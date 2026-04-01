-- Hotel PRICING: price per night vs price per stay (only relevant for category hotel)
ALTER TABLE public.order_services
ADD COLUMN IF NOT EXISTS hotel_price_per text DEFAULT 'stay';

ALTER TABLE public.order_services
DROP CONSTRAINT IF EXISTS check_hotel_price_per;

ALTER TABLE public.order_services
ADD CONSTRAINT check_hotel_price_per
CHECK (hotel_price_per IS NULL OR hotel_price_per IN ('night', 'stay'));

COMMENT ON COLUMN public.order_services.hotel_price_per IS 'Hotel only: night = price × nights, stay = total price for stay (quantity 1).';
