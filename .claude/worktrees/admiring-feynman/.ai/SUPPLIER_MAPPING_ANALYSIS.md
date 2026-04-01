# Supplier Field Mapping Analysis

**Date:** 2025-12-25  
**Issue:** "Record not found" after creating Supplier record

---

## 🔍 Field Mapping Verification

### Form → API → Database Mapping

| Form Field | Form State Variable | API Field | DB Column | Status |
|------------|---------------------|-----------|-----------|--------|
| Activity Area | `supplierActivityArea` | `supplierExtras.activityArea` | `business_category` | ✅ |
| Commission Type | `supplierCommissionType` | `supplierExtras.commissionType` | `commission_type` | ✅ |
| Commission Value | `supplierCommissionValue` | `supplierExtras.commissionValue` | `commission_value` | ✅ |
| Commission Currency | `supplierCommissionCurrency` | `supplierExtras.commissionCurrency` | `commission_currency` | ✅ |
| Commission Valid From | `supplierCommissionValidFrom` | `supplierExtras.commissionValidFrom` | `commission_valid_from` | ✅ |
| Commission Valid To | `supplierCommissionValidTo` | `supplierExtras.commissionValidTo` | `commission_valid_to` | ✅ |

**✅ All mappings appear correct!**

---

## 📋 Database Schema (Expected)

**Table:** `partner_party`

| Column | Type | Nullable | Default | Required |
|--------|------|----------|---------|----------|
| `id` | uuid | NO | `gen_random_uuid()` | ✅ |
| `party_id` | uuid | NO | - | ✅ |
| `partner_role` | text | NO | `'supplier'` | ✅ **REQUIRED** |
| `business_category` | text | YES | - | ❌ |
| `commission_type` | text | YES | - | ❌ |
| `commission_value` | numeric | YES | - | ❌ |
| `commission_currency` | text | YES | `'EUR'` | ❌ |
| `commission_valid_from` | date | YES | - | ❌ |
| `commission_valid_to` | date | YES | - | ❌ |
| `commission_notes` | text | YES | - | ❌ |

**Constraints:**
- `CHECK (partner_role = 'supplier')` - только 'supplier' разрешен
- `CHECK (business_category IN ('TO', 'Hotel', 'Rent a car', 'Airline', 'DMC', 'Other'))` - если указано
- `CHECK (commission_type IN ('percent', 'fixed'))` - если указано

---

## 🔍 Code Analysis

### Form Submission (DirectoryForm.tsx lines 397-405)

```typescript
if (roles.includes("supplier")) {
  formData.supplierExtras = {
    activityArea: supplierActivityArea || undefined,
    commissionType: supplierCommissionType || undefined,
    commissionValue: supplierCommissionValue || undefined,
    commissionCurrency: supplierCommissionCurrency || undefined,
    commissionValidFrom: supplierCommissionValidFrom || undefined,
    commissionValidTo: supplierCommissionValidTo || undefined,
  };
}
```

✅ **Correct** - все поля отправляются

### API CREATE (app/api/directory/create/route.ts lines 202-243)

```typescript
if (data.roles.includes("supplier")) {
  const supplierData: any = { 
    party_id: partyId, 
    partner_role: 'supplier'  // ✅ Always set
  };
  
  if (data.supplierExtras?.activityArea && validBusinessCategories.includes(...)) {
    supplierData.business_category = data.supplierExtras.activityArea;
  }
  
  if (data.supplierExtras?.commissionType) {
    supplierData.commission_type = data.supplierExtras.commissionType;
  }
  // ... other fields
}
```

✅ **Correct** - `partner_role` всегда устанавливается в 'supplier'

### API GET (app/api/directory/[id]/route.ts lines 62-72)

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

✅ **Correct** - все поля правильно маппятся

---

## ⚠️ Potential Issues

### Issue 1: Record Not Found After Creation

**Possible Causes:**
1. **Tenant Isolation** - Record created with wrong `company_id`
2. **Creation Failed Silently** - Error not shown to user
3. **RLS Policy Blocking** - Policy prevents reading newly created record

### Issue 2: business_category Validation

API validates `activityArea` against allowed values:
```typescript
const validBusinessCategories = ['TO', 'Hotel', 'Rent a car', 'Airline', 'DMC', 'Other'];
if (data.supplierExtras?.activityArea && validBusinessCategories.includes(...)) {
  supplierData.business_category = data.supplierExtras.activityArea;
}
```

**If `activityArea` doesn't match**, field is skipped (which is OK, it's optional).

---

## 🧪 Diagnostic Steps

### Step 1: Check Database Schema

Run: `migrations/check_supplier_mapping.sql`

**Check:**
- Actual columns in `partner_party` table
- CHECK constraints (especially `partner_role`)
- Sample data (if any Supplier records exist)

### Step 2: Test Creation

1. Create new Supplier record
2. Check browser console (F12) for errors
3. Check Network tab - verify API response
4. Check server logs for errors

### Step 3: Check Tenant Isolation

After creation, run SQL:
```sql
SELECT 
    pp.*,
    p.company_id,
    (SELECT company_id FROM profiles WHERE user_id = auth.uid()) as user_company_id
FROM partner_party pp
JOIN party p ON p.id = pp.party_id
ORDER BY pp.id DESC
LIMIT 1;
```

**Check:** `p.company_id` should match `user_company_id`

---

## 📝 Recommendations

1. **Run diagnostic SQL** to verify actual schema
2. **Check server logs** when creating Supplier record
3. **Verify tenant isolation** - check `company_id` matches
4. **Test with minimal data** - create Supplier with only required fields

---

**Status:** ⏳ **Pending diagnostic SQL execution** - Need to verify actual schema matches expected

