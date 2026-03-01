-- Migration: Add bank_accounts JSONB to party (multiple bank accounts for Supplier, Subagent, Client)
-- Enables both person and company parties to have multiple bank accounts

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'party'
        AND column_name = 'bank_accounts'
    ) THEN
        ALTER TABLE public.party
        ADD COLUMN bank_accounts jsonb;

        COMMENT ON COLUMN public.party.bank_accounts IS 'Array of {bankName, iban, swift} for Supplier, Subagent, Client payment details';
    END IF;
END $$;
