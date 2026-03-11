-- Migration: Add email tracking columns to order_communications
-- Enables delivery and open tracking via Resend webhooks.

ALTER TABLE public.order_communications
ADD COLUMN IF NOT EXISTS resend_email_id text;

ALTER TABLE public.order_communications
ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'sent'
  CHECK (delivery_status IN ('sent', 'delivered', 'bounced', 'complained'));

ALTER TABLE public.order_communications
ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

ALTER TABLE public.order_communications
ADD COLUMN IF NOT EXISTS opened_at timestamptz;

ALTER TABLE public.order_communications
ADD COLUMN IF NOT EXISTS open_count integer DEFAULT 0;

ALTER TABLE public.order_communications
ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_order_communications_resend_email_id
  ON public.order_communications(resend_email_id) WHERE resend_email_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_communications_invoice_id
  ON public.order_communications(invoice_id) WHERE invoice_id IS NOT NULL;

-- Allow UPDATE for webhook status changes
DROP POLICY IF EXISTS "Users can update company communications" ON public.order_communications;
CREATE POLICY "Users can update company communications"
  ON public.order_communications
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

COMMENT ON COLUMN public.order_communications.resend_email_id IS 'Resend email ID for tracking delivery and opens';
COMMENT ON COLUMN public.order_communications.delivery_status IS 'Email delivery status: sent, delivered, bounced, complained';
COMMENT ON COLUMN public.order_communications.delivered_at IS 'Timestamp when email was confirmed delivered';
COMMENT ON COLUMN public.order_communications.opened_at IS 'Timestamp when email was first opened by recipient';
COMMENT ON COLUMN public.order_communications.open_count IS 'Number of times email was opened';
COMMENT ON COLUMN public.order_communications.invoice_id IS 'Link to invoice if this communication is an invoice email';
