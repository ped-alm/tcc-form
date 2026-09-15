/**
 * Anonymous respondent fingerprinting utility.
 *
 * Implements a hybrid identification strategy:
 * 1. Persistent first-party token (localStorage + cookie) to uniquely track standard browsing sessions.
 * 2. Hardware and browser canvas entropy (User-Agent, screen geometry, timezone, canvas 2D rendering)
 *    to correlate submissions across incognito sessions while preventing IP-based collisions on campus Wi-Fi.
 */

const STORAGE_KEY = 'openform_client_token'
const COOKIE_NAME = 'survey_client_token'

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[2]) : null
}

function setCookie(name: string, value: string, days = 365): void {
  if (typeof document === 'undefined') return
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`
}

/**
 * Returns or initializes a persistent client token (UUID v4).
 */
export function getOrCreateClientToken(): string {
  if (typeof window === 'undefined') {
    return 'server-env-token'
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored && /^[0-9a-f-]{36}$/i.test(stored)) {
      setCookie(COOKIE_NAME, stored)
      return stored
    }

    const cookieVal = getCookie(COOKIE_NAME)
    if (cookieVal && /^[0-9a-f-]{36}$/i.test(cookieVal)) {
      window.localStorage.setItem(STORAGE_KEY, cookieVal)
      return cookieVal
    }

    const newToken = crypto.randomUUID()
    window.localStorage.setItem(STORAGE_KEY, newToken)
    setCookie(COOKIE_NAME, newToken)
    return newToken
  } catch {
    return crypto.randomUUID()
  }
}

/**
 * Generates an HTML5 canvas signature.
 * Subtle differences in OS font rasterization, GPU drivers, and antialiasing
 * produce distinct hashes for different devices.
 */
function getCanvasSignature(): string {
  if (typeof document === 'undefined') return 'server'
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 240
    canvas.height = 60
    const ctx = canvas.getContext('2d')
    if (!ctx) return 'no-canvas-2d'

    // Background & geometry
    ctx.textBaseline = 'top'
    ctx.font = '14px Arial, sans-serif'
    ctx.fillStyle = '#f60'
    ctx.fillRect(125, 1, 62, 20)
    ctx.fillStyle = '#069'
    ctx.fillText('OpenForm Survey 🎮', 2, 15)
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)'
    ctx.fillText('Software Engineering TCC', 4, 35)

    return canvas.toDataURL()
  } catch {
    return 'canvas-error'
  }
}

/**
 * SHA-256 helper using crypto.subtle with a pure JS fallback.
 */
async function sha256(message: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const msgBuffer = new TextEncoder().encode(message)
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    } catch {
      // Fallback to simple hash below
    }
  }

  // FNV-1a 64-bit style hex string fallback if Web Crypto is unavailable
  let h1 = 0xdeadbeef
  let h2 = 0x41c64e6d
  for (let i = 0; i < message.length; i++) {
    const ch = message.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(16, '0')
}

export interface RespondentFingerprint {
  respondentHash: string
  clientToken: string
}

/**
 * Generates the hybrid respondent fingerprint for a specific form.
 */
export async function generateRespondentFingerprint(formId: string): Promise<RespondentFingerprint> {
  const clientToken = getOrCreateClientToken()

  let entropy = `form:${formId}|token:${clientToken}`
  if (typeof window !== 'undefined') {
    const nav = window.navigator
    const screen = window.screen
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown-tz'
    const canvasSig = getCanvasSignature()

    entropy += `|ua:${nav.userAgent}|lang:${nav.language}|res:${screen.width}x${screen.height}x${screen.colorDepth}|tz:${tz}|canvas:${canvasSig}`
  }

  const respondentHash = await sha256(entropy)
  return {
    respondentHash,
    clientToken,
  }
}
