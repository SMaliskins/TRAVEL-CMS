-- Custom cities table: stores cities resolved via external geocoding API
-- so they are instantly available for future searches (auto-learning).

CREATE TABLE IF NOT EXISTS custom_cities (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  country text NOT NULL,
  country_code text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  iata_code text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, name, country_code)
);

CREATE INDEX IF NOT EXISTS idx_custom_cities_company ON custom_cities(company_id);
CREATE INDEX IF NOT EXISTS idx_custom_cities_name ON custom_cities(company_id, lower(name));

ALTER TABLE custom_cities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company cities"
  ON custom_cities FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert cities for their company"
  ON custom_cities FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));
