-- ============================================================
-- Extend order_communications.type CHECK to allow hotel_confirmation
-- so emails sent from "Send to Hotel" land in the Communication tab.
-- Run in Supabase Dashboard → SQL Editor → Run.
-- ============================================================

ALTER TABLE public.order_communications
  DROP CONSTRAINT IF EXISTS order_communications_type_check;

ALTER TABLE public.order_communications
  ADD CONSTRAINT order_communications_type_check
  CHECK (
    type IN (
      'to_supplier',
      'from_supplier',
      'to_client',
      'from_client',
      'hotel_confirmation',
      'other'
    )
  );

COMMENT ON COLUMN public.order_communications.type IS
  'Direction / kind: to_supplier, from_supplier, to_client, from_client, hotel_confirmation, other';
