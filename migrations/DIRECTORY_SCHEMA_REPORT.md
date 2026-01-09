# Directory Schema Migration Report

**Date:** 2024-12-19  
**Specification:** `directory-v1-full-architecture.md`  
**Phase:** Phase 1 - Database Schema & Migrations

---

## Executive Summary

This report documents the database schema migration for the Directory/Party system per the full architecture specification.

### Status: ✅ Migration SQL Ready

All migration files have been created and are ready for execution:
- `directory_schema_migration.sql` - Schema changes and indexes
- `directory_rls_policies.sql` - Row Level Security policies
- `directory_schema_verification.sql` - Verification queries

---

## Schema Changes Summary

### Party Table (`party`)

**New Fields Added:**
- ✅ `display_name` (text) - Main name for listing
- ✅ `rating` (integer, CHECK 1-10) - Manual + future auto-scoring
- ✅ `status` (enum: 'active', 'inactive', 'blocked', default 'active') - Party status
- ✅ `company_id` (uuid, FK → companies) - Tenant isolation
- ✅ `created_by` (uuid, FK → auth.users) - Creator tracking
- ✅ `notes` (text) - Internal notes
- ✅ `email_marketing_consent` (boolean, default false) - Email marketing consent
- ✅ `phone_marketing_consent` (boolean, default false) - Phone/SMS marketing consent

**Enum Types Created:**
- ✅ `party_status` - ('active', 'inactive', 'blocked')
- ✅ `party_type` - ('person', 'company') - if not exists

### Party Person Table (`party_person`)

**New Fields Added:**
- ✅ `title` (text) - Mr, Mrs, Chd, etc.
- ✅ `citizenship` (text) - Country code (if missing)
- ✅ `address` (text) - Physical address (if missing)

### Party Company Table (`party_company`)

**New Fields Added:**
- ✅ `bank_details` (text) - Bank account information
- ✅ `actual_address` (text) - Physical address (if missing)

### Partner Party Table (`partner_party` - Supplier)

**New Fields Added:**
- ✅ `business_category` (enum: 'TO', 'Hotel', 'Rent a car', 'Airline', 'DMC', 'Other')
- ✅ `commission_notes` (text) - Notes about commission terms
- ✅ `commission_type`, `commission_value`, `commission_currency`, `commission_valid_from`, `commission_valid_to` (if missing)

**Enum Types Created:**
- ✅ `business_category` - Supplier business categories
- ✅ `commission_type` - ('percent', 'fixed') - if needed

### Party Documents Table (`party_documents`)

**New Table Created:**
- ✅ Full table structure per spec section 2.4
- ✅ For future document management feature

---

## Indexes Created

### Party Table Indexes

- ✅ `idx_party_display_name` - For name searches
- ✅ `idx_party_email` - For email lookups
- ✅ `idx_party_phone` - For phone lookups
- ✅ `idx_party_company_id` - For tenant isolation queries
- ✅ `idx_party_status` - For status filtering
- ✅ `idx_party_rating` - For rating sorting/filtering
- ✅ `idx_party_created_by` - For creator tracking
- ✅ `idx_party_company_status` - Composite index for common queries

### Party Person Indexes

- ✅ `idx_party_person_first_name` - For name searches
- ✅ `idx_party_person_last_name` - For name searches
- ✅ `idx_party_person_personal_code` - For personal code lookups

### Party Company Indexes

- ✅ `idx_party_company_name` - For company name searches
- ✅ `idx_party_company_reg_number` - For registration number lookups

### Party Documents Indexes

- ✅ `idx_party_documents_party_id` - For party document lookups
- ✅ `idx_party_documents_valid_till` - For expiry tracking

---

## RLS Policies

### Security Model

**Tenant Isolation:** All policies enforce company-based multi-tenancy via `company_id` matching against `profiles.company_id`.

**Service Role Bypass:** Service role (supabaseAdmin) automatically bypasses RLS - ensure API routes validate `company_id` manually.

### Policies Created

**Party Table:**
- ✅ SELECT - Users can read parties from their company
- ✅ INSERT - Users can create parties in their company (with created_by = auth.uid())
- ✅ UPDATE - Users can update parties in their company
- ✅ DELETE - Users can delete parties in their company

**Related Tables (ALL operations):**
- ✅ `party_person` - Company-based via party_id
- ✅ `party_company` - Company-based via party_id
- ✅ `client_party` - Company-based via party_id
- ✅ `partner_party` - Company-based via party_id
- ✅ `subagents` - Company-based via party_id
- ✅ `party_documents` - Company-based via party_id

