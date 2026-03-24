import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Rebuilds referral_accrual_line rows for an order from current services and referral category rates.
 * - No referral on order → deletes all lines for the order.
 * - Trip not ended OR calculation not confirmed → status `planned`.
 * - Trip ended (date_to < today UTC) AND confirmed → status `accrued` (full replace for this order).
 */
export async function syncOrderReferralAccruals(
  supabase: SupabaseClient,
  orderId: string,
  companyId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
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
      return { ok: true };
    }

    const { data: refRow } = await supabase
      .from("referral_party")
      .select("party_id")
      .eq("party_id", referralId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (!refRow) {
      return { ok: true };
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

    const { data: services } = await supabase
      .from("order_services")
      .select("id, category_id, client_price, currency, res_status")
      .eq("order_id", orderId)
      .eq("company_id", companyId);

    const today = new Date().toISOString().slice(0, 10);
    const dateTo = order.date_to ? String(order.date_to).slice(0, 10) : "";
    const tripEnded = Boolean(dateTo && dateTo < today);
    const confirmed = order.referral_commission_confirmed === true;
    const asAccrued = tripEnded && confirmed;
    const now = new Date().toISOString();
    const reportingPeriod = asAccrued ? `${today.slice(0, 7)}-01` : null;

    const rows: Record<string, unknown>[] = [];

    for (const s of services || []) {
      if (s.res_status === "cancelled") continue;
      if (!s.category_id) continue;
      const rate = rateByCat.get(s.category_id);
      if (!rate) continue;

      const base = Number(s.client_price) || 0;
      let commission = 0;
      if (rate.kind === "percent") {
        commission = (base * rate.value) / 100;
      } else {
        commission = rate.value;
      }
      commission = Math.round(commission * 100) / 100;
      if (commission <= 0) continue;

      const currency = String(s.currency || "EUR").toUpperCase();
      rows.push({
        company_id: companyId,
        referral_party_id: referralId,
        order_id: orderId,
        order_service_id: s.id,
        category_id: s.category_id,
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

    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[syncOrderReferralAccruals]", msg);
    return { ok: false, error: msg };
  }
}
