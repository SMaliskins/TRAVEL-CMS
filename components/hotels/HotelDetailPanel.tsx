"use client";

import { useEffect, useMemo } from "react";
import {
  X,
  Star,
  MapPin,
  Clock,
  Wifi,
  Car,
  Waves,
  Dumbbell,
  UtensilsCrossed,
  Sparkles,
} from "lucide-react";
import { ImageGallery } from "./ImageGallery";
import { RoomRateRow } from "./RoomRateRow";
import { CancellationTimeline } from "./CancellationTimeline";
import type { AggregatedHotel, NormalizedRate } from "@/lib/providers/types";
import dynamic from "next/dynamic";

const HotelMapInner = dynamic(() => import("./HotelMapInner"), { ssr: false });

interface HotelDetailPanelProps {
  hotel: AggregatedHotel;
  nights: number;
  checkIn: string;
  checkOut: string;
  onClose: () => void;
  onSelectRate: (rate: NormalizedRate) => void;
}

const AMENITY_ICONS: Record<string, typeof Wifi> = {
  wifi: Wifi,
  "free wifi": Wifi,
  parking: Car,
  "free parking": Car,
  pool: Waves,
  "swimming pool": Waves,
  gym: Dumbbell,
  fitness: Dumbbell,
  restaurant: UtensilsCrossed,
  spa: Sparkles,
};

export function HotelDetailPanel({
  hotel,
  nights,
  checkIn,
  checkOut,
  onClose,
  onSelectRate,
}: HotelDetailPanelProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handler);
    };
  }, [onClose]);

  const groupedRates = useMemo(() => {
    const map = new Map<string, NormalizedRate[]>();
    for (const r of hotel.rates) {
      const key = r.roomType || r.roomName;
      const group = map.get(key) ?? [];
      group.push(r);
      map.set(key, group);
    }
    return Array.from(map.entries());
  }, [hotel.rates]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full md:w-[70%] bg-white/95 backdrop-blur-xl shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white/90 backdrop-blur-md border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{hotel.name}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="flex">
                {Array.from({ length: hotel.starRating }).map((_, i) => (
                  <Star
                    key={i}
                    className="w-3.5 h-3.5 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>
              {hotel.reviewScore !== null && (
                <span className="bg-indigo-500 text-white text-xs font-bold px-2 py-0.5 rounded-md">
                  {hotel.reviewScore.toFixed(1)}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Gallery */}
          <ImageGallery images={hotel.images} hotelName={hotel.name} />

          {/* Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-sm text-slate-600">
                <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                <span>
                  {hotel.address}, {hotel.city}, {hotel.country}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-600">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>Check-in: {checkIn}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>Check-out: {checkOut}</span>
                </div>
              </div>
            </div>

            {/* Amenities grid */}
            {hotel.amenities.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {hotel.amenities.map((a) => {
                  const IconComp =
                    AMENITY_ICONS[a.toLowerCase()] ?? Sparkles;
                  return (
                    <div
                      key={a}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 text-xs text-slate-600"
                    >
                      <IconComp className="w-3.5 h-3.5 text-slate-400" />
                      {a}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Map */}
          <div className="h-48 rounded-xl overflow-hidden border border-slate-200">
            <HotelMapInner
              hotels={[
                {
                  id: hotel.id,
                  lat: hotel.latitude,
                  lng: hotel.longitude,
                  name: hotel.name,
                  price: hotel.bestPrice,
                  currency: hotel.currency,
                },
              ]}
              onHotelClick={() => {}}
              center={[hotel.latitude, hotel.longitude]}
            />
          </div>

          {/* Rates */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-800">
              Available Rooms
            </h3>
            {groupedRates.map(([roomType, rates]) => (
              <div key={roomType} className="space-y-1.5">
                <h4 className="text-sm font-semibold text-slate-700 pl-1">
                  {roomType}
                </h4>
                {rates.map((rate) => (
                  <RoomRateRow
                    key={rate.rateId}
                    rate={rate}
                    nights={nights}
                    onSelect={onSelectRate}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Cancellation timeline for cheapest free-cancel rate */}
          {hotel.rates.some((r) => r.cancellationType !== "non_refundable") && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-700">
                Cancellation Policy
              </h3>
              {(() => {
                const sampleRate = hotel.rates.find(
                  (r) => r.cancellationType !== "non_refundable"
                );
                if (!sampleRate) return null;
                return (
                  <CancellationTimeline
                    cancellationType={sampleRate.cancellationType}
                    freeCancellationBefore={sampleRate.freeCancellationBefore}
                    policies={sampleRate.cancellationPolicies}
                    checkIn={checkIn}
                  />
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
