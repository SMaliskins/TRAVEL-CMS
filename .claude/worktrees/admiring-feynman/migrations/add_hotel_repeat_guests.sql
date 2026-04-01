-- Migration: Add hotel_repeat_guests to order_services
-- Run this in Supabase SQL Editor

ALTER TABLE public.order_services
ADD COLUMN IF NOT EXISTS hotel_repeat_guests boolean DEFAULT false;

COMMENT ON COLUMN public.order_services.hotel_repeat_guests IS 'Repeat guests preference for hotel booking';
