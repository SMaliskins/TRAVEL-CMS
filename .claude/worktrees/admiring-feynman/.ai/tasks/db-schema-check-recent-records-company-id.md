# PROMPT FOR DB/SCHEMA AGENT

**Task:** Check company_id for records that create but don't open

---

## Problem

**From server logs:**
- Record `b0eb268e-a72c-43a5-a0c9-2ad2d2edf317` created successfully (POST 200)
- Record `51fc094f-f11e-4c5c-868b-a161e9f8ca89` created successfully  
- But GET requests return: `"The result contains 0 rows"` with tenant isolation filter
- User company_id: `ca0143be-0696-4422-b949-4f4119adef36`
- Error: `PGRST116: Cannot coerce the result to a single JSON object`

**Working record for comparison:**
- Record `4e911c0a-159e-48b2-868a-cb96276d25a7` opens successfully
- Has `company_id: 'ca0143be-0696-4422-b949-4f4119adef36'` (matches user)
- Only has client role (no supplier/subagent)

---

## Your Task

### Run SQL Query to Check Records

**SQL Script:** `migrations/check_recent_record.sql`

**This script checks:**
1. Do the problematic records exist in `party` table?
2. What `company_id` do they have?
3. Do they have supplier/subagent roles?
4. Does user's company_id match?

**Run the script and report:**

1. **Do records exist?**
   - If NO → Records were not created (CREATE endpoint failed silently)
   - If YES → Continue to step 2

2. **What company_id do they have?**
   - If `company_id` is NULL → Problem: CREATE endpoint didn't set company_id
   - If `company_id` differs from user's → Problem: Wrong company_id set
   - If `company_id` matches → Problem is elsewhere (not tenant isolation)

3. **What roles do they have?**
   - Check if they have supplier/subagent roles
   - Verify all role records exist

4. **Compare with working record:**
   - Working record has correct company_id
   - Working record only has client role
   - Problem records may have supplier/subagent roles

---

## Expected Findings

**If records exist but have wrong company_id:**
- CREATE endpoint is not setting company_id correctly
- Or company_id is being set to wrong value

**If records don't exist:**
- CREATE endpoint returns 200 but doesn't actually create records
- Transaction rollback happening silently
- Error in role inserts causing cleanup

**If records exist with correct company_id:**
- Problem is NOT tenant isolation
- Problem is in GET endpoint query logic
- Or problem is in data structure (spread conflict)

---

## Output Required

1. **Create report:** `.ai/DB_RECENT_RECORDS_COMPANY_ID_REPORT.md`

2. **Include:**
   - SQL query results
   - Do records exist? (YES/NO)
   - What company_id do they have?
   - Do they match user's company_id?
   - What roles do they have?
   - Analysis and recommendations

3. **Update CODE WRITER task if needed:**
   - If company_id is wrong → Update CREATE endpoint fix instructions
   - If records don't exist → Update to check CREATE endpoint transaction handling
   - If company_id is correct → Problem is elsewhere, update diagnostics

---

**Created by:** ARCHITECT  
**Date:** 2026-01-03  
**Related:** Record not found, Tenant isolation, company_id mismatch

