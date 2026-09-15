# Supabase + Vercel — Reference (2026)

Flags marked **[CHANGED]** diverge materially from pre-2025 guidance.

## Supabase with Next.js App Router

### Client architecture (`@supabase/ssr`)
`@supabase/auth-helpers-nextjs` is **deprecated** — `@supabase/ssr` is the only supported path. **[CHANGED]**
- **Browser client** — `createBrowserClient()`, client components only (realtime, interactive UI). Singleton.
- **Server client** — `createServerClient()`, **rebuilt per request** with fresh `next/headers` cookies. Never shared across requests.
- **Admin client** — service-role key, **bypasses RLS**, server-only, no session persistence. Use only for trusted server work.
- **Cookies**: use `getAll`/`setAll`, **not** the old `get`/`set`/`remove`. **[CHANGED]** `setAll` in a Server Component is expected to no-op/throw-and-catch — the middleware does the real write.

### Auth flow (PKCE + callback + middleware refresh)
- **PKCE is the default/recommended SSR flow** — server exchanges `code` for a session at a callback route (`exchangeCodeForSession(code)`). Avoid implicit flow.
- **Middleware/proxy session refresh is mandatory.** Server Components can't write cookies, so a `proxy.ts` (Next 16) must refresh the expiring token on every matched request and propagate it to both request (downstream Server Components) and response (browser). Skipping it → random logouts.
- **Auth-check correctness (the single most important rule):**
  - **`getClaims()`** — preferred to protect pages/data. Verifies the JWT locally (fast). **[CHANGED]** Supersedes the old "always `getUser()`."
  - `getUser()` — network call; use when you need the freshest user record.
  - `getSession()` — **never trust in server code** (reads cookie without revalidating). Classic footgun.
- Add `no-store`-style headers on authed responses so a CDN can't cache one user's session.

### Row Level Security (RLS) — the security boundary, not an add-on
The DB is exposed to the internet via the Data API and the **anon/publishable key ships to browsers** — any table without RLS is world-readable/writable. This is exactly how **CVE-2025-48757** leaked data across 303 endpoints. Cite it.
- Enable RLS on **every** table exposed to the API. Supabase **Security Advisor (Splinter)** flags missing policies — run it before shipping schema changes.
- **Performance:** wrap auth calls in a subquery — `(select auth.uid()) = user_id`, **not** `auth.uid() = user_id`. The subquery is evaluated once (initPlan) instead of per-row. **[CHANGED — widely under-applied.]**
- **Never trust a client-supplied user ID** for authorization — filter by `(select auth.uid())` in the policy.
- Any **new table must ship with a policy in the same migration**. For uniqueness/no-duplicate guarantees that can't be expressed in app code safely under concurrency, add a **partial unique index** at the DB level (e.g. `UNIQUE (owner_id, slot) WHERE status='confirmed'`) — the DB is the only race-proof backstop.

### Service-role / secret key
Bypasses all RLS by design. Server-side only (migrations, cron, admin). Never in the browser or behind `NEXT_PUBLIC_*`. A leak = full DB compromise.

### New API key model **[CHANGED — time-sensitive]**
Legacy JWT keys are being retired: `anon` → `sb_publishable_…`, `service_role` → `sb_secret_…`. New keys rotate independently of the JWT secret (revoke a compromised secret in seconds without killing sessions). Secret keys 401 if combined with browser headers. Projects from **1 Nov 2025** get no legacy keys. Migrate `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` to the new publishable/secret keys; both generations work during transition.

### Schema / migrations
- Ordered SQL files in `supabase/migrations/` are the source of truth. Never hand-edit prod schema in the dashboard.
- Define RLS policies **in the migration**, part of the schema contract.

### Realtime & Storage
- Realtime in the browser client; RLS applies to it too.
- Storage buckets have their own policies — default private, sign URLs server-side.

Sources: https://supabase.com/docs/guides/auth/server-side/nextjs · https://supabase.com/docs/guides/database/postgres/row-level-security · https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys · https://supabase.com/blog/supabase-security-2025-retro

## Vercel deployment for Next.js 16

### Fluid Compute is the default **[CHANGED]**
Since **Apr 2025, Fluid Compute is on by default.** "Push everything to the Edge" is **outdated** — Edge has no full Node APIs and awkward DB connectivity, wrong for a Supabase/Postgres app. Keep Server Components/route handlers on the **Node runtime under Fluid Compute**; reserve Edge for ultra-light middleware. Pre-Apr-2025 projects must opt in.

### Build/prerender issues with Supabase auth (common failure)
Any route reading cookies **can't be statically prerendered** → `DynamicServerError: Route couldn't be rendered statically because it used cookies`. Fix with `export const dynamic = 'force-dynamic'` on authed pages, and ensure `cookies()` is awaited *inside* the request scope (not at module top). Keep cookie-free public routes static where possible; make a page `force-dynamic` deliberately when its data must be live.

### Environment variables
- Scopes: **Development / Preview / Production**; pull with `vercel env pull`.
- Mark secrets (Supabase secret key, OAuth secrets) **Sensitive** (write-only, redacted from logs).
- **Never** `NEXT_PUBLIC_` a secret — it inlines into the client bundle. Public config (project URL, anon/publishable key, site URL) is fine; the service-role/secret key must stay server-only.
- Point **Preview** at a separate Supabase project/branch so preview traffic never mutates prod data.

### Cron jobs
- Declared in `vercel.json` (`path` + `schedule`). **Cron runs only on Production**, not Preview. Protect cron endpoints with a `CRON_SECRET` header check (public URLs).

### Observability
- **Vercel Drains** (Oct 2025, Pro+) unify logs + OTel traces + Speed Insights + Analytics into one export (Datadog, etc.) with sampling.

### Deprecated storage **[CHANGED]**
**Vercel Postgres and Vercel KV are gone**, migrated to Marketplace (Neon / Upstash). Treat any `@vercel/postgres`/`@vercel/kv` import in tutorials as stale.

Sources: https://vercel.com/docs/fluid-compute · https://vercel.com/docs/cron-jobs/manage-cron-jobs · https://nextjs.org/docs/messages/dynamic-server-error · https://vercel.com/docs/environment-variables/sensitive-environment-variables
