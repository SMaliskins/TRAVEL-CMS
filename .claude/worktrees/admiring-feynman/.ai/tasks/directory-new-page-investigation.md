# TASK: Directory New Page Investigation and Fix

**Created:** 2025-01-02  
**Status:** TODO  
**Assigned to:** CODE WRITER  
**Priority:** High

---

## Problem Description

User reports issue with `/directory/new` page. Need to investigate what is not working and fix it.

---

## Initial Analysis

### Current State

1. **Page Structure:**
   - `app/directory/new/page.tsx` uses `useDirectoryStore()` hook
   - DirectoryProvider is correctly wrapped in `app/directory/layout.tsx`
   - Form uses `DirectoryForm` component with proper refs and callbacks

2. **API Endpoint:**
   - `app/api/directory/create/route.ts` exists but contains only TODO/501 stub
   - Returns: `{ error: "Directory creation not yet implemented" }`
   - Status: 501 Not Implemented

3. **Store Implementation:**
   - `lib/directory/directoryStore.tsx` has `createRecord` function
   - Calls `/api/directory/create` endpoint
   - Expects response format: `{ ok: true, record: DirectoryRecord }`
   - Throws error if response format is invalid

### Likely Issues

1. **API Not Implemented:** The `/api/directory/create` endpoint returns 501 error
2. **Error Handling:** User may see error messages but unclear what exactly
3. **Data Format:** Need to verify what data format DirectoryForm sends vs what API expects

---

## Investigation Steps

1. **Check Browser Console:** What errors appear when accessing `/directory/new`?
2. **Check Network Tab:** What happens when form is submitted?
3. **Verify API Response:** Check what `/api/directory/create` actually returns
4. **Check Data Format:** Verify DirectoryForm sends correct data structure
5. **Check Type Definitions:** Ensure DirectoryRecord type matches API expectations

---

## Expected Issues to Fix

### Issue 1: API Endpoint Not Implemented (CRITICAL)
- **File:** `app/api/directory/create/route.ts`
- **Current State:** Returns 501 with "not yet implemented" message
- **Required:** Full implementation of POST handler
- **Dependencies:** 
  - Database schema (need to check what tables exist)
  - Field mapping (need to verify DirectoryRecord → DB mapping)
  - Authentication/authorization (use fetchWithAuth suggests auth needed)

### Issue 2: Data Format Validation (POTENTIAL)
- **File:** `components/DirectoryForm.tsx`
- **Check:** Does form data match DirectoryRecord type?
- **Check:** Does form data match what API expects?
- **Action:** Verify mapping between form fields and API payload

### Issue 3: Error Handling (POTENTIAL)
- **File:** `app/directory/new/page.tsx`
- **Check:** Are errors displayed correctly to user?
- **Check:** Is error message helpful?

---

## Acceptance Criteria

- [ ] `/directory/new` page loads without errors
- [ ] Form can be filled out
- [ ] Form validation works correctly
- [ ] Submitting form successfully creates record in database
- [ ] After creation, user is redirected appropriately (based on "Save" vs "Save & Close")
- [ ] Error messages are clear and helpful if creation fails
- [ ] New record appears in directory list after creation

---

## Files to Investigate

1. `app/api/directory/create/route.ts` - API endpoint (likely needs implementation)
2. `app/directory/new/page.tsx` - Page component (check error handling)
3. `components/DirectoryForm.tsx` - Form component (check data format)
4. `lib/directory/directoryStore.tsx` - Store (check error handling)
5. `lib/types/directory.ts` - Type definitions (verify structure)
6. Database schema files - Verify table structure exists

---

## Next Steps

1. CODE WRITER should:
   - Access `/directory/new` page in browser
   - Check browser console for errors
   - Check network tab when submitting form
   - Identify exact error/problem
   - Implement fix based on investigation

2. If API needs implementation:
   - Check database schema for directory tables
   - Implement POST handler in `/api/directory/create/route.ts`
   - Follow existing API patterns in project
   - Use proper authentication (supabaseAdmin pattern if exists)
   - Return correct response format: `{ ok: true, record: DirectoryRecord }`

---

## Notes

- DirectoryProvider is correctly set up in layout
- Store implementation looks correct (calls API, handles response)
- Main issue is likely the unimplemented API endpoint
- Need to verify database schema exists before implementing API

---

## Related Files

- `.ai/PROJECT_RULES.md` - Agent coordination rules
- `.ai/ISSUES_AND_SOLUTIONS.md` - For documenting any issues found

