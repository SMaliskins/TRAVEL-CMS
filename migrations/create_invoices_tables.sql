-- Migration: Create invoices and invoice_items tables
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. Create invoices table
-- ============================================
CREATE TABLE IF NOT EXISTS public.invoices (
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

-- ============================================
-- 2. Create invoice_items table
-- ============================================
CREATE TABLE IF NOT EXISTS public.invoice_items (
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

-- ============================================
-- 3. Add invoice_id to order_services (track invoicing)
-- ============================================
ALTER TABLE public.order_services
ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;

-- ============================================
-- 4. Create indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON public.invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON public.invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON public.invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices(due_date) WHERE due_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_service_id ON public.invoice_items(service_id);

CREATE INDEX IF NOT EXISTS idx_order_services_invoice_id ON public.order_services(invoice_id) WHERE invoice_id IS NOT NULL;

-- ============================================
-- 5. Enable RLS
-- ============================================
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. RLS Policies
-- ============================================

-- Invoices policies
DROP POLICY IF EXISTS "Users can view invoices in their company" ON public.invoices;
CREATE POLICY "Users can view invoices in their company" 
  ON public.invoices FOR SELECT 
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert invoices in their company" ON public.invoices;
CREATE POLICY "Users can insert invoices in their company" 
  ON public.invoices FOR INSERT 
  WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update invoices in their company" ON public.invoices;
CREATE POLICY "Users can update invoices in their company" 
  ON public.invoices FOR UPDATE 
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete invoices in their company" ON public.invoices;
CREATE POLICY "Users can delete invoices in their company" 
  ON public.invoices FOR DELETE 
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

-- Invoice items policies
DROP POLICY IF EXISTS "Users can view invoice items" ON public.invoice_items;
CREATE POLICY "Users can view invoice items" 
  ON public.invoice_items FOR SELECT 
  USING (invoice_id IN (
    SELECT id FROM public.invoices 
    WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  ));

DROP POLICY IF EXISTS "Users can insert invoice items" ON public.invoice_items;
CREATE POLICY "Users can insert invoice items" 
  ON public.invoice_items FOR INSERT 
  WITH CHECK (invoice_id IN (
    SELECT id FROM public.invoices 
    WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  ));

DROP POLICY IF EXISTS "Users can update invoice items" ON public.invoice_items;
CREATE POLICY "Users can update invoice items" 
  ON public.invoice_items FOR UPDATE 
  USING (invoice_id IN (
    SELECT id FROM public.invoices 
    WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  ));

DROP POLICY IF EXISTS "Users can delete invoice items" ON public.invoice_items;
CREATE POLICY "Users can delete invoice items" 
  ON public.invoice_items FOR DELETE 
  USING (invoice_id IN (
    SELECT id FROM public.invoices 
    WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  ));

-- ============================================
-- 7. Comments
-- ============================================
COMMENT ON TABLE public.invoices IS 'Invoices for orders';
COMMENT ON TABLE public.invoice_items IS 'Line items for invoices (services)';
COMMENT ON COLUMN public.invoices.status IS 'Invoice status: draft, sent, paid, cancelled, overdue';
COMMENT ON COLUMN public.order_services.invoice_id IS 'Links service to invoice (prevents double-invoicing)';

-- ============================================
-- Done!
-- ============================================
