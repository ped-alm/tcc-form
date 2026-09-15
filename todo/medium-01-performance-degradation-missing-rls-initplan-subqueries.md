# Issue: Performance Degradation from Missing RLS InitPlan Subqueries

**Severity**: MEDIUM  
**Category**: Supabase Security & Database Performance  
**File and line**: `supabase/schema.sql:64-117`

### What is wrong
All Row Level Security policies defined in `supabase/schema.sql` compare `auth.uid()` directly without enclosing it in a scalar subquery:
```sql
CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can view their own forms" ON forms FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Form owners can view responses" ON responses FOR SELECT USING (
  EXISTS (SELECT 1 FROM forms WHERE forms.id = responses.form_id AND forms.user_id = auth.uid())
);
```

### Why it matters
In Postgres, functions like `auth.uid()` are marked as volatile. When used directly in a policy condition, the database planner re-invokes `auth.uid()` for every single row scanned by the query. When wrapped in a subquery `(select auth.uid())`, Postgres evaluates the function only once as an `initPlan` and caches the scalar result across all row comparisons. Without this optimization, queries on large tables suffer drastic performance degradation.

### Concrete recommended fix
Refactor all RLS policies in `supabase/schema.sql` to use `(select auth.uid())`:
```sql
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

CREATE POLICY "Users can view their own forms"
  ON forms FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Form owners can view responses"
  ON responses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM forms 
      WHERE forms.id = responses.form_id 
      AND forms.user_id = (select auth.uid())
    )
  );
```
