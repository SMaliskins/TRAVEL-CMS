"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import PartySelect from "@/components/PartySelect";
import DateRangePicker from "@/components/DateRangePicker";
import HotelSuggestInput from "@/components/HotelSuggestInput";
import ClientMultiSelectDropdown from "@/components/ClientMultiSelectDropdown";
import AddAccompanyingModal from "./AddAccompanyingModal";
import FlightItineraryInput, { FlightSegment } from "@/components/FlightItineraryInput";
import { parseFlightBooking, getAirportTimezoneOffset } from "@/lib/flights/airlineParsers";
import { getCityByIATA } from "@/lib/data/cities";
import { useEscapeKey } from '@/lib/hooks/useEscapeKey';
import { useDraggableModal } from '@/hooks/useDraggableModal';
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { formatDateDDMMYYYY, formatDateShort, segmentDisplayArrivalDate, normalizeSegmentsArrivalYear, nightsBetween } from "@/utils/dateFormat";
import { toTitleCaseForDisplay } from "@/utils/nameFormat";
import DateInput from "@/components/DateInput";
import type { SupplierCommission } from "@/lib/types/directory";
import { Hotel, Link2, Sparkles } from "lucide-react";
import { sanitizeNumber, sanitizeDecimalInput } from "@/utils/sanitizeNumber";
import LinkedServicesModal from "./LinkedServicesModal";
import { useModalOverlay } from "@/contexts/ModalOverlayContext";
import { formatApiErrorResponse } from "@/lib/http/formatApiError";
import { normalizeCategoryIdForDb } from "@/lib/orders/normalizeCategoryIdForDb";

const CUSTOM_ROOMS_KEY = "travel-cms-custom-rooms";
const CUSTOM_BOARDS_KEY = "travel-cms-custom-boards";

/** Parse price string; ignores spaces (e.g. "1 485.55" -> 1485.55). */
function parsePrice(s: string | null | undefined): number {
  if (s == null || s === "") return 0;
  const cleaned = String(s).replace(/\s/g, "");
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? 0 : n;
}

const BOARD_LABELS: Record<string, string> = {
  room_only: "Room only",
  breakfast: "Breakfast",
  half_board: "Half board",
  full_board: "Full board",
  all_inclusive: "AI (All inclusive)",
  uai: "UAI (Ultra All Inclusive)",
};

interface TransferRouteData {
  id: string;
  pickup: string;
  pickupType: "airport" | "hotel" | "address";
  pickupMeta?: { iata?: string; hid?: number; lat?: number; lon?: number };
  dropoff: string;
  dropoffType: "airport" | "hotel" | "address";
  dropoffMeta?: { iata?: string; hid?: number; lat?: number; lon?: number };
  pickupTime?: string;
  distanceKm?: number;
  durationMin?: number;
  linkedFlightId?: string;
  linkedSegmentIndex?: number;
}

interface LocationSuggestionAdd {
  type: "airport" | "hotel" | "region";
  label: string;
  meta: { iata?: string; hid?: number; regionId?: number; lat?: number; lon?: number; country?: string };
}

interface AddServiceModalProps {
  orderCode: string;
  // Default client from order
  defaultClientId?: string | null;
  defaultClientName?: string;
  orderDateFrom?: string | null;
  orderDateTo?: string | null;
  /** When set, category is fixed and selector is hidden (opened from "What service?" step) */
  initialCategoryId?: string | null;
  /** Type/name/vat from parent so modal opens with correct category when id is API UUID (not in fallback) */
  initialCategoryType?: string | null;
  initialCategoryName?: string | null;
  initialVatRate?: number | null;
  /** Transfer type chosen from popup (One way / Return / By hour) for correct Linked Services suggestions */
  initialTransferBookingType?: "one_way" | "return" | "by_hour" | null;
  /** Airport service sub-type chosen from popup (Meet & Greet / Fast Track) */
  initialAirportServiceType?: "meet_and_greet" | "fast_track" | null;
  /** Company default currency from Company Settings / Regional Settings / Currency */
  companyCurrencyCode?: string;
  flightServices?: { id: string; name: string; flightSegments: FlightSegment[] }[];
  hotelServices?: { id: string; hotelName?: string; dateFrom?: string; dateTo?: string }[];
  /** Order travellers to suggest first for Client, Payer, Supplier */
  orderTravellers?: { id: string; firstName?: string; lastName?: string; avatarUrl?: string | null }[];
  /** Default payer from existing services in this order */
  defaultPayerId?: string | null;
  defaultPayerName?: string;
  /** Pre-selected parent service ID for ancillary add-on */
  initialAncillaryParentId?: string | null;
  onClose: () => void;
  onServiceAdded: (service: ServiceData) => void;
}

// Functional types that determine which features are available
type CategoryType = 'flight' | 'hotel' | 'transfer' | 'tour' | 'insurance' | 'visa' | 'rent_a_car' | 'cruise' | 'ancillary' | 'other';

interface ServiceCategory {
  id: string;
  name: string;
  type: CategoryType;
  vat_rate: number;
  is_active: boolean;
}

export interface ServiceData {
  id: string;
  category: string;
  categoryId?: string | null; // UUID reference to travel_service_categories
  categoryType?: CategoryType; // Functional type for conditional logic
  serviceName: string;
  dateFrom: string;
  dateTo: string;
  supplierPartyId: string | null;
  supplierName: string;
  clientPartyId: string | null;
  clientName: string;
  clients?: { partyId: string; name: string }[]; // Multiple clients
  payerPartyId: string | null;
  payerName: string;
  servicePrice: number;
  clientPrice: number;
  quantity?: number; // Units/nights (from API response when adding service)
  vatRate: number; // 0 or 21
  resStatus: "draft" | "booked" | "confirmed" | "changed" | "rejected" | "cancelled";
  refNr: string;
  ticketNr: string; // Legacy single ticket
  ticketNumbers?: { clientId: string; clientName: string; ticketNr: string }[]; // Array of tickets per client
  travellerIds: string[];
  invoice_id?: string | null;
  // Payment deadline fields
  paymentDeadlineDeposit?: string | null;
  paymentDeadlineFinal?: string | null;
  paymentTerms?: string | null;
  // Hotel-specific
  hotelName?: string;
  hotelStarRating?: string | null;
  hotelRoom?: string | null;
  hotelBoard?: string | null;
  mealPlanText?: string | null;
  hotelAddress?: string;
  hotelPhone?: string;
  hotelEmail?: string;
  // Tour-specific
  transferType?: string | null;
  additionalServices?: string | null;
  // Transfer-specific (legacy flat)
  pickupLocation?: string;
  dropoffLocation?: string;
  pickupTime?: string;
  estimatedDuration?: string;
  linkedFlightId?: string;
  // Transfer-specific (new structured)
  transferRoutes?: TransferRouteData[];
  transferMode?: string | null;
  vehicleClass?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  driverNotes?: string | null;
  // Flight-specific
  flightSegments?: FlightSegment[];
  boardingPasses?: { id: string; fileName: string; fileUrl: string; clientId: string; clientName: string; uploadedAt: string }[];
  baggage?: string; // Baggage allowance
  cabinClass?: "economy" | "premium_economy" | "business" | "first";
  airlineChannel?: boolean;
  airlineChannelSupplierId?: string | null;
  airlineChannelSupplierName?: string;
  // Split-specific
  isSplit?: boolean;
  splitGroupId?: string | null;
  splitIndex?: number | null;
  splitTotal?: number | null;
  // Terms & Conditions
  priceType?: "ebd" | "regular" | "spo" | null;
  refundPolicy?: "non_ref" | "refundable" | "fully_ref" | null;
  freeCancellationUntil?: string | null;
  cancellationPenaltyAmount?: number | null;
  cancellationPenaltyPercent?: number | null;
  changeFee?: number | null; // Airline change fee (for Flights)
  // Amendment fields (change/cancellation)
  parentServiceId?: string | null;
  serviceType?: "original" | "change" | "cancellation";
  cancellationFee?: number | null;
  refundAmount?: number | null;
  // Tour (Package Tour) pricing
  commissionName?: string | null;
  commissionRate?: number | null;
  commissionAmount?: number | null;
  agentDiscountValue?: number | null;
  agentDiscountType?: "%" | "€" | null;
}

// Fallback categories used when API is not available
const FALLBACK_CATEGORIES: ServiceCategory[] = [
  { id: 'fallback-flight', name: 'Flight', type: 'flight', vat_rate: 0, is_active: true },
  { id: 'fallback-hotel', name: 'Hotel', type: 'hotel', vat_rate: 21, is_active: true },
  { id: 'fallback-transfer', name: 'Transfer', type: 'transfer', vat_rate: 21, is_active: true },
  { id: 'fallback-tour', name: 'Tour', type: 'tour', vat_rate: 21, is_active: true },
  { id: 'fallback-insurance', name: 'Insurance', type: 'insurance', vat_rate: 21, is_active: true },
  { id: 'fallback-visa', name: 'Visa', type: 'visa', vat_rate: 21, is_active: true },
  { id: 'fallback-rent_a_car', name: 'Rent a Car', type: 'rent_a_car', vat_rate: 21, is_active: true },
  { id: 'fallback-cruise', name: 'Cruise', type: 'cruise', vat_rate: 21, is_active: true },
  { id: 'fallback-other', name: 'Other', type: 'other', vat_rate: 21, is_active: true },
];

