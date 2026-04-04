# Order Page Performance Optimization — Technical Specification

> Goal: Order page opens and tabs switch "instantly" (perceived < 300ms).
> This spec is the combined analysis of Cursor + Claude (Cowork), covering both frontend (bundle, code splitting) and backend (queries, payload, caching).

---

## Current State: Why It's Slow

The order detail page (`app/orders/[orderCode]/page.tsx`) has **two layers of problems**:

### Frontend Layer

1. **Entire page is `"use client"` with all tabs eagerly imported** — browser parses thousands of lines of JS even for one tab
2. `**loadWorldCities()` called on every mount** — heavy dataset loaded before user needs it
3. **Multiple `getSession()` calls** — each useEffect independently calls Supabase auth
4. `**router.replace` on tab switch** — triggers Next.js router cycle instead of plain `history.replaceState`

### Backend Layer

1. `**SELECT `* on order_services** — returns 100+ columns including heavy JSON fields (flight_segments, boarding_passes, pricing_per_client, service_price_line_items, 20+ hotel_* columns)
2. **Services fetched TWICE** — Client tab (`OrderServicesBlock`) and Finance tab (`OrderFinanceOverview`) both call `/api/orders/{code}/services`
3. **Main order API runs 6-7 sequential DB queries** — order → services (sums) → payments → invoices → owner profile (2-3 attempts) → referral party
4. **Documents API: N+1 signed URL calls** — each document gets an individual `createSignedUrl()` to Supabase Storage
5. **No pagination** — documents, communications, invoices all fetched without LIMIT
6. **No data caching between tabs** — switching away and back re-fetches everything

---

## Implementation Plan (7 Steps, Priority Order)

### Step 1: Code-split heavy tabs with `next/dynamic`

**Files to change:**

- `app/orders/[orderCode]/page.tsx`

**What to do:**
Replace static imports of tab components with dynamic imports:

```tsx
import dynamic from "next/dynamic";

// Keep default tab (services) as static import for instant first render
import OrderServicesBlock from "./_components/OrderServicesBlock";

// Lazy-load everything else
const OrderFinanceOverview = dynamic(
  () => import("./_components/OrderFinanceOverview"),
  { loading: () => <TabSkeleton />, ssr: false }
);
const OrderDocumentsTab = dynamic(
  () => import("./_components/OrderDocumentsTab"),
  { loading: () => <TabSkeleton />, ssr: false }
);
const OrderCommunicationsTab = dynamic(
  () => import("./_components/OrderCommunicationsTab"),
  { loading: () => <TabSkeleton />, ssr: false }
);
const OrderClientsDataTab = dynamic(
  () => import("./_components/OrderClientsDataTab"),
  { loading: () => <TabSkeleton />, ssr: false }
);
const InvoiceCreator = dynamic(
  () => import("./_components/InvoiceCreator"),
  { ssr: false }
);
const InvoiceList = dynamic(
  () => import("./_components/InvoiceList"),
  { loading: () => <TabSkeleton />, ssr: false }
);
const OrderPaymentsList = dynamic(
  () => import("./_components/OrderPaymentsList"),
  { ssr: false }
);
```

**Checklist (regression risks):**

- `servicesBlockRef` — OrderServicesBlock stays static, so ref works as-is
- `paymentsListRef` — wrap OrderPaymentsList with `React.forwardRef` before making it dynamic
- Deep link `?tab=documents` — dynamic chunk may not be loaded yet; the conditional render `{activeTab === "documents" && <OrderDocumentsTab />}` already handles this (component mounts → chunk loads → skeleton shown → content appears)
- Create a reusable `<TabSkeleton />` component (simple pulse animation matching tab content area height)

**Expected impact:** Initial JS bundle reduced by 60-70%. First paint much faster.

---

### Step 2: Narrow SELECT for services API + eliminate duplicate fetch

**Status:** ✅ Partially implemented by Cursor.

**What was done:**

