-- ============================================
-- CHECK: Do Directory role tables exist?
-- ============================================
-- Purpose: Verify if client_party, partner_party, and subagents tables exist in database
-- This is critical - if tables don't exist, all INSERT operations will fail
-- ============================================

-- Check if client_party table exists
SELECT 
    'table_exists_check' as check_type,
    'client_party' as table_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'client_party'
        ) THEN '✅ EXISTS'
        ELSE '❌ DOES NOT EXIST'
    END as status;

-- Check if partner_party table exists
SELECT 
    'table_exists_check' as check_type,
    'partner_party' as table_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'partner_party'
        ) THEN '✅ EXISTS'
        ELSE '❌ DOES NOT EXIST'
    END as status;

-- Check if subagents table exists
SELECT 
    'table_exists_check' as check_type,
    'subagents' as table_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'subagents'
        ) THEN '✅ EXISTS'
        ELSE '❌ DOES NOT EXIST'
    END as status;

-- Summary: List all three tables
SELECT 
    'summary' as check_type,
    table_name,
    CASE 
        WHEN table_name IN ('client_party', 'partner_party', 'subagents') THEN '✅ REQUIRED TABLE'
        ELSE 'ℹ️  Other table'
    END as table_status
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('client_party', 'partner_party', 'subagents')
ORDER BY table_name;

-- If tables don't exist, show what tables DO exist (to help with debugging)
SELECT 
    'existing_tables_in_public' as check_type,
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE '%party%' OR table_name LIKE '%agent%' OR table_name LIKE '%client%'
ORDER BY table_name;

-- ============================================
-- MESSAGE FOR ARCHITECT AGENT
-- ============================================
-- 
-- CRITICAL CHECK: Verify role tables exist
-- 
-- If any table shows "❌ DOES NOT EXIST":
-- - That explains why INSERT operations fail!
-- - Need to create missing tables before fixing columns
-- - Check directory_schema_migration.sql for table definitions
-- 
-- Expected tables:
-- - client_party (for Client role)
-- - partner_party (for Supplier role)
-- - subagents (for Subagent role)
-- 
-- If tables are missing:
-- 1. Check migrations/directory_schema_migration.sql
-- 2. Create migration to add missing tables
-- 3. Ensure all required columns are included
--
