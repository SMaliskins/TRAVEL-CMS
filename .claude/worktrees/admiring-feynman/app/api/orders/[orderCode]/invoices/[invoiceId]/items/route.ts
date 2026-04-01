import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function getInvoiceForOrder(orderCode: string, invoiceId: string) {
  const orderCodeDecoded = decodeURIComponent(orderCode);
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq("order_code", orderCodeDecoded)
    .single();
  if (!order) return null;

  const { data: invoice } = await supabaseAdmin
    .from("invoices")
    .select("id, order_id, tax_rate, subtotal, tax_amount, total")
    .eq("id", invoiceId)
    .eq("order_id", order.id)
    .single();

  return invoice;
}

async function recalcInvoiceTotals(invoiceId: string) {
  const { data: items } = await supabaseAdmin
    .from("invoice_items")
    .select("line_total")
    .eq("invoice_id", invoiceId);

  const subtotal = (items || []).reduce((sum, i) => sum + Number(i.line_total || 0), 0);
  const { data: inv } = await supabaseAdmin
    .from("invoices")
    .select("tax_rate")
    .eq("id", invoiceId)
    .single();
  const taxRate = Number(inv?.tax_rate ?? 0) || 0;
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;

  await supabaseAdmin
    .from("invoices")
    .update({
      subtotal,
      tax_amount: taxAmount,
      total,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);
}

/**
 * POST /api/orders/[orderCode]/invoices/[invoiceId]/items - Add a line to the invoice
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string; invoiceId: string }> }
) {
  try {
    const { orderCode, invoiceId } = await params;
    const invoice = await getInvoiceForOrder(orderCode, invoiceId);
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      service_name,
      service_client,
      service_category,
      service_date_from,
      service_date_to,
      quantity = 1,
      unit_price = 0,
    } = body;

    if (!service_name || typeof service_name !== "string" || !service_name.trim()) {
      return NextResponse.json({ error: "service_name is required" }, { status: 400 });
    }

    const qty = Math.max(0, Number(quantity) || 1);
    const price = Number(unit_price) || 0;
    const line_total = Math.round(qty * price * 100) / 100;

    const { data: newItem, error: insertError } = await supabaseAdmin
      .from("invoice_items")
      .insert({
        invoice_id: invoiceId,
        service_id: null,
        service_name: String(service_name).trim(),
        service_client: service_client != null ? String(service_client).trim() || null : null,
        service_category: service_category != null ? String(service_category).trim() || null : null,
        service_date_from: service_date_from || null,
        service_date_to: service_date_to || null,
        quantity: qty,
        unit_price: price,
        line_total,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[invoice-items] POST error:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    await recalcInvoiceTotals(invoiceId);

    return NextResponse.json({ data: newItem });
  } catch (err) {
    console.error("[invoice-items] POST:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
