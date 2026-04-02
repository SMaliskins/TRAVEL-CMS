-- Who created the payment row (for audit / "Entered by" column).
-- Run in Supabase SQL Editor.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_created_by ON public.payments(created_by);

COMMENT ON COLUMN public.payments.created_by IS 'Staff user (user_profiles.id) who recorded the payment';
