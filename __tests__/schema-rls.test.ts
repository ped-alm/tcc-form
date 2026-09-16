import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Supabase Schema and RLS Security Policies', () => {
  const schemaPath = path.resolve(__dirname, '../supabase/schema.sql')
  const schemaSql = fs.readFileSync(schemaPath, 'utf8')

  it('should enable Row Level Security on all core tables', () => {
    expect(schemaSql).toMatch(/ALTER TABLE forms ENABLE ROW LEVEL SECURITY;/i)
    expect(schemaSql).toMatch(/ALTER TABLE responses ENABLE ROW LEVEL SECURITY;/i)
  })

  it('should restrict anonymous users to viewing published forms only', () => {
    expect(schemaSql).toContain('CREATE POLICY "Anyone can view published forms"')
    expect(schemaSql).toMatch(/ON forms FOR SELECT[\s\S]*?TO anon, authenticated[\s\S]*?USING \(status = 'published'\);/i)
  })

  it('should restrict form mutations to authenticated admin users with admin role claim', () => {
    expect(schemaSql).toContain('CREATE POLICY "Admins can manage forms"')
    expect(schemaSql).toMatch(/ON forms FOR ALL[\s\S]*?TO authenticated[\s\S]*?auth\.jwt\(\)->'app_metadata'->>'role'\) = 'admin'/i)
  })

  it('should allow public responses insertion only for published forms', () => {
    expect(schemaSql).toContain('CREATE POLICY "Anyone can submit responses to published forms"')
    expect(schemaSql).toMatch(/ON responses FOR INSERT[\s\S]*?WHERE forms\.id = form_id[\s\S]*?AND forms\.status = 'published'/i)
  })

  it('should protect respondent privacy by restricting response SELECT to authenticated admin researchers', () => {
    expect(schemaSql).toContain('CREATE POLICY "Admins can view responses"')
    expect(schemaSql).toMatch(/ON responses FOR SELECT[\s\S]*?TO authenticated[\s\S]*?auth\.jwt\(\)->'app_metadata'->>'role'\) = 'admin'/i)
    // Verify that anon is NEVER granted SELECT on responses within the policy statement
    expect(schemaSql).not.toMatch(/ON responses FOR SELECT[^;]*?TO[^\n]*anon/i)
  })

  it('should protect responses from unauthorized deletion by requiring admin role claim', () => {
    expect(schemaSql).toContain('CREATE POLICY "Admins can delete responses"')
    expect(schemaSql).toMatch(/ON responses FOR DELETE[\s\S]*?TO authenticated[\s\S]*?auth\.jwt\(\)->'app_metadata'->>'role'\) = 'admin'/i)
    // Verify that anon is NEVER granted DELETE on responses within the policy statement
    expect(schemaSql).not.toMatch(/ON responses FOR DELETE[^;]*?TO[^\n]*anon/i)
  })

  it('should not contain overly permissive USING (true) policies for authenticated role (preventing BOLA/IDOR)', () => {
    // Must not contain any policy granting unrestricted access to authenticated role
    expect(schemaSql).not.toMatch(/TO authenticated[\s\n]+USING\s*\(\s*true\s*\)/i)
    expect(schemaSql).toContain('DROP POLICY IF EXISTS "Authenticated users can manage questions"')
    expect(schemaSql).toContain('DROP POLICY IF EXISTS "Authenticated users can manage forms"')
    expect(schemaSql).toContain('DROP POLICY IF EXISTS "Authenticated users can view responses"')
    expect(schemaSql).toContain('DROP POLICY IF EXISTS "Authenticated users can delete responses"')
  })

  it('should enforce singleton form architecture via database check constraint', () => {
    expect(schemaSql).toMatch(/is_singleton\s+BOOLEAN\s+DEFAULT\s+true\s+NOT\s+NULL\s+UNIQUE\s+CHECK\s*\(is_singleton\)/i)
  })

  it('should define performance indexes and unique constraint for response deduplication and queries', () => {
    expect(schemaSql).toContain('CREATE INDEX idx_responses_form_id')
    expect(schemaSql).toContain('CREATE INDEX idx_responses_submitted_at')
    expect(schemaSql).toContain('CREATE UNIQUE INDEX idx_responses_unique_respondent')
    expect(schemaSql).toMatch(/CREATE\s+UNIQUE\s+INDEX\s+idx_responses_unique_respondent\s+ON\s+responses\s*\(\s*form_id\s*,\s*respondent_hash\s*\)\s+WHERE\s+respondent_hash\s+IS\s+NOT\s+NULL/i)
  })

  it('should define secure submit_survey_response RPC function with SECURITY DEFINER and execute permissions', () => {
    expect(schemaSql).toContain('CREATE OR REPLACE FUNCTION submit_survey_response')
    expect(schemaSql).toMatch(/SECURITY\s+DEFINER/i)
    expect(schemaSql).toMatch(/SET\s+search_path\s*=\s*public/i)
    expect(schemaSql).toMatch(/RETURNS\s+JSONB/i)
    expect(schemaSql).toMatch(/WHEN\s+unique_violation\s+THEN/i)
    expect(schemaSql).toContain('GRANT EXECUTE ON FUNCTION submit_survey_response(UUID, JSONB, TEXT) TO anon, authenticated;')
  })

  it('should enforce security_invoker on analytical views and revoke anon/public privileges to prevent RLS bypass', () => {
    // Views must be created WITH (security_invoker = true)
    expect(schemaSql).toMatch(/CREATE OR REPLACE VIEW v_response_answers_normalized\s+WITH\s*\(\s*security_invoker\s*=\s*true\s*\)\s+AS/i)
    expect(schemaSql).toMatch(/CREATE OR REPLACE VIEW v_question_metrics\s+WITH\s*\(\s*security_invoker\s*=\s*true\s*\)\s+AS/i)

    // Anonymous and public access must be revoked
    expect(schemaSql).toContain('REVOKE ALL ON v_response_answers_normalized FROM anon, public;')
    expect(schemaSql).toContain('REVOKE ALL ON v_question_metrics FROM anon, public;')

    // Access granted to authenticated users
    expect(schemaSql).toContain('GRANT SELECT ON v_response_answers_normalized TO authenticated;')
    expect(schemaSql).toContain('GRANT SELECT ON v_question_metrics TO authenticated;')
  })

  it('should maintain supabase/schema.sql as the single canonical schema source without redundant drift files', () => {
    const redundantPath = path.resolve(__dirname, '../supabase/normalized-schema.sql')
    expect(fs.existsSync(redundantPath)).toBe(false)
  })

  it('should support fallback deduplication under RLS via idx_responses_unique_respondent without requiring anonymous SELECT', () => {
    // Unique index exists to support race-free deduplication on INSERT
    expect(schemaSql).toMatch(/CREATE\s+UNIQUE\s+INDEX\s+idx_responses_unique_respondent\s+ON\s+responses/i)
    // SELECT on responses is strictly prohibited for anonymous users
    expect(schemaSql).not.toMatch(/ON responses FOR SELECT[^;]*?TO[^\n]*anon/i)
    // INSERT on responses is allowed for anonymous users for published forms
    expect(schemaSql).toMatch(/ON responses FOR INSERT[\s\S]*?TO anon, authenticated/i)
  })
})
