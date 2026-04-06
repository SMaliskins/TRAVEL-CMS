import type { SupabaseClient } from "@supabase/supabase-js";
import { computeServiceLineEconomics } from "@/lib/orders/serviceEconomics";

type CatRow = { id: string; type: string | null; name: string | null };

function resolveCategoryIdForService(
  categoryId: string | null | undefined,
  categoryLabel: string | null | undefined,
  categories: CatRow[]
): string | null {
  if (categoryId && String(categoryId).length >= 32) return String(categoryId);
  const raw = (categoryLabel || "").trim().toLowerCase();
  if (!raw || categories.length === 0) return null;
  const asUnderscore = raw.replace(/\s+/g, "_");
  for (const c of categories) {
    const t = (c.type || "").trim().toLowerCase();
    if (t && (t === raw || t === asUnderscore)) return c.id;
  }
  for (const c of categories) {
    const n = (c.name || "").trim().toLowerCase();
    if (n && n === raw) return c.id;
  }
  return null;
}

type ServiceRow = {
  id: string;
  category_id?: string | null;
  category?: string | null;
  client_price?: number | string | null;
  service_price?: number | string | null;
  res_status?: string | null;
  service_type?: string | null;
  invoice_id?: string | null;
  commission_amount?: number | string | null;
  vat_rate?: number | string | null;
  referral_include_in_commission?: boolean | null;
  referral_commission_percent_override?: number | string | null;
  referral_commission_fixed_amount?: number | string | null;
};

function profitNetByServiceIdAfterFees(
  services: ServiceRow[],
  totalProcessingFees: number
): Map<string, number> {
  const list = services.map((svc) => {
    const econ = computeServiceLineEconomics({
      client_price: svc.client_price,
      service_price: svc.service_price,
      service_type: svc.service_type,
      category: svc.category,
      commission_amount: svc.commission_amount,
      vat_rate: svc.vat_rate,
    });
    return { id: svc.id, econ };
  });
  const totalMargin = list.reduce((sum, x) => sum + Math.max(x.econ.marginGross, 0), 0);
  const map = new Map<string, number>();
  for (const { id, econ } of list) {
    const marginGross = econ.marginGross;
    const feeShare =
      totalMargin > 0 && totalProcessingFees > 0
        ? Math.round(totalProcessingFees * (Math.max(marginGross, 0) / totalMargin) * 100) / 100
        : 0;
    const adjustedMargin = marginGross - feeShare;
    const ratio = marginGross > 0 ? adjustedMargin / marginGross : 1;
    const adjustedVat = Math.round(econ.vatOnMargin * ratio * 100) / 100;
    const adjustedProfitNet = Math.round((adjustedMargin - adjustedVat) * 100) / 100;
    map.set(id, adjustedProfitNet);
  }
  return map;
}

/**
 * Same commission math as syncOrderReferralAccruals / order Referral tab (no DB writes).
 * Used when referral_accrual_line is empty so Directory still shows bonuses.
 */
