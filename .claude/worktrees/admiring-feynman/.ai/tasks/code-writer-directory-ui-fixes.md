# PROMPT FOR CODE WRITER AGENT

**Task:** Fix Directory UI issues - edit navigation, remove Status/View columns, make search instant

---

## Problems to Fix

### Problem 1: Cannot access record for editing
**Issue:** After clicking on a record in the list, cannot access edit page.

**Root Cause:** `app/directory/[id]/page.tsx` has TODO comment - doesn't load record from API, only from local store which is empty.

### Problem 2: Remove Status and View columns
**Issue:** User doesn't want Status column and View button displayed.

**Root Cause:** `app/directory/page.tsx` displays Status column (lines 65, 101-111) and View button (lines 112-119).

### Problem 3: Search should work immediately (no debounce delay)
**Issue:** Search has debounce delay (200ms), user wants instant search as they type.

**Root Cause:** `components/DirectorySearchPopover.tsx` uses `useDebounce` hook with 200ms delay (lines 22, 24, 26, 28).

---

## Implementation Requirements

### Fix 1: Load record from API in detail page

**File:** `app/directory/[id]/page.tsx`

**Current code (lines 18-25):**
```tsx
useEffect(() => {
  // TODO: Load record from API
  const found = getRecordById(id);
  if (found) {
    setRecord(found);
  }
  setLoading(false);
}, [id, getRecordById]);
```

**Replace with:**
```tsx
useEffect(() => {
  const loadRecord = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/directory/${id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch directory record");
      }
      const result = await response.json();
      if (result.error) {
        throw new Error(result.error);
      }
      setRecord(result.record || null);
    } catch (error) {
      console.error("Error loading directory record:", error);
      setRecord(null); // Show "Record not found" message
    } finally {
      setLoading(false);
    }
  };
  
  loadRecord();
}, [id]);
```

**Reference:** Check `app/api/directory/[id]/route.ts` for response format: `{ record: DirectoryRecord }`

---

### Fix 2: Remove Status column and View button, make rows clickable

**File:** `app/directory/page.tsx`

**Changes needed:**

1. **Remove Status column header** (line 65):
   - Delete: `<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>`

2. **Remove Status column cell** (lines 101-111):
   - Delete the entire `<td>` with Status badge

3. **Remove Actions column header** (line 66):
   - Delete: `<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>`

4. **Remove View button** (lines 112-119):
   - Delete the entire `<td>` with View button

5. **Make table row clickable** (line 76):
   - Add `onClick` handler to `<tr>` element
   - Add `cursor-pointer` class to indicate clickability
   - Navigate to `/directory/${record.id}` on row click

**Updated row code should be:**
```tsx
<tr 
  key={record.id} 
  className="hover:bg-gray-50 cursor-pointer"
  onClick={() => router.push(`/directory/${record.id}`)}
>
  {/* ... existing cells without Status and Actions columns ... */}
</tr>
```

---

### Fix 3: Remove debounce from search (instant search)

**File:** `components/DirectorySearchPopover.tsx`

**Current code uses debounce:**
```tsx
const debouncedName = useDebounce(nameValue, 200);
const debouncedPersonalCode = useDebounce(personalCodeValue, 200);
const debouncedPhone = useDebounce(phoneValue, 200);
const debouncedEmail = useDebounce(emailValue, 200);
```

**Changes needed:**

1. **Remove debounce for instant updates:**
   - Replace `debouncedName` with `nameValue` directly
   - Replace `debouncedPersonalCode` with `personalCodeValue` directly
   - Replace `debouncedPhone` with `phoneValue` directly
   - Replace `debouncedEmail` with `emailValue` directly

2. **Update useEffect hooks** (lines 89-103):
   - Change from using `debouncedName` etc. to using `nameValue` etc. directly
   - Remove dependency on debounced values

**Updated code:**
```tsx
// Remove debounce declarations (lines 22, 24, 26, 28)
// Keep only local state:
const [nameValue, setNameValue] = useState(filters.name);
const [personalCodeValue, setPersonalCodeValue] = useState(filters.personalCode);
const [phoneValue, setPhoneValue] = useState(filters.phone);
const [emailValue, setEmailValue] = useState(filters.email);

// Update useEffect hooks to use values directly:
useEffect(() => {
  directorySearchStore.getState().setName(nameValue);
}, [nameValue]);

useEffect(() => {
  directorySearchStore.getState().setPersonalCode(personalCodeValue);
}, [personalCodeValue]);

useEffect(() => {
  directorySearchStore.getState().setPhone(phoneValue);
}, [phoneValue]);

useEffect(() => {
  directorySearchStore.getState().setEmail(emailValue);
}, [emailValue]);
```

**Note:** You can remove `useDebounce` import if it's no longer used.

---

## Files to Modify

1. **`app/directory/[id]/page.tsx`** - Load record from API
2. **`app/directory/page.tsx`** - Remove Status/View columns, make rows clickable
3. **`components/DirectorySearchPopover.tsx`** - Remove debounce for instant search

---

## Acceptance Criteria

- [ ] Clicking on a directory record row navigates to edit page (`/directory/[id]`)
- [ ] Edit page loads record from API and displays correctly
- [ ] Status column is removed from directory list table
- [ ] View button is removed from directory list table
- [ ] Table rows are clickable (cursor changes to pointer on hover)
- [ ] Search filters update immediately as user types (no delay)
- [ ] TypeScript compiles without errors
- [ ] No console errors in browser

---

## Testing Steps

1. **Edit navigation:**
   - Go to `/directory`
   - Click on any record row
   - Should navigate to `/directory/[id]` and load record for editing

2. **UI cleanup:**
   - Go to `/directory`
   - Verify Status column is not visible
   - Verify View button is not visible
   - Verify rows are clickable (cursor changes on hover)

3. **Instant search:**
   - Open search popover (if exists on page)
   - Type in search field
   - Verify search filters update immediately without delay

---

## Notes

- Detail page API endpoint exists: `GET /api/directory/[id]` returns `{ record: DirectoryRecord }`
- Removing debounce will cause more frequent store updates - this is acceptable per user requirement
- Making rows clickable improves UX (fewer clicks needed)
- Removing Status column simplifies table (user doesn't need it visible)

---

**Complete this task and report back with:**
1. What you implemented
2. Any blockers or issues encountered
3. Testing results
4. Whether all three issues are resolved

