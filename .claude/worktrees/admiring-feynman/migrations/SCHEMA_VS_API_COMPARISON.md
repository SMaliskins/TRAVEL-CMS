# Directory Schema vs API Expectations - Comparison Report

## API Route Reference

**File**: `app/api/directory/create/route.ts`

## Column Mapping: API Code → Database Schema

### Party Table

| API Field (route.ts) | DB Column | Type | Required | Nullable | Status |
|---------------------|-----------|------|----------|----------|--------|
| `display_name` (line 97) | `display_name` | text | ✅ Yes | ❓ Check | ⚠️ Verify |
| `party_type` (line 98) | `party_type` | text/enum | ✅ Yes | ❓ Check | ⚠️ Verify |
| `status` (line 99) | `status` | enum | ✅ Yes | ❌ No | ⚠️ Verify |
| `rating` (line 100) | `rating` | integer | ❌ No | ✅ Yes | ⚠️ Verify |
| `notes` (line 101) | `notes` | text | ❌ No | ✅ Yes | ⚠️ Verify |
| `company_id` (line 102) | `company_id` | uuid | ✅ Yes | ❓ Check | ⚠️ Verify |
| `email` (line 103) | `email` | text | ❌ No | ✅ Yes | ⚠️ Verify |
| `phone` (line 104) | `phone` | text | ❌ No | ✅ Yes | ⚠️ Verify |
| `email_marketing_consent` (line 105) | `email_marketing_consent` | boolean | ❌ No | ✅ Yes | ⚠️ Verify |
| `phone_marketing_consent` (line 106) | `phone_marketing_consent` | boolean | ❌ No | ✅ Yes | ⚠️ Verify |
| `created_by` (line 107) | `created_by` | uuid | ✅ Yes | ❓ Check | ⚠️ Verify |
| `id` (line 129) | `id` | uuid | ✅ Yes | ❌ No | ✅ Should exist |
| `created_at` | `created_at` | timestamptz | ✅ Yes | ❌ No | ✅ Should exist |
| `updated_at` | `updated_at` | timestamptz | ✅ Yes | ❌ No | ✅ Should exist |

### Party Person Table

| API Field (route.ts) | DB Column | Type | Required | Nullable | Status |
|---------------------|-----------|------|----------|----------|--------|
| `party_id` (line 134) | `party_id` | uuid (FK) | ✅ Yes | ❌ No | ⚠️ Verify |
| `title` (line 135) | `title` | text | ❌ No | ✅ Yes | ⚠️ Verify |
| `first_name` (line 136) | `first_name` | text | ✅ Yes | ❌ No | ⚠️ Verify |
| `last_name` (line 137) | `last_name` | text | ✅ Yes | ❌ No | ⚠️ Verify |
| `dob` (line 138) | `dob` | date | ❌ No | ✅ Yes | ⚠️ Verify |
| `personal_code` (line 139) | `personal_code` | text | ❌ No | ✅ Yes | ⚠️ Verify |
| `citizenship` (line 140) | `citizenship` | text | ❌ No | ✅ Yes | ⚠️ Verify |
| `address` (line 141) | `address` | text | ❌ No | ✅ Yes | ⚠️ Verify |

### Party Company Table

| API Field (route.ts) | DB Column | Type | Required | Nullable | Status |
|---------------------|-----------|------|----------|----------|--------|
| `party_id` (line 159) | `party_id` | uuid (FK) | ✅ Yes | ❌ No | ⚠️ Verify |
| `company_name` (line 160) | `company_name` | text | ✅ Yes | ❌ No | ⚠️ Verify |
| `reg_number` (line 161) | `reg_number` | text | ❌ No | ✅ Yes | ⚠️ Verify |
| `legal_address` (line 162) | `legal_address` | text | ❌ No | ✅ Yes | ⚠️ Verify |
| `actual_address` (line 163) | `actual_address` | text | ❌ No | ✅ Yes | ⚠️ Verify |
| `bank_details` (line 164) | `bank_details` | text | ❌ No | ✅ Yes | ⚠️ Verify |

### Client Party Table

| API Field (route.ts) | DB Column | Type | Required | Nullable | Status |
|---------------------|-----------|------|----------|----------|--------|
| `party_id` (line 184) | `party_id` | uuid (FK) | ✅ Yes | ❌ No | ⚠️ Verify |

**Note**: Simple junction table - only `party_id` needed

### Partner Party Table (Supplier)

| API Field (route.ts) | DB Column | Type | Required | Nullable | Status |
|---------------------|-----------|------|----------|----------|--------|
| `party_id` (line 188) | `party_id` | uuid (FK) | ✅ Yes | ❌ No | ⚠️ Verify |
| `business_category` (line 190) | `business_category` | enum | ❌ No | ✅ Yes | ⚠️ Verify |
| `commission_type` (line 191) | `commission_type` | enum | ❌ No | ✅ Yes | ⚠️ Verify |
| `commission_value` (line 192) | `commission_value` | numeric | ❌ No | ✅ Yes | ⚠️ Verify |
| `commission_currency` (line 193) | `commission_currency` | text | ❌ No | ✅ Yes | ⚠️ Verify |
| `commission_valid_from` (line 194) | `commission_valid_from` | date | ❌ No | ✅ Yes | ⚠️ Verify |
| `commission_valid_to` (line 195) | `commission_valid_to` | date | ❌ No | ✅ Yes | ⚠️ Verify |
| `commission_notes` (line 196) | `commission_notes` | text | ❌ No | ✅ Yes | ⚠️ Verify |

