"use client";

/**
 * Itinerary Timeline — approved layout for flights (Flight and Tour Package):
 * Flight number, airline, class, baggage, route (dep→arr + times + terminals),
 * duration, PNR, traveller, +BP button, status (Flight departed / Check-in countdown).
 * Tour Package with flight segments uses the same layout.
 * See .ai/specs/itinerary-flight-layout-approved.md
 */
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import { getCheckinUrl, isCheckinAvailable } from "@/lib/flights/airlineCheckin";
import CheckinCountdown from "@/components/CheckinCountdown";
import BoardingPassUpload from "@/components/BoardingPassUpload";
import { requestNotificationPermission } from "@/lib/notifications/checkinNotifications";
import { getCityByName, getCityByIATA } from "@/lib/data/cities";

// Format baggage for short display (compact, for inline use)
// personal = under seat, cabin = carry-on, bag = checked
function formatBaggageShort(baggage: string): string {
  if (!baggage) return "";
  switch (baggage) {
    case "personal": return "Personal only";
    case "personal+cabin": return "Personal, Cabin";
    case "personal+1bag": return "Personal, 1 checked"; // budget: no cabin
    case "personal+2bags": return "Personal, 2 checked"; // budget: no cabin
    case "personal+cabin+1bag": return "Personal, Cabin, 1 checked";
    case "personal+cabin+2bags": return "Personal, Cabin, 2 checked";
    case "personal+cabin+3bags": return "Personal, Cabin, 3 checked";
    default:
      // Budget airlines: personal+Nbags (no cabin)
      const budgetMatch = baggage.match(/personal\+(\d+)bags?$/);
      if (budgetMatch) return `Personal, ${budgetMatch[1]} checked`;
      // Traditional: personal+cabin+Nbags
      const match = baggage.match(/personal\+cabin\+(\d+)bags?/);
      if (match) return `Personal, Cabin, ${match[1]} checked`;
      // Handle PC format from Amadeus
      const pcMatch = baggage.match(/(\d+)PC/i);
      if (pcMatch) return `Personal, Cabin, ${pcMatch[1]} checked`;
      return baggage;
  }
}

// Format baggage for tooltip (detailed)
function formatBaggageTooltip(baggage: string): string {
  if (!baggage) return "";
  
  const personal = "1× personal item (under seat)";
  const cabin = "1× carry-on (overhead)";
  const checked = (n: number) => `${n}× checked bag${n > 1 ? "s" : ""}`;
  
  switch (baggage) {
    case "personal": return personal;
    case "personal+cabin": return `${personal}\n${cabin}`;
    case "personal+1bag": return `${personal}\n${checked(1)} (no carry-on!)`;
    case "personal+2bags": return `${personal}\n${checked(2)} (no carry-on!)`;
    case "personal+cabin+1bag": return `${personal}\n${cabin}\n${checked(1)}`;
    case "personal+cabin+2bags": return `${personal}\n${cabin}\n${checked(2)}`;
    case "personal+cabin+3bags": return `${personal}\n${cabin}\n${checked(3)}`;
    default:
      // Budget airlines: personal+Nbags (no cabin)
      const budgetMatch = baggage.match(/personal\+(\d+)bags?$/);
      if (budgetMatch) {
        return `${personal}\n${checked(parseInt(budgetMatch[1]))} (no carry-on!)`;
      }
      // Traditional: personal+cabin+Nbags
      const match = baggage.match(/personal\+cabin\+(\d+)bags?/);
      if (match) return `${personal}\n${cabin}\n${checked(parseInt(match[1]))}`;
      // Handle PC format from Amadeus
      const pcMatch = baggage.match(/(\d+)PC/i);
      if (pcMatch) return `${personal}\n${cabin}\n${checked(parseInt(pcMatch[1]))}`;
      return baggage;
  }
}

