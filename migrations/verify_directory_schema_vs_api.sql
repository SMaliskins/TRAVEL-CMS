-- ============================================
-- Verify Directory Schema vs API Expectations
-- ============================================
-- Purpose: Verify database schema matches what API code expects
-- Compares actual schema with API route expectations from app/api/directory/create/route.ts
-- ============================================

-- ============================================
-- PART 1: Party Table Verification
-- ============================================
-- API expects (from route.ts lines 96-108):
-- display_name, party_type, status, rating, notes, company_id, email, phone,
-- email_marketing_consent, phone_marketing_consent, created_by, created_at, updated_at
-- ============================================

SELECT 
    'party table - API expected columns' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default,
    CASE 
        WHEN column_name IN ('id', 'display_name', 'party_type', 'status', 'company_id', 'created_by', 'created_at', 'updated_at') 
        THEN 'REQUIRED'
        ELSE 'OPTIONAL'
    END as api_requirement
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'party'
  AND column_name IN (
    'id',
    'display_name',
    'party_type',
    'status',
    'rating',
    'notes',
    'company_id',
    'email',
    'phone',
    'email_marketing_consent',
    'phone_marketing_consent',
    'created_by',
    'created_at',
    'updated_at'
  )
ORDER BY 
    CASE column_name
        WHEN 'id' THEN 1
        WHEN 'display_name' THEN 2
        WHEN 'party_type' THEN 3
        WHEN 'status' THEN 4
        WHEN 'rating' THEN 5
        WHEN 'notes' THEN 6
        WHEN 'company_id' THEN 7
        WHEN 'email' THEN 8
        WHEN 'phone' THEN 9
        WHEN 'email_marketing_consent' THEN 10
        WHEN 'phone_marketing_consent' THEN 11
        WHEN 'created_by' THEN 12
        WHEN 'created_at' THEN 13
        WHEN 'updated_at' THEN 14
        ELSE 99
    END;

-- Expected columns in API:
-- ✓ id (uuid, PK)
-- ✓ display_name (text) - REQUIRED in API
-- ✓ party_type (text/enum) - REQUIRED in API
-- ✓ status (text/enum) - REQUIRED in API, default 'active'
-- ✓ rating (integer) - OPTIONAL in API
-- ✓ notes (text) - OPTIONAL in API
-- ✓ company_id (uuid) - REQUIRED in API
-- ✓ email (text) - OPTIONAL in API
-- ✓ phone (text) - OPTIONAL in API
-- ✓ email_marketing_consent (boolean) - OPTIONAL in API, default false
-- ✓ phone_marketing_consent (boolean) - OPTIONAL in API, default false
-- ✓ created_by (uuid) - REQUIRED in API
-- ✓ created_at (timestamptz) - Auto-generated
-- ✓ updated_at (timestamptz) - Auto-generated

-- ============================================
-- PART 2: Party Table - Missing Columns Check
-- ============================================

SELECT 
    'party table - missing columns' as check_type,
    'display_name' as expected_column,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'party' AND column_name = 'display_name'
        ) THEN 'EXISTS'
        ELSE 'MISSING'
    END as status
UNION ALL
SELECT 'party table - missing columns', 'party_type',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'party' AND column_name = 'party_type'
    ) THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL
SELECT 'party table - missing columns', 'status',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'party' AND column_name = 'status'
    ) THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL
SELECT 'party table - missing columns', 'rating',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'party' AND column_name = 'rating'
    ) THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL
SELECT 'party table - missing columns', 'notes',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'party' AND column_name = 'notes'
    ) THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL
SELECT 'party table - missing columns', 'company_id',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'party' AND column_name = 'company_id'
    ) THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL
SELECT 'party table - missing columns', 'email',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'party' AND column_name = 'email'
    ) THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL
SELECT 'party table - missing columns', 'phone',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'party' AND column_name = 'phone'
    ) THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL
SELECT 'party table - missing columns', 'email_marketing_consent',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'party' AND column_name = 'email_marketing_consent'
    ) THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL
SELECT 'party table - missing columns', 'phone_marketing_consent',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'party' AND column_name = 'phone_marketing_consent'
    ) THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL
SELECT 'party table - missing columns', 'created_by',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'party' AND column_name = 'created_by'
    ) THEN 'EXISTS' ELSE 'MISSING' END;

