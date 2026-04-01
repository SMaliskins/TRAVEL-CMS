"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Hotel,
  Search,
  Send,
  Loader2,
  CreditCard,
  FileText,
  RefreshCw,
  MapPin,
  Star,
  Users,
  Percent,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  Info,
} from "lucide-react";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import DateRangePicker from "@/components/DateRangePicker";
import "./modern-booking.css"; // Injecting the new premium design system

type Tab = "search" | "logs" | "bookings";

interface RegionSuggestion {
  id: number | string;
  name: string;
  type?: string;
  country_code?: string;
  hid?: number;
}

interface HotelSuggestion {
  hid: number;
  name: string;
  region_id: number;
}

interface CancellationPenalty {
  from: string;
  amount: string;
  currency: string;
}

interface HotelSearchItem {
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
  cancellationPenalties?: CancellationPenalty[];
  checkIn: string;
  checkOut: string;
  guests: number;
  bookHash?: string | null;
  matchHash?: string | null;
  searchHash?: string | null;
}

interface HotelGroup {
  hid: number;
  hotelName: string;
  address: string | null;
  stars: number | null;
  images: string[];
  rates: HotelSearchItem[];
}

interface HotelOffer {
  id: string;
  hotel_name: string;
  client_name: string | null;
  client_email: string | null;
  client_amount: number;
  ratehawk_amount: number | null;
  currency: string;
  status: string;
  payment_mode: "online" | "invoice";
  payment_status: string;
  tariff_type: "refundable" | "non_refundable";
  cancellation_policy: string | null;
  check_in: string;
  check_out: string;
  created_at: string;
  partner_order_id: string | null;
  created_by: string | null;
  room_name: string | null;
  meal: string | null;
  hotel_stars: number | null;
}

interface HotelOfferEvent {
  id: string;
  event_type: string;
  event_payload: Record<string, unknown>;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  sent: "bg-blue-100 text-blue-800",
  viewed: "bg-indigo-100 text-indigo-800",
  confirmed: "bg-cyan-100 text-cyan-800",
  payment_pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-emerald-100 text-emerald-800",
  invoice_pending: "bg-orange-100 text-orange-800",
  booking_started: "bg-purple-100 text-purple-800",
  booking_confirmed: "bg-green-100 text-green-800",
  booking_failed: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-500",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] || "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function Stars({ count }: { count: number | null | undefined }) {
  if (!count) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500">
      {Array.from({ length: Math.min(count, 5) }).map((_, i) => (
        <Star key={i} size={12} fill="currentColor" strokeWidth={0} />
      ))}
    </span>
  );
}

function Tooltip({ children, content }: { children: React.ReactNode; content: React.ReactNode }) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!show) return;
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setShow(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [show]);

  return (
    <div ref={ref} className="relative inline-flex">
      <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setShow(!show); }} onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setShow(!show); } }} className="inline-flex items-center cursor-pointer">
        {children}
      </span>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-lg text-xs text-gray-700" onClick={(e) => e.stopPropagation()}>
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
            <div className="w-2 h-2 bg-white border-b border-r border-gray-200 rotate-45 -translate-y-1" />
          </div>
        </div>
      )}
    </div>
  );
}

