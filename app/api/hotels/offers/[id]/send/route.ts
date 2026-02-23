import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCompanyIdForCmsUser, getCurrentCmsUser } from "@/lib/hotels/cmsAuth";
import { sendPushToClient } from "@/lib/client-push/sendPush";
import { sendEmail } from "@/lib/email/sendEmail";
import { logHotelOfferEvent } from "@/lib/hotels/events";

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

    const { data: offer, error: offerError } = await supabaseAdmin
      .from("hotel_offers")
      .select("*")
      .eq("id", id)
      .eq("company_id", companyId)
      .single();
    if (offerError || !offer) {
      return NextResponse.json({ data: null, error: "Offer not found", message: "Invalid offer id" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const channel = (body.channel || "both") as "app" | "email" | "both";
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL || "http://localhost:3000";
    const linkBase = String(baseUrl).startsWith("http") ? baseUrl : `https://${baseUrl}`;
    const appConfirmUrl = `${linkBase}/api/client/v1/hotels/offers/${offer.id}/confirm`;
    const emailConfirmUrl = `${linkBase}/api/client/v1/hotels/offers/confirm-by-token?token=${offer.confirmation_token}`;

    if (channel === "app" || channel === "both") {
      if (offer.client_party_id) {
        await sendPushToClient(offer.client_party_id, {
          title: "New hotel offer",
          body: `${offer.hotel_name} • ${offer.client_amount} ${offer.currency}`,
          type: "hotel_offer",
          refId: offer.id,
        });
      }
    }

    if (channel === "email" || channel === "both") {
      if (offer.client_email) {
        const html = `
          <h2>Hotel Offer</h2>
          <p><strong>Hotel:</strong> ${offer.hotel_name}</p>
          <p><strong>Dates:</strong> ${offer.check_in} → ${offer.check_out}</p>
          <p><strong>Tariff:</strong> ${offer.tariff_type}</p>
          <p><strong>Cancellation:</strong> ${offer.cancellation_policy || "See terms before payment."}</p>
          <p><strong>Price:</strong> ${offer.client_amount} ${offer.currency}</p>
          <p><a href="${emailConfirmUrl}">Confirm this offer</a></p>
          <p>If you use the app, your confirm endpoint is available in-app via: ${appConfirmUrl}</p>
        `;
        await sendEmail(
          offer.client_email,
          `Hotel offer: ${offer.hotel_name}`,
          html
        );
      }
    }

    await supabaseAdmin
      .from("hotel_offers")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", offer.id);

    await logHotelOfferEvent({
      offerId: offer.id,
      companyId,
      createdBy: user.id,
      eventType: "sent",
      eventPayload: { channel, appConfirmUrl, emailConfirmUrl },
    });

    return NextResponse.json({ data: { id: offer.id, status: "sent" }, error: null, message: "Offer sent" });
  } catch (error) {
    return NextResponse.json(
      { data: null, error: "Internal error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
