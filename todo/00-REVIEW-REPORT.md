# OpenForm Architecture & Code Quality Review Report

This review evaluates the Next.js 16 + React 19 + Supabase codebase of OpenForm across correctness, Supabase security, Next.js architecture, React patterns, TypeScript rigor, database integrity, maintainability, and testing.

---

### Executive Summary

The application demonstrates strong visual presentation and functional form-rendering capabilities, but exhibits severe vulnerabilities in security, data integrity, and API boundaries. Most critically:
- Public endpoints exist that allow unrestricted, unauthenticated file uploads to third-party storage.
- An unsanitized OAuth redirect enables open-redirection attacks.
- A fundamental mismatch between database uniqueness constraints `(user_id, slug)` and URL routing `/f/[slug]` causes fatal runtime crashes upon slug collisions.
- Postgres Row-Level Security (RLS) policies omit crucial `WITH CHECK` clauses and `(select auth.uid())` subqueries, creating ownership takeover risks and performance bottlenecks.
- Mutating operations occur on HTTP GET requests, and mutations across the board bypass Server Actions to write directly from client components.
- Automated tests are completely absent, and the codebase currently fails linting (`npm run lint` fails with 14 errors).

---

### Severity Classification

Issues are categorized by their real-world impact and likelihood of causing security breaches, data corruption, fatal downtime, or operational cost spikes:
- **CRITICAL**: Immediate vulnerability to security exploit, data compromise, or non-recoverable runtime failure.
- **HIGH**: Substantial performance degradation, data integrity failure under concurrency/scale, or dangerous architectural flaws.
- **MEDIUM**: Code quality regressions, lint failures, sub-optimal query execution, request waterfalls, or UX degradation.
- **LOW**: Minor technical debt, asset omissions, deprecation warnings, or dead code.

---

### Verified Issues Ordered by Severity

#### CRITICAL

##### 1. Unauthenticated Public File Upload Endpoint
- **File and line**: `app/api/upload/route.ts:28-94`
- **What is wrong**: The `POST` route handler accepts file uploads up to 10MB to Cloudflare R2 without verifying authentication, checking user authorization, or verifying that the upload corresponds to a valid question in an active published form.
- **Why it matters**: Anyone on the internet can use this endpoint as a free file hosting service, upload malware, or exhaust cloud storage quotas and egress bandwidth, causing high financial costs and denial of service.
- **Concrete recommended fix**: Require an authenticated user session for creator uploads, or if respondents must upload files, bind the upload to a specific form ID and validate that the form is published and contains an active `file_upload` question. Enforce rate limiting and validate file headers/magic numbers.

