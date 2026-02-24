/**
 * Airline-specific regex parsers for booking confirmations
 * Fallback: AI parsing for unknown formats
 */

export interface ParsedSegment {
  id: string;
  flightNumber: string;
  airline: string;
  departure: string;
  departureCity?: string;
  arrival: string;
  arrivalCity?: string;
  departureDate: string;
  departureTimeScheduled: string;
  arrivalDate: string;
  arrivalTimeScheduled: string;
  departureTerminal?: string;
  arrivalTerminal?: string;
  duration?: string;
  cabinClass?: "economy" | "premium_economy" | "business" | "first";
  baggage?: string;
  bookingRef?: string;
  ticketNumber?: string;
}

export interface ParsedPassenger {
  name: string;
  ticketNumber?: string;
}

export interface ParsedBooking {
  bookingRef: string;
  airline: string;
  totalPrice: number | null;
  salePrice?: number | null;
  currency: string;
  ticketNumbers: string[];
  /** All passengers when 2+ on the ticket; otherwise passengerName used for single */
  passengers?: ParsedPassenger[];
  cabinClass: string;
  refundPolicy: "non_ref" | "refundable" | "fully_ref";
  baggage: string;
  passengerName?: string;
}

export interface ParseResult {
  success: boolean;
  segments: ParsedSegment[];
  booking: ParsedBooking;
  parser: string; // Which parser was used
}

// Month name to number mapping
const MONTHS: Record<string, string> = {
  january: "01", jan: "01",
  february: "02", feb: "02",
  march: "03", mar: "03",
  april: "04", apr: "04",
  may: "05",
  june: "06", jun: "06",
  july: "07", jul: "07",
  august: "08", aug: "08",
  september: "09", sep: "09", sept: "09",
  october: "10", oct: "10",
  november: "11", nov: "11",
  december: "12", dec: "12",
};

// Parse date from various formats
function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  
  // DD.MM.YYYY or DD/MM/YYYY
  let match = dateStr.match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
  if (match) {
    return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  }
  
  // DD Mon YYYY or DD Month YYYY
  match = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/i);
  if (match) {
    const month = MONTHS[match[2].toLowerCase()];
    if (month) {
      return `${match[3]}-${month}-${match[1].padStart(2, "0")}`;
    }
  }
  
  // Mon DD, YYYY
  match = dateStr.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/i);
  if (match) {
    const month = MONTHS[match[1].toLowerCase()];
    if (month) {
      return `${match[3]}-${month}-${match[2].padStart(2, "0")}`;
    }
  }
  
  return null;
}

// Parse time from various formats
function parseTime(timeStr: string): string | null {
  if (!timeStr) return null;
  
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    return `${match[1].padStart(2, "0")}:${match[2]}`;
  }
  
  return null;
}

// Detect refund policy from text
function detectRefundPolicy(text: string): "non_ref" | "refundable" | "fully_ref" {
  const lower = text.toLowerCase();
  if (lower.includes("non-refundable") || lower.includes("nonref") || lower.includes("non refundable")) {
    return "non_ref";
  }
  if (lower.includes("fully refundable") || lower.includes("full refund")) {
    return "fully_ref";
  }
  if (lower.includes("refundable")) {
    return "refundable";
  }
  return "non_ref"; // Default
}

