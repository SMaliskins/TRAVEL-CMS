# PROMPT FOR DB/SCHEMA AGENT

**Task:** Verify Directory module database schema and update DIRECTORY_FORM_DB_MAPPING.md

---

## Problem

ARCHITECT created `.ai/DIRECTORY_FORM_DB_MAPPING.md` without consulting DB/SCHEMA agent first. The mapping document needs to be verified against the actual database schema.

**User requirement:** All field mappings MUST be verified by DB/SCHEMA agent before being used by CODE WRITER or other agents.

---

## Your Task

1. **Verify Database Schema:**
   - Check actual structure of all Directory tables in Supabase:
     - `party`
     - `party_person`
     - `party_company`
     - `client_party`
     - `partner_party`
     - `subagents`
   - Get column names, data types, constraints, and nullable status
   - Verify primary keys and foreign keys

2. **Compare with Mapping Document:**
   - Read `.ai/DIRECTORY_FORM_DB_MAPPING.md`
   - Compare documented mappings with actual database schema
   - Identify any discrepancies:
     - Missing columns in mapping document
     - Incorrect column names
     - Wrong data types
     - Missing constraints

3. **Update Mapping Document:**
   - Fix any errors found
   - Add missing columns
   - Correct column names if wrong
   - Update data types if incorrect
   - Add notes about constraints, defaults, etc.

4. **Verify Field Mappings:**
   - Check that Form → API → Database mappings are correct
   - Verify camelCase ↔ snake_case conversions
   - Check that all required fields are documented
   - Verify optional fields are marked correctly

---

## Database Tables to Check

### 1. `party` table
- Check all columns: `id`, `party_type`, `status`, `company_id`, `email`, `phone`, `display_name`, `created_at`, `updated_at`, etc.
- Verify data types (UUID, VARCHAR, TEXT, BOOLEAN, TIMESTAMP, etc.)
- Check constraints (NOT NULL, DEFAULT values, CHECK constraints)

### 2. `party_person` table
- Check columns: `party_id`, `first_name`, `last_name`, `title`, `dob`, `personal_code`, `citizenship`, `address`
- Verify `party_id` is primary key and foreign key to `party.id`
- Check data types and nullable status

### 3. `party_company` table
- Check columns: `party_id`, `company_name`, `reg_number`, `legal_address`, `actual_address`, `bank_details`
- Verify `party_id` is primary key and foreign key to `party.id`
- Check data types and nullable status

### 4. `client_party` table
- Check columns: `id`, `party_id`, `client_type`
- Verify `party_id` is foreign key to `party.id`
- Check `client_type` values (should be "person" or "company")

### 5. `partner_party` table
- Check columns: `id`, `party_id`, `partner_role`, `business_category`, `commission_type`, `commission_value`, `commission_currency`
- Verify `party_id` is foreign key to `party.id`
- Check `partner_role` values (should include "supplier")

### 6. `subagents` table
- Check columns: `id`, `party_id`, `commission_scheme`, `commission_tiers`, `payout_details`
- Verify `party_id` is foreign key to `party.id`
- Check data types (especially `commission_tiers` - should be JSONB)

---

## SQL Queries to Run

Use these queries to get schema information:

```sql
-- Get all columns for party table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'party'
ORDER BY ordinal_position;

-- Repeat for each table: party_person, party_company, client_party, partner_party, subagents

-- Get foreign keys
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('party_person', 'party_company', 'client_party', 'partner_party', 'subagents');

-- Get primary keys
SELECT
    tc.table_name,
    kcu.column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'PRIMARY KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('party', 'party_person', 'party_company', 'client_party', 'partner_party', 'subagents');

-- Get CHECK constraints (for enums)
SELECT
    tc.table_name,
    tc.constraint_name,
    cc.check_clause
FROM information_schema.table_constraints AS tc
JOIN information_schema.check_constraints AS cc
  ON tc.constraint_name = cc.constraint_name
WHERE tc.constraint_type = 'CHECK'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('party', 'party_person', 'party_company', 'client_party', 'partner_party', 'subagents');
```

---

## Expected Output

After verification, update `.ai/DIRECTORY_FORM_DB_MAPPING.md` with:

1. **Corrected column names** (if any were wrong)
2. **Complete column list** (no missing columns)
3. **Correct data types** (VARCHAR, TEXT, UUID, DATE, JSONB, etc.)
4. **Nullable status** (which columns are NOT NULL, which can be NULL)
5. **Default values** (if any columns have defaults)
6. **Constraints** (CHECK constraints for enums, foreign keys, etc.)
7. **Primary keys** (which columns are PKs)
8. **Notes** about any discrepancies found

---

## Files to Update

- `.ai/DIRECTORY_FORM_DB_MAPPING.md` - Update with verified schema information

---

## Acceptance Criteria

- [ ] All 6 tables verified against actual database schema
- [ ] All columns documented with correct names and data types
- [ ] All mappings verified (Form → API → Database)
- [ ] DIRECTORY_FORM_DB_MAPPING.md updated with correct information
- [ ] Any discrepancies documented and fixed
- [ ] Report created with findings (what was wrong, what was fixed)

---

## Notes

- This is CRITICAL - CODE WRITER and other agents will use this mapping document
- Any errors in mapping will cause data inconsistencies and broken functionality
- Take time to verify thoroughly - better to be slow and correct than fast and wrong
- If you find discrepancies, document them clearly in the mapping document

---

**Complete this task and report back with:**
1. What you found (any discrepancies?)
2. What you fixed in DIRECTORY_FORM_DB_MAPPING.md
3. Confirmation that mapping is now accurate
4. Any recommendations for CODE WRITER based on schema findings

