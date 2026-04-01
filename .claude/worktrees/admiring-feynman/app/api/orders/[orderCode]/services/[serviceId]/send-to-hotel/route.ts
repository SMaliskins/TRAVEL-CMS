import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/email/sendEmail";

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

    if (!to?.trim()) {
      return NextResponse.json({ error: "Email address is required" }, { status: 400 });
    }

    const user = await getUser(request);

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, company_id")
      .eq("order_code", orderCode)
      .single();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const htmlBody = (message || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");

    let signatureHtml = "";
    if (user?.id) {
      const { data: profile } = await supabaseAdmin
        .from("user_profiles")
        .select("email_signature")
        .eq("id", user.id)
        .single();
      if (profile?.email_signature) {
        signatureHtml = `<br><div style="margin-top:16px;padding-top:12px;border-top:1px solid #e5e7eb">${profile.email_signature}</div>`;
      }
    }

    const result = await sendEmail(
      to.trim(),
      subject || "Hotel reservation",
      `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#333">${htmlBody}${signatureHtml}</div>`,
      message,
      undefined,
      { companyId: order.company_id }
    );

    await supabaseAdmin.from("order_communications").insert({
      order_id: order.id,
      service_id: serviceId,
      type: "hotel_confirmation",
      recipient_email: to.trim(),
      subject: subject || "Hotel reservation",
      body: message,
      sent_at: new Date().toISOString(),
      sent_by: user?.id || null,
      email_sent: result.success,
      delivery_status: result.success ? "sent" : "failed",
      resend_email_id: result.success && "id" in result ? result.id : null,
    });

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
