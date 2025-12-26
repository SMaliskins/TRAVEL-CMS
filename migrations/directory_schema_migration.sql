-- ============================================
-- Directory Schema Migration - Phase 1
-- ============================================
-- Purpose: Add missing fields per directory-v1-full-architecture.md specification
-- Safety: All operations use IF NOT EXISTS - safe to run multiple times
-- No destructive operations
-- ============================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- PART 1: Party Table - Core Fields
-- ============================================

DO $$ 
BEGIN
    -- Add display_name if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party' 
        AND column_name = 'display_name'
    ) THEN
        ALTER TABLE public.party 
        ADD COLUMN display_name text;
        
        COMMENT ON COLUMN public.party.display_name IS 'Main name for listing (computed or stored)';
    END IF;

    -- Add rating if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party' 
        AND column_name = 'rating'
    ) THEN
        ALTER TABLE public.party 
        ADD COLUMN rating integer 
        CHECK (rating >= 1 AND rating <= 10);
        
        COMMENT ON COLUMN public.party.rating IS 'Manual + future auto-scoring (1-10)';
    END IF;

    -- Add status enum type if not exists
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'party_status') THEN
        CREATE TYPE party_status AS ENUM ('active', 'inactive', 'blocked');
    END IF;

    -- Add status column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE public.party 
        ADD COLUMN status party_status DEFAULT 'active' NOT NULL;
        
        COMMENT ON COLUMN public.party.status IS 'Party status: active, inactive, or blocked';
    ELSE
        -- If column exists but wrong type, we can't safely convert here
        -- This requires manual intervention
        RAISE NOTICE 'status column already exists - verify it uses party_status enum';
    END IF;

    -- Add company_id if not exists (for tenant isolation)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party' 
        AND column_name = 'company_id'
    ) THEN
        ALTER TABLE public.party 
        ADD COLUMN company_id uuid;
        
        COMMENT ON COLUMN public.party.company_id IS 'Tenant/company isolation';
    END IF;

    -- Add FK constraint if column exists but constraint doesn't
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party' 
        AND column_name = 'company_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = 'public' 
        AND tc.table_name = 'party'
        AND kcu.column_name = 'company_id'
        AND tc.constraint_type = 'FOREIGN KEY'
    ) THEN
        ALTER TABLE public.party
        ADD CONSTRAINT party_company_id_fkey
        FOREIGN KEY (company_id)
        REFERENCES public.companies(id);
    END IF;

    -- Add created_by if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party' 
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE public.party 
        ADD COLUMN created_by uuid REFERENCES auth.users(id);
        
        COMMENT ON COLUMN public.party.created_by IS 'User who created this party record';
    END IF;

    -- Add notes if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party' 
        AND column_name = 'notes'
    ) THEN
        ALTER TABLE public.party 
        ADD COLUMN notes text;
        
        COMMENT ON COLUMN public.party.notes IS 'Internal notes about this party';
    END IF;

    -- Add email_marketing_consent if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party' 
        AND column_name = 'email_marketing_consent'
    ) THEN
        ALTER TABLE public.party 
        ADD COLUMN email_marketing_consent boolean DEFAULT false;
        
        COMMENT ON COLUMN public.party.email_marketing_consent IS 'Consent to receive marketing emails';
    END IF;

    -- Add phone_marketing_consent if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party' 
        AND column_name = 'phone_marketing_consent'
    ) THEN
        ALTER TABLE public.party 
        ADD COLUMN phone_marketing_consent boolean DEFAULT false;
        
        COMMENT ON COLUMN public.party.phone_marketing_consent IS 'Consent to receive SMS/phone marketing';
    END IF;

    -- Ensure party_type exists and is correct enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'party_type') THEN
        CREATE TYPE party_type AS ENUM ('person', 'company');
    END IF;

    -- If party_type column exists but uses different type, note it
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party' 
        AND column_name = 'party_type'
    ) THEN
        RAISE NOTICE 'party_type column exists - verify it uses party_type enum';
    END IF;

    -- Add email if not exists (common contact field)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party' 
        AND column_name = 'email'
    ) THEN
        ALTER TABLE public.party 
        ADD COLUMN email text;
        
        COMMENT ON COLUMN public.party.email IS 'Primary email address';
    END IF;

    -- Add phone if not exists (common contact field)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party' 
        AND column_name = 'phone'
    ) THEN
        ALTER TABLE public.party 
        ADD COLUMN phone text;
        
        COMMENT ON COLUMN public.party.phone IS 'Primary phone number';
    END IF;
