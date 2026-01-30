-- Migration: Create travel_service_categories table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.travel_service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  vat_rate numeric(5,2) NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_travel_service_categories_company_id 
ON public.travel_service_categories(company_id);

CREATE INDEX IF NOT EXISTS idx_travel_service_categories_is_active 
ON public.travel_service_categories(is_active) WHERE is_active = true;

COMMENT ON TABLE public.travel_service_categories IS 'Travel service categories with VAT rates per company';
COMMENT ON COLUMN public.travel_service_categories.name IS 'Category name (e.g., Flight, Hotel, Transfer)';
COMMENT ON COLUMN public.travel_service_categories.vat_rate IS 'VAT rate in percentage (e.g., 21.00 for 21%)';
