-- Store original invoice PDF/file for company expense entries (view later).
-- Run in Supabase SQL Editor.

ALTER TABLE public.company_expense_invoices
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS mime_type text;

COMMENT ON COLUMN public.company_expense_invoices.file_path IS 'Storage path for uploaded invoice PDF/image (bucket company-expense-invoices).';
COMMENT ON COLUMN public.company_expense_invoices.file_name IS 'Original file name for display.';
COMMENT ON COLUMN public.company_expense_invoices.mime_type IS 'MIME type for file (e.g. application/pdf).';