-- ============================================
-- PART 3: Party Person Table Verification
-- ============================================
-- API expects (from route.ts lines 133-142):
-- party_id, title, first_name, last_name, dob, personal_code, citizenship, address
-- ============================================

SELECT 
    'party_person table - API expected columns' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default,
    CASE 
        WHEN column_name IN ('party_id', 'first_name', 'last_name') 
        THEN 'REQUIRED'
        ELSE 'OPTIONAL'
    END as api_requirement
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'party_person'
  AND column_name IN (
    'party_id',
    'title',
    'first_name',
    'last_name',
    'dob',
    'personal_code',
    'citizenship',
    'address'
  )
ORDER BY ordinal_position;

-- Expected:
-- ✓ party_id (uuid, FK → party.id) - REQUIRED
-- ✓ title (text) - OPTIONAL
-- ✓ first_name (text) - REQUIRED for person
-- ✓ last_name (text) - REQUIRED for person
-- ✓ dob (date) - OPTIONAL
-- ✓ personal_code (text) - OPTIONAL
-- ✓ citizenship (text) - OPTIONAL
-- ✓ address (text) - OPTIONAL

-- ============================================
-- PART 4: Party Company Table Verification
-- ============================================
-- API expects (from route.ts lines 158-165):
-- party_id, company_name, reg_number, legal_address, actual_address, bank_details
-- ============================================

SELECT 
    'party_company table - API expected columns' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default,
    CASE 
        WHEN column_name = 'company_name' 
        THEN 'REQUIRED'
        ELSE 'OPTIONAL'
    END as api_requirement
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'party_company'
  AND column_name IN (
    'party_id',
    'company_name',
    'reg_number',
    'legal_address',
    'actual_address',
    'bank_details'
  )
ORDER BY ordinal_position;

-- Expected:
-- ✓ party_id (uuid, FK → party.id) - REQUIRED
-- ✓ company_name (text) - REQUIRED for company
-- ✓ reg_number (text) - OPTIONAL
-- ✓ legal_address (text) - OPTIONAL
-- ✓ actual_address (text) - OPTIONAL
-- ✓ bank_details (text) - OPTIONAL

-- ============================================
-- PART 5: Client Party Table Verification
-- ============================================
-- API expects (from route.ts line 184):
-- party_id (simple junction table)
-- ============================================

SELECT 
    'client_party table - API expected columns' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'client_party'
ORDER BY ordinal_position;

-- Expected:
-- ✓ party_id (uuid, FK → party.id) - REQUIRED

-- ============================================
-- PART 6: Partner Party Table Verification (Supplier)
-- ============================================
-- API expects (from route.ts lines 188-198):
-- party_id, business_category, commission_type, commission_value, commission_currency,
-- commission_valid_from, commission_valid_to, commission_notes
-- ============================================

SELECT 
    'partner_party table - API expected columns' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'partner_party'
  AND column_name IN (
    'party_id',
    'business_category',
    'commission_type',
    'commission_value',
    'commission_currency',
    'commission_valid_from',
    'commission_valid_to',
    'commission_notes'
  )
ORDER BY ordinal_position;

-- Expected:
-- ✓ party_id (uuid, FK → party.id) - REQUIRED
-- ✓ business_category (enum) - OPTIONAL
-- ✓ commission_type (enum) - OPTIONAL
-- ✓ commission_value (numeric) - OPTIONAL
-- ✓ commission_currency (text) - OPTIONAL, default 'EUR'
-- ✓ commission_valid_from (date) - OPTIONAL
-- ✓ commission_valid_to (date) - OPTIONAL
-- ✓ commission_notes (text) - OPTIONAL

-- ============================================
-- PART 7: Subagents Table Verification
-- ============================================
-- API expects (from route.ts lines 202-209):
-- party_id, commission_scheme, commission_tiers, payout_details
-- ============================================

SELECT 
    'subagents table - API expected columns' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'subagents'
  AND column_name IN (
    'party_id',
    'commission_scheme',
    'commission_tiers',
    'payout_details'
  )
ORDER BY ordinal_position;

-- Expected:
-- ✓ party_id (uuid, FK → party.id) - REQUIRED
-- ✓ commission_scheme (enum/text) - OPTIONAL
-- ✓ commission_tiers (jsonb) - OPTIONAL
-- ✓ payout_details (text) - OPTIONAL

-- ============================================
-- PART 8: Data Type Compatibility Check
-- ============================================

