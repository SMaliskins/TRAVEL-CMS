-- ============================================
-- Directory Schema Verification Queries
-- ============================================
-- Purpose: Verify schema matches directory-v1-full-architecture.md specification
-- Run these queries in Supabase SQL Editor to check current state
-- ============================================

-- ============================================
-- 1. Check Party Table Structure
-- ============================================

SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default,
    ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'party'
ORDER BY ordinal_position;

-- Expected columns (per spec):
-- ✓ id (uuid, PK)
-- ✓ display_name (text)
-- ✓ party_type (enum: 'person', 'company')
-- ✓ status (enum: 'active', 'inactive', 'blocked')
-- ✓ rating (integer, CHECK 1-10)
-- ✓ notes (text)
-- ✓ company_id (uuid, FK → companies)
-- ✓ created_at (timestamptz)
-- ✓ updated_at (timestamptz)
-- ✓ created_by (uuid, FK → auth.users)
-- ✓ email (text)
-- ✓ phone (text)
-- ✓ email_marketing_consent (boolean, default false)
-- ✓ phone_marketing_consent (boolean, default false)

-- ============================================
-- 2. Check Party Person Table Structure
-- ============================================

SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default,
    ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'party_person'
ORDER BY ordinal_position;

-- Expected columns:
-- ✓ party_id (uuid, FK → party)
-- ✓ title (text) - NEW
-- ✓ first_name (text, required for person)
-- ✓ last_name (text, required for person)
-- ✓ dob (date, NOT required)
-- ✓ personal_code (text, NOT required)
-- ✓ citizenship (text)
-- ✓ address (text)

-- ============================================
-- 3. Check Party Company Table Structure
-- ============================================

SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default,
    ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'party_company'
ORDER BY ordinal_position;

-- Expected columns:
-- ✓ party_id (uuid, FK → party)
-- ✓ company_name (text, required for company)
-- ✓ reg_number (text, NOT required)
-- ✓ legal_address (text, NOT required)
-- ✓ actual_address (text)
-- ✓ bank_details (text) - NEW

-- ============================================
-- 4. Check Partner Party Table Structure (Supplier)
-- ============================================

SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default,
    ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'partner_party'
ORDER BY ordinal_position;

-- Expected columns:
-- ✓ party_id (uuid, FK → party)
-- ✓ business_category (enum: 'TO', 'Hotel', 'Rent a car', 'Airline', 'DMC', 'Other') - NEW
-- ✓ commission_type (enum: 'percent', 'fixed')
-- ✓ commission_value (numeric)
-- ✓ commission_currency (text, default 'EUR')
-- ✓ commission_valid_from (date)
-- ✓ commission_valid_to (date)
-- ✓ commission_notes (text) - NEW

-- ============================================
-- 5. Check Enum Types
-- ============================================

SELECT 
    t.typname as enum_name,
    string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as enum_values
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname IN ('party_status', 'party_type', 'business_category', 'commission_type')
GROUP BY t.typname
ORDER BY t.typname;

-- Expected enums:
-- ✓ party_status: 'active', 'inactive', 'blocked'
-- ✓ party_type: 'person', 'company'
-- ✓ business_category: 'TO', 'Hotel', 'Rent a car', 'Airline', 'DMC', 'Other'
-- ✓ commission_type: 'percent', 'fixed'

-- ============================================
-- 6. Check Indexes on Party Table
-- ============================================

SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
  AND tablename = 'party'
ORDER BY indexname;

-- Expected indexes:
-- ✓ idx_party_display_name
-- ✓ idx_party_email
-- ✓ idx_party_phone
-- ✓ idx_party_company_id
-- ✓ idx_party_status
-- ✓ idx_party_rating
-- ✓ idx_party_created_by
-- ✓ idx_party_company_status (composite)

-- ============================================
-- 7. Check RLS Status
-- ============================================

SELECT 
    tablename, 
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN 'RLS ENABLED'
        ELSE 'RLS DISABLED - NEEDS ENABLING'
    END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('party', 'party_person', 'party_company', 'client_party', 'partner_party', 'subagents', 'party_documents')
