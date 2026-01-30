-- Migration: Add default_vat_rate to companies table
-- Run this in Supabase SQL Editor

ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS default_vat_rate numeric(5,2) DEFAULT 0;

COMMENT ON COLUMN public.companies.default_vat_rate IS 'Default VAT rate for the country (e.g., 21.00 for 21%)';
