import { NextRequest, NextResponse } from "next/server";
import { getCurrentCmsUser } from "@/lib/hotels/cmsAuth";

// ─── Kiwi Tequila Search API ────────────────────────────────────────────────
// Docs: https://tequila.kiwi.com/portal/docs/tequila_api/search_api
// Replaces Amadeus flight-offers with Kiwi.com v2/search endpoint.
// The response is transformed to the Amadeus-like format the frontend expects.

const KIWI_API_BASE = "https://tequila-api.kiwi.com";

// Map our travel class codes to Kiwi's selected_cabins param
// Kiwi: M = economy, W = economy premium, C = business, F = first
const CABIN_MAP: Record<string, string> = {
  ECONOMY: "M",
  PREMIUM_ECONOMY: "W",
  BUSINESS: "C",
  FIRST: "F",
};

// ─── Kiwi response types ────────────────────────────────────────────────────

interface KiwiRouteSegment {
  id: string;
  flyFrom: string;
  flyTo: string;
  cityFrom: string;
  cityTo: string;
  cityCodeFrom: string;
  cityCodeTo: string;
  local_departure: string;
  local_arrival: string;
  utc_departure: string;
  utc_arrival: string;
  airline: string;
  flight_no: number;
  operating_carrier?: string;
  operating_flight_no?: string;
  equipment?: string;
  return?: number; // 0 = outbound, 1 = return
}

