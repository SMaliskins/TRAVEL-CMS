-- Migration: Banking use_in_invoices + company invoice_currencies (multi-currency)
-- Date: 2026-02-19
-- Description: Add use_in_invoices to company_bank_accounts; add invoice_currencies to companies

-- 1. company_bank_accounts: use in invoices (for filtering which accounts appear on invoice PDF)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'company_bank_accounts' AND column_name = 'use_in_invoices'
  ) THEN
    ALTER TABLE public.company_bank_accounts
      ADD COLUMN use_in_invoices boolean NOT NULL DEFAULT true;
    COMMENT ON COLUMN public.company_bank_accounts.use_in_invoices IS 'If true, this account is shown in invoice banking details';
  END IF;
END $$;

-- 2. companies: list of currencies for banking (multi-currency)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'invoice_currencies'
  ) THEN
    ALTER TABLE public.companies
      ADD COLUMN invoice_currencies jsonb NOT NULL DEFAULT '["EUR","USD","GBP"]'::jsonb;
    COMMENT ON COLUMN public.companies.invoice_currencies IS 'Allowed currencies for bank accounts and invoices (e.g. ["EUR","USD","GBP"]). Used in Settings → Company → Financial → Banking Details.';
  END IF;
END $$;
