import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logHotelOfferEvent } from "@/lib/hotels/events";
import { finalizeHotelOfferBooking } from "@/lib/hotels/finalizeBooking";

export async function processPaidHotelOffer(params: {
  offerId: string;
  stripeSessionId: string;
  paymentIntentId: string | null;
}) {
  const { data: offer } = await supabaseAdmin
    .from("hotel_offers")
    .select("*")
    .eq("id", params.offerId)
    .single();
  if (!offer) {
    return { ok: false as const, reason: "offer_not_found" as const };
  }

  const wasAlreadyPaid = offer.payment_status === "paid";
  if (!wasAlreadyPaid) {
    await supabaseAdmin
      .from("hotel_offers")
      .update({
        status: "paid",
        payment_status: "paid",
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id: params.paymentIntentId,
      })
      .eq("id", params.offerId);
    await logHotelOfferEvent({
      offerId: params.offerId,
      companyId: offer.company_id,
      eventType: "payment_succeeded",
      eventPayload: { stripeSessionId: params.stripeSessionId },
    });
  }

  await finalizeHotelOfferBooking(params.offerId);
  return { ok: true as const, alreadyPaid: wasAlreadyPaid };
}

export function extractPaymentIntentId(session: Stripe.Checkout.Session): string | null {
  return typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id || null;
}
