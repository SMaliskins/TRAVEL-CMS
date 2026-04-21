-- Per-user toggle for the "cash register" sound that plays when a payment
-- is received. Defaults to ON. Used by TopBar / AddPaymentModal.
-- Run in Supabase SQL Editor (or your migration runner). Idempotent.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS payment_sound_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.user_profiles.payment_sound_enabled IS
  'When true, the CRM plays a short cash-register chime on incoming payments for this user.';
