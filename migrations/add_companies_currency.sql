-- Add currency to companies (default EUR)
-- Used in Pricing (Cost, Marge, Sale) and invoices
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'EUR';

COMMENT ON COLUMN public.companies.currency IS 'Company default currency code (EUR, USD, GBP, etc.) for pricing and invoices';
