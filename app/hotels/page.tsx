"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Hotel,
  Search,
  Loader2,
  Star,
  MapPin,
  Users,
  CalendarDays,
  ChevronRight,
  AlertCircle,
  X,
  Utensils,
  BedDouble,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import "../hotels-booking/modern-booking.css";

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface HotelResult {
  hid: number;
  hotelName: string;
  address?: string | null;
  stars?: number | null;
  hotelImages?: string[];
  roomName?: string | null;
  beddingType?: string | null;
  meal?: string | null;
  ratehawkAmount: number;
  currency: string;
  tariffType: "refundable" | "non_refundable";
  freeCancellationBefore?: string | null;
  checkIn: string;
  checkOut: string;
  guests: number;
}

interface HotelGroup {
  hid: number;
  hotelName: string;
  address: string | null;
  stars: number | null;
  images: string[];
  minPrice: number;
  currency: string;
  rates: HotelResult[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().split("T")[0]; }
function tomorrowStr() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}
function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.max(1, Math.round(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000
  ));
}

function groupByHotel(rates: HotelResult[]): HotelGroup[] {
  const map = new Map<number, HotelGroup>();
  for (const r of rates) {
    if (!map.has(r.hid)) {
      map.set(r.hid, {
        hid: r.hid,
        hotelName: r.hotelName,
        address: r.address ?? null,
        stars: r.stars ?? null,
        images: r.hotelImages ?? [],
        minPrice: r.ratehawkAmount,
        currency: r.currency,
        rates: [],
      });
    }
    const g = map.get(r.hid)!;
    g.rates.push(r);
    if (r.ratehawkAmount < g.minPrice) g.minPrice = r.ratehawkAmount;
  }
  return Array.from(map.values()).sort((a, b) => a.minPrice - b.minPrice);
}

// ─── Stars Component ─────────────────────────────────────────────────────────

function Stars({ count }: { count: number | null }) {
  if (!count) return null;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} size={12} className="text-amber-400 fill-amber-400" />
      ))}
    </div>
  );
}

// ─── Hotel Card ───────────────────────────────────────────────────────────────

