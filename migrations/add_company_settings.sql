-- Migration: Add company settings fields to companies table
-- Run this in Supabase SQL Editor
-- Date: 2026-01-19

-- ============================================
-- COMPANY PROFILE
-- ============================================

-- Legal and trading names
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS legal_name text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS trading_name text;

-- Logo
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS logo_url text;

-- Registration and legal
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS registration_number text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS vat_number text;

-- Addresses
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS legal_address text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS operating_address text;

-- Website
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS website text;

-- ============================================
-- COMPANY TYPE CLASSIFICATION
-- ============================================

-- Primary type (single select)
-- Values: travel_agency, tour_operator, ota, tmc, dmc, mice, crew_marine, luxury_concierge, medical_educational, airline_gsa, other
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS primary_type text;

-- Additional types (array of strings)
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS additional_types jsonb DEFAULT '[]'::jsonb;

-- Other type description (if primary_type = 'other')
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS other_type_description text;

-- ============================================
-- CONTACT INFORMATION
-- ============================================

-- Primary contact
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS email text;

-- Financial contact
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS finance_phone text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS finance_email text;

-- Technical support
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS tech_phone text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS tech_email text;

-- General queries
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS general_phone text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS general_email text;

-- ============================================
-- LICENSES & CERTIFICATIONS
-- ============================================

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS license_number text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS tato_number text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS other_licenses text;

-- ============================================
-- BANKING DETAILS
-- ============================================

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS bank_name text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS bank_account text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS swift_code text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS beneficiary_name text;

-- ============================================
-- IATA ACCREDITATION
-- ============================================

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS is_iata_accredited boolean DEFAULT false;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS iata_code text;

-- IATA type: go_lite, go_standard, go_eurozone, go_global
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS iata_type text;

-- BSP remittance frequency: weekly, fortnightly, monthly
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS bsp_remittance_frequency text;

-- ============================================
-- OPERATIONAL SETTINGS
-- ============================================

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS default_currency text DEFAULT 'EUR';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS date_format text DEFAULT 'dd.mm.yyyy';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS document_language text DEFAULT 'en';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS default_origin_city text;

-- ============================================
-- REGIONAL SETTINGS
-- ============================================

-- Show Order Source classification (TA/TO/CORP/NON) - for Latvian legislation
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS show_order_source boolean DEFAULT false;

-- ============================================
-- ADDITIONAL SETTINGS
-- ============================================

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS working_hours text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS emergency_contact text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS invoice_prefix text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS default_payment_terms integer DEFAULT 14;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS commission_rate numeric(5,2);

-- Social media (as JSON object)
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS social_media jsonb DEFAULT '{}'::jsonb;

-- Updated timestamp
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN public.companies.legal_name IS 'Official legal company name';
COMMENT ON COLUMN public.companies.trading_name IS 'Trading/brand name if different from legal';
COMMENT ON COLUMN public.companies.primary_type IS 'Primary company type: travel_agency, tour_operator, ota, tmc, dmc, mice, crew_marine, luxury_concierge, medical_educational, airline_gsa, other';
COMMENT ON COLUMN public.companies.additional_types IS 'Additional company types (JSON array)';
COMMENT ON COLUMN public.companies.is_iata_accredited IS 'Whether company has IATA accreditation';
COMMENT ON COLUMN public.companies.iata_type IS 'IATA accreditation type: go_lite, go_standard, go_eurozone, go_global';
COMMENT ON COLUMN public.companies.bsp_remittance_frequency IS 'BSP payment frequency: weekly, fortnightly, monthly';
COMMENT ON COLUMN public.companies.show_order_source IS 'Show Order Source (TA/TO/CORP/NON) classification - for Latvian legislation';
COMMENT ON COLUMN public.companies.default_payment_terms IS 'Default payment terms in days';
COMMENT ON COLUMN public.companies.commission_rate IS 'Default commission rate percentage';

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_companies_country ON public.companies(country);
CREATE INDEX IF NOT EXISTS idx_companies_primary_type ON public.companies(primary_type);
CREATE INDEX IF NOT EXISTS idx_companies_is_iata ON public.companies(is_iata_accredited) WHERE is_iata_accredited = true;
