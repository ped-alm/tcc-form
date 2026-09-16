-- OpenForm Database Schema (Single-Form Architecture)
-- Run this in your Supabase SQL Editor

-- Create enum types
CREATE TYPE form_status AS ENUM ('draft', 'published', 'closed');
CREATE TYPE theme_preset AS ENUM ('midnight', 'ocean', 'sunset', 'forest', 'lavender', 'minimal');

-- Forms table (singleton table: enforces at most one form exists in the database)
CREATE TABLE forms (
  id UUID DEFAULT '11111111-1111-4111-8111-111111111111'::uuid PRIMARY KEY,
  is_singleton BOOLEAN DEFAULT true NOT NULL UNIQUE CHECK (is_singleton),
  title TEXT NOT NULL DEFAULT 'Untitled Form',
  description TEXT,
  slug TEXT UNIQUE NOT NULL,
  status form_status DEFAULT 'published' NOT NULL,
  theme theme_preset DEFAULT 'ocean' NOT NULL,
  questions JSONB DEFAULT '[]'::jsonb NOT NULL,
  thank_you_message TEXT DEFAULT 'Thank you for your response!' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for status lookup
CREATE INDEX idx_forms_status ON forms(status);

-- Responses table
CREATE TABLE responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id UUID DEFAULT '11111111-1111-4111-8111-111111111111'::uuid REFERENCES forms(id) ON DELETE CASCADE NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  respondent_hash TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for faster response lookups, deduplication and dashboard export
CREATE INDEX idx_responses_form_id ON responses(form_id);
CREATE INDEX idx_responses_submitted_at ON responses(submitted_at DESC);

-- Remove non-unique index if present
DROP INDEX IF EXISTS idx_responses_respondent_hash;

-- Create unique index to guarantee race-proof deduplication
CREATE UNIQUE INDEX idx_responses_unique_respondent
  ON responses(form_id, respondent_hash)
  WHERE respondent_hash IS NOT NULL;

-- Row Level Security (RLS) Policies

-- Enable RLS
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;

-- Forms policies:
-- Anyone can view the published form to answer it
DROP POLICY IF EXISTS "Anyone can view published forms" ON forms;
CREATE POLICY "Anyone can view published forms"
  ON forms FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

-- Forms management policy:
-- Only authenticated users with admin role in app_metadata can manage forms
DROP POLICY IF EXISTS "Authenticated users can manage forms" ON forms;
DROP POLICY IF EXISTS "Admins can manage forms" ON forms;
CREATE POLICY "Admins can manage forms"
  ON forms FOR ALL
  TO authenticated
  USING ((select auth.jwt()->'app_metadata'->>'role') = 'admin')
  WITH CHECK ((select auth.jwt()->'app_metadata'->>'role') = 'admin');

-- Responses policies:
-- 1. INSERT: Anyone (anon or authenticated) can submit responses to published forms.
--    Direct inserts must NOT chain RETURNING / .select() under the anonymous role,
--    as PostgREST requires SELECT permissions on returned representation rows.
DROP POLICY IF EXISTS "Anyone can submit responses to published forms" ON responses;
CREATE POLICY "Anyone can submit responses to published forms"
  ON responses FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM forms 
      WHERE forms.id = form_id 
      AND forms.status = 'published'
    )
  );

-- 2. SELECT: Only authenticated users with admin role in app_metadata can view responses.
--    Public anonymous SELECT is strictly denied by Row Level Security to protect respondent privacy.
--    Deduplication for anonymous respondents is handled at the database level:
--    - Primary path: via submit_survey_response RPC function (SECURITY DEFINER)
--    - Fallback path: via unique index idx_responses_unique_respondent (handling error 23505 on INSERT)
--      without requiring an anonymous SELECT query.
DROP POLICY IF EXISTS "Authenticated users can view responses" ON responses;
DROP POLICY IF EXISTS "Admins can view responses" ON responses;
CREATE POLICY "Admins can view responses"
  ON responses FOR SELECT
  TO authenticated
  USING ((select auth.jwt()->'app_metadata'->>'role') = 'admin');

