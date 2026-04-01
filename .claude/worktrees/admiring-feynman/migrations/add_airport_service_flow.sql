-- Migration: Add airport_service_flow to order_services
-- Stores the flow type for Airport Services (Meet & Greet / Fast Track):
-- arrival, departure, transit
-- Run this in Supabase SQL Editor

ALTER TABLE public.order_services
  ADD COLUMN IF NOT EXISTS airport_service_flow text;

COMMENT ON COLUMN public.order_services.airport_service_flow IS 'Airport service flow type: arrival (Flight→Service→Transfer), departure (Transfer→Service→Flight), transit (Flight→Service→Flight)';
