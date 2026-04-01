# Fix: No Statistics Available for Existing Clients

## Problem
Orders and services created **before** commit `aeddec5` do not have `client_party_id` saved in the database. This causes the Statistics panel to show "No statistics available" even when orders exist.

## Root Cause
The API endpoint `/api/orders/create` was not saving `client_party_id` to the database until commit `aeddec5` (2026-01-18 03:00).

**Before fix:**
- Order saved `client_display_name` ✅
- Order did NOT save `client_party_id` ❌

**After fix:**
- Order saves BOTH `client_display_name` AND `client_party_id` ✅

## Solution Options

### Option 1: Quick Fix (Single Order)
If you only need to fix one specific order (e.g., `0011-26-sm`):

1. Open Supabase SQL Editor
2. Run migration: `migrations/update_order_0011_client_party.sql`
3. This will link order `0011-26-sm` to party `8a2712aa-7702-4bff-b399-7977c30999a5`

### Option 2: Full Migration (All Old Orders)
To fix **all** existing orders at once:

1. Open Supabase SQL Editor
2. Run migration: `migrations/link_old_orders_to_party.sql`
3. This will:
   - Match `orders.client_display_name` to `party.display_name`
   - Update `orders.client_party_id`
   - Update `order_services.client_party_id` and `payer_party_id`
   - Show verification report

**Matching logic:**
- Exact match: `party.display_name = order.client_display_name`
- Person match: `first_name + last_name = client_display_name`
- Company match: `party.name = client_display_name`
- Only matches parties with `roles` containing `'client'`

### Option 3: Manual Update via UI
For each old order:
1. Open the order in UI
2. Click "Edit" on any service
3. Re-select the Client from dropdown
4. Save
5. This will update `client_party_id` automatically

## Testing After Migration

1. Go to: http://localhost:3000/directory/8a2712aa-7702-4bff-b399-7977c30999a5
2. Check Statistics Tab
3. Should now show:
   - Orders: 1 (or more)
   - Total Spent: €X.XX
   - Debt: €X.XX
   - Last Trip / Next Trip: dates

## Prevention

**All new orders** created after commit `aeddec5` will automatically save `client_party_id` and will work correctly with Statistics.

## Files Created

1. `migrations/update_order_0011_client_party.sql` - Quick fix for single order
2. `migrations/link_old_orders_to_party.sql` - Full migration for all orders
3. `MIGRATION_FIX_CLIENT_STATS.md` - This instruction file

## Recommendation

**Run Option 2** (Full Migration) to fix all existing orders at once. This is a one-time operation and safe to run multiple times (idempotent).
