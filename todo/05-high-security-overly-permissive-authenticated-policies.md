# Task: Secure Overly Permissive `TO authenticated USING (true)` RLS Policies

**Severity**: HIGH  
**Category**: Supabase Security / Authorization (BOLA/IDOR)  
**Status**: Resolved  
**Files**: `supabase/schema.sql` (lines 54-58, 73-83, 182-186, 201-205, 220-224, 239-243), `supabase/normalized-schema.sql` (lines 84-90, 105-110, 126-131, 147-152)

---

### What is wrong
In `supabase/schema.sql` and `supabase/normalized-schema.sql`, administrative policies grant unrestricted access to ANY authenticated user:
```sql
CREATE POLICY "Authenticated users can manage forms"
  ON forms FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view responses"
  ON responses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete responses"
  ON responses FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage questions"
  ON questions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
```
Policies on `question_options`, `question_matrix_rows`, and `question_matrix_columns` repeat this same pattern.

### Why it matters
In Supabase, any user who calls `supabase.auth.signUp()` automatically gains the Postgres `authenticated` role.
Because these policies check only the role (`TO authenticated`) and have no ownership predicate or role validation (`USING (true)`):
1. **Response Theft**: Any signed-in user can execute `SELECT * FROM responses;` and read all respondent survey data and metadata.
2. **Response Wipeout**: Any signed-in user can execute `DELETE FROM responses;` and delete all collected research data.
3. **Form Tampering / Takeover**: Any signed-in user can change the form title, question configurations, set `status = 'closed'`, or delete the form entirely.

This violates the principle of Authorization vs Authentication: "Checking role = authenticated without checking user identity or admin claim is authentication without authorization."

### Concrete recommended fix
1. If management and data export are performed strictly via the Supabase Dashboard / SQL editor:
   - Supabase Dashboard queries run with privileged roles (`postgres` / `service_role`) that bypass RLS by design.
   - Simply **DROP** the `TO authenticated` policies entirely:
   ```sql
   DROP POLICY IF EXISTS "Authenticated users can manage forms" ON forms;
   DROP POLICY IF EXISTS "Authenticated users can view responses" ON responses;
   DROP POLICY IF EXISTS "Authenticated users can delete responses" ON responses;
   DROP POLICY IF EXISTS "Authenticated users can manage questions" ON questions;
   DROP POLICY IF EXISTS "Authenticated users can manage question options" ON question_options;
   DROP POLICY IF EXISTS "Authenticated users can manage matrix rows" ON question_matrix_rows;
   DROP POLICY IF EXISTS "Authenticated users can manage matrix columns" ON question_matrix_columns;
   ```
2. If client-side or researcher login is required:
   - Check `app_metadata` (never `user_metadata`, which is user-editable):
   ```sql
   CREATE POLICY "Admins can view responses"
     ON responses FOR SELECT
     TO authenticated
     USING ((select auth.jwt()->'app_metadata'->>'role') = 'admin');

   CREATE POLICY "Admins can delete responses"
     ON responses FOR DELETE
     TO authenticated
     USING ((select auth.jwt()->'app_metadata'->>'role') = 'admin');
   ```

### Verification
1. Sign in as a regular user via Supabase Auth without the `admin` claim.
2. Attempt to run `DELETE FROM responses` or `SELECT * FROM responses`.
3. Verify that RLS denies the query with an empty response or permission error.
