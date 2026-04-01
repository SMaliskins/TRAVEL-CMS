-- Add correspondence language and invoice language to party_company (directory company settings)
-- Run in Supabase SQL Editor

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'party_company'
        AND column_name = 'correspondence_language'
    ) THEN
        ALTER TABLE public.party_company
        ADD COLUMN correspondence_language text DEFAULT 'en';

        COMMENT ON COLUMN public.party_company.correspondence_language IS 'Language of correspondence (e.g. en, lv, ru). Used in directory company settings.';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'party_company'
        AND column_name = 'invoice_language'
    ) THEN
        ALTER TABLE public.party_company
        ADD COLUMN invoice_language text DEFAULT 'en';

        COMMENT ON COLUMN public.party_company.invoice_language IS 'Language of invoice documents (e.g. en, lv, ru). Used in directory company settings.';
    END IF;
END $$;

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'party_company'
AND column_name IN ('correspondence_language', 'invoice_language');
