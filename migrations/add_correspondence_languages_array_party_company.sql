-- Correspondence language: allow multiple (array). Migrate from single correspondence_language.
-- Run in Supabase SQL Editor

-- Add new column for array of language codes
ALTER TABLE public.party_company
  ADD COLUMN IF NOT EXISTS correspondence_languages jsonb DEFAULT '["en"]'::jsonb;

COMMENT ON COLUMN public.party_company.correspondence_languages IS 'Languages of correspondence (e.g. ["en", "lv", "ru"]). Used in directory company settings.';

-- Migrate existing single value into array (if old column exists and new is still default)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'party_company' AND column_name = 'correspondence_language'
  ) THEN
    UPDATE public.party_company
    SET correspondence_languages = jsonb_build_array(correspondence_language)
    WHERE correspondence_language IS NOT NULL
      AND (correspondence_languages IS NULL OR correspondence_languages = '["en"]'::jsonb);
  END IF;
END $$;

-- Drop old single-value column if it exists
ALTER TABLE public.party_company DROP COLUMN IF EXISTS correspondence_language;
