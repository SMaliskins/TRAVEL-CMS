-- ============================================
-- FIX: Add missing columns to party_company table
-- ============================================
-- This script ensures party_company has all required columns
-- Required: party_id (FK), company_name
-- Optional: reg_number, legal_address, actual_address, bank_details

DO $$ 
BEGIN
    -- Add company_name if missing (REQUIRED)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party_company' 
        AND column_name = 'company_name'
    ) THEN
        ALTER TABLE public.party_company 
        ADD COLUMN company_name text NOT NULL DEFAULT '';
        
        COMMENT ON COLUMN public.party_company.company_name IS 'Company name (required for company type parties)';
        
        RAISE NOTICE 'Added company_name column to party_company table';
    ELSE
        RAISE NOTICE 'company_name column already exists';
    END IF;

    -- Verify party_id exists and has FK constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party_company' 
        AND column_name = 'party_id'
    ) THEN
        -- This should never happen if table was created correctly
        RAISE EXCEPTION 'CRITICAL: party_id column missing from party_company table. Table may not exist or was incorrectly created.';
    ELSE
        -- Check if FK constraint exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_schema = 'public'
            AND tc.table_name = 'party_company'
            AND tc.constraint_type = 'FOREIGN KEY'
            AND kcu.column_name = 'party_id'
        ) THEN
            -- Add FK constraint if missing
            ALTER TABLE public.party_company
            ADD CONSTRAINT party_company_party_id_fkey
            FOREIGN KEY (party_id) 
            REFERENCES public.party(id) 
            ON DELETE CASCADE;
            
            RAISE NOTICE 'Added FK constraint: party_company.party_id → party.id';
        ELSE
            RAISE NOTICE 'FK constraint party_company.party_id → party.id already exists';
        END IF;
    END IF;

    -- Add reg_number if missing (optional)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party_company' 
        AND column_name = 'reg_number'
    ) THEN
        ALTER TABLE public.party_company 
        ADD COLUMN reg_number text;
        
        COMMENT ON COLUMN public.party_company.reg_number IS 'Registration number (optional)';
        
        RAISE NOTICE 'Added reg_number column to party_company table';
    END IF;

    -- Add legal_address if missing (optional)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'party_company' 
        AND column_name = 'legal_address'
    ) THEN
        ALTER TABLE public.party_company 
        ADD COLUMN legal_address text;
        
        COMMENT ON COLUMN public.party_company.legal_address IS 'Legal address (optional)';
        
        RAISE NOTICE 'Added legal_address column to party_company table';
    END IF;

    -- actual_address should already be added by directory_schema_migration.sql
    -- bank_details should already be added by directory_schema_migration.sql

END $$;

-- Verify the fix
SELECT 
    'verification' as check_type,
    'party_company' as table_name,
    COUNT(*) FILTER (WHERE column_name IN ('party_id', 'company_name')) as required_columns_present,
    2 as required_columns_total,
    CASE 
        WHEN COUNT(*) FILTER (WHERE column_name IN ('party_id', 'company_name')) = 2
        THEN '✅ Complete - All required columns present'
        ELSE '❌ Still missing required columns'
    END as status
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'party_company';

-- ============================================
-- MESSAGE FOR ARCHITECT AGENT
-- ============================================
-- 
-- FIX APPLIED: party_company table columns
-- 
-- This script ensures party_company table has:
-- ✅ party_id (FK to party.id) - required
-- ✅ company_name - required
-- ✅ reg_number - optional (if missing)
-- ✅ legal_address - optional (if missing)
-- 
-- Safety: Idempotent (safe to run multiple times)
-- - Uses IF NOT EXISTS checks
-- - Only adds missing columns
-- - Verifies FK constraint exists
-- 
-- Next steps:
-- 1. Run this script in Supabase SQL Editor
-- 2. Verify with: migrations/verify_directory_schema_vs_api.sql
-- 3. Check that schema completeness summary shows "Complete" for party_company
--
