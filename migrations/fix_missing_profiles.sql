-- ============================================
-- Fix Missing Profiles and Company_ID Setup
-- ============================================
-- Purpose: Create default company and profiles for users missing profiles
-- Fixes: "User profile not found or company_id missing" error
-- Safety: Idempotent - safe to run multiple times
-- ============================================

-- ============================================
-- PART 1: Ensure Companies Exist
-- ============================================

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
        -- Use first existing company as default
        SELECT id INTO default_company_id FROM public.companies ORDER BY created_at LIMIT 1;
        RAISE NOTICE 'Using existing company: %', default_company_id;
    END IF;

    -- ============================================
    -- PART 2: Create Profiles for Users Missing Them
    -- ============================================
    
    -- Insert profiles for auth.users that don't have profiles
    INSERT INTO public.profiles (user_id, company_id, role, created_at)
    SELECT 
        au.id as user_id,
        default_company_id as company_id,
        'agent' as role, -- Default role
        COALESCE(au.created_at, NOW()) as created_at
    FROM auth.users au
    WHERE NOT EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.user_id = au.id
    );
    
    IF FOUND THEN
        RAISE NOTICE 'Created profiles for users missing them';
    ELSE
        RAISE NOTICE 'All users already have profiles';
    END IF;

    -- ============================================
    -- PART 3: Fix Profiles with NULL company_id
    -- ============================================
    
    -- This shouldn't happen if FK constraint is correct, but fix if it does
    UPDATE public.profiles
    SET company_id = default_company_id
    WHERE company_id IS NULL;
    
    IF FOUND THEN
        RAISE NOTICE 'Fixed profiles with NULL company_id';
    END IF;

    -- ============================================
    -- PART 4: Fix Profiles with Invalid company_id
    -- ============================================
    
    -- Fix profiles that reference non-existent companies
    UPDATE public.profiles
    SET company_id = default_company_id
    WHERE NOT EXISTS (
        SELECT 1 FROM public.companies WHERE id = profiles.company_id
    );
    
    IF FOUND THEN
        RAISE NOTICE 'Fixed profiles with invalid company_id';
    END IF;

END $$;

-- ============================================
-- PART 5: Verification
-- ============================================

SELECT 
    'Fix verification' as check_type,
    (SELECT COUNT(*) FROM companies) as companies_count,
    (SELECT COUNT(*) FROM profiles) as total_profiles,
    (SELECT COUNT(*) FROM auth.users au 
     LEFT JOIN profiles p ON p.user_id = au.id 
     WHERE p.user_id IS NULL) as users_still_without_profile,
    (SELECT COUNT(*) FROM profiles WHERE company_id IS NULL) as profiles_still_without_company_id,
    (SELECT COUNT(*) FROM profiles p 
     LEFT JOIN companies c ON c.id = p.company_id 
     WHERE c.id IS NULL) as profiles_still_with_invalid_company_id;

-- Expected results:
-- companies_count: >= 1
-- users_still_without_profile: 0
-- profiles_still_without_company_id: 0
-- profiles_still_with_invalid_company_id: 0

-- ============================================
-- PART 6: Show Created/Updated Profiles
-- ============================================

SELECT 
    'recent profiles' as check_type,
    p.user_id,
    au.email,
    p.company_id,
    c.name as company_name,
    p.role,
    p.created_at
FROM profiles p
LEFT JOIN auth.users au ON au.id = p.user_id
LEFT JOIN companies c ON c.id = p.company_id
ORDER BY p.created_at DESC
LIMIT 10;

-- ============================================
-- MESSAGE FOR ARCHITECT AGENT
-- ============================================
-- This script fixes missing profiles and company_id issues.
-- Creates: default company if missing, profiles for users without them.
-- Fixes: NULL company_id, invalid company_id.
-- Safe: Idempotent - can run multiple times safely.
-- Use when: API fails with "User profile not found or company_id missing".
-- After running: All users should have profiles with valid company_id.
-- ============================================

