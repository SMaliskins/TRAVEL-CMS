import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

    // Build update object
    const updates: Record<string, unknown> = {};

    if (body.service_name !== undefined) updates.service_name = body.service_name;
    if (body.category !== undefined) updates.category = body.category;
    if (body.service_price !== undefined) updates.service_price = body.service_price;
    if (body.client_price !== undefined) updates.client_price = body.client_price;
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
    // Backward compatibility
    if (body.date_from !== undefined) updates.service_date_from = body.date_from;
    if (body.date_to !== undefined) updates.service_date_to = body.date_to;
    if (body.hotel_name !== undefined) updates.hotel_name = body.hotel_name;
    if (body.hotel_address !== undefined) updates.hotel_address = body.hotel_address;
    if (body.hotel_phone !== undefined) updates.hotel_phone = body.hotel_phone;
    if (body.hotel_email !== undefined) updates.hotel_email = body.hotel_email;

    updates.updated_at = new Date().toISOString();

    const updateService = (payload: Record<string, unknown>) =>
      supabaseAdmin
        .from("order_services")
        .update(payload)
        .eq("id", serviceId)
        .eq("order_id", order.id)
        .select()
        .single();

    let { data: service, error: updateError } = await updateService(updates);

    // Some environments may not have hotel columns yet.
    if (updateError?.code === "42703") {
      const safeUpdates = { ...updates };
      delete safeUpdates.hotel_name;
      delete safeUpdates.hotel_address;
      delete safeUpdates.hotel_phone;
      delete safeUpdates.hotel_email;
      ({ data: service, error: updateError } = await updateService(safeUpdates));
    }

    if (updateError) {
      console.error("Update service error:", updateError);
      return NextResponse.json(
        { error: "Failed to update service", details: updateError.message },
        { status: 500 }
      );
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
