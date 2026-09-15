# Issue: Complete Absence of Automated Testing Suite

**Severity**: LOW  
**Category**: Testing & Engineering Rigor  
**File and line**: `package.json:5-10`

### What is wrong
The project has zero automated tests:
- 0 unit tests
- 0 integration tests
- 0 end-to-end tests
No testing dependencies (e.g. `vitest`, `@testing-library/react`, `playwright`) are installed in `package.json`.

### Why it matters
Without automated tests, code modifications, refactoring, and package updates cannot be verified for regressions. Critical security logic (RLS policies, session handling, CSV sanitization, form validation) is vulnerable to accidental breakage.

### Concrete recommended fix
1. Install Vitest for unit/integration testing and Playwright for E2E testing:
   ```bash
   npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @playwright/test
   ```
2. Configure `vitest.config.ts` with `environment: 'jsdom'` and deterministic timezone settings (`process.env.TZ = 'UTC'`).
3. Add critical path tests:
   - Unit tests for `lib/questions.ts` question creation and validation.
   - Unit tests for CSV sanitization and formula injection prevention.
   - Integration tests for Supabase RLS policies.
   - Playwright E2E tests for the form completion and submission flow.

### Resolution
- Installed and configured `vitest` with `@testing-library/react`, `@testing-library/jest-dom`, and `jsdom` with `process.env.TZ = 'UTC'`, React plugin, and `@/*` path resolution in `vitest.config.ts` and `vitest.setup.ts`.
- Installed and configured `@playwright/test` in `playwright.config.ts`.
- Added `test`, `test:watch`, and `test:e2e` scripts to `package.json`.
- Implemented unit and integration test suites in `__tests__/`:
  - `validation.test.ts`: 21 tests covering all question types, bounds, required constraints, and multilingual error messages.
  - `fingerprint.test.ts`: 7 tests verifying client token generation, localStorage/cookie persistence, and anonymous SHA-256 respondent hashing.
  - `themes-and-utils.test.ts`: 4 tests for theme presets, CSS custom property generation, and Tailwind class merging.
  - `schema-rls.test.ts`: 8 tests validating Supabase RLS security policies, singleton constraints, and query performance indexes.
  - `submit-response.test.ts`: 3 tests for server action rate limiting, missing required field rejection, and unpublished form protection.
  - `question-renderer.test.tsx`: 5 component tests verifying short text, checkbox toggles, dropdown option selection, matrix rating, and error styles.
  - `form-player.test.tsx`: 4 component tests validating the full survey flow: welcome view, transition to first question, required validation blocking, and progression.
- Implemented end-to-end tests in `e2e/form-flow.spec.ts` for survey entry, form loading, and validation feedback.
- Verified all 52 automated tests pass with 0 errors, alongside zero ESLint errors and successful Next.js production builds.
