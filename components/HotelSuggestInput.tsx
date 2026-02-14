"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { countryCodeToFlag } from "@/lib/data/cities";

interface RegionSuggestion {
  id: number | string;
  name: string;
  type?: string;
  country_code?: string;
}

interface HotelSuggestion {
  hid: number;
  name: string;
  region_id: number;
}

interface HotelContentSummary {
  address?: string;
  city?: string;
  country?: string;
}

export interface HotelDetails {
  name: string;
  hid?: number;
  address?: string;
  phone?: string;
  email?: string;
  /** Room categories from RateHawk room_groups */
  roomOptions?: string[];
  /** Meal types from RateHawk metapolicy_struct.meal */
  mealOptions?: string[];
}

interface HotelSuggestInputProps {
  value: string;
  onChange: (value: string) => void;
  onHotelSelected?: (details: HotelDetails) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

export default function HotelSuggestInput({
  value,
  onChange,
  onHotelSelected,
  placeholder = "Search hotel by name...",
  className = "",
  disabled = false,
}: HotelSuggestInputProps) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<HotelSuggestion[]>([]);
  const [regions, setRegions] = useState<RegionSuggestion[]>([]);
  const [hotelContents, setHotelContents] = useState<Record<number, HotelContentSummary>>({});
  const [loading, setLoading] = useState(false);
  const [fetchingContent, setFetchingContent] = useState(false);
  const [query, setQuery] = useState(value);
  const [ratehawkAvailable, setRatehawkAvailable] = useState<boolean | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentFetchIdRef = useRef(0);

  // Sync query with value when value changes externally
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q || q.trim().length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/ratehawk/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q.trim(), language: "en" }),
      });
      const json = await res.json();
      if (res.status === 503) {
        setRatehawkAvailable(false);
        setSuggestions([]);
        setRegions([]);
        setHotelContents({});
        return;
      }
      if (res.ok && json.data?.hotels) {
        setRatehawkAvailable(true);
        const hotels = json.data.hotels as HotelSuggestion[];
        setSuggestions(hotels);
        setRegions(Array.isArray(json.data.regions) ? json.data.regions : []);
        setHotelContents({});
        // Fetch hotel content for each hotel (address, city, country)
        if (hotels.length > 0) {
          contentFetchIdRef.current += 1;
          const fetchId = contentFetchIdRef.current;
          fetch("/api/ratehawk/hotel-content", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ hids: hotels.slice(0, 5).map((h) => h.hid), language: "en" }),
          })
            .then((r) => r.json())
            .then((j) => {
              if (fetchId !== contentFetchIdRef.current) return;
              if (j.data && Array.isArray(j.data)) {
                const map: Record<number, HotelContentSummary> = {};
                for (const h of j.data) {
                  const country = h.region?.country_code ?? undefined;
                  const city = h.region?.name;
                  map[h.hid] = {
                    address: h.address,
                    city,
                    country,
                  };
                }
                setHotelContents(map);
              }
            })
            .catch(() => {});
        }
      } else {
        setSuggestions([]);
        setRegions([]);
        setHotelContents({});
      }
    } catch {
      setSuggestions([]);
      setRegions([]);
      setHotelContents({});
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    onChange(v);
    setOpen(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(v);
      debounceRef.current = null;
    }, DEBOUNCE_MS);
  };

  const handleSelectHotel = async (hotel: HotelSuggestion) => {
    setOpen(false);
    onChange(hotel.name);
    setQuery(hotel.name);

    if (!onHotelSelected) return;

    setFetchingContent(true);
    try {
      const res = await fetch("/api/ratehawk/hotel-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hids: [hotel.hid], language: "en" }),
      });
      const json = await res.json();
      if (res.ok && json.data?.[0]) {
        const h = json.data[0];
        const roomOpts = h.room_groups?.map((rg: { name?: string }) => rg.name?.trim()).filter(Boolean) ?? [];
        const roomOptions = roomOpts.length ? [...new Set(roomOpts)] as string[] : undefined;
        const mealOptions = h.meal_types as string[] | undefined;
        onHotelSelected({
          name: h.name || hotel.name,
          hid: hotel.hid,
          address: h.address || undefined,
          phone: h.phone || undefined,
          email: h.email || undefined,
          roomOptions: roomOptions?.length ? roomOptions : undefined,
          mealOptions: mealOptions?.length ? mealOptions : undefined,
        });
      } else {
        onHotelSelected({ name: hotel.name, hid: hotel.hid });
      }
    } catch {
      onHotelSelected({ name: hotel.name, hid: hotel.hid });
    } finally {
      setFetchingContent(false);
    }
  };

  const handleFocus = () => {
    if (query.length >= MIN_QUERY_LENGTH && suggestions.length === 0 && !loading) {
      fetchSuggestions(query);
    }
    setOpen(true);
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full rounded-lg border border-amber-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white disabled:opacity-50 disabled:cursor-not-allowed pr-8"
        />
        {(loading || fetchingContent) && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <svg
              className="h-4 w-4 animate-spin text-amber-600"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        )}
      </div>

      {open && (query.length >= MIN_QUERY_LENGTH || suggestions.length > 0) && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-amber-200 rounded-lg shadow-lg max-h-[240px] overflow-y-auto">
          {loading ? (
            <div className="px-4 py-6 text-center text-sm text-amber-600">Searching...</div>
          ) : ratehawkAvailable === false ? (
            <div className="px-4 py-3 text-xs text-gray-500">
              RateHawk API not configured. Add RATEHAWK_KEY_ID and RATEHAWK_API_KEY to .env.local
            </div>
          ) : suggestions.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-500">
              {query.trim().length < MIN_QUERY_LENGTH
                ? "Type at least 2 characters to search"
                : "No hotels found"}
            </div>
          ) : (
            suggestions.map((hotel) => {
              const content = hotelContents[hotel.hid];
              const region = regions.find((r) => String(r.id) === String(hotel.region_id));
              const fallbackCountry = region?.country_code ?? null;
              const fallbackLocation =
                region?.name && fallbackCountry ? `${region.name}, ${fallbackCountry}` : region?.name || fallbackCountry;
              const parts: string[] = [];
              if (content?.address) parts.push(content.address);
              if (content?.city) parts.push(content.city);
              if (content?.country) parts.push(content.country);
              const locationLine =
                parts.length > 0 ? parts.join(", ") : fallbackLocation || null;
              const subtitle = locationLine ? `${locationLine} · ID: ${hotel.hid}` : `ID: ${hotel.hid}`;
              const rawCode = region?.country_code?.toUpperCase();
              const countryCode = rawCode?.length === 2 ? rawCode : undefined;
              return (
                <button
                  key={hotel.hid}
                  type="button"
                  onClick={() => handleSelectHotel(hotel)}
                  className="w-full px-3 py-2.5 text-left hover:bg-amber-50 flex flex-col gap-0.5 border-b border-amber-100 last:border-0"
                >
                  <span className="font-medium text-sm text-gray-900">{hotel.name}</span>
                  <span className="text-xs text-gray-500 flex items-center gap-1.5">
                    {locationLine && (
                      <svg className="h-3 w-3 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                    {countryCode && <span className="flex-shrink-0">{countryCodeToFlag(countryCode)}</span>}
                    {subtitle}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
