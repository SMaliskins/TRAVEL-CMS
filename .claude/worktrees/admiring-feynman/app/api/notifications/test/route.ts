import { NextResponse } from "next/server";
import { sendEmail, resolveEmailConfig } from "@/lib/email/sendEmail";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, companyId } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const { apiKey } = await resolveEmailConfig(companyId);

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: "No Resend API key configured",
        message: "Configure a Resend API key in Company Settings or set RESEND_API_KEY in .env.local",
      }, { status: 400 });
    }

    const testHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Check-in Notification Test</h2>
        <p>This is a test email from Travel CMS.</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #059669;">Check-in is NOW OPEN!</h3>
          <table style="width: 100%;">
            <tr><td style="padding: 8px 0; color: #6b7280;">Flight:</td><td style="padding: 8px 0; font-weight: bold;">BA353</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;">Booking Ref:</td><td style="padding: 8px 0; font-weight: bold;">XYNRKB</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;">Passenger:</td><td style="padding: 8px 0; font-weight: bold;">Test Passenger</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;">Departure:</td><td style="padding: 8px 0; font-weight: bold;">25 Jan 2026 07:35</td></tr>
          </table>
        </div>
        <a href="https://www.britishairways.com/travel/olcilandingpageauthreq/public/en_gb/"
           style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0;">
          Check-in Now
        </a>
        <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
          This is an automated test notification from Travel CMS.
        </p>
      </div>
    `;

    const result = await sendEmail(
      email,
      "[TEST] Check-in NOW OPEN - BA353 - Test Passenger",
      testHtml,
      "Check-in is NOW OPEN for flight BA353. Booking Ref: XYNRKB. Passenger: Test Passenger.",
      undefined,
      { companyId }
    );

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || "Failed to send email",
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${email}`,
      emailId: result.id,
    });
  } catch (error) {
    console.error("Test notification error:", error);
    return NextResponse.json({ error: "Failed to send test notification" }, { status: 500 });
  }
}

export async function GET() {
  const hasGlobalKey = !!process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;

  return NextResponse.json({
    configured: hasGlobalKey,
    from: emailFrom || "not set (using default)",
    message: hasGlobalKey
      ? "Global fallback email key is configured"
      : "No global RESEND_API_KEY set. Companies must configure their own key in Company Settings.",
  });
}
