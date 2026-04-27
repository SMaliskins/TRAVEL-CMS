-- Supplier invoice matching and accounting workflow.
-- Purpose:
-- 1. Track whether uploaded supplier invoices are active, deleted, or replaced.
-- 2. Track accounting processing/attention state for supplier invoices.
-- 3. Link supplier invoice documents to real order services.
-- 4. Mark services as requiring direct, periodic, or no supplier invoice coverage.

ALTER TABLE public.order_documents
  ADD COLUMN IF NOT EXISTS document_state text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS accounting_state text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS accounting_processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS accounting_processed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS attention_reason text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS replaced_by_document_id uuid REFERENCES public.order_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

ALTER TABLE public.order_documents
  DROP CONSTRAINT IF EXISTS order_documents_document_state_check,
  ADD CONSTRAINT order_documents_document_state_check
    CHECK (document_state IN ('active', 'deleted', 'replaced'));

ALTER TABLE public.order_documents
  DROP CONSTRAINT IF EXISTS order_documents_accounting_state_check,
  ADD CONSTRAINT order_documents_accounting_state_check
    CHECK (accounting_state IN ('pending', 'processed', 'attention', 'cancelled_processed'));

ALTER TABLE public.order_documents
  DROP CONSTRAINT IF EXISTS order_documents_attention_reason_check,
  ADD CONSTRAINT order_documents_attention_reason_check
    CHECK (
      attention_reason IS NULL
      OR attention_reason IN ('deleted', 'changed', 'replaced')
    );

ALTER TABLE public.order_services
  ADD COLUMN IF NOT EXISTS supplier_invoice_requirement text NOT NULL DEFAULT 'required',
  ADD COLUMN IF NOT EXISTS supplier_invoice_period text,
  ADD COLUMN IF NOT EXISTS supplier_invoice_note text;

ALTER TABLE public.order_services
  DROP CONSTRAINT IF EXISTS order_services_supplier_invoice_requirement_check,
  ADD CONSTRAINT order_services_supplier_invoice_requirement_check
    CHECK (supplier_invoice_requirement IN ('required', 'periodic', 'not_required'));

-- Redundant unique constraints allow composite foreign keys that prevent
-- cross-company or cross-order document/service links.
ALTER TABLE public.order_documents
  DROP CONSTRAINT IF EXISTS order_documents_id_company_order_unique,
  ADD CONSTRAINT order_documents_id_company_order_unique
    UNIQUE (id, company_id, order_id);

ALTER TABLE public.order_services
  DROP CONSTRAINT IF EXISTS order_services_id_company_order_unique,
  ADD CONSTRAINT order_services_id_company_order_unique
    UNIQUE (id, company_id, order_id);

CREATE TABLE IF NOT EXISTS public.order_document_service_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  document_id uuid NOT NULL,
  service_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  CONSTRAINT order_document_service_links_document_fkey
    FOREIGN KEY (document_id, company_id, order_id)
    REFERENCES public.order_documents(id, company_id, order_id)
    ON DELETE CASCADE,
  CONSTRAINT order_document_service_links_service_fkey
    FOREIGN KEY (service_id, company_id, order_id)
    REFERENCES public.order_services(id, company_id, order_id)
    ON DELETE CASCADE,
  CONSTRAINT order_document_service_links_unique
    UNIQUE (document_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_order_documents_document_state
  ON public.order_documents(document_state);

CREATE INDEX IF NOT EXISTS idx_order_documents_accounting_state
  ON public.order_documents(accounting_state);

CREATE INDEX IF NOT EXISTS idx_order_documents_replaced_by_document_id
  ON public.order_documents(replaced_by_document_id)
  WHERE replaced_by_document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_services_supplier_invoice_requirement
  ON public.order_services(supplier_invoice_requirement);

CREATE INDEX IF NOT EXISTS idx_order_document_service_links_company_order
  ON public.order_document_service_links(company_id, order_id);

CREATE INDEX IF NOT EXISTS idx_order_document_service_links_document_id
  ON public.order_document_service_links(document_id);

CREATE INDEX IF NOT EXISTS idx_order_document_service_links_service_id
  ON public.order_document_service_links(service_id);

ALTER TABLE public.order_document_service_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view order document service links in their company"
  ON public.order_document_service_links;
CREATE POLICY "Users can view order document service links in their company"
  ON public.order_document_service_links FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
    UNION
    SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert order document service links in their company"
  ON public.order_document_service_links;
CREATE POLICY "Users can insert order document service links in their company"
  ON public.order_document_service_links FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
    UNION
    SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update order document service links in their company"
  ON public.order_document_service_links;
CREATE POLICY "Users can update order document service links in their company"
  ON public.order_document_service_links FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
    UNION
    SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
  ))
  WITH CHECK (company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
    UNION
    SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can delete order document service links in their company"
  ON public.order_document_service_links;
CREATE POLICY "Users can delete order document service links in their company"
  ON public.order_document_service_links FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
    UNION
    SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
  ));

COMMENT ON COLUMN public.order_documents.document_state IS
  'Supplier invoice document lifecycle: active, deleted, or replaced.';
COMMENT ON COLUMN public.order_documents.accounting_state IS
  'Accounting workflow state for supplier invoices: pending, processed, attention, cancelled_processed.';
COMMENT ON COLUMN public.order_documents.attention_reason IS
  'Reason the accountant needs to review this supplier invoice: deleted, changed, or replaced.';
COMMENT ON TABLE public.order_document_service_links IS
  'Links uploaded supplier invoice documents to the real order services they cover.';
COMMENT ON COLUMN public.order_services.supplier_invoice_requirement IS
  'Supplier invoice coverage expectation for the service: required, periodic, or not_required.';
