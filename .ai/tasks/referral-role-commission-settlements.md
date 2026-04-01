# Referral role — directory card, commissions, settlements

**Status:** Phase 2 — directory API + DirectoryForm + referral stats/settlements endpoints (order UI + accrual sync still TODO)  
**Branch:** `feature/x`

## Product summary

- New directory role **Referral** (people who recommend the agency; passive commission).
- When Referral is enabled on a party card, show:
  - **Commission rules:** per `travel_service_categories` row — either **percent** of relevant service amount or **fixed** amount per service line.
  - **Statistics (two blocks, no per-order detail in UI):**
    - **Planned:** commission that is still “in progress” (order not yet eligible for accrual).
    - **Accumulated:** commission that has **moved** to accrued balance (see rules below).
  - **Settlements:** manual entries when money is paid out or used at the referral’s request; reduces **available** balance (accumulated minus settlements).
- **Periods:** filter accrued totals and settlement history by month/quarter (use `reporting_period` / `entry_date`).

## Business rules (accrual)

1. **Planned lines** are tied internally to `orders` / `order_services` (for recalculation when prices change) but the **UI only shows aggregates** (totals by currency, optional breakdown by category — not by order).
2. **Move to accumulated:** only when **both** hold:
   - **Trip ended:** `orders.date_to < current_date` (company timezone can be phase 2; v1 uses UTC date).
   - **Confirmed on order:** `orders.referral_commission_confirmed = true` (set by user on order UI).
3. Until confirmation, recomputing **planned** from current service lines is allowed; **accrued** rows are immutable except via explicit **adjustment** entries (future) or void (future).
4. **Referral on order:** `orders.referral_party_id` points to the referral party for that booking (influencer). Commission rates come from **that** party’s `referral_party_category_rate` rows.

## Data model (implemented in `migrations/add_referral_party_commission.sql`)

| Object | Purpose |
|--------|---------|
| `referral_party` | One row per party with Referral role (`party_id` PK); `company_id`, `default_currency`, `notes`. |
| `referral_party_category_rate` | Per category: `rate_kind` `percent` \| `fixed`, `rate_value`. |
| `referral_accrual_line` | `status` `planned` \| `accrued` \| `void`; amounts; optional `reporting_period` (month bucket); FKs to order/service for backend only. |
| `referral_settlement_entry` | Payouts / usage; positive `amount` reduces liability; `entry_date`, `note`, `created_by`. |
| `orders` columns | `referral_party_id`, `referral_commission_confirmed`, `referral_commission_confirmed_at`, `referral_commission_confirmed_by`. |

## Display formulas

- **Planned total** = `SUM(commission_amount)` where `status = 'planned'`.
- **Accumulated (gross)** = `SUM(commission_amount)` where `status = 'accrued'`.
- **Settled / paid out** = `SUM(amount)` from `referral_settlement_entry`.
- **Available to pay** = accumulated gross − settlements (per currency; no auto FX in v1).

## Implementation phases (next steps)

1. **DB:** Apply migration in Supabase SQL Editor; verify RLS.
2. **API:** Extend `GET/PUT /api/directory/[id]` and `create` for role `referral` + rates; new routes e.g. `GET/POST /api/directory/[id]/referral-settlements`, `GET .../referral-stats?from=&to=`.
3. **Orders:** Referral party selector + “Commission calculation confirmed” checkbox; on save/confirm, call service to **promote** planned lines to accrued when `date_to` passed.
4. **Reconciliation job (API or cron):** rebuild `planned` lines from `order_services` × rates for orders with `referral_party_id` and not yet confirmed (or confirmed but trip not ended — stays planned until both conditions met).
5. **UI:** `DirectoryForm` — checkbox Referral, section rates, stats blocks, settlements list + add payout.

## Open decisions

- **Base for percent:** default `client_price` on `order_services` (align with existing finance fields).
- **Order status:** v1 uses `date_to` only; optional strict `orders.status = 'completed'` later.
