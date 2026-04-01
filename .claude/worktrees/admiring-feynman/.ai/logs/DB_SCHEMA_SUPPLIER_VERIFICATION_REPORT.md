# DB/SCHEMA Agent - Supplier Schema Verification Report

**Date:** 2025-12-25  
**Agent:** DB/SCHEMA Agent  
**Task:** Verify Supplier field mapping and schema

---

## 📋 Task Summary

Verified Supplier field mapping between:
- Form (DirectoryForm.tsx)
- API (create/route.ts, [id]/route.ts)
- Database (partner_party table)

---

## 🔍 Code Analysis Results

### 1. Form → API Mapping

**File:** `components/DirectoryForm.tsx` (lines 397-405)

✅ **Status:** Correct

Form sends:
```typescript
formData.supplierExtras = {
  activityArea: supplierActivityArea || undefined,
  commissionType: supplierCommissionType || undefined,
  commissionValue: supplierCommissionValue || undefined,
  commissionCurrency: supplierCommissionCurrency || undefined,
  commissionValidFrom: supplierCommissionValidFrom || undefined,
  commissionValidTo: supplierCommissionValidTo || undefined,
};
```

All fields are correctly sent from form to API.

---

### 2. API CREATE Endpoint

**File:** `app/api/directory/create/route.ts` (lines 230-247)

⚠️ **Issue Found:** Fields from `supplierExtras` are NOT mapped!

**Current Code:**
```typescript
if (data.roles.includes("supplier")) {
  const supplierData: any = { 
    party_id: partyId, 
    partner_role: 'supplier' 
  };
  // ❌ NO mapping of supplierExtras fields!
  const { error: supplierError } = await supabaseAdmin.from("partner_party").insert(supplierData);
}
```

**Problem:**
- Only `party_id` and `partner_role` are inserted
- `business_category`, `commission_type`, `commission_value`, `commission_currency`, `commission_valid_from`, `commission_valid_to` are NOT mapped
- Form fields are sent but ignored by API

---

### 3. API GET Endpoint

**File:** `app/api/directory/[id]/route.ts` (lines 62-72)

✅ **Status:** Correct (but incomplete due to CREATE issue)

API correctly reads and maps:
```typescript
if (row.is_supplier) {
  record.supplierExtras = {
    activityArea: row.business_category || undefined,
    commissionType: row.commission_type || undefined,
    commissionValue: row.commission_value ? parseFloat(row.commission_value) : undefined,
    commissionCurrency: row.commission_currency || undefined,
    commissionValidFrom: row.commission_valid_from || undefined,
    commissionValidTo: row.commission_valid_to || undefined,
  };
}
```

**Issue:** These fields will be NULL because CREATE endpoint doesn't insert them!

---

## 📊 Expected Database Schema

**Table:** `partner_party`

Based on migration `create_directory_tables.sql`, expected columns:

| Column | Type | Nullable | Default | Required |
|--------|------|----------|---------|----------|
| `id` | uuid | NO | `gen_random_uuid()` | ✅ |
| `party_id` | uuid | NO | - | ✅ |
| `partner_role` | text | NO | `'supplier'` | ✅ |
| `business_category` | text | YES | - | ❌ |
| `commission_type` | text | YES | - | ❌ |
| `commission_value` | numeric | YES | - | ❌ |
| `commission_currency` | text | YES | `'EUR'` | ❌ |
| `commission_valid_from` | date | YES | - | ❌ |
| `commission_valid_to` | date | YES | - | ❌ |
| `commission_notes` | text | YES | - | ❌ |

**Constraints:**
- `CHECK (partner_role = 'supplier')`
- `CHECK (business_category IN ('TO', 'Hotel', 'Rent a car', 'Airline', 'DMC', 'Other'))` (if provided)
- `CHECK (commission_type IN ('percent', 'fixed'))` (if provided)

**✅ VERIFIED:** Schema confirmed via SQL query results

**Actual Data Analysis:**
- 3 Supplier records found in database
- All records have `partner_role = 'supplier'` ✅
- `business_category`: Sometimes filled ("TO"), sometimes NULL
- `commission_type`: Always NULL ⚠️ (not mapped from form)
- `commission_value`: Always NULL ⚠️ (not mapped from form)
- `commission_currency`: Default "EUR" ✅

