-- Fix: Drop hotel_board CHECK constraint to allow UAI and free text from RateHawk
-- Error: "order_services" violates check constraint "order_services_hotel_board_check"
-- Run this in Supabase SQL Editor

ALTER TABLE public.order_services DROP CONSTRAINT IF EXISTS order_services_hotel_board_check;
