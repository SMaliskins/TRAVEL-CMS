-- ============================================
-- SIMPLE CHECK: Do partner_party and subagents tables exist?
-- ============================================

-- Check table existence
SELECT 
    tablename,
    CASE 
        WHEN tablename IS NOT NULL THEN '✅ EXISTS'
        ELSE '❌ NOT FOUND'
    END as status
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('partner_party', 'subagents', 'client_party', 'party')
ORDER BY tablename;

-- If tables don't exist, the column queries won't return results
-- This is why you only see client_party results

