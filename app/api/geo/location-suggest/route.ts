import { NextRequest, NextResponse } from "next/server";
import { searchAirports } from "@/lib/airports";

interface LocationSuggestion {
  type: "airport" | "hotel" | "region";
  label: string;
  meta: {
    iata?: string;
    hid?: number;
    regionId?: number;
    lat?: number;
    lon?: number;
    country?: string;
  };
}

async function geocodeName(name: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q: name, format: "json", limit: "1" })}`,
      { headers: { "User-Agent": "TravelCMS/1.0" }, signal: AbortSignal.timeout(3000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ data: [] });
  }

  const results: LocationSuggestion[] = [];

  const airports = searchAirports(q, 5);
  for (const a of airports) {
    results.push({
      type: "airport",
      label: `${a.name} (${a.iata})`,
      meta: {
        iata: a.iata,
        lat: a.latitude,
        lon: a.longitude,
        country: a.country,
      },
    });
  }

  const keyId = process.env.RATEHAWK_KEY_ID;
  const apiKey = process.env.RATEHAWK_API_KEY;

  if (keyId && apiKey) {
    try {
      const { suggestHotels } = await import("@/lib/ratehawk/client");
      const { hotels, regions } = await suggestHotels(q, "en", keyId, apiKey);

      if (regions) {
        for (const r of regions.slice(0, 5)) {
          results.push({
            type: "region",
            label: `${r.name} (${r.type})`,
            meta: {
              regionId: typeof r.id === "number" ? r.id : undefined,
              country: r.country_code,
            },
          });
        }
      }

      const hotelGeoPromises = hotels.slice(0, 5).map(async (h) => {
        const geo = await geocodeName(h.name);
        results.push({
          type: "hotel" as const,
          label: h.name,
          meta: {
            hid: h.hid,
            lat: geo?.lat,
            lon: geo?.lon,
          },
        });
      });
      await Promise.all(hotelGeoPromises);
    } catch (err) {
      console.warn("[location-suggest] RateHawk error:", err);
    }
  }

  return NextResponse.json({ data: results });
}
