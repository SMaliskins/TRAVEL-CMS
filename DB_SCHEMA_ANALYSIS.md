# Database Schema Analysis

## Executive Summary

**Analysis Date:** Current  
**Base Schema:** `supabase_schema.sql`  
**Pending Migrations:** `add_orders_fields_migration.sql`, `supabase_migration.sql`

### Critical Findings

1. ⚠️ **Missing Column:** `client_party_id` referenced in code but NOT in base schema
2. ✅ **Migration Safety:** All migrations use `IF NOT EXISTS` - safe to apply
3. ⚠️ **RLS Status:** No RLS policies defined in base schema files
4. ⚠️ **Schema Mismatch:** Code expects different column names than base schema

---

## Schema Comparison: Base vs. Code Expectations

### Orders Table - Column Mismatches

| Column Name | Base Schema (`supabase_schema.sql`) | Code Expectation | Status |
|------------|-------------------------------------|------------------|--------|
| Order Identifier | `order_code` (text, NOT NULL) | `order_number` | ⚠️ MISMATCH |
| Owner Field | `owner_user_id` (uuid, NOT NULL) | `manager_user_id` | ⚠️ MISMATCH |
| Check-in Date | `date_from` (date, nullable) | `check_in_date` | ⚠️ MISMATCH |
| Return Date | `date_to` (date, nullable) | `return_date` | ⚠️ MISMATCH |
| Client Reference | **MISSING** | `client_party_id` | ❌ MISSING |
| Cities/Countries | `countries_cities` (text) | Separate `cities[]`, `countries[]` | ⚠️ MISMATCH |

### Orders Table - Base Schema Columns (Confirmed)

✅ **Core Columns (from `supabase_schema.sql`):**
- `id` (uuid, PK)
- `company_id` (uuid, NOT NULL, FK → companies)
- `owner_user_id` (uuid, NOT NULL, FK → auth.users)
- `order_no` (int, NOT NULL)
- `order_year` (int, NOT NULL)
- `order_code` (text, NOT NULL) ⚠️ Code expects `order_number`
- `order_type` (text, NOT NULL, CHECK: 'TA', 'TO', 'CORP', 'NON')
- `status` (text, NOT NULL, CHECK: 'Draft', 'Active', 'Cancelled', 'Completed', 'On hold')
- `client_display_name` (text, nullable)
- `countries_cities` (text, nullable) ⚠️ Code passes separate arrays
- `date_from` (date, nullable) ⚠️ Code uses `check_in_date`
- `date_to` (date, nullable) ⚠️ Code uses `return_date`
- `amount_total` (numeric(12,2), NOT NULL, DEFAULT 0)
- `amount_paid` (numeric(12,2), NOT NULL, DEFAULT 0)
- `amount_debt` (numeric(12,2), NOT NULL, DEFAULT 0)
- `profit_estimated` (numeric(12,2), NOT NULL, DEFAULT 0)
- `updated_at` (timestamptz, DEFAULT now())
- `created_at` (timestamptz, DEFAULT now())

✅ **Constraints (from `supabase_schema.sql`):**
- UNIQUE(company_id, order_year, order_no)
- UNIQUE(company_id, order_code)

---

## Migration Analysis

### 1. `add_orders_fields_migration.sql` - ✅ SAFE

**Purpose:** Add new optional fields to orders table

**Additions:**
- `order_payment_status` (text, DEFAULT 'none', CHECK: 'none', 'partial', 'full')
- `all_services_invoiced` (boolean, DEFAULT false)
- `client_payment_due_date` (date, nullable)
- `order_date` (date, nullable)

**Safety Assessment:**
- ✅ Uses `IF NOT EXISTS` checks
- ✅ All columns are nullable or have defaults
- ✅ Adds indexes (conditional)
- ✅ Includes data migration (UPDATE) - **REVIEW VALUES CAREFULLY**
- ⚠️ **Data Migration Note:** Lines 78-89 update existing rows - verify logic matches business rules

**Recommendation:** Safe to apply. Review UPDATE statements for correctness.

### 2. `supabase_migration.sql` - ✅ SAFE (with notes)

**Purpose:** Incremental migration for existing tables

