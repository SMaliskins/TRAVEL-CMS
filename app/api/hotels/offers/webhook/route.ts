import { NextRequest, NextResponse } from "next/server";
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

function getWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET!;
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ data: null, error: "Missing signature", message: "stripe-signature header is required" }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, getWebhookSecret());
  } catch (error) {
    return NextResponse.json(
      { data: null, error: "Invalid signature", message: error instanceof Error ? error.message : "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status === "paid") {
      const offerId = session.metadata?.hotel_offer_id;
      if (offerId) {
        await processPaidHotelOffer({
          offerId,
          stripeSessionId: session.id,
          paymentIntentId: extractPaymentIntentId(session),
        });
      }
    }
  }

  return NextResponse.json({ data: { received: true }, error: null, message: "Webhook processed" });
}
