Project specification: TypeForm-style form player.

1. Focused exclusively on the respondent experience (form player).
2. Clean, responsive, and accessible UI matching TypeForm's one-question-at-a-time presentation.
3. Submissions stored directly into Supabase (`public.responses`).
4. Data access and response management handled directly via Supabase dashboard / database.
5. Dedicated single-form architecture: database schema enforces at most one form instance (`is_singleton` constraint).