import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeEmailToField, sendEmail } from "@/lib/email/sendEmail";
import { replaceBase64Images } from "@/lib/email/replaceBase64Images";
import { loadDefaultEmailTemplateForCategory } from "@/lib/email/emailTemplateUtils";
import { appendHtmlWithEmailSignature } from "@/lib/email/appendUserEmailSignature";
import { fetchOrderIdentityByRouteParam } from "@/lib/orders/orderFromRouteParam";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

async function getUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await authClient.auth.getUser(token);
    if (!error && data?.user) return data.user;
  }
  const cookieHeader = request.headers.get("cookie") || "";
  if (cookieHeader) {
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Cookie: cookieHeader } },
    });
    const { data, error } = await authClient.auth.getUser();
    if (!error && data?.user) return data.user;
  }
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string; serviceId: string }> }
) {
  try {
    const { orderCode, serviceId } = await params;
    const body = await request.json();
    const { to, subject, message } = body;

    const toNormalized = normalizeEmailToField(to || "");
    if (!toNormalized) {
      return NextResponse.json({ error: "Email address is required" }, { status: 400 });
    }

    const user = await getUser(request);

    // Slug-aware lookup: URL param may be slug form (`0113-26-sm`) while DB
    // stores the canonical code with a slash (`0113/26-SM`).
    const order = await fetchOrderIdentityByRouteParam(supabaseAdmin, orderCode);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const htmlBody = (message || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");

    const tpl = await loadDefaultEmailTemplateForCategory(order.company_id, "hotel");
    const innerDiv = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#333">${htmlBody}</div>`;
    const withSignature = await appendHtmlWithEmailSignature(innerDiv, {
      source: tpl?.email_signature_source ?? "personal",
      userId: user?.id,
      companyId: order.company_id,
    });
    const finalEmailHtml = await replaceBase64Images(withSignature);

    const result = await sendEmail(
      toNormalized,
      subject || "Hotel reservation",
      finalEmailHtml,
      message,
      undefined,
      { companyId: order.company_id }
    );

    const { error: commInsertError } = await supabaseAdmin.from("order_communications").insert({
      company_id: order.company_id,
      order_id: order.id,
      service_id: serviceId,
      type: "hotel_confirmation",
      recipient_email: toNormalized,
      subject: subject || "Hotel reservation",
      body: message,
      sent_at: new Date().toISOString(),
      sent_by: user?.id || null,
      email_sent: result.success,
      delivery_status: result.success ? "sent" : "failed",
      resend_email_id: result.success && "id" in result ? result.id : null,
    });
    if (commInsertError) {
      console.error("[send-to-hotel] order_communications insert failed:", commInsertError);
    }

    if (!result.success) {
      if (result.reason === "no_api_key") {
        return NextResponse.json(
          { error: "Email not configured. Add a Resend API key in Company Settings." },
          { status: 422 }
        );
      }
      return NextResponse.json(
        { error: `Failed to send email: ${result.error || result.reason}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, emailId: result.id });
  } catch (error) {
    console.error("Send to hotel error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