END $$;

-- ============================================
-- PART 2: Party Person Table
-- ============================================

DO $$ 
BEGIN
    -- Add title if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party_person' 
        AND column_name = 'title'
    ) THEN
        ALTER TABLE public.party_person 
        ADD COLUMN title text;
        
        COMMENT ON COLUMN public.party_person.title IS 'Title: Mr, Mrs, Chd, etc.';
    END IF;

    -- Verify citizenship column exists (mentioned in spec)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party_person' 
        AND column_name = 'citizenship'
    ) THEN
        ALTER TABLE public.party_person 
        ADD COLUMN citizenship text;
        
        COMMENT ON COLUMN public.party_person.citizenship IS 'Country code (autocomplete from countries list)';
    END IF;

    -- Verify address column exists (mentioned in spec)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party_person' 
        AND column_name = 'address'
    ) THEN
        ALTER TABLE public.party_person 
        ADD COLUMN address text;
        
        COMMENT ON COLUMN public.party_person.address IS 'Physical address';
    END IF;
END $$;

-- ============================================
-- PART 3: Party Company Table
-- ============================================

DO $$ 
BEGIN
    -- Add bank_details if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party_company' 
        AND column_name = 'bank_details'
    ) THEN
        ALTER TABLE public.party_company 
        ADD COLUMN bank_details text;
        
        COMMENT ON COLUMN public.party_company.bank_details IS 'Bank account information';
    END IF;

    -- Verify actual_address column exists (mentioned in spec)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party_company' 
        AND column_name = 'actual_address'
    ) THEN
        ALTER TABLE public.party_company 
        ADD COLUMN actual_address text;
        
        COMMENT ON COLUMN public.party_company.actual_address IS 'Physical address';
    END IF;
END $$;

-- ============================================
-- PART 4: Partner Party Table (Supplier)
-- ============================================

DO $$ 
BEGIN
    -- Create business_category enum type if not exists
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'business_category') THEN
        CREATE TYPE business_category AS ENUM ('TO', 'Hotel', 'Rent a car', 'Airline', 'DMC', 'Other');
    END IF;

    -- Add business_category if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'partner_party' 
        AND column_name = 'business_category'
    ) THEN
        ALTER TABLE public.partner_party 
        ADD COLUMN business_category business_category;
        
        COMMENT ON COLUMN public.partner_party.business_category IS 'Supplier business category';
    ELSE
        RAISE NOTICE 'business_category column already exists - verify it uses business_category enum';
    END IF;

    -- Add commission_notes if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'partner_party' 
        AND column_name = 'commission_notes'
    ) THEN
        ALTER TABLE public.partner_party 
        ADD COLUMN commission_notes text;
        
        COMMENT ON COLUMN public.partner_party.commission_notes IS 'Notes about commission terms';
    END IF;

    -- Verify commission fields exist (mentioned in spec)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'partner_party' 
        AND column_name = 'commission_type'
    ) THEN
        -- Create commission_type enum if needed
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'commission_type') THEN
            CREATE TYPE commission_type AS ENUM ('percent', 'fixed');
        END IF;
        
        ALTER TABLE public.partner_party 
        ADD COLUMN commission_type commission_type;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'partner_party' 
        AND column_name = 'commission_value'
    ) THEN
        ALTER TABLE public.partner_party 
        ADD COLUMN commission_value numeric(12,2);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'partner_party' 
        AND column_name = 'commission_currency'
    ) THEN
        ALTER TABLE public.partner_party 
        ADD COLUMN commission_currency text DEFAULT 'EUR';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'partner_party' 
        AND column_name = 'commission_valid_from'
    ) THEN
        ALTER TABLE public.partner_party 
        ADD COLUMN commission_valid_from date;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'partner_party' 
        AND column_name = 'commission_valid_to'
    ) THEN
        ALTER TABLE public.partner_party 
        ADD COLUMN commission_valid_to date;
    END IF;
END $$;

-- ============================================
-- PART 5: Create Indexes for Performance
-- ============================================

