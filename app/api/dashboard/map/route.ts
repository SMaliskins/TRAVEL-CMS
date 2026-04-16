import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiUser } from "@/lib/auth/getApiUser";
import { resolveCitiesBatch, resolverCacheKey } from "@/lib/geocoding/resolveCity";

// Always re-run on request. Any caching layer (Next.js Data Cache / CDN) causes the
// "markers flicker in and out" effect the team saw before MAP-01 step 1.
export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseDestination(raw: string): { city: string; country: string } {
  // New format: "origin:Riga, Latvia|Antalya, Turkey|return:Riga, Latvia"
  if (raw.includes("|")) {
    const segments = raw.split("|").map((s) => s.trim()).filter(Boolean);
    for (const seg of segments) {
      if (seg.startsWith("origin:") || seg.startsWith("return:")) continue;
      const parts = seg.split(",").map((s) => s.trim());
      return { city: parts[0] || "", country: parts[1] || "" };
    }
    const first = segments[0]?.replace(/^(origin|return):/, "").trim() || "";
    const parts = first.split(",").map((s) => s.trim());
    return { city: parts[0] || "", country: parts[1] || "" };
  }

  // Old format: "Antalya, Turcija" or "Dubaija,Londona, AAE,Lielbritānija"
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) return { city: parts[0], country: parts[1] };
  return { city: parts[0] || "", country: "" };
}

type OrderTravellerPartyRow = {
  order_id: string;
  party?: { status?: string } | { status?: string }[] | null;
};

/** Match GET /api/orders/[orderCode]/travellers: only active parties count as clients. */
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
            travellerCountByOrder.set(r.order_id, (travellerCountByOrder.get(r.order_id) || 0) + 1);
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
      /** Active clients on the order (same rule as order Travellers UI); defaults to 1 if none linked. */
      travellerCount: number;
    }

    // Pre-parse every order + collect unique (city, country) pairs so the resolver is asked
    // about each distinct destination exactly once per request.
    type OrderParsed = {
      order: (typeof orderList)[number];
      city: string;
      country: string;
    };
    const parsedOrders: OrderParsed[] = [];
    const uniquePairs: { city: string; country: string }[] = [];
    const seenPairKeys = new Set<string>();
    for (const order of orderList) {
      const raw = (order.countries_cities as string) || "";
      if (!raw) continue;
      const { city, country } = parseDestination(raw);
      if (!city) continue;
      parsedOrders.push({ order, city, country });
      const key = resolverCacheKey(city, country);
      if (!seenPairKeys.has(key)) {
        seenPairKeys.add(key);
        uniquePairs.push({ city, country });
      }
    }

    const resolvedByKey = await resolveCitiesBatch(uniquePairs);

    const locations: MapLocation[] = [];
    let unmappedCount = 0;
    let approximateCount = 0;

    for (const { order, city, country } of parsedOrders) {
      const key = resolverCacheKey(city, country);
      const resolved = resolvedByKey.get(key) || null;
      if (!resolved) {
        unmappedCount++;
        continue;
      }
      if (resolved.approximate) approximateCount++;

      let status: "upcoming" | "in-progress" | "completed";
      const from = order.date_from || "";
      const to = order.date_to || from;
      if (from > today) status = "upcoming";
      else if (to < today) status = "completed";
      else status = "in-progress";

      const label = resolved.country
        ? `${resolved.city}, ${resolved.country}`
        : country
          ? `${city}, ${country}`
          : city;

      const ot = travellerCountByOrder.get(order.id as string) ?? 0;
      const travellerCount = ot > 0 ? ot : 1;

      locations.push({
        id: order.id,
        name: order.client_display_name || "Client",
        location: [resolved.lat, resolved.lng],
        orderCode: order.order_code,
        status,
        dateFrom: from || undefined,
        dateTo: to || undefined,
        completedAt: status === "completed" ? to : undefined,
        destination: label,
        travellerCount,
      });
    }

    return NextResponse.json({
      locations,
      stats: {
        total: parsedOrders.length,
        mapped: locations.length,
        approximate: approximateCount,
        unmapped: unmappedCount,
      },
    });
  } catch (err) {
    console.error("Map error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
