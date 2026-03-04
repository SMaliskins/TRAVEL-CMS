-- Migration: Add hotel contact fields to order_services
-- Address, phone, email for display in Edit Service - Hotel
-- Run this in Supabase SQL Editor

ALTER TABLE public.order_services
  ADD COLUMN IF NOT EXISTS hotel_address text,
  ADD COLUMN IF NOT EXISTS hotel_phone text,
  ADD COLUMN IF NOT EXISTS hotel_email text;

COMMENT ON COLUMN public.order_services.hotel_address IS 'Hotel address (from RateHawk or manual)';
COMMENT ON COLUMN public.order_services.hotel_phone IS 'Hotel phone (from RateHawk or manual)';
COMMENT ON COLUMN public.order_services.hotel_email IS 'Hotel email (from RateHawk or manual)';
