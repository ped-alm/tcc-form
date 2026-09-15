# Comprehensive Codebase Review Report: `tcc-form`

**Stack**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Supabase (@supabase/ssr + PostgreSQL), Vitest, Playwright.  
**Review Standard**: Senior Engineering Manager / Principal Engineer Persona (Correctness, Security, Architecture, React 19 / Next 16 Best Practices, Database Integrity, Tests).

---

### Executive Summary

An architectural, security, and quality audit was conducted across the entire codebase. The application demonstrates strong visual craft, responsive one-question-at-a-time form player ergonomics, robust CSS variable theming, and thorough question-type modeling.

However, the audit identified **2 CRITICAL** and **4 HIGH** issues that prevent immediate production release:
1. **Critical Data Exposure**: Unauthenticated public clients can query database views (`v_response_answers_normalized`) via PostgREST to read all respondent answers and hashes, bypassing the `responses` table Row Level Security policies.
2. **Critical Submission Lockout**: Cloudflare Turnstile integration creates an infinite re-render loop on the final question, destroying and recreating the widget on every keystroke and wiping solved verification tokens.
3. **Database Race Condition**: Deduplication relies on application-level read-then-write checks without a database-level unique constraint on `(form_id, respondent_hash)`.
4. **Silent RLS Failure**: Without `SUPABASE_SERVICE_ROLE_KEY`, server actions fall back to the public `anon` role, which has no `SELECT` policy on `responses`, silently disabling database deduplication.
5. **Privilege Escalation**: Overly permissive policies (`TO authenticated USING (true)`) allow any signed-in user to delete or modify all forms and survey responses.
6. **TypeScript Contract Errors**: Strict compiler checks (`tsc --noEmit`) fail across multiple test files and schema types.

---

### Issues Ordered by Severity

#### 1. CRITICAL Severity

##### 1.1 Database Analytical Views Bypass RLS on Survey Responses
- **File and Line**: `supabase/schema.sql` (lines 393-430), `supabase/normalized-schema.sql` (lines 302-339)
- **What is wrong**: The analytical views `v_response_answers_normalized` and `v_question_metrics` are defined in the `public` schema without `WITH (security_invoker = true)`. In PostgreSQL 15+ and Supabase, views run with the privileges of the view owner (`postgres`) by default.
- **Why it matters**: The `responses` table has RLS restricting `SELECT` to `authenticated` users only, explicitly preventing anonymous respondents from reading others' answers. Because these views are in `public` without `security_invoker = true`, PostgREST exposes them directly to unauthenticated clients holding `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Any client can fetch `/rest/v1/v_response_answers_normalized` and read all confidential survey answers and respondent hashes.
- **Concrete recommended fix**:
  Add `WITH (security_invoker = true)` to both views and revoke public grants:
  ```sql
  CREATE OR REPLACE VIEW v_response_answers_normalized
  WITH (security_invoker = true) AS
  SELECT ... FROM responses r JOIN questions q ON q.form_id = r.form_id;

  REVOKE ALL ON v_response_answers_normalized FROM anon, public;
  REVOKE ALL ON v_question_metrics FROM anon, public;
  ```
- **Classification**: Verified Issue.

##### 1.2 Cloudflare Turnstile Destruction & Re-render Loop Wipes Tokens
- **File and Line**: `components/form-player/turnstile-widget.tsx` (lines 71-154), `components/form-player/form-player.tsx` (lines 788-796)
- **What is wrong**: `TurnstileWidget` includes callback props (`onToken`, `onError`, `onExpire`) in its `useEffect` dependency array. `FormPlayer` passes fresh inline arrow functions on every render. Typing into the final question triggers `FormPlayer` re-renders, causing the widget effect to re-run, execute `window.turnstile.remove()`, and re-initialize `window.turnstile.render()`.
- **Why it matters**: Once a user solves the CAPTCHA, typing or selecting any option destroys the widget and wipes the token, locking the user out from submitting. On text inputs, typing causes the Turnstile iframe to violently flash and flicker on every keystroke.
- **Concrete recommended fix**:
  Store callbacks in `useRef` inside `TurnstileWidget` and omit them from the initialization `useEffect` dependency array:
  ```tsx
  const onTokenRef = useRef(onToken);
  useEffect(() => { onTokenRef.current = onToken; });
  useEffect(() => {
    // Mount widget once per container / siteKey
  }, [siteKey, theme, size, language]);
  ```
- **Classification**: Verified Issue.

---

#### 2. HIGH Severity

