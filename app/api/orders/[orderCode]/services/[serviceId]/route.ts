import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * PATCH /api/orders/[orderCode]/services/[serviceId]
 * Update a service OR split it into multiple services
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

    // Handle SPLIT action
    if (body.action === 'split' && body.parts && Array.isArray(body.parts)) {
      return handleSplitService(order.id, serviceId, body.parts);
    }

    // Regular update
    const updates: Record<string, unknown> = {};

    if (body.service_name !== undefined) updates.service_name = body.service_name;
    if (body.category !== undefined) updates.category = body.category;
    if (body.category_id !== undefined) updates.category_id = body.category_id;
    if (body.service_price !== undefined) updates.service_price = body.service_price;
    if (body.client_price !== undefined) updates.client_price = body.client_price;
    if (body.commission_name !== undefined) updates.commission_name = body.commission_name;
    if (body.commission_rate !== undefined) updates.commission_rate = body.commission_rate;
    if (body.commission_amount !== undefined) updates.commission_amount = body.commission_amount;
    if (body.agent_discount_value !== undefined) updates.agent_discount_value = body.agent_discount_value;
    if (body.agent_discount_type !== undefined) updates.agent_discount_type = body.agent_discount_type;
    if (body.vat_rate !== undefined) updates.vat_rate = body.vat_rate;
    if (body.res_status !== undefined) updates.res_status = body.res_status;
    if (body.ref_nr !== undefined) updates.ref_nr = body.ref_nr;
    if (body.ticket_nr !== undefined) updates.ticket_nr = body.ticket_nr;
    if (body.supplier_party_id !== undefined) updates.supplier_party_id = body.supplier_party_id;
    if (body.supplier_name !== undefined) updates.supplier_name = body.supplier_name;
    if (body.client_party_id !== undefined) updates.client_party_id = body.client_party_id;
    if (body.client_name !== undefined) updates.client_name = body.client_name;
    if (body.payer_party_id !== undefined) updates.payer_party_id = body.payer_party_id;
    if (body.payer_name !== undefined) updates.payer_name = body.payer_name;
    if (body.service_date_from !== undefined) updates.service_date_from = body.service_date_from;
    if (body.service_date_to !== undefined) updates.service_date_to = body.service_date_to;
    
    // Payment deadline fields
    if (body.payment_deadline_deposit !== undefined) updates.payment_deadline_deposit = body.payment_deadline_deposit;
    if (body.payment_deadline_final !== undefined) updates.payment_deadline_final = body.payment_deadline_final;
    if (body.payment_terms !== undefined) updates.payment_terms = body.payment_terms;

    // Terms & conditions fields
    if (body.price_type !== undefined) updates.price_type = body.price_type;
    if (body.refund_policy !== undefined) updates.refund_policy = body.refund_policy;
    if (body.free_cancellation_until !== undefined) updates.free_cancellation_until = body.free_cancellation_until;
    if (body.cancellation_penalty_amount !== undefined) updates.cancellation_penalty_amount = body.cancellation_penalty_amount;
    if (body.cancellation_penalty_percent !== undefined) updates.cancellation_penalty_percent = body.cancellation_penalty_percent;
    if (body.ticket_numbers !== undefined) updates.ticket_numbers = body.ticket_numbers;
    if (body.change_fee !== undefined) updates.change_fee = body.change_fee;
    if (body.flight_segments !== undefined) updates.flight_segments = body.flight_segments;
    if (body.cabin_class !== undefined) updates.cabin_class = body.cabin_class;
    if (body.baggage !== undefined) updates.baggage = body.baggage;
    
    // Hotel-specific fields
    if (body.hotel_name !== undefined) updates.hotel_name = body.hotel_name;
    if (body.hotel_star_rating !== undefined) updates.hotel_star_rating = body.hotel_star_rating;
    if (body.hotel_address !== undefined) updates.hotel_address = body.hotel_address;
    if (body.hotel_phone !== undefined) updates.hotel_phone = body.hotel_phone;
    if (body.hotel_email !== undefined) updates.hotel_email = body.hotel_email;
    if (body.hotel_room !== undefined) updates.hotel_room = body.hotel_room;
    if (body.hotel_board !== undefined) updates.hotel_board = body.hotel_board;
    if (body.meal_plan_text !== undefined) updates.meal_plan_text = body.meal_plan_text;
    if (body.hotel_bed_type !== undefined) updates.hotel_bed_type = body.hotel_bed_type;
    if (body.hotel_early_check_in !== undefined) updates.hotel_early_check_in = body.hotel_early_check_in;
    if (body.hotel_late_check_in !== undefined) updates.hotel_late_check_in = body.hotel_late_check_in;
    if (body.hotel_higher_floor !== undefined) updates.hotel_higher_floor = body.hotel_higher_floor;
    if (body.hotel_king_size_bed !== undefined) updates.hotel_king_size_bed = body.hotel_king_size_bed;
    if (body.hotel_honeymooners !== undefined) updates.hotel_honeymooners = body.hotel_honeymooners;
    if (body.hotel_silent_room !== undefined) updates.hotel_silent_room = body.hotel_silent_room;
    if (body.hotel_rooms_next_to !== undefined) updates.hotel_rooms_next_to = body.hotel_rooms_next_to;
    if (body.hotel_parking !== undefined) updates.hotel_parking = body.hotel_parking;
    if (body.hotel_preferences_free_text !== undefined) updates.hotel_preferences_free_text = body.hotel_preferences_free_text;
    if (body.supplier_booking_type !== undefined) updates.supplier_booking_type = body.supplier_booking_type;
    if (body.transfer_type !== undefined) updates.transfer_type = body.transfer_type;
    if (body.additional_services !== undefined) updates.additional_services = body.additional_services;
    
    // Transfer-specific fields
    if (body.pickup_location !== undefined) updates.pickup_location = body.pickup_location;
    if (body.dropoff_location !== undefined) updates.dropoff_location = body.dropoff_location;
    if (body.pickup_time !== undefined) updates.pickup_time = body.pickup_time;
    if (body.estimated_duration !== undefined) updates.estimated_duration = body.estimated_duration;
    if (body.linked_flight_id !== undefined) updates.linked_flight_id = body.linked_flight_id;
    
    // Amendment fields (change/cancellation)
    if (body.parent_service_id !== undefined) updates.parent_service_id = body.parent_service_id;
    if (body.service_type !== undefined) updates.service_type = body.service_type;
    if (body.cancellation_fee !== undefined) updates.cancellation_fee = body.cancellation_fee;
    if (body.refund_amount !== undefined) updates.refund_amount = body.refund_amount;

    console.log("[Service PATCH] cabin_class update:", { 
      received: body.cabin_class, 
      willUpdate: updates.cabin_class,
      allUpdates: Object.keys(updates)
    });

    // Auto-sync names from party when party_id changes but name not provided
    const partyIdsToFetch: { field: string; partyId: string; nameField: string }[] = [];
    
    if (body.supplier_party_id && !body.supplier_name) {
      partyIdsToFetch.push({ field: "supplier_party_id", partyId: body.supplier_party_id, nameField: "supplier_name" });
    }
    if (body.client_party_id && !body.client_name) {
      partyIdsToFetch.push({ field: "client_party_id", partyId: body.client_party_id, nameField: "client_name" });
    }
    if (body.payer_party_id && !body.payer_name) {
      partyIdsToFetch.push({ field: "payer_party_id", partyId: body.payer_party_id, nameField: "payer_name" });
    }

    for (const item of partyIdsToFetch) {
      const { data: partyData } = await supabaseAdmin
        .from("party")
        .select("display_name")
        .eq("id", item.partyId)
        .single();
      
      if (partyData?.display_name) {
        updates[item.nameField] = partyData.display_name;
        console.log(`[Service PATCH] Auto-synced ${item.nameField}:`, partyData.display_name);
      }
    }

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

    // Handle multiple clients: update order_travellers and order_service_travellers
    // Collect client party IDs from clients array or single client_party_id
    let clientPartyIds: string[] = [];
    
    if (body.clients && Array.isArray(body.clients) && body.clients.length > 0) {
      clientPartyIds = body.clients
        .filter((c: { partyId?: string; id?: string }) => c.partyId || c.id)
        .map((c: { partyId?: string; id?: string }) => c.partyId || c.id);
    } else if (body.client_party_id) {
      // Fallback: use single client_party_id if no clients array
      clientPartyIds = [body.client_party_id];
    }

    if (clientPartyIds.length > 0) {
      // Get company_id from service
      const companyId = service.company_id;

      // Add each client to order_travellers (if not exists)
      for (const partyId of clientPartyIds) {
        await supabaseAdmin
          .from("order_travellers")
          .upsert({
            company_id: companyId,
            order_id: order.id,
            party_id: partyId,
            is_main_client: partyId === (body.clientPartyId || body.client_party_id),
          }, { onConflict: "order_id,party_id" });
      }

      // Replace order_service_travellers for this service
      // First delete existing
      await supabaseAdmin
        .from("order_service_travellers")
        .delete()
        .eq("service_id", serviceId);

      // Then insert new
      const serviceTravellerInserts = clientPartyIds.map((partyId: string) => ({
        company_id: companyId,
        service_id: serviceId,
        traveller_id: partyId,
      }));

      await supabaseAdmin
        .from("order_service_travellers")
        .insert(serviceTravellerInserts);
      
      console.log("[Services PATCH] Updated service_travellers:", clientPartyIds);
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
 * Handle service split
 */
async function handleSplitService(
  orderId: string,
  serviceId: string,
  parts: Array<{
    name: string;
    clientPrice: number;
    payer: string | null;
    travellers?: string[];
    splitIndex: number;
    totalParts: number;
  }>
) {
  try {
    // Get original service
    const { data: originalService, error: fetchError } = await supabaseAdmin
      .from("order_services")
      .select("*")
      .eq("id", serviceId)
      .eq("order_id", orderId)
      .single();

    if (fetchError || !originalService) {
      return NextResponse.json(
        { error: "Service not found" },
        { status: 404 }
      );
    }

    // Generate split_group_id (UUID)
    const splitGroupId = crypto.randomUUID();

    // Create new services for each part
    const newServices = parts.map((part, index) => ({
      order_id: orderId,
      service_name: originalService.service_name,
      category: originalService.category,
      service_price: originalService.service_price ? (originalService.service_price / parts.length) : null,
      client_price: part.clientPrice,
      res_status: originalService.res_status,
      ref_nr: originalService.ref_nr,
      ticket_nr: originalService.ticket_nr,
      supplier_party_id: originalService.supplier_party_id,
      supplier_name: originalService.supplier_name,
      client_party_id: originalService.client_party_id,
      client_name: originalService.client_name,
      payer_party_id: part.payer ? originalService.payer_party_id : null,
      payer_name: part.payer || null,
      service_date_from: originalService.service_date_from,
      service_date_to: originalService.service_date_to,
      split_group_id: splitGroupId,
      split_index: part.splitIndex,
      split_total: part.totalParts,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    // Insert new services
    const { data: createdServices, error: insertError } = await supabaseAdmin
      .from("order_services")
      .insert(newServices)
      .select();

    if (insertError) {
      console.error("Insert split services error:", insertError);
      return NextResponse.json(
        { error: "Failed to create split services", details: insertError.message },
        { status: 500 }
      );
    }

    // Delete original service
    const { error: deleteError } = await supabaseAdmin
      .from("order_services")
      .delete()
      .eq("id", serviceId)
      .eq("order_id", orderId);

    if (deleteError) {
      console.error("Delete original service error:", deleteError);
      // If delete fails, try to rollback (delete created services)
      await supabaseAdmin
        .from("order_services")
        .delete()
        .eq("split_group_id", splitGroupId);
      
      return NextResponse.json(
        { error: "Failed to delete original service", details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      services: createdServices,
      splitGroupId
    });
  } catch (err) {
    console.error("Split service error:", err);
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
