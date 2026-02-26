-- Reservations of invoice numbers per order. Reserved on "Create Invoice", released if user abandons without saving.
-- Cancelled invoice numbers stay in invoices (status=cancelled) and are reused only in the same order; they do NOT go here.

CREATE TABLE IF NOT EXISTS public.invoice_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  reserved_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'used', 'released'))
);

CREATE INDEX IF NOT EXISTS idx_invoice_reservations_order_reserved
  ON public.invoice_reservations (order_id) WHERE status = 'reserved';

CREATE INDEX IF NOT EXISTS idx_invoice_reservations_company_released
  ON public.invoice_reservations (company_id, invoice_number) WHERE status = 'released';

COMMENT ON TABLE public.invoice_reservations IS 'Reserved invoice numbers per order. Released numbers re-enter company pool; cancelled invoice numbers are not stored here.';
