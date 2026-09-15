import { describe, it, expect, vi } from 'vitest'
import { submitResponseAction } from '@/app/actions/submit-response'
import { EXAMPLE_FORM_ID } from '@/lib/example-form'

// Mock next/headers
vi.mock('next/headers', () => {
  return {
    headers: vi.fn(async () => {
      const h = new Map<string, string>()
      h.set('x-forwarded-for', '127.0.0.1')
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

  it('should reject submission when form is unknown or unpublished', async () => {
    const result = await submitResponseAction({
      formId: 'non-existent-form-id',
      answers: {},
      clientToken: '00000000-0000-4000-8000-000000000002',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Form not found.')
  })

  it('should enforce rate limiting on repeated rapid submissions', async () => {
    const spamToken = 'rate-limit-test-token'
    
    // Simulate multiple requests hitting rate limit
    let blocked = false
    for (let i = 0; i < 15; i++) {
      const res = await submitResponseAction({
        formId: 'invalid-id',
        answers: {},
        clientToken: spamToken,
      })
      if (res.error?.includes('Rate limit exceeded')) {
        blocked = true
        break
      }
    }

    expect(blocked).toBe(true)
  })
})
