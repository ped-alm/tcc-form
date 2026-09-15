# Task: Implement Zod Schema Validation for Server Action Payload

**Severity**: MEDIUM  
**Category**: Next.js Architecture / Security & Correctness  
**Status**: Verified Issue  
**Files**: `app/actions/submit-response.ts` (lines 15-21, 100-112)

---

### What is wrong
`submitResponseAction(payload: SubmitResponsePayload)` relies on TypeScript compile-time interface types for the incoming `payload` without executing server-side runtime validation of the outer object:
```ts
export async function submitResponseAction(
  payload: SubmitResponsePayload
): Promise<SubmitResponseResult> {
  // ...
  const clientIp = ... || payload.clientToken || 'unknown-client'
  // ...
  const language = (payload.answers._survey_language as SurveyLanguage) || 'pt'
```
Because Server Actions are public, unauthenticated HTTP POST endpoints reachable directly via curl or scripted clients, any client can send unexpected payloads, such as `undefined`, `null`, `{ answers: null }`, or non-UUID `formId`.

### Why it matters
1. If `payload.answers` is undefined or null, accessing `payload.answers._survey_language` immediately throws an unhandled `TypeError: Cannot read properties of undefined (reading '_survey_language')`. This causes Next.js to respond with an opaque HTTP 500 server crash instead of a controlled validation response.
2. If `payload` itself is undefined or non-object, accessing `payload.clientToken` throws a runtime TypeError.
3. Next.js and secure engineering standards require: *"Server Actions are public, unauthenticated POST endpoints. Validate every input with Zod server-side; client validation is UX only."*

### Concrete recommended fix
1. Define a strict Zod schema for the payload:
```ts
import { z } from 'zod'

const SubmitResponsePayloadSchema = z.object({
  formId: z.string().uuid(),
  answers: z.record(z.string(), z.any()),
  respondentHash: z.string().max(128).optional(),
  clientToken: z.string().max(128).optional(),
  turnstileToken: z.string().max(2048).optional(),
})
```
2. Validate the incoming argument at the beginning of `submitResponseAction`:
```ts
export async function submitResponseAction(
  rawPayload: unknown
): Promise<SubmitResponseResult> {
  const parseResult = SubmitResponsePayloadSchema.safeParse(rawPayload)
  if (!parseResult.success) {
    return {
      success: false,
      error: 'Invalid request payload format.',
    }
  }
  const payload = parseResult.data
  // proceed with validated payload...
```

### Verification
Invoke `submitResponseAction({})`, `submitResponseAction({ answers: null })`, and `submitResponseAction(null)`.
Verify that each call gracefully returns `{ success: false, error: 'Invalid request payload format.' }` without throwing unhandled TypeErrors or crashing.
