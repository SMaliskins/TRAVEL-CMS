"use client";

import { Star, MapPin, Bed, Utensils, ShieldCheck, ShieldX } from "lucide-react";
import { PriceComparisonStrip } from "./PriceComparisonStrip";
import type { AggregatedHotel } from "@/lib/providers/types";

interface HotelCardProps {
  hotel: AggregatedHotel;
  nights: number;
  onSelect: (hotel: AggregatedHotel) => void;
}

export function HotelCard({ hotel, nights, onSelect }: HotelCardProps) {
  const bestRate = hotel.rates.reduce(
    (best, r) => (r.totalPrice < best.totalPrice ? r : best),
    hotel.rates[0]
  );

  const hasFreeCancel = hotel.rates.some(
    (r) => r.cancellationType === "free"
  );
  const hasMultipleProviders = hotel.providers.length > 1;
  const topAmenities = hotel.amenities.slice(0, 4);

  return (
    <div
      onClick={() => onSelect(hotel)}
      className="booking-glass-panel flex flex-col sm:flex-row gap-4 cursor-pointer hover:shadow-lg transition-all group"
    >
      {/* Image */}
      <div className="w-full sm:w-48 h-40 rounded-xl overflow-hidden flex-shrink-0 relative bg-slate-100">
        {hotel.images.length > 0 ? (
          <img
            src={hotel.images[0]}
            alt={hotel.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <Bed className="w-8 h-8" />
          </div>
        )}
        {hotel.images.length > 1 && (
          <span className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
            1/{hotel.images.length}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-between min-w-0">
        {/* Top */}
        <div>
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-base text-slate-800 truncate">
              {hotel.name}
            </h3>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {hotel.reviewScore !== null && (
                <span className="bg-indigo-500 text-white text-xs font-bold px-2 py-0.5 rounded-md">
                  {hotel.reviewScore.toFixed(1)}
                </span>
              )}
              {hotel.reviewCount !== null && hotel.reviewCount > 0 && (
                <span className="text-[11px] text-slate-400">
                  ({hotel.reviewCount.toLocaleString()})
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <div className="flex">
              {Array.from({ length: hotel.starRating }).map((_, i) => (
                <Star
                  key={i}
                  className="w-3.5 h-3.5 fill-amber-400 text-amber-400"
                />
              ))}
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <MapPin className="w-3 h-3" />
              <span className="truncate">{hotel.address}</span>
            </div>
          </div>

          {topAmenities.length > 0 && (
            <div className="flex gap-1 flex-wrap mb-2">
              {topAmenities.map((a) => (
                <span
                  key={a}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500"
                >
                  {a}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Bottom */}
        <div className="flex items-end justify-between gap-4 mt-auto">
          <div className="space-y-1">
            {bestRate && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Bed className="w-3.5 h-3.5" />
                <span className="truncate max-w-[180px]">{bestRate.roomName}</span>
              </div>
            )}
            {bestRate && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Utensils className="w-3.5 h-3.5" />
                <span>{formatMealPlan(bestRate.mealPlan)}</span>
              </div>
            )}
            {hasFreeCancel ? (
              <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                Free cancellation
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[11px] text-red-500 font-medium">
                <ShieldX className="w-3.5 h-3.5" />
                Non-refundable
              </div>
            )}
          </div>

          <div className="text-right flex-shrink-0">
            <div className="text-xl font-bold text-slate-800">
              {hotel.currency} {hotel.bestPrice.toLocaleString()}
            </div>
            {nights > 1 && (
              <div className="text-[11px] text-slate-400">
                {hotel.currency}{" "}
                {Math.round(hotel.bestPrice / nights).toLocaleString()} / night
              </div>
            )}
            {hasMultipleProviders && (
              <div className="mt-1">
                <PriceComparisonStrip
                  rates={hotel.rates}
                  currency={hotel.currency}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatMealPlan(mp: string): string {
  const map: Record<string, string> = {
    room_only: "Room Only",
    breakfast: "Breakfast",
    half_board: "Half Board",
    full_board: "Full Board",
    all_inclusive: "All Inclusive",
  };
  return map[mp] ?? mp;
}
