-- Normalized Database Schema for Form Questions
-- Run this in your Supabase SQL Editor to migrate/normalize forms.questions JSONB into relational tables

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
CREATE POLICY "Authenticated users can manage questions"
  ON questions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

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
CREATE POLICY "Authenticated users can manage question options"
  ON question_options FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

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
CREATE POLICY "Authenticated users can manage matrix rows"
  ON question_matrix_rows FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

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
CREATE POLICY "Authenticated users can manage matrix columns"
  ON question_matrix_columns FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

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
