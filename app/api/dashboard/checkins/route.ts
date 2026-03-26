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
    const maxLookahead = new Date(now.getTime() + 80 * 60 * 60 * 1000);

    const { data: services } = await supabaseAdmin
      .from("order_services")
      .select(`
        id, ref_nr, flight_segments, ticket_numbers, client_name, supplier_name,
        orders!inner(order_code, company_id)
      `)
      .eq("orders.company_id", companyId)
      .eq("category", "Flight")
      .in("res_status", ["confirmed", "ticketed"])
      .gte("date_from", now.toISOString().split("T")[0])
      .lte("date_from", maxLookahead.toISOString().split("T")[0]);

    const checkins: Array<{
      serviceId: string;
      orderCode: string;
      flightNumber: string;
      clientName: string;
      pnr: string;
      departureDateTime: string;
      route: string;
      checkinUrl: string | null;
      status: "open" | "upcoming" | "closing_soon";
      opensIn: string | null;
      closesIn: string | null;
    }> = [];

    for (const svc of services || []) {
      const segments = svc.flight_segments as FlightSegment[] | null;
      if (!segments || segments.length === 0) continue;

      const tickets = svc.ticket_numbers as TicketEntry[] | null;
      const order = Array.isArray(svc.orders) ? svc.orders[0] : svc.orders;
      if (!order) continue;

      for (const seg of segments) {
        if (!seg.flightNumber || !seg.departureDate) continue;

        const depStr = seg.departureTimeScheduled
          ? `${seg.departureDate}T${seg.departureTimeScheduled}`
          : `${seg.departureDate}T00:00`;
        const depTime = new Date(depStr);
        if (isNaN(depTime.getTime()) || depTime < now) continue;

        const match = seg.flightNumber.match(/^([A-Z]{2})/i);
        if (!match) continue;
        const airlineCode = match[1].toUpperCase();
        const info = AIRLINE_CHECKIN[airlineCode];
        if (!info) continue;

        const msUntilDep = depTime.getTime() - now.getTime();
        const hoursUntilDep = msUntilDep / (1000 * 60 * 60);
        const msUntilOpen = msUntilDep - info.checkinHoursBefore * 3600000;
        const msUntilClose = msUntilDep - info.checkinHoursClose * 3600000;

        let status: "open" | "upcoming" | "closing_soon";
        if (msUntilOpen <= 0 && msUntilClose > 0) {
          status = msUntilClose < 3 * 3600000 ? "closing_soon" : "open";
        } else if (msUntilOpen > 0 && msUntilOpen <= 6 * 3600000) {
          status = "upcoming";
        } else {
          continue;
        }

        const clientName = tickets?.[0]?.clientName || svc.client_name || "—";
        const route = [seg.departureAirport, seg.arrivalAirport].filter(Boolean).join(" → ") || "";

        checkins.push({
          serviceId: svc.id,
          orderCode: (order as { order_code: string }).order_code,
          flightNumber: seg.flightNumber,
          clientName,
          pnr: svc.ref_nr || "—",
          departureDateTime: depStr,
          route,
          checkinUrl: info.checkinUrl,
          status,
          opensIn: msUntilOpen > 0 ? formatDuration(msUntilOpen) : null,
          closesIn: msUntilClose > 0 ? formatDuration(msUntilClose) : null,
        });
      }
    }

    checkins.sort((a, b) => {
      const order = { open: 0, closing_soon: 0, upcoming: 1 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
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
