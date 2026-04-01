-- Migration: Add Room upgrade, Late check-out and time fields for Early/Late check-in and Late check-out
-- Run in Supabase SQL Editor

ALTER TABLE public.order_services
ADD COLUMN IF NOT EXISTS hotel_room_upgrade boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS hotel_late_check_out boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS hotel_early_check_in_time text,
ADD COLUMN IF NOT EXISTS hotel_late_check_in_time text,
ADD COLUMN IF NOT EXISTS hotel_late_check_out_time text;

COMMENT ON COLUMN public.order_services.hotel_room_upgrade IS 'Room upgrade preference';
COMMENT ON COLUMN public.order_services.hotel_late_check_out IS 'Late check-out preference';
COMMENT ON COLUMN public.order_services.hotel_early_check_in_time IS 'Early check-in time (e.g. 10:00)';
COMMENT ON COLUMN public.order_services.hotel_late_check_in_time IS 'Late check-in time (e.g. 16:00)';
COMMENT ON COLUMN public.order_services.hotel_late_check_out_time IS 'Late check-out time (e.g. 14:00)';
