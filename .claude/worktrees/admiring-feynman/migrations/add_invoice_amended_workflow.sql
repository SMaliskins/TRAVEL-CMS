-- Migration: Invoice finance workflow — processed_total + amended status
-- Allows Finance to mark invoices as processed, tracks original amount,
-- and auto-flags invoices as "amended" when total changes after processing.

-- 1. Add processed_total to track amount at time of processing
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS processed_total numeric(12,2);

COMMENT ON COLUMN public.invoices.processed_total IS 'Total amount at the moment Finance marked invoice as processed. Used to detect amount changes (amended).';

-- 2. Backfill: set processed_total for already-processed invoices
UPDATE public.invoices
  SET processed_total = total
  WHERE status = 'processed' AND processed_total IS NULL;

-- 3. Add "amended" to allowed statuses
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft', 'issued', 'issued_sent', 'paid', 'cancelled', 'overdue', 'processed', 'replaced', 'amended'));

COMMENT ON COLUMN public.invoices.status IS 'Invoice status: draft, issued, issued_sent, paid, cancelled, overdue, processed (by accounting), amended (total changed after processing, needs re-processing), replaced';

-- 4. Ensure processed_by and processed_at columns exist
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS processed_by uuid REFERENCES auth.users(id);

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;
