-- Migration: Add vat_number to party_company table
-- For Directory Company card VAT Nr. field

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party_company' 
        AND column_name = 'vat_number'
    ) THEN
        ALTER TABLE public.party_company 
        ADD COLUMN vat_number text;
        
        COMMENT ON COLUMN public.party_company.vat_number IS 'VAT registration number';
        
        RAISE NOTICE 'Added vat_number column to party_company table';
    ELSE
        RAISE NOTICE 'vat_number column already exists in party_company';
    END IF;
END $$;
