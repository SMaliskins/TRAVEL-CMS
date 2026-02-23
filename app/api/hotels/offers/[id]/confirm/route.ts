import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCompanyIdForCmsUser, getCurrentCmsUser } from "@/lib/hotels/cmsAuth";
import { logHotelOfferEvent } from "@/lib/hotels/events";
import { finalizeHotelOfferBooking } from "@/lib/hotels/finalizeBooking";

export async function PATCH(
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
    const action = String(body.action || "confirm");

    if (action === "confirm") {
      await supabaseAdmin
        .from("hotel_offers")
        .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
        .eq("id", id);
      await logHotelOfferEvent({
        offerId: id,
        companyId,
        createdBy: user.id,
        eventType: "confirmed",
      });
      return NextResponse.json({ data: { id, status: "confirmed" }, error: null, message: "Offer confirmed" });
    }

    if (action === "invoice_paid") {
      await supabaseAdmin
        .from("hotel_offers")
        .update({
          status: "paid",
          payment_status: "paid",
          paid_at: new Date().toISOString(),
        })
        .eq("id", id);
      await logHotelOfferEvent({
        offerId: id,
        companyId,
        createdBy: user.id,
        eventType: "invoice_paid",
      });
      await finalizeHotelOfferBooking(id);
      return NextResponse.json({ data: { id, status: "paid" }, error: null, message: "Invoice marked as paid and booking started" });
    }

    return NextResponse.json({ data: null, error: "Invalid action", message: "Unsupported confirm action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { data: null, error: "Internal error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
