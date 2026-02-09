-- Reissue (replace) invoice: status 'replaced' and link to new invoice

-- 1. Add column
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS replaced_by_invoice_id uuid REFERENCES public.invoices(id);

COMMENT ON COLUMN public.invoices.replaced_by_invoice_id IS 'Set when this invoice was replaced by a reissue; points to the new invoice.';

-- 2. Allow status 'replaced'
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('issued', 'issued_sent', 'paid', 'cancelled', 'overdue', 'processed', 'replaced'));

COMMENT ON COLUMN public.invoices.status IS 'Invoice status: issued, issued_sent, paid, cancelled, overdue, processed, replaced (replaced by reissue)';
