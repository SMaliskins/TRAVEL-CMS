# PROMPT FOR CODE WRITER AGENT

**Task:** Fix Supplier role mapping issue - "Record not found" error when selecting Supplier role

---

## Problem

When user selects "Supplier" role in Directory form, immediately shows "Record not found" error.

**User report:** "как только его выбираешь, сразу надпись не может быть найдена - Record not found"

---

## Investigation Steps

### Step 1: Check Supplier Field Mapping in API CREATE Endpoint

**File:** `app/api/directory/create/route.ts` (lines 202-219)

**Current code:**
```typescript
if (data.roles.includes("supplier")) {
  const supplierData: any = { party_id: partyId, partner_role: 'supplier' };
  if (data.supplierExtras?.activityArea) {
    // Note: business_category field mapping - activityArea might need to be mapped
    // For now, storing in a generic way if needed
  }
  const { error: supplierError } = await supabaseAdmin.from("partner_party").insert(supplierData);
  // ...
}
```

**⚠️ CRITICAL ISSUE FOUND:**
- Line 204-207: Comment says "activityArea might need to be mapped" but **`business_category` is NOT added to `supplierData`!**
- According to DB_SCHEMA_VERIFICATION_REPORT.md, `partner_party` table has `business_category` column
- Form sends `supplierExtras.activityArea`, but API doesn't map it to `business_category`
- This may cause validation error or constraint violation

### Step 2: Check Database Schema

**From DB_SCHEMA_VERIFICATION_REPORT.md:**
- Table: `partner_party`
- Column: `business_category` (text, nullable)
- Constraint: `CHECK (business_category IN ('TO', 'Hotel', 'Rent a car', 'Airline', 'DMC', 'Other'))`
- Default: NULL

**Mapping:**
- Form: `supplierActivityArea` → API: `supplierExtras.activityArea` → DB: `business_category`

### Step 3: Check Form Submission

**File:** `components/DirectoryForm.tsx` (lines 396-400)

**Current code:**
```typescript
// Supplier details
if (roles.includes("supplier")) {
  formData.supplierExtras = {
    activityArea: supplierActivityArea || undefined,
  };
}
```

**Status:** ✅ Form correctly sends `supplierExtras.activityArea`

### Step 4: Check API GET Endpoint

**File:** `app/api/directory/[id]/route.ts` (lines 62-67)

**Current code:**
```typescript
// Supplier details
if (row.is_supplier && row.business_category) {
  record.supplierExtras = {
    activityArea: row.business_category,
  };
}
```

**Status:** ✅ API correctly maps `business_category` → `activityArea` when reading

### Step 5: Check API PUT Endpoint (Update)

**File:** `app/api/directory/[id]/route.ts` (lines 336-349)

**Current code:**
```typescript
if (updates.roles.includes("supplier")) {
  const supplierData: any = { party_id: id, partner_role: 'supplier' };
  if (updates.supplierExtras?.activityArea) {
    supplierData.business_category = updates.supplierExtras.activityArea;
  }
  const { error: supplierError } = await supabaseAdmin.from("partner_party").insert(supplierData);
  // ...
}
```

**Status:** ✅ PUT endpoint correctly maps `activityArea` → `business_category`

**Comparison:**
- ✅ PUT endpoint (line 339): `supplierData.business_category = updates.supplierExtras.activityArea;`
- ❌ CREATE endpoint (line 204-207): Only comment, NO mapping code!

---

## Root Cause Analysis

**Problem:** API CREATE endpoint doesn't map `supplierExtras.activityArea` to `business_category` when creating Supplier record.

**Impact:**
- If `business_category` has CHECK constraint requiring specific values, and form sends value not in constraint, INSERT fails
- If validation fails, party record is created but supplier record fails, causing cleanup (party deleted)
- User sees "Record not found" because party was deleted after supplier insert failure

**Evidence:**
- Line 204-207 in `app/api/directory/create/route.ts` has comment but NO actual mapping code
- `supplierData` only contains `party_id` and `partner_role`, missing `business_category`

---

## Fix Required

### Fix 1: Map activityArea to business_category in CREATE Endpoint

**File:** `app/api/directory/create/route.ts` (around line 204)

**Current code:**
```typescript
if (data.roles.includes("supplier")) {
  const supplierData: any = { party_id: partyId, partner_role: 'supplier' };
  if (data.supplierExtras?.activityArea) {
    // Note: business_category field mapping - activityArea might need to be mapped
    // For now, storing in a generic way if needed
  }
  const { error: supplierError } = await supabaseAdmin.from("partner_party").insert(supplierData);
```

**Fix:**
```typescript
if (data.roles.includes("supplier")) {
  const supplierData: any = { 
    party_id: partyId, 
    partner_role: 'supplier' 
  };
  
  // Map activityArea to business_category
  if (data.supplierExtras?.activityArea) {
    supplierData.business_category = data.supplierExtras.activityArea;
  }
  
  const { error: supplierError } = await supabaseAdmin.from("partner_party").insert(supplierData);
```

### Fix 2: Verify business_category Values Match Constraint

