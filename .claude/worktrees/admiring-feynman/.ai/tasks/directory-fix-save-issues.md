# TASK: Fix Directory Save Issues (Roles, Phone, Email Not Saving)

**Context:**
Directory detail page form saves are not working correctly:
- Roles are not being saved (client_party INSERT fails silently due to missing client_type)
- Phone and email are not being saved (may be silently failing or not included in updates)
- User reports that client was created with "client" role, but updates don't persist

**Constraints:**
- Never work on `main` branch (verify current branch first)
- One logical step per commit
- Do NOT break existing functionality
- Ensure proper error handling and return errors to user (not just log)

**Acceptance Criteria:**
1. PUT endpoint correctly inserts client_party with client_type field (derived from party_type)
2. Phone and email fields are properly saved when updating Directory record
3. Error messages are returned to user if save fails (not just logged to console)
4. All role inserts (client, supplier, subagent) work correctly with required fields
5. API returns updated record with correct roles, phone, email after save

**Smoke Test Steps:**
1. Open existing Directory record in detail page
2. Change phone number, save
3. Change email address, save
4. Change roles (add/remove), save
5. Verify all changes persist after page reload
6. Verify API returns correct data after save

---

## EXECUTION PACK FOR CODE WRITER

**COPY-READY PROMPT:**

```
TASK: Fix Directory API PUT endpoint to correctly save roles, phone, and email

Problem:
- Roles not saving: INSERT into client_party fails due to missing client_type (NOT NULL constraint)
- Phone and email may not be saving correctly
- Errors are logged but not returned to user

Files to fix:
- app/api/directory/[id]/route.ts (PUT endpoint)

Requirements:
1. Fix client_party INSERT (line 245):
   - Use updates.party_type to determine client_type value
   - If updates.party_type === 'person' → client_type = 'person'
   - If updates.party_type === 'company' → client_type = 'company'
   - If updates.party_type not provided, fetch party from DB to get party_type
   - Include client_type in INSERT: { party_id: id, client_type: clientType }

2. Ensure phone and email are always updated (lines 172-173):
   - Current code looks correct but verify it's working
   - Make sure empty strings are converted to null
   - Verify partyUpdates includes phone and email when provided

3. Improve error handling:
   - Return error responses instead of just logging (lines 209-211, 229-231)
   - Check for errors after person/company updates and return proper error response
   - Log errors but also return them to user

4. Also fix CREATE endpoint (app/api/directory/create/route.ts line 184):
   - Add client_type to client_party INSERT there as well
   - Use data.party_type to determine client_type

Expected changes:
- app/api/directory/[id]/route.ts: Fix PUT endpoint
  - Get party_type before inserting roles (fetch from DB if not in updates)
  - Add client_type to client_party INSERT
  - Return errors instead of just logging
- app/api/directory/create/route.ts: Fix POST endpoint
  - Add client_type to client_party INSERT
  - Use data.party_type for client_type

Verification:
- Test updating phone/email on existing record
- Test adding/removing roles on existing record
- Test creating new record with client role
- Verify all saves persist correctly
- Verify API returns correct data after save

Commit command:
git add app/api/directory/[id]/route.ts app/api/directory/create/route.ts && git commit -m "fix: add client_type to client_party inserts and improve error handling in Directory API"
```




