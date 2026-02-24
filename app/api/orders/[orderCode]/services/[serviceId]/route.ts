import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { upsertOrderServiceEmbedding } from "@/lib/embeddings/upsert";
import { sendPushToClient } from "@/lib/client-push/sendPush";

/**
 * PATCH /api/orders/[orderCode]/services/[serviceId]
 * Update a service
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string; serviceId: string }> }
) {
  try {
    const { orderCode, serviceId } = await params;
    const body = await request.json();

    // Get order by code
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("order_code", orderCode)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    const { data: existingService } = await supabaseAdmin
      .from("order_services")
      .select("invoice_id")
      .eq("id", serviceId)
      .eq("order_id", order.id)
      .single();

    const isInvoiced = !!existingService?.invoice_id;

    // Build update object
    const updates: Record<string, unknown> = {};

    if (body.service_name !== undefined) updates.service_name = body.service_name;
    if (body.category !== undefined) updates.category = body.category;
    if (body.service_price !== undefined) updates.service_price = body.service_price;
    if (body.client_price !== undefined) {
      if (!isInvoiced) {
        updates.client_price = body.client_price;
      }
      // If invoiced, silently skip client_price update (field is locked on frontend)
    }
    if (body.res_status !== undefined) updates.res_status = body.res_status;
    if (body.ref_nr !== undefined) updates.ref_nr = body.ref_nr;
    if (body.ticket_nr !== undefined) updates.ticket_nr = body.ticket_nr;
    if (body.ticket_numbers !== undefined && Array.isArray(body.ticket_numbers)) updates.ticket_numbers = body.ticket_numbers;
    if (body.supplier_party_id !== undefined) updates.supplier_party_id = body.supplier_party_id;
    if (body.supplier_name !== undefined) updates.supplier_name = body.supplier_name;
    if (body.client_party_id !== undefined) updates.client_party_id = body.client_party_id;
    if (body.client_name !== undefined) updates.client_name = body.client_name;
    if (body.payer_party_id !== undefined) updates.payer_party_id = body.payer_party_id;
    if (body.payer_name !== undefined) updates.payer_name = body.payer_name;
    // order_services columns are service_date_from / service_date_to (payload sends these)
    if (body.service_date_from !== undefined) updates.service_date_from = body.service_date_from;
    if (body.service_date_to !== undefined) updates.service_date_to = body.service_date_to;
    if (body.date_from !== undefined) updates.service_date_from = body.date_from;
    if (body.date_to !== undefined) updates.service_date_to = body.date_to;

    // Tour / Hotel / terms (Edit modal sends snake_case)
    if (body.hotel_name !== undefined) updates.hotel_name = body.hotel_name;
    if (body.hotel_star_rating !== undefined) updates.hotel_star_rating = body.hotel_star_rating;
    if (body.hotel_room !== undefined) updates.hotel_room = body.hotel_room;
    if (body.hotel_board !== undefined) updates.hotel_board = body.hotel_board;
    if (body.meal_plan_text !== undefined) updates.meal_plan_text = body.meal_plan_text;
    if (body.transfer_type !== undefined) updates.transfer_type = body.transfer_type;
    if (body.additional_services !== undefined) updates.additional_services = body.additional_services;
    if (body.hotel_address !== undefined) updates.hotel_address = body.hotel_address;
    if (body.hotel_phone !== undefined) updates.hotel_phone = body.hotel_phone;
    if (body.hotel_email !== undefined) updates.hotel_email = body.hotel_email;
    if (body.hotel_bed_type !== undefined) updates.hotel_bed_type = body.hotel_bed_type;
    if (body.hotelBedType !== undefined) updates.hotel_bed_type = body.hotelBedType;
    if (body.hotel_early_check_in !== undefined) updates.hotel_early_check_in = body.hotel_early_check_in;
    if (body.hotel_late_check_in !== undefined) updates.hotel_late_check_in = body.hotel_late_check_in;
    if (body.hotel_higher_floor !== undefined) updates.hotel_higher_floor = body.hotel_higher_floor;
    if (body.hotel_king_size_bed !== undefined) updates.hotel_king_size_bed = body.hotel_king_size_bed;
    if (body.hotel_honeymooners !== undefined) updates.hotel_honeymooners = body.hotel_honeymooners;
    if (body.hotel_silent_room !== undefined) updates.hotel_silent_room = body.hotel_silent_room;
    if (body.hotel_repeat_guests !== undefined) updates.hotel_repeat_guests = body.hotel_repeat_guests;
    if (body.hotel_rooms_next_to !== undefined) updates.hotel_rooms_next_to = body.hotel_rooms_next_to;
    if (body.hotel_parking !== undefined) updates.hotel_parking = body.hotel_parking;
    if (body.hotel_preferences_free_text !== undefined) updates.hotel_preferences_free_text = body.hotel_preferences_free_text;
    if (body.supplier_booking_type !== undefined) updates.supplier_booking_type = body.supplier_booking_type;
    if (body.payment_deadline_deposit !== undefined) updates.payment_deadline_deposit = body.payment_deadline_deposit;
    if (body.payment_deadline_final !== undefined) updates.payment_deadline_final = body.payment_deadline_final;
    if (body.payment_terms !== undefined) updates.payment_terms = body.payment_terms;
    if (body.price_type !== undefined) updates.price_type = body.price_type;
    if (body.refund_policy !== undefined) updates.refund_policy = body.refund_policy;
    if (body.free_cancellation_until !== undefined) updates.free_cancellation_until = body.free_cancellation_until;
    if (body.cancellation_penalty_amount !== undefined) updates.cancellation_penalty_amount = body.cancellation_penalty_amount;
    if (body.cancellation_penalty_percent !== undefined) updates.cancellation_penalty_percent = body.cancellation_penalty_percent;
    if (body.change_fee !== undefined) updates.change_fee = body.change_fee;
    if (body.commission_name !== undefined) updates.commission_name = body.commission_name;
    if (body.commission_rate !== undefined) updates.commission_rate = body.commission_rate;
    if (body.commission_amount !== undefined) updates.commission_amount = body.commission_amount;
    if (body.agent_discount_value !== undefined) updates.agent_discount_value = body.agent_discount_value;
    if (body.agent_discount_type !== undefined) updates.agent_discount_type = body.agent_discount_type;
    if (body.pickup_location !== undefined) updates.pickup_location = body.pickup_location;
    if (body.dropoff_location !== undefined) updates.dropoff_location = body.dropoff_location;
    if (body.pickup_time !== undefined) updates.pickup_time = body.pickup_time;
    if (body.estimated_duration !== undefined) updates.estimated_duration = body.estimated_duration;
    if (body.linked_flight_id !== undefined) updates.linked_flight_id = body.linked_flight_id;
    if (body.cabin_class !== undefined) updates.cabin_class = body.cabin_class;
    if (body.baggage !== undefined) updates.baggage = body.baggage;
    if (body.flight_segments !== undefined) updates.flight_segments = body.flight_segments;

    // Fetch old service for notification diff
    const { data: oldSvc } = await supabaseAdmin
      .from("order_services")
      .select("service_name, service_date_from, service_date_to, flight_segments, res_status, category")
      .eq("id", serviceId)
      .eq("order_id", order.id)
      .single();

    updates.updated_at = new Date().toISOString();

    // Update service
    const { data: service, error: updateError } = await supabaseAdmin
      .from("order_services")
      .update(updates)
      .eq("id", serviceId)
      .eq("order_id", order.id)
      .select()
      .single();

    if (updateError) {
      console.error("Update service error:", updateError);
      return NextResponse.json(
        { error: "Failed to update service", details: updateError.message },
        { status: 500 }
      );
    }

    upsertOrderServiceEmbedding(serviceId).catch((e) => console.warn("[PATCH service] upsertOrderServiceEmbedding:", e));

    const { data: orderForPush } = await supabaseAdmin
      .from("orders")
      .select("client_party_id, countries_cities")
      .eq("id", order.id)
      .single();

    if (orderForPush?.client_party_id && oldSvc) {
      const fmtD = (d: string | null) => {
        if (!d) return "—";
        const dt = new Date(d);
        return `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.${dt.getFullYear()}`;
      };
      const fmtTime = (t: string | null) => t ? t.substring(0, 5) : "—";

      const blocks: string[] = [];
      const cat = oldSvc.category || service.category || "";
      const name = service.service_name || oldSvc.service_name || "Service";

      // Flight schedule changes
      if (cat.toLowerCase().includes("flight") && body.flight_segments && Array.isArray(oldSvc.flight_segments)) {
        const oldSegs = oldSvc.flight_segments as { departureCity?: string; arrivalCity?: string; departureDate?: string; departureTimeScheduled?: string; arrivalTimeScheduled?: string }[];
        const newSegs = body.flight_segments as typeof oldSegs;
        for (let i = 0; i < Math.max(oldSegs.length, newSegs.length); i++) {
          const o = oldSegs[i];
          const n = newSegs[i];
          if (o && n) {
            const route = `${o.departureCity || "?"}-${o.arrivalCity || "?"}`;
            const oldLine = `${route} ${fmtD(o.departureDate || null)} ${fmtTime(o.departureTimeScheduled || null)}-${fmtTime(o.arrivalTimeScheduled || null)}`;
            const newLine = `${n.departureCity || o.departureCity || "?"}-${n.arrivalCity || o.arrivalCity || "?"} ${fmtD(n.departureDate || o.departureDate || null)} ${fmtTime(n.departureTimeScheduled || o.departureTimeScheduled || null)}-${fmtTime(n.arrivalTimeScheduled || o.arrivalTimeScheduled || null)}`;
            if (oldLine !== newLine) {
              blocks.push(`It was: ${oldLine}\nNow: ${newLine}`);
            }
          }
        }
      }

      // Date changes
      const datesChanged =
        (body.service_date_from && body.service_date_from !== oldSvc.service_date_from) ||
        (body.service_date_to && body.service_date_to !== oldSvc.service_date_to) ||
        (body.date_from && body.date_from !== oldSvc.service_date_from) ||
        (body.date_to && body.date_to !== oldSvc.service_date_to);
      if (datesChanged && blocks.length === 0) {
        const oldFrom = fmtD(oldSvc.service_date_from);
        const oldTo = fmtD(oldSvc.service_date_to);
        const newFrom = fmtD(body.service_date_from ?? body.date_from ?? oldSvc.service_date_from);
        const newTo = fmtD(body.service_date_to ?? body.date_to ?? oldSvc.service_date_to);
        blocks.push(`It was: ${oldFrom} — ${oldTo}\nNow: ${newFrom} — ${newTo}`);
      }

      // Status changes
      if (body.res_status && body.res_status !== oldSvc.res_status) {
        blocks.push(`It was: ${oldSvc.res_status || "—"}\nNow: ${body.res_status}`);
      }

      if (blocks.length === 0) blocks.push("Details updated");

      sendPushToClient(orderForPush.client_party_id, {
        title: "Itinerary updated",
        body: `${name}\n${blocks.join("\n")}`,
        type: "service_update",
        refId: order.id,
      }).catch((e: unknown) => console.error("[Push] fire-and-forget:", e));
    }

    return NextResponse.json({ service });
  } catch (err) {
    console.error("PATCH service error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/orders/[orderCode]/services/[serviceId]
 * Delete a service
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string; serviceId: string }> }
) {
  try {
    const { orderCode, serviceId } = await params;
    const { searchParams } = new URL(request.url);
    const mergeIntoServiceId = searchParams.get("mergeIntoServiceId");

    // Get order by code
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("order_code", orderCode)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    // When merging: reassign invoice_items and travellers to the target service
    if (mergeIntoServiceId) {
      const { error: invoiceReassignError } = await supabaseAdmin
        .from("invoice_items")
        .update({ service_id: mergeIntoServiceId })
        .eq("service_id", serviceId);

      if (invoiceReassignError) {
        console.error("Reassign invoice_items error:", invoiceReassignError);
        return NextResponse.json(
          { error: "Failed to reassign invoice items", details: invoiceReassignError.message },
          { status: 500 }
        );
      }

      // Reassign service travellers: collect existing, then move non-duplicates
      const { data: sourceTravellers } = await supabaseAdmin
        .from("order_service_travellers")
        .select("traveller_id, company_id")
        .eq("service_id", serviceId);

      if (sourceTravellers && sourceTravellers.length > 0) {
        const { data: targetTravellers } = await supabaseAdmin
          .from("order_service_travellers")
          .select("traveller_id")
          .eq("service_id", mergeIntoServiceId);

        const existingIds = new Set((targetTravellers || []).map(t => t.traveller_id));
        const toInsert = sourceTravellers
          .filter(t => !existingIds.has(t.traveller_id))
          .map(t => ({
            company_id: t.company_id,
            service_id: mergeIntoServiceId,
            traveller_id: t.traveller_id,
          }));

        if (toInsert.length > 0) {
          await supabaseAdmin
            .from("order_service_travellers")
            .insert(toInsert);
        }

        // Delete source traveller links (CASCADE would handle this, but be explicit)
        await supabaseAdmin
          .from("order_service_travellers")
          .delete()
          .eq("service_id", serviceId);
      }
    }

    // Delete service
    const { error: deleteError } = await supabaseAdmin
      .from("order_services")
      .delete()
      .eq("id", serviceId)
      .eq("order_id", order.id);

    if (deleteError) {
      console.error("Delete service error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete service", details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE service error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
