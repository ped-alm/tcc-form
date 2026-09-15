# Getting Oriented in a Next.js + Supabase Codebase

When you're handed an unfamiliar repo on this stack, build a mental model fast and grounded — don't opine before you know how the system actually works. A senior engineer reads the map before redrawing it.

## First pass — the shape (5 minutes)
1. **`package.json`** — exact versions (Next/React/Supabase/Tailwind/Zod/Vitest), and the `scripts` block. The scripts tell you how the team actually builds, tests, and runs (e.g. `TZ=UTC vitest run` signals date-sensitive logic).
2. **`tsconfig.json`** — path aliases (`@/*`), strictness.
3. **`next.config.*`** — `cacheComponents`, `reactCompiler`, image config, anything experimental.
4. **Config files** — `eslint.config.*`, `vitest.config.*`, `playwright.config.*`, `postcss`/Tailwind setup, `vercel.json` (cron/headers).
5. **Any `AGENTS.md` / `CLAUDE.md` / `CONTRIBUTING.md`** — the team's own rules override your defaults. Read them first.

## Second pass — the architecture
- **`src/app/`** — routes, layouts. Note which pages are `force-dynamic`, where `loading.js`/`error.js` live, and the route-group structure (`(public)` vs `(dashboard)`).
- **Server boundary** — find the `"use server"` actions file(s) and the data-access layer (often `lib/database.ts` / `lib/data/`). How do actions validate input, guard auth, and shape return values? Is there a clean DAL or is DB access scattered into pages?
- **Supabase clients** — `lib/supabase/` (browser vs server vs admin). Confirm the admin/service-role client is server-only.
- **Domain core** — the pure business logic (often `lib/services/`). This is usually the crown jewel; read it and its tests together to learn the invariants.
- **Schemas & types** — `lib/schemas.ts` (Zod) and `lib/types.ts`. The schemas are the contract; the types are the vocabulary.
- **DB schema + RLS** — `supabase/migrations/`. Read the policies, the constraints, and any partial unique indexes — they encode guarantees the app relies on.
- **Components** — `components/ui/` primitives vs feature components; where the `"use client"` boundaries sit.

## Third pass — how data flows for one feature
Pick the most important user action and trace it end to end: page (Server Component) → data fetch (DAL) → render → client component → Server Action → validation → DB write → revalidation/UI update. Once you can narrate one flow precisely, you understand the system's spine and can review the rest with judgment.

## What to look for while reading (forms an opinion)
- Where does correctness live, and is it tested? Untested business logic is the highest risk.
- Is auth enforced *in the action*, or only at the page? (Common gap — see `nextjs-react.md`.)
- Does every exposed table have RLS? (See `supabase-vercel.md`.)
- Are `"use client"` boundaries at the leaves, or dragging large trees client-side?
- Are there data waterfalls (sequential awaits) that should be parallel?
- Do conventions hold consistently, or has the codebase drifted into two styles?

Capture the answers — they're the raw material for any review, design, or onboarding doc you're about to write.
