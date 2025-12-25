-- ============================================
-- DIAGNOSE: party_company table columns
-- ============================================
-- This script checks what columns actually exist in party_company table
-- Expected required columns: party_id, company_name

-- Check all columns in party_company table
SELECT 
    'actual columns' as check_type,
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default,
    CASE 
        WHEN column_name = 'party_id' THEN '✅ REQUIRED - FK to party.id'
        WHEN column_name = 'company_name' THEN '✅ REQUIRED - Company name'
        WHEN column_name = 'reg_number' THEN 'ℹ️ OPTIONAL - Registration number'
        WHEN column_name = 'legal_address' THEN 'ℹ️ OPTIONAL - Legal address'
        WHEN column_name = 'actual_address' THEN 'ℹ️ OPTIONAL - Physical address'
        WHEN column_name = 'bank_details' THEN 'ℹ️ OPTIONAL - Bank account info'
        ELSE '⚠️ UNEXPECTED COLUMN'
    END as column_status
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'party_company'
ORDER BY ordinal_position;

-- Check which required columns are missing
SELECT 
    'missing columns check' as check_type,
    'party_company' as table_name,
    CASE 
        WHEN NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'party_company' 
            AND column_name = 'party_id'
        ) THEN '❌ MISSING: party_id'
        ELSE '✅ party_id exists'
    END as party_id_status,
    CASE 
        WHEN NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'party_company' 
            AND column_name = 'company_name'
        ) THEN '❌ MISSING: company_name'
        ELSE '✅ company_name exists'
    END as company_name_status;

-- Check table structure (DDL preview)
SELECT 
    'table structure' as check_type,
    'party_company' as table_name,
    COUNT(*) as total_columns,
    COUNT(*) FILTER (WHERE column_name IN ('party_id', 'company_name')) as required_columns_count,
    CASE 
        WHEN COUNT(*) FILTER (WHERE column_name IN ('party_id', 'company_name')) = 2
        THEN '✅ All required columns present'
        ELSE '❌ Missing required columns'
    END as status;

-- ============================================
-- MESSAGE FOR ARCHITECT AGENT
-- ============================================
-- 
-- DIAGNOSTIC COMPLETE: party_company table schema check
-- 
-- This script identifies which columns exist in party_company table.
-- Expected required: party_id, company_name
-- 
-- Next steps:
-- 1. Run this diagnostic in Supabase SQL Editor
-- 2. Review results to see which columns are missing
-- 3. If company_name is missing, run fix_party_company_columns.sql
-- 
-- Safety: Read-only diagnostic queries only, no data changes.
--
