"use client";

import { useMemo } from "react";
import { ProviderBadge } from "./ProviderBadge";
import type { NormalizedRate, ProviderName } from "@/lib/providers/types";

interface PriceComparisonStripProps {
  rates: NormalizedRate[];
  currency: string;
}

interface ProviderPrice {
  provider: ProviderName;
  bestPrice: number;
}

export function PriceComparisonStrip({
  rates,
  currency,
}: PriceComparisonStripProps) {
  const providerPrices = useMemo(() => {
    const map = new Map<ProviderName, number>();
    for (const r of rates) {
      const existing = map.get(r.provider);
      if (existing === undefined || r.totalPrice < existing) {
        map.set(r.provider, r.totalPrice);
      }
    }
    const arr: ProviderPrice[] = [];
    map.forEach((bestPrice, provider) => arr.push({ provider, bestPrice }));
    arr.sort((a, b) => a.bestPrice - b.bestPrice);
    return arr;
  }, [rates]);

  if (providerPrices.length <= 1) return null;

  const cheapest = providerPrices[0];
  const secondCheapest = providerPrices[1];
  const savings = secondCheapest.bestPrice - cheapest.bestPrice;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {providerPrices.map((pp) => {
        const isBest = pp.provider === cheapest.provider;
        return (
          <div
            key={pp.provider}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-all
              ${isBest
                ? "bg-emerald-50 border border-emerald-200 ring-1 ring-emerald-300"
                : "bg-slate-50 border border-slate-200"}`}
          >
            <ProviderBadge provider={pp.provider} size="sm" />
            <span className={`font-semibold ${isBest ? "text-emerald-700" : "text-slate-700"}`}>
              {currency} {pp.bestPrice.toLocaleString()}
            </span>
            {isBest && (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                Best
              </span>
            )}
          </div>
        );
      })}
      {savings > 0 && (
        <span className="text-[11px] text-emerald-600 font-medium">
          Save {currency} {savings.toLocaleString()}
        </span>
      )}
    </div>
  );
}
