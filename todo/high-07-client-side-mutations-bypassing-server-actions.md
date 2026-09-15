# Issue: Client-Side Database Mutations Bypassing Server Actions

**Severity**: HIGH  
**Category**: Next.js Architecture & Security  
**File and line**: `components/form-builder/form-builder.tsx:68-90`, `110-124`, `components/dashboard/delete-form-button.tsx:30-45`

### What is wrong
All core domain mutations in the application are executed directly from browser client components using `@supabase/ssr` browser clients:
- `supabase.from('forms').update(...)` (Saving form and changing status in `form-builder.tsx`)
- `supabase.from('forms').delete(...)` (Deleting forms in `delete-form-button.tsx`)
- `supabase.from('responses').delete(...)` (Deleting responses in `responses-dashboard.tsx`)
There are zero Server Actions implemented anywhere in the project.

### Why it matters
1. **Lack of Server-Side Validation**: Bypassing server endpoints means there is no central location to enforce business rules, validate JSON structures with Zod, or sanitize HTML/text fields. A malicious client can send malformed or oversized payloads directly to Postgres.
2. **Architecture Regression**: In Next.js App Router, direct client-to-database writes bypass cache invalidation (`revalidatePath`, `revalidateTag`), forcing components to rely on manual `router.refresh()` calls that are prone to stale UI state and race conditions.

### Concrete recommended fix
Create Server Actions under `app/actions/` for all mutations:
1. `saveFormAction(formId, formData)`: Authenticates via `getClaims()`, validates the form payload with a Zod schema, updates `forms`, and calls `revalidatePath('/dashboard')`.
2. `deleteFormAction(formId)`: Authenticates, confirms ownership, deletes the form, and revalidates.
3. `deleteResponseAction(formId, responseId)`: Authenticates, confirms ownership, deletes the response record, and revalidates.
Refactor client components to invoke these Server Actions using React 19's `useActionState` or `useTransition`.
