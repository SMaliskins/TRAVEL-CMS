import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/modules/checkModule";
import { checkAiUsageLimit } from "@/lib/ai/usageLimit";
import { getApiUser } from "@/lib/auth/getApiUser";
import { consumeRateLimit } from "@/lib/security/rateLimit";
import { parseFromRequest } from "@/lib/ai/parseWithAI";
import type { FlightTicketData } from "@/lib/ai/parseSchemas";

/**
 * AI-powered flight itinerary parsing
 *
 * Supports: Image, PDF, text input
 * Uses unified parsing pipeline (lib/ai/parseWithAI.ts).
 */

interface FlightSegment {
  id: string;
  flightNumber: string;
  airline?: string;
  departure: string;
  departureCity?: string;
  departureCountry?: string;
  arrival: string;
  arrivalCity?: string;
  arrivalCountry?: string;
  departureDate: string;
  departureTimeScheduled: string;
  departureTimeActual?: string;
  arrivalDate: string;
  arrivalTimeScheduled: string;
  arrivalTimeActual?: string;
  duration?: string;
  departureTerminal?: string;
  arrivalTerminal?: string;
  cabinClass?: string;
  bookingClass?: string;
  bookingRef?: string;
  ticketNumber?: string;
  baggage?: string;
  seat?: string;
  passengerName?: string;
  aircraft?: string;
  departureStatus: string;
  arrivalStatus: string;
}

/** Fix AI year bias: if model returns 2024 but current year is later, fix it */
function fixYear(d: string): string {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const y = parseInt(d.slice(0, 4), 10);
  const currentYear = new Date().getFullYear();
  if (y === 2024 && currentYear > 2024) return `${currentYear}-${d.slice(5)}`;
  return d;
}

export async function POST(request: NextRequest) {
  const authInfo = await getApiUser(request);
  if (!authInfo) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = consumeRateLimit({
    bucket: "ai-parse-flight-itinerary",
    key: authInfo.userId,
    limit: 12,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  if (process.env.NODE_ENV === "production") {
    const moduleError = await requireModule(authInfo.companyId, "ai_parsing");
    if (moduleError) {
      return NextResponse.json({ error: moduleError.error }, { status: moduleError.status });
    }
  }

  const usage = await checkAiUsageLimit(authInfo.companyId);
  if (!usage.allowed) {
    return NextResponse.json(
      { error: `AI usage limit reached (${usage.used}/${usage.limit} calls this month). Upgrade your plan or purchase an AI add-on.` },
      { status: 429 }
    );
  }

  try {
    const result = await parseFromRequest<FlightTicketData>(
      request,
      "flight_ticket",
      authInfo.companyId,
      authInfo.userId
    );

    if (!result.success || !result.data) {
      return NextResponse.json({
        error: result.error || "Could not extract flight information",
        segments: [],
        booking: null,
      });
    }

    const parsed = result.data;
    const booking = parsed.booking || {};

    // Map to legacy response format with year-fix post-processing
    const segments: FlightSegment[] = (parsed.segments || []).map(
      (seg, index) => ({
        id: `seg-${Date.now()}-${index}`,
        flightNumber: seg.flightNumber || "",
        airline: seg.airline || booking.airline || "",
        departure: seg.departure || "",
        departureCity: seg.departureCity || "",
        departureCountry: seg.departureCountry || "",
        arrival: seg.arrival || "",
        arrivalCity: seg.arrivalCity || "",
        arrivalCountry: seg.arrivalCountry || "",
        departureDate: fixYear(seg.departureDate || ""),
        departureTimeScheduled: seg.departureTimeScheduled || "",
        departureTimeActual: "",
        arrivalDate: fixYear(seg.arrivalDate || seg.departureDate || ""),
        arrivalTimeScheduled: seg.arrivalTimeScheduled || "",
        arrivalTimeActual: "",
        duration: seg.duration || "",
        departureTerminal: "",
        arrivalTerminal: "",
        cabinClass: seg.cabinClass || booking.cabinClass || "",
        bookingClass: seg.bookingClass || "",
        bookingRef: booking.bookingRef || "",
        ticketNumber: seg.ticketNumber || "",
        baggage: seg.baggage || booking.baggage || "",
        seat: "",
        passengerName: seg.passengerName || "",
        aircraft: "",
        departureStatus: "scheduled",
        arrivalStatus: "scheduled",
      })
    );

    const responseBooking = {
      bookingRef: booking.bookingRef || "",
      airline: booking.airline || "",
      totalPrice: booking.totalPrice || null,
      currency: booking.currency || "EUR",
      ticketNumbers: booking.ticketNumbers || [],
      passengers: booking.passengers || [],
      cabinClass: booking.cabinClass || "economy",
      refundPolicy: booking.refundPolicy || "non_ref",
      changeFee: booking.changeFee || null,
      baggage: booking.baggage || "",
    };

    return NextResponse.json({ segments, booking: responseBooking });
  } catch (err) {
    console.error("Parse flight itinerary error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
