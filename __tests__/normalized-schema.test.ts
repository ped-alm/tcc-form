import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { exampleForm } from '@/lib/example-form'
import {
  normalizeQuestionConfigs,
  reconstructQuestionConfigs,
} from '@/lib/normalized-questions'
import {
  NormalizedQuestion,
  NormalizedQuestionOption,
  NormalizedMatrixRow,
  NormalizedMatrixColumn,
} from '@/lib/database.types'

describe('Normalized Database Schema and Utilities', () => {
  const schemaPath = path.resolve(__dirname, '../supabase/schema.sql')
  const schemaSql = fs.readFileSync(schemaPath, 'utf8')

  describe('SQL Schema and Relational Integrity', () => {
    it('defines normalized tables with foreign keys and cascade delete', () => {
      expect(schemaSql).toMatch(/CREATE TABLE IF NOT EXISTS questions[\s\S]*?REFERENCES forms\(id\) ON DELETE CASCADE/i)
      expect(schemaSql).toMatch(/CREATE TABLE IF NOT EXISTS question_options[\s\S]*?REFERENCES questions\(id\) ON DELETE CASCADE/i)
      expect(schemaSql).toMatch(/CREATE TABLE IF NOT EXISTS question_matrix_rows[\s\S]*?REFERENCES questions\(id\) ON DELETE CASCADE/i)
      expect(schemaSql).toMatch(/CREATE TABLE IF NOT EXISTS question_matrix_columns[\s\S]*?REFERENCES questions\(id\) ON DELETE CASCADE/i)
    })

    it('enforces uniqueness constraints on keys, options, and matrix cells', () => {
      expect(schemaSql).toContain('CONSTRAINT uq_form_question_key UNIQUE (form_id, question_key)')
      expect(schemaSql).toContain('CONSTRAINT uq_question_option UNIQUE (question_id, label)')
      expect(schemaSql).toContain('CONSTRAINT uq_question_matrix_row UNIQUE (question_id, row_key)')
      expect(schemaSql).toContain('CONSTRAINT uq_question_matrix_col UNIQUE (question_id, col_key)')
    })

    it('enables Row Level Security on all normalized tables', () => {
      expect(schemaSql).toMatch(/ALTER TABLE questions ENABLE ROW LEVEL SECURITY;/i)
      expect(schemaSql).toMatch(/ALTER TABLE question_options ENABLE ROW LEVEL SECURITY;/i)
      expect(schemaSql).toMatch(/ALTER TABLE question_matrix_rows ENABLE ROW LEVEL SECURITY;/i)
      expect(schemaSql).toMatch(/ALTER TABLE question_matrix_columns ENABLE ROW LEVEL SECURITY;/i)
    })

    it('defines secure RLS policies ensuring anonymous users only read questions of published forms', () => {
      expect(schemaSql).toContain('CREATE POLICY "Anyone can view questions of published forms"')
      expect(schemaSql).toContain('CREATE POLICY "Anyone can view options of published forms"')
      expect(schemaSql).toContain('CREATE POLICY "Anyone can view matrix rows of published forms"')
      expect(schemaSql).toContain('CREATE POLICY "Anyone can view matrix columns of published forms"')
    })

    it('restricts management of normalized tables to authenticated users with admin role claim', () => {
      expect(schemaSql).toContain('CREATE POLICY "Admins can manage questions"')
      expect(schemaSql).toContain('CREATE POLICY "Admins can manage question options"')
      expect(schemaSql).toContain('CREATE POLICY "Admins can manage matrix rows"')
      expect(schemaSql).toContain('CREATE POLICY "Admins can manage matrix columns"')
      expect(schemaSql).toMatch(/ON questions FOR ALL[\s\S]*?TO authenticated[\s\S]*?auth\.jwt\(\)->'app_metadata'->>'role'\) = 'admin'/i)
      expect(schemaSql).toMatch(/ON question_options FOR ALL[\s\S]*?TO authenticated[\s\S]*?auth\.jwt\(\)->'app_metadata'->>'role'\) = 'admin'/i)
      expect(schemaSql).toMatch(/ON question_matrix_rows FOR ALL[\s\S]*?TO authenticated[\s\S]*?auth\.jwt\(\)->'app_metadata'->>'role'\) = 'admin'/i)
      expect(schemaSql).toMatch(/ON question_matrix_columns FOR ALL[\s\S]*?TO authenticated[\s\S]*?auth\.jwt\(\)->'app_metadata'->>'role'\) = 'admin'/i)
    })

    it('defines automatic synchronization trigger to populate normalized tables from forms.questions JSONB', () => {
      expect(schemaSql).toContain('CREATE OR REPLACE FUNCTION sync_form_questions_to_normalized()')
      expect(schemaSql).toContain('CREATE TRIGGER sync_form_questions_trigger')
    })

    it('defines analytical aggregate views for direct SQL querying without JSONB parsing in application code', () => {
      expect(schemaSql).toContain('CREATE OR REPLACE VIEW v_response_answers_normalized')
      expect(schemaSql).toContain('CREATE OR REPLACE VIEW v_question_metrics')
    })
  })

  describe('Bidirectional Normalization & Reconstruction', () => {
    it('normalizes example survey questions into relational bundles', () => {
      const bundle = normalizeQuestionConfigs(exampleForm.id, exampleForm.questions)

      expect(bundle.questions.length).toBe(exampleForm.questions.length)
      expect(bundle.options.length).toBeGreaterThan(0)
      expect(bundle.matrixRows.length).toBeGreaterThan(0)
      expect(bundle.matrixColumns.length).toBeGreaterThan(0)

      // Validate matrix question normalization
      const matrixQ = exampleForm.questions.find(q => q.type === 'matrix')
      expect(matrixQ).toBeDefined()
      if (matrixQ) {
        const rowsForQ = bundle.matrixRows.filter(r => r.question_id === matrixQ.id)
        expect(rowsForQ.length).toBe(matrixQ.matrixRows?.length)
      }

      // Validate checkboxes with exclusive options
      const checkboxQ = exampleForm.questions.find(q => q.exclusiveOptions && q.exclusiveOptions.length > 0)
      expect(checkboxQ).toBeDefined()
      if (checkboxQ) {
        const exclusiveOpts = bundle.options.filter(
          o => o.question_id === checkboxQ.id && o.is_exclusive
        )
        expect(exclusiveOpts.length).toBe(checkboxQ.exclusiveOptions?.length)
      }
    })

    it('performs accurate round-trip reconstruction from relational rows back to QuestionConfig', () => {
      const bundle = normalizeQuestionConfigs(exampleForm.id, exampleForm.questions)

      // Map bundle rows to database table Row format
      const dbQuestions: NormalizedQuestion[] = bundle.questions.map(q => ({
        ...q,
        id: q.id,
        order_index: q.order_index ?? 0,
        required: q.required ?? false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }))

      const dbOptions: NormalizedQuestionOption[] = bundle.options.map(o => ({
        ...o,
      }))

      const dbMatrixRows: NormalizedMatrixRow[] = bundle.matrixRows.map(r => ({
        ...r,
      }))

      const dbMatrixCols: NormalizedMatrixColumn[] = bundle.matrixColumns.map(c => ({
        ...c,
      }))

      const reconstructed = reconstructQuestionConfigs({
        questions: dbQuestions,
        options: dbOptions,
        matrixRows: dbMatrixRows,
        matrixColumns: dbMatrixCols,
      })

      expect(reconstructed.length).toBe(exampleForm.questions.length)

      for (let i = 0; i < exampleForm.questions.length; i++) {
        const original = exampleForm.questions[i]
        const rebuilt = reconstructed[i]

        expect(rebuilt.id).toBe(original.id)
        expect(rebuilt.type).toBe(original.type)
        expect(rebuilt.title).toBe(original.title)
        expect(rebuilt.required).toBe(original.required)

        if (original.options) {
          expect(rebuilt.options).toEqual(original.options)
        }
        if (original.matrixRows) {
          expect(rebuilt.matrixRows).toEqual(original.matrixRows)
        }
        if (original.matrixColumns) {
          expect(rebuilt.matrixColumns).toEqual(original.matrixColumns)
        }
        if (original.exclusiveOptions) {
          expect(rebuilt.exclusiveOptions).toEqual(original.exclusiveOptions)
        }
      }
    })
  })
})
