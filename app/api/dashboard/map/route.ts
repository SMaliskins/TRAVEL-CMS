import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiUser } from "@/lib/auth/getApiUser";
import { CITIES, getCityByName, type City } from "@/lib/data/cities";

// Always re-run on request. The map must reflect current orders immediately; any caching layer
// (Next.js Data Cache / CDN) would cause the "markers flicker in and out" effect users observed.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const CITY_COORDS: Record<string, [number, number]> = {
  "london": [51.5074, -0.1278],
  "paris": [48.8566, 2.3522],
  "rome": [41.9028, 12.4964],
  "barcelona": [41.3874, 2.1686],
  "amsterdam": [52.3676, 4.9041],
  "berlin": [52.52, 13.405],
  "madrid": [40.4168, -3.7038],
  "prague": [50.0755, 14.4378],
  "vienna": [48.2082, 16.3738],
  "lisbon": [38.7223, -9.1393],
  "istanbul": [41.0082, 28.9784],
  "athens": [37.9838, 23.7275],
  "dubai": [25.2048, 55.2708],
  "new york": [40.7128, -74.006],
  "los angeles": [34.0522, -118.2437],
  "tokyo": [35.6762, 139.6503],
  "bangkok": [13.7563, 100.5018],
  "singapore": [1.3521, 103.8198],
  "hong kong": [22.3193, 114.1694],
  "sydney": [-33.8688, 151.2093],
  "cairo": [30.0444, 31.2357],
  "marrakech": [31.6295, -7.9811],
  "riga": [56.9496, 24.1052],
  "tallinn": [59.437, 24.7536],
  "vilnius": [54.6872, 25.2797],
  "helsinki": [60.1699, 24.9384],
  "stockholm": [59.3293, 18.0686],
  "oslo": [59.9139, 10.7522],
  "copenhagen": [55.6761, 12.5683],
  "warsaw": [52.2297, 21.0122],
  "budapest": [47.4979, 19.0402],
  "bucharest": [44.4268, 26.1025],
  "sofia": [42.6977, 23.3219],
  "zagreb": [45.815, 15.9819],
  "belgrade": [44.7866, 20.4489],
  "dublin": [53.3498, -6.2603],
  "edinburgh": [55.9533, -3.1883],
  "zurich": [47.3769, 8.5417],
  "geneva": [46.2044, 6.1432],
  "milan": [45.4642, 9.19],
  "venice": [45.4408, 12.3155],
  "abano terme": [45.3597, 11.7897],
  "padua": [45.4064, 11.8768],
  "verona": [45.4384, 10.9916],
  "rimini": [44.0678, 12.5695],
  "amalfi": [40.6340, 13.5737],
  "capri": [40.5507, 14.2224],
  "como": [45.8080, 9.0852],
  "taormina": [37.8516, 15.2853],
  "sorrento": [40.6263, 14.3758],
  "positano": [40.6281, 14.4850],
  "florence": [43.7696, 11.2558],
  "naples": [40.8518, 14.2681],
  "munich": [48.1351, 11.582],
  "frankfurt": [50.1109, 8.6821],
  "hamburg": [53.5511, 9.9937],
  "brussels": [50.8503, 4.3517],
  "cannes": [43.5528, 6.9264],
  "nice": [43.7102, 7.262],
  "lyon": [45.764, 4.8357],
  "marseille": [43.2965, 5.3698],
  "seville": [37.3891, -5.9845],
  "malaga": [36.7213, -4.4214],
  "porto": [41.1579, -8.6291],
  "tbilisi": [41.7151, 44.8271],
  "batumi": [41.6168, 41.6367],
  "baku": [40.4093, 49.8671],
  "tel aviv": [32.0853, 34.7818],
  "jerusalem": [31.7683, 35.2137],
  "antalya": [36.8969, 30.7133],
  "bodrum": [37.0344, 27.4305],
  "hurghada": [27.2579, 33.8116],
  "sharm el sheikh": [27.9158, 34.33],
  "maldives": [3.2028, 73.2207],
  "seychelles": [-4.6796, 55.492],
  "mauritius": [-20.3484, 57.5522],
  "phuket": [7.8804, 98.3923],
  "bali": [-8.3405, 115.092],
  "cancun": [21.1619, -86.8515],
  "miami": [25.7617, -80.1918],
  "las vegas": [36.1699, -115.1398],
  "san francisco": [37.7749, -122.4194],
  "toronto": [43.6532, -79.3832],
  "vancouver": [49.2827, -123.1207],
  "mexico city": [19.4326, -99.1332],
  "buenos aires": [-34.6037, -58.3816],
  "rio de janeiro": [-22.9068, -43.1729],
  "cape town": [-33.9249, 18.4241],
  "nairobi": [-1.2921, 36.8219],
  "zanzibar": [-6.1659, 39.1989],
  "moscow": [55.7558, 37.6173],
  "st petersburg": [59.9343, 30.3351],
  "saint petersburg": [59.9343, 30.3351],
  "minsk": [53.9006, 27.559],
  "tenerife": [28.2916, -16.6291],
  "palma": [39.5696, 2.6502],
  "palma de mallorca": [39.5696, 2.6502],
  "larnaca": [34.9003, 33.6232],
  "paphos": [34.7754, 32.4218],
  "limassol": [34.6786, 33.0413],
  "montenegro": [42.7087, 19.3744],
  "split": [43.5081, 16.4402],
  "dubrovnik": [42.6507, 18.0944],
  "santorini": [36.3932, 25.4615],
  "crete": [35.2401, 24.4709],
  "corfu": [39.6243, 19.9217],
  "malta": [35.8989, 14.5146],
  "sardinia": [40.1209, 9.0129],
  "sicily": [37.5994, 14.0154],
  "corsica": [42.0396, 9.0129],
  "ibiza": [38.9067, 1.4206],
  "mykonos": [37.4467, 25.3289],
  "kuala lumpur": [3.139, 101.6869],
  "hanoi": [21.0285, 105.8542],
  "ho chi minh city": [10.8231, 106.6297],
  "colombo": [6.9271, 79.8612],
  "delhi": [28.7041, 77.1025],
  "mumbai": [19.076, 72.8777],
  "goa": [15.2993, 74.124],
  "beijing": [39.9042, 116.4074],
  "shanghai": [31.2304, 121.4737],
  "seoul": [37.5665, 126.978],
  "samui": [9.5120, 100.0136],
  "koh samui": [9.5120, 100.0136],
  "krabi": [8.0863, 98.9063],
  "chiang mai": [18.7883, 98.9853],
  "langkawi": [6.3500, 99.8000],
  "nha trang": [12.2388, 109.1967],
  "da nang": [16.0544, 108.2022],
  "lombok": [-8.6500, 116.3248],
  "boracay": [11.9674, 121.9248],
  "monte carlo": [43.7384, 7.4246],
  "monaco": [43.7384, 7.4246],
  "saint tropez": [43.2727, 6.6406],
  "st tropez": [43.2727, 6.6406],
  "antibes": [43.5808, 7.1239],
  "marbella": [36.5099, -4.8830],
  "benidorm": [38.5411, -0.1225],
  "algarve": [37.0179, -7.9304],
  "faro": [37.0194, -7.9322],
  "madeira": [32.6669, -16.9241],
  "azores": [37.7412, -25.6756],
  "rhodes": [36.4349, 28.2176],
  "kos": [36.8933, 26.9836],
  "zakynthos": [37.7872, 20.8983],
  "lefkada": [38.7066, 20.6530],
  "hvar": [43.1729, 16.4411],
  "kotor": [42.4247, 18.7712],
  "budva": [42.2914, 18.8401],
  "tivat": [42.4314, 18.6963],
  "doha": [25.2854, 51.531],
  "abu dhabi": [24.4539, 54.3773],
  "muscat": [23.588, 58.3829],
  "petra": [30.3285, 35.4444],
  "amman": [31.9454, 35.9284],
};

