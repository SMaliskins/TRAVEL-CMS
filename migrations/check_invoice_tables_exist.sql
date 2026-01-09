-- ============================================
-- QUICK CHECK: Do invoice tables exist?
-- ============================================
-- Purpose: Verify if invoices and invoice_items tables are created
-- ============================================

-- Check if tables exist
SELECT 
    tablename,
    CASE 
        WHEN tablename IS NOT NULL THEN '✅ EXISTS'
        ELSE '❌ NOT FOUND'
    END as status
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('invoices', 'invoice_items')
ORDER BY tablename;

-- If you see 0 rows or only 1 row, the migration was NOT run!
-- Expected result: 2 rows (invoices ✅ EXISTS, invoice_items ✅ EXISTS)

-- ============================================
-- If tables DON'T exist, run this migration:
-- ============================================
-- File: migrations/rollback_and_create_invoices.sql
-- Location: Copy entire file content into Supabase SQL Editor and RUN
-- ============================================
