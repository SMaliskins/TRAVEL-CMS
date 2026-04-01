-- Migration: Add 'draft' to res_status allowed values
-- Run this in Supabase SQL Editor
-- Date: 2026-01-21

-- ============================================
-- 1. DROP OLD CONSTRAINT
-- ============================================

ALTER TABLE public.order_services 
DROP CONSTRAINT IF EXISTS order_services_res_status_check;

-- ============================================
-- 2. ADD NEW CONSTRAINT WITH 'draft'
-- ============================================

ALTER TABLE public.order_services 
ADD CONSTRAINT order_services_res_status_check 
CHECK (res_status IN ('draft', 'booked', 'confirmed', 'changed', 'rejected', 'cancelled'));

-- ============================================
-- VERIFICATION
-- ============================================

-- Run this to verify:
-- SELECT conname, pg_get_constraintdef(oid) 
-- FROM pg_constraint 
-- WHERE conrelid = 'public.order_services'::regclass AND conname LIKE '%res_status%';
