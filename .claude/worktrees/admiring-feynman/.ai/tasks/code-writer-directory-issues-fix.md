# PROMPT FOR CODE WRITER AGENT

**Task:** Fix 3 Directory issues - remove duplicate search, fix record not found, restore Save buttons

---

## Problems to Fix

### Problem 1: Search is duplicated - should only be in TopBar
**Issue:** Search input appears twice - once in TopBar and once on directory page. Should only be in TopBar.

**Investigation needed:** Check where DirectorySearchPopover or search input is rendered on `/directory` page.

### Problem 2: Record not found by ID
**Issue:** Cannot access record at `/directory/4642eea4-38ed-464d-866c-3d2bea38235e` - shows "Record not found".

**Possible causes:**
- API endpoint `/api/directory/[id]` not working correctly
- Record doesn't exist in database
- Authentication/authorization issue
- ID format issue

### Problem 3: Save / Save and Close buttons missing
**Issue:** On edit page `/directory/2a2c03de-ede4-498a-8ff2-ea2057396169`, buttons "Save" and "Save and Close" are not displayed.

**Investigation needed:** Check DirectoryForm component - buttons should be rendered but are missing.

---

## Implementation Requirements

### Fix 1: Remove duplicate search from directory page

**File:** `app/directory/page.tsx`

**Current code (lines 76-79):**
```tsx
{/* Search */}
<div className="mb-6">
  <DirectorySearchPopover inputRef={searchInputRef} />
</div>
```

**Actions:**
1. Remove the entire search section (lines 76-79)
2. Remove import: `import DirectorySearchPopover from "@/components/DirectorySearchPopover";` (line 6)
3. Remove unused ref: `const searchInputRef = useRef<HTMLInputElement>(null);` (line 11)
4. Keep directorySearchStore subscription for filters (needed for API calls)

**Note:** Search already exists in TopBar via `TopBarSearch` component which renders `DirectorySearchPopover` for directory pages. No need to duplicate it on the page itself.

---

### Fix 2: Fix record not found issue

**File:** `app/directory/[id]/page.tsx`

**Current code (line 22):**
```tsx
const response = await fetch(`/api/directory/${id}`);
```

**Problem:** Using plain `fetch` without authentication. API endpoint requires authentication.

**Fix:**
1. Import `fetchWithAuth`: `import { fetchWithAuth } from "@/lib/http/fetchWithAuth";`
2. Replace `fetch` with `fetchWithAuth`:
```tsx
const response = await fetchWithAuth(`/api/directory/${id}`);
```

**Reference:** Check `app/directory/new/page.tsx` or `lib/directory/directoryStore.tsx` for pattern of using `fetchWithAuth`.

---

### Fix 3: Restore Save / Save and Close buttons

**File:** `app/directory/[id]/page.tsx`

**Problem:** Edit page doesn't have Save/Save and Close buttons in header like the new page does.

**Reference:** `app/directory/new/page.tsx` has buttons in header (lines 149-207). Edit page needs similar implementation.

**Current state:** 
- `app/directory/[id]/page.tsx` only renders DirectoryForm, no buttons
- `app/directory/new/page.tsx` has full header with buttons, error handling, dirty state, etc.
- DirectoryForm uses `forwardRef` and exposes `submit(closeAfterSave: boolean)` via `useImperativeHandle`
- Parent component should render buttons and call `formRef.current?.submit()`

**Fix:** Copy button implementation pattern from `app/directory/new/page.tsx` to `app/directory/[id]/page.tsx`.

**Required changes:**
1. Add state for form validation, dirty state, saving state, errors (like new page)
2. Add header with buttons (Cancel, Save, Save & Close) similar to new page
3. Add handlers: `handleSave`, `handleSaveAndClose`, `handleCancel`
4. Add `onValidationChange` and `onDirtyChange` props to DirectoryForm
5. Update `handleSubmit` to match new page pattern (with error handling, success state, etc.)

**Reference implementation:** See `app/directory/new/page.tsx` lines 12-82, 124-209 for complete pattern.

**Simplified version (if full pattern too complex):**
- At minimum, add buttons in header that call `formRef.current?.submit(false)` and `formRef.current?.submit(true)`
- But full pattern from new page is recommended for consistency

---

## Files to Modify

1. **`app/directory/page.tsx`** - Remove duplicate search (lines 6, 11, 76-79)
2. **`app/directory/[id]/page.tsx`** - Use fetchWithAuth for API call, add Save buttons
3. **`app/directory/new/page.tsx`** - Check if needs Save buttons (verify current implementation)

## Files to Reference

- **`components/TopBarSearch.tsx`** - Shows DirectorySearchPopover is already in TopBar
- **`lib/http/fetchWithAuth.ts`** - Authentication helper
- **`app/directory/new/page.tsx`** - Check button pattern (if exists)

---

## Acceptance Criteria

- [ ] Search appears only in TopBar, not duplicated on directory page
- [ ] Records can be accessed by ID (e.g., `/directory/4642eea4-38ed-464d-866c-3d2bea38235e`)
- [ ] Save and Save and Close buttons are visible and functional on edit page
- [ ] No console errors in browser
- [ ] TypeScript compiles without errors

---

## Testing Steps

1. **Search duplication:**
   - Go to `/directory`
   - Verify search appears only in TopBar
   - Verify no duplicate search on page

2. **Record access:**
   - Try accessing `/directory/4642eea4-38ed-464d-866c-3d2bea38235e`
   - Should load record for editing
   - Check browser console for errors
   - Check network tab for API call

3. **Save buttons:**
   - Go to any record edit page (e.g., `/directory/2a2c03de-ede4-498a-8ff2-ea2057396169`)
   - Verify "Save" and "Save and Close" buttons are visible
   - Verify buttons are clickable
   - Test that buttons work correctly

---

## Notes

- Search should only be in TopBar (global navigation)
- API endpoint `/api/directory/[id]` should return `{ record: DirectoryRecord }`
- DirectoryForm buttons should always be visible in edit mode
- Use `fetchWithAuth` if authentication is required for API calls

---

**Complete this task and report back with:**
1. What you found and fixed for each issue
2. Root cause of each problem
3. Any blockers or issues encountered
4. Testing results