function ImageCarousel({ images, alt }: { images: string[]; alt: string }) {
  const [idx, setIdx] = useState(0);
  if (images.length === 0) {
    return (
      <div className="w-36 h-24 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
        <Hotel size={24} className="text-gray-300" />
      </div>
    );
  }
  return (
    <div className="relative w-36 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 group">
      <img src={images[idx]} alt={alt} className="w-full h-full object-cover" />
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setIdx((i) => (i - 1 + images.length) % images.length); }}
            className="absolute left-1 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setIdx((i) => (i + 1) % images.length); }}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight size={14} />
          </button>
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
            {images.map((_, i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === idx ? "bg-white" : "bg-white/50"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CancellationInfo({ rate }: { rate: HotelSearchItem }) {
  if (rate.tariffType === "non_refundable") {
    return (
      <Tooltip content={<span>If the booking is cancelled, the room cost is non-refundable.</span>}>
        <span className="text-red-600 text-xs flex items-center gap-1">
          Non-refundable <Info size={12} className="text-red-400" />
        </span>
      </Tooltip>
    );
  }

  const freeBefore = rate.freeCancellationBefore;
  const penalties = rate.cancellationPenalties ?? [];
  const shortDate = freeBefore ? formatDateDDMMYYYY(freeBefore) : null;

  const tooltipContent = (
    <div className="space-y-1.5">
      {freeBefore && (
        <div className="flex items-start gap-2">
          <div className="w-1 h-4 rounded-full bg-green-500 flex-shrink-0 mt-0.5" />
          <span>Free cancellation until {formatDateDDMMYYYY(freeBefore)}</span>
        </div>
      )}
      {penalties.map((p, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="w-1 h-4 rounded-full bg-amber-500 flex-shrink-0 mt-0.5" />
          <span>{p.amount} {p.currency} penalty from {formatDateDDMMYYYY(p.from)}</span>
        </div>
      ))}
      {!freeBefore && penalties.length === 0 && (
        <span>Please check cancellation terms before booking.</span>
      )}
    </div>
  );

  return (
    <Tooltip content={tooltipContent}>
      <span className="text-green-600 text-xs flex items-center gap-1">
        {shortDate ? `Free cancel until ${shortDate}` : "Free cancellation"}
        <Info size={12} className="text-green-400" />
      </span>
    </Tooltip>
  );
}

function MealInfo({ meal }: { meal: string | null | undefined }) {
  if (!meal) return <span className="text-xs text-gray-400">—</span>;
  const short = meal.length > 20 ? meal.slice(0, 20) + "..." : meal;
  if (meal.length <= 20) return <span className="text-xs text-gray-700">{meal}</span>;
  return (
    <Tooltip content={<span>{meal}</span>}>
      <span className="text-xs text-gray-700 flex items-center gap-1">
        {short} <Info size={11} className="text-gray-400" />
      </span>
    </Tooltip>
  );
}

export default function HotelsBookingPage() {
  const [tab, setTab] = useState<Tab>("search");

  const [searching, setSearching] = useState(false);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offers, setOffers] = useState<HotelOffer[]>([]);
  const [events, setEvents] = useState<HotelOfferEvent[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<HotelSearchItem[]>([]);

  const [destinationQuery, setDestinationQuery] = useState("");
  const [regionSuggestions, setRegionSuggestions] = useState<RegionSuggestion[]>([]);
  const [hotelSuggestions, setHotelSuggestions] = useState<HotelSuggestion[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<RegionSuggestion | null>(null);
  const suggestRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState(2);
  const [childrenAges, setChildrenAges] = useState<number[]>([]);
  const [guestsDropdownOpen, setGuestsDropdownOpen] = useState(false);
  const guestsRef = useRef<HTMLDivElement>(null);
  const [markupPercent, setMarkupPercent] = useState("15");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [clientPartyId, setClientPartyId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [paymentMode, setPaymentMode] = useState<"online" | "invoice">("online");
  const [sendChannel, setSendChannel] = useState<"app" | "email" | "both">("both");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentModeFilter, setPaymentModeFilter] = useState("all");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");

  const markup = Number(markupPercent) || 0;
  const applyMarkup = useCallback((amount: number) => Math.round(amount * (1 + Math.max(0, markup) / 100) * 100) / 100, [markup]);

  const selectedResult = useMemo(
    () => (selectedIdx !== null ? searchResults[selectedIdx] : null),
    [selectedIdx, searchResults]
  );

  const STORAGE_KEY = "hotels-booking-last-search";

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s.destinationQuery) setDestinationQuery(s.destinationQuery);
      if (s.selectedRegion) setSelectedRegion(s.selectedRegion);
      if (s.checkIn) setCheckIn(s.checkIn);
      if (s.checkOut) setCheckOut(s.checkOut);
      if (s.adults) setAdults(s.adults);
      if (s.childrenAges) setChildrenAges(s.childrenAges);
      if (s.markupPercent) setMarkupPercent(s.markupPercent);
      if (s.searchResults?.length) setSearchResults(s.searchResults);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        destinationQuery, selectedRegion, checkIn, checkOut,
        adults, childrenAges, markupPercent, searchResults,
      }));
    } catch { /* quota exceeded — ignore */ }
  }, [destinationQuery, selectedRegion, checkIn, checkOut, adults, childrenAges, markupPercent, searchResults]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node)) setSuggestOpen(false);
      if (guestsRef.current && !guestsRef.current.contains(e.target as Node)) setGuestsDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const authedFetch = useCallback(async (url: string, init?: RequestInit) => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = new Headers(init?.headers || {});
    if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
    if (!headers.has("Content-Type") && init?.body) headers.set("Content-Type", "application/json");
    return fetch(url, { ...init, headers, credentials: "include" });
  }, []);

  const loadOffers = useCallback(async () => {
    setOffersLoading(true);
    try {
      const res = await authedFetch("/api/hotels/offers");
      const json = await res.json();
      setOffers(json.data ?? []);
    } finally {
      setOffersLoading(false);
    }
  }, [authedFetch]);

  const loadEvents = useCallback(async (offerId: string) => {
    const res = await authedFetch(`/api/hotels/offers/${offerId}/events`);
    const json = await res.json();
    setEvents(json.data ?? []);
  }, [authedFetch]);

  useEffect(() => { void loadOffers(); }, [loadOffers]);

  const ruToLatin = useMemo(() => {
    const ru = "йцукенгшщзхъфывапролджэячсмитьбюЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭЯЧСМИТЬБЮ";
    const en = "qwertyuiop[]asdfghjkl;'zxcvbnm,.QWERTYUIOP[]ASDFGHJKL;'ZXCVBNM,.";
    const map: Record<string, string> = {};
    for (let i = 0; i < ru.length; i++) map[ru[i]] = en[i];
    return map;
  }, []);

  const transliterate = useCallback((text: string): string => {
    if (!/[а-яА-ЯёЁ]/.test(text)) return text;
    return text.split("").map((ch) => ruToLatin[ch] ?? ch).join("");
  }, [ruToLatin]);

  const fetchRegionSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setRegionSuggestions([]); return; }
    setSuggestLoading(true);
    try {
      const query = transliterate(q.trim());
      const res = await fetch("/api/ratehawk/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, language: "en" }),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        setRegionSuggestions(Array.isArray(json.data.regions) ? json.data.regions as RegionSuggestion[] : []);
        setHotelSuggestions(Array.isArray(json.data.hotels) ? json.data.hotels as HotelSuggestion[] : []);
      }
    } finally { setSuggestLoading(false); }
  }, [transliterate]);

  const handleDestinationInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setDestinationQuery(v);
    setSelectedRegion(null);
    setSuggestOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { fetchRegionSuggestions(v); debounceRef.current = null; }, 300);
  };

  const selectRegion = (r: RegionSuggestion) => { setSelectedRegion(r); setDestinationQuery(r.name); setSuggestOpen(false); };
  const clearRegion = () => { setSelectedRegion(null); setDestinationQuery(""); setRegionSuggestions([]); setHotelSuggestions([]); };
  const canSearch = !!selectedRegion && !!checkIn && !!checkOut;

  const runSearch = async () => {
    if (!canSearch || !selectedRegion) return;
    setSearching(true);
    try {
      const res = await authedFetch("/api/hotels/search", {
        method: "POST",
        body: JSON.stringify({
          regionId: Number(selectedRegion.id),
          checkIn, checkOut, adults, childrenAges, currency: "EUR",
          ...(selectedRegion.type === "hotel" && selectedRegion.hid ? { hotelHid: selectedRegion.hid } : {}),
        }),
      });
      const json = await res.json();
      setSearchResults(json.data ?? []);
      setSelectedIdx(null);
    } finally { setSearching(false); }
  };

  const createOffer = async () => {
    if (!selectedResult) return;
    const clientAmount = applyMarkup(selectedResult.ratehawkAmount);
    const res = await authedFetch("/api/hotels/offers", {
      method: "POST",
      body: JSON.stringify({
        ...selectedResult,
        clientAmount,
        markupPercent: markup,
        paymentMode,
        clientPartyId: clientPartyId || null,
        clientName: clientName || null,
        clientEmail: clientEmail || null,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      const offerId = json.data?.id;
      if (offerId) {
        await authedFetch(`/api/hotels/offers/${offerId}/send`, {
          method: "POST",
          body: JSON.stringify({ channel: sendChannel }),
        });
      }
      await loadOffers();
      setTab("logs");
    }
  };

  const startPayment = async (offerId: string, mode: "online" | "invoice") => {
    const res = await authedFetch(`/api/hotels/offers/${offerId}/pay`, { method: "POST", body: JSON.stringify({ mode }) });
    const json = await res.json();
    if (json.data?.checkoutUrl) window.open(json.data.checkoutUrl, "_blank", "noopener,noreferrer");
    await loadOffers();
  };

  const triggerBookingAfterInvoice = async (offerId: string) => {
    await authedFetch(`/api/hotels/offers/${offerId}/confirm`, { method: "PATCH", body: JSON.stringify({ action: "invoice_paid" }) });
    await loadOffers();
  };

  const filteredOffers = useMemo(() => {
    const fromDate = dateFromFilter ? new Date(`${dateFromFilter}T00:00:00`) : null;
    const toDate = dateToFilter ? new Date(`${dateToFilter}T23:59:59`) : null;
    const fromTime = fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate.getTime() : null;
    const toTime = toDate && !Number.isNaN(toDate.getTime()) ? toDate.getTime() : null;
    return offers.filter((offer) => {
      if (statusFilter !== "all" && offer.status !== statusFilter) return false;
      if (paymentModeFilter !== "all" && offer.payment_mode !== paymentModeFilter) return false;
      if (clientFilter) {
        const v = `${offer.client_name || ""} ${offer.client_email || ""}`.toLowerCase();
        if (!v.includes(clientFilter.toLowerCase())) return false;
      }
      if (fromTime !== null || toTime !== null) {
        const t = new Date(offer.created_at).getTime();
        if (Number.isNaN(t)) return false;
        if (fromTime !== null && t < fromTime) return false;
        if (toTime !== null && t > toTime) return false;
      }
      return true;
    });
  }, [offers, statusFilter, paymentModeFilter, clientFilter, dateFromFilter, dateToFilter]);

  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    return Math.max(0, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000));
  }, [checkIn, checkOut]);

  const groupedResults = useMemo<HotelGroup[]>(() => {
    const map = new Map<number, HotelGroup>();
    for (const r of searchResults) {
      let g = map.get(r.hid);
      if (!g) {
        g = { hid: r.hid, hotelName: r.hotelName, address: r.address ?? null, stars: r.stars ?? null, images: r.hotelImages ?? [], rates: [] };
        map.set(r.hid, g);
      }
      g.rates.push(r);
    }
    return [...map.values()];
  }, [searchResults]);

  return (
    <div className="booking-modern-container">
      <div className="max-w-[1400px] mx-auto space-y-4">
        {/* Header */}
        <div className="booking-modern-header">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 backdrop-blur-sm shadow-[0_0_15px_rgba(99,102,241,0.2)]">
              <Hotel size={24} className="text-indigo-400" />
            </div>
            <div>
              <h1 className="booking-header-title">Hotels Booking</h1>
              <p className="booking-header-subtitle">Search rates, create offers with markup, manage bookings</p>
            </div>
          </div>
          <button onClick={() => void loadOffers()} className="booking-glass-panel !py-2 !px-4 flex items-center gap-2 text-sm font-bold text-gray-700 hover:text-indigo-600 transition-colors cursor-pointer drop-shadow-sm" style={{ padding: '0.5rem 1rem' }}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="booking-tabs-container">
          {([
            { id: "search", label: "Search & Offers", icon: <Search size={14} /> },
            { id: "logs", label: "Requests & Payments", icon: <FileText size={14} /> },
            { id: "bookings", label: "Bookings", icon: <Hotel size={14} /> },
          ] as const).map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`booking-tab ${tab === t.id ? "active" : ""}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ==================== SEARCH TAB ==================== */}
        {tab === "search" && (
          <div className="space-y-6">
            {/* Modular Search Bar (Glassmorphism) */}
            <div className="booking-glass-panel">
              <div className="flex items-end gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px] relative booking-input-group" ref={suggestRef}>
                  <label className="booking-label">Destination</label>
                  <div className="relative">
                    <input type="text" value={destinationQuery} onChange={handleDestinationInput} onFocus={() => { if (destinationQuery.length >= 2) setSuggestOpen(true); }} placeholder="City, region, hotel..." className="booking-input pr-7" />
                    {selectedRegion && <button onClick={clearRegion} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"><X size={14} /></button>}
                    {suggestLoading && <div className="absolute right-2 top-1/2 -translate-y-1/2"><Loader2 size={13} className="animate-spin text-indigo-400" /></div>}
                    {suggestOpen && destinationQuery.length >= 2 && (
                      <div className="absolute z-50 w-full mt-2 bg-[#1e293b] border border-[rgba(255,255,255,0.1)] rounded-lg shadow-2xl max-h-[300px] overflow-y-auto backdrop-blur-md">
                        {suggestLoading ? <div className="px-3 py-3 text-center text-sm text-gray-400">Searching...</div> : (regionSuggestions.length === 0 && hotelSuggestions.length === 0) ? <div className="px-3 py-3 text-center text-sm text-gray-400">No destinations found</div> : (
                          <>
                            {hotelSuggestions.length > 0 && (
                              <>
                                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 bg-[#0f172a]/50">Hotels</div>
                                {hotelSuggestions.map((h) => (
                                  <button key={h.hid} type="button" onClick={() => { setSelectedRegion({ id: h.region_id, name: h.name, type: "hotel", hid: h.hid }); setDestinationQuery(h.name); setSuggestOpen(false); }} className="w-full px-3 py-2.5 text-left hover:bg-white/10 flex items-center gap-2 border-b border-white/5 last:border-0 transition-colors">
                                    <Hotel size={13} className="text-indigo-400 flex-shrink-0" />
                                    <div className="text-sm font-medium text-gray-200">{h.name}</div>
                                  </button>
                                ))}
                              </>
                            )}
                            {regionSuggestions.length > 0 && (
                              <>
                                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 bg-[#0f172a]/50">Regions</div>
                                {regionSuggestions.map((r) => (
                                  <button key={String(r.id)} type="button" onClick={() => selectRegion(r)} className="w-full px-3 py-2.5 text-left hover:bg-white/10 flex items-center gap-2 border-b border-white/5 last:border-0 transition-colors">
                                    <MapPin size={13} className="text-gray-400 flex-shrink-0" />
                                    <div>
                                      <div className="text-sm font-medium text-gray-200">{r.name}</div>
                                      <div className="text-[11px] text-gray-400">{r.type}{r.country_code ? ` · ${r.country_code}` : ""}</div>
                                    </div>
                                  </button>
                                ))}
                              </>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="w-[240px] [&_[data-calendar-dropdown]]:left-auto [&_[data-calendar-dropdown]]:right-0 booking-input-group">
                  <DateRangePicker label="Dates" from={checkIn || undefined} to={checkOut || undefined} onChange={(from, to) => { setCheckIn(from ?? ""); setCheckOut(to ?? ""); }} />
                </div>
                {nights > 0 && <span className="text-xs text-[var(--booking-text-secondary)] pb-1.5">{nights}n</span>}

                <div ref={guestsRef} className="relative w-[160px] booking-input-group">
                  <label className="booking-label">Guests</label>
                  <button type="button" onClick={() => setGuestsDropdownOpen(!guestsDropdownOpen)} className="booking-input text-left flex justify-between items-center">
                    {adults} adl{childrenAges.length > 0 ? `, ${childrenAges.length} chd` : ""}
                    <ChevronDown size={14} className="text-gray-400" />
                  </button>
                  {guestsDropdownOpen && (
                    <div className="absolute z-50 left-0 top-full mt-2 w-72 bg-[#1e293b] border border-[rgba(255,255,255,0.1)] rounded-xl shadow-2xl p-4 space-y-3 backdrop-blur-md">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-200">Adults</span>
                        <div className="flex items-center gap-2 bg-[#0f172a] rounded-lg p-1">
                          <button type="button" onClick={() => setAdults(Math.max(1, adults - 1))} className="h-7 w-7 rounded-md bg-white/5 hover:bg-white/10 text-gray-200 flex items-center justify-center transition-colors">−</button>
                          <span className="w-6 text-center text-sm font-bold">{adults}</span>
                          <button type="button" onClick={() => setAdults(Math.min(6, adults + 1))} className="h-7 w-7 rounded-md bg-white/5 hover:bg-white/10 text-gray-200 flex items-center justify-center transition-colors">+</button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-200">Children</span>
                        <div className="flex items-center gap-2 bg-[#0f172a] rounded-lg p-1">
                          <button type="button" onClick={() => setChildrenAges((p) => p.length > 0 ? p.slice(0, -1) : p)} className="h-7 w-7 rounded-md bg-white/5 hover:bg-white/10 text-gray-200 flex items-center justify-center transition-colors">−</button>
                          <span className="w-6 text-center text-sm font-bold">{childrenAges.length}</span>
                          <button type="button" onClick={() => setChildrenAges((p) => p.length < 4 ? [...p, 5] : p)} className="h-7 w-7 rounded-md bg-white/5 hover:bg-white/10 text-gray-200 flex items-center justify-center transition-colors">+</button>
                        </div>
                      </div>
                      {childrenAges.length > 0 && (
                        <div className="pt-3 border-t border-white/10">
                          <span className="text-xs text-gray-400 mb-2 block">Ages of children</span>
                          <div className="flex gap-2 flex-wrap">
                            {childrenAges.map((age, i) => (
                              <select key={i} value={age} onChange={(e) => { const n = [...childrenAges]; n[i] = Number(e.target.value); setChildrenAges(n); }} className="rounded-md bg-[#0f172a] border border-white/10 text-gray-200 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50">
                                {Array.from({ length: 18 }, (_, a) => (<option key={a} value={a}>{a === 0 ? "<1" : a}</option>))}
                              </select>
                            ))}
                          </div>
                        </div>
                      )}
                      <button type="button" onClick={() => setGuestsDropdownOpen(false)} className="w-full mt-2 booking-btn-primary py-2">Done</button>
                    </div>
                  )}
                </div>

                <button onClick={() => void runSearch()} disabled={!canSearch || searching} className="booking-btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
                  {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                  Find Rates
                </button>
              </div>
            </div>

            {/* Results grouped by hotel */}
            {groupedResults.length > 0 && (
              <div className="flex flex-col">
                <div className="mb-4">
                  <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                    Destinations found
                    <span className="ml-3 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-100 shadow-sm">
                      {groupedResults.length} hotels • {searchResults.length} rates
                    </span>
                  </h2>
                </div>

                <div className="booking-results-grid">
                  {groupedResults.map((hotel) => (
                    <div key={hotel.hid} className="booking-glass-panel booking-hotel-card">
                      {/* Hotel header */}
                      <div className="booking-hotel-header">
                        <div className="booking-hotel-image-wrap">
                          {hotel.images.length > 0 ? (
                            <img src={hotel.images[0]} alt={hotel.hotelName} />
                          ) : (
                            <div className="w-full h-full bg-[#0f172a] flex items-center justify-center">
                              <Hotel size={32} className="text-indigo-900/50" />
                            </div>
                          )}
                        </div>
                        <div className="booking-hotel-info">
                          <div className="flex items-center gap-3">
                            <h3 className="booking-hotel-name">{hotel.hotelName}</h3>
                            <div className="flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                              <Stars count={hotel.stars} />
                            </div>
                          </div>
                          {hotel.address && (
                            <div className="booking-hotel-address mt-2">
                              <MapPin size={14} className="text-indigo-400" />
                              <span>{hotel.address}</span>
                            </div>
                          )}
                          <div className="mt-3 inline-flex items-center bg-white/5 border border-white/10 rounded-full px-3 py-1 text-xs text-gray-300 font-medium w-max shadow-sm">
                            {hotel.rates.length} rate{hotel.rates.length !== 1 ? "s" : ""} available
                          </div>
                        </div>
                      </div>

                      {/* Rate rows */}
                      <div className="booking-rate-table">
                        <div className="hidden md:grid grid-cols-[2fr_1fr_1.5fr_1fr] gap-4 px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-[#94a3b8]">
                          <div>Room Details</div>
                          <div>Meal Plan</div>
                          <div>Cancellation Terms</div>
                          <div className="text-right">Total Price</div>
                        </div>
                        {hotel.rates.map((r, idx) => {
                          const globalIdx = searchResults.indexOf(r);
                          const isSelected = selectedIdx === globalIdx;
                          return (
                            <div
                              key={idx}
                              role="button"
                              tabIndex={0}
                              onClick={() => setSelectedIdx(globalIdx)}
                              onKeyDown={(e) => { if (e.key === "Enter") setSelectedIdx(globalIdx); }}
                              className={`booking-rate-row ${isSelected ? "selected" : ""}`}
                            >
                              {/* Room */}
                              <div className="min-w-0 pr-4">
                                <div className="booking-rate-room truncate">{r.roomName || "Standard Room"}</div>
                                {r.beddingType && <div className="booking-rate-sub truncate text-indigo-300/80">{r.beddingType}</div>}
                              </div>
                              {/* Meal */}
                              <div><MealInfo meal={r.meal} /></div>
                              {/* Cancellation */}
                              <div><CancellationInfo rate={r} /></div>
                              {/* Price */}
                              <div className="booking-rate-price-block">
                                <div className="text-[10px] text-[var(--booking-text-tertiary)] uppercase tracking-wider mb-1 line-through decoration-[var(--booking-text-tertiary)] opacity-60 flex gap-1 items-center">
                                  {/* Base Rate */}
                                  {r.ratehawkAmount} {r.currency}
                                </div>
                                <div className="booking-rate-price font-bold text-xl drop-shadow-[0_2px_10px_rgba(16,185,129,0.3)]">
                                  {applyMarkup(r.ratehawkAmount)} <span className="text-xs text-[var(--booking-success)]/70 uppercase">{r.currency}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {searching && (
              <div className="text-center py-8">
                <Loader2 size={24} className="animate-spin mx-auto mb-2 text-blue-500" />
                <p className="text-sm text-gray-500">Searching rates...</p>
              </div>
            )}

            {/* Create offer */}
            {selectedResult && (
              <div className="booking-glass-panel fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-[1400px] z-40 border-indigo-500/30 shadow-[0_-10px_40px_rgba(0,0,0,0.4),_0_0_20px_rgba(99,102,241,0.2)] animate-[slideFadeUp_0.4s_ease-out_both]" style={{ padding: '1.5rem', width: 'calc(100% - 4rem)' }}>
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 rounded-t-xl" />

                <div className="flex flex-col md:flex-row gap-6 items-center">
                  <div className="flex-1 min-w-0 w-full mb-4 md:mb-0">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Star className="text-indigo-400 h-5 w-5" fill="currentColor" />
                      Compose Premium Offer
                    </h2>
                    <p className="text-sm text-gray-400 mt-1 truncate">
                      <strong>{selectedResult.hotelName}</strong> • {selectedResult.roomName}
                    </p>
                  </div>

                  <div className="w-full md:w-auto grid grid-cols-2 md:grid-cols-4 gap-4 items-end flex-wrap">
                    <div className="booking-input-group !mb-0 min-w-[140px]">
                      <label className="booking-label">Client Name</label>
                      <input className="booking-input !py-1.5" placeholder="Full name" value={clientName} onChange={(e) => setClientName(e.target.value)} />
                    </div>
                    <div className="booking-input-group !mb-0 min-w-[140px]">
                      <label className="booking-label">
                        <Percent size={11} className="inline mr-1 -mt-0.5 text-indigo-400" />Markup
                      </label>
                      <input type="number" min={0} max={100} value={markupPercent} onChange={(e) => setMarkupPercent(e.target.value)} className="booking-input !py-1.5 focus:border-emerald-500 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.3)]" />
                    </div>
                    <div className="booking-input-group !mb-0 min-w-[160px]">
                      <label className="booking-label">Gateway</label>
                      <div className="relative">
                        <select className="booking-input !py-1.5 appearance-none pr-8 bg-transparent" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as "online" | "invoice")}>
                          <option value="online" className="text-black">Online (Stripe)</option>
                          <option value="invoice" className="text-black">Bank Transfer</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                      </div>
                    </div>
                    <div className="w-full flex justify-end gap-3 mt-4 md:mt-0 col-span-2 md:col-span-1">
                      <div className="flex flex-col items-end mr-3">
                        <div className="text-[10px] text-gray-400 uppercase tracking-widest">Final Price</div>
                        <div className="text-xl font-extrabold text-[#10b981] drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]">{applyMarkup(selectedResult.ratehawkAmount)} <span className="text-xs uppercase">{selectedResult.currency}</span></div>
                      </div>
                      <button onClick={() => void createOffer()} className="booking-btn-success shadow-lg">
                        <Send size={16} /> Send Offer
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== LOGS TAB ==================== */}
        {tab === "logs" && (
          <div className="space-y-4">
            <div className="booking-glass-panel p-4 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="booking-input-group !mb-0">
                  <label className="booking-label">Status</label>
                  <div className="relative">
                    <select className="booking-input appearance-none pr-8 !py-2" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                      <option value="all" className="text-black">All statuses</option>
                      {["draft", "sent", "viewed", "confirmed", "payment_pending", "paid", "invoice_pending", "booking_started", "booking_confirmed", "booking_failed", "cancelled"].map((s) => (
                        <option key={s} value={s} className="text-black">{s.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div className="booking-input-group !mb-0">
                  <label className="booking-label">Payment mode</label>
                  <div className="relative">
                    <select className="booking-input appearance-none pr-8 !py-2" value={paymentModeFilter} onChange={(e) => setPaymentModeFilter(e.target.value)}>
                      <option value="all" className="text-black">All</option>
                      <option value="online" className="text-black">Online</option>
                      <option value="invoice" className="text-black">Invoice</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div className="booking-input-group !mb-0">
                  <label className="booking-label">From</label>
                  <input className="booking-input !py-2 [color-scheme:dark]" type="date" value={dateFromFilter} onChange={(e) => setDateFromFilter(e.target.value)} />
                </div>
                <div className="booking-input-group !mb-0">
                  <label className="booking-label">To</label>
                  <input className="booking-input !py-2 [color-scheme:dark]" type="date" value={dateToFilter} onChange={(e) => setDateToFilter(e.target.value)} />
                </div>
                <div className="booking-input-group !mb-0">
                  <label className="booking-label">Client</label>
                  <input className="booking-input !py-2" placeholder="Name or email" value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="booking-glass-panel !p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/5 bg-gray-100/50">
                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Created</th>
                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Hotel</th>
                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Client</th>
                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Amount</th>
                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Tariff</th>
                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Status</th>
                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Payment</th>
                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 bg-transparent">
                    {offersLoading && (
                      <tr><td className="px-5 py-8 text-center text-indigo-600" colSpan={8}><Loader2 size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />Loading offers...</td></tr>
                    )}
                    {!offersLoading && filteredOffers.map((o) => (
                      <tr key={o.id} className={`cursor-pointer transition-colors ${selectedOfferId === o.id ? "bg-indigo-50 shadow-[inset_2px_0_0_#6366f1]" : "hover:bg-black/5"}`} onClick={() => { setSelectedOfferId(o.id); void loadEvents(o.id); }}>
                        <td className="px-5 py-3 whitespace-nowrap text-gray-600">{formatDateDDMMYYYY(o.created_at)}</td>
                        <td className="px-5 py-3 text-gray-900 font-semibold">{o.hotel_name}</td>
                        <td className="px-5 py-3 text-gray-600">{o.client_name || o.client_email || "—"}</td>
                        <td className="px-5 py-3 text-emerald-600 font-bold whitespace-nowrap drop-shadow-[0_0_8px_rgba(16,185,129,0.1)]">{o.client_amount} <span className="text-xs uppercase font-normal text-emerald-600/70">{o.currency}</span></td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold border ${o.tariff_type === "refundable" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                            {o.tariff_type === "refundable" ? "REFUNDABLE" : "NON-REF"}
                          </span>
                        </td>
                        <td className="px-5 py-3"><StatusBadge status={o.status} /></td>
                        <td className="px-5 py-3 text-xs text-gray-500">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-gray-700 capitalize">{o.payment_mode}</span>
                            <span className="opacity-70">{o.payment_status}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-2">
                            <button className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-500 hover:text-white transition-all shadow-sm" onClick={() => void startPayment(o.id, o.payment_mode)}>
                              <CreditCard size={14} /> Pay
                            </button>
                            {o.payment_mode === "invoice" && o.payment_status !== "paid" && (
                              <button className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-500 hover:text-white transition-all shadow-sm" onClick={() => void triggerBookingAfterInvoice(o.id)}>
                                <FileText size={14} /> Mark
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!offersLoading && filteredOffers.length === 0 && (
                      <tr><td className="px-5 py-8 text-center text-gray-500" colSpan={8}>No offers matching filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedOfferId && (
              <div className="booking-glass-panel mt-6">
                <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="text-indigo-500" size={18} />
                  Event Timeline
                </h3>
                {events.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No events logged yet.</p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                    {events.map((event) => (
                      <div key={event.id} className="relative rounded-xl border border-black/5 bg-white/50 p-4 hover:bg-white/80 transition-colors group">
                        <div className="absolute -left-[1px] top-4 bottom-4 w-[2px] bg-indigo-300 rounded-r-md group-hover:bg-indigo-500 transition-colors" />
                        <div className="flex items-center justify-between mb-2 pl-2">
                          <span className="text-sm font-bold text-gray-800">{event.event_type.replace(/_/g, " ")}</span>
                          <span className="text-xs text-indigo-700 font-mono bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100">{formatDateDDMMYYYY(event.created_at)}</span>
                        </div>
                        {Object.keys(event.event_payload).length > 0 && (
                          <pre className="mt-2 pl-2 text-[11px] text-gray-600 whitespace-pre-wrap font-mono leading-relaxed bg-gray-50/80 p-3 rounded-lg border border-gray-200 overflow-x-auto">{JSON.stringify(event.event_payload, null, 2)}</pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ==================== BOOKINGS TAB ==================== */}
        {tab === "bookings" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: "Confirmed", status: "booking_confirmed", color: "from-emerald-900/40 to-emerald-800/20 border-emerald-500/30 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.1)]" },
                { label: "In Progress", status: "booking_started", color: "from-indigo-900/40 to-indigo-800/20 border-indigo-500/30 text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.1)]" },
                { label: "Failed", status: "booking_failed", color: "from-red-900/40 to-rose-800/20 border-rose-500/30 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.1)]" },
              ].map((item) => {
                const count = offers.filter((o) => o.status === item.status).length;
                return (
                  <div key={item.status} className={`rounded-xl border bg-gradient-to-br p-6 backdrop-blur-md ${item.color} transform transition-all hover:scale-[1.02]`}>
                    <div className="text-sm font-semibold uppercase tracking-wider opacity-90">{item.label}</div>
                    <div className="text-4xl font-black mt-2 select-none">{count}</div>
                  </div>
                );
              })}
            </div>

            <div className="booking-glass-panel !p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/5 bg-gray-100/50">
                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Hotel</th>
                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Client</th>
                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Dates</th>
                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Amount</th>
                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Status</th>
                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Partner Order</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 bg-transparent">
                    {offers.filter((o) => ["booking_confirmed", "booking_started", "booking_failed"].includes(o.status)).map((o) => (
                      <tr key={o.id} className="hover:bg-black/5 transition-colors">
                        <td className="px-5 py-4 text-gray-900 font-semibold">{o.hotel_name}</td>
                        <td className="px-5 py-4 text-gray-600">{o.client_name || "—"}</td>
                        <td className="px-5 py-4 text-gray-500 text-xs whitespace-nowrap bg-gray-200/50 rounded my-2 block w-max px-2 py-1"><span className="text-gray-900">{formatDateDDMMYYYY(o.check_in)}</span> <span className="mx-1 text-indigo-500">→</span> <span className="text-gray-900">{formatDateDDMMYYYY(o.check_out)}</span></td>
                        <td className="px-5 py-4 text-emerald-600 font-bold drop-shadow-[0_0_8px_rgba(16,185,129,0.1)]">{o.client_amount} <span className="text-xs uppercase font-normal text-emerald-600/70">{o.currency}</span></td>
                        <td className="px-5 py-4"><StatusBadge status={o.status} /></td>
                        <td className="px-5 py-4 text-xs text-indigo-700 font-mono bg-indigo-50 border border-indigo-100 rounded px-2 py-1 select-all">{o.partner_order_id || "—"}</td>
                      </tr>
                    ))}
                    {offers.filter((o) => ["booking_confirmed", "booking_started", "booking_failed"].includes(o.status)).length === 0 && (
                      <tr><td className="px-5 py-12 text-center text-gray-500" colSpan={6}>No bookings yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
