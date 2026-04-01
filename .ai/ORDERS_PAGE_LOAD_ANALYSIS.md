# Orders Page Load Analysis — Performance & Speed

## 1. What Blocks / Loads When You Open `/orders`

### Waterfall (approximate sequence)

```
1. HTML Document
   └── 9 Google Fonts (Geist, Inter, Roboto, Open Sans, Lato, Nunito, Poppins, Source Sans 3)
   └── flag-icons CDN (external)
   └── Inline script (font/theme from localStorage)

2. React Hydration
   └── LayoutClientWrapper
       └── UserProvider      → fetch /api/profile (after getSession)
       └── CompanySettingsProvider → fetch /api/company (after getSession)
       └── TabsProvider, ModalOverlayProvider, NavigationHistoryProvider

3. AuthGuard (blocks render until done)
   └── supabase.auth.getSession()
   └── supabase.auth.getUser()
   └── Possibly 400ms retry if session not ready
   └── Redirect to /login if not authenticated

4. ClientLayout (Sidebar, TopBar, TabBar)
   └── Renders after AuthGuard passes

5. Orders Page
   └── fetchOrders() → GET /api/orders?page=1&pageSize=200
       └── getApiUser (JWT validation + user_profiles/roles)
       └── Supabase: orders (paginated)
       └── Supabase: order_services (for all orderIds)
       └── Supabase: user_profiles (owners)
       └── Supabase: invoices (for all orderIds)
       └── Heavy in-memory aggregation (amount, profit, VAT, invoice stats)
   └── loadWorldCities() on requestIdleCallback
       └── fetch /data/world-cities.json (~2.1 MB)
       └── fetch /api/geo/cities-cache

6. ordersSearchStore.init() + URL params sync
```

---

## 2. Main Bottlenecks (Why It's Slow)

| Bottleneck | Impact | Location |
|------------|--------|----------|
| **AuthGuard blocks everything** | User sees skeleton until auth done | AuthGuard.tsx |
| **Sequential auth + layout + orders** | No parallelization | App structure |
| **/api/orders does 4+ DB round-trips** | orders → services → invoices → profiles | app/api/orders/route.ts |
| **Heavy payload** | 200 orders + all services + all invoices | API |
| **world-cities.json 2.1 MB** | Loaded on Orders page but not needed for list view | lib/data/cities.ts, orders/page.tsx |
| **9 Google Fonts** | Extra network, render blocking | layout.tsx |
| **getApiUser: 2–3 round-trips** | JWT + user_profiles + maybe profiles fallback | lib/auth/getApiUser.ts |
| **No caching** | Every visit hits DB | API routes |

---

## 3. How to Make It ~10× Faster

### A. Architecture (largest impact)

1. **Don't block on AuthGuard for layout**
   - Show shell (Sidebar, TopBar) immediately; only block content area.
   - Or: use middleware for auth, stream content.

2. **Server Components / RSC for initial data**
   - Fetch orders on server, stream HTML. No client fetch before first paint.

3. **Parallel data loading**
   - Auth + Company + Profile + Orders in parallel where possible.
   - Use `Promise.all` or React 18 Suspense.

### B. API /api/orders

4. **Single optimized query or view**
   - Use a DB view or RPC that returns pre-aggregated list.
   - Or: 1 query for orders, 1 for services/invoices via JOINs or lateral joins.

5. **Smaller initial payload**
   - First page: 20–50 orders.
   - Load more on scroll/pagination.

6. **Cache API response**
   - Vercel: `cache: 'force-cache'` or short `revalidate`.
   - Or Redis/Vercel KV for hot data.

### C. world-cities.json

7. **Lazy load only when needed**
   - Orders list uses `formatCountriesWithFlags` → `countryToISO` (static map).
   - Move `loadWorldCities()` out of Orders page.
   - Call it only when user opens CityMultiSelect, OrderClientSection, etc.

8. **Split or compress cities**
   - Split by region or use gzip.
   - Or: API endpoint that returns cities by query.

### D. Fonts

9. **Fewer fonts**
   - Use 1–2 font families.
   - Or `font-display: swap` and subset.

### E. Vercel / Infrastructure

10. **Edge runtime for /api/orders**
    - Lower cold start vs Node serverless.

11. **Region**
    - Deploy close to Supabase (e.g. same region).

12. **ISR / static for shell**
    - Shell can be static; data from API.

---

## 4. What You Might Not Know (Quick Wins)

| Topic | Detail |
|-------|--------|
| **Orders list does NOT need world-cities** | `formatCountriesWithFlags` uses `countryToISO` (static). `loadWorldCities` is only for CityMultiSelect and similar. |
| **requestIdleCallback still runs** | It runs when browser is "idle", but 2.1 MB parse blocks main thread. |
| **Vercel serverless cold starts** | First request after idle can add 200–500 ms. Edge reduces this. |
| **Supabase connection pooling** | Serverless can exhaust connections. Supabase Pooler helps. |
| **Next.js 14+ `loading.tsx`** | Per-route loading UI without blocking layout. |
| **React 18 `use()` + Suspense** | Can fetch in parallel and stream. |
| **Streaming with `loading.tsx`** | Show shell immediately, stream data. |

---

## 5. Does Vercel Affect Speed?

Yes:

- **Cold starts**: Serverless functions can add 200–500 ms on first hit.
- **Region**: Distance to Supabase adds latency.
- **No default cache**: API routes are dynamic unless configured.

Mitigations:

- Edge runtime for `/api/orders`.
- Same region as Supabase.
- Cache headers or `revalidate` for list data.
- Consider Vercel Postgres/KV if you add a cache layer.

---

## 6. Recommended Implementation Order

1. **Remove `loadWorldCities` from Orders page** (no code for cities in list).
2. **Reduce initial page size** to 50 (or 20) for first load.
3. **Add `loading.tsx`** for /orders (instant shell, loading state for table).
4. **Parallelize auth + company + profile** in providers.
5. **Optimize /api/orders**: fewer queries, view, or RPC.
6. **Add short cache** (e.g. 10–30 s) for /api/orders.
7. **Cut fonts** to 2–3.
8. **Edge runtime** for /api/orders.
9. **RSC for orders** when ready (larger refactor).

---

## 7. Summary

The main cost is:

1. Sequential auth → layout → orders.
2. Heavy /api/orders (4+ queries, big payload).
3. Unnecessary 2.1 MB cities load on Orders.
4. No caching.

Fastest gains with minimal changes: remove cities from Orders, smaller first page, `loading.tsx`, and a short cache on the API.
