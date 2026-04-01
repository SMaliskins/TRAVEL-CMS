-- ============================================================
-- FULL MIGRATION: order_communications + email tracking columns
-- Run this in Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- 1. Create the table
CREATE TABLE IF NOT EXISTS public.order_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.order_services(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('to_supplier', 'from_supplier', 'to_client', 'from_client', 'other')),
  recipient_email text,
  subject text,
  body text NOT NULL DEFAULT '',
  sent_at timestamptz NOT NULL DEFAULT now(),
  sent_by uuid REFERENCES auth.users(id),
  email_sent boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Add email tracking columns
ALTER TABLE public.order_communications
ADD COLUMN IF NOT EXISTS resend_email_id text;

ALTER TABLE public.order_communications
ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'sent';

ALTER TABLE public.order_communications
ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

ALTER TABLE public.order_communications
ADD COLUMN IF NOT EXISTS opened_at timestamptz;

ALTER TABLE public.order_communications
ADD COLUMN IF NOT EXISTS open_count integer DEFAULT 0;

ALTER TABLE public.order_communications
ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_order_communications_order_id ON public.order_communications(order_id);
CREATE INDEX IF NOT EXISTS idx_order_communications_service_id ON public.order_communications(service_id) WHERE service_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_communications_company_id ON public.order_communications(company_id);
CREATE INDEX IF NOT EXISTS idx_order_communications_sent_at ON public.order_communications(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_communications_type ON public.order_communications(type);
CREATE INDEX IF NOT EXISTS idx_order_communications_resend_email_id ON public.order_communications(resend_email_id) WHERE resend_email_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_communications_invoice_id ON public.order_communications(invoice_id) WHERE invoice_id IS NOT NULL;

-- 4. RLS
ALTER TABLE public.order_communications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view company communications" ON public.order_communications;
DROP POLICY IF EXISTS "Users can insert company communications" ON public.order_communications;
DROP POLICY IF EXISTS "Users can update company communications" ON public.order_communications;

CREATE POLICY "Users can view company communications"
  ON public.order_communications
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert company communications"
  ON public.order_communications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update company communications"
  ON public.order_communications
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );
