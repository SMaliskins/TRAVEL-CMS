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
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-[1800px] mx-auto space-y-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm px-6 py-4 flex items-center justify-between border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-50">
              <Hotel size={20} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Hotels Booking</h1>
              <p className="text-xs text-gray-500 mt-0.5">Search rates, create offers with markup, manage bookings</p>
            </div>
          </div>
          <button onClick={() => void loadOffers()} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-lg shadow-sm border border-gray-200 p-1">
          {([
            { id: "search", label: "Search & Offers", icon: <Search size={14} /> },
            { id: "logs", label: "Requests & Payments", icon: <FileText size={14} /> },
            { id: "bookings", label: "Bookings", icon: <Hotel size={14} /> },
          ] as const).map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-colors ${tab === t.id ? "bg-gray-900 text-white shadow-sm" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ==================== SEARCH TAB ==================== */}
        {tab === "search" && (
          <div className="space-y-4">
            {/* Compact search bar */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-3">
              <div className="flex items-end gap-2 flex-wrap">
                <div className="flex-1 min-w-[200px] relative" ref={suggestRef}>
                  <label className="block text-xs text-gray-500 mb-0.5">Destination</label>
                  <div className="relative">
                    <input type="text" value={destinationQuery} onChange={handleDestinationInput} onFocus={() => { if (destinationQuery.length >= 2) setSuggestOpen(true); }} placeholder="City, region, hotel..." className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 pr-7" />
                    {selectedRegion && <button onClick={clearRegion} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={13} /></button>}
                    {suggestLoading && <div className="absolute right-2 top-1/2 -translate-y-1/2"><Loader2 size={13} className="animate-spin text-blue-500" /></div>}
                    {suggestOpen && destinationQuery.length >= 2 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-[300px] overflow-y-auto">
                        {suggestLoading ? <div className="px-3 py-3 text-center text-sm text-gray-500">Searching...</div> : (regionSuggestions.length === 0 && hotelSuggestions.length === 0) ? <div className="px-3 py-3 text-center text-sm text-gray-500">No destinations found</div> : (
                          <>
                            {hotelSuggestions.length > 0 && (
                              <>
                                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 bg-gray-50">Hotels</div>
                                {hotelSuggestions.map((h) => (
                                  <button key={h.hid} type="button" onClick={() => { setSelectedRegion({ id: h.region_id, name: h.name, type: "hotel", hid: h.hid }); setDestinationQuery(h.name); setSuggestOpen(false); }} className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center gap-2 border-b border-gray-100 last:border-0">
                                    <Hotel size={13} className="text-blue-400 flex-shrink-0" />
                                    <div className="text-sm font-medium text-gray-900">{h.name}</div>
                                  </button>
                                ))}
                              </>
                            )}
                            {regionSuggestions.length > 0 && (
                              <>
                                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 bg-gray-50">Regions</div>
                                {regionSuggestions.map((r) => (
                                  <button key={String(r.id)} type="button" onClick={() => selectRegion(r)} className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center gap-2 border-b border-gray-100 last:border-0">
                                    <MapPin size={13} className="text-gray-400 flex-shrink-0" />
                                    <div>
                                      <div className="text-sm font-medium text-gray-900">{r.name}</div>
                                      <div className="text-[11px] text-gray-500">{r.type}{r.country_code ? ` · ${r.country_code}` : ""}</div>
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

                <div className="w-[220px] [&_[data-calendar-dropdown]]:left-auto [&_[data-calendar-dropdown]]:right-0">
                  <DateRangePicker label="Dates" from={checkIn || undefined} to={checkOut || undefined} onChange={(from, to) => { setCheckIn(from ?? ""); setCheckOut(to ?? ""); }} />
                </div>
                {nights > 0 && <span className="text-xs text-gray-400 pb-1.5">{nights}n</span>}

                <div ref={guestsRef} className="relative w-[140px]">
                  <label className="block text-xs text-gray-500 mb-0.5">Guests</label>
                  <button type="button" onClick={() => setGuestsDropdownOpen(!guestsDropdownOpen)} className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-left text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                    {adults} adl{childrenAges.length > 0 ? `, ${childrenAges.length} chd` : ""}
                  </button>
                  {guestsDropdownOpen && (
                    <div className="absolute z-50 left-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">Adults</span>
                        <div className="flex items-center gap-1.5">
                          <button type="button" onClick={() => setAdults(Math.max(1, adults - 1))} className="h-6 w-6 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 flex items-center justify-center text-sm">−</button>
                          <span className="w-5 text-center text-sm">{adults}</span>
                          <button type="button" onClick={() => setAdults(Math.min(6, adults + 1))} className="h-6 w-6 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 flex items-center justify-center text-sm">+</button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">Children</span>
                        <div className="flex items-center gap-1.5">
                          <button type="button" onClick={() => setChildrenAges((p) => p.length > 0 ? p.slice(0, -1) : p)} className="h-6 w-6 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 flex items-center justify-center text-sm">−</button>
                          <span className="w-5 text-center text-sm">{childrenAges.length}</span>
                          <button type="button" onClick={() => setChildrenAges((p) => p.length < 4 ? [...p, 5] : p)} className="h-6 w-6 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 flex items-center justify-center text-sm">+</button>
                        </div>
                      </div>
                      {childrenAges.length > 0 && (
                        <div className="pt-1 border-t border-gray-100">
                          <span className="text-[11px] text-gray-500">Ages</span>
                          <div className="flex gap-1.5 mt-1 flex-wrap">
                            {childrenAges.map((age, i) => (
                              <select key={i} value={age} onChange={(e) => { const n = [...childrenAges]; n[i] = Number(e.target.value); setChildrenAges(n); }} className="rounded border border-gray-300 px-1.5 py-0.5 text-xs">
                                {Array.from({ length: 18 }, (_, a) => (<option key={a} value={a}>{a === 0 ? "<1" : a}</option>))}
                              </select>
                            ))}
                          </div>
                        </div>
                      )}
                      <button type="button" onClick={() => setGuestsDropdownOpen(false)} className="w-full rounded bg-gray-900 py-1 text-xs font-medium text-white hover:bg-gray-800">Done</button>
                    </div>
                  )}
                </div>

                <button onClick={() => void runSearch()} disabled={!canSearch || searching} className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  Search
                </button>
              </div>
            </div>

            {/* Results grouped by hotel */}
            {groupedResults.length > 0 && (
              <div className="flex flex-col" style={{ height: "calc(100vh - 220px)" }}>
                <div className="flex-shrink-0 bg-gray-50 py-2">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Results <span className="ml-2 text-sm font-normal text-gray-500">({groupedResults.length} hotel{groupedResults.length !== 1 ? "s" : ""}, {searchResults.length} rates)</span>
                  </h2>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 -mx-1 px-1">
                {groupedResults.map((hotel) => (
                  <div key={hotel.hid} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    {/* Hotel header */}
                    <div className="flex gap-4 p-4 border-b border-gray-100">
                      <ImageCarousel images={hotel.images} alt={hotel.hotelName} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold text-gray-900 truncate">{hotel.hotelName}</h3>
                          <Stars count={hotel.stars} />
                        </div>
                        {hotel.address && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                            <MapPin size={11} className="flex-shrink-0" />
                            <span className="truncate">{hotel.address}</span>
                          </div>
                        )}
                        <div className="mt-1 text-xs text-gray-400">
                          {hotel.rates.length} rate{hotel.rates.length !== 1 ? "s" : ""} available
                        </div>
                      </div>
                    </div>

                    {/* Rate rows — table-like */}
                    <div className="divide-y divide-gray-100">
                      {/* Column header */}
                      <div className="hidden md:grid grid-cols-[1fr_120px_180px_130px] gap-2 px-4 py-1.5 bg-gray-50 text-[11px] font-medium uppercase tracking-wider text-gray-500">
                        <div>Room</div>
                        <div>Meal</div>
                        <div>Cancellation</div>
                        <div className="text-right">Price</div>
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
                            className={`w-full text-left px-4 py-2.5 md:grid md:grid-cols-[1fr_120px_180px_130px] md:gap-2 md:items-center flex flex-col gap-1 transition-colors cursor-pointer ${isSelected ? "bg-blue-50 ring-1 ring-inset ring-blue-200" : "hover:bg-gray-50"}`}
                          >
                            {/* Room */}
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-gray-900 truncate">{r.roomName || "Standard Room"}</div>
                              {r.beddingType && <div className="text-[11px] text-gray-400 truncate">{r.beddingType}</div>}
                            </div>
                            {/* Meal */}
                            <div><MealInfo meal={r.meal} /></div>
                            {/* Cancellation */}
                            <div><CancellationInfo rate={r} /></div>
                            {/* Price */}
                            <div className="text-right">
                              <div className="text-[11px] text-gray-400">{r.ratehawkAmount} {r.currency}</div>
                              <div className="text-sm font-bold text-gray-900">{applyMarkup(r.ratehawkAmount)} <span className="text-xs font-normal">{r.currency}</span></div>
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
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Create and send offer</h2>
                <p className="text-xs text-gray-500 mb-4">
                  Selected: <strong>{selectedResult.hotelName}</strong> — {selectedResult.roomName} — {applyMarkup(selectedResult.ratehawkAmount)} {selectedResult.currency}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Client Party ID <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="UUID" value={clientPartyId} onChange={(e) => setClientPartyId(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Client Name</label>
                    <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="Full name" value={clientName} onChange={(e) => setClientName(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Client Email</label>
                    <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" type="email" placeholder="client@example.com" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Percent size={13} className="inline mr-1 -mt-0.5" />Markup %
                    </label>
                    <input type="number" min={0} max={100} value={markupPercent} onChange={(e) => setMarkupPercent(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
                    <div className="relative">
                      <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm appearance-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 pr-8" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as "online" | "invoice")}>
                        <option value="online">Online Checkout (Stripe)</option>
                        <option value="invoice">Invoice / Bank Transfer</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Send Channel</label>
                    <div className="relative">
                      <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm appearance-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 pr-8" value={sendChannel} onChange={(e) => setSendChannel(e.target.value as "app" | "email" | "both")}>
                        <option value="both">App + Email</option>
                        <option value="app">App only</option>
                        <option value="email">Email only</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-4">
                  <button onClick={() => void createOffer()} className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors">
                    <Send size={14} /> Create offer and send
                  </button>
                  {selectedResult && (
                    <span className="text-sm text-gray-500">
                      Cost: {selectedResult.ratehawkAmount} {selectedResult.currency} → Client: <strong>{applyMarkup(selectedResult.ratehawkAmount)} {selectedResult.currency}</strong> (+{markup}%)
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== LOGS TAB ==================== */}
        {tab === "logs" && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                  <select className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="all">All statuses</option>
                    {["draft","sent","viewed","confirmed","payment_pending","paid","invoice_pending","booking_started","booking_confirmed","booking_failed","cancelled"].map((s) => (
                      <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Payment mode</label>
                  <select className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value={paymentModeFilter} onChange={(e) => setPaymentModeFilter(e.target.value)}>
                    <option value="all">All</option>
                    <option value="online">Online</option>
                    <option value="invoice">Invoice</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
                  <input className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" type="date" value={dateFromFilter} onChange={(e) => setDateFromFilter(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
                  <input className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" type="date" value={dateToFilter} onChange={(e) => setDateToFilter(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Client</label>
                  <input className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="Name or email" value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-700">Created</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-700">Hotel</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-700">Client</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-700">Amount</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-700">Tariff</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-700">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-700">Payment</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {offersLoading && (
                    <tr><td className="px-4 py-8 text-center text-gray-500" colSpan={8}><Loader2 size={20} className="animate-spin mx-auto mb-2 text-gray-400" />Loading offers...</td></tr>
                  )}
                  {!offersLoading && filteredOffers.map((o) => (
                    <tr key={o.id} className={`cursor-pointer transition-colors ${selectedOfferId === o.id ? "bg-blue-50" : "hover:bg-gray-50"}`} onClick={() => { setSelectedOfferId(o.id); void loadEvents(o.id); }}>
                      <td className="px-4 py-2 whitespace-nowrap text-gray-700">{formatDateDDMMYYYY(o.created_at)}</td>
                      <td className="px-4 py-2 text-gray-900 font-medium">{o.hotel_name}</td>
                      <td className="px-4 py-2 text-gray-700">{o.client_name || o.client_email || "—"}</td>
                      <td className="px-4 py-2 text-gray-900 font-medium whitespace-nowrap">{o.client_amount} {o.currency}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${o.tariff_type === "refundable" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                          {o.tariff_type === "refundable" ? "REF" : "NON-REF"}
                        </span>
                      </td>
                      <td className="px-4 py-2"><StatusBadge status={o.status} /></td>
                      <td className="px-4 py-2 text-xs text-gray-500">{o.payment_mode} / {o.payment_status}</td>
                      <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1.5">
                          <button className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-colors" onClick={() => void startPayment(o.id, o.payment_mode)}>
                            <CreditCard size={12} /> Pay
                          </button>
                          {o.payment_mode === "invoice" && o.payment_status !== "paid" && (
                            <button className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-colors" onClick={() => void triggerBookingAfterInvoice(o.id)}>
                              <FileText size={12} /> Mark paid
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!offersLoading && filteredOffers.length === 0 && (
                    <tr><td className="px-4 py-8 text-center text-gray-500" colSpan={8}>No offers matching filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {selectedOfferId && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Event timeline</h3>
                {events.length === 0 ? (
                  <p className="text-xs text-gray-500">No events logged yet.</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {events.map((event) => (
                      <div key={event.id} className="rounded-lg border border-gray-200 px-4 py-2.5 bg-gray-50">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-800">{event.event_type.replace(/_/g, " ")}</span>
                          <span className="text-xs text-gray-500">{formatDateDDMMYYYY(event.created_at)}</span>
                        </div>
                        {Object.keys(event.event_payload).length > 0 && (
                          <pre className="mt-1 text-[11px] text-gray-600 whitespace-pre-wrap">{JSON.stringify(event.event_payload, null, 2)}</pre>
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
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: "Confirmed", status: "booking_confirmed", color: "bg-green-50 border-green-200 text-green-700" },
                { label: "In Progress", status: "booking_started", color: "bg-purple-50 border-purple-200 text-purple-700" },
                { label: "Failed", status: "booking_failed", color: "bg-red-50 border-red-200 text-red-700" },
              ].map((item) => {
                const count = offers.filter((o) => o.status === item.status).length;
                return (
                  <div key={item.status} className={`rounded-lg border p-5 ${item.color}`}>
                    <div className="text-sm font-medium">{item.label}</div>
                    <div className="text-3xl font-bold mt-1">{count}</div>
                  </div>
                );
              })}
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-700">Hotel</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-700">Client</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-700">Dates</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-700">Amount</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-700">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-700">Partner Order</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {offers.filter((o) => ["booking_confirmed", "booking_started", "booking_failed"].includes(o.status)).map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-900 font-medium">{o.hotel_name}</td>
                      <td className="px-4 py-2 text-gray-700">{o.client_name || "—"}</td>
                      <td className="px-4 py-2 text-gray-700 whitespace-nowrap">{formatDateDDMMYYYY(o.check_in)} — {formatDateDDMMYYYY(o.check_out)}</td>
                      <td className="px-4 py-2 text-gray-900 font-medium">{o.client_amount} {o.currency}</td>
                      <td className="px-4 py-2"><StatusBadge status={o.status} /></td>
                      <td className="px-4 py-2 text-xs text-gray-500 font-mono">{o.partner_order_id || "—"}</td>
                    </tr>
                  ))}
                  {offers.filter((o) => ["booking_confirmed", "booking_started", "booking_failed"].includes(o.status)).length === 0 && (
                    <tr><td className="px-4 py-8 text-center text-gray-500" colSpan={6}>No bookings yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
