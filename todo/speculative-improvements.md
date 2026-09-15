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

