# Task: Enforce Database-Level Unique Constraint on Respondent Hash to Prevent Race Conditions

**Severity**: HIGH  
**Category**: Database / Correctness & Concurrency  
**Status**: Verified Issue  
**Files**: `supabase/schema.sql` (line 38), `app/actions/submit-response.ts` (lines 184-212, 224-228)

---

### What is wrong
In `supabase/schema.sql`, line 38 creates a non-unique B-tree index for respondent hashes:
```sql
CREATE INDEX idx_responses_respondent_hash ON responses(form_id, respondent_hash);
```
In `app/actions/submit-response.ts`, the deduplication logic executes an application-level check-then-act pattern:
```ts
const { data: existing } = await client.from('responses')
  .select('id')
  .eq('form_id', payload.formId)
  .eq('respondent_hash', payload.respondentHash)
  .maybeSingle()

if (existing) {
  return { success: true, isDuplicate: true }
}

// ... later ...
await client.from('responses').insert(insertData)
```

### Why it matters
Under concurrent submissions (e.g. double-clicking submit, automated retries, or concurrent duplicate requests from the same respondent), both requests execute the `SELECT` query at the same time, neither finds an existing row, and both execute the `INSERT` statement.

Because the database schema lacks a `UNIQUE` constraint on `(form_id, respondent_hash)`, the database accepts both rows. The database is the only race-proof backstop against duplicate submissions. Relying purely on application-level read-then-write checks is inherently vulnerable to race conditions.

### Concrete recommended fix
1. In `supabase/schema.sql`, replace the regular index with a partial unique index:
```sql
-- Remove non-unique index if present
DROP INDEX IF EXISTS idx_responses_respondent_hash;

-- Create unique index to guarantee race-proof deduplication
CREATE UNIQUE INDEX idx_responses_unique_respondent
  ON responses(form_id, respondent_hash)
  WHERE respondent_hash IS NOT NULL;
```
2. In `app/actions/submit-response.ts`, handle the Postgres unique constraint violation gracefully:
```ts
const { error: insertError } = await client.from('responses').insert(insertData)

if (insertError) {
  // Check for Postgres unique violation code 23505
  if (insertError.code === '23505') {
    return {
      success: true,
      isDuplicate: true,
    }
  }
  // Handle other errors...
}
```

### Verification
Write a concurrent submission test:
Dispatch two identical requests with the same `formId` and `respondentHash` using `Promise.all([submitResponseAction(...), submitResponseAction(...)])`.
Verify that exactly one row is inserted into `responses`, both promises resolve successfully, and at least one returns `isDuplicate: true`.
