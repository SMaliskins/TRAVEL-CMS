import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiUser } from "@/lib/auth/getApiUser";

/**
 * GET /api/geo/cities-cache
 * Returns all custom_cities for the company's client-side cache.
 */
export async function GET(request: NextRequest) {
  const auth = await getApiUser(request);
  if (!auth) return NextResponse.json({ cities: [] });

  const { data, error } = await supabaseAdmin
    .from("custom_cities")
    .select("name, country, country_code, lat, lng, iata_code")
    .eq("company_id", auth.companyId)
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
