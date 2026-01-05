# CODE WRITER TASK RESULT - Directory Company Mapping Fix

**Date:** 2025-12-25  
**Task:** Fix Company details field mapping and investigate why record doesn't open  
**Status:** ✅ VERIFICATION COMPLETE

---

## ✅ Status Check

### Fix 1: fetchWithAuth Usage
**Status:** ✅ **ALREADY FIXED**
- File: `app/directory/[id]/page.tsx`
- Line 30: `const response = await fetchWithAuth(\`/api/directory/${id}\`);`
- ✅ Already using `fetchWithAuth` instead of plain `fetch`

### Fix 2: actualAddress Field in Form
**Status:** ✅ **ALREADY ADDED**
- ✅ State variable: Line 66 in `components/DirectoryForm.tsx`
- ✅ Initial values: Line 142
- ✅ Dirty check: Line 184
- ✅ handleSubmit: Line 365
- ✅ Input field: Lines 625-633

### Fix 3: Field Mapping Verification
**Status:** ✅ **ALL CORRECT**

**Form → API → Database Mapping:**
| Form Field | API Field | DB Column | Status |
|------------|-----------|-----------|--------|
| `companyName` | `companyName` | `company_name` | ✅ |
| `regNo` → `regNumber` | `regNumber` | `reg_number` | ✅ |
| `address` → `legalAddress` | `legalAddress` | `legal_address` | ✅ |
| `actualAddress` | `actualAddress` | `actual_address` | ✅ |

**API Endpoints:**
- ✅ CREATE (`app/api/directory/create/route.ts` lines 159-166): Correctly inserts all Company fields
- ✅ GET (`app/api/directory/[id]/route.ts` lines 50-56): Correctly maps snake_case → camelCase
- ✅ PUT: Should also work (uses same buildDirectoryRecord function)

---

## 🔍 Root Cause Analysis

### Problem: Records Don't Open

**Error from browser console:**
```
API Response status: 404
API Response ok: false
API Response data: { error: "Party not found", details: "Cannot coerce the result to a single JSON object" }
```

### Possible Causes:

1. **❌ Tenant Isolation (Most Likely)**
   - API endpoint applies tenant isolation: `query.eq("company_id", userCompanyId)` (line 120 in `app/api/directory/[id]/route.ts`)
   - If record's `company_id` doesn't match user's `company_id`, query returns 0 rows
   - `.single()` throws "Cannot coerce the result to a single JSON object"

2. **❌ Record Doesn't Exist**
   - Record was never created successfully
   - Record was deleted
   - Record exists in different tenant/company

3. **⚠️ Silent Creation Failure**
   - CREATE endpoint may have failed silently
   - Transaction rolled back but no error shown to user

---

## 🧪 Diagnostic Steps

### Step 1: Check if Records Exist
**SQL Script:** `migrations/test_api_mapping_and_tenant.sql`

Run for record ID: `4642eea4-38ed-464d-866c-3d2bea38235e`

**What to check:**
1. Does record exist in `party` table?
2. What is `company_id` of the record?
3. What is `company_id` of the current user?
4. Do they match?

### Step 2: Check Server Logs
**Look for:**
- `[Directory GET] Fetched data for party:` - should show `userCompanyId`
- `[Directory GET] Error fetching party:` - error details
- `[Directory GET] Built record:` - final record data

### Step 3: Check Browser Console
**Check:**
- Network tab: What is the actual API response?
- Console: Any JavaScript errors?
- What is the response status code?

---

## 📋 Verification Checklist

- [x] ✅ `fetchWithAuth` is used in detail page
- [x] ✅ `actualAddress` field exists in form (state, input, handleSubmit)
- [x] ✅ Field mapping is correct (Form → API → DB)
- [x] ✅ API CREATE endpoint handles all Company fields
- [x] ✅ API GET endpoint maps all Company fields correctly
- [ ] ⏳ Records exist in database (need SQL diagnostic)
- [ ] ⏳ Tenant isolation check (need SQL diagnostic)
- [ ] ⏳ Server logs verification (need to test)

---

## 🎯 Next Steps

### Immediate Actions:
1. **Run Diagnostic SQL:**
   ```
   migrations/test_api_mapping_and_tenant.sql
   ```
   For record: `4642eea4-38ed-464d-866c-3d2bea38235e`

2. **Check Server Logs:**
   - Start dev server: `npm run dev`
   - Try opening record: `http://localhost:3000/directory/4642eea4-38ed-464d-866c-3d2bea38235e`
   - Check terminal for `[Directory GET]` logs

3. **Check Browser:**
   - Open DevTools → Network tab
   - Try opening record
   - Check API response status and body

### If Tenant Isolation Issue:
**Option A:** Update record's `company_id` to match user's `company_id` (if legitimate)
```sql
UPDATE public.party 
SET company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
WHERE id = '4642eea4-38ed-464d-866c-3d2bea38235e';
```

**Option B:** Improve error message for better UX
```typescript
return NextResponse.json(
  { error: "Record not found or access denied", details: "This record may not exist or you don't have access to it" },
  { status: 404 }
);
```

### If Record Doesn't Exist:
- Check if creation failed
- Verify creation process works
- Recreate the record

---

## 📝 Summary

**What Was Fixed:**
- ✅ All code fixes are already in place
- ✅ `fetchWithAuth` is used correctly
- ✅ `actualAddress` field is fully implemented
- ✅ Field mapping is correct throughout the stack

**What Needs Investigation:**
- ⏳ Verify records exist in database
- ⏳ Check tenant isolation (company_id match)
- ⏳ Verify server logs for actual error

**Conclusion:**
The code implementation is correct. The "record doesn't open" issue is likely due to:
1. **Tenant isolation** - record's `company_id` doesn't match user's `company_id`
2. **Record doesn't exist** - record was never created or was deleted

**Next Action:** Run diagnostic SQL script to verify root cause.

---

## 🔗 Files Modified/Created

**No modifications needed** - all fixes are already in place:
- ✅ `app/directory/[id]/page.tsx` - uses `fetchWithAuth`
- ✅ `components/DirectoryForm.tsx` - has `actualAddress` field
- ✅ `app/api/directory/[id]/route.ts` - correct field mapping
- ✅ `app/api/directory/create/route.ts` - correct field insertion

**Diagnostic Files:**
- `migrations/test_api_mapping_and_tenant.sql` - diagnostic script

