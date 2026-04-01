# PROMPT FOR CODE WRITER AGENT

**Task:** Implement `/api/directory/create` endpoint to fix `/directory/new` page

---

## Context

The `/directory/new` page is not working because the API endpoint `/api/directory/create` returns 501 (Not Implemented). You need to implement the POST handler for this endpoint.

---

## Task Details

### Problem
- File: `app/api/directory/create/route.ts`
- Current state: Returns 501 with "Directory creation not yet implemented"
- Required: Full implementation of POST handler

### Expected Behavior
1. Accept POST request with `Partial<DirectoryRecord>` data
2. Validate required fields
3. Insert record into database
4. Return response: `{ ok: true, record: DirectoryRecord }`
5. Handle errors appropriately

---

## Implementation Requirements

### 1. Follow Existing Patterns
- Use `supabaseAdmin` from `@/lib/supabaseAdmin` (same pattern as `app/api/orders/create/route.ts`)
- Follow error handling patterns from existing APIs
- Use NextRequest/NextResponse from Next.js

### 2. Data Format
- Input: Request body contains `Partial<DirectoryRecord>` (see `lib/types/directory.ts`)
- DirectoryRecord structure:
  - `type`: "person" | "company"
  - `roles`: DirectoryRole[] ("client" | "supplier" | "subagent")
  - `isActive`: boolean
  - Person fields: firstName, lastName, personalCode, dob, etc.
  - Company fields: companyName, regNumber, legalAddress, etc.
  - Common: phone, email
  - Supplier: supplierExtras (object with activityArea)
  - Subagent: subagentExtras (object with commissionType, commissionValue, commissionCurrency)

### 3. Database Schema
- **IMPORTANT:** Database schema location is unclear (no migration files found in project root)
- You may need to:
  - Check Supabase directly for table structure
  - Or request DB/SCHEMA agent to provide schema information
  - Tables likely named: `party`, `party_person`, `party_company`, or similar
  - May need to handle roles in separate tables (client_party, partner_party, subagents)

### 4. Response Format
- Success: `{ ok: true, record: DirectoryRecord }`
- Error: `{ error: string }` with appropriate HTTP status

### 5. Authentication
- Store uses `fetchWithAuth` which suggests auth is required
- Follow authentication pattern from `app/api/orders/create/route.ts`
- Use `supabaseAdmin` for database operations (bypasses RLS)

---

## Files to Modify

1. **Primary:** `app/api/directory/create/route.ts` - Implement POST handler

### Files to Reference
- `app/api/orders/create/route.ts` - Example API implementation pattern
- `lib/supabaseAdmin.ts` - Admin client utility
- `lib/types/directory.ts` - Type definitions
- `components/DirectoryForm.tsx` - See what data format is sent (lines 344-381)
- `lib/directory/directoryStore.tsx` - See expected response format (lines 66-68)

---

## Acceptance Criteria

- [ ] `/directory/new` page can submit form without 501 error
- [ ] Form submission successfully creates record in database
- [ ] API returns correct format: `{ ok: true, record: DirectoryRecord }`
- [ ] Created record has all fields properly saved
- [ ] Error handling works (validation errors, database errors)
- [ ] After creation, user is redirected correctly (handled by page component)
- [ ] TypeScript compiles without errors
- [ ] No console errors in browser

---

## Implementation Steps

1. **Check Database Schema:**
   - Verify what tables exist for Directory/Party records
   - If schema unclear, note this in your response for DB/SCHEMA agent

2. **Implement POST Handler:**
   - Parse request body
   - Validate required fields (type, roles, at least one role)
   - Use supabaseAdmin to insert into database
   - Handle person vs company types
   - Handle roles (may need inserts into multiple tables)
   - Return created record

3. **Error Handling:**
   - Validate input data
   - Handle database errors
   - Return appropriate HTTP status codes (400 for validation, 500 for server errors)

4. **Testing:**
   - Test form submission from `/directory/new` page
   - Verify record is created in database
   - Verify response format matches expected structure
   - Test error cases (invalid data, missing fields)

---

## Notes

- DirectoryForm sends `Partial<DirectoryRecord>` - handle optional fields appropriately
- Store expects response: `{ ok: true, record: DirectoryRecord }`
- Store will throw error if response format is invalid (line 67-68 in directoryStore.tsx)
- Follow existing code patterns - consistency is important
- If database schema is missing, coordinate with DB/SCHEMA agent

---

## Questions/Blockers

If you encounter:
- **Missing database schema:** Note this and request DB/SCHEMA agent to provide schema or create migration
- **Unclear field mappings:** Check DirectoryRecord type, verify with DirectoryForm data structure
- **Authentication issues:** Follow pattern from orders/create route

---

**Complete this task and report back with:**
1. What you implemented
2. Any blockers or issues encountered
3. Testing results
4. Whether schema information was needed from DB/SCHEMA agent

