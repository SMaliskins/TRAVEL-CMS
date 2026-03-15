"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Plane,
  ArrowRight,
  ArrowLeftRight,
  Search,
  Loader2,
  Clock,
  Users,
  ChevronDown,
  X,
  AlertCircle,
  ExternalLink,
  FileText,
  CheckCircle,
  UserSearch,
} from "lucide-react";
import "../hotels-booking/modern-booking.css";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AirportLocation {
  iataCode: string;
  name: string;
  cityName?: string;
  countryCode?: string;
  subType: string;
}

interface FlightSegment {
  departure: { iataCode: string; at: string; terminal?: string };
  arrival: { iataCode: string; at: string; terminal?: string };
  carrierCode: string;
  number: string;
  aircraft?: { code: string };
  numberOfStops: number;
  duration: string;
}

interface FlightItinerary {
  duration: string;
  segments: FlightSegment[];
}

interface FlightOffer {
  id: string;
  itineraries: FlightItinerary[];
  price: { currency: string; total: string; base: string };
  numberOfBookableSeats?: number;
  lastTicketingDate?: string;
  deepLink?: string | null;
  bookingToken?: string | null;
  quality?: number | null;
}

interface Dictionaries {
  carriers?: Record<string, string>;
  aircraft?: Record<string, string>;
}

interface DirectoryContact {
  id: string;
  display_name?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

type TripType = "oneWay" | "roundTrip";
type TravelClass = "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDuration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return iso;
  const h = match[1] ? `${match[1]}h` : "";
  const m = match[2] ? `${match[2]}m` : "";
  return [h, m].filter(Boolean).join(" ");
}

