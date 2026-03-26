-- Parse Corrections: stores user corrections for ALL document types
-- Used to inject few-shot "correction rules" into future AI parsing prompts.
-- When a user manually corrects a parsed field, we store:
--   - original AI output vs corrected value
--   - document type + operator/airline context
--   - the rule the AI should follow next time
--
-- This enables self-learning: each correction improves future parsing accuracy.

CREATE TABLE IF NOT EXISTS public.parse_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,

  -- What type of document was corrected
  document_type text NOT NULL CHECK (document_type IN (
    'flight', 'package_tour', 'passport', 'invoice', 'operator_confirmation', 'airline_ticket'
  )),

  -- Context: airline or operator name (helps match corrections to similar documents)
  context_hint text,  -- e.g. "Turkish Airlines", "Coral Travel", "Novatours"

  -- Which field was corrected
  field_name text NOT NULL,  -- e.g. "baggage", "cabinClass", "mealPlan", "flightNumber"

  -- What the AI produced vs what the user corrected to
  original_value text,
  corrected_value text NOT NULL,

  -- Human-readable rule for the AI (generated or manual)
  -- e.g. "When Turkish Airlines shows 'PC 20KG', baggage should be '20kg checked + 8kg cabin'"
  correction_rule text,

  -- Source text fingerprint (to match similar documents)
  text_fingerprint text,

  -- How many times this correction has been applied (popularity/confidence)
  use_count int DEFAULT 1,

  -- Whether this correction is active (can be disabled if wrong)
  is_active boolean DEFAULT true,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for fast lookup during parsing
CREATE INDEX IF NOT EXISTS idx_parse_corrections_company_doctype
  ON public.parse_corrections (company_id, document_type);

CREATE INDEX IF NOT EXISTS idx_parse_corrections_context
  ON public.parse_corrections (document_type, context_hint)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_parse_corrections_field
  ON public.parse_corrections (document_type, field_name)
  WHERE is_active = true;

-- RLS
ALTER TABLE public.parse_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view corrections for their company"
  ON public.parse_corrections FOR SELECT
  USING (company_id = (
    SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert corrections for their company"
  ON public.parse_corrections FOR INSERT
  WITH CHECK (company_id = (
    SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update corrections for their company"
  ON public.parse_corrections FOR UPDATE
  USING (company_id = (
    SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
  ));

-- Also add document_type to flight_parse_templates so it can be used for tours etc.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'flight_parse_templates' AND column_name = 'document_type'
  ) THEN
    ALTER TABLE public.flight_parse_templates
      ADD COLUMN document_type text DEFAULT 'flight';
  END IF;
END $$;

-- Add corrected_fields column to flight_parse_templates to track which fields were user-corrected
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'flight_parse_templates' AND column_name = 'corrected_fields'
  ) THEN
    ALTER TABLE public.flight_parse_templates
      ADD COLUMN corrected_fields jsonb DEFAULT '[]';
  END IF;
END $$;
