# Issue: Unsafe TypeScript Assertions and Explicit `any`

**Severity**: MEDIUM  
**Category**: TypeScript & Type Safety  
**File and line**: `lib/example-form.ts:573-581`, `app/(dashboard)/dashboard/page.tsx:18`, `components/form-builder/form-builder.tsx:80`

### What is wrong
1. **Explicit `any`**: In `lib/example-form.ts:573, 576, 581`, variables are typed as `any`:
   ```typescript
   const oldVal: any = oldAnswers[qId]
   val.map((item: any) => ...)
   ```
   This triggers `@typescript-eslint/no-explicit-any` errors in ESLint.
2. **Unsafe `as never` casts**: In `form-builder.tsx:80` and `forms/new/page.tsx:38`, insert and update payloads are cast to `as never` to bypass database type mismatches.
3. **Unsafe non-null assertion**: In `dashboard/page.tsx:18`, `user!.id` is accessed without verifying that `user` is non-null.

### Why it matters
Bypassing TypeScript type checking masks schema contract errors and regressions, permits invalid JSON data to be sent to the database without compile-time warnings, and causes ESLint and CI checks to fail.

### Concrete recommended fix
1. Generate official Supabase TypeScript types directly from the database schema:
   ```bash
   supabase gen types typescript --local > lib/database.types.ts
   ```
2. Replace `as never` casts with typed insert/update objects:
   ```typescript
   const updateData: Database['public']['Tables']['forms']['Update'] = { ... }
   ```
3. In `lib/example-form.ts`, replace `any` with `Json` or `string | string[] | Record<string, string>`.
4. In `dashboard/page.tsx`, ensure `if (!user) redirect('/login')` precedes any usage of `user.id`.
