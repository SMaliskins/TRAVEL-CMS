import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/modules/checkModule";
import { checkAiUsageLimit } from "@/lib/ai/usageLimit";
import { getApiUser } from "@/lib/auth/getApiUser";
import { consumeRateLimit } from "@/lib/security/rateLimit";
import { parseFromRequest, parseErrorToStatus } from "@/lib/ai/parseWithAI";
import type { FlightTicketData } from "@/lib/ai/parseSchemas";
import { findSimilarTemplates, buildFewShotExamples, saveTemplate } from "@/lib/flights/parseTemplates";

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

function cloneJsonIntakeRequest(source: NextRequest, payload: Record<string, unknown>): NextRequest {
  const h = new Headers();
  h.set("Content-Type", "application/json");
  const auth = source.headers.get("authorization");
  if (auth) h.set("authorization", auth);
  const cookie = source.headers.get("cookie");
  if (cookie) h.set("cookie", cookie);
  return new NextRequest(source.url, {
    method: "POST",
    headers: h,
    body: JSON.stringify(payload),
  });
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
    const contentType = request.headers.get("content-type") || "";
    let intakeRequest: NextRequest = request;
    let userFeedback: string | undefined;
    // Captured original text (when available) so we can: (1) seed few-shot
    // examples from similar previously-parsed tickets, (2) save the result
    // back as a template after a high-confidence parse.
    let originalText: string | undefined;

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as {
        text?: string;
        image?: string;
        mimeType?: string;
        feedback?: string;
      };
      const fb = typeof body.feedback === "string" ? body.feedback.trim() : "";
      userFeedback = fb || undefined;

      if (body.text) {
        originalText = body.text;
        intakeRequest = cloneJsonIntakeRequest(request, { text: body.text });
      } else if (body.image) {
        intakeRequest = cloneJsonIntakeRequest(request, {
          image: body.image,
          mimeType: body.mimeType || "image/png",
        });
      } else {
        return NextResponse.json(
          { error: "JSON body must include \"text\" or \"image\"", segments: [], booking: null },
          { status: 400 }
        );
      }
    } else if (contentType.includes("multipart/form-data")) {
      const fd = await request.formData();
      const rawFb = fd.get("feedback");
      const fb = typeof rawFb === "string" ? rawFb.trim() : "";
      userFeedback = fb || undefined;
      const file = fd.get("file");
      if (!file || !(file instanceof File)) {
        return NextResponse.json(
          { error: "Multipart request requires file field", segments: [], booking: null },
          { status: 400 }
        );
      }
      const newFd = new FormData();
      newFd.append("file", file);
      intakeRequest = new NextRequest(request.url, { method: "POST", body: newFd });
    }

    // Look up structurally-similar prior tickets and build a few-shot block.
    // Only attempted for text input (where we can fingerprint cheaply).
    let fewShotExamples: string | undefined;
    if (originalText) {
      try {
        const templates = await findSimilarTemplates(originalText, authInfo.companyId);
        if (templates.length > 0) {
          fewShotExamples = buildFewShotExamples(templates);
        }
      } catch (e) {
        console.warn("[parse-flight] template lookup failed:", e);
      }
    }

    const result = await parseFromRequest<FlightTicketData>(
      intakeRequest,
      "flight_ticket",
      authInfo.companyId,
      authInfo.userId,
      userFeedback,
      fewShotExamples ? { fewShotExamples } : undefined,
    );

    if (!result.success || !result.data) {
      return NextResponse.json(
        {
          error: result.error || "Could not extract flight information",
          warnings: result.warnings,
          segments: [],
          booking: null,
        },
        { status: parseErrorToStatus(result.errorCode) },
      );
    }

    const parsed = result.data;
    const booking = parsed.booking || {};

    // Map parsed segments to the response shape used by the UI.
    // We pass through values exactly as the model returned them (with `?? ""`
    // only to keep the response shape stable). Previously the mapper hard-cleared
    // `seat`, terminals and `aircraft` even when the model had captured them,
    // which forced users to re-enter the data manually.
    const segments: FlightSegment[] = (parsed.segments || []).map((seg, index) => {
      const segAny = seg as typeof seg & {
        departureTerminal?: string;
        arrivalTerminal?: string;
        seat?: string;
        aircraft?: string;
        bookingRef?: string;
      };
      return {
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
        departureTerminal: segAny.departureTerminal || "",
        arrivalTerminal: segAny.arrivalTerminal || "",
        cabinClass: seg.cabinClass || booking.cabinClass || "",
        bookingClass: seg.bookingClass || "",
        // Per-segment bookingRef wins over the booking-level one (split tickets).
        bookingRef: segAny.bookingRef || booking.bookingRef || "",
        ticketNumber: seg.ticketNumber || "",
        baggage: seg.baggage || booking.baggage || "",
        seat: segAny.seat || "",
        passengerName: seg.passengerName || "",
        aircraft: segAny.aircraft || "",
        departureStatus: "scheduled",
        arrivalStatus: "scheduled",
      };
    });

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

    // Auto-save high-confidence text-based parses as future few-shot
    // templates. Skipped for image/PDF (no text fingerprint available)
    // and for results below the confidence floor.
    if (originalText && result.confidence >= 0.85 && segments.length > 0) {
      try {
        await saveTemplate(
          originalText,
          { booking: responseBooking, segments },
          "ai",
          authInfo.companyId,
        );
      } catch (e) {
        console.warn("[parse-flight] template save failed:", e);
      }
    }

    return NextResponse.json({ segments, booking: responseBooking });
  } catch (err) {
    console.error("Parse flight itinerary error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
