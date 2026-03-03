-- Migration: Add parsed invoice fields to order_documents
-- Stores AI-extracted amount, invoice number, supplier for persistence across page loads

ALTER TABLE public.order_documents
  ADD COLUMN IF NOT EXISTS parsed_amount numeric,
  ADD COLUMN IF NOT EXISTS parsed_currency text DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS parsed_invoice_number text,
  ADD COLUMN IF NOT EXISTS parsed_supplier text,
  ADD COLUMN IF NOT EXISTS parsed_invoice_date text;

COMMENT ON COLUMN public.order_documents.parsed_amount IS 'AI-extracted total amount from invoice';
COMMENT ON COLUMN public.order_documents.parsed_currency IS 'Currency of parsed_amount (EUR, USD)';
COMMENT ON COLUMN public.order_documents.parsed_invoice_number IS 'AI-extracted invoice/reference number';
COMMENT ON COLUMN public.order_documents.parsed_supplier IS 'AI-extracted supplier/issuer company name';
COMMENT ON COLUMN public.order_documents.parsed_invoice_date IS 'AI-extracted invoice date';

-- Allow updating parsed fields (service role bypasses RLS, but policy needed for future anon/authenticated use)
DROP POLICY IF EXISTS "Users can update order documents in their company" ON public.order_documents;
CREATE POLICY "Users can update order documents in their company"
  ON public.order_documents FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
    UNION
    SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
  ));