// Copy button component with feedback
function CopyButton({ text, title }: { text: string; title: string }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className={`p-0.5 rounded transition-colors ${
        copied 
          ? "bg-green-100 text-green-600" 
          : "hover:bg-blue-100 text-gray-400 hover:text-blue-600"
      }`}
      title={copied ? "Copied!" : title}
    >
      {copied ? (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}

interface TicketNumber {
  clientId: string;
  clientName: string;
  ticketNr: string;
}

interface BoardingPass {
  id: string;
  fileName: string;
  fileUrl: string;
  clientId: string;
  clientName: string;
  flightNumber?: string;
  uploadedAt: string;
}

interface FlightSegment {
  id: string;
  flightNumber: string;
  airline?: string;
  departure: string;
  departureCity?: string;
  arrival: string;
  arrivalCity?: string;
  departureDate: string;
  departureTimeScheduled: string;
  arrivalDate: string;
  arrivalTimeScheduled: string;
  departureTerminal?: string;
  arrivalTerminal?: string;
  duration?: string;
  cabinClass?: string;
  baggage?: string;
}

interface TimelineService {
  id: string;
  dateFrom: string;
  dateTo: string;
  category: string;
  serviceType?: string; // original | change | cancellation
  name: string;
  supplier?: string;
  resStatus: string;
  refNr?: string; // Booking reference
  hotelName?: string; // Tour Package hotel
  hotelAddress?: string;
  hotelPhone?: string;
  flightSegments?: FlightSegment[];
  ticketNumbers?: TicketNumber[]; // Clients with ticket numbers
  boardingPasses?: BoardingPass[]; // Uploaded boarding passes
  baggage?: string; // Baggage info: "personal", "personal+cabin", "personal+cabin+1bag", etc.
  transferType?: string | null;
  splitGroupId?: string | null;
  assignedTravellerIds?: string[];
}

interface Traveller {
  id: string;
  firstName: string;
  lastName: string;
}

// Selected boarding pass for multi-select across services
export interface SelectedBoardingPass {
  serviceId: string;
  passId: string;
  clientName: string;
  flightNumber: string;
  fileName: string;
  fileUrl: string;
}

interface ItineraryTimelineProps {
  services: TimelineService[];
  travellers: Traveller[];
  selectedTravellerId?: string | null;
  onSelectTraveller?: (travellerId: string | null) => void;
  onUploadBoardingPass?: (serviceId: string, file: File, clientId: string, flightNumber: string) => Promise<void>;
  onViewBoardingPass?: (pass: BoardingPass) => void;
  onDeleteBoardingPass?: (serviceId: string, passId: string) => void;
  onEditService?: (serviceId: string) => void;
  // Multi-select BP across services
  selectedBoardingPasses?: SelectedBoardingPass[];
  onToggleBoardingPassSelection?: (pass: SelectedBoardingPass) => void;
  /** Map travellerId -> hex color (same as map route colors); used to highlight flight cards */
  travellerIdToColor?: Record<string, string>;
  /** Hex colors already used for flight routes; hotel uses colors not in this set */
  routeColorsUsed?: string[];
  /** Pixel offset for sticky header (bottom of page's sticky header) */
  stickyTopOffset?: number;
}

// Category icons (Lucide)
import { Plane, Hotel, Bus, CarTaxiFront, Ticket, ShieldCheck, FileCheck, Pin, MapPin, Phone, CalendarRange, Luggage } from "lucide-react";
const categoryIcons: Record<string, React.ReactNode> = {
  Flight: <Plane size={16} strokeWidth={1.8} />,
  Hotel: <Hotel size={16} strokeWidth={1.8} />,
  Transfer: <CarTaxiFront size={16} strokeWidth={1.8} />,
  Tour: <Ticket size={16} strokeWidth={1.8} />,
  Insurance: <ShieldCheck size={16} strokeWidth={1.8} />,
  Visa: <FileCheck size={16} strokeWidth={1.8} />,
  Other: <Pin size={16} strokeWidth={1.8} />,
};

// Format date as dd.mm.yyyy (project standard)
function formatDateShort(dateStr: string): string {
  return formatDateDDMMYYYY(dateStr);
}

// Colours for hotel blocks (use ones not used by flight routes on the map)
const HOTEL_COLOR_CANDIDATES = ["#f59e0b", "#f97316", "#8b5cf6", "#ec4899", "#14b8a6"];
function getHotelColors(routeColorsUsed: string[] = []): { checkin: string; checkout: string } {
  const used = new Set(routeColorsUsed);
  const available = HOTEL_COLOR_CANDIDATES.filter((c) => !used.has(c));
  return {
    checkin: available[0] ?? "#22c55e",
    checkout: available[1] ?? "#f97316",
  };
}

// Timeline event structure
interface TimelineEvent {
  id: string;
  date: string;
  type: 'flight' | 'hotel_checkin' | 'hotel_checkout' | 'transfer' | 'transfer_inbound' | 'transfer_outbound' | 'other';
  icon: string | React.ReactNode;
  title: string;
  subtitle?: string;
  sortOrder: number; // For sorting within same date
  // Flight details
  flightNumber?: string;
  airline?: string;
  departureCode?: string;
  departureCity?: string;
  arrivalCode?: string;
  arrivalCity?: string;
  departureTime?: string;
  arrivalTime?: string;
  departureTerminal?: string;
  arrivalTerminal?: string;
  duration?: string;
  cabinClass?: string;
  baggage?: string;
  arrivalNextDay?: boolean; // Arrival on next day
  arrivalDate?: string; // YYYY-MM-DD for schedule card
  // Client info for flights
  bookingRef?: string;
  ticketNumbers?: TicketNumber[];
  checkinUrl?: string;
  checkinAvailable?: boolean;
  // For countdown
  departureDateTime?: string; // ISO format: YYYY-MM-DDTHH:mm
  // For boarding passes
  serviceId?: string;
  // Hotel
  hotelAddress?: string;
  hotelPhone?: string;
  /** When multiple rooms merged: one surname(s) per room, shown in right column */
  hotelRoomSurnames?: string[];
  boardingPasses?: BoardingPass[];
  // Who uses this service (for deduplicated events)
  travellerSurnames?: string;
  /** Assigned traveller ids (for route color when no ticketNumbers yet) */
  assignedTravellerIds?: string[];
  /** Transfer: airport IATA and hotel for distance lookup & card display */
  transferAirportCode?: string;
  transferHotelName?: string;
  transferHotelAddress?: string;
  transferInfo?: string;
}

// Ensure airport is shown as IATA code (3 letters). If value is a city name, resolve via cities DB.
function toAirportCode(value: string): string {
  const s = String(value ?? "").trim();
  if (!s) return "";
  if (/^[A-Za-z]{3}$/.test(s)) return s.toUpperCase();
  const city = getCityByName(s);
  return city?.iataCode ?? s;
}

// Normalize segment keys (API/DB may return snake_case). For Itinerary always show airport CODES (readable).
function normalizeSegment(seg: Record<string, unknown>): { id: string; flightNumber: string; airline?: string; departure: string; arrival: string; departureDate: string; departureTimeScheduled: string; arrivalDate: string; arrivalTimeScheduled: string; departureCity?: string; arrivalCity?: string; departureTerminal?: string; arrivalTerminal?: string; duration?: string; cabinClass?: string; baggage?: string } {
  const depRaw = seg.departure_code ?? seg.departure ?? "";
  const arrRaw = seg.arrival_code ?? seg.arrival ?? "";
  const departure = toAirportCode(String(depRaw));
  const arrival = toAirportCode(String(arrRaw));
  const departureCityRaw = seg.departureCity ?? seg.departure_city;
  const arrivalCityRaw = seg.arrivalCity ?? seg.arrival_city;
  const departureCity = departureCityRaw ? String(departureCityRaw) : (departure ? getCityByIATA(departure)?.name : undefined);
  const arrivalCity = arrivalCityRaw ? String(arrivalCityRaw) : (arrival ? getCityByIATA(arrival)?.name : undefined);
  return {
    id: String(seg.id ?? seg.flightNumber ?? Math.random().toString(36).slice(2)),
    flightNumber: String(seg.flightNumber ?? seg.flight_number ?? ""),
    airline: (seg.airline ?? seg.airline_name) != null ? String(seg.airline ?? seg.airline_name) : undefined,
    departure,
    arrival,
    departureDate: String(seg.departureDate ?? seg.departure_date ?? ""),
    departureTimeScheduled: String(seg.departureTimeScheduled ?? seg.departure_time_scheduled ?? seg.departureTime ?? seg.departure_time ?? ""),
    arrivalDate: String(seg.arrivalDate ?? seg.arrival_date ?? seg.departureDate ?? seg.departure_date ?? ""),
    arrivalTimeScheduled: String(seg.arrivalTimeScheduled ?? seg.arrival_time_scheduled ?? seg.arrivalTime ?? seg.arrival_time ?? ""),
    departureCity,
    arrivalCity,
    departureTerminal: seg.departureTerminal ?? seg.departure_terminal ? String(seg.departureTerminal ?? seg.departure_terminal) : undefined,
    arrivalTerminal: seg.arrivalTerminal ?? seg.arrival_terminal ? String(seg.arrivalTerminal ?? seg.arrival_terminal) : undefined,
    duration: seg.duration ? String(seg.duration) : undefined,
    cabinClass: seg.cabinClass ?? seg.cabin_class ? String(seg.cabinClass ?? seg.cabin_class) : undefined,
    baggage: seg.baggage ? String(seg.baggage) : undefined,
  };
}

// Flight = category "Flight", "Air Ticket", or Tour with flight segments
function isFlightService(service: TimelineService): boolean {
  const cat = (service.category || "").toLowerCase();
  if (cat.includes("flight") || cat === "air ticket" || cat.includes("air ticket")) return true;
  if ((service as { serviceType?: string }).serviceType === "change") return true;
  if (((service as { categoryType?: string }).categoryType === "tour" || service.category === "Tour" || service.category === "Package Tour") && service.flightSegments && service.flightSegments.length > 0) return true;
  return false;
}

// Flight card — single layout; optional left border color (from map itinerary colour)
function renderFlightCard(event: TimelineEvent, leftBorderColor?: string): React.ReactNode {
  const depT = event.departureTerminal?.toLowerCase().startsWith("terminal") ? event.departureTerminal : event.departureTerminal ? `T${event.departureTerminal}` : "";
  const arrT = event.arrivalTerminal?.toLowerCase().startsWith("terminal") ? event.arrivalTerminal : event.arrivalTerminal ? `T${event.arrivalTerminal}` : "";
  const hasRoute = !!(event.departureCode || event.arrivalCode);

  return (
      <div
        className={`bg-white rounded-lg pl-3 pr-3 pt-2 pb-2 border border-sky-100 border-l-4 ${!leftBorderColor ? "border-l-sky-400" : ""}`}
        style={leftBorderColor ? { borderLeftColor: leftBorderColor } : undefined}
      >
        <div className="flex items-start gap-2 text-sm">
          <span className="flex-shrink-0 text-sky-500 mt-0.5"><Plane size={18} strokeWidth={1.6} /></span>
          <div className="w-24 flex-shrink-0 flex flex-col items-center gap-1 text-center">
            <span className="font-semibold text-sky-700">{event.flightNumber}</span>
            {event.airline && <span className="text-[10px] text-gray-400">{event.airline}</span>}
            {event.cabinClass && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium capitalize ${
                event.cabinClass === "first"
                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                  : event.cabinClass === "business"
                  ? "bg-purple-100 text-purple-800 border border-purple-300"
                  : event.cabinClass === "premium_economy"
                  ? "bg-teal-100 text-teal-800"
                  : "bg-gray-100 text-gray-600"
              }`}>
                {event.cabinClass.replace("_", " ")}
              </span>
            )}
            {event.baggage && (
              <span className="text-[10px] text-gray-500" title={formatBaggageTooltip(event.baggage)}>
                <Luggage size={11} strokeWidth={1.8} className="inline -mt-px" /> {formatBaggageShort(event.baggage)}
              </span>
            )}
          </div>
          <div className="flex-1">
            {hasRoute ? (
              <div className="flex items-center gap-2">
                <div className="text-center min-w-[80px]">
                  <div className="text-xs text-gray-400">{formatDateShort(event.date)}</div>
                  <div className="font-medium">{event.departureCode || "—"}</div>
                  {event.departureCity && <div className="text-[10px] text-gray-500">{event.departureCity}</div>}
                  <div className="text-sm font-semibold">{event.departureTime || ""}</div>
                  {depT && <div className="text-[10px] text-gray-400">{depT}</div>}
                </div>
                <div className="flex-1 flex flex-col items-center justify-center px-2 gap-3">
                  {event.duration ? <div className="text-xs font-medium text-gray-700">{event.duration}</div> : <div className="text-[10px] text-gray-400">—</div>}
                  <div className="w-full h-px bg-gray-300 relative"><span className="absolute left-1/2 -translate-x-1/2 -top-[7px] text-gray-400"><Plane size={14} strokeWidth={1.5} /></span></div>
                </div>
                <div className="text-center min-w-[80px]">
                  <div className="text-xs text-gray-400">{event.arrivalDate ? formatDateShort(event.arrivalDate) : formatDateShort(event.date)}</div>
                  <div className="font-medium">{event.arrivalCode || "—"}</div>
                  {event.arrivalCity && <div className="text-[10px] text-gray-500">{event.arrivalCity}</div>}
                  <div className="text-sm font-semibold">{event.arrivalTime || ""}</div>
                  {event.arrivalNextDay && <span className="text-amber-600 text-[10px] font-medium" title="Arrival next day">+1</span>}
                  {arrT && <div className="text-[10px] text-gray-400">{arrT}</div>}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-1"><span className="text-xs text-gray-500">Укажите маршрут в Edit</span></div>
            )}
          </div>
        </div>
      </div>
  );
}

// Helper: get traveller surnames from an array of traveller IDs
function getTravellerSurnamesFromIds(
  travellerIds: string[],
  travellers: Traveller[]
): string {
  const surnames = travellerIds
    .map((tid) => travellers.find((t) => t.id === tid)?.lastName)
    .filter(Boolean) as string[];
  return [...new Set(surnames)].join(", ");
}

// Pre-merge duplicate services (split or identical content) — collect all traveller IDs, tickets, BPs
function mergeDuplicateServices(services: TimelineService[], travellers: Traveller[]): TimelineService[] {
  const groupMap = new Map<string, TimelineService>();

  for (const service of services) {
    if (service.resStatus === "cancelled") continue;

    const key =
      service.splitGroupId ||
      `${service.category}|${service.name}|${service.dateFrom}|${service.dateTo}`;

    const existing = groupMap.get(key);
    if (existing) {
      const merged = new Set([
        ...(existing.assignedTravellerIds || []),
        ...(service.assignedTravellerIds || []),
      ]);
      existing.assignedTravellerIds = Array.from(merged);
      if (service.ticketNumbers?.length) {
        const seen = new Set(
          (existing.ticketNumbers || []).map((t) => `${t.clientId}|${t.ticketNr}`)
        );
        for (const t of service.ticketNumbers) {
          if (!seen.has(`${t.clientId}|${t.ticketNr}`)) {
            existing.ticketNumbers = [...(existing.ticketNumbers || []), t];
          }
        }
      }
      if (service.boardingPasses?.length) {
        const seen = new Set((existing.boardingPasses || []).map((b) => b.id));
        for (const b of service.boardingPasses) {
          if (!seen.has(b.id)) {
            existing.boardingPasses = [...(existing.boardingPasses || []), b];
          }
        }
      }
    } else {
      groupMap.set(key, { ...service });
    }
  }

  return Array.from(groupMap.values());
}

// Convert services to timeline events
function servicesToEvents(rawServices: TimelineService[], travellers: Traveller[]): TimelineEvent[] {
  const services = mergeDuplicateServices(rawServices, travellers);
  const events: TimelineEvent[] = [];
  const seenSegmentKeys = new Set<string>();
  const seenHotelKeys = new Set<string>();
  const seenTransferKeys = new Set<string>();
  const seenOtherKeys = new Set<string>();
  
  for (const service of services) {
    const icon = categoryIcons[service.category] || categoryIcons.Other;
    const travellerSurnames = getTravellerSurnamesFromIds(service.assignedTravellerIds || [], travellers);
    
    if (service.category === "Hotel") {
      const hotelKey = `${service.name}|${service.dateFrom}|${service.dateTo}`;
      if (seenHotelKeys.has(hotelKey)) continue;
      seenHotelKeys.add(hotelKey);
      // Hotel: check-in 13:00-14:00, check-out 11:00-12:00
      events.push({
        id: `${service.id}-checkin`,
        date: service.dateFrom,
        type: 'hotel_checkin',
        icon: "hotel",
        title: `Check-in 13:00-14:00: ${service.name}`,
        sortOrder: 50,
        serviceId: service.id,
        travellerSurnames: travellerSurnames || undefined,
        hotelAddress: service.hotelAddress,
        hotelPhone: service.hotelPhone,
      });
      if (service.dateTo && service.dateTo !== service.dateFrom) {
        events.push({
          id: `${service.id}-checkout`,
          date: service.dateTo,
          type: 'hotel_checkout',
          icon: "hotel",
          title: `Check-out 11:00-12:00: ${service.name}`,
          sortOrder: 10,
          serviceId: service.id,
          travellerSurnames: travellerSurnames || undefined,
          hotelAddress: service.hotelAddress,
          hotelPhone: service.hotelPhone,
        });
      }
    } else if (isFlightService(service)) {
      // Flight or Tour Package with flight segments — same approved layout
      const firstFlightNumber = service.flightSegments?.[0]?.flightNumber || "";
      const checkinUrl = getCheckinUrl(firstFlightNumber);
      const flightIcon = categoryIcons.Flight;
      
      // If we have flight segments, create an event for each segment
      if (service.flightSegments && service.flightSegments.length > 0) {
        for (const rawSeg of service.flightSegments) {
          const segment = normalizeSegment(rawSeg as unknown as Record<string, unknown>);
          // Deduplication: parent (res_status changed) and Change service may share same segments
          const segmentKey = `${segment.departureDate}-${segment.departureTimeScheduled}-${segment.flightNumber}-${segment.departure}-${segment.arrival}`;
          if (seenSegmentKeys.has(segmentKey)) continue;
          seenSegmentKeys.add(segmentKey);
          // Parse time to get sortOrder (earlier flights first)
          const timeSort = segment.departureTimeScheduled 
            ? parseInt(segment.departureTimeScheduled.replace(":", "")) 
            : 3000;
          
          // Check if check-in is available for this segment
          let checkinAvailable = false;
          if (segment.departureDate && segment.departureTimeScheduled && segment.flightNumber) {
            const depDateTime = new Date(`${segment.departureDate}T${segment.departureTimeScheduled}`);
            checkinAvailable = isCheckinAvailable(segment.flightNumber, depDateTime);
          }
          
          events.push({
            id: `${service.id}-${segment.id}`,
            date: segment.departureDate,
            type: 'flight',
            icon: flightIcon,
            title: `${segment.departure} → ${segment.arrival}`,
            subtitle: service.supplier,
            sortOrder: 20 + (timeSort / 10000), // Flights sorted by time
            // Detailed flight info
            flightNumber: segment.flightNumber,
            airline: segment.airline,
            departureCode: segment.departure,
            departureCity: segment.departureCity,
            arrivalCode: segment.arrival,
            arrivalCity: segment.arrivalCity,
            departureTime: segment.departureTimeScheduled,
            arrivalTime: segment.arrivalTimeScheduled,
            departureTerminal: segment.departureTerminal,
            arrivalTerminal: segment.arrivalTerminal,
            duration: segment.duration,
            cabinClass: segment.cabinClass,
            baggage: segment.baggage || service.baggage,
            arrivalNextDay: segment.arrivalDate !== segment.departureDate,
            arrivalDate: segment.arrivalDate,
            // Client info
            bookingRef: service.refNr,
            ticketNumbers: service.ticketNumbers,
            checkinUrl: getCheckinUrl(segment.flightNumber) || checkinUrl || undefined,
            checkinAvailable,
            // For countdown
            departureDateTime: `${segment.departureDate}T${segment.departureTimeScheduled}`,
            // For boarding passes
            serviceId: service.id,
            boardingPasses: service.boardingPasses,
            assignedTravellerIds: service.assignedTravellerIds,
          });
        }
      } else {
        // Fallback: flight without segments — show ticket block, do NOT repeat service name
        events.push({
          id: service.id,
          date: service.dateFrom,
          type: 'flight',
          icon: flightIcon,
          title: "Flight",
          subtitle: service.supplier,
          sortOrder: 30,
          flightNumber: firstFlightNumber || "—",
          departureCode: "",
          arrivalCode: "",
          departureTime: "",
          arrivalTime: "",
          bookingRef: service.refNr,
          ticketNumbers: service.ticketNumbers,
          checkinUrl: checkinUrl || undefined,
          serviceId: service.id,
          boardingPasses: service.boardingPasses,
          assignedTravellerIds: service.assignedTravellerIds,
        });
      }
      // Tour Package: hotel check-in 13:00-14:00, check-out 11:00-12:00 (deduplicate for splitted)
      const isTour = (service as { categoryType?: string }).categoryType === "tour" || service.category === "Tour" || service.category === "Package Tour";
      if (isTour && service.dateFrom && service.dateTo) {
        const tourHotelKey = `tour-hotel|${service.name}|${service.dateFrom}|${service.dateTo}`;
        if (!seenHotelKeys.has(tourHotelKey)) {
          seenHotelKeys.add(tourHotelKey);
          const hotelTitle = (service as { hotelName?: string }).hotelName || service.name;
          events.push({
            id: `${service.id}-checkin`,
            date: service.dateFrom,
            type: 'hotel_checkin',
            icon: "hotel",
            title: `Check-in 13:00-14:00: ${hotelTitle}`,
            sortOrder: 50,
            serviceId: service.id,
            travellerSurnames: travellerSurnames || undefined,
            hotelAddress: service.hotelAddress,
            hotelPhone: service.hotelPhone,
          });
          if (service.dateTo !== service.dateFrom) {
            events.push({
              id: `${service.id}-checkout`,
              date: service.dateTo,
              type: 'hotel_checkout',
              icon: "hotel",
              title: `Check-out 11:00-12:00: ${hotelTitle}`,
              sortOrder: 10,
              serviceId: service.id,
              travellerSurnames: travellerSurnames || undefined,
              hotelAddress: service.hotelAddress,
              hotelPhone: service.hotelPhone,
            });
          }
          // Package Tour transfers (inbound: airport->hotel, outbound: hotel->airport)
          const txType = (service as { transferType?: string | null }).transferType;
          if (txType && txType !== "—") {
            const isGroup = txType.toLowerCase() === "group";
            const txTitle = isGroup ? "Group Transfer" : `Transfer: ${txType}`;
            const txIcon = isGroup ? <Bus size={16} strokeWidth={1.8} /> : <CarTaxiFront size={16} strokeWidth={1.8} />;
            const segments = service.flightSegments || [];
            const firstSeg = segments.length > 0 ? segments[0] as Record<string, unknown> : null;
            const arrivalAirport = firstSeg
              ? toAirportCode(String(firstSeg.arrival_code ?? firstSeg.arrival ?? ""))
              : "";
            const arrivalCity = firstSeg
              ? String(firstSeg.arrivalCity ?? firstSeg.arrival_city ?? "")
              : "";
            const hotelTitle = (service as { hotelName?: string }).hotelName || service.name;
            events.push({
              id: `${service.id}-transfer-in`,
              date: service.dateFrom,
              type: 'transfer_inbound',
              icon: txIcon,
              title: txTitle,
              subtitle: "Airport → Hotel",
              sortOrder: 45,
              serviceId: service.id,
              travellerSurnames: travellerSurnames || undefined,
              transferAirportCode: arrivalAirport,
              arrivalCity: arrivalCity || undefined,
              transferHotelName: hotelTitle,
              transferHotelAddress: service.hotelAddress || hotelTitle,
            });
            if (service.dateTo !== service.dateFrom) {
              const lastSeg = segments.length > 0 ? segments[segments.length - 1] as Record<string, unknown> : null;
              const departureAirport = lastSeg
                ? toAirportCode(String(lastSeg.departure_code ?? lastSeg.departure ?? ""))
                : arrivalAirport;
              const depCity = lastSeg
                ? String(lastSeg.departureCity ?? lastSeg.departure_city ?? "")
                : arrivalCity;
              events.push({
                id: `${service.id}-transfer-out`,
                date: service.dateTo,
                type: 'transfer_outbound',
                icon: txIcon,
                title: txTitle,
                subtitle: "Hotel → Airport",
                sortOrder: 15,
                serviceId: service.id,
                travellerSurnames: travellerSurnames || undefined,
                transferAirportCode: departureAirport,
                arrivalCity: depCity || undefined,
                transferHotelName: hotelTitle,
                transferHotelAddress: service.hotelAddress || hotelTitle,
              });
            }
          }
        }
      }
    } else if (service.category === "Transfer") {
      const txKey = `transfer|${service.name}|${service.dateFrom}`;
      if (seenTransferKeys.has(txKey)) continue;
      seenTransferKeys.add(txKey);
      events.push({
        id: service.id,
        date: service.dateFrom,
        type: 'transfer',
        icon,
        title: service.name,
        sortOrder: 40,
        serviceId: service.id,
        travellerSurnames: travellerSurnames || undefined,
      });
    } else {
      // Tour Package without flight segments: hotel check-in 13:00-14:00, check-out 11:00-12:00 only (deduplicate)
      const isTour = (service as { categoryType?: string }).categoryType === "tour" || service.category === "Tour" || service.category === "Package Tour";
      if (isTour && service.dateFrom && service.dateTo) {
        const tourKey2 = `tour-nofl|${service.name}|${service.dateFrom}|${service.dateTo}`;
        if (!seenHotelKeys.has(tourKey2)) {
          seenHotelKeys.add(tourKey2);
          const hotelTitle = (service as { hotelName?: string }).hotelName || service.name;
          events.push({
            id: `${service.id}-checkin`,
            date: service.dateFrom,
            type: 'hotel_checkin',
            icon: "hotel",
            title: `Check-in 13:00-14:00: ${hotelTitle}`,
            sortOrder: 50,
            serviceId: service.id,
            travellerSurnames: travellerSurnames || undefined,
            hotelAddress: service.hotelAddress,
            hotelPhone: service.hotelPhone,
          });
          if (service.dateTo !== service.dateFrom) {
            events.push({
              id: `${service.id}-checkout`,
              date: service.dateTo,
              type: 'hotel_checkout',
              icon: "hotel",
              title: `Check-out 11:00-12:00: ${hotelTitle}`,
              sortOrder: 10,
              serviceId: service.id,
              travellerSurnames: travellerSurnames || undefined,
              hotelAddress: service.hotelAddress,
              hotelPhone: service.hotelPhone,
            });
          }
          const txType2 = (service as { transferType?: string | null }).transferType;
          if (txType2 && txType2 !== "—") {
            const isGroup2 = txType2.toLowerCase() === "group";
            const txTitle2 = isGroup2 ? "Group Transfer" : `Transfer: ${txType2}`;
            const txIcon2 = isGroup2 ? <Bus size={16} strokeWidth={1.8} /> : <CarTaxiFront size={16} strokeWidth={1.8} />;
            events.push({
              id: `${service.id}-transfer-in`,
              date: service.dateFrom,
              type: 'transfer_inbound',
              icon: txIcon2,
              title: txTitle2,
              subtitle: "Airport → Hotel",
              sortOrder: 45,
              serviceId: service.id,
              travellerSurnames: travellerSurnames || undefined,
            });
            if (service.dateTo !== service.dateFrom) {
              events.push({
                id: `${service.id}-transfer-out`,
                date: service.dateTo,
                type: 'transfer_outbound',
                icon: txIcon2,
                title: txTitle2,
                subtitle: "Hotel → Airport",
                sortOrder: 15,
                serviceId: service.id,
                travellerSurnames: travellerSurnames || undefined,
              });
            }
          }
        }
      } else {
        const otherKey = `other|${service.category}|${service.name}|${service.dateFrom}`;
        if (seenOtherKeys.has(otherKey)) continue;
        seenOtherKeys.add(otherKey);
        events.push({
          id: service.id,
          date: service.dateFrom,
          type: 'other',
          icon,
          title: service.name,
          sortOrder: 60,
          serviceId: service.id,
          travellerSurnames: travellerSurnames || undefined,
        });
      }
    }
  }
  
  for (const event of events) {
    if (!event.assignedTravellerIds && event.serviceId) {
      const svc = services.find((s) => s.id === event.serviceId);
      if (svc?.assignedTravellerIds) {
        event.assignedTravellerIds = svc.assignedTravellerIds;
      }
    }
  }

  return events;
}

// Group events by date
function groupByDate(events: TimelineEvent[]): Record<string, TimelineEvent[]> {
  const groups: Record<string, TimelineEvent[]> = {};
  
  for (const event of events) {
    if (!groups[event.date]) {
      groups[event.date] = [];
    }
    groups[event.date].push(event);
  }
  
  // Sort events within each day
  for (const date of Object.keys(groups)) {
    groups[date].sort((a, b) => a.sortOrder - b.sortOrder);
  }
  
  return groups;
}

export default function ItineraryTimeline({ 
  services, 
  travellers, 
  selectedTravellerId,
  onSelectTraveller,
  onUploadBoardingPass,
  onViewBoardingPass,
  onDeleteBoardingPass,
  onEditService,
  selectedBoardingPasses = [],
  onToggleBoardingPassSelection,
  travellerIdToColor = {},
  routeColorsUsed = [],
  stickyTopOffset = 0,
}: ItineraryTimelineProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const hotelColors = useMemo(() => getHotelColors(routeColorsUsed), [routeColorsUsed]);

  const categories = useMemo(() => {
    const cats = [...new Set(services.map((s) => s.category).filter(Boolean))] as string[];
    return cats.sort((a, b) => a.localeCompare(b));
  }, [services]);

  const servicesFilteredByCategory = selectedCategory
    ? services.filter((s) => s.category === selectedCategory)
    : services;
  const allEvents = servicesToEvents(servicesFilteredByCategory, travellers);

  const events = useMemo(() => {
    if (!selectedTravellerId) return allEvents;
    return allEvents.filter((e) => {
      if (!e.assignedTravellerIds?.length) return true;
      return e.assignedTravellerIds.includes(selectedTravellerId);
    });
  }, [allEvents, selectedTravellerId]);

  const groupedByDate = groupByDate(events);
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => 
    new Date(a).getTime() - new Date(b).getTime()
  );

  // Request notification permission on mount (for flight check-in reminders)
  useEffect(() => {
    const hasFlights = services.some(s => s.category === "Flight");
    if (hasFlights) {
      requestNotificationPermission();
    }
  }, [services]);

  // Async: fetch real driving distance for transfer events via OSRM
  const [transferDistances, setTransferDistances] = useState<Record<string, string>>({});
  const fetchedCacheRef = useRef<Record<string, string>>({});

  useEffect(() => {
    const transferEvents = events.filter(
      (e) => (e.type === "transfer_inbound" || e.type === "transfer_outbound") && e.transferAirportCode
    );
    if (transferEvents.length === 0) return;

    let cancelled = false;

    async function fetchDistances() {
      const results: Record<string, string> = {};

      const uniqueQueries = new Map<string, string[]>();
      for (const ev of transferEvents) {
        const cacheKey = `${ev.transferAirportCode}|${ev.transferHotelAddress || ""}|${ev.transferHotelName || ""}`;
        if (fetchedCacheRef.current[cacheKey]) {
          results[ev.id] = fetchedCacheRef.current[cacheKey];
          continue;
        }
        const existing = uniqueQueries.get(cacheKey) || [];
        existing.push(ev.id);
        uniqueQueries.set(cacheKey, existing);
      }

      for (const [cacheKey, eventIds] of uniqueQueries) {
        const [airport, address, hName] = cacheKey.split("|");
        try {
          const params = new URLSearchParams({ airport });
          if (address) params.set("address", address);
          if (hName) params.set("hotelName", hName);
          const res = await fetch(`/api/geo/transfer-distance?${params}`);
          if (!res.ok) continue;
          const json = await res.json();
          if (json.data?.label) {
            const approxPrefix = json.data.source === "osrm-approx" || json.data.source === "haversine" ? "≈" : "";
            const val = `${approxPrefix}${json.data.label}`;
            fetchedCacheRef.current[cacheKey] = val;
            for (const id of eventIds) {
              results[id] = val;
            }
          }
        } catch { /* ignore */ }
      }

      if (!cancelled && Object.keys(results).length > 0) {
        setTransferDistances((prev) => ({ ...prev, ...results }));
      }
    }

    fetchDistances();
    return () => { cancelled = true; };
  }, [events]);

  if (services.length === 0) {
    return (
      <div className="rounded-lg bg-white shadow-sm p-4">
        <div className="flex items-center gap-2">
          <CalendarRange size={18} strokeWidth={1.6} className="text-gray-500" />
          <h2 className="text-base font-semibold text-gray-900">Itinerary</h2>
        </div>
        <p className="text-gray-400 text-sm text-center py-4">No services added yet</p>
      </div>
    );
  }

  return (
    <div>
      {/* Sticky header - outside the card so it sticks to viewport */}
      <div className="sticky z-10 bg-white rounded-t-lg border border-b-0 border-gray-200 px-4 py-2 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)] before:content-[''] before:absolute before:left-0 before:right-0 before:bottom-full before:h-4 before:bg-gray-50 before:-mx-px" style={{ top: stickyTopOffset }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarRange size={18} strokeWidth={1.6} className="text-gray-500" />
            <h2 className="text-base font-semibold text-gray-900">Itinerary</h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {travellers.length > 0 && (
              <select
                value={selectedTravellerId || "all"}
                onChange={(e) => onSelectTraveller?.(e.target.value === "all" ? null : e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                title="Select client to filter itinerary"
              >
                <option value="all">All clients ({travellers.length})</option>
                {travellers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.firstName} {t.lastName}
                  </option>
                ))}
              </select>
            )}
            {categories.length > 0 && (
              <select
                value={selectedCategory ?? "all"}
                onChange={(e) => setSelectedCategory(e.target.value === "all" ? null : e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                title="Filter by category"
                aria-label="Filter itinerary by category"
              >
                <option value="all">All categories ({categories.length})</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Timeline card body */}
      <div className="rounded-b-lg bg-white shadow-sm border border-t-0 border-gray-200">
      <div className="p-3 space-y-3">
        {sortedDates.map((dateKey) => {
          const dayEvents = groupedByDate[dateKey];
          const formattedDate = formatDateShort(dateKey);
          const weekday = new Date(dateKey).toLocaleDateString("en-GB", { weekday: "short" });
          
          return (
            <div key={dateKey} className="rounded-r-lg border-l-2 border-blue-200 bg-gray-50/50 pl-3 pr-3 pt-2 pb-2">
              <div className="flex gap-5 min-w-0 items-start">
                {/* Date — anchor for this day */}
                <div className="flex-shrink-0 w-16 text-center pr-2 pt-0.5">
                  <div className="text-xs font-bold text-blue-600">{weekday}</div>
                  <div className="text-sm font-semibold text-gray-900">{formattedDate}</div>
                </div>
                
                <div className="flex-1 min-w-0 space-y-1.5">
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    className={`text-sm ${
                      event.type === 'hotel_checkout' || event.type === 'hotel_checkin'
                        ? 'min-h-0'
                        : event.type === 'flight' || event.type === 'transfer_inbound' || event.type === 'transfer_outbound'
                        ? 'min-h-0'
                        : 'bg-gray-50 text-gray-700 px-2 py-1.5 rounded'
                    } ${onEditService ? 'cursor-pointer hover:ring-2 hover:ring-blue-300' : ''}`}
                    onDoubleClick={() => {
                      if (onEditService && event.serviceId) {
                        onEditService(event.serviceId);
                      }
                    }}
                    title={onEditService ? "Double-click to edit" : undefined}
                  >
                    {event.type === 'hotel_checkin' || event.type === 'hotel_checkout' ? (
                      // Hotel card — left border (colors not used by flights on map), content 2/3; right 1/3 + surname(s)
                      <div className="flex items-stretch gap-2 min-w-0">
                        <div
                          className="w-2/3 flex-shrink-0 bg-white rounded-lg pl-3 pr-3 pt-2 pb-2 border border-gray-200 border-l-4 text-gray-800"
                          style={{ borderLeftColor: event.type === 'hotel_checkin' ? hotelColors.checkin : hotelColors.checkout }}
                        >
                          <div className="flex items-start gap-2">
                            <span className="flex-shrink-0 mt-0.5" style={{ color: event.type === 'hotel_checkin' ? hotelColors.checkin : hotelColors.checkout }}><Hotel size={18} strokeWidth={1.6} /></span>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium">{event.title}</div>
                              {event.hotelAddress && (
                                <div className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                                  <MapPin size={12} strokeWidth={1.8} className="flex-shrink-0 text-gray-400" />
                                  {event.hotelAddress}
                                </div>
                              )}
                              {event.hotelPhone && (
                                <div className="text-xs text-gray-600 mt-0.5">
                                  <a href={`tel:${event.hotelPhone.replace(/\s/g, '')}`} className="hover:underline flex items-center gap-1">
                                    <Phone size={12} strokeWidth={1.8} className="flex-shrink-0 text-gray-400" />
                                    {event.hotelPhone}
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        {/* Right: same padding as flight block (pl-4 pr-3), surname(s) */}
                        <div className="flex-1 min-w-0 flex flex-col items-end justify-center pl-4 pr-3 py-2 rounded-lg border border-gray-200 bg-white">
                          {event.hotelRoomSurnames && event.hotelRoomSurnames.length > 0 ? (
                            event.hotelRoomSurnames.map((surnames, i) => (
                              <div key={i} className="text-xs font-medium text-gray-700 text-right">{surnames}</div>
                            ))
                          ) : event.travellerSurnames ? (
                            <div className="text-xs font-medium text-gray-700 text-right">{event.travellerSurnames}</div>
                          ) : null}
                        </div>
                      </div>
                    ) : event.type === 'transfer_inbound' || event.type === 'transfer_outbound' ? (
                      // Transfer card — flight-like layout with route, arrow, car icon, duration
                      (() => {
                        const isInbound = event.type === 'transfer_inbound';
                        const accent = isInbound ? '#3b82f6' : '#8b5cf6';
                        const accentBg = isInbound ? 'bg-blue-50' : 'bg-purple-50';
                        const accentBorder = isInbound ? 'border-l-blue-400' : 'border-l-purple-400';
                        const airportCode = event.transferAirportCode || "";
                        const airportCity = event.arrivalCity || "";
                        const hotelName = event.transferHotelName || "Hotel";
                        const hotelShort = hotelName.length > 12 ? hotelName.slice(0, 12) + "…" : hotelName;
                        const distInfo = transferDistances[event.id] || event.transferInfo;
                        const isApprox = distInfo?.startsWith("≈");
                        const distParts = distInfo?.match(/~(\d+)\s*km.*?~(\d+)\s*min/);
                        const hMatch = distInfo?.match(/~(\d+)\s*km.*?~(\d+)h\s*(\d*)\s*min/);
                        const durationLabel = distParts ? `${isApprox ? "≈" : ""}${distParts[1]} km` : null;
                        const durationTime = hMatch
                          ? `~${hMatch[2]}h ${hMatch[3] ? hMatch[3] + " min" : ""}`
                          : distParts ? `~${distParts[2]} min` : null;

                        return (
                          <div className="flex items-stretch gap-2 min-w-0">
                            <div className={`w-2/3 flex-shrink-0 bg-white rounded-lg pl-3 pr-3 pt-2 pb-2 border border-gray-200 border-l-4 ${accentBorder}`}>
                              <div className="flex items-start gap-2 text-sm">
                                <span className="flex-shrink-0 mt-0.5" style={{ color: accent }}>{event.icon}</span>
                                <div className="w-24 flex-shrink-0 flex flex-col items-center gap-1 text-center">
                                  <span className="font-semibold" style={{ color: accent }}>{event.title}</span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${accentBg}`} style={{ color: accent }}>
                                    {isInbound ? "Airport → Hotel" : "Hotel → Airport"}
                                  </span>
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    {/* FROM */}
                                    <div className="text-center min-w-[70px]">
                                      <div className="text-xs text-gray-400">{formatDateShort(event.date)}</div>
                                      <div className="font-medium">{isInbound ? airportCode : hotelShort}</div>
                                      <div className="text-[10px] text-gray-500">{isInbound ? airportCity : "Hotel"}</div>
                                    </div>
                                    {/* ARROW with car icon + distance + time */}
                                    <div className="flex-1 flex flex-col items-center justify-center px-2 gap-0.5">
                                      {durationLabel ? (
                                        <>
                                          <div className="text-xs font-medium text-gray-700">{durationLabel}</div>
                                          {durationTime && <div className="text-[10px] text-gray-400">{durationTime}</div>}
                                        </>
                                      ) : distInfo ? (
                                        <div className="text-[10px] text-gray-500">{distInfo}</div>
                                      ) : (
                                        <div className="text-[10px] text-gray-400">—</div>
                                      )}
                                      <div className="w-full h-px bg-gray-300 relative mt-2">
                                        <span className="absolute left-1/2 -translate-x-1/2 -top-[7px]" style={{ color: accent }}>
                                          <CarTaxiFront size={14} strokeWidth={1.5} />
                                        </span>
                                      </div>
                                    </div>
                                    {/* TO */}
                                    <div className="text-center min-w-[70px]">
                                      <div className="text-xs text-gray-400">{formatDateShort(event.date)}</div>
                                      <div className="font-medium">{isInbound ? hotelShort : airportCode}</div>
                                      <div className="text-[10px] text-gray-500">{isInbound ? "Hotel" : airportCity}</div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col items-end justify-center pl-4 pr-3 py-2 rounded-lg border border-gray-200 bg-white">
                              {event.travellerSurnames && (
                                <div className="text-xs font-medium text-gray-700 text-right">{event.travellerSurnames}</div>
                              )}
                            </div>
                          </div>
                        );
                      })()
                    ) : event.type === 'flight' && event.flightNumber ? (
                      // Detailed flight display — flight block 2/3 (left border = map route colour), right panel 1/3
                      <div className="flex items-stretch gap-2 min-w-0">
                        <div className="w-2/3 flex-shrink-0 min-w-0 overflow-x-auto">
                          {renderFlightCard(
                            event,
                            (() => {
                              const tid = event.ticketNumbers?.[0]?.clientId ?? event.assignedTravellerIds?.[0];
                              return tid ? travellerIdToColor[tid] : undefined;
                            })()
                          )}
                        </div>
                        
                        {/* Right panel: same outline as flight card (rounded + border), no thick left stripe */}
                        {(event.ticketNumbers && event.ticketNumbers.length > 0) || event.bookingRef ? (
                          <div className="flex-1 min-w-0 flex flex-col items-end justify-center gap-2 pl-4 rounded-lg border border-sky-100 bg-white">
                            {/* Row 1: PNR + passenger surname(s) */}
                            <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
                              {event.bookingRef && (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-gray-500">PNR</span>
                                  <span className="font-mono text-xs font-semibold text-gray-800">{event.bookingRef}</span>
                                  <CopyButton text={event.bookingRef} title="Copy PNR" />
                                </div>
                              )}
                              {event.ticketNumbers && event.ticketNumbers.length > 0 && (
                                <>
                                  {event.bookingRef && <span className="text-gray-300">|</span>}
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-gray-600">
                                      {event.ticketNumbers.map(t => t.clientName.split(" ").pop()).join(", ")}
                                    </span>
                                    <CopyButton
                                      text={event.ticketNumbers.map(t => t.clientName.split(" ").pop()).join(", ")}
                                      title="Copy surname"
                                    />
                                  </div>
                                </>
                              )}
                            </div>
                            {/* Row 2: BP checkboxes + upload per passenger */}
                            {event.ticketNumbers && event.ticketNumbers.map((ticket) => (
                              <div key={ticket.clientId} className="flex items-center gap-2 justify-end">
                                {event.serviceId && (() => {
                                  const clientPasses = (event.boardingPasses || []).filter(
                                    bp => bp.clientName === ticket.clientName && bp.flightNumber === event.flightNumber
                                  );
                                  const hasPass = clientPasses.length > 0;
                                  return (
                                    <div className="flex items-center gap-1.5">
                                      {hasPass && onToggleBoardingPassSelection && (
                                        <div className="flex flex-col gap-0.5">
                                          {clientPasses.map(pass => {
                                            const isSelected = selectedBoardingPasses.some(s => s.passId === pass.id);
                                            return (
                                              <label key={pass.id} className="flex items-center cursor-pointer" title={`Select ${pass.fileName}`}>
                                                <input
                                                  type="checkbox"
                                                  checked={isSelected}
                                                  onChange={() => onToggleBoardingPassSelection({
                                                    serviceId: event.serviceId!,
                                                    passId: pass.id,
                                                    clientName: pass.clientName,
                                                    flightNumber: pass.flightNumber || event.flightNumber || "",
                                                    fileName: pass.fileName,
                                                    fileUrl: pass.fileUrl,
                                                  })}
                                                  className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                  aria-label={`Select boarding pass ${pass.fileName}`}
                                                />
                                              </label>
                                            );
                                          })}
                                        </div>
                                      )}
                                      <BoardingPassUpload
                                        serviceId={event.serviceId}
                                        flightNumber={event.flightNumber || ""}
                                        clientId={ticket.clientId}
                                        clientName={ticket.clientName}
                                        existingPasses={event.boardingPasses}
                                        onUpload={onUploadBoardingPass
                                          ? (file, clientId, flightNumber) => onUploadBoardingPass(event.serviceId!, file, clientId, flightNumber)
                                          : undefined
                                        }
                                        onView={onViewBoardingPass}
                                        onDelete={onDeleteBoardingPass
                                          ? (passId) => onDeleteBoardingPass(event.serviceId!, passId)
                                          : undefined
                                        }
                                      />
                                    </div>
                                  );
                                })()}
                              </div>
                            ))}
                            {/* Row 3: status */}
                            {event.flightNumber && event.departureDateTime && (() => {
                              const depTime = new Date(event.departureDateTime).getTime();
                              const now = Date.now();
                              const isPast = now > depTime;
                              if (isPast) {
                                return <span className="text-[10px] text-gray-500">Flight departed</span>;
                              }
                              const allHaveBP = event.ticketNumbers && event.ticketNumbers.length > 0 &&
                                event.ticketNumbers.every(t =>
                                  event.boardingPasses?.some(bp =>
                                    bp.clientName === t.clientName && bp.flightNumber === event.flightNumber
                                  )
                                );
                              if (allHaveBP) return null;
                              return (
                                <CheckinCountdown
                                  flightNumber={event.flightNumber}
                                  departureDateTime={event.departureDateTime}
                                  checkinUrl={event.checkinUrl}
                                  bookingRef={event.bookingRef}
                                  clientName={event.ticketNumbers?.[0]?.clientName}
                                />
                              );
                            })()}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      // Simple display for hotel, transfer, other (with traveller surnames)
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="flex-shrink-0 text-gray-500">{event.icon}</span>
                        <span className="truncate">{event.title}</span>
                        {event.travellerSurnames && (
                          <span className="text-xs text-gray-500">({event.travellerSurnames})</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Note: check-in/check-out times may vary — shown only when hotel is present in Itinerary */}
      {events.some(e => e.type === 'hotel_checkin' || e.type === 'hotel_checkout') && (
        <div className="border-t border-gray-200 px-4 py-2 bg-gray-50 rounded-b-lg">
          <p className="text-xs text-gray-500 italic">
            Check-in and check-out times may vary by hotel.
          </p>
        </div>
      )}
      </div>
    </div>
  );
}
