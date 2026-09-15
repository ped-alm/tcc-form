# Task: Resolve TypeScript Test Contract Incompatibilities & Schema Drift

**Severity**: HIGH  
**Category**: TypeScript / Static Analysis & Code Quality  
**Status**: Verified Issue  
**Files**: `__tests__/question-renderer.test.tsx` (lines 11, 38, 67, 93), `__tests__/normalized-schema.test.ts` (line 92), `lib/database.types.ts` (lines 85-109, 114), `app/actions/submit-response.ts` (lines 188, 224-225)

---

### What is wrong
1. Running `npx tsc --noEmit` fails with 5 compile errors:
   - `__tests__/question-renderer.test.tsx(11,11)`: `Property 'required' is missing in type '{ id: string; type: "short_text"; title: string; placeholder: string; }' but required in type 'QuestionConfig'.` (Repeated on lines 38, 67, 93).
   - `__tests__/normalized-schema.test.ts(92,13)`: Incompatible types for property `description` (`Type 'undefined' is not assignable to type 'string | null'`).
2. Hand-written `lib/database.types.ts` has drifted from the actual database schema:
   - Contains a definition for a non-existent `profiles` table.
   - Declares `user_id?: string | null` on `forms.Row`, whereas `supabase/schema.sql` has no `user_id` column.
3. In `app/actions/submit-response.ts`, database client operations resort to unsafe escape hatches:
   `as ReturnType<typeof client.from>` and `insert(insertData as never)`.

### Why it matters
1. CI/CD pipelines that run strict typechecking (`tsc --noEmit`) fail.
2. Hand-written database types mask real schema defects and break autocomplete, refactoring, and type inference across the project.
3. Unsafe casts (`as never`) undermine TypeScript's compile-time guarantees, creating potential runtime failures when schema fields change.

### Concrete recommended fix
1. In `lib/database.types.ts`:
   - Either make `required?: boolean` on `QuestionConfig` with a default of `false`, or explicitly pass `required: false` in test mock objects in `__tests__/question-renderer.test.tsx`.
   - Update `lib/database.types.ts` by generating official types from Supabase CLI:
     ```bash
     npx supabase gen types typescript --local > lib/database.types.ts
     ```
   - Remove phantom tables (`profiles`) and non-existent columns (`forms.user_id`).
2. In `__tests__/normalized-schema.test.ts`:
   - Coalesce `description: q.description ?? null`.
3. In `app/actions/submit-response.ts`:
   - Use strongly typed clients without `as never` or `as ReturnType<typeof client.from>`.

### Verification
Run:
```bash
npx tsc --noEmit
```
Verify that the command exits cleanly with code 0 and produces no TypeScript errors.
