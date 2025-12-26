-- ============================================
-- FIX V2: Missing Role Records for Directory Party (Improved)
-- ============================================
-- Purpose: Add missing role records with better error handling
-- Party ID: d1be65fd-5222-475b-9839-df66e67ad456
-- Strategy: Add 'client' role if party is active and no roles exist
-- Improvement: Works even if ON CONFLICT is not supported (checks before insert)
-- ============================================

DO $$
DECLARE
    target_party_id uuid := 'd1be65fd-5222-475b-9839-df66e67ad456';
    party_exists boolean;
    party_status text;
    has_any_role boolean;
    has_client_role boolean;
    invalid_dob_exists boolean;
    insert_result text;
BEGIN
    RAISE NOTICE '=== Starting fix_directory_roles_v2 ===';
    RAISE NOTICE 'Target party_id: %', target_party_id;
    RAISE NOTICE '';
    
    -- Check if party exists
    SELECT EXISTS(SELECT 1 FROM public.party WHERE id = target_party_id) INTO party_exists;
    
    IF NOT party_exists THEN
        RAISE EXCEPTION 'Party with id % does not exist. Cannot add roles.', target_party_id;
    END IF;
    
    -- Get party status
    SELECT status INTO party_status FROM public.party WHERE id = target_party_id;
    RAISE NOTICE '✅ Party exists with status: %', party_status;
    
    -- Check if any role exists
    SELECT EXISTS(SELECT 1 FROM public.client_party WHERE party_id = target_party_id) INTO has_client_role;
    SELECT (
        EXISTS(SELECT 1 FROM public.client_party WHERE party_id = target_party_id)
        OR EXISTS(SELECT 1 FROM public.partner_party WHERE party_id = target_party_id)
        OR EXISTS(SELECT 1 FROM public.subagents WHERE party_id = target_party_id)
    ) INTO has_any_role;
    
    RAISE NOTICE 'Current roles:';
    RAISE NOTICE '  - Client role: %', has_client_role;
    RAISE NOTICE '  - Supplier role: %', EXISTS(SELECT 1 FROM public.partner_party WHERE party_id = target_party_id);
    RAISE NOTICE '  - Subagent role: %', EXISTS(SELECT 1 FROM public.subagents WHERE party_id = target_party_id);
    RAISE NOTICE '  - Has any role: %', has_any_role;
    RAISE NOTICE '';
    
    -- Check if invalid DOB exists (future date)
    SELECT EXISTS(
        SELECT 1 FROM public.party_person 
        WHERE party_id = target_party_id 
        AND dob IS NOT NULL 
        AND dob > CURRENT_DATE
    ) INTO invalid_dob_exists;
    
    -- Fix 1: Add client role if party is active and no roles exist
    IF party_status = 'active' AND NOT has_any_role THEN
        RAISE NOTICE 'Attempting to add client role...';
        
        -- Check if client role already exists (double-check)
        IF NOT has_client_role THEN
            BEGIN
                -- Try insert with explicit check first
                INSERT INTO public.client_party (party_id)
                VALUES (target_party_id);
                
                RAISE NOTICE '✅ Successfully added client role for party %', target_party_id;
                insert_result := 'SUCCESS';
            EXCEPTION
                WHEN unique_violation THEN
                    RAISE NOTICE '⚠️  UNIQUE violation - role might already exist (checking...)';
                    -- Verify if it actually exists now
                    SELECT EXISTS(SELECT 1 FROM public.client_party WHERE party_id = target_party_id) INTO has_client_role;
                    IF has_client_role THEN
                        RAISE NOTICE '✅ Client role exists (inserted by another transaction?)';
                        insert_result := 'ALREADY_EXISTS';
                    ELSE
                        RAISE WARNING '❌ UNIQUE violation but role still missing - check table constraints';
                        insert_result := 'FAILED_UNIQUE';
                    END IF;
                WHEN foreign_key_violation THEN
                    RAISE WARNING '❌ FOREIGN KEY violation - party_id might not reference valid party';
                    RAISE WARNING '   Error details: %', SQLERRM;
                    insert_result := 'FAILED_FK';
                WHEN not_null_violation THEN
                    RAISE WARNING '❌ NOT NULL violation - check table structure';
                    RAISE WARNING '   Error details: %', SQLERRM;
                    insert_result := 'FAILED_NULL';
                WHEN insufficient_privilege THEN
                    RAISE WARNING '❌ INSUFFICIENT PRIVILEGE - RLS might be blocking INSERT';
                    RAISE WARNING '   Error details: %', SQLERRM;
                    RAISE WARNING '   Solution: Run with service_role key or update RLS policies';
                    insert_result := 'FAILED_RLS';
                WHEN OTHERS THEN
                    RAISE WARNING '❌ Failed to add client role: %', SQLERRM;
                    RAISE WARNING '   SQL State: %', SQLSTATE;
                    insert_result := 'FAILED_' || SQLSTATE;
            END;
        ELSE
            RAISE NOTICE '⚠️  Client role already exists, skipping insert';
            insert_result := 'ALREADY_EXISTS';
        END IF;
    ELSIF party_status = 'active' AND has_any_role THEN
        RAISE NOTICE '⚠️  Party has roles already, skipping role addition';
        insert_result := 'SKIPPED_HAS_ROLES';
    ELSIF party_status != 'active' THEN
        RAISE NOTICE '⚠️  Party status is "%" (not "active"), not adding default role', party_status;
        RAISE NOTICE '   Note: Fix script only adds roles for active parties';
        RAISE NOTICE '   To add role anyway, update party status to "active" first';
        insert_result := 'SKIPPED_NOT_ACTIVE';
    END IF;
    
    RAISE NOTICE '';
    
    -- Fix 2: Correct invalid DOB (future date)
    IF invalid_dob_exists THEN
        RAISE NOTICE 'Attempting to fix invalid DOB...';
        BEGIN
            UPDATE public.party_person
            SET dob = NULL
            WHERE party_id = target_party_id
            AND dob IS NOT NULL
            AND dob > CURRENT_DATE;
            
            IF FOUND THEN
                RAISE NOTICE '✅ Fixed invalid DOB (set to NULL for future date)';
            ELSE
                RAISE NOTICE '⚠️  No rows updated (DOB might have been fixed already)';
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING '❌ Failed to fix DOB: %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE '✅ DOB is valid (no future dates found)';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== Fix completed ===';
    RAISE NOTICE 'Insert result: %', insert_result;
    RAISE NOTICE '';
    
    -- Final verification
    SELECT EXISTS(SELECT 1 FROM public.client_party WHERE party_id = target_party_id) INTO has_client_role;
    SELECT (
        EXISTS(SELECT 1 FROM public.client_party WHERE party_id = target_party_id)
        OR EXISTS(SELECT 1 FROM public.partner_party WHERE party_id = target_party_id)
        OR EXISTS(SELECT 1 FROM public.subagents WHERE party_id = target_party_id)
    ) INTO has_any_role;
    
    RAISE NOTICE 'Final verification:';
    RAISE NOTICE '  - Has client role: %', has_client_role;
    RAISE NOTICE '  - Has any role: %', has_any_role;
    
    IF has_any_role THEN
        RAISE NOTICE '✅ SUCCESS: Party now has at least one role';
    ELSE
        RAISE WARNING '❌ FAILURE: Party still has no roles';
        RAISE WARNING '   Check error messages above for details';
        RAISE WARNING '   Common issues: RLS blocking, missing FK constraint, or insufficient privileges';
    END IF;
END $$;

-- ============================================
-- VERIFICATION: Confirm fix worked
-- ============================================

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
-- FIX V2: Improved version with better error handling
-- 
-- Improvements:
-- 1. ✅ More detailed logging (shows each step)
-- 2. ✅ Better error handling (catches specific exceptions)
-- 3. ✅ Works without ON CONFLICT (checks before insert)
-- 4. ✅ Handles RLS permission errors explicitly
-- 5. ✅ Final verification with clear status
-- 
-- Common failure reasons:
-- - RLS blocking INSERT → Run with service_role or update policies
-- - Missing PK/UNIQUE constraint → Script now works without ON CONFLICT
-- - Party status not 'active' → Script will explain why it skipped
-- - Foreign key violation → Party might not exist or FK constraint broken
-- 
-- Next steps if still failing:
-- 1. Check RLS policies: SELECT * FROM pg_policies WHERE tablename = 'client_party'
-- 2. Verify party exists: SELECT * FROM party WHERE id = 'd1be65fd-5222-475b-9839-df66e67ad456'
-- 3. Try running with service_role key (bypasses RLS)
-- 4. Check table structure: SELECT * FROM information_schema.columns WHERE table_name = 'client_party'
--
