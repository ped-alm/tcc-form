# Issue: React Compiler Skipped and Hook Violations Failing Lint

**Severity**: MEDIUM  
**Category**: React 19 & Build Quality  
**File and line**: `components/form-player/form-player.tsx:57-61`, `80-241`

### What is wrong
`npm run lint` fails with 14 errors and 10 warnings across the codebase:
1. Synchronous state update inside `useEffect`:
   ```typescript
   useEffect(() => {
     if (form.theme) {
       setCurrentThemePreset(form.theme)
     }
   }, [form.theme])
   ```
   Triggers ESLint error `react-hooks/set-state-in-effect`: "Calling setState synchronously within an effect can trigger cascading renders."
2. React Compiler cannot preserve manual memoization on `validateCurrentQuestion`, `handleSubmit`, `goToNext`, and `goToPrevious` (`react-hooks/preserve-manual-memoization`). The inferred dependencies do not match the specified dependency arrays.
3. Use of raw `<a>` instead of `<Link>` on line 395.

### Why it matters
CI/CD automated quality gates fail immediately. Because React Compiler cannot optimize the component, it falls back to unoptimized rendering, causing extra re-render passes on every keypress and degraded frame rates during form completion.

### Concrete recommended fix
1. Remove the theme-syncing effect. Either initialize the state with the prop or pass a `key={form.theme}` to reset the component tree when the theme changes.
2. Fix all callback dependency arrays to match React 19 compiler expectations, or remove manual `useCallback` calls where React Compiler automatically handles memoization.
3. Replace the `<a>` tag on line 395 with Next.js `<Link href="/">`.
