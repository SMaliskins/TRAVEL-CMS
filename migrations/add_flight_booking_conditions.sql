-- Migration: Add Flight booking conditions fields
-- cancellation_penalty_currency for Air Ticket / Flight

ALTER TABLE public.order_services
ADD COLUMN IF NOT EXISTS cancellation_penalty_currency TEXT DEFAULT 'EUR';

COMMENT ON COLUMN public.order_services.cancellation_penalty_currency IS 'Currency for cancellation penalty: EUR, USD, GBP, AED';
