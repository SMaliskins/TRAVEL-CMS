import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

interface SplitPart {
  amount: number;
  serviceAmount?: number;
  payerName: string;
  payerPartyId?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string; serviceId: string }> }
) {
  try {
    const { orderCode, serviceId } = await params;
    const body = await request.json();
    const { parts } = body as { parts: SplitPart[] };

    if (!parts || !Array.isArray(parts) || parts.length < 2) {
      return NextResponse.json(
        { error: "At least 2 parts required" },
        { status: 400 }
      );
    }

    const { data: originalService, error: fetchError } = await supabaseAdmin
      .from("order_services")
      .select("*")
      .eq("id", serviceId)
      .single();

    if (fetchError || !originalService) {
      return NextResponse.json(
        { error: "Service not found" },
        { status: 404 }
      );
    }

    const totalAmount = parts.reduce((sum, part) => sum + part.amount, 0);
    if (Math.abs(totalAmount - originalService.client_price) > 0.01) {
      return NextResponse.json(
        { error: "Total client amount must equal original service price" },
        { status: 400 }
      );
    }

    if (originalService.invoice_id) {
      return NextResponse.json(
        { error: "Cannot split service that already has an invoice" },
        { status: 400 }
      );
    }


    // Fetch original service travellers before delete (for copy to new services)
    const { data: originalTravellers } = await supabaseAdmin
      .from("order_service_travellers")
      .select("traveller_id")
      .eq("service_id", serviceId);

    // Use provided serviceAmount or calculate proportionally
    const getServicePrice = (part: SplitPart) => {
      if (part.serviceAmount !== undefined) return part.serviceAmount;
      const priceRatio = part.amount / originalService.client_price;
      return originalService.service_price * priceRatio;
    };

    // Generate a unique split_group_id for all parts
    const { randomUUID } = await import("crypto");
    const splitGroupId = randomUUID();

    // Build base object: copy ALL fields from original, override only split-specific ones
    const baseFields: Record<string, unknown> = {
      order_id: originalService.order_id,
      company_id: originalService.company_id,
      category: originalService.category,
      category_id: originalService.category_id,
      service_name: originalService.service_name,
      service_date_from: originalService.service_date_from,
      service_date_to: originalService.service_date_to,
      supplier_party_id: originalService.supplier_party_id,
      supplier_name: originalService.supplier_name,
      ref_nr: originalService.ref_nr,
      ticket_nr: originalService.ticket_nr,
      res_status: originalService.res_status,
      client_party_id: originalService.client_party_id,
      client_name: originalService.client_name,
      vat_rate: originalService.vat_rate,
      // Package Tour / Hotel / Flight fields
      flight_segments: originalService.flight_segments,
      cabin_class: originalService.cabin_class,
      baggage: originalService.baggage,
      ticket_numbers: originalService.ticket_numbers,
      boarding_passes: originalService.boarding_passes,
      hotel_name: originalService.hotel_name,
      hotel_star_rating: originalService.hotel_star_rating,
      hotel_address: originalService.hotel_address,
      hotel_phone: originalService.hotel_phone,
      hotel_email: originalService.hotel_email,
      hotel_room: originalService.hotel_room,
      hotel_board: originalService.hotel_board,
      meal_plan_text: originalService.meal_plan_text,
      hotel_bed_type: originalService.hotel_bed_type,
      hotel_early_check_in: originalService.hotel_early_check_in,
      hotel_late_check_in: originalService.hotel_late_check_in,
      hotel_higher_floor: originalService.hotel_higher_floor,
      hotel_king_size_bed: originalService.hotel_king_size_bed,
      hotel_honeymooners: originalService.hotel_honeymooners,
      hotel_silent_room: originalService.hotel_silent_room,
      hotel_rooms_next_to: originalService.hotel_rooms_next_to,
      hotel_parking: originalService.hotel_parking,
      hotel_preferences_free_text: originalService.hotel_preferences_free_text,
      supplier_booking_type: originalService.supplier_booking_type,
      transfer_type: originalService.transfer_type,
      additional_services: originalService.additional_services,
      // Payment / terms
      payment_deadline_deposit: originalService.payment_deadline_deposit,
      payment_deadline_final: originalService.payment_deadline_final,
      payment_terms: originalService.payment_terms,
      price_type: originalService.price_type,
      refund_policy: originalService.refund_policy,
      free_cancellation_until: originalService.free_cancellation_until,
      cancellation_penalty_amount: originalService.cancellation_penalty_amount,
      cancellation_penalty_percent: originalService.cancellation_penalty_percent,
      change_fee: originalService.change_fee,
      // Transfer
      pickup_location: originalService.pickup_location,
      dropoff_location: originalService.dropoff_location,
      pickup_time: originalService.pickup_time,
      estimated_duration: originalService.estimated_duration,
      linked_flight_id: originalService.linked_flight_id,
      // Amendment
      parent_service_id: originalService.parent_service_id,
      service_type: originalService.service_type,
      cancellation_fee: originalService.cancellation_fee,
      refund_amount: originalService.refund_amount,
      // Tour commission
      commission_name: originalService.commission_name,
      commission_rate: originalService.commission_rate,
      commission_amount: originalService.commission_amount,
      agent_discount_value: originalService.agent_discount_value,
      agent_discount_type: originalService.agent_discount_type,
    };

    const newServices = parts.map((part, index) => ({
      ...baseFields,
      client_price: part.amount,
      service_price: getServicePrice(part),
      payer_party_id: part.payerPartyId || originalService.payer_party_id,
      payer_name: part.payerName || originalService.payer_name,
      split_group_id: splitGroupId,
      split_index: index + 1,
      split_total: parts.length,
      notes: originalService.notes
        ? `${originalService.notes}\n[Split from original service - Payer: ${part.payerName}]`
        : `[Split from original service - Payer: ${part.payerName}]`,
    }));

    const { data: createdServices, error: insertError } = await supabaseAdmin
      .from("order_services")
      .insert(newServices)
      .select();

    if (insertError) {
      console.error("Error creating split services:", insertError);
      return NextResponse.json(
        { error: "Failed to create split services", details: insertError.message },
        { status: 500 }
      );
    }

    // Copy order_service_travellers to each new service
    if (originalTravellers && originalTravellers.length > 0 && createdServices) {
      const travellerInserts: Array<{ company_id: string; service_id: string; traveller_id: string }> = [];
      for (const svc of createdServices) {
        for (const t of originalTravellers) {
          if (t.traveller_id) {
            travellerInserts.push({
              company_id: originalService.company_id,
              service_id: svc.id,
              traveller_id: t.traveller_id,
            });
          }
        }
      }
      if (travellerInserts.length > 0) {
        const { error: travellerError } = await supabaseAdmin
          .from("order_service_travellers")
          .insert(travellerInserts);
        if (travellerError) {
          console.error("Error copying travellers to split services:", travellerError);
        }
      }
    }

    const { error: deleteError } = await supabaseAdmin
      .from("order_services")
      .delete()
      .eq("id", serviceId);

    if (deleteError) {
      console.error("Error deleting original service:", deleteError);
      return NextResponse.json({
        success: true,
        createdServices,
        warning: "Original service could not be deleted",
      });
    }

    return NextResponse.json({
      success: true,
      createdServices,
      message: `Service split into ${parts.length} parts`,
    });
  } catch (error: any) {
    console.error("Split service error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
