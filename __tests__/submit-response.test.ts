import { describe, it, expect, vi } from 'vitest'
import { submitResponseAction } from '@/app/actions/submit-response'
import { EXAMPLE_FORM_ID } from '@/lib/example-form'
import { createAdminClient, createClient } from '@/lib/supabase/server'

let mockClientIp: string | null = null
let autoIpCounter = 1

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
      const c = new Map<string, { value: string }>()
      return {
        get: (key: string) => c.get(key),
        set: vi.fn(),
      }
    }),
  }
})

describe('submitResponseAction', () => {
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

  it('should reject submission if Turnstile bot verification fails', async () => {
    const originalSecret = process.env.TURNSTILE_SECRET_KEY
    process.env.TURNSTILE_SECRET_KEY = 'mock-secret'

    try {
      const res = await submitResponseAction({
        formId: EXAMPLE_FORM_ID,
        answers: {},
        clientToken: '00000000-0000-4000-8000-000000000003',
        // Omit turnstileToken
      })

      expect(res.success).toBe(false)
      expect(res.error).toMatch(/segurança|verification/i)
    } finally {
      if (originalSecret) {
        process.env.TURNSTILE_SECRET_KEY = originalSecret
      } else {
        delete process.env.TURNSTILE_SECRET_KEY
      }
    }
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
})
