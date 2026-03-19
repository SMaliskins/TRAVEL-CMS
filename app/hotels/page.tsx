"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Hotel,
  Search,
  Loader2,
  MapPin,
  Users,
  CalendarDays,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
  List,
  Map as MapIcon,
  Columns2,
  Info,
  Globe,
  Clock,
  Building2,
  Plane,
  Mountain,
  Navigation,
} from "lucide-react";
import { HotelCard } from "@/components/hotels/HotelCard";
import { HotelDetailPanel } from "@/components/hotels/HotelDetailPanel";
import { HotelFilters, INITIAL_FILTERS } from "@/components/hotels/HotelFilters";
import type { FilterState } from "@/components/hotels/HotelFilters";
import HotelMap from "@/components/hotels/HotelMap";
import { BookingWizard } from "@/components/hotels/BookingWizard";
import type {
  AggregatedHotel,
  NormalizedRate,
  ProviderName,
} from "@/lib/providers/types";
import "../hotels-booking/modern-booking.css";

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

const NATIONALITIES = [
  { code: "GB", label: "United Kingdom" },
  { code: "US", label: "United States" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "ES", label: "Spain" },
  { code: "IT", label: "Italy" },
  { code: "LV", label: "Latvia" },
  { code: "NL", label: "Netherlands" },
  { code: "AT", label: "Austria" },
  { code: "CH", label: "Switzerland" },
  { code: "SE", label: "Sweden" },
  { code: "NO", label: "Norway" },
  { code: "DK", label: "Denmark" },
  { code: "FI", label: "Finland" },
  { code: "PL", label: "Poland" },
  { code: "CZ", label: "Czech Republic" },
  { code: "PT", label: "Portugal" },
  { code: "BE", label: "Belgium" },
  { code: "IE", label: "Ireland" },
  { code: "RU", label: "Russia" },
  { code: "AU", label: "Australia" },
  { code: "CA", label: "Canada" },
  { code: "IN", label: "India" },
  { code: "CN", label: "China" },
  { code: "JP", label: "Japan" },
  { code: "AE", label: "UAE" },
] as const;

function countryCodeToFlag(code: string): string {
  if (!code || code.length !== 2) return "";
  const offset = 0x1f1e6;
  return String.fromCodePoint(
    code.charCodeAt(0) - 65 + offset,
    code.charCodeAt(1) - 65 + offset
  );
}

function getRegionIcon(type?: string) {
  switch (type?.toLowerCase()) {
    case "city":
      return Building2;
    case "airport":
      return Plane;
    case "mountain":
    case "island":
    case "nature":
      return Mountain;
    case "poi":
    case "landmark":
      return Navigation;
    default:
      return MapPin;
  }
}