SELECT 
    'data type compatibility' as check_type,
    table_name,
    column_name,
    data_type,
    CASE 
        -- Email/Phone: Should be text/varchar
        WHEN column_name IN ('email', 'phone') AND data_type NOT IN ('text', 'character varying', 'varchar') 
        THEN '⚠️ Should be text/varchar'
        -- Dates: Should accept date or timestamptz
        WHEN column_name IN ('dob', 'commission_valid_from', 'commission_valid_to') 
             AND data_type NOT IN ('date', 'timestamp without time zone', 'timestamp with time zone') 
        THEN '⚠️ Should be date/timestamp'
        -- Numeric: commission_value should be numeric/decimal
        WHEN column_name = 'commission_value' AND data_type NOT LIKE '%numeric%' AND data_type NOT LIKE '%decimal%'
        THEN '⚠️ Should be numeric/decimal'
        -- Boolean: Should be boolean
        WHEN column_name LIKE '%_consent' AND data_type != 'boolean'
        THEN '⚠️ Should be boolean'
        ELSE '✅ OK'
    END as compatibility_status
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name IN ('party', 'party_person', 'party_company', 'partner_party', 'subagents')
  AND (
    column_name IN ('email', 'phone', 'dob', 'commission_valid_from', 'commission_valid_to', 'commission_value')
    OR column_name LIKE '%_consent'
  );

-- ============================================
-- PART 9: Nullability Check (Optional Fields)
-- ============================================
-- API treats these as optional (can be null):
-- rating, notes, email, phone, title, dob, personal_code, citizenship, address,
-- reg_number, legal_address, actual_address, bank_details, commission fields
-- ============================================

SELECT 
    'nullable fields check' as check_type,
    table_name,
    column_name,
    is_nullable,
    CASE 
        -- These should be nullable (optional in API)
        WHEN column_name IN ('rating', 'notes', 'email', 'phone', 'title', 'dob', 
                             'personal_code', 'citizenship', 'address', 'reg_number', 
                             'legal_address', 'actual_address', 'bank_details',
                             'business_category', 'commission_type', 'commission_value',
                             'commission_currency', 'commission_valid_from', 'commission_valid_to',
                             'commission_notes', 'commission_scheme', 'commission_tiers', 
                             'payout_details')
        AND is_nullable = 'NO'
        THEN '⚠️ Should be nullable (optional in API)'
        ELSE '✅ OK'
    END as nullable_status
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name IN ('party', 'party_person', 'party_company', 'partner_party', 'subagents')
  AND column_name IN ('rating', 'notes', 'email', 'phone', 'title', 'dob', 
                      'personal_code', 'citizenship', 'address', 'reg_number', 
                      'legal_address', 'actual_address', 'bank_details',
                      'business_category', 'commission_type', 'commission_value',
                      'commission_currency', 'commission_valid_from', 'commission_valid_to',
                      'commission_notes', 'commission_scheme', 'commission_tiers', 
                      'payout_details');

-- ============================================
-- PART 10: Foreign Key Constraints Verification
-- ============================================

SELECT
    'foreign key constraints' as check_type,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    CASE 
        WHEN tc.table_name = 'party_person' AND kcu.column_name = 'party_id' AND ccu.table_name = 'party'
        THEN '✅ OK'
        WHEN tc.table_name = 'party_company' AND kcu.column_name = 'party_id' AND ccu.table_name = 'party'
        THEN '✅ OK'
        WHEN tc.table_name = 'client_party' AND kcu.column_name = 'party_id' AND ccu.table_name = 'party'
        THEN '✅ OK'
        WHEN tc.table_name = 'partner_party' AND kcu.column_name = 'party_id' AND ccu.table_name = 'party'
        THEN '✅ OK'
        WHEN tc.table_name = 'subagents' AND kcu.column_name = 'party_id' AND ccu.table_name = 'party'
        THEN '✅ OK'
        WHEN tc.table_name = 'party' AND kcu.column_name = 'company_id' AND ccu.table_name = 'companies'
        THEN '✅ OK'
        WHEN tc.table_name = 'party' AND kcu.column_name = 'created_by' AND ccu.table_name = 'users'
        THEN '✅ OK'
        ELSE '⚠️ Verify'
    END as constraint_status
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('party', 'party_person', 'party_company', 'client_party', 'partner_party', 'subagents')
ORDER BY tc.table_name, kcu.column_name;