/** Locale / alternate spellings → canonical name in `CITIES` */
const MAP_CITY_ALIASES: Record<string, string> = {
  wien: "Vienna",
  roma: "Rome",
  münchen: "Munich",
  munchen: "Munich",
  muenchen: "Munich",
  köln: "Cologne",
  koln: "Cologne",
  kraków: "Krakow",
  krakow: "Krakow",
};

function countryHintMatchesCityCountry(countryHint: string, cityCountry: string): boolean {
  const hint = countryHint.toLowerCase().trim();
  const c = cityCountry.toLowerCase().trim();
  if (!hint || !c) return true;
  return c.includes(hint) || hint.includes(c.slice(0, Math.min(5, c.length)));
}

function geocodeCity(cityName: string, countryHint?: string): [number, number] | null {
  const trimmed = cityName.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();

  if (CITY_COORDS[lower]) return CITY_COORDS[lower];
  for (const [key, coords] of Object.entries(CITY_COORDS)) {
    if (lower.includes(key) || key.includes(lower)) return coords;
  }

  const canonicalName = MAP_CITY_ALIASES[lower] || trimmed;
  let resolved = getCityByName(canonicalName);
  if (resolved && countryHint && !countryHintMatchesCityCountry(countryHint, resolved.country)) {
    const sameName = CITIES.filter(
      (c: City) => c.name.toLowerCase() === resolved!.name.toLowerCase()
    );
    resolved =
      sameName.find((c: City) => countryHintMatchesCityCountry(countryHint, c.country)) ?? undefined;
  }
  if (!resolved) {
    resolved = getCityByName(trimmed);
    if (resolved && countryHint && !countryHintMatchesCityCountry(countryHint, resolved.country)) {
      const sameName = CITIES.filter(
        (c: City) => c.name.toLowerCase() === trimmed.toLowerCase()
      );
      resolved =
        sameName.find((c: City) => countryHintMatchesCityCountry(countryHint, c.country)) ?? undefined;
    }
  }
  if (resolved) return [resolved.lat, resolved.lng];

  const hint = countryHint?.toLowerCase().trim() || "";
  const matches = CITIES.filter((c: City) => {
    const cn = c.name.toLowerCase();
    if (!(cn === lower || cn.includes(lower) || lower.includes(cn))) return false;
    if (!hint) return true;
    return countryHintMatchesCityCountry(hint, c.country);
  });
  if (matches.length === 1) return [matches[0].lat, matches[0].lng];
  const exact = matches.find((c: City) => c.name.toLowerCase() === lower);
  if (exact) return [exact.lat, exact.lng];
  if (matches.length > 1) return [matches[0].lat, matches[0].lng];

  return null;
}

