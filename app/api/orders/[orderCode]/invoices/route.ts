import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// GET /api/orders/[orderCode]/invoices - List all invoices for an order
export async function GET(
  request: NextRequest,
  { params }: { params: { orderCode: string } }
) {
  try {
    const { orderCode } = params;

    // Get order ID from order_code
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, company_id")
      .eq("order_code", orderCode)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    // Get all invoices for this order
    const { data: invoices, error: invoicesError } = await supabaseAdmin
      .from("invoices")
      .select(`
        *,
        invoice_items (
          id,
          service_id,
          service_name,
          service_category,
          quantity,
          unit_price,
          line_total
        )
      `)
      .eq("order_id", order.id)
      .order("created_at", { ascending: false });

    if (invoicesError) {
      console.error("Error fetching invoices:", invoicesError);
      return NextResponse.json(
        { error: "Failed to fetch invoices" },
        { status: 500 }
      );
    }

    return NextResponse.json({ invoices: invoices || [] });
  } catch (error) {
    console.error("Error in GET /api/orders/[orderCode]/invoices:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/orders/[orderCode]/invoices - Create a new invoice
export async function POST(
  request: NextRequest,
  { params }: { params: { orderCode: string } }
) {
  try {
    const { orderCode } = params;
    const body = await request.json();

    const {
      invoice_number,
      invoice_date,
      due_date,
      client_name,
      client_address,
      client_email,
      services, // Array of { service_id, service_name, service_category, quantity, unit_price }
      subtotal,
      tax_rate,
      tax_amount,
      total,
      notes,
    } = body;

    // Validation
    if (!invoice_number || !services || services.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: invoice_number, services" },
        { status: 400 }
      );
    }

    // Get order ID and company_id
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, company_id")
      .eq("order_code", orderCode)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    // Check if any services are already invoiced
    const serviceIds = services.map((s: any) => s.service_id);
    const { data: existingServices, error: checkError } = await supabaseAdmin
      .from("order_services")
      .select("id, invoice_id")
      .in("id", serviceIds)
      .not("invoice_id", "is", null);

    if (checkError) {
      console.error("Error checking services:", checkError);
      return NextResponse.json(
        { error: "Failed to check services" },
        { status: 500 }
      );
    }

    if (existingServices && existingServices.length > 0) {
      return NextResponse.json(
        { error: "Some services are already invoiced" },
        { status: 400 }
      );
    }

    // Create invoice
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .insert({
        invoice_number,
        order_id: order.id,
        company_id: order.company_id,
        invoice_date: invoice_date || new Date().toISOString().split("T")[0],
        due_date: due_date || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        client_name: client_name || "",
        client_address: client_address || "",
        client_email: client_email || "",
        subtotal: subtotal || 0,
        tax_rate: tax_rate || 0,
        tax_amount: tax_amount || 0,
        total: total || 0,
        notes: notes || "",
        status: "draft",
      })
      .select()
      .single();

    if (invoiceError || !invoice) {
      console.error("Error creating invoice:", invoiceError);
      return NextResponse.json(
        { error: "Failed to create invoice" },
        { status: 500 }
      );
    }

    // Create invoice items
    const invoiceItems = services.map((service: any) => ({
      invoice_id: invoice.id,
      service_id: service.service_id,
      service_name: service.service_name || "",
      service_category: service.service_category || "",
      quantity: service.quantity || 1,
      unit_price: service.unit_price || 0,
      line_total: (service.quantity || 1) * (service.unit_price || 0),
    }));

    const { error: itemsError } = await supabaseAdmin
      .from("invoice_items")
      .insert(invoiceItems);

    if (itemsError) {
      console.error("Error creating invoice items:", itemsError);
      // Rollback: delete the invoice
      await supabaseAdmin.from("invoices").delete().eq("id", invoice.id);
      return NextResponse.json(
        { error: "Failed to create invoice items" },
        { status: 500 }
      );
    }

    // Update order_services to link them to this invoice
    const { error: updateServicesError } = await supabaseAdmin
      .from("order_services")
      .update({ invoice_id: invoice.id })
      .in("id", serviceIds);

    if (updateServicesError) {
      console.error("Error updating services:", updateServicesError);
      // Rollback: delete invoice and items
      await supabaseAdmin.from("invoice_items").delete().eq("invoice_id", invoice.id);
      await supabaseAdmin.from("invoices").delete().eq("id", invoice.id);
      return NextResponse.json(
        { error: "Failed to update services" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      invoice: {
        ...invoice,
        invoice_items: invoiceItems,
      },
    });
  } catch (error) {
    console.error("Error in POST /api/orders/[orderCode]/invoices:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
