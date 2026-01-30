-- Migration: Add ticket_numbers array and change_fee fields to order_services
-- Run this in Supabase SQL Editor
-- Date: 2026-01-21

-- ============================================
-- 1. ADD TICKET NUMBERS ARRAY COLUMN
-- ============================================

-- Store ticket numbers as JSONB array
-- Format: [{"clientId": "uuid", "clientName": "John Doe", "ticketNr": "125-2227796422"}, ...]
ALTER TABLE public.order_services 
ADD COLUMN IF NOT EXISTS ticket_numbers JSONB DEFAULT '[]'::jsonb;

-- ============================================
-- 2. ADD CHANGE FEE COLUMN (for Flights)
-- ============================================

-- Change fee amount (airline fee for ticket changes)
-- Note: Even if change is "free", class difference must be paid separately
ALTER TABLE public.order_services 
ADD COLUMN IF NOT EXISTS change_fee DECIMAL(10,2) DEFAULT NULL;

-- ============================================
-- 3. ADD COMMENTS
-- ============================================

COMMENT ON COLUMN public.order_services.ticket_numbers IS 'Array of ticket numbers per client for Flight services. Format: [{clientId, clientName, ticketNr}, ...]';
COMMENT ON COLUMN public.order_services.change_fee IS 'Airline change fee amount. Note: class difference is paid separately even if change is free.';

-- ============================================
-- VERIFICATION
-- ============================================

-- Run this to verify columns were added:
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'order_services' AND column_name IN ('ticket_numbers', 'change_fee');
