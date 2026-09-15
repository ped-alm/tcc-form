# Task: Fix Silent Deduplication Failure When Running Under Anon Client Role

**Severity**: HIGH  
**Category**: Supabase Security & Architecture  
**Status**: Verified Issue  
**Files**: `app/actions/submit-response.ts` (lines 61-65, 184-212), `.env.example`, `README.md`

---

### What is wrong
In `app/actions/submit-response.ts`:
```ts
async function getSupabaseSubmitClient() {
  const adminClient = createAdminClient()
  if (adminClient) return adminClient
  return await createClient()
}
```
`createAdminClient()` returns `null` if `SUPABASE_SERVICE_ROLE_KEY` is not defined in the environment.
Neither `.env.example` nor `README.md` mentions `SUPABASE_SERVICE_ROLE_KEY` (they only list `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`).

When `SUPABASE_SERVICE_ROLE_KEY` is not present, `getSupabaseSubmitClient()` falls back to `await createClient()`, which uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Postgres role `anon`).
Then the action attempts to query existing responses:
```ts
const { data: existing } = await client
  .from('responses')
  .select('id')
  .eq('form_id', payload.formId)
  .eq('respondent_hash', payload.respondentHash)
  .maybeSingle()
```
However, in `supabase/schema.sql`, the RLS policy for `responses` SELECT is:
```sql
CREATE POLICY "Authenticated users can view responses"
  ON responses FOR SELECT
  TO authenticated
  USING (true);
```
There is NO `SELECT` policy for `anon` on `responses`.

### Why it matters
In standard deployment per README/example config, the query executes as `anon`. Postgres RLS silently denies access or returns 0 rows (`data: null`). The check `if (existing)` is NEVER true!
Consequently:
1. Database-backed respondent deduplication is completely non-functional.
2. The application falls back exclusively to the browser cookie (`survey_submitted_${formId}`). If a user submits via incognito mode, clears cookies, or uses another browser profile, the server cannot detect their duplicate submission.
3. The server action executes unnecessary useless SELECT queries that always fail silently.

### Concrete recommended fix
Choose one of two architectural solutions:

**Option A (Recommended: Database RPC function)**:
Create a secure database function (`submit_response`) with `SECURITY DEFINER` in a non-exposed schema (or restricted grant) that checks deduplication and performs the insert atomically, without granting public read access to `responses`:
```sql
CREATE OR REPLACE FUNCTION submit_survey_response(
  p_form_id UUID,
  p_answers JSONB,
  p_respondent_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id UUID;
  v_new_id UUID;
BEGIN
  IF p_respondent_hash IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM responses
    WHERE form_id = p_form_id AND respondent_hash = p_respondent_hash
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'is_duplicate', true);
    END IF;
  END IF;

  INSERT INTO responses (form_id, answers, respondent_hash)
  VALUES (p_form_id, p_answers, p_respondent_hash)
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('success', true, 'is_duplicate', false, 'id', v_new_id);
END;
$$;

GRANT EXECUTE ON FUNCTION submit_survey_response TO anon, authenticated;
```

**Option B (Explicit Service Role Key configuration)**:
1. Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.example` and `README.md`.
2. In `app/actions/submit-response.ts`, require `createAdminClient()` and log an explicit error if missing rather than silently failing RLS with the anon key.

### Verification
Execute `submitResponseAction` using only `NEXT_PUBLIC_SUPABASE_ANON_KEY` without `SUPABASE_SERVICE_ROLE_KEY`. Verify that duplicate submissions with the same hash return `isDuplicate: true` even after clearing browser cookies.
