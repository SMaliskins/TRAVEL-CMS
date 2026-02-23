import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCompanyIdForCmsUser, getCurrentCmsUser } from "@/lib/hotels/cmsAuth";
import { logHotelOfferEvent } from "@/lib/hotels/events";

function makePartnerOrderId() {
  const seed = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `HO-${Date.now()}-${seed}`;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentCmsUser(request);
    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized", message: "Auth required" }, { status: 401 });
    }

    const companyId = await getCompanyIdForCmsUser(user.id);
    if (!companyId) {
      return NextResponse.json({ data: null, error: "Company not found", message: "User has no company" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    let query = supabaseAdmin
      .from("hotel_offers")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (status && status !== "all") {
      query = query.eq("status", status);
    }
    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ data: null, error: "Fetch failed", message: error.message }, { status: 500 });
    }
    return NextResponse.json({ data: data ?? [], error: null, message: "Offers loaded" });
  } catch (error) {
    return NextResponse.json(
      { data: null, error: "Internal error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentCmsUser(request);
    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized", message: "Auth required" }, { status: 401 });
    }

    const companyId = await getCompanyIdForCmsUser(user.id);
    if (!companyId) {
      return NextResponse.json({ data: null, error: "Company not found", message: "User has no company" }, { status: 404 });
    }

    const body = await request.json();
    const partnerOrderId = makePartnerOrderId();
    const payload = {
      company_id: companyId,
      created_by: user.id,
      client_party_id: body.clientPartyId || null,
      client_name: body.clientName || null,
      client_email: body.clientEmail || null,
      payment_mode: body.paymentMode === "invoice" ? "invoice" : "online",
      payment_status: "unpaid",
      status: "draft",
      hotel_hid: Number(body.hid),
      hotel_name: String(body.hotelName || "Hotel"),
      hotel_address: body.address || null,
      hotel_stars: body.stars ? Number(body.stars) : null,
      hotel_image_url: body.hotelImageUrl || null,
      room_name: body.roomName || null,
      meal: body.meal || null,
      tariff_type: body.tariffType === "non_refundable" ? "non_refundable" : "refundable",
      cancellation_policy: body.cancellationPolicy || null,
      check_in: body.checkIn,
      check_out: body.checkOut,
      guests: Number(body.guests || 2),
      currency: String(body.currency || "EUR").toUpperCase(),
      ratehawk_amount: Number(body.ratehawkAmount || 0),
      client_amount: Number(body.clientAmount || 0),
      markup_percent: Number(body.markupPercent || 0),
      search_hash: body.searchHash || null,
      match_hash: body.matchHash || null,
      book_hash: body.bookHash || null,
      partner_order_id: partnerOrderId,
    };

    const { data, error } = await supabaseAdmin
      .from("hotel_offers")
      .insert(payload)
      .select("*")
      .single();
    if (error) {
      return NextResponse.json({ data: null, error: "Create failed", message: error.message }, { status: 500 });
    }

    await logHotelOfferEvent({
      offerId: data.id,
      companyId,
      eventType: "created",
      eventPayload: {
        paymentMode: payload.payment_mode,
        tariffType: payload.tariff_type,
        clientAmount: payload.client_amount,
      },
      createdBy: user.id,
    });

    return NextResponse.json({ data, error: null, message: "Offer created" });
  } catch (error) {
    return NextResponse.json(
      { data: null, error: "Internal error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
