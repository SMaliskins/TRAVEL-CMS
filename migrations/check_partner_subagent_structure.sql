-- ============================================
-- CHECK: partner_party and subagents table structure
-- ============================================
-- Purpose: Check columns, data types, constraints, and required fields
-- Verifies if API INSERT statements include all required fields
-- Files: app/api/directory/[id]/route.ts (lines 269-298)
--        app/api/directory/create/route.ts (lines 192-234)
-- ============================================

-- Check partner_party table structure
SELECT 
    'partner_party structure' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default,
    CASE 
        WHEN is_nullable = 'NO' AND column_default IS NULL THEN '⚠️  REQUIRED (no default)'
        WHEN is_nullable = 'NO' AND column_default IS NOT NULL THEN '✅ REQUIRED (has default)'
        WHEN is_nullable = 'YES' THEN 'ℹ️  OPTIONAL'
        ELSE 'UNKNOWN'
    END as column_status
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'partner_party'
ORDER BY ordinal_position;

-- Check subagents table structure
SELECT 
    'subagents structure' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default,
    CASE 
        WHEN is_nullable = 'NO' AND column_default IS NULL THEN '⚠️  REQUIRED (no default)'
        WHEN is_nullable = 'NO' AND column_default IS NOT NULL THEN '✅ REQUIRED (has default)'
        WHEN is_nullable = 'YES' THEN 'ℹ️  OPTIONAL'
        ELSE 'UNKNOWN'
    END as column_status
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'subagents'
ORDER BY ordinal_position;

-- Check constraints
SELECT 
    'constraints' as check_type,
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'public'
AND tc.table_name IN ('partner_party', 'subagents')
ORDER BY tc.table_name, tc.constraint_type, kcu.column_name;

-- Check for enum types that might be used
SELECT 
    'enum types check' as check_type,
    t.typname as enum_name,
    string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as enum_values,
    CASE 
        WHEN t.typname LIKE '%partner%' OR t.typname LIKE '%supplier%' OR t.typname LIKE '%commission%' OR t.typname LIKE '%business%'
        THEN '⚠️  Possible enum for partner_party/subagents tables'
        ELSE 'ℹ️  Other enum'
    END as relevance
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname LIKE '%partner%' 
   OR t.typname LIKE '%supplier%'
   OR t.typname LIKE '%commission%'
   OR t.typname LIKE '%business%'
   OR t.typname LIKE '%subagent%'
   OR t.typname LIKE '%payout%'
GROUP BY t.typname
ORDER BY t.typname;

-- Check sample data with all column values (to understand required fields usage)
SELECT 
    'sample partner_party data (detailed)' as check_type,
    party_id,
    business_category,
    commission_type,
    commission_value,
    commission_currency,
    commission_valid_from,
    commission_valid_to,
    commission_notes,
    created_at,
    updated_at
FROM public.partner_party
LIMIT 5;

-- Check subagents sample data (show all existing columns)
-- Note: API code references commission_scheme, commission_tiers, payout_details
-- but these columns might not exist in the table yet
SELECT 
    'sample subagents data (all columns)' as check_type,
    *
FROM public.subagents
LIMIT 5;

-- Summary: Required fields that might be missing from API INSERT
-- Partner Party Analysis
SELECT 
    'API INSERT analysis' as check_type,
    'partner_party' as table_name,
    column_name,
    CASE 
        WHEN is_nullable = 'NO' AND column_default IS NULL THEN '⚠️  REQUIRED - Check if API provides this'
        WHEN is_nullable = 'NO' AND column_default IS NOT NULL THEN '✅ Has default - OK if missing'
        WHEN is_nullable = 'YES' THEN 'ℹ️  Optional - OK if missing'
        ELSE 'UNKNOWN'
    END as api_insert_status,
    CASE 
        WHEN column_name = 'party_id' THEN '✅ API provides (required FK)'
        WHEN column_name IN ('created_at', 'updated_at') THEN 'ℹ️  Usually auto-set by DB'
        WHEN is_nullable = 'NO' AND column_default IS NULL AND column_name != 'party_id' THEN '❌ API might be missing this required field'
        ELSE '✅ OK'
    END as recommendation
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'partner_party'
ORDER BY ordinal_position;

-- Subagents Analysis
SELECT 
    'API INSERT analysis' as check_type,
    'subagents' as table_name,
    column_name,
    CASE 
        WHEN is_nullable = 'NO' AND column_default IS NULL THEN '⚠️  REQUIRED - Check if API provides this'
        WHEN is_nullable = 'NO' AND column_default IS NOT NULL THEN '✅ Has default - OK if missing'
        WHEN is_nullable = 'YES' THEN 'ℹ️  Optional - OK if missing'
        ELSE 'UNKNOWN'
    END as api_insert_status,
    CASE 
        WHEN column_name = 'party_id' THEN '✅ API provides (required FK)'
        WHEN column_name IN ('created_at', 'updated_at') THEN 'ℹ️  Usually auto-set by DB'
        WHEN is_nullable = 'NO' AND column_default IS NULL AND column_name != 'party_id' THEN '❌ API might be missing this required field'
        ELSE '✅ OK'
    END as recommendation
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'subagents'
ORDER BY ordinal_position;

-- ============================================
-- MESSAGE FOR ARCHITECT AGENT
-- ============================================
-- 
-- DIAGNOSTIC COMPLETE: partner_party and subagents structure check
-- 
-- This script verifies:
-- 1. ✅ Table structure (columns, data types, nullability)
-- 2. ✅ Required fields (NOT NULL without default)
-- 3. ✅ Constraints (FK, PK, etc.)
-- 4. ✅ Enum types that might be used
-- 5. ✅ Sample data to understand typical values
-- 6. ✅ API INSERT analysis (compares with actual API code)
-- 
-- API Code Locations:
-- - app/api/directory/[id]/route.ts lines 269-298 (UPDATE endpoint)
-- - app/api/directory/create/route.ts lines 192-234 (CREATE endpoint)
-- 
-- Current API INSERT statements:
-- - partner_party: Inserts { party_id, ...optional fields from supplier_details }
-- - subagents: Inserts { party_id, ...optional fields from subagent_details }
-- 
-- Review the "API INSERT analysis" results to identify:
-- - Any required fields (NOT NULL, no default) that API is missing
-- - Fields that should be added to INSERT statements
-- - Recommended values or logic for required fields
-- 
-- If required fields are found:
-- 1. Update API code to include required fields in INSERT
-- 2. Determine appropriate values (from sample data or enum types)
-- 3. Add logic to determine values if they depend on other data
-- 
-- Next steps after running this script:
-- 1. Review "API INSERT analysis" section for any ❌ warnings
-- 2. Check sample data to see what values are typically used
-- 3. If required fields missing, update API code accordingly
-- 4. Test INSERT operations to verify no constraint violations
--

