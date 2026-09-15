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
CREATE INDEX idx_responses_respondent_hash ON responses(form_id, respondent_hash);

-- Row Level Security (RLS) Policies

-- Enable RLS
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;

-- Forms policies:
-- Anyone can view the published form to answer it
CREATE POLICY "Anyone can view published forms"
  ON forms FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

-- Authenticated users (admin/researcher) can manage the form
CREATE POLICY "Authenticated users can manage forms"
  ON forms FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Responses policies:
-- Anyone can submit responses to the published form
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

-- Authenticated users (admin/researcher) can view responses
CREATE POLICY "Authenticated users can view responses"
  ON responses FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users (admin/researcher) can delete responses
CREATE POLICY "Authenticated users can delete responses"
  ON responses FOR DELETE
  TO authenticated
  USING (true);

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

