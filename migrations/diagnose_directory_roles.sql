-- ============================================
-- DIAGNOSTIC: Missing Role Records for Directory Party
-- ============================================
-- Purpose: Check for missing role records in client_party, partner_party, subagents tables
-- Party ID: d1be65fd-5222-475b-9839-df66e67ad456
-- ============================================

-- Set the party_id to check
DO $$
DECLARE
    target_party_id uuid := 'd1be65fd-5222-475b-9839-df66e67ad456';
BEGIN
    RAISE NOTICE 'Diagnostic check for party_id: %', target_party_id;
END $$;

-- ============================================
-- PART 1: Check if party record exists
-- ============================================

SELECT 
    'party existence check' as check_type,
    'party' as table_name,
    id,
    display_name,
    party_type,
    status,
    company_id,
    created_at,
    updated_at,
    CASE 
        WHEN id IS NOT NULL THEN '✅ Party exists'
        ELSE '❌ Party NOT FOUND'
    END as status
FROM public.party
WHERE id = 'd1be65fd-5222-475b-9839-df66e67ad456';

-- ============================================
-- PART 2: Check client_party table
-- ============================================

SELECT 
    'role check' as check_type,
    'client_party' as table_name,
    party_id,
    CASE 
        WHEN party_id IS NOT NULL THEN '✅ Client role EXISTS'
        ELSE '❌ Client role MISSING'
    END as role_status
FROM public.client_party
WHERE party_id = 'd1be65fd-5222-475b-9839-df66e67ad456';

-- ============================================
-- PART 3: Check partner_party table (supplier)
-- ============================================

-- Check partner_party with all columns (will show error if columns don't exist, which is diagnostic info)
SELECT 
    'role check' as check_type,
    'partner_party' as table_name,
    party_id,
    business_category,
    commission_type,
    commission_value,
    commission_currency,
    commission_valid_from,
    commission_valid_to,
    commission_notes,
    CASE 
        WHEN party_id IS NOT NULL THEN '✅ Supplier role EXISTS'
        ELSE '❌ Supplier role MISSING'
    END as role_status
FROM public.partner_party
WHERE party_id = 'd1be65fd-5222-475b-9839-df66e67ad456';

-- ============================================
-- PART 4: Check subagents table
-- ============================================

-- Check subagents with all columns (will show error if columns don't exist, which is diagnostic info)
SELECT 
    'role check' as check_type,
    'subagents' as table_name,
    party_id,
    commission_scheme,
    commission_tiers,
    payout_details,
    commission_type,
    commission_value,
    currency,
    is_active,
    CASE 
        WHEN party_id IS NOT NULL THEN '✅ Subagent role EXISTS'
        ELSE '❌ Subagent role MISSING'
    END as role_status
FROM public.subagents
WHERE party_id = 'd1be65fd-5222-475b-9839-df66e67ad456';

-- ============================================
-- PART 5: Summary - All Role Tables
-- ============================================

SELECT 
    'role summary' as check_type,
    'all roles' as scope,
    (SELECT COUNT(*) FROM public.client_party WHERE party_id = 'd1be65fd-5222-475b-9839-df66e67ad456') as has_client_role,
    (SELECT COUNT(*) FROM public.partner_party WHERE party_id = 'd1be65fd-5222-475b-9839-df66e67ad456') as has_supplier_role,
    (SELECT COUNT(*) FROM public.subagents WHERE party_id = 'd1be65fd-5222-475b-9839-df66e67ad456') as has_subagent_role,
    CASE 
        WHEN (SELECT COUNT(*) FROM public.client_party WHERE party_id = 'd1be65fd-5222-475b-9839-df66e67ad456') > 0
          OR (SELECT COUNT(*) FROM public.partner_party WHERE party_id = 'd1be65fd-5222-475b-9839-df66e67ad456') > 0
          OR (SELECT COUNT(*) FROM public.subagents WHERE party_id = 'd1be65fd-5222-475b-9839-df66e67ad456') > 0
        THEN '⚠️ Has roles (but may need client role)'
        ELSE '❌ NO ROLES FOUND - This causes empty roles array in API'
    END as overall_status;

-- ============================================
-- PART 6: Check DOB in party_person table
-- ============================================

SELECT 
    'dob validation' as check_type,
    'party_person' as table_name,
    party_id,
    dob,
    CASE 
        WHEN dob IS NULL THEN '✅ DOB is NULL (valid)'
        WHEN dob > CURRENT_DATE THEN '❌ DOB is in FUTURE (invalid)'
        ELSE '✅ DOB is valid (past date)'
    END as dob_status,
    CASE 
        WHEN dob > CURRENT_DATE THEN dob::text
        ELSE NULL
    END as invalid_dob_value
FROM public.party_person
WHERE party_id = 'd1be65fd-5222-475b-9839-df66e67ad456';

-- Alternative DOB check (if previous query doesn't format correctly)
SELECT 
    'dob validation (detailed)' as check_type,
    party_id,
    dob,
    CURRENT_DATE as current_date,
    (dob > CURRENT_DATE) as is_future_date,
    CASE 
        WHEN dob IS NULL THEN 'NULL - OK'
        WHEN dob > CURRENT_DATE THEN 'FUTURE DATE - NEEDS FIX'
        ELSE 'VALID'
    END as status
FROM public.party_person
WHERE party_id = 'd1be65fd-5222-475b-9839-df66e67ad456';

-- ============================================
-- MESSAGE FOR ARCHITECT AGENT
-- ============================================
-- 
-- DIAGNOSTIC COMPLETE: Missing role records check
-- 
-- This script checks:
-- 1. Party record exists in party table
-- 2. Role records in client_party, partner_party, subagents tables
-- 3. Invalid DOB (future date) in party_person table
-- 
-- Expected findings:
-- - Party should exist
-- - At least one role should exist (typically client_party)
-- - DOB should not be in the future
-- 
-- Next steps:
-- 1. Review diagnostic results
-- 2. If roles are missing, run: migrations/fix_directory_roles.sql
-- 3. If DOB is invalid, fix script will handle it
-- 
-- Safety: Read-only diagnostic queries only, no data changes.
--
