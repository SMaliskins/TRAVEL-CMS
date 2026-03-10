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

type FlightSegmentLike = { departure?: string; arrival?: string; departureCity?: string; arrivalCity?: string };

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

  // Flight: use stored service name (auto-generated from segments in Add/Edit modal)
  if (isFlight && s.name) {
    // Match "DD.MM IATA-IATA-IATA" or "DD.MM.YYYY IATA-IATA-IATA" with optional date prefix
    const dateRouteMatch = s.name.match(/^(\d{2}\.\d{2}(?:\.\d{4})?)\s+([A-Z]{3}[\s\-–—>→/]+(?:[A-Z]{3}[\s\-–—>→/]*)+)$/);
    if (dateRouteMatch) {
      const datePrefix = dateRouteMatch[1];
      const routePart = dateRouteMatch[2];
      const codes = routePart.split(/[\s\-–—>→/]+/).map((x) => x.trim().toUpperCase()).filter((x) => /^[A-Z]{3}$/.test(x));
      if (codes.length >= 2) {
        const cities = codes.map((code) => getCityByIATA(code)?.name ?? code);
        return `${datePrefix} ${cities.join(" - ")}`;
      }
    }
    // If name is only IATA codes (e.g. "TLL - ARN - NCE"), transcribe to city names
    const codes = s.name.split(/[\s\-–—>→]+/).map((x) => x.trim().toUpperCase()).filter((x) => x.length === 3 && /^[A-Z]{3}$/.test(x));
    const nonCodeParts = s.name.replace(/[A-Z]{3}/g, "").replace(/[\s\-–—>→/]+/g, "").trim();
    if (codes.length >= 2 && !nonCodeParts) {
      const parts = codes.map((code) => getCityByIATA(code)?.name ?? code);
      return parts.join(" — ");
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
