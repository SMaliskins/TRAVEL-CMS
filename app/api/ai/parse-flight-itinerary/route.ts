import { NextRequest, NextResponse } from "next/server";

/**
 * AI-powered flight itinerary parsing
 * 
 * This endpoint accepts an image (base64) and uses AI to extract flight segments.
 * Currently a placeholder - integrate with OpenAI Vision API for production use.
 * 
 * Expected input:
 * {
 *   image: string (base64),
 *   mimeType: string (e.g., "image/png")
 * }
 * 
 * Expected output:
 * {
 *   segments: FlightSegment[]
 * }
 */

interface FlightSegment {
  id: string;
  flightNumber: string;
  departure: string;
  arrival: string;
  departureDate: string;
  departureTime: string;
  arrivalDate: string;
  arrivalTime: string;
  aircraft?: string;
  status?: "scheduled" | "delayed" | "cancelled" | "landed";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image, mimeType } = body;

    if (!image) {
      return NextResponse.json(
        { error: "Image is required" },
        { status: 400 }
      );
    }

    // Check if OpenAI API key is configured
    const openaiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiKey) {
      // Return empty result if AI not configured
      // Frontend will fall back to manual entry
      return NextResponse.json(
        { error: "AI parsing not configured", segments: [] },
        { status: 503 }
      );
    }

    // Call OpenAI Vision API
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are a flight itinerary parser. Extract flight information from images of tickets, boarding passes, or itineraries.

Return a JSON array of flight segments with this structure:
{
  "segments": [
    {
      "flightNumber": "BT401",
      "departure": "RIX",
      "arrival": "FCO",
      "departureDate": "2026-01-15",
      "departureTime": "08:30",
      "arrivalDate": "2026-01-15",
      "arrivalTime": "11:45",
      "aircraft": "Airbus A220"
    }
  ]
}

Use IATA airport codes (3 letters). Dates in YYYY-MM-DD format. Times in HH:mm format.
If you cannot determine a value, leave it empty string.
Only return valid JSON, no other text.`
            },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType || "image/png"};base64,${image}`,
                  },
                },
                {
                  type: "text",
                  text: "Extract all flight segments from this image. Return JSON only.",
                },
              ],
            },
          ],
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("OpenAI API error:", errorData);
        return NextResponse.json(
          { error: "AI parsing failed", segments: [] },
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
            (seg: Partial<FlightSegment>, index: number) => ({
              id: `seg-${Date.now()}-${index}`,
              flightNumber: seg.flightNumber || "",
              departure: seg.departure || "",
              arrival: seg.arrival || "",
              departureDate: seg.departureDate || "",
              departureTime: seg.departureTime || "",
              arrivalDate: seg.arrivalDate || seg.departureDate || "",
              arrivalTime: seg.arrivalTime || "",
              aircraft: seg.aircraft || "",
              status: "scheduled",
            })
          );

          return NextResponse.json({ segments });
        }
      } catch (parseErr) {
        console.error("Failed to parse AI response:", parseErr);
      }

      return NextResponse.json({ segments: [] });
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
