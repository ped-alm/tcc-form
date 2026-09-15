# Task: Fix Database Views Bypassing RLS on Survey Responses

**Severity**: CRITICAL  
**Category**: Supabase Security / Data Integrity  
**Status**: Resolved
**Files**: `supabase/schema.sql` (lines 393-430), `supabase/normalized-schema.sql` (lines 302-339)

---

### What is wrong
Views `v_response_answers_normalized` and `v_question_metrics` are defined in the `public` schema without `WITH (security_invoker = true)`:
```sql
CREATE OR REPLACE VIEW v_response_answers_normalized AS
SELECT
  r.id AS response_id,
  r.form_id,
  r.respondent_hash,
  r.submitted_at,
  q.id AS question_id,
  q.question_key,
  q.type AS question_type,
  q.title AS question_title,
  r.answers ->> q.question_key AS answer_text,
  r.answers -> q.question_key AS answer_raw
FROM responses r
JOIN questions q ON q.form_id = r.form_id;
```
In PostgreSQL 15+ and Supabase, views execute with the permissions of the view definer (`postgres` role / bypassrls) unless explicitly declared with `WITH (security_invoker = true)`.

### Why it matters
The underlying `responses` table has RLS policies intentionally restricting `SELECT` access to `authenticated` users only (`CREATE POLICY "Authenticated users can view responses"`), keeping anonymous respondents (`anon` role) from viewing any other respondent's submissions.

However, because PostgREST exposes all views in the `public` schema via the Data API, any unauthenticated user possessing the public `NEXT_PUBLIC_SUPABASE_ANON_KEY` can make a simple HTTP GET request to `/rest/v1/v_response_answers_normalized`. The view bypasses the `responses` RLS policy entirely, leaking every respondent's raw answers, submission timestamps, and hashes. This directly breaks participant privacy and confidentiality.

### Concrete recommended fix
1. Add `WITH (security_invoker = true)` to both views in `supabase/schema.sql` and `supabase/normalized-schema.sql`:
```sql
CREATE OR REPLACE VIEW v_response_answers_normalized
WITH (security_invoker = true) AS
SELECT
  r.id AS response_id,
  r.form_id,
  r.respondent_hash,
  r.submitted_at,
  q.id AS question_id,
  q.question_key,
  q.type AS question_type,
  q.title AS question_title,
  r.answers ->> q.question_key AS answer_text,
  r.answers -> q.question_key AS answer_raw
FROM responses r
JOIN questions q ON q.form_id = r.form_id;

CREATE OR REPLACE VIEW v_question_metrics
WITH (security_invoker = true) AS
SELECT
  q.form_id,
  q.id AS question_id,
  q.question_key,
  q.type AS question_type,
  q.title,
  COUNT(r.id) AS total_survey_responses,
  COUNT(r.answers -> q.question_key) AS answered_count,
  ROUND(
    AVG(
      CASE 
        WHEN q.type IN ('rating', 'opinion_scale', 'number') AND (r.answers ->> q.question_key) ~ '^[0-9]+(\.[0-9]+)?$' 
        THEN (r.answers ->> q.question_key)::numeric 
        ELSE NULL 
      END
    ), 2
  ) AS numeric_average
FROM questions q
LEFT JOIN responses r ON r.form_id = q.form_id
GROUP BY q.form_id, q.id, q.question_key, q.type, q.title;
```
2. Revoke permissions from `anon` and `public`:
```sql
REVOKE ALL ON v_response_answers_normalized FROM anon, public;
REVOKE ALL ON v_question_metrics FROM anon, public;
```

### Verification
Run an anonymous query via PostgREST curl:
```bash
curl -H "apikey: <ANON_KEY>" "https://<PROJECT-REF>.supabase.co/rest/v1/v_response_answers_normalized"
```
Verify that it returns an empty array or 403 Forbidden instead of leaking response records.
