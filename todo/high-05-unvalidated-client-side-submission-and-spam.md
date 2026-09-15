# Issue: Unvalidated Public Response Submissions and Bot Spam Exposure

**Severity**: HIGH  
**Category**: Supabase Security & Data Integrity  
**File and line**: `supabase/schema.sql:120-128`, `components/form-player/form-player.tsx:172-194`

### What is wrong
The RLS INSERT policy on the `responses` table:
```sql
CREATE POLICY "Anyone can submit responses to published forms"
  ON responses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM forms 
      WHERE forms.id = form_id 
      AND forms.status = 'published'
    )
  );
```
permits any anonymous client possessing the Supabase anon key to insert arbitrary JSON data into the database. Furthermore:
1. There is no verification that the answers conform to the form's `QuestionConfig[]` (valid question IDs, types, option bounds, or max character limits).
2. The client-side `handleSubmit` function only executes `validateCurrentQuestion()`, failing to re-verify that previously answered questions or skipped required questions are valid.
3. There is no rate limiting, CAPTCHA, or bot protection on response submission.

### Why it matters
Automated bots can spam millions of synthetic responses into `responses`, exhausting database storage, corrupting survey results, and polluting the creator's dashboard. A single HTTP script can forge malformed answers or send multi-megabyte payloads directly to PostgREST.

### Concrete recommended fix
1. Route all response submissions through a Server Action rather than direct client-side database insertion.
2. In the Server Action:
   - Fetch the form definition on the server.
   - Use Zod to strictly validate the submitted answers map against the questions array (ensuring required questions are present, option values match allowed options, string lengths are bounded).
   - Implement rate limiting (e.g. via Upstash Redis or Cloudflare Turnstile token validation).
   - Insert the sanitized record using an authenticated or service client after validation passes.
