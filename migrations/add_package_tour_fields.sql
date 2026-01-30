-- Migration: Add Package Tour parsing fields to order_services
-- Hotel star rating, transfer type, additional services

ALTER TABLE public.order_services
  ADD COLUMN IF NOT EXISTS hotel_star_rating text,
  ADD COLUMN IF NOT EXISTS transfer_type text,
  ADD COLUMN IF NOT EXISTS additional_services text;

COMMENT ON COLUMN public.order_services.hotel_star_rating IS 'Hotel star rating (e.g. 5*, 4*)';
COMMENT ON COLUMN public.order_services.transfer_type IS 'Transfer type: Group, Individual, or — if absent';
COMMENT ON COLUMN public.order_services.additional_services IS 'Additional services from package (free text)';
