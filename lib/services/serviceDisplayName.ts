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

  // Flight: transcribe IATA codes to city names when flightSegments exist
  if (isFlight && s.flightSegments && s.flightSegments.length > 0) {
    const segs = [...s.flightSegments].sort((a, b) => {
      const da = (a as { departureDate?: string; departure_time?: string }).departureDate ?? (a as { departure_date?: string }).departure_date ?? "";
      const db = (b as { departureDate?: string; departure_time?: string }).departureDate ?? (b as { departure_date?: string }).departure_date ?? "";
      const ta = (a as { departureTimeScheduled?: string }).departureTimeScheduled ?? (a as { departure_time_scheduled?: string }).departure_time_scheduled ?? "";
      const tb = (b as { departureTimeScheduled?: string }).departureTimeScheduled ?? (b as { departure_time_scheduled?: string }).departure_time_scheduled ?? "";
      return new Date(`${da}T${ta}`).getTime() - new Date(`${db}T${tb}`).getTime();
    });
    const parts: string[] = [];
    const depCode = (segs[0] as { departure?: string }).departure;
    if (depCode) {
      const c = getCityByIATA(depCode) || getCityByName((segs[0] as { departureCity?: string }).departureCity ?? depCode);
      parts.push(c?.name ?? depCode);
    }
    for (const seg of segs) {
      const arrCode = (seg as { arrival?: string }).arrival;
      if (arrCode) {
        const c = getCityByIATA(arrCode) || getCityByName((seg as { arrivalCity?: string }).arrivalCity ?? arrCode);
        parts.push(c?.name ?? arrCode);
      }
    }
    if (parts.length > 0) return parts.join(" — ");
  }

  // Flight without segments: try to transcribe IATA codes from name (e.g. "RIX - FRA - NCE")
  if (isFlight && s.name) {
    const codes = s.name.split(/[\s\-–—>→]+/).map((x) => x.trim().toUpperCase()).filter((x) => x.length === 3 && /^[A-Z]{3}$/.test(x));
    if (codes.length >= 2) {
      const parts = codes.map((code) => getCityByIATA(code)?.name ?? code);
      return parts.join(" — ");
    }
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
