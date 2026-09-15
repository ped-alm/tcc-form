# Task: Align Normalization Utility Primary Keys with Database UUID Type

**Severity**: LOW  
**Category**: Database & TypeScript / Data Integrity  
**Status**: Verified Issue  
**Files**: `lib/normalized-questions.ts` (lines 54-57, 76, 89, 102), `supabase/schema.sql` (lines 105-156)

---

### What is wrong
In `lib/normalized-questions.ts`, `normalizeQuestionConfigs()` constructs primary keys as string slugs:
```ts
const questionId = config.id || `q_${qIdx + 1}`
questions.push({
  id: questionId, // e.g. "q01-consentimento"
  form_id: formId,
  question_key: config.id,
  // ...
})

options.push({
  id: `${questionId}_opt_${optIdx + 1}`,
  question_id: questionId,
  // ...
})
```
However, the PostgreSQL relational schema in `supabase/schema.sql` defines:
```sql
CREATE TABLE IF NOT EXISTS questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id UUID REFERENCES forms(id) ON DELETE CASCADE NOT NULL,
  question_key TEXT NOT NULL,
  ...
);

CREATE TABLE IF NOT EXISTS question_options (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
  ...
);
```
Both `id` and `question_id` are strictly typed as `UUID`.

### Why it matters
If `normalizeQuestionConfigs` is executed to seed or insert relational question data into Supabase, PostgreSQL will reject the insert with `invalid input syntax for type uuid: "q01-consentimento"`.
While the SQL trigger `sync_form_questions_to_normalized` in Postgres uses `gen_random_uuid()`, the TypeScript utility in `lib/normalized-questions.ts` generates invalid IDs that cannot be persisted to the PostgreSQL schema.

### Concrete recommended fix
Use valid UUIDs for `id` and keep the human-readable identifier in `question_key`:
```ts
import { v4 as uuidv4 } from 'uuid' // or crypto.randomUUID()

const questionId = crypto.randomUUID()
questions.push({
  id: questionId,
  form_id: formId,
  question_key: config.id || `q_${qIdx + 1}`,
  // ...
})
```

### Verification
Run `normalizeQuestionConfigs` and verify that all generated `id` and foreign key fields match the standard UUID v4 regex:
`/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`.