-- Only authenticated users with admin role in app_metadata can delete responses
DROP POLICY IF EXISTS "Authenticated users can delete responses" ON responses;
DROP POLICY IF EXISTS "Admins can delete responses" ON responses;
CREATE POLICY "Admins can delete responses"
  ON responses FOR DELETE
  TO authenticated
  USING ((select auth.jwt()->'app_metadata'->>'role') = 'admin');

-- Functions and Triggers

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_forms_updated_at
  BEFORE UPDATE ON forms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Secure RPC Function: submit_survey_response
-- Executes with SECURITY DEFINER to allow anonymous respondents to submit responses
-- and perform deduplication checks atomically, without granting public SELECT access to responses table.
CREATE OR REPLACE FUNCTION submit_survey_response(
  p_form_id UUID,
  p_answers JSONB,
  p_respondent_hash TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id UUID;
  v_new_id UUID;
BEGIN
  -- 1. Verify form exists and is published
  IF NOT EXISTS (
    SELECT 1 FROM forms WHERE id = p_form_id AND status = 'published'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Form not found or not published');
  END IF;

  -- 2. Check for duplicate submission by respondent hash if provided
  IF p_respondent_hash IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM responses
    WHERE form_id = p_form_id AND respondent_hash = p_respondent_hash
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'is_duplicate', true);
    END IF;
  END IF;

  -- 3. Insert response record (safely catching race conditions via unique index idx_responses_unique_respondent)
  BEGIN
    INSERT INTO responses (form_id, answers, respondent_hash)
    VALUES (p_form_id, p_answers, p_respondent_hash)
    RETURNING id INTO v_new_id;

    RETURN jsonb_build_object('success', true, 'is_duplicate', false, 'id', v_new_id);
  EXCEPTION
    WHEN unique_violation THEN
      RETURN jsonb_build_object('success', true, 'is_duplicate', true);
  END;
END;
$$;

-- Grant execution to anon and authenticated roles
REVOKE ALL ON FUNCTION submit_survey_response(UUID, JSONB, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION submit_survey_response(UUID, JSONB, TEXT) TO anon, authenticated;

-- =====================================================================
-- Normalized Relational Schema for Form Questions
-- =====================================================================

-- 1. Normalized Questions Table
CREATE TABLE IF NOT EXISTS questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id UUID REFERENCES forms(id) ON DELETE CASCADE NOT NULL,
  question_key TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  display_number TEXT,
  required BOOLEAN DEFAULT false NOT NULL,
  placeholder TEXT,
  min_value NUMERIC,
  max_value NUMERIC,
  max_select INTEGER,
  exclusive_options TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT uq_form_question_key UNIQUE (form_id, question_key)
);

-- 2. Question Options Table (for dropdowns, checkboxes, single choice)
CREATE TABLE IF NOT EXISTS question_options (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL,
  value TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_exclusive BOOLEAN DEFAULT false NOT NULL,
  CONSTRAINT uq_question_option UNIQUE (question_id, label)
);

-- 3. Question Matrix Rows Table (for matrix/grid questions)
CREATE TABLE IF NOT EXISTS question_matrix_rows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
  row_key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT uq_question_matrix_row UNIQUE (question_id, row_key)
);

-- 4. Question Matrix Columns Table (for matrix/grid questions)
CREATE TABLE IF NOT EXISTS question_matrix_columns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
  col_key TEXT NOT NULL,
  label TEXT NOT NULL,
  short_label TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT uq_question_matrix_col UNIQUE (question_id, col_key)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_questions_form_id ON questions(form_id, order_index);
CREATE INDEX IF NOT EXISTS idx_question_options_question_id ON question_options(question_id, order_index);
CREATE INDEX IF NOT EXISTS idx_question_matrix_rows_question_id ON question_matrix_rows(question_id, order_index);
CREATE INDEX IF NOT EXISTS idx_question_matrix_cols_question_id ON question_matrix_columns(question_id, order_index);

-- Row Level Security (RLS)
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_matrix_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_matrix_columns ENABLE ROW LEVEL SECURITY;