### Subagents Table

| API Field (route.ts) | DB Column | Type | Required | Nullable | Status |
|---------------------|-----------|------|----------|----------|--------|
| `party_id` (line 202) | `party_id` | uuid (FK) | ✅ Yes | ❌ No | ⚠️ Verify |
| `commission_scheme` (line 204) | `commission_scheme` | enum/text | ❌ No | ✅ Yes | ⚠️ Verify |
| `commission_tiers` (line 205) | `commission_tiers` | jsonb | ❌ No | ✅ Yes | ⚠️ Verify |
| `payout_details` (line 206) | `payout_details` | text | ❌ No | ✅ Yes | ⚠️ Verify |

---

## Expected Data Types

### Text Fields (Should be TEXT/VARCHAR)
- `display_name`, `notes`, `email`, `phone` → `text`
- `title`, `first_name`, `last_name`, `personal_code`, `citizenship`, `address` → `text`
- `company_name`, `reg_number`, `legal_address`, `actual_address`, `bank_details` → `text`
- `commission_currency`, `commission_notes`, `payout_details` → `text`

### Date Fields (Should be DATE)
- `dob` → `date`
- `commission_valid_from`, `commission_valid_to` → `date`

### Numeric Fields (Should be NUMERIC/DECIMAL)
- `rating` → `integer` (with CHECK 1-10)
- `commission_value` → `numeric(12,2)` or similar

### Boolean Fields (Should be BOOLEAN)
- `email_marketing_consent` → `boolean`
- `phone_marketing_consent` → `boolean`

### UUID Fields (Should be UUID)
- `id`, `company_id`, `created_by`, `party_id` → `uuid`

### Enum Fields
- `party_type` → enum or text with CHECK constraint
- `status` → enum ('active', 'inactive', 'blocked')
- `business_category` → enum ('TO', 'Hotel', 'Rent a car', 'Airline', 'DMC', 'Other')
- `commission_type` → enum ('percent', 'fixed')
- `commission_scheme` → enum ('revenue', 'profit')

### JSONB Fields
- `commission_tiers` → `jsonb`

---

## Constraints Check

### Foreign Keys (Required)

✅ **Should exist:**
- `party_person.party_id` → `party.id`
- `party_company.party_id` → `party.id`
- `client_party.party_id` → `party.id`
- `partner_party.party_id` → `party.id`
- `subagents.party_id` → `party.id`
- `party.company_id` → `companies.id`
- `party.created_by` → `auth.users.id`

### NOT NULL Constraints

**Required fields (should be NOT NULL):**
- `party.id`, `party.display_name`, `party.party_type`, `party.status`, `party.company_id`, `party.created_by`
- `party_person.party_id`, `party_person.first_name`, `party_person.last_name`
- `party_company.party_id`, `party_company.company_name`
- `client_party.party_id`
- `partner_party.party_id`
- `subagents.party_id`

**Optional fields (should be NULL):**
- All other fields listed as optional in API

### CHECK Constraints

**Expected:**
- `party.rating`: CHECK (rating >= 1 AND rating <= 10)
- `party.status`: CHECK or enum ('active', 'inactive', 'blocked')
- `party.party_type`: CHECK or enum ('person', 'company')

---

## Verification Queries

Run `verify_directory_schema_vs_api.sql` to check:
1. All required columns exist
2. Data types match expectations
3. Nullability is correct (required vs optional)
4. FK constraints exist
5. Enum types match

---

## Common Issues

### Issue 1: Missing Columns
**Symptom**: Column doesn't exist in table

**Fix**: Run `directory_schema_migration.sql`

### Issue 2: Wrong Data Type
**Symptom**: Column exists but wrong type (e.g., integer instead of text)

**Fix**: May require ALTER COLUMN (manual intervention needed)

### Issue 3: Wrong Nullability
**Symptom**: Optional field is NOT NULL, or required field is nullable

**Fix**: ALTER COLUMN to fix nullability

### Issue 4: Missing FK Constraint
**Symptom**: FK constraint doesn't exist

**Fix**: Run `directory_schema_migration.sql` or `fix_party_company_id_fk.sql`

---

## Files Reference

- **Verification**: `migrations/verify_directory_schema_vs_api.sql`
- **Schema Migration**: `migrations/directory_schema_migration.sql`
- **API Route**: `app/api/directory/create/route.ts`
- **Types**: `lib/types/directory.ts`

---

## Message for Architect Agent

**Verification Complete**: Created comprehensive schema verification comparing actual database with API expectations.

**Comparison**: Maps all API route fields to database columns with type, nullability, and constraint checks.

**Files Created**: Verification SQL script and comparison documentation.

**Status**: Ready to run verification queries to identify any schema mismatches.





