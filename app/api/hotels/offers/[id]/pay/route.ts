import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCompanyIdForCmsUser, getCurrentCmsUser } from "@/lib/hotels/cmsAuth";
import { logHotelOfferEvent } from "@/lib/hotels/events";

let _stripe: Stripe | null = null;
function getStripe() {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-12-18.acacia" as Stripe.LatestApiVersion,
    });
  }
  return _stripe;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentCmsUser(request);
    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized", message: "Auth required" }, { status: 401 });
    }
    const companyId = await getCompanyIdForCmsUser(user.id);
    if (!companyId) {
      return NextResponse.json({ data: null, error: "Company not found", message: "User has no company" }, { status: 404 });
    }

    const { data: offer } = await supabaseAdmin
      .from("hotel_offers")
      .select("*")
      .eq("id", id)
      .eq("company_id", companyId)
      .single();
    if (!offer) {
      return NextResponse.json({ data: null, error: "Offer not found", message: "Invalid offer id" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const mode = (body.mode || offer.payment_mode || "online") as "online" | "invoice";
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL || "http://localhost:3000";
    const normalizedBaseUrl = String(baseUrl).startsWith("http") ? String(baseUrl) : `https://${baseUrl}`;

    if (mode === "invoice") {
      if (offer.payment_status === "paid") {
        return NextResponse.json({
          data: { id, mode: "invoice", checkoutUrl: null },
          error: null,
          message: "Offer is already paid",
        });
      }
      await supabaseAdmin
        .from("hotel_offers")
        .update({
          payment_mode: "invoice",
          status: "invoice_pending",
          payment_status: "pending",
        })
        .eq("id", id);
      await logHotelOfferEvent({
        offerId: id,
        companyId,
        createdBy: user.id,
        eventType: "invoice_requested",
      });
      return NextResponse.json({
        data: {
          id,
          mode: "invoice",
          checkoutUrl: null,
          message: "Invoice mode activated. Await manual payment confirmation.",
        },
        error: null,
        message: "Invoice payment started",
      });
    }

    const currency = String(offer.currency || "EUR").toLowerCase();
    const amountCents = Math.round(Number(offer.client_amount || 0) * 100);
    if (amountCents <= 0) {
      return NextResponse.json({ data: null, error: "Invalid amount", message: "Offer amount must be > 0" }, { status: 400 });
    }

    if (offer.payment_status === "paid" || offer.status === "booking_confirmed") {
      return NextResponse.json({
        data: { id, mode: "online", checkoutUrl: null },
        error: null,
        message: "Offer already paid/confirmed, checkout is not required",
      });
    }

    if (offer.stripe_checkout_session_id && offer.payment_status === "pending") {
      const existing = await getStripe().checkout.sessions.retrieve(offer.stripe_checkout_session_id);
      if (existing && existing.status === "open" && existing.url) {
        return NextResponse.json({
          data: { id, mode: "online", checkoutUrl: existing.url },
          error: null,
          message: "Reused existing checkout session",
        });
      }
    }

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `${offer.hotel_name} (${offer.check_in} → ${offer.check_out})`,
              description: [
                offer.room_name,
                offer.meal,
                `Tariff: ${offer.tariff_type}`,
                offer.cancellation_policy ? `Cancellation: ${offer.cancellation_policy}` : null,
              ].filter(Boolean).join(" | "),
              images: offer.hotel_image_url ? [offer.hotel_image_url] : undefined,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        hotel_offer_id: offer.id,
        company_id: companyId,
        flow: "hotels_offer",
      },
      success_url: `${normalizedBaseUrl}/api/hotels/offers/payment-success?offer_id=${offer.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${normalizedBaseUrl}/api/hotels/offers/payment-cancel?offer_id=${offer.id}`,
    });

    await supabaseAdmin
      .from("hotel_offers")
      .update({
        payment_mode: "online",
        status: "payment_pending",
        payment_status: "pending",
        stripe_checkout_session_id: session.id,
      })
      .eq("id", id);

    await logHotelOfferEvent({
      offerId: id,
      companyId,
      createdBy: user.id,
      eventType: "payment_started",
      eventPayload: { mode: "online", stripeSessionId: session.id },
    });

    return NextResponse.json({
      data: { id, mode: "online", checkoutUrl: session.url },
      error: null,
      message: "Online checkout created",
    });
  } catch (error) {
    return NextResponse.json(
      { data: null, error: "Internal error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
