-- Add updated_at to invoice_items (used by PATCH when editing lines)
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT NOW();

COMMENT ON COLUMN public.invoice_items.updated_at IS 'Last update time for the line (e.g. when dates/service text are edited).';