##### 2.1 Missing Database-Level Unique Constraint on Respondent Hash
- **File and Line**: `supabase/schema.sql` (line 38), `app/actions/submit-response.ts` (lines 184-212)
- **What is wrong**: Deduplication is implemented via an application-level read-then-write check (`SELECT id FROM responses ...` then `INSERT`). The index `idx_responses_respondent_hash` in `supabase/schema.sql` is a standard non-unique index.
- **Why it matters**: Concurrent submissions (e.g. user double-clicking submit or network retry races) execute both queries simultaneously, find no existing row, and write duplicate records to the database. The database is the only race-proof backstop.
- **Concrete recommended fix**:
  Replace the index with a partial unique index in `supabase/schema.sql`:
  ```sql
  CREATE UNIQUE INDEX idx_responses_unique_respondent
    ON responses(form_id, respondent_hash)
    WHERE respondent_hash IS NOT NULL;
  ```
  Catch PostgreSQL error code `23505` (unique violation) in `submit-response.ts` and return `{ success: true, isDuplicate: true }`.
- **Classification**: Verified Issue.

##### 2.2 Silent Deduplication Failure Under Anon Client Role
- **File and Line**: `app/actions/submit-response.ts` (lines 61-65, 184-212), `.env.example`, `README.md`
- **What is wrong**: When `SUPABASE_SERVICE_ROLE_KEY` is omitted (which is the default per `.env.example` and `README.md`), `getSupabaseSubmitClient()` falls back to `await createClient()`, operating with the `anon` role. The `responses` table has no `SELECT` policy for `anon`.
- **Why it matters**: The `SELECT id FROM responses` deduplication query returns null on every submission. Database deduplication silently fails, leaving only browser cookies. Clearing cookies or using incognito completely circumvents deduplication.
- **Concrete recommended fix**:
  Either encapsulate response insertion and deduplication inside a PostgreSQL `SECURITY DEFINER` function (`submit_survey_response(...)`), or require and document `SUPABASE_SERVICE_ROLE_KEY` in `.env.example` and `README.md`.
- **Classification**: Verified Issue.

##### 2.3 Overly Permissive `TO authenticated USING (true)` Administrative Policies
- **File and Line**: `supabase/schema.sql` (lines 54-58, 73-83, 182-186, 201-205), `supabase/normalized-schema.sql` (lines 84-90, 105-110)
- **What is wrong**: RLS policies grant `ALL` on `forms` and `SELECT`/`DELETE` on `responses` to `authenticated` with `USING (true) WITH CHECK (true)` without role or ownership checks.
- **Why it matters**: In Supabase, any user who registers via `supabase.auth.signUp()` receives the `authenticated` role. Any authenticated user can read all survey responses, delete all response records, or change form configurations.
- **Concrete recommended fix**:
  Drop the public `TO authenticated` policies if management is done via the Supabase Dashboard (which uses `service_role`/`postgres`), or enforce admin claims via `(select auth.jwt()->'app_metadata'->>'role') = 'admin'`.
- **Classification**: Verified Issue.

##### 2.4 TypeScript Contract Incompatibilities & Type Checking Failure
- **File and Line**: `__tests__/question-renderer.test.tsx` (lines 11, 38, 67, 93), `__tests__/normalized-schema.test.ts` (line 92), `lib/database.types.ts` (lines 85-109, 114), `app/actions/submit-response.ts` (lines 188, 224-225)
- **What is wrong**: `npx tsc --noEmit` fails with 5 errors due to missing `required` properties on test fixtures and nullable `description` types. Hand-written `lib/database.types.ts` contains phantom tables (`profiles`) and non-existent columns (`forms.user_id`), forcing `as never` and `as ReturnType<typeof client.from>` casts in server actions.
- **Why it matters**: CI/CD typechecking is broken. Hand-written types drift from PostgreSQL schemas, masking bugs and bypassing compiler safety guarantees.
- **Concrete recommended fix**:
  Add `required: false` to test fixtures, coalesce nullable fields, and generate official types via `npx supabase gen types typescript --local > lib/database.types.ts`.
- **Classification**: Verified Issue.

---

#### 3. MEDIUM Severity

##### 3.1 Missing Zod Schema Validation on Server Action Payload
- **File and Line**: `app/actions/submit-response.ts` (lines 15-21, 100-112)
- **What is wrong**: `submitResponseAction(payload: SubmitResponsePayload)` relies on compile-time TypeScript interfaces without parsing the incoming argument at runtime with Zod.
- **Why it matters**: Server Actions are public unauthenticated POST endpoints. Malformed payloads (e.g. `{ answers: null }` or missing properties) trigger unhandled `TypeError` exceptions, resulting in opaque HTTP 500 server crashes.
- **Concrete recommended fix**:
  Validate the outer payload with `SubmitResponsePayloadSchema.safeParse(rawPayload)` before accessing fields.
- **Classification**: Verified Issue.

##### 3.2 Respondent Fingerprint Entropy Implementation Discrepancy
- **File and Line**: `lib/fingerprint.ts` (lines 6-7, 28-53, 122-134)
- **What is wrong**: The utility claims to correlate submissions across incognito sessions using canvas/hardware entropy, but mixes a randomly generated UUID `clientToken` into the entropy before hashing.
- **Why it matters**: In an incognito window, `clientToken` is freshly generated every time, partitioning the hash and allowing respondents to bypass deduplication simply by opening private windows.
- **Concrete recommended fix**:
  Separate hardware device entropy from the random session token, or update documentation and contracts to acknowledge session-only tracking.
