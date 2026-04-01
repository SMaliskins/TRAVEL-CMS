import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * POST /api/webhooks/resend — Resend webhook for email events
 * Handles: email.delivered, email.opened, email.bounced, email.complained
 * Docs: https://resend.com/docs/dashboard/webhooks/introduction
 */
export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (webhookSecret) {
      const svixId = request.headers.get("svix-id");
      const svixTimestamp = request.headers.get("svix-timestamp");
      const svixSignature = request.headers.get("svix-signature");
      if (!svixId || !svixTimestamp || !svixSignature) {
        return NextResponse.json({ error: "Missing signature headers" }, { status: 401 });
      }
    }

    const payload = await request.json();
    const { type, data } = payload;

    if (!data?.email_id) {
      return NextResponse.json({ received: true });
    }

    const emailId = data.email_id as string;

    const { data: comm } = await supabaseAdmin
      .from("order_communications")
      .select("id, open_count")
      .eq("resend_email_id", emailId)
      .maybeSingle();

    if (!comm) {
      return NextResponse.json({ received: true, matched: false });
    }

    const updateData: Record<string, unknown> = {};

    switch (type) {
      case "email.delivered":
        updateData.delivery_status = "delivered";
        updateData.delivered_at = data.created_at || new Date().toISOString();
        break;
      case "email.opened":
        updateData.opened_at = data.created_at || new Date().toISOString();
        updateData.open_count = ((comm.open_count as number) || 0) + 1;
        break;
      case "email.bounced":
        updateData.delivery_status = "bounced";
        break;
      case "email.complained":
        updateData.delivery_status = "complained";
        break;
      default:
        return NextResponse.json({ received: true, type });
    }

    await supabaseAdmin
      .from("order_communications")
      .update(updateData)
      .eq("id", comm.id);

    return NextResponse.json({ received: true, updated: true });
  } catch (error) {
    console.error("Resend webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
