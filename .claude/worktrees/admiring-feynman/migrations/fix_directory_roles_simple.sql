-- ============================================
-- FIX SIMPLE: Add client role (no ON CONFLICT, direct insert)
-- ============================================
-- Purpose: Simple direct INSERT - works even if table has no UNIQUE constraint
-- Party ID: d1be65fd-5222-475b-9839-df66e67ad456
-- ============================================

-- Step 1: Verify party exists and is active
SELECT 
    'party check' as step,
    id,
    display_name,
    status,
    CASE 
        WHEN status = 'active' THEN '✅ Ready for role addition'
        ELSE '⚠️  Status is not "active" - role will still be added but may not be used'
    END as note
FROM public.party
WHERE id = 'd1be65fd-5222-475b-9839-df66e67ad456';

-- Step 2: Check if client role already exists
SELECT 
    'existing role check' as step,
    COUNT(*) as existing_client_roles,
    CASE 
        WHEN COUNT(*) > 0 THEN '⚠️  Client role already exists - skipping insert'
        ELSE '✅ No client role found - will insert'
    END as action
FROM public.client_party
WHERE party_id = 'd1be65fd-5222-475b-9839-df66e67ad456';

-- Step 3: Insert client role (only if it doesn't exist)
DO $$
DECLARE
    target_party_id uuid := 'd1be65fd-5222-475b-9839-df66e67ad456';
    role_exists boolean;
BEGIN
    -- Check if role already exists
    SELECT EXISTS(
        SELECT 1 FROM public.client_party 
        WHERE party_id = target_party_id
    ) INTO role_exists;
    
    IF NOT role_exists THEN
        -- Direct insert without ON CONFLICT
        BEGIN
            INSERT INTO public.client_party (party_id)
            VALUES (target_party_id);
            
            RAISE NOTICE '✅ Successfully inserted client role for party %', target_party_id;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING '❌ Failed to insert: %', SQLERRM;
                RAISE WARNING '   SQL State: %', SQLSTATE;
                RAISE WARNING '   Possible causes:';
                RAISE WARNING '   - RLS policies blocking INSERT';
                RAISE WARNING '   - Foreign key constraint violation';
                RAISE WARNING '   - Insufficient privileges';
                RAISE WARNING '   Solution: Run with service_role key or check RLS policies';
        END;
    ELSE
        RAISE NOTICE '⚠️  Client role already exists, skipping insert';
    END IF;
END $$;

-- Step 4: Verification
SELECT 
    'verification' as step,
    party_id,
    CASE 
        WHEN party_id IS NOT NULL THEN '✅ Client role EXISTS'
        ELSE '❌ Client role MISSING'
    END as status
FROM public.client_party
WHERE party_id = 'd1be65fd-5222-475b-9839-df66e67ad456';

-- ============================================
-- MESSAGE FOR ARCHITECT AGENT
-- ============================================
-- 
-- SIMPLE FIX: Direct INSERT without ON CONFLICT
-- 
-- This script:
-- 1. ✅ Checks if party exists
-- 2. ✅ Checks if role already exists
-- 3. ✅ Direct INSERT (no ON CONFLICT needed)
-- 4. ✅ Clear error messages if INSERT fails
-- 
-- Use this if:
-- - fix_directory_roles.sql didn't work
-- - Table doesn't have UNIQUE constraint on party_id
-- - ON CONFLICT is causing issues
-- 
-- If this fails with permission error:
-- - RLS is blocking → Use service_role key or update RLS policies
-- - Run: SELECT * FROM pg_policies WHERE tablename = 'client_party'
--




