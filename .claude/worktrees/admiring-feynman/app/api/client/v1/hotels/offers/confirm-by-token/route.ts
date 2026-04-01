import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logHotelOfferEvent } from "@/lib/hotels/events";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return new Response("Missing token", { status: 400 });
  }

  const { data: offer } = await supabaseAdmin
    .from("hotel_offers")
    .select("*")
    .eq("confirmation_token", token)
    .single();

  if (!offer) {
    return new Response("Invalid or expired offer token.", { status: 404 });
  }

  await supabaseAdmin
    .from("hotel_offers")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", offer.id);

  await logHotelOfferEvent({
    offerId: offer.id,
    companyId: offer.company_id,
    eventType: "client_confirmed",
    eventPayload: { channel: "email_link" },
  });

  const html = `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Hotel offer confirmed</title></head>
  <body style="font-family: Inter, Arial, sans-serif; padding: 24px;">
    <h2>Offer confirmed</h2>
    <p>Your hotel offer for <strong>${offer.hotel_name}</strong> has been confirmed.</p>
    <p>Payment mode: <strong>${offer.payment_mode}</strong>.</p>
    <p>The manager will proceed with payment and booking steps.</p>
  </body>
</html>`;

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