-- Questions RLS Policies:
-- Anyone can view questions of published forms
DROP POLICY IF EXISTS "Anyone can view questions of published forms" ON questions;
CREATE POLICY "Anyone can view questions of published forms"
  ON questions FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM forms 
      WHERE forms.id = questions.form_id 
      AND forms.status = 'published'
    )
  );

DROP POLICY IF EXISTS "Authenticated users can manage questions" ON questions;
DROP POLICY IF EXISTS "Admins can manage questions" ON questions;
CREATE POLICY "Admins can manage questions"
  ON questions FOR ALL
  TO authenticated
  USING ((select auth.jwt()->'app_metadata'->>'role') = 'admin')
  WITH CHECK ((select auth.jwt()->'app_metadata'->>'role') = 'admin');

-- Question Options RLS Policies:
DROP POLICY IF EXISTS "Anyone can view options of published forms" ON question_options;
CREATE POLICY "Anyone can view options of published forms"
  ON question_options FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM questions
      JOIN forms ON forms.id = questions.form_id
      WHERE questions.id = question_options.question_id
      AND forms.status = 'published'
    )
  );

DROP POLICY IF EXISTS "Authenticated users can manage question options" ON question_options;
DROP POLICY IF EXISTS "Admins can manage question options" ON question_options;
CREATE POLICY "Admins can manage question options"
  ON question_options FOR ALL
  TO authenticated
  USING ((select auth.jwt()->'app_metadata'->>'role') = 'admin')
  WITH CHECK ((select auth.jwt()->'app_metadata'->>'role') = 'admin');

-- Matrix Rows RLS Policies:
DROP POLICY IF EXISTS "Anyone can view matrix rows of published forms" ON question_matrix_rows;
CREATE POLICY "Anyone can view matrix rows of published forms"
  ON question_matrix_rows FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM questions
      JOIN forms ON forms.id = questions.form_id
      WHERE questions.id = question_matrix_rows.question_id
      AND forms.status = 'published'
    )
  );

DROP POLICY IF EXISTS "Authenticated users can manage matrix rows" ON question_matrix_rows;
DROP POLICY IF EXISTS "Admins can manage matrix rows" ON question_matrix_rows;
CREATE POLICY "Admins can manage matrix rows"
  ON question_matrix_rows FOR ALL
  TO authenticated
  USING ((select auth.jwt()->'app_metadata'->>'role') = 'admin')
  WITH CHECK ((select auth.jwt()->'app_metadata'->>'role') = 'admin');

-- Matrix Columns RLS Policies:
DROP POLICY IF EXISTS "Anyone can view matrix columns of published forms" ON question_matrix_columns;
CREATE POLICY "Anyone can view matrix columns of published forms"
  ON question_matrix_columns FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM questions
      JOIN forms ON forms.id = questions.form_id
      WHERE questions.id = question_matrix_columns.question_id
      AND forms.status = 'published'
    )
  );

DROP POLICY IF EXISTS "Authenticated users can manage matrix columns" ON question_matrix_columns;
DROP POLICY IF EXISTS "Admins can manage matrix columns" ON question_matrix_columns;
CREATE POLICY "Admins can manage matrix columns"
  ON question_matrix_columns FOR ALL
  TO authenticated
  USING ((select auth.jwt()->'app_metadata'->>'role') = 'admin')
  WITH CHECK ((select auth.jwt()->'app_metadata'->>'role') = 'admin');

-- Automatic Synchronization Function:
-- Keeps normalized relational tables in sync with forms.questions JSONB
CREATE OR REPLACE FUNCTION sync_form_questions_to_normalized()
RETURNS TRIGGER AS $$
DECLARE
  q JSONB;
  q_id UUID;
  opt TEXT;
  opt_idx INTEGER;
  mrow JSONB;
  mrow_idx INTEGER;
  mcol JSONB;
  mcol_idx INTEGER;
  q_idx INTEGER := 0;
