-- Migration: Add airline channel fields for BSP services
-- When a ticket is issued via airline's own system but billed through BSP

ALTER TABLE public.order_services
ADD COLUMN IF NOT EXISTS airline_channel BOOLEAN DEFAULT false;

ALTER TABLE public.order_services
ADD COLUMN IF NOT EXISTS airline_channel_supplier_id uuid REFERENCES public.party(id);

ALTER TABLE public.order_services
ADD COLUMN IF NOT EXISTS airline_channel_supplier_name TEXT;

COMMENT ON COLUMN public.order_services.airline_channel IS 'True when ticket is issued via airline channel but billed through BSP';
COMMENT ON COLUMN public.order_services.airline_channel_supplier_id IS 'The airline supplier party when airline_channel is true';
COMMENT ON COLUMN public.order_services.airline_channel_supplier_name IS 'The airline supplier name when airline_channel is true';
