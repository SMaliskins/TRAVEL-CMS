"use client";

import { Bed, Utensils, Coffee, UtensilsCrossed, Gem, ShieldCheck, ShieldX } from "lucide-react";
import { ProviderBadge } from "./ProviderBadge";
import type { NormalizedRate, MealPlanType } from "@/lib/providers/types";

interface RoomRateRowProps {
  rate: NormalizedRate;
  nights: number;
  onSelect: (rate: NormalizedRate) => void;
}

const MEAL_ICONS: Record<MealPlanType, { icon: typeof Coffee; label: string }> = {
  room_only: { icon: Coffee, label: "Room Only" },
  breakfast: { icon: Coffee, label: "Breakfast" },
  half_board: { icon: Utensils, label: "Half Board" },
  full_board: { icon: UtensilsCrossed, label: "Full Board" },
  all_inclusive: { icon: Gem, label: "All Inclusive" },
  other: { icon: Utensils, label: "Other" },
};

export function RoomRateRow({ rate, nights, onSelect }: RoomRateRowProps) {
  const meal = MEAL_ICONS[rate.mealPlan] ?? MEAL_ICONS.other;
  const MealIcon = meal.icon;
  const isFree = rate.cancellationType === "free";

  return (
    <div className="grid grid-cols-[2fr_1fr_auto_auto_auto] gap-3 items-center px-4 py-3 bg-white/40 border border-white/80 rounded-lg hover:bg-white/90 hover:translate-x-1 transition-all cursor-pointer group">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Bed className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <span className="font-semibold text-sm text-slate-800 truncate">
            {rate.roomName}
          </span>
        </div>
        {rate.beddingType && (
          <span className="text-[11px] text-slate-500 ml-6">
            {rate.beddingType}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <MealIcon className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-xs text-slate-600">{meal.label}</span>
      </div>

      <ProviderBadge provider={rate.provider} />

      <div className="flex items-center gap-1">
        {isFree ? (
          <>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[11px] text-emerald-600 font-medium">
              Free cancellation
            </span>
          </>
        ) : (
          <>
            <ShieldX className="w-3.5 h-3.5 text-red-400" />
            <span className="text-[11px] text-red-500 font-medium">
              Non-refundable
            </span>
          </>
        )}
      </div>

      <div className="text-right flex flex-col items-end gap-0.5">
        <span className="text-lg font-bold text-slate-800">
          {rate.currency} {rate.totalPrice.toLocaleString()}
        </span>
        {nights > 1 && (
          <span className="text-[11px] text-slate-400">
            {rate.currency} {rate.pricePerNight.toLocaleString()} / night
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect(rate);
          }}
          className="mt-1 px-4 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-sm shadow-indigo-200 hover:shadow-md hover:shadow-indigo-300 hover:-translate-y-0.5 transition-all opacity-0 group-hover:opacity-100"
        >
          Select
        </button>
      </div>
    </div>
  );
}
