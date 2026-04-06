import type { SupabaseClient } from "@supabase/supabase-js";
import { syncOrderReferralAccruals } from "@/lib/referral/syncOrderReferralAccruals";

const CONCURRENCY = 5;
/** Cap per request so opening Directory does not run hundreds of syncs. */
const MAX_ORDERS = 60;
const PROBE_CHUNK = 40;

/**
 * Runs CRM-equivalent referral sync for orders that have no planned/accrued accrual rows.
 *
 * Important: we only treat `planned` / `accrued` as "having lines". If the DB only has `void`
 * rows, the Directory used to skip sync forever and show €0.00 while the order tab showed Est.
 */
export async function syncReferralAccrualsForOrdersMissingLines(
  supabase: SupabaseClient,
  companyId: string,
  orderIds: string[]
): Promise<void> {
  if (orderIds.length === 0) return;

  const unique = [...new Set(orderIds)];
  const hasRenderableLine = new Set<string>();

  for (let c = 0; c < unique.length; c += PROBE_CHUNK) {
    const slice = unique.slice(c, c + PROBE_CHUNK);
    const { data: existing, error: exErr } = await supabase
      .from("referral_accrual_line")
      .select("order_id")
      .eq("company_id", companyId)
      .in("order_id", slice)
      .in("status", ["planned", "accrued"]);

    if (exErr) {
      console.warn("[syncReferralAccrualsForOrdersMissingLines] line probe:", exErr.message);
      continue;
    }
    for (const r of existing || []) {
      const oid = r.order_id as string;
      if (oid) hasRenderableLine.add(oid);
    }
  }

  const missing = unique.filter((id) => !hasRenderableLine.has(id)).slice(0, MAX_ORDERS);

  for (let i = 0; i < missing.length; i += CONCURRENCY) {
    const chunk = missing.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map((oid) => syncOrderReferralAccruals(supabase, oid, companyId))
    );
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      if (!r.ok) {
        console.warn("[syncReferralAccrualsForOrdersMissingLines] order", chunk[j], r.error);
      }
    }
  }
}

/** Re-runs sync for specific orders (e.g. confirmed in CRM but DB totals still zero). */
export async function rerunReferralAccrualSyncForOrders(
  supabase: SupabaseClient,
  companyId: string,
  orderIds: string[]
): Promise<void> {
  const slice = orderIds.slice(0, MAX_ORDERS);
  for (let i = 0; i < slice.length; i += CONCURRENCY) {
    const chunk = slice.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map((oid) => syncOrderReferralAccruals(supabase, oid, companyId))
    );
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      if (!r.ok) {
        console.warn("[rerunReferralAccrualSyncForOrders] order", chunk[j], r.error);
      }
    }
  }
}
