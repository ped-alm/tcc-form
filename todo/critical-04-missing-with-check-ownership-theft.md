# Issue: Missing `WITH CHECK` on Forms UPDATE Policy Enables Ownership Hijacking

**Severity**: CRITICAL  
**Category**: Supabase Security / Authorization (BOLA / IDOR)  
**File and line**: `supabase/schema.sql:85-87`

### What is wrong
The RLS UPDATE policy on the `forms` table only provides a `USING` expression:
```sql
CREATE POLICY "Users can update their own forms"
  ON forms FOR UPDATE
  USING (auth.uid() = user_id);
```
It does not define a `WITH CHECK` clause.

### Why it matters
In Postgres Row-Level Security, the `USING` clause controls which existing rows are visible for update, while `WITH CHECK` governs the new values of the row after the update. Because `WITH CHECK` is omitted, any user who owns a form can execute an `UPDATE forms SET user_id = '<target-user-uuid>' WHERE id = '<form-id>'`. This allows an attacker to reassign form ownership to another user, orphan records, or inject unwanted forms into another account.

### Concrete recommended fix
Recreate the policy with both `TO authenticated`, an optimized subquery, and a matching `WITH CHECK` clause:
```sql
DROP POLICY IF EXISTS "Users can update their own forms" ON forms;

CREATE POLICY "Users can update their own forms"
  ON forms FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
```
Repeat this pattern for the `profiles` UPDATE policy as well to ensure users cannot modify their primary key `id`.