interface KiwiFlightResult {
  id: string;
  flyFrom: string;
  flyTo: string;
  cityFrom: string;
  cityTo: string;
  cityCodeFrom: string;
  cityCodeTo: string;
  countryFrom?: { code: string; name: string };
  countryTo?: { code: string; name: string };
  local_departure: string;
  local_arrival: string;
  utc_departure: string;
  utc_arrival: string;
  distance?: number;
  duration: {
    departure: number; // seconds
    return: number;    // seconds
    total: number;
  };
  price: number;
  conversion?: Record<string, number>;
  fare?: {
    adults: number;
    children: number;
    infants: number;
  };
  bags_price?: Record<string, number>;
  availability?: {
    seats: number | null;
  };
  airlines: string[];
  route: KiwiRouteSegment[];
  booking_token?: string;
  deep_link?: string;
  quality?: number;
  has_airport_change?: boolean;
  technical_stops?: number;
  nightsInDest?: number | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Convert seconds to ISO 8601 duration, e.g. 11700 → "PT3H15M" */
function secondsToIsoDuration(sec: number): string {
  if (!sec || sec <= 0) return "PT0M";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}H`);
  if (m > 0) parts.push(`${m}M`);
  return `PT${parts.join("") || "0M"}`;
}

/** Format Kiwi date (2024-01-15T10:30:00.000Z) to Amadeus-like (2024-01-15T10:30:00) */
function formatDateTime(dt: string): string {
  return dt.replace(/\.000Z$/, "").replace(/Z$/, "");
}

/** Convert dd/mm/yyyy to YYYY-MM-DD and vice versa */
function toKiwiDate(isoDate: string): string {
  // Input: YYYY-MM-DD → Output: dd/mm/yyyy
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

// ─── Transform Kiwi → Amadeus-like format ───────────────────────────────────

function transformToAmadeusFormat(
  kiwiFlight: KiwiFlightResult,
  currency: string
) {
  // Split route into outbound and return segments
  const outboundSegments = kiwiFlight.route.filter((s) => s.return === 0 || !s.return);
  const returnSegments = kiwiFlight.route.filter((s) => s.return === 1);

  const buildSegment = (seg: KiwiRouteSegment) => ({
    departure: {
      iataCode: seg.flyFrom,
      at: formatDateTime(seg.local_departure),
      terminal: undefined,
    },
    arrival: {
      iataCode: seg.flyTo,
      at: formatDateTime(seg.local_arrival),
      terminal: undefined,
    },
    carrierCode: seg.airline,
    number: String(seg.flight_no),
    aircraft: seg.equipment ? { code: seg.equipment } : undefined,
    numberOfStops: 0,
    duration: secondsToIsoDuration(
      (new Date(seg.local_arrival).getTime() -
        new Date(seg.local_departure).getTime()) /
        1000
    ),
  });

  const itineraries = [];

  // Outbound itinerary
  if (outboundSegments.length > 0) {
    itineraries.push({
      duration: secondsToIsoDuration(kiwiFlight.duration.departure),
      segments: outboundSegments.map(buildSegment),
    });
  }

  // Return itinerary (if round trip)
  if (returnSegments.length > 0) {
    itineraries.push({
      duration: secondsToIsoDuration(kiwiFlight.duration.return),
      segments: returnSegments.map(buildSegment),
    });
  }

  return {
    id: kiwiFlight.id,
    itineraries,
    price: {
      currency,
      total: String(kiwiFlight.price),
      base: String(kiwiFlight.fare?.adults || kiwiFlight.price),
    },
    numberOfBookableSeats: kiwiFlight.availability?.seats || undefined,
    deepLink: kiwiFlight.deep_link || null,
    bookingToken: kiwiFlight.booking_token || null,
    quality: kiwiFlight.quality || null,
  };
}

// Build a carriers dictionary from the results
function buildCarriersDictionary(flights: KiwiFlightResult[]): Record<string, string> {
  const carriers: Record<string, string> = {};
  for (const flight of flights) {
    for (const seg of flight.route) {
      if (seg.airline && !carriers[seg.airline]) {
        // Kiwi doesn't return airline names in the search response,
        // so we use the code as a placeholder. The frontend already
        // handles this gracefully (shows code if name is same as code).
        carriers[seg.airline] = seg.airline;
      }
    }
  }
  return carriers;
}

// ─── Route Handler ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentCmsUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      origin,
      destination,
      departureDate,
      returnDate,
      adults = 1,
      travelClass = "ECONOMY",
    } = body;

    if (!origin || !destination || !departureDate) {
      return NextResponse.json(
        { error: "origin, destination, and departureDate are required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.KIWI_TEQUILA_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Flight search not configured. Add KIWI_TEQUILA_API_KEY to environment variables. Get your free API key at https://tequila.kiwi.com",
          setup: true,
        },
        { status: 503 }
      );
    }

    // Build Kiwi search params
    const params = new URLSearchParams({
      fly_from: origin.toUpperCase(),
      fly_to: destination.toUpperCase(),
      date_from: toKiwiDate(departureDate),
      date_to: toKiwiDate(departureDate), // same day
      adults: String(Math.max(1, Number(adults))),
      curr: "EUR",
      limit: "15",
      sort: "price",
      selected_cabins: CABIN_MAP[travelClass] || "M",
      flight_type: returnDate ? "round" : "oneway",
      max_stopovers: "2",
      vehicle_type: "aircraft",
    });

    if (returnDate) {
      params.set("return_from", toKiwiDate(returnDate));
      params.set("return_to", toKiwiDate(returnDate));
    }

    const res = await fetch(`${KIWI_API_BASE}/v2/search?${params}`, {
      headers: {
        apikey: apiKey,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: "Flight search failed",
          details: errBody?.error || errBody?.message || "Unknown error from Kiwi API",
        },
        { status: res.status }
      );
    }

    const data = await res.json();
    const kiwiFlights: KiwiFlightResult[] = data.data || [];
    const currency = data.currency || "EUR";

    // Transform to Amadeus-like format for frontend compatibility
    const transformed = kiwiFlights.map((f) =>
      transformToAmadeusFormat(f, currency)
    );

    const carriersDictionary = buildCarriersDictionary(kiwiFlights);

    return NextResponse.json({
      data: transformed,
      dictionaries: {
        carriers: carriersDictionary,
      },
      meta: {
        provider: "kiwi",
        totalResults: data._results || transformed.length,
        searchId: data.search_id || null,
        currency,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