##### 2. Unsanitized Open Redirect in OAuth Callback
- **File and line**: `app/auth/callback/route.ts:5-15`
- **What is wrong**: The `next` query parameter is read directly from the URL and passed to `NextResponse.redirect(`${origin}${next}`)` without sanitization or origin validation.
- **Why it matters**: Attackers can construct malicious login URLs (e.g. `next=@attacker.com` or `next=//evil.com`) that redirect authenticated users to external phishing sites, compromising accounts and credentials.
- **Concrete recommended fix**: Validate that `next` is a relative path starting with a single `/` (and not `//` or `/\`), or validate with `new URL(next, origin).origin === origin`. Fallback to `/dashboard` if invalid.

##### 3. Non-Unique Slug Constraint Causes Fatal Runtime Crash on Form Views
- **File and line**: `supabase/schema.sql:36`, `app/f/[slug]/page.tsx:39-44`, `app/f/[slug]/page.tsx:16-21`
- **What is wrong**: The database only enforces slug uniqueness per user via `UNIQUE(user_id, slug)`. However, forms are queried globally at `/f/[slug]` using `.single()`.
- **Why it matters**: If two users publish forms with the identical slug (e.g. `feedback`, `pesquisa`), PostgREST returns error `PGRST116` (multiple rows returned). This causes `FormPage` and `generateMetadata` to throw/404, crashing the public form for all respondents.
- **Concrete recommended fix**: Enforce global uniqueness on `forms(slug)` via `CREATE UNIQUE INDEX idx_forms_slug_unique ON forms(slug);` or alter the public route to be namespaced by user: `/f/[username]/[slug]` or `/f/[formId]`.

##### 4. Missing `WITH CHECK` on Forms UPDATE RLS Policy Enables Ownership Hijacking
- **File and line**: `supabase/schema.sql:85-87`
- **What is wrong**: The UPDATE policy for `forms` specifies `USING (auth.uid() = user_id)` but omits `WITH CHECK (auth.uid() = user_id)`.
- **Why it matters**: In Postgres RLS, `USING` checks whether an existing row can be selected for modification, but `WITH CHECK` validates the modified row. Without `WITH CHECK`, a user can update their form and change `user_id` to another user's UUID, hijacking accounts or transferring ownership without consent.
- **Concrete recommended fix**: Add an explicit `WITH CHECK` constraint to the policy:
  ```sql
  DROP POLICY "Users can update their own forms" ON forms;
  CREATE POLICY "Users can update their own forms"
    ON forms FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);
  ```

---

#### HIGH

##### 5. In-Memory Response Counting and PostgREST 1,000-Row Truncation
- **File and line**: `app/(dashboard)/dashboard/page.tsx:23-36`
- **What is wrong**: The dashboard queries raw response records via `.select('form_id').in('form_id', formIds)` and computes counts in Node.js memory with a `Map`.
- **Why it matters**: PostgREST caps queries at 1,000 rows by default. When a user accumulates more than 1,000 responses across their forms, counts are truncated and display incorrectly. Downloading thousands of rows to calculate a count wastes server bandwidth and memory.
- **Concrete recommended fix**: Use an aggregation database query, a database view (`form_response_counts`), or PostgREST count query (`select('id', { count: 'exact', head: true })`) per form instead of downloading raw row data.

##### 6. Side-Effecting Database Mutation on HTTP GET Request During Prefetching
- **File and line**: `app/(dashboard)/forms/new/page.tsx:13-47`
- **What is wrong**: `NewFormPage` is an HTTP GET page component that inserts a new form record into the database and redirects to the editor.
- **Why it matters**: In Next.js App Router, `<Link href="/forms/new">` automatically prefetches routes in production. Hovering over or viewing pages containing this link issues GET requests that generate blank orphaned forms in the database.
- **Concrete recommended fix**: Trigger form creation exclusively via a Server Action or a form submission method (e.g. POST), ensuring GET requests remain side-effect free.

##### 7. Multi-Megabyte Base64 Fallback Stored in Postgres JSONB
- **File and line**: `components/form-player/question-renderer.tsx:48-67`
- **What is wrong**: When the file upload endpoint returns 503 (which occurs whenever R2 environment variables are unset), the client converts the file into a base64 Data URL and saves it directly into the `responses.answers` JSONB column.
- **Why it matters**: Storing multi-megabyte base64 strings inside database rows causes severe database bloat, exhausts I/O bandwidth, degrades query performance, and can freeze low-memory client browsers.
- **Concrete recommended fix**: Remove base64 database fallback. Use Supabase Storage with signed upload URLs and display an explicit error message if storage is unavailable.

##### 8. CSV Formula Injection Vulnerability in Responses Export
- **File and line**: `components/responses/responses-dashboard.tsx:181-186`
- **What is wrong**: The CSV export function joins answers with quotes without sanitizing formula trigger characters (`=`, `+`, `-`, `@`, `\t`, `\r`).
- **Why it matters**: An attacker submitting a form can input spreadsheet formulas (e.g. `=cmd|' /C calc'!A0` or `=HYPERLINK(...)`). When the form creator opens the CSV in Excel or Google Sheets, the formula executes, potentially running local commands or exfiltrating data.
- **Concrete recommended fix**: Sanitize every exported cell: if the value starts with `=`, `+`, `-`, `@`, `\t`, or `\r`, prepend a single quote `'` to force spreadsheet software to treat the cell as plain text.

