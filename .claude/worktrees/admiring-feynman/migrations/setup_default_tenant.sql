-- ============================================
-- Setup Default Tenant (Company + Profile) for Development
-- ============================================
-- Purpose: Complete tenant isolation setup with default company
-- Use this for: Development/staging environments
-- Safety: Idempotent - safe to run multiple times
-- ============================================

-- ============================================
-- PART 1: Create Default Company
-- ============================================

DO $$
DECLARE
    default_company_id uuid;
    default_company_name text := 'Default Company';
BEGIN
    -- Check if default company exists
    SELECT id INTO default_company_id 
    FROM public.companies 
    WHERE name = default_company_name 
    LIMIT 1;

    -- Create if doesn't exist
    IF default_company_id IS NULL THEN
        INSERT INTO public.companies (name, created_at)
        VALUES (default_company_name, NOW())
        RETURNING id INTO default_company_id;
        
        RAISE NOTICE 'Created default company: % (ID: %)', default_company_name, default_company_id;
    ELSE
        RAISE NOTICE 'Default company already exists: % (ID: %)', default_company_name, default_company_id;
    END IF;

    -- ============================================
    -- PART 2: Create Profiles for All Auth Users
    -- ============================================
    
    -- Create profiles for all users in auth.users who don't have profiles
    INSERT INTO public.profiles (user_id, company_id, role, created_at)
    SELECT 
        au.id as user_id,
        default_company_id as company_id,
        'agent' as role, -- Default to 'agent' role
        COALESCE(au.created_at, NOW()) as created_at
    FROM auth.users au
    WHERE NOT EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.user_id = au.id
    )
    ON CONFLICT (user_id) DO NOTHING; -- Idempotency: don't error if profile exists
    
    IF FOUND THEN
        RAISE NOTICE 'Created profiles for users missing them';
    ELSE
        RAISE NOTICE 'All users already have profiles';
    END IF;

    -- ============================================
    -- PART 3: Ensure All Profiles Have Valid company_id
    -- ============================================
    
    -- Fix any profiles with NULL or invalid company_id
    UPDATE public.profiles
    SET company_id = default_company_id
    WHERE company_id IS NULL 
       OR NOT EXISTS (
           SELECT 1 FROM public.companies WHERE id = profiles.company_id
       );
    
    IF FOUND THEN
        RAISE NOTICE 'Fixed profiles with missing/invalid company_id';
    END IF;

    -- ============================================
    -- PART 4: Display Summary
    -- ============================================
    
    RAISE NOTICE '=== SETUP COMPLETE ===';
    RAISE NOTICE 'Default Company ID: %', default_company_id;
    RAISE NOTICE 'Total Users: %', (SELECT COUNT(*) FROM auth.users);
    RAISE NOTICE 'Total Profiles: %', (SELECT COUNT(*) FROM profiles);
    RAISE NOTICE 'Profiles with valid company_id: %', (
        SELECT COUNT(*) FROM profiles p 
        JOIN companies c ON c.id = p.company_id
    );

END $$;

-- ============================================
-- PART 5: Final Verification
-- ============================================

SELECT 
    'Tenant setup verification' as check_type,
    (SELECT id FROM companies WHERE name = 'Default Company' LIMIT 1) as default_company_id,
    (SELECT COUNT(*) FROM companies) as total_companies,
    (SELECT COUNT(*) FROM auth.users) as total_auth_users,
    (SELECT COUNT(*) FROM profiles) as total_profiles,
    (SELECT COUNT(*) FROM auth.users au 
     LEFT JOIN profiles p ON p.user_id = au.id 
     WHERE p.user_id IS NULL) as users_without_profile,
    (SELECT COUNT(*) FROM profiles WHERE company_id IS NULL) as profiles_without_company_id,
    (SELECT COUNT(*) FROM profiles p 
     LEFT JOIN companies c ON c.id = p.company_id 
     WHERE c.id IS NULL) as profiles_with_invalid_company_id;

-- Expected: All counts should be 0 except total_companies, total_auth_users, total_profiles (should be >= 1)

-- ============================================
-- PART 6: List All Users and Their Profiles
-- ============================================

SELECT 
    au.id as user_id,
    au.email,
    CASE WHEN p.user_id IS NOT NULL THEN 'YES' ELSE 'NO' END as has_profile,
    p.company_id,
    c.name as company_name,
    p.role,
    CASE 
        WHEN p.user_id IS NULL THEN '❌ MISSING PROFILE'
        WHEN p.company_id IS NULL THEN '⚠️ MISSING company_id'
        WHEN c.id IS NULL THEN '⚠️ INVALID company_id'
        ELSE '✅ OK'
    END as status
FROM auth.users au
LEFT JOIN profiles p ON p.user_id = au.id
LEFT JOIN companies c ON c.id = p.company_id
ORDER BY au.created_at DESC;

-- ============================================
-- MESSAGE FOR ARCHITECT AGENT
-- ============================================
-- Complete tenant isolation setup for development/staging.
-- Creates: default company, profiles for all users.
-- Fixes: missing profiles, invalid company_id.
-- Safe: Idempotent with ON CONFLICT handling.
-- Use for: Initial setup, development environment bootstrap.
-- After running: All users will have profiles with valid company_id.
-- ============================================





