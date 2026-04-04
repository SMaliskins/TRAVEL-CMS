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

**Files to change:**

- `app/api/orders/[orderCode]/services/route.ts` — replace `SELECT `*
- `app/orders/[orderCode]/page.tsx` — lift services data to parent, pass to both tabs

#### 2a. Replace `SELECT *` with explicit columns

In `app/api/orders/[orderCode]/services/route.ts` line ~83, replace:

```typescript
// BEFORE
.select("*")

// AFTER — only columns needed for the services list view
.select(`
  id, order_id, company_id, category_type, category_id,
  service_date_from, service_date_to, status,
  supplier_name, supplier_id,
  description, notes,
  sale_amount, sale_currency, cost_amount, cost_currency,
  commission_amount, commission_percent,
  quantity,
  hotel_name, hotel_star_rating, hotel_board, hotel_room_type,
  hotel_checkin_date, hotel_checkout_date, hotel_nights,
  flight_segments,
  transfer_type, transfer_route,
  created_at, updated_at
`)
```

Drop: `boarding_passes`, `ticket_numbers`, `service_price_line_items`, `pricing_per_client`, all `hotel_preference_*` columns, `hotel_contact_*` overrides, `meal_plan_text`, `seat_preference`, etc. These are only needed when opening the edit modal for a specific service — fetch them on demand.

#### 2b. Add a lightweight `/services/detail/[serviceId]` endpoint

For the edit modal, create a new endpoint that returns ALL columns for a single service:

```
GET /api/orders/{orderCode}/services/{serviceId}
→ SELECT * FROM order_services WHERE id = serviceId
```

This way the list is fast, and full data loads only when user clicks "Edit" on a specific service.

#### 2c. Eliminate duplicate services fetch

Currently `OrderServicesBlock` and `OrderFinanceOverview` both independently fetch `/api/orders/{code}/services`.

**Option A (simple):** Fetch services once in `page.tsx` and pass as prop to both components:

```tsx
const [services, setServices] = useState(null);

useEffect(() => {
  fetch(`/api/orders/${code}/services`).then(r => r.json()).then(setServices);
}, [code]);

// In render:
{activeTab === "client" && <OrderServicesBlock services={services} ... />}
{activeTab === "finances" && <OrderFinanceOverview services={services} ... />}
```

**Option B (better, Step 4):** Use React Query with shared cache key — both components call `useServices(orderCode)` and React Query deduplicates automatically.

**Expected impact:** Response payload reduced from ~200KB to ~30-50KB. One fewer API call.

---

### Step 3: Bootstrap endpoint for order header

**Files to create/change:**

- Create `app/api/orders/[orderCode]/bootstrap/route.ts`
- Update `app/orders/[orderCode]/page.tsx` — single fetch on mount

**What the bootstrap returns:**

```typescript
{
  order: { /* core order fields: code, status, dates, amounts, owner, manager */ },
  travellers: [ /* id, name, dob — lightweight */ ],
  invoiceSummary: { count, totalAmount, paidAmount, outstandingAmount },
}
```

**Inside the bootstrap route — parallelize everything:**

```typescript
const [order, travellers, invoiceSummary] = await Promise.all([
  fetchOrderCore(orderCode, companyId),      // 1 query
  fetchTravellers(orderId),                    // 1 query
  fetchInvoiceSummary(orderId, companyId),     // 1 query
]);
```

**Refactor `fetchOrderCore`** — currently does 6-7 sequential queries. Merge into 2-3 parallel ones:

```typescript
const [orderRow, amounts, ownerProfile] = await Promise.all([
  supabaseAdmin.from("orders").select("...").eq("order_code", code).single(),
  supabaseAdmin.rpc("get_order_amounts", { p_order_id: orderId }),  // DB function
  supabaseAdmin.from("profiles").select("display_name, avatar_url").eq("user_id", ownerId).single(),
]);
```

Consider creating a Postgres function `get_order_amounts(order_id)` that calculates service totals + payment totals in one query instead of multiple round-trips.

**On the page:** Replace 3 separate useEffects with one:

```typescript
useEffect(() => {
  const token = await supabase.auth.getSession(); // ONE getSession call
  const res = await fetch(`/api/orders/${code}/bootstrap`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const { order, travellers, invoiceSummary } = await res.json();
  setOrder(order);
  setTravellers(travellers);
  setInvoiceSummary(invoiceSummary);
}, [code]);
```

**Expected impact:** 3 API calls → 1. Multiple sequential DB queries → parallel. Faster first render of order header.

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