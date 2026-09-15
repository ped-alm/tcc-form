# Testing + Tailwind 4 + Zod 4 — Reference (2026)

## Testing strategy

Shape the pyramid around where the risk lives. Pure, deterministic domain logic (pricing, scheduling, permissions, any non-trivial calculation) is the cheapest thing to test exhaustively and the most expensive thing to get wrong — so it gets the most coverage.

### The pyramid
- **Wide base — Vitest unit tests (the bulk).** Every branch of the core domain logic and every Zod schema. Pure functions → cover edge cases exhaustively, fast and cheap.
- **Middle — component/integration (Testing Library + Vitest, jsdom).** Form behavior, error states, that a component renders correctly for a fixed data input. **Mock** the Supabase client and service modules — don't hit a real DB.
- **Narrow top — Playwright E2E (few, high-value).** The critical user journeys (sign-up → core action → confirmation; the primary happy path; a key destructive path). Slow/brittle — reserve for journeys that mean the product is broken if they fail.

**Rule:** test domain *correctness* with unit tests (hundreds, ms); test that the *journey holds together* with E2E (a handful). Never push business-logic assertions into E2E.

### Deterministic time/timezone testing — the critical discipline
Time bugs are almost always timezone bugs. Make tests independent of the dev machine:
1. **Run date-sensitive suites in UTC** — e.g. `TZ=UTC vitest run`. Highest-leverage habit.
2. **Freeze "now"** — `vi.useFakeTimers()` + `vi.setSystemTime(new Date('2026-06-26T09:00:00Z'))` so any "X minutes from now" / horizon math is reproducible; `vi.useRealTimers()` in teardown.
3. **Test across timezones deliberately** — UTC alone misses host-in-`America/New_York` / guest-in-`Asia/Tokyo` bugs and **DST edges**. Prefer passing an explicit IANA tz into the logic (it should never read ambient tz), and/or a second CI job with a different `TZ`. Add spring-forward/fall-back and ambiguous-local-time cases.
4. Pass timezone as an **explicit parameter**; don't rely on ambient `Intl`/tz.

### Mocking
`vi.mock()` the Supabase client and any email/calendar/external service modules so service/component tests stay hermetic. Assert the **auditable side effects** (the logged event, the external resource id/status), not just that nothing threw.

### Vitest 4 (Oct 2025) **[CHANGED]**
- Browser Mode stable (real-browser component testing via Playwright).
- Built-in visual regression + `toBeInViewport`.
- `expect.schemaMatching` accepts a Standard Schema v1 object → assert a value conforms to a **Zod 4** schema in one matcher.

Sources: https://vitest.dev/blog/vitest-4 · https://vitest.dev/guide/mocking/dates

## Tailwind CSS 4 **[CHANGED — large shift]**

- **CSS-first config.** `tailwind.config.js` is **gone by default.** Configure in CSS via `@theme`. One import: `@import "tailwindcss";` (replaces the three `@tailwind base/components/utilities`).
- **New PostCSS package** — `@tailwindcss/postcss`. Using `tailwindcss` directly as a PostCSS plugin now errors. (Vite: prefer `@tailwindcss/vite`.)
- **Automatic content detection** — no `content: [...]` globs in most projects.
- Tokens (`--color-*`, `--font-*`, `--spacing-*`) in `@theme` emit real CSS custom properties (usable in arbitrary CSS + at runtime).
- 3–10× faster builds; ~100× faster incremental.
- **#1 v4 gotcha** when "Tailwind isn't working": check the `@tailwindcss/postcss` wiring first. Don't reintroduce a JS config or old `@tailwind` directives from memory.

Sources: https://tailwindcss.com/blog/tailwindcss-v4 · https://tailwindcss.com/docs/upgrade-guide

## Zod 4 + react-hook-form **[CHANGED]**

Zod 4 has real breaking changes — drop Zod 3 muscle memory:
- **Top-level string formats** — `z.email()`, `z.url()`, `z.uuidv4()`, `z.iso.datetime()` etc. Chained `z.string().email()` is **deprecated** (less tree-shakable).
- **Unified error API** — single `{ error }` param replaces `message`/`invalid_type_error`/`required_error`/`errorMap`. `error` can be a function inspecting the issue. `message` still works but deprecated.
- **Defaults apply inside optional fields now** — behavior change; audit optional-with-default fields.
- Zod 4 implements **Standard Schema v1** (why RHF's resolver and Vitest's `schemaMatching` interop cleanly).

react-hook-form integration:
- `zodResolver` from `@hookform/resolvers/zod` bridges schema → form errors.
- **Single source of truth:** derive the form type with `z.infer<typeof schema>` and reuse the **same schema** in the client form *and* the Server Action. Never trust client validation alone — re-validate server-side before writing to the DB.
- Always set `defaultValues` for clean hydration. For create-vs-edit forms, bundle schema + defaults in one hook shared by both modes.

Sources: https://zod.dev/v4 · https://zod.dev/v4/changelog · https://github.com/react-hook-form/resolvers