**Key Operations:**
- Creates tables with `IF NOT EXISTS`
- Adds columns with `IF NOT EXISTS`
- Creates indexes with `IF NOT EXISTS`
- Adds constraints conditionally

**Safety Assessment:**
- ✅ No destructive operations
- ✅ All operations are idempotent
- ⚠️ **Note:** Lines 171 adds `owner_user_id` as nullable initially - may conflict with base schema `NOT NULL`
- ⚠️ **Gap:** Does NOT add `client_party_id` column

**Recommendation:** Safe to apply. Verify `owner_user_id` NULL handling if table has existing rows.

---

## Missing Column Analysis

### ❌ `client_party_id` - CRITICAL MISSING COLUMN

**Issue:**
- Code in `app/api/orders/create/route.ts` line 190 expects `client_party_id`
- Base schema does NOT have this column
- `supabase_migration.sql` does NOT add this column
- Resolver checks for `client_party_id`, `client_id`, or `party_id` (line 127)

**Possible Solutions:**

**Option 1: Add to orders table (RECOMMENDED)**
```sql
-- Add client_party_id column
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS client_party_id uuid;

-- Add foreign key if party/client tables exist
-- ALTER TABLE public.orders
-- ADD CONSTRAINT orders_client_party_fk 
-- FOREIGN KEY (client_party_id) REFERENCES public.client_party(id);
```

**Option 2: Use existing field**
- If clients are tracked via `client_display_name` only
- May need to refactor code to not require `client_party_id`

**Recommendation:** 
1. Verify if `client_party` or similar table exists
2. Check `fix_rls_issue.sql` - references `client_party` table
3. Create migration to add `client_party_id` column

---

## RLS (Row Level Security) Analysis

### Current Status: ⚠️ UNKNOWN/UNDEFINED

**Base Schema (`supabase_schema.sql`):**
- ❌ No RLS policies defined
- ❌ No `ENABLE ROW LEVEL SECURITY` statements
- ❌ No `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`

**Migration Files:**
- `supabase_migration.sql`: No RLS policies
- `add_orders_fields_migration.sql`: No RLS policies

**Other Files:**
- `fix_rls_issue.sql`: **DISABLES RLS** on party tables (⚠️ SECURITY RISK)
- `fix_rls_issue_full_policies.sql`: Creates permissive policies for party tables

### RLS Recommendations

**For `orders` table:**

1. **Enable RLS:**
```sql
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
```

2. **Policy: Users can read orders from their company:**
```sql
CREATE POLICY "Users can read orders from their company"
ON public.orders FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM public.profiles 
    WHERE user_id = auth.uid()
  )
);
```

3. **Policy: Owners can update their orders:**
```sql
CREATE POLICY "Owners can update their orders"
ON public.orders FOR UPDATE
TO authenticated
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());
```

4. **Policy: Service role bypass (for API routes):**
```sql
-- Service role automatically bypasses RLS
-- No policy needed - route handler uses supabaseAdmin client
```

**⚠️ WARNING:** 
- Current code uses `supabaseAdmin` (service_role) to bypass RLS
- This is correct for server-side operations
- Ensure RLS is enabled for direct client queries

---

## Index Analysis

### Base Schema Indexes (from `supabase_schema.sql`)

✅ **Orders Table:**
- `idx_orders_company_id` on `company_id`
- `idx_orders_updated_at` on `updated_at`
- `idx_orders_date_from` on `date_from`
- `idx_orders_date_to` on `date_to`
- `idx_orders_status` on `status`
- `idx_orders_order_type` on `order_type`
- `idx_orders_owner_user_id` on `owner_user_id`

### Migration Indexes

✅ **From `add_orders_fields_migration.sql`:**
- `idx_orders_payment_status` on `order_payment_status` (partial: WHERE NOT NULL)
- `idx_orders_all_services_invoiced` on `all_services_invoiced` (partial: WHERE NOT NULL)
- `idx_orders_client_payment_due_date` on `client_payment_due_date` (partial: WHERE NOT NULL)
- `idx_orders_order_date` on `order_date` (partial: WHERE NOT NULL)

