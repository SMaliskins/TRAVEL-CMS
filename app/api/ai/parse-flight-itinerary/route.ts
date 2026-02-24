import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAiUsage } from "@/lib/aiUsageLogger";
import { requireModule } from "@/lib/modules/checkModule";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function getAuthInfo(request: NextRequest): Promise<{ userId: string; companyId: string } | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  
  const token = authHeader.replace("Bearer ", "");
  const authClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user) return null;
  
  const userId = data.user.id;
  const adminClient = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
  const { data: profile } = await adminClient
    .from("profiles")
    .select("company_id")
    .eq("user_id", userId)
    .single();
  
  if (!profile?.company_id) return null;
  return { userId, companyId: profile.company_id };
}

// Dynamic import for pdf-parse to avoid ESM issues
async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdf = require("pdf-parse");
    const data = await pdf(buffer);
    return data.text || "";
  } catch (err) {
    console.error("PDF extraction error:", err);
    throw err;
  }
}

/**
 * AI-powered flight itinerary parsing
 * 
 * Supports:
 * - Image upload (base64 or FormData)
 * - PDF upload (FormData) - extracts text first, then parses
 * - Text parsing (JSON body)
 * 
 * Expected FormData:
 *   file: File (image or PDF)
 *   type: "image" | "pdf" (optional, auto-detected)
 * 
 * Expected JSON body:
 *   { image: string (base64), mimeType: string }
 *   OR
 *   { text: string }
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
  cabinClass?: "economy" | "premium_economy" | "business" | "first";
  bookingClass?: string;
  bookingRef?: string;
  ticketNumber?: string;
  baggage?: string;
  seat?: string;
  passengerName?: string;
  aircraft?: string;
  departureStatus: "scheduled" | "on_time" | "delayed" | "cancelled" | "landed";
  arrivalStatus: "scheduled" | "on_time" | "delayed" | "cancelled" | "landed";
}

function getSystemPrompt(): string {
  const currentYear = new Date().getFullYear();
  return `You are a flight itinerary parser for a travel agency CRM. Extract ALL flight and booking information from images of tickets, boarding passes, booking confirmations, emails, or PDFs.

Return a JSON object with this structure:
{
  "booking": {
    "bookingRef": "XYNRKB",
    "airline": "British Airways",
    "totalPrice": 420.76,
    "currency": "EUR",
    "ticketNumbers": ["125-2227796422", "125-2227796423"],
    "passengers": [
      { "name": "Frederic Piano", "ticketNumber": "125-2227796422" },
      { "name": "Marie Piano", "ticketNumber": "125-2227796423" }
    ],
    "cabinClass": "economy",
    "refundPolicy": "non_ref",
    "changeFee": null,
    "baggage": "1 cabin bag, 1 small handbag"
  },
  "segments": [
    {
      "flightNumber": "BA353",
      "airline": "British Airways",
      "departure": "NCE",
      "departureCity": "Nice",
      "departureCountry": "FR",
      "arrival": "LHR",
      "arrivalCity": "London",
      "arrivalCountry": "GB",
      "departureDate": "${currentYear}-01-25",
      "departureTimeScheduled": "07:35",
      "arrivalDate": "${currentYear}-01-25",
      "arrivalTimeScheduled": "08:55",
      "duration": "2h 20m",
      "departureTerminal": "1",
      "arrivalTerminal": "5",
      "cabinClass": "economy",
      "bookingClass": "Y",
      "baggage": "1 cabin bag"
    }
  ]
}

Rules:
- CRITICAL — Year for dates: Use ONLY the year explicitly shown on the document. If the document shows only day and month (e.g. "23 MAR", "23.03", "25 Jan") and no year is visible, use the current calendar year ${currentYear}. NEVER use 2024 or any past year unless that exact year is clearly printed on the document.
- CRITICAL — Route: You MUST extract the full route. Return at least one segment per flight leg. Each segment MUST have: departure (IATA 3-letter code, e.g. RIX, NCE), arrival (IATA code), departureCity, arrivalCity, departureDate (YYYY-MM-DD), departureTimeScheduled (HH:mm), arrivalDate, arrivalTimeScheduled. Without segments the route cannot be displayed.
- CRITICAL — Passengers: Extract ALL passengers. If the ticket shows 2 or more passengers, return ALL of them in booking.passengers (each with name and optional ticketNumber). Do not return only one passenger when multiple are on the document.
- Extract EVERYTHING: booking reference, ticket numbers, prices, passenger names, baggage allowance
- Use IATA airport codes (3 letters) for departure/arrival
- Use ISO country codes (2 letters) for countries
- Dates in YYYY-MM-DD format
- Times in HH:mm format (24-hour)
- If arrival is next day, use the correct arrival date
- Calculate duration from times if not shown
- cabinClass: "economy", "premium_economy", "business", or "first"
- refundPolicy: "non_ref" (non-refundable), "refundable" (with conditions), "fully_ref" (fully refundable)
- Look for keywords: "Nonref", "Non-refundable", "Refundable", "Free cancellation"
- Extract total price with taxes
- Match ticket numbers to passenger names when possible
- Only return valid JSON, no other text`;
}

export async function POST(request: NextRequest) {
  // Get auth info for usage logging and module check
  const authInfo = await getAuthInfo(request);
  
  // Check if company has ai_parsing module (skip in development for easier testing)
  if (authInfo && process.env.NODE_ENV === "production") {
    const moduleError = await requireModule(authInfo.companyId, "ai_parsing");
    if (moduleError) {
      return NextResponse.json({ error: moduleError.error }, { status: moduleError.status });
    }
  }
  
  try {
    const contentType = request.headers.get("content-type") || "";
    
    let imageBase64: string | null = null;
    let mimeType: string = "image/png";
    let textContent: string | null = null;
    let isPDF = false;
    let inputType: "pdf" | "image" | "text" = "text";

    // Handle FormData (file upload)
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      
      if (!file) {
        return NextResponse.json(
          { error: "File is required" },
          { status: 400 }
        );
      }
      
      mimeType = file.type;
      isPDF = file.type === "application/pdf";
      
      if (isPDF) {
        inputType = "pdf";
        // Extract text from PDF using pdf-parse
        try {
          const buffer = await file.arrayBuffer();
          textContent = await extractPdfText(Buffer.from(buffer));
          console.log("Extracted PDF text:", textContent?.substring(0, 500));
        } catch (pdfError) {
          console.error("PDF parsing error:", pdfError);
          return NextResponse.json(
            { error: "Failed to extract text from PDF. Please try pasting the text directly.", segments: [] },
            { status: 400 }
          );
        }
      } else if (file.type.startsWith("image/")) {
        const buffer = await file.arrayBuffer();
        imageBase64 = Buffer.from(buffer).toString("base64");
        inputType = "image";
      } else {
        return NextResponse.json(
          { error: "Unsupported file type. Please upload an image or PDF." },
          { status: 400 }
        );
      }
    } else {
      // Handle JSON body
      const body = await request.json();
      
      if (body.text) {
        textContent = body.text;
      } else if (body.image) {
        imageBase64 = body.image;
        mimeType = body.mimeType || "image/png";
      } else {
        return NextResponse.json(
          { error: "Image or text is required" },
          { status: 400 }
        );
      }
    }

    // Check if OpenAI API key is configured
    const openaiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiKey) {
      return NextResponse.json(
        { error: "AI parsing not configured. Please add OPENAI_API_KEY to environment.", segments: [] },
        { status: 503 }
      );
    }

    try {
      let messages;
      
      if (textContent) {
        // Text-based parsing
        messages = [
          {
            role: "system",
            content: getSystemPrompt(),
          },
          {
            role: "user",
            content: `Parse this flight booking text and extract all flight segments:\n\n${textContent}`,
          },
        ];
      } else if (isPDF) {
        // PDF parsing - GPT-4V can process PDFs as images
        // For complex PDFs, consider extracting text first
        messages = [
          {
            role: "system",
            content: getSystemPrompt(),
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                },
              },
              {
                type: "text",
                text: "This is a PDF document containing flight booking information. Extract all flight segments from it. Return JSON only.",
              },
            ],
          },
        ];
      } else {
        // Image parsing
        messages = [
          {
            role: "system",
            content: getSystemPrompt(),
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                },
              },
              {
                type: "text",
                text: "Extract all flight segments from this image. Return JSON only.",
              },
            ],
          },
        ];
      }

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages,
          max_tokens: 2000,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("OpenAI API error:", errorData);
        return NextResponse.json(
          { error: "AI parsing failed", details: errorData, segments: [] },
          { status: 500 }
        );
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";
      const usage = data.usage || {};

      // Log AI usage for billing
      if (authInfo) {
        await logAiUsage({
          companyId: authInfo.companyId,
          userId: authInfo.userId,
          operation: "parse_flight",
          model: "gpt-4o",
          inputTokens: usage.prompt_tokens || 0,
          outputTokens: usage.completion_tokens || 0,
          totalTokens: usage.total_tokens || 0,
          success: true,
          metadata: { inputType },
        });
      }

      // Parse JSON from response
      try {
        // Try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          
          // Extract booking-level info
          const booking = parsed.booking || {};
          const currentYear = new Date().getFullYear();
          // If AI returned 2024 but we're past that, fix dates (model bias)
          const fixYear = (d: string) => {
            if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
            const y = parseInt(d.slice(0, 4), 10);
            if (y === 2024 && currentYear > 2024) return `${currentYear}-${d.slice(5)}`;
            return d;
          };
          
          const segments: FlightSegment[] = (parsed.segments || []).map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (seg: any, index: number) => {
              const depDate = fixYear(seg.departureDate || "");
              const arrDate = fixYear(seg.arrivalDate || seg.departureDate || "");
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
              departureDate: depDate,
              departureTimeScheduled: seg.departureTimeScheduled || seg.departureTime || "",
              departureTimeActual: seg.departureTimeActual || "",
              arrivalDate: arrDate,
              arrivalTimeScheduled: seg.arrivalTimeScheduled || seg.arrivalTime || "",
              arrivalTimeActual: seg.arrivalTimeActual || "",
              duration: seg.duration || "",
              departureTerminal: seg.departureTerminal || "",
              arrivalTerminal: seg.arrivalTerminal || "",
              cabinClass: seg.cabinClass || booking.cabinClass || "",
              bookingClass: seg.bookingClass || "",
              bookingRef: seg.bookingRef || booking.bookingRef || "",
              ticketNumber: seg.ticketNumber || "",
              baggage: seg.baggage || booking.baggage || "",
              seat: seg.seat || "",
              passengerName: seg.passengerName || "",
              aircraft: seg.aircraft || "",
              departureStatus: "scheduled",
              arrivalStatus: "scheduled",
            };
            }
          );

          return NextResponse.json({ 
            segments,
            booking: {
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
            }
          });
        }
      } catch (parseErr) {
        console.error("Failed to parse AI response:", parseErr, "Content:", content);
      }

      return NextResponse.json({ 
        error: "Could not extract flight information",
        segments: [],
        booking: null
      });
    } catch (aiError) {
      console.error("OpenAI API call failed:", aiError);
      // Log failed usage
      if (authInfo) {
        await logAiUsage({
          companyId: authInfo.companyId,
          userId: authInfo.userId,
          operation: "parse_flight",
          model: "gpt-4o",
          success: false,
          errorMessage: aiError instanceof Error ? aiError.message : "AI service unavailable",
        });
      }
      return NextResponse.json(
        { error: "AI service unavailable", segments: [] },
        { status: 503 }
      );
    }
  } catch (err) {
    console.error("Parse flight itinerary error:", err);
    // Log failed usage
    if (authInfo) {
      await logAiUsage({
        companyId: authInfo.companyId,
        userId: authInfo.userId,
        operation: "parse_flight",
        model: "gpt-4o",
        success: false,
        errorMessage: err instanceof Error ? err.message : "Internal server error",
      });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
