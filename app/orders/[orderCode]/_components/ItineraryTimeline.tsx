"use client";

/**
 * Itinerary Timeline — утверждённый layout для перелётов (Flight и Tour Package):
 * Flight number, airline, class, baggage, route (dep→arr + times + terminals),
 * duration, PNR, traveller, +BP button, status (Flight departed / Check-in countdown).
 * Tour Package с flight segments отображается тем же layout.
 * См. .ai/specs/itinerary-flight-layout-approved.md
 */
import React, { useEffect, useState, useCallback } from "react";
import { getCheckinUrl, isCheckinAvailable } from "@/lib/flights/airlineCheckin";
import CheckinCountdown from "@/components/CheckinCountdown";
import BoardingPassUpload from "@/components/BoardingPassUpload";
import { requestNotificationPermission } from "@/lib/notifications/checkinNotifications";

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
  flightSegments?: FlightSegment[];
  ticketNumbers?: TicketNumber[]; // Clients with ticket numbers
  boardingPasses?: BoardingPass[]; // Uploaded boarding passes
  baggage?: string; // Baggage info: "personal", "personal+cabin", "personal+cabin+1bag", etc.
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
}

// Category icons
const categoryIcons: Record<string, string> = {
  Flight: "✈️",
  Hotel: "🏨",
  Transfer: "🚐",
  Tour: "🎫",
  Insurance: "🛡️",
  Visa: "📋",
  Other: "📌",
};

// Format date as DD.MM
function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" });
}

// Timeline event structure
interface TimelineEvent {
  id: string;
  date: string;
  type: 'flight' | 'hotel_checkin' | 'hotel_checkout' | 'transfer' | 'other';
  icon: string;
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
  arrivalNextDay?: boolean; // Прилёт на след. день
  // Client info for flights
  bookingRef?: string;
  ticketNumbers?: TicketNumber[];
  checkinUrl?: string;
  checkinAvailable?: boolean;
  // For countdown
  departureDateTime?: string; // ISO format: YYYY-MM-DDTHH:mm
  // For boarding passes
  serviceId?: string;
  boardingPasses?: BoardingPass[];
  // Who uses this service (for deduplicated events)
  travellerSurnames?: string;
}

// Normalize segment keys (API/DB may return snake_case)
function normalizeSegment(seg: Record<string, unknown>): { id: string; flightNumber: string; airline?: string; departure: string; arrival: string; departureDate: string; departureTimeScheduled: string; arrivalDate: string; arrivalTimeScheduled: string; departureCity?: string; arrivalCity?: string; departureTerminal?: string; arrivalTerminal?: string; duration?: string; cabinClass?: string; baggage?: string } {
  return {
    id: String(seg.id ?? seg.flightNumber ?? Math.random().toString(36).slice(2)),
    flightNumber: String(seg.flightNumber ?? seg.flight_number ?? ""),
    airline: seg.airline ?? seg.airline_name ? String(seg.airline ?? seg.airline_name) : undefined,
    departure: String(seg.departure ?? ""),
    arrival: String(seg.arrival ?? ""),
    departureDate: String(seg.departureDate ?? seg.departure_date ?? ""),
    departureTimeScheduled: String(seg.departureTimeScheduled ?? seg.departure_time_scheduled ?? seg.departureTime ?? seg.departure_time ?? ""),
    arrivalDate: String(seg.arrivalDate ?? seg.arrival_date ?? seg.departureDate ?? seg.departure_date ?? ""),
    arrivalTimeScheduled: String(seg.arrivalTimeScheduled ?? seg.arrival_time_scheduled ?? seg.arrivalTime ?? seg.arrival_time ?? ""),
    departureCity: seg.departureCity ?? seg.departure_city ? String(seg.departureCity ?? seg.departure_city) : undefined,
    arrivalCity: seg.arrivalCity ?? seg.arrival_city ? String(seg.arrivalCity ?? seg.arrival_city) : undefined,
    departureTerminal: seg.departureTerminal ?? seg.departure_terminal ? String(seg.departureTerminal ?? seg.departure_terminal) : undefined,
    arrivalTerminal: seg.arrivalTerminal ?? seg.arrival_terminal ? String(seg.arrivalTerminal ?? seg.arrival_terminal) : undefined,
    duration: seg.duration ? String(seg.duration) : undefined,
    cabinClass: seg.cabinClass ?? seg.cabin_class ? String(seg.cabinClass ?? seg.cabin_class) : undefined,
    baggage: seg.baggage ? String(seg.baggage) : undefined,
  };
}