- **2a.** `SELECT *` replaced with explicit `ORDER_SERVICES_LIST_COLUMNS` (79 fields) in `services/route.ts`
- **2b.** Separate `GET /api/orders/{code}/services/[serviceId]` endpoint created — returns `SELECT *` for edit modal
- **2c.** Duplicate fetch eliminated — single `useQuery` in `page.tsx` with shared `orderPageQueryKeys.services()` key; both Client tab and Finance tab use the same cached data

**What remains — further narrowing (optional, trade-off):**

The current 79-column list SELECT is intentionally wide because `OrderServicesBlock` renders inline data that would otherwise require a detail fetch:
- **Terms column** uses `refund_policy`, `free_cancellation_until`, `price_type`, `cancellation_penalty_amount`, `cancellation_penalty_percent` (see `case "terms"` ~line 2961–3012 in OrderServicesBlock)
- **Hotel/transfer display** uses `hotel_address`, `hotel_phone`, `hotel_email`, `hotel_bed_type`, etc.

Fields that are **safely removable** from list SELECT (only used in edit modal, fetched via `/services/[serviceId]`):
- `driver_name`, `driver_phone`, `driver_notes` — not rendered in default table columns
- Potentially `payment_terms`, `supplier_booking_type` — verify with UI first

> ⚠️ Do NOT blindly cut to 20-25 columns — audit each field against `mapOrderServiceRowToListApi`, smart hints, itinerary display, and Terms column before removing.

---

### Step 3: Bootstrap endpoint for order header

**Status:** ✅ Implemented by Cursor.

**What was done:**

- `app/api/orders/[orderCode]/bootstrap/route.ts` created
- `lib/orders/orderPageBootstrap.ts` contains `buildExpandedOrderAndInvoiceSummary()` with internal `Promise.all` for parallel sub-queries
- Bootstrap returns: `order` (expanded), `travellers`, `invoiceSummary`
- `page.tsx` (~line 871-886) fetches bootstrap on mount

**What remains:**

- Both `bootstrap/route.ts` (line ~33-35) and `GET /api/orders/[orderCode]/route.ts` (line 36) still use `select("*")` on the `orders` table. Replace with an explicit column list matching what `buildExpandedOrderAndInvoiceSummary` + the page header actually need.
- This is a safe, low-risk change: enumerate the fields used by `OrderPageHeaderE`, date pickers, status badge, client display, and the bootstrap summary builder.

---

### Step 4: React Query for tab data caching

**Install:** `@tanstack/react-query` (check if already in package.json — it IS in the Client/ mobile app but may not be in the main Next.js app).

**What to wrap:**

```typescript
// hooks/useOrderServices.ts
export function useOrderServices(orderCode: string) {
  return useQuery({
    queryKey: ["order-services", orderCode],
    queryFn: () => fetch(`/api/orders/${orderCode}/services`).then(r => r.json()),
    staleTime: 60_000, // 1 min — don't refetch if user switches tabs within a minute
    gcTime: 5 * 60_000, // keep in cache for 5 min
  });
}
```

**Benefits:**

- Services tab → Finance tab: no re-fetch (same cache key)
- Tab A → Tab B → back to Tab A: instant from cache
- `invoiceRefetchTrigger` changes → invalidate only the specific query, not the entire order
- Automatic deduplication of concurrent requests

**Apply to all tab data fetches:**

- `useOrderServices(orderCode)` — shared between Client + Finance tabs
- `useOrderDocuments(orderCode)` — Documents tab
- `useOrderCommunications(orderCode)` — Communications tab
- `useOrderClientsData(orderCode)` — Clients Data tab

**On mutation (invoice created, service edited, etc.):**

```typescript
queryClient.invalidateQueries({ queryKey: ["order-services", orderCode] });
```

This replaces the `invoiceRefetchTrigger` pattern — no more full order reload on invoice change.

**Expected impact:** Tab switching becomes instant (cached). No duplicate fetches. Granular invalidation instead of full page reload.

---

### Step 5: Defer `loadWorldCities()`

**File:** `app/orders/[orderCode]/page.tsx`

**Current:** `loadWorldCities()` is called in a `useEffect` on page mount.

**Change:** Load it lazily, only when user interacts with the city selector:

