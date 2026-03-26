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

export async function GET(request: NextRequest) {
  try {
    const apiUser = await getApiUser(request);
    if (!apiUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { companyId } = apiUser;

    const now = new Date();
    const maxLookahead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const { data: services, error: svcError } = await supabaseAdmin
      .from("order_services")
      .select(`
        id, ref_nr, flight_segments, ticket_numbers, client_name, supplier_name,
        orders!inner(order_code, company_id)
      `)
      .eq("orders.company_id", companyId)
      .in("category", ["Flight", "Air Ticket"])
      .in("res_status", ["confirmed", "ticketed"])
      .gte("service_date_to", now.toISOString().split("T")[0])
      .lte("service_date_to", maxLookahead.toISOString().split("T")[0]);

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

      const tickets = svc.ticket_numbers as TicketEntry[] | null;
      const orderRaw = svc.orders;
      const order = Array.isArray(orderRaw) ? orderRaw[0] : orderRaw;
      if (!order) continue;

      for (const seg of segments) {
        if (!seg.flightNumber || !seg.departureDate) continue;

        const depStr = seg.departureTimeScheduled
          ? `${seg.departureDate}T${seg.departureTimeScheduled}`
          : `${seg.departureDate}T00:00`;
        const depTime = new Date(depStr);
        if (isNaN(depTime.getTime()) || depTime < now) continue;

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

        const clientName = tickets?.[0]?.clientName || svc.client_name || "—";
        const depAirport = seg.departure || seg.departureAirport || "";
        const arrAirport = seg.arrival || seg.arrivalAirport || "";
        const route = [depAirport, arrAirport].filter(Boolean).join(" → ");

        checkins.push({
          serviceId: svc.id,
          orderCode: (order as { order_code: string }).order_code,
          flightNumber: seg.flightNumber,
          clientName,
          pnr: svc.ref_nr || "—",
          departureDateTime: depStr,
          route,
          checkinUrl: info?.checkinUrl || null,
          status,
          opensIn: msUntilOpen > 0 ? formatDuration(msUntilOpen) : null,
          closesIn: msUntilClose > 0 ? formatDuration(msUntilClose) : null,
        });
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
