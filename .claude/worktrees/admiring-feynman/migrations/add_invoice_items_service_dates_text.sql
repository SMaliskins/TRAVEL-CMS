-- Allow free-text "Dates" in invoice line items (Edit lines)
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS service_dates_text text;

COMMENT ON COLUMN public.invoice_items.service_dates_text IS 'Free-text dates/duration for the line (e.g. "15.03.2025 – 20.03.2025" or "March 2025"). Shown in Edit lines Dates column.';
