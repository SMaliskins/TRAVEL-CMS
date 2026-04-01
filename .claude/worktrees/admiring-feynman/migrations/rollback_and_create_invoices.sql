-- =================================================
-- STEP 1: COMPLETE ROLLBACK (Clean slate)
-- =================================================

-- Drop all constraints and policies first
DROP POLICY IF EXISTS "Users can view invoices in their company" ON public.invoices;
DROP POLICY IF EXISTS "Users can insert invoices in their company" ON public.invoices;
DROP POLICY IF EXISTS "Users can update invoices in their company" ON public.invoices;
DROP POLICY IF EXISTS "Users can delete invoices in their company" ON public.invoices;
DROP POLICY IF EXISTS "Users can view invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can insert invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can update invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can delete invoice items" ON public.invoice_items;

-- Drop all indexes
DROP INDEX IF EXISTS idx_invoices_company_id;
DROP INDEX IF EXISTS idx_invoices_order_id;
DROP INDEX IF EXISTS idx_invoices_status;
DROP INDEX IF EXISTS idx_invoices_invoice_date;
DROP INDEX IF EXISTS idx_invoices_due_date;
DROP INDEX IF EXISTS idx_invoice_items_invoice_id;
DROP INDEX IF EXISTS idx_invoice_items_service_id;
DROP INDEX IF EXISTS idx_order_services_invoice_id;

-- Remove invoice_id from order_services
ALTER TABLE IF EXISTS public.order_services DROP COLUMN IF EXISTS invoice_id CASCADE;

-- Drop tables
DROP TABLE IF EXISTS public.invoice_items CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;

-- =================================================
-- STEP 2: CREATE FRESH TABLES
-- =================================================

-- Create invoices table
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Client info
  client_party_id uuid REFERENCES public.party(id),
  client_name text NOT NULL,
  client_address text,
  client_email text,
  
  -- Dates
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  
  -- Amounts
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  tax_rate numeric(5,2) NOT NULL DEFAULT 0,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  
  -- Status
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'cancelled', 'overdue')),
  
  -- Additional fields
  notes text,
  
  -- Audit
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  created_by uuid REFERENCES auth.users(id),
  
  CONSTRAINT invoices_company_id_order_id_key UNIQUE (company_id, order_id, invoice_number)
);

-- Create invoice_items table
CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.order_services(id) ON DELETE RESTRICT,
  
  -- Service info (snapshot at invoice creation)
  service_name text NOT NULL,
  service_category text,
  service_date_from date,
  service_date_to date,
  
  -- Pricing
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL,
  line_total numeric(12,2) NOT NULL,
  
  -- Audit
  created_at timestamptz DEFAULT NOW(),
  
  CONSTRAINT invoice_items_invoice_service_key UNIQUE (invoice_id, service_id)
);

-- Add invoice_id to order_services
ALTER TABLE public.order_services
ADD COLUMN invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;

-- =================================================
-- STEP 3: CREATE INDEXES
-- =================================================

CREATE INDEX idx_invoices_company_id ON public.invoices(company_id);
CREATE INDEX idx_invoices_order_id ON public.invoices(order_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_due_date ON public.invoices(due_date) WHERE due_date IS NOT NULL;

CREATE INDEX idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_service_id ON public.invoice_items(service_id);

CREATE INDEX idx_order_services_invoice_id ON public.order_services(invoice_id) WHERE invoice_id IS NOT NULL;

-- =================================================
-- STEP 4: ENABLE RLS
-- =================================================

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- =================================================
-- STEP 5: CREATE RLS POLICIES
-- =================================================

-- Invoices policies
CREATE POLICY "Users can view invoices in their company" 
  ON public.invoices FOR SELECT 
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert invoices in their company" 
  ON public.invoices FOR INSERT 
  WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update invoices in their company" 
  ON public.invoices FOR UPDATE 
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete invoices in their company" 
  ON public.invoices FOR DELETE 
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

-- Invoice items policies
CREATE POLICY "Users can view invoice items" 
  ON public.invoice_items FOR SELECT 
  USING (invoice_id IN (
    SELECT id FROM public.invoices 
    WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  ));

CREATE POLICY "Users can insert invoice items" 
  ON public.invoice_items FOR INSERT 
  WITH CHECK (invoice_id IN (
    SELECT id FROM public.invoices 
    WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  ));

CREATE POLICY "Users can update invoice items" 
  ON public.invoice_items FOR UPDATE 
  USING (invoice_id IN (
    SELECT id FROM public.invoices 
    WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  ));

CREATE POLICY "Users can delete invoice items" 
  ON public.invoice_items FOR DELETE 
  USING (invoice_id IN (
    SELECT id FROM public.invoices 
    WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  ));

-- =================================================
-- STEP 6: COMMENTS
-- =================================================

COMMENT ON TABLE public.invoices IS 'Invoices for orders';
COMMENT ON TABLE public.invoice_items IS 'Line items for invoices (services)';
COMMENT ON COLUMN public.invoices.status IS 'Invoice status: draft, sent, paid, cancelled, overdue';
COMMENT ON COLUMN public.order_services.invoice_id IS 'Links service to invoice (prevents double-invoicing)';

-- =================================================
-- DONE! ✅
-- =================================================
