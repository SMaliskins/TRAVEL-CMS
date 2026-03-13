import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiUser } from "@/lib/auth/getApiUser";

interface CityResult {
  name: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  iataCode?: string;
  source: "local" | "db" | "external";
}

// GET: search custom_cities DB + Nominatim fallback
export async function GET(request: NextRequest) {
  const apiUser = await getApiUser(request);
  if (!apiUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ cities: [] });
  }

  const results: CityResult[] = [];
  const seen = new Set<string>();
  const addCity = (c: CityResult) => {
    const key = `${c.name.toLowerCase()}|${c.countryCode.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push(c);
    }
  };

  // 1. Search company's custom_cities in DB
  const { data: dbCities } = await supabaseAdmin
    .from("custom_cities")
    .select("name, country, country_code, lat, lng, iata_code")
    .eq("company_id", apiUser.companyId)
    .ilike("name", `%${q}%`)
    .limit(10);

  if (dbCities) {
    for (const c of dbCities) {
      addCity({
        name: c.name,
        country: c.country,
        countryCode: c.country_code,
        lat: c.lat,
        lng: c.lng,
        iataCode: c.iata_code || undefined,
        source: "db",
      });
    }
  }

  // 2. If fewer than 5 results, query Nominatim (OpenStreetMap geocoder)
  if (results.length < 5) {
    try {
      const nominatimUrl = new URL("https://nominatim.openstreetmap.org/search");
      nominatimUrl.searchParams.set("q", q);
      nominatimUrl.searchParams.set("format", "jsonv2");
      nominatimUrl.searchParams.set("featuretype", "city");
      nominatimUrl.searchParams.set("limit", "5");
      nominatimUrl.searchParams.set("addressdetails", "1");
      nominatimUrl.searchParams.set("accept-language", "en");

      const res = await fetch(nominatimUrl.toString(), {
        headers: { "User-Agent": "TravelCMS/1.0" },
        signal: AbortSignal.timeout(4000),
      });

      if (res.ok) {
        const data = await res.json();
        for (const item of data) {
          const name = item.address?.city
            || item.address?.town
            || item.address?.village
            || item.address?.municipality
            || item.address?.island
            || item.name;
          const country = item.address?.country || "";
          const countryCode = (item.address?.country_code || "").toUpperCase();
          const lat = parseFloat(item.lat);
          const lng = parseFloat(item.lon);

          if (name && countryCode && !isNaN(lat) && !isNaN(lng)) {
            addCity({
              name,
              country,
              countryCode,
              lat,
              lng,
              source: "external",
            });
          }
        }
      }
    } catch {
      // Nominatim timeout or error — return what we have
    }
  }

  return NextResponse.json({ cities: results.slice(0, 10) });
}

// POST: save a city to custom_cities (auto-learning)
export async function POST(request: NextRequest) {
  const apiUser = await getApiUser(request);
  if (!apiUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, country, countryCode, lat, lng, iataCode } = body;

  if (!name || !country || !countryCode || lat == null || lng == null) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("custom_cities").upsert(
    {
      company_id: apiUser.companyId,
      name,
      country,
      country_code: countryCode,
      lat,
      lng,
      iata_code: iataCode || null,
    },
    { onConflict: "company_id,name,country_code", ignoreDuplicates: true }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
