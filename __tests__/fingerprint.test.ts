import { describe, it, expect, beforeEach } from 'vitest'
import { getOrCreateClientToken, generateRespondentFingerprint } from '@/lib/fingerprint'

describe('fingerprint utilities', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.cookie.split(';').forEach((c) => {
      document.cookie = c
        .replace(/^ +/, '')
        .replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/')
    })
  })

  describe('getOrCreateClientToken', () => {
    it('should generate a valid UUID v4 token when none exists', () => {
      const token = getOrCreateClientToken()
      expect(token).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      )
    })

    it('should persist the token in localStorage and cookies', () => {
      const token = getOrCreateClientToken()
      expect(window.localStorage.getItem('openform_client_token')).toBe(token)
      expect(document.cookie).toContain(`survey_client_token=${token}`)
    })

    it('should reuse existing token from localStorage if valid UUID', () => {
      const existing = '12345678-1234-4234-8234-123456789abc'
      window.localStorage.setItem('openform_client_token', existing)

      const token = getOrCreateClientToken()
      expect(token).toBe(existing)
    })

    it('should sync token from cookie if localStorage was cleared', () => {
      const cookieToken = '87654321-4321-4321-8321-cba987654321'
      document.cookie = `survey_client_token=${cookieToken}; path=/`

      const token = getOrCreateClientToken()
      expect(token).toBe(cookieToken)
      expect(window.localStorage.getItem('openform_client_token')).toBe(cookieToken)
    })
  })

  describe('generateRespondentFingerprint', () => {
    it('should generate a 64-character SHA-256 hash and return the clientToken', async () => {
      const { respondentHash, clientToken } = await generateRespondentFingerprint('test-form-123')

      expect(clientToken).toBeTruthy()
      expect(respondentHash).toMatch(/^[0-9a-f]{16,64}$/)
    })

    it('should produce deterministic hash for identical form and entropy in the same session', async () => {
      const fp1 = await generateRespondentFingerprint('form-a')
      const fp2 = await generateRespondentFingerprint('form-a')

      expect(fp1.respondentHash).toBe(fp2.respondentHash)
      expect(fp1.clientToken).toBe(fp2.clientToken)
    })

    it('should produce distinct hashes for different forms with the same client token', async () => {
      const fpA = await generateRespondentFingerprint('form-alpha')
      const fpB = await generateRespondentFingerprint('form-beta')

      expect(fpA.respondentHash).not.toBe(fpB.respondentHash)
    })
  })
})
