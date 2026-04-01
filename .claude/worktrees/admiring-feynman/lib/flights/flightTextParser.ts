/**
 * Flight Text Parser
 * Parses flight itinerary text from emails, GDS systems, etc.
 */

import { FlightSegment } from "@/components/FlightItineraryInput";

/**
 * Generate unique ID for segment
 */
function generateId(): string {
  return `seg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Parse various date formats to YYYY-MM-DD
 */
function parseDate(dateStr: string): string {
  // Try common formats
  const patterns = [
    // DD.MM.YYYY
    /(\d{1,2})\.(\d{1,2})\.(\d{4})/,
    // DD/MM/YYYY
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
    // YYYY-MM-DD
    /(\d{4})-(\d{2})-(\d{2})/,
    // DDMMMYY (25JAN26)
    /(\d{1,2})([A-Z]{3})(\d{2})/i,
    // DD MMM YYYY (25 Jan 2026)
    /(\d{1,2})\s*([A-Z]{3})\s*(\d{4})/i,
  ];
  
  const months: Record<string, string> = {
    JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
    JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
  };
  
  for (const pattern of patterns) {
    const match = dateStr.match(pattern);
    if (match) {
      if (pattern.source.includes("[A-Z]")) {
        // Month name format
        const day = match[1].padStart(2, "0");
        const month = months[match[2].toUpperCase()] || "01";
        let year = match[3];
        if (year.length === 2) {
          year = "20" + year;
        }
        return `${year}-${month}-${day}`;
      } else if (match[1].length === 4) {
        // YYYY-MM-DD
        return `${match[1]}-${match[2]}-${match[3]}`;
      } else {
        // DD.MM.YYYY or DD/MM/YYYY
        const day = match[1].padStart(2, "0");
        const month = match[2].padStart(2, "0");
        const year = match[3];
        return `${year}-${month}-${day}`;
      }
    }
  }
  
  return "";
}

/**
 * Parse time string to HH:mm format
 */
function parseTime(timeStr: string): string {
  // Handle formats: 12:30, 1230, 12.30
  const match = timeStr.match(/(\d{1,2})[:\.]?(\d{2})/);
  if (match) {
    return `${match[1].padStart(2, "0")}:${match[2]}`;
  }
  return "";
}

/**
 * Extract flight number and airline
 */
function parseFlightNumber(text: string): { airline: string; flightNumber: string } {
  // Common patterns: LH1234, BT 123, airBaltic 123
  const patterns = [
    // IATA code + number: LH1234, BT123
    /\b([A-Z]{2})(\d{1,4})\b/,
    // Airline name + number
    /\b(Lufthansa|airBaltic|Swiss|KLM|Air France|British Airways|Ryanair|easyJet|Finnair|SAS|Norwegian)\s*(\d{1,4})\b/i,
  ];
  
  const airlineCodes: Record<string, string> = {
    "LH": "Lufthansa",
    "BT": "airBaltic",
    "LX": "Swiss",
    "KL": "KLM",
    "AF": "Air France",
    "BA": "British Airways",
    "FR": "Ryanair",
    "U2": "easyJet",
    "AY": "Finnair",
    "SK": "SAS",
    "DY": "Norwegian",
  };
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const code = match[1].toUpperCase();
      const number = match[2];
      const airline = airlineCodes[code] || code;
      return {
        airline,
        flightNumber: `${code}${number}`,
      };
    }
  }
  
  return { airline: "", flightNumber: "" };
}

/**
 * Extract airport codes from text
 */
function extractAirportCodes(text: string): string[] {
  // Common 3-letter airport codes
  const matches = text.match(/\b[A-Z]{3}\b/g) || [];
  // Filter out common non-airport codes
  const nonAirports = ["THE", "AND", "FOR", "NOT", "ALL", "ARE", "BUT", "YOU", "CAN"];
  return matches.filter(code => !nonAirports.includes(code));
}

/**
 * Parse cabin class
 */
function parseCabinClass(text: string): FlightSegment["cabinClass"] | undefined {
  const lower = text.toLowerCase();
  if (lower.includes("first")) return "first";
  if (lower.includes("business")) return "business";
  if (lower.includes("premium") || lower.includes("comfort")) return "premium_economy";
  if (lower.includes("econom")) return "economy";
  return undefined;
}

/**
 * Main parser function
 * Takes raw text and attempts to extract flight segments
 */
export function parseFlightText(text: string): FlightSegment[] {
  const segments: FlightSegment[] = [];
  
  // Split by common delimiters (new lines, semicolons, etc.)
  const lines = text.split(/[\n;]+/).filter(line => line.trim());
  
  let currentDate = "";
  
  for (const line of lines) {
    // Try to extract date from line
    const dateMatch = line.match(/(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4}|\d{1,2}\s*[A-Z]{3}\s*\d{2,4}|\d{1,2}[A-Z]{3}\d{2})/i);
    if (dateMatch) {
      currentDate = parseDate(dateMatch[1]);
    }
    
    // Try to extract flight info
    const { airline, flightNumber } = parseFlightNumber(line);
    const airports = extractAirportCodes(line);
    
    // Extract times (look for time patterns)
    const times = line.match(/\b(\d{1,2}[:\.]?\d{2})\b/g) || [];
    const depTime = times[0] ? parseTime(times[0]) : "";
    const arrTime = times[1] ? parseTime(times[1]) : "";
    
    const cabinClass = parseCabinClass(line);
    
    // If we have at least flight number and 2 airports, create a segment
    if (flightNumber && airports.length >= 2) {
      segments.push({
        id: generateId(),
        flightNumber,
        airline,
        departure: airports[0],
        arrival: airports[1],
        departureDate: currentDate,
        arrivalDate: currentDate,
        departureTimeScheduled: depTime,
        arrivalTimeScheduled: arrTime,
        departureStatus: "scheduled",
        arrivalStatus: "scheduled",
        cabinClass,
      });
    }
    // If we have just airports (route info), try to pair them
    else if (airports.length >= 2 && !flightNumber) {
      for (let i = 0; i < airports.length - 1; i++) {
        segments.push({
          id: generateId(),
          flightNumber: "",
          departure: airports[i],
          arrival: airports[i + 1],
          departureDate: currentDate,
          arrivalDate: currentDate,
          departureTimeScheduled: i === 0 ? depTime : "",
          arrivalTimeScheduled: i === airports.length - 2 ? arrTime : "",
          departureStatus: "scheduled",
          arrivalStatus: "scheduled",
          cabinClass,
        });
      }
    }
  }
  
  return segments;
}

/**
 * Parse simple route string like "RIX-FRA-NCE"
 */
export function parseRouteString(route: string, date?: string): FlightSegment[] {
  const segments: FlightSegment[] = [];
  const airports = route.split(/[-–—>→]/).map(s => s.trim().toUpperCase()).filter(s => s.length === 3);
  
  for (let i = 0; i < airports.length - 1; i++) {
    segments.push({
      id: generateId(),
      flightNumber: "",
      departure: airports[i],
      arrival: airports[i + 1],
      departureDate: date || "",
      arrivalDate: date || "",
      departureTimeScheduled: "",
      arrivalTimeScheduled: "",
      departureStatus: "scheduled",
      arrivalStatus: "scheduled",
    });
  }
  
  return segments;
}
