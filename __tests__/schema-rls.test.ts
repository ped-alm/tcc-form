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

  it('should restrict form mutations to authenticated users', () => {
    expect(schemaSql).toContain('CREATE POLICY "Authenticated users can manage forms"')
    expect(schemaSql).toMatch(/ON forms FOR ALL[\s\S]*?TO authenticated/i)
  })

  it('should allow public responses insertion only for published forms', () => {
    expect(schemaSql).toContain('CREATE POLICY "Anyone can submit responses to published forms"')
    expect(schemaSql).toMatch(/ON responses FOR INSERT[\s\S]*?WHERE forms\.id = form_id[\s\S]*?AND forms\.status = 'published'/i)
  })

  it('should protect respondent privacy by restricting response SELECT to authenticated researchers', () => {
    expect(schemaSql).toContain('CREATE POLICY "Authenticated users can view responses"')
    expect(schemaSql).toMatch(/ON responses FOR SELECT[\s\S]*?TO authenticated/i)
    // Verify that anon is NEVER granted SELECT on responses
    expect(schemaSql).not.toMatch(/ON responses FOR SELECT[\s\S]*?TO[^\n]*anon/i)
  })

  it('should protect responses from unauthorized deletion', () => {
    expect(schemaSql).toContain('CREATE POLICY "Authenticated users can delete responses"')
    expect(schemaSql).toMatch(/ON responses FOR DELETE[\s\S]*?TO authenticated/i)
    expect(schemaSql).not.toMatch(/ON responses FOR DELETE[\s\S]*?TO[^\n]*anon/i)
  })

  it('should enforce singleton form architecture via database check constraint', () => {
    expect(schemaSql).toMatch(/is_singleton\s+BOOLEAN\s+DEFAULT\s+true\s+NOT\s+NULL\s+UNIQUE\s+CHECK\s*\(is_singleton\)/i)
  })

  it('should define performance indexes for response deduplication and queries', () => {
    expect(schemaSql).toContain('CREATE INDEX idx_responses_form_id')
    expect(schemaSql).toContain('CREATE INDEX idx_responses_submitted_at')
    expect(schemaSql).toContain('CREATE INDEX idx_responses_respondent_hash')
  })
})
