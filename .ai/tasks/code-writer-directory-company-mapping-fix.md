image.png# PROMPT FOR CODE WRITER AGENT

**Task:** Fix Company details field mapping and investigate why record doesn't open

---

## Problem

Records with IDs `4642eea4-38ed-464d-866c-3d2bea38235e` (Gulliver Travel) and `5bbdd5f0-2d4f-4e7b-86d1-13940e95fde6` were created but don't open when accessed.

**User reports:** 
- "был добавлен, но не открывается" (4642eea4-38ed-464d-866c-3d2bea38235e)
- "так и не открывается" (5bbdd5f0-2d4f-4e7b-86d1-13940e95fde6)

Need to:
1. Check Company details field mapping between Form and Database
2. Investigate why the record doesn't load/open correctly

---

## Investigation Steps

### Step 1: Check Field Mapping

**File:** `.ai/DIRECTORY_FORM_DB_MAPPING.md`

Check if Company fields are correctly mapped:
- Form field names vs DB column names
- API field names vs DB column names

**Expected mapping:**
- Form: `regNumber` → API: `regNumber` → DB: `reg_number`
- Form: `legalAddress` → API: `legalAddress` → DB: `legal_address`
- Form: `actualAddress` → API: `actualAddress` → DB: `actual_address`

### Step 2: Check DirectoryForm State Variables

**File:** `components/DirectoryForm.tsx`

**Current state (lines 62-66):**
```tsx
const [companyName, setCompanyName] = useState(record?.companyName || "");
const [regNo, setRegNo] = useState(record?.regNumber || "");
const [address, setAddress] = useState(record?.legalAddress || "");
```

**Issues found:**
- State variable: `regNo` but type uses: `regNumber` ✅ (correctly mapped in handleSubmit)
- State variable: `address` but type uses: `legalAddress` ⚠️ (check mapping)

**Check handleSubmit (line 359-361):**
```tsx
formData.companyName = companyName;
formData.regNumber = regNo || undefined;
formData.legalAddress = address || undefined;
```

### Step 3: Check API GET Endpoint

**File:** `app/api/directory/[id]/route.ts`

Check if Company fields are correctly fetched and returned:
- Verify `party_company` table fields are mapped correctly
- Check response format matches DirectoryRecord type

**Check buildDirectoryRecord function:**
- Should map `reg_number` → `regNumber`
- Should map `legal_address` → `legalAddress`
- Should map `actual_address` → `actualAddress`

### Step 4: Check API CREATE Endpoint

**File:** `app/api/directory/create/route.ts`

Check if Company fields are correctly inserted:
- Verify field names match database columns
- Check all Company fields are included

---

## Potential Issues

### Issue 1: Missing actualAddress Field in Form ⚠️ **CRITICAL**

**Problem:** Form does NOT have `actualAddress` field, but:
- DirectoryRecord type has `actualAddress` (lib/types/directory.ts line 35)
- API endpoints handle `actualAddress` (create, GET, PUT all support it)
- Database has `actual_address` column

**Current state in DirectoryForm.tsx:**
- NO state variable for `actualAddress`
- NO input field for `actualAddress` in Company section
- Only has `address` state which maps to `legalAddress`

**Impact:** 
- `actualAddress` cannot be set when creating records
- `actualAddress` is not displayed when editing records
- Data mismatch between what API returns and what form shows

**Fix needed:**
- Add `actualAddress` state variable
- Add `actualAddress` input field in Company section
- Include `actualAddress` in handleSubmit

### Issue 2: Record Not Opening - fetchWithAuth Issue

**Problem:** Previous task identified that `app/directory/[id]/page.tsx` uses plain `fetch` instead of `fetchWithAuth`.

**Check:** Line 22 in app/directory/[id]/page.tsx
```tsx
const response = await fetch(`/api/directory/${id}`);
```

