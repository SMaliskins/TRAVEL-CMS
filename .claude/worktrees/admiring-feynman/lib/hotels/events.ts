import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function logHotelOfferEvent(params: {
  offerId: string;
  companyId: string;
  eventType: string;
  eventPayload?: Record<string, unknown>;
  createdBy?: string | null;
}) {
  const payload = params.eventPayload ?? {};
  await supabaseAdmin.from("hotel_offer_events").insert({
    offer_id: params.offerId,
    company_id: params.companyId,
    event_type: params.eventType,
    event_payload: payload,
    created_by: params.createdBy ?? null,
  });
}