function HotelCard({
  group,
  nights,
}: {
  group: HotelGroup;
  nights: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const imgSrc = group.images[0] || null;
  const bestRate = group.rates[0];

  return (
    <div className="booking-glass-panel rounded-2xl overflow-hidden hover:shadow-lg transition-shadow">
      <div className="flex gap-0">
        {/* Image */}
        <div className="w-32 sm:w-44 shrink-0">
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={group.hotelName}
              className="w-full h-full object-cover"
              style={{ minHeight: 120 }}
            />
          ) : (
            <div className="w-full h-full min-h-[120px] bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center">
              <Hotel size={32} className="text-indigo-300" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-4 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 text-sm truncate">{group.hotelName}</h3>
              <Stars count={group.stars} />
              {group.address && (
                <div className="flex items-center gap-1 mt-1">
                  <MapPin size={11} className="text-gray-400 shrink-0" />
                  <span className="text-xs text-gray-400 truncate">{group.address}</span>
                </div>
              )}
            </div>

            {/* Price */}
            <div className="text-right shrink-0">
              <div className="text-xl font-bold text-gray-900">
                {group.minPrice.toLocaleString("de-DE", { minimumFractionDigits: 0 })}
                <span className="text-xs font-normal text-gray-500 ml-1">{group.currency}</span>
              </div>
              <div className="text-xs text-gray-400">{nights} night{nights !== 1 ? "s" : ""}</div>
              <div className="text-xs text-gray-400">
                ~{Math.round(group.minPrice / nights).toLocaleString()} / night
              </div>
            </div>
          </div>

          {/* Best rate info */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {bestRate.roomName && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <BedDouble size={11} /> {bestRate.roomName}
              </span>
            )}
            {bestRate.meal && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Utensils size={11} /> {bestRate.meal}
              </span>
            )}
            {bestRate.tariffType === "refundable" ? (
              <span className="flex items-center gap-1 text-xs text-emerald-600">
                <ShieldCheck size={11} /> Refundable
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-red-500">
                <ShieldX size={11} /> Non-refundable
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
            <button
              onClick={() => setExpanded((e) => !e)}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
            >
              {group.rates.length} rate{group.rates.length !== 1 ? "s" : ""}{" "}
              <ChevronRight
                size={14}
                className={`transition-transform ${expanded ? "rotate-90" : ""}`}
              />
            </button>
            <a
              href="/hotels-booking"
              className="booking-btn-primary text-xs px-3 py-1.5"
            >
              Book →
            </a>
          </div>
        </div>
      </div>

      {/* Expanded rates */}
      {expanded && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {group.rates.map((rate, idx) => (
            <div key={idx} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50/50 transition-colors">
              <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                {rate.roomName && <span><BedDouble size={11} className="inline mr-1" />{rate.roomName}</span>}
                {rate.meal && <span><Utensils size={11} className="inline mr-1" />{rate.meal}</span>}
                {rate.beddingType && <span>{rate.beddingType}</span>}
                {rate.tariffType === "refundable" ? (
                  <span className="text-emerald-600"><ShieldCheck size={11} className="inline mr-1" />Refundable</span>
                ) : (
                  <span className="text-red-500"><ShieldX size={11} className="inline mr-1" />Non-refundable</span>
                )}
              </div>
              <div className="text-sm font-semibold text-gray-900 shrink-0 ml-4">
                {rate.ratehawkAmount.toLocaleString("de-DE", { minimumFractionDigits: 0 })} {rate.currency}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HotelsPage() {
  const [destQuery, setDestQuery] = useState("");
  const [regionId, setRegionId] = useState<number | null>(null);
  const [regionName, setRegionName] = useState("");
  const [hotelSuggestions, setHotelSuggestions] = useState<HotelSuggestion[]>([]);
  const [regionSuggestions, setRegionSuggestions] = useState<RegionSuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);

  const [checkIn, setCheckIn] = useState(tomorrowStr());
  const [checkOut, setCheckOut] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 2);
    return d.toISOString().split("T")[0];
  });
  const [adults, setAdults] = useState(2);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<HotelGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setSuggestOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setRegionSuggestions([]); setHotelSuggestions([]); setSuggestOpen(false); return; }
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
    } catch { /* silent */ }
    setSuggestLoading(false);
  }, []);

  const handleDestChange = (q: string) => {
    setDestQuery(q);
    setRegionId(null);
    setRegionName("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(q), 300);
  };

  const handleSelectRegion = (r: RegionSuggestion) => {
    setRegionId(Number(r.id));
    setRegionName(r.name);
    setDestQuery(r.name);
    setSuggestOpen(false);
  };

  const handleSelectHotel = (h: HotelSuggestion) => {
    setRegionId(h.region_id);
    setRegionName(h.name);
    setDestQuery(h.name);
    setSuggestOpen(false);
  };

  const handleSearch = async () => {
    if (!regionId || !checkIn || !checkOut) {
      setError("Please select a destination and dates.");
      return;
    }
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/hotels/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ regionId, checkIn, checkOut, adults, currency: "EUR" }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.message || json.error || "Search failed");
      } else {
        const grouped = groupByHotel(json.data || []);
        setResults(grouped);
        setSearched(true);
        if (grouped.length === 0) setError("No hotels found for this destination and dates.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    }

    setLoading(false);
  };

  const nights = nightsBetween(checkIn, checkOut);

  return (
    <div className="booking-modern-container">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="booking-modern-header !mb-0">
          <div>
            <h1 className="booking-header-title">Hotel Search</h1>
            <p className="booking-header-subtitle mt-1">
              Quick price lookup via RateHawk
            </p>
          </div>
          <a
            href="/hotels-booking"
            className="booking-btn-primary flex items-center gap-2 text-sm"
          >
            <Hotel size={16} />
            Full Booking
          </a>
        </div>

        {/* Search Panel */}
        <div className="booking-glass-panel rounded-2xl p-6 space-y-4">
          {/* Destination */}
          <div ref={containerRef} className="relative">
            <label className="block text-xs font-medium text-gray-500 mb-1">Destination</label>
            <div className="relative">
              <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" />
              <input
                type="text"
                value={destQuery}
                onChange={(e) => handleDestChange(e.target.value)}
                onFocus={() => (regionSuggestions.length || hotelSuggestions.length) && setSuggestOpen(true)}
                placeholder="City, region or hotel name..."
                className="booking-input pl-9 pr-8 w-full"
              />
              {suggestLoading && (
                <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
              )}
              {regionId && !suggestLoading && (
                <button
                  onClick={() => { setRegionId(null); setRegionName(""); setDestQuery(""); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Suggestions dropdown */}
            {suggestOpen && (regionSuggestions.length > 0 || hotelSuggestions.length > 0) && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50 booking-glass-panel rounded-xl overflow-hidden shadow-xl max-h-64 overflow-y-auto">
                {regionSuggestions.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50/70">
                      Regions
                    </div>
                    {regionSuggestions.map((r) => (
                      <button
                        key={r.id}
                        onMouseDown={() => handleSelectRegion(r)}
                        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-indigo-50/70 transition-colors text-left"
                      >
                        <MapPin size={13} className="text-indigo-400 shrink-0" />
                        <span className="text-sm text-gray-900">{r.name}</span>
                        {r.country_code && (
                          <span className="ml-auto text-xs text-gray-400">{r.country_code}</span>
                        )}
                      </button>
                    ))}
                  </>
                )}
                {hotelSuggestions.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50/70">
                      Hotels
                    </div>
                    {hotelSuggestions.map((h) => (
                      <button
                        key={h.hid}
                        onMouseDown={() => handleSelectHotel(h)}
                        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-indigo-50/70 transition-colors text-left"
                      >
                        <Hotel size={13} className="text-indigo-400 shrink-0" />
                        <span className="text-sm text-gray-900">{h.name}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Dates & guests */}
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">Check-in</label>
              <div className="relative">
                <CalendarDays size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" />
                <input
                  type="date"
                  value={checkIn}
                  min={todayStr()}
                  onChange={(e) => setCheckIn(e.target.value)}
                  className="booking-input pl-9 w-full"
                />
              </div>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">Check-out</label>
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
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">Guests</label>
              <div className="flex items-center gap-2 booking-input">
                <Users size={14} className="text-indigo-400" />
                <button
                  onClick={() => setAdults(Math.max(1, adults - 1))}
                  className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium transition-colors flex items-center justify-center"
                >−</button>
                <span className="text-sm font-medium text-gray-800 w-4 text-center">{adults}</span>
                <button
                  onClick={() => setAdults(Math.min(8, adults + 1))}
                  className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium transition-colors flex items-center justify-center"
                >+</button>
                <span className="text-sm text-gray-500">adults</span>
              </div>
            </div>
          </div>

          {/* Search button */}
          <button
            onClick={handleSearch}
            disabled={loading || !regionId}
            className="booking-btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <><Loader2 size={18} className="animate-spin" /> Searching...</>
            ) : (
              <><Search size={18} /> Search Hotels</>
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {results.length} hotel{results.length !== 1 ? "s" : ""} found
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <CalendarDays size={12} />
                <span>{nights} night{nights !== 1 ? "s" : ""} · {adults} adult{adults !== 1 ? "s" : ""} · EUR</span>
              </div>
            </div>
            {results.map((g) => (
              <HotelCard key={g.hid} group={g} nights={nights} />
            ))}
          </div>
        )}

        {/* Initial state */}
        {!searched && !loading && (
          <div className="booking-glass-panel rounded-2xl p-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
              <Hotel size={32} className="text-indigo-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-1">Search for hotels</h3>
            <p className="text-sm text-gray-400">
              Enter a destination and dates to find available hotels via RateHawk.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
