import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { checkBookingStatus, createBookingForm, startBooking } from "@/lib/ratehawk/client";
import { logHotelOfferEvent } from "@/lib/hotels/events";

export async function finalizeHotelOfferBooking(offerId: string): Promise<void> {
  const { data: offer } = await supabaseAdmin
    .from("hotel_offers")
    .select("*")
    .eq("id", offerId)
    .single();

  if (!offer) return;
  if (offer.status === "booking_confirmed" || offer.status === "booking_started") return;
  if (offer.payment_status !== "paid" && offer.status !== "paid") return;

  const keyId = process.env.RATEHAWK_KEY_ID;
  const apiKey = process.env.RATEHAWK_API_KEY;
  if (!keyId || !apiKey) {
    await supabaseAdmin
      .from("hotel_offers")
      .update({ status: "booking_failed", error_message: "RateHawk API not configured" })
      .eq("id", offerId);
    await logHotelOfferEvent({
      offerId,
      companyId: offer.company_id,
      eventType: "booking_failed",
      eventPayload: { reason: "ratehawk_not_configured" },
    });
    return;
  }

  if (!offer.book_hash) {
    await supabaseAdmin
      .from("hotel_offers")
      .update({ status: "booking_failed", error_message: "Missing book_hash" })
      .eq("id", offerId);
    await logHotelOfferEvent({
      offerId,
      companyId: offer.company_id,
      eventType: "booking_failed",
      eventPayload: { reason: "missing_book_hash" },
    });
    return;
  }

  const partnerOrderId = offer.partner_order_id || `HO-${Date.now()}-${offer.id.slice(0, 8)}`;

  try {
    const { data: startedOffer } = await supabaseAdmin
      .from("hotel_offers")
      .update({ status: "booking_started", partner_order_id: partnerOrderId })
      .eq("id", offerId)
      .neq("status", "booking_started")
      .neq("status", "booking_confirmed")
      .select("id")
      .maybeSingle();
    if (!startedOffer?.id) return;
    await logHotelOfferEvent({
      offerId,
      companyId: offer.company_id,
      eventType: "booking_started",
      eventPayload: { partnerOrderId },
    });

    const form = await createBookingForm(
      offer.book_hash,
      partnerOrderId,
      "127.0.0.1",
      keyId,
      apiKey
    );

    await startBooking(
      {
        partnerOrderId,
        guestFirstName: "Guest",
        guestLastName: offer.client_name || "Client",
        guestEmail: offer.client_email || "guest@travel-cms.com",
        guestPhone: "+0000000000",
        paymentType: form.paymentType,
        paymentAmount: form.amount,
        paymentCurrency: form.currencyCode,
      },
      keyId,
      apiKey
    );

    let bookingConfirmed = false;
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const status = await checkBookingStatus(partnerOrderId, keyId, apiKey);
      if (status.status === "ok") {
        bookingConfirmed = true;
        await supabaseAdmin
          .from("hotel_offers")
          .update({
            status: "booking_confirmed",
            booked_at: new Date().toISOString(),
            ratehawk_order_id: status.orderId ?? null,
            error_message: null,
          })
          .eq("id", offerId);
        await logHotelOfferEvent({
          offerId,
          companyId: offer.company_id,
          eventType: "booking_confirmed",
          eventPayload: { orderId: status.orderId, confirmationNumber: status.confirmationNumber },
        });
        await createOrderServiceFromOffer(offer);
        break;
      }
      if (status.status === "error") {
        await supabaseAdmin
          .from("hotel_offers")
          .update({
            status: "booking_failed",
            error_message: status.errorMessage || "Booking failed",
          })
          .eq("id", offerId);
        await logHotelOfferEvent({
          offerId,
          companyId: offer.company_id,
          eventType: "booking_failed",
          eventPayload: { reason: status.errorMessage || "unknown" },
        });
        return;
      }
    }

    if (!bookingConfirmed) {
      await supabaseAdmin
        .from("hotel_offers")
        .update({
          status: "booking_failed",
          error_message: "Booking confirmation timed out",
        })
        .eq("id", offerId);
      await logHotelOfferEvent({
        offerId,
        companyId: offer.company_id,
        eventType: "booking_failed",
        eventPayload: { reason: "timeout" },
      });
    }
  } catch (error) {
    await supabaseAdmin
      .from("hotel_offers")
      .update({
        status: "booking_failed",
        error_message: error instanceof Error ? error.message : "Unknown booking error",
      })
      .eq("id", offerId);
    await logHotelOfferEvent({
      offerId,
      companyId: offer.company_id,
      eventType: "booking_failed",
      eventPayload: {
        reason: error instanceof Error ? error.message : "unknown",
      },
    });
  }
}

async function createOrderServiceFromOffer(offer: Record<string, unknown>) {
  const clientPartyId = offer.client_party_id as string | null;
  const companyId = offer.company_id as string;
  const checkIn = offer.check_in as string;
  const checkOut = offer.check_out as string;

  if (!clientPartyId || !companyId) return;

  const { data: existingOrder } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq("company_id", companyId)
    .eq("client_party_id", clientPartyId)
    .lte("date_from", checkOut)
    .gte("date_to", checkIn)
    .limit(1)
    .maybeSingle();

  let orderId = existingOrder?.id as string | undefined;
  if (!orderId) {
    const { data: newOrder } = await supabaseAdmin
      .from("orders")
      .insert({
        company_id: companyId,
        client_party_id: clientPartyId,
        client_display_name: offer.client_name || "Client",
        status: "Active",
        order_type: "TO",
        date_from: checkIn,
        date_to: checkOut,
        countries_cities: offer.hotel_address || "Hotel booking",
      })
      .select("id")
      .single();
    orderId = newOrder?.id as string | undefined;
  }
  if (!orderId) return;

  const refNr = offer.partner_order_id as string | null;
  let existingServiceQuery = supabaseAdmin
    .from("order_services")
    .select("id")
    .eq("order_id", orderId)
    .eq("category", "accommodation")
    .limit(1);
  existingServiceQuery = refNr
    ? existingServiceQuery.eq("ref_nr", refNr)
    : existingServiceQuery.is("ref_nr", null);
  const { data: existingService } = await existingServiceQuery.maybeSingle();
  if (existingService?.id) return;

  await supabaseAdmin.from("order_services").insert({
    company_id: companyId,
    order_id: orderId,
    category: "accommodation",
    service_name: offer.hotel_name || "Hotel",
    service_date_from: checkIn,
    service_date_to: checkOut,
    hotel_name: offer.hotel_name || null,
    hotel_room: offer.room_name || null,
    hotel_board: offer.meal || null,
    supplier_name: "RateHawk",
    client_party_id: clientPartyId,
    client_name: offer.client_name || null,
    payer_party_id: clientPartyId,
    payer_name: offer.client_name || null,
    client_price: offer.client_amount || 0,
    service_price: offer.ratehawk_amount || 0,
    res_status: "confirmed",
    ref_nr: offer.partner_order_id || null,
  });
}