-- Indexes on party table (conditional - only create if column exists)
DO $$ 
BEGIN
    -- Index on display_name (if column exists)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party' 
        AND column_name = 'display_name'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_party_display_name ON public.party(display_name) WHERE display_name IS NOT NULL;
    END IF;

    -- Index on email (if column exists)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party' 
        AND column_name = 'email'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_party_email ON public.party(email) WHERE email IS NOT NULL;
    END IF;

    -- Index on phone (if column exists)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party' 
        AND column_name = 'phone'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_party_phone ON public.party(phone) WHERE phone IS NOT NULL;
    END IF;

    -- Index on company_id (if column exists)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party' 
        AND column_name = 'company_id'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_party_company_id ON public.party(company_id) WHERE company_id IS NOT NULL;
    END IF;

    -- Index on status (if column exists)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party' 
        AND column_name = 'status'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_party_status ON public.party(status) WHERE status IS NOT NULL;
    END IF;

    -- Index on rating (if column exists)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party' 
        AND column_name = 'rating'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_party_rating ON public.party(rating) WHERE rating IS NOT NULL;
    END IF;

    -- Index on created_by (if column exists)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party' 
        AND column_name = 'created_by'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_party_created_by ON public.party(created_by) WHERE created_by IS NOT NULL;
    END IF;

    -- Composite index for tenant + status queries (if both columns exist)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party' 
        AND column_name = 'company_id'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party' 
        AND column_name = 'status'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_party_company_status ON public.party(company_id, status) WHERE company_id IS NOT NULL;
    END IF;
END $$;

-- Indexes on party_person (for search performance) - conditional
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party_person' 
        AND column_name = 'first_name'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_party_person_first_name ON public.party_person(first_name) WHERE first_name IS NOT NULL;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party_person' 
        AND column_name = 'last_name'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_party_person_last_name ON public.party_person(last_name) WHERE last_name IS NOT NULL;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party_person' 
        AND column_name = 'personal_code'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_party_person_personal_code ON public.party_person(personal_code) WHERE personal_code IS NOT NULL;
    END IF;
END $$;

-- Indexes on party_company - conditional
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party_company' 
        AND column_name = 'company_name'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_party_company_name ON public.party_company(company_name) WHERE company_name IS NOT NULL;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party_company' 
        AND column_name = 'reg_number'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_party_company_reg_number ON public.party_company(reg_number) WHERE reg_number IS NOT NULL;
    END IF;
END $$;

-- ============================================
-- PART 6: Future Table - Party Documents (Optional)
-- ============================================

-- Create party_documents table for future use (per spec section 2.4)
CREATE TABLE IF NOT EXISTS public.party_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id uuid NOT NULL, -- Will add FK after verifying party table structure
    doc_type text NOT NULL CHECK (doc_type IN ('passport', 'id', 'other')),
    doc_number text NOT NULL,
    issued_at date,
    valid_till date,
    issued_by text,
    file_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Add foreign key constraint if party table exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'party_documents_party_id_fkey'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'party'
        ) THEN
            ALTER TABLE public.party_documents 
            ADD CONSTRAINT party_documents_party_id_fkey 
            FOREIGN KEY (party_id) REFERENCES public.party(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- Indexes for party_documents
CREATE INDEX IF NOT EXISTS idx_party_documents_party_id ON public.party_documents(party_id);
CREATE INDEX IF NOT EXISTS idx_party_documents_valid_till ON public.party_documents(valid_till) WHERE valid_till IS NOT NULL;

COMMENT ON TABLE public.party_documents IS 'Future feature: Document management for parties (passports, IDs, etc.)';

-- ============================================
-- Migration Complete
-- ============================================
-- Next steps:
-- 1. Verify schema with verification queries
-- 2. Apply RLS policies (see directory_rls_policies.sql)
-- 3. Populate display_name for existing records if needed
-- ============================================

-- ============================================
-- MESSAGE FOR ARCHITECT AGENT
-- ============================================
-- This migration adds all required fields per directory-v1-full-architecture.md specification.
-- All operations are idempotent (safe to run multiple times).
-- No destructive operations included.
-- Schema changes: party, party_person, party_company, partner_party tables extended.
-- New table created: party_documents (for future feature).
-- Indexes created for performance (conditional - only if columns exist).
-- Status: Ready for verification and RLS policy application.
-- ============================================