---

## Migration Safety

✅ **All migrations are idempotent:**
- All operations use `IF NOT EXISTS` checks
- Enum types created conditionally
- Policies dropped before creation
- No destructive operations (DROP, ALTER DROP)

✅ **Data safety:**
- All new columns are nullable or have defaults
- No data loss risk
- Existing data preserved

✅ **Rollback safety:**
- No constraints removed
- No columns dropped
- Can be rolled back by reversing column additions (if needed)

---

## Verification Steps

1. **Run verification queries:**
   ```sql
   -- Execute directory_schema_verification.sql
   ```

2. **Check for expected columns:**
   - Run query #1-4 (table structures)
   - Verify all expected columns exist

3. **Check enum types:**
   - Run query #5 (enum types)
   - Verify enum values match specification

4. **Check indexes:**
   - Run query #6 (indexes)
   - Verify all indexes created

5. **Check RLS:**
   - Run query #7 (RLS status)
   - Verify RLS is enabled on all tables

6. **Check policies:**
   - Run query #8 (RLS policies)
   - Verify policies exist and are correct

---

## Next Steps

### Immediate Actions

1. ✅ **Review migration SQL** - Verify logic matches requirements
2. ✅ **Run verification queries** - Check current schema state
3. ⏳ **Apply migration** - Execute `directory_schema_migration.sql` in Supabase
4. ⏳ **Apply RLS policies** - Execute `directory_rls_policies.sql` in Supabase
5. ⏳ **Verify results** - Run verification queries again

### Data Migration (if needed)

**Populate display_name for existing records:**
```sql
-- For persons
UPDATE public.party p
SET display_name = COALESCE(
    (SELECT first_name || ' ' || last_name 
     FROM public.party_person pp 
     WHERE pp.party_id = p.id),
    p.display_name
)
WHERE p.party_type = 'person' 
  AND (p.display_name IS NULL OR p.display_name = '');

-- For companies
UPDATE public.party p
SET display_name = COALESCE(
    (SELECT company_name 
     FROM public.party_company pc 
     WHERE pc.party_id = p.id),
    p.display_name
)
WHERE p.party_type = 'company' 
  AND (p.display_name IS NULL OR p.display_name = '');
```

**Set company_id for existing records (if needed):**
- This requires business logic - determine appropriate company_id per record
- May need manual review or business rules

**Set created_by for existing records (if needed):**
- May need to set to a default user or leave NULL (if nullable)

### Phase 2 Tasks (After Schema Migration)

1. Update TypeScript types (`lib/types/directory.ts`)
2. Update API routes to use new schema
3. Update UI components to display new fields

---

## Known Issues / Notes

### Warnings

1. **Existing status column:**
   - Migration checks if `status` column exists but doesn't convert existing types
   - If column exists with different type, manual intervention needed

2. **Existing party_type column:**
   - Migration notes if column exists but doesn't force enum type
   - Verify existing column uses correct enum

3. **company_id population:**
   - New column is nullable
   - Existing records need company_id set (business logic required)

4. **display_name population:**
   - New column is nullable
   - Existing records should populate from person/company names (see data migration above)

### Performance Considerations

- RLS policies use subqueries on `profiles` table
- Ensure `profiles.company_id` is indexed (should already exist)
- Composite index `idx_party_company_status` helps with common filtering queries
- Consider materialized views for complex statistics queries

### Security Considerations

- All policies enforce company isolation
- Service role bypasses RLS - API routes must validate company_id manually
- No direct client access should use service role
- Review API routes to ensure proper authorization

---

## Files Created

1. `migrations/directory_schema_migration.sql` - Main schema migration
2. `migrations/directory_rls_policies.sql` - RLS policies
3. `migrations/directory_schema_verification.sql` - Verification queries
4. `migrations/DIRECTORY_SCHEMA_REPORT.md` - This report

---

## Acceptance Criteria Status

- ✅ All required fields added per specification
- ✅ All enums created with correct values
- ✅ All indexes created for performance
- ✅ RLS policies created for tenant isolation
- ✅ All migrations are idempotent
- ✅ No destructive operations
- ⏳ Schema verified in Supabase (pending execution)
- ⏳ RLS policies tested (pending execution)

---

**Next Step:** Execute migrations in Supabase SQL Editor and verify results.