```typescript
// In CityMultiSelect component:
const [citiesLoaded, setCitiesLoaded] = useState(false);

const handleFocus = useCallback(async () => {
  if (!citiesLoaded) {
    await loadWorldCities();
    setCitiesLoaded(true);
  }
}, [citiesLoaded]);

// Or use requestIdleCallback for background preload:
useEffect(() => {
  const handle = requestIdleCallback(() => loadWorldCities());
  return () => cancelIdleCallback(handle);
}, []);
```

**Expected impact:** Removes blocking data load from critical path. Cities only loaded when actually needed.

---

### Step 6: Batch signed URLs in Documents API

**File:** `app/api/orders/[orderCode]/documents/route.ts` lines ~66-73

**Current:**

```typescript
const withUrls = await Promise.all(
  docs.map(async (d) => {
    const { data } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(d.file_path, 3600); // N individual calls
    return { ...d, download_url: data?.signedUrl || null };
  })
);
```

**Change:** Use Supabase batch signed URL API:

```typescript
const paths = docs.map(d => d.file_path);
const { data: signedUrls } = await supabaseAdmin.storage
  .from(BUCKET_NAME)
  .createSignedUrls(paths, 3600); // ONE batch call

const withUrls = docs.map((d, i) => ({
  ...d,
  download_url: signedUrls?.[i]?.signedUrl || null,
}));
```

**Note:** `createSignedUrls` (plural) is a real Supabase Storage method that accepts an array of paths.

**Expected impact:** 50 documents = 1 API call instead of 50. Documents tab loads 10-50x faster.

---

### Step 7: Parallelize remaining sequential queries in order API

**File:** `app/api/orders/[orderCode]/route.ts`

After Steps 2-3 reduce the payload, parallelize what remains. The current flow:

```
1. fetch order          (sequential)
2. fetch services sums  (depends on order.id)
3. fetch payments       (depends on order.id)
4. fetch invoices       (depends on order.id)
5. fetch owner profile  (depends on order.owner_id — 2-3 attempts)
6. fetch date services  (if dates missing)
7. fetch referral party (if referral_party_id)
```

**Change to:**

```typescript
const order = await fetchOrder(orderCode); // must be first (need order.id)

// Everything else in parallel
const [amounts, ownerProfile, referralName] = await Promise.all([
  fetchOrderAmounts(order.id),           // services + payments + invoices in one
  fetchOwnerProfile(order.owner_id),     // single lookup with fallback chain
  order.referral_party_id
    ? fetchReferralName(order.referral_party_id)
    : Promise.resolve(null),
]);
```

Consider a Postgres function that returns amounts in one call:

```sql
CREATE FUNCTION get_order_summary(p_order_id UUID)
RETURNS JSON AS $$
  SELECT json_build_object(
    'service_total', COALESCE(SUM(s.sale_amount), 0),
    'cost_total', COALESCE(SUM(s.cost_amount), 0),
    'paid_total', (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE order_id = p_order_id),
    'invoice_count', (SELECT COUNT(*) FROM invoices WHERE order_id = p_order_id)
  )
  FROM order_services s WHERE s.order_id = p_order_id;
$$ LANGUAGE SQL STABLE;
```

**Expected impact:** 6-7 sequential queries → 1 + 3 parallel. Server response time cut in half.

---

## Execution Order


| Step | What                                 | Effort | Impact                               | Risk                    |
| ---- | ------------------------------------ | ------ | ------------------------------------ | ----------------------- |
| 1    | `next/dynamic` for tabs              | 1-2h   | HIGH — smaller initial bundle        | LOW (check refs)        |
| 2    | Narrow SELECT + kill duplicate fetch | 2-3h   | HIGH — 75% less payload              | LOW                     |
| 3    | Bootstrap endpoint                   | 3-4h   | HIGH — 3 calls → 1, parallel DB      | MEDIUM                  |
| 4    | React Query caching                  | 3-4h   | HIGH — instant tab switching         | MEDIUM (new dependency) |
| 5    | Defer loadWorldCities                | 30min  | MEDIUM — faster first paint          | LOW                     |
| 6    | Batch signed URLs                    | 30min  | MEDIUM — Documents tab 10-50x faster | LOW                     |
| 7    | Parallelize order API                | 1-2h   | MEDIUM — server response 2x faster   | LOW                     |