const RES_STATUS_OPTIONS: { value: ServiceData["resStatus"]; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "booked", label: "Booked" },
  { value: "confirmed", label: "Confirmed" },
  { value: "changed", label: "Changed" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

const VALID_CATEGORY_TYPES: CategoryType[] = ["flight", "hotel", "transfer", "tour", "insurance", "visa", "rent_a_car", "cruise", "other"];

/** Categories that show Basic Info + Parties tabs (CLIENTS & PAYER, Supplier) */
const CATEGORIES_WITH_PARTIES_TAB: CategoryType[] = ["tour", "other", "transfer", "visa", "insurance", "rent_a_car", "cruise"];

function getCurrencySymbol(code: string): string {
  const c = (code || "EUR").trim().toUpperCase() || "EUR";
  try {
    const parts = new Intl.NumberFormat(undefined, { style: "currency", currency: c, currencyDisplay: "symbol" }).formatToParts(0);
    return parts.find((p: { type: string }) => p.type === "currency")?.value ?? c;
  } catch {
    return c;
  }
}

export default function AddServiceModal({ 
  orderCode,
  defaultClientId,
  defaultClientName,
  orderDateFrom,
  orderDateTo,
  initialCategoryId,
  initialCategoryType,
  initialCategoryName,
  initialVatRate,
  initialTransferBookingType,
  initialAirportServiceType,
  companyCurrencyCode = "EUR",
  flightServices = [],
  hotelServices = [],
  orderTravellers = [],
  defaultPayerId,
  defaultPayerName,
  initialAncillaryParentId,
  onClose,
  onServiceAdded
}: AddServiceModalProps) {
  useModalOverlay();
  const currencySymbol = getCurrencySymbol(companyCurrencyCode);
  const categoryLocked = !!initialCategoryId;
  console.log('🚀 AddServiceModal mounted with:', {
    defaultClientId,
    defaultClientName,
    orderDateFrom,
    orderDateTo,
    initialCategoryId,
    initialCategoryType,
    initialCategoryName,
    categoryLocked,
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Categories: show fallback immediately when category is locked so form opens without Loading
  const [categories, setCategories] = useState<ServiceCategory[]>(() =>
    categoryLocked ? FALLBACK_CATEGORIES : []
  );
  const [categoriesLoading, setCategoriesLoading] = useState(() => !categoryLocked);
  const [categoryId, setCategoryId] = useState<string | null>(() => {
    if (!initialCategoryId) return null;
    // Always use initialCategoryId so we never show wrong category (e.g. Flight when user chose Package Tour)
    return initialCategoryId;
  });
  const [categoryType, setCategoryType] = useState<CategoryType>(() => {
    if (!initialCategoryId) return 'flight';
    const matched = FALLBACK_CATEGORIES.find(c => c.id === initialCategoryId);
    if (matched) {
      return (matched.type || "other") as CategoryType;
    }
    const raw = initialCategoryType && VALID_CATEGORY_TYPES.includes(initialCategoryType as CategoryType)
      ? initialCategoryType
      : "other";
    return (typeof raw === "string" ? raw.toLowerCase() : "other") as CategoryType;
  });

  // Form state
  const [category, setCategory] = useState(() => {
    if (!initialCategoryId) return "";
    const matched = FALLBACK_CATEGORIES.find(c => c.id === initialCategoryId);
    if (matched) return matched.name;
    return (initialCategoryName ?? "") as string;
  });
  const [serviceName, setServiceName] = useState(
    initialAirportServiceType === "meet_and_greet" ? "Meet & Greet" :
    initialAirportServiceType === "fast_track" ? "Fast Track" : ""
  );
  const [dateFrom, setDateFrom] = useState<string | undefined>(orderDateFrom || undefined);
  const [dateTo, setDateTo] = useState<string | undefined>(orderDateTo || undefined);
  const [supplierPartyId, setSupplierPartyId] = useState<string | null>(null);
  const [supplierName, setSupplierName] = useState("");
  const [airlineChannel, setAirlineChannel] = useState(false);
  const [airlineChannelSupplierId, setAirlineChannelSupplierId] = useState<string | null>(null);
  const [airlineChannelSupplierName, setAirlineChannelSupplierName] = useState("");
  
  // Multiple clients support
  interface ClientEntry {
    id: string | null;
    name: string;
    parseUnmatched?: boolean;
  }
  const [clients, setClients] = useState<ClientEntry[]>(() => {
    // Initialize with default client from Order (requires both id and name)
    if (defaultClientId && defaultClientName) {
      console.log('🔧 Initializing clients with default:', { 
        id: defaultClientId, 
        name: defaultClientName 
      });
      return [{ id: defaultClientId, name: defaultClientName }];
    }
    return [{ id: null, name: "" }];
  });
  
  const [payerPartyId, setPayerPartyId] = useState<string | null>(defaultPayerId || defaultClientId || null);
  const [payerName, setPayerName] = useState(defaultPayerName || defaultClientName || "");
  const [servicePrice, setServicePrice] = useState("");
  const [marge, setMarge] = useState("");
  const [clientPrice, setClientPrice] = useState("");
  const [priceUnits, setPriceUnits] = useState(1); // Units or nights for multiply (sale × units)
  const [hotelPricePer, setHotelPricePer] = useState<"night" | "stay">("stay"); // Hotel: price per night vs total for stay (default: per stay)
  const [serviceCurrency, setServiceCurrency] = useState<string>(companyCurrencyCode || "EUR");
  const [servicePriceForeign, setServicePriceForeign] = useState("");
  const [exchangeRate, setExchangeRate] = useState("");
  const [rateFetching, setRateFetching] = useState(false);
  const [actuallyPaid, setActuallyPaid] = useState("");
  // Tour (Package Tour) pricing: commission from Supplier settings, agent discount (% or €)
  const [supplierCommissions, setSupplierCommissions] = useState<SupplierCommission[]>([]);
  const [selectedCommissionIndex, setSelectedCommissionIndex] = useState<number>(-1);
  const [agentDiscountValue, setAgentDiscountValue] = useState("");
  const [agentDiscountType, setAgentDiscountType] = useState<"%" | "€">("%");
  const [servicePriceLineItems, setServicePriceLineItems] = useState<{ description: string; amount: number; commissionable: boolean }[]>([]);
  
  // Track which field was last edited to determine calculation direction
  const pricingLastEditedRef = useRef<'cost' | 'marge' | 'sale' | 'agent' | 'commission' | null>(null);
  const [vatRate, setVatRate] = useState<number>(() => {
    if (categoryLocked && initialVatRate != null && !Number.isNaN(Number(initialVatRate))) {
      const v = Number(initialVatRate);
      // Package Tour: VAT always >0 (country settings); fallback 21
      if (initialCategoryType === "tour" && v === 0) return 21;
      return v;
    }
    return 0;
  }); // Default 0%, can be 21%
  // Draft for Flight/Hotel, Booked for others
  const [resStatus, setResStatus] = useState<ServiceData["resStatus"]>("draft");
  const [refNr, setRefNr] = useState("");
  // Multiple PNR/Ref per service (flight)
  const [refNrs, setRefNrs] = useState<string[]>([]);
  const [ticketNr, setTicketNr] = useState(""); // Legacy single ticket
  // Ticket numbers per client (for Flights) — clientId can be null for name-only clients
  const [ticketNumbers, setTicketNumbers] = useState<{ clientId: string | null; clientName: string; ticketNr: string }[]>([]);
  const [showAddAccompanyingModal, setShowAddAccompanyingModal] = useState(false);
  // Flight: per-client pricing (cost, marge, sale per passenger). Synced with clients length.
  const [pricingPerClient, setPricingPerClient] = useState<{ cost: string; marge: string; sale: string }[]>([]);
  const [bulkCost, setBulkCost] = useState("");
  const [bulkMarge, setBulkMarge] = useState("");
  const [bulkSale, setBulkSale] = useState("");
  
  // Hotel-specific fields
  const [hotelName, setHotelName] = useState("");
  const [hotelAddress, setHotelAddress] = useState("");
  const [hotelPhone, setHotelPhone] = useState("");
  const [hotelEmail, setHotelEmail] = useState("");
  const [hotelBedType, setHotelBedType] = useState<"king_queen" | "twin" | "not_guaranteed">("not_guaranteed");
  const [hotelPreferences, setHotelPreferences] = useState({
    earlyCheckIn: false,
    earlyCheckInTime: "",
    lateCheckIn: false,
    lateCheckInTime: "",
    lateCheckOut: false,
    lateCheckOutTime: "",
    roomUpgrade: false,
    higherFloor: false,
    kingSizeBed: false,
    honeymooners: false,
    silentRoom: false,
    repeatGuests: false,
    roomsNextTo: "",
    parking: false,
    freeText: "",
  });
  const [supplierBookingType, setSupplierBookingType] = useState<"gds" | "direct" | "partner">("gds");
  
  // Transfer-specific fields (legacy)
  const [pickupLocation, setPickupLocation] = useState("");
  const [dropoffLocation, setDropoffLocation] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [estimatedDuration, setEstimatedDuration] = useState("");
  const [linkedFlightId, setLinkedFlightId] = useState<string | null>(null);
  const [airportServiceFlow, setAirportServiceFlow] = useState<"arrival" | "departure" | "transit" | null>(null);

  // Transfer-specific fields (new structured)
  const [transferRoutes, setTransferRoutes] = useState<TransferRouteData[]>([
    { id: crypto.randomUUID(), pickup: "", pickupType: "address", dropoff: "", dropoffType: "address" },
  ]);
  const [transferMode, setTransferMode] = useState("individual");
  const [transferBookingType, setTransferBookingType] = useState<"one_way" | "by_hour" | "return">(
    initialTransferBookingType === "return" || initialTransferBookingType === "by_hour" ? initialTransferBookingType : "one_way"
  );
  const [transferHours, setTransferHours] = useState<number>(2);
  const [chauffeurNotes, setChauffeurNotes] = useState("");
  const [vehicleClass, setVehicleClass] = useState("");
  const [vehicleClassCustom, setVehicleClassCustom] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [driverNotes, setDriverNotes] = useState("");
  const [locationQueryAdd, setLocationQueryAdd] = useState<Record<string, string>>({});
  const [locationResultsAdd, setLocationResultsAdd] = useState<Record<string, LocationSuggestionAdd[]>>({});
  const [activeLocationFieldAdd, setActiveLocationFieldAdd] = useState<string | null>(null);
  const locationDebounceRefAdd = useRef<Record<string, NodeJS.Timeout>>({});
  const [showLinkedServicesModal, setShowLinkedServicesModal] = useState(false);
  const [showLinkedHint, setShowLinkedHint] = useState(false);
  const [expandedRouteIdsAdd, setExpandedRouteIdsAdd] = useState<Set<string>>(new Set());
  const linkedServicesAutoOpenedRef = useRef(false);
  const [basicInfoTab, setBasicInfoTab] = useState<"basic" | "parties">("basic");

  const searchLocationsAdd = useCallback(async (fieldKey: string, query: string) => {
    if (query.length < 2) { setLocationResultsAdd(prev => ({ ...prev, [fieldKey]: [] })); return; }
    try {
      const res = await fetch(`/api/geo/location-suggest?q=${encodeURIComponent(query)}`);
      const json = await res.json();
      setLocationResultsAdd(prev => ({ ...prev, [fieldKey]: json.data || [] }));
    } catch { setLocationResultsAdd(prev => ({ ...prev, [fieldKey]: [] })); }
  }, []);

  const handleLocationInputAdd = useCallback((fieldKey: string, value: string) => {
    setLocationQueryAdd(prev => ({ ...prev, [fieldKey]: value }));
    if (locationDebounceRefAdd.current[fieldKey]) clearTimeout(locationDebounceRefAdd.current[fieldKey]);
    locationDebounceRefAdd.current[fieldKey] = setTimeout(() => searchLocationsAdd(fieldKey, value), 300);
  }, [searchLocationsAdd]);

  const selectLocationAdd = useCallback((routeId: string, field: "pickup" | "dropoff", suggestion: LocationSuggestionAdd) => {
    const displayValue = suggestion.type === "airport" && suggestion.meta?.iata
      ? `${suggestion.meta.iata} Airport`
      : suggestion.label;
    setTransferRoutes(prev => prev.map(r => {
      if (r.id !== routeId) return r;
      return { ...r, [field]: displayValue, [`${field}Type`]: suggestion.type, [`${field}Meta`]: suggestion.meta };
    }));
    const fieldKey = `${routeId}-${field}`;
    setLocationQueryAdd(prev => ({ ...prev, [fieldKey]: displayValue }));
    setLocationResultsAdd(prev => ({ ...prev, [fieldKey]: [] }));
    setActiveLocationFieldAdd(null);
  }, []);

  const addTransferRouteAdd = useCallback(() => {
    const newId = crypto.randomUUID();
    setTransferRoutes(prev => [...prev, { id: newId, pickup: "", pickupType: "address", dropoff: "", dropoffType: "address" }]);
    // Route 3+ starts collapsed — do NOT add to expandedRouteIdsAdd
  }, []);

  const toggleRouteExpandedAdd = useCallback((routeId: string) => {
    setExpandedRouteIdsAdd(prev => {
      const next = new Set(prev);
      if (next.has(routeId)) next.delete(routeId);
      else next.add(routeId);
      return next;
    });
  }, []);

  const removeTransferRouteAdd = useCallback((routeId: string) => {
    setTransferRoutes(prev => {
      const minRoutes = transferBookingType === "return" ? 2 : 1;
      return prev.length > minRoutes ? prev.filter(r => r.id !== routeId) : prev;
    });
  }, [transferBookingType]);

  const updateRouteFieldAdd = useCallback((routeId: string, field: string, value: unknown) => {
    setTransferRoutes(prev => prev.map(r => r.id === routeId ? { ...r, [field]: value } : r));
  }, []);

  // Helper: get airport IATA from route (meta, linked flight segment, or "AYT Airport" text)
  const getAirportIataForRouteAdd = useCallback((route: TransferRouteData, isPickupAirport: boolean): string | undefined => {
    const meta = isPickupAirport ? route.pickupMeta : route.dropoffMeta;
    if (meta?.iata) return meta.iata;
    const text = isPickupAirport ? route.pickup : route.dropoff;
    const match = text?.match(/^([A-Z]{3})\s+Airport$/i);
    if (match) return match[1].toUpperCase();
    if (!route.linkedFlightId || route.linkedSegmentIndex == null) return undefined;
    const fs = flightServices.find((f) => f.id === route.linkedFlightId);
    const seg = fs?.flightSegments?.[route.linkedSegmentIndex] as unknown as { arrival?: string; departure?: string } | undefined;
    if (!seg) return undefined;
    return (isPickupAirport ? seg.arrival : seg.departure)?.trim() || undefined;
  }, [flightServices]);

  // Auto-calculate distance: airport ↔ hotel (use specific airport IATA for correct distance)
  useEffect(() => {
    transferRoutes.forEach(async (route) => {
      if (route.distanceKm != null) return;
      const pMeta = route.pickupMeta;
      const dMeta = route.dropoffMeta;
      const pickupIsAirport = route.pickupType === "airport" || !!pMeta?.iata || /^[A-Z]{3}\s+Airport$/i.test(route.pickup || "");
      const dropoffIsAirport = route.dropoffType === "airport" || !!dMeta?.iata || /^[A-Z]{3}\s+Airport$/i.test(route.dropoff || "");
      const airportIata = pickupIsAirport
        ? (pMeta?.iata || getAirportIataForRouteAdd(route, true))
        : dropoffIsAirport
          ? (dMeta?.iata || getAirportIataForRouteAdd(route, false))
          : undefined;
      const hotelAddress = pickupIsAirport ? route.dropoff : dropoffIsAirport ? route.pickup : undefined;
      const hotelLat = pickupIsAirport ? dMeta?.lat : pMeta?.lat;
      const hotelLon = pickupIsAirport ? dMeta?.lon : pMeta?.lon;
      if (!airportIata || !hotelAddress) return;
      try {
        const params = new URLSearchParams({ airport: airportIata, address: hotelAddress });
        if (hotelLat != null && hotelLon != null) {
          params.set("lat", String(hotelLat));
          params.set("lon", String(hotelLon));
        }
        const res = await fetch(`/api/geo/transfer-distance?${params}`);
        const json = await res.json();
        if (json.data) {
        const dist = json.data.distanceKm;
        const dur = json.data.durationMin;
        setTransferRoutes(prev => prev.map(r => {
          if (r.id === route.id) return { ...r, distanceKm: dist, durationMin: dur };
          if (prev.length === 2 && r.pickup === route.dropoff && r.dropoff === route.pickup) return { ...r, distanceKm: dist, durationMin: dur };
          return r;
        }));
      }
      } catch {}
    });
  }, [transferRoutes, getAirportIataForRouteAdd]);

  const suggestPickupTimeAdd = useCallback((routeId: string, flightServiceId: string, segmentIndex?: number) => {
    const fs = flightServices.find(f => f.id === flightServiceId);
    if (!fs || !fs.flightSegments?.length) return;
    const route = transferRoutes.find(r => r.id === routeId);
    if (!route || route.pickupTime) return;
    const segIdx = segmentIndex ?? route.linkedSegmentIndex ?? 0;
    const seg = fs.flightSegments[segIdx] as unknown as Record<string, string> | undefined;
    if (!seg) return;
    const isPickupAirport = route.pickupMeta?.iata || route.pickupType === "airport";
    const isDropoffAirport = route.dropoffMeta?.iata || route.dropoffType === "airport";
    if (isPickupAirport && seg.arrivalTimeScheduled) {
      const [h, m] = seg.arrivalTimeScheduled.split(":").map(Number);
      const totalMin = h * 60 + m + 45;
      const suggestedTime = `${String(Math.floor(totalMin / 60) % 24).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
      setTransferRoutes(prev => prev.map(r => r.id === routeId ? { ...r, pickupTime: suggestedTime } : r));
      return;
    }
    if (isDropoffAirport && seg.departureTimeScheduled) {
      const [h, m] = seg.departureTimeScheduled.split(":").map(Number);
      const durationBuffer = route.durationMin || 60;
      const totalMin = h * 60 + m - 120 - durationBuffer;
      const adj = totalMin < 0 ? totalMin + 1440 : totalMin;
      const suggestedTime = `${String(Math.floor(adj / 60) % 24).padStart(2, "0")}:${String(adj % 60).padStart(2, "0")}`;
      setTransferRoutes(prev => prev.map(r => r.id === routeId ? { ...r, pickupTime: suggestedTime } : r));
      return;
    }
  }, [flightServices, transferRoutes]);

  // Flight-specific fields
  const [flightSegments, setFlightSegments] = useState<FlightSegment[]>([]);
  const [showPasteInput, setShowPasteInput] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [isAIParsing, setIsAIParsing] = useState(false);
  const [showAIParsedBanner, setShowAIParsedBanner] = useState(false);
  const [correctionMode, setCorrectionMode] = useState(false);
  const [correctedFields, setCorrectedFields] = useState<Set<string>>(new Set());
  const [replacingClientIdx, setReplacingClientIdx] = useState<number | null>(null);
  const parseSourceTextRef = useRef<string>("");
  const flightFileInputRef = useRef<HTMLInputElement>(null);
  const flightPasteTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (showPasteInput && categoryType === "flight") {
      const t = setTimeout(() => flightPasteTextareaRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [showPasteInput, categoryType]);

  // Tour (Package Tour) AI parsing
  const [showTourPasteInput, setShowTourPasteInput] = useState(false);
  const [tourPasteText, setTourPasteText] = useState("");
  const [isParsingTour, setIsParsingTour] = useState(false);
  const [isDraggingTour, setIsDraggingTour] = useState(false);
  const tourParseInputRef = useRef<HTMLInputElement>(null);
  const [parsedFields, setParsedFields] = useState<Set<string>>(new Set());
  /** Fields parser returned but value empty or not applied — show red outline */
  const [parseAttemptedButEmpty, setParseAttemptedButEmpty] = useState<Set<string>>(new Set());
  // Tour-specific: hotel star, room, meal, transfer, additional
  const [hotelStarRating, setHotelStarRating] = useState("");
  const [hotelRoom, setHotelRoom] = useState("");
  const [hotelBoard, setHotelBoard] = useState<"room_only" | "breakfast" | "half_board" | "full_board" | "all_inclusive" | "uai">("room_only");
  /** Room types from Ratehawk for selected hotel — click to choose */
  const [hotelRoomOptions, setHotelRoomOptions] = useState<string[]>([]);
  /** Meal types from Ratehawk rate search for selected hotel */
  const [hotelMealOptions, setHotelMealOptions] = useState<string[]>([]);
  const [hotelHid, setHotelHid] = useState<number | null>(null);
  const [mealPlanText, setMealPlanText] = useState("");
  const [roomListOpen, setRoomListOpen] = useState(false);
  const [boardListOpen, setBoardListOpen] = useState(false);
  const roomListRef = useRef<HTMLDivElement>(null);
  const boardListRef = useRef<HTMLDivElement>(null);
  const [customRooms, setCustomRooms] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(CUSTOM_ROOMS_KEY) || "[]"); } catch { return []; }
  });
  const [customBoards, setCustomBoards] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw: string[] = JSON.parse(localStorage.getItem(CUSTOM_BOARDS_KEY) || "[]");
      const knownCodes = new Set(["BB", "HB", "FB", "RO", "AI", "UAI", "nomeal", "breakfast", "half-board", "full-board", "all-inclusive", "ultra-all-inclusive"]);
      const knownLabels = new Set(Object.values(BOARD_LABELS));
      const clean = raw.filter((v) => !knownCodes.has(v) && !knownCodes.has(v.toUpperCase()) && !knownLabels.has(v));
      if (clean.length !== raw.length) localStorage.setItem(CUSTOM_BOARDS_KEY, JSON.stringify(clean));
      return clean;
    } catch { return []; }
  });
  const roomOptionsForDropdown = useMemo(() => [...new Set([...hotelRoomOptions, ...customRooms])], [hotelRoomOptions, customRooms]);
  const filteredRoomOptions = useMemo(() => {
    const q = hotelRoom.trim().toLowerCase();
    if (!q) return roomOptionsForDropdown;
    return roomOptionsForDropdown.filter((opt) => opt.toLowerCase().includes(q));
  }, [roomOptionsForDropdown, hotelRoom]);
  const defaultBoardOptions = useMemo(() => Object.values(BOARD_LABELS), []);
  const boardOptionsForDropdown = useMemo(() => {
    if (hotelMealOptions.length > 0) {
      const rhCodeToLabel: Record<string, string> = {
        nomeal: BOARD_LABELS.room_only,
        "room-only": BOARD_LABELS.room_only,
        RO: BOARD_LABELS.room_only,
        breakfast: BOARD_LABELS.breakfast,
        "breakfast-buffet": BOARD_LABELS.breakfast,
        "continental-breakfast": BOARD_LABELS.breakfast,
        "english-breakfast": BOARD_LABELS.breakfast,
        "american-breakfast": BOARD_LABELS.breakfast,
        BB: BOARD_LABELS.breakfast,
        "half-board": BOARD_LABELS.half_board,
        "half-board-lunch": BOARD_LABELS.half_board,
        "half-board-dinner": BOARD_LABELS.half_board,
        HB: BOARD_LABELS.half_board,
        "full-board": BOARD_LABELS.full_board,
        FB: BOARD_LABELS.full_board,
        "all-inclusive": BOARD_LABELS.all_inclusive,
        AI: BOARD_LABELS.all_inclusive,
        "ultra-all-inclusive": BOARD_LABELS.uai,
        UAI: BOARD_LABELS.uai,
      };
      const mapped = hotelMealOptions.map((c) => rhCodeToLabel[c] ?? rhCodeToLabel[c.toUpperCase()] ?? c);
      return [...new Set([...mapped, ...customBoards])];
    }
    return [...new Set([...defaultBoardOptions, ...customBoards])];
  }, [hotelMealOptions, customBoards, defaultBoardOptions]);
  const [transferType, setTransferType] = useState("");
  const [additionalServices, setAdditionalServices] = useState("");
  
  // Payment deadline fields
  const [paymentDeadlineDeposit, setPaymentDeadlineDeposit] = useState<string>("");
  const [paymentDeadlineFinal, setPaymentDeadlineFinal] = useState<string>("");
  const [depositPercent, setDepositPercent] = useState<string>("");
  const [finalPercent, setFinalPercent] = useState<string>("");
  const [paymentTerms, setPaymentTerms] = useState<string>("");

  // Terms & Conditions fields
  const [priceType, setPriceType] = useState<"ebd" | "regular" | "spo">("regular");
  const [refundPolicy, setRefundPolicy] = useState<"non_ref" | "refundable" | "fully_ref">("non_ref");
  const [freeCancellationUntil, setFreeCancellationUntil] = useState<string>("");
  const [cancellationPenaltyAmount, setCancellationPenaltyAmount] = useState<string>("");
  const [cancellationPenaltyPercent, setCancellationPenaltyPercent] = useState<string>("");
  const [changeFee, setChangeFee] = useState<string>(""); // Airline change fee
  const [cabinClass, setCabinClass] = useState<"economy" | "premium_economy" | "business" | "first">("economy");
  const [baggage, setBaggage] = useState<string>("");
  // Ancillary sub-service state
  const [ancillaryType, setAncillaryType] = useState<"extra_baggage" | "seat_selection" | "meal" | "other_ancillary">("extra_baggage");
  const [ancillaryParentId, setAncillaryParentId] = useState<string>(initialAncillaryParentId || "");

  // Map Ratehawk meal label to hotel_board enum (for Board dropdown from API)
  const mapRatehawkMealToBoard = (plan: string): "room_only" | "breakfast" | "half_board" | "full_board" | "all_inclusive" | "uai" => {
    const p = (plan || "").toUpperCase();
    if (p.includes("RO") || p === "ROOM ONLY") return "room_only";
    if (p.includes("BB") || p.includes("BED AND BREAKFAST") || p.includes("BREAKFAST")) return "breakfast";
    if (p.includes("HB") || p.includes("HALF BOARD")) return "half_board";
    if (p.includes("FB") || p.includes("FULL BOARD")) return "full_board";
    if (p.includes("UAI") || p.includes("ULTRA ALL INCLUSIVE")) return "uai";
    if (p.includes("AI") || p.includes("ALL INCLUSIVE")) return "all_inclusive";
    return "room_only";
  };

  // Auto-fill clients/payer when defaultClient changes
  useEffect(() => {
    if (defaultClientId && defaultClientName) {
      // Only set default if no clients selected yet
      if (clients.length === 1 && !clients[0].id && !clients[0].name) {
        console.log('🔄 useEffect: Setting clients to default');
        setClients([{ id: defaultClientId, name: defaultClientName }]);
      }
      if (!payerPartyId && !payerName) {
        console.log('🔄 useEffect: Setting payer to default');
        setPayerPartyId(defaultClientId);
        setPayerName(defaultClientName);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultClientId, defaultClientName]);

  // Load categories on mount so default is from Travel Services (e.g. Air Ticket), not FALLBACK Flight
  const loadCategories = useCallback(async () => {
    try {
      if (!categoryLocked) setCategoriesLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setCategories(FALLBACK_CATEGORIES);
        if (initialCategoryId) {
          setCategoryId(initialCategoryId);
        } else {
          const first = FALLBACK_CATEGORIES.find(c => c.is_active);
          if (first) setCategoryId(first.id);
        }
        return;
      }
      const response = await fetch("/api/travel-service-categories", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        const apiCategories = (data.categories || []) as ServiceCategory[];
        if (apiCategories.length > 0) {
          setCategories(apiCategories);
          if (initialCategoryId) {
            setCategoryId(initialCategoryId);
          } else {
            const first = apiCategories.find((c: ServiceCategory) => c.is_active);
            if (first) setCategoryId(first.id);
          }
        } else {
          setCategories(FALLBACK_CATEGORIES);
          if (initialCategoryId) {
            setCategoryId(initialCategoryId);
          } else {
            const first = FALLBACK_CATEGORIES.find(c => c.is_active);
            if (first) setCategoryId(first.id);
          }
        }
      } else {
        setCategories(FALLBACK_CATEGORIES);
        if (initialCategoryId) {
          setCategoryId(initialCategoryId);
        } else {
          const first = FALLBACK_CATEGORIES.find(c => c.is_active);
          if (first) setCategoryId(first.id);
        }
      }
    } catch (err) {
      console.error("Error loading categories:", err);
      setCategories(FALLBACK_CATEGORIES);
      if (initialCategoryId) {
        setCategoryId(initialCategoryId);
      } else {
        const first = FALLBACK_CATEGORIES.find(c => c.is_active);
        if (first) setCategoryId(first.id);
      }
    } finally {
      setCategoriesLoading(false);
    }
  }, [initialCategoryId, categoryLocked]);

  useEffect(() => {
    // When category is pre-selected (Package Tour etc.) skip fetch so form doesn't re-render with "second" layout
    if (categoryLocked) return;
    loadCategories();
  }, [loadCategories, categoryLocked]);

  const isAirportServices = (category || "").toLowerCase().includes("airport") && (category || "").toLowerCase().includes("service");
  const COMMISSION_PRICING_CATEGORIES: CategoryType[] = ["tour", "insurance", "ancillary", "cruise", "rent_a_car", "transfer"];
  const usesCommissionPricing = COMMISSION_PRICING_CATEGORIES.includes(categoryType as CategoryType) || isAirportServices;

  // Load supplier commissions only on dropdown open (lazy), not on supplier change
  const loadSupplierCommissions = useCallback(async () => {
    if (!usesCommissionPricing || !supplierPartyId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`/api/directory/${encodeURIComponent(supplierPartyId)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const raw = (data?.record?.supplierExtras?.commissions || []) as Array<SupplierCommission & { is_active?: boolean }>;
      const list = raw
        .filter((c) => c.isActive !== false && c.is_active !== false)
        .map((c) => ({ name: c.name, rate: c.rate ?? 0, isActive: c.isActive ?? c.is_active ?? true })) as SupplierCommission[];
      if (list.length > 0) {
        setSupplierCommissions(list);
        setSelectedCommissionIndex((prev) => (prev < 0 ? 0 : prev));
      }
    } catch {}
  }, [usesCommissionPricing, supplierPartyId]);

  useEffect(() => {
    if (!usesCommissionPricing || !supplierPartyId) {
      setSupplierCommissions([]);
      setSelectedCommissionIndex(-1);
    } else {
      loadSupplierCommissions();
    }
  }, [usesCommissionPricing, supplierPartyId, loadSupplierCommissions]);

  // Derive category name, type and VAT from selected category BY ID (single source of truth: categoryId)
  // Package Tour: VAT always >0 (country/settings); fallback 21 if category has 0
  useEffect(() => {
    const matched = categories.find(c => c.id === categoryId);
    if (matched) {
      setCategory(matched.name);
      const rawType = (matched as { type?: string }).type ?? "other";
      setCategoryType((typeof rawType === "string" ? rawType.toLowerCase() : "other") as CategoryType);
      const v = matched.vat_rate;
      const isTour = (typeof rawType === "string" ? rawType.toLowerCase() : "") === "tour";
      setVatRate(isTour && (v == null || v === 0) ? 21 : v);
    }
  }, [categoryId, categories]);

  // Package Tour: VAT always >0 (e.g. Latvia 21%); enforce when category gave 0 or initial state was 0
  useEffect(() => {
    if (categoryType === "tour" && vatRate === 0) {
      setVatRate(21);
    }
  }, [categoryType, vatRate]);

  // Store ticket numbers by index to preserve when client changes
  const ticketNumbersRef = useRef<string[]>([]);
  
  // Sync ticketNumbers with clients for Flight — one entry per displayed client (by index)
  useEffect(() => {
    if (categoryType === "flight") {
      const displayedClients = clients.filter(c => c.id || c.name);
      setTicketNumbers(prev => {
        prev.forEach((t, i) => {
          if (t.ticketNr) ticketNumbersRef.current[i] = t.ticketNr;
        });
        return displayedClients.map((client, index) => {
          const existingById = client.id ? prev.find(t => t.clientId === client.id) : null;
          const ticketNr = existingById?.ticketNr ?? prev[index]?.ticketNr ?? ticketNumbersRef.current[index] ?? "";
          return { clientId: client.id ?? null, clientName: client.name, ticketNr };
        });
      });
      // Sync pricingPerClient length with displayed clients
      setPricingPerClient(prev => {
        const displayed = clients.filter(c => c.id || c.name);
        if (displayed.length === 0) return [];
        return displayed.map((_, i) => prev[i] ?? { cost: "", marge: "", sale: "" });
      });
    }
  }, [clients, category]);

  // Effective = Service Price (base) + line items. Line items ADD to Service Price.
  const effectiveServicePrice = useMemo(() => {
    const base = Math.round((parseFloat(servicePrice) || 0) * 100) / 100;
    if (usesCommissionPricing && servicePriceLineItems.length > 0) {
      const lineSum = servicePriceLineItems.reduce((s, it) => s + (Number(it.amount) || 0), 0);
      return Math.round((base + lineSum) * 100) / 100;
    }
    return base;
  }, [usesCommissionPricing, servicePriceLineItems, servicePrice]);

  const commissionableCost = useMemo(() => {
    const base = Math.round((parseFloat(servicePrice) || 0) * 100) / 100;
    if (usesCommissionPricing && servicePriceLineItems.length > 0) {
      const commissionableSum = servicePriceLineItems.filter((it) => it.commissionable).reduce((s, it) => s + (Number(it.amount) || 0), 0);
      return Math.round((base + commissionableSum) * 100) / 100;
    }
    return effectiveServicePrice;
  }, [usesCommissionPricing, servicePriceLineItems, servicePrice, effectiveServicePrice]);

  const getCommissionAmount = (baseCost: number): number => {
    if (!usesCommissionPricing || selectedCommissionIndex < 0 || !supplierCommissions[selectedCommissionIndex]) return 0;
    const rate = supplierCommissions[selectedCommissionIndex].rate;
    if (rate == null || rate <= 0) return 0;
    return Math.round((baseCost * rate / 100) * 100) / 100;
  };

  // Agent discount amount in € (Tour / commission-style)
  const getAgentDiscountAmount = (cost: number): number => {
    if (!usesCommissionPricing) return 0;
    const val = parseFloat(agentDiscountValue) || 0;
    if (val <= 0) return 0;
    if (agentDiscountType === "%") return Math.round((cost * val / 100) * 100) / 100;
    return Math.round(val * 100) / 100;
  };

  // Tour / commission-style: recalc only when user edits Pricing
  useEffect(() => {
    if (!usesCommissionPricing) return;
    if (!pricingLastEditedRef.current) return;
    const cost = effectiveServicePrice;
    const commissionAmount = getCommissionAmount(commissionableCost);
    const netCost = Math.round((cost - commissionAmount) * 100) / 100;

    if (pricingLastEditedRef.current === "sale") {
      const saleVal = Math.round((parseFloat(clientPrice) || 0) * 100) / 100;
      const discount = Math.max(0, Math.round((cost - saleVal) * 100) / 100);
      setAgentDiscountType("€");
      setAgentDiscountValue(discount.toFixed(2));
      setMarge(Math.round((saleVal - netCost) * 100) / 100 + "");
      pricingLastEditedRef.current = null;
      return;
    }
    if (pricingLastEditedRef.current === "commission") {
      const saleVal = Math.round((parseFloat(clientPrice) || 0) * 100) / 100;
      setMarge(Math.round((saleVal - netCost) * 100) / 100 + "");
      pricingLastEditedRef.current = null;
      return;
    }
    if (pricingLastEditedRef.current === "marge") {
      const margeVal = Math.round((parseFloat(marge) || 0) * 100) / 100;
      const saleVal = Math.round((netCost + margeVal) * 100) / 100;
      const discount = Math.max(0, Math.round((cost - saleVal) * 100) / 100);
      setAgentDiscountType("€");
      setAgentDiscountValue(discount.toFixed(2));
      setClientPrice(saleVal.toFixed(2));
      pricingLastEditedRef.current = null;
      return;
    }
    // User edited cost or agent discount → recalc Sale and Margin
    const discountAmount = getAgentDiscountAmount(cost);
    const saleCalculated = Math.round((cost - discountAmount) * 100) / 100;
    setMarge(Math.round((saleCalculated - netCost) * 100) / 100 + "");
    setClientPrice(saleCalculated.toFixed(2));
    pricingLastEditedRef.current = null;
  }, [usesCommissionPricing, effectiveServicePrice, commissionableCost, servicePrice, selectedCommissionIndex, supplierCommissions, agentDiscountValue, agentDiscountType, clientPrice, marge]);

  // Non-commission-style: when Sale (Client price) changes, recalculate Marge = Sale - Cost.
  useEffect(() => {
    if (usesCommissionPricing) return;
    if (pricingLastEditedRef.current === "cost" || pricingLastEditedRef.current === "marge") return;
    const totalClient = Math.round((parseFloat(clientPrice) || 0) * 100) / 100;
    const totalService = Math.round((parseFloat(servicePrice) || 0) * 100) / 100;
    const isHotelPerNight = categoryType === "hotel" && hotelPricePer === "night";
    const units = isHotelPerNight && priceUnits >= 1 ? priceUnits : 1;
    const totalMargin = Math.round((totalClient - totalService) * 100) / 100;
    const marginPerNight = units > 0 ? Math.round((totalMargin / units) * 100) / 100 : 0;
    const newMarge = isHotelPerNight ? marginPerNight.toFixed(2) : totalMargin.toFixed(2);
    setMarge(newMarge);
  }, [usesCommissionPricing, categoryType, hotelPricePer, servicePrice, clientPrice, priceUnits]);

  // Non-commission-style: when Cost changes, recalculate Sale = Cost + Marge.
  useEffect(() => {
    if (usesCommissionPricing) return;
    if (pricingLastEditedRef.current !== "cost") return;
    const totalService = Math.round((parseFloat(servicePrice) || 0) * 100) / 100;
    const isHotelPerNight = categoryType === "hotel" && hotelPricePer === "night";
    const units = isHotelPerNight && priceUnits >= 1 ? priceUnits : 1;
    const margeVal = Math.round((parseFloat(marge) || 0) * 100) / 100;
    const totalMargin = isHotelPerNight ? Math.round(margeVal * units * 100) / 100 : margeVal;
    const totalClient = Math.round((totalService + totalMargin) * 100) / 100;
    setClientPrice(totalClient.toFixed(2));
  }, [usesCommissionPricing, categoryType, hotelPricePer, servicePrice, marge, priceUnits]);

  // Non-commission-style: when user edits Marge, recalculate Sale = Cost + Marge.
  useEffect(() => {
    if (usesCommissionPricing) return;
    if (pricingLastEditedRef.current !== "marge") return;
    const totalService = Math.round((parseFloat(servicePrice) || 0) * 100) / 100;
    const isHotelPerNight = categoryType === "hotel" && hotelPricePer === "night";
    const units = isHotelPerNight && priceUnits >= 1 ? priceUnits : 1;
    const margeVal = Math.round((parseFloat(marge) || 0) * 100) / 100;
    const totalMargin = isHotelPerNight ? Math.round(margeVal * units * 100) / 100 : margeVal;
    const totalClient = Math.round((totalService + totalMargin) * 100) / 100;
    setClientPrice(totalClient.toFixed(2));
  }, [categoryType, hotelPricePer, servicePrice, marge, priceUnits]);

  // Auto-confirm when all tickets filled (Flight) or ref_nr filled (Hotel)
  useEffect(() => {
    if (categoryType === "flight") {
      const allTicketsFilled = ticketNumbers.length > 0 && ticketNumbers.every(t => t.ticketNr.trim());
      if (allTicketsFilled && resStatus === "draft") {
        setResStatus("confirmed");
      }
    }
    if (categoryType === "hotel" && refNr.trim() && resStatus === "draft") {
      setResStatus("confirmed");
    }
  }, [ticketNumbers, refNr, category, resStatus]);
  
  // Reset to draft when category changes to Flight/Hotel
  useEffect(() => {
    if ((categoryType === "flight" || categoryType === "hotel") && resStatus === "booked") {
      setResStatus("draft");
    }
  }, [category]);

  // ESC key handler
  useEscapeKey(onClose);
  const { modalStyle, onHeaderMouseDown } = useDraggableModal();
  const trapRef = useFocusTrap<HTMLDivElement>(true);

  // Close room/board dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!roomListRef.current?.contains(target)) setRoomListOpen(false);
      if (!boardListRef.current?.contains(target)) setBoardListOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Fetch real meal types from Ratehawk rate search when HID + dates are available
  const mealFetchedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (categoryType !== "hotel" || !hotelHid || !dateFrom || !dateTo) return;
    const key = `${hotelHid}:${dateFrom}:${dateTo}`;
    if (mealFetchedForRef.current === key) return;
    let cancelled = false;
    (async () => {
      try {
        const checkin = dateFrom.includes(".") ? dateFrom.split(".").reverse().join("-") : dateFrom;
        const checkout = dateTo.includes(".") ? dateTo.split(".").reverse().join("-") : dateTo;
        const res = await fetch("/api/ratehawk/hotel-rates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hid: hotelHid, checkin, checkout }),
        });
        const json = await res.json();
        if (cancelled || !res.ok) return;
        const meals: string[] = json.data?.mealTypes ?? [];
        if (cancelled) return;
        setHotelMealOptions(meals);
        mealFetchedForRef.current = key;
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [categoryType, hotelHid, dateFrom, dateTo]);
  
  // Client management functions
  const addClient = () => {
    setClients([...clients, { id: null, name: "" }]);
  };
  
  const updateClient = (index: number, id: string | null, name: string) => {
    const updated = [...clients];
    updated[index] = id
      ? { id, name }
      : { id, name, parseUnmatched: clients[index]?.parseUnmatched };
    setClients(updated);
    markCorrected("clients");
  };
  
  const removeClient = (index: number) => {
    const next = clients.filter((_, i) => i !== index);
    if (categoryType === "hotel") {
      setClients(next.length > 0 ? next : [{ id: null, name: "" }]);
    } else {
      if (clients.length <= 1) return;
      setClients(next);
    }
    markCorrected("clients");
  };

  // Determine which fields to show based on category
  const showTicketNr = categoryType === "flight";
  const showHotelFields = categoryType === "hotel";
  const showTransferFields = categoryType === "transfer";
  const showAirportServicesLinkedFields = isAirportServices && ((flightServices?.length ?? 0) > 0);
  const mgRoutes = useMemo(() => [{
    id: "mg",
    pickup: "",
    pickupType: "address" as const,
    dropoff: "",
    dropoffType: "address" as const,
    linkedFlightId: linkedFlightId || undefined,
  }], [linkedFlightId]);

  // Transfer: sync dates by booking type — Return: from order; One way/By hour: single date (first from order)
  useEffect(() => {
    if (!showTransferFields) return;
    if (transferBookingType === "return") {
      if (orderDateFrom) setDateFrom(orderDateFrom);
      if (orderDateTo) setDateTo(orderDateTo);
    } else {
      const first = orderDateFrom || dateFrom || "";
      if (first) {
        setDateFrom(first);
        setDateTo(first);
      }
    }
  }, [showTransferFields, transferBookingType, orderDateFrom, orderDateTo]); // init on transfer type change

  // Transfer Return: when opened with initialTransferBookingType="return", ensure 2 routes (Route 2 = reverse of Route 1)
  useEffect(() => {
    if (!showTransferFields || transferBookingType !== "return" || transferRoutes.length !== 1) return;
    const r = transferRoutes[0];
    setTransferRoutes(prev => [...prev, {
      id: crypto.randomUUID(),
      pickup: r.dropoff,
      pickupType: r.dropoffType || "address",
      dropoff: r.pickup,
      dropoffType: r.pickupType || "address",
      pickupMeta: r.dropoffMeta,
      dropoffMeta: r.pickupMeta,
      distanceKm: r.distanceKm,
      durationMin: r.durationMin,
    }]);
  }, [showTransferFields, transferBookingType]); // only on mount / type change

  // Auto-open Linked Services after 2s when adding Transfer and there are flights/hotels to link
  useEffect(() => {
    if (!showTransferFields || linkedServicesAutoOpenedRef.current || ((flightServices?.length ?? 0) === 0 && (hotelServices?.length ?? 0) === 0)) return;
    const hintTimer = setTimeout(() => setShowLinkedHint(true), 1000);
    const modalTimer = setTimeout(() => {
      linkedServicesAutoOpenedRef.current = true;
      setShowLinkedServicesModal(true);
    }, 2000);
    return () => { clearTimeout(hintTimer); clearTimeout(modalTimer); };
  }, [showTransferFields, flightServices?.length, hotelServices?.length]);

  // Auto-generate service name (route) from flight segments — IATA format: "DD.MM IATA-IATA-IATA / DD.MM IATA-IATA"
  useEffect(() => {
    if (categoryType === "flight" && flightSegments.length > 0) {
      // Auto-set dates from segments first (used as fallback for route dates)
      const firstDep = flightSegments[0]?.departureDate;
      const lastArr = flightSegments[flightSegments.length - 1]?.arrivalDate || firstDep;
      if (firstDep && !dateFrom) setDateFrom(firstDep);
      if (lastArr && !dateTo) setDateTo(lastArr);

      // Ensure every segment has a departureDate; fall back to neighbour or service date
      const fallbackDate = firstDep || dateFrom || "";
      const enriched = flightSegments.map((seg, i) => {
        if (seg.departureDate) return seg;
        const prev = (i > 0 ? flightSegments[i - 1]?.departureDate : null) || fallbackDate;
        return { ...seg, departureDate: prev };
      });

      const groupedByDate: Record<string, FlightSegment[]> = {};
      enriched.forEach(seg => {
        const date = seg.departureDate || "unknown";
        if (!groupedByDate[date]) groupedByDate[date] = [];
        groupedByDate[date].push(seg);
      });
      
      const routeParts = Object.entries(groupedByDate).map(([, segs]) => {
        const dateStr = formatDateShort(segs[0]?.departureDate || "");
        const codes = [
          segs[0].departure || "",
          ...segs.map(s => s.arrival || ""),
        ].filter(Boolean).map(c => c.toUpperCase());
        const routeStr = codes.join("-");
        return dateStr && dateStr !== "-" ? `${dateStr} ${routeStr}` : routeStr;
      });
      
      const newRoute = routeParts.join(" / ");
      if (newRoute && newRoute !== serviceName) {
        setServiceName(newRoute);
      }
    }
  }, [flightSegments, category, dateFrom, dateTo]); // removed serviceName from deps to allow auto-update

  // Hotel Per night: sync nights from Dates; when dates change, preserve per-night rates
  const prevDatesRef = useRef<string>("");
  useEffect(() => {
    if (categoryType !== "hotel" || hotelPricePer !== "night" || !dateFrom || !dateTo) return;
    const key = `${dateFrom}|${dateTo}`;
    const n = nightsBetween(dateFrom, dateTo);
    if (n == null || n < 1) return;
    if (prevDatesRef.current === key) return;
    prevDatesRef.current = key;
    const prev = priceUnits;
    const perCost = prev > 0 ? (parseFloat(servicePrice) || 0) / prev : 0;
    const perSale = prev > 0 ? (parseFloat(clientPrice) || 0) / prev : 0;
    setPriceUnits(n);
    setServicePrice(String(Math.round(perCost * n * 100) / 100));
    setClientPrice(String(Math.round(perSale * n * 100) / 100));
  }, [categoryType, hotelPricePer, dateFrom, dateTo, priceUnits, servicePrice, clientPrice]);

  const markCorrected = useCallback((field: string) => {
    if (correctionMode) {
      setCorrectedFields(prev => { const n = new Set(prev); n.add(field); return n; });
    }
  }, [correctionMode]);

  const fieldRingClass = useCallback((field: string) => {
    if (correctedFields.has(field)) return "ring-2 ring-amber-400 border-amber-400 bg-amber-50/30";
    if (parsedFields.has(field)) return "ring-2 ring-green-300 border-green-400";
    if (parseAttemptedButEmpty.has(field)) return "ring-2 ring-red-300 border-red-400 bg-red-50/50";
    return "border-gray-300 focus:border-blue-500";
  }, [correctedFields, parsedFields, parseAttemptedButEmpty]);

  // Parse with regex for 14 supported airlines (free, instant)
  // Supported: BA, LH, AF, KL, BT, LO, AY, SK, FZ, EK, TK, FR, U2, W6, AMADEUS
  const parseWithRegex = (text: string): { segments: FlightSegment[]; booking: Record<string, unknown>; parser?: string } | null => {
    const result = parseFlightBooking(text);
    if (!result || result.segments.length === 0) return null;
    
    // Convert ParsedSegment[] to FlightSegment[]
    const segments: FlightSegment[] = result.segments.map(seg => ({
      id: seg.id,
      flightNumber: seg.flightNumber,
      airline: seg.airline,
      departure: seg.departure,
      departureCity: seg.departureCity,
      arrival: seg.arrival,
      arrivalCity: seg.arrivalCity,
      departureDate: seg.departureDate,
      departureTimeScheduled: seg.departureTimeScheduled,
      arrivalDate: seg.arrivalDate,
      arrivalTimeScheduled: seg.arrivalTimeScheduled,
      departureTerminal: seg.departureTerminal,
      arrivalTerminal: seg.arrivalTerminal,
      duration: seg.duration,
      cabinClass: seg.cabinClass,
      baggage: seg.baggage,
      bookingRef: seg.bookingRef,
      ticketNumber: seg.ticketNumber,
      departureStatus: "scheduled",
      arrivalStatus: "scheduled",
    }));
    
    return {
      segments,
      booking: {
        bookingRef: result.booking.bookingRef,
        airline: result.booking.airline,
        totalPrice: result.booking.totalPrice,
        currency: result.booking.currency,
        ticketNumbers: result.booking.ticketNumbers,
        passengers: result.booking.passengers,
        cabinClass: result.booking.cabinClass,
        refundPolicy: result.booking.refundPolicy,
        baggage: result.booking.baggage,
      },
      parser: result.parser,
    };
  };
  
  // Resolve name-only clients against directory via vector/semantic search (handles diacritics, typos, layout)
  const resolveParsedClientsAgainstDirectory = useCallback(
    async (nameOnlyClients: { id: string | null; name: string }[], ticketNumbersRaw?: string[]) => {
      const { data: { session } } = await supabase.auth.getSession();
      const resolved = await Promise.all(
        nameOnlyClients.map(async (c) => {
          if (!c.name.trim()) return c;
          try {
            const res = await fetch("/api/search/semantic/party", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
              },
              credentials: "include",
              body: JSON.stringify({
                query: c.name.trim(),
                limit: 1,
                threshold: 0.45,
              }),
            });
            if (!res.ok) return c;
            const json = await res.json();
            const first = json.results?.[0];
            // Only use directory match if similarity is high enough — otherwise keep parsed name (e.g. Zaklina Rave)
            const minSimilarity = 0.45;
            if (first?.partyId && first?.displayName && (first.similarity ?? 0) >= minSimilarity) {
              return { id: first.partyId, name: first.displayName };
            }
          } catch {
            // ignore
          }
          return c;
        })
      );
      setClients(resolved);
      if (ticketNumbersRaw && ticketNumbersRaw.length > 0) {
        const list = resolved.map((c, i) => ({
          clientId: c.id,
          clientName: c.name,
          ticketNr: ticketNumbersRaw[i] ?? "",
        }));
        setTicketNumbers(list);
        list.forEach((t, i) => {
          ticketNumbersRef.current[i] = t.ticketNr;
        });
      }
    },
    []
  );

  // Apply parsed data to form
  const applyParsedData = (segments: FlightSegment[], booking: Record<string, unknown>) => {
    const parsed = new Set<string>();

    if (booking.bookingRef) {
      const ref = String(booking.bookingRef).trim();
      setRefNrs((prev) => (prev.some((r) => r === ref) ? prev : [...prev.filter(Boolean), ref]));
      setRefNr(ref);
      parsed.add("refNr");
    }
    if (booking.airline) { setSupplierName(booking.airline as string); parsed.add("supplierName"); }
    if (booking.totalPrice) {
      setServicePrice(String(booking.totalPrice));
      parsed.add("servicePrice");
    }
    if (booking.salePrice) {
      setClientPrice(String(booking.salePrice));
      parsed.add("clientPrice");
    } else if (booking.totalPrice) {
      setClientPrice(String(booking.totalPrice));
    }
    if (booking.cabinClass) {
      const validClasses = ["economy", "premium_economy", "business", "first"];
      if (validClasses.includes(booking.cabinClass as string)) {
        setCabinClass(booking.cabinClass as "economy" | "premium_economy" | "business" | "first");
        parsed.add("cabinClass");
      }
    }
    if (booking.baggage) {
      setBaggage(booking.baggage as string);
      parsed.add("baggage");
    }
    if (booking.refundPolicy) {
      const validPolicies = ["non_ref", "refundable", "fully_ref"];
      if (validPolicies.includes(booking.refundPolicy as string)) {
        setRefundPolicy(booking.refundPolicy as "non_ref" | "refundable" | "fully_ref");
      }
    }
    if (booking.changeFee !== null && booking.changeFee !== undefined) {
      setChangeFee(String(booking.changeFee));
    }
    
    const ticketNumbersRaw = booking.ticketNumbers as string[] | undefined;
    const passengersRaw = booking.passengers as { name: string; ticketNumber?: string }[] | undefined;
    if (passengersRaw && passengersRaw.length > 0) {
      const titleCased = passengersRaw.map((p) => ({
        id: null as string | null,
        name: toTitleCaseForDisplay(p.name || ""),
      }));
      setClients(titleCased);
      if (ticketNumbersRaw && ticketNumbersRaw.length > 0) {
        const list = titleCased.map((c, i) => ({
          clientId: null as string | null,
          clientName: c.name,
          ticketNr: passengersRaw[i]?.ticketNumber || ticketNumbersRaw[i] || "",
        }));
        setTicketNumbers(list);
        list.forEach((t, i) => { ticketNumbersRef.current[i] = t.ticketNr; });
      }
      resolveParsedClientsAgainstDirectory(titleCased, ticketNumbersRaw);
    } else if (ticketNumbersRaw && ticketNumbersRaw.length > 0) {
      const firstTicket = ticketNumbersRaw[0];
      if (firstTicket) {
        setTicketNr(firstTicket);
        if (clients[0]?.id) {
          setTicketNumbers([{ clientId: clients[0].id, clientName: clients[0].name, ticketNr: firstTicket }]);
          ticketNumbersRef.current[0] = firstTicket;
        }
      }
    }
    
    const normalized = normalizeSegmentsArrivalYear(segments) as FlightSegment[];
    setFlightSegments(normalized);
    if (normalized.length > 0) {
      parsed.add("flightSegments");
      parsed.add("serviceName");
    }
    
    if (normalized[0]?.departureDate) {
      setDateFrom(normalized[0].departureDate);
      parsed.add("dateFrom");
    }
    if (normalized.length > 0) {
      const lastSeg = normalized[normalized.length - 1];
      setDateTo(lastSeg.arrivalDate || lastSeg.departureDate);
      parsed.add("dateTo");
    }
    
    if (ticketNumbers && ticketNumbers.length > 0) {
      setResStatus("confirmed");
    }
    
    setParsedFields(parsed);
    setShowPasteInput(false);
    setPasteText("");
  };
  
  // Handle PDF file drop
  const handleFileDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length === 0) return;
    
    const file = files[0];
    const fileName = file.name.toLowerCase();
    
    const autoParseText = async (text: string) => {
      parseSourceTextRef.current = text;
      const regexResult = parseWithRegex(text);
      if (regexResult && regexResult.segments.length > 0) {
        applyParsedData(regexResult.segments, regexResult.booking);
        setShowAIParsedBanner(true);
        setParsedFields((prev) => {
          const next = new Set(prev);
          if (regexResult.segments[0]?.departureDate) next.add("dateFrom");
          const last = regexResult.segments[regexResult.segments.length - 1];
          if (last?.arrivalDate || last?.departureDate) next.add("dateTo");
          return next;
        });
        setShowPasteInput(false);
        setPasteText("");
        return;
      }
      setIsAIParsing(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch("/api/ai/parse-flight-itinerary", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
          body: JSON.stringify({ text }),
        });
        const aiData = await res.json();
        if (res.ok && aiData.segments?.length > 0) {
          applyParsedData(aiData.segments, aiData.booking || {});
          setShowAIParsedBanner(true);
          setParsedFields((prev) => {
            const next = new Set(prev);
            if (aiData.segments[0]?.departureDate) next.add("dateFrom");
            const last = aiData.segments[aiData.segments.length - 1];
            if (last?.arrivalDate || last?.departureDate) next.add("dateTo");
            return next;
          });
          setShowPasteInput(false);
          setPasteText("");
          return;
        }
      } catch (e) { console.error("AI flight parse error:", e); } finally { setIsAIParsing(false); }
      setPasteText(text);
      setShowPasteInput(true);
    };

    if (fileName.endsWith('.pdf')) {
      setIsLoadingPdf(true);
      setParseError(null);
      
      try {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/parse-pdf', {
          method: 'POST',
          body: formData,
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          const msg = (data?.error as string) || 'Failed to read PDF. Try copying text manually.';
          setParseError(msg);
          return;
        }
        
        const extractedText = (data.text || '').trim();
        if (!extractedText) {
          setParseError('PDF is empty or could not be read.');
          return;
        }
        await autoParseText(extractedText);
      } catch (error) {
        console.error('PDF parsing error:', error);
        setParseError('Failed to read PDF. Try copying text manually.');
      } finally {
        setIsLoadingPdf(false);
      }
    } else if (fileName.endsWith('.txt') || fileName.endsWith('.eml')) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = (event.target?.result as string || '').trim();
        if (!text) return;
        await autoParseText(text);
      };
      reader.readAsText(file);
    } else {
      setParseError('Supported: PDF, TXT, EML files');
    }
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  
  // Parse pasted flight booking text — try regex first, fallback to AI
  const handleParseFlight = async () => {
    if (!pasteText.trim()) return;
    
    setParseError(null);
    const text = pasteText.trim();
    parseSourceTextRef.current = text;

    // Try regex first — instant, free, deterministic (handles Amadeus PNR, airline confirmations)
    const regexResult = parseWithRegex(text);
    if (regexResult && regexResult.segments.length > 0) {
      applyParsedData(regexResult.segments, regexResult.booking);
      setShowAIParsedBanner(true);
      const segs = regexResult.segments;
      setParsedFields((prev) => {
        const next = new Set(prev);
        if (segs.length > 0) {
          if (segs[0].departureDate) next.add("dateFrom");
          const last = segs[segs.length - 1];
          if (last.arrivalDate || last.departureDate) next.add("dateTo");
        }
        return next;
      });
      return;
    }

    // Fallback: AI parsing for formats regex can't handle
    setIsAIParsing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/ai/parse-flight-itinerary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      
      if (res.ok && data.segments?.length > 0) {
        const booking = data.booking || {};
        applyParsedData(data.segments, booking);
        setShowAIParsedBanner(true);
        const segs = data.segments;
        setParsedFields((prev) => {
          const next = new Set(prev);
          if (segs.length > 0) {
            if (segs[0].departureDate) next.add("dateFrom");
            const last = segs[segs.length - 1];
            if (last.arrivalDate || last.departureDate) next.add("dateTo");
          }
          return next;
        });
        return;
      }
    } catch (e) {
      console.error("AI flight parse error:", e);
    } finally {
      setIsAIParsing(false);
    }
    
    setParseError("Could not parse this booking. Try copying the full booking confirmation text.");
  };

  // Tour (Package Tour) AI parsing - apply parsed data to form
  const applyParsedTourData = useCallback(async (p: Record<string, unknown>) => {
    const mapMeal = (plan: string): "room_only" | "breakfast" | "half_board" | "full_board" | "all_inclusive" | "uai" => {
      const p2 = (plan || "").toUpperCase();
      if (p2 === "RO" || p2 === "ROOM ONLY") return "room_only";
      if (p2 === "BB" || p2 === "BED AND BREAKFAST") return "breakfast";
      if (p2 === "HB" || p2 === "HALF BOARD") return "half_board";
      if (p2 === "FB" || p2 === "FULL BOARD") return "full_board";
      if (p2 === "UAI" || p2 === "ULTRA ALL INCLUSIVE") return "uai";
      if (p2 === "AI" || p2 === "ALL INCLUSIVE") return "all_inclusive";
      return "room_only";
    };
    const fields = new Set<string>();
    const attemptedEmpty = new Set<string>();
    if (p.direction && typeof p.direction === "string") {
      setServiceName(String(p.direction).trim());
      fields.add("serviceName");
    } else if ((p.accommodation && typeof p.accommodation === "object") || p.flights) {
      const a = p.accommodation && typeof p.accommodation === "object" ? p.accommodation as Record<string, unknown> : null;
      const dep = a?.arrivalDate ? String(a.arrivalDate).slice(0, 10) : "";
      const ret = a?.departureDate ? String(a.departureDate).slice(0, 10) : "";
      if (p.flights && typeof p.flights === "object" && Array.isArray((p.flights as Record<string, unknown>).segments)) {
        const segs = (p.flights as Record<string, unknown>).segments as Record<string, string>[];
        const first = segs[0];
        const last = segs[segs.length - 1];
        const route = first && last ? `${first.departure || ""}-${last.arrival || ""}` : "";
        const dep2 = dep || (first?.departureDate || "").slice(0, 10);
        const ret2 = ret || (last?.arrivalDate || "").slice(0, 10);
        const dates = dep2 && ret2 ? `${dep2.slice(8, 10)}.${dep2.slice(5, 7)}-${ret2.slice(8, 10)}.${ret2.slice(5, 7)}` : "";
        if (route || dates) {
          setServiceName([route, dates].filter(Boolean).join(" ").trim());
          fields.add("serviceName");
        }
      }
    }
    if (p.accommodation && typeof p.accommodation === "object") {
      const a = p.accommodation as Record<string, unknown>;
      if (a.hotelName) { setHotelName(String(a.hotelName)); fields.add("hotelName"); }
      if (a.starRating) { setHotelStarRating(String(a.starRating)); fields.add("hotelStarRating"); }
      if (a.roomType) { setHotelRoom(String(a.roomType)); fields.add("hotelRoom"); }
      if (a.mealPlan) {
        const exact = String(a.mealPlan).trim();
        setMealPlanText(exact);
        setHotelBoard(mapMeal(exact));
        fields.add("hotelBoard");
      }
      if (a.arrivalDate) { setDateFrom(String(a.arrivalDate)); fields.add("dateFrom"); }
      if (a.departureDate) { setDateTo(String(a.departureDate)); fields.add("dateTo"); }
    }
    if (p.transfers && typeof p.transfers === "object" && (p.transfers as Record<string, unknown>).type) {
      setTransferType(String((p.transfers as Record<string, unknown>).type));
      fields.add("transferType");
    }
    if (Array.isArray(p.additionalServices) && p.additionalServices.length) {
      setAdditionalServices(p.additionalServices.map((s: unknown) => {
        const o = s && typeof s === "object" ? s as Record<string, unknown> : {};
        return `${o.description || ""}${o.price != null ? ` (${o.price} EUR)` : ""}`.trim();
      }).filter(Boolean).join("\n"));
      fields.add("additionalServices");
    }
    if (p.flights && typeof p.flights === "object" && Array.isArray((p.flights as Record<string, unknown>).segments)) {
      const segs = (p.flights as Record<string, unknown>).segments as Record<string, string>[];
      const mapped = segs.map((s, i) => ({
        id: `seg-${Date.now()}-${i}`,
        flightNumber: s.flightNumber || "",
        airline: s.airline || "",
        departure: s.departure || "",
        departureCity: s.departureCity || "",
        arrival: s.arrival || "",
        arrivalCity: s.arrivalCity || "",
        departureDate: s.departureDate || "",
        departureTimeScheduled: s.departureTimeScheduled || "",
        arrivalDate: s.arrivalDate || s.departureDate || "",
        arrivalTimeScheduled: s.arrivalTimeScheduled || "",
        duration: s.duration || "",
        cabinClass: (s.cabinClass || "economy") as "economy" | "premium_economy" | "business" | "first",
        baggage: typeof s.baggage === "string" && s.baggage.trim() ? s.baggage.trim() : undefined,
        departureStatus: "scheduled",
        arrivalStatus: "scheduled",
      }));
      const normalized = normalizeSegmentsArrivalYear(mapped) as FlightSegment[];
      setFlightSegments(normalized);
      fields.add("flightSegments");
      const bagFromSeg = normalized.map((x) => x.baggage).find(Boolean);
      if (bagFromSeg) {
        setBaggage(bagFromSeg);
        fields.add("baggage");
      }
      if (normalized.length > 0) {
        const first = normalized[0];
        const last = normalized[normalized.length - 1];
        if (first?.departureDate && !fields.has("dateFrom")) {
          setDateFrom(String(first.departureDate).slice(0, 10));
          fields.add("dateFrom");
        }
        if (last?.arrivalDate && !fields.has("dateTo")) {
          setDateTo(String(last.arrivalDate).slice(0, 10));
          fields.add("dateTo");
        }
      }
    }
    if (p.pricing && typeof p.pricing === "object") {
      const pr = p.pricing as Record<string, unknown>;
      const total = pr.totalPrice ?? pr.packagePrice ?? pr.cost;
      if (total != null) {
        setClientPrice(String(total));
        setServicePrice(String(total));
        // Only Cost (€) is parsed; Sale (€) is not — system doesn't know final client price
        fields.add("servicePrice");
      }
    }
    if (p.paymentTerms && typeof p.paymentTerms === "object") {
      const pt = p.paymentTerms as Record<string, unknown>;
      if (pt.depositDueDate) { setPaymentDeadlineDeposit(String(pt.depositDueDate)); fields.add("paymentDeadlineDeposit"); }
      if (pt.finalDueDate) { setPaymentDeadlineFinal(String(pt.finalDueDate)); fields.add("paymentDeadlineFinal"); }
      if (pt.depositPercent != null) { setDepositPercent(String(pt.depositPercent)); fields.add("depositPercent"); }
      if (pt.finalPercent != null) { setFinalPercent(String(pt.finalPercent)); fields.add("finalPercent"); }
      setPaymentTerms(`${pt.depositPercent ?? 0}% deposit, ${pt.finalPercent ?? 100}% final`);
    }
    const operatorName =
      (p.operator && typeof p.operator === "object" && (p.operator as Record<string, unknown>).name != null)
        ? String((p.operator as Record<string, unknown>).name).trim()
        : (p.detectedOperator != null && typeof p.detectedOperator === "string")
          ? String(p.detectedOperator).trim()
          : "";
    if (operatorName.length > 0) {
      setSupplierName(operatorName);
      fields.add("supplierName");
      // Resolve supplier party by name so commission can load
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const res = await fetch(
            `/api/directory?role=supplier&search=${encodeURIComponent(operatorName)}&limit=1`,
            { headers: { Authorization: `Bearer ${session.access_token}` }, credentials: "include" }
          );
          if (res.ok) {
            const json = await res.json();
            const first = json?.data?.[0];
            if (first?.id) setSupplierPartyId(first.id);
          }
        }
      } catch {}
    } else if (p.operator != null || p.detectedOperator != null) {
      attemptedEmpty.add("supplierName");
    }
    if (p.bookingRef) { const v = String(p.bookingRef).trim(); if (v) { setRefNr(v); fields.add("refNr"); } else { attemptedEmpty.add("refNr"); } }
    // Mark attempted-but-empty for any field the parser could have filled but didn't
    if ((p.direction != null || p.accommodation || p.flights) && !fields.has("serviceName")) attemptedEmpty.add("serviceName");
    if (p.accommodation && typeof p.accommodation === "object") {
      if (!fields.has("hotelName")) attemptedEmpty.add("hotelName");
      if (!fields.has("hotelStarRating")) attemptedEmpty.add("hotelStarRating");
      if (!fields.has("hotelRoom")) attemptedEmpty.add("hotelRoom");
      if (!fields.has("hotelBoard")) attemptedEmpty.add("hotelBoard");
    }
    if ((p.accommodation || p.flights) && !fields.has("dateFrom")) attemptedEmpty.add("dateFrom");
    if ((p.accommodation || p.flights) && !fields.has("dateTo")) attemptedEmpty.add("dateTo");
    if (p.flights != null && typeof p.flights === "object" && !fields.has("flightSegments")) attemptedEmpty.add("flightSegments");
    if (p.transfers != null && !fields.has("transferType")) attemptedEmpty.add("transferType");
    if (p.additionalServices != null && !fields.has("additionalServices")) attemptedEmpty.add("additionalServices");
    if (p.pricing != null && typeof p.pricing === "object") {
      if (!fields.has("servicePrice")) attemptedEmpty.add("servicePrice");
    }
    if (p.paymentTerms != null && typeof p.paymentTerms === "object") {
      const pt = p.paymentTerms as Record<string, unknown>;
      if (!fields.has("paymentDeadlineDeposit")) attemptedEmpty.add("paymentDeadlineDeposit");
      if (!fields.has("paymentDeadlineFinal")) attemptedEmpty.add("paymentDeadlineFinal");
      if (!fields.has("depositPercent")) attemptedEmpty.add("depositPercent");
      if (!fields.has("finalPercent")) attemptedEmpty.add("finalPercent");
    }
    // Travellers: find-or-create and add to clients (same as EditServiceModalNew)
    if (Array.isArray(p.travellers) && p.travellers.length > 0) {
      const travellers = p.travellers
        .map((t: unknown) => {
          if (t && typeof t === "object" && "name" in t) {
            const obj = t as { name?: string; firstName?: string; lastName?: string };
            const name = String(obj.name || "").trim();
            if (!name) return null;
            return {
              name,
              firstName: obj.firstName?.trim(),
              lastName: obj.lastName?.trim(),
            };
          }
          return null;
        })
        .filter((x) => x !== null) as { name: string; firstName?: string; lastName?: string }[];
      if (travellers.length > 0) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const res = await fetch("/api/parties/find-or-create-travellers", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
            },
            body: JSON.stringify({ travellers, matchOnly: true }),
          });
          if (res.ok) {
            const data = await res.json();
            const parties = data.parties || [];
            const clientEntries = parties.map(
              (r: { name: string; id: string | null; displayName: string; matched?: boolean }) => ({
                id: r.id,
                name: r.displayName || r.name,
                parseUnmatched: r.matched === false,
              })
            );
            if (clientEntries.length > 0) {
              setClients(clientEntries);
              if (clientEntries.length === 1 && clientEntries[0].id) {
                setPayerPartyId(clientEntries[0].id);
                setPayerName(clientEntries[0].name);
              }
              fields.add("clients");
            } else {
              attemptedEmpty.add("clients");
            }
          } else {
            attemptedEmpty.add("clients");
          }
        } catch (err) {
          console.error("Find-or-create travellers error:", err);
          attemptedEmpty.add("clients");
        }
      }
    } else if (Array.isArray(p.travellers) && p.travellers.length > 0 && !fields.has("clients")) {
      attemptedEmpty.add("clients");
    }
    // Parsed document => at least Booked
    setResStatus((prev) => (prev === "draft" ? "booked" : prev));
    // Deposit + departure >4 months => Early booking
    let parsedDateFrom: string | null = null;
    if (p.accommodation && typeof p.accommodation === "object") {
      const a = p.accommodation as Record<string, unknown>;
      if (a.arrivalDate) parsedDateFrom = String(a.arrivalDate).slice(0, 10);
    }
    if (!parsedDateFrom && p.flights && typeof p.flights === "object" && Array.isArray((p.flights as Record<string, unknown>).segments)) {
      const segs = (p.flights as Record<string, unknown>).segments as Record<string, string>[];
      if (segs.length > 0 && segs[0].departureDate) parsedDateFrom = String(segs[0].departureDate).slice(0, 10);
    }
    if (parsedDateFrom && (fields.has("paymentDeadlineDeposit") || fields.has("depositPercent"))) {
      const dep = new Date(parsedDateFrom);
      const now = new Date();
      const monthsDiff = (dep.getTime() - now.getTime()) / (30.44 * 24 * 60 * 60 * 1000);
      if (monthsDiff >= 4) setPriceType("ebd");
    }
    setParseAttemptedButEmpty(attemptedEmpty);
    setParsedFields(fields);
  }, []);

  const isAcceptableTourFile = useCallback((file: File): boolean => {
    if (file.type === "application/pdf" || file.type.startsWith("image/")) return true;
    const name = (file.name || "").toLowerCase();
    return name.endsWith(".pdf") || /\.(jpg|jpeg|png|gif|webp|bmp)$/.test(name);
  }, []);

  const handleParsePackageTour = useCallback(async (file: File) => {
    if (!isAcceptableTourFile(file)) {
      setParseError("Supported: PDF or image (JPG, PNG, etc.)");
      return;
    }
    setIsParsingTour(true);
    setParseError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/ai/parse-package-tour", {
        method: "POST",
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.parsed) {
        setParseError(data.error || "Could not parse document.");
        return;
      }
      await applyParsedTourData({ ...data.parsed, detectedOperator: data.detectedOperator ?? (data.parsed as Record<string, unknown>)?.detectedOperator });
    } catch (err) {
      console.error("Parse package tour error:", err);
      setParseError("Failed to parse document.");
    } finally {
      setIsParsingTour(false);
      if (tourParseInputRef.current) tourParseInputRef.current.value = "";
    }
  }, [applyParsedTourData, isAcceptableTourFile]);

  const handleParsePackageTourText = useCallback(async () => {
    if (!tourPasteText.trim()) return;
    setIsParsingTour(true);
    setParseError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/ai/parse-package-tour", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ text: tourPasteText.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.parsed) {
        setParseError(data.error || "Could not parse text.");
        return;
      }
      await applyParsedTourData({ ...data.parsed, detectedOperator: data.detectedOperator ?? (data.parsed as Record<string, unknown>)?.detectedOperator });
      setShowTourPasteInput(false);
      setTourPasteText("");
    } catch (err) {
      console.error("Parse package tour text error:", err);
      setParseError("Failed to parse text.");
    } finally {
      setIsParsingTour(false);
    }
  }, [tourPasteText, applyParsedTourData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const effectiveServiceName =
      serviceName.trim() || (categoryType === "hotel" ? hotelName.trim() : "");

    if (!effectiveServiceName) {
      setError("Service name is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      // Get first client as primary (for backwards compatibility)
      const primaryClient = clients.find(c => c.id) || clients[0];
      
      const payload: Record<string, unknown> = {
        category,
        categoryId: normalizeCategoryIdForDb(categoryId),
        serviceName: effectiveServiceName,
        dateFrom: dateFrom || null,
        dateTo: dateTo || dateFrom || null,
        supplierPartyId,
        supplierName,
        // Primary client (backwards compatible)
        clientPartyId: primaryClient?.id || null,
        clientName: primaryClient?.name || "",
        // All clients (new format)
        clients: clients.filter(c => c.id).map(c => ({ partyId: c.id, name: c.name })),
        payerPartyId,
        payerName,
        servicePrice: categoryType === "flight" && pricingPerClient.length > 0
          ? Math.round(pricingPerClient.reduce((s, p) => s + parsePrice(p.cost), 0) * 100) / 100
          : (usesCommissionPricing && servicePriceLineItems.length > 0 ? effectiveServicePrice : parseFloat(servicePrice) || 0),
        clientPrice: categoryType === "flight" && pricingPerClient.length > 0
          ? Math.round(pricingPerClient.reduce((s, p) => s + parsePrice(p.sale), 0) * 100) / 100
          : parseFloat(clientPrice) || 0,
        quantity: categoryType === "flight" || usesCommissionPricing || categoryType === "visa" ? 1 : (categoryType === "hotel" && hotelPricePer === "stay" ? 1 : priceUnits),
        pricingPerClient: categoryType === "flight" && pricingPerClient.length > 0
          ? clients.filter(c => c.id || c.name).map((c, i) => ({
              partyId: c.id ?? null,
              cost: parsePrice(pricingPerClient[i]?.cost),
              marge: parsePrice(pricingPerClient[i]?.marge),
              sale: parsePrice(pricingPerClient[i]?.sale),
            }))
          : undefined,
        vatRate,
        resStatus,
        refNr: categoryType === "flight" && refNrs.length > 0 ? refNrs.filter(Boolean).join(", ") : refNr,
        ticketNr: showTicketNr ? (categoryType === "flight" ? ticketNumbers.map(t => t.ticketNr).join(", ") : ticketNr) : "",
        ticketNumbers: categoryType === "flight" ? ticketNumbers : undefined,
        // Travellers = selected clients (party IDs). If none selected, use primary client so CLIENT always appears in TRAVELLERS
        travellerIds: (() => {
          const ids = [...new Set(clients.filter(c => c.id).map(c => c.id as string))];
          if (ids.length === 0 && primaryClient?.id) ids.push(primaryClient.id);
          return ids;
        })(),
      };
      
      // Add hotel-specific fields (same as Edit Service)
      if (showHotelFields) {
        payload.hotelName = hotelName || null;
        if (hotelHid != null) payload.hotelHid = hotelHid;
        payload.hotelAddress = hotelAddress || null;
        payload.hotelPhone = hotelPhone || null;
        payload.hotelEmail = hotelEmail || null;
        payload.hotelRoom = hotelRoom || null;
        payload.hotelBoard = hotelBoard || null;
        payload.hotelBedType = hotelBedType || null;
        payload.hotelEarlyCheckIn = hotelPreferences.earlyCheckIn;
        payload.hotelEarlyCheckInTime = hotelPreferences.earlyCheckInTime || null;
        payload.hotelLateCheckIn = hotelPreferences.lateCheckIn;
        payload.hotelLateCheckInTime = hotelPreferences.lateCheckInTime || null;
        payload.hotelLateCheckOut = hotelPreferences.lateCheckOut;
        payload.hotelLateCheckOutTime = hotelPreferences.lateCheckOutTime || null;
        payload.hotelRoomUpgrade = hotelPreferences.roomUpgrade;
        payload.hotelHigherFloor = hotelPreferences.higherFloor;
        payload.hotelKingSizeBed = hotelPreferences.kingSizeBed;
        payload.hotelHoneymooners = hotelPreferences.honeymooners;
        payload.hotelSilentRoom = hotelPreferences.silentRoom;
        payload.hotelRepeatGuests = hotelPreferences.repeatGuests;
        payload.hotelRoomsNextTo = hotelPreferences.roomsNextTo || null;
        payload.hotelParking = hotelPreferences.parking;
        payload.hotelPreferencesFreeText = hotelPreferences.freeText || null;
        payload.supplierBookingType = supplierBookingType || null;
        payload.hotelPricePer = hotelPricePer;
        payload.serviceCurrency = serviceCurrency || companyCurrencyCode || "EUR";
        if (serviceCurrency && serviceCurrency !== (companyCurrencyCode || "EUR")) {
          if (servicePriceForeign != null && servicePriceForeign !== "") payload.servicePriceForeign = parseFloat(servicePriceForeign) || null;
          if (exchangeRate != null && exchangeRate !== "") payload.exchangeRate = parseFloat(exchangeRate) || null;
        } else {
          payload.servicePriceForeign = null;
          payload.exchangeRate = null;
        }
        if (actuallyPaid != null && actuallyPaid !== "") payload.actuallyPaid = parseFloat(actuallyPaid) || null;
      }

      // Add transfer-specific fields
      if (showTransferFields) {
        payload.serviceCurrency = serviceCurrency || companyCurrencyCode || "EUR";
        if (serviceCurrency && serviceCurrency !== (companyCurrencyCode || "EUR")) {
          if (servicePriceForeign != null && servicePriceForeign !== "") payload.servicePriceForeign = parseFloat(servicePriceForeign) || null;
          if (exchangeRate != null && exchangeRate !== "") payload.exchangeRate = parseFloat(exchangeRate) || null;
        } else {
          payload.servicePriceForeign = null;
          payload.exchangeRate = null;
        }
        payload.pickupLocation = pickupLocation;
        payload.dropoffLocation = dropoffLocation;
        payload.pickupTime = pickupTime;
        payload.estimatedDuration = estimatedDuration;
        payload.linkedFlightId = linkedFlightId;
        payload.transferRoutes = transferRoutes.map(r => ({
          ...r,
          bookingType: transferBookingType,
          hours: transferBookingType === "by_hour" ? transferHours : undefined,
          chauffeurNotes: chauffeurNotes || undefined,
        }));
        payload.transferMode = transferMode;
        payload.vehicleClass = vehicleClass ? (vehicleClassCustom ? `${vehicleClass}: ${vehicleClassCustom}` : vehicleClass) : (vehicleClassCustom || null);
        payload.driverName = driverName || null;
        payload.driverPhone = driverPhone || null;
        payload.driverNotes = driverNotes || null;
      }
      if (isAirportServices) {
        if (linkedFlightId) payload.linkedFlightId = linkedFlightId;
        if (airportServiceFlow) payload.airportServiceFlow = airportServiceFlow;
      }
      
      // Ancillary sub-service fields
      if (categoryType === "ancillary") {
        payload.parentServiceId = ancillaryParentId || null;
        payload.serviceType = "ancillary";
        payload.ancillaryType = ancillaryType;
        payload.quantity = 1;
      }

      // BSP Airline Channel — for any service when Supplier is BSP
      payload.airlineChannel = airlineChannel;
      payload.airlineChannelSupplierId = airlineChannelSupplierId;
      payload.airlineChannelSupplierName = airlineChannelSupplierName;

      // Add flight-specific fields (Flight category and Package Tour can have flight schedule)
      if (categoryType === "flight") {
        payload.cabinClass = cabinClass;
        payload.baggage = baggage;
        if (flightSegments.length > 0) {
          payload.flightSegments = flightSegments;
        }
      }
      if (categoryType === "tour" && flightSegments.length > 0) {
        payload.flightSegments = flightSegments;
        if (linkedFlightId) payload.linkedFlightId = linkedFlightId;
      }
      
      // Add payment deadline fields
      if (paymentDeadlineDeposit) {
        payload.paymentDeadlineDeposit = paymentDeadlineDeposit;
      }
      if (paymentDeadlineFinal) {
        payload.paymentDeadlineFinal = paymentDeadlineFinal;
      }
      if (categoryType === "tour" && (depositPercent || finalPercent)) {
        payload.paymentTerms = `${depositPercent || 0}% deposit, ${finalPercent || 100}% final`;
      } else if (paymentTerms.trim()) {
        payload.paymentTerms = paymentTerms.trim();
      }

      // Add terms & conditions fields
      payload.priceType = priceType;
      payload.refundPolicy = refundPolicy;
      if (freeCancellationUntil) {
        payload.freeCancellationUntil = freeCancellationUntil;
      }
      if (cancellationPenaltyAmount) {
        payload.cancellationPenaltyAmount = parseFloat(cancellationPenaltyAmount) || null;
      }
      if (cancellationPenaltyPercent) {
        payload.cancellationPenaltyPercent = parseInt(cancellationPenaltyPercent) || null;
      }
      if (changeFee && categoryType === "flight") {
        payload.changeFee = parseFloat(changeFee) || null;
      }

      // Tour (Package Tour): hotel fields
      if (categoryType === "tour") {
        payload.hotelName = hotelName || null;
        if (hotelHid != null) payload.hotelHid = hotelHid;
        payload.hotelAddress = hotelAddress || null;
        payload.hotelPhone = hotelPhone || null;
        payload.hotelStarRating = hotelStarRating || null;
        payload.hotelRoom = hotelRoom || null;
        payload.hotelBoard = hotelBoard || null;
        payload.mealPlanText = mealPlanText?.trim() || null;
        payload.transferType = transferType?.trim() || null;
        payload.additionalServices = additionalServices?.trim() || null;
      }
      // Tour / commission-style (Package Tour, Insurance, Ancillary, Cruise, Rent a Car, Transfer, Airport services)
      if (usesCommissionPricing) {
        const comm = selectedCommissionIndex >= 0 ? supplierCommissions[selectedCommissionIndex] : null;
        payload.commissionName = comm?.name ?? null;
        payload.commissionRate = comm?.rate ?? null;
        payload.commissionAmount = comm?.rate != null && comm.rate > 0 ? Math.round((commissionableCost * comm.rate / 100) * 100) / 100 : null;
        payload.servicePriceLineItems = servicePriceLineItems.map((it) => ({
          description: it.description.trim(),
          amount: Number(it.amount) || 0,
          commissionable: !!it.commissionable,
        }));
        const discVal = parseFloat(agentDiscountValue);
        payload.agentDiscountValue = Number.isFinite(discVal) ? discVal : null;
        payload.agentDiscountType = agentDiscountValue.trim() ? agentDiscountType : null;
      }

      const response = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/services`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      console.log('📤 AddService payload:', {
        clientPartyId: payload.clientPartyId,
        clientName: payload.clientName,
        clients: payload.clients,
        primaryClient,
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📥 AddService response:', {
          clientPartyId: data.service.clientPartyId,
          clientName: data.service.clientName,
        });
        // Save corrected parse template if text was parsed
        if (parseSourceTextRef.current && flightSegments.length > 0) {
          const { data: { session: s2 } } = await supabase.auth.getSession();
          fetch("/api/ai/save-parse-template", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(s2?.access_token ? { Authorization: `Bearer ${s2.access_token}` } : {}) },
            body: JSON.stringify({
              text: parseSourceTextRef.current,
              segments: flightSegments,
              booking: { bookingRef: refNr, airline: supplierName, totalPrice: servicePrice, baggage, cabinClass, refundPolicy },
              correctedFields: correctedFields.size > 0 ? [...correctedFields] : undefined,
            }),
          }).catch(() => {});
          parseSourceTextRef.current = "";
        }
        onServiceAdded(data.service);
        onClose();
      } else {
        const errData = await response.json().catch(() => ({}));
        setError(formatApiErrorResponse(errData, "Failed to create service"));
      }
    } catch (err) {
      console.error("Create service error:", err);
      setError("Network error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const needsRightWrapper = categoryType === "hotel" || categoryType === "flight";
  const RightWrapper = needsRightWrapper ? "div" : React.Fragment;
  const rightWrapperProps = needsRightWrapper ? { className: "md:col-span-1 space-y-3 min-w-0 overflow-hidden" as const } : {};

  const addFlightScheduleBlock = flightSegments.length > 0 ? (
    <div className={`mt-3 p-3 rounded-lg border ${parseAttemptedButEmpty.has("flightSegments") ? "bg-red-50 border-red-200 ring-2 ring-red-300" : parsedFields.has("flightSegments") ? "bg-green-50 border-green-200 ring-2 ring-green-300" : "bg-sky-50 border-sky-200"}`}>
      <h4 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${parseAttemptedButEmpty.has("flightSegments") ? "text-red-700" : parsedFields.has("flightSegments") ? "text-green-700" : "text-sky-700"}`}>FLIGHT SCHEDULE</h4>
      <div className="space-y-2">
        {flightSegments.map((seg, idx) => {
          let gapInfo: { type: "layover" | "stay" | null; time: string; location: string } = { type: null, time: "", location: "" };
          if (idx > 0) {
            const prevSeg = flightSegments[idx - 1];
            if (prevSeg.arrivalDate && prevSeg.arrivalTimeScheduled && seg.departureDate && seg.departureTimeScheduled) {
              const prevArrTzOffset = getAirportTimezoneOffset(prevSeg.arrival);
              const currDepTzOffset = getAirportTimezoneOffset(seg.departure);
              const prevArrival = new Date(`${prevSeg.arrivalDate}T${prevSeg.arrivalTimeScheduled}`);
              const currDeparture = new Date(`${seg.departureDate}T${seg.departureTimeScheduled}`);
              const prevArrivalUTC = prevArrival.getTime() - (prevArrTzOffset * 60 * 60 * 1000);
              const currDepartureUTC = currDeparture.getTime() - (currDepTzOffset * 60 * 60 * 1000);
              const diffMs = currDepartureUTC - prevArrivalUTC;
              if (diffMs > 0) {
                const totalMinutes = Math.floor(diffMs / (1000 * 60));
                const hours = Math.floor(totalMinutes / 60);
                const minutes = totalMinutes % 60;
                const shortTimeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
                const days = Math.floor(hours / 24);
                const remainingHours = hours % 24;
                const longTimeStr = days > 0 ? `${days} day${days > 1 ? "s" : ""} ${remainingHours}h ${minutes}m` : shortTimeStr;
                if (prevSeg.arrival === seg.departure && hours < 12) {
                  gapInfo = { type: "layover", time: shortTimeStr, location: prevSeg.arrivalCity || prevSeg.arrival };
                } else if (hours >= 6) {
                  gapInfo = { type: "stay", time: longTimeStr, location: prevSeg.arrivalCity || prevSeg.arrival };
                }
              }
            }
          }
          const fmtDate = (dateStr: string) => (dateStr ? formatDateDDMMYYYY(dateStr) : "");
          return (
            <div key={seg.id || idx}>
              {gapInfo.type === "layover" && (
                <div className="flex items-center justify-center py-1 text-xs text-amber-600">
                  <span className="bg-amber-100 px-2 py-0.5 rounded">⏱ Layover: {gapInfo.time} in {gapInfo.location}</span>
                </div>
              )}
              {gapInfo.type === "stay" && (
                <div className="flex items-center justify-center py-1 text-xs text-green-600">
                  <span className="bg-green-100 px-2 py-0.5 rounded inline-flex items-center gap-1"><Hotel size={12} /> Stay in {gapInfo.location}: {gapInfo.time}</span>
                </div>
              )}
              <div className="bg-white rounded-lg px-3 py-2 border border-sky-100">
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex flex-col items-center">
                    <span className="font-semibold text-sky-700">{seg.flightNumber}</span>
                    <span className="text-[10px] text-gray-400">{seg.airline}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-center min-w-[80px]">
                        <div className="text-xs text-gray-400">{fmtDate(seg.departureDate)}</div>
                        <div className="font-medium">{seg.departure}</div>
                        <div className="text-[10px] text-gray-500">{seg.departureCity}</div>
                        <div className="text-sm font-semibold">{seg.departureTimeScheduled}</div>
                        {seg.departureTerminal && <div className="text-[10px] text-gray-400">{seg.departureTerminal.toLowerCase().startsWith("terminal") ? seg.departureTerminal : `T${seg.departureTerminal}`}</div>}
                      </div>
                      <div className="flex-1 flex flex-col items-center px-2">
                        <div className="text-[10px] text-gray-400">{seg.duration || "—"}</div>
                        <div className="w-full h-px bg-gray-300 relative">
                          <span className="absolute left-1/2 -translate-x-1/2 -top-1 text-gray-400">✈</span>
                        </div>
                      </div>
                      <div className="text-center min-w-[80px]">
                        <div className="text-xs text-gray-400">{fmtDate(segmentDisplayArrivalDate(seg))}</div>
                        <div className="font-medium">{seg.arrival}</div>
                        <div className="text-[10px] text-gray-500">{seg.arrivalCity}</div>
                        <div className="text-sm font-semibold">{seg.arrivalTimeScheduled}</div>
                        {seg.arrivalTerminal && <div className="text-[10px] text-gray-400">{seg.arrivalTerminal.toLowerCase().startsWith("terminal") ? seg.arrivalTerminal : `T${seg.arrivalTerminal}`}</div>}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {seg.cabinClass && (
                      <span className="text-xs bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded capitalize">{seg.cabinClass.replace("_", " ")}</span>
                    )}
                    {seg.baggage && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">🧳 {seg.baggage}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {flightSegments.length > 0 && (
          <div className="text-xs text-gray-500 text-right pt-1">
            Total travel time: {(() => {
              const first = flightSegments[0];
              const last = flightSegments[flightSegments.length - 1];
              if (first.departureDate && first.departureTimeScheduled && last.arrivalDate && last.arrivalTimeScheduled) {
                const depTzOffset = getAirportTimezoneOffset(first.departure);
                const arrTzOffset = getAirportTimezoneOffset(last.arrival);
                const start = new Date(`${first.departureDate}T${first.departureTimeScheduled}`);
                const end = new Date(`${last.arrivalDate}T${last.arrivalTimeScheduled}`);
                const startUTC = start.getTime() - (depTzOffset * 60 * 60 * 1000);
                const endUTC = end.getTime() - (arrTzOffset * 60 * 60 * 1000);
                const diffMs = endUTC - startUTC;
                if (diffMs > 0) {
                  const totalMinutes = Math.floor(diffMs / (1000 * 60));
                  const dys = Math.floor(totalMinutes / (24 * 60));
                  const hrs = Math.floor((totalMinutes % (24 * 60)) / 60);
                  const mns = totalMinutes % 60;
                  const parts: string[] = [];
                  if (dys > 0) parts.push(`${dys} day${dys > 1 ? "s" : ""}`);
                  if (hrs > 0) parts.push(`${hrs}h`);
                  if (mns > 0) parts.push(`${mns}m`);
                  return parts.join(", ") || "—";
                }
              }
              return "—";
            })()}
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className="fixed inset-0 z-[100000] flex items-end sm:items-center justify-center p-0 sm:p-4 modal-future-overlay">
      <div ref={trapRef} className="w-full sm:max-w-4xl max-h-[100dvh] sm:max-h-[90vh] min-h-0 overflow-y-auto modal-future-container rounded-t-xl sm:rounded-xl" style={modalStyle}>
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-slate-200/80 px-6 py-4 flex items-center justify-between z-10 cursor-grab active:cursor-grabbing select-none shadow-sm" onMouseDown={onHeaderMouseDown}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-100 to-sky-50 shadow-sm">
              <svg className="h-4 w-4 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-[#343A40]">
              Add Service{category ? ` — ${category}` : ""}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-[#6C757D] hover:text-gray-900 hover:bg-gray-100" aria-label="Close">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tour: Direction + Paste & Parse moved to BASIC INFO (same as flight) */}

        <form onSubmit={handleSubmit} className="p-4 rounded-b-2xl modal-future-form-bg">
          {error && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
          {showAIParsedBanner && (
            <div className={`mb-3 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${correctionMode ? "bg-amber-100 border-amber-300 text-amber-900" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
              {correctionMode ? (
                <>
                  <span>✏️ Correction mode — fields you edit are highlighted in <strong>orange</strong>. Click <strong>Save</strong> when done.</span>
                  <button type="button" onClick={() => setCorrectionMode(false)} className="px-2.5 py-1 bg-amber-600 text-white rounded text-xs font-medium hover:bg-amber-700 shrink-0">Done</button>
                </>
              ) : (
                <>
                  <span>📋 Data parsed from document. To correct missing or wrong fields, click <strong>Edit Form</strong>.</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => setCorrectionMode(true)} className="px-2.5 py-1 bg-amber-600 text-white rounded text-xs font-medium hover:bg-amber-700">Edit Form</button>
                    <button type="button" onClick={() => setShowAIParsedBanner(false)} className="text-amber-600 hover:text-amber-900 font-bold">&times;</button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Two-column layout: Left = BASIC INFO + CLIENTS & PAYER (hotel/flight) + Supplier/Preferences, Right = PARTIES (tour/other only) + PRICING + REFERENCES */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            
            {/* Left column */}
            <div className={`space-y-3 min-w-0 ${categoryType === "hotel" ? "md:col-span-1" : ""}`}>
              {/* BASIC INFO for flight — first, aligns with PRICING on the right */}
              {categoryType === "flight" && (
                <div className="p-3 modal-section space-y-2">
                  <h4 className="modal-section-title">BASIC INFO</h4>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-0.5">Route *</label>
                    <input
                      type="text"
                      value={serviceName}
                      onChange={(e) => { setServiceName(e.target.value); markCorrected("serviceName"); }}
                      placeholder="e.g. RIX - FRA - NCE / NCE - FRA - RIX or paste below"
                      className={`w-full rounded-lg border px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 ${fieldRingClass("serviceName")}`}
                    />
                  </div>
                  {/* Paste & Parse — drop zone or textarea */}
                  {!showPasteInput ? (
                    <div
                      role="region"
                      aria-label="Drop or paste flight document"
                      tabIndex={0}
                      onDrop={handleFileDrop}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = "copy";
                        setIsDragging(true);
                      }}
                      onDragLeave={handleDragLeave}
                      onPaste={(e) => {
                        const files = e.clipboardData?.files;
                        const f = files?.[0];
                        if (f && (f.type === "application/pdf" || f.name?.toLowerCase().endsWith(".pdf") || f.name?.toLowerCase().endsWith(".txt") || f.name?.toLowerCase().endsWith(".eml"))) {
                          e.preventDefault();
                          const dt = new DataTransfer();
                          dt.items.add(f);
                          handleFileDrop({ preventDefault: () => {}, stopPropagation: () => {}, dataTransfer: dt } as React.DragEvent<HTMLDivElement>);
                          return;
                        }
                        const text = e.clipboardData?.getData?.("text/plain");
                        if (text?.trim()) {
                          e.preventDefault();
                          setShowPasteInput(true);
                          setPasteText(text.trim());
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setShowPasteInput(true);
                        }
                      }}
                      onClick={() => setShowPasteInput(true)}
                      className={`w-full px-3 py-3 text-sm border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer transition-all outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 ${
                        isDragging ? "border-blue-500 bg-blue-100 text-blue-700" : "border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-400"
                      }`}
                    >
                      {isLoadingPdf ? (
                        <span className="animate-pulse">⏳ Reading PDF...</span>
                      ) : isDragging ? (
                        <span className="font-medium">📄 Drop PDF here</span>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            📋 Paste & Parse
                          </div>
                          <span className="text-xs text-gray-400">or drop PDF / TXT file, Ctrl+V to paste</span>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="text-xs text-blue-600 font-medium mb-1">Paste Amadeus ITR or airline confirmation</div>
                      <textarea
                        ref={flightPasteTextareaRef}
                        value={pasteText}
                        onChange={(e) => setPasteText(e.target.value)}
                        onPaste={(e) => {
                          const files = e.clipboardData?.files;
                          const f = files?.[0];
                          if (f && (f.type === "application/pdf" || /\.(pdf|txt|eml)$/i.test(f.name || ""))) {
                            e.preventDefault();
                            const dt = new DataTransfer();
                            dt.items.add(f);
                            handleFileDrop({ preventDefault: () => {}, stopPropagation: () => {}, dataTransfer: dt } as React.DragEvent<HTMLDivElement>);
                          }
                        }}
                        placeholder="Paste Amadeus ITR, airline confirmation, or PDF text here. Or paste file (Ctrl+V)."
                        rows={6}
                        className="w-full rounded-lg border border-blue-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        autoFocus
                        tabIndex={0}
                      />
                      <input
                        ref={flightFileInputRef}
                        type="file"
                        accept=".pdf,.txt,.eml"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            const dt = new DataTransfer();
                            dt.items.add(f);
                            handleFileDrop({ preventDefault: () => {}, stopPropagation: () => {}, dataTransfer: dt } as React.DragEvent<HTMLDivElement>);
                          }
                          e.target.value = "";
                        }}
                      />
                      {parseError && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{parseError}</div>}
                      <div className="flex gap-2 flex-wrap">
                        <button type="button" onClick={() => flightFileInputRef.current?.click()} disabled={isLoadingPdf} className="px-4 py-1.5 text-sm border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50 flex items-center gap-2">Attach PDF</button>
                        <button type="button" onClick={handleParseFlight} disabled={!pasteText.trim() || isAIParsing} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">{isAIParsing ? "Parsing…" : "📋 Parse"}</button>
                        <button type="button" onClick={() => { setShowPasteInput(false); setPasteText(""); setParseError(null); }} className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Dates</label>
                      <DateRangePicker
                        label=""
                        from={dateFrom}
                        to={dateTo}
                        onChange={(from, to) => {
                          setDateFrom(from);
                          setDateTo(to);
                          markCorrected("dateFrom");
                          if (flightSegments.length > 0) {
                            setFlightSegments((prev) => {
                              const next = prev.map((seg, i) => {
                                if (i === 0 && from) return { ...seg, departureDate: from };
                                if (i === prev.length - 1 && to) return { ...seg, arrivalDate: to };
                                return seg;
                              });
                              return normalizeSegmentsArrivalYear(next) as FlightSegment[];
                            });
                          }
                        }}
                        triggerClassName={correctedFields.has("dateFrom") ? "ring-2 ring-amber-400 border-amber-400 bg-amber-50/30" : parseAttemptedButEmpty.has("dateFrom") || parseAttemptedButEmpty.has("dateTo") ? "ring-2 ring-red-300 border-red-400 bg-red-50/50" : (parsedFields.has("dateFrom") || parsedFields.has("dateTo")) ? "ring-2 ring-green-300 border-green-400" : undefined}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Cabin Class</label>
                      <select
                        value={cabinClass}
                        onChange={(e) => { setCabinClass(e.target.value as "economy" | "premium_economy" | "business" | "first"); markCorrected("cabinClass"); }}
                        className={`w-full rounded-lg border px-2.5 py-1.5 text-sm bg-white focus:ring-1 focus:ring-blue-500 ${fieldRingClass("cabinClass")}`}
                      >
                        <option value="economy">Economy</option>
                        <option value="premium_economy">Premium Economy</option>
                        <option value="business">Business</option>
                        <option value="first">First</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-0.5">Baggage</label>
                    <input
                      type="text"
                      value={baggage}
                      onChange={(e) => { setBaggage(e.target.value); markCorrected("baggage"); }}
                      placeholder="e.g., personal+cabin+1bag"
                      className={`w-full rounded-lg border px-2.5 py-1.5 text-sm bg-white focus:ring-1 focus:ring-blue-500 ${fieldRingClass("baggage")}`}
                    />
                  </div>
                </div>
              )}
              {categoryType === "hotel" ? (
                /* Hotel: BASIC INFO → Supplier → Preferences → Contact → Send to Hotel */
                <div className="space-y-3">

                  {/* BASIC INFO */}
                  <div className="p-3 modal-section space-y-3">
                    <h4 className="modal-section-title">BASIC INFO</h4>
                    <div>
                      <label className="block text-sm font-normal text-[#343A40] mb-1">Hotel <span className="text-red-500">*</span></label>
                      <HotelSuggestInput
                        value={hotelName}
                        onChange={setHotelName}
                        onHotelSelected={(d) => {
                          setHotelName(d.name);
                          if (d.address) setHotelAddress(d.address);
                          if (d.phone) setHotelPhone(d.phone);
                          if (d.email) setHotelEmail(d.email);
                          setServiceName(d.name);
                          setHotelRoomOptions(d.roomOptions ?? []);
                          if (d.hid) {
                            setHotelHid(d.hid);
                            mealFetchedForRef.current = null;
                          }
                        }}
                        placeholder="Search hotel by name..."
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 rounded-md border border-[#CED4DA] bg-white focus-within:border-[#FFC107] focus-within:ring-1 focus-within:ring-amber-400">
                          <span className="pl-2.5 text-[#6C757D]" aria-hidden><svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg></span>
                          <input type="text" value={hotelAddress} onChange={(e) => setHotelAddress(e.target.value)} placeholder="Address" className="flex-1 min-w-0 py-1.5 pr-2.5 text-sm text-[#343A40] bg-transparent placeholder:text-[#6C757D] border-0 focus:ring-0 focus:outline-none" />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 rounded-md border border-[#CED4DA] bg-white focus-within:border-[#FFC107] focus-within:ring-1 focus-within:ring-amber-400">
                          <span className="pl-2.5 text-[#6C757D]" aria-hidden><svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg></span>
                          <input type="tel" value={hotelPhone} onChange={(e) => setHotelPhone(e.target.value)} placeholder="Phone" className="flex-1 min-w-0 py-1.5 pr-2.5 text-sm text-[#343A40] bg-transparent placeholder:text-[#6C757D] border-0 focus:ring-0 focus:outline-none" />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 rounded-md border border-[#CED4DA] bg-white focus-within:border-[#FFC107] focus-within:ring-1 focus-within:ring-amber-400">
                          <span className="pl-2.5 text-[#6C757D]" aria-hidden><svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg></span>
                          <input type="email" value={hotelEmail} onChange={(e) => setHotelEmail(e.target.value)} placeholder="Email" className="flex-1 min-w-0 py-1.5 pr-2.5 text-sm text-[#343A40] bg-transparent placeholder:text-[#6C757D] border-0 focus:ring-0 focus:outline-none" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-normal text-[#343A40] mb-1">Dates</label>
                      <DateRangePicker
                        label=""
                        from={dateFrom}
                        to={dateTo}
                        onChange={(from, to) => { setDateFrom(from); setDateTo(to); }}
                        triggerClassName="rounded-md border border-[#CED4DA] px-2.5 py-1.5 text-sm bg-white focus:border-[#FFC107] focus:ring-1 focus:ring-amber-400"
                      />
                    </div>
                    <div className="grid grid-cols-[3fr_2fr_2fr] gap-2">
                      <div ref={roomListRef} className="relative">
                        <label className="block text-sm font-normal text-[#343A40] mb-1">Room</label>
                        <input
                          type="text"
                          value={hotelRoom}
                          onChange={(e) => {
                            setHotelRoom(e.target.value);
                            if (roomOptionsForDropdown.length > 0) setRoomListOpen(true);
                          }}
                          onFocus={() => roomOptionsForDropdown.length > 0 && setRoomListOpen(true)}
                          onClick={() => roomOptionsForDropdown.length > 0 && setRoomListOpen(true)}
                          onBlur={() => {
                            const v = hotelRoom.trim();
                            if (v && !roomOptionsForDropdown.includes(v)) {
                              const next = [...customRooms, v];
                              setCustomRooms(next);
                              try { localStorage.setItem(CUSTOM_ROOMS_KEY, JSON.stringify(next)); } catch {}
                            }
                          }}
                          placeholder="Room type"
                          className="w-full rounded-md border border-[#CED4DA] px-2.5 py-1.5 text-sm text-[#343A40] bg-white placeholder:text-[#6C757D] focus:border-[#FFC107] focus:ring-1 focus:ring-amber-400"
                        />
                        {roomListOpen && filteredRoomOptions.length > 0 && (
                          <div className="absolute z-50 mt-0.5 w-full max-h-48 overflow-auto rounded-lg border border-amber-200 bg-white shadow-lg">
                            {filteredRoomOptions.map((opt) => (
                              <button key={opt} type="button" className="w-full px-2.5 py-1.5 text-left text-sm hover:bg-amber-50 border-b border-amber-50 last:border-0 break-words" onClick={() => { setHotelRoom(opt); setRoomListOpen(false); }}>{opt}</button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div ref={boardListRef} className="relative">
                        <label className="block text-sm font-normal text-[#343A40] mb-1">Board</label>
                        <input
                          type="text"
                          value={mealPlanText}
                          onChange={(e) => {
                            const v = e.target.value;
                            setMealPlanText(v);
                            const mapped = (Object.entries(BOARD_LABELS).find(([, l]) => l === v)?.[0] as typeof hotelBoard) ?? mapRatehawkMealToBoard(v);
                            setHotelBoard(mapped);
                          }}
                          onFocus={() => boardOptionsForDropdown.length > 0 && setBoardListOpen(true)}
                          onClick={() => boardOptionsForDropdown.length > 0 && setBoardListOpen(true)}
                          onBlur={() => {
                            const v = mealPlanText.trim();
                            if (v && !boardOptionsForDropdown.includes(v)) {
                              const next = [...customBoards, v];
                              setCustomBoards(next);
                              try { localStorage.setItem(CUSTOM_BOARDS_KEY, JSON.stringify(next)); } catch {}
                            }
                          }}
                          placeholder="Board"
                          className="w-full rounded-md border border-[#CED4DA] px-2.5 py-1.5 text-sm text-[#343A40] bg-white placeholder:text-[#6C757D] focus:border-[#FFC107] focus:ring-1 focus:ring-amber-400"
                        />
                        {boardListOpen && boardOptionsForDropdown.length > 0 && (
                          <div className="absolute z-50 mt-0.5 w-full min-w-[11rem] max-h-48 overflow-auto rounded-lg border border-amber-200 bg-white shadow-lg">
                            {boardOptionsForDropdown.map((opt) => (
                              <button key={opt} type="button" className="w-full min-w-0 px-2.5 py-1.5 text-left text-sm hover:bg-amber-50 border-b border-amber-50 last:border-0 whitespace-nowrap" onClick={() => { const bk = (Object.entries(BOARD_LABELS).find(([, l]) => l === opt)?.[0] as typeof hotelBoard) ?? mapRatehawkMealToBoard(opt); setMealPlanText(BOARD_LABELS[bk] || opt); setHotelBoard(bk); setBoardListOpen(false); }}>{opt}</button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-normal text-[#343A40] mb-1">Bed Type</label>
                        <select value={hotelBedType} onChange={(e) => setHotelBedType(e.target.value as typeof hotelBedType)} className="w-full rounded-md border border-[#CED4DA] px-2.5 py-1.5 text-sm focus:border-[#FFC107] focus:ring-1 focus:ring-amber-400 bg-white">
                          <option value="king_queen">King/Queen</option>
                          <option value="twin">Twin</option>
                          <option value="not_guaranteed">Not guaranteed</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* CLIENTS & PAYER */}
                  <div className="p-3 modal-section space-y-2">
                    <h4 className="modal-section-title">CLIENTS & PAYER</h4>
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {clients.filter(c => c.id || c.name).map((client) => {
                          const realIndex = clients.indexOf(client);
                          const displayName = toTitleCaseForDisplay(client.name || "") || "—";
                          return replacingClientIdx === realIndex ? (
                            <div key={client.id || realIndex} className="w-48">
                              <PartySelect
                                value={client.id}
                                onChange={(id, name) => {
                                  if (id) updateClient(realIndex, id, name);
                                  setReplacingClientIdx(null);
                                }}
                                roleFilter="client"
                                initialDisplayName={displayName}
                                prioritizedParties={orderTravellers.map(t => ({ id: t.id, display_name: [t.firstName, t.lastName].filter(Boolean).join(" ").trim() || t.id, firstName: t.firstName, lastName: t.lastName, avatarUrl: t.avatarUrl }))}
                              />
                            </div>
                          ) : (
                            <span
                              key={client.id || realIndex}
                              className="inline-flex items-center gap-1 bg-[#E9ECEF] rounded-xl pl-3 pr-1.5 py-1 text-[13px] text-[#343A40] cursor-pointer hover:bg-[#dee2e6] transition-colors"
                              onClick={() => setReplacingClientIdx(realIndex)}
                              title="Click to replace client"
                            >
                              {displayName}
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); removeClient(realIndex); }}
                                className="text-[#6C757D] hover:text-red-600 ml-0.5 leading-none"
                                aria-label={`Remove ${displayName}`}
                              >
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </span>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAddAccompanyingModal(true)}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        + Add Accompanying Persons
                      </button>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Payer</label>
                      <PartySelect
                        key={`payer-${payerPartyId || "empty"}`}
                        value={payerPartyId}
                        onChange={(id, name) => { setPayerPartyId(id); setPayerName(name); }}
                        roleFilter=""
                        initialDisplayName={payerName}
                        prioritizedParties={orderTravellers.map(t => ({ id: t.id, display_name: [t.firstName, t.lastName].filter(Boolean).join(" ").trim() || t.id, firstName: t.firstName, lastName: t.lastName, avatarUrl: t.avatarUrl }))}
                      />
                    </div>
                  </div>

                  {/* Supplier */}
                  <div className="p-3 modal-section space-y-2">
                    <h4 className="modal-section-title">Supplier</h4>
                    <div className="flex gap-2 items-center">
                      <div className="w-[38%] shrink-0">
                        <select
                          value={supplierBookingType}
                          onChange={(e) => {
                            const newType = e.target.value as "gds" | "direct" | "partner";
                            setSupplierBookingType(newType);
                            if (newType === "direct" && hotelName.trim()) setSupplierName(hotelName.trim());
                          }}
                          className="w-full rounded-md border border-[#CED4DA] px-2.5 py-1.5 text-sm bg-white focus:border-[#FFC107] focus:ring-1 focus:ring-amber-400"
                        >
                          <option value="gds">GDS</option>
                          <option value="direct">Direct booking</option>
                          <option value="partner">Partner</option>
                        </select>
                      </div>
                      <div className="flex-1 min-w-0">
                        <PartySelect
                          value={supplierPartyId}
                          onChange={(id, name) => {
                            setSupplierPartyId(id);
                            setSupplierName(name);
                            if (!name.toUpperCase().includes("BSP")) {
                              setAirlineChannel(false);
                              setAirlineChannelSupplierId(null);
                              setAirlineChannelSupplierName("");
                            }
                          }}
                          roleFilter="supplier"
                          initialDisplayName={supplierName || hotelName}
                          prioritizedParties={orderTravellers.map(t => ({ id: t.id, display_name: [t.firstName, t.lastName].filter(Boolean).join(" ").trim() || t.id, firstName: t.firstName, lastName: t.lastName, avatarUrl: t.avatarUrl }))}
                        />
                      </div>
                    </div>
                    {supplierName.toUpperCase().includes("BSP") && (
                      <div className="mt-1.5 space-y-1.5">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={airlineChannel}
                            onChange={(e) => {
                              setAirlineChannel(e.target.checked);
                              if (!e.target.checked) {
                                setAirlineChannelSupplierId(null);
                                setAirlineChannelSupplierName("");
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-xs font-medium text-gray-700">Airline Channel</span>
                          <span className="text-[10px] text-gray-400">ticket issued in airline system, billed via BSP</span>
                        </label>
                        {airlineChannel && (
                          <div className="pl-6">
                            <label className="block text-xs font-medium text-gray-600 mb-0.5">Airline (issuing system)</label>
                            <PartySelect
                              value={airlineChannelSupplierId}
                              onChange={(id, name) => { setAirlineChannelSupplierId(id); setAirlineChannelSupplierName(name); }}
                              roleFilter="supplier"
                              initialDisplayName={airlineChannelSupplierName}
                              prioritizedParties={[]}
                            />
                          </div>
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-sm font-normal text-[#343A40] mb-1">Booking ref</label>
                        <input
                          type="text"
                          value={refNr}
                          onChange={(e) => { setRefNr(e.target.value); markCorrected("refNr"); }}
                          placeholder="Booking ref"
                          className={`w-full rounded-md border px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-amber-400 ${fieldRingClass("refNr")}`}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-normal text-[#343A40] mb-1">Status</label>
                        <select
                          value={resStatus}
                          onChange={(e) => setResStatus(e.target.value as ServiceData["resStatus"])}
                          className="w-full rounded-md border border-[#CED4DA] px-2.5 py-1.5 text-sm bg-white focus:border-[#FFC107] focus:ring-1 focus:ring-amber-400"
                        >
                          {RES_STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Preferences */}
                  <div className="p-3 modal-section modal-section-amber space-y-2">
                    <h4 className="modal-section-title-amber">Preferences</h4>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <label className="flex items-center gap-1.5 text-sm font-normal text-slate-700 cursor-pointer hover:text-slate-900"><input type="checkbox" checked={hotelPreferences.earlyCheckIn} onChange={(e) => setHotelPreferences(prev => ({ ...prev, earlyCheckIn: e.target.checked }))} className="modal-checkbox" />Early check-in</label>
                        {hotelPreferences.earlyCheckIn && <input type="time" value={hotelPreferences.earlyCheckInTime} onChange={(e) => setHotelPreferences(prev => ({ ...prev, earlyCheckInTime: e.target.value }))} className="rounded border border-slate-300 px-2 py-1 text-sm w-24" />}
                        <label className="flex items-center gap-1.5 text-sm font-normal text-slate-700 cursor-pointer hover:text-slate-900"><input type="checkbox" checked={hotelPreferences.lateCheckIn} onChange={(e) => setHotelPreferences(prev => ({ ...prev, lateCheckIn: e.target.checked }))} className="modal-checkbox" />Late check-in</label>
                        {hotelPreferences.lateCheckIn && <input type="time" value={hotelPreferences.lateCheckInTime} onChange={(e) => setHotelPreferences(prev => ({ ...prev, lateCheckInTime: e.target.value }))} className="rounded border border-slate-300 px-2 py-1 text-sm w-24" />}
                        <label className="flex items-center gap-1.5 text-sm font-normal text-slate-700 cursor-pointer hover:text-slate-900"><input type="checkbox" checked={hotelPreferences.lateCheckOut} onChange={(e) => setHotelPreferences(prev => ({ ...prev, lateCheckOut: e.target.checked }))} className="modal-checkbox" />Late check-out</label>
                        {hotelPreferences.lateCheckOut && <input type="time" value={hotelPreferences.lateCheckOutTime} onChange={(e) => setHotelPreferences(prev => ({ ...prev, lateCheckOutTime: e.target.value }))} className="rounded border border-slate-300 px-2 py-1 text-sm w-24" />}
                      </div>
                      <div className="grid grid-cols-4 gap-x-3 gap-y-2">
                        <label className="flex items-center gap-1.5 text-sm font-normal text-slate-700 cursor-pointer hover:text-slate-900"><input type="checkbox" checked={hotelPreferences.roomUpgrade} onChange={(e) => setHotelPreferences(prev => ({ ...prev, roomUpgrade: e.target.checked }))} className="modal-checkbox" />Room upgrade</label>
                        <label className="flex items-center gap-1.5 text-sm font-normal text-slate-700 cursor-pointer hover:text-slate-900"><input type="checkbox" checked={hotelPreferences.higherFloor} onChange={(e) => setHotelPreferences(prev => ({ ...prev, higherFloor: e.target.checked }))} className="modal-checkbox" />Higher floor</label>
                        <label className="flex items-center gap-1.5 text-sm font-normal text-slate-700 cursor-pointer hover:text-slate-900"><input type="checkbox" checked={hotelPreferences.kingSizeBed} onChange={(e) => setHotelPreferences(prev => ({ ...prev, kingSizeBed: e.target.checked }))} className="modal-checkbox" />King size bed</label>
                        <label className="flex items-center gap-1.5 text-sm font-normal text-slate-700 cursor-pointer hover:text-slate-900"><input type="checkbox" checked={hotelPreferences.honeymooners} onChange={(e) => setHotelPreferences(prev => ({ ...prev, honeymooners: e.target.checked }))} className="modal-checkbox" />Honeymooners</label>
                        <label className="flex items-center gap-1.5 text-sm font-normal text-slate-700 cursor-pointer hover:text-slate-900"><input type="checkbox" checked={hotelPreferences.silentRoom} onChange={(e) => setHotelPreferences(prev => ({ ...prev, silentRoom: e.target.checked }))} className="modal-checkbox" />Silent room</label>
                        <label className="flex items-center gap-1.5 text-sm font-normal text-slate-700 cursor-pointer hover:text-slate-900"><input type="checkbox" checked={hotelPreferences.repeatGuests} onChange={(e) => setHotelPreferences(prev => ({ ...prev, repeatGuests: e.target.checked }))} className="modal-checkbox" />Repeat Guests</label>
                        <label className="flex items-center gap-1.5 text-sm font-normal text-slate-700 cursor-pointer hover:text-slate-900"><input type="checkbox" checked={hotelPreferences.parking} onChange={(e) => setHotelPreferences(prev => ({ ...prev, parking: e.target.checked }))} className="modal-checkbox" />Parking</label>
                      </div>
                    </div>
                    <textarea value={hotelPreferences.freeText} onChange={(e) => setHotelPreferences(prev => ({ ...prev, freeText: e.target.value }))} placeholder="Additional preferences (free text)" rows={2} className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm placeholder:text-slate-400 modal-input focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 bg-white resize-y" />
                    <button
                      type="button"
                      onClick={() => {
                        const preferencesList = Object.entries(hotelPreferences)
                          .filter(([key, value]) => key !== "roomsNextTo" && key !== "freeText" && value === true)
                          .map(([key]) => key.replace(/([A-Z])/g, " $1").toLowerCase())
                          .join(", ");
                        const message = `We have a reservation for ${hotelName}. Please confirm the reservation exists and consider the following preferences:\n\nRoom: ${hotelRoom || "Not specified"}\nBoard: ${hotelBoard}\nBed Type: ${hotelBedType}\nPreferences: ${preferencesList || "None"}${hotelPreferences.freeText ? `\nAdditional: ${hotelPreferences.freeText}` : ""}`;
                        alert(`Message to hotel:\n\n${message}\n\n(Will be saved to Communication tab)`);
                      }}
                      className="modal-primary-btn px-3 py-1.5 text-xs font-medium text-[#FF8C00] border border-[#FF8C00] hover:bg-[#FF8C00] hover:text-white rounded-md inline-flex items-center gap-1.5"
                    >
                      <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      Send to Hotel
                    </button>
                  </div>

                  {/* Cancel / Save */}
                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100">
                      Cancel
                    </button>
                    <button type="button" onClick={(e) => handleSubmit(e as unknown as React.FormEvent)} disabled={isSubmitting} className="px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                      {isSubmitting ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        </>
                      ) : "Add Service"}
                    </button>
                  </div>

                </div>
              ) : (
              <div className="space-y-0">
                {CATEGORIES_WITH_PARTIES_TAB.includes(categoryType) && (
                  <div className="rounded-lg border border-gray-200 overflow-hidden bg-gradient-to-br from-white to-slate-50 shadow-sm" style={{ boxShadow: "0 1px 3px 0 rgba(15, 23, 42, 0.04)" }}>
                    <div className="flex border-b border-slate-200/60 bg-slate-100/80" role="tablist">
                      <button type="button" role="tab" aria-selected={basicInfoTab === "basic"} onClick={() => setBasicInfoTab("basic")} className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${basicInfoTab === "basic" ? "bg-white text-gray-900 shadow-sm border-b-2 border-transparent -mb-px" : "text-gray-600 hover:text-gray-700"}`}>Basic Info</button>
                      <button type="button" role="tab" aria-selected={basicInfoTab === "parties"} onClick={() => setBasicInfoTab("parties")} className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${basicInfoTab === "parties" ? "bg-white text-gray-900 shadow-sm font-semibold border-b-2 border-transparent -mb-px" : "text-gray-600 hover:text-gray-700"}`}>Parties</button>
                    </div>
                {(basicInfoTab === "basic" || !CATEGORIES_WITH_PARTIES_TAB.includes(categoryType)) && (
              <div className={`p-3 space-y-2 ${CATEGORIES_WITH_PARTIES_TAB.includes(categoryType) ? "" : "modal-section"}`}>
                {!CATEGORIES_WITH_PARTIES_TAB.includes(categoryType) && <h4 className="modal-section-title">BASIC INFO</h4>}
                
                {!categoryLocked && (
                <div>
                  <label className="block text-sm font-medium text-[#343A40] mb-0.5">Category *</label>
                  <select
                    value={categoryId ?? ""}
                    onChange={(e) => setCategoryId(e.target.value || null)}
                    disabled={categoriesLoading}
                    className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-70"
                    aria-label="Category"
                  >
                    {categoriesLoading ? (
                      <option value="">Loading...</option>
                    ) : (
                      categories.filter(c => c.is_active).map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))
                    )}
                  </select>
                </div>
                )}

                {categoryType === "transfer" && (
                <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/50">
                  <label className="block text-xs font-semibold text-gray-700 mb-2">Transfer type</label>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="transferBookingTypeAdd" value="one_way" checked={transferBookingType === "one_way"} onChange={() => {
                        setTransferBookingType("one_way");
                        setDateTo(dateFrom || orderDateFrom || dateTo || "");
                      }} className="accent-emerald-600" />
                      <span className="text-sm">One way</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="transferBookingTypeAdd" value="return" checked={transferBookingType === "return"} onChange={() => {
                        setTransferBookingType("return");
                        setDateFrom(orderDateFrom || dateFrom || "");
                        setDateTo(orderDateTo || dateTo || dateFrom || "");
                        if (transferRoutes.length === 1) {
                          const r = transferRoutes[0];
                          setTransferRoutes(prev => [...prev, {
                            id: crypto.randomUUID(),
                            pickup: r.dropoff,
                            pickupType: r.dropoffType || "address",
                            dropoff: r.pickup,
                            dropoffType: r.pickupType || "address",
                            pickupMeta: r.dropoffMeta,
                            dropoffMeta: r.pickupMeta,
                          }]);
                        }
                      }} className="accent-emerald-600" />
                      <span className="text-sm">Return Transfer</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="transferBookingTypeAdd" value="by_hour" checked={transferBookingType === "by_hour"} onChange={() => {
                        setTransferBookingType("by_hour");
                        setDateTo(dateFrom || orderDateFrom || dateTo || "");
                      }} className="accent-emerald-600" />
                      <span className="text-sm">By the hour</span>
                    </label>
                  </div>
                </div>
                )}

                {categoryType !== "ancillary" && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">
                    {categoryType === "tour" ? "Direction" : "Name *"}
                  </label>
                  <input
                    type="text"
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    placeholder={categoryType === "tour" ? "e.g. RIX-BOJ or paste below" : categoryType === "visa" ? "Visa to Turkey" : isAirportServices ? "Airport name, arrival/departure/transfer" : "e.g. Airport - Hotel - Airport, Hotel - Hotel, Train Station - Hotel"}
                    className={`w-full rounded-lg border px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 ${parseAttemptedButEmpty.has("serviceName") ? "ring-2 ring-red-300 border-red-400 bg-red-50/50" : parsedFields.has("serviceName") ? "ring-2 ring-green-300 border-green-400" : "border-gray-300 focus:border-blue-500"}`}
                  />
                </div>
                )}

                {/* Tour: Paste & Parse in Basic Info */}
                {categoryType === "tour" && (
                  !showTourPasteInput ? (
                    <>
                    <div
                      role="region"
                      aria-label="Drop or paste Tour Package document"
                      tabIndex={0}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDraggingTour(false);
                        if (isParsingTour) return;
                        const f = e.dataTransfer.files?.[0];
                        if (f && isAcceptableTourFile(f)) handleParsePackageTour(f);
                        else if (f) setParseError("Supported: PDF or image (JPG, PNG, etc.)");
                      }}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "copy"; }}
                      onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingTour(true); }}
                      onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingTour(false); }}
                      onPaste={(e) => {
                        if (isParsingTour) return;
                        const files = e.clipboardData?.files;
                        const f = files?.[0];
                        if (f && isAcceptableTourFile(f)) { e.preventDefault(); handleParsePackageTour(f); }
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!isParsingTour) tourParseInputRef.current?.click(); } }}
                      onClick={() => !isParsingTour && tourParseInputRef.current?.click()}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 ${isParsingTour ? "cursor-wait opacity-80 border-gray-200 bg-gray-50" : isDraggingTour ? "border-blue-500 bg-blue-100 ring-2 ring-blue-400" : "cursor-pointer border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50/50"}`}
                    >
                      {isParsingTour ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span className="text-sm text-gray-600">Parsing document...</span>
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-sm text-gray-600">Drop PDF/image, Ctrl+V to paste, or click to parse Tour Package</span>
                          <span onClick={(e) => { e.stopPropagation(); setShowTourPasteInput(true); }} className="ml-auto text-xs text-blue-600 hover:underline shrink-0 cursor-pointer">Paste text</span>
                        </>
                      )}
                      <input ref={tourParseInputRef} type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleParsePackageTour(f); e.target.value = ""; }} />
                    </div>
                    {parseError && !showTourPasteInput && (
                      (parseError.includes("module") || parseError.includes("upgrade"))
                        ? <div className="mt-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded">{parseError}</div>
                        : <div className="mt-1 text-sm text-red-600 bg-red-50 p-2 rounded">{parseError}</div>
                    )}
                    </>
                  ) : (
                    <div className="space-y-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="text-xs text-gray-600 font-medium mb-1">Paste document text — will fill tour fields</div>
                      <textarea
                        value={tourPasteText}
                        onChange={(e) => setTourPasteText(e.target.value)}
                        onPaste={(e) => {
                          const files = e.clipboardData?.files;
                          const f = files?.[0];
                          if (f && isAcceptableTourFile(f)) { e.preventDefault(); handleParsePackageTour(f); }
                        }}
                        placeholder="Open PDF, Ctrl+A, Ctrl+C, paste here. Or paste file (Ctrl+V)."
                        rows={4}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                        autoFocus
                      />
                      {parseError && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{parseError}</div>}
                      <div className="flex gap-2">
                        <button type="button" onClick={handleParsePackageTourText} disabled={!tourPasteText.trim() || isParsingTour} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                          {isParsingTour ? <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg> Parsing...</> : "📋 Parse"}
                        </button>
                        <button type="button" onClick={() => { setShowTourPasteInput(false); setTourPasteText(""); setParseError(null); }} className="px-4 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
                      </div>
                    </div>
                  )
                )}

                {categoryType === "transfer" ? (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Dates</label>
                      {(transferBookingType === "return") ? (
                        <DateRangePicker
                          label=""
                          from={dateFrom}
                          to={dateTo}
                          onChange={(from, to) => { setDateFrom(from); setDateTo(to); }}
                          triggerClassName={parseAttemptedButEmpty.has("dateFrom") || parseAttemptedButEmpty.has("dateTo") ? "ring-2 ring-red-300 border-red-400 bg-red-50/50" : (parsedFields.has("dateFrom") || parsedFields.has("dateTo")) ? "ring-2 ring-green-300 border-green-400" : undefined}
                        />
                      ) : (
                        <DateInput
                          value={dateFrom || orderDateFrom || ""}
                          onChange={(v) => { setDateFrom(v); setDateTo(v); }}
                          className={parseAttemptedButEmpty.has("dateFrom") ? "ring-2 ring-red-300 border-red-400 bg-red-50/50" : parsedFields.has("dateFrom") ? "ring-2 ring-green-300 border-green-400" : undefined}
                        />
                      )}
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-0.5">Dates</label>
                    <DateRangePicker
                      label=""
                      from={dateFrom}
                      to={dateTo}
                      onChange={(from, to) => { setDateFrom(from); setDateTo(to); }}
                      triggerClassName={parseAttemptedButEmpty.has("dateFrom") || parseAttemptedButEmpty.has("dateTo") ? "ring-2 ring-red-300 border-red-400 bg-red-50/50" : (parsedFields.has("dateFrom") || parsedFields.has("dateTo")) ? "ring-2 ring-green-300 border-green-400" : undefined}
                    />
                  </div>
                )}

                {/* Airport Services: flow type + linked services */}
                {isAirportServices && (
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-gray-600">Service flow</label>
                    <div className="flex gap-2">
                      {([
                        { value: "arrival" as const, label: "Arrival", hint: "Flight → Service → Transfer" },
                        { value: "departure" as const, label: "Departure", hint: "Transfer → Service → Flight" },
                        { value: "transit" as const, label: "Transit", hint: "Flight → Service → Flight" },
                      ]).map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setAirportServiceFlow(opt.value)}
                          className={`flex-1 px-2 py-2 rounded-lg border text-xs font-medium transition-colors ${
                            airportServiceFlow === opt.value
                              ? "bg-emerald-100 border-emerald-500 text-emerald-800"
                              : "bg-white border-gray-300 text-gray-600 hover:border-emerald-300 hover:text-emerald-700"
                          }`}
                          title={opt.hint}
                        >
                          <div>{opt.label}</div>
                          <div className={`text-[10px] mt-0.5 font-normal ${airportServiceFlow === opt.value ? "text-emerald-600" : "text-gray-400"}`}>{opt.hint}</div>
                        </button>
                      ))}
                    </div>
                    {showAirportServicesLinkedFields && (
                      <div className="flex items-center justify-between p-2 rounded-lg border border-emerald-200 bg-emerald-50/50">
                        <span className="text-xs text-emerald-800">Link to flight</span>
                        <button
                          type="button"
                          onClick={() => setShowLinkedServicesModal(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-50 transition-colors"
                        >
                          <Link2 className="w-4 h-4" />
                          Linked Services
                        </button>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Tour: Hotel + Stars in one row */}
                {categoryType === "tour" && (
                  <>
                    <div className="grid grid-cols-[1fr_4rem] gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Hotel</label>
                        <HotelSuggestInput
                          value={hotelName}
                          onChange={setHotelName}
                          onHotelSelected={(d) => {
                            setHotelName(d.name);
                            if (d.address) setHotelAddress(d.address);
                            if (d.phone) setHotelPhone(d.phone);
                            if (d.email) setHotelEmail(d.email);
                          }}
                          placeholder="Search hotel..."
                          className={parsedFields.has("hotelName") ? "[&_input]:ring-2 [&_input]:ring-green-300 [&_input]:border-green-400" : parseAttemptedButEmpty.has("hotelName") ? "[&_input]:ring-2 [&_input]:ring-red-300 [&_input]:border-red-400" : ""}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Stars</label>
                        <input
                          type="text"
                          value={hotelStarRating}
                          onChange={(e) => setHotelStarRating(e.target.value)}
                          placeholder="5*"
                          className={`w-full rounded-lg border px-2.5 py-1.5 text-sm bg-white ${parseAttemptedButEmpty.has("hotelStarRating") ? "ring-2 ring-red-300 border-red-400 bg-red-50/50" : parsedFields.has("hotelStarRating") ? "ring-2 ring-green-300 border-green-400" : "border-gray-300 focus:border-blue-500 focus:ring-1"}`}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Address</label>
                        <input
                          type="text"
                          value={hotelAddress}
                          onChange={(e) => setHotelAddress(e.target.value)}
                          placeholder="Hotel address"
                          className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Phone</label>
                        <input
                          type="tel"
                          value={hotelPhone}
                          onChange={(e) => setHotelPhone(e.target.value)}
                          placeholder="Hotel phone"
                          className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </>
                )}
                
                {/* Tour: Room + Meal in one row */}
                {categoryType === "tour" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Room</label>
                      <input
                        type="text"
                        value={hotelRoom}
                        onChange={(e) => setHotelRoom(e.target.value)}
                        placeholder="Club Superior"
                        className={`w-full rounded-lg border px-2.5 py-1.5 text-sm bg-white ${parseAttemptedButEmpty.has("hotelRoom") ? "ring-2 ring-red-300 border-red-400 bg-red-50/50" : parsedFields.has("hotelRoom") ? "ring-2 ring-green-300 border-green-400" : "border-gray-300 focus:border-blue-500 focus:ring-1"}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Meal</label>
                      <select
                        value={hotelBoard}
                        onChange={(e) => setHotelBoard(e.target.value as typeof hotelBoard)}
                        className={`w-full rounded-lg border px-2.5 py-1.5 text-sm bg-white ${parseAttemptedButEmpty.has("hotelBoard") ? "ring-2 ring-red-300 border-red-400 bg-red-50/50" : parsedFields.has("hotelBoard") ? "ring-2 ring-green-300 border-green-400" : "border-gray-300 focus:border-blue-500 focus:ring-1"}`}
                      >
                        <option value="room_only">RO</option>
                        <option value="breakfast">BB</option>
                        <option value="half_board">HB</option>
                        <option value="full_board">FB</option>
                        <option value="all_inclusive">AI</option>
                        <option value="uai">UAI</option>
                      </select>
                    </div>
                  </div>
                )}
                
                {/* Tour: Transfer + Additional */}
                {categoryType === "tour" && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Transfer</label>
                      <input
                        type="text"
                        value={transferType}
                        onChange={(e) => setTransferType(e.target.value)}
                        placeholder="Group / Individual / —"
                        className={`w-full rounded-lg border px-2.5 py-1.5 text-sm bg-white ${parseAttemptedButEmpty.has("transferType") ? "ring-2 ring-red-300 border-red-400 bg-red-50/50" : parsedFields.has("transferType") ? "ring-2 ring-green-300 border-green-400" : "border-gray-300 focus:border-blue-500 focus:ring-1"}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Additional</label>
                      <textarea
                        value={additionalServices}
                        onChange={(e) => setAdditionalServices(e.target.value)}
                        placeholder="Extra services"
                        rows={2}
                        className={`w-full rounded-lg border px-2.5 py-1.5 text-sm bg-white resize-none ${parseAttemptedButEmpty.has("additionalServices") ? "ring-2 ring-red-300 border-red-400 bg-red-50/50" : parsedFields.has("additionalServices") ? "ring-2 ring-green-300 border-green-400" : "border-gray-300 focus:border-blue-500 focus:ring-1"}`}
                      />
                    </div>
                  </>
                )}
                
                {/* Confirmation / booking ref — party-tab categories (insurance, visa, transfer, …), above Status */}
                <>
                {CATEGORIES_WITH_PARTIES_TAB.includes(categoryType) && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-0.5">Confirmation ref (booking ref)</label>
                    <input
                      type="text"
                      value={refNr}
                      onChange={(e) => setRefNr(e.target.value)}
                      placeholder="Policy / confirmation / booking ref"
                      className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                )}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-0.5">Status</label>
                    <select
                      value={resStatus}
                      onChange={(e) => setResStatus(e.target.value as ServiceData["resStatus"])}
                      className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      {RES_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </>
              </div>
              )}
                {basicInfoTab === "parties" && CATEGORIES_WITH_PARTIES_TAB.includes(categoryType) && (
              <div className="p-3 space-y-2">
                <div className={categoryType === "tour" ? (parseAttemptedButEmpty.has("supplierName") ? "ring-2 ring-red-300 border-red-400 rounded-lg p-0.5 -m-0.5 bg-red-50/50" : parsedFields.has("supplierName") ? "ring-2 ring-green-300 border-green-400 rounded-lg p-0.5 -m-0.5" : "") : undefined}>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Supplier</label>
                  <PartySelect
                    value={supplierPartyId}
                    onChange={(id, name) => {
                      setSupplierPartyId(id);
                      setSupplierName(name);
                      if (!name.toUpperCase().includes("BSP")) {
                        setAirlineChannel(false);
                        setAirlineChannelSupplierId(null);
                        setAirlineChannelSupplierName("");
                      }
                    }}
                    roleFilter="supplier"
                    initialDisplayName={supplierName}
                    prioritizedParties={orderTravellers.map(t => ({ id: t.id, display_name: [t.firstName, t.lastName].filter(Boolean).join(" ").trim() || t.id, firstName: t.firstName, lastName: t.lastName, avatarUrl: t.avatarUrl }))}
                  />
                  {supplierName.toUpperCase().includes("BSP") && (
                    <div className="mt-1.5 space-y-1.5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={airlineChannel}
                          onChange={(e) => {
                            setAirlineChannel(e.target.checked);
                            if (!e.target.checked) {
                              setAirlineChannelSupplierId(null);
                              setAirlineChannelSupplierName("");
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs font-medium text-gray-700">Airline Channel</span>
                        <span className="text-[10px] text-gray-400">ticket issued in airline system, billed via BSP</span>
                      </label>
                      {airlineChannel && (
                        <div className="pl-6">
                          <label className="block text-xs font-medium text-gray-600 mb-0.5">Airline (issuing system)</label>
                          <PartySelect
                            value={airlineChannelSupplierId}
                            onChange={(id, name) => { setAirlineChannelSupplierId(id); setAirlineChannelSupplierName(name); }}
                            roleFilter="supplier"
                            initialDisplayName={airlineChannelSupplierName}
                            prioritizedParties={[]}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className={categoryType === "tour" ? (parseAttemptedButEmpty.has("clients") ? "ring-2 ring-red-300 border-red-400 rounded-lg p-0.5 -m-0.5 bg-red-50/50" : parsedFields.has("clients") ? "ring-2 ring-green-300 border-green-400 rounded-lg p-0.5 -m-0.5" : "") : undefined}>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="text-xs font-medium text-gray-600">Client{clients.length > 1 ? "s" : ""}</label>
                    <ClientMultiSelectDropdown onAddClients={(toAdd) => setClients(prev => { const existing = prev.filter(c => c.id); const next = [...existing, ...toAdd]; return next.length > 0 ? next : [{ id: null, name: "" }]; })} existingClientIds={clients.map(c => c.id).filter((id): id is string => id !== null)} orderTravellers={orderTravellers} />
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {clients.filter(c => c.id || c.name).map((client, index) => {
                      const realIdx = clients.indexOf(client);
                      const displayName = toTitleCaseForDisplay(client.name || (index === 0 ? defaultClientName : "") || "") || "-";
                      return (
                        <div key={client.id || index} className="flex items-center gap-1">
                          {replacingClientIdx === realIdx ? (
                            <div className="w-48">
                              <PartySelect
                                value={client.id}
                                onChange={(id, name) => {
                                  if (id) updateClient(realIdx, id, name);
                                  setReplacingClientIdx(null);
                                }}
                                roleFilter="client"
                                initialDisplayName={displayName}
                                prioritizedParties={orderTravellers.map(t => ({ id: t.id, display_name: [t.firstName, t.lastName].filter(Boolean).join(" ").trim() || t.id, firstName: t.firstName, lastName: t.lastName, avatarUrl: t.avatarUrl }))}
                              />
                            </div>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm cursor-pointer hover:bg-gray-200 transition-colors ${
                                client.parseUnmatched
                                  ? "bg-amber-50 ring-2 ring-amber-400"
                                  : correctedFields.has("clients")
                                    ? "bg-amber-100 ring-1 ring-amber-400"
                                    : "bg-gray-100"
                              }`}
                              onClick={() => setReplacingClientIdx(realIdx)}
                              title={client.parseUnmatched ? "Not in directory — click to select or add" : "Click to replace client"}
                            >
                              {displayName}
                              {clients.filter(c => c.id || c.name).length > 1 && (
                                <button type="button" onClick={(e) => { e.stopPropagation(); const idx = clients.findIndex(c => (c.id || "") === (client.id || "") && (c.name || "") === (client.name || "")); if (idx >= 0) removeClient(idx); }} className="text-gray-400 hover:text-red-600" aria-label={`Remove ${displayName}`}>
                                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              )}
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {clients.filter(c => c.id || c.name).length === 0 && <span className="text-xs text-gray-400">No clients — use &quot;+ Add from directory&quot; above</span>}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Payer</label>
                  <PartySelect key={`payer-${payerPartyId || "empty"}`} value={payerPartyId} onChange={(id, name) => { setPayerPartyId(id); setPayerName(name); }} roleFilter="" initialDisplayName={payerName} prioritizedParties={orderTravellers.map(t => ({ id: t.id, display_name: [t.firstName, t.lastName].filter(Boolean).join(" ").trim() || t.id, firstName: t.firstName, lastName: t.lastName, avatarUrl: t.avatarUrl }))} />
                </div>
              </div>
                )}
                  </div>
                )}
              </div>
              )}

            {/* CLIENT & PAYER — under BASIC INFO for flight */}
            {categoryType === "flight" && (
              <div className="p-3 modal-section space-y-2">
                <h4 className="modal-section-title">CLIENT & PAYER</h4>
                <div className="space-y-2">
                  <div className="space-y-2">
                    {clients.filter(c => c.id || c.name).map((client, idx) => {
                      const realIndex = clients.indexOf(client);
                      const ticketEntry = ticketNumbers[idx];
                      const displayName = toTitleCaseForDisplay(client.name || "") || "-";
                      return (
                        <div key={client.id || realIndex} className="flex items-center gap-2 flex-wrap">
                          {replacingClientIdx === realIndex ? (
                            <div className="w-48">
                              <PartySelect
                                value={client.id}
                                onChange={(id, name) => {
                                  if (id) updateClient(realIndex, id, name);
                                  setReplacingClientIdx(null);
                                }}
                                roleFilter="client"
                                initialDisplayName={displayName}
                                prioritizedParties={orderTravellers.map(t => ({ id: t.id, display_name: [t.firstName, t.lastName].filter(Boolean).join(" ").trim() || t.id, firstName: t.firstName, lastName: t.lastName, avatarUrl: t.avatarUrl }))}
                              />
                            </div>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 rounded-xl pl-3 pr-1.5 py-1 text-[13px] text-[#343A40] shrink-0 cursor-pointer hover:bg-[#dee2e6] transition-colors ${correctedFields.has("clients") ? "bg-amber-100 ring-1 ring-amber-400" : "bg-[#E9ECEF]"}`}
                              onClick={() => setReplacingClientIdx(realIndex)}
                              title="Click to replace client"
                            >
                              {displayName}
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); removeClient(realIndex); }}
                                className="text-[#6C757D] hover:text-red-600 ml-0.5 leading-none"
                                aria-label={`Remove ${displayName}`}
                              >
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </span>
                          )}
                          <input
                            type="text"
                            value={ticketEntry?.ticketNr ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              setTicketNumbers((prev) => {
                                const n = [...prev];
                                if (n[idx]) n[idx] = { ...n[idx], ticketNr: v };
                                else n[idx] = { clientId: client.id, clientName: client.name, ticketNr: v };
                                return n;
                              });
                              ticketNumbersRef.current[idx] = v;
                            }}
                            placeholder="E-ticket"
                            className="w-32 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddAccompanyingModal(true)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    + Add Accompanying Persons
                  </button>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Payer</label>
                  <PartySelect
                    key={`payer-${payerPartyId || "empty"}`}
                    value={payerPartyId}
                    onChange={(id, name) => { setPayerPartyId(id); setPayerName(name); }}
                    roleFilter=""
                    initialDisplayName={payerName}
                    prioritizedParties={orderTravellers.map(t => ({ id: t.id, display_name: [t.firstName, t.lastName].filter(Boolean).join(" ").trim() || t.id, firstName: t.firstName, lastName: t.lastName, avatarUrl: t.avatarUrl }))}
                  />
                </div>
              </div>
            )}

            {/* PARTIES — Supplier + Ref Nr + Status (flight only) */}
            {categoryType === "flight" && (
              <div className="p-3 modal-section space-y-2">
                <h4 className="modal-section-title">SUPPLIER</h4>
                <div className={parsedFields.has("supplierName") ? "ring-2 ring-green-300 border-green-400 rounded-lg p-0.5 -m-0.5" : ""}>
                  <PartySelect
                    value={supplierPartyId}
                    onChange={(id, name) => {
                      setSupplierPartyId(id);
                      setSupplierName(name);
                      if (!name.toUpperCase().includes("BSP")) {
                        setAirlineChannel(false);
                        setAirlineChannelSupplierId(null);
                        setAirlineChannelSupplierName("");
                      }
                    }}
                    roleFilter="supplier"
                    initialDisplayName={supplierName}
                    prioritizedParties={orderTravellers.map(t => ({ id: t.id, display_name: [t.firstName, t.lastName].filter(Boolean).join(" ").trim() || t.id, firstName: t.firstName, lastName: t.lastName, avatarUrl: t.avatarUrl }))}
                  />
                </div>
                {supplierName.toUpperCase().includes("BSP") && (
                  <div className="mt-1.5 space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={airlineChannel}
                        onChange={(e) => {
                          setAirlineChannel(e.target.checked);
                          if (!e.target.checked) {
                            setAirlineChannelSupplierId(null);
                            setAirlineChannelSupplierName("");
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs font-medium text-gray-700">Airline Channel</span>
                      <span className="text-[10px] text-gray-400">ticket issued in airline system, billed via BSP</span>
                    </label>
                    {airlineChannel && (
                      <div className="pl-6">
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Airline (issuing system)</label>
                        <PartySelect
                          value={airlineChannelSupplierId}
                          onChange={(id, name) => { setAirlineChannelSupplierId(id); setAirlineChannelSupplierName(name); }}
                          roleFilter="supplier"
                          initialDisplayName={airlineChannelSupplierName}
                          prioritizedParties={[]}
                        />
                      </div>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-0.5">PNR (Ref)</label>
                    <div className="space-y-1.5">
                      {(refNrs.length ? refNrs : [""]).map((r, i) => (
                        <div key={i} className="flex gap-1">
                          <input
                            type="text"
                            value={r}
                            onChange={(e) => setRefNrs((prev) => { const n = prev.length ? [...prev] : [""]; n[i] = e.target.value; return n; })}
                            placeholder="Booking ref"
                            className={`flex-1 rounded-lg border px-2.5 py-1.5 text-sm min-w-0 ${parsedFields.has("refNr") ? "ring-2 ring-green-300 border-green-400" : "border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"}`}
                          />
                          <button
                            type="button"
                            onClick={() => setRefNrs((prev) => (prev.length ? prev.filter((_, j) => j !== i) : []))}
                            className="text-gray-400 hover:text-red-600 shrink-0 p-1"
                            aria-label="Remove PNR"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setRefNrs((prev) => (prev.length ? [...prev, ""] : [""]))}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        + Add PNR
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-0.5">Status</label>
                    <select
                      value={resStatus}
                      onChange={(e) => setResStatus(e.target.value as ServiceData["resStatus"])}
                      className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      {RES_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Ancillary sub-service form */}
            {categoryType === "ancillary" && (
              <>
              <div className="p-3 modal-section space-y-2">
                <h4 className="modal-section-title">ANCILLARY DETAILS</h4>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Linked Air Ticket *</label>
                  <select
                    value={ancillaryParentId}
                    onChange={(e) => {
                      setAncillaryParentId(e.target.value);
                      const parent = (flightServices || []).find(f => f.id === e.target.value);
                      if (parent) {
                        setSupplierName(parent.name.split(/[\s-]/)[0] || "");
                      }
                    }}
                    className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select air ticket...</option>
                    {(flightServices || []).map(f => (
                      <option key={f.id} value={f.id}>{f.name || "Air Ticket"}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {([
                      { value: "extra_baggage", label: "Extra Baggage" },
                      { value: "seat_selection", label: "Seat Selection" },
                      { value: "meal", label: "Meal" },
                      { value: "other_ancillary", label: "Other" },
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setAncillaryType(opt.value);
                          if (!serviceName.trim() || ["Extra Baggage", "Seat Selection", "Meal", "Other"].includes(serviceName.trim())) {
                            setServiceName(opt.label);
                          }
                        }}
                        className={`px-3 py-2 text-sm rounded-lg border transition-colors ${ancillaryType === opt.value ? "bg-blue-50 border-blue-400 text-blue-800 font-medium" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Description</label>
                  <input
                    type="text"
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    placeholder={ancillaryType === "extra_baggage" ? "e.g. 23kg checked bag" : ancillaryType === "seat_selection" ? "e.g. Seat 14A window" : ancillaryType === "meal" ? "e.g. Vegetarian meal" : "Description"}
                    className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="p-3 modal-section space-y-2">
                <h4 className="modal-section-title">CLIENT & PAYER</h4>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {clients.filter(c => c.id || c.name).map((client) => {
                      const realIndex = clients.indexOf(client);
                      const displayName = toTitleCaseForDisplay(client.name || "") || "—";
                      return (
                        <span key={client.id || realIndex} className="inline-flex items-center gap-1 bg-[#E9ECEF] rounded-xl pl-3 pr-1.5 py-1 text-[13px] text-[#343A40]">
                          {displayName}
                          <button type="button" onClick={() => removeClient(realIndex)} className="text-[#6C757D] hover:text-red-600 ml-0.5 leading-none" aria-label={`Remove ${displayName}`}>
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </span>
                      );
                    })}
                  </div>
                  <button type="button" onClick={() => setShowAddAccompanyingModal(true)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">+ Add Persons</button>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Payer</label>
                  <PartySelect key={`payer-${payerPartyId || "empty"}`} value={payerPartyId} onChange={(id, name) => { setPayerPartyId(id); setPayerName(name); }} roleFilter="" initialDisplayName={payerName} prioritizedParties={orderTravellers.map(t => ({ id: t.id, display_name: [t.firstName, t.lastName].filter(Boolean).join(" ").trim() || t.id, firstName: t.firstName, lastName: t.lastName, avatarUrl: t.avatarUrl }))} />
                </div>
              </div>
              <div className="p-3 modal-section space-y-2">
                <h4 className="modal-section-title">SUPPLIER</h4>
                <PartySelect
                  value={supplierPartyId}
                  onChange={(id, name) => {
                    setSupplierPartyId(id);
                    setSupplierName(name);
                    if (!name.toUpperCase().includes("BSP")) {
                      setAirlineChannel(false);
                      setAirlineChannelSupplierId(null);
                      setAirlineChannelSupplierName("");
                    }
                  }}
                  roleFilter="supplier"
                  initialDisplayName={supplierName}
                  prioritizedParties={orderTravellers.map(t => ({ id: t.id, display_name: [t.firstName, t.lastName].filter(Boolean).join(" ").trim() || t.id, firstName: t.firstName, lastName: t.lastName, avatarUrl: t.avatarUrl }))}
                />
                {supplierName.toUpperCase().includes("BSP") && (
                  <div className="mt-1.5 space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={airlineChannel}
                        onChange={(e) => {
                          setAirlineChannel(e.target.checked);
                          if (!e.target.checked) {
                            setAirlineChannelSupplierId(null);
                            setAirlineChannelSupplierName("");
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs font-medium text-gray-700">Airline Channel</span>
                      <span className="text-[10px] text-gray-400">ticket issued in airline system, billed via BSP</span>
                    </label>
                    {airlineChannel && (
                      <div className="pl-6">
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Airline (issuing system)</label>
                        <PartySelect
                          value={airlineChannelSupplierId}
                          onChange={(id, name) => { setAirlineChannelSupplierId(id); setAirlineChannelSupplierName(name); }}
                          roleFilter="supplier"
                          initialDisplayName={airlineChannelSupplierName}
                          prioritizedParties={[]}
                        />
                      </div>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-0.5">Ref</label>
                    <input type="text" value={refNr} onChange={(e) => setRefNr(e.target.value)} placeholder="Booking ref" className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-0.5">Status</label>
                    <select value={resStatus} onChange={(e) => setResStatus(e.target.value as ServiceData["resStatus"])} className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                      {RES_STATUS_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                    </select>
                  </div>
                </div>
              </div>
              </>
            )}

            {/* Flight Schedule — in the left column */}
            {categoryType === "flight" && addFlightScheduleBlock}
            {/* Tour: Flight Information — parse document above or add/edit manually */}
            {categoryType === "tour" && (
              <div className="mt-3 p-3 rounded-lg border bg-sky-50/50 border-sky-100">
                <h4 className="text-xs font-semibold uppercase tracking-wide mb-2 text-sky-600">FLIGHT INFORMATION</h4>
                <p className="text-xs text-gray-500 mb-3">Parse document above, or add flight segments manually:</p>
                <FlightItineraryInput
                  segments={flightSegments}
                  onSegmentsChange={(segs) => setFlightSegments(normalizeSegmentsArrivalYear(segs) as FlightSegment[])}
                  readonly={false}
                />
              </div>
            )}
            </div>

            {/* Right side: PRICING → PARTIES → Booking Terms */}
            <RightWrapper {...rightWrapperProps}>
            {/* PRICING first */}
            <div className="space-y-2">
              <div className="p-3 modal-section space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="modal-section-title">PRICING</h4>
                  {(categoryType as string) === "hotel" && (
                    <div className="flex rounded-lg border border-gray-300 p-0.5 bg-gray-100" role="group" aria-label="Price per night or per stay">
                      <button
                        type="button"
                        onClick={() => {
                          if (hotelPricePer === "stay") {
                            const n = dateFrom && dateTo ? Number(nightsBetween(dateFrom, dateTo)) || 1 : 1;
                            setPriceUnits(n >= 1 ? n : 1);
                            prevDatesRef.current = dateFrom && dateTo ? `${dateFrom}|${dateTo}` : "";
                          }
                          setHotelPricePer("night");
                        }}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${hotelPricePer === "night" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
                      >
                        Per night
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (hotelPricePer === "night") {
                            const totalCost = parseFloat(servicePrice) || 0;
                            const totalSale = parseFloat(clientPrice) || 0;
                            setServicePrice(String(totalCost));
                            setClientPrice(String(totalSale));
                            setPriceUnits(1);
                            prevDatesRef.current = "";
                          }
                          setHotelPricePer("stay");
                        }}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${hotelPricePer === "stay" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
                      >
                        Per stay
                      </button>
                    </div>
                  )}
                </div>

                {/* Tour / commission-style: Cost | Commission; Agent discount | Sale; Line items; Marge | VAT (no Units) */}
                {usesCommissionPricing ? (
                  <div className="space-y-3">
                    {/* Transfer: supplier currency + FX → cost in company currency (same pattern as Hotel) */}
                    {categoryType === "transfer" && (
                      <div className="rounded-lg bg-amber-50/60 border border-amber-200/60 p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-slate-600 shrink-0">Supplier&apos;s Service currency</span>
                          <select
                            value={serviceCurrency}
                            onChange={(e) => {
                              const c = e.target.value;
                              setServiceCurrency(c);
                              setExchangeRate("");
                              if (c === (companyCurrencyCode || "EUR")) {
                                const f = parseFloat(servicePriceForeign) || 0;
                                const r = parseFloat(exchangeRate) || 0;
                                if (f > 0 && r > 0) setServicePrice(String(Math.round(f * r * 100) / 100));
                              }
                            }}
                            className="cursor-pointer text-blue-600 hover:text-blue-700 hover:underline bg-transparent border-0 border-b border-dashed border-slate-400 py-0.5 px-0 text-sm font-medium focus:ring-0 focus:outline-none min-w-0"
                            aria-label="Supplier's Service currency (click to open)"
                          >
                            <option value="EUR">{getCurrencySymbol("EUR")} (EUR)</option>
                            <option value="CHF">{getCurrencySymbol("CHF")} (CHF)</option>
                            <option value="USD">{getCurrencySymbol("USD")} (USD)</option>
                            <option value="GBP">{getCurrencySymbol("GBP")} (GBP)</option>
                          </select>
                        </div>
                        {serviceCurrency !== (companyCurrencyCode || "EUR") && (
                          <>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm text-slate-600 shrink-0">Service price</span>
                              <div className="inline-flex items-center rounded border border-slate-300 w-28 overflow-hidden focus-within:border-sky-500">
                                <span className="pl-2 text-slate-600 shrink-0">{getCurrencySymbol(serviceCurrency)}</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={servicePriceForeign}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setServicePriceForeign(v);
                                    const f = parseFloat(v) || 0;
                                    const r = parseFloat(exchangeRate) || 0;
                                    pricingLastEditedRef.current = "cost";
                                    if (r > 0) setServicePrice(String(Math.round(f * r * 100) / 100));
                                  }}
                                  placeholder="0.00"
                                  className="flex-1 min-w-0 w-20 py-1 pr-2 text-right border-0 bg-transparent focus:ring-0 focus:outline-none modal-input [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm text-slate-500">1 {serviceCurrency} =</span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={rateFetching}
                                  onClick={async () => {
                                    setRateFetching(true);
                                    try {
                                      const url = `${typeof window !== "undefined" ? window.location.origin : ""}/api/currency-rate?from=${encodeURIComponent(serviceCurrency)}&to=${encodeURIComponent(companyCurrencyCode || "EUR")}`;
                                      const r = await fetch(url);
                                      const data = await r.json();
                                      const rateVal = data.rate != null ? Number(data.rate) : NaN;
                                      if (Number.isFinite(rateVal) && rateVal > 0) {
                                        setExchangeRate(String(rateVal));
                                        const f = parseFloat(servicePriceForeign) || 0;
                                        pricingLastEditedRef.current = "cost";
                                        if (f > 0) setServicePrice(String(Math.round(f * rateVal * 100) / 100));
                                      }
                                    } catch (_) {}
                                    setRateFetching(false);
                                  }}
                                  className="text-sm text-blue-600 hover:underline disabled:opacity-50"
                                >
                                  {rateFetching ? "…" : "Fetch"}
                                </button>
                                <div className="inline-flex items-center rounded border border-slate-300 overflow-hidden focus-within:border-sky-500">
                                  <span className="pl-2 text-slate-600 text-sm shrink-0">{currencySymbol}</span>
                                  <input
                                    type="number"
                                    step="0.0001"
                                    min="0"
                                    max="10"
                                    value={exchangeRate}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setExchangeRate(v);
                                      const f = parseFloat(servicePriceForeign) || 0;
                                      const r = parseFloat(v) || 0;
                                      pricingLastEditedRef.current = "cost";
                                      if (r > 0) setServicePrice(String(Math.round(f * r * 100) / 100));
                                    }}
                                    placeholder="—"
                                    title="Rate to company currency"
                                    className="w-20 py-1 pl-1 pr-2 text-right text-sm tabular-nums border-0 bg-transparent modal-input focus:ring-0 [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                                  />
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Cost ({currencySymbol})</label>
                        {categoryType === "transfer" && serviceCurrency !== (companyCurrencyCode || "EUR") ? (
                          <div
                            className={`w-full rounded-lg border px-2.5 py-1.5 text-sm text-right tabular-nums bg-gray-50 text-gray-800 ${parseAttemptedButEmpty.has("servicePrice") ? "ring-2 ring-red-300 border-red-400 bg-red-50/50" : parsedFields.has("servicePrice") ? "ring-2 ring-green-300 border-green-400" : "border-gray-200"}`}
                            title="Converted from supplier currency; edit amount and rate above"
                          >
                            {(() => {
                              const sp = parseFloat(servicePrice) || 0;
                              return sp > 0 ? `${currencySymbol}${sp.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";
                            })()}
                          </div>
                        ) : (
                          <input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            value={servicePrice}
                            onChange={(e) => {
                              pricingLastEditedRef.current = "cost";
                              setServicePrice(sanitizeDecimalInput(e.target.value));
                            }}
                            placeholder="0.00"
                            className={`w-full rounded-lg border px-2.5 py-1.5 text-sm tabular-nums ${parseAttemptedButEmpty.has("servicePrice") ? "ring-2 ring-red-300 border-red-400 bg-red-50/50" : parsedFields.has("servicePrice") ? "ring-2 ring-green-300 border-green-400 focus:border-green-500 focus:ring-green-500" : "border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"}`}
                          />
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Commission</label>
                        <select
                          value={selectedCommissionIndex}
                          onFocus={loadSupplierCommissions}
                          onChange={(e) => {
                            pricingLastEditedRef.current = "commission";
                            setSelectedCommissionIndex(parseInt(e.target.value, 10));
                          }}
                          className="w-full min-w-0 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          aria-label="Commission"
                        >
                          <option value={-1}>—</option>
                          {supplierCommissions.map((c, i) => (
                            <option key={i} value={i}>
                              {c.name}{c.rate != null ? ` (${c.rate}%)` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="border-t border-gray-100 pt-1.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-600">Extra</span>
                        <button
                          type="button"
                          onClick={() => {
                            pricingLastEditedRef.current = "cost";
                            setServicePriceLineItems((prev) => [...prev, { description: "", amount: 0, commissionable: true }]);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-700"
                        >
                          + Add
                        </button>
                      </div>
                      {servicePriceLineItems.length > 0 && (
                        <div className="space-y-1">
                          {servicePriceLineItems.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 py-1.5 px-2 rounded bg-gray-50 border border-gray-100">
                              <input
                                type="text"
                                placeholder="Description"
                                value={item.description}
                                onChange={(e) => {
                                  pricingLastEditedRef.current = "cost";
                                  setServicePriceLineItems((prev) => { const next = [...prev]; next[idx] = { ...next[idx], description: e.target.value }; return next; });
                                }}
                                className="flex-1 min-w-0 rounded border border-gray-300 px-2 py-1 text-sm"
                              />
                              <div className="inline-flex shrink-0 rounded border border-gray-300 overflow-hidden">
                                <span className="pl-1.5 py-1 text-slate-500 text-xs">{currencySymbol}</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={item.amount || ""}
                                  onChange={(e) => {
                                    pricingLastEditedRef.current = "cost";
                                    const v = parseFloat(e.target.value) || 0;
                                    setServicePriceLineItems((prev) => { const next = [...prev]; next[idx] = { ...next[idx], amount: v }; return next; });
                                  }}
                                  placeholder="0.00"
                                  className="w-16 py-1 pr-1.5 text-sm text-right [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                                />
                              </div>
                              <label className="flex shrink-0 items-center gap-1 text-xs text-gray-600">
                                <input
                                  type="checkbox"
                                  checked={item.commissionable}
                                  onChange={(e) => {
                                    pricingLastEditedRef.current = "cost";
                                    setServicePriceLineItems((prev) => { const next = [...prev]; next[idx] = { ...next[idx], commissionable: e.target.checked }; return next; });
                                  }}
                                  className="rounded border-gray-300"
                                />
                                Comm
                              </label>
                              <button
                                type="button"
                                onClick={() => { pricingLastEditedRef.current = "cost"; setServicePriceLineItems((prev) => prev.filter((_, i) => i !== idx)); }}
                                className="shrink-0 text-red-500 hover:text-red-600 p-0.5"
                                aria-label="Remove"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Service Price Net + Client price summary (same layout; client row in sky tones) */}
                    {(() => {
                      const comm = selectedCommissionIndex >= 0 ? supplierCommissions[selectedCommissionIndex] : null;
                      const hasComm = comm && comm.rate != null && comm.rate > 0;
                      const commAmount = hasComm ? getCommissionAmount(commissionableCost) : 0;
                      const netPrice = Math.round((effectiveServicePrice - commAmount) * 100) / 100;
                      const clientTotal = Math.round((parseFloat(clientPrice) || 0) * 100) / 100;
                      return (
                        <div className="mt-1 space-y-2">
                          <div className={`rounded-lg px-3 py-2 ${hasComm ? "bg-amber-50 border border-amber-200" : "bg-gray-50 border border-gray-200"}`}>
                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-semibold uppercase tracking-wide ${hasComm ? "text-amber-800" : "text-gray-500"}`}>Service Price Net</span>
                              <span className={`text-xs ${hasComm ? "text-amber-600" : "text-gray-400"}`}>pay to operator</span>
                            </div>
                            <div className={`mt-1 text-right text-lg font-bold ${hasComm ? "text-amber-900" : "text-gray-700"}`}>
                              {currencySymbol}{netPrice.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                          <div className="rounded-lg px-3 py-2 bg-sky-50 border border-sky-200">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold uppercase tracking-wide text-sky-800">Client price</span>
                              <span className="text-xs text-sky-600">total to client</span>
                            </div>
                            <div className="mt-1 text-right text-lg font-bold text-sky-900">
                              {currencySymbol}{clientTotal.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Agent discount</label>
                        <div className="flex gap-1.5">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={agentDiscountValue}
                            onChange={(e) => {
                              pricingLastEditedRef.current = "agent";
                              setAgentDiscountValue(sanitizeNumber(e.target.value));
                            }}
                            placeholder="0"
                            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                          />
                          <select
                            value={agentDiscountType}
                            onChange={(e) => {
                              pricingLastEditedRef.current = "agent";
                              setAgentDiscountType(e.target.value as "%" | "€");
                            }}
                            className="w-12 shrink-0 rounded-lg border border-gray-300 px-1.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            aria-label="Discount type"
                          >
                            <option value="%">%</option>
                            <option value="€">€</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Sale ({currencySymbol})</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={clientPrice}
                          onChange={(e) => {
                            pricingLastEditedRef.current = "sale";
                            const v = parseFloat(e.target.value) || 0;
                            setClientPrice(String(Math.round(v * 100) / 100));
                          }}
                          placeholder="0.00"
                          className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield] focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Marge ({currencySymbol})</label>
                        <input
                          type="number"
                          step="0.01"
                          value={marge}
                          onChange={(e) => {
                            pricingLastEditedRef.current = "marge";
                            setMarge(sanitizeNumber(e.target.value));
                          }}
                          placeholder="0.00"
                          title="Edit margin — sale updates; or edit sale to set margin"
                          className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-right [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield] focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">VAT</label>
                        <select
                          value={vatRate}
                          onChange={(e) => setVatRate(Number(e.target.value))}
                          className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          aria-label="VAT"
                        >
                          <option value={0}>0%</option>
                          <option value={21}>21%</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ) : categoryType === "flight" ? (
                  /* Flight / Ancillary: Bulk Price row above clients, per-column down-arrow to apply; then client rows */
                  <div className="space-y-3">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse table-fixed">
                        <thead>
                          <tr className="border-b border-gray-200 bg-blue-50/60">
                            <th className="text-left py-0 pr-2 font-medium text-gray-700 align-middle text-xs">Bulk Price</th>
                            <th className="text-right py-0 px-1 align-top">
                              <div className="space-y-0.5">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={bulkCost}
                                  onChange={(e) => setBulkCost(sanitizeNumber(e.target.value))}
                                  placeholder="0"
                                  className="w-full rounded border border-gray-300 px-1 py-0.5 text-right text-xs bg-white [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const parseNum = (s: string) => parseFloat((s ?? "").trim().replace(/,/g, ".")) || 0;
                                    const v = parseNum(bulkCost);
                                    if (!v && !bulkCost.trim()) return;
                                    const saleVal = parseNum(bulkSale);
                                    setPricingPerClient(prev => prev.map(p => {
                                      const costStr = bulkCost.trim() ? String(v) : (p.cost ?? "");
                                      const saleStr = p.sale ?? "";
                                      const costN = parseNum(costStr);
                                      const saleN = saleVal || parseNum(saleStr);
                                      const margeN = saleN && costN ? Math.round((saleN - costN) * 100) / 100 : parseNum(p.marge ?? "");
                                      return { ...p, cost: costStr, marge: margeN ? String(margeN) : (p.marge ?? "") };
                                    }));
                                  }}
                                  className="w-full flex items-center justify-center py-0.5 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 text-xs leading-none"
                                  title="Apply Cost to all clients"
                                >
                                  <span className="text-base">↓</span>
                                </button>
                              </div>
                            </th>
                            <th className="text-right py-0 px-1 align-top">
                              <div className="space-y-0.5">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={bulkMarge}
                                  onChange={(e) => setBulkMarge(sanitizeNumber(e.target.value))}
                                  placeholder="0"
                                  className="w-full rounded border border-gray-300 px-1 py-0.5 text-right text-xs bg-white [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const parseNum = (s: string) => parseFloat((s ?? "").trim().replace(/,/g, ".")) || 0;
                                    const v = parseNum(bulkMarge);
                                    if (!v && !bulkMarge.trim()) return;
                                    setPricingPerClient(prev => prev.map(p => ({ ...p, marge: bulkMarge.trim() ? String(v) : (p.marge ?? "") })));
                                  }}
                                  className="w-full flex items-center justify-center py-0.5 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 text-xs leading-none"
                                  title="Apply Marge to all clients"
                                >
                                  <span className="text-base">↓</span>
                                </button>
                              </div>
                            </th>
                            <th className="text-right py-0 px-1 align-top">
                              <div className="space-y-0.5">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={bulkSale}
                                  onChange={(e) => setBulkSale(sanitizeNumber(e.target.value))}
                                  placeholder="0"
                                  className="w-full rounded border border-gray-300 px-1 py-0.5 text-right text-xs bg-white [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const parseNum = (s: string) => parseFloat((s ?? "").trim().replace(/,/g, ".")) || 0;
                                    const v = parseNum(bulkSale);
                                    if (!v && !bulkSale.trim()) return;
                                    const costVal = parseNum(bulkCost);
                                    setPricingPerClient(prev => prev.map(p => {
                                      const saleStr = bulkSale.trim() ? String(v) : (p.sale ?? "");
                                      const costStr = p.cost ?? "";
                                      const saleN = parseNum(saleStr);
                                      const costN = costVal || parseNum(costStr);
                                      const margeN = saleN && costN ? Math.round((saleN - costN) * 100) / 100 : parseNum(p.marge ?? "");
                                      return { ...p, sale: saleStr, marge: margeN ? String(margeN) : (p.marge ?? "") };
                                    }));
                                  }}
                                  className="w-full flex items-center justify-center py-0.5 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 text-xs leading-none"
                                  title="Apply Sale to all clients"
                                >
                                  <span className="text-base">↓</span>
                                </button>
                              </div>
                            </th>
                          </tr>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-1.5 pr-2 font-medium text-gray-600">Client</th>
                            <th className="text-right py-1.5 px-2 font-medium text-gray-600">Cost ({currencySymbol})</th>
                            <th className="text-right py-1.5 px-2 font-medium text-gray-600">Marge ({currencySymbol})</th>
                            <th className="text-right py-1.5 px-2 font-medium text-gray-600">Sale ({currencySymbol})</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clients.filter(c => c.id || c.name).map((client, idx) => (
                            <tr key={client.id ?? idx} className="border-b border-gray-100">
                              <td className="py-1.5 pr-2 text-gray-900">{toTitleCaseForDisplay(client.name || "") || "—"}</td>
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={pricingPerClient[idx]?.cost ?? ""}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const costStr = raw.replace(/\s/g, "");
                                    const cost = parsePrice(costStr);
                                    const marge = parsePrice(pricingPerClient[idx]?.marge);
                                    const sale = Math.round((cost + marge) * 100) / 100;
                                    setPricingPerClient(prev => {
                                      const n = [...prev];
                                      if (!n[idx]) n[idx] = { cost: "", marge: "", sale: "" };
                                      n[idx] = { cost: costStr, marge: pricingPerClient[idx]?.marge ?? "", sale: sale ? String(sale) : "" };
                                      return n;
                                    });
                                  }}
                                  placeholder="0.00"
                                  className="w-full rounded border border-gray-300 px-2 py-1 text-right text-sm [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                                />
                              </td>
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={pricingPerClient[idx]?.marge ?? ""}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const margeStr = raw.replace(/\s/g, "");
                                    const cost = parsePrice(pricingPerClient[idx]?.cost);
                                    const marge = parsePrice(margeStr);
                                    const sale = Math.round((cost + marge) * 100) / 100;
                                    setPricingPerClient(prev => {
                                      const n = [...prev];
                                      if (!n[idx]) n[idx] = { cost: "", marge: "", sale: "" };
                                      n[idx] = { cost: pricingPerClient[idx]?.cost ?? "", marge: margeStr, sale: sale ? String(sale) : "" };
                                      return n;
                                    });
                                  }}
                                  placeholder="0.00"
                                  className="w-full rounded border border-gray-300 px-2 py-1 text-right text-sm [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                                />
                              </td>
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={pricingPerClient[idx]?.sale ?? ""}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const saleStr = raw.replace(/\s/g, "");
                                    const cost = parsePrice(pricingPerClient[idx]?.cost);
                                    const sale = parsePrice(saleStr);
                                    const marge = Math.round((sale - cost) * 100) / 100;
                                    setPricingPerClient(prev => {
                                      const n = [...prev];
                                      if (!n[idx]) n[idx] = { cost: "", marge: "", sale: "" };
                                      n[idx] = { cost: pricingPerClient[idx]?.cost ?? "", marge: marge ? String(marge) : "", sale: saleStr };
                                      return n;
                                    });
                                  }}
                                  placeholder="0.00"
                                  className="w-full rounded border border-gray-300 px-2 py-1 text-right text-sm [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {(() => {
                      const totalCost = pricingPerClient.reduce((s, p) => s + parsePrice(p.cost), 0);
                      const totalMarge = pricingPerClient.reduce((s, p) => s + parsePrice(p.marge), 0);
                      const totalSale = pricingPerClient.reduce((s, p) => s + parsePrice(p.sale), 0);
                      return (
                        <div className="grid grid-cols-3 gap-2 border-t border-gray-200 pt-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-0.5">Total Cost ({currencySymbol})</label>
                            <div className="rounded border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm font-medium text-gray-800">{totalCost.toFixed(2)}</div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-0.5">Total Marge ({currencySymbol})</label>
                            <div className="rounded border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm font-medium text-gray-800">{totalMarge.toFixed(2)}</div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-0.5">Total Sale ({currencySymbol})</label>
                            <div className="rounded border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm font-medium text-gray-800">{totalSale.toFixed(2)}</div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(categoryType as string) === "hotel" && (
                      <>
                        <div className="rounded-lg bg-amber-50/60 border border-amber-200/60 p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-slate-600 shrink-0">Supplier&apos;s Service currency</span>
                          <select
                            value={serviceCurrency}
                            onChange={(e) => {
                              const c = e.target.value;
                              setServiceCurrency(c);
                              setExchangeRate("");
                              if (c === (companyCurrencyCode || "EUR")) {
                                const f = parseFloat(servicePriceForeign) || 0;
                                const r = parseFloat(exchangeRate) || 0;
                                const mult = (categoryType as string) === "hotel" && hotelPricePer === "night" ? (priceUnits >= 1 ? priceUnits : 1) : 1;
                                if (f > 0 && r > 0) setServicePrice(String(Math.round(f * r * mult * 100) / 100));
                              }
                            }}
                            className="cursor-pointer text-blue-600 hover:text-blue-700 hover:underline bg-transparent border-0 border-b border-dashed border-slate-400 py-0.5 px-0 text-sm font-medium focus:ring-0 focus:outline-none min-w-0"
                            aria-label="Supplier's Service currency (click to open)"
                          >
                            <option value="EUR">{getCurrencySymbol("EUR")} (EUR)</option>
                            <option value="CHF">{getCurrencySymbol("CHF")} (CHF)</option>
                            <option value="USD">{getCurrencySymbol("USD")} (USD)</option>
                            <option value="GBP">{getCurrencySymbol("GBP")} (GBP)</option>
                          </select>
                        </div>
                        {serviceCurrency !== (companyCurrencyCode || "EUR") && (
                          <>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm text-slate-600 shrink-0">Service price</span>
                              <div className="inline-flex items-center rounded border border-slate-300 w-28 overflow-hidden focus-within:border-sky-500">
                                <span className="pl-2 text-slate-600 shrink-0">{getCurrencySymbol(serviceCurrency)}</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={servicePriceForeign}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setServicePriceForeign(v);
                                    const f = parseFloat(v) || 0;
                                    const r = parseFloat(exchangeRate) || 0;
                                    const mult = (categoryType as string) === "hotel" && hotelPricePer === "night" ? (priceUnits >= 1 ? priceUnits : 1) : 1;
                                    if (r > 0) setServicePrice(String(Math.round(f * r * mult * 100) / 100));
                                  }}
                                  placeholder="0.00"
                                  className="flex-1 min-w-0 w-20 py-1 pr-2 text-right border-0 bg-transparent focus:ring-0 focus:outline-none modal-input [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm text-slate-500">1 {serviceCurrency} =</span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={rateFetching}
                                  onClick={async () => {
                                    setRateFetching(true);
                                    try {
                                      const url = `${typeof window !== "undefined" ? window.location.origin : ""}/api/currency-rate?from=${encodeURIComponent(serviceCurrency)}&to=${encodeURIComponent(companyCurrencyCode || "EUR")}`;
                                      const r = await fetch(url);
                                      const data = await r.json();
                                      const rateVal = data.rate != null ? Number(data.rate) : NaN;
                                      if (Number.isFinite(rateVal) && rateVal > 0) {
                                        setExchangeRate(String(rateVal));
                                        const f = parseFloat(servicePriceForeign) || 0;
                                        const mult = (categoryType as string) === "hotel" && hotelPricePer === "night" ? (priceUnits >= 1 ? priceUnits : 1) : 1;
                                        if (f > 0) setServicePrice(String(Math.round(f * rateVal * mult * 100) / 100));
                                      }
                                    } catch (_) {}
                                    setRateFetching(false);
                                  }}
                                  className="text-sm text-blue-600 hover:underline disabled:opacity-50"
                                >
                                  {rateFetching ? "…" : "Fetch"}
                                </button>
                                <div className="inline-flex items-center rounded border border-slate-300 overflow-hidden focus-within:border-sky-500">
                                  <span className="pl-2 text-slate-600 text-sm shrink-0">{currencySymbol}</span>
                                  <input
                                    type="number"
                                    step="0.0001"
                                    min="0"
                                    max="10"
                                    value={exchangeRate}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setExchangeRate(v);
                                      const f = parseFloat(servicePriceForeign) || 0;
                                      const r = parseFloat(v) || 0;
                                      const mult = (categoryType as string) === "hotel" && hotelPricePer === "night" ? (priceUnits >= 1 ? priceUnits : 1) : 1;
                                      if (r > 0) setServicePrice(String(Math.round(f * r * mult * 100) / 100));
                                    }}
                                    placeholder="—"
                                    title="Rate to company currency"
                                    className="w-20 py-1 pl-1 pr-2 text-right text-sm tabular-nums border-0 bg-transparent modal-input focus:ring-0 [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                                  />
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                        </div>
                        <div className="border-t border-slate-300 my-2" role="separator" />
                      </>
                    )}
                    {(categoryType as string) === "hotel" ? (
                    <div className="rounded-lg bg-sky-50/50 border border-sky-200/60 p-3 space-y-2">
                    <div className="space-y-2">
                      {hotelPricePer === "night" ? (
                        <>
                          <div className="grid grid-cols-[1fr_5.5rem_5.5rem] gap-x-2 gap-y-2 items-center text-sm">
                            <span className="text-slate-500 font-medium"></span>
                            <span className="text-slate-500 font-medium text-right tabular-nums">Per night</span>
                            <span className="text-slate-500 font-medium text-right tabular-nums">Per stay</span>
                          </div>
                          <div className="grid grid-cols-[1fr_5.5rem_5.5rem] gap-x-2 gap-y-2 items-center">
                            <span className="text-slate-600 shrink-0">Service price</span>
                            {(categoryType as string) === "hotel" && serviceCurrency !== (companyCurrencyCode || "EUR") ? (
                              <>
                                <span className="text-slate-800 tabular-nums text-right w-[5.5rem]">{(() => { const f = parseFloat(servicePriceForeign) || 0; const r = parseFloat(exchangeRate) || 0; const perNight = r > 0 ? Math.round(f * r * 100) / 100 : 0; return perNight > 0 ? `${currencySymbol}${(perNight).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"; })()}</span>
                                <span className="text-slate-800 tabular-nums text-right w-[5.5rem]">{(() => { const f = parseFloat(servicePriceForeign) || 0; const r = parseFloat(exchangeRate) || 0; const total = r > 0 && priceUnits >= 1 ? Math.round(f * r * priceUnits * 100) / 100 : 0; return total > 0 ? `${currencySymbol}${(total).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"; })()}</span>
                              </>
                            ) : (
                              <>
                                <div className="flex justify-end w-[5.5rem]"><div className={`inline-flex items-center min-h-[2.25rem] rounded border w-24 overflow-hidden ${parsedFields.has("servicePrice") ? "border-green-500 bg-green-50/30" : parseAttemptedButEmpty.has("servicePrice") ? "border-red-400 bg-red-50/30" : "border-slate-300"} focus-within:border-sky-500`}><span className="pl-1 text-slate-600 text-xs">{currencySymbol}</span><input type="number" step="0.01" min="0" value={priceUnits > 0 && !isNaN(parseFloat(servicePrice)) ? Math.round((parseFloat(servicePrice) / priceUnits) * 100) / 100 : ""} onChange={(e) => { pricingLastEditedRef.current = "cost"; const v = parseFloat(e.target.value) || 0; setServicePrice(String(Math.round(v * priceUnits * 100) / 100)); }} placeholder="0.00" className="flex-1 min-w-0 py-0.5 pr-1 text-right text-sm tabular-nums border-0 bg-transparent modal-input [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]" /></div></div>
                                <div className="flex justify-end w-[5.5rem]"><div className="inline-flex items-center min-h-[2.25rem] rounded border border-slate-300 w-24 overflow-hidden focus-within:border-sky-500"><span className="pl-1 text-slate-600 text-xs">{currencySymbol}</span><input type="number" step="0.01" min="0" value={!isNaN(parseFloat(servicePrice)) ? Math.round(parseFloat(servicePrice) * 100) / 100 : ""} onChange={(e) => { pricingLastEditedRef.current = "cost"; const v = parseFloat(e.target.value) || 0; setServicePrice(String(Math.round(v * 100) / 100)); }} placeholder="0.00" className="flex-1 min-w-0 py-0.5 pr-1 text-right text-sm tabular-nums border-0 bg-transparent modal-input [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]" /></div></div>
                              </>
                            )}
                          </div>
                          {serviceCurrency !== (companyCurrencyCode || "EUR") && (
                            <div className="grid grid-cols-[1fr_5.5rem_5.5rem] gap-x-2 gap-y-2 items-center">
                              <span className="text-slate-600 shrink-0">Actually paid</span>
                              <div className="flex justify-end w-[5.5rem]"><div className="inline-flex items-center min-h-[2.25rem] rounded border border-slate-300 w-24 overflow-hidden focus-within:border-sky-500"><span className="pl-1 text-slate-600 text-xs">{currencySymbol}</span><input type="number" step="0.01" min="0" value={priceUnits >= 1 && actuallyPaid !== "" && !isNaN(parseFloat(actuallyPaid)) ? Math.round((parseFloat(actuallyPaid) / priceUnits) * 100) / 100 : ""} onChange={(e) => { const v = parseFloat(e.target.value) || 0; if (priceUnits >= 1) setActuallyPaid(String(Math.round(v * priceUnits * 100) / 100)); }} placeholder="0.00" className="flex-1 min-w-0 py-0.5 pr-1 text-right text-sm tabular-nums border-0 bg-transparent modal-input [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]" /></div></div>
                              <div className="flex justify-end w-[5.5rem]"><div className="inline-flex items-center min-h-[2.25rem] rounded border border-slate-300 w-24 overflow-hidden focus-within:border-sky-500"><span className="pl-1 text-slate-600 text-xs">{currencySymbol}</span><input type="number" step="0.01" min="0" value={actuallyPaid !== "" && !isNaN(parseFloat(actuallyPaid)) ? Math.round(parseFloat(actuallyPaid) * 100) / 100 : ""} onChange={(e) => { const v = parseFloat(e.target.value) || 0; setActuallyPaid(String(Math.round(v * 100) / 100)); }} placeholder="0.00" className="flex-1 min-w-0 py-0.5 pr-1 text-right text-sm tabular-nums border-0 bg-transparent modal-input [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]" /></div></div>
                            </div>
                          )}
                          <div className="grid grid-cols-[1fr_5.5rem_5.5rem] gap-x-2 gap-y-2 items-center">
                            <span className="text-slate-600 shrink-0">Margin</span>
                            <div className="flex justify-end w-[5.5rem]">
                              <div className="inline-flex items-center min-h-[2.25rem] rounded border border-slate-300 w-24 overflow-hidden focus-within:border-sky-500">
                                <span className="pl-1 text-slate-600 shrink-0 text-xs">{currencySymbol}</span>
                                <input type="number" step="0.01" value={marge !== "" && !isNaN(parseFloat(marge)) ? Math.round(parseFloat(marge) * 100) / 100 : marge} onChange={(e) => { pricingLastEditedRef.current = "marge"; setMarge(sanitizeNumber(e.target.value)); }} placeholder="0.00" className="flex-1 min-w-0 py-0.5 pr-1 text-right text-sm tabular-nums border-0 bg-transparent modal-input [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]" />
                              </div>
                            </div>
                            <div className="flex justify-end w-[5.5rem]"><div className="inline-flex items-center min-h-[2.25rem] rounded border border-slate-300 w-24 overflow-hidden focus-within:border-sky-500"><span className="pl-1 text-slate-600 text-xs">{currencySymbol}</span><input type="number" step="0.01" value={priceUnits >= 1 && marge !== "" && !isNaN(parseFloat(marge)) ? Math.round(parseFloat(marge) * priceUnits * 100) / 100 : ""} onChange={(e) => { pricingLastEditedRef.current = "marge"; const v = parseFloat(e.target.value) || 0; if (priceUnits >= 1) setMarge(String(Math.round((v / priceUnits) * 100) / 100)); }} placeholder="0.00" className="flex-1 min-w-0 py-0.5 pr-1 text-right text-sm tabular-nums border-0 bg-transparent modal-input [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]" /></div></div>
                          </div>
                          <div className="grid grid-cols-[1fr_5.5rem_5.5rem] gap-x-2 gap-y-2 items-center">
                            <span className="text-slate-600 shrink-0">Client price</span>
                            <div className="flex justify-end w-[5.5rem]">
                              <div className={`inline-flex items-center min-h-[2.25rem] rounded border w-24 overflow-hidden ${parsedFields.has("clientPrice") ? "border-green-500 bg-green-50/30" : parseAttemptedButEmpty.has("clientPrice") ? "border-red-400 bg-red-50/30" : "border-slate-300"} focus-within:border-sky-500`}>
                                <span className="pl-1 text-slate-600 shrink-0 text-xs">{currencySymbol}</span>
                                <input type="number" step="0.01" min="0" value={priceUnits > 0 && !isNaN(parseFloat(clientPrice)) ? Math.round((parseFloat(clientPrice) / priceUnits) * 100) / 100 : ""} onChange={(e) => { pricingLastEditedRef.current = "sale"; const v = parseFloat(e.target.value) || 0; setClientPrice(String(Math.round(v * priceUnits * 100) / 100)); }} placeholder="0.00" title="Edit per night or per stay — the other updates automatically" className="flex-1 min-w-0 py-0.5 pr-1 text-right text-sm tabular-nums border-0 bg-transparent modal-input [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]" />
                              </div>
                            </div>
                            <div className="flex justify-end w-[5.5rem]"><div className="inline-flex items-center min-h-[2.25rem] rounded border border-slate-300 w-24 overflow-hidden focus-within:border-sky-500"><span className="pl-1 text-slate-600 text-xs">{currencySymbol}</span><input type="number" step="0.01" min="0" value={!isNaN(parseFloat(clientPrice)) ? Math.round(parseFloat(clientPrice) * 100) / 100 : ""} onChange={(e) => { pricingLastEditedRef.current = "sale"; const v = parseFloat(e.target.value) || 0; setClientPrice(String(Math.round(v * 100) / 100)); }} placeholder="0.00" className="flex-1 min-w-0 py-0.5 pr-1 text-right text-sm tabular-nums border-0 bg-transparent modal-input [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]" /></div></div>
                          </div>
                          <div className="grid grid-cols-[1fr_5.5rem_5.5rem] gap-x-2 gap-y-2 items-center pt-1.5 mt-0.5 border-t border-sky-200/80">
                            <span className="text-slate-700 font-medium shrink-0">Total Client price</span>
                            <div className="w-[5.5rem] text-right tabular-nums font-medium text-slate-900">{currencySymbol}{(priceUnits > 0 && !isNaN(parseFloat(clientPrice)) ? Math.round((parseFloat(clientPrice) / priceUnits) * 100) / 100 : 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            <div className="w-[5.5rem] text-right tabular-nums font-medium text-slate-900">{currencySymbol}{(Math.round(parseFloat(clientPrice) || 0) * 100 / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          </div>
                        </>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm text-slate-600 shrink-0">Service price</span>
                            {(categoryType as string) === "hotel" && serviceCurrency !== (companyCurrencyCode || "EUR") ? (
                              <span className="text-sm text-slate-800 tabular-nums">{(() => { const f = parseFloat(servicePriceForeign) || 0; const r = parseFloat(exchangeRate) || 0; const eur = r > 0 ? Math.round(f * r * 100) / 100 : 0; return eur > 0 ? `${currencySymbol}${(eur).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"; })()}</span>
                            ) : (
                              <div className={`inline-flex items-center rounded border w-28 max-w-full overflow-hidden ${parsedFields.has("servicePrice") ? "border-green-500 bg-green-50/30" : parseAttemptedButEmpty.has("servicePrice") ? "border-red-400 bg-red-50/30" : "border-slate-300"} focus-within:border-sky-500`}>
                                <span className="pl-2 text-slate-600 shrink-0">{currencySymbol}</span>
                                <input type="number" step="0.01" min="0" value={(() => { const eff = (categoryType as string) === "hotel" && hotelPricePer === "stay" ? 1 : priceUnits; const q = eff > 0 ? parseFloat(servicePrice) / eff : NaN; return (eff > 0 && !isNaN(q)) ? Math.round(q * 100) / 100 : servicePrice; })()} onChange={(e) => { pricingLastEditedRef.current = "cost"; const v = parseFloat(e.target.value) || 0; const eff = (categoryType as string) === "hotel" && hotelPricePer === "stay" ? 1 : priceUnits; setServicePrice(String(Math.round(v * eff * 100) / 100)); }} placeholder="0.00" className="flex-1 min-w-0 w-20 py-1 pr-2 text-right border-0 bg-transparent focus:ring-0 modal-input [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]" />
                              </div>
                            )}
                          </div>
                          {serviceCurrency !== (companyCurrencyCode || "EUR") && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm text-slate-600 shrink-0">Actually paid</span>
                              <div className="inline-flex items-center rounded border border-slate-300 w-28 overflow-hidden focus-within:border-sky-500">
                                <span className="pl-2 text-slate-600 shrink-0">{currencySymbol}</span>
                                <input type="number" step="0.01" min="0" value={actuallyPaid} onChange={(e) => setActuallyPaid(sanitizeNumber(e.target.value))} placeholder="0.00" className="flex-1 min-w-0 w-20 py-1 pr-2 text-right text-sm tabular-nums border-0 bg-transparent modal-input [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]" />
                              </div>
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm text-slate-600 shrink-0">{(categoryType as string) === "hotel" ? "Margin" : "Marge"}</span>
                            <div className="inline-flex items-center rounded border border-slate-300 w-28 max-w-full overflow-hidden focus-within:border-sky-500">
                              <span className="pl-2 text-slate-600 shrink-0">{currencySymbol}</span>
                              <input type="number" step="0.01" value={marge !== "" && !isNaN(parseFloat(marge)) ? Math.round(parseFloat(marge) * 100) / 100 : marge} onChange={(e) => { pricingLastEditedRef.current = "marge"; setMarge(sanitizeNumber(e.target.value)); }} placeholder="0.00" className="flex-1 min-w-0 w-20 py-1 pr-2 text-right border-0 bg-transparent focus:ring-0 modal-input [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]" />
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm text-slate-600 shrink-0">{(categoryType as string) === "hotel" ? "Total Client price" : "Sale"}</span>
                            <div className={`inline-flex items-center rounded border w-28 max-w-full overflow-hidden ${parsedFields.has("clientPrice") ? "border-green-500 bg-green-50/30" : parseAttemptedButEmpty.has("clientPrice") ? "border-red-400 bg-red-50/30" : "border-slate-300"} focus-within:border-sky-500`}>
                              <span className="pl-2 text-slate-600 shrink-0">{currencySymbol}</span>
                              <input type="number" step="0.01" min="0" value={(() => { const eff = (categoryType as string) === "hotel" && hotelPricePer === "stay" ? 1 : priceUnits; const q = eff > 0 ? parseFloat(clientPrice) / eff : NaN; return (eff > 0 && !isNaN(q)) ? Math.round(q * 100) / 100 : clientPrice; })()} onChange={(e) => { pricingLastEditedRef.current = "sale"; const v = parseFloat(e.target.value) || 0; const eff = (categoryType as string) === "hotel" && hotelPricePer === "stay" ? 1 : priceUnits; setClientPrice(String(Math.round(v * eff * 100) / 100)); }} placeholder="0.00" className="flex-1 min-w-0 w-20 py-1 pr-2 text-right border-0 bg-transparent focus:ring-0 modal-input [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    </div>
                    ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-slate-600 shrink-0">Cost</span>
                        <div className={`inline-flex items-center rounded border w-28 overflow-hidden focus-within:border-sky-500 ${correctedFields.has("servicePrice") ? "ring-2 ring-amber-400 border-amber-400 bg-amber-50/30" : "border-slate-300"}`}><span className="pl-2 text-slate-600 shrink-0">{currencySymbol}</span><input type="number" step="0.01" min="0" value={servicePrice} onChange={(e) => { pricingLastEditedRef.current = "cost"; setServicePrice(sanitizeNumber(e.target.value)); markCorrected("servicePrice"); }} placeholder="0.00" className="flex-1 min-w-0 w-20 py-1 pr-2 text-right border-0 bg-transparent modal-input [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]" /></div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-slate-600 shrink-0">Marge</span>
                        <div className="inline-flex items-center rounded border border-slate-300 w-28 overflow-hidden focus-within:border-sky-500"><span className="pl-2 text-slate-600 shrink-0">{currencySymbol}</span><input type="number" step="0.01" value={marge} onChange={(e) => { pricingLastEditedRef.current = "marge"; setMarge(sanitizeNumber(e.target.value)); }} placeholder="0.00" className="flex-1 min-w-0 w-20 py-1 pr-2 text-right border-0 bg-transparent modal-input [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]" /></div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-slate-600 shrink-0">Sale</span>
                        <div className={`inline-flex items-center rounded border w-28 overflow-hidden focus-within:border-sky-500 ${correctedFields.has("clientPrice") ? "ring-2 ring-amber-400 border-amber-400 bg-amber-50/30" : "border-slate-300"}`}><span className="pl-2 text-slate-600 shrink-0">{currencySymbol}</span><input type="number" step="0.01" min="0" value={clientPrice} onChange={(e) => { pricingLastEditedRef.current = "sale"; setClientPrice(sanitizeNumber(e.target.value)); markCorrected("clientPrice"); }} placeholder="0.00" className="flex-1 min-w-0 w-20 py-1 pr-2 text-right border-0 bg-transparent modal-input [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]" /></div>
                      </div>
                    </div>
                    )}
                  </div>
                )}

                {/* Margin / Profit for Tour / commission-style */}
                {usesCommissionPricing && (parseFloat(marge) || 0) !== 0 && (() => {
                  const margin = parseFloat(marge) || 0;
                  const vatAmount = vatRate > 0 ? margin * vatRate / (100 + vatRate) : 0;
                  const profit = margin - vatAmount;
                  return (
                    <div className="text-sm font-medium pt-1 border-t border-gray-200">
                      {vatRate > 0 ? (
                        <>
                          <div className={margin >= 0 ? "text-[#28A745]" : "text-red-600"}>
                            Margin: €{margin.toFixed(2)}
                            <span className="text-gray-500 ml-1">(VAT: €{vatAmount.toFixed(2)})</span>
                          </div>
                          <div className={margin >= 0 ? "text-[#28A745] font-semibold" : "text-red-600 font-semibold"}>
                            Profit: €{profit.toFixed(2)}
                          </div>
                        </>
                      ) : (
                        <div className={margin >= 0 ? "text-[#28A745] font-semibold" : "text-red-600 font-semibold"}>
                          Profit: €{margin.toFixed(2)}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {!usesCommissionPricing && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-slate-600 shrink-0">VAT</span>
                    <select
                      value={vatRate}
                      onChange={(e) => setVatRate(Number(e.target.value))}
                      className="cursor-pointer rounded border border-slate-300 px-2 py-1 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 min-w-0 w-16"
                      aria-label="VAT"
                    >
                      <option value={0}>0%</option>
                      <option value={21}>21%</option>
                    </select>
                  </div>
                  {(() => {
                    const usePerClient = categoryType === "flight" && pricingPerClient.length > 0;
                    const totalMargin = usePerClient
                      ? Math.round(pricingPerClient.reduce((s, p) => s + parsePrice(p.marge), 0) * 100) / 100
                      : Math.round((parseFloat(marge) || 0) * (categoryType === "hotel" && hotelPricePer === "stay" ? 1 : priceUnits) * 100) / 100;
                    const paid = (categoryType as string) === "hotel" && actuallyPaid !== "" ? parseFloat(actuallyPaid) : null;
                    const saleTotal = usePerClient
                      ? pricingPerClient.reduce((s, p) => s + parsePrice(p.sale), 0)
                      : parseFloat(clientPrice) || 0;
                    const marginFromPaid = paid != null && Number.isFinite(paid) ? Math.round((saleTotal - paid) * 100) / 100 : null;
                    const vatAmount = vatRate > 0 && (marginFromPaid != null ? marginFromPaid : totalMargin) >= 0
                      ? Math.round((marginFromPaid != null ? marginFromPaid : totalMargin) * vatRate / (100 + vatRate) * 100) / 100 : 0;
                    const profit = marginFromPaid != null
                      ? Math.round((marginFromPaid - vatAmount) * 100) / 100
                      : (totalMargin - vatAmount);
                    if (totalMargin === 0 && marginFromPaid == null) return null;
                    const marginPerUnit = usePerClient ? totalMargin : (parseFloat(marge) || 0);
                    return (
                      <div className="text-sm font-medium pt-1 border-t border-gray-200">
                        {vatRate > 0 ? (
                          <>
                            {marginFromPaid != null ? (
                              <>
                                <div className="text-gray-600">
                                  Margin (est.): {currencySymbol}{totalMargin.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <div className={marginFromPaid >= 0 ? 'text-[#28A745]' : 'text-red-600'}>
                                  Margin (actually paid): {currencySymbol}{marginFromPaid.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  <span className="text-gray-500 ml-1">(VAT: {currencySymbol}{vatAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>
                                </div>
                                <div className={(profit >= 0 ? 'text-[#28A745]' : 'text-red-600') + ' font-semibold'}>
                                  Profit: {currencySymbol}{profit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              </>
                            ) : (
                              <>
                                <div className={totalMargin >= 0 ? 'text-[#28A745]' : 'text-red-600'}>
                                  Margin: {currencySymbol}{totalMargin.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  {categoryType !== "flight" && (categoryType === "hotel" && hotelPricePer === "stay" ? false : priceUnits > 1) && <span className="text-gray-500 ml-1">({marginPerUnit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}×{(categoryType === "hotel" && hotelPricePer === "stay" ? 1 : priceUnits)})</span>}
                                  <span className="text-gray-500 ml-1">(VAT: {currencySymbol}{vatAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>
                                </div>
                                <div className={totalMargin >= 0 ? 'text-[#28A745] font-semibold' : 'text-red-600 font-semibold'}>
                                  Profit: {currencySymbol}{profit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              </>
                            )}
                          </>
                        ) : (
                          <div className={(marginFromPaid != null ? (marginFromPaid >= 0) : totalMargin >= 0) ? 'text-[#28A745] font-semibold' : 'text-red-600 font-semibold'}>
                            Profit: {currencySymbol}{((marginFromPaid != null ? (marginFromPaid - vatAmount) : totalMargin)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
                )}
              </div>

              {/* PARTIES moved to left column as tab (tour/other/transfer) */}

              {/* Booking Terms for hotel, tour, other — in right column (NOT for Transfer; Transfer has it at bottom) */}
              {categoryType !== "flight" && categoryType !== "transfer" && (
              <div className="mt-3 p-3 modal-section space-y-2">
                <h4 className="modal-section-title">Booking Terms</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {categoryType === "tour" && (
                    <div className="sm:col-span-2 min-w-0">
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Price Type</label>
                      <select value={priceType} onChange={(e) => setPriceType(e.target.value as "ebd" | "regular" | "spo")} className="w-full min-w-[10rem] rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white">
                        <option value="regular">Regular</option>
                        <option value="ebd">Early Booking (EBD)</option>
                        <option value="spo">Special Offer (SPO)</option>
                      </select>
                    </div>
                  )}
                  {categoryType !== "tour" && (
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Refund Policy</label>
                      <select value={refundPolicy} onChange={(e) => setRefundPolicy(e.target.value as "non_ref" | "refundable" | "fully_ref")} className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white">
                        <option value="non_ref">Non-refundable</option>
                        <option value="refundable">Refundable (with conditions)</option>
                        <option value="fully_ref">Fully Refundable</option>
                      </select>
                    </div>
                  )}
                </div>
                {categoryType !== "tour" && refundPolicy === "refundable" && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Free cancel until</label>
                      <DateInput value={freeCancellationUntil} onChange={setFreeCancellationUntil} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Penalty EUR</label>
                      <input type="number" min="0" step="0.01" value={cancellationPenaltyAmount} onChange={(e) => setCancellationPenaltyAmount(sanitizeNumber(e.target.value))} placeholder="0.00" className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Penalty %</label>
                      <input type="number" min="0" max="100" value={cancellationPenaltyPercent} onChange={(e) => setCancellationPenaltyPercent(e.target.value)} placeholder="0" className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white" />
                    </div>
                  </div>
                )}
                <div className="border-t border-gray-200 pt-2 mt-2">
                  {categoryType === "tour" ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="min-w-0">
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Deposit Due</label>
                        <DateInput value={paymentDeadlineDeposit} onChange={setPaymentDeadlineDeposit} className={`w-full min-w-[120px] rounded-lg border px-2.5 py-1.5 text-sm bg-white ${parseAttemptedButEmpty.has("paymentDeadlineDeposit") ? "ring-2 ring-red-300 border-red-400 bg-red-50/50" : parsedFields.has("paymentDeadlineDeposit") ? "ring-2 ring-green-300 border-green-400 focus:border-green-500 focus:ring-green-500" : "border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"}`} />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Deposit %</label>
                        <input type="number" min="0" max="100" value={depositPercent} onChange={(e) => setDepositPercent(e.target.value)} placeholder="10" className={`w-full min-w-[4rem] rounded-lg border px-2.5 py-1.5 text-sm bg-white [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield] ${parseAttemptedButEmpty.has("depositPercent") ? "ring-2 ring-red-300 border-red-400 bg-red-50/50" : parsedFields.has("depositPercent") ? "ring-2 ring-green-300 border-green-400 focus:border-green-500 focus:ring-green-500" : "border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"}`} />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Final Due</label>
                        <DateInput value={paymentDeadlineFinal} onChange={setPaymentDeadlineFinal} className={`w-full min-w-[120px] rounded-lg border px-2.5 py-1.5 text-sm bg-white ${parseAttemptedButEmpty.has("paymentDeadlineFinal") ? "ring-2 ring-red-300 border-red-400 bg-red-50/50" : parsedFields.has("paymentDeadlineFinal") ? "ring-2 ring-green-300 border-green-400 focus:border-green-500 focus:ring-green-500" : "border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"}`} />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Final %</label>
                        <input type="number" min="0" max="100" value={finalPercent} onChange={(e) => setFinalPercent(e.target.value)} placeholder="90" className={`w-full min-w-[4rem] rounded-lg border px-2.5 py-1.5 text-sm bg-white [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield] ${parseAttemptedButEmpty.has("finalPercent") ? "ring-2 ring-red-300 border-red-400 bg-red-50/50" : parsedFields.has("finalPercent") ? "ring-2 ring-green-300 border-green-400 focus:border-green-500 focus:ring-green-500" : "border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"}`} />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Payment Deadline</label>
                      <DateInput value={paymentDeadlineFinal} onChange={setPaymentDeadlineFinal} />
                    </div>
                  )}
                </div>
              </div>
              )}
            </div>
          </RightWrapper>
          </div>

          {/* Category-specific fields - Hotel Details at top for hotel; show here only for non-hotel (e.g. Tour) */}
          {showHotelFields && categoryType !== "hotel" && (
            <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-3">
              <h4 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Hotel Details</h4>
              
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">Hotel Name</label>
                <HotelSuggestInput
                  value={hotelName}
                  onChange={setHotelName}
                  onHotelSelected={(d) => {
                    setHotelName(d.name);
                    if (d.address) setHotelAddress(d.address);
                    if (d.phone) setHotelPhone(d.phone);
                    if (d.email) setHotelEmail(d.email);
                    setServiceName(d.name);
                    setHotelRoomOptions(d.roomOptions ?? []);
                    if (d.hid) {
                      setHotelHid(d.hid);
                      mealFetchedForRef.current = null;
                    }
                  }}
                  placeholder="Search hotel by name..."
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Room</label>
                  <input
                    type="text"
                    list="add-hotel-room-datalist-2"
                    value={hotelRoom}
                    onChange={(e) => setHotelRoom(e.target.value)}
                    placeholder="Room type (or choose from hotel)"
                    title={hotelRoom || undefined}
                    className="w-full rounded-lg border border-amber-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white"
                  />
                  {hotelRoomOptions.length > 0 && (
                    <datalist id="add-hotel-room-datalist-2">
                      {hotelRoomOptions.map((opt) => (
                        <option key={opt} value={opt} />
                      ))}
                    </datalist>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Board</label>
                  <select value={hotelBoard} onChange={(e) => setHotelBoard(e.target.value as typeof hotelBoard)} className="w-full rounded-lg border border-amber-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white">
                    <option value="room_only">Room only</option>
                    <option value="breakfast">Breakfast</option>
                    <option value="half_board">Half board</option>
                    <option value="full_board">Full board</option>
                    <option value="all_inclusive">AI (All inclusive)</option>
                    <option value="uai">UAI (Ultra All Inclusive)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Bed Type</label>
                  <select value={hotelBedType} onChange={(e) => setHotelBedType(e.target.value as typeof hotelBedType)} className="w-full rounded-lg border border-amber-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white">
                    <option value="king_queen">King/Queen</option>
                    <option value="twin">Twin</option>
                    <option value="not_guaranteed">Not guaranteed</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Address</label>
                  <input type="text" value={hotelAddress} onChange={(e) => setHotelAddress(e.target.value)} placeholder="Address" className="w-full rounded-lg border border-amber-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Phone</label>
                  <input type="tel" value={hotelPhone} onChange={(e) => setHotelPhone(e.target.value)} placeholder="Phone" className="w-full rounded-lg border border-amber-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Email</label>
                  <input type="email" value={hotelEmail} onChange={(e) => setHotelEmail(e.target.value)} placeholder="Email" className="w-full rounded-lg border border-amber-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white" />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Preferences</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                  <label className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input type="checkbox" checked={hotelPreferences.earlyCheckIn} onChange={(e) => setHotelPreferences(prev => ({ ...prev, earlyCheckIn: e.target.checked }))} className="rounded border-[#CED4DA] accent-[#387ADF] focus:ring-amber-400" />
                    Early check-in
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input type="checkbox" checked={hotelPreferences.lateCheckIn} onChange={(e) => setHotelPreferences(prev => ({ ...prev, lateCheckIn: e.target.checked }))} className="rounded border-[#CED4DA] accent-[#387ADF] focus:ring-amber-400" />
                    Late check-in
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input type="checkbox" checked={hotelPreferences.higherFloor} onChange={(e) => setHotelPreferences(prev => ({ ...prev, higherFloor: e.target.checked }))} className="rounded border-[#CED4DA] accent-[#387ADF] focus:ring-amber-400" />
                    Higher floor
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input type="checkbox" checked={hotelPreferences.kingSizeBed} onChange={(e) => setHotelPreferences(prev => ({ ...prev, kingSizeBed: e.target.checked }))} className="rounded border-[#CED4DA] accent-[#387ADF] focus:ring-amber-400" />
                    King size bed
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input type="checkbox" checked={hotelPreferences.honeymooners} onChange={(e) => setHotelPreferences(prev => ({ ...prev, honeymooners: e.target.checked }))} className="rounded border-[#CED4DA] accent-[#387ADF] focus:ring-amber-400" />
                    Honeymooners
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input type="checkbox" checked={hotelPreferences.silentRoom} onChange={(e) => setHotelPreferences(prev => ({ ...prev, silentRoom: e.target.checked }))} className="rounded border-[#CED4DA] accent-[#387ADF] focus:ring-amber-400" />
                    Silent room
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input type="checkbox" checked={hotelPreferences.repeatGuests} onChange={(e) => setHotelPreferences(prev => ({ ...prev, repeatGuests: e.target.checked }))} className="rounded border-[#CED4DA] accent-[#387ADF] focus:ring-amber-400" />
                    Repeat Guests
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input type="checkbox" checked={hotelPreferences.parking} onChange={(e) => setHotelPreferences(prev => ({ ...prev, parking: e.target.checked }))} className="rounded border-[#CED4DA] accent-[#387ADF] focus:ring-amber-400" />
                    Parking
                  </label>
                </div>
                <div>
                  <textarea value={hotelPreferences.freeText} onChange={(e) => setHotelPreferences(prev => ({ ...prev, freeText: e.target.value }))} placeholder="Additional preferences (free text)" rows={2} className="w-full rounded-md border border-[#CED4DA] px-2.5 py-1.5 text-sm placeholder:text-[#6C757D] focus:border-[#FFC107] focus:ring-1 focus:ring-amber-400 bg-white" />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const preferencesList = Object.entries(hotelPreferences).filter(([key, value]) => key !== "roomsNextTo" && key !== "freeText" && value === true).map(([key]) => key.replace(/([A-Z])/g, " $1").toLowerCase()).join(", ");
                    const message = `We have a reservation for ${hotelName}. Please confirm the reservation exists and consider the following preferences:\n\nRoom: ${hotelRoom || "Not specified"}\nBoard: ${hotelBoard}\nBed Type: ${hotelBedType}\nPreferences: ${preferencesList || "None"}${hotelPreferences.roomsNextTo ? `\nRooms next to: ${hotelPreferences.roomsNextTo}` : ""}${hotelPreferences.freeText ? `\nAdditional: ${hotelPreferences.freeText}` : ""}`;
                    alert(`Message to hotel:\n\n${message}\n\n(Will be saved to Communication tab)`);
                  }}
                  className="modal-primary-btn w-[90%] max-w-md mx-auto px-4 py-3 text-base font-semibold text-white bg-[#FF8C00] hover:bg-[#E67E00] rounded-md flex items-center justify-center gap-2"
                >
                  <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  Send to Hotel
                </button>
              </div>
            </div>
          )}

          {showTransferFields && (
            <div className="mt-3 p-3 modal-section space-y-3 relative">
              {showLinkedHint && (
                <div className="absolute -top-1 -right-1 z-10 animate-pulse">
                  <div className="rounded-full bg-amber-100/90 p-1.5 shadow-[0_0_12px_rgba(245,158,11,0.5)]">
                    <Sparkles className="w-4 h-4 text-amber-500" strokeWidth={2} />
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <h4 className="modal-section-title">Transfer Details</h4>
                <button
                  type="button"
                  onClick={() => setShowLinkedServicesModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-50 transition-colors"
                >
                  <Link2 className="w-4 h-4" />
                  Linked Services
                </button>
              </div>

              {/* Mode, Vehicle class, Details */}
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Mode</label>
                  <select value={transferMode} onChange={e => setTransferMode(e.target.value)} className="w-full rounded-lg border border-emerald-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white">
                    <option value="individual">Individual</option>
                    <option value="group">Group</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Vehicle Class</label>
                  <select value={vehicleClass} onChange={e => setVehicleClass(e.target.value)} className="w-full rounded-lg border border-emerald-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white">
                    <option value="">—</option>
                    <option value="economy">Economy</option>
                    <option value="comfort">Comfort</option>
                    <option value="business">Business</option>
                    <option value="premium">Premium</option>
                    <option value="first">First Class</option>
                    <option value="minivan">Minivan</option>
                    <option value="minibus">Minibus</option>
                    <option value="bus">Bus</option>
                    <option value="electric">Electric</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Details</label>
                  <input type="text" value={vehicleClassCustom} onChange={e => setVehicleClassCustom(e.target.value)} placeholder="e.g. Mercedes V-Class" className="w-full rounded-lg border border-emerald-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white" />
                </div>
              </div>

              {/* Routes */}
              {transferRoutes.map((route, idx) => {
                const isRoute3Plus = transferBookingType === "return" ? idx >= 2 : idx >= 1;
                const isExpanded = !isRoute3Plus || expandedRouteIdsAdd.has(route.id);
                const routeLabel = transferBookingType === "return" && transferRoutes.length === 2 ? (idx === 0 ? "Outbound" : "Return") : `Route ${idx + 1}`;
                return (
                <div key={route.id} className="p-2 bg-white rounded-lg border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between">
                    {isRoute3Plus ? (
                      <button type="button" onClick={() => toggleRouteExpandedAdd(route.id)} className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 uppercase hover:text-emerald-800">
                        <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        {routeLabel}
                      </button>
                    ) : (
                      <span className="text-[10px] font-semibold text-emerald-600 uppercase">{routeLabel}</span>
                    )}
                    {transferRoutes.length > 1 && (
                      <button type="button" onClick={() => removeTransferRouteAdd(route.id)} className="text-red-400 hover:text-red-600 text-xs">Remove</button>
                    )}
                  </div>
                  {isExpanded && (
                  <>
                  <div className="relative">
                    <label className="block text-[10px] font-medium text-gray-500 mb-0.5">From</label>
                    <input type="text" value={locationQueryAdd[`${route.id}-pickup`] ?? route.pickup} onChange={e => { handleLocationInputAdd(`${route.id}-pickup`, e.target.value); updateRouteFieldAdd(route.id, "pickup", e.target.value); }} onFocus={() => setActiveLocationFieldAdd(`${route.id}-pickup`)} onBlur={() => setTimeout(() => setActiveLocationFieldAdd(null), 200)} placeholder="Airport, hotel, address..." className="w-full rounded-lg border border-emerald-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white" />
                    {activeLocationFieldAdd === `${route.id}-pickup` && (locationResultsAdd[`${route.id}-pickup`] || []).length > 0 && (
                      <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {(locationResultsAdd[`${route.id}-pickup`] || []).map((s, i) => (
                          <button key={i} type="button" onMouseDown={() => selectLocationAdd(route.id, "pickup", s)} className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 flex items-center gap-2">
                            <span className="text-[10px] font-medium text-gray-400 uppercase w-12 shrink-0">{s.type}</span>
                            <span className="truncate">{s.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {(transferBookingType === "one_way" || transferBookingType === "return") ? (
                    <div className="relative">
                      <label className="block text-[10px] font-medium text-gray-500 mb-0.5">To</label>
                      <input type="text" value={locationQueryAdd[`${route.id}-dropoff`] ?? route.dropoff} onChange={e => { handleLocationInputAdd(`${route.id}-dropoff`, e.target.value); updateRouteFieldAdd(route.id, "dropoff", e.target.value); }} onFocus={() => setActiveLocationFieldAdd(`${route.id}-dropoff`)} onBlur={() => setTimeout(() => setActiveLocationFieldAdd(null), 200)} placeholder="Airport, hotel, address..." className="w-full rounded-lg border border-emerald-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white" />
                      {activeLocationFieldAdd === `${route.id}-dropoff` && (locationResultsAdd[`${route.id}-dropoff`] || []).length > 0 && (
                        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {(locationResultsAdd[`${route.id}-dropoff`] || []).map((s, i) => (
                            <button key={i} type="button" onMouseDown={() => selectLocationAdd(route.id, "dropoff", s)} className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 flex items-center gap-2">
                              <span className="text-[10px] font-medium text-gray-400 uppercase w-12 shrink-0">{s.type}</span>
                              <span className="truncate">{s.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Duration</label>
                      <select value={transferHours} onChange={e => setTransferHours(Number(e.target.value))} className="w-full rounded-lg border border-emerald-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white">
                        {[1,2,3,4,5,6,7,8,10,12].map(h => <option key={h} value={h}>{h} {h === 1 ? "hour" : "hours"}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Pickup Time</label>
                      <input type="time" value={route.pickupTime || ""} onChange={e => updateRouteFieldAdd(route.id, "pickupTime", e.target.value)} className="w-full rounded-lg border border-emerald-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white" />
                    </div>
                    {(transferBookingType === "one_way" || transferBookingType === "return") && (
                      <>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Distance</label>
                          <div className="px-2.5 py-1.5 text-sm text-gray-600 bg-gray-50 rounded-lg border border-gray-200">{route.distanceKm != null ? `~${route.distanceKm} km` : "—"}</div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Est. Duration</label>
                          <div className="px-2.5 py-1.5 text-sm text-gray-600 bg-gray-50 rounded-lg border border-gray-200">{route.durationMin != null ? (route.durationMin >= 60 ? `~${Math.floor(route.durationMin / 60)}h ${route.durationMin % 60}min` : `~${route.durationMin} min`) : "—"}</div>
                        </div>
                      </>
                    )}
                  </div>
                  {flightServices.length > 0 && (
                    <div>
                      <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Flight Number</label>
                      <select
                        value={route.linkedFlightId != null && (route.linkedSegmentIndex ?? 0) >= 0 ? `${route.linkedFlightId}|${route.linkedSegmentIndex ?? 0}` : ""}
                        onChange={e => {
                          const raw = e.target.value;
                          if (!raw) {
                            setTransferRoutes(prev => prev.map(r => r.id === route.id ? { ...r, linkedFlightId: undefined, linkedSegmentIndex: undefined } : r));
                            return;
                          }
                          const [fid, segIdxStr] = raw.split("|");
                          const segIdx = parseInt(segIdxStr || "0", 10);
                          setTransferRoutes(prev => prev.map(r => r.id === route.id ? { ...r, linkedFlightId: fid, linkedSegmentIndex: segIdx } : r));
                          if (fid) suggestPickupTimeAdd(route.id, fid, segIdx);
                        }}
                        className="w-full rounded-lg border border-emerald-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
                      >
                        <option value="">No linked flight</option>
                        {flightServices.flatMap(f => {
                          const segs = f.flightSegments || [];
                          const pickupIata = (route.pickupMeta?.iata ?? "").trim().toUpperCase();
                          const dropoffIata = (route.dropoffMeta?.iata ?? "").trim().toUpperCase();
                          const pickupIsAirport = route.pickupType === "airport" || !!route.pickupMeta?.iata;
                          const dropoffIsAirport = route.dropoffType === "airport" || !!route.dropoffMeta?.iata;
                          const filtered = segs.filter((s) => {
                            const r = s as unknown as Record<string, string>;
                            const arr = (r.arrival ?? "").trim().toUpperCase();
                            const dep = (r.departure ?? "").trim().toUpperCase();
                            if (pickupIsAirport && pickupIata && arr === pickupIata) return true;
                            if (dropoffIsAirport && dropoffIata && dep === dropoffIata) return true;
                            if (!pickupIata && !dropoffIata) return true;
                            return false;
                          });
                          const toShow = filtered.length > 0 ? filtered : segs;
                          return toShow.map((s) => {
                            const origIdx = segs.indexOf(s);
                            const r = s as unknown as Record<string, string>;
                            const label = `${r.flightNumber || ""} ${r.departure || ""}→${r.arrival || ""}`.trim() || f.name;
                            return <option key={`${f.id}-${origIdx}`} value={`${f.id}|${origIdx}`}>{label}</option>;
                          });
                        })}
                      </select>
                      {route.linkedFlightId && route.pickupTime && (
                        <p className="text-[10px] text-emerald-600 mt-0.5">
                          {(route.pickupMeta?.iata || route.pickupType === "airport") ? "Pickup ~45 min after arrival" : `Be at airport 2h before departure (pickup ${route.pickupTime})`}
                        </p>
                      )}
                    </div>
                  )}
                  </>
                  )}
                </div>
              );
              })}

              <button type="button" onClick={addTransferRouteAdd} className="text-sm text-emerald-600 hover:text-emerald-800 font-medium">
                + Add route
              </button>

              {/* Chauffeur & Driver */}
              <div className="border-t border-emerald-200 pt-2 space-y-2">
                <h5 className="text-[10px] font-semibold text-emerald-600 uppercase">Chauffeur / Driver</h5>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Name</label>
                    <input type="text" value={driverName} onChange={e => setDriverName(e.target.value)} placeholder="Driver name" className="w-full rounded-lg border border-emerald-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Phone</label>
                    <input type="tel" value={driverPhone} onChange={e => setDriverPhone(e.target.value)} placeholder="+371..." className="w-full rounded-lg border border-emerald-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Notes for the chauffeur</label>
                  <textarea value={chauffeurNotes} onChange={e => setChauffeurNotes(e.target.value)} placeholder="Flight BT293, meet at arrivals with sign..." rows={2} className="w-full rounded-lg border border-emerald-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white resize-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Info visible to client</label>
                  <textarea value={driverNotes} onChange={e => setDriverNotes(e.target.value)} placeholder="Driver will meet you at the exit gate..." rows={2} className="w-full rounded-lg border border-emerald-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white resize-none" />
                </div>
              </div>
            </div>
          )}

          {/* Booking Terms — at bottom ONLY for Transfer (hotel/tour/other keep it in right column) */}
          {categoryType === "transfer" && (
          <div className="mt-3 p-3 modal-section space-y-2">
            <h4 className="modal-section-title">Booking Terms</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Refund Policy - Transfer only */}
              <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Refund Policy</label>
                  <select
                    value={refundPolicy}
                    onChange={(e) => setRefundPolicy(e.target.value as "non_ref" | "refundable" | "fully_ref")}
                    className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                  >
                    <option value="non_ref">Non-refundable</option>
                    <option value="refundable">Refundable (with conditions)</option>
                    <option value="fully_ref">Fully Refundable</option>
                  </select>
                </div>
            </div>
            
            {/* Cancellation/Refund details */}
            {refundPolicy === "refundable" && (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Free cancel until</label>
                  <DateInput
                    value={freeCancellationUntil}
                    onChange={setFreeCancellationUntil}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Penalty EUR</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={cancellationPenaltyAmount}
                    onChange={(e) => setCancellationPenaltyAmount(sanitizeNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Penalty %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={cancellationPenaltyPercent}
                    onChange={(e) => setCancellationPenaltyPercent(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>
            )}
            
            {/* Payment Deadlines - Transfer uses single deadline */}
            <div className="border-t border-gray-200 pt-2 mt-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">Payment Deadline</label>
                <DateInput
                  value={paymentDeadlineFinal}
                  onChange={setPaymentDeadlineFinal}
                />
              </div>
            </div>
          </div>
          )}

          {showTransferFields && showLinkedServicesModal && (
            <LinkedServicesModal
              flightServices={flightServices}
              hotelServices={hotelServices}
              transferRoutes={transferRoutes}
              onApply={(routes) => setTransferRoutes(routes as TransferRouteData[])}
              onClose={() => setShowLinkedServicesModal(false)}
              suggestPickupTime={suggestPickupTimeAdd}
              transferBookingType={transferBookingType}
            />
          )}
          {showAirportServicesLinkedFields && showLinkedServicesModal && (
            <LinkedServicesModal
              flightServices={flightServices}
              hotelServices={hotelServices ?? []}
              transferRoutes={mgRoutes}
              onApply={(routes) => {
                const r0 = routes[0];
                if (r0?.linkedFlightId) setLinkedFlightId(r0.linkedFlightId);
                else if (!r0?.linkedFlightId) setLinkedFlightId(null);
                setShowLinkedServicesModal(false);
              }}
              onClose={() => setShowLinkedServicesModal(false)}
              transferBookingType="one_way"
              serviceLabel={serviceName || "Airport Service"}
              airportServiceFlowType={airportServiceFlow || undefined}
            />
          )}

          {/* Actions - Sticky Footer (hidden for Hotel — buttons are in left column) */}
          {categoryType !== "hotel" && <div className="mt-4 pt-3 border-t flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Adding...
                </>
              ) : "Add Service"}
            </button>
          </div>}
        </form>
      </div>
      {showAddAccompanyingModal && (categoryType === "flight" || categoryType === "hotel") && (
        <AddAccompanyingModal
          orderCode={orderCode}
          existingClientIds={clients.filter(c => c.id).map(c => c.id as string)}
          onAddClients={(toAdd) => {
            const existing = clients.filter(c => c.id || c.name);
            const newOnes = toAdd.filter(nc => !existing.some(c => c.id === nc.id));
            setClients(prev => {
              const ex = prev.filter(c => c.id || c.name);
              const next = [...ex, ...newOnes];
              return next.length > 0 ? next : [{ id: null, name: "" }];
            });
            if (categoryType === "flight" && newOnes.length > 0) {
              setTicketNumbers(prev => [...prev, ...newOnes.map(c => ({ clientId: c.id, clientName: c.name, ticketNr: "" }))]);
            }
          }}
          onClose={() => setShowAddAccompanyingModal(false)}
        />
      )}
    </div>
  );
}