// Extract cabin class from text - only explicit mentions, no fare codes (they vary by airline)
function detectCabinClass(text: string): "economy" | "premium_economy" | "business" | "first" | undefined {
  const lower = text.toLowerCase();
  
  // First class - must be explicit "first class" (not just "first")
  // Check for "first class" as a phrase, not just "first" followed by any word
  if (/\bfirst\s+class\b/i.test(text)) {
    return "first";
  }
  
  // Business class - explicit mentions only
  if (lower.includes("business class") || lower.includes("business,") || 
      lower.includes("club class") || lower.includes("club world") ||
      /\bbusiness\b\s*\(/i.test(lower)) {
    return "business";
  }
  
  // Premium economy - explicit mentions
  if (lower.includes("premium economy") || lower.includes("premium eco") || 
      lower.includes("economy plus") || lower.includes("economy comfort") ||
      lower.includes("world traveller plus") || lower.includes("economy premium")) {
    return "premium_economy";
  }
  
  // Economy - explicit mentions
  if (lower.includes("economy class") || lower.includes("economy,") || 
      lower.includes("world traveller") || lower.includes("euro traveller") ||
      /\beconomy\b\s*\(/i.test(lower) || lower.includes("economy (")) {
    return "economy";
  }
  
  // Default: undefined (don't guess)
  return undefined;
}

// Universal baggage parser
// Returns structured baggage info: "personal", "personal+cabin", "personal+cabin+1bag", "personal+cabin+2bags"
function parseBaggage(text: string, cabinClass?: string): string {
  const lower = text.toLowerCase();
  
  // Check for explicit baggage allowance patterns
  // Pattern: "2PC", "1PC", "0PC" (pieces = checked bags)
  // NOTE: For traditional airlines, PC includes personal+cabin automatically
  // For budget airlines (Ryanair, Wizzair etc.), PC means checked bags but NO cabin bag included
  const pcMatch = text.match(/(\d+)\s*PC\b/i);
  if (pcMatch) {
    const pieces = parseInt(pcMatch[1]);
    // Check if this is a budget airline first
    const budgetAirlines = ["ryanair", "wizzair", "wizz air", "spirit", "frontier", "allegiant", "volotea", "pobeda"];
    const isBudget = budgetAirlines.some(a => lower.includes(a));
    
    if (isBudget) {
      // Budget airlines: PC is checked bags, personal only included
      if (pieces === 0) return "personal";
      if (pieces === 1) return "personal+1bag"; // No cabin bag!
      if (pieces >= 2) return `personal+${pieces}bags`;
    } else {
      // Traditional airlines: PC includes personal+cabin
      if (pieces === 0) return "personal+cabin";
      if (pieces === 1) return "personal+cabin+1bag";
      if (pieces >= 2) return `personal+cabin+${pieces}bags`;
    }
  }
  
  // Pattern: "baggage allowance: 23kg" or "1x23kg"
  const kgMatch = text.match(/(\d+)\s*x?\s*(\d+)\s*kg/i) || text.match(/baggage.*?(\d+)\s*kg/i);
  if (kgMatch) {
    const count = kgMatch[1] ? parseInt(kgMatch[1]) : 1;
    if (count === 1) return "personal+cabin+1bag";
    if (count >= 2) return `personal+cabin+${count}bags`;
  }
  
  // Pattern: "checked bag", "checked baggage"
  const checkedMatch = text.match(/(\d+)\s*(?:x\s*)?checked\s*bag/i);
  if (checkedMatch) {
    const count = parseInt(checkedMatch[1]);
    if (count === 1) return "personal+cabin+1bag";
    if (count >= 2) return `personal+cabin+${count}bags`;
  }
  
  // Pattern: "no checked baggage", "hand luggage only"
  if (lower.includes("no checked") || lower.includes("hand luggage only") || lower.includes("cabin only") || lower.includes("carry-on only")) {
    return "personal+cabin";
  }
  
  // Pattern: "personal item only" (budget airlines)
  if (lower.includes("personal item only") || lower.includes("small bag only") || lower.includes("under seat")) {
    return "personal";
  }
  
  // Low-cost carriers - personal item only by default (no cabin bag without extra fee)
  const personalOnlyAirlines = [
    "ryanair", "wizzair", "wizz air", "spirit", "frontier", 
    "allegiant", "volotea", "pobeda", "победа"
  ];
  if (personalOnlyAirlines.some(a => lower.includes(a))) {
    return "personal"; // Budget airlines: personal item only
  }
  
  // Low-cost carriers that include cabin bag
  const personalPlusCabinAirlines = [
    "easyjet", "vueling", "transavia", "eurowings", "norwegian"
  ];
  if (personalPlusCabinAirlines.some(a => lower.includes(a))) {
    return "personal+cabin"; // These include cabin bag
  }
  
  // Default based on cabin class
  if (cabinClass === "first") return "personal+cabin+3bags";
  if (cabinClass === "business") return "personal+cabin+2bags";
  
  // Default: unknown (empty string means not detected)
  return "";
}

// Format baggage for display
// personal = under seat, cabin = carry-on (overhead), bag = checked
// Budget airlines (Ryanair, Wizzair etc.) may not include cabin bag
export function formatBaggageDisplay(baggage: string): string {
  if (!baggage) return "";
  
  switch (baggage) {
    case "personal":
      return "Personal item only";
    case "personal+cabin":
      return "Personal, Carry-on";
    case "personal+1bag":
      return "Personal, 1 checked"; // Budget: no cabin!
    case "personal+2bags":
      return "Personal, 2 checked"; // Budget: no cabin!
    case "personal+cabin+1bag":
      return "Personal, Carry-on, 1 checked";
    case "personal+cabin+2bags":
      return "Personal, Carry-on, 2 checked";
    case "personal+cabin+3bags":
      return "Personal, Carry-on, 3 checked";
    default:
      // Budget airlines: personal+Nbags (no cabin)
      const budgetMatch = baggage.match(/personal\+(\d+)bags?$/);
      if (budgetMatch) {
        return `Personal, ${budgetMatch[1]} checked`;
      }
      // Traditional: personal+cabin+Nbags
      const match = baggage.match(/personal\+cabin\+(\d+)bags?/);
      if (match) {
        return `Personal, Carry-on, ${match[1]} checked`;
      }
      // Handle PC format from Amadeus
      const pcMatch = baggage.match(/(\d+)PC/i);
      if (pcMatch) {
        return `Personal, Carry-on, ${pcMatch[1]} checked`;
      }
      return baggage;
  }
}

// ============================================
// BRITISH AIRWAYS (BA)
// ============================================
function parseBritishAirways(text: string): ParseResult | null {
  if (!text.includes("British Airways") && !text.match(/BA\d{3,4}\s+\w+\s+to\s+\w+/i)) {
    return null;
  }
  
  const bookingRefMatch = text.match(/Booking\s+reference:\s*\n?\s*([A-Z0-9]{6})/i);
  const ticketMatch = text.match(/Ticket\s+number\(s\)[\s\t]+([0-9-]+)/i);
  const priceMatch = text.match(/Total\s*\(incl\.\s*taxes.*?\)[\s\t\n]+EUR\s*([\d.,]+)/i) ||
                    text.match(/Total.*?[\s\t\n]+(?:EUR|GBP|USD)\s*([\d.,]+)/i);
  
  const flightPattern = /BA(\d{3,4})\s+([A-Za-z\s]+?)\s+to\s+([A-Za-z\s]+?)(?:\n|Departs)/gi;
  const segments: ParsedSegment[] = [];
  let flightMatch;
  const allMatches: { num: string; from: string; to: string; index: number }[] = [];
  
  while ((flightMatch = flightPattern.exec(text)) !== null) {
    allMatches.push({
      num: flightMatch[1],
      from: flightMatch[2].trim(),
      to: flightMatch[3].trim(),
      index: flightMatch.index
    });
  }
  
  if (allMatches.length === 0) return null;
  
  for (let i = 0; i < allMatches.length; i++) {
    const flight = allMatches[i];
    const sectionEnd = allMatches[i + 1]?.index || text.length;
    const section = text.substring(flight.index, sectionEnd);
    
    const departsMatch = section.match(/Departs:\s*\w+,\s*(\d{1,2})\s+(\w+)\s+(\d{4})/i);
    const arrivesMatch = section.match(/Arrives:\s*\w+,\s*(\d{1,2})\s+(\w+)\s+(\d{4})/i);
    
    if (departsMatch && arrivesMatch) {
      const depDate = parseDate(`${departsMatch[1]} ${departsMatch[2]} ${departsMatch[3]}`);
      const arrDate = parseDate(`${arrivesMatch[1]} ${arrivesMatch[2]} ${arrivesMatch[3]}`);
      
      const times = section.match(/\b(\d{1,2}:\d{2})\b/g) || [];
      
      const airportPattern = /([A-Z]{3})\s*-\s*Terminal\s*(\d+)/gi;
      const airports: { code: string; terminal: string }[] = [];
      let am;
      while ((am = airportPattern.exec(section)) !== null) {
        airports.push({ code: am[1], terminal: am[2] });
      }
      
      const durationMatch = section.match(/(\d+)\s*hours?\s*(\d+)\s*minutes?/i);
      
      segments.push({
        id: `seg-${Date.now()}-${i}`,
        flightNumber: `BA${flight.num}`,
        airline: "British Airways",
        departure: airports[0]?.code || "",
        departureCity: flight.from,
        arrival: airports[1]?.code || "",
        arrivalCity: flight.to,
        departureDate: depDate || "",
        departureTimeScheduled: parseTime(times[0] || "") || "",
        arrivalDate: arrDate || depDate || "",
        arrivalTimeScheduled: parseTime(times[1] || "") || "",
        departureTerminal: airports[0]?.terminal,
        arrivalTerminal: airports[1]?.terminal,
        duration: durationMatch ? `${durationMatch[1]}h ${durationMatch[2]}m` : undefined,
        cabinClass: detectCabinClass(section),
        bookingRef: bookingRefMatch?.[1],
        ticketNumber: ticketMatch?.[1],
      });
    }
  }
  
  if (segments.length === 0) return null;
  
  // Baggage
  let baggage = "";
  const cabinBag = text.match(/(\d+)\s*cabin\s*bag/i);
  const checkedBag = text.match(/(\d+)\s*checked/i);
  if (cabinBag) baggage += `${cabinBag[1]} cabin bag`;
  if (checkedBag) baggage += (baggage ? ", " : "") + `${checkedBag[1]} checked`;
  
  return {
    success: true,
    segments,
    booking: {
      bookingRef: bookingRefMatch?.[1] || "",
      airline: "British Airways",
      totalPrice: priceMatch ? parseFloat(priceMatch[1].replace(",", ".")) : null,
      currency: "EUR",
      ticketNumbers: ticketMatch ? [ticketMatch[1]] : [],
      cabinClass: segments[0]?.cabinClass || "economy",
      refundPolicy: detectRefundPolicy(text),
      baggage,
    },
    parser: "british_airways",
  };
}

// ============================================
// LUFTHANSA (LH)
// ============================================
function parseLufthansa(text: string): ParseResult | null {
  if (!text.includes("Lufthansa") && !text.match(/LH\s?\d{3,4}/i)) {
    return null;
  }
  
  const bookingRefMatch = text.match(/(?:Booking\s+code|Buchungscode|PNR)[\s:]+([A-Z0-9]{6})/i);
  const ticketMatch = text.match(/(?:Ticket\s+number|Ticketnummer)[\s:]*(\d{13})/i);
  const priceMatch = text.match(/(?:Final\s+price|Total|Gesamt)[\s:]*(?:EUR|€)\s*([\d.,]+)/i);
  
  const segments: ParsedSegment[] = [];
  
  // Extract passenger name
  const passengerMatch = text.match(/(?:Dear\s+(?:Ms|Mr|Mrs)\s+|Passenger\s*\n?\s*(?:Ms|Mr|Mrs)\s+)([A-Za-z]+\s+[A-Za-z]+)/i);
  const passengerName = passengerMatch?.[1] || "";
  
  // Lufthansa format: Look for flight segments in itinerary details
  // Pattern: date - time\nCity\n...flight info\n...LH1234
  // Example:
  // 25.01.2026 - 13:55
  // Tallinn
  // ...
  // 25.01.2026 - 15:30
  // Frankfurt
  // ...
  // LH881 Operated by: Lufthansa
  
  // Strategy: Find all LH flight numbers and their context
  const flightMatches = [...text.matchAll(/LH\s?(\d{3,4})\s+Operated\s+by:\s*Lufthansa[^]*?(?:Economy|Business|First)[^\n]*/gi)];
  
  // Find all datetime + city patterns
  const timeLocationPattern = /(\d{1,2}\.\d{1,2}\.\d{4})\s*-\s*(\d{1,2}:\d{2})\s*\n\s*([A-Za-z\s]+?)(?:\n|$)/g;
  const timeLocations: { date: string; time: string; city: string; index: number }[] = [];
  let tlMatch;
  while ((tlMatch = timeLocationPattern.exec(text)) !== null) {
    const city = tlMatch[3].trim().replace(/\s+/g, " ");
    // Skip if it's not a city name (contains special chars or too short)
    if (city.length > 2 && /^[A-Za-z\s]+$/.test(city)) {
      timeLocations.push({
        date: parseDate(tlMatch[1]) || "",
        time: tlMatch[2],
        city: city,
        index: tlMatch.index,
      });
    }
  }
  
  // Find all flight numbers with their positions
  const flightNumberPattern = /LH\s?(\d{3,4})/gi;
  const flightNumbers: { num: string; index: number }[] = [];
  let fnMatch;
  while ((fnMatch = flightNumberPattern.exec(text)) !== null) {
    flightNumbers.push({ num: fnMatch[1], index: fnMatch.index });
  }
  
  // Extract cabin class
  const cabinClass = detectCabinClass(text);
  
  // Pair consecutive time-locations to form segments
  // Each segment has departure and arrival, followed by flight number
  for (let i = 0; i < timeLocations.length - 1; i += 2) {
    const dep = timeLocations[i];
    const arr = timeLocations[i + 1];
    
    if (!dep || !arr) continue;
    
    // Find flight number between departure and arrival (or just after arrival)
    const relevantFlight = flightNumbers.find(f => 
      f.index > dep.index && f.index < (timeLocations[i + 2]?.index || text.length)
    );
    
    if (!relevantFlight) continue;
    
    // Get IATA codes from city names
    const depCode = getIATAFromCity(dep.city);
    const arrCode = getIATAFromCity(arr.city);
    
    // Look for terminal info
    const terminalPattern = new RegExp(`${dep.city}[^]*?Terminal\\s*(\\d+)`, "i");
    const depTermMatch = text.slice(dep.index, arr.index).match(terminalPattern);
    const arrTermMatch = text.slice(arr.index, arr.index + 500).match(/Terminal\s*(\d+)/i);
    
    segments.push({
      id: `seg-${Date.now()}-${i}`,
      flightNumber: `LH${relevantFlight.num}`,
      airline: "Lufthansa",
      departure: depCode,
      departureCity: dep.city,
      arrival: arrCode,
      arrivalCity: arr.city,
      departureDate: dep.date,
      departureTimeScheduled: dep.time,
      arrivalDate: arr.date,
      arrivalTimeScheduled: arr.time,
      departureTerminal: depTermMatch?.[1] ? `Terminal ${depTermMatch[1]}` : undefined,
      arrivalTerminal: arrTermMatch?.[1] ? `Terminal ${arrTermMatch[1]}` : undefined,
      cabinClass,
      bookingRef: bookingRefMatch?.[1],
      ticketNumber: ticketMatch?.[1],
    });
  }
  
  // If primary method didn't work, try simpler approach
  if (segments.length === 0) {
    // Look for route summary: TLL - NCE format
    const routeSummaryPattern = /([A-Z]{3})\s*\t+([A-Z]{3})/g;
    const routes: { from: string; to: string }[] = [];
    let rsMatch;
    while ((rsMatch = routeSummaryPattern.exec(text)) !== null) {
      routes.push({ from: rsMatch[1], to: rsMatch[2] });
    }
    
    // Also try finding routes in format: "TLL Departure IATA Code TLL NCE Arrival IATA Code NCE"
    const iataPattern = /([A-Z]{3})\s+(?:Departure|Arrival)\s+IATA\s+Code\s+([A-Z]{3})/gi;
    const iataCodes: string[] = [];
    let iataMatch;
    while ((iataMatch = iataPattern.exec(text)) !== null) {
      if (!iataCodes.includes(iataMatch[1])) {
        iataCodes.push(iataMatch[1]);
      }
    }
    
    // Simple date-time extraction
    const simpleDatePattern = /(\d{1,2}\.\d{1,2}\.\d{4})\s*-\s*(\d{1,2}:\d{2})/g;
    const dateTimes: { date: string; time: string }[] = [];
    let dtMatch;
    while ((dtMatch = simpleDatePattern.exec(text)) !== null) {
      dateTimes.push({ 
        date: parseDate(dtMatch[1]) || "", 
        time: dtMatch[2] 
      });
    }
    
    // Create segments from flight numbers
    for (let i = 0; i < flightNumbers.length; i++) {
      const depIdx = i * 2;
      const arrIdx = i * 2 + 1;
      
      segments.push({
        id: `seg-${Date.now()}-${i}`,
        flightNumber: `LH${flightNumbers[i].num}`,
        airline: "Lufthansa",
        departure: iataCodes[depIdx] || routes[Math.floor(i/2)]?.from || "",
        arrival: iataCodes[arrIdx] || routes[Math.floor(i/2)]?.to || "",
        departureDate: dateTimes[depIdx]?.date || "",
        departureTimeScheduled: dateTimes[depIdx]?.time || "",
        arrivalDate: dateTimes[arrIdx]?.date || dateTimes[depIdx]?.date || "",
        arrivalTimeScheduled: dateTimes[arrIdx]?.time || "",
        cabinClass,
        bookingRef: bookingRefMatch?.[1],
        ticketNumber: ticketMatch?.[1],
      });
    }
  }
  
  if (segments.length === 0) return null;
  
  // Extract duration for each segment from "Duration: 5h 30m" patterns
  // Or from specific segment info
  const durationMatches = [...text.matchAll(/Duration:\s*(\d+)h\s*(\d+)m/gi)];
  
  // Extract layover/stopover times: "1 stop in Frankfurt Airport 1h 25m"
  const layoverMatches = [...text.matchAll(/(?:\d+\s+)?stop(?:s)?\s+in\s+([A-Za-z\s]+?)\s+(\d+)h\s*(\d+)m/gi)];
  
  // Add duration to segments if available
  if (durationMatches.length > 0) {
    // Total durations for each journey leg (not individual flights)
    // For individual flights, we need to calculate from times
  }
  
  // Calculate duration for each segment from departure/arrival times
  for (const segment of segments) {
    if (segment.departureTimeScheduled && segment.arrivalTimeScheduled) {
      const [depH, depM] = segment.departureTimeScheduled.split(":").map(Number);
      const [arrH, arrM] = segment.arrivalTimeScheduled.split(":").map(Number);
      
      let durationMins = (arrH * 60 + arrM) - (depH * 60 + depM);
      
      // If negative, flight crosses midnight
      if (durationMins < 0) {
        durationMins += 24 * 60;
      }
      
      // Also check if dates are different
      if (segment.departureDate && segment.arrivalDate && segment.departureDate !== segment.arrivalDate) {
        const depDate = new Date(segment.departureDate);
        const arrDate = new Date(segment.arrivalDate);
        const daysDiff = Math.floor((arrDate.getTime() - depDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff > 0) {
          durationMins += daysDiff * 24 * 60;
        }
      }
      
      const hours = Math.floor(durationMins / 60);
      const mins = durationMins % 60;
      segment.duration = `${hours}h ${mins.toString().padStart(2, "0")}m`;
    }
  }
  
  // Parse baggage info - convert to standard format
  let baggage = "";
  const hasPersonal = text.match(/personal\s*item/i);
  const hasCarryOn = text.match(/carry-on/i);
  const checkedBagsMatch = text.match(/(\d+)x?\s*checked\s*bag/i);
  const numCheckedBags = checkedBagsMatch ? parseInt(checkedBagsMatch[1]) : 0;
  
  if (hasPersonal && hasCarryOn && numCheckedBags > 0) {
    baggage = numCheckedBags === 1 ? "personal+cabin+1bag" : `personal+cabin+${numCheckedBags}bags`;
  } else if (hasPersonal && hasCarryOn) {
    baggage = "personal+cabin";
  } else if (hasPersonal) {
    baggage = "personal";
  }
  
  // Apply baggage to all segments
  if (baggage) {
    for (const segment of segments) {
      segment.baggage = baggage;
    }
  }
  
  // Detect cabin class more precisely - look for "Economy Flex", "Business", etc.
  // Only use explicit cabin class mentions, not words like "First Name" or "First Flight"
  let detectedCabinClass: "economy" | "premium_economy" | "business" | "first" | undefined = undefined;
  const cabinClassMatch = text.match(/\b(Economy(?:\s+Flex)?|Business(?:\s+Class)?|First(?:\s+Class)?|Premium\s+Economy)\b/i);
  if (cabinClassMatch) {
    const cls = cabinClassMatch[1].toLowerCase();
    // Only set if it's a clear cabin class mention
    // For "first" - ONLY if it's "first class" explicitly, not just "first"
    if (cls === "first class" || cls.startsWith("first class")) {
      detectedCabinClass = "first";
    } else if (cls.includes("business")) {
      detectedCabinClass = "business";
    } else if (cls.includes("premium")) {
      detectedCabinClass = "premium_economy";
    } else if (cls.includes("economy")) {
      detectedCabinClass = "economy";
    }
    // If just "first" without "class", don't set it - likely not a cabin class
  }
  
  // Update segments with cabin class - only if detected, otherwise keep existing or default to economy
  for (const segment of segments) {
    if (!segment.cabinClass) {
      segment.cabinClass = detectedCabinClass || "economy";
    }
  }
  
  return {
    success: true,
    segments,
    booking: {
      bookingRef: bookingRefMatch?.[1] || "",
      airline: "Lufthansa",
      totalPrice: priceMatch ? parseFloat(priceMatch[1].replace(",", ".")) : null,
      currency: "EUR",
      ticketNumbers: ticketMatch ? [ticketMatch[1]] : [],
      cabinClass: detectedCabinClass ?? "economy",
      refundPolicy: detectRefundPolicy(text),
      baggage,
      passengerName,
    },
    parser: "lufthansa",
  };
}

// Helper to get IATA code from city name
function getIATAFromCity(city: string): string {
  const cityMap: Record<string, string> = {
    // Baltic States
    "tallinn": "TLL",
    "riga": "RIX",
    "vilnius": "VNO",
    "kaunas": "KUN",
    "palanga": "PLQ",
    
    // Scandinavia
    "helsinki": "HEL",
    "stockholm": "ARN",
    "oslo": "OSL",
    "copenhagen": "CPH",
    "gothenburg": "GOT",
    "malmö": "MMX",
    "malmo": "MMX",
    "bergen": "BGO",
    "tampere": "TMP",
    "turku": "TKU",
    
    // Germany
    "frankfurt": "FRA",
    "munich": "MUC",
    "berlin": "BER",
    "hamburg": "HAM",
    "düsseldorf": "DUS",
    "dusseldorf": "DUS",
    "cologne": "CGN",
    "köln": "CGN",
    "koln": "CGN",
    "stuttgart": "STR",
    "hannover": "HAJ",
    "nuremberg": "NUE",
    "nürnberg": "NUE",
    "leipzig": "LEJ",
    "dresden": "DRS",
    "bremen": "BRE",
    
    // France
    "paris": "CDG",
    "nice": "NCE",
    "lyon": "LYS",
    "marseille": "MRS",
    "toulouse": "TLS",
    "bordeaux": "BOD",
    "nantes": "NTE",
    "strasbourg": "SXB",
    "montpellier": "MPL",
    "lille": "LIL",
    
    // UK & Ireland
    "london": "LHR",
    "manchester": "MAN",
    "birmingham": "BHX",
    "edinburgh": "EDI",
    "glasgow": "GLA",
    "bristol": "BRS",
    "liverpool": "LPL",
    "newcastle": "NCL",
    "belfast": "BFS",
    "dublin": "DUB",
    "cork": "ORK",
    "shannon": "SNN",
    
    // Benelux
    "amsterdam": "AMS",
    "brussels": "BRU",
    "luxembourg": "LUX",
    "eindhoven": "EIN",
    "rotterdam": "RTM",
    "antwerp": "ANR",
    
    // Central Europe
    "zurich": "ZRH",
    "geneva": "GVA",
    "basel": "BSL",
    "bern": "BRN",
    "vienna": "VIE",
    "salzburg": "SZG",
    "innsbruck": "INN",
    "prague": "PRG",
    "budapest": "BUD",
    "warsaw": "WAW",
    "krakow": "KRK",
    "kraków": "KRK",
    "gdansk": "GDN",
    "gdańsk": "GDN",
    "wroclaw": "WRO",
    "wrocław": "WRO",
    "poznan": "POZ",
    "poznań": "POZ",
    "bratislava": "BTS",
    "ljubljana": "LJU",
    "zagreb": "ZAG",
    
    // Southern Europe
    "milan": "MXP",
    "milano": "MXP",
    "rome": "FCO",
    "roma": "FCO",
    "venice": "VCE",
    "venezia": "VCE",
    "florence": "FLR",
    "firenze": "FLR",
    "naples": "NAP",
    "napoli": "NAP",
    "bologna": "BLQ",
    "turin": "TRN",
    "torino": "TRN",
    "pisa": "PSA",
    "verona": "VRN",
    "palermo": "PMO",
    "catania": "CTA",
    "bari": "BRI",
    
    // Spain & Portugal
    "barcelona": "BCN",
    "madrid": "MAD",
    "malaga": "AGP",
    "málaga": "AGP",
    "valencia": "VLC",
    "seville": "SVQ",
    "sevilla": "SVQ",
    "bilbao": "BIO",
    "alicante": "ALC",
    "palma": "PMI",
    "mallorca": "PMI",
    "ibiza": "IBZ",
    "tenerife": "TFS",
    "gran canaria": "LPA",
    "lisbon": "LIS",
    "porto": "OPO",
    "faro": "FAO",
    
    // Greece & Cyprus
    "athens": "ATH",
    "thessaloniki": "SKG",
    "heraklion": "HER",
    "crete": "HER",
    "rhodes": "RHO",
    "corfu": "CFU",
    "santorini": "JTR",
    "mykonos": "JMK",
    "larnaca": "LCA",
    "paphos": "PFO",
    "nicosia": "NIC",
    
    // Turkey & Middle East
    "istanbul": "IST",
    "ankara": "ESB",
    "antalya": "AYT",
    "izmir": "ADB",
    "bodrum": "BJV",
    "dubai": "DXB",
    "abu dhabi": "AUH",
    "doha": "DOH",
    "riyadh": "RUH",
    "jeddah": "JED",
    "tel aviv": "TLV",
    "amman": "AMM",
    "beirut": "BEY",
    "cairo": "CAI",
    "sharm el sheikh": "SSH",
    "hurghada": "HRG",
    
    // Russia & CIS
    "moscow": "SVO",
    "moskva": "SVO",
    "st petersburg": "LED",
    "saint petersburg": "LED",
    "kiev": "KBP",
    "kyiv": "KBP",
    "minsk": "MSQ",
    "tbilisi": "TBS",
    "baku": "GYD",
    "yerevan": "EVN",
    "almaty": "ALA",
    "tashkent": "TAS",
    
    // Asia
    "singapore": "SIN",
    "hong kong": "HKG",
    "tokyo": "NRT",
    "narita": "NRT",
    "haneda": "HND",
    "osaka": "KIX",
    "seoul": "ICN",
    "incheon": "ICN",
    "beijing": "PEK",
    "shanghai": "PVG",
    "guangzhou": "CAN",
    "shenzhen": "SZX",
    "taipei": "TPE",
    "bangkok": "BKK",
    "phuket": "HKT",
    "kuala lumpur": "KUL",
    "jakarta": "CGK",
    "bali": "DPS",
    "denpasar": "DPS",
    "manila": "MNL",
    "ho chi minh": "SGN",
    "saigon": "SGN",
    "hanoi": "HAN",
    "mumbai": "BOM",
    "delhi": "DEL",
    "new delhi": "DEL",
    "bangalore": "BLR",
    "chennai": "MAA",
    "kolkata": "CCU",
    "male": "MLE",
    "maldives": "MLE",
    "colombo": "CMB",
    "kathmandu": "KTM",
    
    // North America
    "new york": "JFK",
    "los angeles": "LAX",
    "chicago": "ORD",
    "miami": "MIA",
    "san francisco": "SFO",
    "washington": "IAD",
    "boston": "BOS",
    "seattle": "SEA",
    "las vegas": "LAS",
    "orlando": "MCO",
    "atlanta": "ATL",
    "dallas": "DFW",
    "houston": "IAH",
    "denver": "DEN",
    "phoenix": "PHX",
    "detroit": "DTW",
    "minneapolis": "MSP",
    "philadelphia": "PHL",
    "toronto": "YYZ",
    "montreal": "YUL",
    "vancouver": "YVR",
    "calgary": "YYC",
    "mexico city": "MEX",
    "cancun": "CUN",
    
    // South America
    "sao paulo": "GRU",
    "são paulo": "GRU",
    "rio de janeiro": "GIG",
    "buenos aires": "EZE",
    "santiago": "SCL",
    "lima": "LIM",
    "bogota": "BOG",
    "bogotá": "BOG",
    "caracas": "CCS",
    
    // Africa
    "johannesburg": "JNB",
    "cape town": "CPT",
    "nairobi": "NBO",
    "casablanca": "CMN",
    "marrakech": "RAK",
    "tunis": "TUN",
    "lagos": "LOS",
    "addis ababa": "ADD",
    
    // Australia & Oceania
    "sydney": "SYD",
    "melbourne": "MEL",
    "brisbane": "BNE",
    "perth": "PER",
    "auckland": "AKL",
    "wellington": "WLG",
    "fiji": "NAN",
  };
  return cityMap[city.toLowerCase().trim()] || "";
}

// Helper to get city name from IATA code
function getCityFromIATA(code: string): string {
  const iataMap: Record<string, string> = {
    // Major European hubs
    "LHR": "London", "LGW": "London", "STN": "London", "LTN": "London", "LCY": "London",
    "CDG": "Paris", "ORY": "Paris",
    "FRA": "Frankfurt", "MUC": "Munich", "TXL": "Berlin", "BER": "Berlin", "HAM": "Hamburg", "DUS": "Düsseldorf", "CGN": "Cologne", "STR": "Stuttgart",
    "AMS": "Amsterdam", "BRU": "Brussels", "LUX": "Luxembourg",
    "ZRH": "Zurich", "GVA": "Geneva",
    "VIE": "Vienna", "PRG": "Prague", "BUD": "Budapest", "WAW": "Warsaw", "KRK": "Krakow",
    "MAD": "Madrid", "BCN": "Barcelona", "AGP": "Malaga", "VLC": "Valencia", "PMI": "Palma",
    "LIS": "Lisbon", "OPO": "Porto", "FAO": "Faro",
    "FCO": "Rome", "MXP": "Milan", "LIN": "Milan", "VCE": "Venice", "FLR": "Florence", "NAP": "Naples", "BGY": "Bergamo",
    "ATH": "Athens", "SKG": "Thessaloniki", "HER": "Heraklion", "RHO": "Rhodes", "JTR": "Santorini",
    "LCA": "Larnaca", "PFO": "Paphos",
    "IST": "Istanbul", "SAW": "Istanbul", "AYT": "Antalya", "ADB": "Izmir",
    // France
    "NCE": "Nice", "LYS": "Lyon", "MRS": "Marseille", "TLS": "Toulouse", "BOD": "Bordeaux", "NTE": "Nantes",
    // Nordics
    "HEL": "Helsinki", "ARN": "Stockholm", "GOT": "Gothenburg", "OSL": "Oslo", "BGO": "Bergen", "CPH": "Copenhagen",
    // Baltic
    "TLL": "Tallinn", "RIX": "Riga", "VNO": "Vilnius", "KUN": "Kaunas", "PLQ": "Palanga",
    // Russia & CIS
    "SVO": "Moscow", "DME": "Moscow", "VKO": "Moscow", "LED": "St Petersburg",
    "KBP": "Kyiv", "MSQ": "Minsk", "TBS": "Tbilisi", "EVN": "Yerevan", "GYD": "Baku",
    // Middle East
    "DXB": "Dubai", "AUH": "Abu Dhabi", "DOH": "Doha", "TLV": "Tel Aviv", "CAI": "Cairo", "AMM": "Amman",
    // Asia
    "SIN": "Singapore", "HKG": "Hong Kong", "NRT": "Tokyo", "HND": "Tokyo", "ICN": "Seoul",
    "PEK": "Beijing", "PVG": "Shanghai", "BKK": "Bangkok", "KUL": "Kuala Lumpur", "DPS": "Bali",
    "DEL": "Delhi", "BOM": "Mumbai",
    // Americas
    "JFK": "New York", "EWR": "New York", "LGA": "New York", "LAX": "Los Angeles", "ORD": "Chicago",
    "MIA": "Miami", "SFO": "San Francisco", "BOS": "Boston", "DFW": "Dallas", "ATL": "Atlanta",
    "YYZ": "Toronto", "YVR": "Vancouver", "YUL": "Montreal",
    "GRU": "São Paulo", "GIG": "Rio de Janeiro", "EZE": "Buenos Aires", "SCL": "Santiago", "LIM": "Lima", "BOG": "Bogotá",
    "MEX": "Mexico City", "CUN": "Cancún",
    // Africa
    "JNB": "Johannesburg", "CPT": "Cape Town", "NBO": "Nairobi", "CMN": "Casablanca", "RAK": "Marrakech",
    // Australia
    "SYD": "Sydney", "MEL": "Melbourne", "BNE": "Brisbane", "PER": "Perth", "AKL": "Auckland",
  };
  return iataMap[code.toUpperCase()] || "";
}

// Get timezone offset in hours for airport (for travel time calculations)
// Returns offset from UTC (e.g., Paris = +1, London = 0, Dubai = +4)
export function getAirportTimezoneOffset(code: string | undefined): number {
  if (!code) return 0;
  const tzMap: Record<string, number> = {
    // UK & Ireland (UTC+0, summer UTC+1 - using winter time)
    "LHR": 0, "LGW": 0, "STN": 0, "LTN": 0, "LCY": 0, "MAN": 0, "EDI": 0, "BHX": 0, "BRS": 0, "GLA": 0,
    "DUB": 0, "SNN": 0, "ORK": 0,
    // Western Europe (UTC+1)
    "CDG": 1, "ORY": 1, "NCE": 1, "LYS": 1, "MRS": 1, "TLS": 1, "BOD": 1, "NTE": 1,
    "AMS": 1, "BRU": 1, "LUX": 1,
    "FRA": 1, "MUC": 1, "BER": 1, "TXL": 1, "HAM": 1, "DUS": 1, "CGN": 1, "STR": 1,
    "ZRH": 1, "GVA": 1, "BSL": 1,
    "VIE": 1, "PRG": 1, "BUD": 1, "WAW": 1, "KRK": 1,
    "MAD": 1, "BCN": 1, "AGP": 1, "VLC": 1, "PMI": 1, "IBZ": 1, "ALC": 1,
    "FCO": 1, "MXP": 1, "LIN": 1, "VCE": 1, "FLR": 1, "NAP": 1, "BGY": 1,
    // Portugal (UTC+0)
    "LIS": 0, "OPO": 0, "FAO": 0,
    // Greece & Cyprus (UTC+2)
    "ATH": 2, "SKG": 2, "HER": 2, "RHO": 2, "JTR": 2, "CFU": 2,
    "LCA": 2, "PFO": 2,
    // Eastern Europe & Baltic (UTC+2)
    "TLL": 2, "RIX": 2, "VNO": 2, "KUN": 2,
    "KBP": 2, "ODS": 2,
    "OTP": 2, "SOF": 2,
    // Finland (UTC+2)
    "HEL": 2,
    // Turkey (UTC+3)
    "IST": 3, "SAW": 3, "AYT": 3, "ADB": 3, "ESB": 3,
    // Russia (UTC+3 Moscow)
    "SVO": 3, "DME": 3, "VKO": 3, "LED": 3,
    // Middle East (UTC+3 to +4)
    "DXB": 4, "AUH": 4, "DOH": 3, "BAH": 3, "KWI": 3, "MCT": 4,
    "TLV": 2, "AMM": 2, "BEY": 2, "CAI": 2,
    // Scandinavia (UTC+1)
    "ARN": 1, "GOT": 1, "OSL": 1, "BGO": 1, "CPH": 1,
    // Belarus & Georgia (UTC+3)
    "MSQ": 3, "TBS": 4, "EVN": 4, "GYD": 4,
    // Asia
    "SIN": 8, "HKG": 8, "BKK": 7, "KUL": 8,
    "NRT": 9, "HND": 9, "ICN": 9,
    "PEK": 8, "PVG": 8, "CAN": 8,
    "DEL": 5.5, "BOM": 5.5, "BLR": 5.5,
    "DPS": 8, "CGK": 7,
    // Americas (negative offsets)
    "JFK": -5, "EWR": -5, "LGA": -5, "BOS": -5, "PHL": -5, "DCA": -5, "IAD": -5,
    "ORD": -6, "DFW": -6, "IAH": -6, "MSP": -6,
    "LAX": -8, "SFO": -8, "SEA": -8, "LAS": -8, "PHX": -7,
    "MIA": -5, "FLL": -5, "TPA": -5, "MCO": -5, "ATL": -5,
    "DEN": -7,
    "YYZ": -5, "YVR": -8, "YUL": -5, "YYC": -7,
    "MEX": -6, "CUN": -5,
    "GRU": -3, "GIG": -3, "EZE": -3, "SCL": -4, "LIM": -5, "BOG": -5,
    // Africa
    "JNB": 2, "CPT": 2, "NBO": 3, "CMN": 1, "RAK": 1,
    // Australia & NZ
    "SYD": 11, "MEL": 11, "BNE": 10, "PER": 8, "AKL": 13,
  };
  return tzMap[code.toUpperCase()] ?? 0;
}

// ============================================
// AIR FRANCE (AF)
// ============================================
function parseAirFrance(text: string): ParseResult | null {
  if (!text.includes("Air France") && !text.includes("AIR FRANCE") && !text.match(/AF\s?\d{3,4}/i)) {
    return null;
  }
  
  // Skip if this is an Amadeus PNR format (let parseAmadeus handle it)
  // PNR format: "2  AF7303 I 28JAN 3 NCECDG HK1  1100 1235"
  const isPNRFormat = text.match(/^\s*\d+\s+[A-Z]{2}\d{3,4}\s+[A-Z]\s+\d{1,2}[A-Z]{3}\s+\d\s+[A-Z]{6}\s+[A-Z]{2}\d/m);
  if (isPNRFormat) {
    return null; // Let parseAmadeus handle this
  }
  
  // Try GDS format first (BOOKING REF: + FLIGHT AF xxxx - AIR FRANCE)
  // Note: There can be spaces between AF and flight number (e.g., "AF 7303")
  const hasGDSFormat = text.match(/BOOKING\s+REF:/i) && text.match(/FLIGHT\s+AF\s+\d{3,4}\s*-\s*AIR FRANCE/i);
  
  if (hasGDSFormat) {
    const bookingRefMatch = text.match(/BOOKING\s+REF:\s*([A-Z0-9]{6})/i);
    
    // Extract ticket: TICKET: KL/ETKT 074 2796062312 FOR VELINSKI/KATERINA
    const ticketMatch = text.match(/TICKET:\s*[A-Z]{2}\/ETKT\s*(\d{3})\s*(\d{10})/i);
    const ticketNumber = ticketMatch ? `${ticketMatch[1]}-${ticketMatch[2]}` : undefined;
    
    // Extract passenger from header: VELINSKI/KATERINA MRS (on separate line)
    const passengerMatch = text.match(/^\s*([A-Z]+)\/([A-Z]+)\s+(?:MRS?|MS|MISS|DR)\s*$/im);
    const passengerName = passengerMatch ? `${passengerMatch[2]} ${passengerMatch[1]}` : undefined;
    
    const segments: ParsedSegment[] = [];
    
    // Split by FLIGHT sections - handle spaces between AF and number
    const flightSections = text.split(/(?=FLIGHT\s+AF\s+\d{3,4}\s*-\s*AIR FRANCE)/i);
    
    for (let i = 0; i < flightSections.length; i++) {
      const section = flightSections[i];
      
      // Match: FLIGHT     AF 7303 - AIR FRANCE                           WED 28 JANUARY 2026
      // Note: Flight number has space: "AF 7303" not "AF7303"
      const flightMatch = section.match(/FLIGHT\s+AF\s+(\d{3,4})\s*-\s*AIR FRANCE\s+[A-Z]{3}\s+(\d{1,2})\s+([A-Z]+)\s+(\d{4})/i);
      if (!flightMatch) continue;
      
      const flightNum = flightMatch[1];
      const day = flightMatch[2];
      const monthStr = flightMatch[3].toLowerCase();
      const year = flightMatch[4];
      
      const month = MONTHS[monthStr] || MONTHS[monthStr.slice(0, 3)];
      const depDate = month ? `${year}-${month}-${day.padStart(2, "0")}` : "";
      
      // Parse departure: DEPARTURE: NICE, FR (COTE D AZUR), TERMINAL 2       28 JAN 11:00
      const depMatch = section.match(/DEPARTURE:\s*([A-Z][A-Z\s]*?),\s*[A-Z]{2}\s*\([^)]+\)(?:[^0-9]*TERMINAL\s*([A-Z0-9]+))?[^0-9]*(\d{1,2})\s+[A-Z]{3}\s+(\d{1,2}):(\d{2})/i);
      
      // Parse arrival: ARRIVAL:   PARIS, FR (CHARLES DE GAULLE), TERMINAL 2F     28 JAN 12:35
      const arrMatch = section.match(/ARRIVAL:\s*([A-Z][A-Z\s]*?),\s*[A-Z]{2}\s*\([^)]+\)(?:[^0-9]*TERMINAL\s*([A-Z0-9]+))?[^0-9]*(\d{1,2})\s+[A-Z]{3}\s+(\d{1,2}):(\d{2})/i);
      
      if (!depMatch || !arrMatch) continue;
      
      const depCity = depMatch[1].trim();
      const arrCity = arrMatch[1].trim();
      const depCode = getIATAFromCity(depCity) || depCity.slice(0, 3).toUpperCase();
      const arrCode = getIATAFromCity(arrCity) || arrCity.slice(0, 3).toUpperCase();
      
      const depTime = `${depMatch[4].padStart(2, "0")}:${depMatch[5]}`;
      const arrTime = `${arrMatch[4].padStart(2, "0")}:${arrMatch[5]}`;
      
      // Arrival date might be different
      const arrDay = arrMatch[3];
      let arrDate = depDate;
      if (arrDay !== day && month) {
        arrDate = `${year}-${month}-${arrDay.padStart(2, "0")}`;
      }
      
      // Parse cabin class: RESERVATION CONFIRMED, BUSINESS (I)
      const cabinMatch = section.match(/RESERVATION\s+CONFIRMED,\s*(ECONOMY|BUSINESS|FIRST(?:\s+CLASS)?|PREMIUM(?:\s+ECONOMY)?)/i);
      // If cabinMatch found "FIRST", check if it's "FIRST CLASS" or just "FIRST"
      let cabinClass: "economy" | "premium_economy" | "business" | "first" | undefined = undefined;
      if (cabinMatch) {
        const matchedClass = cabinMatch[1].toUpperCase();
        if (matchedClass === "ECONOMY") {
          cabinClass = "economy";
        } else if (matchedClass === "BUSINESS") {
          cabinClass = "business";
        } else if (matchedClass === "FIRST CLASS" || matchedClass.startsWith("FIRST CLASS")) {
          cabinClass = "first";
        } else if (matchedClass === "FIRST") {
          // Only set to "first" if it's explicitly "FIRST CLASS" in the match
          // If just "FIRST", check the full section for "FIRST CLASS"
          if (section.match(/FIRST\s+CLASS/i)) {
            cabinClass = "first";
          } else {
            // Just "FIRST" without "CLASS" - likely not a cabin class, default to economy
            cabinClass = "economy";
          }
        } else if (matchedClass.includes("PREMIUM")) {
          cabinClass = "premium_economy";
        }
      }
      // Fallback to detectCabinClass if no match
      if (!cabinClass) {
        cabinClass = detectCabinClass(section);
      }
      
      // Parse baggage: BAGGAGE ALLOWANCE: 2PC - convert to standard format
      const baggageMatch = section.match(/BAGGAGE\s+ALLOWANCE:\s*(\d+)PC/i);
      let baggage = "";
      if (baggageMatch) {
        const pieces = parseInt(baggageMatch[1]);
        if (pieces === 0) baggage = "personal+cabin";
        else if (pieces === 1) baggage = "personal+cabin+1bag";
        else baggage = `personal+cabin+${pieces}bags`;
      }
      
      // Parse duration: DURATION: 01:35
      const durationMatch = section.match(/DURATION:\s*(\d{1,2}):(\d{2})/i);
      const duration = durationMatch ? `${durationMatch[1]}h ${durationMatch[2]}m` : undefined;
      
      segments.push({
        id: `seg-${Date.now()}-${i}`,
        flightNumber: `AF${flightNum}`,
        airline: "Air France",
        departure: depCode,
        departureCity: depCity,
        arrival: arrCode,
        arrivalCity: arrCity,
        departureDate: depDate,
        departureTimeScheduled: depTime,
        arrivalDate: arrDate,
        arrivalTimeScheduled: arrTime,
        departureTerminal: depMatch[2] ? `Terminal ${depMatch[2]}` : undefined,
        arrivalTerminal: arrMatch[2] ? `Terminal ${arrMatch[2]}` : undefined,
        duration,
        cabinClass,
        baggage,
        bookingRef: bookingRefMatch?.[1],
        ticketNumber,
      });
    }
    
    if (segments.length > 0) {
      // Remove duplicates
      const uniqueSegments = segments.filter((seg, idx, arr) => 
        arr.findIndex(s => s.flightNumber === seg.flightNumber && s.departureDate === seg.departureDate) === idx
      );
      
      return {
        success: true,
        segments: uniqueSegments,
        booking: {
          bookingRef: bookingRefMatch?.[1] || "",
          airline: "Air France",
          totalPrice: null,
          currency: "EUR",
          ticketNumbers: ticketNumber ? [ticketNumber] : [],
          cabinClass: uniqueSegments[0]?.cabinClass || "economy",
          refundPolicy: "non_ref",
          baggage: uniqueSegments[0]?.baggage || "",
          passengerName,
        },
        parser: "air_france_gds",
      };
    }
  }
  
  // Fallback: Standard Air France format
  const bookingRefMatch = text.match(/(?:Booking\s+reference|Référence)[\s:]+([A-Z0-9]{6})/i);
  const ticketMatch = text.match(/(?:Ticket|Billet)[\s:]+(\d{13})/i);
  const priceMatch = text.match(/(?:Total|Montant)[\s:]+(?:EUR|€)\s*([\d.,]+)/i);
  
  // Match flight numbers but NOT Frequent Flyer numbers (AF-AF5318...)
  // Flight pattern: AF followed by 3-4 digits, NOT preceded by "AF-" or "AF/"
  const flightPattern = /(?<!AF[-\/])AF\s?(\d{3,4})(?!\d)/gi;
  const segments: ParsedSegment[] = [];
  let flightMatch;
  const matches: string[] = [];
  
  while ((flightMatch = flightPattern.exec(text)) !== null) {
    // Skip if this looks like a frequent flyer number (long digit sequences)
    const contextStart = Math.max(0, flightMatch.index - 20);
    const context = text.slice(contextStart, flightMatch.index);
    if (context.includes("FREQUENT") || context.includes("TRAVELLER") || context.includes("AF-AF")) {
      continue;
    }
    matches.push(flightMatch[1]);
  }
  
  const routePattern = /([A-Z]{3})\s*[-–→]\s*([A-Z]{3})/g;
  const routes: { from: string; to: string }[] = [];
  let routeMatch;
  while ((routeMatch = routePattern.exec(text)) !== null) {
    routes.push({ from: routeMatch[1], to: routeMatch[2] });
  }
  
  const datePattern = /(\d{1,2}[.\/]\d{1,2}[.\/]\d{4}|\d{1,2}\s+\w+\s+\d{4})/g;
  const dates: string[] = [];
  let dateMatch;
  while ((dateMatch = datePattern.exec(text)) !== null) {
    const parsed = parseDate(dateMatch[1]);
    if (parsed) dates.push(parsed);
  }
  
  const timePattern = /(\d{1,2}:\d{2})/g;
  const times: string[] = [];
  let timeMatch;
  while ((timeMatch = timePattern.exec(text)) !== null) {
    times.push(timeMatch[1]);
  }
  
  for (let i = 0; i < matches.length; i++) {
    const route = routes[i] || { from: "", to: "" };
    segments.push({
      id: `seg-${Date.now()}-${i}`,
      flightNumber: `AF${matches[i]}`,
      airline: "Air France",
      departure: route.from,
      arrival: route.to,
      departureDate: dates[i * 2] || dates[0] || "",
      departureTimeScheduled: parseTime(times[i * 2] || "") || "",
      arrivalDate: dates[i * 2 + 1] || dates[i * 2] || dates[0] || "",
      arrivalTimeScheduled: parseTime(times[i * 2 + 1] || "") || "",
      cabinClass: detectCabinClass(text),
      bookingRef: bookingRefMatch?.[1],
    });
  }
  
  if (segments.length === 0) return null;
  
  return {
    success: true,
    segments,
    booking: {
      bookingRef: bookingRefMatch?.[1] || "",
      airline: "Air France",
      totalPrice: priceMatch ? parseFloat(priceMatch[1].replace(",", ".")) : null,
      currency: "EUR",
      ticketNumbers: ticketMatch ? [ticketMatch[1]] : [],
      cabinClass: segments[0]?.cabinClass || "economy",
      refundPolicy: detectRefundPolicy(text),
      baggage: parseBaggage(text, segments[0]?.cabinClass),
    },
    parser: "air_france",
  };
}

// ============================================
// KLM (KL)
// ============================================
function parseKLM(text: string): ParseResult | null {
  if (!text.includes("KLM") && !text.match(/KL\s?\d{3,4}/i)) {
    return null;
  }
  
  const bookingRefMatch = text.match(/(?:Booking\s+code|Reserveringscode)[\s:]+([A-Z0-9]{6})/i);
  const ticketMatch = text.match(/(?:Ticket|E-ticket)[\s:]+(\d{13})/i);
  const priceMatch = text.match(/(?:Total|Totaal)[\s:]+(?:EUR|€)\s*([\d.,]+)/i);
  
  const flightPattern = /KL\s?(\d{3,4})/gi;
  const segments: ParsedSegment[] = [];
  let flightMatch;
  const matches: string[] = [];
  
  while ((flightMatch = flightPattern.exec(text)) !== null) {
    matches.push(flightMatch[1]);
  }
  
  const routePattern = /([A-Z]{3})\s*[-–→]\s*([A-Z]{3})/g;
  const routes: { from: string; to: string }[] = [];
  let routeMatch;
  while ((routeMatch = routePattern.exec(text)) !== null) {
    routes.push({ from: routeMatch[1], to: routeMatch[2] });
  }
  
  const datePattern = /(\d{1,2}[.\/]\d{1,2}[.\/]\d{4}|\d{1,2}\s+\w+\s+\d{4})/g;
  const dates: string[] = [];
  let dateMatch;
  while ((dateMatch = datePattern.exec(text)) !== null) {
    const parsed = parseDate(dateMatch[1]);
    if (parsed) dates.push(parsed);
  }
  
  const timePattern = /(\d{1,2}:\d{2})/g;
  const times: string[] = [];
  let timeMatch;
  while ((timeMatch = timePattern.exec(text)) !== null) {
    times.push(timeMatch[1]);
  }
  
  for (let i = 0; i < matches.length; i++) {
    const route = routes[i] || { from: "", to: "" };
    segments.push({
      id: `seg-${Date.now()}-${i}`,
      flightNumber: `KL${matches[i]}`,
      airline: "KLM",
      departure: route.from,
      arrival: route.to,
      departureDate: dates[i * 2] || dates[0] || "",
      departureTimeScheduled: parseTime(times[i * 2] || "") || "",
      arrivalDate: dates[i * 2 + 1] || dates[i * 2] || dates[0] || "",
      arrivalTimeScheduled: parseTime(times[i * 2 + 1] || "") || "",
      cabinClass: detectCabinClass(text),
      bookingRef: bookingRefMatch?.[1],
    });
  }
  
  if (segments.length === 0) return null;
  
  return {
    success: true,
    segments,
    booking: {
      bookingRef: bookingRefMatch?.[1] || "",
      airline: "KLM",
      totalPrice: priceMatch ? parseFloat(priceMatch[1].replace(",", ".")) : null,
      currency: "EUR",
      ticketNumbers: ticketMatch ? [ticketMatch[1]] : [],
      cabinClass: segments[0]?.cabinClass || "economy",
      refundPolicy: detectRefundPolicy(text),
      baggage: parseBaggage(text, segments[0]?.cabinClass),
    },
    parser: "klm",
  };
}

// ============================================
// AIRBALTIC (BT)
// ============================================
function parseAirBaltic(text: string): ParseResult | null {
  if (!text.includes("airBaltic") && !text.match(/BT\s?\d{3,4}/i)) {
    return null;
  }
  // Skip Amadeus PNR/GDS format — let parseAmadeus handle it
  if (text.match(/RP\/[A-Z0-9]+\//) || text.match(/\d\s+[A-Z]{2}\s*\d{3,4}\s+[A-Z]\s+\d{1,2}[A-Z]{3}\s+\d\s+[A-Z]{6}\s+HK/)) {
    return null;
  }
  
  const bookingRefMatch = text.match(/(?:Booking\s+reference|Reservation)[\s:]+([A-Z0-9]{6})/i);
  const ticketMatch = text.match(/(?:Ticket|E-ticket)[\s:]+(\d{13})/i);
  const priceMatch = text.match(/(?:Total|Amount)[\s:]+(?:EUR|€)\s*([\d.,]+)/i);
  
  const flightPattern = /BT\s?(\d{3,4})/gi;
  const segments: ParsedSegment[] = [];
  let flightMatch;
  const matches: string[] = [];
  
  while ((flightMatch = flightPattern.exec(text)) !== null) {
    matches.push(flightMatch[1]);
  }
  
  const routePattern = /([A-Z]{3})\s*[-–→]\s*([A-Z]{3})/g;
  const routes: { from: string; to: string }[] = [];
  let routeMatch;
  while ((routeMatch = routePattern.exec(text)) !== null) {
    routes.push({ from: routeMatch[1], to: routeMatch[2] });
  }
  
  const datePattern = /(\d{1,2}[.\/]\d{1,2}[.\/]\d{4}|\d{1,2}\s+\w+\s+\d{4})/g;
  const dates: string[] = [];
  let dateMatch;
  while ((dateMatch = datePattern.exec(text)) !== null) {
    const parsed = parseDate(dateMatch[1]);
    if (parsed) dates.push(parsed);
  }
  
  const timePattern = /(\d{1,2}:\d{2})/g;
  const times: string[] = [];
  let timeMatch;
  while ((timeMatch = timePattern.exec(text)) !== null) {
    times.push(timeMatch[1]);
  }
  
  for (let i = 0; i < matches.length; i++) {
    const route = routes[i] || { from: "", to: "" };
    segments.push({
      id: `seg-${Date.now()}-${i}`,
      flightNumber: `BT${matches[i]}`,
      airline: "airBaltic",
      departure: route.from,
      arrival: route.to,
      departureDate: dates[i * 2] || dates[0] || "",
      departureTimeScheduled: parseTime(times[i * 2] || "") || "",
      arrivalDate: dates[i * 2 + 1] || dates[i * 2] || dates[0] || "",
      arrivalTimeScheduled: parseTime(times[i * 2 + 1] || "") || "",
      cabinClass: detectCabinClass(text),
      bookingRef: bookingRefMatch?.[1],
    });
  }
  
  if (segments.length === 0) return null;
  
  return {
    success: true,
    segments,
    booking: {
      bookingRef: bookingRefMatch?.[1] || "",
      airline: "airBaltic",
      totalPrice: priceMatch ? parseFloat(priceMatch[1].replace(",", ".")) : null,
      currency: "EUR",
      ticketNumbers: ticketMatch ? [ticketMatch[1]] : [],
      cabinClass: segments[0]?.cabinClass || "economy",
      refundPolicy: detectRefundPolicy(text),
      baggage: parseBaggage(text, segments[0]?.cabinClass),
    },
    parser: "airbaltic",
  };
}

// ============================================
// LOT POLISH AIRLINES (LO)
// ============================================
function parseLOT(text: string): ParseResult | null {
  if (!text.includes("LOT Polish") && !text.match(/LO\s?\d{3,4}/i)) {
    return null;
  }
  
  const bookingRefMatch = text.match(/(?:Booking|Rezerwacja)[\s:]+([A-Z0-9]{6})/i);
  const ticketMatch = text.match(/(?:Ticket|Bilet)[\s:]+(\d{13})/i);
  const priceMatch = text.match(/(?:Total|Suma)[\s:]+(?:EUR|PLN|€)\s*([\d.,]+)/i);
  
  const flightPattern = /LO\s?(\d{3,4})/gi;
  const segments: ParsedSegment[] = [];
  let flightMatch;
  const matches: string[] = [];
  
  while ((flightMatch = flightPattern.exec(text)) !== null) {
    matches.push(flightMatch[1]);
  }
  
  const routePattern = /([A-Z]{3})\s*[-–→]\s*([A-Z]{3})/g;
  const routes: { from: string; to: string }[] = [];
  let routeMatch;
  while ((routeMatch = routePattern.exec(text)) !== null) {
    routes.push({ from: routeMatch[1], to: routeMatch[2] });
  }
  
  const datePattern = /(\d{1,2}[.\/]\d{1,2}[.\/]\d{4}|\d{1,2}\s+\w+\s+\d{4})/g;
  const dates: string[] = [];
  let dateMatch;
  while ((dateMatch = datePattern.exec(text)) !== null) {
    const parsed = parseDate(dateMatch[1]);
    if (parsed) dates.push(parsed);
  }
  
  const timePattern = /(\d{1,2}:\d{2})/g;
  const times: string[] = [];
  let timeMatch;
  while ((timeMatch = timePattern.exec(text)) !== null) {
    times.push(timeMatch[1]);
  }
  
  for (let i = 0; i < matches.length; i++) {
    const route = routes[i] || { from: "", to: "" };
    segments.push({
      id: `seg-${Date.now()}-${i}`,
      flightNumber: `LO${matches[i]}`,
      airline: "LOT Polish Airlines",
      departure: route.from,
      arrival: route.to,
      departureDate: dates[i * 2] || dates[0] || "",
      departureTimeScheduled: parseTime(times[i * 2] || "") || "",
      arrivalDate: dates[i * 2 + 1] || dates[i * 2] || dates[0] || "",
      arrivalTimeScheduled: parseTime(times[i * 2 + 1] || "") || "",
      cabinClass: detectCabinClass(text),
      bookingRef: bookingRefMatch?.[1],
    });
  }
  
  if (segments.length === 0) return null;
  
  return {
    success: true,
    segments,
    booking: {
      bookingRef: bookingRefMatch?.[1] || "",
      airline: "LOT Polish Airlines",
      totalPrice: priceMatch ? parseFloat(priceMatch[1].replace(",", ".")) : null,
      currency: "EUR",
      ticketNumbers: ticketMatch ? [ticketMatch[1]] : [],
      cabinClass: segments[0]?.cabinClass || "economy",
      refundPolicy: detectRefundPolicy(text),
      baggage: parseBaggage(text, segments[0]?.cabinClass),
    },
    parser: "lot",
  };
}

// ============================================
// FINNAIR (AY)
// ============================================
function parseFinnair(text: string): ParseResult | null {
  if (!text.includes("Finnair") && !text.match(/AY\s?\d{3,4}/i)) {
    return null;
  }
  
  const bookingRefMatch = text.match(/(?:Booking\s+reference|Varausnumero)[\s:]+([A-Z0-9]{6})/i);
  const ticketMatch = text.match(/(?:Ticket|E-ticket)[\s:]+(\d{13})/i);
  const priceMatch = text.match(/(?:Total|Yhteensä)[\s:]+(?:EUR|€)\s*([\d.,]+)/i);
  
  const flightPattern = /AY\s?(\d{3,4})/gi;
  const segments: ParsedSegment[] = [];
  let flightMatch;
  const matches: string[] = [];
  
  while ((flightMatch = flightPattern.exec(text)) !== null) {
    matches.push(flightMatch[1]);
  }
  
  const routePattern = /([A-Z]{3})\s*[-–→]\s*([A-Z]{3})/g;
  const routes: { from: string; to: string }[] = [];
  let routeMatch;
  while ((routeMatch = routePattern.exec(text)) !== null) {
    routes.push({ from: routeMatch[1], to: routeMatch[2] });
  }
  
  const datePattern = /(\d{1,2}[.\/]\d{1,2}[.\/]\d{4}|\d{1,2}\s+\w+\s+\d{4})/g;
  const dates: string[] = [];
  let dateMatch;
  while ((dateMatch = datePattern.exec(text)) !== null) {
    const parsed = parseDate(dateMatch[1]);
    if (parsed) dates.push(parsed);
  }
  
  const timePattern = /(\d{1,2}:\d{2})/g;
  const times: string[] = [];
  let timeMatch;
  while ((timeMatch = timePattern.exec(text)) !== null) {
    times.push(timeMatch[1]);
  }
  
  for (let i = 0; i < matches.length; i++) {
    const route = routes[i] || { from: "", to: "" };
    segments.push({
      id: `seg-${Date.now()}-${i}`,
      flightNumber: `AY${matches[i]}`,
      airline: "Finnair",
      departure: route.from,
      arrival: route.to,
      departureDate: dates[i * 2] || dates[0] || "",
      departureTimeScheduled: parseTime(times[i * 2] || "") || "",
      arrivalDate: dates[i * 2 + 1] || dates[i * 2] || dates[0] || "",
      arrivalTimeScheduled: parseTime(times[i * 2 + 1] || "") || "",
      cabinClass: detectCabinClass(text),
      bookingRef: bookingRefMatch?.[1],
    });
  }
  
  if (segments.length === 0) return null;
  
  return {
    success: true,
    segments,
    booking: {
      bookingRef: bookingRefMatch?.[1] || "",
      airline: "Finnair",
      totalPrice: priceMatch ? parseFloat(priceMatch[1].replace(",", ".")) : null,
      currency: "EUR",
      ticketNumbers: ticketMatch ? [ticketMatch[1]] : [],
      cabinClass: segments[0]?.cabinClass || "economy",
      refundPolicy: detectRefundPolicy(text),
      baggage: parseBaggage(text, segments[0]?.cabinClass),
    },
    parser: "finnair",
  };
}

// ============================================
// SAS SCANDINAVIAN (SK)
// ============================================
function parseSAS(text: string): ParseResult | null {
  if (!text.includes("SAS") && !text.includes("Scandinavian") && !text.match(/SK\s?\d{3,4}/i)) {
    return null;
  }
  
  const bookingRefMatch = text.match(/(?:Booking\s+reference|Bestillingsnummer)[\s:]+([A-Z0-9]{6})/i);
  const ticketMatch = text.match(/(?:Ticket|E-ticket)[\s:]+(\d{13})/i);
  const priceMatch = text.match(/(?:Total|Totalt)[\s:]+(?:EUR|SEK|NOK|DKK|€)\s*([\d.,]+)/i);
  
  const flightPattern = /SK\s?(\d{3,4})/gi;
  const segments: ParsedSegment[] = [];
  let flightMatch;
  const matches: string[] = [];
  
  while ((flightMatch = flightPattern.exec(text)) !== null) {
    matches.push(flightMatch[1]);
  }
  
  const routePattern = /([A-Z]{3})\s*[-–→]\s*([A-Z]{3})/g;
  const routes: { from: string; to: string }[] = [];
  let routeMatch;
  while ((routeMatch = routePattern.exec(text)) !== null) {
    routes.push({ from: routeMatch[1], to: routeMatch[2] });
  }
  
  const datePattern = /(\d{1,2}[.\/]\d{1,2}[.\/]\d{4}|\d{1,2}\s+\w+\s+\d{4})/g;
  const dates: string[] = [];
  let dateMatch;
  while ((dateMatch = datePattern.exec(text)) !== null) {
    const parsed = parseDate(dateMatch[1]);
    if (parsed) dates.push(parsed);
  }
  
  const timePattern = /(\d{1,2}:\d{2})/g;
  const times: string[] = [];
  let timeMatch;
  while ((timeMatch = timePattern.exec(text)) !== null) {
    times.push(timeMatch[1]);
  }
  
  for (let i = 0; i < matches.length; i++) {
    const route = routes[i] || { from: "", to: "" };
    segments.push({
      id: `seg-${Date.now()}-${i}`,
      flightNumber: `SK${matches[i]}`,
      airline: "SAS Scandinavian",
      departure: route.from,
      arrival: route.to,
      departureDate: dates[i * 2] || dates[0] || "",
      departureTimeScheduled: parseTime(times[i * 2] || "") || "",
      arrivalDate: dates[i * 2 + 1] || dates[i * 2] || dates[0] || "",
      arrivalTimeScheduled: parseTime(times[i * 2 + 1] || "") || "",
      cabinClass: detectCabinClass(text),
      bookingRef: bookingRefMatch?.[1],
    });
  }
  
  if (segments.length === 0) return null;
  
  return {
    success: true,
    segments,
    booking: {
      bookingRef: bookingRefMatch?.[1] || "",
      airline: "SAS Scandinavian",
      totalPrice: priceMatch ? parseFloat(priceMatch[1].replace(",", ".")) : null,
      currency: "EUR",
      ticketNumbers: ticketMatch ? [ticketMatch[1]] : [],
      cabinClass: segments[0]?.cabinClass || "economy",
      refundPolicy: detectRefundPolicy(text),
      baggage: parseBaggage(text, segments[0]?.cabinClass),
    },
    parser: "sas",
  };
}

// ============================================
// FLYDUBAI (FZ)
// ============================================
function parseFlyDubai(text: string): ParseResult | null {
  if (!text.includes("flydubai") && !text.includes("FlyDubai") && !text.match(/FZ\s?\d{3,4}/i)) {
    return null;
  }
  
  const bookingRefMatch = text.match(/(?:Booking\s+reference|Confirmation)[\s:]+([A-Z0-9]{6})/i);
  const ticketMatch = text.match(/(?:Ticket|E-ticket)[\s:]+(\d{13})/i);
  const priceMatch = text.match(/(?:Total|Amount)[\s:]+(?:AED|USD|EUR)\s*([\d.,]+)/i);
  
  const flightPattern = /FZ\s?(\d{3,4})/gi;
  const segments: ParsedSegment[] = [];
  let flightMatch;
  const matches: string[] = [];
  
  while ((flightMatch = flightPattern.exec(text)) !== null) {
    matches.push(flightMatch[1]);
  }
  
  const routePattern = /([A-Z]{3})\s*[-–→]\s*([A-Z]{3})/g;
  const routes: { from: string; to: string }[] = [];
  let routeMatch;
  while ((routeMatch = routePattern.exec(text)) !== null) {
    routes.push({ from: routeMatch[1], to: routeMatch[2] });
  }
  
  const datePattern = /(\d{1,2}[.\/]\d{1,2}[.\/]\d{4}|\d{1,2}\s+\w+\s+\d{4})/g;
  const dates: string[] = [];
  let dateMatch;
  while ((dateMatch = datePattern.exec(text)) !== null) {
    const parsed = parseDate(dateMatch[1]);
    if (parsed) dates.push(parsed);
  }
  
  const timePattern = /(\d{1,2}:\d{2})/g;
  const times: string[] = [];
  let timeMatch;
  while ((timeMatch = timePattern.exec(text)) !== null) {
    times.push(timeMatch[1]);
  }
  
  for (let i = 0; i < matches.length; i++) {
    const route = routes[i] || { from: "", to: "" };
    segments.push({
      id: `seg-${Date.now()}-${i}`,
      flightNumber: `FZ${matches[i]}`,
      airline: "flydubai",
      departure: route.from,
      arrival: route.to,
      departureDate: dates[i * 2] || dates[0] || "",
      departureTimeScheduled: parseTime(times[i * 2] || "") || "",
      arrivalDate: dates[i * 2 + 1] || dates[i * 2] || dates[0] || "",
      arrivalTimeScheduled: parseTime(times[i * 2 + 1] || "") || "",
      cabinClass: detectCabinClass(text),
      bookingRef: bookingRefMatch?.[1],
    });
  }
  
  if (segments.length === 0) return null;
  
  return {
    success: true,
    segments,
    booking: {
      bookingRef: bookingRefMatch?.[1] || "",
      airline: "flydubai",
      totalPrice: priceMatch ? parseFloat(priceMatch[1].replace(",", ".")) : null,
      currency: "AED",
      ticketNumbers: ticketMatch ? [ticketMatch[1]] : [],
      cabinClass: segments[0]?.cabinClass || "economy",
      refundPolicy: detectRefundPolicy(text),
      baggage: parseBaggage(text, segments[0]?.cabinClass),
    },
    parser: "flydubai",
  };
}

// ============================================
// EMIRATES (EK)
// ============================================
function parseEmirates(text: string): ParseResult | null {
  if (!text.includes("Emirates") && !text.match(/EK\s?\d{3,4}/i)) {
    return null;
  }
  
  const bookingRefMatch = text.match(/(?:Booking\s+reference|Confirmation)[\s:]+([A-Z0-9]{6})/i);
  const ticketMatch = text.match(/(?:Ticket|E-ticket)[\s:]+(\d{13})/i);
  const priceMatch = text.match(/(?:Total|Amount)[\s:]+(?:AED|USD|EUR)\s*([\d.,]+)/i);
  
  const flightPattern = /EK\s?(\d{3,4})/gi;
  const segments: ParsedSegment[] = [];
  let flightMatch;
  const matches: string[] = [];
  
  while ((flightMatch = flightPattern.exec(text)) !== null) {
    matches.push(flightMatch[1]);
  }
  
  const routePattern = /([A-Z]{3})\s*[-–→]\s*([A-Z]{3})/g;
  const routes: { from: string; to: string }[] = [];
  let routeMatch;
  while ((routeMatch = routePattern.exec(text)) !== null) {
    routes.push({ from: routeMatch[1], to: routeMatch[2] });
  }
  
  const datePattern = /(\d{1,2}[.\/]\d{1,2}[.\/]\d{4}|\d{1,2}\s+\w+\s+\d{4})/g;
  const dates: string[] = [];
  let dateMatch;
  while ((dateMatch = datePattern.exec(text)) !== null) {
    const parsed = parseDate(dateMatch[1]);
    if (parsed) dates.push(parsed);
  }
  
  const timePattern = /(\d{1,2}:\d{2})/g;
  const times: string[] = [];
  let timeMatch;
  while ((timeMatch = timePattern.exec(text)) !== null) {
    times.push(timeMatch[1]);
  }
  
  for (let i = 0; i < matches.length; i++) {
    const route = routes[i] || { from: "", to: "" };
    segments.push({
      id: `seg-${Date.now()}-${i}`,
      flightNumber: `EK${matches[i]}`,
      airline: "Emirates",
      departure: route.from,
      arrival: route.to,
      departureDate: dates[i * 2] || dates[0] || "",
      departureTimeScheduled: parseTime(times[i * 2] || "") || "",
      arrivalDate: dates[i * 2 + 1] || dates[i * 2] || dates[0] || "",
      arrivalTimeScheduled: parseTime(times[i * 2 + 1] || "") || "",
      cabinClass: detectCabinClass(text),
      bookingRef: bookingRefMatch?.[1],
    });
  }
  
  if (segments.length === 0) return null;
  
  return {
    success: true,
    segments,
    booking: {
      bookingRef: bookingRefMatch?.[1] || "",
      airline: "Emirates",
      totalPrice: priceMatch ? parseFloat(priceMatch[1].replace(",", ".")) : null,
      currency: "AED",
      ticketNumbers: ticketMatch ? [ticketMatch[1]] : [],
      cabinClass: segments[0]?.cabinClass || "economy",
      refundPolicy: detectRefundPolicy(text),
      baggage: parseBaggage(text, segments[0]?.cabinClass),
    },
    parser: "emirates",
  };
}

// ============================================
// TURKISH AIRLINES (TK)
// ============================================
function parseTurkishAirlines(text: string): ParseResult | null {
  if (!text.includes("Turkish Airlines") && !text.includes("Türk Hava Yolları") && !text.match(/TK\s?\d{3,4}/i)) {
    return null;
  }
  
  const bookingRefMatch = text.match(/(?:Booking|PNR|Rezervasyon)[\s:]+([A-Z0-9]{6})/i);
  const ticketMatch = text.match(/(?:Ticket|Bilet)[\s:]+(\d{13})/i);
  const priceMatch = text.match(/(?:Total|Toplam)[\s:]+(?:TRY|EUR|USD)\s*([\d.,]+)/i);
  
  const flightPattern = /TK\s?(\d{3,4})/gi;
  const segments: ParsedSegment[] = [];
  let flightMatch;
  const matches: string[] = [];
  
  while ((flightMatch = flightPattern.exec(text)) !== null) {
    matches.push(flightMatch[1]);
  }
  
  const routePattern = /([A-Z]{3})\s*[-–→]\s*([A-Z]{3})/g;
  const routes: { from: string; to: string }[] = [];
  let routeMatch;
  while ((routeMatch = routePattern.exec(text)) !== null) {
    routes.push({ from: routeMatch[1], to: routeMatch[2] });
  }
  
  const datePattern = /(\d{1,2}[.\/]\d{1,2}[.\/]\d{4}|\d{1,2}\s+\w+\s+\d{4})/g;
  const dates: string[] = [];
  let dateMatch;
  while ((dateMatch = datePattern.exec(text)) !== null) {
    const parsed = parseDate(dateMatch[1]);
    if (parsed) dates.push(parsed);
  }
  
  const timePattern = /(\d{1,2}:\d{2})/g;
  const times: string[] = [];
  let timeMatch;
  while ((timeMatch = timePattern.exec(text)) !== null) {
    times.push(timeMatch[1]);
  }
  
  for (let i = 0; i < matches.length; i++) {
    const route = routes[i] || { from: "", to: "" };
    segments.push({
      id: `seg-${Date.now()}-${i}`,
      flightNumber: `TK${matches[i]}`,
      airline: "Turkish Airlines",
      departure: route.from,
      arrival: route.to,
      departureDate: dates[i * 2] || dates[0] || "",
      departureTimeScheduled: parseTime(times[i * 2] || "") || "",
      arrivalDate: dates[i * 2 + 1] || dates[i * 2] || dates[0] || "",
      arrivalTimeScheduled: parseTime(times[i * 2 + 1] || "") || "",
      cabinClass: detectCabinClass(text),
      bookingRef: bookingRefMatch?.[1],
    });
  }
  
  if (segments.length === 0) return null;
  
  return {
    success: true,
    segments,
    booking: {
      bookingRef: bookingRefMatch?.[1] || "",
      airline: "Turkish Airlines",
      totalPrice: priceMatch ? parseFloat(priceMatch[1].replace(",", ".")) : null,
      currency: "EUR",
      ticketNumbers: ticketMatch ? [ticketMatch[1]] : [],
      cabinClass: segments[0]?.cabinClass || "economy",
      refundPolicy: detectRefundPolicy(text),
      baggage: parseBaggage(text, segments[0]?.cabinClass),
    },
    parser: "turkish_airlines",
  };
}

// ============================================
// RYANAIR (FR)
// ============================================
function parseRyanair(text: string): ParseResult | null {
  if (!text.includes("Ryanair") && !text.match(/FR\s?\d{3,4}/i)) {
    return null;
  }
  
  const bookingRefMatch = text.match(/(?:Booking\s+reference|Confirmation)[\s:]+([A-Z0-9]{6,8})/i);
  const priceMatch = text.match(/(?:Total|Amount)[\s:]+(?:EUR|€|GBP|£)\s*([\d.,]+)/i);
  
  const flightPattern = /FR\s?(\d{3,4})/gi;
  const segments: ParsedSegment[] = [];
  let flightMatch;
  const matches: string[] = [];
  
  while ((flightMatch = flightPattern.exec(text)) !== null) {
    matches.push(flightMatch[1]);
  }
  
  const routePattern = /([A-Z]{3})\s*[-–→]\s*([A-Z]{3})/g;
  const routes: { from: string; to: string }[] = [];
  let routeMatch;
  while ((routeMatch = routePattern.exec(text)) !== null) {
    routes.push({ from: routeMatch[1], to: routeMatch[2] });
  }
  
  const datePattern = /(\d{1,2}[.\/]\d{1,2}[.\/]\d{4}|\d{1,2}\s+\w+\s+\d{4})/g;
  const dates: string[] = [];
  let dateMatch;
  while ((dateMatch = datePattern.exec(text)) !== null) {
    const parsed = parseDate(dateMatch[1]);
    if (parsed) dates.push(parsed);
  }
  
  const timePattern = /(\d{1,2}:\d{2})/g;
  const times: string[] = [];
  let timeMatch;
  while ((timeMatch = timePattern.exec(text)) !== null) {
    times.push(timeMatch[1]);
  }
  
  for (let i = 0; i < matches.length; i++) {
    const route = routes[i] || { from: "", to: "" };
    segments.push({
      id: `seg-${Date.now()}-${i}`,
      flightNumber: `FR${matches[i]}`,
      airline: "Ryanair",
      departure: route.from,
      arrival: route.to,
      departureDate: dates[i * 2] || dates[0] || "",
      departureTimeScheduled: parseTime(times[i * 2] || "") || "",
      arrivalDate: dates[i * 2 + 1] || dates[i * 2] || dates[0] || "",
      arrivalTimeScheduled: parseTime(times[i * 2 + 1] || "") || "",
      cabinClass: "economy", // Ryanair is always economy
      bookingRef: bookingRefMatch?.[1],
    });
  }
  
  if (segments.length === 0) return null;
  
  return {
    success: true,
    segments,
    booking: {
      bookingRef: bookingRefMatch?.[1] || "",
      airline: "Ryanair",
      totalPrice: priceMatch ? parseFloat(priceMatch[1].replace(",", ".")) : null,
      currency: "EUR",
      ticketNumbers: [],
      cabinClass: "economy",
      refundPolicy: "non_ref", // Ryanair is typically non-refundable
      baggage: parseBaggage(text) || "personal", // Ryanair: personal item only by default
    },
    parser: "ryanair",
  };
}

// ============================================
// EASYJET (U2)
// ============================================
function parseEasyJet(text: string): ParseResult | null {
  if (!text.includes("easyJet") && !text.includes("EasyJet") && !text.match(/U2\s?\d{3,4}/i)) {
    return null;
  }
  
  const bookingRefMatch = text.match(/(?:Booking\s+reference|Confirmation)[\s:]+([A-Z0-9]{7,8})/i);
  const priceMatch = text.match(/(?:Total|Amount)[\s:]+(?:EUR|€|GBP|£)\s*([\d.,]+)/i);
  
  const flightPattern = /U2\s?(\d{3,4})/gi;
  const segments: ParsedSegment[] = [];
  let flightMatch;
  const matches: string[] = [];
  
  while ((flightMatch = flightPattern.exec(text)) !== null) {
    matches.push(flightMatch[1]);
  }
  
  // Also try EZY format
  const ezyPattern = /EZY(\d{3,4})/gi;
  while ((flightMatch = ezyPattern.exec(text)) !== null) {
    matches.push(flightMatch[1]);
  }
  
  const routePattern = /([A-Z]{3})\s*[-–→]\s*([A-Z]{3})/g;
  const routes: { from: string; to: string }[] = [];
  let routeMatch;
  while ((routeMatch = routePattern.exec(text)) !== null) {
    routes.push({ from: routeMatch[1], to: routeMatch[2] });
  }
  
  const datePattern = /(\d{1,2}[.\/]\d{1,2}[.\/]\d{4}|\d{1,2}\s+\w+\s+\d{4})/g;
  const dates: string[] = [];
  let dateMatch;
  while ((dateMatch = datePattern.exec(text)) !== null) {
    const parsed = parseDate(dateMatch[1]);
    if (parsed) dates.push(parsed);
  }
  
  const timePattern = /(\d{1,2}:\d{2})/g;
  const times: string[] = [];
  let timeMatch;
  while ((timeMatch = timePattern.exec(text)) !== null) {
    times.push(timeMatch[1]);
  }
  
  for (let i = 0; i < matches.length; i++) {
    const route = routes[i] || { from: "", to: "" };
    segments.push({
      id: `seg-${Date.now()}-${i}`,
      flightNumber: `U2${matches[i]}`,
      airline: "easyJet",
      departure: route.from,
      arrival: route.to,
      departureDate: dates[i * 2] || dates[0] || "",
      departureTimeScheduled: parseTime(times[i * 2] || "") || "",
      arrivalDate: dates[i * 2 + 1] || dates[i * 2] || dates[0] || "",
      arrivalTimeScheduled: parseTime(times[i * 2 + 1] || "") || "",
      cabinClass: "economy",
      bookingRef: bookingRefMatch?.[1],
    });
  }
  
  if (segments.length === 0) return null;
  
  return {
    success: true,
    segments,
    booking: {
      bookingRef: bookingRefMatch?.[1] || "",
      airline: "easyJet",
      totalPrice: priceMatch ? parseFloat(priceMatch[1].replace(",", ".")) : null,
      currency: "EUR",
      ticketNumbers: [],
      cabinClass: "economy",
      refundPolicy: "non_ref",
      baggage: parseBaggage(text) || "personal+cabin", // EasyJet includes cabin bag
    },
    parser: "easyjet",
  };
}

// ============================================
// WIZZAIR (W6)
// ============================================
function parseWizzair(text: string): ParseResult | null {
  if (!text.includes("Wizz") && !text.includes("WIZZ") && !text.match(/W6\s?\d{3,4}/i)) {
    return null;
  }
  
  const bookingRefMatch = text.match(/(?:Confirmation|Booking)[\s:]+([A-Z0-9]{6,8})/i);
  const priceMatch = text.match(/(?:Total|Amount)[\s:]+(?:EUR|€|HUF|PLN)\s*([\d.,]+)/i);
  
  const flightPattern = /W6\s?(\d{3,4})/gi;
  const segments: ParsedSegment[] = [];
  let flightMatch;
  const matches: string[] = [];
  
  while ((flightMatch = flightPattern.exec(text)) !== null) {
    matches.push(flightMatch[1]);
  }
  
  const routePattern = /([A-Z]{3})\s*[-–→]\s*([A-Z]{3})/g;
  const routes: { from: string; to: string }[] = [];
  let routeMatch;
  while ((routeMatch = routePattern.exec(text)) !== null) {
    routes.push({ from: routeMatch[1], to: routeMatch[2] });
  }
  
  const datePattern = /(\d{1,2}[.\/]\d{1,2}[.\/]\d{4}|\d{1,2}\s+\w+\s+\d{4})/g;
  const dates: string[] = [];
  let dateMatch;
  while ((dateMatch = datePattern.exec(text)) !== null) {
    const parsed = parseDate(dateMatch[1]);
    if (parsed) dates.push(parsed);
  }
  
  const timePattern = /(\d{1,2}:\d{2})/g;
  const times: string[] = [];
  let timeMatch;
  while ((timeMatch = timePattern.exec(text)) !== null) {
    times.push(timeMatch[1]);
  }
  
  for (let i = 0; i < matches.length; i++) {
    const route = routes[i] || { from: "", to: "" };
    segments.push({
      id: `seg-${Date.now()}-${i}`,
      flightNumber: `W6${matches[i]}`,
      airline: "Wizz Air",
      departure: route.from,
      arrival: route.to,
      departureDate: dates[i * 2] || dates[0] || "",
      departureTimeScheduled: parseTime(times[i * 2] || "") || "",
      arrivalDate: dates[i * 2 + 1] || dates[i * 2] || dates[0] || "",
      arrivalTimeScheduled: parseTime(times[i * 2 + 1] || "") || "",
      cabinClass: "economy",
      bookingRef: bookingRefMatch?.[1],
    });
  }
  
  if (segments.length === 0) return null;
  
  return {
    success: true,
    segments,
    booking: {
      bookingRef: bookingRefMatch?.[1] || "",
      airline: "Wizz Air",
      totalPrice: priceMatch ? parseFloat(priceMatch[1].replace(",", ".")) : null,
      currency: "EUR",
      ticketNumbers: [],
      cabinClass: "economy",
      refundPolicy: "non_ref",
      baggage: parseBaggage(text) || "personal", // WizzAir: personal item only by default
    },
    parser: "wizzair",
  };
}

// ============================================
// AMADEUS GDS FORMAT (Multiple formats supported)
// ============================================
function parseAmadeus(text: string): ParseResult | null {
  // Detect Amadeus format
  const hasBookingRef = text.match(/BOOKING\s+REF:\s*([A-Z0-9]{6})/i);
  const hasFlightLine = text.match(/FLIGHT\s+[A-Z]{2}\s*\d{3,4}/i);
  // Classic format with dot: "1. AF7303" or PNR format with spaces: "2  AF7303"
  const hasClassicFormat = text.match(/\d[\.\s]+[A-Z]{2}\s?\d{3,4}\s+[A-Z]\s+\d{1,2}[A-Z]{3}/);
  // PNR header format: "RP/RIXLA2215/... XGGEFU"
  const hasPNRHeader = text.match(/RP\/[A-Z0-9]+\/[A-Z0-9]+.*[A-Z0-9]{6}/);
  
  if (!hasBookingRef && !hasFlightLine && !hasClassicFormat && !hasPNRHeader) {
    return null;
  }
  
  const bookingRefMatch = text.match(/BOOKING\s+REF:\s*([A-Z0-9]{6})/i) ||
                          text.match(/^([A-Z0-9]{6})\s*$/m) || 
                          text.match(/PNR[\s:]+([A-Z0-9]{6})/i);
  
  // Extract ALL passengers: FOR SURNAME/FIRSTNAME [MRS|MR|MS|...] or TICKET ... FOR SURNAME/FIRST
  const forNameRe = /(?:TICKET:\s*[A-Z]{2}\/ETKT\s*\d{3}\s*\d{10}\s+)?FOR\s+([A-Z\s\u00C0-\u024F]+)\/([A-Z\s\u00C0-\u024F]+)(?:\s+(?:MRS?|MS|MISS|MSTR|DR|MR))?/gi;
  const passengers: ParsedPassenger[] = [];
  let m: RegExpExecArray | null;
  while ((m = forNameRe.exec(text)) !== null) {
    const surname = (m[1] || "").trim().replace(/\s+/g, " ");
    const first = (m[2] || "").trim().replace(/\s+/g, " ");
    const name = first && surname ? `${first} ${surname}` : (first || surname);
    if (name && !passengers.some((p) => p.name === name)) {
      passengers.push({ name });
    }
  }
  // Also each TICKET line with FOR: TICKET: XX/ETKT 074 1234567890 FOR SURNAME/FIRST
  const ticketForAll = [...text.matchAll(/TICKET:\s*[A-Z]{2}\/ETKT\s*(\d{3})\s*(\d{10})\s+FOR\s+([A-Z\s\u00C0-\u024F]+)\/([A-Z\s\u00C0-\u024F]+)/gi)];
  for (const tm of ticketForAll) {
    const first = (tm[4] || "").trim().replace(/\s+/g, " ");
    const surname = (tm[3] || "").trim().replace(/\s+/g, " ");
    const name = first && surname ? `${first} ${surname}` : (first || surname);
    if (name && !passengers.some((p) => p.name === name)) {
      passengers.push({ name, ticketNumber: `${tm[1]}-${tm[2]}` });
    }
  }
  // Fallback: single ticket+name when no FOR block matched
  const ticketForMatch = text.match(/TICKET:\s*[A-Z]{2}\/ETKT\s*(\d{3})\s*(\d{10})\s+FOR\s+([A-Z]+)\/([A-Z]+)/i);
  if (ticketForMatch && passengers.length === 0) {
    passengers.push({
      name: `${ticketForMatch[4]} ${ticketForMatch[3]}`,
      ticketNumber: `${ticketForMatch[1]}-${ticketForMatch[2]}`,
    });
  }
  const ticketMatches = [...text.matchAll(/TICKET:\s*[A-Z]{2}\/ETKT\s*(\d{3})\s*(\d{10})/gi)];
  const ticketNumbers = ticketMatches.map((tm) => `${tm[1]}-${tm[2]}`);
  if (ticketNumbers.length > 0 && passengers.length > 0 && passengers.length <= ticketNumbers.length) {
    ticketNumbers.forEach((tn, i) => {
      if (passengers[i] && !passengers[i].ticketNumber) {
        passengers[i] = { ...passengers[i], ticketNumber: tn };
      }
    });
  }
  const passengerName = passengers.length === 1 ? passengers[0].name : (passengers[0]?.name);

  const segments: ParsedSegment[] = [];
  
  // Split text into flight sections
  const flightSections = text.split(/(?=FLIGHT\s+[A-Z]{2}\s*\d{3,4}\s*-)/i);
  
  for (let i = 0; i < flightSections.length; i++) {
    const section = flightSections[i];
    
    // Match: FLIGHT     AF 7303 - AIR FRANCE                           WED 28 JANUARY 2026
    const flightHeaderMatch = section.match(/FLIGHT\s+([A-Z]{2})\s*(\d{3,4})\s*-\s*([A-Z\s]+?)\s+[A-Z]{3}\s+(\d{1,2})\s+([A-Z]+)\s+(\d{4})/i);
    
    if (!flightHeaderMatch) continue;
    
    const airlineCode = flightHeaderMatch[1];
    const flightNum = flightHeaderMatch[2];
    const airlineName = flightHeaderMatch[3].trim();
    const day = flightHeaderMatch[4];
    const monthStr = flightHeaderMatch[5].toLowerCase();
    const year = flightHeaderMatch[6];
    
    const month = MONTHS[monthStr] || MONTHS[monthStr.slice(0, 3)];
    const depDate = month ? `${year}-${month}-${day.padStart(2, "0")}` : "";
    
    // Parse departure: DEPARTURE: NICE, FR (COTE D AZUR), TERMINAL 2 - AEROGARE 2       28 JAN 11:00
    const depMatch = section.match(/DEPARTURE:\s*([A-Z][A-Z\s]*?),\s*[A-Z]{2}\s*\([^)]+\)(?:,\s*TERMINAL\s*([A-Z0-9]+))?[\s\S]*?(\d{1,2})\s+[A-Z]{3}\s+(\d{1,2}):(\d{2})/i);
    
    // Parse arrival: ARRIVAL:   PARIS, FR (CHARLES DE GAULLE), TERMINAL 2F -
    //                AEROGARE 2 TERMINAL F
    //                28 JAN 12:35
    // Note: [\s\S]*? allows matching across newlines for PDF format where time is on next line
    const arrMatch = section.match(/ARRIVAL:\s*([A-Z][A-Z\s]*?),\s*[A-Z]{2}\s*\([^)]+\)(?:,\s*TERMINAL\s*([A-Z0-9]+))?[\s\S]*?(\d{1,2})\s+[A-Z]{3}\s+(\d{1,2}):(\d{2})/i);
    
    if (!depMatch || !arrMatch) continue;
    
    const depCity = depMatch[1].trim();
    const arrCity = arrMatch[1].trim();
    const depCode = getIATAFromCity(depCity) || depCity.slice(0, 3).toUpperCase();
    const arrCode = getIATAFromCity(arrCity) || arrCity.slice(0, 3).toUpperCase();
    
    const depTime = `${depMatch[4].padStart(2, "0")}:${depMatch[5]}`;
    const arrTime = `${arrMatch[4].padStart(2, "0")}:${arrMatch[5]}`;
    
    // Calculate arrival date - parse arrival month separately in case it differs
    const arrDay = arrMatch[3];
    // Extract arrival month from the full text (e.g., "28 JAN" or "01 FEB")
    const arrMonthMatch = section.match(/ARRIVAL:.*?(\d{1,2})\s+([A-Z]{3})\s+\d{1,2}:\d{2}/i);
    const arrMonthStr = arrMonthMatch?.[2]?.toLowerCase() || monthStr;
    const arrMonth = MONTHS[arrMonthStr] || month;
    let arrDate = depDate;
    if (arrMonth) {
      arrDate = `${year}-${arrMonth}-${arrDay.padStart(2, "0")}`;
    }
    
    // Parse cabin class: RESERVATION CONFIRMED, BUSINESS (I)
    const cabinMatch = section.match(/RESERVATION\s+CONFIRMED,\s*(ECONOMY|BUSINESS|FIRST(?:\s+CLASS)?|PREMIUM(?:\s+ECONOMY)?)/i);
    // If cabinMatch found "FIRST", check if it's "FIRST CLASS" or just "FIRST"
    let cabinClass: "economy" | "premium_economy" | "business" | "first" | undefined = undefined;
    if (cabinMatch) {
      const matchedClass = cabinMatch[1].toUpperCase();
      if (matchedClass === "ECONOMY") {
        cabinClass = "economy";
      } else if (matchedClass === "BUSINESS") {
        cabinClass = "business";
      } else if (matchedClass === "FIRST CLASS" || matchedClass.startsWith("FIRST CLASS")) {
        cabinClass = "first";
      } else if (matchedClass === "FIRST") {
        // Only set to "first" if it's explicitly "FIRST CLASS" in the match
        // If just "FIRST", check the full section for "FIRST CLASS"
        if (section.match(/FIRST\s+CLASS/i)) {
          cabinClass = "first";
        } else {
          // Just "FIRST" without "CLASS" - likely not a cabin class, default to economy
          cabinClass = "economy";
        }
      } else if (matchedClass.includes("PREMIUM")) {
        cabinClass = "premium_economy";
      }
    }
    // Fallback to detectCabinClass if no match
    if (!cabinClass) {
      cabinClass = detectCabinClass(section);
    }
    
    // Parse baggage: BAGGAGE ALLOWANCE: 2PC
    const baggageMatch = section.match(/BAGGAGE\s+ALLOWANCE:\s*(\d+PC)/i);
    const baggage = baggageMatch ? parseBaggage(baggageMatch[1], cabinClass) : parseBaggage(section, cabinClass);
    
    // Parse duration: DURATION: 01:35
    const durationMatch = section.match(/DURATION:\s*(\d{1,2}):(\d{2})/i);
    const duration = durationMatch ? `${durationMatch[1]}h ${durationMatch[2]}m` : undefined;
    
    segments.push({
      id: `seg-${Date.now()}-${i}`,
      flightNumber: `${airlineCode}${flightNum}`,
      airline: airlineName || airlineCode,
      departure: depCode,
      departureCity: depCity,
      arrival: arrCode,
      arrivalCity: arrCity,
      departureDate: depDate,
      departureTimeScheduled: depTime,
      arrivalDate: arrDate,
      arrivalTimeScheduled: arrTime,
      departureTerminal: depMatch[2] ? `Terminal ${depMatch[2]}` : undefined,
      arrivalTerminal: arrMatch[2] ? `Terminal ${arrMatch[2]}` : undefined,
      duration,
      cabinClass,
      baggage,
      bookingRef: bookingRefMatch?.[1],
      ticketNumber: ticketNumbers[0],
    });
  }
  
  // Format 2: Classic Amadeus PNR format if no segments found
  // Example: 2  AF7303 I 28JAN 3 NCECDG HK1  1100 1235  28JAN  E  AF/XGGEFU
  // Format:  [line] [flight] [class] [date] [dow] [route6] [status] [depTime] [arrTime] [arrDate] [e] [ref]
  if (segments.length === 0) {
    // Extract booking ref from header: RP/RIXLA2215/RIXLA2215 (PNR locator)
    const headerRefMatch = text.match(/RP\/[A-Z0-9]+\/[A-Z0-9]+\s+[A-Z]{2}\/[A-Z]{2}\s+\d{2}[A-Z]{3}\d{2}\/\d{4}Z\s+([A-Z0-9]{6})/);
    const segmentRefMatch = text.match(/[A-Z]{2}\/([A-Z0-9]{5,8})\s*$/m);
    const pnrRef = headerRefMatch?.[1] || segmentRefMatch?.[1] || bookingRefMatch?.[1];
    
    // Extract ticket from FA line: FA PAX 074-2796062312/ETKL
    const faTicketMatch = text.match(/FA\s+PAX\s+(\d{3})-(\d{10})/);
    const pnrTicketNumber = faTicketMatch ? `${faTicketMatch[1]}-${faTicketMatch[2]}` : ticketNumbers[0];
    
    // Extract passenger: 1.VELINSKI/KATERINA MRS (all lines)
    const pnrPassengerMatches = [...text.matchAll(/\d\.\s*([A-Z]+)\/([A-Z]+)\s+(?:MRS?|MS|MISS|DR|MR)/gi)];
    const pnrPassengers: ParsedPassenger[] = pnrPassengerMatches.length > 0
      ? pnrPassengerMatches.map((pm) => ({ name: `${pm[2]} ${pm[1]}`.trim() }))
      : passengers;
    const pnrPassengerName = pnrPassengers.length === 1 ? pnrPassengers[0].name : (pnrPassengers[0]?.name ?? passengerName);
    
    // Classic PNR flight pattern:
    // 2  AF7303 I 28JAN 3 NCECDG HK1  1100 1235  28JAN  E  AF/XGGEFU
    // Group 1: airline code (AF)
    // Group 2: flight number (7303)
    // Group 3: booking class (I)
    // Group 4: departure date day (28)
    // Group 5: departure date month (JAN)
    // Group 6: day of week (3)
    // Group 7: departure airport (NCE)
    // Group 8: arrival airport (CDG)
    // Group 9: status (HK1)
    // Group 10: departure time (1100)
    // Group 11: arrival time (1235)
    // Group 12: arrival date day (28)
    // Group 13: arrival date month (JAN)
    const classicPattern = /^\s*\d+\s+([A-Z]{2})\s*(\d{3,4})\s+([A-Z])\s+(\d{1,2})([A-Z]{3})\s+\d\s+([A-Z]{3})([A-Z]{3})\s+[A-Z]{2}\d?\s+(\d{4})\s+(\d{4})\s+(\d{1,2})([A-Z]{3})/gim;
    let classicMatch;
    let idx = 0;
    
    // Determine year from text or use current
    const yearMatch = text.match(/(\d{2})([A-Z]{3})(\d{2})\/\d{4}Z/);
    const currentYear = new Date().getFullYear();
    let baseYear = currentYear;
    if (yearMatch) {
      const twoDigitYear = parseInt(yearMatch[3]);
      baseYear = 2000 + twoDigitYear;
    }
    
    while ((classicMatch = classicPattern.exec(text)) !== null) {
      const airlineCode = classicMatch[1];
      const flightNum = classicMatch[2];
      const bookingClass = classicMatch[3];
      const depDay = classicMatch[4];
      const depMonthStr = classicMatch[5].toLowerCase();
      const depAirport = classicMatch[6];
      const arrAirport = classicMatch[7];
      const depTimeRaw = classicMatch[8];
      const arrTimeRaw = classicMatch[9];
      const arrDay = classicMatch[10];
      const arrMonthStr = classicMatch[11].toLowerCase();
      
      const depMonth = MONTHS[depMonthStr];
      const arrMonth = MONTHS[arrMonthStr];
      
      // Calculate year - if month is before current month, it might be next year
      let depYear = baseYear;
      let arrYear = baseYear;
      
      const depDate = depMonth ? `${depYear}-${depMonth}-${depDay.padStart(2, "0")}` : "";
      const arrDate = arrMonth ? `${arrYear}-${arrMonth}-${arrDay.padStart(2, "0")}` : depDate;
      
      const depTime = `${depTimeRaw.slice(0, 2)}:${depTimeRaw.slice(2)}`;
      const arrTime = `${arrTimeRaw.slice(0, 2)}:${arrTimeRaw.slice(2)}`;
      
      const cabinClass = detectCabinClass(text);
      
      // Get airline name
      const airlineNames: Record<string, string> = {
        "AF": "Air France",
        "BA": "British Airways",
        "LH": "Lufthansa",
        "KL": "KLM",
        "BT": "airBaltic",
        "LO": "LOT",
        "AY": "Finnair",
        "SK": "SAS",
        "EK": "Emirates",
        "TK": "Turkish Airlines",
        "FR": "Ryanair",
        "U2": "easyJet",
        "W6": "Wizz Air",
        "FZ": "flydubai",
      };
      
      // Get city names from IATA codes
      const depCity = getCityFromIATA(depAirport);
      const arrCity = getCityFromIATA(arrAirport);
      
      // Calculate duration accounting for timezone differences
      const depMinutes = parseInt(depTimeRaw.slice(0, 2)) * 60 + parseInt(depTimeRaw.slice(2));
      const arrMinutes = parseInt(arrTimeRaw.slice(0, 2)) * 60 + parseInt(arrTimeRaw.slice(2));
      const depTzOffset = getAirportTimezoneOffset(depAirport);
      const arrTzOffset = getAirportTimezoneOffset(arrAirport);
      const depUtc = depMinutes - depTzOffset * 60;
      const arrUtc = arrMinutes - arrTzOffset * 60;
      let durationMinutes = arrUtc - depUtc;
      if (durationMinutes < 0) durationMinutes += 24 * 60;
      const durationHours = Math.floor(durationMinutes / 60);
      const durationMins = durationMinutes % 60;
      const duration = `${durationHours}h ${durationMins}m`;
      
      segments.push({
        id: `seg-${Date.now()}-${idx}`,
        flightNumber: `${airlineCode}${flightNum}`,
        airline: airlineNames[airlineCode] || airlineCode,
        departure: depAirport,
        departureCity: depCity,
        arrival: arrAirport,
        arrivalCity: arrCity,
        departureDate: depDate,
        departureTimeScheduled: depTime,
        arrivalDate: arrDate,
        arrivalTimeScheduled: arrTime,
        duration,
        cabinClass,
        bookingRef: pnrRef,
        ticketNumber: pnrTicketNumber,
      });
      idx++;
    }
    
    // Parse TQT format for price and baggage (when PNR + TQT pasted together)
    let tqtTotalPrice: number | null = null;
    let tqtCurrency = "EUR";
    let tqtBaggage = "";
    const totalMatch = text.match(/TOTAL\s+([A-Z]{3})\s+([\d.]+)/);
    if (totalMatch) {
      tqtTotalPrice = parseFloat(totalMatch[2]);
      tqtCurrency = totalMatch[1];
    }
    const baggageMatch = text.match(/\s+(\d+PC)\s*$/m);
    if (baggageMatch) {
      tqtBaggage = baggageMatch[1];
      segments.forEach((seg) => { seg.baggage = tqtBaggage; });
    }

    // Parse RIR remark for sale/client price: "RIR 865 EUR BUSINESS CLASS"
    let rirSalePrice: number | null = null;
    const rirMatch = text.match(/RIR\s+([\d.]+)\s+([A-Z]{3})/);
    if (rirMatch) {
      rirSalePrice = parseFloat(rirMatch[1]);
    }
    
    if (pnrPassengerName && segments.length > 0) {
      const pnrTicketArr = pnrTicketNumber ? [pnrTicketNumber] : ticketNumbers;
      return {
        success: true,
        segments,
        booking: {
          bookingRef: pnrRef || "",
          airline: "BSP", // Amadeus = BSP (Billing and Settlement Plan)
          totalPrice: tqtTotalPrice,
          salePrice: rirSalePrice,
          currency: tqtCurrency,
          ticketNumbers: pnrTicketArr,
          passengers: pnrPassengers.length > 0 ? pnrPassengers : undefined,
          cabinClass: segments[0]?.cabinClass || "economy",
          refundPolicy: "non_ref",
          baggage: tqtBaggage,
          passengerName: pnrPassengerName,
        },
        parser: "amadeus_pnr",
      };
    }
  }
  
  if (segments.length === 0) return null;
  
  // Remove duplicate segments (same flight number + date)
  const uniqueSegments = segments.filter((seg, idx, arr) => 
    arr.findIndex(s => s.flightNumber === seg.flightNumber && s.departureDate === seg.departureDate) === idx
  );
  
  // Parse TQT for price and baggage (when PNR + TQT pasted together)
  let tqtTotalPrice: number | null = null;
  let tqtCurrency = "EUR";
  const totalMatch = text.match(/TOTAL\s+([A-Z]{3})\s+([\d.]+)/);
  if (totalMatch) {
    tqtTotalPrice = parseFloat(totalMatch[2]);
    tqtCurrency = totalMatch[1];
  }
  const baggageMatch = text.match(/\s+(\d+PC)\s*$/m);
  if (baggageMatch) {
    uniqueSegments.forEach((seg) => { seg.baggage = baggageMatch[1]; });
  }

  // Parse RIR remark for sale/client price
  let rirSalePrice: number | null = null;
  const rirMatch = text.match(/RIR\s+([\d.]+)\s+([A-Z]{3})/);
  if (rirMatch) {
    rirSalePrice = parseFloat(rirMatch[1]);
  }
  
  // Amadeus = BSP (Billing and Settlement Plan) as supplier
  return {
    success: true,
    segments: uniqueSegments,
    booking: {
      bookingRef: bookingRefMatch?.[1] || "",
      airline: "BSP",
      totalPrice: tqtTotalPrice,
      salePrice: rirSalePrice,
      currency: tqtCurrency,
      ticketNumbers,
      passengers: passengers.length > 0 ? passengers : undefined,
      cabinClass: uniqueSegments[0]?.cabinClass || "economy",
      refundPolicy: "non_ref",
      baggage: uniqueSegments[0]?.baggage || "",
      passengerName,
    },
    parser: "amadeus",
  };
}

