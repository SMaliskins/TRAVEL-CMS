-- Migration: Add payment deadline fields to order_services
-- Run this in Supabase SQL Editor
-- Date: 2026-01-19

-- ============================================
-- 1. ADD PAYMENT DEADLINE COLUMNS
-- ============================================

-- Deposit payment deadline (first payment)
ALTER TABLE public.order_services 
ADD COLUMN IF NOT EXISTS payment_deadline_deposit date;

-- Final payment deadline (full payment)
ALTER TABLE public.order_services 
ADD COLUMN IF NOT EXISTS payment_deadline_final date;

-- Payment terms (free text: "50% deposit, 50% 14 days before", etc.)
ALTER TABLE public.order_services 
ADD COLUMN IF NOT EXISTS payment_terms text;

-- ============================================
-- 2. ADD INDEXES FOR QUERIES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_order_services_payment_deadline_deposit 
ON public.order_services(payment_deadline_deposit) 
WHERE payment_deadline_deposit IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_services_payment_deadline_final 
ON public.order_services(payment_deadline_final) 
WHERE payment_deadline_final IS NOT NULL;

-- ============================================
-- 3. COMMENTS
-- ============================================

COMMENT ON COLUMN public.order_services.payment_deadline_deposit IS 'Date when deposit payment is due';
COMMENT ON COLUMN public.order_services.payment_deadline_final IS 'Date when final payment is due';
COMMENT ON COLUMN public.order_services.payment_terms IS 'Payment terms description (e.g., "50% deposit, 50% 14 days before departure")';

-- ============================================
-- VERIFICATION
-- ============================================

-- Run this to verify columns were added:
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'order_services' AND column_name LIKE 'payment%';