function parseDestination(raw: string): { city: string; country: string } {
  // New format: "origin:Riga, Latvia|Antalya, Turkey|return:Riga, Latvia"
  if (raw.includes("|")) {
    const segments = raw.split("|").map(s => s.trim()).filter(Boolean);
    for (const seg of segments) {
      if (seg.startsWith("origin:") || seg.startsWith("return:")) continue;
      const parts = seg.split(",").map(s => s.trim());
      return { city: parts[0] || "", country: parts[1] || "" };
    }
    const first = segments[0]?.replace(/^(origin|return):/, "").trim() || "";
    const parts = first.split(",").map(s => s.trim());
    return { city: parts[0] || "", country: parts[1] || "" };
  }

  // Old format: "Antalya, Turcija" or "Dubaija,Londona, AAE,Lielbritānija"
  const parts = raw.split(",").map(s => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { city: parts[0], country: parts[1] };
  }
  return { city: parts[0] || "", country: "" };
}

type OrderTravellerPartyRow = {
  order_id: string;
  party?: { status?: string } | { status?: string }[] | null;
};

/** Match GET /api/orders/[orderCode]/travellers: only active parties count as clients */
function isActivePartyOnOrderTravellerRow(row: OrderTravellerPartyRow): boolean {
  const partyRaw = row.party;
  const party = Array.isArray(partyRaw) ? partyRaw[0] : partyRaw;
  const status = party?.status ?? "active";
  return status === "active";
}

