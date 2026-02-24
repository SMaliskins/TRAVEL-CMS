import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function normalizeDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  if (!s) return null;
  const dmy = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

// PATCH /api/orders/[orderCode]/invoices/[invoiceId] - Update invoice (status, dates)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string; invoiceId: string }> }
) {
  try {
    const { invoiceId } = await params;
    const body = await request.json();
    const { status, replaced_by_invoice_id, invoice_date, due_date, deposit_date, final_payment_date } = body;

    // Fetch current invoice (order_id, total) before update
    const { data: existingInvoice, error: fetchErr } = await supabaseAdmin
      .from("invoices")
      .select("id, order_id, total, status")
      .eq("id", invoiceId)
      .single();

    if (fetchErr || !existingInvoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (status !== undefined) {
      const validStatuses = ["draft", "sent", "paid", "cancelled", "overdue", "issued", "issued_sent", "processed", "replaced"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
          { status: 400 }
        );
      }
      updatePayload.status = status;
      if (status === "replaced" && replaced_by_invoice_id != null) {
        updatePayload.replaced_by_invoice_id = replaced_by_invoice_id;
      }
    }

    if (invoice_date !== undefined) {
      const d = normalizeDate(invoice_date);
      if (d) updatePayload.invoice_date = d;
    }
    if (due_date !== undefined) updatePayload.due_date = normalizeDate(due_date);
    if (deposit_date !== undefined) updatePayload.deposit_date = normalizeDate(deposit_date);
    if (final_payment_date !== undefined) updatePayload.final_payment_date = normalizeDate(final_payment_date);

    const { data: invoice, error: updateError } = await supabaseAdmin
      .from("invoices")
      .update(updatePayload)
      .eq("id", invoiceId)
      .select()
      .single();

    if (updateError || !invoice) {
      console.error("Error updating invoice:", updateError);
      return NextResponse.json(
        { error: "Failed to update invoice" },
        { status: 500 }
      );
    }

    let paymentMovedToDeposit = 0;

    // If cancelling: move payment to order deposit (only if invoice was paid), unlock services
    if (status === "cancelled") {
      const orderId = existingInvoice.order_id as string;
      const invoiceTotal = Number(existingInvoice.total) || 0;
      const wasPaid = existingInvoice.status === "paid";

      // Decrease order amount_paid only when invoice was paid (payment moved to order deposit)
      if (orderId && wasPaid && invoiceTotal > 0) {
        const { data: orderRow } = await supabaseAdmin
          .from("orders")
          .select("amount_paid")
          .eq("id", orderId)
          .single();

        const currentPaid = Number((orderRow as any)?.amount_paid) || 0;
        const newPaid = Math.max(0, currentPaid - invoiceTotal);

        const { error: orderUpdateErr } = await supabaseAdmin
          .from("orders")
          .update({ amount_paid: newPaid, updated_at: new Date().toISOString() })
          .eq("id", orderId);

        if (!orderUpdateErr) {
          paymentMovedToDeposit = Math.min(invoiceTotal, currentPaid);
        }
      }

      // Unlock services (set invoice_id to null)
      const { error: unlockError } = await supabaseAdmin
        .from("order_services")
        .update({ invoice_id: null })
        .eq("invoice_id", invoiceId);

      if (unlockError) {
        console.error("Error unlocking services:", unlockError);
      }
    }

    return NextResponse.json({
      success: true,
      invoice,
      paymentMovedToDeposit,
    });
  } catch (error) {
    console.error("Error in PATCH /api/orders/[orderCode]/invoices/[invoiceId]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/orders/[orderCode]/invoices/[invoiceId] - Cancel invoice (alias for PATCH with status=cancelled)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string; invoiceId: string }> }
) {
  // Just call PATCH with status=cancelled
  const modifiedRequest = new Request(request.url, {
    method: "PATCH",
    headers: request.headers,
    body: JSON.stringify({ status: "cancelled" }),
  });

  return PATCH(modifiedRequest as NextRequest, { params });
}
