# TASK: Verify client_type in Directory Create Endpoint

**Context:**
Security/CI agent fixed client_type in PUT endpoint, but create endpoint needs verification. Ensure client_type is correctly determined and included in client_party INSERT.

**Constraints:**
- Never work on `main` branch (verify current branch first)
- One logical step per commit
- Do NOT break existing functionality
- Verify logic is correct (not just presence of field)

**Acceptance Criteria:**
1. client_type is correctly determined from party_type (company → 'company', else → 'person')
2. client_type is included in client_party INSERT
3. Logic matches PUT endpoint implementation (consistency check)
4. Error handling is present (if INSERT fails, error is returned to user)

**Smoke Test Steps:**
1. Create party with type 'person' and client role - verify client_type = 'person'
2. Create party with type 'company' and client role - verify client_type = 'company'
3. Verify no INSERT errors occur
4. Verify API returns correct response

---

## EXECUTION PACK FOR CODE WRITER

**COPY-READY PROMPT:**

```
TASK: Verify and fix client_type in Directory create endpoint

Context:
- PUT endpoint (app/api/directory/[id]/route.ts) correctly includes client_type in client_party INSERT
- Create endpoint (app/api/directory/create/route.ts) needs verification
- Ensure consistency between CREATE and UPDATE endpoints

Requirements:
1. Review create endpoint (app/api/directory/create/route.ts lines ~183-190):
   - Verify client_type is determined from party_type
   - Verify client_type is included in client_party INSERT
   - Ensure logic matches PUT endpoint: party_type === 'company' → 'company', else → 'person'

2. Check current implementation:
   - Current code uses: record.party_type (line 185) - ⚠️ BUG: variable 'record' doesn't exist!
   - Should use: party.party_type or data.party_type (party is result from INSERT, data is input)
   - Fix: const clientType = (party?.party_type || data.party_type) === "company" ? "company" : "person";

3. Ensure error handling:
   - Check if client_party INSERT has error handling
   - If INSERT fails, should clean up party and return error to user
   - Similar to supplier/subagent error handling in same endpoint

4. Compare with PUT endpoint logic (app/api/directory/[id]/route.ts lines 248-263):
   - PUT uses: const partyType = partyData?.party_type || updates.party_type || "person";
   - PUT uses: const clientType = partyType === "company" ? "company" : "person";
   - Ensure CREATE uses similar logic for consistency

Expected changes (if needed):
- Ensure clientType determination is correct and has fallback
- Verify client_type is included in INSERT
- Add error handling if missing (clean up party on failure, return error)

Verification:
- Create party with person type + client role → check client_type = 'person'
- Create party with company type + client role → check client_type = 'company'
- Test error case (if possible) → verify cleanup and error response

Commit command (if changes needed):
git add app/api/directory/create/route.ts && git commit -m "fix(api): verify and improve client_type handling in Directory create endpoint"
```

