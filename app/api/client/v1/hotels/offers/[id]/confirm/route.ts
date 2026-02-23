import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthenticatedClient, unauthorizedResponse } from "@/lib/client-auth/middleware";
import { logHotelOfferEvent } from "@/lib/hotels/events";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const client = await getAuthenticatedClient(req);
    const { id } = await params;

    const { data: offer } = await supabaseAdmin
      .from("hotel_offers")
      .select("*")
      .eq("id", id)
      .eq("client_party_id", client.crmClientId)
      .single();

    if (!offer) {
      return Response.json({ data: null, error: "Offer not found", message: "Invalid offer id" }, { status: 404 });
    }

    await supabaseAdmin
      .from("hotel_offers")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("id", id);

    await logHotelOfferEvent({
      offerId: id,
      companyId: offer.company_id,
      eventType: "client_confirmed",
      eventPayload: { channel: "app" },
    });

    return Response.json({ data: { id, status: "confirmed" }, error: null, message: "Offer confirmed" });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return unauthorizedResponse();
    }
    return Response.json({ data: null, error: "INTERNAL_ERROR", message: "Failed to confirm offer" }, { status: 500 });
  }
}
