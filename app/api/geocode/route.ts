import { NextRequest, NextResponse } from "next/server";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "TravelCMS/1.0 (map display; contact required)";

/**
 * GET /api/geocode?q=address
 * Returns coordinates for an address via Nominatim (OSM).
 * Usage policy: https://operations.osmfoundation.org/policies/nominatim/
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  if (!q || typeof q !== "string" || !q.trim()) {
    return NextResponse.json({ error: "Missing or empty query 'q'" }, { status: 400 });
  }

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", q.trim());
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: 86400 }, // cache 24h
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Geocoding service error" }, { status: 502 });
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: "No results" }, { status: 404 });
    }
    const first = data[0] as { lat?: string; lon?: string; display_name?: string };
    const lat = first.lat != null ? parseFloat(String(first.lat)) : undefined;
    const lng = first.lon != null ? parseFloat(String(first.lon)) : undefined;
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: "Invalid result" }, { status: 502 });
    }
    return NextResponse.json({
      data: { lat, lng, display_name: first.display_name ?? null },
    });
  } catch (e) {
    console.error("Geocode error:", e);
    return NextResponse.json({ error: "Geocoding failed" }, { status: 502 });
  }
}
