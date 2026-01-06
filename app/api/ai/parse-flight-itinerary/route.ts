import { NextRequest, NextResponse } from "next/server";

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

const SYSTEM_PROMPT = `You are a flight itinerary parser. Extract flight information from images of tickets, boarding passes, booking confirmations, or PDFs.

Return a JSON object with this structure:
{
  "segments": [
    {
      "flightNumber": "LX348",
      "airline": "SWISS",
      "departure": "GVA",
      "departureCity": "Geneva",
      "departureCountry": "CH",
      "arrival": "LHR",
      "arrivalCity": "London",
      "arrivalCountry": "GB",
      "departureDate": "2026-01-06",
      "departureTimeScheduled": "15:55",
      "arrivalDate": "2026-01-06",
      "arrivalTimeScheduled": "16:40",
      "duration": "1h 45m",
      "departureTerminal": "1",
      "arrivalTerminal": "2",
      "cabinClass": "business",
      "bookingClass": "Z",
      "bookingRef": "ZBBVXE",
      "ticketNumber": "7242796062303",
      "baggage": "2PC",
      "seat": "07A",
      "passengerName": "VELINSKI/ANNA MRS",
      "aircraft": "AIRBUS A220-300"
    }
  ]
}

Rules:
- Use IATA airport codes (3 letters) for departure/arrival
- Dates in YYYY-MM-DD format
- Times in HH:mm format (24-hour)
- If arrival is next day, use the correct arrival date
- Calculate duration from times if not explicitly shown
- Extract terminal info if visible
- cabinClass should be lowercase: "economy", "premium_economy", "business", or "first"
- bookingClass is the fare class letter (Y, Z, C, F, etc.)
- passengerName in LASTNAME/FIRSTNAME format if possible
- If you cannot determine a value, omit it or use empty string
- Only return valid JSON, no other text`;

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    
    let imageBase64: string | null = null;
    let mimeType: string = "image/png";
    let textContent: string | null = null;
    let isPDF = false;

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
        // For PDF, we'll extract text using pdf-parse or send to AI directly
        // Since we don't have pdf-parse installed, we'll send as base64 to AI
        // Note: For production, consider using a PDF text extraction library
        const buffer = await file.arrayBuffer();
        imageBase64 = Buffer.from(buffer).toString("base64");
      } else if (file.type.startsWith("image/")) {
        const buffer = await file.arrayBuffer();
        imageBase64 = Buffer.from(buffer).toString("base64");
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
            content: SYSTEM_PROMPT,
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
            content: SYSTEM_PROMPT,
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
            content: SYSTEM_PROMPT,
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

      // Parse JSON from response
      try {
        // Try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const segments: FlightSegment[] = (parsed.segments || []).map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (seg: any, index: number) => ({
              id: `seg-${Date.now()}-${index}`,
              flightNumber: seg.flightNumber || "",
              airline: seg.airline || "",
              departure: seg.departure || "",
              departureCity: seg.departureCity || "",
              departureCountry: seg.departureCountry || "",
              arrival: seg.arrival || "",
              arrivalCity: seg.arrivalCity || "",
              arrivalCountry: seg.arrivalCountry || "",
              departureDate: seg.departureDate || "",
              departureTimeScheduled: seg.departureTimeScheduled || seg.departureTime || "",
              departureTimeActual: seg.departureTimeActual || "",
              arrivalDate: seg.arrivalDate || seg.departureDate || "",
              arrivalTimeScheduled: seg.arrivalTimeScheduled || seg.arrivalTime || "",
              arrivalTimeActual: seg.arrivalTimeActual || "",
              duration: seg.duration || "",
              departureTerminal: seg.departureTerminal || "",
              arrivalTerminal: seg.arrivalTerminal || "",
              cabinClass: seg.cabinClass || "",
              bookingClass: seg.bookingClass || "",
              bookingRef: seg.bookingRef || "",
              ticketNumber: seg.ticketNumber || "",
              baggage: seg.baggage || "",
              seat: seg.seat || "",
              passengerName: seg.passengerName || "",
              aircraft: seg.aircraft || "",
              departureStatus: "scheduled",
              arrivalStatus: "scheduled",
            })
          );

          return NextResponse.json({ segments });
        }
      } catch (parseErr) {
        console.error("Failed to parse AI response:", parseErr, "Content:", content);
      }

      return NextResponse.json({ 
        error: "Could not extract flight information",
        segments: [] 
      });
    } catch (aiError) {
      console.error("OpenAI API call failed:", aiError);
      return NextResponse.json(
        { error: "AI service unavailable", segments: [] },
        { status: 503 }
      );
    }
  } catch (err) {
    console.error("Parse flight itinerary error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
