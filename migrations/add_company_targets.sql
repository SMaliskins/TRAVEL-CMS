-- Migration: Add monthly target fields to companies table
-- Run this in Supabase SQL Editor

ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS target_profit_monthly numeric(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS target_revenue_monthly numeric(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS target_orders_monthly integer DEFAULT 0;

COMMENT ON COLUMN public.companies.target_profit_monthly IS 'Monthly profit target for dashboard speedometer';
COMMENT ON COLUMN public.companies.target_revenue_monthly IS 'Monthly revenue target for dashboard speedometer';
COMMENT ON COLUMN public.companies.target_orders_monthly IS 'Monthly orders count target for dashboard speedometer';
