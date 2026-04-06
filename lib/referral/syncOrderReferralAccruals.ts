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
  currency?: string | null;
  res_status?: string | null;
  service_type?: string | null;
  invoice_id?: string | null;
  commission_amount?: number | string | null;
  vat_rate?: number | string | null;
  referral_include_in_commission?: boolean | null;
  referral_commission_percent_override?: number | string | null;
  referral_commission_fixed_amount?: number | string | null;
};

/** Profit net of VAT after allocating card processing fees across lines — same idea as OrderReferralServicesPanel + orders list. */
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
 * Referral accrual lines: base = profit net of VAT (same as orders list profit per line).
 * Fixed amount per line wins over % override; % override wins over partner category rate.
 */
export async function syncOrderReferralAccruals(
  supabase: SupabaseClient,
  orderId: string,
  companyId: string
): Promise<{ ok: true; linesWritten: number } | { ok: false; error: string }> {
  try {
    const { data: order, error: oErr } = await supabase
      .from("orders")
      .select("id, referral_party_id, referral_commission_confirmed, date_to")
      .eq("id", orderId)
      .eq("company_id", companyId)
      .single();

    if (oErr || !order) {
      return { ok: false, error: oErr?.message || "Order not found" };
    }

    await supabase.from("referral_accrual_line").delete().eq("order_id", orderId);

    const referralId = order.referral_party_id as string | null;
    if (!referralId) {
      return { ok: true, linesWritten: 0 };
    }

    const { data: partyOk } = await supabase
      .from("party")
      .select("id")
      .eq("id", referralId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!partyOk) {
      return { ok: true, linesWritten: 0 };
    }

    const { error: rpUpsertErr } = await supabase.from("referral_party").upsert(
      {
        party_id: referralId,
        company_id: companyId,
        is_active: true,
        default_currency: "EUR",
        notes: null,
      },
      { onConflict: "party_id", ignoreDuplicates: true }
    );
    if (rpUpsertErr) {
      console.error("[syncOrderReferralAccruals] referral_party upsert:", rpUpsertErr);
      return { ok: false, error: rpUpsertErr.message };
    }

    const { data: rates } = await supabase
      .from("referral_party_category_rate")
      .select("category_id, rate_kind, rate_value")
      .eq("party_id", referralId)
      .eq("company_id", companyId);

    const rateByCat = new Map(
      (rates || []).map((r: { category_id: string; rate_kind: string; rate_value: number | string }) => [
        r.category_id,
        { kind: r.rate_kind as "percent" | "fixed", value: Number(r.rate_value) },
      ])
    );

    const [{ data: services }, { data: payRows }] = await Promise.all([
      supabase
        .from("order_services")
        .select(
          "id, category_id, category, client_price, service_price, currency, res_status, service_type, invoice_id, commission_amount, vat_rate, referral_include_in_commission, referral_commission_percent_override, referral_commission_fixed_amount"
        )
        .eq("order_id", orderId)
        .eq("company_id", companyId),
      supabase
        .from("payments")
        .select("processing_fee")
        .eq("order_id", orderId)
        .eq("company_id", companyId)
        .neq("status", "cancelled"),
    ]);

    const totalProcessingFees = (payRows || []).reduce(
      (s, r) => s + (Number((r as { processing_fee?: unknown }).processing_fee) || 0),
      0
    );
    const profitAfterFees = profitNetByServiceIdAfterFees((services || []) as ServiceRow[], totalProcessingFees);

    const { data: categoryRows } = await supabase
      .from("travel_service_categories")
      .select("id, type, name")
      .eq("company_id", companyId);

    const categories: CatRow[] = (categoryRows || []) as CatRow[];

    const today = new Date().toISOString().slice(0, 10);
    const dateTo = order.date_to ? String(order.date_to).slice(0, 10) : "";
    const tripEnded = Boolean(dateTo && dateTo < today);
    const confirmed = order.referral_commission_confirmed === true;
    const asAccrued = tripEnded && confirmed;
    const now = new Date().toISOString();
    const reportingPeriod = asAccrued ? `${today.slice(0, 7)}-01` : null;

    const rows: Record<string, unknown>[] = [];

    for (const s of services || []) {
      const svc = s as ServiceRow;
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
      const useFixed =
        fixedRaw != null &&
        fixedRaw !== "" &&
        Number.isFinite(Number(fixedRaw));

      const overrideRaw = svc.referral_commission_percent_override;
      const override =
        overrideRaw != null && overrideRaw !== "" ? Number(overrideRaw) : null;
      const useOverride = override != null && Number.isFinite(override);

      let commission = 0;
      let categoryIdForLine: string | null = null;

      if (useFixed) {
        commission = Number(fixedRaw);
        categoryIdForLine = resolveCategoryIdForService(svc.category_id, svc.category, categories);
      } else if (useOverride) {
        commission = (base * (override as number)) / 100;
        categoryIdForLine = resolveCategoryIdForService(svc.category_id, svc.category, categories);
      } else {
        const effectiveCatId = resolveCategoryIdForService(svc.category_id, svc.category, categories);
        if (!effectiveCatId) continue;
        const rate = rateByCat.get(effectiveCatId);
        if (!rate) continue;
        categoryIdForLine = effectiveCatId;
        if (rate.kind === "percent") {
          commission = (base * rate.value) / 100;
        } else {
          commission = rate.value;
        }
      }

      commission = Math.round(commission * 100) / 100;
      if (Math.abs(commission) < 0.0001) continue;

      const currency = String(svc.currency || "EUR").toUpperCase();
      rows.push({
        company_id: companyId,
        referral_party_id: referralId,
        order_id: orderId,
        order_service_id: svc.id,
        category_id: categoryIdForLine,
        base_amount: base,
        commission_amount: commission,
        currency,
        status: asAccrued ? "accrued" : "planned",
        reporting_period: reportingPeriod,
        created_at: now,
        accrued_at: asAccrued ? now : null,
        updated_at: now,
      });
    }

    if (rows.length > 0) {
      const { error: insErr } = await supabase.from("referral_accrual_line").insert(rows);
      if (insErr) {
        console.error("[syncOrderReferralAccruals] insert:", insErr);
        return { ok: false, error: insErr.message };
      }
    }

    return { ok: true, linesWritten: rows.length };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[syncOrderReferralAccruals]", msg);
    return { ok: false, error: msg };
  }
}
