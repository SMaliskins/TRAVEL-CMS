import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiUser } from "@/lib/auth/getApiUser";

/**
 * GET — orders attributed to this referral party + planned/accrued commission per order.
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
      .eq("company_id", apiUser.companyId)
      .maybeSingle();

    if (!refRow) {
      return NextResponse.json({ orders: [] });
    }

    const { data: orderRows, error: ordErr } = await supabaseAdmin
      .from("orders")
      .select("id, order_code, date_to, referral_commission_confirmed, updated_at")
      .eq("company_id", apiUser.companyId)
      .eq("referral_party_id", partyId)
      .order("updated_at", { ascending: false })
      .limit(80);

    if (ordErr) {
      console.error("[referral-orders]", ordErr);
      return NextResponse.json({ error: ordErr.message }, { status: 500 });
    }

    const ords = orderRows || [];
    const orderIds = ords.map((o) => o.id as string);
    if (orderIds.length === 0) {
      return NextResponse.json({ orders: [] });
    }

    const { data: lineRows, error: lineErr } = await supabaseAdmin
      .from("referral_accrual_line")
      .select("order_id, status, commission_amount")
      .eq("company_id", apiUser.companyId)
      .in("order_id", orderIds)
      .in("status", ["planned", "accrued"]);

    if (lineErr) {
      console.error("[referral-orders] lines", lineErr);
      return NextResponse.json({ error: lineErr.message }, { status: 500 });
    }

    const sums = new Map<string, { planned: number; accrued: number }>();
    for (const oid of orderIds) {
      sums.set(oid, { planned: 0, accrued: 0 });
    }
    for (const r of lineRows || []) {
      const row = r as { order_id: string; status: string; commission_amount?: number | string | null };
      const cur = sums.get(row.order_id);
      if (!cur) continue;
      const amt = Number(row.commission_amount) || 0;
      if (row.status === "planned") cur.planned += amt;
      else if (row.status === "accrued") cur.accrued += amt;
    }

    const today = new Date().toISOString().slice(0, 10);

    const orders = ords.map((o) => {
      const id = o.id as string;
      const dateTo = o.date_to ? String(o.date_to).slice(0, 10) : "";
      const tripEnded = Boolean(dateTo && dateTo < today);
      const confirmed = o.referral_commission_confirmed === true;
      const { planned, accrued } = sums.get(id) || { planned: 0, accrued: 0 };
      const primaryStatus =
        accrued !== 0 && planned === 0 ? "accrued" : planned !== 0 ? "planned" : accrued !== 0 ? "accrued" : "planned";

      return {
        orderId: id,
        orderCode: (o.order_code as string) || "",
        dateTo: dateTo || null,
        referralCommissionConfirmed: confirmed,
        tripEnded,
        plannedCommission: Math.round(planned * 100) / 100,
        accruedCommission: Math.round(accrued * 100) / 100,
        primaryStatus,
        becomesAccruedWhenTripEndedAndConfirmed: !tripEnded || !confirmed,
      };
    });

    return NextResponse.json({ orders });
  } catch (e) {
    console.error("[referral-orders]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
