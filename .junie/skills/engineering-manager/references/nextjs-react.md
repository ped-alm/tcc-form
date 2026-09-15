# Next.js 16 + React 19 — Reference

Verified against Next.js **16.2.x** and React **19.2**. Next 16 GA was Oct 2025 and reverses several long-standing defaults. Prefer a project's local docs in `node_modules/next/dist/docs/` over memory.

## Contents
- What Next 16 changed vs ≤15
- Server vs Client boundaries
- Server Actions security (the review-critical part)
- Data fetching & waterfalls
- Caching (Cache Components / `use cache`)
- Streaming, metadata, proxy
- React 19
- Performance / Core Web Vitals
- TypeScript strictness
- Review anti-patterns

## What Next 16 changed vs ≤15

| Area | Old (≤15) | Next 16 |
|---|---|---|
| Caching default | implicit `fetch`/route caching; opt *out* | **Opt-in.** Everything dynamic until `"use cache"` |
| Cache primitive | `unstable_cache`, `export const revalidate/dynamic/fetchCache` | **`"use cache"`** + stable `cacheLife`/`cacheTag` |
| PPR | `experimental.ppr` + `experimental_ppr` | **Removed** — folded into **Cache Components** (`cacheComponents: true`) |
| Middleware | `middleware.ts`, Edge runtime | **`proxy.ts`**, **Node.js runtime** (middleware.ts deprecated) |
| Bundler | webpack | **Turbopack default** (`--webpack` to opt out) |
| `params`/`searchParams`/`cookies()`/`headers()`/`draftMode()` | sync | **all async — must `await`** |
| Min versions | Node 18, TS 4 | **Node 20.9+, TS 5.1+** |
| `revalidateTag(tag)` | single arg | **needs a `cacheLife` profile as 2nd arg** |
| `next lint` | bundled | **removed**; run ESLint directly |
| Removed | — | AMP, `serverRuntimeConfig`, `images.domains`→`remotePatterns`, `next/legacy/image` deprecated |
| React Compiler | experimental | **stable** (`reactCompiler: true`, off by default) |

Sources: https://nextjs.org/blog/next-16 · https://nextjs.org/docs/app/guides/upgrading/version-16

## Server vs Client Component boundaries

- **Server Components are the default.** Add `"use client"` only for React hooks, browser APIs, or event handlers.
- **Push `"use client"` to the leaves.** A client file drags *all its imports and rendered descendants* into the client bundle. Misplaced near the root → the whole tree hydrates. Page/layout/grid/card stay Server Components; only the interactive leaf is a client component.
- **The boundary does not capture `children`/props.** Server Components passed as props/children to a client component render on the server and stream in (the "donut" pattern). Use it to wrap an interactive shell around server-rendered content instead of converting the whole subtree.
- Client Components also prerender on the server — no secrets, no `server-only` modules in them.

Sources: https://nextjs.org/docs/app/getting-started/server-and-client-components

## Server Actions — security (enforce in review)

Server Actions are **public, unauthenticated POST endpoints**. Reachable by raw POST even if never wired to UI (unless dead-code-eliminated). Treat every `"use server"` function like a raw API route.

Every action, non-negotiable:
1. **Authenticate inside the action.** A page-level `redirect()` does NOT protect the action defined in/near it — separate entry point. Re-check auth.
2. **Authorize, not just authenticate** — check resource *ownership* (`row.userId === session.user.id`) to prevent IDOR. (RLS is the backstop, but check in the action too.)
3. **Validate every input with Zod** — formData, params, searchParams. Client validation is UX only.
4. **Filter return values** — returns serialize to the client. Return `{ ok: true }`/DTOs, not raw DB rows.
5. **Never trust client flags** (`?isAdmin=true`, hidden fields) for authz.
6. **No mutations during render** — mutations only via actions (also mitigates CSRF).

Good pattern: actions take `(state: ActionState, formData)`, parse with a shared Zod schema, return `{ ok, message, errors }`. **Re-validate anything the client chose** (e.g. an availability slot, a price, a permission) server-side before the write — the client list can be stale or forged.

