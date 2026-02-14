-- Invoice localization: company-level allowed languages and per-invoice language
-- Run in Supabase SQL Editor

-- Companies: allowed invoice languages (array of codes, e.g. ["en", "lv", "ru"])
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS invoice_languages jsonb DEFAULT '["en"]'::jsonb;

COMMENT ON COLUMN public.companies.invoice_languages IS 'Allowed languages for invoices (e.g. ["en", "lv", "ru"]). Used in Settings → Company → Financial.';

-- Invoices: language of the invoice document (e.g. "en", "lv", "ru")
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'en';

COMMENT ON COLUMN public.invoices.language IS 'Language of the invoice (PDF/HTML). Set when creating the invoice.';
