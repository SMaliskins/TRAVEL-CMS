-- ============================================
-- CHECK: Do partner_party and subagents tables exist?
-- ============================================
-- Purpose: Verify tables exist and show their structure
-- ============================================

-- Check if tables exist
SELECT 
    'table existence check' as check_type,
    schemaname,
    tablename,
    CASE 
        WHEN tablename IS NOT NULL THEN '✅ Table EXISTS'
        ELSE '❌ Table NOT FOUND'
    END as status
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('partner_party', 'subagents', 'client_party', 'party')
ORDER BY tablename;

-- Show all columns in partner_party (if exists)
SELECT 
    'partner_party columns' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default,
    ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'partner_party'
ORDER BY ordinal_position;

-- Show all columns in subagents (if exists)
SELECT 
    'subagents columns' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default,
    ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'subagents'
ORDER BY ordinal_position;

-- Show all columns in client_party (for comparison)
SELECT 
    'client_party columns' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default,
    ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'client_party'
ORDER BY ordinal_position;





