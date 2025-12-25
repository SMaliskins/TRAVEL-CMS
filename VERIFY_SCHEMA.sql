-- ============================================
-- Schema Verification Queries
-- Run these in Supabase SQL Editor to verify schema matches code expectations
-- ============================================

-- 1. Check all columns in orders table
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default,
    ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'orders'
ORDER BY ordinal_position;

-- 2. Check for critical column name mismatches
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_schema = 'public' 
                     AND table_name = 'orders' 
                     AND column_name = 'order_code') 
        THEN '✓ order_code exists (DB schema)'
        ELSE '✗ order_code MISSING'
    END as order_code_check,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_schema = 'public' 
                     AND table_name = 'orders' 
                     AND column_name = 'order_number') 
        THEN '✓ order_number exists (code expectation)'
        ELSE '✗ order_number MISSING'
    END as order_number_check,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_schema = 'public' 
                     AND table_name = 'orders' 
                     AND column_name = 'owner_user_id') 
        THEN '✓ owner_user_id exists (DB schema)'
        ELSE '✗ owner_user_id MISSING'
    END as owner_user_id_check,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_schema = 'public' 
                     AND table_name = 'orders' 
                     AND column_name = 'manager_user_id') 
        THEN '✓ manager_user_id exists (code expectation)'
        ELSE '✗ manager_user_id MISSING'
    END as manager_user_id_check,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_schema = 'public' 
                     AND table_name = 'orders' 
                     AND column_name = 'date_from') 
        THEN '✓ date_from exists (DB schema)'
        ELSE '✗ date_from MISSING'
    END as date_from_check,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_schema = 'public' 
                     AND table_name = 'orders' 
                     AND column_name = 'check_in_date') 
        THEN '✓ check_in_date exists (code expectation)'
        ELSE '✗ check_in_date MISSING'
    END as check_in_date_check,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_schema = 'public' 
                     AND table_name = 'orders' 
                     AND column_name = 'countries_cities') 
        THEN '✓ countries_cities exists (DB schema)'
        ELSE '✗ countries_cities MISSING'
    END as countries_cities_check,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_schema = 'public' 
                     AND table_name = 'orders' 
                     AND column_name = 'client_party_id') 
        THEN '✓ client_party_id exists'
        ELSE '✗ client_party_id MISSING - NEEDS MIGRATION'
    END as client_party_id_check;

-- 3. Check for new migration columns
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_schema = 'public' 
                     AND table_name = 'orders' 
                     AND column_name = 'order_payment_status') 
        THEN '✓ order_payment_status exists'
        ELSE '✗ order_payment_status MISSING - Run migration'
    END as order_payment_status_check,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_schema = 'public' 
                     AND table_name = 'orders' 
                     AND column_name = 'all_services_invoiced') 
        THEN '✓ all_services_invoiced exists'
        ELSE '✗ all_services_invoiced MISSING - Run migration'
    END as all_services_invoiced_check,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_schema = 'public' 
                     AND table_name = 'orders' 
                     AND column_name = 'client_payment_due_date') 
        THEN '✓ client_payment_due_date exists'
        ELSE '✗ client_payment_due_date MISSING - Run migration'
    END as client_payment_due_date_check,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_schema = 'public' 
                     AND table_name = 'orders' 
                     AND column_name = 'order_date') 
        THEN '✓ order_date exists'
        ELSE '✗ order_date MISSING - Run migration'
    END as order_date_check;

-- 4. Check RLS status
SELECT 
    tablename, 
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN 'RLS is ENABLED - Policies needed'
        ELSE 'RLS is DISABLED - Less secure'
    END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'orders';

-- 5. List existing RLS policies (if RLS is enabled)
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd as command,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'orders'
ORDER BY policyname;

-- 6. Check if get_table_columns function exists (for column discovery)
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public'
            AND p.proname = 'get_table_columns'
        )
        THEN '✓ get_table_columns function exists'
        ELSE '✗ get_table_columns function MISSING - Run create_get_table_columns_function.sql'
    END as function_check;

-- 7. Test column discovery (if function exists)
-- Uncomment to test:
-- SELECT get_table_columns('orders');

-- ============================================
-- Expected Results:
-- ============================================
-- If schema matches base schema:
--   - order_code: ✓
--   - owner_user_id: ✓
--   - date_from: ✓
--   - date_to: ✓
--   - countries_cities: ✓
--   - order_number: ✗ (code expects this, but DB has order_code)
--   - manager_user_id: ✗ (code expects this, but DB has owner_user_id)
--   - check_in_date: ✗ (code expects this, but DB has date_from)
--   - client_party_id: ✗ (may not exist - needs verification)
--
-- The code has been updated to handle these mismatches dynamically.
-- ============================================

