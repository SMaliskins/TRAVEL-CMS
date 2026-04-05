import type { SupabaseClient } from "@supabase/supabase-js";
import { slugToOrderCode } from "@/lib/orders/orderCode";
import { ORDER_ROW_DETAIL_SELECT } from "@/lib/orders/orderRowSelect";

/**
 * Next `[orderCode]` may be URL slug (`0146-26-sm`), encoded canonical (`0146%2F26-SM`),
 * or mixed case vs DB. Normalize for lookups.
 */
export function resolveOrderCodeFromRouteParam(raw: string): string {
  let s = (raw || "").trim();
  try {
    s = decodeURIComponent(s);
  } catch {
    /* ignore */
  }
  if (!s) return s;
  if (s.includes("/")) return s;
  return slugToOrderCode(s);
}

export function orderCodeLookupCandidates(resolved: string): string[] {
  if (!resolved) return [];
  const u = resolved.toUpperCase();
  const l = resolved.toLowerCase();
  return [...new Set([resolved, u, l])];
}

export async function fetchOrderRowByRouteParam(
  admin: SupabaseClient,
  companyId: string,
  orderCodeParam: string
): Promise<{ row: Record<string, unknown>; order_code: string } | null> {
  const resolved = resolveOrderCodeFromRouteParam(orderCodeParam);
  const candidates = orderCodeLookupCandidates(resolved);
  const { data: rows, error } = await admin
    .from("orders")
    .select(ORDER_ROW_DETAIL_SELECT)
    .eq("company_id", companyId)
    .in("order_code", candidates)
    .limit(2);

  if (error) {
    console.warn("[fetchOrderRowByRouteParam]", error.message);
    return null;
  }
  if (!rows?.length) return null;
  if (rows.length > 1) {
    console.warn("[fetchOrderRowByRouteParam] multiple matches for", candidates);
  }
  const row = rows[0] as unknown as Record<string, unknown>;
  const oc = row.order_code;
  if (typeof oc !== "string") return null;
  return { row, order_code: oc };
}

export async function fetchOrderIdByRouteParam(
  admin: SupabaseClient,
  companyId: string,
  orderCodeParam: string
): Promise<string | null> {
  const found = await fetchOrderRowByRouteParam(admin, companyId, orderCodeParam);
  const id = found?.row?.id;
  return typeof id === "string" ? id : null;
}

/** Same code resolution as fetchOrderRowByRouteParam but no company filter (legacy invoices GET/POST). */
export async function fetchOrderIdentityByRouteParam(
  admin: SupabaseClient,
  orderCodeParam: string
): Promise<{ id: string; company_id: string; order_code: string } | null> {
  const resolved = resolveOrderCodeFromRouteParam(orderCodeParam);
  const candidates = orderCodeLookupCandidates(resolved);
  const { data: rows, error } = await admin
    .from("orders")
    .select("id, company_id, order_code")
    .in("order_code", candidates)
    .limit(2);

  if (error) {
    console.warn("[fetchOrderIdentityByRouteParam]", error.message);
    return null;
  }
  if (!rows?.length) return null;
  const r = rows[0] as { id: string; company_id: string; order_code: string };
  return r;
}
