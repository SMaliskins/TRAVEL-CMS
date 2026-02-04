-- Migration: Update invoice statuses to issued, issued_sent, paid, cancelled, overdue
-- Replaces: draft -> issued, sent -> issued_sent

-- 1. Drop constraint FIRST (otherwise UPDATE to 'issued'/'issued_sent' would violate old constraint)
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;

-- 2. Update existing invoices
UPDATE public.invoices SET status = 'issued' WHERE status = 'draft';
UPDATE public.invoices SET status = 'issued_sent' WHERE status = 'sent';
-- Note: 'processed' invoices stay as is

-- 3. Add new status constraint
ALTER TABLE public.invoices
ADD CONSTRAINT invoices_status_check 
CHECK (status IN ('issued', 'issued_sent', 'paid', 'cancelled', 'overdue', 'processed'));

COMMENT ON COLUMN public.invoices.status IS 'Invoice status: issued (after creation), issued_sent (after email), paid, cancelled, overdue, processed (by accounting)';
