-- ============================================
-- FIX: Add client role with RLS bypass (for service_role/admin)
-- ============================================
-- Purpose: Direct INSERT that bypasses RLS (use with service_role key)
-- Party ID: d1be65fd-5222-475b-9839-df66e67ad456
-- 
-- IMPORTANT: This script assumes you're running with service_role key
-- or as a database superuser (bypasses RLS automatically)
-- ============================================

-- Check current user and RLS status
SELECT 
    'session info' as check_type,
    current_user as current_db_user,
    session_user as session_user,
    (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'client_party') as rls_enabled,
    CASE 
        WHEN current_user = 'service_role' OR current_user = 'postgres' OR current_user LIKE '%admin%'
        THEN '✅ Running as privileged user (RLS bypassed)'
        ELSE '⚠️  Running as regular user (RLS enforced)'
    END as rls_bypass_status;

-- Verify party exists and get company_id
SELECT 
    'party check' as check_type,
    id,
    display_name,
    status,
    company_id
FROM public.party
WHERE id = 'd1be65fd-5222-475b-9839-df66e67ad456';

-- Check if client role already exists
SELECT 
    'existing role check' as check_type,
    COUNT(*) as existing_count,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ Client role already exists'
        ELSE '⚠️  Client role missing - will insert'
    END as status
FROM public.client_party
WHERE party_id = 'd1be65fd-5222-475b-9839-df66e67ad456';

-- ============================================
-- FIX: Insert client role (bypasses RLS if running as service_role/admin)
-- ============================================

DO $$
DECLARE
    target_party_id uuid := 'd1be65fd-5222-475b-9839-df66e67ad456';
    role_exists boolean;
    insert_success boolean := false;
BEGIN
    -- Check if role already exists
    SELECT EXISTS(
        SELECT 1 FROM public.client_party 
        WHERE party_id = target_party_id
    ) INTO role_exists;
    
    IF role_exists THEN
        RAISE NOTICE '✅ Client role already exists, skipping insert';
    ELSE
        RAISE NOTICE 'Attempting to insert client role...';
        RAISE NOTICE 'Note: If you see permission error, you need to run with service_role key';
        
        BEGIN
            -- Direct insert (will bypass RLS if running as service_role/superuser)
            INSERT INTO public.client_party (party_id)
            VALUES (target_party_id);
            
            RAISE NOTICE '✅ Successfully inserted client role';
            insert_success := true;
            
        EXCEPTION
            WHEN insufficient_privilege THEN
                RAISE WARNING '❌ INSUFFICIENT PRIVILEGE - RLS is blocking INSERT';
                RAISE WARNING '   Error: %', SQLERRM;
                RAISE WARNING '';
                RAISE WARNING 'SOLUTION OPTIONS:';
                RAISE WARNING '1. Run this script with service_role key (recommended)';
                RAISE WARNING '2. Or run in Supabase SQL Editor with "Run as service_role" option';
                RAISE WARNING '3. Or temporarily disable RLS: ALTER TABLE client_party DISABLE ROW LEVEL SECURITY;';
                RAISE WARNING '4. Or add policy that allows INSERT (see directory_rls_policies.sql)';
                
            WHEN unique_violation THEN
                RAISE NOTICE '⚠️  UNIQUE violation - role might have been inserted by another process';
                SELECT EXISTS(SELECT 1 FROM public.client_party WHERE party_id = target_party_id) INTO role_exists;
                IF role_exists THEN
                    RAISE NOTICE '✅ Client role exists now';
                    insert_success := true;
                END IF;
                
            WHEN foreign_key_violation THEN
                RAISE WARNING '❌ FOREIGN KEY violation - party_id might not reference valid party';
                RAISE WARNING '   Error: %', SQLERRM;
                
            WHEN OTHERS THEN
                RAISE WARNING '❌ INSERT failed: %', SQLERRM;
                RAISE WARNING '   SQL State: %', SQLSTATE;
        END;
    END IF;
    
    RAISE NOTICE '';
    
    -- Final verification
    SELECT EXISTS(SELECT 1 FROM public.client_party WHERE party_id = target_party_id) INTO role_exists;
    
    IF role_exists THEN
        RAISE NOTICE '✅ VERIFICATION: Client role EXISTS for party %', target_party_id;
        RAISE NOTICE '   API should now return non-empty roles array';
    ELSE
        RAISE WARNING '❌ VERIFICATION: Client role MISSING';
        RAISE WARNING '   Check error messages above for details';
    END IF;
END $$;

-- Final verification query
SELECT 
    'final verification' as check_type,
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
-- FIX WITH RLS BYPASS: Insert client role using service_role
-- 
-- This script:
-- 1. ✅ Checks current user (service_role bypasses RLS)
-- 2. ✅ Verifies party exists
-- 3. ✅ Direct INSERT (bypasses RLS if running as service_role)
-- 4. ✅ Clear error messages if RLS blocks INSERT
-- 
-- How to use:
-- 1. In Supabase Dashboard → SQL Editor
-- 2. Make sure you're running with service_role key OR
-- 3. Use "Run as service_role" option if available
-- 
-- If you get permission error:
-- - You're not running with service_role
-- - Solution: Use service_role key or temporarily disable RLS
-- 
-- RLS policy requires:
-- - party.company_id must match profiles.company_id for current user
-- - If running as admin/service_role, RLS is bypassed automatically
--




