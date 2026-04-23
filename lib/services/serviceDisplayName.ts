import { getCityByIATA, getCityByName } from "@/lib/data/cities";

/**
 * Returns the same string that is shown in the "Name" column of the order services list.
 * Used so the invoice "Service" column shows exactly what the user sees in the list,
 * not the Direction field or raw service_name from DB.
 */

function toTitleCase(str: string): string {
  return str
    .trim()
    .split(/\s+/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

const BOARD_LABELS: Record<string, string> = {
  room_only: "Room Only",
  breakfast: "Breakfast",
  half_board: "Half Board",
  full_board: "Full Board",
  all_inclusive: "AI",
  uai: "UAI",
};

type FlightSegmentLike = {
  departure?: string;
  arrival?: string;
  departureCity?: string;
  arrivalCity?: string;
  departureDate?: string;
  arrivalDate?: string;
};

/**
 * IATA → city name with safe fallback to a city already known on the segment
 * (e.g. parsed from the supplier confirmation but not present in our local
 * IATA database — like RMO → Chișinău).
 */
function resolveSegmentCity(code: string | undefined, fallbackCity?: string): string {
  const c = (code || "").trim().toUpperCase();
  const cityFallback = (fallbackCity || "").trim();
  if (!c && cityFallback) return cityFallback;
  if (!c) return "";
  const fromIata = getCityByIATA(c)?.name;
  if (fromIata) return fromIata;
  return cityFallback || c;
}

function formatSegmentDate(date: string | undefined): string {
  if (!date) return "";
  // Expecting YYYY-MM-DD; render as DD.MM
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}.${m[2]}`;
  // Or DD.MM[.YYYY] passthrough
  const m2 = date.match(/^(\d{2})\.(\d{2})/);
  if (m2) return `${m2[1]}.${m2[2]}`;
  return "";
}

/**
 * Build a flight service name from structured segments. Groups by departure
 * date and joins city names with " - ", same shape as the legacy stored name
 * ("DD.MM City1 - City2 - City3 / DD.MM City1 - City2"). Used when the
 * service has flightSegments[] available — covers IATA codes our local
 * database does not know but the parser recorded the city for.
 */
function buildFlightNameFromSegments(segments: FlightSegmentLike[]): string {
  if (!segments.length) return "";
  const groups: Array<{ date: string; segs: FlightSegmentLike[] }> = [];
  let currentDate: string | undefined;
  for (const seg of segments) {
    const d = seg.departureDate || currentDate || "";
    if (!groups.length || groups[groups.length - 1].date !== d) {
      groups.push({ date: d, segs: [seg] });
    } else {
      groups[groups.length - 1].segs.push(seg);
    }
    currentDate = d;
  }
  const parts = groups.map(({ date, segs }) => {
    const cities: string[] = [];
    if (segs[0]) cities.push(resolveSegmentCity(segs[0].departure, segs[0].departureCity));
    for (const s of segs) cities.push(resolveSegmentCity(s.arrival, s.arrivalCity));
    const filtered = cities.filter((c, i, arr) => c && c !== arr[i - 1]);
    const route = filtered.join(" - ");
    const datePrefix = formatSegmentDate(date);
    return datePrefix ? `${datePrefix} ${route}` : route;
  });
  return parts.filter(Boolean).join(" / ");
}

export type ServiceForDisplayName = {
  category?: string;
  name: string;
  hotelName?: string | null;
  hotelStarRating?: string | null;
  hotelRoom?: string | null;
  hotelBoard?: string | null;
  mealPlanText?: string | null;
  flightSegments?: FlightSegmentLike[] | null;
};

/**
 * Same logic as the Name column in OrderServicesBlock.
 * For Hotel / Tour / Package Tour: hotel (title case) · stars · room · board.
 * For other categories: service name as-is.
 * Fallback is used only when no hotel parts are present (so we never use Direction as primary).
 */
export function getServiceDisplayName(
  s: ServiceForDisplayName,
  fallback?: string
): string {
  const catNorm = (s.category || "").toLowerCase().replace(/\s+/g, " ").trim();
  const isHotelOrTour =
    catNorm === "hotel" ||
    catNorm === "tour" ||
    catNorm === "package tour" ||
    catNorm.includes("tour");
  const isFlight =
    catNorm.includes("flight") ||
    catNorm.includes("air ticket") ||
    catNorm.includes("авиа");

  // Flight: prefer rebuilding the name from structured segments, so IATA
  // codes our local database does not know (e.g. RMO → Chișinău) still
  // resolve to the city name captured during parsing.
  if (isFlight && s.flightSegments && s.flightSegments.length > 0) {
    const fromSegments = buildFlightNameFromSegments(s.flightSegments);
    if (fromSegments) return fromSegments;
  }

  // Flight: fall back to parsing the stored service name when no segments.
  if (isFlight && s.name) {
    // Multi-segment: "18.03 RIX-IST / 24.03 IST-RIX" — split by " / " and resolve each part
    const segments = s.name.split(/\s*\/\s*/);
    const dateRoutePattern = /^(\d{2}\.\d{2}(?:\.\d{4})?)\s+(.+)$/;
    let allConverted = true;
    const converted = segments.map((seg) => {
      const m = seg.match(dateRoutePattern);
      if (m) {
        const datePrefix = m[1];
        const routePart = m[2];
        const codes = routePart.split(/[\s\-–—>→]+/).map((x) => x.trim().toUpperCase()).filter((x) => /^[A-Z]{3}$/.test(x));
        if (codes.length >= 2) {
          const cities = codes.map((code) => getCityByIATA(code)?.name ?? code);
          return `${datePrefix} ${cities.join(" - ")}`;
        }
        const singleCode = routePart.trim().toUpperCase();
        if (/^[A-Z]{3}$/.test(singleCode)) {
          return `${datePrefix} ${getCityByIATA(singleCode)?.name ?? singleCode}`;
        }
      }
      // No date prefix — try pure IATA codes
      const codes = seg.split(/[\s\-–—>→]+/).map((x) => x.trim().toUpperCase()).filter((x) => /^[A-Z]{3}$/.test(x));
      const nonCodeParts = seg.replace(/[A-Z]{3}/g, "").replace(/[\s\-–—>→]+/g, "").trim();
      if (codes.length >= 2 && !nonCodeParts) {
        return codes.map((code) => getCityByIATA(code)?.name ?? code).join(" - ");
      }
      allConverted = false;
      return seg;
    });
    if (allConverted || converted.some((c, i) => c !== segments[i])) {
      return converted.join(" / ");
    }
    return s.name;
  }

  if (!isHotelOrTour) return s.name;

  const name = (s.hotelName || "").trim();
  const parts: string[] = [];
  if (name) parts.push(toTitleCase(name));
  if (s.hotelStarRating?.trim())
    parts.push(`${s.hotelStarRating.trim().replace(/\*/g, "")}*`);
  if (s.hotelRoom?.trim()) parts.push(toTitleCase(s.hotelRoom.trim()));
  const board = s.mealPlanText?.trim()
    ? toTitleCase(s.mealPlanText.trim())
    : s.hotelBoard
      ? BOARD_LABELS[String(s.hotelBoard)] || toTitleCase(String(s.hotelBoard))
      : null;
  if (board) parts.push(board);

  if (parts.length > 0) return parts.join(" · ").replace(/\* · /g, "*· ");
  return toTitleCase(fallback ?? s.name);
}
