-- Allow supplier_booking_type = 'partner' (GDS, Direct booking, Partner)
-- Run in Supabase SQL Editor if the column was created with CHECK (gds, direct) only.

ALTER TABLE public.order_services
  DROP CONSTRAINT IF EXISTS order_services_supplier_booking_type_check;

ALTER TABLE public.order_services
  ADD CONSTRAINT order_services_supplier_booking_type_check
  CHECK (supplier_booking_type IS NULL OR supplier_booking_type IN ('gds', 'direct', 'partner'));

COMMENT ON COLUMN public.order_services.supplier_booking_type IS 'Supplier booking type: gds, direct, or partner';
