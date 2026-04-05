import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiUser } from "@/lib/auth/getApiUser";
import { AIRLINE_CHECKIN } from "@/lib/flights/airlineCheckin";

interface FlightSegment {
  flightNumber: string;
  departureDate: string;
  departureTimeScheduled?: string;
  arrivalDate?: string;
  arrivalTimeScheduled?: string;
  departure?: string;
  arrival?: string;
  departureAirport?: string;
  arrivalAirport?: string;
}

interface TicketEntry {
  clientName?: string;
  ticketNumber?: string;
}

/** Normalize HH:mm or HH:mm:ss for ISO datetime. */
function normalizeTimePart(t: string): string {
  const s = t.trim();
  if (/^\d{1,2}:\d{2}$/.test(s)) return `${s}:00`;
  return s;
}

/**
 * Parse segment departure; supports YYYY-MM-DD and DD.MM.YYYY (common in UI / imports).
 */
function segmentDepartureTime(seg: FlightSegment): Date | null {
  const raw = (seg.departureDate || "").trim();
  if (!raw) return null;

  let isoDay: string;
  const dmy = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(raw);
  if (dmy) {
    const dd = dmy[1].padStart(2, "0");
    const mm = dmy[2].padStart(2, "0");
    isoDay = `${dmy[3]}-${mm}-${dd}`;
  } else if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    isoDay = raw.slice(0, 10);
  } else {
    const fallback = new Date(raw);
    return isNaN(fallback.getTime()) ? null : fallback;
  }

  const timeRaw = (seg.departureTimeScheduled || "").trim();
  const iso = timeRaw
    ? `${isoDay}T${normalizeTimePart(timeRaw)}`
    : `${isoDay}T00:00`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/** Earliest valid segment departure at or after `notBefore` (for overlap with check-in window). */
function minSegmentDepartureOnOrAfter(
  segments: FlightSegment[] | null,
  notBefore: Date
): Date | null {
  if (!segments?.length) return null;
  let best: Date | null = null;
  for (const seg of segments) {
    if (!String(seg.flightNumber || "").trim()) continue;
    const d = segmentDepartureTime(seg);
    if (!d || d.getTime() < notBefore.getTime()) continue;
    if (!best || d.getTime() < best.getTime()) best = d;
  }
  return best;
}

