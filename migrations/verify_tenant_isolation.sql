-- ============================================
-- Tenant Isolation Verification for Directory
-- ============================================
-- Purpose: Verify schema and data for party.company_id FK constraint
-- Run these queries to diagnose company_id foreign key issues
-- ============================================

-- ============================================
-- 1. CHECK TABLES EXIST
-- ============================================

SELECT 
    'Tables existence check' as check_type,
    COUNT(*) FILTER (WHERE tablename = 'companies') as companies_exists,
    COUNT(*) FILTER (WHERE tablename = 'profiles') as profiles_exists,
    COUNT(*) FILTER (WHERE tablename = 'party') as party_exists
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('companies', 'profiles', 'party');

-- ============================================
-- 2. COMPANIES TABLE STRUCTURE
-- ============================================

SELECT 
    'companies table structure' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'companies'
ORDER BY ordinal_position;

-- Expected:
-- id (uuid, PK)
-- name (text, NOT NULL)
-- created_at (timestamptz)

-- ============================================
-- 3. PROFILES TABLE STRUCTURE
-- ============================================

SELECT 
    'profiles table structure' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- Expected:
-- user_id (uuid, PK, FK → auth.users)
-- company_id (uuid, NOT NULL, FK → companies)
-- role (text)
-- initials (text)
-- display_name (text)
-- created_at (timestamptz)

-- ============================================
-- 4. PARTY TABLE STRUCTURE
-- ============================================

SELECT 
    'party table structure' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'party'
ORDER BY ordinal_position;

-- Expected:
-- company_id (uuid, nullable or NOT NULL, FK → companies)

-- ============================================
-- 5. CHECK FOREIGN KEY CONSTRAINTS
-- ============================================

SELECT
    'Foreign key constraints' as check_type,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name,
    CASE 
        WHEN rc.delete_rule = 'RESTRICT' THEN 'RESTRICT'
        WHEN rc.delete_rule = 'CASCADE' THEN 'CASCADE'
        ELSE rc.delete_rule
    END as delete_rule
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
LEFT JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'public'
  AND (
    (tc.table_name = 'profiles' AND kcu.column_name = 'company_id')
    OR (tc.table_name = 'party' AND kcu.column_name = 'company_id')
    OR (tc.table_name = 'profiles' AND kcu.column_name = 'user_id')
  )
ORDER BY tc.table_name, kcu.column_name;

-- Expected:
-- profiles.company_id → companies.id
-- profiles.user_id → auth.users.id
-- party.company_id → companies.id (if migration was applied)

-- ============================================
-- 6. CHECK IF PARTY.COMPANY_ID FK EXISTS
-- ============================================

SELECT 
    'party.company_id FK check' as check_type,
    COUNT(*) as fk_constraint_exists
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'party'
  AND kcu.column_name = 'company_id'
  AND ccu.table_name = 'companies'
  AND ccu.column_name = 'id';

-- Expected: 1 (if FK exists)

-- ============================================
-- 7. CHECK CURRENT USER PROFILE AND COMPANY_ID
-- ============================================
-- Replace 'YOUR_USER_ID' with actual auth.uid() or current user ID
-- ============================================

-- Option A: Check specific user (replace UUID)
/*
SELECT 
    'User profile check' as check_type,
    p.user_id,
    p.company_id,
    p.role,
    c.id as company_exists,
    c.name as company_name
FROM profiles p
LEFT JOIN companies c ON c.id = p.company_id
WHERE p.user_id = 'YOUR_USER_ID_HERE';
*/

-- Option B: Check all profiles and their companies
SELECT 
    'All profiles check' as check_type,
    p.user_id,
    p.company_id,
    p.role,
    CASE 
        WHEN c.id IS NULL THEN 'MISSING COMPANY'
        ELSE 'COMPANY EXISTS'
    END as company_status,
    c.name as company_name
FROM profiles p
LEFT JOIN companies c ON c.id = p.company_id
ORDER BY p.user_id;

