# Issue: Non-Unique Slug DB Constraint Causes Fatal Runtime Crash on Form Views

**Severity**: CRITICAL  
**Category**: Database & Next.js Architecture / Correctness  
**File and line**: `supabase/schema.sql:36`, `app/f/[slug]/page.tsx:39-44`, `app/f/[slug]/page.tsx:16-21`

### What is wrong
The `forms` table in `supabase/schema.sql` defines uniqueness per user:
```sql
UNIQUE(user_id, slug)
```
However, the application routing serves forms at `/f/[slug]` with no user namespace, and queries forms with `.single()`:
```typescript
const { data, error } = await supabase
  .from('forms')
  .select('*')
  .eq('slug', slug)
  .eq('status', 'published')
  .single()
```
If two distinct users create and publish forms with the identical slug (for example, `feedback`, `survey`, `contact`, or `test`), PostgREST throws code `PGRST116` ("The result contains 2 rows, while 1 was expected").

### Why it matters
As soon as any slug collision occurs between two published forms, neither form can be rendered. Both users' forms will trigger PostgREST exceptions, causing `notFound()` or 500 errors. A malicious or regular user can intentionally or accidentally take another user's live public form offline simply by creating a form with the same slug.

### Concrete recommended fix
Choose one of the following two architectural fixes:

1. **Global Slug Uniqueness (Recommended for clean URLs)**:
   - Change the database constraint to make `slug` globally unique:
     ```sql
     ALTER TABLE forms DROP CONSTRAINT forms_user_id_slug_key;
     ALTER TABLE forms ADD CONSTRAINT forms_slug_unique UNIQUE (slug);
     CREATE INDEX idx_forms_slug ON forms(slug);
     ```
   - Validate global slug availability in the form editor before allowing the user to save.
2. **Namespaced URL Routing**:
   - Change the public route from `/f/[slug]` to `/f/[username]/[slug]` or `/f/[formId]`.
   - Update `app/f/[slug]` to accept both parameters or query by form UUID.