function getRegionTypeBadge(type?: string): { label: string; className: string } | null {
  if (!type) return null;
  const map: Record<string, { label: string; className: string }> = {
    city: { label: "City", className: "bg-blue-50 text-blue-600" },
    region: { label: "Region", className: "bg-purple-50 text-purple-600" },
    airport: { label: "Airport", className: "bg-amber-50 text-amber-700" },
    poi: { label: "POI", className: "bg-emerald-50 text-emerald-600" },
    island: { label: "Island", className: "bg-cyan-50 text-cyan-600" },
  };
  return map[type.toLowerCase()] || { label: type, className: "bg-slate-50 text-slate-500" };
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-semibold text-indigo-600">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function dayAfterTomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return d.toISOString().split("T")[0];
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function nightsBetween(a: string, b: string): number {
  return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
}

function applyFilters(hotels: AggregatedHotel[], f: FilterState): AggregatedHotel[] {
  let out = hotels;

  if (f.stars.length > 0) {
    out = out.filter((h) => f.stars.includes(h.starRating));
  }

  if (f.mealPlans.length > 0) {
    out = out.filter((h) => h.rates.some((r) => f.mealPlans.includes(r.mealPlan)));
  }

  if (f.freeCancellationOnly) {
    out = out.filter((h) => h.rates.some((r) => r.cancellationType === "free"));
  }

  if (f.priceMin !== null) {
    out = out.filter((h) => h.bestPrice >= f.priceMin!);
  }
  if (f.priceMax !== null) {
    out = out.filter((h) => h.bestPrice <= f.priceMax!);
  }

  if (f.providers.length > 0) {
    out = out.filter((h) => h.providers.some((p) => f.providers.includes(p)));
  }

  switch (f.sortBy) {
    case "price_asc":
      out = [...out].sort((a, b) => a.bestPrice - b.bestPrice);
      break;
    case "price_desc":
      out = [...out].sort((a, b) => b.bestPrice - a.bestPrice);
      break;
    case "stars":
      out = [...out].sort((a, b) => b.starRating - a.starRating);
      break;
    case "review_score":
      out = [...out].sort((a, b) => (b.reviewScore ?? 0) - (a.reviewScore ?? 0));
      break;
  }

  return out;
}

function SkeletonCard() {
  return (
    <div className="booking-glass-panel flex flex-col sm:flex-row gap-4 animate-pulse">
      <div className="w-full sm:w-48 h-40 rounded-xl bg-slate-200" />
      <div className="flex-1 space-y-3 py-2">
        <div className="h-5 bg-slate-200 rounded w-3/4" />
        <div className="h-3 bg-slate-200 rounded w-1/2" />
        <div className="h-3 bg-slate-200 rounded w-1/3" />
        <div className="flex justify-between items-end mt-4">
          <div className="space-y-2">
            <div className="h-3 bg-slate-200 rounded w-24" />
            <div className="h-3 bg-slate-200 rounded w-20" />
          </div>
          <div className="h-7 bg-slate-200 rounded w-20" />
        </div>
      </div>
    </div>
  );
}

export default function HotelsPage() {
  const [destQuery, setDestQuery] = useState("");
  const [regionId, setRegionId] = useState<number | null>(null);
  const [cityCode, setCityCode] = useState("");
  const [checkIn, setCheckIn] = useState(tomorrowStr());
  const [checkOut, setCheckOut] = useState(dayAfterTomorrowStr());
  const [adults, setAdults] = useState(2);
  const [nationality, setNationality] = useState("GB");
  const [enabledProviders, setEnabledProviders] = useState<ProviderName[]>(["ratehawk", "goglobal"]);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AggregatedHotel[]>([]);
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [viewMode, setViewMode] = useState<"list" | "map" | "split">("split");
  const [errors, setErrors] = useState<{ provider: string; error: string }[]>([]);
  const [timing, setTiming] = useState<Record<string, number>>({});
  const [searched, setSearched] = useState(false);

  const [selectedHotel, setSelectedHotel] = useState<AggregatedHotel | null>(null);
  const [selectedRate, setSelectedRate] = useState<NormalizedRate | null>(null);
  const [bookingHotel, setBookingHotel] = useState<AggregatedHotel | null>(null);

  const [regionSuggestions, setRegionSuggestions] = useState<RegionSuggestion[]>([]);
  const [hotelSuggestions, setHotelSuggestions] = useState<HotelSuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [searchCollapsed, setSearchCollapsed] = useState(false);

  const suggestRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nights = nightsBetween(checkIn, checkOut);

  const filteredResults = useMemo(() => applyFilters(results, filters), [results, filters]);

  const availableProviders = useMemo<ProviderName[]>(() => {
    const set = new Set<ProviderName>();
    results.forEach((h) => h.providers.forEach((p) => set.add(p)));
    return Array.from(set);
  }, [results]);

  const totalRates = useMemo(() => results.reduce((s, h) => s + h.rates.length, 0), [results]);

  const mapHotels = useMemo(
    () =>
      filteredResults
        .filter((h) => h.latitude && h.longitude)
        .map((h) => ({
          lat: h.latitude,
          lng: h.longitude,
          name: h.name,
          price: h.bestPrice,
          currency: h.currency,
          id: h.id,
        })),
    [filteredResults]
  );

  const mapCenter = useMemo<[number, number] | undefined>(() => {
    if (mapHotels.length === 0) return undefined;
    const avgLat = mapHotels.reduce((s, h) => s + h.lat, 0) / mapHotels.length;
    const avgLng = mapHotels.reduce((s, h) => s + h.lng, 0) / mapHotels.length;
    return [avgLat, avgLng];
  }, [mapHotels]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!suggestRef.current?.contains(e.target as Node)) setSuggestOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    if (mq.matches) setViewMode("list");
  }, []);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) {
      setRegionSuggestions([]);
      setHotelSuggestions([]);
      setSuggestOpen(false);
      return;
    }
    setSuggestLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/ratehawk/suggest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ query: q, language: "en" }),
      });
      if (res.ok) {
        const json = await res.json();
        setRegionSuggestions(json.data?.regions || []);
        setHotelSuggestions(json.data?.hotels || []);
        setSuggestOpen(true);
      }
    } catch {
      /* silent */
    }
    setSuggestLoading(false);
  }, []);

  const handleDestChange = (q: string) => {
    setDestQuery(q);
    setRegionId(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(q), 300);
  };

  const handleSelectRegion = (r: RegionSuggestion) => {
    setRegionId(Number(r.id));
    setDestQuery(r.name);
    setSuggestOpen(false);
  };

  const handleSelectHotel = (h: HotelSuggestion) => {
    setRegionId(h.region_id);
    setDestQuery(h.name);
    setSuggestOpen(false);
  };

  const toggleProvider = (p: ProviderName) => {
    setEnabledProviders((prev) => {
      if (prev.includes(p)) {
        if (prev.length === 1) return prev;
        return prev.filter((x) => x !== p);
      }
      return [...prev, p];
    });
  };

  const handleSearch = async () => {
    if (!regionId && !cityCode) return;
    setLoading(true);
    setErrors([]);
    setResults([]);
    setFilters(INITIAL_FILTERS);
    setSelectedHotel(null);
    setTiming({});

    const startTime = Date.now();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/hotels/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          regionId,
          cityCode: cityCode ? Number(cityCode) : undefined,
          checkIn,
          checkOut,
          adults,
          nationality,
          providers: enabledProviders,
          currency: "EUR",
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setErrors([{ provider: "search", error: json.message || json.error || "Search failed" }]);
      } else {
        const hotels: AggregatedHotel[] = json.data || [];
        setResults(hotels);

        if (json.errors && Array.isArray(json.errors)) {
          setErrors(json.errors.map((e: { provider?: string; error?: string; message?: string }) => ({
            provider: e.provider || "unknown",
            error: e.error || e.message || "Unknown error",
          })));
        }

        if (json.timing && typeof json.timing === "object") {
          const t = json.timing;
          const flat: Record<string, number> = {};
          if (typeof t.totalMs === "number") flat.total = t.totalMs / 1000;
          if (t.perProvider && typeof t.perProvider === "object") {
            for (const [k, v] of Object.entries(t.perProvider)) {
              if (typeof v === "number") flat[k] = v / 1000;
            }
          }
          setTiming(flat);
        } else {
          const elapsed = (Date.now() - startTime) / 1000;
          setTiming({ total: elapsed });
        }
      }
    } catch (e) {
      setErrors([{ provider: "network", error: e instanceof Error ? e.message : "Network error" }]);
    }

    setSearched(true);
    setLoading(false);
    setSearchCollapsed(true);
  };

  const handleMapHotelClick = (id: string) => {
    const hotel = filteredResults.find((h) => h.id === id);
    if (hotel) setSelectedHotel(hotel);
  };

  const handleSelectRate = (rate: NormalizedRate) => {
    setSelectedRate(rate);
    setBookingHotel(selectedHotel);
    setSelectedHotel(null);
  };

  const handleBookingComplete = () => {
    setSelectedRate(null);
    setBookingHotel(null);
  };

  const dismissError = (idx: number) => {
    setErrors((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="booking-modern-container !p-4 md:!p-8">
      <div className="mx-auto max-w-[1600px] space-y-4">
        {/* ─── Header ─── */}
        <div className="booking-modern-header !mb-0">
          <div>
            <h1 className="booking-header-title">Hotel Search</h1>
            <p className="booking-header-subtitle mt-1">Search across multiple providers</p>
          </div>
          <a
            href="/hotels-booking"
            className="booking-btn-primary flex items-center gap-2 text-sm"
          >
            <Hotel size={16} />
            Full Booking
          </a>
        </div>

        {/* ─── Search Panel ─── */}
        <div className="booking-glass-panel rounded-2xl overflow-hidden">
          {searched && (
            <button
              onClick={() => setSearchCollapsed(!searchCollapsed)}
              className="w-full flex items-center justify-between px-6 py-3 text-sm text-slate-600 hover:bg-white/40 transition-colors"
            >
              <span className="font-medium">
                {destQuery} · {checkIn} → {checkOut} · {adults} adult{adults !== 1 ? "s" : ""}
              </span>
              {searchCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          )}

          <div
            className={`transition-all duration-300 ease-in-out overflow-hidden ${
              searchCollapsed ? "max-h-0 opacity-0" : "max-h-[800px] opacity-100"
            }`}
          >
            <div className="p-6 space-y-4">
              {/* Destination + City Code */}
              <div className="flex gap-3">
                <div ref={suggestRef} className="relative flex-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Destination</label>
                  <div className="relative">
                    <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" />
                    <input
                      type="text"
                      value={destQuery}
                      onChange={(e) => handleDestChange(e.target.value)}
                      onFocus={() =>
                        (regionSuggestions.length || hotelSuggestions.length) && setSuggestOpen(true)
                      }
                      placeholder="City, region or hotel name..."
                      className="booking-input pl-9 pr-8 w-full"
                    />
                    {suggestLoading && (
                      <Loader2
                        size={14}
                        className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
                      />
                    )}
                    {regionId && !suggestLoading && (
                      <button
                        onClick={() => {
                          setRegionId(null);
                          setDestQuery("");
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {suggestOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-2xl overflow-hidden shadow-2xl border border-slate-200/80 bg-white/95 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                      {suggestLoading && regionSuggestions.length === 0 && hotelSuggestions.length === 0 ? (
                        <div className="p-4 space-y-3">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-3 animate-pulse">
                              <div className="w-9 h-9 rounded-xl bg-slate-100" />
                              <div className="flex-1 space-y-1.5">
                                <div className="h-3.5 bg-slate-100 rounded-md w-3/4" />
                                <div className="h-2.5 bg-slate-50 rounded-md w-1/2" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : regionSuggestions.length === 0 && hotelSuggestions.length === 0 ? (
                        <div className="px-5 py-6 text-center">
                          <Search size={20} className="mx-auto text-slate-300 mb-2" />
                          <p className="text-sm text-slate-400">No results for &ldquo;{destQuery}&rdquo;</p>
                          <p className="text-xs text-slate-300 mt-1">Try a different city or hotel name</p>
                        </div>
                      ) : (
                        <div className="max-h-[360px] overflow-y-auto overscroll-contain">
                          {regionSuggestions.length > 0 && (
                            <div className="py-1.5">
                              <div className="flex items-center justify-between px-4 py-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.08em]">
                                  Destinations
                                </span>
                                <span className="text-[10px] text-slate-300 font-medium">
                                  {regionSuggestions.length}
                                </span>
                              </div>
                              {regionSuggestions.map((r) => {
                                const Icon = getRegionIcon(r.type);
                                const badge = getRegionTypeBadge(r.type);
                                const flag = r.country_code ? countryCodeToFlag(r.country_code.toUpperCase()) : "";
                                return (
                                  <button
                                    key={r.id}
                                    onMouseDown={() => handleSelectRegion(r)}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50/60 active:bg-indigo-100/60 transition-all text-left group"
                                  >
                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100/60 flex items-center justify-center shrink-0 group-hover:from-indigo-100 group-hover:to-blue-100 transition-colors">
                                      <Icon size={16} className="text-indigo-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-slate-800 truncate">
                                          {highlightMatch(r.name, destQuery)}
                                        </span>
                                        {badge && (
                                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider shrink-0 ${badge.className}`}>
                                            {badge.label}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {flag && (
                                      <span className="text-base shrink-0 ml-1" title={r.country_code}>
                                        {flag}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {regionSuggestions.length > 0 && hotelSuggestions.length > 0 && (
                            <div className="mx-4 border-t border-slate-100" />
                          )}

                          {hotelSuggestions.length > 0 && (
                            <div className="py-1.5">
                              <div className="flex items-center justify-between px-4 py-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.08em]">
                                  Hotels
                                </span>
                                <span className="text-[10px] text-slate-300 font-medium">
                                  {hotelSuggestions.length}
                                </span>
                              </div>
                              {hotelSuggestions.map((h) => (
                                <button
                                  key={h.hid}
                                  onMouseDown={() => handleSelectHotel(h)}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-amber-50/50 active:bg-amber-100/50 transition-all text-left group"
                                >
                                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100/60 flex items-center justify-center shrink-0 group-hover:from-amber-100 group-hover:to-orange-100 transition-colors">
                                    <Hotel size={16} className="text-amber-600" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <span className="text-sm font-medium text-slate-800 truncate block">
                                      {highlightMatch(h.name, destQuery)}
                                    </span>
                                    <span className="text-[11px] text-slate-400">
                                      Property
                                    </span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="w-28 shrink-0">
                  <label className="flex items-center gap-1 text-xs font-medium text-slate-500 mb-1">
                    City Code
                    <span className="relative group">
                      <Info size={12} className="text-slate-400 cursor-help" />
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-[10px] text-white bg-slate-800 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        Required for GoGlobal provider
                      </span>
                    </span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={cityCode}
                    onChange={(e) => setCityCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="e.g. 75"
                    className="booking-input w-full"
                  />
                </div>
              </div>

              {/* Dates + Guests + Nationality */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Check-in</label>
                  <div className="relative">
                    <CalendarDays size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" />
                    <input
                      type="date"
                      value={checkIn}
                      min={todayStr()}
                      onChange={(e) => {
                        setCheckIn(e.target.value);
                        if (e.target.value >= checkOut) {
                          const next = new Date(e.target.value);
                          next.setDate(next.getDate() + 1);
                          setCheckOut(next.toISOString().split("T")[0]);
                        }
                      }}
                      className="booking-input pl-9 w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Check-out</label>
                  <div className="relative">
                    <CalendarDays size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" />
                    <input
                      type="date"
                      value={checkOut}
                      min={checkIn}
                      onChange={(e) => setCheckOut(e.target.value)}
                      className="booking-input pl-9 w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Guests</label>
                  <div className="flex items-center gap-2 booking-input">
                    <Users size={14} className="text-indigo-400 shrink-0" />
                    <button
                      onClick={() => setAdults(Math.max(1, adults - 1))}
                      className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium transition-colors flex items-center justify-center"
                    >
                      −
                    </button>
                    <span className="text-sm font-semibold text-slate-800 w-5 text-center">{adults}</span>
                    <button
                      onClick={() => setAdults(Math.min(8, adults + 1))}
                      className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium transition-colors flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Nationality</label>
                  <div className="relative">
                    <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" />
                    <select
                      value={nationality}
                      onChange={(e) => setNationality(e.target.value)}
                      className="booking-input pl-9 w-full appearance-none cursor-pointer"
                    >
                      {NATIONALITIES.map((n) => (
                        <option key={n.code} value={n.code}>
                          {n.code} — {n.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Provider Toggles */}
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-xs font-medium text-slate-500">Providers:</span>
                {(["ratehawk", "goglobal"] as ProviderName[]).map((p) => {
                  const labels: Record<string, string> = { ratehawk: "RateHawk", goglobal: "GoGlobal" };
                  const isOn = enabledProviders.includes(p);
                  return (
                    <label key={p} className="flex items-center gap-2 cursor-pointer select-none">
                      <div
                        className={`relative w-9 h-5 rounded-full transition-colors ${
                          isOn ? "bg-indigo-500" : "bg-slate-200"
                        }`}
                        onClick={() => toggleProvider(p)}
                      >
                        <div
                          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                            isOn ? "translate-x-4" : ""
                          }`}
                        />
                      </div>
                      <span className="text-sm text-slate-700">{labels[p]}</span>
                    </label>
                  );
                })}
              </div>

              {/* Search Button */}
              <button
                onClick={handleSearch}
                disabled={loading || (!regionId && !cityCode)}
                className="booking-btn-primary w-full py-3.5 text-base flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" /> Searching…
                  </>
                ) : (
                  <>
                    <Search size={20} /> Search Hotels
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ─── Provider Errors ─── */}
        {errors.length > 0 && (
          <div className="space-y-2">
            {errors.map((err, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-xl text-sm"
              >
                <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <span className="text-red-700 flex-1">
                  <strong className="capitalize">{err.provider}:</strong> {err.error}
                </span>
                <button
                  onClick={() => dismissError(idx)}
                  className="text-red-400 hover:text-red-600 shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ─── Provider Timing ─── */}
        {Object.keys(timing).length > 0 && searched && !loading && (
          <div className="flex flex-wrap items-center gap-2">
            {Object.entries(timing).map(([provider, ms]) => (
              <span
                key={provider}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-[11px] text-slate-500 font-medium"
              >
                <Clock size={11} />
                <span className="capitalize">{provider}</span>: {typeof ms === "number" ? `${ms.toFixed(1)}s` : ms}
              </span>
            ))}
          </div>
        )}

        {/* ─── Loading State ─── */}
        {loading && (
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {/* ─── Results Area ─── */}
        {searched && !loading && results.length > 0 && (
          <>
            {/* Filter Bar */}
            <HotelFilters
              filters={filters}
              onFiltersChange={setFilters}
              availableProviders={availableProviders}
            />

            {/* Results Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-sm text-slate-600">
                <span className="font-semibold text-slate-800 text-lg">{filteredResults.length}</span>{" "}
                hotel{filteredResults.length !== 1 ? "s" : ""} found
                <span className="text-slate-400 mx-1.5">·</span>
                {availableProviders.length} provider{availableProviders.length !== 1 ? "s" : ""}
                <span className="text-slate-400 mx-1.5">·</span>
                {totalRates} rate{totalRates !== 1 ? "s" : ""}
                <span className="text-slate-400 mx-1.5">·</span>
                {nights} night{nights !== 1 ? "s" : ""}
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center p-0.5 rounded-lg bg-white/70 border border-slate-200 shadow-sm">
                {([
                  { mode: "list" as const, icon: List, label: "List" },
                  { mode: "split" as const, icon: Columns2, label: "Split" },
                  { mode: "map" as const, icon: MapIcon, label: "Map" },
                ] as const).map(({ mode, icon: Icon, label }) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      viewMode === mode
                        ? "bg-indigo-500 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <Icon size={14} />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Content by View Mode */}
            {viewMode === "list" && (
              <div className="space-y-3">
                {filteredResults.map((hotel) => (
                  <HotelCard
                    key={hotel.id}
                    hotel={hotel}
                    nights={nights}
                    onSelect={setSelectedHotel}
                  />
                ))}
              </div>
            )}

            {viewMode === "map" && (
              <div className="h-[calc(100vh-220px)] rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                <HotelMap
                  hotels={mapHotels}
                  onHotelClick={handleMapHotelClick}
                  center={mapCenter}
                />
              </div>
            )}

            {viewMode === "split" && (
              <div className="flex gap-4 items-start">
                <div className="flex-[3] space-y-3 min-w-0">
                  {filteredResults.map((hotel) => (
                    <HotelCard
                      key={hotel.id}
                      hotel={hotel}
                      nights={nights}
                      onSelect={setSelectedHotel}
                    />
                  ))}
                </div>
                <div className="flex-[2] hidden md:block sticky top-4 h-[calc(100vh-180px)] rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                  <HotelMap
                    hotels={mapHotels}
                    onHotelClick={handleMapHotelClick}
                    center={mapCenter}
                  />
                </div>
              </div>
            )}

            {filteredResults.length === 0 && results.length > 0 && (
              <div className="booking-glass-panel rounded-2xl p-10 text-center">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
                  <Search size={28} className="text-amber-400" />
                </div>
                <h3 className="text-base font-semibold text-slate-700 mb-1">No matching hotels</h3>
                <p className="text-sm text-slate-400">
                  Try adjusting your filters to see more results.
                </p>
              </div>
            )}
          </>
        )}

        {/* ─── Empty State after search ─── */}
        {searched && !loading && results.length === 0 && errors.length === 0 && (
          <div className="booking-glass-panel rounded-2xl p-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
              <Search size={32} className="text-slate-300" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-1">No hotels found</h3>
            <p className="text-sm text-slate-400">
              Try different dates, destination, or expand your provider selection.
            </p>
          </div>
        )}

        {/* ─── Initial State ─── */}
        {!searched && !loading && (
          <div className="booking-glass-panel rounded-2xl p-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
              <Hotel size={32} className="text-indigo-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-1">Search for hotels</h3>
            <p className="text-sm text-slate-400">
              Enter a destination and dates to find the best available rates across providers.
            </p>
          </div>
        )}
      </div>

      {/* ─── Detail Panel ─── */}
      {selectedHotel && (
        <HotelDetailPanel
          hotel={selectedHotel}
          nights={nights}
          checkIn={checkIn}
          checkOut={checkOut}
          onClose={() => setSelectedHotel(null)}
          onSelectRate={handleSelectRate}
        />
      )}

      {/* ─── Booking Wizard ─── */}
      {selectedRate && bookingHotel && (
        <BookingWizard
          rate={selectedRate}
          hotel={bookingHotel}
          checkIn={checkIn}
          checkOut={checkOut}
          onComplete={handleBookingComplete}
          onCancel={() => {
            setSelectedRate(null);
            setBookingHotel(null);
          }}
        />
      )}
    </div>
  );
}
