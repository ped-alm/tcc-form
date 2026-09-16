# Codebase Review Issues & Action Items

This directory contains individual task issue files generated from the comprehensive architectural, security, and code review of the `tcc-form` repository.

### Summary of Issues by Severity

| # | Severity | Title | File(s) | Category | Type |
|---|---|---|---|---|---|
| 01 | **CRITICAL** | [Fix Database Views Bypassing RLS on Survey Responses](./01-critical-views-bypass-rls.md) | `supabase/schema.sql`, `supabase/normalized-schema.sql` | Supabase Security / Data Privacy | Resolved |
| 02 | **CRITICAL** | [Fix Cloudflare Turnstile Re-render Loop & Token Invalidation](./02-critical-turnstile-rerender-loop.md) | `components/form-player/turnstile-widget.tsx`, `form-player.tsx` | React / UX & Correctness | Resolved |
| 03 | **HIGH** | [Enforce Database-Level Unique Constraint on Respondent Hash](./03-high-database-missing-unique-constraint-race-condition.md) | `supabase/schema.sql`, `submit-response.ts` | Database / Concurrency | Resolved |
| 04 | **HIGH** | [Fix Silent Deduplication Failure Under Anon Client Role](./04-high-supabase-silent-deduplication-failure-anon-rls.md) | `app/actions/submit-response.ts`, `.env.example` | Supabase Security & Architecture | Resolved |
| 05 | **HIGH** | [Secure Overly Permissive `TO authenticated USING (true)` Policies](./05-high-security-overly-permissive-authenticated-policies.md) | `supabase/schema.sql`, `supabase/normalized-schema.sql` | Supabase Security / Authorization | Resolved |
| 06 | **HIGH** | [Resolve TypeScript Test Contract Incompatibilities & Schema Drift](./06-high-typescript-test-type-errors-and-schema-mismatch.md) | `__tests__/*`, `database.types.ts`, `submit-response.ts` | TypeScript / Static Analysis | Resolved |
| 07 | **MEDIUM** | [Implement Zod Schema Validation for Server Action Payload](./07-medium-action-missing-zod-payload-validation.md) | `app/actions/submit-response.ts` | Next.js Architecture / Security | Verified Issue |
| 08 | **MEDIUM** | [Fix Respondent Fingerprint Entropy Implementation Discrepancy](./08-medium-fingerprint-incognito-correlation-flaw.md) | `lib/fingerprint.ts` | Correctness / Deduplication | Verified Issue |
| 09 | **MEDIUM** | [Complete Bilingual Localization in Question Renderer UI](./09-medium-i18n-hardcoded-strings-matrix-yes-no.md) | `components/form-player/question-renderer.tsx` | UI / Maintainability | Verified Issue |
| 10 | **LOW** | [Import Missing Space Grotesk Font for Forest Theme](./10-low-layout-missing-space-grotesk-font.md) | `app/layout.tsx`, `lib/themes.ts` | Next.js & UI Architecture | Verified Issue |
| 11 | **LOW** | [Modernize React 19 Ref Handling in Turnstile Widget](./11-low-react-legacy-forwardref-turnstile.md) | `components/form-player/turnstile-widget.tsx` | React 19 Best Practices | Verified Issue |
| 12 | **LOW** | [Align Normalization Utility Primary Keys with Database UUID Type](./12-low-database-normalization-uuid-mismatch.md) | `lib/normalized-questions.ts`, `schema.sql` | Database & TypeScript | Verified Issue |
| 13 | **LOW** | [Evaluate Distributed Rate Limiting for Multi-Instance Serverless Deployment](./13-low-speculative-serverless-in-memory-rate-limiting.md) | `app/actions/submit-response.ts` | Architecture & Scalability | Speculative Improvement |

---

### Overall Verdict: SHIP WITH FIXES

The application exhibits excellent craftsmanship in its UI animations, responsive TypeForm-style presentation, and bilingual question definitions. However, deployment to production must be halted until the **CRITICAL** issues (database views leaking private responses via PostgREST and Turnstile re-rendering loop blocking submission) and **HIGH** issues (database race condition and overly permissive RLS) are resolved.
