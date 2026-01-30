-- Migration: Add pricing terms and conditions fields to order_services
-- Run this in Supabase SQL Editor
-- Date: 2026-01-21

-- ============================================
-- 1. ADD PRICE TYPE COLUMN (for Tours: EBD/Regular/SPO)
-- ============================================

ALTER TABLE public.order_services 
ADD COLUMN IF NOT EXISTS price_type TEXT DEFAULT 'regular';

-- Add check constraint
ALTER TABLE public.order_services
DROP CONSTRAINT IF EXISTS check_price_type;

ALTER TABLE public.order_services
ADD CONSTRAINT check_price_type 
CHECK (price_type IS NULL OR price_type IN ('ebd', 'regular', 'spo'));

-- ============================================
-- 2. ADD REFUND POLICY COLUMN
-- ============================================

ALTER TABLE public.order_services 
ADD COLUMN IF NOT EXISTS refund_policy TEXT DEFAULT 'non_ref';

-- Add check constraint
ALTER TABLE public.order_services
DROP CONSTRAINT IF EXISTS check_refund_policy;

ALTER TABLE public.order_services
ADD CONSTRAINT check_refund_policy 
CHECK (refund_policy IS NULL OR refund_policy IN ('non_ref', 'refundable', 'fully_ref'));

-- ============================================
-- 3. ADD FREE CANCELLATION DEADLINE
-- ============================================

ALTER TABLE public.order_services 
ADD COLUMN IF NOT EXISTS free_cancellation_until DATE;

-- ============================================
-- 4. ADD CANCELLATION PENALTY FIELDS
-- ============================================

-- Penalty as fixed amount (EUR)
ALTER TABLE public.order_services 
ADD COLUMN IF NOT EXISTS cancellation_penalty_amount DECIMAL(10,2);

-- Penalty as percentage of price
ALTER TABLE public.order_services 
ADD COLUMN IF NOT EXISTS cancellation_penalty_percent INTEGER;

-- Add check constraint for percentage
ALTER TABLE public.order_services
DROP CONSTRAINT IF EXISTS check_penalty_percent;

ALTER TABLE public.order_services
ADD CONSTRAINT check_penalty_percent 
CHECK (cancellation_penalty_percent IS NULL OR (cancellation_penalty_percent >= 0 AND cancellation_penalty_percent <= 100));

-- ============================================
-- 5. ADD INDEXES FOR QUERIES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_order_services_free_cancellation 
ON public.order_services(free_cancellation_until) 
WHERE free_cancellation_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_services_refund_policy 
ON public.order_services(refund_policy);

-- ============================================
-- 6. ADD COMMENTS
-- ============================================

COMMENT ON COLUMN public.order_services.price_type IS 'Price type: ebd (early booking), regular, spo (special offer). Mainly used for Tour category.';
COMMENT ON COLUMN public.order_services.refund_policy IS 'Refund policy: non_ref (non-refundable), refundable (with conditions), fully_ref (fully refundable)';
COMMENT ON COLUMN public.order_services.free_cancellation_until IS 'Date until which free cancellation is available. After this date, penalties apply.';
COMMENT ON COLUMN public.order_services.cancellation_penalty_amount IS 'Fixed cancellation penalty amount in EUR';
COMMENT ON COLUMN public.order_services.cancellation_penalty_percent IS 'Cancellation penalty as percentage of service price (0-100)';

-- ============================================
-- VERIFICATION
-- ============================================

-- Run this to verify columns were added:
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'order_services' 
-- AND column_name IN ('price_type', 'refund_policy', 'free_cancellation_until', 'cancellation_penalty_amount', 'cancellation_penalty_percent');