**Database constraint:** `CHECK (business_category IN ('TO', 'Hotel', 'Rent a car', 'Airline', 'DMC', 'Other'))`

**Check:** Does form allow user to select values that match this constraint?

**File:** `components/DirectoryForm.tsx` - Find supplier activity area input field

**If form allows free text input:**
- Need to validate against constraint values
- Or update constraint to allow any text
- Or add dropdown/select with constraint values

### Fix 3: Check PUT Endpoint (Update)

**File:** `app/api/directory/[id]/route.ts` - Check PUT handler

**Verify:** Does PUT endpoint correctly map `supplierExtras.activityArea` → `business_category` when updating?

---

## Files to Check

1. **`app/api/directory/create/route.ts`** - Fix supplier mapping (line 204-207)
2. **`app/api/directory/[id]/route.ts`** - Check PUT handler for supplier updates
3. **`components/DirectoryForm.tsx`** - Check supplier activity area input field (what values are allowed?)
4. **`.ai/DB_SCHEMA_VERIFICATION_REPORT.md`** - Verify business_category constraint values

---

## Implementation Requirements

### Fix 1: Add business_category Mapping in CREATE Endpoint (REQUIRED)

**File:** `app/api/directory/create/route.ts` (lines 202-219)

**Current code (WRONG):**
```typescript
if (data.roles.includes("supplier")) {
  const supplierData: any = { party_id: partyId, partner_role: 'supplier' };
  if (data.supplierExtras?.activityArea) {
    // Note: business_category field mapping - activityArea might need to be mapped
    // For now, storing in a generic way if needed
  }
  const { error: supplierError } = await supabaseAdmin.from("partner_party").insert(supplierData);
```

**Fix (copy pattern from PUT endpoint line 338-340):**
```typescript
if (data.roles.includes("supplier")) {
  const supplierData: any = { 
    party_id: partyId, 
    partner_role: 'supplier' 
  };
  
  // Map activityArea to business_category (same as PUT endpoint)
  if (data.supplierExtras?.activityArea) {
    supplierData.business_category = data.supplierExtras.activityArea;
  }
  
  const { error: supplierError } = await supabaseAdmin
    .from("partner_party")
    .insert(supplierData);
```

### Fix 2: Verify PUT Endpoint (ALREADY CORRECT)

**File:** `app/api/directory/[id]/route.ts` (lines 336-349)

**Status:** ✅ PUT endpoint already has correct mapping:
```typescript
if (updates.roles.includes("supplier")) {
  const supplierData: any = { party_id: id, partner_role: 'supplier' };
  if (updates.supplierExtras?.activityArea) {
    supplierData.business_category = updates.supplierExtras.activityArea; // ✅ CORRECT
  }
  // ...
}
```

**Action:** No changes needed in PUT endpoint - use it as reference for CREATE endpoint fix

### Fix 3: Verify Form Input (OPTIONAL but recommended)

**File:** `components/DirectoryForm.tsx`

**Check supplier activity area input:**
- Is it a text input (free text)?
- Or a select/dropdown with specific values?
- If free text, consider adding validation or changing to dropdown

**If form allows free text but DB has CHECK constraint:**
- Either: Add validation in form to match constraint values
- Or: Change input to dropdown with constraint values: 'TO', 'Hotel', 'Rent a car', 'Airline', 'DMC', 'Other'

---

## Acceptance Criteria

- [ ] `business_category` is correctly mapped from `supplierExtras.activityArea` in CREATE endpoint
- [ ] `business_category` is correctly mapped in PUT endpoint (if updating supplier)
- [ ] Supplier records can be created successfully without "Record not found" error
- [ ] Supplier records can be updated successfully
- [ ] Form input values match database constraint (if CHECK constraint exists)
- [ ] No console errors when selecting Supplier role
- [ ] No API errors when creating/updating Supplier records

---

## Testing Steps

1. **Test CREATE with Supplier:**
   - Open `/directory/new`
   - Select "Supplier" role
   - Fill in form (including activity area if field exists)
   - Click "Save"
   - Verify: No "Record not found" error
   - Verify: Record is created successfully
   - Verify: Supplier role is saved in `partner_party` table
   - Verify: `business_category` is set correctly

2. **Test UPDATE with Supplier:**
   - Open existing record with Supplier role
   - Modify activity area
   - Click "Save"
   - Verify: Update succeeds
   - Verify: `business_category` is updated correctly

3. **Check Database:**
   - Verify `partner_party` record exists with correct `business_category` value
   - Verify `business_category` value matches form input (if constraint allows)

---

## Notes

- **Critical:** The mapping code is missing - line 204-207 has only a comment, no actual mapping
- **Database constraint:** `business_category` has CHECK constraint with specific values
- **Form validation:** May need to validate form input against constraint values
- **Error handling:** Current error handling deletes party if supplier insert fails - this causes "Record not found"

---

**Complete this task and report back with:**
1. What you found (missing mapping code)
2. What you fixed (added business_category mapping)
3. Testing results (can create Supplier records now?)
4. Any additional issues found (form validation, constraint mismatches, etc.)

