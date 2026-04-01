/**
 * AI Task: Parse Flight Itinerary
 *
 * Extracts flight information from ticket images or text
 */

import { aiVision, aiJSON } from "../client";

export interface FlightSegmentParsed {
  flightNumber: string;
  airline?: string;
  departure: string;
  departureCity?: string;
  arrival: string;
  arrivalCity?: string;
  departureDate: string;
  departureTimeScheduled: string;
  arrivalDate: string;
  arrivalTimeScheduled: string;
  duration?: string;
  departureTerminal?: string;
  arrivalTerminal?: string;
}

export interface ParseFlightResult {
  success: boolean;
  segments: FlightSegmentParsed[];
  error?: string;
}

const SYSTEM_PROMPT = `You are a flight itinerary parser for a travel agency CRM.
Extract flight information from images or text of tickets, boarding passes, or booking confirmations.

Return JSON with this structure:
{
  "segments": [
    {
      "flightNumber": "LX348",
      "airline": "SWISS",
      "departure": "GVA",
      "departureCity": "Geneva",
      "arrival": "LHR",
      "arrivalCity": "London Heathrow",
      "departureDate": "2026-01-06",
      "departureTimeScheduled": "15:55",
      "arrivalDate": "2026-01-06",
      "arrivalTimeScheduled": "16:40",
      "duration": "1h 45m",
      "departureTerminal": "1",
      "arrivalTerminal": "2"
    }
  ]
}

Rules:
- Use IATA 3-letter airport codes
- Dates in YYYY-MM-DD format
- Times in HH:mm format (24-hour)
- Calculate duration if not shown
- Extract terminal info if visible
- Leave empty string for unknown values
- Return empty segments array if no flight info found`;

/**
 * Parse ticket image
 */
export async function parseFlightItinerary(
  imageBase64: string,
  mimeType: string
): Promise<ParseFlightResult> {
  const result = await aiVision(
    imageBase64,
    mimeType,
    "Extract all flight segments from this image. Return JSON only.",
    SYSTEM_PROMPT
  );

  if (!result.success) {
    return { success: false, segments: [], error: result.error };
  }

  try {
    // Extract JSON from response
    const jsonMatch = result.content?.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, segments: [], error: "No JSON found in response" };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const segments: FlightSegmentParsed[] = (parsed.segments || []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (seg: any) => ({
        flightNumber: seg.flightNumber || "",
        airline: seg.airline || "",
        departure: seg.departure || "",
        departureCity: seg.departureCity || "",
        arrival: seg.arrival || "",
        arrivalCity: seg.arrivalCity || "",
        departureDate: seg.departureDate || "",
        departureTimeScheduled: seg.departureTimeScheduled || seg.departureTime || "",
        arrivalDate: seg.arrivalDate || seg.departureDate || "",
        arrivalTimeScheduled: seg.arrivalTimeScheduled || seg.arrivalTime || "",
        duration: seg.duration || "",
        departureTerminal: seg.departureTerminal || "",
        arrivalTerminal: seg.arrivalTerminal || "",
      })
    );

    return { success: true, segments };
  } catch (err) {
    return { success: false, segments: [], error: "Failed to parse response" };
  }
}

/**
 * Parse text containing flight details
 */
export async function parseFlightText(text: string): Promise<ParseFlightResult> {
  const result = await aiJSON<{ segments: FlightSegmentParsed[] }>(
    `Parse these flight details:\n\n${text}`,
    SYSTEM_PROMPT
  );

  if (!result.success || !result.data) {
    return { success: false, segments: [], error: result.error };
  }

  return { success: true, segments: result.data.segments || [] };
}
