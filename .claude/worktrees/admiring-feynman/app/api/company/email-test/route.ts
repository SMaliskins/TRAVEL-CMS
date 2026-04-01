import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, resolveEmailConfig } from "@/lib/email/sendEmail";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-key";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

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

/**
 * POST /api/company/email-test
 * Sends a test email using the company's own Resend API key.
 * Body: { email: string }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    const companyId = profile?.company_id;
    if (!companyId) {
      return NextResponse.json({ error: "User has no company assigned" }, { status: 400 });
    }

    const body = await request.json();
    const { email } = body;
    if (!email?.trim()) {
      return NextResponse.json({ error: "Email address is required" }, { status: 400 });
    }

    const { apiKey, from } = await resolveEmailConfig(companyId);
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: "No Resend API key configured for this company. Please add one in Company Settings.",
      }, { status: 400 });
    }

    const testHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Email Configuration Test</h2>
        <p>This is a test email from your Travel CMS company configuration.</p>
        <div style="background: #f0fdf4; border: 1px solid #86efac; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0; color: #166534; font-weight: 600;">Email is configured correctly!</p>
          <p style="margin: 8px 0 0 0; color: #15803d;">From: ${from}</p>
        </div>
        <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">
          This is an automated test from Travel CMS email configuration.
        </p>
      </div>
    `;

    const result = await sendEmail(
      email.trim(),
      "[Travel CMS] Email Configuration Test",
      testHtml,
      `Email Configuration Test - Email is configured correctly! From: ${from}`,
      undefined,
      { companyId }
    );

    if (!result.success) {
      const msg = result.reason === "no_api_key"
        ? "No API key available"
        : result.error || "Failed to send test email";
      return NextResponse.json({ success: false, error: msg }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${email.trim()}`,
      id: result.id,
    });
  } catch (error) {
    console.error("Email test error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
