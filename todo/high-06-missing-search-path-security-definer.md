# Issue: `SECURITY DEFINER` Function Missing `search_path` and Public Access Revocation

**Severity**: HIGH  
**Category**: Database & Postgres Security  
**File and line**: `supabase/schema.sql:134-160`

### What is wrong
The trigger function `handle_new_user()` is created as:
```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles ...
...
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```
It does not define a fixed `search_path`. Additionally, Postgres grants `EXECUTE` privileges on functions in the `public` schema to `PUBLIC` by default.

### Why it matters
`SECURITY DEFINER` functions execute with the privileges of the user who defined them (typically `postgres` or `supabase_admin`). Without an immutable `search_path`, malicious users could create temporary objects or manipulate search paths to hijack table resolution during execution. Furthermore, leaving `EXECUTE` granted to `PUBLIC` allows anyone with the anon or authenticated role to invoke the function directly via RPC endpoints.

### Concrete recommended fix
Set a secure `search_path` and revoke execution privileges from public roles:
```sql
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
```
For future functions, always specify `SET search_path = public, pg_temp` directly in the `CREATE FUNCTION` statement.