**Assessment:** All indexes are appropriate. Partial indexes (WHERE NOT NULL) are efficient for sparse columns.

---

## Triggers & Functions Analysis

### Existing Functions

✅ **`get_table_columns` function:**
- Defined in: `app/orders/new/create_get_table_columns_function.sql`
- Purpose: Column discovery for dynamic schema handling
- Security: `SECURITY DEFINER` - runs with creator's privileges
- ✅ Properly granted to `authenticated` and `anon` roles

**Assessment:** Safe and correctly configured.

### Missing Triggers (Potential Improvements)

**Suggested: Auto-update `updated_at`:**
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

**Suggested: Auto-calculate `amount_debt`:**
```sql
CREATE OR REPLACE FUNCTION calculate_order_debt()
RETURNS TRIGGER AS $$
BEGIN
    NEW.amount_debt = NEW.amount_total - NEW.amount_paid;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_orders_debt
BEFORE INSERT OR UPDATE OF amount_total, amount_paid ON public.orders
FOR EACH ROW
EXECUTE FUNCTION calculate_order_debt();
```

**⚠️ Note:** These are suggestions only. Not included in current schema.

---

## Constraints & Data Integrity

### Unique Constraints

✅ **Base Schema:**
- `UNIQUE(company_id, order_year, order_no)`
- `UNIQUE(company_id, order_code)`

✅ **Migration:**
- `supabase_migration.sql` adds these with conditional checks (lines 308-328)

**Assessment:** Properly defined. Prevents duplicate order codes within company.

### Foreign Key Constraints

✅ **Orders Table:**
- `company_id` → `companies(id)`
- `owner_user_id` → `auth.users(id)`

⚠️ **Missing (if needed):**
- `client_party_id` → `client_party(id)` (if party table exists)

### Check Constraints

✅ **Base Schema:**
- `order_type` CHECK: 'TA', 'TO', 'CORP', 'NON'
- `status` CHECK: 'Draft', 'Active', 'Cancelled', 'Completed', 'On hold'

✅ **Migration:**
- `order_payment_status` CHECK: 'none', 'partial', 'full' (line 19)

**Assessment:** Properly enforced at database level.

---

## Recommendations Summary

### 🔴 Critical Actions Required

1. **Add `client_party_id` column:**
   - Verify if `client_party` table exists
   - Create migration to add column
   - Update foreign key if applicable

2. **Enable RLS on orders table:**
   - Create policies for authenticated users
   - Test with service_role client (should bypass)
   - Test with anon/authenticated clients (should enforce)

### 🟡 Recommended Actions

3. **Review data migration in `add_orders_fields_migration.sql`:**
   - Lines 78-89: Verify `order_payment_status` calculation logic
   - Lines 87-89: Verify `order_date` population logic

4. **Verify `owner_user_id` NULL handling:**
   - `supabase_migration.sql` adds as nullable
   - Base schema requires NOT NULL
   - May need NOT NULL constraint after backfill

5. **Consider adding triggers:**
   - Auto-update `updated_at`
   - Auto-calculate `amount_debt`

### 🟢 Optional Improvements

6. **Add composite indexes for common queries:**
   - `(company_id, status)` if filtering by status frequently
   - `(company_id, order_date)` if querying by date range

7. **Add comments to columns:**
   - Already included in `add_orders_fields_migration.sql`
   - Consider adding to base schema columns

---

## Verification Queries

See `VERIFY_SCHEMA.sql` for comprehensive verification queries.

**Quick Status Check:**
```sql
-- Check orders table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'orders'
ORDER BY ordinal_position;

-- Check RLS status
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'orders';

-- Check for missing client_party_id
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'orders'
    AND column_name = 'client_party_id'
) as client_party_id_exists;
```

---

## Migration Safety Checklist

- ✅ All migrations use `IF NOT EXISTS`
- ✅ No DROP statements
- ✅ No ALTER COLUMN DROP
- ✅ New columns are nullable or have defaults
- ⚠️ Data migrations present (verify logic)
- ✅ Indexes are conditional
- ✅ Constraints are conditional

**Overall Assessment:** Migrations are SAFE to apply. Review data migration logic before production deployment.