export async function GET(request: NextRequest) {
  try {
    const apiUser = await getApiUser(request);
    if (!apiUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { companyId, userId, scope } = apiUser;
    const isOwnScope = scope === "own";

    const today = new Date().toISOString().slice(0, 10);

    let mapQ = supabaseAdmin
      .from("orders")
      .select("id, order_code, client_display_name, countries_cities, date_from, date_to, status, owner_user_id, manager_user_id")
      .eq("company_id", companyId)
      .neq("status", "Cancelled");
    if (isOwnScope) {
      mapQ = mapQ.or(`owner_user_id.eq.${userId},manager_user_id.eq.${userId}`);
    }
    const { data: orders, error } = await mapQ;

    if (error) {
      console.error("Map query error:", error);
      return NextResponse.json({ error: "Query failed" }, { status: 500 });
    }

    const orderList = orders || [];
    const orderIds = orderList.map((o) => o.id as string).filter(Boolean);
    const travellerCountByOrder = new Map<string, number>();
    if (orderIds.length > 0) {
      const chunkSize = 150;
      for (let i = 0; i < orderIds.length; i += chunkSize) {
        const chunk = orderIds.slice(i, i + chunkSize);
        const { data: otRows, error: otErr } = await supabaseAdmin
          .from("order_travellers")
          .select("order_id, party:party_id(status)")
          .eq("company_id", companyId)
          .in("order_id", chunk);
        if (otErr) {
          console.error("order_travellers map count error:", otErr);
        } else {
          for (const row of otRows || []) {
            const r = row as OrderTravellerPartyRow;
            if (!isActivePartyOnOrderTravellerRow(r)) continue;
            const oid = r.order_id;
            travellerCountByOrder.set(oid, (travellerCountByOrder.get(oid) || 0) + 1);
          }
        }
      }
    }

    interface MapLocation {
      id: string;
      name: string;
      location: [number, number];
      orderCode: string;
      status: "upcoming" | "in-progress" | "completed";
      dateFrom?: string;
      dateTo?: string;
      completedAt?: string;
      destination?: string;
      /** Active clients on the order (order_travellers + party.status active, same as order Travellers UI); defaults to 1 if none linked yet */
      travellerCount: number;
    }

    const locations: MapLocation[] = [];

    for (const order of orderList) {
      const raw = (order.countries_cities as string) || "";
      if (!raw) continue;

      const { city, country } = parseDestination(raw);
      if (!city) continue;

      const coords = geocodeCity(city, country);
      if (!coords) continue;

      let status: "upcoming" | "in-progress" | "completed";
      const from = order.date_from || "";
      const to = order.date_to || from;

      if (from > today) {
        status = "upcoming";
      } else if (to < today) {
        status = "completed";
      } else {
        status = "in-progress";
      }

      const label = country ? `${city}, ${country}` : city;

      const ot = travellerCountByOrder.get(order.id as string) ?? 0;
      const travellerCount = ot > 0 ? ot : 1;

      locations.push({
        id: order.id,
        name: order.client_display_name || "Client",
        location: coords,
        orderCode: order.order_code,
        status,
        dateFrom: from || undefined,
        dateTo: to || undefined,
        completedAt: status === "completed" ? to : undefined,
        destination: label,
        travellerCount,
      });
    }

    return NextResponse.json({ locations });
  } catch (err) {
    console.error("Map error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
