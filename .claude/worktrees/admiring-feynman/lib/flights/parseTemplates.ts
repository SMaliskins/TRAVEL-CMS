import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function getAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
}

/**
 * Compute a text fingerprint: strip numbers, dates, times, collapse whitespace,
 * take first 200 chars. Two tickets from the same airline/format will share a fingerprint.
 */
export function computeFingerprint(text: string): string {
  return text
    .replace(/\d{1,2}[.:/-]\d{1,2}[.:/-]\d{2,4}/g, "DATE")
    .replace(/\d{1,2}:\d{2}/g, "TIME")
    .replace(/\b\d{13}\b/g, "TICKET")
    .replace(/\b[A-Z0-9]{5,6}\b/g, "REF")
    .replace(/[\d.,]+/g, "N")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

function detectAirline(text: string): string {
  const lower = text.toLowerCase();
  if (/turkish\s*airlines/i.test(text) || /\bTK\d{3,4}\b/.test(text)) return "Turkish Airlines";
  if (/lufthansa/i.test(text) || /\bLH\d{3,4}\b/.test(text)) return "Lufthansa";
  if (/air\s*france/i.test(text) || /\bAF\d{3,4}\b/.test(text)) return "Air France";
  if (/british\s*airways/i.test(text) || /\bBA\d{3,4}\b/.test(text)) return "British Airways";
  if (/airbaltic/i.test(lower) || /\bBT\d{3,4}\b/.test(text)) return "airBaltic";
  if (/ryanair/i.test(text)) return "Ryanair";
  if (/easyjet/i.test(text)) return "easyJet";
  if (/wizz\s*air/i.test(text)) return "Wizz Air";
  if (/emirates/i.test(text) || /\bEK\d{3,4}\b/.test(text)) return "Emirates";
  if (/flydubai/i.test(text) || /\bFZ\d{3,4}\b/.test(text)) return "flydubai";
  if (/klm/i.test(text) || /\bKL\d{3,4}\b/.test(text)) return "KLM";
  if (/lot\s*polish/i.test(text) || /\bLO\d{3,4}\b/.test(text)) return "LOT";
  if (/finnair/i.test(text) || /\bAY\d{3,4}\b/.test(text)) return "Finnair";
  if (/sas|scandinavian/i.test(text) || /\bSK\d{3,4}\b/.test(text)) return "SAS";
  return "";
}

export interface ParseTemplate {
  id: string;
  text_sample: string;
  parsed_result: Record<string, unknown>;
  airline_hint: string;
}

/**
 * Find similar templates by fingerprint match. Returns up to 2 examples
 * that share the same structural shape (same airline format).
 */
export async function findSimilarTemplates(
  text: string,
  companyId?: string
): Promise<ParseTemplate[]> {
  const fingerprint = computeFingerprint(text);
  const airline = detectAirline(text);
  const admin = getAdmin();

  let query = admin
    .from("flight_parse_templates")
    .select("id, text_sample, parsed_result, airline_hint")
    .order("use_count", { ascending: false })
    .limit(2);

  if (airline) {
    query = query.eq("airline_hint", airline);
  } else {
    query = query.eq("text_fingerprint", fingerprint);
  }

  if (companyId) {
    query = query.or(`company_id.eq.${companyId},company_id.is.null`);
  }

  const { data } = await query;
  return (data || []) as ParseTemplate[];
}

/**
 * Save a successful parse as a template for future few-shot examples.
 * Deduplicates by fingerprint + airline.
 */
export async function saveTemplate(
  text: string,
  parsedResult: Record<string, unknown>,
  source: "regex" | "ai" | "manual",
  companyId?: string
): Promise<void> {
  const fingerprint = computeFingerprint(text);
  const airline = detectAirline(text);
  const admin = getAdmin();

  const { data: existing } = await admin
    .from("flight_parse_templates")
    .select("id")
    .eq("text_fingerprint", fingerprint)
    .eq("airline_hint", airline || "")
    .limit(1);

  if (existing && existing.length > 0) {
    await admin
      .from("flight_parse_templates")
      .update({
        parsed_result: parsedResult,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing[0].id);
    return;
  }

  await admin.from("flight_parse_templates").insert({
    company_id: companyId || null,
    airline_hint: airline || null,
    text_fingerprint: fingerprint,
    text_sample: text.slice(0, 5000),
    parsed_result: parsedResult,
    source,
  });
}

/**
 * Redact concrete values from a parsed result, keeping only structural info.
 * The AI learns WHERE fields are located, not WHAT specific values to output.
 */
function redactParsedResult(result: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  const booking = result.booking as Record<string, unknown> | undefined;
  if (booking) {
    const b: Record<string, unknown> = {};
    b.bookingRef = "<extract_booking_ref>";
    if (booking.airline) b.airline = booking.airline;
    b.totalPrice = "<extract_numeric_price>";
    if (booking.currency) b.currency = booking.currency;
    b.ticketNumbers = ["<extract_ticket_number>"];
    if (booking.passengers && Array.isArray(booking.passengers)) {
      b.passengers = booking.passengers.map(() => ({
        name: "<extract_passenger_name>",
        ticketNumber: "<extract_ticket_number>",
      }));
    }
    if (booking.cabinClass) b.cabinClass = booking.cabinClass;
    if (booking.refundPolicy) b.refundPolicy = booking.refundPolicy;
    if (booking.baggage) b.baggage = booking.baggage;
    if (booking.changeFee !== undefined) b.changeFee = booking.changeFee;
    out.booking = b;
  }

  const segments = result.segments as Record<string, unknown>[] | undefined;
  if (segments && Array.isArray(segments)) {
    out.segments = segments.map((seg) => {
      const s: Record<string, unknown> = {};
      if (seg.flightNumber) s.flightNumber = seg.flightNumber;
      if (seg.airline) s.airline = seg.airline;
      if (seg.departure) s.departure = seg.departure;
      s.departureCity = "<extract_city_name>";
      if (seg.arrival) s.arrival = seg.arrival;
      s.arrivalCity = "<extract_city_name>";
      s.departureDate = "<extract_YYYY-MM-DD>";
      s.departureTimeScheduled = "<extract_HH:mm>";
      s.arrivalDate = "<extract_YYYY-MM-DD>";
      s.arrivalTimeScheduled = "<extract_HH:mm>";
      s.duration = "<calculate_duration>";
      if (seg.cabinClass) s.cabinClass = seg.cabinClass;
      if (seg.departureTerminal) s.departureTerminal = "<extract_terminal>";
      if (seg.arrivalTerminal) s.arrivalTerminal = "<extract_terminal>";
      s.bookingRef = "<extract_booking_ref>";
      s.ticketNumber = "<extract_ticket_number>";
      return s;
    });
  }

  return out;
}

/**
 * Redact personal data from a text sample while keeping structural markers
 * (section headers, field labels, layout) intact for the AI to learn from.
 */
function redactTextSample(text: string): string {
  return text
    .replace(/\b\d{13}\b/g, "{TICKET}")
    .replace(/\+?\d[\d\s()-]{8,}\d/g, "{PHONE}")
    .replace(/\S+@\S+\.\S+/g, "{EMAIL}")
    .replace(/((?:Total(?:\s+Fare)?|Toplam|Grand\s+Total|Price)[:\s]+(?:TRY|EUR|USD|AED)\s*)[\d.,]+/gi, "$1{PRICE}")
    .replace(/((?:Ms\.|Mr\.|Mrs\.|Miss|Mstr|Dr\.)\s+)[A-Z][a-zA-Z\u00C0-\u024F]+\s+[A-Z][a-zA-Z\u00C0-\u024F]+/g, "$1{PASSENGER_NAME}");
}

/**
 * Build few-shot examples from templates to enhance AI prompt.
 * Redacts concrete values so the AI learns document STRUCTURE, not specific data.
 */
export function buildFewShotExamples(templates: ParseTemplate[]): string {
  if (templates.length === 0) return "";

  const examples = templates.map((t, i) => {
    const redacted = redactParsedResult(t.parsed_result);
    const sampleText = redactTextSample(t.text_sample);
    return `--- Example ${i + 1} (${t.airline_hint || "Unknown airline"}) ---
Input text structure (first 300 chars):
${sampleText.slice(0, 300)}...

Field locations in this format:
${JSON.stringify(redacted, null, 2).slice(0, 1000)}
---`;
  });

  return `\n\nHere are STRUCTURAL examples from similar ticket formats.
These show WHERE each field is located — extract actual values from the NEW input text.
Do NOT copy placeholder values from examples.\n\n${examples.join("\n\n")}\n`;
}