-- Expected: All profiles should have valid company_id that exists in companies table

-- ============================================
-- 8. CHECK COMPANIES DATA
-- ============================================

SELECT 
    'Companies data' as check_type,
    id,
    name,
    created_at,
    (SELECT COUNT(*) FROM profiles WHERE company_id = companies.id) as users_count
FROM companies
ORDER BY created_at;

-- ============================================
-- 9. CHECK PARTY TABLE COMPANY_ID VALUES
-- ============================================

SELECT 
    'Party company_id validation' as check_type,
    COUNT(*) as total_party_records,
    COUNT(company_id) as records_with_company_id,
    COUNT(*) - COUNT(company_id) as records_without_company_id,
    COUNT(*) FILTER (WHERE company_id NOT IN (SELECT id FROM companies)) as invalid_company_ids
FROM party;

-- ============================================
-- 10. DETAILED INVALID COMPANY_ID CHECK
-- ============================================

SELECT 
    'Invalid company_id in party' as check_type,
    p.id as party_id,
    p.display_name,
    p.company_id,
    CASE 
        WHEN p.company_id IS NULL THEN 'NULL company_id'
        WHEN NOT EXISTS (SELECT 1 FROM companies WHERE id = p.company_id) THEN 'Company does not exist'
        ELSE 'Valid'
    END as issue
FROM party p
WHERE p.company_id IS NULL 
   OR NOT EXISTS (SELECT 1 FROM companies WHERE id = p.company_id);

-- ============================================
-- 11. CHECK PROFILES WITHOUT COMPANY_ID
-- ============================================

SELECT 
    'Profiles without company_id' as check_type,
    user_id,
    role,
    company_id
FROM profiles
WHERE company_id IS NULL;

-- Expected: 0 rows (company_id is NOT NULL in schema)

-- ============================================
-- DIAGNOSIS SUMMARY
-- ============================================

SELECT 
    'Diagnosis Summary' as check_type,
    (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND tablename = 'companies') as companies_table_exists,
    (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') as profiles_table_exists,
    (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND tablename = 'party') as party_table_exists,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_schema = 'public' AND table_name = 'party' AND column_name = 'company_id') as party_has_company_id,
    (SELECT COUNT(*) FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
     WHERE tc.table_schema = 'public' AND tc.table_name = 'party' 
     AND kcu.column_name = 'company_id' AND tc.constraint_type = 'FOREIGN KEY') as party_has_company_id_fk,
    (SELECT COUNT(*) FROM companies) as companies_count,
    (SELECT COUNT(*) FROM profiles) as profiles_count,
    (SELECT COUNT(*) FROM profiles WHERE company_id IS NULL) as profiles_without_company_id,
    (SELECT COUNT(*) FROM profiles p 
     LEFT JOIN companies c ON c.id = p.company_id 
     WHERE c.id IS NULL) as profiles_with_invalid_company_id;

-- ============================================
-- RECOMMENDATIONS
-- ============================================
-- 
-- If party_has_company_id_fk = 0:
--   → Run directory_schema_migration.sql to add FK constraint
--
-- If profiles_without_company_id > 0:
--   → Profiles missing company_id - need to update profiles table
--
-- If profiles_with_invalid_company_id > 0:
--   → Profiles have company_id that doesn't exist in companies table
--   → Need to fix data or create missing companies
--
-- If companies_count = 0:
--   → No companies exist - need to create at least one company
--   → Then assign users to companies via profiles table
--
-- ============================================

-- ============================================
-- MESSAGE FOR ARCHITECT AGENT
-- ============================================
-- This verification script diagnoses tenant isolation issues for Directory party creation.
-- Checks: table existence, FK constraints, data integrity, user profiles.
-- Run all queries to get complete diagnosis picture.
-- Focus on: FK constraint existence, valid company_id in profiles, companies data.
-- If FK missing: run directory_schema_migration.sql.
-- If data missing: need to create companies and update profiles.
-- ============================================





