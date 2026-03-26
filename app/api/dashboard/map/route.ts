import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiUser } from "@/lib/auth/getApiUser";

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
  "florence": [43.7696, 11.2558],
  "naples": [40.8518, 14.2681],
  "munich": [48.1351, 11.582],
  "frankfurt": [50.1109, 8.6821],
  "hamburg": [53.5511, 9.9937],
  "brussels": [50.8503, 4.3517],
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
  "doha": [25.2854, 51.531],
  "abu dhabi": [24.4539, 54.3773],
  "muscat": [23.588, 58.3829],
  "petra": [30.3285, 35.4444],
  "amman": [31.9454, 35.9284],
};

function geocodeCity(cityName: string): [number, number] | null {
  const lower = cityName.toLowerCase().trim();
  if (CITY_COORDS[lower]) return CITY_COORDS[lower];

  for (const [key, coords] of Object.entries(CITY_COORDS)) {
    if (lower.includes(key) || key.includes(lower)) return coords;
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const apiUser = await getApiUser(request);
    if (!apiUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { companyId, userId, scope } = apiUser;
    const isOwnScope = scope === "own";

    const today = new Date().toISOString().slice(0, 10);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentStr = thirtyDaysAgo.toISOString().slice(0, 10);

    let mapQ = supabaseAdmin
      .from("orders")
      .select("id, order_code, client_display_name, countries_cities, date_from, date_to, status, owner_user_id, manager_user_id")
      .eq("company_id", companyId)
      .or(`date_to.gte.${recentStr},date_from.gte.${recentStr}`);
    if (isOwnScope) {
      mapQ = mapQ.or(`owner_user_id.eq.${userId},manager_user_id.eq.${userId}`);
    }
    const { data: orders, error } = await mapQ;

    if (error) {
      console.error("Map query error:", error);
      return NextResponse.json({ error: "Query failed" }, { status: 500 });
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
    }

    const locations: MapLocation[] = [];

    for (const order of orders || []) {
      const destination = (order.countries_cities as string) || "";
      if (!destination) continue;

      const cities = destination.split(",").map((c: string) => c.trim()).filter(Boolean);
      const firstCity = cities[0];
      if (!firstCity) continue;

      const coords = geocodeCity(firstCity);
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

      locations.push({
        id: order.id,
        name: order.client_display_name || "Client",
        location: coords,
        orderCode: order.order_code,
        status,
        dateFrom: from || undefined,
        dateTo: to || undefined,
        completedAt: status === "completed" ? to : undefined,
        destination: firstCity,
      });
    }

    return NextResponse.json({ locations });
  } catch (err) {
    console.error("Map error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
