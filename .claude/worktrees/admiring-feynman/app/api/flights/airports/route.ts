import { NextRequest, NextResponse } from "next/server";
import { getCurrentCmsUser } from "@/lib/hotels/cmsAuth";

// ─── Kiwi Tequila Locations API ─────────────────────────────────────────────
// Docs: https://tequila.kiwi.com/portal/docs/tequila_api/locations_api
// Replaces Amadeus airport/city lookup with Kiwi.com locations/query endpoint.

const KIWI_API_BASE = "https://tequila-api.kiwi.com";

interface KiwiLocation {
  id: string;
  int_id: number;
  active: boolean;
  code: string;
  icao?: string;
  name: string;
  slug?: string;
  alternative_names?: string[];
  rank: number;
  global_rank_dst?: number;
  dst_popularity_score?: number;
  timezone?: string;
  city?: {
    id: string;
    name: string;
    code: string;
    slug?: string;
    country?: {
      id: string;
      name: string;
      code: string;
    };
  };
  country?: {
    id: string;
    name: string;
    code: string;
  };
  region?: {
    id: string;
    name: string;
  };
  continent?: {
    id: string;
    name: string;
    code: string;
  };
  type: string; // "airport" | "city" | "country" | "station" etc.
  location?: {
    lat: number;
    lon: number;
  };
}

// Transform Kiwi location to the format our frontend expects (Amadeus-like)
function toAmadeusFormat(loc: KiwiLocation) {
  return {
    iataCode: loc.code,
    name: loc.name,
    cityName: loc.city?.name || loc.name,
    countryCode: loc.city?.country?.code || loc.country?.code || "",
    subType: loc.type === "airport" ? "AIRPORT" : "CITY",
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentCmsUser(request);
    if (!user) {
      return NextResponse.json({ data: [] }, { status: 401 });
    }

    const q = request.nextUrl.searchParams.get("q") || "";
    if (q.length < 2) return NextResponse.json({ data: [] });

    const apiKey = process.env.KIWI_TEQUILA_API_KEY;
    if (!apiKey) {
      // Fallback: return empty if not configured
      return NextResponse.json({ data: [] });
    }

    const params = new URLSearchParams({
      term: q,
      location_types: "airport,city",
      limit: "8",
      active_only: "true",
      sort: "rank",
    });

    const res = await fetch(`${KIWI_API_BASE}/locations/query?${params}`, {
      headers: {
        apikey: apiKey,
        Accept: "application/json",
      },
    });

    if (!res.ok) return NextResponse.json({ data: [] });

    const data = await res.json();
    const locations: KiwiLocation[] = data.locations || [];

    return NextResponse.json({
      data: locations.map(toAmadeusFormat),
    });
  } catch {
    return NextResponse.json({ data: [] });
  }
}
