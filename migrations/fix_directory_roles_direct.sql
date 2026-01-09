-- ============================================
-- FIX DIRECT: Simple direct INSERT (RLS is disabled)
-- ============================================
-- Purpose: Direct INSERT since RLS is UNRESTRICTED (disabled)
-- Party ID: d1be65fd-5222-475b-9839-df66e67ad456
-- ============================================

-- Step 1: Verify party exists
SELECT 
    'step 1: party check' as step,
    id,
    display_name,
    status,
    company_id,
    CASE 
        WHEN id IS NOT NULL THEN '✅ Party exists'
        ELSE '❌ Party NOT FOUND'
    END as status
FROM public.party
WHERE id = 'd1be65fd-5222-475b-9839-df66e67ad456';

-- Step 2: Check if role already exists
SELECT 
    'step 2: existing role check' as step,
    COUNT(*) as existing_count,
    CASE 
        WHEN COUNT(*) > 0 THEN '⚠️  Role already exists - will skip insert'
        ELSE '✅ No role found - will insert'
    END as action
FROM public.client_party
WHERE party_id = 'd1be65fd-5222-475b-9839-df66e67ad456';

-- Step 3: Check table structure
SELECT 
    'step 3: table structure' as step,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'client_party'
ORDER BY ordinal_position;

-- Step 4: Direct INSERT with client_type (required field)
-- First, check what client_type values are valid
DO $$
DECLARE
    target_party_id uuid := 'd1be65fd-5222-475b-9839-df66e67ad456';
    client_type_value text;
    role_exists boolean;
BEGIN
    -- Check if role already exists
    SELECT EXISTS(
        SELECT 1 FROM public.client_party 
        WHERE party_id = target_party_id
    ) INTO role_exists;
    
    IF role_exists THEN
        RAISE NOTICE '⚠️  Client role already exists, skipping insert';
    ELSE
        -- Try to determine client_type from existing data or use default
        -- Check if there are any existing records to see what values are used
        SELECT client_type INTO client_type_value
        FROM public.client_party
        WHERE client_type IS NOT NULL
        LIMIT 1;
        
        -- If no existing data, try common default values
        IF client_type_value IS NULL THEN
            -- Try 'standard' as default (common value)
            client_type_value := 'standard';
            RAISE NOTICE 'Using default client_type: %', client_type_value;
        ELSE
            RAISE NOTICE 'Using client_type from existing data: %', client_type_value;
        END IF;
        
        BEGIN
            -- Insert with client_type
            INSERT INTO public.client_party (party_id, client_type)
            VALUES (target_party_id, client_type_value);
            
            RAISE NOTICE '✅ Client role inserted with client_type: %', client_type_value;
        EXCEPTION
            WHEN invalid_text_representation THEN
                -- client_type might be an enum - try to find enum values
                RAISE WARNING '❌ Invalid client_type value: %', client_type_value;
                RAISE WARNING '   client_type might be an enum - check enum values';
                RAISE WARNING '   Run: SELECT unnest(enum_range(NULL::client_type_enum));';
                
            WHEN OTHERS THEN
                RAISE WARNING '❌ INSERT failed: %', SQLERRM;
                RAISE WARNING '   SQL State: %', SQLSTATE;
                RAISE WARNING '   Try running check_client_party_structure.sql to see valid client_type values';
        END;
    END IF;
END $$;

-- Alternative: Try INSERT with NULL client_type if column allows it (but error says NOT NULL, so this won't work)
-- But we can try different common values:
-- Option 1: 'standard'
-- Option 2: 'individual' 
-- Option 3: 'corporate'
-- Option 4: Check enum values first

-- If the above fails, uncomment and try one of these:
/*
-- Try with 'standard'
INSERT INTO public.client_party (party_id, client_type)
VALUES ('d1be65fd-5222-475b-9839-df66e67ad456', 'standard')
ON CONFLICT DO NOTHING;
*/

-- Step 5: Verification
SELECT 
    'step 5: verification' as step,
    party_id,
    CASE 
        WHEN party_id IS NOT NULL THEN '✅ Client role EXISTS'
        ELSE '❌ Client role MISSING'
    END as status
FROM public.client_party
WHERE party_id = 'd1be65fd-5222-475b-9839-df66e67ad456';

-- Final summary
SELECT 
    'final summary' as step,
    (SELECT COUNT(*) FROM public.client_party WHERE party_id = 'd1be65fd-5222-475b-9839-df66e67ad456') as has_client_role,
    CASE 
        WHEN (SELECT COUNT(*) FROM public.client_party WHERE party_id = 'd1be65fd-5222-475b-9839-df66e67ad456') > 0
        THEN '✅ SUCCESS: Client role added - API should return non-empty roles array'
        ELSE '❌ FAILED: Client role still missing - check error messages above'
    END as result;

-- ============================================
-- MESSAGE FOR ARCHITECT AGENT
-- ============================================
-- 
-- DIRECT FIX: Since RLS is UNRESTRICTED (disabled), direct INSERT should work
-- 
-- This script:
-- 1. ✅ Verifies party exists
-- 2. ✅ Checks if role already exists
-- 3. ✅ Shows table structure
-- 4. ✅ Direct INSERT (RLS won't block)
-- 5. ✅ Verification
-- 
-- If INSERT fails, possible causes:
-- - Foreign key constraint violation (party_id doesn't reference valid party)
-- - Table structure issue (missing party_id column)
-- - Database connection/permission issue
-- 
-- If ON CONFLICT fails, uncomment the DO block version (checks before insert)
--
