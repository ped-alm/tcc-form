import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { submitResponseAction } from '@/app/actions/submit-response'
import { EXAMPLE_FORM_ID } from '@/lib/example-form'
import { createAdminClient, createClient } from '@/lib/supabase/server'

let mockClientIp: string | null = null
let autoIpCounter = 1
const mockCookieSet = vi.fn()
const mockCookieMap = new Map<string, { value: string }>()

// Mock @/lib/supabase/server
vi.mock('@/lib/supabase/server', () => {
  return {
    createAdminClient: vi.fn(),
    createClient: vi.fn(),
  }
})

// Mock next/headers
vi.mock('next/headers', () => {
  return {
    headers: vi.fn(async () => {
      const h = new Map<string, string>()
      const ip = mockClientIp || `127.0.0.${autoIpCounter++}`
      h.set('x-forwarded-for', ip)
      return {
        get: (key: string) => h.get(key) || null,
      }
    }),
    cookies: vi.fn(async () => {
      return {
        get: (key: string) => mockCookieMap.get(key),
        set: mockCookieSet,
      }
    }),
  }
})

describe('submitResponseAction', () => {
  beforeEach(() => {
    mockCookieSet.mockClear()
    mockCookieMap.clear()
  })
  it('should reject submission when required answers are missing', async () => {
    const result = await submitResponseAction({
      formId: EXAMPLE_FORM_ID,
      answers: {},
      clientToken: '00000000-0000-4000-8000-000000000001',
    })

    expect(result.success).toBe(false)
    expect(result.validationErrors).toBeDefined()
    expect(result.validationErrors?.['q01-consentimento']).toBeDefined()
  })

  it('should return English validation errors and error summary when respondent language is en', async () => {
    const result = await submitResponseAction({
      formId: EXAMPLE_FORM_ID,
      answers: {
        _survey_language: 'en',
      },
      clientToken: '00000000-0000-4000-8000-000000000001',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Please review the highlighted questions before submitting.')
    expect(result.validationErrors?.['q01-consentimento']).toBe('This field is required')
  })

  it('should return Portuguese validation errors and error summary when respondent language is pt', async () => {
    const result = await submitResponseAction({
      formId: EXAMPLE_FORM_ID,
      answers: {
        _survey_language: 'pt',
      },
      clientToken: '00000000-0000-4000-8000-000000000001',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Por favor, revise os campos destacados antes de enviar.')
    expect(result.validationErrors?.['q01-consentimento']).toBe('Este campo é obrigatório')
  })

  it('should reject malformed or non-object payloads with payload format error', async () => {
    const testCases: unknown[] = [
      null,
      undefined,
      {},
      { answers: null },
      { formId: 'invalid-non-uuid', answers: {} },
      { formId: EXAMPLE_FORM_ID },
      { formId: EXAMPLE_FORM_ID, answers: 'not-an-object' },
      {
        formId: EXAMPLE_FORM_ID,
        answers: {},
        clientToken: 'a'.repeat(129),
      },
    ]

    for (const testPayload of testCases) {
      const res = await submitResponseAction(testPayload)
      expect(res.success).toBe(false)
      expect(res.error).toBe('Invalid request payload format.')
    }
  })

  it('should reject submission when form is unknown or unpublished', async () => {
    const result = await submitResponseAction({
      formId: '00000000-0000-4000-8000-000000000000',
      answers: {},
      clientToken: '00000000-0000-4000-8000-000000000002',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Form not found.')
  })

  it('should enforce rate limiting on repeated rapid submissions', async () => {
    mockClientIp = '10.99.88.77'
    const spamToken = 'rate-limit-test-token'
    
    // Simulate multiple requests hitting rate limit
    let blocked = false
    try {
      for (let i = 0; i < 15; i++) {
        const res = await submitResponseAction({
          formId: '00000000-0000-4000-8000-000000000099',
          answers: {},
          clientToken: spamToken,
        })
        if (res.error?.includes('Rate limit exceeded')) {
          blocked = true
          break
        }
      }
    } finally {
      mockClientIp = null
    }

    expect(blocked).toBe(true)
  })

  it('should prevent race condition duplicates under concurrent submissions with identical respondentHash', async () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const originalAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key'

    const testFormId = '00000000-0000-4000-8000-000000000099'
    const testRespondentHash = 'hash-concurrent-test-12345'
    const insertedResponses: Array<{ form_id: string; respondent_hash: string | null; answers: unknown }> = []

    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === 'forms') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: testFormId,
                    status: 'published',
                    questions: [],
                  },
                  error: null,
                })),
              })),
            })),
          }
        }

        if (table === 'responses') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => {
                    // Simulate concurrency delay where both requests perform read check before either inserts
                    await new Promise((resolve) => setTimeout(resolve, 25))
                    const existing = insertedResponses.find(
                      (r) => r.form_id === testFormId && r.respondent_hash === testRespondentHash
                    )
                    return {
                      data: existing ? { id: 'existing-id' } : null,
                      error: null,
                    }
                  }),
                })),
              })),
            })),
            insert: vi.fn(async (data: { form_id: string; respondent_hash: string | null; answers: unknown }) => {
              // Simulate PostgreSQL unique constraint: CREATE UNIQUE INDEX idx_responses_unique_respondent
              // ON responses(form_id, respondent_hash) WHERE respondent_hash IS NOT NULL;
              const hasConflict =
                data.respondent_hash &&
                insertedResponses.some(
                  (r) => r.form_id === data.form_id && r.respondent_hash === data.respondent_hash
                )

              if (hasConflict) {
                return {
                  data: null,
                  error: {
                    code: '23505',
                    message: 'duplicate key value violates unique constraint "idx_responses_unique_respondent"',
                    details: `Key (form_id, respondent_hash)=(${data.form_id}, ${data.respondent_hash}) already exists.`,
                  },
                }
              }

              insertedResponses.push(data)
              return { data, error: null }
            }),
          }
        }

        return {}
      }),
    }

    vi.mocked(createAdminClient).mockReturnValue(mockClient as unknown as ReturnType<typeof createAdminClient>)
    vi.mocked(createClient).mockResolvedValue(mockClient as unknown as Awaited<ReturnType<typeof createClient>>)

    try {
      const [res1, res2] = await Promise.all([
        submitResponseAction({
          formId: testFormId,
          answers: {},
          respondentHash: testRespondentHash,
          clientToken: 'token-concurrency-1',
        }),
        submitResponseAction({
          formId: testFormId,
          answers: {},
          respondentHash: testRespondentHash,
          clientToken: 'token-concurrency-2',
        }),
      ])

      // Both promises should resolve successfully
      expect(res1.success).toBe(true)
      expect(res2.success).toBe(true)

      // Exactly one row was inserted into the database
      expect(insertedResponses).toHaveLength(1)
      expect(insertedResponses[0].form_id).toBe(testFormId)
      expect(insertedResponses[0].respondent_hash).toBe(testRespondentHash)

      // At least one returned isDuplicate: true, and exactly one of them did
      const duplicateCount = [res1.isDuplicate, res2.isDuplicate].filter(Boolean).length
      expect(duplicateCount).toBe(1)
    } finally {
      if (originalUrl) {
        process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
      } else {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL
      }
      if (originalAnonKey) {
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey
      } else {
        delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      }
      if (originalServiceKey) {
        process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey
      } else {
        delete process.env.SUPABASE_SERVICE_ROLE_KEY
      }
      vi.mocked(createAdminClient).mockReset()
      vi.mocked(createClient).mockReset()
    }
  })

  it('should deduplicate responses via submit_survey_response RPC when running under anon client role without service role key', async () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const originalAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key'
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    const testFormId = '00000000-0000-4000-8000-000000000088'
    const testRespondentHash = 'anon-rpc-test-hash-456'
    const dbStoredResponses: Array<{ form_id: string; respondent_hash: string | null; answers: unknown }> = []

    const rpcMock = vi.fn(
      async (
        fnName: string,
        args: { p_form_id: string; p_answers: unknown; p_respondent_hash: string | null }
      ) => {
        expect(fnName).toBe('submit_survey_response')
        expect(args.p_form_id).toBe(testFormId)
        expect(args.p_respondent_hash).toBe(testRespondentHash)

        // Simulate PostgreSQL SECURITY DEFINER function logic
        const isExisting = dbStoredResponses.some(
          (r) => r.form_id === args.p_form_id && r.respondent_hash === args.p_respondent_hash
        )

        if (isExisting) {
          return {
            data: { success: true, is_duplicate: true },
            error: null,
          }
        }

        dbStoredResponses.push({
          form_id: args.p_form_id,
          respondent_hash: args.p_respondent_hash,
          answers: args.p_answers,
        })

        return {
          data: { success: true, is_duplicate: false, id: 'resp-uuid-123' },
          error: null,
        }
      }
    )

    const mockAnonClient = {
      from: vi.fn((table: string) => {
        if (table === 'forms') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: testFormId,
                    status: 'published',
                    questions: [],
                  },
                  error: null,
                })),
              })),
            })),
          }
        }
        return {}
      }),
      rpc: rpcMock,
    }

    // createAdminClient returns null when SUPABASE_SERVICE_ROLE_KEY is absent
    vi.mocked(createAdminClient).mockReturnValue(null)
    vi.mocked(createClient).mockResolvedValue(mockAnonClient as unknown as Awaited<ReturnType<typeof createClient>>)

    try {
      // 1. First submission by anonymous user
      const res1 = await submitResponseAction({
        formId: testFormId,
        answers: {},
        respondentHash: testRespondentHash,
        clientToken: 'token-rpc-1',
      })

      expect(res1.success).toBe(true)
      expect(res1.isDuplicate).toBeFalsy()
      expect(dbStoredResponses).toHaveLength(1)
      expect(rpcMock).toHaveBeenCalledTimes(1)

      // 2. Second submission with identical respondentHash (even if cookies were cleared)
      const res2 = await submitResponseAction({
        formId: testFormId,
        answers: {},
        respondentHash: testRespondentHash,
        clientToken: 'token-rpc-2',
      })

      expect(res2.success).toBe(true)
      expect(res2.isDuplicate).toBe(true)
      expect(dbStoredResponses).toHaveLength(1) // Still exactly 1 record
      expect(rpcMock).toHaveBeenCalledTimes(2)
    } finally {
      if (originalUrl) {
        process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
      } else {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL
      }
      if (originalAnonKey) {
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey
      } else {
        delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      }
      if (originalServiceKey) {
        process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey
      } else {
        delete process.env.SUPABASE_SERVICE_ROLE_KEY
      }
      vi.mocked(createAdminClient).mockReset()
      vi.mocked(createClient).mockReset()
    }
  })

  describe('fallback direct insert RLS compatibility', () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const originalAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const testFormId = '00000000-0000-4000-8000-000000000077'

    beforeEach(() => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key'
    })

    afterEach(() => {
      if (originalUrl) {
        process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
      } else {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL
      }
      if (originalAnonKey) {
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey
      } else {
        delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      }
      if (originalServiceKey) {
        process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey
      } else {
        delete process.env.SUPABASE_SERVICE_ROLE_KEY
      }
      vi.mocked(createAdminClient).mockReset()
      vi.mocked(createClient).mockReset()
    })

    it('should handle duplicate responses in fallback submission via Postgres unique violation (23505) without performing anonymous SELECT on responses', async () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY
      vi.mocked(createAdminClient).mockReturnValue(null)

      const testRespondentHash = 'fallback-anon-duplicate-hash'
      const responsesSelectSpy = vi.fn()
      const responsesInsertSpy = vi.fn(async () => ({
        data: null,
        error: {
          code: '23505',
          message: 'duplicate key value violates unique constraint "idx_responses_unique_respondent"',
          details: `Key (form_id, respondent_hash)=(${testFormId}, ${testRespondentHash}) already exists.`,
        },
      }))

      const mockAnonClient = {
        from: vi.fn((table: string) => {
          if (table === 'forms') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: testFormId,
                      status: 'published',
                      questions: [],
                    },
                    error: null,
                  })),
                })),
              })),
            }
          }
          if (table === 'responses') {
            return {
              select: responsesSelectSpy,
              insert: responsesInsertSpy,
            }
          }
          return {}
        }),
      }

      vi.mocked(createClient).mockResolvedValue(mockAnonClient as unknown as Awaited<ReturnType<typeof createClient>>)

      const result = await submitResponseAction({
        formId: testFormId,
        answers: {},
        respondentHash: testRespondentHash,
        clientToken: 'token-fallback-dup',
      })

      expect(result.success).toBe(true)
      expect(result.isDuplicate).toBe(true)
      expect(mockCookieSet).toHaveBeenCalledWith(
        `survey_submitted_${testFormId}`,
        '1',
        expect.objectContaining({ httpOnly: true, path: '/' })
      )
      // Anonymous client MUST NOT attempt SELECT on responses under RLS
      expect(responsesSelectSpy).not.toHaveBeenCalled()
      // Insert must be invoked directly with respondent_hash
      expect(responsesInsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          form_id: testFormId,
          respondent_hash: testRespondentHash,
        })
      )
    })

    it('should insert response successfully in fallback submission under anon role without chaining .select() and without triggering RLS error', async () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY
      vi.mocked(createAdminClient).mockReturnValue(null)

      const testRespondentHash = 'fallback-anon-new-hash'
      const responsesSelectSpy = vi.fn(() => {
        throw new Error('RLS Error: SELECT permission denied for table responses under anonymous role (code 42501)')
      })
      const responsesInsertSpy = vi.fn(async (data: unknown) => ({
        data,
        error: null,
      }))

      const mockAnonClient = {
        from: vi.fn((table: string) => {
          if (table === 'forms') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: testFormId,
                      status: 'published',
                      questions: [],
                    },
                    error: null,
                  })),
                })),
              })),
            }
          }
          if (table === 'responses') {
            return {
              select: responsesSelectSpy,
              insert: responsesInsertSpy,
            }
          }
          return {}
        }),
      }

      vi.mocked(createClient).mockResolvedValue(mockAnonClient as unknown as Awaited<ReturnType<typeof createClient>>)

      const result = await submitResponseAction({
        formId: testFormId,
        answers: {},
        respondentHash: testRespondentHash,
        clientToken: 'token-fallback-new',
      })

      expect(result.success).toBe(true)
      expect(result.isDuplicate).toBeFalsy()
      expect(mockCookieSet).toHaveBeenCalledWith(
        `survey_submitted_${testFormId}`,
        '1',
        expect.objectContaining({ httpOnly: true, path: '/' })
      )
      expect(responsesSelectSpy).not.toHaveBeenCalled()
      expect(responsesInsertSpy).toHaveBeenCalledTimes(1)
    })

    it('should execute pre-check SELECT when running with admin privileges (SUPABASE_SERVICE_ROLE_KEY configured)', async () => {
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key'

      const testRespondentHash = 'fallback-admin-precheck-hash'
      const adminSelectSpy = vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: { id: 'admin-existing-response-id' },
              error: null,
            })),
          })),
        })),
      }))
      const adminInsertSpy = vi.fn()

      const mockAdminClient = {
        from: vi.fn((table: string) => {
          if (table === 'forms') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: testFormId,
                      status: 'published',
                      questions: [],
                    },
                    error: null,
                  })),
                })),
              })),
            }
          }
          if (table === 'responses') {
            return {
              select: adminSelectSpy,
              insert: adminInsertSpy,
            }
          }
          return {}
        }),
      }

      vi.mocked(createAdminClient).mockReturnValue(mockAdminClient as unknown as ReturnType<typeof createAdminClient>)
      vi.mocked(createClient).mockResolvedValue(mockAdminClient as unknown as Awaited<ReturnType<typeof createClient>>)

      const result = await submitResponseAction({
        formId: testFormId,
        answers: {},
        respondentHash: testRespondentHash,
        clientToken: 'token-admin-precheck',
      })

      expect(result.success).toBe(true)
      expect(result.isDuplicate).toBe(true)
      // Admin client performs explicit pre-check SELECT
      expect(adminSelectSpy).toHaveBeenCalledTimes(1)
      // Since duplicate was detected in pre-check, insert is skipped
      expect(adminInsertSpy).not.toHaveBeenCalled()
      expect(mockCookieSet).toHaveBeenCalledWith(
        `survey_submitted_${testFormId}`,
        '1',
        expect.objectContaining({ httpOnly: true, path: '/' })
      )
    })

    it('should fall back to direct insert if RPC returns 42883 (function does not exist)', async () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY
      vi.mocked(createAdminClient).mockReturnValue(null)

      const testRespondentHash = 'rpc-missing-fallback-hash'
      const rpcSpy = vi.fn(async () => ({
        data: null,
        error: { code: '42883', message: 'function submit_survey_response does not exist' },
      }))
      const responsesSelectSpy = vi.fn()
      const responsesInsertSpy = vi.fn(async (data: unknown) => ({ data, error: null }))

      const mockAnonClient = {
        rpc: rpcSpy,
        from: vi.fn((table: string) => {
          if (table === 'forms') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: testFormId,
                      status: 'published',
                      questions: [],
                    },
                    error: null,
                  })),
                })),
              })),
            }
          }
          if (table === 'responses') {
            return {
              select: responsesSelectSpy,
              insert: responsesInsertSpy,
            }
          }
          return {}
        }),
      }

      vi.mocked(createClient).mockResolvedValue(mockAnonClient as unknown as Awaited<ReturnType<typeof createClient>>)

      const result = await submitResponseAction({
        formId: testFormId,
        answers: {},
        respondentHash: testRespondentHash,
        clientToken: 'token-rpc-missing',
      })

      expect(result.success).toBe(true)
      expect(rpcSpy).toHaveBeenCalledTimes(1)
      // When falling back under anon role, no SELECT on responses is performed
      expect(responsesSelectSpy).not.toHaveBeenCalled()
      // Insert is executed via direct fallback path
      expect(responsesInsertSpy).toHaveBeenCalledTimes(1)
      expect(mockCookieSet).toHaveBeenCalledWith(
        `survey_submitted_${testFormId}`,
        '1',
        expect.objectContaining({ httpOnly: true, path: '/' })
      )
    })
  })

  describe('unconfigured database credentials handling', () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const originalAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    const validAnswersPT = {
      'q01-consentimento': 'Sim, concordo.',
      'q02-atuacao-software': 'Sim.',
      'q03-formacao-academica': 'Graduação concluída.',
      'q04-formacao-computacao': 'Sim.',
      'q05-estudou-es': 'Sim.',
      'q06-experiencia-jogos': '3 a menos de 6 anos.',
      'q07-experiencia-outros-softwares': 'Não.',
      'q08-tamanho-equipe': '2 a 5 (Micro).',
      'q09-conhecimento-topicos': {
        processos: '3',
        requisitos: '3',
        modelagem: '3',
        padroes: '3',
        arquitetura: '3',
        testes: '3',
        refatoracao: '3',
        devops: '3',
        versionamento: '3',
      },
      'q10-frequencia-aplicacao': {
        processos: '3',
        requisitos: '3',
        modelagem: '3',
        padroes: '3',
        arquitetura: '3',
        testes: '3',
        refatoracao: '3',
        devops: '3',
        versionamento: '3',
      },
      'q15-correspondencia-conteudos': 'Totalmente.',
      _survey_language: 'pt',
    }

    const validAnswersEN = {
      'q01-consentimento': 'Yes, I agree.',
      'q02-atuacao-software': 'Yes.',
      'q03-formacao-academica': 'Undergraduate degree completed (Bachelor’s / Licentiate).',
      'q04-formacao-computacao': 'Yes.',
      'q05-estudou-es': 'Yes.',
      'q06-experiencia-jogos': '3 to less than 6 years.',
      'q07-experiencia-outros-softwares': 'No.',
      'q08-tamanho-equipe': '2 to 5 (Micro).',
      'q09-conhecimento-topicos': {
        processos: '3',
        requisitos: '3',
        modelagem: '3',
        padroes: '3',
        arquitetura: '3',
        testes: '3',
        refatoracao: '3',
        devops: '3',
        versionamento: '3',
      },
      'q10-frequencia-aplicacao': {
        processos: '3',
        requisitos: '3',
        modelagem: '3',
        padroes: '3',
        arquitetura: '3',
        testes: '3',
        refatoracao: '3',
        devops: '3',
        versionamento: '3',
      },
      'q15-correspondencia-conteudos': 'Completely.',
      _survey_language: 'en',
    }

    afterEach(() => {
      if (originalUrl) {
        process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
      } else {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL
      }
      if (originalAnonKey) {
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey
      } else {
        delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      }
      vi.mocked(createAdminClient).mockReset()
      vi.mocked(createClient).mockReset()
    })

    it('should return success: false with localized Portuguese message and not set completion cookie when Supabase env vars are undefined', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      const result = await submitResponseAction({
        formId: EXAMPLE_FORM_ID,
        answers: validAnswersPT,
        clientToken: 'token-unconfigured-db-pt',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe(
        'O serviço de banco de dados está indisponível no momento. Por favor, entre em contato com o administrador.'
      )
      expect(mockCookieSet).not.toHaveBeenCalled()
    })

    it('should return success: false with localized English message and not set completion cookie when Supabase env vars are undefined', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      const result = await submitResponseAction({
        formId: EXAMPLE_FORM_ID,
        answers: validAnswersEN,
        clientToken: 'token-unconfigured-db-en',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe(
        'Database service is currently unavailable. Please contact the administrator.'
      )
      expect(mockCookieSet).not.toHaveBeenCalled()
    })

    it('should return success: false when either NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing or empty whitespace', async () => {
      // Only URL set
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock.supabase.co'
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      const res1 = await submitResponseAction({
        formId: EXAMPLE_FORM_ID,
        answers: validAnswersEN,
        clientToken: 'token-partial-env-1',
      })
      expect(res1.success).toBe(false)
      expect(res1.error).toBe(
        'Database service is currently unavailable. Please contact the administrator.'
      )
      expect(mockCookieSet).not.toHaveBeenCalled()

      // Only anon key set
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key'

      const res2 = await submitResponseAction({
        formId: EXAMPLE_FORM_ID,
        answers: validAnswersEN,
        clientToken: 'token-partial-env-2',
      })
      expect(res2.success).toBe(false)
      expect(res2.error).toBe(
        'Database service is currently unavailable. Please contact the administrator.'
      )
      expect(mockCookieSet).not.toHaveBeenCalled()

      // Whitespace only
      process.env.NEXT_PUBLIC_SUPABASE_URL = '   '
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key'

      const res3 = await submitResponseAction({
        formId: EXAMPLE_FORM_ID,
        answers: validAnswersEN,
        clientToken: 'token-partial-env-3',
      })
      expect(res3.success).toBe(false)
      expect(res3.error).toBe(
        'Database service is currently unavailable. Please contact the administrator.'
      )
      expect(mockCookieSet).not.toHaveBeenCalled()
    })

    it('should successfully submit and set completion cookie when database credentials are fully configured', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key'

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === 'responses') {
            return {
              insert: vi.fn(async () => ({ data: {}, error: null })),
            }
          }
          return {}
        }),
      }

      vi.mocked(createAdminClient).mockReturnValue(null)
      vi.mocked(createClient).mockResolvedValue(mockClient as unknown as Awaited<ReturnType<typeof createClient>>)

      const result = await submitResponseAction({
        formId: EXAMPLE_FORM_ID,
        answers: validAnswersPT,
        clientToken: 'token-configured-db',
      })

      expect(result.success).toBe(true)
      expect(mockCookieSet).toHaveBeenCalledWith(
        `survey_submitted_${EXAMPLE_FORM_ID}`,
        '1',
        expect.objectContaining({
          httpOnly: true,
          path: '/',
        })
      )
    })
  })
})
