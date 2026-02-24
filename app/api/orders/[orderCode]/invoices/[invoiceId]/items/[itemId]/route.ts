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
    .select("id, order_id")
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
 * PATCH /api/orders/[orderCode]/invoices/[invoiceId]/items/[itemId] - Update a line (service_name, client, dates, amount for draft only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string; invoiceId: string; itemId: string }> }
) {
  try {
    const { orderCode, invoiceId, itemId } = await params;
    const invoice = await getInvoiceForOrder(orderCode, invoiceId);
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const { data: inv } = await supabaseAdmin
      .from("invoices")
      .select("id, status")
      .eq("id", invoiceId)
      .single();
    const isDraft = inv?.status === "draft";

    const body = await request.json().catch(() => ({}));
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.service_name !== undefined) updates.service_name = String(body.service_name ?? "").trim();
    if (body.service_client !== undefined) updates.service_client = String(body.service_client ?? "").trim();
    if (body.service_date_from !== undefined) updates.service_date_from = body.service_date_from && String(body.service_date_from).trim() ? String(body.service_date_from).trim() : null;
    if (body.service_date_to !== undefined) updates.service_date_to = body.service_date_to && String(body.service_date_to).trim() ? String(body.service_date_to).trim() : null;
    if ("service_dates_text" in body) updates.service_dates_text = body.service_dates_text != null && String(body.service_dates_text).trim() ? String(body.service_dates_text).trim() : null;

    if (isDraft) {
      if (body.quantity !== undefined) updates.quantity = Math.max(1, Number(body.quantity) || 1);
      if (body.unit_price !== undefined) updates.unit_price = Number(body.unit_price) || 0;
      const qty = (updates.quantity as number) ?? undefined;
      const price = (updates.unit_price as number) ?? undefined;
      if (qty !== undefined || price !== undefined) {
        const { data: item } = await supabaseAdmin.from("invoice_items").select("quantity, unit_price").eq("id", itemId).eq("invoice_id", invoiceId).single();
        const newQty = qty !== undefined ? qty : Number(item?.quantity ?? 1);
        const newPrice = price !== undefined ? price : Number(item?.unit_price ?? 0);
        updates.line_total = Math.round(newQty * newPrice * 100) / 100;
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from("invoice_items")
      .update(updates)
      .eq("id", itemId)
      .eq("invoice_id", invoiceId);

    if (updateError) {
      console.error("[invoice-items] PATCH error:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (isDraft && (updates.unit_price !== undefined || updates.quantity !== undefined)) {
      await recalcInvoiceTotals(invoiceId);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[invoice-items] PATCH:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/orders/[orderCode]/invoices/[invoiceId]/items/[itemId] - Remove a line from the invoice
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string; invoiceId: string; itemId: string }> }
) {
  try {
    const { orderCode, invoiceId, itemId } = await params;
    const invoice = await getInvoiceForOrder(orderCode, invoiceId);
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const { data: item } = await supabaseAdmin
      .from("invoice_items")
      .select("id")
      .eq("id", itemId)
      .eq("invoice_id", invoiceId)
      .single();

    if (!item) {
      return NextResponse.json({ error: "Invoice line not found" }, { status: 404 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from("invoice_items")
      .delete()
      .eq("id", itemId)
      .eq("invoice_id", invoiceId);

    if (deleteError) {
      console.error("[invoice-items] DELETE error:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Do NOT unlink order_services from this invoice when a line is removed.
    // Deleting a line is a presentation/formatting choice; all originally selected services remain on this invoice.

    await recalcInvoiceTotals(invoiceId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[invoice-items] DELETE:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
