-- ============================================
-- Fix Party Company_ID Foreign Key Constraint
-- ============================================
-- Purpose: Ensure party.company_id has FK constraint to companies(id)
-- Fixes: FK constraint error when creating party records
-- Safety: Idempotent - safe to run multiple times
-- ============================================

-- Step 1: Ensure at least one company exists
DO $$
DECLARE
    default_company_id uuid;
BEGIN
    -- Create default company if none exists
    IF NOT EXISTS (SELECT 1 FROM public.companies) THEN
        INSERT INTO public.companies (name, created_at)
        VALUES ('Default Company', NOW())
        RETURNING id INTO default_company_id;
        
        RAISE NOTICE 'Created default company: %', default_company_id;
    ELSE
        SELECT id INTO default_company_id FROM public.companies LIMIT 1;
        RAISE NOTICE 'Using existing company: %', default_company_id;
    END IF;

    -- Step 2: Fix profiles with NULL or invalid company_id
    UPDATE public.profiles
    SET company_id = default_company_id
    WHERE company_id IS NULL 
       OR NOT EXISTS (SELECT 1 FROM public.companies WHERE id = profiles.company_id);
    
    IF FOUND THEN
        RAISE NOTICE 'Updated profiles with invalid company_id';
    END IF;

    -- Step 3: Fix party records with NULL or invalid company_id (if any exist)
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' AND table_name = 'party') THEN
        UPDATE public.party
        SET company_id = default_company_id
        WHERE (company_id IS NULL 
           OR NOT EXISTS (SELECT 1 FROM public.companies WHERE id = party.company_id));
        
        IF FOUND THEN
            RAISE NOTICE 'Updated party records with invalid company_id';
        END IF;
    END IF;
END $$;

-- Step 4: Add FK constraint to party.company_id (if missing)
DO $$
BEGIN
    -- Check if FK constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = 'public' 
        AND tc.table_name = 'party'
        AND kcu.column_name = 'company_id'
        AND tc.constraint_type = 'FOREIGN KEY'
    ) THEN
        -- Check if party table and company_id column exist
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'party'
            AND column_name = 'company_id'
        ) THEN
            -- Add FK constraint
            ALTER TABLE public.party
            ADD CONSTRAINT party_company_id_fkey
            FOREIGN KEY (company_id)
            REFERENCES public.companies(id);
            
            RAISE NOTICE 'Added FK constraint: party.company_id → companies.id';
        ELSE
            RAISE NOTICE 'party.company_id column does not exist - run directory_schema_migration.sql first';
        END IF;
    ELSE
        RAISE NOTICE 'FK constraint already exists';
    END IF;
END $$;

-- Step 5: Verification
SELECT 
    'Verification' as check_type,
    (SELECT COUNT(*) FROM companies) as companies_count,
    (SELECT COUNT(*) FROM profiles WHERE company_id IS NOT NULL) as profiles_with_company_id,
    (SELECT COUNT(*) FROM profiles p 
     LEFT JOIN companies c ON c.id = p.company_id 
     WHERE c.id IS NULL) as profiles_with_invalid_company_id,
    (SELECT COUNT(*) FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
     WHERE tc.table_schema = 'public' 
     AND tc.table_name = 'party'
     AND kcu.column_name = 'company_id'
     AND tc.constraint_type = 'FOREIGN KEY') as party_has_fk_constraint;

-- ============================================
-- EXPECTED RESULTS
-- ============================================
-- companies_count: >= 1
-- profiles_with_company_id: Should match total profiles count
-- profiles_with_invalid_company_id: 0
-- party_has_fk_constraint: 1
-- ============================================

-- ============================================
-- MESSAGE FOR ARCHITECT AGENT
-- ============================================
-- This script fixes tenant isolation issues for Directory party creation.
-- Fixes: Creates default company if missing, fixes invalid company_id in profiles/party,
--        adds FK constraint to party.company_id.
-- Safe: Idempotent - can be run multiple times safely.
-- Use when: FK constraint error occurs when creating party records.
-- Run after: directory_schema_migration.sql (or together if FK constraint was missing).
-- ============================================





