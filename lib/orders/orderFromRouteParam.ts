import type { SupabaseClient } from "@supabase/supabase-js";
import { slugToOrderCode } from "@/lib/orders/orderCode";

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

/**
 * All strings we try in `order_code.in.(...)`: case variants + legacy hyphen form
 * when the canonical uses a slash (`0146/26-SM` vs DB `0146-26-SM`).
 */
export function orderCodeLookupCandidates(resolved: string): string[] {
  const s = resolved.trim();
  if (!s) return [];
  const out = new Set<string>();
  for (const v of [s, s.toUpperCase(), s.toLowerCase()]) {
    if (v) out.add(v);
  }
  if (s.includes("/")) {
    const hyphenForm = s.replace("/", "-");
    for (const v of [hyphenForm, hyphenForm.toUpperCase(), hyphenForm.toLowerCase()]) {
      if (v) out.add(v);
    }
  }
  return [...out];
}

export async function fetchOrderRowByRouteParam(
  admin: SupabaseClient,
  companyId: string,
  orderCodeParam: string
): Promise<{ row: Record<string, unknown>; order_code: string } | null> {
  const resolved = resolveOrderCodeFromRouteParam(orderCodeParam);
  const candidates = orderCodeLookupCandidates(resolved);
  // Use per-candidate `.eq().maybeSingle()` — PostgREST `in.(…)` breaks for values containing `/`
  // (order codes like 0146/26-SM), which made every order lookup fail.
  // `select("*")` — avoids 404 for all orders when prod DB is missing a column from a narrow list.
  // Lookup uses `.eq` per candidate (not `.in`) so `order_code` values with `/` work with PostgREST.
  for (const code of candidates) {
    const { data, error } = await admin
      .from("orders")
      .select("*")
      .eq("company_id", companyId)
      .eq("order_code", code)
      .maybeSingle();

    if (error) {
      console.warn("[fetchOrderRowByRouteParam]", code, error.message);
      continue;
    }
    if (!data) continue;
    const row = data as unknown as Record<string, unknown>;
    const oc = row.order_code;
    if (typeof oc === "string") return { row, order_code: oc };
  }
  return null;
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
  for (const code of candidates) {
    const { data, error } = await admin
      .from("orders")
      .select("id, company_id, order_code")
      .eq("order_code", code)
      .maybeSingle();

    if (error) {
      console.warn("[fetchOrderIdentityByRouteParam]", code, error.message);
      continue;
    }
    if (!data) continue;
    const r = data as { id: string; company_id: string; order_code: string };
    if (r.id && r.company_id && typeof r.order_code === "string") return r;
  }
  return null;
}
