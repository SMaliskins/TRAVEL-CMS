import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiUser } from "@/lib/auth/getApiUser";
import { computeReferralPlannedAccruedFromServices } from "@/lib/referral/computeReferralTotalsFromOrderServices";
import { syncReferralAccrualsForOrdersMissingLines } from "@/lib/referral/syncReferralAccrualsForOrdersMissingLines";

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

/**
 * GET — planned / accrued commission totals and settlements (no per-order breakdown).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const apiUser = await getApiUser(_request);
    if (!apiUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: partyId } = await params;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!partyId || !uuidRegex.test(partyId)) {
      return NextResponse.json({ error: "Invalid party id" }, { status: 400 });
    }

    const { data: party, error: partyErr } = await supabaseAdmin
      .from("party")
      .select("id")
      .eq("id", partyId)
      .eq("company_id", apiUser.companyId)
      .maybeSingle();

    if (partyErr || !party) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: orderRowsForHeal } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("company_id", apiUser.companyId)
      .eq("referral_party_id", partyId)
      .order("updated_at", { ascending: false })
      .limit(80);

    const healOrderIds = (orderRowsForHeal || []).map((o) => o.id as string);
    await syncReferralAccrualsForOrdersMissingLines(supabaseAdmin, apiUser.companyId, healOrderIds);

    const [plannedRes, accruedRes, settledRes] = await Promise.all([
      supabaseAdmin
        .from("referral_accrual_line")
        .select("currency, commission_amount")
        .eq("referral_party_id", partyId)
        .eq("company_id", apiUser.companyId)
        .eq("status", "planned"),
      supabaseAdmin
        .from("referral_accrual_line")
        .select("currency, commission_amount")
        .eq("referral_party_id", partyId)
        .eq("company_id", apiUser.companyId)
        .eq("status", "accrued"),
      supabaseAdmin
        .from("referral_settlement_entry")
        .select("currency, amount")
        .eq("referral_party_id", partyId)
        .eq("company_id", apiUser.companyId),
    ]);

    if (plannedRes.error) console.warn("[referral-stats] planned:", plannedRes.error.message);
    if (accruedRes.error) console.warn("[referral-stats] accrued:", accruedRes.error.message);
    if (settledRes.error) console.warn("[referral-stats] settled:", settledRes.error.message);

    const plannedByCurrency: Record<string, number> = {};
    const accruedByCurrency: Record<string, number> = {};
    const settledByCurrency: Record<string, number> = {};

    addAmounts(plannedByCurrency, plannedRes.error ? null : plannedRes.data);
    addAmounts(accruedByCurrency, accruedRes.error ? null : accruedRes.data);
    addSettlementAmounts(settledByCurrency, settledRes.error ? null : settledRes.data);

    const sumAbs = (rec: Record<string, number>) =>
      Object.values(rec).reduce((a, b) => a + Math.abs(b), 0);

    if (
      sumAbs(plannedByCurrency) < 1e-9 &&
      sumAbs(accruedByCurrency) < 1e-9 &&
      healOrderIds.length > 0
    ) {
      let livePlanned = 0;
      let liveAccrued = 0;
      const CHUNK = 8;
      for (let i = 0; i < healOrderIds.length; i += CHUNK) {
        const chunk = healOrderIds.slice(i, i + CHUNK);
        const results = await Promise.all(
          chunk.map((oid) =>
            computeReferralPlannedAccruedFromServices(
              supabaseAdmin,
              oid,
              apiUser.companyId,
              partyId
            )
          )
        );
        for (const r of results) {
          if (!r) continue;
          livePlanned += r.planned;
          liveAccrued += r.accrued;
        }
      }
      const eur = "EUR";
      if (Math.abs(livePlanned) > 1e-9) {
        plannedByCurrency[eur] = (plannedByCurrency[eur] || 0) + Math.round(livePlanned * 100) / 100;
      }
      if (Math.abs(liveAccrued) > 1e-9) {
        accruedByCurrency[eur] = (accruedByCurrency[eur] || 0) + Math.round(liveAccrued * 100) / 100;
      }
    }

    return NextResponse.json({
      data: {
        plannedByCurrency,
        accruedByCurrency,
        settledByCurrency,
        availableByCurrency: availableByCurrency(accruedByCurrency, settledByCurrency),
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[referral-stats]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
