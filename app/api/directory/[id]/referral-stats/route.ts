import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiUser } from "@/lib/auth/getApiUser";

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

    const { data: refRow } = await supabaseAdmin
      .from("referral_party")
      .select("party_id")
      .eq("party_id", partyId)
      .maybeSingle();

    if (!refRow) {
      return NextResponse.json({
        data: {
          plannedByCurrency: {},
          accruedByCurrency: {},
          settledByCurrency: {},
          availableByCurrency: {},
        },
      });
    }

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