BEGIN
  IF NEW.questions IS NULL OR jsonb_typeof(NEW.questions) != 'array' THEN
    RETURN NEW;
  END IF;

  -- Remove prior normalized records for this form (cascade deletes child tables)
  DELETE FROM questions WHERE form_id = NEW.id;

  FOR q IN SELECT * FROM jsonb_array_elements(NEW.questions)
  LOOP
    q_id := gen_random_uuid();
    q_idx := q_idx + 1;

    INSERT INTO questions (
      id,
      form_id,
      question_key,
      order_index,
      type,
      title,
      description,
      display_number,
      required,
      placeholder,
      min_value,
      max_value,
      max_select,
      exclusive_options
    ) VALUES (
      q_id,
      NEW.id,
      COALESCE(q->>'id', 'q_' || q_idx),
      q_idx,
      COALESCE(q->>'type', 'short_text'),
      COALESCE(q->>'title', ''),
      q->>'description',
      q->>'displayNumber',
      COALESCE((q->>'required')::boolean, false),
      q->>'placeholder',
      (q->>'minValue')::numeric,
      (q->>'maxValue')::numeric,
      (q->>'maxSelect')::integer,
      CASE 
        WHEN q ? 'exclusiveOptions' AND jsonb_typeof(q->'exclusiveOptions') = 'array' 
        THEN ARRAY(SELECT jsonb_array_elements_text(q->'exclusiveOptions'))
        ELSE NULL
      END
    );

    -- Normalize options array
    IF q ? 'options' AND jsonb_typeof(q->'options') = 'array' THEN
      opt_idx := 0;
      FOR opt IN SELECT * FROM jsonb_array_elements_text(q->'options')
      LOOP
        opt_idx := opt_idx + 1;
        INSERT INTO question_options (
          question_id,
          label,
          value,
          order_index,
          is_exclusive
        ) VALUES (
          q_id,
          opt,
          opt,
          opt_idx,
          CASE 
            WHEN q ? 'exclusiveOptions' AND jsonb_typeof(q->'exclusiveOptions') = 'array'
            THEN opt = ANY(ARRAY(SELECT jsonb_array_elements_text(q->'exclusiveOptions')))
            ELSE false
          END
        );
      END LOOP;
    END IF;

    -- Normalize matrix rows
    IF q ? 'matrixRows' AND jsonb_typeof(q->'matrixRows') = 'array' THEN
      mrow_idx := 0;
      FOR mrow IN SELECT * FROM jsonb_array_elements(q->'matrixRows')
      LOOP
        mrow_idx := mrow_idx + 1;
        INSERT INTO question_matrix_rows (
          question_id,
          row_key,
          label,
          description,
          order_index
        ) VALUES (
          q_id,
          COALESCE(mrow->>'id', 'row_' || mrow_idx),
          COALESCE(mrow->>'label', ''),
          mrow->>'description',
          mrow_idx
        );
      END LOOP;
    END IF;

    -- Normalize matrix columns
    IF q ? 'matrixColumns' AND jsonb_typeof(q->'matrixColumns') = 'array' THEN
      mcol_idx := 0;
      FOR mcol IN SELECT * FROM jsonb_array_elements(q->'matrixColumns')
      LOOP
        mcol_idx := mcol_idx + 1;
        INSERT INTO question_matrix_columns (
          question_id,
          col_key,
          label,
          short_label,
          order_index
        ) VALUES (
          q_id,
          COALESCE(mcol->>'id', 'col_' || mcol_idx),
          COALESCE(mcol->>'label', ''),
          mcol->>'shortLabel',
          mcol_idx
        );
      END LOOP;
    END IF;

  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to forms table
DROP TRIGGER IF EXISTS sync_form_questions_trigger ON forms;
CREATE TRIGGER sync_form_questions_trigger
  AFTER INSERT OR UPDATE OF questions ON forms
  FOR EACH ROW EXECUTE FUNCTION sync_form_questions_to_normalized();

-- 5. Analytical Views for Direct SQL Queries

-- View: Flattens responses and joins them to normalized question definitions
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

-- View: Computes response rates, counts, and numeric averages per question
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

-- Permissions: Restrict analytical views to authenticated users and revoke public/anon access
REVOKE ALL ON v_response_answers_normalized FROM anon, public;
REVOKE ALL ON v_question_metrics FROM anon, public;
GRANT SELECT ON v_response_answers_normalized TO authenticated;
GRANT SELECT ON v_question_metrics TO authenticated;