**Status:** Should use `fetchWithAuth` for authentication (from task #4).

**This might be the root cause of "record doesn't open" issue!**

### Issue 3: Field Name Mapping (Minor)

**Problem:** Form uses `address` state variable but should map to `legalAddress` in DirectoryRecord type.

**Check:** Line 65 in DirectoryForm.tsx
```tsx
const [address, setAddress] = useState(record?.legalAddress || "");
```

**Status:** ✅ Correctly mapped in handleSubmit (line 361) - this is OK.

**Check:**
- Does DirectoryForm have `actualAddress` input field?
- Is `actualAddress` included in form state?
- Is `actualAddress` sent to API when creating/updating?

### Issue 3: API Response Format

**Problem:** API might not return Company fields correctly, causing record not to load.

**Check:**
- Does GET `/api/directory/[id]` return all Company fields?
- Are field names correctly mapped (snake_case → camelCase)?

### Issue 4: Record Not Found Error

**Problem:** Record exists but API returns error or empty response.

**Check:**
- Is record actually in database?
- Does API endpoint handle Company records correctly?
- Are there any errors in browser console or network tab?

---

## Files to Check

1. **`.ai/DIRECTORY_FORM_DB_MAPPING.md`** - Verify Company field mapping
2. **`components/DirectoryForm.tsx`** - Check Company field state and mapping
3. **`app/api/directory/[id]/route.ts`** - Check GET endpoint for Company fields
4. **`app/api/directory/create/route.ts`** - Check CREATE endpoint for Company fields
5. **`lib/types/directory.ts`** - Verify DirectoryRecord type for Company fields

---

## Implementation Requirements

### Fix 1: Verify and Fix Field Mapping

**Check mapping in:**
- Form state variables → DirectoryRecord type fields
- DirectoryRecord type → API request/response
- API request/response → Database columns

**Ensure consistency:**
- `companyName` → `company_name` ✅
- `regNumber` → `reg_number` ✅
- `legalAddress` → `legal_address` ✅
- `actualAddress` → `actual_address` ⚠️ (verify exists)

### Fix 2: Add Missing actualAddress Field ⚠️ **REQUIRED**

**File:** `components/DirectoryForm.tsx`

**Add state variable (around line 65, after address):**
```tsx
const [actualAddress, setActualAddress] = useState(record?.actualAddress || "");
```

**Add input field in Company section (around line 568, after Address field):**
```tsx
<div>
  <label className="mb-1 block text-sm font-medium text-gray-700">
    Actual address
  </label>
  <input
    type="text"
    value={actualAddress}
    onChange={(e) => setActualAddress(e.target.value)}
    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
  />
</div>
```

**Update handleSubmit (around line 361, after legalAddress):**
```tsx
formData.legalAddress = address || undefined;
formData.actualAddress = actualAddress || undefined;
```

**Update initialValues (around line 140, after legalAddress):**
```tsx
legalAddress: record.legalAddress,
actualAddress: record.actualAddress,
```

**Update dirty state check (around line 181, after address check):**
```tsx
address.trim() !== (initialValues.legalAddress || "").trim() ||
actualAddress.trim() !== (initialValues.actualAddress || "").trim()
```

### Fix 3: Fix Record Loading (Use fetchWithAuth)

**File:** `app/directory/[id]/page.tsx`

**This is likely the MAIN reason record doesn't open!**

**Current code (line 22):**
```tsx
const response = await fetch(`/api/directory/${id}`);
```

**Fix (from task #4):**
```tsx
import { fetchWithAuth } from "@/lib/http/fetchWithAuth";

// In loadRecord function:
const response = await fetchWithAuth(`/api/directory/${id}`);
```

**Note:** This fix is already documented in task #4 (.ai/tasks/code-writer-directory-issues-fix.md), but it's critical for this issue too.

### Fix 4: Debug Record Loading (Additional Checks)

**✅ CONSOLE OUTPUT RECEIVED:**

For record `5bbdd5f0-2d4f-4e7b-86d1-13940e95fde6`:
```
API Response status: 404
API Response ok: false
API Response data: { error: "Party not found", details: "Cannot coerce the result to a single JSON object" }
```

**Root cause identified:** The `.single()` method in API endpoint is failing, which means:
- Either record doesn't exist in database
- OR record exists but tenant isolation filters it out (company_id mismatch)

**For the problematic record IDs `4642eea4-38ed-464d-866c-3d2bea38235e` and `5bbdd5f0-2d4f-4e7b-86d1-13940e95fde6`:**

1. **✅ CONSOLE CHECK COMPLETE:** Browser console shows:
   - Status: 404
   - Error: "Party not found"
   - Details: "Cannot coerce the result to a single JSON object"
   
   This confirms the `.single()` method in API endpoint is failing (line 124 in app/api/directory/[id]/route.ts).

2. **Root Cause Analysis:**
   - The error "Cannot coerce the result to a single JSON object" from Supabase `.single()` means:
     - Query returned 0 rows (record doesn't exist OR tenant isolation filtered it out)
     - Query returned 2+ rows (shouldn't happen with UUID primary key, but possible)
   
3. **Most Likely Cause: Tenant Isolation**
   - API endpoint applies tenant isolation (line 120-122): `query.eq("company_id", userCompanyId)`
   - If record's `company_id` doesn't match user's `company_id`, query returns 0 rows
   - `.single()` then throws "Cannot coerce the result to a single JSON object"
   
4. **✅ DATABASE CHECK COMPLETE for 5bbdd5f0-2d4f-4e7b-86d1-13940e95fde6:**
   - **Result: RECORD DOES NOT EXIST** (count = 0, result = "❌ NOT FOUND")
   - This confirms the root cause: Record `5bbdd5f0-2d4f-4e7b-86d1-13940e95fde6` does not exist in the database
   - API 404 error is correct - the record truly doesn't exist
   - **NOT a tenant isolation issue** - record is simply missing from database

5. **Next Steps:**
   - **Check record 4642eea4-38ed-464d-866c-3d2bea38235e:** Run `migrations/test_api_mapping_and_tenant.sql` to verify if this record exists
   - **Investigate why records don't exist:**
     - Were they ever created successfully?
     - Were they deleted?
     - Did creation fail silently?
     - Check creation logs/errors
   - **If records were supposed to exist:** Need to investigate creation process
   - **If records should be recreated:** User may need to create them again
   
5. **Possible Solutions:**
   - **If tenant isolation is the issue:** 
     - Option A: Update record's `company_id` to match user's `company_id` (if legitimate)
     - Option B: Improve error message to indicate "Record not found or access denied" (better UX)
     - Option C: Check if records were created with wrong `company_id` (data integrity issue)
   - **If record doesn't exist:**
     - Check if record was deleted or never created
     - Verify creation process works correctly
   
6. **Check server logs:** Look for:
   - `[Directory GET] Error fetching party:` - should show the error details
   - `[Directory GET] Party not found:` - if record not found
   - Check what `userCompanyId` is logged (line 192 in API endpoint)

---

## Acceptance Criteria

- [ ] **CRITICAL:** Records `4642eea4-38ed-464d-866c-3d2bea38235e` and `5bbdd5f0-2d4f-4e7b-86d1-13940e95fde6` open successfully
- [ ] **REQUIRED:** actualAddress field added to form (state, input field, handleSubmit)
- [ ] All Company fields (companyName, regNumber, legalAddress, actualAddress) are correctly mapped
- [ ] Company records load and display correctly
- [ ] Form state variables correctly map to DirectoryRecord type
- [ ] actualAddress can be set when creating Company records
- [ ] actualAddress is displayed when editing Company records
- [ ] API endpoints correctly handle all Company fields (already working)
- [ ] No console errors when opening Company records

---

## Testing Steps

1. **Check mapping:**
   - Review DIRECTORY_FORM_DB_MAPPING.md for Company fields
   - Verify all fields are documented

2. **Test record opening:**
   - Try opening `/directory/4642eea4-38ed-464d-866c-3d2bea38235e`
   - Check browser console for errors
   - Check network tab - verify API response

3. **Test Company record creation:**
   - Create new Company record
   - Verify all fields save correctly
   - Open created record - verify all fields load correctly

4. **Test Company record editing:**
   - Open existing Company record
   - Edit fields
   - Save and verify changes persist

---

## Notes

- Record has Client and Supplier roles - ensure both are handled correctly
- Check if issue is specific to records with multiple roles
- Verify database schema matches expected fields
- Check if `actualAddress` field exists in database and form

---

**Complete this task and report back with:**
1. What mapping issues you found (if any)
2. Why the records don't open (root cause) - check browser console, network tab, server logs, and database
3. What you fixed
4. Testing results
5. Whether records now open successfully

**Diagnostic SQL scripts available:**
- `migrations/test_api_mapping_and_tenant.sql` (for 4642eea4-38ed-464d-866c-3d2bea38235e)
- `migrations/test_record_5bbdd5f0.sql` (for 5bbdd5f0-2d4f-4e7b-86d1-13940e95fde6) - **NEW**

**✅ BROWSER CONSOLE CHECKED:**
- Error: "Party not found", details: "Cannot coerce the result to a single JSON object"
- Status: 404
- This confirms `.single()` is failing, likely due to tenant isolation or record not existing

**Important:** 
- Run diagnostic SQL scripts to verify if records exist and check `company_id` values
- Compare record's `company_id` with user's `company_id` to confirm tenant isolation issue
- Check server logs for `[Directory GET]` messages to see what `userCompanyId` is being used

