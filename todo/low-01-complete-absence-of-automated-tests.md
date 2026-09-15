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
