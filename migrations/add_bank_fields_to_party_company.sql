-- Migration: Add bank_name, iban, swift to party_company
-- Split bank details into structured fields

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'party_company' AND column_name = 'bank_name') THEN
        ALTER TABLE public.party_company ADD COLUMN bank_name text;
        COMMENT ON COLUMN public.party_company.bank_name IS 'Bank name';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'party_company' AND column_name = 'iban') THEN
        ALTER TABLE public.party_company ADD COLUMN iban text;
        COMMENT ON COLUMN public.party_company.iban IS 'IBAN';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'party_company' AND column_name = 'swift') THEN
        ALTER TABLE public.party_company ADD COLUMN swift text;
        COMMENT ON COLUMN public.party_company.swift IS 'SWIFT/BIC';
    END IF;
END $$;
