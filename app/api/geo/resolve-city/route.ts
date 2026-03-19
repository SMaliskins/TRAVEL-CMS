import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiUser } from "@/lib/auth/getApiUser";

const ALLOWED_PLACE_TYPES = new Set([
  "city", "town", "village", "municipality", "island",
  "hamlet", "suburb", "borough", "quarter", "neighbourhood",
  "resort", "administrative", "county",
]);

/**
 * POST /api/geo/resolve-city
 * Resolves a city name to full geo data via Nominatim.
 * Validates it's a real place before saving to custom_cities.
 *
 * Body: { name: string, countryHint?: string }
 * Returns: { city: { name, country, countryCode, lat, lng } | null }
 */
export async function POST(request: NextRequest) {
  const auth = await getApiUser(request);
  if (!auth) return NextResponse.json({ city: null });

  const body = await request.json();
  const rawName = (body.name || "").trim();
  const countryHint = (body.countryHint || "").trim();

  if (!rawName || rawName.length < 2 || rawName.length > 100) {
    return NextResponse.json({ city: null });
  }

  if (/[<>{}()\[\]\\\/;]/.test(rawName)) {
    return NextResponse.json({ city: null });
  }

  // 1. Check custom_cities first
  const { data: existing } = await supabaseAdmin
    .from("custom_cities")
    .select("name, country, country_code, lat, lng, iata_code")
    .ilike("name", rawName)
    .limit(1);

  if (existing && existing.length > 0) {
    const c = existing[0];
    return NextResponse.json({
      city: { name: c.name, country: c.country, countryCode: c.country_code, lat: c.lat, lng: c.lng },
    });
  }

  // 2. Query Nominatim
  try {
    const query = countryHint ? `${rawName}, ${countryHint}` : rawName;
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "5");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("accept-language", "en");

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "TravelCMS/1.0" },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json({ city: null });
    }

    const results = await res.json();

    for (const item of results) {
      const placeType = (item.type || "").toLowerCase();
      const placeClass = (item.class || "").toLowerCase();

      const isValidPlace =
        (placeClass === "place" && ALLOWED_PLACE_TYPES.has(placeType)) ||
        (placeClass === "boundary" && placeType === "administrative") ||
        (placeClass === "tourism" && placeType === "resort");

      if (!isValidPlace) continue;

      const name =
        item.address?.city ||
        item.address?.town ||
        item.address?.village ||
        item.address?.municipality ||
        item.address?.island ||
        item.address?.resort ||
        item.name;

      const country = item.address?.country || "";
      const countryCode = (item.address?.country_code || "").toUpperCase();
      const lat = parseFloat(item.lat);
      const lng = parseFloat(item.lon);

      if (!name || !countryCode || isNaN(lat) || isNaN(lng)) continue;

      // Validate: the resolved name should be similar to the input
      const inputNorm = rawName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const resultNorm = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const isSimilar =
        resultNorm.includes(inputNorm) ||
        inputNorm.includes(resultNorm) ||
        levenshteinRatio(inputNorm, resultNorm) > 0.6;

      if (!isSimilar) continue;

      // 3. Save to custom_cities for this company
      try {
        await supabaseAdmin.from("custom_cities").upsert(
          {
            company_id: auth.companyId,
            name,
            country,
            country_code: countryCode,
            lat,
            lng,
            iata_code: null,
          },
          { onConflict: "company_id,name,country_code", ignoreDuplicates: true }
        );
      } catch {
        // ignore save error — still return the resolved city
      }

      return NextResponse.json({
        city: { name, country, countryCode, lat, lng },
      });
    }
  } catch {
    // Nominatim timeout — return null
  }

  return NextResponse.json({ city: null });
}

function levenshteinRatio(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
    for (let j = 1; j <= b.length; j++) {
      if (i === 0) { matrix[i][j] = j; continue; }
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return 1 - matrix[a.length][b.length] / maxLen;
}
