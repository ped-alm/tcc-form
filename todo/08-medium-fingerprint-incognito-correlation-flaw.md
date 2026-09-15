# Task: Fix Respondent Fingerprint Entropy Implementation Discrepancy

**Severity**: MEDIUM  
**Category**: Correctness / Deduplication  
**Status**: Verified Issue  
**Files**: `lib/fingerprint.ts` (lines 6-7, 28-53, 122-134)

---

### What is wrong
The file documentation for `lib/fingerprint.ts` claims:
```text
2. Hardware and browser canvas entropy (User-Agent, screen geometry, timezone, canvas 2D rendering)
   to correlate submissions across incognito sessions while preventing IP-based collisions on campus Wi-Fi.
```
However, in `generateRespondentFingerprint`:
```ts
export async function generateRespondentFingerprint(formId: string): Promise<RespondentFingerprint> {
  const clientToken = getOrCreateClientToken()

  let entropy = `form:${formId}|token:${clientToken}`
  if (typeof window !== 'undefined') {
    // ... adds user-agent, canvas, screen geometry ...
  }

  const respondentHash = await sha256(entropy)
  return { respondentHash, clientToken }
}
```
`clientToken` is generated as `crypto.randomUUID()` and stored in `localStorage` and a cookie.
When a user opens an incognito / private browsing window:
`localStorage` and cookies are completely empty. `getOrCreateClientToken()` therefore creates a brand new random UUID.
Because the fresh `clientToken` is prepended to the entropy string (`|token:${clientToken}`), hashing produces an entirely different `respondentHash`, regardless of identical canvas, screen, and browser parameters.

### Why it matters
The implementation contradicts its stated architectural objective. An anonymous respondent can open an incognito window and immediately submit the survey again with a completely different `respondentHash`, bypassing both cookie and database hash deduplication.

### Concrete recommended fix
Either:
1. **True hardware fingerprinting**: Separate the hardware fingerprint from the random session token:
```ts
// Stable device hash (does not mix clientToken into entropy)
let deviceEntropy = `form:${formId}|ua:${nav.userAgent}|res:${screen.width}x${screen.height}|tz:${tz}|canvas:${canvasSig}`
const respondentHash = await sha256(deviceEntropy)
```
2. **Accept session-only limitation**: If cross-incognito tracking is undesirable for privacy reasons, update the documentation and architecture to clearly reflect that deduplication is browser-session bound, and remove the claim of correlating across incognito windows.

### Verification
Run `generateRespondentFingerprint` in two contexts with identical screen, navigator, and canvas entropy but different `clientToken`s. Confirm whether the resulting hash is intended to match (device-level) or diverge (token-level), and align the code with the design contract.
