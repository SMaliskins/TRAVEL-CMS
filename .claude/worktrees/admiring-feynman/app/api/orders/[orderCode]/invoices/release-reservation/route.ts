import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * POST /api/orders/[orderCode]/invoices/release-reservation
 * Releases reserved invoice numbers for this order (e.g. user closed Create Invoice without saving).
 * Numbers return to the company pool for future reservations. Cancelled invoice numbers are unaffected.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ orderCode: string }> }
) {
  try {
    const { orderCode: rawOrderCode } = await params;
    const orderCode = decodeURIComponent(rawOrderCode);

    if (!orderCode) {
      return NextResponse.json({ error: "Order code is required" }, { status: 400 });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("order_code", orderCode)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const { error: updateError } = await supabaseAdmin
      .from("invoice_reservations")
      .update({ status: "released" })
      .eq("order_id", order.id)
      .eq("status", "reserved");

    if (updateError) {
      console.error("[Invoices API] release-reservation error:", updateError);
      return NextResponse.json({ error: "Failed to release reservation" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in release-reservation:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
