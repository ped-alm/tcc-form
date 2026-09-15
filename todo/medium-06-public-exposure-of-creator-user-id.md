# Issue: Public Exposure of Form Creator's Internal UUID

**Severity**: MEDIUM  
**Category**: Supabase Security & Data Privacy  
**File and line**: `supabase/schema.sql:93-96`, `app/f/[slug]/page.tsx:41`

### What is wrong
The public RLS policy on `forms`:
```sql
CREATE POLICY "Anyone can view published forms"
  ON forms FOR SELECT
  USING (status = 'published');
```
allows any anonymous user to select all columns on published forms. In `FormPage`, the query runs:
```typescript
const { data, error } = await supabase
  .from('forms')
  .select('*')
  .eq('slug', slug)
  .eq('status', 'published')
  .single()
```
This retrieves all columns, including `user_id` (the form creator's auth UUID), and passes the entire object to the client component `<FormPlayer form={form} />`.

### Why it matters
The internal `user_id` (Supabase `auth.users` UUID) is private identity metadata. Exposing creator UUIDs in public client bundles enables user enumeration, correlation of forms created by the same author, and potential targeting in auth-related exploits.

### Concrete recommended fix
1. Narrow the columns selected in `app/f/[slug]/page.tsx` and `app/page.tsx`:
   ```typescript
   const { data, error } = await supabase
     .from('forms')
     .select('id, title, description, slug, theme, questions, thank_you_message, status')
     .eq('slug', slug)
     .eq('status', 'published')
     .single()
   ```
2. Create a secure view for public form rendering:
   ```sql
   CREATE OR REPLACE VIEW public_forms WITH (security_invoker = true) AS
   SELECT id, title, description, slug, theme, questions, thank_you_message, status
   FROM forms
   WHERE status = 'published';
   ```
