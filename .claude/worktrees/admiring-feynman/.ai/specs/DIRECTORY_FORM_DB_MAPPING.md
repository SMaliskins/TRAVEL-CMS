# Directory Form ↔ API ↔ Database Field Mapping

**Last Verified:** 2025-12-25  
**Verified By:** DB/SCHEMA Agent  
**Status:** ✅ Schema Verified

---

## Overview

This document provides complete field mapping between:
- **Form** (React/TypeScript - camelCase)
- **API** (Next.js API Routes - camelCase)
- **Database** (PostgreSQL - snake_case)

**Naming Conventions:**
- Form/API: `camelCase` (JavaScript convention)
- Database: `snake_case` (PostgreSQL convention)

---

## Core Table: `party`

**Primary Key:** `id` (uuid)

### Common Fields (All Party Types)

| Form Field | API Field | DB Column | Type | Required | Nullable | Default | Notes |
|------------|-----------|-----------|------|----------|----------|---------|-------|
| `id` | `id` | `id` | uuid | ✅ | NO | `gen_random_uuid()` | Primary key |
| `type` | `type` | `party_type` | text | ✅ | NO | - | 'person' or 'company' (CHECK constraint) |
| `isActive` | `isActive` | `status` | text | ✅ | NO | `'active'` | 'active', 'inactive', 'blocked' (CHECK) |
| `email` | `email` | `email` | text | ❌ | YES | - | Optional |
| `phone` | `phone` | `phone` | text | ❌ | YES | - | Optional |
| `display_name` | `displayName` | `display_name` | text | ✅ | NO | - | Auto-generated from name fields |
| `createdAt` | `createdAt` | `created_at` | timestamptz | ❌ | YES | `now()` | Auto-set |
| `updatedAt` | `updatedAt` | `updated_at` | timestamptz | ❌ | YES | `now()` | Auto-updated via trigger |
| - | - | `company_id` | uuid | ✅ | NO | - | FK → `companies(id)` - Tenant isolation |
| - | - | `created_by` | uuid | ✅ | NO | - | FK → `auth.users(id)` |
| - | - | `rating` | integer | ❌ | YES | - | 1-10 (CHECK constraint) |
| - | - | `notes` | text | ❌ | YES | - | Internal notes |
| - | - | `email_marketing_consent` | boolean | ❌ | YES | `false` | - |
| - | - | `phone_marketing_consent` | boolean | ❌ | YES | `false` | - |

**Database Constraints:**
- `CHECK (party_type IN ('person', 'company'))`
- `CHECK (status IN ('active', 'inactive', 'blocked'))`
- `CHECK (rating >= 1 AND rating <= 10)` (if rating is not NULL)

**Foreign Keys:**
- `company_id` → `companies(id)`
- `created_by` → `auth.users(id)`

**Indexes:**
- `idx_party_company_id` on `company_id`
- `idx_party_party_type` on `party_type`
- `idx_party_status` on `status`
- `idx_party_email` on `email` WHERE `email IS NOT NULL` (partial)
- `idx_party_phone` on `phone` WHERE `phone IS NOT NULL` (partial)

---

## Person-Specific Fields: `party_person`

**Primary Key:** `party_id` (uuid)  
**Foreign Key:** `party_id` → `party(id) ON DELETE CASCADE`

| Form Field | API Field | DB Column | Type | Required | Nullable | Default | Notes |
|------------|-----------|-----------|------|----------|----------|---------|-------|
| `title` | `title` | `title` | text | ❌ | YES | - | Optional (Mr, Mrs, Chd, etc.) |
| `firstName` | `firstName` | `first_name` | text | ✅ | NO | - | **Required for person** |
| `lastName` | `lastName` | `last_name` | text | ✅ | NO | - | **Required for person** |
| `dob` | `dob` | `dob` | date | ❌ | YES | - | Date of birth (optional) |
| `personalCode` | `personalCode` | `personal_code` | text | ❌ | YES | - | Personal ID code (optional) |
| `citizenship` | `citizenship` | `citizenship` | text | ❌ | YES | - | Country code |
| `address` | `address` | `address` | text | ❌ | YES | - | Physical address |

**Indexes:**
- `idx_party_person_personal_code` on `personal_code` WHERE `personal_code IS NOT NULL` (partial)

---

## Company-Specific Fields: `party_company`

**Primary Key:** `party_id` (uuid)  
**Foreign Key:** `party_id` → `party(id) ON DELETE CASCADE`

| Form Field | API Field | DB Column | Type | Required | Nullable | Default | Notes |
|------------|-----------|-----------|------|----------|----------|---------|-------|
| `companyName` | `companyName` | `company_name` | text | ✅ | NO | - | **Required for company** |
| `regNumber` | `regNumber` | `reg_number` | text | ❌ | YES | - | Registration number (optional) |
| `legalAddress` | `legalAddress` | `legal_address` | text | ❌ | YES | - | Legal address (optional) |
| `actualAddress` | `actualAddress` | `actual_address` | text | ❌ | YES | - | Actual address (optional) |
| - | - | `bank_details` | text | ❌ | YES | - | Bank details (not in current Form/API) |

