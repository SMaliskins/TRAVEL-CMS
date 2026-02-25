"use client";

import { useMemo, useState } from "react";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import { getCityByName, countryCodeToFlag } from "@/lib/data/cities";
import { supabase } from "@/lib/supabaseClient";

interface OrderRouteSummaryProps {
  orderId: string;
  orderCode: string;
  clientDisplayName: string | null;
  countriesCities: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  orderType?: string;
  orderSource?: string; // TA/TO/CORP/NON
  onUpdate?: (updates: { order_type?: string; order_source?: string }) => void;
}

const ORDER_TYPES = [
  { value: "leisure", label: "Leisure" },
  { value: "business", label: "Business" },
  { value: "lifestyle", label: "Lifestyle" },
];

const ORDER_SOURCES = [
  { value: "TA", label: "TA" },
  { value: "TO", label: "TO" },
  { value: "CORP", label: "CORP" },
  { value: "NON", label: "NON" },
];

export default function OrderRouteSummary({
  orderId,
  orderCode,
  clientDisplayName,
  countriesCities,
  dateFrom,
  dateTo,
  orderType,
  orderSource,
  onUpdate,
}: OrderRouteSummaryProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  // Parse route - supports both new format (origin:|return:) and legacy (comma-separated)
  const parsedRoute = useMemo(() => {
    if (!countriesCities) return { origin: null, destinations: [], returnCity: null };

    // Check if new format with origin:/return:
    if (countriesCities.includes("origin:") || countriesCities.includes("|")) {
      let originCity: { name: string; countryCode?: string } | null = null;
      let returnCity: { name: string; countryCode?: string } | null = null;
      let destinations: { name: string; countryCode?: string }[] = [];
      
      const parts = countriesCities.split("|");
      for (const part of parts) {
        if (part.startsWith("origin:")) {
          const cityStr = part.replace("origin:", "").trim();
          const cityName = cityStr.split(",")[0]?.trim() || "";
          const cityData = getCityByName(cityName);
          if (cityData) {
            originCity = cityData;
          } else if (cityName) {
            originCity = { name: cityName };
          }
        } else if (part.startsWith("return:")) {
          const cityStr = part.replace("return:", "").trim();
          const cityName = cityStr.split(",")[0]?.trim() || "";
          const cityData = getCityByName(cityName);
          if (cityData) {
            returnCity = cityData;
          } else if (cityName) {
            returnCity = { name: cityName };
          }
        } else if (part.trim()) {
          // Destinations - split by semicolon
          destinations = part.split(";").map(item => {
            const cityName = item.trim().split(",")[0]?.trim() || "";
            const cityData = getCityByName(cityName);
            return cityData || (cityName ? { name: cityName } : null);
          }).filter(Boolean) as { name: string; countryCode?: string }[];
        }
      }
      
      return { origin: originCity, destinations, returnCity };
    }

    // Legacy format: comma-separated city names
    const cities = countriesCities.split(",").map((c) => c.trim());
    const origin = cities.length > 0 ? getCityByName(cities[0]) : null;
    const destinations = cities.slice(1).map((c) => getCityByName(c)).filter(Boolean);
    const returnCity = cities.length > 1 ? getCityByName(cities[cities.length - 1]) : null;

    return { origin, destinations, returnCity };
  }, [countriesCities]);

  // Unique destinations
  const uniqueDestinations = useMemo(() => {
    const seen = new Set<string>();
    return parsedRoute.destinations.filter((city) => {
      if (!city) return false;
      if (seen.has(city.name)) return false;
      seen.add(city.name);
      return true;
    });
  }, [parsedRoute.destinations]);

  // Calculate days/nights
  const daysAndNights = useMemo(() => {
    if (!dateFrom || !dateTo) return null;
    const days = Math.ceil((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const nights = Math.max(0, days - 1);
    const dayWord = days === 1 ? "day" : "days";
    const nightWord = nights === 1 ? "night" : "nights";
    return ` (${days} ${dayWord} / ${nights} ${nightWord})`;
  }, [dateFrom, dateTo]);

  // Calculate days until trip
  const daysUntilTrip = useMemo(() => {
    if (!dateFrom) return null;
    const tripDate = new Date(dateFrom);
    const today = new Date();
    const diff = Math.ceil((tripDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  }, [dateFrom]);

  // Handle order type change
  const handleOrderTypeChange = async (newType: string) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ order_type: newType })
        .eq("id", orderId);

      if (error) throw error;
      onUpdate?.({ order_type: newType });
    } catch (err) {
      console.error("Error updating order type:", err);
      alert("Failed to update order type");
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle order source change
  const handleOrderSourceChange = async (newSource: string) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ order_source: newSource })
        .eq("id", orderId);

      if (error) throw error;
      onUpdate?.({ order_source: newSource });
    } catch (err) {
      console.error("Error updating order source:", err);
      alert("Failed to update order source");
    } finally {
      setIsUpdating(false);
    }
  };

  if (!parsedRoute.origin && uniqueDestinations.length === 0 && !dateFrom) {
    return null;
  }

  return (
    <div className="mb-6 rounded-lg bg-white p-4 shadow-sm">
      <div className="flex items-center gap-4 flex-wrap">
        {/* Client Name */}
        {clientDisplayName && (
          <span className="text-lg font-bold text-gray-900">{clientDisplayName}</span>
        )}

        {/* Route */}
        {(parsedRoute.origin || uniqueDestinations.length > 0) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {parsedRoute.origin && (
              <>
                <span className="flex items-center gap-1 text-base font-semibold text-gray-900">
                  {parsedRoute.origin.countryCode && (
                    <span className="text-base mr-1">{countryCodeToFlag(parsedRoute.origin.countryCode)}</span>
                  )}
                  {parsedRoute.origin.name}
                </span>
                <span className="text-gray-400 text-sm">→</span>
              </>
            )}
            {uniqueDestinations.map((city, idx) => city && (
              <span key={`${city?.name || idx}-${idx}`} className="flex items-center">
                <span className="flex items-center gap-1 text-base font-semibold text-gray-900">
                  {city.countryCode && (
                    <span className="text-base mr-1">{countryCodeToFlag(city.countryCode)}</span>
                  )}
                  {city.name}
                </span>
                {(idx < uniqueDestinations.length - 1 || (parsedRoute.returnCity && parsedRoute.origin && parsedRoute.returnCity.name !== parsedRoute.origin.name)) && (
                  <span className="text-gray-400 text-sm mx-1">→</span>
                )}
              </span>
            ))}
            {parsedRoute.returnCity && parsedRoute.origin && parsedRoute.returnCity.name !== parsedRoute.origin.name && (
              <>
                <span className="text-gray-400 text-sm">→</span>
                <span className="flex items-center gap-1 text-base font-semibold text-gray-700">
                  {parsedRoute.returnCity.countryCode && (
                    <span className="text-base mr-1">{countryCodeToFlag(parsedRoute.returnCity.countryCode)}</span>
                  )}
                  {parsedRoute.returnCity.name}
                </span>
              </>
            )}
          </div>
        )}

        {/* Dates */}
        {(dateFrom || dateTo) && (
          <div className="flex items-center gap-2 pl-4 border-l border-gray-200">
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-medium text-gray-700">
              {dateFrom ? formatDateDDMMYYYY(dateFrom) : "—"} — {dateTo ? formatDateDDMMYYYY(dateTo) : "—"}{daysAndNights}
            </span>
            {daysUntilTrip !== null && daysUntilTrip >= 0 && (
              <span className="text-xs font-semibold text-gray-500 bg-gray-100/80 px-2 py-0.5 rounded-full">
                {daysUntilTrip} {daysUntilTrip === 1 ? 'day' : 'days'} before trip
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
