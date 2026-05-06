-- Add internal cash-to-bank ATM deposits to payments.
-- ATM deposits are not client/order payments, so order_id is nullable for this method.

ALTER TABLE public.payments
  ALTER COLUMN order_id DROP NOT NULL;

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_method_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_method_check
  CHECK (method = ANY (ARRAY['cash'::text, 'bank'::text, 'card'::text, 'atm'::text]));

COMMENT ON COLUMN public.payments.method IS
  'Payment method: cash, bank, card, or atm for internal cash-to-bank ATM deposits.';
