import { NextRequest } from "next/server";
import Stripe from "stripe";
import { extractPaymentIntentId, processPaidHotelOffer } from "@/lib/hotels/stripePayment";

let _stripe: Stripe | null = null;
function getStripe() {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-12-18.acacia" as Stripe.LatestApiVersion,
    });
  }
  return _stripe;
}

export async function GET(req: NextRequest) {
  const offerId = req.nextUrl.searchParams.get("offer_id");
  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!offerId || !sessionId) {
    return new Response("Missing offer_id or session_id", { status: 400 });
  }

  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  if (!session || session.payment_status !== "paid") {
    return new Response("Payment is not completed yet.", { status: 400 });
  }

  const processed = await processPaidHotelOffer({
    offerId,
    stripeSessionId: sessionId,
    paymentIntentId: extractPaymentIntentId(session),
  });
  if (!processed.ok) {
    return new Response("Offer not found", { status: 404 });
  }

  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>Payment successful</title></head><body style="font-family:Inter,Arial,sans-serif;padding:24px;"><h2>Payment successful</h2><p>${processed.alreadyPaid ? "Payment was already processed earlier." : "Hotel payment has been received."} Booking finalization has started.</p></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