##### 9. Unvalidated Public Response Submissions and Bot Spam Exposure
- **File and line**: `supabase/schema.sql:120-128`, `components/form-player/form-player.tsx:172-194`
- **What is wrong**: The `Anyone can submit responses to published forms` RLS policy checks only `forms.status = 'published'` and allows unrestricted JSON payloads into `responses.answers`. There is no schema validation against the form's question definitions, no rate limiting, and client-side `handleSubmit` only validates the active question.
- **Why it matters**: Malicious clients can flood the database with gigabytes of garbage data or corrupted JSON structures, bypassing all client validations.
- **Concrete recommended fix**: Route submissions through an authenticated/rate-limited Server Action that parses answers against the form's question schema with Zod before writing to the database.

##### 10. `SECURITY DEFINER` Function Missing `search_path` and Public Access Revocation
- **File and line**: `supabase/schema.sql:134-160`
- **What is wrong**: `handle_new_user()` runs with `SECURITY DEFINER` privileges but does not specify `SET search_path = public, pg_temp;`. Additionally, `EXECUTE` privileges are granted to `PUBLIC` by default.
- **Why it matters**: Running `SECURITY DEFINER` without an explicit `search_path` opens the function to search-path hijacking in Postgres.
- **Concrete recommended fix**: Alter the function to set a fixed search path and revoke public execution:
  ```sql
  ALTER FUNCTION handle_new_user() SET search_path = public, pg_temp;
  REVOKE EXECUTE ON FUNCTION handle_new_user() FROM PUBLIC;
  ```

##### 11. Client-Side Database Mutations Bypassing Server Actions
- **File and line**: `components/form-builder/form-builder.tsx:68-90`, `components/dashboard/delete-form-button.tsx:30-45`
- **What is wrong**: All mutations (form saving, status updates, deletions) are performed directly from the browser using `@supabase/ssr` browser client calls without Server Actions or server-side input validation.
- **Why it matters**: Client-side direct database calls bypass centralized server validation, leak implementation details, make auditing difficult, and violate standard Next.js App Router security and architectural practices.
- **Concrete recommended fix**: Create dedicated Server Actions in an `app/actions/` directory that validate inputs using Zod, enforce user authorization, execute the mutation, and trigger `revalidatePath()`.

---

#### MEDIUM

##### 12. Missing InitPlan Subquery Optimization on RLS Policies
- **File and line**: `supabase/schema.sql:64-117`
- **What is wrong**: Policies use bare `auth.uid() = user_id` rather than `(select auth.uid()) = user_id`.
- **Why it matters**: Bare `auth.uid()` calls are re-evaluated by Postgres for every row scanned. Wrapping the function in a subquery `(select auth.uid())` allows Postgres to evaluate it once as an `initPlan`, avoiding severe query slowdowns at scale.
- **Concrete recommended fix**: Wrap all `auth.uid()` calls in `(select auth.uid())` in `supabase/schema.sql`.

##### 13. React Compiler Skipped and Hook Violations Failing Lint
- **File and line**: `components/form-player/form-player.tsx:57-61`, `80-241`
- **What is wrong**: `setCurrentThemePreset` is called synchronously inside `useEffect`. Multiple `useCallback` hooks have mismatched inferred dependencies, causing React Compiler to skip optimizations. `npm run lint` fails with 14 errors.
- **Why it matters**: Breaks continuous integration builds and causes cascading re-renders and degraded rendering performance.
- **Concrete recommended fix**: Remove unnecessary effects by deriving state during render, fix `useCallback` dependency arrays, and resolve all ESLint errors.

