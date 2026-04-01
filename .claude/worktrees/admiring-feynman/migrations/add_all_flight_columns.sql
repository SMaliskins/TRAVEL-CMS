-- Migration: Add all flight-related columns to order_services
-- Run this in Supabase SQL Editor
-- Date: 2026-01-25

-- ============================================
-- 1. FLIGHT SEGMENTS (JSONB array of flight details)
-- ============================================
ALTER TABLE public.order_services 
ADD COLUMN IF NOT EXISTS flight_segments JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.order_services.flight_segments IS 'Array of flight segments: [{flightNumber, airline, departure, arrival, times, etc.}]';

-- ============================================
-- 2. TICKET NUMBERS ARRAY (per client)
-- ============================================
ALTER TABLE public.order_services 
ADD COLUMN IF NOT EXISTS ticket_numbers JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.order_services.ticket_numbers IS 'Array of ticket numbers per client: [{clientId, clientName, ticketNr}]';

-- ============================================
-- 3. CHANGE FEE (for Flights)
-- ============================================
ALTER TABLE public.order_services 
ADD COLUMN IF NOT EXISTS change_fee DECIMAL(10,2) DEFAULT NULL;

COMMENT ON COLUMN public.order_services.change_fee IS 'Airline change fee amount';

-- ============================================
-- 4. CABIN CLASS
-- ============================================
ALTER TABLE public.order_services 
ADD COLUMN IF NOT EXISTS cabin_class TEXT DEFAULT 'economy';

-- ============================================
-- 5. BOARDING PASSES (JSONB array)
-- ============================================
ALTER TABLE public.order_services 
ADD COLUMN IF NOT EXISTS boarding_passes JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.order_services.boarding_passes IS 'Array of uploaded boarding passes: [{id, fileName, fileUrl, clientId, flightNumber}]';

-- ============================================
-- 6. VAT RATE
-- ============================================
ALTER TABLE public.order_services 
ADD COLUMN IF NOT EXISTS vat_rate INTEGER DEFAULT 0;

COMMENT ON COLUMN public.order_services.vat_rate IS 'VAT rate in percentage (0 or 21)';

-- ============================================
-- 7. BAGGAGE
-- ============================================
ALTER TABLE public.order_services 
ADD COLUMN IF NOT EXISTS baggage TEXT DEFAULT '';

COMMENT ON COLUMN public.order_services.baggage IS 'Baggage allowance: personal, personal+cabin, personal+cabin+1bag, personal+cabin+2bags';

-- ============================================
-- VERIFICATION
-- ============================================
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'order_services' 
AND column_name IN ('flight_segments', 'ticket_numbers', 'change_fee', 'cabin_class', 'boarding_passes', 'vat_rate', 'baggage')
ORDER BY column_name;
