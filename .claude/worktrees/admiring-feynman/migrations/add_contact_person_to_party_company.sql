-- Migration: Add contact_person to party_company
-- Contact person name for company records in directory

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'party_company'
        AND column_name = 'contact_person'
    ) THEN
        ALTER TABLE public.party_company
        ADD COLUMN contact_person text;

        COMMENT ON COLUMN public.party_company.contact_person IS 'Contact person name for the company';
    END IF;
END $$;

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'party_company' AND column_name = 'contact_person';
