-- Migration: Add company settings fields to companies table
-- Run this in Supabase SQL Editor
-- Date: 2026-01-19 (Updated)

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
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS primary_type text;

-- Additional types (array of strings)
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS additional_types jsonb DEFAULT '[]'::jsonb;

-- Other type description (if primary_type = 'other')
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS other_type_description text;

-- ============================================
-- CONTACT INFORMATION (as JSONB objects)
-- Each contact has: first_name, last_name, phone, email
-- ============================================

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS primary_contact jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS finance_contact jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS tech_contact jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS general_contact jsonb DEFAULT '{}'::jsonb;

-- ============================================
-- LICENSES & CERTIFICATIONS (as JSONB array)
-- Each license has: id, type, number
-- ============================================

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS licenses jsonb DEFAULT '[]'::jsonb;

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
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS iata_type text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS bsp_remittance_frequency text;

-- ============================================
-- REGIONAL SETTINGS
-- ============================================

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS default_currency text DEFAULT 'EUR';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS date_format text DEFAULT 'dd.mm.yyyy';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS document_language text DEFAULT 'en';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Europe/Riga';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS city_label text DEFAULT 'Riga';

-- Show Order Source classification (TA/TO/CORP/NON) - for Latvian legislation
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS show_order_source boolean DEFAULT false;

-- ============================================
-- ADDITIONAL SETTINGS
-- ============================================

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS working_hours text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS emergency_contact text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS invoice_prefix text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS default_payment_terms integer DEFAULT 14;

-- Updated timestamp
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN public.companies.legal_name IS 'Official legal company name';
COMMENT ON COLUMN public.companies.trading_name IS 'Trading/brand name if different from legal';
COMMENT ON COLUMN public.companies.primary_type IS 'Primary company type';
COMMENT ON COLUMN public.companies.additional_types IS 'Additional company types (JSON array)';
COMMENT ON COLUMN public.companies.primary_contact IS 'Primary contact (JSON: first_name, last_name, phone, email)';
COMMENT ON COLUMN public.companies.finance_contact IS 'Financial contact (JSON)';
COMMENT ON COLUMN public.companies.tech_contact IS 'Technical support contact (JSON)';
COMMENT ON COLUMN public.companies.general_contact IS 'General queries contact (JSON)';
COMMENT ON COLUMN public.companies.licenses IS 'Licenses and certifications (JSON array: id, type, number)';
COMMENT ON COLUMN public.companies.is_iata_accredited IS 'Whether company has IATA accreditation';
COMMENT ON COLUMN public.companies.iata_type IS 'IATA accreditation type: go_lite, go_standard, go_eurozone, go_global';
COMMENT ON COLUMN public.companies.bsp_remittance_frequency IS 'BSP payment frequency: weekly, fortnightly, monthly';
COMMENT ON COLUMN public.companies.show_order_source IS 'Show Order Source (TA/TO/CORP/NON) - for Latvian legislation';

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_companies_country ON public.companies(country);
CREATE INDEX IF NOT EXISTS idx_companies_primary_type ON public.companies(primary_type);
CREATE INDEX IF NOT EXISTS idx_companies_is_iata ON public.companies(is_iata_accredited) WHERE is_iata_accredited = true;
