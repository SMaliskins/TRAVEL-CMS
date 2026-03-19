"use client";

import { useState, useCallback } from "react";
import {
  Star,
  X,
  ChevronDown,
  SlidersHorizontal,
  ShieldCheck,
} from "lucide-react";
import type { ProviderName } from "@/lib/providers/types";

export interface FilterState {
  stars: number[];
  mealPlans: string[];
  freeCancellationOnly: boolean;
  priceMin: number | null;
  priceMax: number | null;
  providers: ProviderName[];
  sortBy:
    | "price_asc"
    | "price_desc"
    | "stars"
    | "review_score";
}

export const INITIAL_FILTERS: FilterState = {
  stars: [],
  mealPlans: [],
  freeCancellationOnly: false,
  priceMin: null,
  priceMax: null,
  providers: [],
  sortBy: "price_asc",
};

const MEAL_OPTIONS = [
  { value: "room_only", label: "Room Only" },
  { value: "breakfast", label: "Breakfast" },
  { value: "half_board", label: "Half Board" },
  { value: "full_board", label: "Full Board" },
  { value: "all_inclusive", label: "All Inclusive" },
] as const;

const SORT_OPTIONS = [
  { value: "price_asc", label: "Price: low → high" },
  { value: "price_desc", label: "Price: high → low" },
  { value: "stars", label: "Star rating" },
  { value: "review_score", label: "Review score" },
] as const;

interface HotelFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  availableProviders: ProviderName[];
}

export function HotelFilters({
  filters,
  onFiltersChange,
  availableProviders,
}: HotelFiltersProps) {
  const [showSort, setShowSort] = useState(false);

  const update = useCallback(
    (patch: Partial<FilterState>) =>
      onFiltersChange({ ...filters, ...patch }),
    [filters, onFiltersChange]
  );

  const toggleStar = (s: number) => {
    const stars = filters.stars.includes(s)
      ? filters.stars.filter((v) => v !== s)
      : [...filters.stars, s];
    update({ stars });
  };

  const toggleMeal = (m: string) => {
    const mealPlans = filters.mealPlans.includes(m)
      ? filters.mealPlans.filter((v) => v !== m)
      : [...filters.mealPlans, m];
    update({ mealPlans });
  };

  const toggleProvider = (p: ProviderName) => {
    const providers = filters.providers.includes(p)
      ? filters.providers.filter((v) => v !== p)
      : [...filters.providers, p];
    update({ providers });
  };

  const hasActiveFilters =
    filters.stars.length > 0 ||
    filters.mealPlans.length > 0 ||
    filters.freeCancellationOnly ||
    filters.priceMin !== null ||
    filters.priceMax !== null ||
    filters.providers.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2.5 p-3 rounded-xl bg-white/70 backdrop-blur-md border border-white/80 shadow-sm">
      <div className="flex items-center gap-1 mr-1">
        <SlidersHorizontal className="w-4 h-4 text-slate-400" />
      </div>

      {/* Star rating */}
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            onClick={() => toggleStar(s)}
            className={`p-1.5 rounded-lg transition-all text-xs font-medium
              ${filters.stars.includes(s)
                ? "bg-amber-100 text-amber-700"
                : "bg-slate-50 text-slate-400 hover:bg-slate-100"}`}
          >
            <Star
              className={`w-3.5 h-3.5 ${filters.stars.includes(s) ? "fill-amber-400" : ""}`}
            />
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-slate-200" />

      {/* Meal plans */}
      <div className="flex gap-1 flex-wrap">
        {MEAL_OPTIONS.map((m) => (
          <button
            key={m.value}
            onClick={() => toggleMeal(m.value)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all
              ${filters.mealPlans.includes(m.value)
                ? "bg-indigo-100 text-indigo-700"
                : "bg-slate-50 text-slate-500 hover:bg-slate-100"}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-slate-200" />

      {/* Free cancellation */}
      <button
        onClick={() =>
          update({ freeCancellationOnly: !filters.freeCancellationOnly })
        }
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all
          ${filters.freeCancellationOnly
            ? "bg-emerald-100 text-emerald-700"
            : "bg-slate-50 text-slate-500 hover:bg-slate-100"}`}
      >
        <ShieldCheck className="w-3.5 h-3.5" />
        Free cancellation
      </button>

      <div className="w-px h-6 bg-slate-200" />

      {/* Price range */}
      <div className="flex items-center gap-1">
        <input
          type="number"
          placeholder="Min"
          value={filters.priceMin ?? ""}
          onChange={(e) =>
            update({
              priceMin: e.target.value ? Number(e.target.value) : null,
            })
          }
          className="w-20 px-2 py-1 text-xs rounded-lg border border-slate-200 bg-white/60 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
        />
        <span className="text-slate-400 text-xs">–</span>
        <input
          type="number"
          placeholder="Max"
          value={filters.priceMax ?? ""}
          onChange={(e) =>
            update({
              priceMax: e.target.value ? Number(e.target.value) : null,
            })
          }
          className="w-20 px-2 py-1 text-xs rounded-lg border border-slate-200 bg-white/60 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
        />
      </div>

      <div className="w-px h-6 bg-slate-200" />

      {/* Providers */}
      <div className="flex gap-1">
        {availableProviders.map((p) => {
          const labelMap: Record<string, string> = {
            ratehawk: "RateHawk",
            goglobal: "GoGlobal",
            booking: "Booking",
          };
          return (
            <button
              key={p}
              onClick={() => toggleProvider(p)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all
                ${filters.providers.includes(p)
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-slate-50 text-slate-500 hover:bg-slate-100"}`}
            >
              {labelMap[p] ?? p}
            </button>
          );
        })}
      </div>

      <div className="w-px h-6 bg-slate-200" />

      {/* Sort dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowSort(!showSort)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 text-xs text-slate-600 hover:bg-slate-100 transition-all"
        >
          {SORT_OPTIONS.find((o) => o.value === filters.sortBy)?.label}
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        {showSort && (
          <div className="absolute top-full mt-1 right-0 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20 min-w-[160px]">
            {SORT_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => {
                  update({ sortBy: o.value as FilterState["sortBy"] });
                  setShowSort(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 transition-colors
                  ${filters.sortBy === o.value ? "text-indigo-600 font-medium" : "text-slate-600"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Clear all */}
      {hasActiveFilters && (
        <button
          onClick={() => onFiltersChange(INITIAL_FILTERS)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium text-red-500 bg-red-50 hover:bg-red-100 transition-all ml-auto"
        >
          <X className="w-3 h-3" />
          Clear all
        </button>
      )}
    </div>
  );
}