Built-in protections are defense-in-depth, **not** a substitute for auth: encrypted action IDs, dead-code elimination, Origin/Host check (`serverActions.allowedOrigins` behind a proxy). Closure variables captured by inline actions are sent to the client and back (Next encrypts them, but don't put secrets there).

**Architecture:** keep `"use server"` actions thin; delegate auth+authz+DB to a `server-only` data-access layer. Only the DAL touches `process.env`/the admin client. The canonical doc — https://nextjs.org/docs/app/guides/data-security — has an Auditing checklist that maps straight onto a review rubric.

## Data fetching & waterfalls

- Default is **uncached, request-time**. Fetch directly in async Server Components.
- **Avoid sequential `await`s** — the #1 server perf bug. Start independent requests together (`Promise.all`, or start promises before awaiting), or split into sibling Server Components each behind its own `<Suspense>`.
- **Dedup** shared DB/ORM calls with React `cache()` (request-scoped). `fetch` auto-dedups identical URL+options per render.

Sources: https://nextjs.org/docs/app/building-your-application/data-fetching/patterns

## Caching (Cache Components / `use cache`)

Enable with `cacheComponents: true`. Then:
- **`"use cache"`** — file/component/function directive; key auto-derived from args+closures. Replaces `unstable_cache`. **In-memory per instance by default** (lost on redeploy) unless `"use cache: remote"`.
- **`cacheLife(profile)`** — stable; presets `seconds|minutes|hours|days|weeks|max`. Call inside the cached scope, inline (not in a shared util).
- **`cacheTag(tag)`** — stable; for targeted invalidation.
- Invalidation (Server-Actions only):
  - **`updateTag(tag)`** → read-your-writes (expire + read fresh same request). Use when the user must see their change instantly.
  - **`revalidateTag(tag, profile)`** → SWR; profile (use `'max'`) now **required**.
  - **`refresh()`** → re-render uncached data only.
- **`"use cache: private"`** (experimental) — browser-memory only, allows `cookies()` inside. **PPR payoff:** static shell prerenders, dynamic holes stream via Suspense.

Rule of thumb: routes that read cookies are dynamic (correct for authed pages). Live, fast-changing data should not be naively cached; if you do cache it, tag by entity and `updateTag` on the mutation so stale data disappears immediately.

Sources: https://nextjs.org/docs/app/getting-started/caching · https://nextjs.org/docs/app/guides/migrating-to-cache-components

## Streaming, metadata, proxy

- **Streaming**: `loading.js` or nested `<Suspense>` for instant shells.
- **Metadata**: static `export const metadata` or async `generateMetadata`; metadata-image route `params` is now a Promise.
- **`proxy.ts`** (was `middleware.ts`): export a `proxy` function; runs on **Node.js** (full npm/native modules — Edge limits gone). For Supabase this is where the session-refresh middleware lives. Audit `proxy.ts`/`route.ts` like real endpoints.
- **Parallel routes** require an explicit `default.js` per slot or the build fails.

## React 19 (19.2)

- **Actions**: async transitions integrated with `<form action={fn}>`.
- **`useActionState(fn, initial)`** → `[state, dispatch, isPending]`. Pairs with bound actions (`action.bind(null, ctx)`).
- **`useFormStatus()`** → read parent form submit status from a child (submit button) without prop-drilling.
- **`useOptimistic(state, reducer)`** → instant UI before the server resolves; reconciles on real state.
- **`use(resource)`** → read a promise (Suspends) or context; may be called conditionally.
- **`ref` is a prop** — `forwardRef` is **legacy**; don't write it for new components. ref callbacks may return a cleanup.
- **React Compiler 1.0 (stable)** auto-memoizes → **discourages manual `useMemo`/`useCallback`/`React.memo`** (off by default; Babel slows builds).
- 19.2 extras: View Transitions, `useEffectEvent`, `<Activity>`.
- **Discouraged now:** `forwardRef` (new code), `useFormState` (use `useActionState`), manual memo when compiler on, throwing-in-render to fetch (use `use()`).

Sources: https://react.dev/blog/2024/12/05/react-19 · https://react.dev/blog/2025/10/01/react-19-2

## Performance / Core Web Vitals

Thresholds (2026): **LCP < 2.5s, INP < 200ms, CLS < 0.1**. INP is the most-failed.
- **INP**: mark non-urgent updates with `useTransition`/`useDeferredValue`; ship less JS (leaf `"use client"` + RSC). Upgrading React without using concurrent APIs gives **no** INP win.
- **LCP**: prerender shell (PPR/static), `<Image priority>` on hero, no client waterfall in front of the LCP element.
- **CLS**: `next/image` enforces dimensions; `next/font` self-hosts + fallback metrics + `swap` → ~0 font CLS. (Next 16 removed auto `scroll-behavior: smooth`; opt back with `data-scroll-behavior="smooth"`.)
- **Images (Next 16 defaults)**: `minimumCacheTTL` 60s→4h; `qualities` default `[75]`; `images.domains`→`remotePatterns`.

## TypeScript strictness

- `strict: true`. `params`/`searchParams` typed as `Promise<…>` and awaited.
- Treat bracket-folder params (`/[slug]`) as untrusted `string` — parse/validate, don't cast.
- Use `server-only`/`client-only` packages as compile-time boundary guards.
- Keep DTO types **narrow** at the server→client boundary — map DB rows to domain types; don't pass raw rows.

## Review anti-patterns (flag these)

**Security**: action with no auth check inside (relying on page redirect); auth without ownership check (IDOR); trusting searchParams/client fields for authz; returning raw DB rows; DB driver/`process.env` outside the DAL; secrets in closure variables.

**Architecture/caching**: `"use client"` near the root; assuming old implicit `fetch` caching still applies (it doesn't); `revalidateTag(tag)` single-arg; assuming `"use cache"` is durable; mutations as render side effects; `middleware.ts`/Edge assumptions instead of `proxy.ts`/Node.

**Performance**: sequential `await` waterfalls without Suspense; manual memo sprawl with compiler on; unsized `<img>`; fonts not via `next/font`.

**Legacy leftovers** (flag in migration PRs): `forwardRef` in new code; `useFormState`; `export const revalidate/dynamic` where unneeded; `experimental_ppr`; `unstable_cache`; `images.domains`; sync `cookies()`/`params`.
