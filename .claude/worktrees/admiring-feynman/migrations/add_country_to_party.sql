-- Migration: Add country column to party table
-- Country field used by company records in directory

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'party'
        AND column_name = 'country'
    ) THEN
        ALTER TABLE public.party
        ADD COLUMN country text;

        COMMENT ON COLUMN public.party.country IS 'Country of the party (company or person)';
    END IF;
END $$;

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'party' AND column_name = 'country';