**Indexes:**
- `idx_party_company_reg_number` on `reg_number` WHERE `reg_number IS NOT NULL` (partial)

---

## Role: Client (`client_party`)

**Primary Key:** `id` (uuid)  
**Foreign Key:** `party_id` → `party(id) ON DELETE CASCADE`

| Form Field | API Field | DB Column | Type | Required | Nullable | Default | Notes |
|------------|-----------|-----------|------|----------|----------|---------|-------|
| `roles` (includes "client") | `roles` (includes "client") | - | - | - | - | - | Role flag (if exists = client) |
| - | - | `id` | uuid | ✅ | NO | `gen_random_uuid()` | Primary key |
| - | - | `party_id` | uuid | ✅ | NO | - | FK → `party(id)` |
| - | - | `client_type` | text | ✅ | NO | - | 'person' or 'company' (CHECK constraint) |

**Database Constraints:**
- `CHECK (client_type IN ('person', 'company'))`

**Indexes:**
- `idx_client_party_party_id` on `party_id`

**API Mapping:**
- If `client_party` record exists → `roles` includes `"client"` in API response
- API checks: `is_client = !!clientData.data`

---

## Role: Supplier (`partner_party`)

**Primary Key:** `id` (uuid)  
**Foreign Key:** `party_id` → `party(id) ON DELETE CASCADE`

| Form Field | API Field | DB Column | Type | Required | Nullable | Default | Notes |
|------------|-----------|-----------|------|----------|----------|---------|-------|
| `roles` (includes "supplier") | `roles` (includes "supplier") | - | - | - | - | - | Role flag (if exists = supplier) |
| `supplierExtras.activityArea` | `supplierExtras.activityArea` | `business_category` | text | ❌ | YES | - | 'TO', 'Hotel', 'Rent a car', 'Airline', 'DMC', 'Other' |
| - | - | `id` | uuid | ✅ | NO | `gen_random_uuid()` | Primary key |
| - | - | `party_id` | uuid | ✅ | NO | - | FK → `party(id)` |
| - | - | `partner_role` | text | ✅ | NO | `'supplier'` | Currently only 'supplier' (CHECK constraint) |
| - | - | `commission_type` | text | ❌ | YES | - | 'percent' or 'fixed' (CHECK constraint) |
| - | - | `commission_value` | numeric | ❌ | YES | - | Commission value |
| - | - | `commission_currency` | text | ❌ | YES | `'EUR'` | Currency code |
| - | - | `commission_valid_from` | date | ❌ | YES | - | Start date |
| - | - | `commission_valid_to` | date | ❌ | YES | - | End date |
| - | - | `commission_notes` | text | ❌ | YES | - | Commission notes |

**Database Constraints:**
- `CHECK (partner_role = 'supplier')`
- `CHECK (business_category IN ('TO', 'Hotel', 'Rent a car', 'Airline', 'DMC', 'Other'))` (if provided)
- `CHECK (commission_type IN ('percent', 'fixed'))` (if provided)

**Indexes:**
- `idx_partner_party_party_id` on `party_id`

**API Mapping:**
- If `partner_party` record exists → `roles` includes `"supplier"` in API response
- API maps: `business_category` → `supplierExtras.activityArea`
- API checks: `is_supplier = !!supplierData.data`

---

## Role: Subagent (`subagents`)

**Primary Key:** `id` (uuid)  
**Foreign Key:** `party_id` → `party(id) ON DELETE CASCADE`

| Form Field | API Field | DB Column | Type | Required | Nullable | Default | Notes |
|------------|-----------|-----------|------|----------|----------|---------|-------|
| `roles` (includes "subagent") | `roles` (includes "subagent") | - | - | - | - | - | Role flag (if exists = subagent) |
| `subagentExtras.commissionType` | `subagentExtras.commissionType` | `commission_scheme` | text | ❌ | YES | - | 'revenue' → 'percentage', 'profit' → 'fixed' |
| `subagentExtras.commissionValue` | `subagentExtras.commissionValue` | - | - | - | - | - | **NOT IN DB** - subagents uses `commission_tiers` (jsonb) |
| `subagentExtras.commissionCurrency` | `subagentExtras.commissionCurrency` | - | - | - | - | - | **NOT IN DB** - no currency field |
| - | - | `id` | uuid | ✅ | NO | `gen_random_uuid()` | Primary key |
| - | - | `party_id` | uuid | ✅ | NO | - | FK → `party(id)` |
| - | - | `commission_scheme` | text | ❌ | YES | - | 'revenue' or 'profit' (CHECK constraint) |
| - | - | `commission_tiers` | jsonb | ❌ | YES | - | Commission tiers as JSON |
| - | - | `payout_details` | text | ❌ | YES | - | Payout details/instructions |

**Database Constraints:**
- `CHECK (commission_scheme IN ('revenue', 'profit'))` (if provided)

**Indexes:**
- `idx_subagents_party_id` on `party_id`

