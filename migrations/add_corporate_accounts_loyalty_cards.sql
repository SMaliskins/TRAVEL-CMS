-- Migration: Add corporate_accounts and loyalty_cards JSONB columns to party
-- corporate_accounts: for Company records (e.g. airBaltic code, Sixt account)
-- loyalty_cards: for Person records (e.g. Miles & More, Sixt loyalty)

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'party'
        AND column_name = 'corporate_accounts'
    ) THEN
        ALTER TABLE public.party
        ADD COLUMN corporate_accounts jsonb;

        COMMENT ON COLUMN public.party.corporate_accounts IS 'Array of {providerId?, providerName, accountCode} for company booking accounts';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'party'
        AND column_name = 'loyalty_cards'
    ) THEN
        ALTER TABLE public.party
        ADD COLUMN loyalty_cards jsonb;

        COMMENT ON COLUMN public.party.loyalty_cards IS 'Array of {providerId?, providerName, programName?, cardCode} for person loyalty programs';
    END IF;
END $$;

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'party'
AND column_name IN ('corporate_accounts', 'loyalty_cards');