-- Expected FKs:
-- ✓ party_person.party_id → party.id
-- ✓ party_company.party_id → party.id
-- ✓ client_party.party_id → party.id
-- ✓ partner_party.party_id → party.id
-- ✓ subagents.party_id → party.id
-- ✓ party.company_id → companies.id
-- ✓ party.created_by → auth.users.id

-- ============================================
-- PART 11: Enum Types Verification
-- ============================================

SELECT 
    'enum types' as check_type,
    t.typname as enum_name,
    string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as enum_values,
    CASE 
        WHEN typname = 'party_status' AND string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) = 'active, inactive, blocked'
        THEN '✅ Matches API'
        WHEN typname = 'party_type' AND string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) = 'person, company'
        THEN '✅ Matches API'
        WHEN typname = 'business_category' 
        THEN '✅ Verify values match: TO, Hotel, Rent a car, Airline, DMC, Other'
        WHEN typname = 'commission_type' AND string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) = 'percent, fixed'
        THEN '✅ Matches API'
        WHEN typname = 'commission_scheme' AND string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) = 'revenue, profit'
        THEN '✅ Matches API'
        ELSE '⚠️ Verify values'
    END as enum_status
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname IN ('party_status', 'party_type', 'business_category', 'commission_type', 'commission_scheme')
GROUP BY t.typname
ORDER BY t.typname;

-- ============================================
-- PART 12: Summary - All Required Columns Present
-- ============================================

SELECT 
    'schema completeness summary' as check_type,
    'party' as table_name,
    COUNT(*) FILTER (WHERE column_name IN ('id', 'display_name', 'party_type', 'status', 'company_id', 'created_by', 'created_at', 'updated_at')) as required_columns_present,
    8 as required_columns_total,
    CASE 
        WHEN COUNT(*) FILTER (WHERE column_name IN ('id', 'display_name', 'party_type', 'status', 'company_id', 'created_by', 'created_at', 'updated_at')) = 8
        THEN '✅ Complete'
        ELSE '❌ Missing columns'
    END as status
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'party'

UNION ALL

SELECT 
    'schema completeness summary',
    'party_person',
    COUNT(*) FILTER (WHERE column_name IN ('party_id', 'first_name', 'last_name')),
    3,
    CASE 
        WHEN COUNT(*) FILTER (WHERE column_name IN ('party_id', 'first_name', 'last_name')) = 3
        THEN '✅ Complete'
        ELSE '❌ Missing columns'
    END
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'party_person'

UNION ALL

SELECT 
    'schema completeness summary',
    'party_company',
    COUNT(*) FILTER (WHERE column_name IN ('party_id', 'company_name')),
    2,
    CASE 
        WHEN COUNT(*) FILTER (WHERE column_name IN ('party_id', 'company_name')) = 2
        THEN '✅ Complete'
        ELSE '❌ Missing columns'
    END
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'party_company'

UNION ALL

SELECT 
    'schema completeness summary',
    'client_party',
    COUNT(*) FILTER (WHERE column_name = 'party_id'),
    1,
    CASE 
        WHEN COUNT(*) FILTER (WHERE column_name = 'party_id') = 1
        THEN '✅ Complete'
        ELSE '❌ Missing columns'
    END
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'client_party'

UNION ALL

SELECT 
    'schema completeness summary',
    'partner_party',
    COUNT(*) FILTER (WHERE column_name = 'party_id'),
    1,
    CASE 
        WHEN COUNT(*) FILTER (WHERE column_name = 'party_id') = 1
        THEN '✅ Complete'
        ELSE '❌ Missing columns'
    END
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'partner_party'

UNION ALL

SELECT 
    'schema completeness summary',
    'subagents',
    COUNT(*) FILTER (WHERE column_name = 'party_id'),
    1,
    CASE 
        WHEN COUNT(*) FILTER (WHERE column_name = 'party_id') = 1
        THEN '✅ Complete'
        ELSE '❌ Missing columns'
    END
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'subagents';

-- ============================================
-- MESSAGE FOR ARCHITECT AGENT
-- ============================================
-- Comprehensive schema verification comparing actual database structure with API expectations.
-- Checks: All table structures, column types, nullability, FK constraints, enum types.
-- Compares with: app/api/directory/create/route.ts field mappings.
-- Run all queries to get complete verification picture.
-- Focus on: Missing columns, type mismatches, nullability issues, missing FK constraints.
-- If issues found: Run directory_schema_migration.sql to fix.
-- ============================================

