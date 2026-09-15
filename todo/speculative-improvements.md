# Speculative Architectural Improvements

These recommendations represent architectural enhancements that are not strictly bugs in current implementation, but would substantially improve system longevity, scalability, operational efficiency, and data integrity over time.

---

### 1. Normalized Database Schema for Form Questions

**Context**:  
Questions are currently stored as a JSONB array inside `forms.questions`.

**Tradeoff Analysis**:
- **Benefits**:
  - Eliminates JSON parsing and type-casting ambiguities in SQL and application code.
  - Enables foreign key relationships between responses and individual questions/options.
  - Allows direct SQL aggregate queries (e.g. calculating rating averages or frequency distributions across question options in PostgreSQL without extracting JSONB sub-keys).
  - Enforces DB-level uniqueness and character length constraints on question labels and options.
- **Costs**:
  - Adds schema complexity (multi-table relationships `forms` $\rightarrow$ `questions` $\rightarrow$ `question_options`).
  - Requires transactional multi-table updates (`BEGIN ... COMMIT`) during form builder saves.

**Recommendation**: Retain JSONB for MVP/prototype iteration, but migrate to normalized tables prior to scaling to high-concurrency enterprise survey workloads.

---

### 2. Bot Protection (Cloudflare Turnstile) on Public Submissions

**Context**:  
Anyone can submit responses to published forms via the web player without CAPTCHA or bot verification.

**Tradeoff Analysis**:
- **Benefits**:
  - Protects database storage from automated bot submission floods.
  - Eliminates corrupted automated survey submissions.
- **Costs**:
  - Adds an external dependency (Cloudflare Turnstile script).
  - Adds minor user friction (imperceptible for Turnstile, but still a client-side execution step).

**Recommendation**: Add Turnstile token verification inside the recommended response submission Server Action.

---

### 3. Soft-Delete Pattern for Forms and Responses

**Context**:  
Forms and responses currently undergo hard foreign-key cascading deletes:
```sql
CREATE TABLE forms (
  ...
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL
);
CREATE TABLE responses (
  ...
  form_id UUID REFERENCES forms(id) ON DELETE CASCADE NOT NULL
);
```

**Tradeoff Analysis**:
- **Benefits**:
  - Accidental clicks on "Delete Form" can be recovered within a 30-day grace period.
  - Maintains compliance audit trails and prevents irreversible data loss for creators.
- **Costs**:
  - Requires adding `deleted_at TIMESTAMPTZ` columns to `forms` and `responses`.
  - Requires appending `AND deleted_at IS NULL` to all queries, indexes, and RLS policies.

**Recommendation**: Implement a `deleted_at` soft-delete pattern before general availability launch.

---

### 4. Supabase Realtime for Live Response Monitoring

**Context**:  
The `ResponsesDashboard` currently loads initial data at request time; users must reload the page or trigger manual navigation to see new submissions.

**Tradeoff Analysis**:
- **Benefits**:
  - Enables form creators to view incoming survey responses live as respondents submit them in real time.
  - Provides a high-polish, modern software experience matching premium SaaS products.
- **Costs**:
  - Uses Supabase Realtime WebSocket connections, which can incur costs under high concurrent viewer counts.
  - Increases client component complexity to handle realtime subscription lifecycle, deduplication, and reconnections.

**Recommendation**: Implement an opt-in toggle on the Responses Dashboard that activates a `supabase.channel('responses')` subscription when the user is actively monitoring live submissions.