- **Classification**: Verified Issue.

##### 3.3 Incomplete Bilingual Localization in Question Renderer
- **File and Line**: `components/form-player/question-renderer.tsx` (lines 148, 156, 172, 516)
- **What is wrong**: `MatrixQuestion` labels ("Avaliação dos tópicos", "preenchidos", "Tópico") are hardcoded in Portuguese and ignore the active language. The `yes_no` question type hardcodes English options (`['Yes', 'No']`), ignoring Portuguese mode.
- **Why it matters**: Breaks user experience for English respondents on matrix grids and Portuguese respondents on binary questions.
- **Concrete recommended fix**:
  Pass the `language` prop to `MatrixQuestion` and dynamically select button labels and headers based on `language`.
- **Classification**: Verified Issue.

---

#### 4. LOW Severity

##### 4.1 Missing Font Import for Forest Theme ('Space Grotesk')
- **File and Line**: `app/layout.tsx` (lines 6-29, 44), `lib/themes.ts` (line 38)
- **What is wrong**: `lib/themes.ts` configures `fontFamily: "'Space Grotesk', sans-serif"`, but `app/layout.tsx` does not import `Space_Grotesk` via `next/font/google`.
- **Why it matters**: Causes layout shifts and fallback to system fonts when the forest theme is active.
- **Concrete recommended fix**: Import and expose `--font-space-grotesk` in `app/layout.tsx`.
- **Classification**: Verified Issue.

##### 4.2 Legacy `forwardRef` in React 19
- **File and Line**: `components/form-player/turnstile-widget.tsx` (line 42)
- **What is wrong**: Uses `forwardRef`, which is legacy in React 19 where `ref` is a standard prop.
- **Why it matters**: Unnecessary boilerplate contrary to current React 19 best practices.
- **Concrete recommended fix**: Accept `ref` directly as a component prop.
- **Classification**: Verified Issue.

##### 4.3 Database Normalization Utility String Primary Key Mismatch
- **File and Line**: `lib/normalized-questions.ts` (lines 54-57, 76, 89, 102), `supabase/schema.sql` (lines 105-156)
- **What is wrong**: Generates text slugs (`q01-consentimento`) as table primary keys, whereas the SQL schema defines `id UUID PRIMARY KEY`.
- **Why it matters**: Inserting records generated by this utility into PostgreSQL will fail with UUID type syntax errors.
- **Concrete recommended fix**: Assign `crypto.randomUUID()` to `id` and keep question keys in `question_key`.
- **Classification**: Verified Issue.

##### 4.4 In-Memory Rate Limiting in Multi-Instance Serverless Deployment
- **File and Line**: `app/actions/submit-response.ts` (lines 30-59)
- **What is wrong**: Rate limiting relies on an in-memory `Map` inside the Node.js module.
- **Why it matters**: In serverless/Fluid Compute environments, memory is not shared across lambda instances.
- **Concrete recommended fix**: Use edge rate limiting (Upstash Redis) or rely on Cloudflare Turnstile bot challenges.
- **Classification**: Speculative Architectural Improvement.

---

### Separation of Verified Issues vs Speculative Improvements

- **Verified Issues (Defects confirmed by code inspection & static analysis)**:
  - Issues 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3.
- **Speculative Improvements (Architectural enhancements for high-scale multi-instance production)**:
  - Issue 4.4 (In-memory rate limiting across serverless lambdas).

---

### Final Verdict & Decision

## **SHIP WITH FIXES**

### Why this decision:
1. **What's Good**:
   - The UI presentation, animation transitions, theme switching, and TypeForm-style single-question flow are responsive, smooth, and well-designed.
   - Server-side question validation in `lib/validation.ts` is comprehensive across input types (email, scales, numbers, matrices, exclusive checkboxes).
   - Test suites in `__tests__/` provide strong baseline coverage for core rendering, validation, and utilities.

2. **Why it Cannot Ship Unmodified**:
   - **Data Privacy Breach**: The database view `v_response_answers_normalized` bypasses RLS and exposes all participant survey responses to anyone querying the PostgREST API with the anon key.
   - **Broken Form Submissions**: The Turnstile re-rendering loop wipes bot verification tokens whenever respondents type or select choices on the final question, preventing form submission.
   - **Data Integrity & Authorization**: The lack of a database unique constraint on `(form_id, respondent_hash)` allows duplicate submissions under concurrency, and `TO authenticated USING (true)` policies expose responses to deletion by any authenticated user.

Once the blocking CRITICAL and HIGH issues are resolved according to the individual tasks in the `todo/` directory, the application will be robust, secure, and ready to ship.
