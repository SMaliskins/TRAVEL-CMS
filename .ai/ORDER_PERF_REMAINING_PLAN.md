# Plan: remaining performance & quality work (Order page + Orders list)

Ordered by **recommended execution sequence** (impact, dependencies, risk).  
Synced with `ORDER_PAGE_PERF_SPEC.md` and current codebase state (**2026-04-01**).

---

## Progress snapshot (repo)

| ID | Status | Notes |
|----|--------|--------|
| **A1** | **Partial** | Done: `search` + `range`; **A1.3:** `orders.search_text` + triggers (`migrations/add_orders_search_text.sql`) + API `.or` includes `search_text.ilike` — **apply migration on Supabase**. Client surname filter still client-side fuzzy (`filterOrders`); optional later: sync patterns. |
| **L3** (list) | **Done** | `referral_accrual_line`, `payments`, traveller label collect in `Promise.all` with other post-queries. |
| **L4** (list) | **Partial** | First page `useQuery` (`staleTime: 30s`), load-more appends `extraOrders`; query key includes `search`. Optional: `useInfiniteQuery`, hover prefetch. |
| **B1** | **Deferred** | `lib/orders/orderRowSelect.ts` exists; **order lookup** (`fetchOrderRowByRouteParam`) uses `select("*")` so prod never 404s on missing columns. Re-introduce narrow `SELECT` on bootstrap/GET only after DB column audit. |
| **Order code / bootstrap** | **Done** | `orderFromRouteParam`: slug, decode, case + hyphen variants; per-candidate `.eq` (not `.in`) for `/` in codes. |

---

## Phase A — Orders list API (`/api/orders` + `/orders`)

### A1. Server-side search + pagination (spec **L1**) — highest impact

**Problem (historical):** With `search`, pagination was disabled and all company orders loaded.

**Done in code:** Items 1–2 below.

**Still to do:** Item 3 (full-text style search for traveller / payer / service names on large datasets).

**Do:**

1. ~~Pass search text to API~~ — `ilike` on `order_code`, `client_display_name`.
2. ~~Always apply `range()` / `page` + `pageSize` when search is active.~~
3. ~~**orders.search_text**~~ — **Implemented:** `migrations/add_orders_search_text.sql` (column, `refresh_order_search_text`, triggers, `pg_trgm` index, backfill). `GET /api/orders` `search` uses `search_text.ilike` with existing fields.

**Verify:** Run migration on target DB; large company: latency + spot-check payer / traveller name in search box (query text).

**Note:** Inline “Client / Payer…” surname field uses fuzzy `matchesSearch` on loaded rows only — full-dataset fuzzy surname would need RPC or different UX.

---

### A2. Profit / VAT / margin in database (spec **L2**)

**Problem:** Full `order_services` for all orders on the page + `computeServiceLineEconomics()` per line in Node.

**Done (partial):**

1. **Migration** `migrations/add_orders_list_service_economics_rpc.sql` — `orders_list_service_economics(company_id, order_ids)` + helpers mirroring `serviceEconomics.ts`.
2. **API** `GET /api/orders` — RPC in parallel with other fetches; **JS fallback** if RPC missing/errors. List still loads `order_services` for payers, client names, dates, referral line math, invoice stats.

**Open:** Drop redundant columns from list `order_services` select after audit; QA regression on sample orders.

**Depends on:** Apply migration on Supabase.

---

### A3. Orders list UI polish (spec **L5**, partial)

**Do in order:**

1. **Flags / cities:** **Partial** — no idle load on mount; `ensureWorldCitiesLoaded()` runs once `orders.length > 0`, then `countriesFlagsMap` recomputes. **Open:** API-provided `country_flag` / no client JSON.
2. **Calendar view:** **Partial** — `buildOrdersOverlappingByIsoDay` + `ordersOverlappingByIsoDay` `Map` (cap 800 days/order); cells use O(1) lookup. Same cell `iso` / overlap rules as before.
3. **Debounce / defer:** Popover text fields already debounced (180ms). **Partial:** `useDeferredValue(searchState)` drives `filterOrders` + tree/calendar memos so filter work can yield; `listSearch` stays immediate for RQ + `skipClientQueryTextMatch`.

**Note:** `buildOrdersTree` / `filteredOrders` already use `useMemo` in places — audit calendar + any remaining work per render.

---

### A4. React Query for list — extend (spec **L4+**)

**Done:** First page cached (`staleTime: 30s`), load-more appends `extraOrders`; `queryKey` includes debounced search string (`ordersListQueryKeys.firstPage(pageSize, search)`).

**Done:** `useInfiniteQuery` + `listInfinite` query key (replaces manual `extraOrders` / append).

**Optional next:**

- Expand `queryKey` with other server-driven filters (`status`, `order_type`) when those are sent to the API.
- `prefetchQuery` on link hover for likely next navigation (nice-to-have).

---

## Phase B — Order detail (`/orders/[orderCode]`)

### B1. Narrow `orders` SELECT in bootstrap + GET order (spec Step 3 “remains”)

**Blocked / deferred:** Explicit list lives in `lib/orders/orderRowSelect.ts`, but **lookups use `select("*")`** (`orderFromRouteParam`) because a narrow list that omits a column present in older DBs caused **all orders to 404**.

**Do (when safe):** Re-attach `ORDER_ROW_DETAIL_SELECT` to bootstrap + `GET` **after** confirming every column exists in production (DB Specialist). Keep lookup loop + slug/hyphen resolution as-is.

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

Mark **done** vs **open** for Steps 1–7 and List L1–L5 so the spec matches the repo. **Last full pass: 2026-04-01** (this file + spec).

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