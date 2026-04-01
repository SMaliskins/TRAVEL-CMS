# PROMPT FOR CODE WRITER AGENT

**Task:** Implement directory list loading on `/directory` page

---

## Problem

After creating a directory record via `/directory/new`, the record is successfully created in the database, but it does not appear in the list on `/directory` page.

**Root Cause:** The `/directory` page (`app/directory/page.tsx`) has a TODO comment and does not actually fetch records from the API.

---

## Current State

### ✅ Working:
- API endpoint `/api/directory/create` - **IMPLEMENTED** (creates records successfully)
- API endpoint `/api/directory/route.ts` (GET) - **IMPLEMENTED** (returns records correctly)
- Store has `CREATE_RECORD` action that adds to local state

### ❌ Not Working:
- `app/directory/page.tsx` - Has TODO comment, doesn't fetch records
- Store doesn't have a function to fetch/load records from API
- After creating record and navigating to list, records don't appear

---

## Implementation Requirements

### 1. Add fetchRecords function to Store

**File:** `lib/directory/directoryStore.tsx`

Add a new function to fetch records from API:
- Function name: `fetchRecords` or `loadRecords`
- Should call `GET /api/directory` endpoint using `fetchWithAuth`
- Should parse response: `{ data: DirectoryRecord[], total: number, page: number, limit: number }`
- Should dispatch `SET_RECORDS` action with fetched records
- Should handle errors appropriately

**Interface update:**
```typescript
interface DirectoryContextType {
  state: DirectoryState;
  createRecord: (record: Omit<DirectoryRecord, "id" | "createdAt">) => Promise<DirectoryRecord>;
  fetchRecords: () => Promise<void>; // NEW
  updateRecord: (id: string, patch: Partial<DirectoryRecord>) => void;
  getRecordById: (id: string) => DirectoryRecord | undefined;
}
```

### 2. Implement loading in Directory Page

**File:** `app/directory/page.tsx`

Replace the TODO with actual implementation:
- Use `useDirectoryStore()` hook to get `fetchRecords` function
- Call `fetchRecords()` in `useEffect` on component mount
- Display loading state while fetching
- Display records in a table/list format
- Handle empty state (no records)
- Handle errors

**Reference:** Check `app/api/directory/route.ts` to understand response format:
- Response: `{ data: DirectoryRecord[], total: number, page: number, limit: number }`

### 3. Update Store after Creation

**Optional but recommended:** After creating a record, refresh the list automatically if user is on list page, OR ensure the created record is properly added to store (currently it is, but the record returned from API might be incomplete).

**Check:** The API `/api/directory/create` returns:
```json
{
  "ok": true,
  "record": {
    "id": "...",
    "display_name": "..."
  }
}
```

This is incomplete - it should return full `DirectoryRecord`. But for now, you can either:
- Fetch full record after creation, OR
- Just refresh the list after creation

---

## Files to Modify

1. **Primary:** `lib/directory/directoryStore.tsx` - Add `fetchRecords` function
2. **Primary:** `app/directory/page.tsx` - Implement actual loading and display

### Files to Reference
- `app/api/directory/route.ts` - See GET endpoint implementation and response format
- `app/api/directory/create/route.ts` - See how `fetchWithAuth` is used
- `lib/http/fetchWithAuth.ts` - Authentication helper

---

## Acceptance Criteria

- [ ] `/directory` page loads records from API on mount
- [ ] Records are displayed in a table or list format
- [ ] Loading state is shown while fetching
- [ ] Empty state is shown when no records exist
- [ ] Error handling works (shows error message if fetch fails)
- [ ] After creating a record and navigating to `/directory`, the new record appears in the list
- [ ] TypeScript compiles without errors
- [ ] No console errors in browser

---

## Implementation Steps

1. **Add fetchRecords to Store:**
   - Add function to `DirectoryProvider` component
   - Use `fetchWithAuth` to call `GET /api/directory`
   - Parse response and dispatch `SET_RECORDS` action
   - Handle errors

2. **Update Directory Page:**
   - Import `useDirectoryStore` hook
   - Get `fetchRecords` function and `state.records` from store
   - Call `fetchRecords()` in `useEffect` on mount
   - Display records (create table/list UI)
   - Show loading and error states

3. **Test:**
   - Create a record via `/directory/new`
   - Navigate to `/directory`
   - Verify record appears in list
   - Test loading state
   - Test empty state
   - Test error handling

---

## Notes

- API endpoint `/api/directory` (GET) is already implemented and working
- Response format: `{ data: DirectoryRecord[], total: number, page: number, limit: number }`
- Store already has `SET_RECORDS` action - just need to call it
- Consider adding pagination later (API supports it, but for now just load all records)
- The create API returns incomplete record - you may need to fetch full record or refresh list after creation

---

## Questions/Blockers

If you encounter:
- **API response format issues:** Check `app/api/directory/route.ts` for exact format
- **Authentication issues:** Follow pattern from `createRecord` function
- **Store state issues:** Ensure `SET_RECORDS` action is dispatched correctly

---

**Complete this task and report back with:**
1. What you implemented
2. Any blockers or issues encountered
3. Testing results
4. Whether records now appear in the list after creation

