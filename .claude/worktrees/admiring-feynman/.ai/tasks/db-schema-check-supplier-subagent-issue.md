# PROMPT FOR DB/SCHEMA AGENT

**Task:** Diagnose "Record not found" issue for records with supplier+subagent roles

---

## Problem

**User Report:** "если у записи отмечено supplier и subagent - запись создается, но не открывается, ошибка Record not found!"

**Symptoms:**
- Record with "supplier" AND "subagent" roles creates successfully
- After creation, record does NOT open
- Error: "Record not found"
- Previous solutions (tenant isolation) did NOT fix the issue

---

## Your Task

### Step 1: Check Database Schema for Actual Structure

**Run these SQL queries in Supabase SQL Editor:**

```sql
-- 1. Check partner_party table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'partner_party'
ORDER BY ordinal_position;

-- 2. Check subagents table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'subagents'
ORDER BY ordinal_position;

-- 3. Check constraints on partner_party
SELECT
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.partner_party'::regclass
ORDER BY conname;

-- 4. Check constraints on subagents
SELECT
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.subagents'::regclass
ORDER BY conname;

-- 5. Check indexes
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND (tablename = 'partner_party' OR tablename = 'subagents')
ORDER BY tablename, indexname;
```

### Step 2: Check Existing Records with Supplier+Subagent

**Find records that have BOTH supplier and subagent roles:**

```sql
-- Find party records with both supplier and subagent roles
SELECT 
    p.id,
    p.display_name,
    p.party_type,
    p.status,
    p.company_id,
    p.created_at,
    pp.id as partner_party_id,
    pp.partner_role,
    pp.business_category,
    s.id as subagent_id,
    s.commission_scheme
FROM party p
INNER JOIN partner_party pp ON pp.party_id = p.id
INNER JOIN subagents s ON s.party_id = p.id
ORDER BY p.created_at DESC
LIMIT 10;
```

### Step 3: Check if Records Exist but Can't Be Found

**Check the most recent created record (if user created one recently):**

```sql
-- Get the most recent party record
SELECT 
    id,
    display_name,
    party_type,
    status,
    company_id,
    created_at,
    created_by
FROM party
ORDER BY created_at DESC
LIMIT 1;

-- If you have the ID, check its roles:
-- Replace '<PARTY_ID>' with actual ID from above query
SELECT 
    'client' as role_type,
    id,
    party_id
FROM client_party
WHERE party_id = '<PARTY_ID>'
UNION ALL
SELECT 
    'supplier' as role_type,
    id::text,
    party_id::text
FROM partner_party
WHERE party_id = '<PARTY_ID>'
UNION ALL
SELECT 
    'subagent' as role_type,
    id::text,
    party_id::text
FROM subagents
WHERE party_id = '<PARTY_ID>';
```

### Step 4: Check Tenant Isolation (company_id)

**Check if company_id matches:**

```sql
-- Get all parties with their company_id
SELECT 
    p.id,
    p.display_name,
    p.company_id,
    COUNT(DISTINCT cp.id) as has_client,
    COUNT(DISTINCT pp.id) as has_supplier,
    COUNT(DISTINCT s.id) as has_subagent
FROM party p
LEFT JOIN client_party cp ON cp.party_id = p.id
LEFT JOIN partner_party pp ON pp.party_id = p.id
LEFT JOIN subagents s ON s.party_id = p.id
GROUP BY p.id, p.display_name, p.company_id
HAVING COUNT(DISTINCT pp.id) > 0 AND COUNT(DISTINCT s.id) > 0
ORDER BY p.created_at DESC
LIMIT 10;

-- Check user's company_id
SELECT 
    user_id,
    company_id
FROM profiles
ORDER BY updated_at DESC
LIMIT 5;
```

### Step 5: Check for Data Integrity Issues

**Check if there are any orphaned records or missing data:**

```sql
-- Check for partner_party records without party
SELECT pp.*
FROM partner_party pp
LEFT JOIN party p ON p.id = pp.party_id
WHERE p.id IS NULL;

-- Check for subagents records without party
SELECT s.*
FROM subagents s
LEFT JOIN party p ON p.id = s.party_id
WHERE p.id IS NULL;

-- Check for duplicate role records (should not happen, but check)
SELECT 
    party_id,
    COUNT(*) as count
FROM partner_party
GROUP BY party_id
HAVING COUNT(*) > 1;

SELECT 
    party_id,
    COUNT(*) as count
FROM subagents
GROUP BY party_id
HAVING COUNT(*) > 1;
```

---

## Analysis Required

After running the SQL queries, analyze:

1. **Schema Structure:**
   - Are all expected columns present?
   - Are data types correct?
   - Are constraints correct?
   - Are indexes present?

2. **Data Issues:**
   - Do records with supplier+subagent exist in database?
   - Are there any orphaned records?
   - Are there duplicate role records?
   - Do company_id values match?

3. **Potential Issues:**
   - Missing columns that API expects?
   - Wrong data types that cause query failures?
   - Constraints that prevent inserts?
   - Missing indexes that cause slow queries?
   - RLS policies blocking access?

---

## Output Required

1. **Create a diagnostic report file:** `.ai/DB_SUPPLIER_SUBAGENT_DIAGNOSTIC_REPORT.md`

2. **Include in the report:**
   - Results of all SQL queries
   - Schema structure (columns, types, constraints, indexes)
   - Sample data from existing records
   - Any data integrity issues found
   - Analysis of potential causes
   - Recommendations for fixing

3. **Update the CODE WRITER task:**
   - File: `.ai/tasks/code-writer-fix-supplier-subagent-record-not-found.md`
   - Add findings from this diagnostic
   - Update fix instructions based on actual schema/data issues found
   - Remove incorrect assumptions (like tenant isolation if that's not the issue)

---

## Expected Issues to Find

Based on the problem description, look for:

1. **Schema Mismatch:**
   - API expects columns that don't exist
   - API uses wrong column names
   - Data types don't match

2. **Constraint Violations:**
   - CHECK constraints that fail silently
   - Foreign key constraints missing
   - Unique constraints causing conflicts

3. **Data Issues:**
   - Records created but with NULL/invalid values
   - Records created in wrong tables
   - Missing role records

4. **Query Issues:**
   - JOIN queries that fail when both roles exist
   - Queries that return multiple rows when expecting one
   - Queries that return no rows due to wrong conditions

---

## Files to Create/Update

1. **Create:** `.ai/DB_SUPPLIER_SUBAGENT_DIAGNOSTIC_REPORT.md`
   - Include all SQL results
   - Analysis and findings
   - Recommendations

2. **Update:** `.ai/tasks/code-writer-fix-supplier-subagent-record-not-found.md`
   - Add diagnostic findings
   - Update fix instructions
   - Remove incorrect assumptions

---

## Notes

- **DO NOT** assume tenant isolation is the issue (previous solutions didn't work)
- **DO** check actual schema structure vs. what API expects
- **DO** check actual data in database
- **DO** look for data integrity issues
- **DO** verify constraints and indexes

---

**Created by:** ARCHITECT  
**Date:** 2026-01-03  
**Related:** Supplier+Subagent roles, Record not found, Database schema verification

