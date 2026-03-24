import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiUser } from "@/lib/auth/getApiUser";

/**
 * GET — recent settlement entries (payouts / usage).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const apiUser = await getApiUser(request);
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
      return NextResponse.json({ data: [] });
    }

    const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 50));

    const { data, error } = await supabaseAdmin
      .from("referral_settlement_entry")
      .select("id, amount, currency, note, entry_date, created_at, created_by")
      .eq("referral_party_id", partyId)
      .eq("company_id", apiUser.companyId)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[referral-settlements GET]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[referral-settlements GET]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST — record a payout or usage against accrued balance.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const apiUser = await getApiUser(request);
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
      return NextResponse.json({ error: "Party does not have Referral role" }, { status: 400 });
    }

    const body = await request.json();
    const amount = Number(body?.amount);
    const currency = typeof body?.currency === "string" && body.currency.trim() ? body.currency.trim().toUpperCase() : "EUR";
    const note = typeof body?.note === "string" ? body.note.trim() || null : null;
    const entryDate =
      typeof body?.entryDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.entryDate)
        ? body.entryDate
        : new Date().toISOString().slice(0, 10);

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
    }

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("referral_settlement_entry")
      .insert({
        company_id: apiUser.companyId,
        referral_party_id: partyId,
        amount,
        currency,
        note,
        entry_date: entryDate,
        created_by: apiUser.userId,
      })
      .select("id, amount, currency, note, entry_date, created_at")
      .single();

    if (insErr) {
      console.error("[referral-settlements POST]", insErr);
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    return NextResponse.json({ data: inserted });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[referral-settlements POST]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
