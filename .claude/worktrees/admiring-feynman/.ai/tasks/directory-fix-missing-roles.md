# TASK: Fix Missing Roles for Directory Record

**Context:**
Directory detail page shows validation error because API returns empty roles array (`roles: []`). This blocks form save functionality. Root cause: missing role records in `client_party`, `partner_party`, or `subagents` tables for `party_id = d1be65fd-5222-475b-9839-df66e67ad456`.

**Constraints:**
- Never work on `main` branch (verify current branch first)
- One logical step per commit
- Do NOT guess schema - verify actual table structure first
- Idempotent SQL scripts only (safe to re-run)

**Acceptance Criteria:**
1. Diagnostic SQL script identifies missing role records for the affected `party_id`
2. Fix SQL script restores appropriate role(s) based on business logic or party status
3. After fix: API GET `/api/directory/d1be65fd-5222-475b-9839-df66e67ad456` returns `roles` array with at least one role
4. Also fix invalid DOB: `2026-02-22` (future date) → should be in the past
5. Scripts are idempotent and safe to re-run

**Smoke Test Steps:**
1. Run diagnostic script to check current state of role tables for party_id
2. Run fix script to restore missing roles
3. Verify API returns non-empty roles array: `curl http://localhost:3000/api/directory/d1be65fd-5222-475b-9839-df66e67ad456 | jq '.record.roles'`
4. Verify form can be saved after roles restored
5. Verify DOB is corrected to valid past date

---

## EXECUTION PACK FOR DB/SCHEMA AGENT

**COPY-READY PROMPT:**

```
TASK: Diagnose and fix missing role records for Directory party_id

Context:
- Party ID: d1be65fd-5222-475b-9839-df66e67ad456
- API endpoint GET /api/directory/[id] returns roles: [] (empty array)
- Root cause: missing records in role tables (client_party, partner_party, subagents)
- Secondary issue: invalid DOB "2026-02-22" (future date)

Requirements:
1. Create diagnostic SQL script: migrations/diagnose_directory_roles.sql
   - Check if party record exists in party table
   - Check for records in client_party table (WHERE party_id = 'd1be65fd-5222-475b-9839-df66e67ad456')
   - Check for records in partner_party table
   - Check for records in subagents table
   - Show current party status and display_name for context
   - Check DOB value in party_person table

2. Create fix SQL script: migrations/fix_directory_roles.sql
   - Add appropriate role record(s) based on party status
   - Default strategy: if party.status = 'active' and no roles exist, add 'client' role
   - Use ON CONFLICT DO NOTHING for idempotency
   - Fix DOB if it's in the future (set to NULL or reasonable past date)
   - Script must be idempotent (safe to re-run)

3. Provide SQL verification query to confirm fix worked

Expected Output:
- Diagnostic script: migrations/diagnose_directory_roles.sql
- Fix script: migrations/fix_directory_roles.sql
- Both scripts must be idempotent
- Fix script should handle:
  a) Missing client_party record → INSERT INTO client_party (party_id) VALUES (...)
  b) Invalid DOB (future date) → UPDATE party_person SET dob = NULL WHERE dob > CURRENT_DATE

Verify:
- Run diagnostic first to confirm missing records
- Run fix script
- Verify with: SELECT * FROM client_party WHERE party_id = 'd1be65fd-5222-475b-9839-df66e67ad456';
- Verify DOB: SELECT dob FROM party_person WHERE party_id = 'd1be65fd-5222-475b-9839-df66e67ad456';

Commit command:
git add migrations/diagnose_directory_roles.sql migrations/fix_directory_roles.sql && git commit -m "fix(db): add diagnostic and fix scripts for missing Directory role records"
```