export async function computeReferralPlannedAccruedFromServices(
  supabase: SupabaseClient,
  orderId: string,
  companyId: string,
  referralPartyId: string
): Promise<{ planned: number; accrued: number } | null> {
  const { data: order, error: oErr } = await supabase
    .from("orders")
    .select("id, referral_party_id, referral_commission_confirmed, date_to")
    .eq("id", orderId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (oErr || !order) return null;
  const rid = order.referral_party_id as string | null;
  if (!rid || rid !== referralPartyId) return null;

  const [{ data: services }, { data: payRows }, { data: rates }, { data: categoryRows }] =
    await Promise.all([
      supabase
        .from("order_services")
        .select(
          "id, category_id, category, client_price, service_price, res_status, service_type, invoice_id, commission_amount, vat_rate, referral_include_in_commission, referral_commission_percent_override, referral_commission_fixed_amount"
        )
        .eq("order_id", orderId)
        .eq("company_id", companyId),
      supabase
        .from("payments")
        .select("processing_fee")
        .eq("order_id", orderId)
        .eq("company_id", companyId)
        .neq("status", "cancelled"),
      supabase
        .from("referral_party_category_rate")
        .select("category_id, rate_kind, rate_value")
        .eq("party_id", rid)
        .eq("company_id", companyId),
      supabase.from("travel_service_categories").select("id, type, name").eq("company_id", companyId),
    ]);

  const totalProcessingFees = (payRows || []).reduce(
    (s, r) => s + (Number((r as { processing_fee?: unknown }).processing_fee) || 0),
    0
  );
  const list = (services || []) as ServiceRow[];
  const profitAfterFees = profitNetByServiceIdAfterFees(list, totalProcessingFees);
  const categories = (categoryRows || []) as CatRow[];
  const rateByCat = new Map(
    (rates || []).map((r: { category_id: string; rate_kind: string; rate_value: number | string }) => [
      r.category_id,
      { kind: r.rate_kind as "percent" | "fixed", value: Number(r.rate_value) },
    ])
  );

  const today = new Date().toISOString().slice(0, 10);
  const dateTo = order.date_to ? String(order.date_to).slice(0, 10) : "";
  const tripEnded = Boolean(dateTo && dateTo < today);
  const confirmed = order.referral_commission_confirmed === true;
  const asAccrued = tripEnded && confirmed;

  let total = 0;
  for (const s of list) {
    const svc = s;
    if (svc.referral_include_in_commission === false) continue;

    const cancelled = String(svc.res_status || "") === "cancelled";
    if (cancelled && !svc.invoice_id) continue;

    const base =
      profitAfterFees.get(svc.id) ??
      computeServiceLineEconomics({
        client_price: svc.client_price,
        service_price: svc.service_price,
        service_type: svc.service_type,
        category: svc.category,
        commission_amount: svc.commission_amount,
        vat_rate: svc.vat_rate,
      }).profitNetOfVat;

    const fixedRaw = svc.referral_commission_fixed_amount;
    const useFixed = fixedRaw != null && fixedRaw !== "" && Number.isFinite(Number(fixedRaw));

    const overrideRaw = svc.referral_commission_percent_override;
    const override = overrideRaw != null && overrideRaw !== "" ? Number(overrideRaw) : null;
    const useOverride = override != null && Number.isFinite(override);

    let commission = 0;

    if (useFixed) {
      commission = Number(fixedRaw);
    } else if (useOverride) {
      commission = (base * (override as number)) / 100;
    } else {
      const effectiveCatId = resolveCategoryIdForService(svc.category_id, svc.category, categories);
      if (!effectiveCatId) continue;
      const rate = rateByCat.get(effectiveCatId);
      if (!rate) continue;
      if (rate.kind === "percent") {
        commission = (base * rate.value) / 100;
      } else {
        commission = rate.value;
      }
    }

    commission = Math.round(commission * 100) / 100;
    if (Math.abs(commission) < 0.0001) continue;
    total += commission;
  }

  total = Math.round(total * 100) / 100;
  if (asAccrued) {
    return { planned: 0, accrued: total };
  }
  return { planned: total, accrued: 0 };
}

export type LiveReferralPortalLine = {
  id: string;
  commissionAmount: number;
  currency: string;
  status: string;
  createdAt: string;
  baseAmount: number;
  orderCode: string | null;
};

/**
 * When referral_accrual_line is empty, build the same per-order view the CRM Directory uses
 * (from order_services + rates) so /referral is not blank.
 */
export async function buildLiveReferralPortalSnapshot(
  supabase: SupabaseClient,
  partyId: string,
  companyId: string
): Promise<{
  lines: LiveReferralPortalLine[];
  plannedByCurrency: Record<string, number>;
  accruedByCurrency: Record<string, number>;
}> {
  const { data: orderRows } = await supabase
    .from("orders")
    .select("id, order_code")
    .eq("referral_party_id", partyId)
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false })
    .limit(80);

  const codeById: Record<string, string> = {};
  for (const o of orderRows || []) {
    codeById[o.id as string] = String(o.order_code ?? "");
  }

  const orderIds = (orderRows || []).map((o) => o.id as string);
  const lines: LiveReferralPortalLine[] = [];
  const plannedByCurrency: Record<string, number> = {};
  const accruedByCurrency: Record<string, number> = {};
  const eur = "EUR";
  const CHUNK = 8;

  for (let i = 0; i < orderIds.length; i += CHUNK) {
    const chunk = orderIds.slice(i, i + CHUNK);
    const results = await Promise.all(
      chunk.map((oid) => computeReferralPlannedAccruedFromServices(supabase, oid, companyId, partyId))
    );
    for (let j = 0; j < chunk.length; j++) {
      const comp = results[j];
      if (!comp) continue;
      const p = comp.planned;
      const a = comp.accrued;
      if (Math.abs(p) < 1e-9 && Math.abs(a) < 1e-9) continue;
      const oid = chunk[j]!;
      const total = Math.round((p + a) * 100) / 100;
      if (p > 1e-9) {
        plannedByCurrency[eur] = Math.round(((plannedByCurrency[eur] || 0) + p) * 100) / 100;
      }
      if (a > 1e-9) {
        accruedByCurrency[eur] = Math.round(((accruedByCurrency[eur] || 0) + a) * 100) / 100;
      }
      lines.push({
        id: `live-order-${oid}`,
        commissionAmount: total,
        currency: eur,
        status: a > 1e-9 ? "accrued" : "planned",
        createdAt: new Date().toISOString(),
        baseAmount: 0,
        orderCode: codeById[oid] || null,
      });
    }
  }

  lines.sort((x, y) => (y.orderCode || "").localeCompare(x.orderCode || ""));

  return { lines, plannedByCurrency, accruedByCurrency };
}
