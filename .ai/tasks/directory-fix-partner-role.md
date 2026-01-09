# TASK: Fix partner_party INSERT - Add Required partner_role Field

**Context:**
partner_party table has required field `partner_role` (NOT NULL, no default) that API code doesn't provide when inserting supplier role. This causes INSERT failures.

**Architect Decision:**
- partner_role value: Always 'supplier' (fixed value)
- Rationale: partner_party table is used only for supplier role, no dynamic determination needed

**Constraints:**
- Never work on `main` branch (verify current branch first)
- One logical step per commit
- Do NOT break existing functionality
- Ensure proper error handling

**Acceptance Criteria:**
1. PUT endpoint (app/api/directory/[id]/route.ts) includes partner_role: 'supplier' in partner_party INSERT
2. POST endpoint (app/api/directory/create/route.ts) includes partner_role: 'supplier' in partner_party INSERT
3. Error handling returns errors to user (not just logs) in PUT endpoint
4. All INSERT operations for supplier role work correctly

**Smoke Test Steps:**
1. Create new party with supplier role
2. Update existing party to add supplier role
3. Verify partner_party record is created with partner_role = 'supplier'
4. Verify no INSERT errors occur

---

## EXECUTION PACK FOR CODE WRITER

**COPY-READY PROMPT:**

```
TASK: Add partner_role field to partner_party INSERT statements

Problem:
- partner_party table has required field partner_role (NOT NULL, no default)
- API code doesn't provide partner_role when inserting supplier role
- INSERT fails with: null value in column "partner_role" violates not-null constraint

Architect Decision:
- partner_role value: Always 'supplier' (fixed value, no dynamic determination)

Files to fix:
1. app/api/directory/[id]/route.ts (PUT endpoint, line ~270)
2. app/api/directory/create/route.ts (POST endpoint, line ~193)

Requirements:
1. Update supplierData object to include partner_role: 'supplier'
   - In PUT endpoint: const supplierData: any = { party_id: id, partner_role: 'supplier' };
   - In POST endpoint: const supplierData: any = { party_id: partyId, partner_role: 'supplier' };

2. Improve error handling in PUT endpoint (line ~280-284):
   - Currently only logs errors
   - Should return error to user (similar to POST endpoint lines 204-212)
   - Return NextResponse.json with error details

Expected changes:
- app/api/directory/[id]/route.ts:
  - Line ~270: Add partner_role: 'supplier' to supplierData
  - Lines ~280-284: Return error response instead of just logging
- app/api/directory/create/route.ts:
  - Line ~193: Add partner_role: 'supplier' to supplierData

Verification:
- Test creating party with supplier role
- Test updating party to add supplier role
- Verify partner_party record has partner_role = 'supplier'
- Verify no INSERT errors

Commit command:
git add app/api/directory/\[id\]/route.ts app/api/directory/create/route.ts && git commit -m "fix(api): add partner_role field to partner_party INSERT statements"
```




