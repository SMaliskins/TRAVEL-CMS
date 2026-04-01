-- Migration: Add logo_url to party_company table
-- For company avatar/logo (paste Ctrl+V over circle)

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party_company' 
        AND column_name = 'logo_url'
    ) THEN
        ALTER TABLE public.party_company 
        ADD COLUMN logo_url text;
        
        COMMENT ON COLUMN public.party_company.logo_url IS 'Company logo/avatar URL (Supabase Storage)';
        
        RAISE NOTICE 'Added logo_url column to party_company table';
    ELSE
        RAISE NOTICE 'logo_url column already exists in party_company';
    END IF;
END $$;