**Total estimated effort: 1.5-2 days**

Steps 1, 5, 6 are quick wins with near-zero risk — do them first.
Steps 2 + 4 together solve the duplicate fetch problem completely.
Step 3 is the biggest refactor but has the most server-side impact.

---

## What NOT to Do

- **Don't SSR the order page** — it's behind auth, SSR adds complexity with no benefit
- **Don't prefetch all tab data on page load** — the whole point is lazy loading per tab
- **Don't add Redis/Memcached** — React Query client cache is sufficient for this scale
- **Don't rewrite services API to GraphQL** — column selection solves the overfetch problem
- **Don't paginate services** — orders typically have 3-15 services, not hundreds; paginate documents/communications instead

---

## How to Verify

After each step, measure:

1. **Network tab:** Count requests, total payload size, request waterfall
2. **Lighthouse Performance score** on the order page (before/after)
3. **Time to Interactive (TTI)** — should drop significantly after Step 1
4. **Tab switch time** — should be < 100ms after Step 4 (cached) or < 500ms (first load)
5. **Server response time** for `/api/orders/{code}` — should halve after Step 3+7

Target: order page loads in < 1s, tab switching feels instant.

---

## Part 2: Orders LIST Page (`/orders`) — Performance Problems

> Applies to `app/orders/page.tsx` (1600+ lines) and `app/api/orders/route.ts` (573 lines, Edge Runtime).

### Current State: Why the List is Slow

#### Backend (API) Layer

1. **Search disables pagination** — when `search` param is present, `range()` is NOT applied (`if (!search)`). The API loads ALL orders for the company, then filters in-memory. For 500+ orders this is 200KB+ before filtering even starts.

2. **Search triggers 4+ extra DB round-trips** — after loading all orders, the search path runs:
   - `order_services` query (client_name, payer_name per order) — chunked in 400s
   - `collectTravellerSearchLabelsByOrder()` — which itself does:
     - `order_travellers` + `party` join (chunked)
     - `order_services` → `order_service_travellers` → `party` (3 sequential chunked queries)
   - Total: 5-8 extra DB queries just for search name resolution

3. **Client-side profit recalculation** — the API fetches ALL `order_services` for ALL orders on the page (line 253), then runs `computeServiceLineEconomics()` per service line in JS to calculate profit, VAT, referral commission. This is O(orders × services) in application code instead of one DB aggregation.

4. **4 sequential post-queries after main fetch** — after the primary orders query, the API runs:
   - `order_services` (for profit calc + invoice stats)
   - `user_profiles` (owner names)
   - `invoices` (invoice statistics)
   - `referral_accrual_line` (referral commissions) — sequential, NOT in the Promise.all
   - `payments` (processing fees) — sequential, NOT in the Promise.all
   - `collectTravellerSearchLabelsByOrder()` — sequential, for list display

   Only the first three are in `Promise.all`. The last three run sequentially after.

5. **No server-side search** — Supabase `ilike` / `textSearch` is not used. The entire search is JS `matchesSearch()` on client_display_name, order_code, and service client names loaded in bulk.

#### Frontend Layer

6. **`loadWorldCities()` on orders list page** — `app/orders/page.tsx` line 14 imports `getCityByName, loadWorldCities` and calls it on mount to resolve country flags from city names. This is a ~150KB dataset loaded eagerly.

7. **Calendar view: O(n × 42 cells)** — the calendar iterates all filtered orders against every visible day cell. With 200 orders × 42 cells = 8400 comparisons per render.

8. **Tree view rebuilt on every filter change** — `buildOrdersTree()` groups orders into Year→Month→Day hierarchy, recalculated on every filter/search keystroke without memoization.

9. **No data caching** — navigating to an order detail and pressing Back re-fetches the entire orders list from scratch.

---

