-- ============================================
-- CHECK: RLS Status for Role Tables
-- ============================================
-- Purpose: Check if RLS is enabled and what policies exist
-- This explains "UNRESTRICTED" vs "RESTRICTED" labels in Supabase Table Editor
-- ============================================

-- Check RLS status for role tables
SELECT 
    'RLS status' as check_type,
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity = true THEN 'RESTRICTED (RLS enabled - requires policies)'
        WHEN rowsecurity = false THEN 'UNRESTRICTED (RLS disabled - all access allowed)'
        ELSE 'UNKNOWN'
    END as rls_status_meaning
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('client_party', 'partner_party', 'subagents', 'party', 'party_person', 'party_company')
ORDER BY tablename;

-- Check existing policies for role tables
SELECT 
    'RLS policies' as check_type,
    schemaname,
    tablename,
    policyname,
    permissive,  -- PERMISSIVE or RESTRICTIVE
    roles,       -- Who the policy applies to (e.g., authenticated users)
    cmd,         -- Command: SELECT, INSERT, UPDATE, DELETE, or ALL
    qual,        -- Using expression (for SELECT, UPDATE, DELETE)
    with_check   -- With check expression (for INSERT, UPDATE)
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('client_party', 'partner_party', 'subagents')
ORDER BY tablename, policyname;

-- Check if client_party has any policies
SELECT 
    'policy count' as check_type,
    tablename,
    COUNT(*) as policy_count,
    CASE 
        WHEN COUNT(*) = 0 THEN '⚠️  NO POLICIES - If RLS is enabled, ALL operations are BLOCKED'
        ELSE '✅ Has policies'
    END as status
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('client_party', 'partner_party', 'subagents')
GROUP BY tablename
ORDER BY tablename;

-- ============================================
-- DETAILED ANALYSIS
-- ============================================

-- For client_party specifically
SELECT 
    'client_party analysis' as check_type,
    (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'client_party') as rls_enabled,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'client_party') as policy_count,
    CASE 
        WHEN (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'client_party') = false
        THEN '✅ RLS disabled (UNRESTRICTED) - INSERT should work'
        WHEN (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'client_party') = true
             AND (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'client_party' AND cmd IN ('INSERT', 'ALL')) = 0
        THEN '❌ RLS enabled but NO INSERT policies - INSERT is BLOCKED'
        WHEN (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'client_party') = true
             AND (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'client_party' AND cmd IN ('INSERT', 'ALL')) > 0
        THEN '⚠️  RLS enabled with INSERT policies - check if policies allow your INSERT'
        ELSE 'UNKNOWN'
    END as insert_status;

-- ============================================
-- RECOMMENDATION
-- ============================================

SELECT 
    'recommendation' as check_type,
    CASE 
        WHEN (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'client_party') = false
        THEN 'RLS is disabled (UNRESTRICTED) - INSERT should work. Problem might be elsewhere (FK constraint, table structure, etc.)'
        WHEN (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'client_party') = true
             AND (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'client_party' AND cmd IN ('INSERT', 'ALL')) = 0
        THEN 'RLS is enabled but NO INSERT policies - INSERT is BLOCKED. Solution: Either disable RLS or add INSERT policy, or run with service_role key'
        WHEN (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'client_party') = true
             AND (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'client_party' AND cmd IN ('INSERT', 'ALL')) > 0
        THEN 'RLS is enabled with INSERT policies - Check if policies allow INSERT for your user. May need to run with service_role key or update policies'
        ELSE 'Cannot determine - check results above'
    END as recommendation;

-- ============================================
-- MESSAGE FOR ARCHITECT AGENT
-- ============================================
-- 
-- RLS STATUS CHECK: Understanding UNRESTRICTED vs RESTRICTED
-- 
-- In Supabase Table Editor:
-- - "UNRESTRICTED" = RLS disabled (ALTER TABLE ... DISABLE ROW LEVEL SECURITY)
--   → All operations allowed (no restrictions)
--   → INSERT should work without policies
-- 
-- - "RESTRICTED" = RLS enabled (ALTER TABLE ... ENABLE ROW LEVEL SECURITY)
--   → Operations require policies to allow them
--   → If no INSERT policy exists → INSERT is BLOCKED
--   → Need policies or service_role key to bypass
-- 
-- This script checks:
-- 1. RLS status (enabled/disabled) for role tables
-- 2. Existing policies for INSERT operations
-- 3. Whether INSERT can work based on current RLS setup
-- 
-- If client_party shows "UNRESTRICTED":
-- - RLS is disabled → INSERT should work
-- - Problem might be: FK constraint, table structure, or other error
-- 
-- If client_party shows "RESTRICTED" but no INSERT policies:
-- - RLS is enabled → INSERT is BLOCKED
-- - Solution: Add INSERT policy OR use service_role key OR disable RLS temporarily
-- 
-- Next steps based on results:
-- 1. If UNRESTRICTED → Run debug script to find other issues
-- 2. If RESTRICTED + no policies → Add INSERT policy or use service_role
-- 3. If RESTRICTED + has policies → Check if policies allow your operation
--




