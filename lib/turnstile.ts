/**
 * Cloudflare Turnstile token verification utility.
 * Verifies submitted client tokens against Cloudflare's siteverify API.
 */

export interface TurnstileVerificationResult {
  success: boolean
  error?: string
  challengeTs?: string
  hostname?: string
  errorCodes?: string[]
}

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export async function verifyTurnstileToken(
  token?: string,
  remoteIp?: string
): Promise<TurnstileVerificationResult> {
  const secretKey =
    process.env.TURNSTILE_SECRET_KEY || process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY

  // In development, testing, or if no secret key is configured, bypass verification
  if (!secretKey) {
    return { success: true }
  }

  if (!token) {
    return {
      success: false,
      error: 'Turnstile verification token is missing.',
      errorCodes: ['missing-input-response'],
    }
  }

  try {
    const body = new URLSearchParams()
    body.append('secret', secretKey)
    body.append('response', token)
    if (remoteIp && remoteIp !== 'unknown-client') {
      body.append('remoteip', remoteIp)
    }

    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })

    if (!response.ok) {
      return {
        success: false,
        error: `Cloudflare Turnstile verification request failed with HTTP ${response.status}`,
        errorCodes: ['http-error'],
      }
    }

    const data = (await response.json()) as {
      success: boolean
      'challenge_ts'?: string
      hostname?: string
      'error-codes'?: string[]
    }

    if (!data.success) {
      return {
        success: false,
        error: 'Security challenge verification failed.',
        errorCodes: data['error-codes'] || [],
      }
    }

    return {
      success: true,
      challengeTs: data['challenge_ts'],
      hostname: data.hostname,
    }
  } catch (err) {
    console.error('Turnstile verification network error:', err)
    return {
      success: false,
      error: 'Network error during Turnstile token verification.',
      errorCodes: ['network-error'],
    }
  }
}
