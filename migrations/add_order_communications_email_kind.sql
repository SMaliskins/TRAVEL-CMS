-- Distinguish invoice emails from payment reminders (separate open-tracking in UI).
-- Run in Supabase SQL Editor.

ALTER TABLE public.order_communications
  ADD COLUMN IF NOT EXISTS email_kind text DEFAULT 'general';

COMMENT ON COLUMN public.order_communications.email_kind IS 'invoice | payment_reminder | general — newest row per kind used for Email / Reminder columns';

CREATE INDEX IF NOT EXISTS idx_order_communications_invoice_email_kind
  ON public.order_communications(invoice_id, email_kind, sent_at DESC)
  WHERE invoice_id IS NOT NULL;
