import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { verifyTurnstileToken } from '@/lib/turnstile'

describe('Cloudflare Turnstile Verification Utility', () => {
  const originalEnv = process.env
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('bypasses verification when no TURNSTILE_SECRET_KEY is configured in development or test', async () => {
    delete process.env.TURNSTILE_SECRET_KEY
    delete process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY

    const result = await verifyTurnstileToken()
    expect(result.success).toBe(true)
  })

  it('fails verification when TURNSTILE_SECRET_KEY is configured but token is missing', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret-key'

    const result = await verifyTurnstileToken(undefined, '127.0.0.1')
    expect(result.success).toBe(false)
    expect(result.error).toContain('missing')
    expect(result.errorCodes).toContain('missing-input-response')
  })

  it('succeeds when Cloudflare siteverify endpoint confirms a valid token', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'valid-secret-key'

    const mockResponse = {
      success: true,
      challenge_ts: '2026-09-15T15:00:00Z',
      hostname: 'example.com',
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    }) as unknown as typeof fetch

    const result = await verifyTurnstileToken('valid-token-123', '192.168.1.10')

    expect(result.success).toBe(true)
    expect(result.challengeTs).toBe('2026-09-15T15:00:00Z')
    expect(result.hostname).toBe('example.com')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.objectContaining({
        method: 'POST',
      })
    )
  })

  it('fails verification when Cloudflare siteverify rejects the token', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'valid-secret-key'

    const mockResponse = {
      success: false,
      'error-codes': ['invalid-input-response'],
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    }) as unknown as typeof fetch

    const result = await verifyTurnstileToken('bad-token-xyz', '127.0.0.1')

    expect(result.success).toBe(false)
    expect(result.errorCodes).toContain('invalid-input-response')
  })

  it('handles HTTP error responses from Cloudflare gracefully', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'valid-secret-key'

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
    }) as unknown as typeof fetch

    const result = await verifyTurnstileToken('any-token', '127.0.0.1')

    expect(result.success).toBe(false)
    expect(result.errorCodes).toContain('http-error')
  })

  it('handles network exceptions during verification gracefully', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'valid-secret-key'

    global.fetch = vi.fn().mockRejectedValue(new Error('Connection timed out')) as unknown as typeof fetch

    const result = await verifyTurnstileToken('any-token', '127.0.0.1')

    expect(result.success).toBe(false)
    expect(result.errorCodes).toContain('network-error')
  })
})
