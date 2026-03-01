"use client";

import React, { useMemo, useState } from "react";
import { Link2, Plane, Hotel, Car } from "lucide-react";
import type { FlightSegment } from "@/components/FlightItineraryInput";
import { formatDateShort } from "@/utils/dateFormat";
import { useModalOverlay } from "@/contexts/ModalOverlayContext";

function suggestPickupTimeFromFlight(
  flight: FlightServiceRef,
  isPickupAtArrivalAirport: boolean,
  durationMin?: number,
  useLastSegment?: boolean
): string | undefined {
  const segs = flight.flightSegments || [];
  const iter = useLastSegment ? [...segs].reverse() : segs;
  for (const seg of iter) {
    const s = seg as unknown as Record<string, string>;
    if (isPickupAtArrivalAirport && s.arrivalTimeScheduled) {
      const [h, m] = s.arrivalTimeScheduled.split(":").map(Number);
      const totalMin = h * 60 + m + 45;
      return `${String(Math.floor(totalMin / 60) % 24).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
    }
    if (!isPickupAtArrivalAirport && s.departureTimeScheduled) {
      const [h, m] = s.departureTimeScheduled.split(":").map(Number);
      const buffer = durationMin || 60;
      const totalMin = h * 60 + m - 120 - buffer;
      const adj = totalMin < 0 ? totalMin + 1440 : totalMin;
      return `${String(Math.floor(adj / 60) % 24).padStart(2, "0")}:${String(adj % 60).padStart(2, "0")}`;
    }
  }
  return undefined;
}

interface FlightServiceRef {
  id: string;
  name: string;
  flightSegments: FlightSegment[];
}

interface HotelServiceRef {
  id: string;
  hotelName?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface TransferRouteData {
  id: string;
  pickup: string;
  pickupType?: "airport" | "hotel" | "address";
  dropoff: string;
  dropoffType?: "airport" | "hotel" | "address";
  pickupTime?: string;
  linkedFlightId?: string;
  linkedSegmentIndex?: number;
  pickupMeta?: { iata?: string };
  dropoffMeta?: { iata?: string };
  durationMin?: number;
}

interface LinkedServicesModalProps {
  flightServices: FlightServiceRef[];
  hotelServices?: HotelServiceRef[];
  transferRoutes: TransferRouteData[];
  onApply: (routes: TransferRouteData[]) => void;
  onClose: () => void;
  suggestPickupTime?: (routeId: string, flightServiceId: string, segmentIndex?: number) => void;
  /** When "one_way", show only Route 1 with option to add Route 2 */
  transferBookingType?: "one_way" | "return" | "by_hour";
}

export default function LinkedServicesModal({
  flightServices,
  hotelServices = [],
  transferRoutes,
  onApply,
  onClose,
  suggestPickupTime = () => {},
  transferBookingType,
}: LinkedServicesModalProps) {
  useModalOverlay();
  const isOneWay = transferBookingType === "one_way";

  type BlockId = "flight" | "transfer" | "hotel";
  const defaultRoute1Order: BlockId[] = ["flight", "transfer", "hotel"];
  const defaultRoute2Order: BlockId[] = ["hotel", "transfer", "flight"];
  const [route1Order, setRoute1Order] = useState<BlockId[]>(() => defaultRoute1Order);
  const [route2Order, setRoute2Order] = useState<BlockId[]>(() => defaultRoute2Order);

  const moveBlock = (order: BlockId[], setOrder: (o: BlockId[]) => void, fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const next = [...order];
    const [removed] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, removed);
    setOrder(next);
  };

  const blockConfig: Record<BlockId, { icon: typeof Plane; label: string; isTransfer?: boolean }> = {
    flight: { icon: Plane, label: "Flight", isTransfer: false },
    transfer: { icon: Car, label: "Transfer", isTransfer: true },
    hotel: { icon: Hotel, label: "Hotel", isTransfer: false },
  };

  const DraggableRow = ({
    order,
    setOrder,
    label,
    showFlight,
    showHotel,
  }: {
    order: BlockId[];
    setOrder: (o: BlockId[]) => void;
    label: string;
    showFlight: boolean;
    showHotel: boolean;
  }) => {
    const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
    const filtered = order.filter((id) => (id === "flight" && showFlight) || (id === "hotel" && showHotel) || id === "transfer");
    const handleDrop = (toIdx: number) => {
      if (draggedIdx === null) return;
      if (toIdx !== draggedIdx) {
        const next = [...filtered];
        const [removed] = next.splice(draggedIdx, 1);
        next.splice(toIdx, 0, removed);
        const hidden = order.filter((id) => !filtered.includes(id));
        setOrder([...next, ...hidden]);
      }
      setDraggedIdx(null);
      setDragOverIdx(null);
    };
    return (
      <div className="space-y-1">
        <p className="text-[10px] font-medium text-emerald-700">{label}</p>
        <div className="flex items-center gap-2 flex-wrap">
          {filtered.map((id, idx) => {
            const cfg = blockConfig[id];
            const Icon = cfg.icon;
            const isTransfer = cfg.isTransfer;
            return (
              <React.Fragment key={`${id}-${idx}`}>
                {idx > 0 && <span className="text-slate-400">→</span>}
                <div
                  draggable
                  onDragStart={() => setDraggedIdx(idx)}
                  onDragEnd={() => { setDraggedIdx(null); setDragOverIdx(null); }}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverIdx(idx); }}
                  onDragLeave={() => setDragOverIdx(null)}
                  onDrop={(e) => { e.preventDefault(); handleDrop(idx); }}
                  className={`inline-flex cursor-grab active:cursor-grabbing items-center gap-1.5 px-3 py-2 rounded-lg select-none touch-none ${
                    isTransfer ? "bg-emerald-100 border-2 border-emerald-500 shadow-sm ring-2 ring-emerald-200" : "bg-white border border-slate-200 shadow-sm"
                  } ${draggedIdx === idx ? "opacity-50" : ""} ${dragOverIdx === idx && draggedIdx !== idx ? "ring-2 ring-emerald-400 ring-offset-1" : ""}`}
                >
                  <Icon className={`w-4 h-4 ${isTransfer ? "text-emerald-700" : "text-slate-500"}`} />
                  <span className={`text-xs font-medium ${isTransfer ? "text-emerald-800" : "text-slate-700"}`}>{cfg.label}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  };
  const flightsSorted = useMemo(() => {
    return [...flightServices].sort((a, b) => {
      const dateA = a.flightSegments?.[0]?.departureDate || "";
      const dateB = b.flightSegments?.[0]?.departureDate || "";
      return dateA.localeCompare(dateB);
    });
  }, [flightServices]);

  // Flatten segments with flight ref, sort by departure date+time
  const { arrivalSegmentInfo, returnSegmentInfo } = useMemo(() => {
    type SegWithFlight = { segment: FlightSegment; flight: FlightServiceRef };
    const flat: SegWithFlight[] = [];
    for (const f of flightsSorted) {
      for (const seg of f.flightSegments || []) {
        flat.push({ segment: seg as FlightSegment, flight: f });
      }
    }
    flat.sort((a, b) => {
      const dA = `${a.segment.departureDate || ""}T${a.segment.departureTimeScheduled || ""}`;
      const dB = `${b.segment.departureDate || ""}T${b.segment.departureTimeScheduled || ""}`;
      return dA.localeCompare(dB);
    });

    // Destination = airport where we arrive then later depart (turnaround)
    const arrivedAt = new Set<string>();
    let destinationIata: string | null = null;
    for (const { segment } of flat) {
      const dep = (segment.departure || "").trim();
      if (dep && arrivedAt.has(dep)) {
        destinationIata = dep;
        break;
      }
      const arr = (segment.arrival || "").trim();
      if (arr) arrivedAt.add(arr);
    }

    let arrivalSegmentInfo: SegWithFlight | null = null;
    let returnSegmentInfo: SegWithFlight | null = null;

    if (flat.length === 1) {
      arrivalSegmentInfo = flat[0];
    } else if (destinationIata) {
      arrivalSegmentInfo = flat.find((x) => (x.segment.arrival || "").trim() === destinationIata) ?? null;
      returnSegmentInfo = flat.find((x) => (x.segment.departure || "").trim() === destinationIata) ?? null;
    } else {
      arrivalSegmentInfo = flat[0];
    }

    return { arrivalSegmentInfo, returnSegmentInfo };
  }, [flightsSorted]);

  const firstHotel = hotelServices[0];

  const handleAutoLink = () => {
    if (flightsSorted.length < 1 || !firstHotel) return;
    const hotelName = (firstHotel.hotelName || "").trim() || "Hotel";
    const routes: TransferRouteData[] = [];
    const baseRoute = { pickup: "", pickupType: "address" as const, dropoff: "", dropoffType: "address" as const };

    // Use segment-level logic: arrival segment = lands at destination, return segment = departs from destination
    const arrInfo = arrivalSegmentInfo;
    const retInfo = returnSegmentInfo;
    if (arrInfo) {
      const seg = arrInfo.segment;
      const segIdx = arrInfo.flight.flightSegments?.findIndex((x) => x === seg) ?? 0;
      const arrivalIata = (seg.arrival || "").trim();
      const flightWithSeg = { ...arrInfo.flight, flightSegments: [seg] };
      const pickupTime = suggestPickupTimeFromFlight(flightWithSeg, true);
      routes.push({
        ...baseRoute,
        id: crypto.randomUUID(),
        pickup: arrivalIata ? `${arrivalIata} Airport` : "Airport",
        pickupType: arrivalIata ? "airport" : "address",
        pickupMeta: arrivalIata ? { iata: arrivalIata } : undefined,
        dropoff: hotelName,
        dropoffType: "address",
        linkedFlightId: arrInfo.flight.id,
        linkedSegmentIndex: segIdx,
        pickupTime,
      });
    }
    if (retInfo && retInfo !== arrInfo) {
      const seg = retInfo.segment;
      const segIdx = retInfo.flight.flightSegments?.findIndex((x) => x === seg) ?? 0;
      const depIata = (seg.departure || "").trim();
      const flightWithSeg = { ...retInfo.flight, flightSegments: [seg] };
      const pickupTime = suggestPickupTimeFromFlight(flightWithSeg, false, undefined, true);
      routes.push({
        ...baseRoute,
        id: crypto.randomUUID(),
        pickup: hotelName,
        pickupType: "address",
        dropoff: depIata ? `${depIata} Airport` : "Airport",
        dropoffType: depIata ? "airport" : "address",
        dropoffMeta: depIata ? { iata: depIata } : undefined,
        linkedFlightId: retInfo.flight.id,
        linkedSegmentIndex: segIdx,
        pickupTime,
      });
    }
    if (routes.length > 0) {
      onApply(routes);
      onClose();
    }
  };

  const canAutoLink = flightsSorted.length >= 1 && firstHotel;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-emerald-600" />
            Linked Services
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Visual: where does this transfer sit relative to other services — draggable per route */}
          {(flightServices.length > 0 || hotelServices.length > 0) && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 space-y-3">
              <p className="text-xs font-medium text-emerald-800">Transfer position in itinerary</p>
              <p className="text-[10px] text-emerald-700">Drag blocks to reorder. Route 1: arrival flow. Route 2: return flow.</p>
              <DraggableRow
                order={route1Order}
                setOrder={setRoute1Order}
                label="Route 1"
                showFlight={flightServices.length > 0}
                showHotel={hotelServices.length > 0}
              />
              {!isOneWay && (
                <DraggableRow
                  order={route2Order}
                  setOrder={setRoute2Order}
                  label="Route 2"
                  showFlight={flightServices.length > 0}
                  showHotel={hotelServices.length > 0}
                />
              )}
            </div>
          )}
          {flightServices.length > 0 || hotelServices.length > 0 ? (
            <p className="text-sm text-gray-600">
              Link routes to flights so pickup times are suggested. Choose which route connects to which flight.
            </p>
          ) : (
            <p className="text-sm text-gray-500">
              No flights or hotels in this order yet. Add them first to link with transfer.
            </p>
          )}
          {canAutoLink && (
            <button
              type="button"
              onClick={handleAutoLink}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-emerald-400 bg-emerald-50 text-emerald-800 font-medium hover:bg-emerald-100 transition-colors"
            >
              <Hotel className="w-5 h-5" />
              Auto-link airport — hotel — airport
            </button>
          )}
          {flightServices.length > 0 ? (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                <Plane className="w-4 h-4" />
                Flights
              </h4>
              <div className="space-y-2">
                {arrivalSegmentInfo && (
                  <div className="p-3 rounded-lg border border-gray-200 bg-gray-50 text-sm">
                    <div className="text-[10px] font-semibold text-emerald-600 uppercase mb-1">Route 1 — arrival (pickup at airport)</div>
                    <div className="font-medium text-gray-900">
                      {`${arrivalSegmentInfo.segment.flightNumber || ""} ${arrivalSegmentInfo.segment.departure || ""}→${arrivalSegmentInfo.segment.arrival || ""}`.trim() || arrivalSegmentInfo.flight.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Dep: {formatDateShort(arrivalSegmentInfo.segment.departureDate || "")} {arrivalSegmentInfo.segment.departureTimeScheduled || ""} {arrivalSegmentInfo.segment.departure || ""}
                    </div>
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          const r = transferRoutes[0];
                          if (!r) return;
                          const route = transferRoutes.find((x) => x.id === r.id);
                          const flightWithSeg = { ...arrivalSegmentInfo.flight, flightSegments: [arrivalSegmentInfo.segment] };
                          const pickupTime = !route?.pickupTime ? suggestPickupTimeFromFlight(flightWithSeg, true, route?.durationMin) : route.pickupTime;
                          const hotelName = (firstHotel?.hotelName || "").trim() || "Hotel";
                          const arrIata = (arrivalSegmentInfo.segment.arrival || "").trim();
                          const segIdx = arrivalSegmentInfo.flight.flightSegments?.findIndex((x) => x === arrivalSegmentInfo.segment) ?? 0;
                          const updated = transferRoutes.map((rt) =>
                            rt.id === r.id
                              ? { ...rt, linkedFlightId: arrivalSegmentInfo.flight.id, linkedSegmentIndex: segIdx, pickupTime: pickupTime || rt.pickupTime, pickup: arrIata ? `${arrIata} Airport` : "Airport", pickupType: "airport" as const, pickupMeta: arrIata ? { iata: arrIata } : undefined, dropoff: hotelName, dropoffType: "address" as const }
                              : rt
                          );
                          onApply(updated);
                          suggestPickupTime(r.id, arrivalSegmentInfo.flight.id, segIdx);
                        }}
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          transferRoutes[0]?.linkedFlightId === arrivalSegmentInfo.flight.id
                            ? "bg-emerald-600 text-white"
                            : "bg-white border border-gray-300 text-gray-600 hover:border-emerald-400 hover:text-emerald-700"
                        }`}
                      >
                        Link Route 1
                      </button>
                    </div>
                  </div>
                )}
                {!isOneWay && returnSegmentInfo && transferRoutes[1] && (
                  <div className="p-3 rounded-lg border border-gray-200 bg-gray-50 text-sm">
                    <div className="text-[10px] font-semibold text-emerald-600 uppercase mb-1">Route 2 — return (dropoff at airport)</div>
                    <div className="font-medium text-gray-900">
                      {`${returnSegmentInfo.segment.flightNumber || ""} ${returnSegmentInfo.segment.departure || ""}→${returnSegmentInfo.segment.arrival || ""}`.trim() || returnSegmentInfo.flight.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Dep: {formatDateShort(returnSegmentInfo.segment.departureDate || "")} {returnSegmentInfo.segment.departureTimeScheduled || ""} {returnSegmentInfo.segment.departure || ""}
                    </div>
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          const r = transferRoutes[1];
                          if (!r) return;
                          const route = transferRoutes.find((x) => x.id === r.id);
                          const flightWithSeg = { ...returnSegmentInfo.flight, flightSegments: [returnSegmentInfo.segment] };
                          const pickupTime = !route?.pickupTime ? suggestPickupTimeFromFlight(flightWithSeg, false, route?.durationMin, true) : route.pickupTime;
                          const hotelName = (firstHotel?.hotelName || "").trim() || "Hotel";
                          const depIata = (returnSegmentInfo.segment.departure || "").trim();
                          const segIdx = returnSegmentInfo.flight.flightSegments?.findIndex((x) => x === returnSegmentInfo.segment) ?? 0;
                          const updated = transferRoutes.map((rt) =>
                            rt.id === r.id
                              ? { ...rt, linkedFlightId: returnSegmentInfo.flight.id, linkedSegmentIndex: segIdx, pickupTime: pickupTime || rt.pickupTime, pickup: hotelName, pickupType: "address" as const, dropoff: depIata ? `${depIata} Airport` : "Airport", dropoffType: "airport" as const, dropoffMeta: depIata ? { iata: depIata } : undefined }
                              : rt
                          );
                          onApply(updated);
                          suggestPickupTime(r.id, returnSegmentInfo.flight.id, segIdx);
                        }}
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          transferRoutes[1]?.linkedFlightId === returnSegmentInfo.flight.id
                            ? "bg-emerald-600 text-white"
                            : "bg-white border border-gray-300 text-gray-600 hover:border-emerald-400 hover:text-emerald-700"
                        }`}
                      >
                        Link Route 2
                      </button>
                    </div>
                  </div>
                )}
                {isOneWay && transferRoutes.length === 1 && (
                  <div className="p-3 rounded-lg border border-dashed border-emerald-300 bg-emerald-50/50 text-sm">
                    <button
                      type="button"
                      onClick={() => {
                        const r0 = transferRoutes[0];
                        const newRoute: TransferRouteData = {
                          id: crypto.randomUUID(),
                          pickup: r0?.dropoff || "",
                          pickupType: (r0?.dropoffType as "airport" | "hotel" | "address") || "address",
                          dropoff: r0?.pickup || "",
                          dropoffType: (r0?.pickupType as "airport" | "hotel" | "address") || "address",
                          pickupMeta: r0?.dropoffMeta,
                          dropoffMeta: r0?.pickupMeta,
                        };
                        onApply([...transferRoutes, newRoute]);
                      }}
                      className="w-full py-2 text-sm font-medium text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 rounded-lg transition-colors"
                    >
                      + Add Route 2
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No flights in this order. Add flights first to link with transfer.</p>
          )}
        </div>
        <div className="p-4 border-t bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