// Helper: get traveller surnames for contributing services (splitted deduplication)
function getTravellerSurnames(
  contributingServiceIds: string[],
  services: TimelineService[],
  travellers: Traveller[]
): string {
  const travellerIds = new Set<string>();
  for (const svc of services) {
    if (contributingServiceIds.includes(svc.id) && svc.assignedTravellerIds?.length) {
      svc.assignedTravellerIds.forEach((tid) => travellerIds.add(tid));
    }
  }
  const surnames = Array.from(travellerIds)
    .map((tid) => travellers.find((t) => t.id === tid)?.lastName)
    .filter(Boolean) as string[];
  return [...new Set(surnames)].join(", ");
}

// Convert services to timeline events
function servicesToEvents(services: TimelineService[], travellers: Traveller[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const seenSegmentKeys = new Set<string>(); // Дедупликация: parent + change могут иметь одни сегменты
  const seenSplitGroupHotelIds = new Set<string>();
  const seenSplitGroupTransferIds = new Set<string>();
  const seenSplitGroupOtherIds = new Set<string>();
  
  for (const service of services) {
    if (service.resStatus === "cancelled") continue;
    
    const icon = categoryIcons[service.category] || categoryIcons.Other;
    const splitGroupId = service.splitGroupId ?? null;
    const contributingIds = splitGroupId
      ? services.filter((s) => (s.splitGroupId ?? null) === splitGroupId).map((s) => s.id)
      : [service.id];
    const travellerSurnames = getTravellerSurnames(contributingIds, services, travellers);
    
    if (service.category === "Hotel") {
      // Deduplicate: splitted services show hotel once
      if (splitGroupId && seenSplitGroupHotelIds.has(splitGroupId)) continue;
      if (splitGroupId) seenSplitGroupHotelIds.add(splitGroupId);
      // Hotel: check-in 13:00-14:00, check-out 11:00-12:00
      events.push({
        id: `${service.id}-checkin`,
        date: service.dateFrom,
        type: 'hotel_checkin',
        icon: "🏨",
        title: `Check-in 13:00-14:00: ${service.name}`,
        sortOrder: 50, // After flights/transfers
        serviceId: service.id,
        travellerSurnames: travellerSurnames || undefined,
      });
      
      if (service.dateTo && service.dateTo !== service.dateFrom) {
        events.push({
          id: `${service.id}-checkout`,
          date: service.dateTo,
          type: 'hotel_checkout',
          icon: "🏨",
          title: `Check-out 11:00-12:00: ${service.name}`,
          sortOrder: 10, // Before flights on departure day
          serviceId: service.id,
          travellerSurnames: travellerSurnames || undefined,
        });
      }
    } else if (service.category === "Flight" || (service as { serviceType?: string }).serviceType === "change" || (((service as { categoryType?: string }).categoryType === "tour" || service.category === "Tour" || service.category === "Package Tour") && service.flightSegments && service.flightSegments.length > 0)) {
      // Flight или Tour Package с flight segments — один и тот же утверждённый layout
      const firstFlightNumber = service.flightSegments?.[0]?.flightNumber || "";
      const checkinUrl = getCheckinUrl(firstFlightNumber);
      const flightIcon = categoryIcons.Flight; // ✈️ для всех перелётов (Flight и Tour Package)
      
      // If we have flight segments, create an event for each segment
      if (service.flightSegments && service.flightSegments.length > 0) {
        for (const rawSeg of service.flightSegments) {
          const segment = normalizeSegment(rawSeg as unknown as Record<string, unknown>);
          // Дедупликация: parent (res_status changed) и Change service могут иметь одни сегменты
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
          });
        }
      } else {
        // Fallback: just show the route name
        events.push({
          id: service.id,
          date: service.dateFrom,
          type: 'flight',
          icon: flightIcon,
          title: service.name,
          subtitle: service.supplier,
          sortOrder: 30,
          bookingRef: service.refNr,
          ticketNumbers: service.ticketNumbers,
          checkinUrl: checkinUrl || undefined,
          serviceId: service.id,
          boardingPasses: service.boardingPasses,
        });
      }
      // Tour Package: отель check-in 13:00-14:00, check-out 11:00-12:00 (deduplicate for splitted)
      const isTour = (service as { categoryType?: string }).categoryType === "tour" || service.category === "Tour" || service.category === "Package Tour";
      if (isTour && service.dateFrom && service.dateTo) {
        if (splitGroupId && seenSplitGroupHotelIds.has(splitGroupId)) {
          // skip - already added for this split group
        } else {
          if (splitGroupId) seenSplitGroupHotelIds.add(splitGroupId);
          const hotelTitle = (service as { hotelName?: string }).hotelName || service.name;
          events.push({
            id: `${service.id}-checkin`,
            date: service.dateFrom,
            type: 'hotel_checkin',
            icon: "🏨",
            title: `Check-in 13:00-14:00: ${hotelTitle}`,
            sortOrder: 50,
            serviceId: service.id,
            travellerSurnames: travellerSurnames || undefined,
          });
          if (service.dateTo !== service.dateFrom) {
            events.push({
              id: `${service.id}-checkout`,
              date: service.dateTo,
              type: 'hotel_checkout',
              icon: "🏨",
              title: `Check-out 11:00-12:00: ${hotelTitle}`,
              sortOrder: 10,
              serviceId: service.id,
              travellerSurnames: travellerSurnames || undefined,
            });
          }
        }
      }
    } else if (service.category === "Transfer") {
      if (splitGroupId && seenSplitGroupTransferIds.has(splitGroupId)) continue;
      if (splitGroupId) seenSplitGroupTransferIds.add(splitGroupId);
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
      // Tour Package без flight segments: только отель check-in 13:00-14:00, check-out 11:00-12:00 (deduplicate)
      const isTour = (service as { categoryType?: string }).categoryType === "tour" || service.category === "Tour" || service.category === "Package Tour";
      if (isTour && service.dateFrom && service.dateTo) {
        if (splitGroupId && seenSplitGroupHotelIds.has(splitGroupId)) {
          // skip
        } else {
          if (splitGroupId) seenSplitGroupHotelIds.add(splitGroupId);
          const hotelTitle = (service as { hotelName?: string }).hotelName || service.name;
          events.push({
            id: `${service.id}-checkin`,
            date: service.dateFrom,
            type: 'hotel_checkin',
            icon: "🏨",
            title: `Check-in 13:00-14:00: ${hotelTitle}`,
            sortOrder: 50,
            serviceId: service.id,
            travellerSurnames: travellerSurnames || undefined,
          });
          if (service.dateTo !== service.dateFrom) {
            events.push({
              id: `${service.id}-checkout`,
              date: service.dateTo,
              type: 'hotel_checkout',
              icon: "🏨",
              title: `Check-out 11:00-12:00: ${hotelTitle}`,
              sortOrder: 10,
              serviceId: service.id,
              travellerSurnames: travellerSurnames || undefined,
            });
          }
        }
      } else {
        // Other services (excursions, VIP, etc.) - deduplicate for splitted
        if (splitGroupId && seenSplitGroupOtherIds.has(splitGroupId)) continue;
        if (splitGroupId) seenSplitGroupOtherIds.add(splitGroupId);
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
}: ItineraryTimelineProps) {
  const events = servicesToEvents(services, travellers);
  const groupedByDate = groupByDate(events);
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => 
    new Date(a).getTime() - new Date(b).getTime()
  );
  
  // Filter travellers based on selection
  const displayTravellers = selectedTravellerId 
    ? travellers.filter(t => t.id === selectedTravellerId)
    : travellers;

  // Request notification permission on mount (for flight check-in reminders)
  useEffect(() => {
    const hasFlights = services.some(s => s.category === "Flight");
    if (hasFlights) {
      requestNotificationPermission();
    }
  }, [services]);

  if (services.length === 0) {
    return (
      <div className="rounded-lg bg-white shadow-sm p-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">📅</span>
          <h2 className="text-base font-semibold text-gray-900">Itinerary</h2>
        </div>
        <p className="text-gray-400 text-sm text-center py-4">No services added yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-200 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📅</span>
            <h2 className="text-base font-semibold text-gray-900">Itinerary</h2>
          </div>
          {travellers.length > 0 && (
            <div className="flex items-center gap-2">
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
            </div>
          )}
        </div>
      </div>

      {/* Compact Timeline */}
      <div className="p-3 space-y-3">
        {sortedDates.map((dateKey) => {
          const dayEvents = groupedByDate[dateKey];
          const formattedDate = formatDateShort(dateKey);
          const weekday = new Date(dateKey).toLocaleDateString("en-GB", { weekday: "short" });
          
          return (
            <div key={dateKey} className="flex gap-3">
              {/* Date badge */}
              <div className="flex-shrink-0 w-16 text-center">
                <div className="text-xs font-bold text-blue-600">{weekday}</div>
                <div className="text-sm font-semibold text-gray-900">{formattedDate}</div>
              </div>
              
              {/* Events for this date */}
              <div className="flex-1 space-y-1.5">
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    className={`px-2 py-1.5 rounded text-sm ${
                      event.type === 'hotel_checkout' 
                        ? 'bg-orange-50 text-orange-800' 
                        : event.type === 'hotel_checkin'
                        ? 'bg-green-50 text-green-800'
                        : event.type === 'flight'
                        ? 'bg-blue-50 text-blue-800'
                        : 'bg-gray-50 text-gray-700'
                    } ${onEditService ? 'cursor-pointer hover:ring-2 hover:ring-blue-300' : ''}`}
                    onDoubleClick={() => {
                      if (onEditService && event.serviceId) {
                        onEditService(event.serviceId);
                      }
                    }}
                    title={onEditService ? "Double-click to edit" : undefined}
                  >
                    {event.type === 'flight' && event.flightNumber ? (
                      // Detailed flight display with clients
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5">{event.icon}</span>
                        <div className="flex-1 min-w-0">
                          {/* Flight number and airline */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">{event.flightNumber}</span>
                            {event.airline && (
                              <span className="text-xs text-gray-500">{event.airline}</span>
                            )}
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
                              <span className="text-xs text-gray-500" title={formatBaggageTooltip(event.baggage)}>
                                {formatBaggageShort(event.baggage)}
                              </span>
                            )}
                          </div>
                          {/* Route with times */}
                          <div className="flex items-center gap-1 mt-0.5 text-xs">
                            <div className="flex items-center gap-0.5">
                              <span className="font-medium">{event.departureCode}</span>
                              {event.departureCity && (
                                <span className="text-gray-500 hidden sm:inline">({event.departureCity})</span>
                              )}
                              <span className="font-bold ml-1">{event.departureTime}</span>
                              {event.departureTerminal && (
                                <span className="text-gray-400 text-[10px]">{event.departureTerminal.toLowerCase().startsWith("terminal") ? event.departureTerminal : `T${event.departureTerminal}`}</span>
                              )}
                            </div>
                            <span className="text-gray-400 mx-1">→</span>
                            <div className="flex items-center gap-0.5">
                              <span className="font-medium">{event.arrivalCode}</span>
                              {event.arrivalCity && (
                                <span className="text-gray-500 hidden sm:inline">({event.arrivalCity})</span>
                              )}
                              <span className="font-bold ml-1">{event.arrivalTime}</span>
                              {event.arrivalNextDay && (
                                <span className="text-amber-600 text-[10px] font-medium ml-1" title="Прилёт на следующий день">+1</span>
                              )}
                              {event.arrivalTerminal && (
                                <span className="text-gray-400 text-[10px]">{event.arrivalTerminal.toLowerCase().startsWith("terminal") ? event.arrivalTerminal : `T${event.arrivalTerminal}`}</span>
                              )}
                            </div>
                            {event.duration && (
                              <span className="text-gray-400 ml-2">{event.duration}</span>
                            )}
                          </div>
                        </div>
                        
                        {/* Clients with tickets and check-in */}
                        {(event.ticketNumbers && event.ticketNumbers.length > 0) || event.bookingRef ? (
                          <div className="flex-shrink-0 text-right text-xs space-y-0.5 border-l border-blue-200 pl-2 ml-2">
                            {event.bookingRef && (
                              <div className="flex items-center gap-1.5 justify-end">
                                <span className="text-gray-500">PNR:</span>
                                <span className="font-mono font-semibold text-gray-700">{event.bookingRef}</span>
                                <CopyButton text={event.bookingRef} title="Copy PNR" />
                                {event.ticketNumbers && event.ticketNumbers.length > 0 && (
                                  <>
                                    <span className="text-gray-400 mx-1">|</span>
                                    <span className="text-gray-600">
                                      {event.ticketNumbers.map(t => t.clientName.split(" ").pop()).join(", ")}
                                    </span>
                                    <CopyButton 
                                      text={event.ticketNumbers.map(t => t.clientName.split(" ").pop()).join(", ")} 
                                      title="Copy surname" 
                                    />
                                  </>
                                )}
                              </div>
                            )}
                            {event.ticketNumbers && event.ticketNumbers.map((ticket) => (
                              <div key={ticket.clientId} className="flex items-center gap-1.5 justify-end">
                                {ticket.ticketNr && (
                                  <>
                                    <span className="font-mono text-[10px] text-gray-400">{ticket.ticketNr}</span>
                                    <CopyButton text={ticket.ticketNr} title="Copy ticket" />
                                  </>
                                )}
                                {event.serviceId && (() => {
                                  // Find passes for this client and flight
                                  const clientPasses = (event.boardingPasses || []).filter(
                                    bp => bp.clientName === ticket.clientName && bp.flightNumber === event.flightNumber
                                  );
                                  const hasPass = clientPasses.length > 0;
                                  
                                  return (
                                    <div className="flex items-center gap-1">
                                      {/* Multi-select checkbox (only show if BP exists) */}
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
                            {/* Show flight status */}
                            {event.flightNumber && event.departureDateTime && (() => {
                              const depTime = new Date(event.departureDateTime).getTime();
                              const now = Date.now();
                              const isPast = now > depTime;
                              
                              // If flight departed, always show this
                              if (isPast) {
                                return <span className="text-[10px] text-gray-400">Flight departed</span>;
                              }
                              
                              // Check if all clients have BP for this specific flight
                              const allHaveBP = event.ticketNumbers && event.ticketNumbers.length > 0 &&
                                event.ticketNumbers.every(ticket => 
                                  event.boardingPasses?.some(bp => 
                                    bp.clientName === ticket.clientName && bp.flightNumber === event.flightNumber
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
                        <span>{event.icon}</span>
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
          );
        })}
      </div>

      {/* Ремарка: время check-in/check-out может различаться — только при наличии отеля в Itinerary */}
      {events.some(e => e.type === 'hotel_checkin' || e.type === 'hotel_checkout') && (
        <div className="border-t border-gray-200 px-4 py-2 bg-gray-50">
          <p className="text-xs text-gray-500 italic">
            Check-in and check-out times may vary by hotel.
          </p>
        </div>
      )}
      
    </div>
  );
}