function formatTime(isoDateTime: string): string {
  const d = new Date(isoDateTime);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatDateShort(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function nextWeekStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split("T")[0];
}

const CLASS_LABELS: Record<TravelClass, string> = {
  ECONOMY: "Economy",
  PREMIUM_ECONOMY: "Prem. Economy",
  BUSINESS: "Business",
  FIRST: "First",
};

// ─── Airport Input Component ─────────────────────────────────────────────────

function AirportInput({
  label,
  value,
  iataCode,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  iataCode: string;
  onChange: (name: string, code: string) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<AirportLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(iataCode ? `${value} (${iataCode})` : value);
  }, [value, iataCode]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/flights/airports?q=${encodeURIComponent(q)}`, {
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        setSuggestions(json.data || []);
        setOpen(true);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  const handleChange = (q: string) => {
    setQuery(q);
    onChange("", "");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 300);
  };

  const handleSelect = (loc: AirportLocation) => {
    const cityName = loc.cityName || loc.name;
    onChange(cityName, loc.iataCode);
    setQuery(`${cityName} (${loc.iataCode})`);
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <div className="relative">
        <Plane size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="booking-input pl-9 pr-8 w-full"
        />
        {loading && (
          <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
        )}
        {iataCode && !loading && (
          <button
            onClick={() => { onChange("", ""); setQuery(""); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 booking-glass-panel rounded-xl overflow-hidden shadow-xl max-h-60 overflow-y-auto">
          {suggestions.map((loc) => (
            <button
              key={`${loc.iataCode}-${loc.subType}`}
              onMouseDown={() => handleSelect(loc)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50/70 transition-colors text-left"
            >
              <span className="font-mono text-sm font-bold text-indigo-600 w-10 shrink-0">
                {loc.iataCode}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {loc.cityName || loc.name}
                </div>
                <div className="text-xs text-gray-400 truncate">
                  {loc.subType === "AIRPORT" ? loc.name : "City"} · {loc.countryCode}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Flight Card ─────────────────────────────────────────────────────────────

function FlightCard({
  offer,
  dictionaries,
  onCreateOffer,
}: {
  offer: FlightOffer;
  dictionaries: Dictionaries;
  onCreateOffer: (offer: FlightOffer) => void;
}) {
  const isRound = offer.itineraries.length > 1;

  const renderItinerary = (itin: FlightItinerary, idx: number) => {
    const firstSeg = itin.segments[0];
    const lastSeg = itin.segments[itin.segments.length - 1];
    const stops = itin.segments.length - 1;
    const carrier = firstSeg.carrierCode;
    const carrierName = dictionaries.carriers?.[carrier] || carrier;
    const depDate = firstSeg.departure.at.split("T")[0];

    return (
      <div key={idx} className={`flex items-center gap-4 ${idx > 0 ? "pt-3 mt-3 border-t border-gray-100" : ""}`}>
        {/* Airline */}
        <div className="flex flex-col items-center gap-1 w-20 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
            {carrier}
          </div>
          <span className="text-[10px] text-gray-400 text-center leading-tight">{carrierName}</span>
        </div>

        {/* Departure */}
        <div className="text-center shrink-0">
          <div className="text-xl font-bold text-gray-900">{formatTime(firstSeg.departure.at)}</div>
          <div className="text-sm font-semibold text-indigo-600">{firstSeg.departure.iataCode}</div>
          <div className="text-xs text-gray-400">{formatDateShort(depDate)}</div>
          {firstSeg.departure.terminal && (
            <div className="text-[10px] text-gray-400">T{firstSeg.departure.terminal}</div>
          )}
        </div>

        {/* Duration & stops */}
        <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <div className="text-xs text-gray-500">{parseDuration(itin.duration)}</div>
          <div className="relative w-full flex items-center">
            <div className="h-px flex-1 bg-gray-200" />
            <Plane size={14} className="text-indigo-400 mx-1 shrink-0" />
            <div className="h-px flex-1 bg-gray-200" />
          </div>
          {stops === 0 ? (
            <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">
              Direct
            </span>
          ) : (
            <span className="text-[10px] font-medium text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">
              {stops} stop{stops > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Arrival */}
        <div className="text-center shrink-0">
          <div className="text-xl font-bold text-gray-900">{formatTime(lastSeg.arrival.at)}</div>
          <div className="text-sm font-semibold text-indigo-600">{lastSeg.arrival.iataCode}</div>
          <div className="text-xs text-gray-400">{formatDateShort(lastSeg.arrival.at.split("T")[0])}</div>
          {lastSeg.arrival.terminal && (
            <div className="text-[10px] text-gray-400">T{lastSeg.arrival.terminal}</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="booking-glass-panel rounded-2xl p-4 hover:shadow-lg transition-shadow">
      <div className="flex items-start gap-4">
        {/* Itineraries */}
        <div className="flex-1 min-w-0">
          {offer.itineraries.map((itin, idx) => renderItinerary(itin, idx))}
          {isRound && (
            <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
              <ArrowLeftRight size={12} />
              <span>Round trip</span>
            </div>
          )}
        </div>

        {/* Price */}
        <div className="flex flex-col items-end gap-2 shrink-0 pl-4 border-l border-gray-100">
          <div className="text-2xl font-bold text-gray-900">
            {Number(offer.price.total).toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            <span className="text-sm font-normal text-gray-500 ml-1">{offer.price.currency}</span>
          </div>
          <div className="text-xs text-gray-400">per person</div>
          {offer.numberOfBookableSeats && offer.numberOfBookableSeats <= 5 && (
            <span className="text-[10px] font-medium text-red-500 bg-red-50 rounded-full px-2 py-0.5">
              {offer.numberOfBookableSeats} seats left
            </span>
          )}
          <button
            onClick={() => onCreateOffer(offer)}
            className="w-full text-xs px-3 py-1.5 flex items-center justify-center gap-1 mt-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-medium"
          >
            <FileText size={11} />
            Create Offer
          </button>
          {offer.deepLink && (
            <a
              href={offer.deepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1 flex items-center justify-center gap-1 text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              Kiwi.com
              <ExternalLink size={10} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Create Offer Modal ──────────────────────────────────────────────────────

function CreateOfferModal({
  offer,
  dictionaries,
  travelClass,
  onClose,
}: {
  offer: FlightOffer;
  dictionaries: Dictionaries;
  travelClass: TravelClass;
  onClose: () => void;
}) {
  const router = useRouter();
  const [clientQuery, setClientQuery] = useState("");
  const [clients, setClients] = useState<DirectoryContact[]>([]);
  const [selectedClient, setSelectedClient] = useState<DirectoryContact | null>(null);
  const [clientPrice, setClientPrice] = useState(offer.price.total);
  const [searchLoading, setSearchLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ orderCode: string } | null>(null);
  const [offerError, setOfferError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const searchClients = useCallback(async (q: string) => {
    if (q.length < 2) { setClients([]); return; }
    setSearchLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/directory?search=${encodeURIComponent(q)}&limit=8`, {
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        setClients(json.data || json || []);
      }
    } catch { /* silent */ }
    setSearchLoading(false);
  }, []);

  const handleClientSearch = (q: string) => {
    setClientQuery(q);
    setSelectedClient(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchClients(q), 300);
  };

  const handleSelectClient = (c: DirectoryContact) => {
    setSelectedClient(c);
    const displayName = c.display_name || c.name || [c.first_name, c.last_name].filter(Boolean).join(" ");
    setClientQuery(displayName);
    setClients([]);
  };

  const buildFlightName = () => {
    const firstItin = offer.itineraries[0];
    if (!firstItin) return "Flight";
    const firstSeg = firstItin.segments[0];
    const lastSeg = firstItin.segments[firstItin.segments.length - 1];
    const carrier = dictionaries.carriers?.[firstSeg.carrierCode] || firstSeg.carrierCode;
    const isRound = offer.itineraries.length > 1;
    return `${carrier} ${firstSeg.departure.iataCode}→${lastSeg.arrival.iataCode}${isRound ? " RT" : ""}`;
  };

  const buildFlightSegments = () => {
    return offer.itineraries.flatMap((itin, itinIdx) =>
      itin.segments.map((seg) => ({
        departure: seg.departure.iataCode,
        arrival: seg.arrival.iataCode,
        departureTime: seg.departure.at,
        arrivalTime: seg.arrival.at,
        carrier: seg.carrierCode,
        flightNumber: `${seg.carrierCode}${seg.number}`,
        aircraft: seg.aircraft?.code || null,
        direction: itinIdx === 0 ? "outbound" : "return",
      }))
    );
  };

  const handleCreate = async () => {
    if (!selectedClient) { setOfferError("Please select a client"); return; }
    setCreating(true);
    setOfferError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session) headers.Authorization = `Bearer ${session.access_token}`;

      // 1. Get current user profile for agent initials
      const profileRes = await fetch("/api/profile", { headers });
      const profile = profileRes.ok ? await profileRes.json() : {};
      const agentInitials = profile.initials || profile.name?.slice(0, 2)?.toUpperCase() || "XX";

      const firstSeg = offer.itineraries[0]?.segments[0];
      const lastItin = offer.itineraries[offer.itineraries.length - 1];
      const lastSeg = lastItin?.segments[lastItin.segments.length - 1];

      // 2. Create order
      const orderRes = await fetch("/api/orders/create", {
        method: "POST",
        headers,
        body: JSON.stringify({
          clientPartyId: selectedClient.id,
          orderType: "NON",
          ownerAgent: agentInitials,
          cities: [firstSeg?.departure.iataCode, lastSeg?.arrival.iataCode].filter(Boolean),
          countries: [],
          checkIn: firstSeg?.departure.at?.split("T")[0] || null,
          return: lastSeg?.arrival.at?.split("T")[0] || null,
        }),
      });

      if (!orderRes.ok) {
        const err = await orderRes.json();
        throw new Error(err.error || "Failed to create order");
      }

      const { order_number: orderCode } = await orderRes.json();

      // 3. Add flight service to the order
      const serviceRes = await fetch(`/api/orders/${orderCode}/services`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          category: "Flight",
          serviceName: buildFlightName(),
          dateFrom: firstSeg?.departure.at?.split("T")[0] || null,
          dateTo: lastSeg?.arrival.at?.split("T")[0] || null,
          servicePrice: parseFloat(offer.price.total),
          clientPrice: parseFloat(clientPrice),
          cabinClass: travelClass.toLowerCase(),
          flightSegments: buildFlightSegments(),
          resStatus: "pending",
          clientPartyId: selectedClient.id,
          clientName: selectedClient.display_name || selectedClient.name || [selectedClient.first_name, selectedClient.last_name].filter(Boolean).join(" "),
        }),
      });

      if (!serviceRes.ok) {
        const err = await serviceRes.json();
        throw new Error(err.error || "Failed to add flight service");
      }

      setCreated({ orderCode });
    } catch (e) {
      setOfferError(e instanceof Error ? e.message : "Failed to create offer");
    }

    setCreating(false);
  };

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={handleBackdrop}
    >
      <div className="booking-glass-panel rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileText size={20} className="text-indigo-500" />
            Create Offer
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {created ? (
          /* ─── Success state ─── */
          <div className="text-center py-4 space-y-3">
            <CheckCircle size={48} className="mx-auto text-emerald-500" />
            <p className="text-sm text-gray-700">
              Order <span className="font-semibold">{created.orderCode}</span> created with flight service!
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => router.push(`/orders/${created.orderCode}`)}
                className="booking-btn-primary text-sm px-4 py-2"
              >
                Open Order
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          /* ─── Form ─── */
          <>
            {/* Flight summary */}
            <div className="bg-indigo-50/50 rounded-xl p-3 text-sm">
              <div className="font-medium text-gray-900">{buildFlightName()}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {parseDuration(offer.itineraries[0]?.duration || "")} · {offer.price.total} {offer.price.currency}
              </div>
            </div>

            {/* Client search */}
            <div ref={dropdownRef} className="relative">
              <label className="block text-xs font-medium text-gray-500 mb-1">Client</label>
              <div className="relative">
                <UserSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" />
                <input
                  type="text"
                  value={clientQuery}
                  onChange={(e) => handleClientSearch(e.target.value)}
                  placeholder="Search client by name..."
                  className="booking-input pl-9 pr-8 w-full"
                />
                {searchLoading && (
                  <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
                )}
                {selectedClient && (
                  <button
                    onClick={() => { setSelectedClient(null); setClientQuery(""); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              {clients.length > 0 && !selectedClient && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 booking-glass-panel rounded-xl overflow-hidden shadow-xl max-h-48 overflow-y-auto">
                  {clients.map((c) => {
                    const name = c.display_name || c.name || [c.first_name, c.last_name].filter(Boolean).join(" ");
                    return (
                      <button
                        key={c.id}
                        onMouseDown={() => handleSelectClient(c)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50/70 transition-colors text-left"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{name}</div>
                          {c.email && <div className="text-xs text-gray-400 truncate">{c.email}</div>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Client price */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Client Price (EUR)</label>
              <input
                type="number"
                value={clientPrice}
                onChange={(e) => setClientPrice(e.target.value)}
                step="0.01"
                min="0"
                className="booking-input w-full"
              />
              <div className="text-xs text-gray-400 mt-1">
                Cost: {offer.price.total} {offer.price.currency} · Markup:{" "}
                {(parseFloat(clientPrice) - parseFloat(offer.price.total)).toFixed(2)} {offer.price.currency}
              </div>
            </div>

            {/* Error */}
            {offerError && (
              <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {offerError}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={creating || !selectedClient}
                className="booking-btn-primary flex-1 py-2.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? (
                  <><Loader2 size={16} className="animate-spin" /> Creating...</>
                ) : (
                  <><FileText size={16} /> Create Offer</>
                )}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FlightsPage() {
  const [tripType, setTripType] = useState<TripType>("oneWay");
  const [originName, setOriginName] = useState("");
  const [originCode, setOriginCode] = useState("");
  const [destName, setDestName] = useState("");
  const [destCode, setDestCode] = useState("");
  const [departureDate, setDepartureDate] = useState(todayStr());
  const [returnDate, setReturnDate] = useState(nextWeekStr());
  const [adults, setAdults] = useState(1);
  const [travelClass, setTravelClass] = useState<TravelClass>("ECONOMY");
  const [classOpen, setClassOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<FlightOffer[]>([]);
  const [dictionaries, setDictionaries] = useState<Dictionaries>({});
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [offerFlight, setOfferFlight] = useState<FlightOffer | null>(null);

  const handleSwap = () => {
    setOriginName(destName); setOriginCode(destCode);
    setDestName(originName); setDestCode(originCode);
  };

  const handleSearch = async () => {
    if (!originCode || !destCode || !departureDate) {
      setError("Please select origin, destination, and departure date.");
      return;
    }
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/flights/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          origin: originCode,
          destination: destCode,
          departureDate,
          returnDate: tripType === "roundTrip" ? returnDate : undefined,
          adults,
          travelClass,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Search failed");
        if (json.setup) setError(json.error);
      } else {
        setResults(json.data || []);
        setDictionaries(json.dictionaries || {});
        setSearched(true);
        if ((json.data || []).length === 0) {
          setError("No flights found for this route and date. Try different dates or nearby airports.");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    }

    setLoading(false);
  };

  return (
    <div className="booking-modern-container">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="booking-modern-header !mb-0">
          <div>
            <h1 className="booking-header-title">Flight Search</h1>
            <p className="booking-header-subtitle mt-1">
              Find flights via Kiwi.com
            </p>
          </div>
        </div>

        {/* Search Panel */}
        <div className="booking-glass-panel rounded-2xl p-6 space-y-4">
          {/* Trip type + class */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-xl overflow-hidden border border-gray-200/70">
              {(["oneWay", "roundTrip"] as TripType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTripType(t)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    tripType === t
                      ? "bg-indigo-600 text-white"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {t === "oneWay" ? "One Way" : "Round Trip"}
                </button>
              ))}
            </div>

            {/* Travel class */}
            <div className="relative">
              <button
                onClick={() => setClassOpen((o) => !o)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-200/70 rounded-xl hover:bg-gray-50 transition-colors"
              >
                {CLASS_LABELS[travelClass]}
                <ChevronDown size={14} />
              </button>
              {classOpen && (
                <div className="absolute top-full mt-1 left-0 z-50 booking-glass-panel rounded-xl overflow-hidden shadow-lg min-w-max">
                  {(Object.keys(CLASS_LABELS) as TravelClass[]).map((c) => (
                    <button
                      key={c}
                      onClick={() => { setTravelClass(c); setClassOpen(false); }}
                      className={`w-full px-4 py-2 text-sm text-left hover:bg-indigo-50 transition-colors ${
                        travelClass === c ? "text-indigo-600 font-medium" : "text-gray-700"
                      }`}
                    >
                      {CLASS_LABELS[c]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Passengers */}
            <div className="flex items-center gap-2 border border-gray-200/70 rounded-xl px-3 py-2">
              <Users size={15} className="text-gray-400" />
              <button
                onClick={() => setAdults(Math.max(1, adults - 1))}
                className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium transition-colors flex items-center justify-center"
              >
                −
              </button>
              <span className="text-sm font-medium text-gray-800 w-4 text-center">{adults}</span>
              <button
                onClick={() => setAdults(Math.min(9, adults + 1))}
                className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium transition-colors flex items-center justify-center"
              >
                +
              </button>
              <span className="text-sm text-gray-500">pax</span>
            </div>
          </div>

          {/* Route inputs */}
          <div className="flex flex-wrap items-end gap-2">
            <AirportInput
              label="From"
              value={originName}
              iataCode={originCode}
              onChange={(name, code) => { setOriginName(name); setOriginCode(code); }}
              placeholder="City or airport..."
            />

            {/* Swap button */}
            <button
              onClick={handleSwap}
              className="w-10 h-10 mb-[1px] rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-600 flex items-center justify-center transition-colors shrink-0"
              title="Swap airports"
            >
              <ArrowLeftRight size={16} />
            </button>

            <AirportInput
              label="To"
              value={destName}
              iataCode={destCode}
              onChange={(name, code) => { setDestName(name); setDestCode(code); }}
              placeholder="City or airport..."
            />
          </div>

          {/* Dates */}
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">Departure</label>
              <input
                type="date"
                value={departureDate}
                min={todayStr()}
                onChange={(e) => setDepartureDate(e.target.value)}
                className="booking-input w-full"
              />
            </div>
            {tripType === "roundTrip" && (
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs font-medium text-gray-500 mb-1">Return</label>
                <input
                  type="date"
                  value={returnDate}
                  min={departureDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="booking-input w-full"
                />
              </div>
            )}
          </div>

          {/* Search button */}
          <button
            onClick={handleSearch}
            disabled={loading || !originCode || !destCode}
            className="booking-btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <><Loader2 size={18} className="animate-spin" /> Searching...</>
            ) : (
              <><Search size={18} /> Search Flights</>
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div>
              <p>{error}</p>
              {error.includes("KIWI_TEQUILA_API_KEY") && (
                <p className="mt-2 text-xs text-red-500">
                  Register at{" "}
                  <a href="https://tequila.kiwi.com" target="_blank" rel="noopener noreferrer" className="underline">
                    tequila.kiwi.com
                  </a>{" "}
                  → get your API key → add KIWI_TEQUILA_API_KEY to Vercel environment variables.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {results.length} flight{results.length !== 1 ? "s" : ""} found
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Clock size={12} />
                <span>Prices per person · {CLASS_LABELS[travelClass]}</span>
              </div>
            </div>

            {results.map((offer) => (
              <FlightCard
                key={offer.id}
                offer={offer}
                dictionaries={dictionaries}
                onCreateOffer={setOfferFlight}
              />
            ))}
          </div>
        )}

        {/* Empty state after search */}
        {searched && results.length === 0 && !error && !loading && (
          <div className="booking-glass-panel rounded-2xl p-12 text-center">
            <Plane size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No flights found. Try different dates or airports.</p>
          </div>
        )}

        {/* Initial state */}
        {!searched && !loading && (
          <div className="booking-glass-panel rounded-2xl p-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
              <Plane size={32} className="text-indigo-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-1">Search for flights</h3>
            <p className="text-sm text-gray-400">
              Enter origin, destination and dates to find available flights via Kiwi.com.
            </p>
          </div>
        )}
      </div>

      {/* Create Offer Modal */}
      {offerFlight && (
        <CreateOfferModal
          offer={offerFlight}
          dictionaries={dictionaries}
          travelClass={travelClass}
          onClose={() => setOfferFlight(null)}
        />
      )}
    </div>
  );
}
