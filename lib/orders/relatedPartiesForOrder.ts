import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { RelatedPartyTag } from "@/lib/types/orderRelatedParties";

export type RelatedPartiesPayload = {
  parties: { partyId: string; tags: RelatedPartyTag[] }[];
  nameOnlyPayers: string[];
};

/**
 * Party IDs linked to the order as lead client, travellers, or service payers (deduped).
 * Shared by GET /api/orders/.../related-parties and GET .../clients-data-parties.
 */
export async function fetchRelatedPartiesPayload(
  orderId: string,
  leadPartyId: string | null
): Promise<RelatedPartiesPayload> {
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

  if (leadPartyId) {
    addTag(leadPartyId, "lead_client");
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

  return {
    parties,
    nameOnlyPayers: Array.from(nameOnlyPayers).sort((a, b) => a.localeCompare(b)),
  };
}
