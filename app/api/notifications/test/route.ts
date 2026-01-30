import { NextResponse } from "next/server";

// Test endpoint to send a test check-in notification email
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    
    if (!resendApiKey) {
      return NextResponse.json({ 
        success: false, 
        error: "RESEND_API_KEY not configured",
        message: "Add RESEND_API_KEY to .env.local to enable email notifications"
      }, { status: 400 });
    }

    // Send test email
    const testHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">✈️ Check-in Notification Test</h2>
        <p>This is a test email from Travel CMS.</p>
        
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #059669;">Check-in is NOW OPEN!</h3>
          <table style="width: 100%;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Flight:</td>
              <td style="padding: 8px 0; font-weight: bold;">BA353</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Booking Ref:</td>
              <td style="padding: 8px 0; font-weight: bold;">XYNRKB</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Passenger:</td>
              <td style="padding: 8px 0; font-weight: bold;">Test Passenger</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Departure:</td>
              <td style="padding: 8px 0; font-weight: bold;">25 Jan 2026 07:35</td>
            </tr>
          </table>
        </div>
        
        <a href="https://www.britishairways.com/travel/olcilandingpageauthreq/public/en_gb/" 
           style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0;">
          Check-in Now →
        </a>
        
        <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
          This is an automated test notification from Travel CMS.
        </p>
      </div>
    `;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Travel CMS <onboarding@resend.dev>",
        to: [email],
        subject: "✈️ [TEST] Check-in NOW OPEN - BA353 - Test Passenger",
        html: testHtml,
        text: "Check-in is NOW OPEN for flight BA353. Booking Ref: XYNRKB. Passenger: Test Passenger.",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Failed to send test email:", error);
      return NextResponse.json({ 
        success: false, 
        error: "Failed to send email",
        details: error
      }, { status: 500 });
    }

    const result = await response.json();
    return NextResponse.json({ 
      success: true, 
      message: `Test email sent to ${email}`,
      emailId: result.id
    });

  } catch (error) {
    console.error("Test notification error:", error);
    return NextResponse.json({ error: "Failed to send test notification" }, { status: 500 });
  }
}

// GET - check if email is configured
export async function GET() {
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;
  
  return NextResponse.json({
    configured: !!resendApiKey,
    from: emailFrom || "not set (using default)",
    message: resendApiKey 
      ? "Email notifications are configured" 
      : "Add RESEND_API_KEY to .env.local to enable email notifications"
  });
}
