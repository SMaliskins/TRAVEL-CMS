import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiUser } from "@/lib/auth/getApiUser";
import { fetchRelatedPartiesPayload } from "@/lib/orders/relatedPartiesForOrder";
import { loadDirectoryRecordsForPartyIds } from "@/lib/directory/loadDirectoryRecordsBatch";
import type { RelatedPartyTag } from "@/lib/types/orderRelatedParties";
import type { DirectoryRecord } from "@/lib/types/directory";

/**
 * One round-trip for Order > Clients Data tab: related parties + full directory records (batch DB reads).
 */
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

    const payload = await fetchRelatedPartiesPayload(orderId, leadId);
    const partyIds = payload.parties.map((p) => p.partyId);

    const recordByPartyId =
      partyIds.length > 0 ? await loadDirectoryRecordsForPartyIds(partyIds, user.companyId) : new Map<string, DirectoryRecord>();

    const partyRows: { partyId: string; tags: RelatedPartyTag[]; record: DirectoryRecord | null }[] =
      payload.parties.map(({ partyId, tags }) => ({
        partyId,
        tags,
        record: recordByPartyId.get(partyId) ?? null,
      }));

    return NextResponse.json({
      parties: payload.parties,
      leadPartyId: leadId,
      nameOnlyPayers: payload.nameOnlyPayers,
      partyRows,
    });
  } catch (e) {
    console.error("[clients-data-parties]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
