import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// PATCH /api/orders/[orderCode]/invoices/[invoiceId] - Update invoice status (e.g., cancel)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { orderCode: string; invoiceId: string } }
) {
  try {
    const { invoiceId } = params;
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        { error: "Missing required field: status" },
        { status: 400 }
      );
    }

    // Valid statuses
    const validStatuses = ["draft", "sent", "paid", "cancelled", "overdue"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // Update invoice status
    const { data: invoice, error: updateError } = await supabaseAdmin
      .from("invoices")
      .update({ status, updated_at: new Date().toISOString() })
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

    // If cancelling, unlock the services (set invoice_id to null)
    if (status === "cancelled") {
      const { error: unlockError } = await supabaseAdmin
        .from("order_services")
        .update({ invoice_id: null })
        .eq("invoice_id", invoiceId);

      if (unlockError) {
        console.error("Error unlocking services:", unlockError);
        // Don't fail the request, but log the error
      }
    }

    return NextResponse.json({
      success: true,
      invoice,
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
  { params }: { params: { orderCode: string; invoiceId: string } }
) {
  // Just call PATCH with status=cancelled
  const modifiedRequest = new Request(request.url, {
    method: "PATCH",
    headers: request.headers,
    body: JSON.stringify({ status: "cancelled" }),
  });

  return PATCH(modifiedRequest as NextRequest, { params });
}
