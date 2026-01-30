-- Migration: Add flight_segments and cabin_class fields to order_services
-- Run this in Supabase SQL Editor
-- Date: 2026-01-21

-- ============================================
-- 1. ADD FLIGHT SEGMENTS COLUMN
-- ============================================

-- Store flight segments as JSONB array
ALTER TABLE public.order_services 
ADD COLUMN IF NOT EXISTS flight_segments JSONB DEFAULT '[]'::jsonb;

-- ============================================
-- 2. ADD CABIN CLASS COLUMN
-- ============================================

ALTER TABLE public.order_services 
ADD COLUMN IF NOT EXISTS cabin_class TEXT DEFAULT 'economy' 
CHECK (cabin_class IN ('economy', 'premium_economy', 'business', 'first'));

-- ============================================
-- 3. ADD COMMENTS
-- ============================================

COMMENT ON COLUMN public.order_services.flight_segments IS 'Array of flight segments with detailed info: flightNumber, airline, times, terminals, etc.';
COMMENT ON COLUMN public.order_services.cabin_class IS 'Cabin class for flights: economy, premium_economy, business, first';

-- ============================================
-- VERIFICATION
-- ============================================

-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'order_services' AND column_name IN ('flight_segments', 'cabin_class');
