import { NextRequest, NextResponse } from "next/server";
import { getAirportByIata } from "@/lib/airports";
import { CITIES } from "@/lib/data/cities";
import { estimateTransfer } from "@/lib/geo";

/**
 * GET /api/transfer-distance?airportCode=AYT&hotelAddress=Kemer,+Antalya&destinationCity=Antalya
 *
 * Returns approximate road distance (km) and travel time (min) between
 * an airport and a hotel/destination using haversine × road factor.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const airportCode = searchParams.get("airportCode")?.toUpperCase().trim();
  const hotelAddress = searchParams.get("hotelAddress")?.trim() || "";
  const destinationCity = searchParams.get("destinationCity")?.trim() || "";

  if (!airportCode) {
    return NextResponse.json({ error: "airportCode is required" }, { status: 400 });
  }

  const airport = getAirportByIata(airportCode);
  if (!airport || !airport.latitude || !airport.longitude) {
    return NextResponse.json({ error: `Airport ${airportCode} not found` }, { status: 404 });
  }

  let hotelLat: number | null = null;
  let hotelLng: number | null = null;
  let resolvedCity = "";

  const addressParts = hotelAddress
    .split(/[,\-/]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const candidateNames = [
    ...addressParts,
    destinationCity.toLowerCase(),
    airport.city.toLowerCase(),
  ].filter(Boolean);

  for (const candidate of candidateNames) {
    const match = CITIES.find(
      (c) => c.name.toLowerCase() === candidate ||
             c.name.toLowerCase().startsWith(candidate) ||
             candidate.startsWith(c.name.toLowerCase()),
    );
    if (match && match.name.toLowerCase() !== airport.city.toLowerCase()) {
      hotelLat = match.lat;
      hotelLng = match.lng;
      resolvedCity = match.name;
      break;
    }
  }

  if (hotelLat === null || hotelLng === null) {
    const cityMatch = CITIES.find((c) => c.iataCode === airportCode);
    if (cityMatch) {
      hotelLat = cityMatch.lat;
      hotelLng = cityMatch.lng;
      resolvedCity = cityMatch.name;
    }
  }

  if (hotelLat === null || hotelLng === null) {
    return NextResponse.json({
      airportCode,
      airportName: airport.name,
      airportCity: airport.city,
      distanceKm: null,
      estimatedMinutes: null,
      note: "Could not resolve hotel/destination coordinates",
    });
  }

  const { distanceKm, estimatedMinutes } = estimateTransfer(
    airport.latitude,
    airport.longitude,
    hotelLat,
    hotelLng,
  );

  const clampedDistance = Math.max(distanceKm, 5);
  const clampedMinutes = Math.max(estimatedMinutes, 10);

  return NextResponse.json({
    airportCode,
    airportName: airport.name,
    airportCity: airport.city,
    resolvedCity,
    distanceKm: clampedDistance,
    estimatedMinutes: clampedMinutes,
  });
}
