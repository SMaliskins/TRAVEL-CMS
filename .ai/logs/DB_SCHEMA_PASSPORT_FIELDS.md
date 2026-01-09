# DB/SCHEMA Agent - Passport Fields Structure

**Date:** 2026-01-07  
**Agent:** DB/SCHEMA Agent  
**Task:** D1 - Определить структуру БД для полей паспорта

---

## 📋 Task Requirements

**Задача:** Добавить passport details в Main details клиента (Directory Form) с AI парсингом

**Поля для парсинга:**
- Passport number
- Issue date
- Expiry date
- Issuing country
- Full name (как в паспорте)
- Date of birth
- Nationality

**Таблица:** `party_person`

---

## 🔍 Current Schema Analysis

**Table:** `party_person`

**Expected existing columns:**
- `party_id` (uuid, PK, FK → party)
- `first_name` (text)
- `last_name` (text)
- `title` (text)
- `dob` (date) - **Date of birth уже существует**
- `personal_code` (text)
- `citizenship` (text) - **Nationality может быть связано с citizenship**

---

## 📊 Proposed Database Schema

### New Columns for `party_person`

| Field Name | API Field | DB Column | Type | Nullable | Default | Notes |
|------------|-----------|-----------|------|----------|---------|-------|
| Passport number | `passportNumber` | `passport_number` | text | YES | NULL | Passport number (unique per person) |
| Issue date | `passportIssueDate` | `passport_issue_date` | date | YES | NULL | Date when passport was issued |
| Expiry date | `passportExpiryDate` | `passport_expiry_date` | date | YES | NULL | Passport expiration date |
| Issuing country | `passportIssuingCountry` | `passport_issuing_country` | text | YES | NULL | Country that issued the passport (ISO code or name) |
| Full name (as in passport) | `passportFullName` | `passport_full_name` | text | YES | NULL | Full name exactly as shown in passport |
| Date of birth | `dob` | `dob` | date | YES | NULL | **Already exists** - can be updated from passport |
| Nationality | `nationality` | `nationality` | text | YES | NULL | **May exist as `citizenship`** - verify schema |

---

## ✅ Field Mapping

### Form → API → Database

| Form Field (Display) | Form State | API Field | DB Column | Type | Required |
|----------------------|------------|-----------|-----------|------|----------|
| Passport Number | `passportNumber` | `passportNumber` | `passport_number` | text | ❌ |
| Issue Date | `passportIssueDate` | `passportIssueDate` | `passport_issue_date` | date | ❌ |
| Expiry Date | `passportExpiryDate` | `passportExpiryDate` | `passport_expiry_date` | date | ❌ |
| Issuing Country | `passportIssuingCountry` | `passportIssuingCountry` | `passport_issuing_country` | text | ❌ |
| Full Name (as in passport) | `passportFullName` | `passportFullName` | `passport_full_name` | text | ❌ |
| Date of Birth | `dob` | `dob` | `dob` | date | ❌ **Already exists** |
| Nationality | `nationality` | `nationality` | `nationality` or `citizenship` | text | ❌ **May exist** |

---

## 🔧 Migration Strategy

### Step 1: Verify Current Schema

**SQL Script:** `migrations/check_party_person_schema.sql`

Check:
- Current columns in `party_person`
- Existing `dob` and `citizenship`/`nationality` fields
- Constraints and indexes

### Step 2: Add New Columns (Idempotent)

**SQL Script:** `migrations/add_passport_fields_to_party_person.sql`

Add columns:
- `passport_number` (text, nullable)
- `passport_issue_date` (date, nullable)
- `passport_expiry_date` (date, nullable)
- `passport_issuing_country` (text, nullable)
- `passport_full_name` (text, nullable)
- `nationality` (text, nullable) - only if doesn't exist

All columns:
- **NULLABLE** (optional fields)
- **No default values** (keep NULL if not provided)
- **Idempotent** (use `IF NOT EXISTS` or `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`)

### Step 3: Add Indexes (Optional)

Consider indexes:
- `idx_party_person_passport_number` on `passport_number` WHERE `passport_number IS NOT NULL` (partial index)

---

## 📋 Column Definitions

### 1. `passport_number` (text, nullable)

**Purpose:** Store passport number/document number

**Constraints:**
- NULLABLE (optional)
- Consider UNIQUE constraint per person (optional, may be too restrictive)

**Examples:**
- "AB123456"
- "P1234567"
- "123456789"

### 2. `passport_issue_date` (date, nullable)

**Purpose:** Date when passport was issued

**Constraints:**
- NULLABLE
- Date type (no time component)

**Validation:**
- Should be in the past
- Should be before `passport_expiry_date` (if both are set)

### 3. `passport_expiry_date` (date, nullable)

**Purpose:** Date when passport expires

**Constraints:**
- NULLABLE
- Date type (no time component)

**Validation:**
- Should be after `passport_issue_date` (if both are set)
- Can be used for expiry warnings

### 4. `passport_issuing_country` (text, nullable)

**Purpose:** Country that issued the passport

**Constraints:**
- NULLABLE
- Consider using ISO country codes (e.g., "US", "GB", "DE")

**Recommendation:**
- Use 2-letter ISO country codes (ISO 3166-1 alpha-2)
- Or full country names (less preferred)

### 5. `passport_full_name` (text, nullable)

**Purpose:** Full name exactly as shown in passport document

**Constraints:**
- NULLABLE
- Can differ from `first_name` + `last_name` combination

**Use Case:**
- Some passports show full name in a single field
- May include middle names
- May use different name format/order

### 6. `nationality` (text, nullable)

**Purpose:** Nationality of the person

**Constraints:**
- NULLABLE
- May already exist as `citizenship` field

**Note:** Verify if `citizenship` field exists and whether we need separate `nationality` or can reuse `citizenship`

---

## ⚠️ Considerations

### 1. Existing Fields

**Date of Birth (`dob`):**
- Already exists in `party_person`
- Can be populated/updated from passport parsing
- No need to add duplicate field

**Nationality/Citizenship:**
- Check if `citizenship` field exists
- If exists, decide: reuse `citizenship` or add separate `nationality`
- If doesn't exist, add `nationality`

### 2. Data Types

- **Dates:** Use `date` type (not `timestamp` or `timestamp with time zone`)
- **Country codes:** Use `text` type (consider validation via CHECK constraint or enum)

### 3. Constraints

**Recommended:**
- All fields NULLABLE (optional)
- No UNIQUE constraints (passport numbers can be duplicates across different people)
- Consider CHECK constraint for date validation (expiry > issue date)

### 4. Indexes

**Recommended:**
- Partial index on `passport_number` WHERE `passport_number IS NOT NULL`
- Helps with search by passport number

---

## 📄 Next Steps

1. **Run verification SQL:** `migrations/check_party_person_schema.sql`
   - Verify current schema
   - Check if `citizenship`/`nationality` exists
   - Check if all expected columns exist

2. **Create migration script:** `migrations/add_passport_fields_to_party_person.sql`
   - Add all passport fields (idempotent)
   - Handle `nationality` vs `citizenship` decision

3. **Update mapping document:** `.ai/DIRECTORY_FORM_DB_MAPPING.md`
   - Add passport fields mapping
   - Document Form → API → DB flow

---

## ✅ Verification Checklist

- [ ] Current schema verified (run SQL script)
- [ ] Migration script created (idempotent)
- [ ] All fields documented
- [ ] Mapping document updated
- [ ] Ready for Code Writer

---

**Status:** ⏳ **Pending SQL verification** - Need to verify current schema before finalizing

**SQL Script:** `migrations/check_party_person_schema.sql`

