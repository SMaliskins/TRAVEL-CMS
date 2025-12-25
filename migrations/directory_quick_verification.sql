-- ============================================
-- Quick Verification - Directory Schema Migration
-- ============================================
-- Run this after executing directory_schema_migration.sql
-- This gives you a quick overview of migration status
-- ============================================

-- Quick Check: Required Columns in Party Table
SELECT 
    'party table columns' as check_type,
    COUNT(*) FILTER (WHERE column_name = 'display_name') as has_display_name,
    COUNT(*) FILTER (WHERE column_name = 'rating') as has_rating,
    COUNT(*) FILTER (WHERE column_name = 'status') as has_status,
    COUNT(*) FILTER (WHERE column_name = 'company_id') as has_company_id,
    COUNT(*) FILTER (WHERE column_name = 'created_by') as has_created_by,
    COUNT(*) FILTER (WHERE column_name = 'email') as has_email,
    COUNT(*) FILTER (WHERE column_name = 'phone') as has_phone,
    COUNT(*) FILTER (WHERE column_name = 'email_marketing_consent') as has_email_consent,
    COUNT(*) FILTER (WHERE column_name = 'phone_marketing_consent') as has_phone_consent,
    COUNT(*) FILTER (WHERE column_name = 'notes') as has_notes
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'party';

-- Quick Check: Party Person Table
SELECT 
    'party_person table columns' as check_type,
    COUNT(*) FILTER (WHERE column_name = 'title') as has_title,
    COUNT(*) FILTER (WHERE column_name = 'citizenship') as has_citizenship,
    COUNT(*) FILTER (WHERE column_name = 'address') as has_address
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'party_person';

-- Quick Check: Party Company Table
SELECT 
    'party_company table columns' as check_type,
    COUNT(*) FILTER (WHERE column_name = 'bank_details') as has_bank_details,
    COUNT(*) FILTER (WHERE column_name = 'actual_address') as has_actual_address
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'party_company';

-- Quick Check: Partner Party Table
SELECT 
    'partner_party table columns' as check_type,
    COUNT(*) FILTER (WHERE column_name = 'business_category') as has_business_category,
    COUNT(*) FILTER (WHERE column_name = 'commission_notes') as has_commission_notes
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'partner_party';

-- Quick Check: Enum Types
SELECT 
    'enum types' as check_type,
    COUNT(*) FILTER (WHERE typname = 'party_status') as has_party_status,
    COUNT(*) FILTER (WHERE typname = 'party_type') as has_party_type,
    COUNT(*) FILTER (WHERE typname = 'business_category') as has_business_category,
    COUNT(*) FILTER (WHERE typname = 'commission_type') as has_commission_type
FROM pg_type
WHERE typname IN ('party_status', 'party_type', 'business_category', 'commission_type');

-- Quick Check: Key Indexes
SELECT 
    'indexes' as check_type,
    COUNT(*) FILTER (WHERE indexname = 'idx_party_display_name') as has_idx_display_name,
    COUNT(*) FILTER (WHERE indexname = 'idx_party_email') as has_idx_email,
    COUNT(*) FILTER (WHERE indexname = 'idx_party_phone') as has_idx_phone,
    COUNT(*) FILTER (WHERE indexname = 'idx_party_company_id') as has_idx_company_id,
    COUNT(*) FILTER (WHERE indexname = 'idx_party_status') as has_idx_status,
    COUNT(*) FILTER (WHERE indexname = 'idx_party_rating') as has_idx_rating
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'party';

-- Quick Check: RLS Status
SELECT 
    'RLS status' as check_type,
    COUNT(*) FILTER (WHERE tablename = 'party' AND rowsecurity = true) as party_rls_enabled,
    COUNT(*) FILTER (WHERE tablename = 'party_person' AND rowsecurity = true) as party_person_rls_enabled,
    COUNT(*) FILTER (WHERE tablename = 'party_company' AND rowsecurity = true) as party_company_rls_enabled,
    COUNT(*) FILTER (WHERE tablename = 'client_party' AND rowsecurity = true) as client_party_rls_enabled,
    COUNT(*) FILTER (WHERE tablename = 'partner_party' AND rowsecurity = true) as partner_party_rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('party', 'party_person', 'party_company', 'client_party', 'partner_party', 'subagents', 'party_documents');

-- Quick Check: RLS Policies
SELECT 
    'RLS policies' as check_type,
    COUNT(*) FILTER (WHERE tablename = 'party') as party_policies_count,
    COUNT(*) FILTER (WHERE tablename = 'party_person') as party_person_policies_count,
    COUNT(*) FILTER (WHERE tablename = 'party_company') as party_company_policies_count
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('party', 'party_person', 'party_company', 'client_party', 'partner_party', 'subagents', 'party_documents');

-- ============================================
-- INTERPRETATION
-- ============================================
-- All counts should be 1 (or greater for policies)
-- If any count is 0, that item is missing and needs attention
-- ============================================

-- ============================================
-- MESSAGE FOR ARCHITECT AGENT
-- ============================================
-- Quick verification script for directory schema migration status.
-- Run after directory_schema_migration.sql to verify all columns, enums, indexes, and RLS are in place.
-- Expected: All counts = 1 (or >= 1 for policies).
-- If any count is 0, that component failed to migrate and needs investigation.
-- Use directory_schema_verification.sql for detailed verification.
-- ============================================

