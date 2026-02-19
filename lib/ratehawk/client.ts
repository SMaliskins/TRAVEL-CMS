/**
 * RateHawk (Emerging Travel Group) API client
 * Docs: https://docs.emergingtravel.com/
 *
 * Endpoints:
 * - Suggest hotel and region: /api/b2b/v3/search/multicomplete/
 * - Retrieve hotel content: /api/b2b/v3/hotel/info/ (B2B/Affiliate API)
 */

const RATEHAWK_BASE = "https://api.worldota.net";
const RATEHAWK_SANDBOX = "https://api-sandbox.worldota.net";

export interface RateHawkHotelSuggestion {
  hid: number;
  id?: string;
  name: string;
  region_id: number;
}

export interface RateHawkRegionSuggestion {
  id: number | string;
  name: string;
  type: string;
  country_code: string;
}

export interface RateHawkSuggestResponse {
  hotels: RateHawkHotelSuggestion[];
  regions: RateHawkRegionSuggestion[] | null;
}

/** Room group from hotel info API */
export interface RateHawkRoomGroup {
  name: string;
  name_struct?: { main_name?: string };
}

export interface RateHawkHotelContent {
  hid: number;
  id?: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
  postal_code?: string;
  region?: {
    name?: string;
    country_code?: string;
    type?: string;
  };
  /** Room categories from room_groups */
  room_groups?: RateHawkRoomGroup[];
  /** Meal types from metapolicy_struct.meal */
  meal_types?: string[];
}

function getAuthHeader(keyId: string, apiKey: string): string {
  const credentials = Buffer.from(`${keyId}:${apiKey}`).toString("base64");
  return `Basic ${credentials}`;
}

function getBaseUrl(): string {
  return process.env.RATEHAWK_USE_SANDBOX === "true" ? RATEHAWK_SANDBOX : RATEHAWK_BASE;
}

/**
 * Suggest hotels and regions by query (autocomplete)
 * POST /api/b2b/v3/search/multicomplete/
 */
export async function suggestHotels(
  query: string,
  language: string,
  keyId: string,
  apiKey: string
): Promise<RateHawkSuggestResponse> {
  if (!query || query.trim().length < 2) {
    return { hotels: [], regions: null };
  }

  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/b2b/v3/search/multicomplete/`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(keyId, apiKey),
    },
    body: JSON.stringify({ query: query.trim(), language }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`RateHawk suggest failed: ${response.status} ${errText}`);
  }

  const json = await response.json();
  if (json.status !== "ok" || json.error) {
    throw new Error(json.error || "RateHawk suggest error");
  }

  return {
    hotels: json.data?.hotels || [],
    regions: json.data?.regions || null,
  };
}

/**
 * Retrieve hotel content (address, phone, email, coordinates)
 * POST /api/b2b/v3/hotel/info/ — B2B/Affiliate API (one hotel per request)
 */
export async function getHotelContent(
  hotelIds: number[],
  language: string,
  keyId: string,
  apiKey: string
): Promise<RateHawkHotelContent[]> {
  if (!hotelIds.length) return [];

  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/b2b/v3/hotel/info/`;
  const hid = hotelIds[0];
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(keyId, apiKey),
      "User-Agent": "TravelCMS/1.0",
      "X-Partner-Name": "TravelCMS",
      "X-Client-Version": "1.0",
    },
    body: JSON.stringify({ hid, language }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`RateHawk hotel content failed: ${response.status} ${errText}`);
  }

  const json = await response.json();
  if (json.status !== "ok" || json.error) {
    throw new Error(json.error || "RateHawk hotel content error");
  }

  // B2B API returns single object in data, not array
  const raw = json.data;
  if (!raw) return [];

  // Extract room groups and meal types from raw response
  const roomGroups: RateHawkRoomGroup[] = Array.isArray(raw.room_groups)
    ? raw.room_groups.map((rg: { name?: string; name_struct?: { main_name?: string } }) => ({
        name: (rg.name_struct?.main_name || rg.name || "").trim(),
        name_struct: rg.name_struct,
      }))
    : [];
  const mealTypes: string[] = [];
  const mp = raw.metapolicy_struct;
  if (mp?.meal && Array.isArray(mp.meal)) {
    for (const m of mp.meal) {
      const mt = m?.meal_type;
      if (mt && typeof mt === "string" && mt !== "unspecified" && !mealTypes.includes(mt)) {
        mealTypes.push(mt);
      }
    }
  }

  const hotel: RateHawkHotelContent = {
    hid: raw.hid ?? hid,
    id: raw.id,
    name: raw.name ?? "",
    address: raw.address,
    latitude: raw.latitude,
    longitude: raw.longitude,
    phone: raw.phone,
    email: raw.email,
    postal_code: raw.postal_code,
    region: raw.region,
    room_groups: roomGroups.length ? roomGroups : undefined,
    meal_types: mealTypes.length ? mealTypes : undefined,
  };
  return [hotel];
}

/**
 * Search hotel rates to extract available meal types.
 * POST /api/b2b/v3/search/hp/
 * Returns unique meal codes (e.g. "nomeal", "breakfast", "half-board", "full-board", "all-inclusive").
 */
export async function getHotelMealTypes(
  hid: number,
  checkin: string,
  checkout: string,
  language: string,
  keyId: string,
  apiKey: string,
  currency = "EUR"
): Promise<string[]> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/b2b/v3/search/hp/`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(keyId, apiKey),
    },
    body: JSON.stringify({
      hid,
      checkin,
      checkout,
      residency: "gb",
      language,
      guests: [{ adults: 2, children: [] }],
      currency,
      timeout: 8,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`RateHawk hotelpage failed: ${response.status} ${errText}`);
  }

  const json = await response.json();
  if (json.status !== "ok" || json.error) {
    throw new Error(json.error || "RateHawk hotelpage error");
  }

  const meals = new Set<string>();
  const hotels = json.data?.hotels;
  if (Array.isArray(hotels)) {
    for (const hotel of hotels) {
      if (!Array.isArray(hotel.rates)) continue;
      for (const rate of hotel.rates) {
        const m = rate.meal_data?.value ?? rate.meal;
        if (m && typeof m === "string") meals.add(m);
      }
    }
  }

  return [...meals];
}

/**
 * Fetch hotel content for multiple hotels in parallel (ETG API: one hotel per request).
 * Limit to 5 hotels to respect rate limits (30/min).
 */
export async function getHotelContentsBatch(
  hotelIds: number[],
  language: string,
  keyId: string,
  apiKey: string
): Promise<RateHawkHotelContent[]> {
  const ids = hotelIds.slice(0, 5);
  const results = await Promise.all(
    ids.map((hid) => getHotelContent([hid], language, keyId, apiKey))
  );
  return results.flat();
}
