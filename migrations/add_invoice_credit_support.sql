-- Migration: Add credit note support to invoices
-- Enables negative invoices (credit notes) for refunds

-- Add is_credit flag to invoices
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS is_credit BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN public.invoices.is_credit IS 'True if this invoice is a credit note (refund/negative amount)';

-- Create index for credit note filtering
CREATE INDEX IF NOT EXISTS idx_invoices_is_credit
ON public.invoices(is_credit)
WHERE is_credit = TRUE;
