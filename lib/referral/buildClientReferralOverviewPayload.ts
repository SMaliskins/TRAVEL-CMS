import type { SupabaseClient } from "@supabase/supabase-js";
import { buildLiveReferralPortalSnapshot } from "@/lib/referral/computeReferralTotalsFromOrderServices";
import { syncOrderReferralAccruals } from "@/lib/referral/syncOrderReferralAccruals";

function addAmounts(
  target: Record<string, number>,
  rows: { currency: string | null; commission_amount: string | number | null }[] | null
) {
  for (const r of rows || []) {
    const c = (r.currency || "EUR").toUpperCase();
    target[c] = (target[c] || 0) + Number(r.commission_amount ?? 0);
  }
}

function addSettlementAmounts(
  target: Record<string, number>,
  rows: { currency: string | null; amount: string | number | null }[] | null
) {
  for (const r of rows || []) {
    const c = (r.currency || "EUR").toUpperCase();
    target[c] = (target[c] || 0) + Number(r.amount ?? 0);
  }
}

function availableByCurrency(accrued: Record<string, number>, settled: Record<string, number>) {
  const keys = new Set([...Object.keys(accrued), ...Object.keys(settled)]);
  const out: Record<string, number> = {};
  for (const k of keys) {
    out[k] = (accrued[k] || 0) - (settled[k] || 0);
  }
  return out;
}

export type ClientReferralOverviewPayload = {
  hasReferralRole: boolean;
  referralActive: boolean;
  defaultCurrency: string;
  plannedByCurrency: Record<string, number>;
  accruedByCurrency: Record<string, number>;
  settledByCurrency: Record<string, number>;
  availableByCurrency: Record<string, number>;
  lines: Array<{
    id: string;
    commissionAmount: number;
    currency: string;
    status: string;
    createdAt: string;
    baseAmount: number;
    orderCode: string | null;
  }>;
  settlements: Array<{
    id: string;
    amount: number;
    currency: string;
    note: string | null;
    entryDate: string;
    createdAt: string;
  }>;
};

/**
 * Loads balances + lines for /referral (client API). Caller may run heal first when lines are empty.
 */
export async function buildClientReferralOverviewPayload(
  supabase: SupabaseClient,
  partyId: string,
  companyId: string
): Promise<ClientReferralOverviewPayload> {
  const { data: refMeta } = await supabase
    .from("referral_party")
    .select("party_id, default_currency, is_active")
    .eq("party_id", partyId)
    .eq("company_id", companyId)
    .maybeSingle();

  const [plannedRes, accruedRes, settledRes, linesRes, recentSettlements] = await Promise.all([
    supabase
      .from("referral_accrual_line")
      .select("currency, commission_amount")
      .eq("referral_party_id", partyId)
      .eq("company_id", companyId)
      .eq("status", "planned"),
    supabase
      .from("referral_accrual_line")
      .select("currency, commission_amount")
      .eq("referral_party_id", partyId)
      .eq("company_id", companyId)
      .eq("status", "accrued"),
    supabase
      .from("referral_settlement_entry")
      .select("currency, amount")
      .eq("referral_party_id", partyId)
      .eq("company_id", companyId),
    supabase
      .from("referral_accrual_line")
      .select("id, commission_amount, currency, status, created_at, base_amount, order_id")
      .eq("referral_party_id", partyId)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(75),
    supabase
      .from("referral_settlement_entry")
      .select("id, amount, currency, note, entry_date, created_at")
      .eq("referral_party_id", partyId)
      .eq("company_id", companyId)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const plannedByCurrency: Record<string, number> = {};
  const accruedByCurrency: Record<string, number> = {};
  const settledByCurrency: Record<string, number> = {};

  addAmounts(plannedByCurrency, plannedRes.error ? null : plannedRes.data);
  addAmounts(accruedByCurrency, accruedRes.error ? null : accruedRes.data);
  addSettlementAmounts(settledByCurrency, settledRes.error ? null : settledRes.data);

  const rawLines = linesRes.error ? [] : linesRes.data || [];
  const orderIds = [...new Set(rawLines.map((l) => l.order_id).filter(Boolean))] as string[];
  const orderCodeById: Record<string, string> = {};
  if (orderIds.length > 0) {
    const { data: orders } = await supabase
      .from("orders")
      .select("id, order_code")
      .eq("company_id", companyId)
      .in("id", orderIds);
    for (const o of orders || []) {
      orderCodeById[o.id as string] = String(o.order_code ?? "");
    }
  }

  const lines = rawLines.map((l) => ({
    id: l.id as string,
    commissionAmount: Number(l.commission_amount ?? 0),
    currency: (l.currency || "EUR").toUpperCase(),
    status: String(l.status),
    createdAt: String(l.created_at),
    baseAmount: Number(l.base_amount ?? 0),
    orderCode: l.order_id ? orderCodeById[l.order_id as string] || null : null,
  }));

  const settlements = (recentSettlements.error ? [] : recentSettlements.data || []).map((s) => ({
    id: s.id as string,
    amount: Number(s.amount ?? 0),
    currency: (s.currency || "EUR").toUpperCase(),
    note: s.note as string | null,
    entryDate: String(s.entry_date),
    createdAt: String(s.created_at),
  }));

  let finalLines = lines;
  let finalPlanned = plannedByCurrency;
  let finalAccrued = accruedByCurrency;
  let filledFromLiveOrders = false;

  if (finalLines.length === 0) {
    const live = await buildLiveReferralPortalSnapshot(supabase, partyId, companyId);
    if (live.lines.length > 0) {
      filledFromLiveOrders = true;
      finalLines = live.lines;
      finalPlanned = live.plannedByCurrency;
      finalAccrued = live.accruedByCurrency;
    }
  }

  return {
    hasReferralRole: !!refMeta || filledFromLiveOrders,
    referralActive: refMeta?.is_active !== false,
    defaultCurrency: refMeta?.default_currency || "EUR",
    plannedByCurrency: finalPlanned,
    accruedByCurrency: finalAccrued,
    settledByCurrency,
    availableByCurrency: availableByCurrency(finalAccrued, settledByCurrency),
    lines: finalLines,
    settlements,
  };
}

/** Heal must cover all referral orders; a plain LIMIT without ORDER BY can skip the only order that has commission. */
const HEAL_PAGE_SIZE = 60;
const HEAL_MAX_ORDERS = 400;
const HEAL_CONCURRENCY = 4;

/**
 * If there are orders attributed to this party as referral but no accrual rows, rebuild lines from order_services (same as CRM sync).
 */
export async function healReferralAccrualsIfStale(
  supabase: SupabaseClient,
  partyId: string,
  companyId: string
): Promise<void> {
  let offset = 0;
  while (offset < HEAL_MAX_ORDERS) {
    const { data: orderRows } = await supabase
      .from("orders")
      .select("id")
      .eq("referral_party_id", partyId)
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + HEAL_PAGE_SIZE - 1);

    if (!orderRows?.length) break;

    for (let i = 0; i < orderRows.length; i += HEAL_CONCURRENCY) {
      const batch = orderRows.slice(i, i + HEAL_CONCURRENCY);
      const results = await Promise.all(
        batch.map((row) => syncOrderReferralAccruals(supabase, row.id as string, companyId))
      );
      for (let j = 0; j < results.length; j++) {
        const syncResult = results[j];
        if (!syncResult.ok) {
          console.warn("[healReferralAccrualsIfStale] order", batch[j]!.id, syncResult.error);
        }
      }
    }

    offset += orderRows.length;
    if (orderRows.length < HEAL_PAGE_SIZE) break;
  }
}