### Implementation Plan: Orders List Page (5 Steps)

#### List Step 1: Move search to server-side with `ilike` / `or()` filter

**File:** `app/api/orders/route.ts`

Replace the in-memory search with Supabase filters:

```typescript
if (search) {
  const pattern = `%${search}%`;
  query = query.or(
    `order_code.ilike.${pattern},client_display_name.ilike.${pattern}`
  );
  // Still apply pagination!
  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);
}
```

For traveller name search, add a DB function or a materialized `search_text` column on orders:

```sql
-- Option: trigger that updates orders.search_text on service/traveller changes
ALTER TABLE orders ADD COLUMN IF NOT EXISTS search_text TEXT;
-- Contains: client_display_name + all traveller names + payer names
-- Updated by trigger on order_travellers, order_services, order_service_travellers
```

**Expected impact:** Eliminates 5-8 extra DB queries during search. Pagination always works. Response time drops from 2-5s to <300ms.

#### List Step 2: Move profit/VAT calculation to DB

**File:** `app/api/orders/route.ts`

Create a Postgres function that calculates profit per order:

```sql
CREATE FUNCTION get_orders_summary(p_company_id UUID, p_order_ids UUID[])
RETURNS TABLE(
  order_id UUID,
  service_amount NUMERIC,
  profit_net NUMERIC,
  vat_on_margin NUMERIC,
  referral_commission NUMERIC
) AS $$ ... $$ LANGUAGE SQL STABLE;
```

This replaces fetching ALL services + running `computeServiceLineEconomics()` per line in JS.

**Expected impact:** Removes the biggest payload (services for all orders) and all per-line JS computation. API response payload drops 60-80%.

#### List Step 3: Parallelize ALL post-queries

**File:** `app/api/orders/route.ts`

Move `referral_accrual_line`, `payments` (processing fees), and `collectTravellerSearchLabelsByOrder()` into the existing `Promise.all`:

```typescript
const [servicesResult, ownerProfilesResult, invoicesResult, refRows, feeRows, travellerLabels] = await Promise.all([
  // ... existing 3 ...
  supabaseAdmin.from("referral_accrual_line")...,
  supabaseAdmin.from("payments")...,
  collectTravellerSearchLabelsByOrder(...),
]);
```

**Expected impact:** 3 sequential queries become parallel. Saves 200-500ms.

#### List Step 4: Cache orders list with React Query

**File:** `app/orders/page.tsx`

Wrap the orders fetch in `useQuery`:

```typescript
const { data, isPending } = useQuery({
  queryKey: ["orders-list", { status, orderType, search, page }],
  queryFn: () => fetchOrdersList({ status, orderType, search, page }),
  staleTime: 30_000,
  gcTime: 5 * 60_000,
});
```

**Benefits:** Back button from order detail → instant list from cache. Filter changes within 30s don't re-fetch.

#### List Step 5: Defer flag resolution / memoize tree

**File:** `app/orders/page.tsx`

- Remove `loadWorldCities()` from orders list — pre-compute `countryFlag` in the API response instead
- Memoize `buildOrdersTree()` and calendar cell matching with `useMemo` keyed on filtered orders
- Debounce search input (300ms) to avoid re-renders on every keystroke

**Expected impact:** Faster renders, no blocking city data load.

---

### Orders List — Execution Order

| Step | What | Effort | Impact | Risk |
| ---- | ---- | ------ | ------ | ---- |
| L1 | Server-side search | 3-4h | CRITICAL — eliminates bulk load | MEDIUM |
| L2 | DB profit calculation | 4-6h | HIGH — 80% less payload | MEDIUM (new DB function) |
| L3 | Parallelize post-queries | 30min | MEDIUM — 200-500ms faster | LOW |
| L4 | React Query for list | 1-2h | HIGH — instant back navigation | LOW |
| L5 | Defer cities + memoize | 1h | MEDIUM — smoother UI | LOW |

**Total estimated effort: 1-1.5 days**

L3 is a quick win. L1 is the most impactful single change. L2 is the biggest refactor but eliminates the heaviest payload.