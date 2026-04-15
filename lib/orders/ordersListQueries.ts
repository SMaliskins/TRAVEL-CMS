/**
 * ORDER_PAGE_PERF_SPEC Part 2 L4: React Query infinite list for /orders (cache + load-more).
 */

import { supabase } from "@/lib/supabaseClient";

export const ORDERS_LIST_PAGE_SIZE = 50;
export const ORDERS_LIST_STALE_MS = 30_000;

export const ordersListQueryKeys = {
  /** useInfiniteQuery: pageParam = API page number (1-based) */
  listInfinite: (pageSize: number, search: string, lastName: string) =>
    ["orders-list", "infinite", pageSize, search, lastName] as const,
};

async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

export type OrdersListAgent = { id: string; name: string; initials: string };

export type OrdersListPagination = {
  page: number;
  total: number;
  totalPages: number;
  pageSize?: number;
};

export type OrdersListFetchResult = {
  orders: unknown[];
  agents: OrdersListAgent[];
  pagination: OrdersListPagination | null;
};

export async function fetchOrdersListPage(
  page: number,
  pageSize: number = ORDERS_LIST_PAGE_SIZE,
  search: string = "",
  lastName: string = ""
): Promise<OrdersListFetchResult> {
  const headers = await authHeaders();
  const q = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  const t = search.trim();
  if (t) q.set("search", t);
  const ln = lastName.trim();
  if (ln) q.set("lastName", ln);
  const response = await fetch(`/api/orders?${q.toString()}`, {
    headers,
    credentials: "include",
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const msg =
      typeof (errorData as { error?: string }).error === "string"
        ? (errorData as { error: string }).error
        : `HTTP ${response.status}`;
    throw new Error(msg);
  }
  const data = (await response.json()) as {
    orders?: unknown[];
    agents?: OrdersListAgent[];
    pagination?: OrdersListPagination;
  };
  return {
    orders: data.orders ?? [],
    agents: data.agents ?? [],
    pagination: data.pagination ?? null,
  };
}