##### 14. Wheel Event Listener Hijacking & Scroll Debounce Reset
- **File and line**: `components/form-player/form-player.tsx:288-320`
- **What is wrong**: The wheel navigation listener only excludes `TEXTAREA`. For matrix tables or option lists, scrolling down advances the question. Additionally, `lastScrollTime` is declared inside `useEffect`, causing debounce state to reset on every render.
- **Why it matters**: Users attempting to scroll within questions are unintentionally advanced to the next question.
- **Concrete recommended fix**: Store debounce state in `useRef` and check whether the scroll event occurred inside a scrollable container (`scrollHeight > clientHeight`).

##### 15. Request Waterfalls and Duplicate Uncached Queries
- **File and line**: `app/f/[slug]/page.tsx:12-53`, `app/(dashboard)/dashboard/page.tsx:12-30`
- **What is wrong**: `generateMetadata` and `FormPage` execute duplicate database queries for the same form. Dashboard queries run in sequential waterfall.
- **Why it matters**: Increases server response latency (TTFB) and doubles database load on public pages.
- **Concrete recommended fix**: Wrap the form query with `React.cache()` and parallelize independent queries with `Promise.all`.

##### 16. Unpaginated Responses Table Causing DOM Lag
- **File and line**: `app/(dashboard)/forms/[id]/responses/page.tsx:34-40`, `components/responses/responses-dashboard.tsx:290-340`
- **What is wrong**: All responses are queried and rendered into the DOM at once without pagination or virtualization.
- **Why it matters**: Rendering hundreds or thousands of complex DOM rows with multiple columns causes browser freezing.
- **Concrete recommended fix**: Implement server-side pagination (`?page=1&limit=50`) or DOM virtualization using `@tanstack/react-virtual`.

##### 17. Public Exposure of Form Creator's Internal UUID
- **File and line**: `supabase/schema.sql:93-96`, `app/f/[slug]/page.tsx:41`
- **What is wrong**: `Anyone can view published forms` allows `SELECT *`, exposing the creator's auth `user_id` to anonymous visitors.
- **Why it matters**: Leaks internal user identifiers that can be leveraged for account targeting or data correlation.
- **Concrete recommended fix**: Restrict public form queries to non-sensitive columns (`title`, `description`, `theme`, `questions`, `thank_you_message`).

##### 18. Unsafe TypeScript Assertions and Explicit `any`
- **File and line**: `lib/example-form.ts:573-581`, `app/(dashboard)/dashboard/page.tsx:18`, `components/form-builder/form-builder.tsx:80`
- **What is wrong**: The codebase relies on `as never`, `user!.id`, and explicit `any` declarations.
- **Why it matters**: Circumvents type-checking, introduces potential null pointer exceptions, and fails automated lint checks.
- **Concrete recommended fix**: Use generated Supabase types (`supabase gen types typescript`), replace `any` with strict interfaces, and add runtime guards before dereferencing optional values.

##### 19. Loss of Redirect Path on Unauthenticated Login
- **File and line**: `app/(auth)/login/page.tsx:24`, `44`
- **What is wrong**: `LoginPage` ignores the `redirect` query parameter set by middleware and always redirects to `/dashboard`.
- **Why it matters**: Users clicking direct links to edit forms or view responses lose their destination upon logging in.
- **Concrete recommended fix**: Read `searchParams.get('redirect')` and pass it to `/auth/callback?next=...`.

---

#### LOW

##### 20. Complete Absence of Automated Testing Suite
- **File and line**: `package.json:5-10`
- **What is wrong**: There are zero unit, integration, or end-to-end tests in the repository.
- **Why it matters**: Changes risk causing silent regressions in auth, response submission, and data integrity.
- **Concrete recommended fix**: Install Vitest and Playwright; configure deterministic timezone testing (`TZ=UTC`).

##### 21. Hardcoded TCC Survey Coupling in Generic Components
- **File and line**: `components/form-player/form-player.tsx:35-39`, `208-220`
- **What is wrong**: Generic form player components contain hardcoded checks for specific question IDs (`q01-consentimento`, `q02-atuacao-software`).
- **Why it matters**: Limits reusability and creates brittle branching logic for non-survey forms.
- **Concrete recommended fix**: Model branching and early termination rules in `QuestionConfig`.

