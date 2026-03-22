import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/email/sendEmail";

async function getUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const { createClient } = await import("@supabase/supabase-js");
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

/**
 * POST /api/orders/[orderCode]/boarding-passes/send-email
 * Body: { to: string, subject: string, message: string, attachments: { fileName: string, url: string }[] }
 * Fetches each attachment URL, then sends email via Resend (same as invoice email).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string }> }
) {
  try {
    const { orderCode } = await params;
    const body = await request.json();
    const { to, subject, message, attachments } = body as {
      to?: string;
      subject?: string;
      message?: string;
      attachments?: { fileName: string; url: string }[];
    };

    if (!to || !String(to).trim()) {
      return NextResponse.json({ error: "Email address is required" }, { status: 400 });
    }
    if (!attachments?.length) {
      return NextResponse.json({ error: "At least one boarding pass attachment is required" }, { status: 400 });
    }

    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, company_id")
      .eq("order_code", orderCode)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const companyId = (order as { company_id?: string }).company_id ?? null;
    const orderId = (order as { id?: string }).id ?? null;

    const attachmentBuffers: { filename: string; content: Buffer }[] = [];
    for (const att of attachments.slice(0, 20)) {
      const url = att?.url;
      const fileName = att?.fileName || "boarding-pass.pdf";
      if (!url) continue;
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) continue;
        const arrayBuffer = await res.arrayBuffer();
        attachmentBuffers.push({
          filename: fileName,
          content: Buffer.from(arrayBuffer),
        });
      } catch (e) {
        console.warn("Failed to fetch attachment:", fileName, e);
      }
    }

    if (attachmentBuffers.length === 0) {
      return NextResponse.json(
        { error: "Could not fetch any attachment. Check that the links are valid." },
        { status: 400 }
      );
    }

    const emailSubject = (subject && String(subject).trim()) || "Boarding passes";
    const emailHtml = (message && String(message).trim())
      ? `<p>${String(message).replace(/\n/g, "<br>")}</p><p style="margin-top:12px;color:#6b7280">Boarding pass(es) attached.</p>`
      : "<p>Please find your boarding pass(es) attached.</p>";

    const result = await sendEmail(
      String(to).trim(),
      emailSubject,
      emailHtml,
      undefined,
      attachmentBuffers,
      { companyId: companyId || undefined }
    );

    if (!result.success) {
      const msg =
        result.reason === "no_api_key"
          ? "Email is not configured (RESEND_API_KEY missing)."
          : result.error || "Failed to send email.";
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    if (orderId && companyId) {
      await supabaseAdmin.from("order_communications").insert({
        company_id: companyId,
        order_id: orderId,
        type: "to_client",
        recipient_email: String(to).trim(),
        subject: emailSubject,
        body: (message && String(message).trim()) || "Boarding passes",
        sent_by: user.id,
        email_sent: true,
        resend_email_id: result.id ?? null,
        delivery_status: "sent",
      }).then(({ error: commError }) => {
        if (commError) console.error("Failed to log BP email communication:", commError);
      });
    }

    return NextResponse.json({
      success: true,
      message: "Email sent successfully",
      id: result.id,
    });
  } catch (error) {
    console.error("Boarding passes send-email error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
