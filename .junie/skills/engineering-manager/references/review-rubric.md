# Review & Ship-Decision Rubric

Use this when reviewing a change or making a ship call. Priority order is fixed: **correctness → security → architecture → tests → fit.** A failure high in the list blocks the merge regardless of how clean the rest is.

Start by understanding the change: read the diff, run the lint/test scripts (mentally or for real), and identify which surfaces it touches (domain logic? action? schema? RLS? client boundary?). Then walk the checklist for the surfaces in play — don't recite items that don't apply.

## 1. Correctness

- [ ] The change does what it claims across **edge cases**: empty inputs, boundary values, concurrent access, timezone/DST, past/future dates, and error paths.
- [ ] **Concurrency**: anything that must be unique or must not be double-applied (a slot, an order, a balance) is protected at the **DB level** (transaction / partial unique index), not just by an app-code check — the DB is the only race-proof backstop. The action handles the unique-violation gracefully.
- [ ] **State filters intact** — e.g. soft-deleted/canceled/archived rows are excluded everywhere they should be.
- [ ] **Timezones explicit** — logic reads no ambient tz; storage tz vs display tz is correct.
- [ ] Error states are handled and surfaced (not swallowed); the user sees a clear result.
- [ ] Risky logic ships with a **test**, including a boundary or timezone/DST case where relevant.

## 2. Security

- [ ] Every **Server Action authenticates inside itself** (not relying on a page redirect) **and authorizes by ownership** (not just "is logged in").
- [ ] All action input is **Zod-validated server-side** with the shared schema; client validation is not trusted.
- [ ] Server-side **re-validation** of anything the client chose (slot, price, permission) before the write.
- [ ] Any **new table has an RLS policy in the same migration**; policy uses the `(select auth.uid())` subquery form.
- [ ] **Service-role / secret key** stays server-only; nothing secret behind `NEXT_PUBLIC_`; no secret in client-captured closure variables.
- [ ] Actions/components return **DTOs, not raw DB rows**; client prop types are narrow.
- [ ] No `getSession()` used for authorization in server code (`getClaims()`/`getUser()` instead).
- [ ] Cron/webhook endpoints verify a secret.

## 3. Architecture

- [ ] `"use client"` is **at the leaves**, not dragging a large tree into the bundle.
- [ ] No **data waterfalls** — independent reads are parallel (`Promise.all` / sibling Suspense).
- [ ] **Caching intent is explicit** and correct for Next 16's opt-in model; live data isn't accidentally cached; if cached, it's tagged and invalidated (`updateTag`) on the right mutation.
- [ ] Business logic lives in services/domain modules, not page components.
- [ ] **Simplest design that's correct and safe** — no speculative abstraction, no cleverness the next engineer must decode. Could a moving part be removed?
- [ ] No stale-stack patterns (`middleware.ts`/Edge assumptions, `forwardRef` in new code, `unstable_cache`, chained `z.string().email()`, JS Tailwind config).

## 4. Tests

- [ ] Domain logic and schemas covered by **unit tests**; component behavior via Testing Library with mocked Supabase/services.
- [ ] Cross-page or browser-only flows covered by **E2E** where the change warrants it.
- [ ] Date-sensitive tests run in `TZ=UTC` with time frozen where "now"-relative math is involved.
- [ ] Tests assert **auditable side effects** (logged events, external resource ids) for integration changes, not just the happy return.

## 5. Fit

- [ ] Matches existing conventions (path aliases, action/return shapes, ui primitives, project style).
- [ ] Scope is what was asked — no quiet expansion; unrelated worktree changes untouched.
- [ ] For route/layout/caching/boundary changes, the project's pinned framework docs were honored (read `node_modules/next/dist/docs/` for the exact installed version).
- [ ] Docs/migrations updated if the change alters schema or a contract.

## Delivering the verdict

State it as four blocks, in this shape:

> **Decision:** ship / ship-with-fixes / don't ship — one sentence on why.
>
> **Blocking** — must fix before merge (with file:line and the reason it blocks).
>
> **Non-blocking** — suggestions / nits, clearly labeled as optional.
>
> **What's good** — call out genuinely strong work; taste is taught by example.

Be direct about what blocks and why; be generous about what's good. The aim is a stronger engineer next time and a system that never pages someone at 2am.
