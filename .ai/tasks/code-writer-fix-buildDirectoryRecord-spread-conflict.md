# CRITICAL FIX: buildDirectoryRecord Spread Conflict for Supplier+Subagent

**Priority:** CRITICAL  
**Type:** Bug Fix  
**Assigned to:** CODE WRITER  
**Status:** TODO

---

## 🔍 ПРОБЛЕМА

**User Report:** "если у записи отмечено supplier и subagent - запись создается, но не открывается, ошибка Record not found!"

**Root Cause Found:** Spread operator conflict in `buildDirectoryRecord` function!

**File:** `app/api/directory/[id]/route.ts` (lines 254-263)

**Problematic Code:**
```typescript
const record = buildDirectoryRecord({
  ...party,
  ...personData.data,
  ...companyData.data,
  is_client: !!clientData.data,
  is_supplier: !!supplierData.data,
  is_subagent: !!subagentData.data,
  ...supplierData.data,  // ⚠️ PROBLEM: Spreads ALL columns from partner_party
  ...subagentData.data,  // ⚠️ PROBLEM: Spreads ALL columns from subagents
});
```

**Issue:**
- Both `partner_party` and `subagents` tables have `id` and `party_id` columns
- When spreading `...supplierData.data` and `...subagentData.data`, columns with same names overwrite each other
- `subagentData.data` overwrites `supplierData.data` columns (id, party_id, etc.)
- `buildDirectoryRecord` function expects specific field names, but gets wrong/overwritten values
- This may cause the function to fail or return incorrect data

---

## 🔧 РЕШЕНИЕ

### Fix: Select Only Needed Columns Instead of Spreading All Data

**File:** `app/api/directory/[id]/route.ts`

**Change lines 254-263 FROM:**
```typescript
const record = buildDirectoryRecord({
  ...party,
  ...personData.data,
  ...companyData.data,
  is_client: !!clientData.data,
  is_supplier: !!supplierData.data,
  is_subagent: !!subagentData.data,
  ...supplierData.data,
  ...subagentData.data,
});
```

**TO:**
```typescript
const record = buildDirectoryRecord({
  ...party,
  ...personData.data,
  ...companyData.data,
  is_client: !!clientData.data,
  is_supplier: !!supplierData.data,
  is_subagent: !!subagentData.data,
  // Only spread supplier-specific fields (avoid id, party_id conflicts)
  business_category: supplierData.data?.business_category,
  commission_type: supplierData.data?.commission_type,
  commission_value: supplierData.data?.commission_value,
  commission_currency: supplierData.data?.commission_currency,
  commission_valid_from: supplierData.data?.commission_valid_from,
  commission_valid_to: supplierData.data?.commission_valid_to,
  commission_notes: supplierData.data?.commission_notes,
  // Only spread subagent-specific fields (avoid id, party_id conflicts)
  commission_scheme: subagentData.data?.commission_scheme,
  commission_tiers: subagentData.data?.commission_tiers,
  payout_details: subagentData.data?.payout_details,
});
```

**Also fix the same issue in PUT endpoint (around line 472-481):**

**Change FROM:**
```typescript
const record = buildDirectoryRecord({
  ...updatedParty,
  ...personData.data,
  ...companyData.data,
  is_client: !!clientData.data,
  is_supplier: !!supplierData.data,
  is_subagent: !!subagentData.data,
  ...supplierData.data,
  ...subagentData.data,
});
```

**TO:**
```typescript
const record = buildDirectoryRecord({
  ...updatedParty,
  ...personData.data,
  ...companyData.data,
  is_client: !!clientData.data,
  is_supplier: !!supplierData.data,
  is_subagent: !!subagentData.data,
  // Only spread supplier-specific fields (avoid id, party_id conflicts)
  business_category: supplierData.data?.business_category,
  commission_type: supplierData.data?.commission_type,
  commission_value: supplierData.data?.commission_value,
  commission_currency: supplierData.data?.commission_currency,
  commission_valid_from: supplierData.data?.commission_valid_from,
  commission_valid_to: supplierData.data?.commission_valid_to,
  commission_notes: supplierData.data?.commission_notes,
  // Only spread subagent-specific fields (avoid id, party_id conflicts)
  commission_scheme: subagentData.data?.commission_scheme,
  commission_tiers: subagentData.data?.commission_tiers,
  payout_details: subagentData.data?.payout_details,
});
```

---

## ✅ КРИТЕРИИ ПРИЕМКИ

1. ✅ Records with supplier+subagent roles open successfully
2. ✅ No "Record not found" error
3. ✅ All supplier fields are correctly loaded
4. ✅ All subagent fields are correctly loaded
5. ✅ No field conflicts or overwrites
6. ✅ GET endpoint works correctly
7. ✅ PUT endpoint works correctly (after update)

---

## 🧪 ТЕСТИРОВАНИЕ

1. Create a new record with BOTH supplier AND subagent roles
2. Save the record
3. Open the created record
4. Verify: Record opens successfully (no "Record not found")
5. Verify: Supplier fields are displayed correctly
6. Verify: Subagent fields are displayed correctly
7. Update the record
8. Verify: Update works correctly
9. Reload the record
10. Verify: All fields are still correct

---

## 📝 ПРИМЕЧАНИЯ

- The spread operator (`...`) overwrites properties with same names
- Both `partner_party` and `subagents` have `id` and `party_id` columns
- Spreading all columns causes conflicts
- Solution: Select only the specific fields needed by `buildDirectoryRecord`
- This ensures no field conflicts and correct data mapping

---

**Created by:** ARCHITECT  
**Date:** 2026-01-03  
**Related:** Supplier+Subagent roles, buildDirectoryRecord, Record not found

