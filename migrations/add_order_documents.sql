-- Migration: order_documents - uploaded invoices/bills for orders
-- Visible in Order Documents tab and Finances section

CREATE TABLE IF NOT EXISTS public.order_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  document_type text NOT NULL DEFAULT 'invoice' CHECK (document_type IN ('invoice', 'other')),
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_documents_order_id ON public.order_documents(order_id);
CREATE INDEX IF NOT EXISTS idx_order_documents_company_id ON public.order_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_order_documents_created_at ON public.order_documents(created_at DESC);

ALTER TABLE public.order_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view order documents in their company" ON public.order_documents;
CREATE POLICY "Users can view order documents in their company"
  ON public.order_documents FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
    UNION
    SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert order documents in their company" ON public.order_documents;
CREATE POLICY "Users can insert order documents in their company"
  ON public.order_documents FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
    UNION
    SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can delete order documents in their company" ON public.order_documents;
CREATE POLICY "Users can delete order documents in their company"
  ON public.order_documents FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
    UNION
    SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
  ));

COMMENT ON TABLE public.order_documents IS 'Uploaded documents (invoices, bills) for orders. Visible in Order Documents tab and Finances.';
