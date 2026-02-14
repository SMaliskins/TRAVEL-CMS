import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { formatCheckinEmailData } from "@/lib/notifications/checkinNotifications";
import { getCheckinUrl } from "@/lib/flights/airlineCheckin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-key";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

// Email sending via Resend (or other provider)
async function sendEmail(to: string, subject: string, html: string, text: string) {
  // Check if we have Resend API key
  const resendApiKey = process.env.RESEND_API_KEY;
  
  if (!resendApiKey) {
    console.log("RESEND_API_KEY not set, skipping email send");
    console.log("Would send email to:", to);
    console.log("Subject:", subject);
    return { success: false, reason: "no_api_key" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Travel CMS <noreply@travel-cms.com>",
        to: [to],
        subject,
        html,
        text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Failed to send email:", error);
      return { success: false, reason: "api_error", error };
    }

    const result = await response.json();
    return { success: true, id: result.id };
  } catch (error) {
    console.error("Email send error:", error);
    return { success: false, reason: "exception", error };
  }
}

export async function POST(request: Request) {
  try {
    // Get user from auth header or session
    const authHeader = request.headers.get("authorization");
    let userId: string | null = null;
    
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      userId = user?.id || null;
    }
    
    // For internal calls, allow without auth
    // In production, you may want stricter auth
    if (!userId) {
      // Try to get from cookie/session if needed, for now allow
      console.log("Notification request without auth");
    }

    const body = await request.json();
    const { 
      flightNumber, 
      departureDateTime, 
      bookingRef, 
      clientName,
      agentEmail,
      notificationType, // "checkin_open" | "checkin_reminder"
      locale = "en", // "en" | "ru" | "lv"
    } = body;

    if (!flightNumber || !departureDateTime || !bookingRef || !clientName || !agentEmail) {
      return NextResponse.json({ 
        error: "Missing required fields: flightNumber, departureDateTime, bookingRef, clientName, agentEmail" 
      }, { status: 400 });
    }

    // Get check-in URL for this airline
    const checkinUrl = getCheckinUrl(flightNumber);
    
    if (!checkinUrl) {
      return NextResponse.json({ 
        error: "No check-in URL found for this airline" 
      }, { status: 400 });
    }

    // Format email content with locale
    const emailData = formatCheckinEmailData({
      flightNumber,
      departureDateTime,
      bookingRef,
      clientName,
      agentEmail,
      checkinUrl,
      locale: locale as "en" | "ru" | "lv",
    });

    // Send email to agent
    const emailResult = await sendEmail(
      agentEmail,
      emailData.subject,
      emailData.html,
      emailData.text
    );

    // Log the notification (only if we have userId and table exists)
    if (userId) {
      try {
        await supabaseAdmin.from("notification_log").insert({
          type: notificationType || "checkin_open",
          recipient_email: agentEmail,
          flight_number: flightNumber,
          booking_ref: bookingRef,
          client_name: clientName,
          departure_time: departureDateTime,
          sent_at: new Date().toISOString(),
          sent_by: userId,
          email_sent: emailResult.success,
        });
      } catch (logError) {
        console.log("Failed to log notification (table may not exist yet):", logError);
      }
    }

    return NextResponse.json({ 
      success: true, 
      emailSent: emailResult.success,
      checkinUrl,
    });

  } catch (error) {
    console.error("Checkin notification error:", error);
    return NextResponse.json({ 
      error: "Failed to send notification" 
    }, { status: 500 });
  }
}

// GET: Check upcoming check-ins for notifications
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const hoursAhead = parseInt(searchParams.get("hours") || "24");

    // Get flights with check-in opening in the next X hours
    const now = new Date();
    const cutoff = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

    // Query services with upcoming flights
    const { data: services, error } = await supabaseAdmin
      .from("order_services")
      .select(`
        id,
        ref_nr,
        flight_segments,
        ticket_numbers,
        orders!inner(
          order_code,
          agent_id
        )
      `)
      .eq("category", "Flight")
      .eq("res_status", "confirmed")
      .gte("date_from", now.toISOString().split("T")[0])
      .lte("date_from", cutoff.toISOString().split("T")[0]);

    if (error) {
      console.error("Error fetching upcoming flights:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    // Filter to flights where check-in is about to open
    const upcomingCheckins = [];
    
    for (const service of services || []) {
      const segments = service.flight_segments as Array<{
        flightNumber: string;
        departureDate: string;
        departureTimeScheduled: string;
      }> | null;
      
      if (!segments || segments.length === 0) continue;
      
      // Check first segment
      const firstSegment = segments[0];
      const depDateTime = `${firstSegment.departureDate}T${firstSegment.departureTimeScheduled}`;
      
      // Get order info (orders is an array from the join)
      const ordersArray = service.orders as Array<{ order_code: string; agent_id: string }> | null;
      const orderInfo = ordersArray?.[0];
      
      upcomingCheckins.push({
        serviceId: service.id,
        bookingRef: service.ref_nr,
        flightNumber: firstSegment.flightNumber,
        departureDateTime: depDateTime,
        ticketNumbers: service.ticket_numbers,
        orderCode: orderInfo?.order_code,
        agentId: orderInfo?.agent_id,
      });
    }

    return NextResponse.json({ 
      upcomingCheckins,
      count: upcomingCheckins.length,
    });

  } catch (error) {
    console.error("Get upcoming checkins error:", error);
    return NextResponse.json({ 
      error: "Failed to fetch upcoming check-ins" 
    }, { status: 500 });
  }
}
