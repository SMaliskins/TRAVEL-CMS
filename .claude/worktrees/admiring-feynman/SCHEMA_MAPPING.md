# Orders Table Schema Mapping

## Findings

### ❌ Critical Schema Mismatches

1. **Column Name Conflicts:**
   - Code uses `order_number` → DB has `order_code`
   - Code uses `manager_user_id` → DB has `owner_user_id`
   - Code uses `check_in_date` → DB has `date_from`
   - Code uses `return_date` → DB has `date_to`
   - Code expects separate `cities`/`countries` → DB has single `countries_cities` (text)

2. **Hardcoded Values in Route Handler:**
   - `route.ts` line 213: hardcodes `payload.order_number = orderCode`
   - `route.ts` line 216: hardcodes `payload.manager_user_id = user.id`
   - These bypass the column resolver and will fail if column names don't match

3. **Missing Column Handling:**
   - Migration adds new columns but resolver doesn't handle them
   - No mapping for `client_party_id` to actual DB column

### ✅ Good Practices Found

- Service role key properly secured (server-only in route handler)
- Column resolver attempts dynamic discovery
- Graceful error handling for missing columns
- Migration uses safe `IF NOT EXISTS` checks

## Column Mapping Table

| Code Field | Database Column | Status | Notes |
|------------|----------------|--------|-------|
| `order_number` | `order_code` | ❌ MISMATCH | Code expects `order_number`, DB has `order_code` |
| `manager_user_id` | `owner_user_id` | ❌ MISMATCH | Code expects `manager_user_id`, DB has `owner_user_id` |
| `check_in_date` | `date_from` | ⚠️ RESOLVER HANDLES | Resolver checks both, but route passes `check_in_date` |
| `return_date` | `date_to` | ⚠️ RESOLVER HANDLES | Resolver checks both, but route passes `return_date` |
| `client_party_id` | `client_party_id` | ❓ UNKNOWN | Not in schema file - needs verification |
| `order_type` | `order_type` | ✅ MATCH | Correct |
| `status` | `status` | ✅ MATCH | Correct |
| `cities` (array) | `countries_cities` (text) | ❌ MISMATCH | Code passes array, DB expects text |
| `countries` (array) | `countries_cities` (text) | ❌ MISMATCH | Code passes separate, DB expects combined text |
| `order_payment_status` | `order_payment_status` | ✅ NEW | Added by migration |
| `all_services_invoiced` | `all_services_invoiced` | ✅ NEW | Added by migration |
| `client_payment_due_date` | `client_payment_due_date` | ✅ NEW | Added by migration |
| `order_date` | `order_date` | ✅ NEW | Added by migration |

## Database Schema (from `supabase_schema.sql`)

```sql
CREATE TABLE orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id),
    owner_user_id uuid NOT NULL REFERENCES auth.users(id),  -- NOT manager_user_id
    order_no int NOT NULL,
    order_year int NOT NULL,
    order_code text NOT NULL,  -- NOT order_number
    order_type text NOT NULL DEFAULT 'TA',
    status text NOT NULL DEFAULT 'Active',
    client_display_name text,
    countries_cities text,  -- Single text field, not separate arrays
    date_from date,  -- NOT check_in_date
    date_to date,  -- NOT return_date
    amount_total numeric(12,2) NOT NULL DEFAULT 0,
    amount_paid numeric(12,2) NOT NULL DEFAULT 0,
    amount_debt numeric(12,2) NOT NULL DEFAULT 0,
    profit_estimated numeric(12,2) NOT NULL DEFAULT 0,
    updated_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    UNIQUE(company_id, order_year, order_no),
    UNIQUE(company_id, order_code)
);
```

## Minimal Fix (✅ COMPLETED)

1. **✅ Updated resolver to handle column name mappings:**
   - Added `getOrderCodeColumn()` to map `order_code` (DB) ↔ `order_number` (code)
   - Added `getOwnerUserIdColumn()` to map `owner_user_id` (DB) ↔ `manager_user_id` (code)
   - Updated `route.ts` to use these mapping functions

2. **✅ Fixed cities/countries handling:**
   - Resolver now checks for `countries_cities` column first (combined field)
   - Falls back to separate `cities`/`countries` columns if combined doesn't exist
   - Combines arrays into single text field: "Country1, Country2, City1, City2"

3. **✅ Fixed date field mapping:**
   - Resolver already handles both `date_from`/`check_in_date` and `date_to`/`return_date`
   - Route handler passes fields correctly

4. **⚠️ `client_party_id` column verification needed:**
   - Not present in base schema file
   - Code expects this column - verify with `VERIFY_SCHEMA.sql`
   - May need migration if missing

5. **✅ Updated error handling:**
   - Route handler now uses dynamic column mapping
   - Graceful fallback for missing optional columns
   - Clear error messages for required columns

## Next Steps

1. **Run verification queries:**
   ```bash
   # Execute VERIFY_SCHEMA.sql in Supabase SQL Editor
   ```

2. **Apply migration if needed:**
   - Run `add_orders_fields_migration.sql` to add new columns
   - Verify `client_party_id` exists or create migration

3. **Verify RLS policies:**
   - Check if orders table has RLS enabled
   - Review policies - service role bypasses RLS (expected)
   - Ensure authenticated users can read their orders

4. **Test order creation:**
   - Test API endpoint with various field combinations
   - Verify order codes are generated correctly
   - Check that responses use `order_number` field name

## RLS/Auth Status

✅ **Service Role Usage:** Correctly secured
- Used only in server-side route handler (`/api/orders/create/route.ts`)
- Has validation check for key existence
- Never exposed to client

⚠️ **RLS Policies:** Need verification
- Base schema doesn't show RLS policies
- Migration doesn't add RLS policies
- Service role bypasses RLS (expected behavior)

## Verification Queries

```sql
-- Check actual orders table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'orders'
ORDER BY ordinal_position;

-- Check for client_party_id column
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'orders'
  AND column_name LIKE '%party%';

-- Check RLS status
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'orders';

-- Check existing RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'orders';
```

