-- Flight parse templates: self-learning database for AI flight parsing
-- Stores successful parse results to provide few-shot examples for future parsing

CREATE TABLE IF NOT EXISTS flight_parse_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  airline_hint text,
  text_fingerprint text NOT NULL,
  text_sample text NOT NULL,
  parsed_result jsonb NOT NULL,
  source text DEFAULT 'ai' CHECK (source IN ('regex', 'ai', 'manual')),
  use_count int DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fpt_fingerprint ON flight_parse_templates(text_fingerprint);
CREATE INDEX IF NOT EXISTS idx_fpt_airline ON flight_parse_templates(airline_hint);
CREATE INDEX IF NOT EXISTS idx_fpt_company ON flight_parse_templates(company_id);

-- RLS
ALTER TABLE flight_parse_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view templates for their company"
  ON flight_parse_templates FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
    OR company_id IS NULL
  );

CREATE POLICY "Users can insert templates for their company"
  ON flight_parse_templates FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update templates for their company"
  ON flight_parse_templates FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );
