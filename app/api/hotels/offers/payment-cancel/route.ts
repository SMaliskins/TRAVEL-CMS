import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logHotelOfferEvent } from "@/lib/hotels/events";

export async function GET(req: NextRequest) {
  const offerId = req.nextUrl.searchParams.get("offer_id");
  if (!offerId) {
    return new Response("Missing offer_id", { status: 400 });
  }

  const { data: offer } = await supabaseAdmin
    .from("hotel_offers")
    .select("*")
    .eq("id", offerId)
    .single();
  if (!offer) {
    return new Response("Offer not found", { status: 404 });
  }

  await supabaseAdmin
    .from("hotel_offers")
    .update({
      status: "confirmed",
      payment_status: "cancelled",
    })
    .eq("id", offerId);

  await logHotelOfferEvent({
    offerId,
    companyId: offer.company_id,
    eventType: "payment_cancelled",
    eventPayload: { reason: "checkout_cancelled" },
  });

  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>Payment cancelled</title></head><body style="font-family:Inter,Arial,sans-serif;padding:24px;"><h2>Payment cancelled</h2><p>The offer is still available for payment later.</p></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
