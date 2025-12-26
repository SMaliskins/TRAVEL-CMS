-- ============================================
-- CHECK: client_party table structure
-- ============================================
-- Purpose: Check columns, data types, constraints, and default values
-- ============================================

-- Check all columns in client_party
SELECT 
    'table structure' as check_type,
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
AND table_name = 'client_party'
ORDER BY ordinal_position;

-- Check constraints
SELECT 
    'constraints' as check_type,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    tc.table_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'public'
AND tc.table_name = 'client_party'
ORDER BY tc.constraint_type, kcu.column_name;

-- Check if client_type is an enum type
SELECT 
    'enum check' as check_type,
    t.typname as enum_name,
    string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as enum_values
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname LIKE '%client%type%' OR t.typname LIKE '%client_type%'
GROUP BY t.typname;

-- Check existing data in client_party (to see what values are used)
SELECT 
    'sample data' as check_type,
    party_id,
    client_type,
    COUNT(*) as count
FROM public.client_party
GROUP BY party_id, client_type
LIMIT 10;

