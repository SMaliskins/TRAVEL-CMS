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