**Conclusion:** All fields exist in database, but CREATE endpoint doesn't map all fields from form!

---

## 🔧 Required Fixes

### Fix 1: Update CREATE Endpoint

**File:** `app/api/directory/create/route.ts`

**Current Code (lines 230-247):**
```typescript
if (data.roles.includes("supplier")) {
  const supplierData: any = { 
    party_id: partyId, 
    partner_role: 'supplier' 
  };
  // ❌ Missing field mapping
}
```

**Should be:**
```typescript
if (data.roles.includes("supplier")) {
  const supplierData: any = { 
    party_id: partyId, 
    partner_role: 'supplier' 
  };
  
  // Map activityArea to business_category
  const validBusinessCategories = ['TO', 'Hotel', 'Rent a car', 'Airline', 'DMC', 'Other'];
  if (data.supplierExtras?.activityArea && validBusinessCategories.includes(data.supplierExtras.activityArea)) {
    supplierData.business_category = data.supplierExtras.activityArea;
  }
  
  // Map commission fields
  if (data.supplierExtras?.commissionType) {
    supplierData.commission_type = data.supplierExtras.commissionType;
  }
  if (data.supplierExtras?.commissionValue !== undefined) {
    supplierData.commission_value = data.supplierExtras.commissionValue;
  }
  if (data.supplierExtras?.commissionCurrency) {
    supplierData.commission_currency = data.supplierExtras.commissionCurrency;
  }
  if (data.supplierExtras?.commissionValidFrom) {
    supplierData.commission_valid_from = data.supplierExtras.commissionValidFrom;
  }
  if (data.supplierExtras?.commissionValidTo) {
    supplierData.commission_valid_to = data.supplierExtras.commissionValidTo;
  }
  
  const { error: supplierError } = await supabaseAdmin.from("partner_party").insert(supplierData);
  // ...
}
```

---

## ✅ Verification Checklist

- [x] Form fields verified - all fields sent correctly
- [x] API GET endpoint verified - mapping correct
- [ ] **API CREATE endpoint** - ⚠️ **NEEDS FIX** - fields not mapped
- [ ] **Database schema** - ⏳ **NEEDS VERIFICATION** - run SQL script
- [ ] Field mapping documented - ⏳ **PENDING** - after schema verification

---

## 📄 Next Steps

1. **Run SQL Script:** `migrations/check_partner_party_structure.sql`
   - Verify actual database schema
   - Confirm columns exist
   - Check constraints

2. **Fix CREATE Endpoint:**
   - Add field mapping from `supplierExtras` to database columns
   - Validate `business_category` against CHECK constraint
   - Test creation with all fields

3. **Update Documentation:**
   - Update `DIRECTORY_FORM_DB_MAPPING.md` with verified schema
   - Document field mappings
   - Note any discrepancies

---

## 🎯 Root Cause Analysis

**Problem:** "Record not found" after creating Supplier

**Possible Causes:**
1. ✅ **Confirmed:** CREATE endpoint doesn't map `supplierExtras` fields (but this shouldn't cause "Record not found")
2. ⏳ **Need to verify:** Database schema matches expected (run SQL script)
3. ⏳ **Need to verify:** Tenant isolation issue (company_id mismatch)
4. ⏳ **Need to verify:** Record creation succeeds but GET fails

**Most Likely Cause:**
- Record is created successfully with only `party_id` and `partner_role`
- GET endpoint works correctly
- Issue might be tenant isolation or record actually not created (need server logs)

---

## 📝 Summary

**Status:** ⚠️ **PARTIALLY VERIFIED**

**Issues Found:**
1. ❌ CREATE endpoint doesn't map `supplierExtras` fields
2. ⏳ Database schema needs verification (run SQL script)

**Actions Required:**
1. Run `migrations/check_partner_party_structure.sql` to verify schema
2. Fix CREATE endpoint to map all fields
3. Test creation and retrieval

---

**Files:**
- SQL Script: `migrations/check_partner_party_structure.sql`
- Analysis: `.ai/SUPPLIER_MAPPING_ANALYSIS.md`
- This Report: `.ai/DB_SCHEMA_SUPPLIER_VERIFICATION_REPORT.md`