**API Mapping:**
- If `subagents` record exists → `roles` includes `"subagent"` in API response
- API maps: `commission_scheme` → `subagentExtras.commissionType` ('revenue' → 'percentage', 'profit' → 'fixed')
- **Note:** API currently tries to map `commission_value` and `commission_currency` from `subagents`, but these fields don't exist in this table (they exist in `partner_party`). This is a known issue.

**API checks:** `is_subagent = !!subagentData.data`

---

## Field Mapping Examples

### Creating a Person Record

**Form Input:**
```typescript
{
  type: "person",
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
  phone: "+1234567890",
  roles: ["client"]
}
```

**API Request:**
```typescript
{
  type: "person",
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
  phone: "+1234567890",
  roles: ["client"]
}
```

**Database Inserts:**

**`party` table:**
```sql
INSERT INTO party (
  id, display_name, party_type, status, company_id, 
  email, phone, created_by
) VALUES (
  gen_random_uuid(), 'John Doe', 'person', 'active',
  (SELECT company_id FROM profiles WHERE user_id = auth.uid()),
  'john@example.com', '+1234567890', auth.uid()
);
```

**`party_person` table:**
```sql
INSERT INTO party_person (
  party_id, first_name, last_name
) VALUES (
  <party_id>, 'John', 'Doe'
);
```

**`client_party` table:**
```sql
INSERT INTO client_party (
  id, party_id, client_type
) VALUES (
  gen_random_uuid(), <party_id>, 'person'
);
```

---

### Creating a Company Record

**Form Input:**
```typescript
{
  type: "company",
  companyName: "Gulliver Travel",
  regNumber: "LV123456",
  legalAddress: "Legal St 1",
  actualAddress: "Actual St 2",
  email: "info@gtr.lv",
  phone: "+371 22306472",
  roles: ["client", "supplier"]
}
```

**API Request:**
```typescript
{
  type: "company",
  companyName: "Gulliver Travel",
  regNumber: "LV123456",
  legalAddress: "Legal St 1",
  actualAddress: "Actual St 2",
  email: "info@gtr.lv",
  phone: "+371 22306472",
  roles: ["client", "supplier"]
}
```

**Database Inserts:**

**`party` table:**
```sql
INSERT INTO party (
  id, display_name, party_type, status, company_id,
  email, phone, created_by
) VALUES (
  gen_random_uuid(), 'Gulliver Travel', 'company', 'active',
  (SELECT company_id FROM profiles WHERE user_id = auth.uid()),
  'info@gtr.lv', '+371 22306472', auth.uid()
);
```

**`party_company` table:**
```sql
INSERT INTO party_company (
  party_id, company_name, reg_number, legal_address, actual_address
) VALUES (
  <party_id>, 'Gulliver Travel', 'LV123456', 'Legal St 1', 'Actual St 2'
);
```

**`client_party` table:**
```sql
INSERT INTO client_party (
  id, party_id, client_type
) VALUES (
  gen_random_uuid(), <party_id>, 'company'
);
```

**`partner_party` table:**
```sql
INSERT INTO partner_party (
  id, party_id, partner_role
) VALUES (
  gen_random_uuid(), <party_id>, 'supplier'
);
```

---

## Known Issues & Notes

### 1. Subagent Commission Fields
**Issue:** API tries to map `commission_value` and `commission_currency` from `subagents` table, but these fields don't exist there.

**Current State:**
- `subagents.commission_value` - ❌ Does not exist
- `subagents.commission_currency` - ❌ Does not exist
- `subagents.commission_tiers` - ✅ Exists (jsonb) - not currently used by API
- `subagents.commission_scheme` - ✅ Exists (text) - maps to `commissionType`

**These fields exist in `partner_party`:**
- `partner_party.commission_value` - ✅ Exists
- `partner_party.commission_currency` - ✅ Exists

**Recommendation:** API should not try to read `commission_value`/`commission_currency` from `subagents`. These belong to `partner_party` (supplier role).

### 2. Bank Details
**Issue:** `party_company.bank_details` exists in database but is not exposed in Form/API.

**Status:** Optional field, currently not used.

### 3. Address Field
**Note:** `party_person.address` exists but is separate from Company addresses (`legal_address`, `actual_address`).

### 4. Display Name
**Auto-generation:** `display_name` should be auto-generated:
- For Person: `"${firstName} ${lastName}"`
- For Company: `companyName`

Currently handled by API/Form logic.

---

## Verification Status

✅ **Schema Verified:** 2025-12-25  
✅ **All Tables Checked:** party, party_person, party_company, client_party, partner_party, subagents  
✅ **Field Mapping Verified:** Form → API → Database  
✅ **Constraints Documented:** Primary keys, foreign keys, check constraints  
✅ **Indexes Documented:** All indexes listed  

---

## Related Files

- **Schema Definition:** `migrations/create_directory_tables.sql`
- **Schema Verification Script:** `migrations/verify_directory_schema_complete.sql`
- **Verification Report:** `.ai/DB_SCHEMA_VERIFICATION_REPORT.md`
- **TypeScript Types:** `lib/types/directory.ts`

---

**Last Updated:** 2025-12-25  
**Maintained By:** DB/SCHEMA Agent