ORDER BY tablename;

-- ============================================
-- 8. Check RLS Policies
-- ============================================

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd as command,
    qual as using_expression
FROM pg_policies
WHERE tablename IN ('party', 'party_person', 'party_company', 'client_party', 'partner_party', 'subagents', 'party_documents')
ORDER BY tablename, policyname;

-- Expected policies:
-- ✓ party: SELECT, INSERT, UPDATE, DELETE (company-based)
-- ✓ party_person: ALL (company-based via party_id)
-- ✓ party_company: ALL (company-based via party_id)
-- ✓ client_party: ALL (company-based via party_id)
-- ✓ partner_party: ALL (company-based via party_id)
-- ✓ subagents: ALL (company-based via party_id)
-- ✓ party_documents: ALL (company-based via party_id)

-- ============================================
-- 9. Check Foreign Key Constraints
-- ============================================

SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('party', 'party_person', 'party_company', 'client_party', 'partner_party', 'subagents', 'party_documents')
ORDER BY tc.table_name, kcu.column_name;

-- Expected FKs:
-- ✓ party.company_id → companies.id
-- ✓ party.created_by → auth.users.id
-- ✓ party_person.party_id → party.id
-- ✓ party_company.party_id → party.id
-- ✓ client_party.party_id → party.id
-- ✓ partner_party.party_id → party.id
-- ✓ subagents.party_id → party.id
-- ✓ party_documents.party_id → party.id

-- ============================================
-- 10. Check Constraints (CHECK constraints)
-- ============================================

SELECT
    tc.table_name,
    tc.constraint_name,
    cc.check_clause
FROM information_schema.table_constraints AS tc
JOIN information_schema.check_constraints AS cc
  ON tc.constraint_name = cc.constraint_name
WHERE tc.constraint_type = 'CHECK'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('party', 'party_person', 'party_company', 'partner_party')
ORDER BY tc.table_name, tc.constraint_name;

-- Expected CHECK constraints:
-- ✓ party.rating: CHECK (rating >= 1 AND rating <= 10)
-- ✓ party_documents.doc_type: CHECK (doc_type IN ('passport', 'id', 'other'))

-- ============================================
-- 11. Summary Report Query
-- ============================================

SELECT 
    'party' as table_name,
    COUNT(*) FILTER (WHERE column_name = 'display_name') as has_display_name,
    COUNT(*) FILTER (WHERE column_name = 'rating') as has_rating,
    COUNT(*) FILTER (WHERE column_name = 'status') as has_status,
    COUNT(*) FILTER (WHERE column_name = 'company_id') as has_company_id,
    COUNT(*) FILTER (WHERE column_name = 'created_by') as has_created_by,
    COUNT(*) FILTER (WHERE column_name = 'email_marketing_consent') as has_email_consent,
    COUNT(*) FILTER (WHERE column_name = 'phone_marketing_consent') as has_phone_consent
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'party'

UNION ALL

SELECT 
    'party_person' as table_name,
    COUNT(*) FILTER (WHERE column_name = 'title') as has_title,
    0 as has_rating,
    0 as has_status,
    0 as has_company_id,
    0 as has_created_by,
    0 as has_email_consent,
    0 as has_phone_consent
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'party_person'

UNION ALL

SELECT 
    'party_company' as table_name,
    0 as has_display_name,
    0 as has_rating,
    0 as has_status,
    0 as has_company_id,
    0 as has_created_by,
    COUNT(*) FILTER (WHERE column_name = 'bank_details') as has_bank_details,
    0 as has_phone_consent
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'party_company'

UNION ALL

SELECT 
    'partner_party' as table_name,
    0 as has_display_name,
    0 as has_rating,
    0 as has_status,
    0 as has_company_id,
    0 as has_created_by,
    COUNT(*) FILTER (WHERE column_name = 'business_category') as has_business_category,
    COUNT(*) FILTER (WHERE column_name = 'commission_notes') as has_commission_notes
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'partner_party';

-- ============================================
-- Verification Complete
-- ============================================
-- Review results above and compare with specification
-- All counts should be 1 (indicating column exists)
-- ============================================





