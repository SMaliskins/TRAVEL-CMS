import { NextRequest, NextResponse } from "next/server";
import { getAirportByIata } from "@/lib/airports";
import { getCityByIATA, getCityByName } from "@/lib/data/cities";

interface TransferResult {
  distanceKm: number;
  durationMin: number;
  label: string;
  source: "osrm" | "osrm-approx" | "haversine";
  geocodedAs?: string;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function geocodeQuery(query: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
      q: query,
      format: "json",
      limit: "1",
    })}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "TravelCMS/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

function extractLocationTokens(address: string): string[] {
  const noiseWords = new Set([
    "turizm", "merkezi", "caddesi", "cad", "sokak", "sok", "mahallesi", "mah",
    "bulvari", "bulv", "no", "kat", "apt", "street", "str", "road", "rd",
    "avenue", "ave", "blvd", "center", "centre", "resort", "hotel", "all",
    "inclusive", "plaza", "suite", "floor", "building", "block",
  ]);
  return address
    .split(/[\s,;/]+/)
    .map((w) => w.replace(/[^a-zA-ZçğıöşüÇĞİÖŞÜa-ząćęłńóśźżа-яА-Я\u00C0-\u024F]/g, ""))
    .filter((w) => w.length > 2 && !noiseWords.has(w.toLowerCase()));
}

async function tryMultipleGeocoding(
  hotelName: string | null,
  hotelAddress: string | null,
  airportCity: string,
  airportCountry: string,
): Promise<{ coords: { lat: number; lon: number }; method: string } | null> {
  const queries: { q: string; method: string }[] = [];

  // Priority 1: Full address + country (most reliable with geo context)
  if (hotelAddress) {
    queries.push({ q: `${hotelAddress}, ${airportCountry}`, method: "address+country" });
    queries.push({ q: `${hotelAddress}, ${airportCity}, ${airportCountry}`, method: "address+city+country" });
    queries.push({ q: hotelAddress, method: "address" });
  }

  // Priority 2: Hotel name + country (specific hotel search in correct country)
  if (hotelName) {
    queries.push({ q: `${hotelName}, ${airportCity}, ${airportCountry}`, method: "name+city+country" });
    queries.push({ q: `${hotelName}, ${airportCountry}`, method: "name+country" });
  }

  // Priority 3: Extract location words from address + country
  if (hotelAddress) {
    const tokens = extractLocationTokens(hotelAddress);
    for (const token of tokens) {
      queries.push({ q: `${token}, ${airportCountry}`, method: `token(${token})+country` });
      queries.push({ q: `${token}, ${airportCity}, ${airportCountry}`, method: `token(${token})+city+country` });
    }
  }

  // Priority 4: Hotel name alone (LAST — risky, may find wrong country)
  if (hotelName) {
    queries.push({ q: hotelName, method: "name-only" });
  }

  for (const { q, method } of queries) {
    const coords = await geocodeQuery(q);
    if (coords) {
      return { coords, method };
    }
  }

  return null;
}

async function osrmRoute(
  fromLon: number, fromLat: number,
  toLon: number, toLat: number,
): Promise<{ distanceKm: number; durationMin: number } | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.length) return null;
    const route = data.routes[0];
    return {
      distanceKm: Math.round(route.distance / 1000),
      durationMin: Math.round(route.duration / 60),
    };
  } catch {
    return null;
  }
}

function formatLabel(distanceKm: number, durationMin: number): string {
  const hours = Math.floor(durationMin / 60);
  const mins = durationMin % 60;
  const timeStr = hours > 0
    ? `~${hours}h ${mins > 0 ? `${mins} min` : ""}`
    : `~${durationMin} min`;
  return `~${distanceKm} km, ${timeStr.trim()}`;
}

function haversineFallback(
  airportLat: number, airportLon: number,
  hotelLat: number, hotelLon: number,
): TransferResult | null {
  const straight = haversineKm(airportLat, airportLon, hotelLat, hotelLon);
  if (straight < 2) return null;
  const roadKm = Math.round(straight * 1.3);
  const durationMin = Math.max(10, Math.round((roadKm / 50) * 60));
  return {
    distanceKm: roadKm,
    durationMin,
    label: formatLabel(roadKm, durationMin),
    source: "haversine",
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const airportCode = searchParams.get("airport");
  const hotelAddress = searchParams.get("address");
  const hotelName = searchParams.get("hotelName");
  const destLat = searchParams.get("lat");
  const destLon = searchParams.get("lon");

  if (!airportCode) {
    return NextResponse.json({ error: "airport param required" }, { status: 400 });
  }

  const airport = getAirportByIata(airportCode);
  if (!airport) {
    return NextResponse.json({ error: "Airport not found" }, { status: 404 });
  }

  const airportCity = airport.city || "";
  const airportCountry = airport.country || "";

  let hotelCoords: { lat: number; lon: number } | null = null;
  let geocodeMethod = "none";

  // Priority 0: use explicit coordinates when provided (from location-suggest meta)
  if (destLat && destLon) {
    const lat = parseFloat(destLat);
    const lon = parseFloat(destLon);
    if (!isNaN(lat) && !isNaN(lon)) {
      const checkDist = haversineKm(airport.latitude, airport.longitude, lat, lon);
      if (checkDist <= 500) {
        hotelCoords = { lat, lon };
        geocodeMethod = "explicit-coords";
      }
    }
  }

  // Fallback: multi-strategy Nominatim geocoding
  if (!hotelCoords) {
    const geocoded = await tryMultipleGeocoding(hotelName || null, hotelAddress || null, airportCity, airportCountry);
    hotelCoords = geocoded?.coords ?? null;
    geocodeMethod = geocoded?.method ?? "none";

    if (hotelCoords) {
      const checkDist = haversineKm(airport.latitude, airport.longitude, hotelCoords.lat, hotelCoords.lon);
      if (checkDist > 500) {
        hotelCoords = null;
        geocodeMethod = "none";
      }
    }
  }

  // Last resort: airport city coordinates from our DB
  if (!hotelCoords) {
    const airportCityData = getCityByIATA(airportCode) || getCityByName(airportCity);
    if (airportCityData) {
      hotelCoords = { lat: airportCityData.lat, lon: airportCityData.lng };
      geocodeMethod = "city-fallback";
    }
  }

  if (!hotelCoords) {
    return NextResponse.json({ data: null });
  }

  const straightKm = haversineKm(airport.latitude, airport.longitude, hotelCoords.lat, hotelCoords.lon);
  const isCityFallback = geocodeMethod === "city-fallback" || straightKm < 3;

  const route = await osrmRoute(
    airport.longitude, airport.latitude,
    hotelCoords.lon, hotelCoords.lat,
  );

  if (route && route.distanceKm > 0) {
    const result: TransferResult = {
      ...route,
      label: formatLabel(route.distanceKm, route.durationMin),
      source: isCityFallback ? "osrm-approx" : "osrm",
      geocodedAs: geocodeMethod,
    };
    return NextResponse.json({ data: result });
  }

  const fallback = haversineFallback(
    airport.latitude, airport.longitude,
    hotelCoords.lat, hotelCoords.lon,
  );

  if (fallback) {
    fallback.geocodedAs = geocodeMethod;
  }

  return NextResponse.json({ data: fallback });
}
