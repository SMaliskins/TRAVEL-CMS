# Directory Schema Migrations

Migration files for Directory/Party system per `directory-v1-full-architecture.md` specification.

## Files

1. **`directory_schema_migration.sql`** - Main schema migration
   - Adds all required fields to party tables
   - Creates enum types
   - Creates indexes
   - Creates party_documents table (future feature)

2. **`directory_rls_policies.sql`** - Row Level Security policies
   - Enables RLS on all party tables
   - Creates company-based tenant isolation policies

3. **`directory_schema_verification.sql`** - Verification queries
   - Checks table structures
   - Verifies columns, enums, indexes, RLS status

4. **`DIRECTORY_SCHEMA_REPORT.md`** - Detailed migration report
   - Complete documentation
   - Field mapping
   - Safety notes

## Execution Order

1. **Verify current schema:**
   ```sql
   -- Run queries from directory_schema_verification.sql
   ```

2. **Apply schema migration:**
   ```sql
   -- Execute directory_schema_migration.sql
   ```

3. **Apply RLS policies:**
   ```sql
   -- Execute directory_rls_policies.sql
   ```

4. **Verify results:**
   ```sql
   -- Run verification queries again
   ```

## Safety

✅ All migrations are **idempotent** (safe to run multiple times)  
✅ All operations use `IF NOT EXISTS`  
✅ **No destructive operations** (no DROP, no ALTER DROP)  
✅ New columns are nullable or have defaults (no data loss)

## New Fields Summary

### Party Table
- `display_name` (text)
- `rating` (integer 1-10)
- `status` (enum: active/inactive/blocked)
- `company_id` (uuid) - tenant isolation
- `created_by` (uuid) - creator tracking
- `notes` (text)
- `email_marketing_consent` (boolean)
- `phone_marketing_consent` (boolean)

### Party Person
- `title` (text) - Mr/Mrs/Chd

### Party Company
- `bank_details` (text)

### Partner Party (Supplier)
- `business_category` (enum)
- `commission_notes` (text)

## RLS Policies

All tables have company-based tenant isolation:
- Users can only access parties from their own company
- Policies enforce via `company_id` matching `profiles.company_id`
- Service role bypasses RLS (for API routes)

## Next Steps

After applying migrations:
1. Update TypeScript types (`lib/types/directory.ts`)
2. Update API routes
3. Update UI components





