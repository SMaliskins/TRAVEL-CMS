-- ============================================
-- DEBUG: Why fix_directory_roles.sql didn't add roles
-- ============================================
-- Purpose: Investigate why role wasn't added after running fix script
-- Party ID: d1be65fd-5222-475b-9839-df66e67ad456
-- ============================================

DO $$
DECLARE
    target_party_id uuid := 'd1be65fd-5222-475b-9839-df66e67ad456';
    party_exists boolean;
    party_status text;
    party_display_name text;
    has_any_role boolean;
    client_party_count integer;
    table_has_pk boolean;
    pk_constraint_name text;
BEGIN
    RAISE NOTICE '=== DEBUG: Investigating why fix script didn''t add roles ===';
    RAISE NOTICE '';
    
    -- Check 1: Does party exist?
    SELECT EXISTS(SELECT 1 FROM public.party WHERE id = target_party_id) INTO party_exists;
    IF party_exists THEN
        SELECT status, display_name INTO party_status, party_display_name 
        FROM public.party WHERE id = target_party_id;
        RAISE NOTICE '✅ Party exists:';
        RAISE NOTICE '   - Display name: %', party_display_name;
        RAISE NOTICE '   - Status: %', party_status;
    ELSE
        RAISE NOTICE '❌ Party does NOT exist!';
        RETURN;
    END IF;
    
    RAISE NOTICE '';
    
    -- Check 2: Does party have any roles?
    SELECT (
        EXISTS(SELECT 1 FROM public.client_party WHERE party_id = target_party_id)
        OR EXISTS(SELECT 1 FROM public.partner_party WHERE party_id = target_party_id)
        OR EXISTS(SELECT 1 FROM public.subagents WHERE party_id = target_party_id)
    ) INTO has_any_role;
    
    SELECT COUNT(*) INTO client_party_count 
    FROM public.client_party 
    WHERE party_id = target_party_id;
    
    RAISE NOTICE 'Current role status:';
    RAISE NOTICE '   - Has any role: %', has_any_role;
    RAISE NOTICE '   - client_party count: %', client_party_count;
    RAISE NOTICE '   - partner_party count: %', (SELECT COUNT(*) FROM public.partner_party WHERE party_id = target_party_id);
    RAISE NOTICE '   - subagents count: %', (SELECT COUNT(*) FROM public.subagents WHERE party_id = target_party_id);
    
    RAISE NOTICE '';
    
    -- Check 3: Why would fix script skip adding role?
    RAISE NOTICE 'Fix script logic check:';
    IF party_status != 'active' THEN
        RAISE NOTICE '⚠️  Party status is "%" (not "active")', party_status;
        RAISE NOTICE '   → Fix script only adds roles for active parties';
    ELSE
        RAISE NOTICE '✅ Party status is "active" (condition met)';
    END IF;
    
    IF has_any_role THEN
        RAISE NOTICE '⚠️  Party already has roles';
        RAISE NOTICE '   → Fix script skips adding default role if roles exist';
    ELSE
        RAISE NOTICE '✅ Party has NO roles (condition met for adding default role)';
    END IF;
    
    RAISE NOTICE '';
    
    -- Check 4: Table structure (does client_party have PK constraint?)
    SELECT EXISTS(
        SELECT 1 FROM information_schema.table_constraints tc
        WHERE tc.table_schema = 'public'
        AND tc.table_name = 'client_party'
        AND tc.constraint_type = 'PRIMARY KEY'
    ) INTO table_has_pk;
    
    SELECT constraint_name INTO pk_constraint_name
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
    AND table_name = 'client_party'
    AND constraint_type = 'PRIMARY KEY'
    LIMIT 1;
    
    RAISE NOTICE 'Table structure check:';
    RAISE NOTICE '   - client_party has PK: %', table_has_pk;
    IF table_has_pk THEN
        RAISE NOTICE '   - PK constraint name: %', pk_constraint_name;
    END IF;
    
    RAISE NOTICE '';
    
    -- Check 5: Try to insert manually (will show actual error)
    IF party_status = 'active' AND NOT has_any_role THEN
        RAISE NOTICE 'Attempting manual INSERT to see actual error...';
        BEGIN
            INSERT INTO public.client_party (party_id)
            VALUES (target_party_id);
            RAISE NOTICE '✅ Manual INSERT succeeded!';
            
            -- Rollback for debugging
            RAISE EXCEPTION 'Manual insert succeeded - rolling back for debugging';
        EXCEPTION
            WHEN unique_violation THEN
                RAISE NOTICE '❌ UNIQUE constraint violation (record might already exist?)';
            WHEN foreign_key_violation THEN
                RAISE NOTICE '❌ FOREIGN KEY violation (party_id doesn''t reference valid party?)';
            WHEN not_null_violation THEN
                RAISE NOTICE '❌ NOT NULL violation (party_id column requires non-null value?)';
            WHEN OTHERS THEN
                RAISE NOTICE '❌ INSERT failed with error: %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE 'Skipping manual INSERT (conditions not met)';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== DEBUG COMPLETE ===';
END $$;

-- ============================================
-- PART 2: Check RLS policies (might block INSERT)
-- ============================================

SELECT 
    'RLS check' as check_type,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'client_party';

-- ============================================
-- PART 3: Check if we can see the table structure
-- ============================================

SELECT 
    'table structure' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'client_party'
ORDER BY ordinal_position;

-- ============================================
-- PART 4: Try direct INSERT (if running as superuser/service_role)
-- ============================================

-- Uncomment to try direct insert (will only work with proper permissions)
/*
DO $$
DECLARE
    target_party_id uuid := 'd1be65fd-5222-475b-9839-df66e67ad456';
BEGIN
    INSERT INTO public.client_party (party_id)
    VALUES (target_party_id)
    ON CONFLICT (party_id) DO NOTHING;
    
    RAISE NOTICE 'Direct INSERT executed';
END $$;
*/

-- ============================================
-- MESSAGE FOR ARCHITECT AGENT
-- ============================================
-- 
-- DEBUG SCRIPT: Investigate why fix_directory_roles.sql didn't add roles
-- 
-- This script checks:
-- 1. Party existence and status
-- 2. Current role counts
-- 3. Fix script logic conditions
-- 4. Table structure (PK constraints)
-- 5. RLS policies (might block INSERT)
-- 6. Attempts manual INSERT to see actual error
-- 
-- Common issues:
-- - Party status is not 'active' → fix script skips
-- - RLS policies block INSERT → need service_role or update policies
-- - Missing PK constraint on client_party → ON CONFLICT won't work
-- - Foreign key violation → party_id doesn't reference valid party
-- 
-- Next steps after running this:
-- 1. Review debug output to identify the issue
-- 2. If RLS is blocking, run fix script with service_role key
-- 3. If PK is missing, create it first
-- 4. If party status is wrong, update it or adjust fix script logic
--




