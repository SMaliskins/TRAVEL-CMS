-- ============================================
-- Diagnose Missing Profile or Company_ID Issue
-- ============================================
-- Purpose: Verify user profile existence and company_id for Directory party creation
-- Run these queries to identify the exact problem
-- ============================================

-- ============================================
-- 1. CHECK PROFILES TABLE STRUCTURE
-- ============================================

SELECT 
    'profiles table structure' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default,
    ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- Expected DDL (from supabase_schema.sql):
-- CREATE TABLE profiles (
--     user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
--     company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
--     role text NOT NULL DEFAULT 'agent' CHECK (role IN ('agent', 'supervisor')),
--     initials text,
--     display_name text,
--     created_at timestamptz DEFAULT now()
-- );

-- ============================================
-- 2. CHECK COMPANIES TABLE STRUCTURE
-- ============================================

SELECT 
    'companies table structure' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default,
    ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'companies'
ORDER BY ordinal_position;

-- Expected DDL (from supabase_schema.sql):
-- CREATE TABLE companies (
--     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--     name text NOT NULL,
--     created_at timestamptz DEFAULT now()
-- );

-- ============================================
-- 3. CHECK FOREIGN KEY CONSTRAINTS
-- ============================================

SELECT
    'profiles FK constraints' as check_type,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'public'
  AND tc.table_name = 'profiles'
ORDER BY kcu.column_name;

-- Expected:
-- profiles.user_id → auth.users.id
-- profiles.company_id → companies.id

-- ============================================
-- 4. CHECK COMPANIES DATA
-- ============================================

SELECT 
    'companies data' as check_type,
    id,
    name,
    created_at,
    (SELECT COUNT(*) FROM profiles WHERE company_id = companies.id) as users_count
FROM companies
ORDER BY created_at;

-- If this returns 0 rows: No companies exist - need to create one

-- ============================================
-- 5. CHECK ALL PROFILES AND THEIR COMPANY_ID
-- ============================================

SELECT 
    'all profiles status' as check_type,
    p.user_id,
    au.email as user_email,
    p.company_id,
    c.name as company_name,
    p.role,
    CASE 
        WHEN p.company_id IS NULL THEN 'MISSING company_id'
        WHEN c.id IS NULL THEN 'INVALID company_id (company not found)'
        ELSE 'OK'
    END as status
FROM profiles p
LEFT JOIN auth.users au ON au.id = p.user_id
LEFT JOIN companies c ON c.id = p.company_id
ORDER BY p.created_at;

-- ============================================
-- 6. CHECK CURRENT AUTHENTICATED USER
-- ============================================
-- Note: Replace 'YOUR_USER_ID' with actual auth.uid() in application context
-- Or use: SELECT auth.uid() as current_user_id;

-- Get current user ID (run this in context where auth.uid() is available)
-- SELECT auth.uid() as current_user_id;

-- Check if current user has profile (replace UUID manually):
/*
SELECT 
    'current user profile check' as check_type,
    au.id as user_id,
    au.email,
    p.user_id as profile_exists,
    p.company_id,
    p.role,
    c.name as company_name,
    CASE 
        WHEN p.user_id IS NULL THEN 'NO PROFILE - NEEDS CREATION'
        WHEN p.company_id IS NULL THEN 'PROFILE EXISTS BUT NO company_id'
        WHEN c.id IS NULL THEN 'PROFILE HAS INVALID company_id'
        ELSE 'PROFILE OK'
    END as status
FROM auth.users au
LEFT JOIN profiles p ON p.user_id = au.id
LEFT JOIN companies c ON c.id = p.company_id
WHERE au.id = 'YOUR_USER_ID_HERE';
*/

-- Alternative: Check all auth users and their profile status
SELECT 
    'auth users vs profiles' as check_type,
    au.id as user_id,
    au.email,
    CASE WHEN p.user_id IS NOT NULL THEN 'YES' ELSE 'NO' END as has_profile,
    p.company_id,
    c.name as company_name,
    CASE 
        WHEN p.user_id IS NULL THEN 'MISSING PROFILE'
        WHEN p.company_id IS NULL THEN 'MISSING company_id'
        WHEN c.id IS NULL THEN 'INVALID company_id'
        ELSE 'OK'
    END as status
FROM auth.users au
LEFT JOIN profiles p ON p.user_id = au.id
LEFT JOIN companies c ON c.id = p.company_id
ORDER BY au.created_at DESC
LIMIT 10; -- Show most recent users

-- ============================================
-- 7. COUNT SUMMARY
-- ============================================

SELECT 
    'summary counts' as check_type,
    (SELECT COUNT(*) FROM auth.users) as total_auth_users,
    (SELECT COUNT(*) FROM profiles) as total_profiles,
    (SELECT COUNT(*) FROM auth.users au 
     LEFT JOIN profiles p ON p.user_id = au.id 
     WHERE p.user_id IS NULL) as users_without_profile,
    (SELECT COUNT(*) FROM profiles WHERE company_id IS NULL) as profiles_without_company_id,
    (SELECT COUNT(*) FROM profiles p 
     LEFT JOIN companies c ON c.id = p.company_id 
     WHERE c.id IS NULL) as profiles_with_invalid_company_id,
    (SELECT COUNT(*) FROM companies) as companies_count;

-- ============================================
-- 8. FIND USERS WITHOUT PROFILES
-- ============================================

SELECT 
    'users missing profiles' as check_type,
    au.id as user_id,
    au.email,
    au.created_at as user_created_at,
    'NO PROFILE' as issue
FROM auth.users au
WHERE NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.user_id = au.id
)
ORDER BY au.created_at DESC;

-- ============================================
-- 9. FIND PROFILES WITH NULL OR INVALID company_id
-- ============================================

SELECT 
    'profiles with company_id issues' as check_type,
    p.user_id,
    au.email,
    p.company_id,
    CASE 
        WHEN p.company_id IS NULL THEN 'NULL company_id'
        WHEN NOT EXISTS (SELECT 1 FROM companies WHERE id = p.company_id) THEN 'INVALID company_id'
    END as issue
FROM profiles p
LEFT JOIN auth.users au ON au.id = p.user_id
WHERE p.company_id IS NULL 
   OR NOT EXISTS (SELECT 1 FROM companies WHERE id = p.company_id);

-- ============================================
-- DIAGNOSIS SUMMARY
-- ============================================
-- 
-- Run all queries above and check:
-- 
-- 1. If companies_count = 0:
--    → No companies exist - need to create default company
--
-- 2. If users_without_profile > 0:
--    → Users exist in auth.users but no profile in profiles table
--    → Need to create profiles for these users
--
-- 3. If profiles_without_company_id > 0:
--    → Profiles exist but company_id is NULL (shouldn't happen if FK constraint is correct)
--
-- 4. If profiles_with_invalid_company_id > 0:
--    → Profiles have company_id that doesn't exist in companies table
--    → Need to fix data integrity
--
-- ============================================

-- ============================================
-- MESSAGE FOR ARCHITECT AGENT
-- ============================================
-- This diagnostic script identifies missing profiles or company_id issues.
-- Checks: table structures, FK constraints, data integrity, user-profile mapping.
-- Run all queries to get complete diagnosis.
-- Focus on: users without profiles, profiles without/invalid company_id, missing companies.
-- Use results to determine which fix script to run.
-- ============================================





