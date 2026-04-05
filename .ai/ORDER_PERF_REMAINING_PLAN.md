# Plan: remaining performance & quality work (Order page + Orders list)

Ordered by **recommended execution sequence** (impact, dependencies, risk).  
Synced with `ORDER_PAGE_PERF_SPEC.md` and current codebase state (2026-04).

---

## Phase A — Orders list API (`/api/orders` + `/orders`)

### A1. Server-side search + pagination (spec **L1**) — highest impact

**Problem:** With `search` query param, pagination is disabled; all company orders load, then filter in memory.

**Do:**

1. Pass search text to API (or align URL/store with API): `ilike` on `order_code`, `client_display_name` (and any safe indexed fields).
2. Always apply `range()` / `page` + `pageSize` when search is active.
3. For traveller / payer / service-line name matches: either
  - `**orders.search_text`** (or similar) maintained by triggers on `order_travellers`, `order_services`, `order_service_travellers`, **or**  
  - RPC / materialized path — coordinate with DB Specialist (RLS, migration).

**Verify:** Large company (500+ orders): response size and latency; search still finds surname/payer cases per product rules.

---

### A2. Profit / VAT / margin in database (spec **L2**)

**Problem:** Full `order_services` for all orders on the page + `computeServiceLineEconomics()` per line in Node.

**Do:**

1. Postgres function or view: input `company_id` + `order_id[]`, output per order: amounts, profit net of VAT, VAT on margin (match current JS semantics).
2. API: replace or narrow services fetch for list payload; keep detailed lines only where UI still needs them.
3. QA: same numbers as before on sample orders (regression).

**Depends on:** DB Specialist for function + indexes; map fields to existing UI columns.

---

### A3. Orders list UI polish (spec **L5**, partial)

**Do in order:**

1. **Flags / cities:** stop eager `loadWorldCities()` on list page — e.g. `country_flag` or preformatted HTML from API (small payload).
2. **Calendar view:** replace O(orders × 42) day scan with pre-index by date (e.g. `Map<isoDay, OrderRow[]>` built once per `filteredOrders` change).
3. **Debounce:** heavy client filters (surname, text) ~300ms where re-renders are costly.

**Note:** `buildOrdersTree` / `filteredOrders` already use `useMemo` in places — audit calendar + any remaining work per render.

---

### A4. React Query for list — extend (spec **L4+**)

**Done:** First page cached (`staleTime: 30s`), load-more appends `extraOrders`.

**Optional next:**

- `useInfiniteQuery` instead of manual append (cleaner, one pattern).
- After **A1**, expand `queryKey` with server-driven filters + page so cache matches real queries.
- `prefetchQuery` on link hover for likely next navigation (nice-to-have).

---

## Phase B — Order detail (`/orders/[orderCode]`)

### B1. Narrow `orders` SELECT in bootstrap + GET order (spec Step 3 “remains”)

**Do:** Replace `select("*")` on `orders` with explicit columns required by:

- `OrderPageHeaderE`, dates, status, client, referral flags  
- `buildExpandedOrderAndInvoiceSummary` / bootstrap JSON

**Risk:** Low if enumerated from actual field usage (grep components + bootstrap builder).

---

### B2. Tab data: invalidate instead of full remount (spec Step 4 “ideal”)

**Do:** Where `invoiceRefetchTrigger` + `key={...}` force remount, prefer:

- `queryClient.invalidateQueries({ queryKey: [...] })` for invoices, payments, services as needed  
- Keep remount only where ref/API contract requires a clean state

**Goal:** Fewer duplicate fetches and less state reset.

---

### B3. `loadWorldCities` on order page (spec Step 5)

**Do:** Confirm only lazy load (focus on city UI) or `requestIdleCallback` preload — no blocking on first paint.

---

### B4. Optional: further narrow list `order_services` SELECT (spec Step 2)

**Do:** Field-by-field audit vs `OrderServicesBlock` + Terms column; remove columns only used in edit modal (detail fetch already exists).

---

## Phase C — Documentation & hygiene

### C1. Update `ORDER_PAGE_PERF_SPEC.md`

Mark **done** vs **open** for Steps 1–7 and List L1–L5 so the spec matches the repo (L3, L4 first page, traveller parallelization, invoices RQ, etc.).

### C2. RELEASE / product notes

When A1 or A2 ships with user-visible speedup, add a line to `.ai/RELEASE_LOG.md` per project rules.

---

## Suggested timeline (rough)


| Phase | Item  | Effort                                                               |
| ----- | ----- | -------------------------------------------------------------------- |
| A     | A1 L1 | 0.5–1.5 d (without triggers); +0.5–1 d with `search_text` + triggers |
| A     | A2 L2 | 1–1.5 d (with DB review)                                             |
| A     | A3 L5 | 0.5–1 d                                                              |
| A     | A4    | 0.25–0.5 d                                                           |
| B     | B1–B3 | 0.5–1 d total                                                        |
| B     | B4    | 0.25–0.5 d                                                           |
| C     | C1–C2 | ad hoc                                                               |


---

## Out of scope (per spec)

- Redis / external cache for this use case  
- GraphQL rewrite  
- SSR for authenticated order page  
- Paginating services on order detail (low row count per order)