##### 22. Missing Font Asset for 'forest' Theme
- **File and line**: `lib/themes.ts:38`, `app/layout.tsx:1-29`
- **What is wrong**: `forest` theme references `Space Grotesk`, which is never imported in `RootLayout`.
- **Why it matters**: Theme renders with a generic fallback font.
- **Concrete recommended fix**: Import `Space_Grotesk` in `app/layout.tsx` or use an existing loaded font.

##### 23. Deprecated Middleware Convention in Next.js 16
- **File and line**: `middleware.ts:1-20`
- **What is wrong**: Next.js 16 deprecates `middleware.ts` in favor of `proxy.ts`.
- **Why it matters**: Generates build warnings and may be removed in future Next.js major releases.
- **Concrete recommended fix**: Rename and migrate `middleware.ts` to `proxy.ts`.

##### 24. Unused Dead Code and Imports Flagged by Linter
- **File and line**: `components/form-builder/form-builder.tsx:52`, `components/form-player/form-player.tsx:6-15`, `supabase/schema.sql:185-200`
- **What is wrong**: Unused imports and unused SQL function `generate_unique_slug`.
- **Why it matters**: Clutters code and increases bundle size.
- **Concrete recommended fix**: Prune dead code and run linter cleanup.

---

### Speculative Improvements

These items represent architectural enhancements that are not strictly bugs in current code, but would significantly improve long-term scalability and resilience:

1. **Normalized Database Storage for Form Questions**:
   - *Current state*: Questions are stored as a JSONB array in `forms.questions`.
   - *Improvement*: Normalize into `questions` and `question_options` tables with foreign keys.
   - *Tradeoff*: Increases schema complexity and multi-table transactions for builder updates, but enables foreign keys, granular constraints, and SQL-level joins on individual answers.
2. **Turnstile / Bot Protection for Public Submissions**:
   - *Current state*: Public forms can be submitted without bot challenges.
   - *Improvement*: Integrate Cloudflare Turnstile before processing submissions.
   - *Tradeoff*: Adds an external script dependency, but prevents bot-driven database exhaustion.
3. **Soft-Delete Architecture for Forms**:
   - *Current state*: Deleting a form cascades and permanently removes all responses.
   - *Improvement*: Introduce `deleted_at` timestamp with a 30-day recovery window.
   - *Tradeoff*: Requires filtering `deleted_at IS NULL` across all queries and RLS policies.
4. **Realtime Dashboard Response Updates**:
   - *Current state*: Creators must manually refresh the responses dashboard.
   - *Improvement*: Subscribe to Supabase Realtime changes for new responses.
   - *Tradeoff*: Adds WebSocket connection overhead and client state management.

---

### Verdict

### DO NOT SHIP

#### Explanation of Decision

From the standpoint of maximizing system utility and avoiding catastrophic harm to users and operators, shipping the software in its current state is unviable:
1. **Critical Security Vulnerabilities**: The completely unauthenticated `/api/upload` endpoint exposes the system to storage hijacking, unmetered hosting costs, and malware distribution. The open redirect in `/auth/callback` leaves users vulnerable to credential phishing.
2. **Fatal Data Integrity and Runtime Collisions**: The slug collision bug between the database constraint `UNIQUE(user_id, slug)` and the routing architecture `/f/[slug]` causes forms to crash with PostgREST 500/404 errors as soon as multiple users choose identical common slugs.
3. **Broken Build Pipeline**: The application fails `npm run lint` with 14 errors due to React Compiler and hook violations, meaning production CI checks cannot pass.
4. **Zero Test Coverage**: There are no automated tests guarding auth, RLS permissions, response submission, or CSV generation.
5. **Architectural Gaps**: All mutations bypass Server Actions, and GET requests mutate database state during Next.js prefetching.

Shipping must be blocked until all **CRITICAL** and **HIGH** issues are resolved, lint errors are fixed, and automated tests are introduced to protect core user flows.
