-- Allow reusing invoice number from a cancelled invoice (only one active invoice per company+number).
-- Drop old unique constraint, add partial unique index so cancelled/replaced can share numbers with new invoices.

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_number_company_unique;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_company_number_active_unique
  ON public.invoices (company_id, invoice_number)
  WHERE (status IS NULL OR status NOT IN ('cancelled', 'replaced'));

COMMENT ON INDEX public.invoices_company_number_active_unique IS
  'Only one non-cancelled, non-replaced invoice per (company_id, invoice_number). Cancelled numbers can be reused.';
