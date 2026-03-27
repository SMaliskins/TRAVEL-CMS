import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiUser } from "@/lib/auth/getApiUser";
import type { RelatedPartyTag } from "@/lib/types/orderRelatedParties";

/** Party IDs linked to the order as lead client, travellers, or service payers (deduped). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string }> }
) {
  try {
    const user = await getApiUser(request);
    if (!user?.companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderCode } = await params;
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, client_party_id")
      .eq("company_id", user.companyId)
      .eq("order_code", orderCode)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const orderId = order.id as string;
    const leadId = order.client_party_id as string | null;

    const [{ data: travellerRows }, { data: serviceRows }] = await Promise.all([
      supabaseAdmin.from("order_travellers").select("party_id, is_main_client").eq("order_id", orderId),
      supabaseAdmin
        .from("order_services")
        .select("payer_party_id, payer_name")
        .eq("order_id", orderId)
        .or("res_status.is.null,res_status.neq.cancelled"),
    ]);

    const byParty = new Map<string, Set<RelatedPartyTag>>();

    const addTag = (partyId: string | null | undefined, tag: RelatedPartyTag) => {
      if (!partyId || typeof partyId !== "string") return;
      const id = partyId.trim();
      if (!id) return;
      if (!byParty.has(id)) byParty.set(id, new Set());
      byParty.get(id)!.add(tag);
    };

    if (leadId) {
      addTag(leadId, "lead_client");
    }

    for (const row of travellerRows || []) {
      const pid = (row as { party_id?: string }).party_id;
      addTag(pid, "traveller");
    }

    const nameOnlyPayers = new Set<string>();
    for (const row of serviceRows || []) {
      const r = row as { payer_party_id?: string | null; payer_name?: string | null };
      if (r.payer_party_id) {
        addTag(r.payer_party_id, "payer");
      } else {
        const name = (r.payer_name || "").trim();
        if (name) nameOnlyPayers.add(name);
      }
    }

    const parties = Array.from(byParty.entries()).map(([partyId, tags]) => ({
      partyId,
      tags: Array.from(tags) as RelatedPartyTag[],
    }));

    return NextResponse.json({
      parties,
      nameOnlyPayers: Array.from(nameOnlyPayers).sort((a, b) => a.localeCompare(b)),
    });
  } catch (e) {
    console.error("[related-parties]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
