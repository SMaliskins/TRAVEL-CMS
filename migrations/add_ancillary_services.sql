-- Migration: Add ancillary sub-services support for Air Tickets
-- Enables extra baggage, seat selection, meal, and other add-ons linked to a parent ticket

-- Add ancillary_type column
ALTER TABLE public.order_services
ADD COLUMN IF NOT EXISTS ancillary_type TEXT;

-- Drop old constraint and add updated one that includes 'ancillary'
ALTER TABLE public.order_services
DROP CONSTRAINT IF EXISTS order_services_service_type_check;

ALTER TABLE public.order_services
ADD CONSTRAINT order_services_service_type_check
CHECK (service_type IN ('original', 'change', 'cancellation', 'ancillary'));

-- Index for ancillary type filtering
CREATE INDEX IF NOT EXISTS idx_order_services_ancillary_type
ON public.order_services(ancillary_type)
WHERE ancillary_type IS NOT NULL;

COMMENT ON COLUMN public.order_services.ancillary_type IS 'Sub-type for ancillary services: extra_baggage, seat_selection, meal, other_ancillary';