export async function GET(request: NextRequest) {
  try {
    const apiUser = await getApiUser(request);
    if (!apiUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { companyId } = apiUser;

    const now = new Date();
    const maxLookahead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const todayStr = now.toISOString().split("T")[0];
    const capDate = new Date(now.getTime() + 366 * 24 * 60 * 60 * 1000);
    const capStr = capDate.toISOString().split("T")[0];

    // Pull flight rows that may still contain a segment in the check-in window.
    // - Include booked/confirmed/ticketed/changed.
    // - service_date_to in [today, cap] OR null OR service_date_from in [today, cap] (covers bad service_date_to).
    // Final narrowing is by parsed flight_segments dates (7-day window).
    const { data: services, error: svcError } = await supabaseAdmin
      .from("order_services")
      .select(`
        id, ref_nr, flight_segments, ticket_numbers, client_name, supplier_name,
        service_date_from, service_date_to,
        orders!inner(order_code, company_id)
      `)
      .eq("orders.company_id", companyId)
      .in("category", ["Flight", "Air Ticket"])
      .in("res_status", ["booked", "confirmed", "ticketed", "changed"])
      .or(
        `and(service_date_to.gte.${todayStr},service_date_to.lte.${capStr}),service_date_to.is.null,and(service_date_from.gte.${todayStr},service_date_from.lte.${capStr})`
      );

    if (svcError) {
      console.error("[Dashboard Checkins] Query error:", svcError);
    }

    const checkins: Array<{
      serviceId: string;
      orderCode: string;
      flightNumber: string;
      clientName: string;
      pnr: string;
      departureDateTime: string;
      route: string;
      checkinUrl: string | null;
      status: "open" | "upcoming" | "closing_soon" | "scheduled";
      opensIn: string | null;
      closesIn: string | null;
    }> = [];

    for (const svc of services || []) {
      const segments = svc.flight_segments as FlightSegment[] | null;
      if (!segments || segments.length === 0) continue;

      const minUpcoming = minSegmentDepartureOnOrAfter(segments, now);
      if (!minUpcoming || minUpcoming.getTime() > maxLookahead.getTime()) continue;

      const tickets = svc.ticket_numbers as TicketEntry[] | null;
      const orderRaw = svc.orders;
      const order = Array.isArray(orderRaw) ? orderRaw[0] : orderRaw;
      if (!order) continue;

      for (const seg of segments) {
        if (!seg.flightNumber || !seg.departureDate) continue;

        const depTime = segmentDepartureTime(seg);
        if (!depTime || depTime < now || depTime > maxLookahead) continue;

        const rawDate = (seg.departureDate || "").trim();
        let isoForDisplay: string;
        const dmy = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(rawDate);
        if (dmy) {
          isoForDisplay = `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
        } else if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
          isoForDisplay = rawDate.slice(0, 10);
        } else {
          isoForDisplay = rawDate;
        }
        const depStr = seg.departureTimeScheduled
          ? `${isoForDisplay}T${normalizeTimePart(seg.departureTimeScheduled)}`
          : `${isoForDisplay}T00:00`;

        const match = seg.flightNumber.match(/^([A-Z]{2})/i);
        const airlineCode = match ? match[1].toUpperCase() : null;
        const info = airlineCode ? AIRLINE_CHECKIN[airlineCode] : null;

        const msUntilDep = depTime.getTime() - now.getTime();
        const msUntilOpen = info ? msUntilDep - info.checkinHoursBefore * 3600000 : msUntilDep - 24 * 3600000;
        const msUntilClose = info ? msUntilDep - info.checkinHoursClose * 3600000 : msUntilDep - 3600000;

        let status: "open" | "upcoming" | "closing_soon" | "scheduled";
        if (msUntilOpen <= 0 && msUntilClose > 0) {
          status = msUntilClose < 3 * 3600000 ? "closing_soon" : "open";
        } else if (msUntilOpen > 0 && msUntilOpen <= 48 * 3600000) {
          status = "upcoming";
        } else {
          status = "scheduled";
        }

        const depAirport = seg.departure || seg.departureAirport || "";
        const arrAirport = seg.arrival || seg.arrivalAirport || "";
        const route = [depAirport, arrAirport].filter(Boolean).join(" → ");
        const oCode = (order as { order_code: string }).order_code;

        const pnrs = svc.ref_nr
          ? svc.ref_nr.split(/[,;]\s*/).map((p: string) => p.trim()).filter(Boolean)
          : ["—"];

        const passengerNames = tickets && tickets.length > 0
          ? tickets.map((t) => t.clientName).filter(Boolean)
          : [svc.client_name || "—"];

        for (const pnr of pnrs) {
          checkins.push({
            serviceId: svc.id,
            orderCode: oCode,
            flightNumber: seg.flightNumber,
            clientName: passengerNames.join(", "),
            pnr,
            departureDateTime: depStr,
            route,
            checkinUrl: info?.checkinUrl || null,
            status,
            opensIn: msUntilOpen > 0 ? formatDuration(msUntilOpen) : null,
            closesIn: msUntilClose > 0 ? formatDuration(msUntilClose) : null,
          });
        }
      }
    }

    checkins.sort((a, b) => {
      const pri: Record<string, number> = { open: 0, closing_soon: 0, upcoming: 1, scheduled: 2 };
      if (pri[a.status] !== pri[b.status]) return pri[a.status] - pri[b.status];
      return new Date(a.departureDateTime).getTime() - new Date(b.departureDateTime).getTime();
    });

    return NextResponse.json({ checkins });
  } catch (err) {
    console.error("[Dashboard Checkins]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function formatDuration(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
