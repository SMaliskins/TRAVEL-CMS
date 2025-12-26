# TASK: Check partner_party and subagents Table Structure for Required Fields

**Context:**
After fixing client_party INSERT issue (missing client_type), we need to verify if partner_party and subagents tables also have required fields that are not being provided in API INSERT statements. Security/CI agent added error handling but we need to confirm table structures to prevent similar issues.

**Constraints:**
- Never work on `main` branch (verify current branch first)
- One logical step per commit
- Do NOT guess schema - check actual table structure in Supabase

**Acceptance Criteria:**
1. Diagnostic SQL script checks all columns in partner_party table (required vs optional)
2. Diagnostic SQL script checks all columns in subagents table (required vs optional)
3. Script identifies any NOT NULL constraints without defaults
4. Script shows sample data to understand what values are used
5. Results clearly indicate if INSERT statements need additional required fields

**Smoke Test Steps:**
1. Run diagnostic script in Supabase
2. Review results to identify required fields
3. If required fields found, update API INSERT statements accordingly
4. Verify INSERT operations work correctly after fix

---

## EXECUTION PACK FOR DB/SCHEMA AGENT

**COPY-READY PROMPT:**

```
TASK: Verify partner_party and subagents table structure for required fields

Context:
- client_party table has required client_type field (NOT NULL, no default) that was missing in API INSERT
- Need to verify if partner_party and subagents have similar required fields
- Security/CI agent created check_partner_subagent_structure.sql but results need verification
- API INSERT statements may be missing required fields, causing silent failures

Requirements:
1. Review existing diagnostic script: migrations/check_partner_subagent_structure.sql
   - Verify it checks all columns in partner_party and subagents
   - Ensure it identifies required fields (NOT NULL, no default)

2. If script is incomplete, enhance it to:
   - Show all columns with data types and constraints
   - Clearly mark required fields (NOT NULL, no default)
   - Show sample data to understand what values are typically used
   - Check for enum types or foreign key constraints

3. Provide analysis:
   - List any required fields that are missing from API INSERT statements
   - Recommend values for required fields (if applicable)
   - Indicate if current API code (app/api/directory/[id]/route.ts lines 270-298, app/api/directory/create/route.ts lines 192-234) needs fixes

4. If required fields are found:
   - Document what fields need to be added to INSERT statements
   - Suggest appropriate values or logic to determine values
   - Note any differences between partner_party and subagents requirements

Expected Output:
- Enhanced or verified diagnostic script (if needed)
- Clear summary of required fields for both tables
- Recommendations for API code fixes (if needed)

Verification:
- Run script in Supabase SQL Editor
- Review output to identify any required fields
- Compare with current API INSERT statements to find gaps

Commit command (if script enhanced):
git add migrations/check_partner_subagent_structure.sql && git commit -m "docs(db): enhance partner_party and subagents structure diagnostic script"
```