// ============================================
// MAIN PARSER - TRY ALL PARSERS
// ============================================
export function parseFlightBooking(text: string): ParseResult | null {
  // List of parsers to try in order
  const parsers = [
    parseBritishAirways,
    parseLufthansa,
    parseAirFrance,
    parseKLM,
    parseAirBaltic,
    parseLOT,
    parseFinnair,
    parseSAS,
    parseFlyDubai,
    parseEmirates,
    parseTurkishAirlines,
    parseRyanair,
    parseEasyJet,
    parseWizzair,
    parseAmadeus, // Try Amadeus last as it's more generic
  ];
  
  for (const parser of parsers) {
    const result = parser(text);
    if (result && result.segments.length > 0) {
      return result;
    }
  }
  
  return null;
}

// List of supported airlines
export const SUPPORTED_AIRLINES = [
  { code: "BA", name: "British Airways" },
  { code: "LH", name: "Lufthansa" },
  { code: "AF", name: "Air France" },
  { code: "KL", name: "KLM" },
  { code: "BT", name: "airBaltic" },
  { code: "LO", name: "LOT Polish Airlines" },
  { code: "AY", name: "Finnair" },
  { code: "SK", name: "SAS Scandinavian" },
  { code: "FZ", name: "flydubai" },
  { code: "EK", name: "Emirates" },
  { code: "TK", name: "Turkish Airlines" },
  { code: "FR", name: "Ryanair" },
  { code: "U2", name: "easyJet" },
  { code: "W6", name: "Wizz Air" },
  { code: "1A", name: "Amadeus GDS" },
];
