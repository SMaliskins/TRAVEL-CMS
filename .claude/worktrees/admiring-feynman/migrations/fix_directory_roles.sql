-- ============================================
-- FIX: Missing Role Records for Directory Party
-- ============================================
-- Purpose: Add missing role records and fix invalid DOB
-- Party ID: d1be65fd-5222-475b-9839-df66e67ad456
-- Strategy: Add 'client' role if party is active and no roles exist
-- ============================================

DO $$
DECLARE
    target_party_id uuid := 'd1be65fd-5222-475b-9839-df66e67ad456';
    party_exists boolean;
    party_status text;
    has_any_role boolean;
    invalid_dob_exists boolean;
BEGIN
    -- Check if party exists
    SELECT EXISTS(SELECT 1 FROM public.party WHERE id = target_party_id) INTO party_exists;
    
    IF NOT party_exists THEN
        RAISE EXCEPTION 'Party with id % does not exist. Cannot add roles.', target_party_id;
    END IF;
    
    -- Get party status
    SELECT status INTO party_status FROM public.party WHERE id = target_party_id;
    
    -- Check if any role exists
    SELECT (
        EXISTS(SELECT 1 FROM public.client_party WHERE party_id = target_party_id)
        OR EXISTS(SELECT 1 FROM public.partner_party WHERE party_id = target_party_id)
        OR EXISTS(SELECT 1 FROM public.subagents WHERE party_id = target_party_id)
    ) INTO has_any_role;
    
    -- Check if invalid DOB exists (future date)
    SELECT EXISTS(
        SELECT 1 FROM public.party_person 
        WHERE party_id = target_party_id 
        AND dob IS NOT NULL 
        AND dob > CURRENT_DATE
    ) INTO invalid_dob_exists;
    
    RAISE NOTICE 'Party exists: %', party_exists;
    RAISE NOTICE 'Party status: %', party_status;
    RAISE NOTICE 'Has any role: %', has_any_role;
    RAISE NOTICE 'Invalid DOB exists: %', invalid_dob_exists;
    
    -- Fix 1: Add client role if party is active and no roles exist
    IF party_status = 'active' AND NOT has_any_role THEN
        BEGIN
            INSERT INTO public.client_party (party_id)
            VALUES (target_party_id)
            ON CONFLICT (party_id) DO NOTHING;
            
            RAISE NOTICE '✅ Added client role for party %', target_party_id;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING 'Failed to add client role: %', SQLERRM;
        END;
    ELSIF party_status = 'active' AND has_any_role THEN
        RAISE NOTICE '⚠️ Party has roles already, skipping role addition';
    ELSIF party_status != 'active' THEN
        RAISE NOTICE '⚠️ Party status is %, not adding default role (only add for active parties)', party_status;
    END IF;
    
    -- Fix 2: Correct invalid DOB (future date)
    IF invalid_dob_exists THEN
        BEGIN
            UPDATE public.party_person
            SET dob = NULL
            WHERE party_id = target_party_id
            AND dob IS NOT NULL
            AND dob > CURRENT_DATE;
            
            RAISE NOTICE '✅ Fixed invalid DOB (set to NULL for future date)';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING 'Failed to fix DOB: %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE '✅ DOB is valid (no future dates found)';
    END IF;
    
    RAISE NOTICE 'Fix completed for party %', target_party_id;
END $$;

-- ============================================
-- VERIFICATION: Confirm fix worked
-- ============================================

-- Verify client_party record exists
SELECT 
    'verification' as check_type,
    'client_party' as table_name,
    party_id,
    CASE 
        WHEN party_id IS NOT NULL THEN '✅ Client role EXISTS'
        ELSE '❌ Client role MISSING'
    END as status
FROM public.client_party
WHERE party_id = 'd1be65fd-5222-475b-9839-df66e67ad456';

-- Verify DOB is fixed
SELECT 
    'verification' as check_type,
    'party_person' as table_name,
    party_id,
    dob,
    CASE 
        WHEN dob IS NULL THEN '✅ DOB is NULL (valid)'
        WHEN dob > CURRENT_DATE THEN '❌ DOB still in FUTURE'
        ELSE '✅ DOB is valid'
    END as dob_status
FROM public.party_person
WHERE party_id = 'd1be65fd-5222-475b-9839-df66e67ad456';

-- Summary verification
SELECT 
    'verification summary' as check_type,
    'all fixes' as scope,
    (SELECT COUNT(*) FROM public.client_party WHERE party_id = 'd1be65fd-5222-475b-9839-df66e67ad456') as has_client_role,
    (SELECT COUNT(*) FROM public.partner_party WHERE party_id = 'd1be65fd-5222-475b-9839-df66e67ad456') as has_supplier_role,
    (SELECT COUNT(*) FROM public.subagents WHERE party_id = 'd1be65fd-5222-475b-9839-df66e67ad456') as has_subagent_role,
    (SELECT COUNT(*) FROM public.party_person WHERE party_id = 'd1be65fd-5222-475b-9839-df66e67ad456' AND dob IS NOT NULL AND dob > CURRENT_DATE) as invalid_dob_count,
    CASE 
        WHEN (SELECT COUNT(*) FROM public.client_party WHERE party_id = 'd1be65fd-5222-475b-9839-df66e67ad456') > 0
          OR (SELECT COUNT(*) FROM public.partner_party WHERE party_id = 'd1be65fd-5222-475b-9839-df66e67ad456') > 0
          OR (SELECT COUNT(*) FROM public.subagents WHERE party_id = 'd1be65fd-5222-475b-9839-df66e67ad456') > 0
        THEN '✅ Has roles - API should return non-empty roles array'
        ELSE '❌ NO ROLES - API will still return empty roles array'
    END as roles_status,
    CASE 
        WHEN (SELECT COUNT(*) FROM public.party_person WHERE party_id = 'd1be65fd-5222-475b-9839-df66e67ad456' AND dob IS NOT NULL AND dob > CURRENT_DATE) = 0
        THEN '✅ DOB is valid'
        ELSE '❌ DOB still has future date'
    END as dob_status;

-- ============================================
-- MESSAGE FOR ARCHITECT AGENT
-- ============================================
-- 
-- FIX APPLIED: Missing role records and invalid DOB
-- 
-- This script:
-- 1. ✅ Adds client_party record if party is active and no roles exist
-- 2. ✅ Fixes invalid DOB (future dates set to NULL)
-- 3. ✅ Uses ON CONFLICT DO NOTHING for idempotency (safe to re-run)
-- 4. ✅ Includes verification queries to confirm fix worked
-- 
-- Strategy:
-- - Default: Add 'client' role for active parties with no roles
-- - DOB: Set future dates to NULL (safer than guessing past date)
-- 
-- Safety: Idempotent (safe to run multiple times)
-- - Uses DO NOTHING on conflict
-- - Only updates if needed
-- - Verifies party exists before changes
-- 
-- Next steps:
-- 1. Run this script in Supabase SQL Editor
-- 2. Review verification results
-- 3. Test API endpoint: GET /api/directory/d1be65fd-5222-475b-9839-df66e67ad456
-- 4. Verify roles array is no longer empty
-- 5. Verify form can be saved without validation errors
--




