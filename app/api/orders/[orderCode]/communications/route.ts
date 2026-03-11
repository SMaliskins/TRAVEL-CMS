import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string }> }
) {
  try {
    const { orderCode } = await params;

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("order_code", orderCode)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const { data: communications, error } = await supabaseAdmin
      .from("order_communications")
      .select(`
        id,
        type,
        recipient_email,
        subject,
        body,
        sent_at,
        sent_by,
        email_sent,
        delivery_status,
        delivered_at,
        opened_at,
        open_count,
        invoice_id,
        service_id,
        resend_email_id
      `)
      .eq("order_id", order.id)
      .order("sent_at", { ascending: false });

    if (error) {
      console.error("Error fetching communications:", error);
      return NextResponse.json({ error: "Failed to fetch communications" }, { status: 500 });
    }

    const senderIds = [...new Set(
      (communications || []).map(c => c.sent_by).filter(Boolean)
    )];
    let senderMap: Record<string, string> = {};
    if (senderIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("user_profiles")
        .select("id, first_name, last_name")
        .in("id", senderIds);
      if (profiles) {
        senderMap = Object.fromEntries(
          profiles.map(p => [p.id, `${p.first_name || ""} ${p.last_name || ""}`.trim()])
        );
      }
    }

    const enriched = (communications || []).map(c => ({
      ...c,
      sender_name: c.sent_by ? senderMap[c.sent_by] || "Unknown" : null,
    }));

    return NextResponse.json({ communications: enriched });
  } catch (error) {
    console.error("Communications GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
