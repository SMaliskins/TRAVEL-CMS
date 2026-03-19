import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * GET /api/geo/cities-cache
 * Returns all custom_cities for the client-side cache.
 * No auth required — city names are not sensitive data.
 */
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("custom_cities")
    .select("name, country, country_code, lat, lng, iata_code")
    .limit(2000);

  if (error) {
    return NextResponse.json({ cities: [] });
  }

  const cities = (data || []).map((c) => ({
    name: c.name,
    country: c.country,
    countryCode: c.country_code,
    lat: c.lat,
    lng: c.lng,
    iataCode: c.iata_code || undefined,
  }));

  return NextResponse.json({ cities });
}
