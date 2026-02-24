'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import PartySelect from '@/components/PartySelect';
import DateRangePicker from '@/components/DateRangePicker';
import { FlightSegment } from '@/components/FlightItineraryInput';
import { getAirportTimezoneOffset, parseFlightBooking, formatBaggageDisplay } from '@/lib/flights/airlineParsers';
import { useEscapeKey } from '@/lib/hooks/useEscapeKey';
import { useDraggableModal } from '@/hooks/useDraggableModal';
import { formatDateDDMMYYYY, formatDateShort, segmentDisplayArrivalDate, normalizeSegmentsArrivalYear, normalizeSegmentsWithCalendar } from '@/utils/dateFormat';
import { toTitleCaseForDisplay } from '@/utils/nameFormat';
import DateInput from '@/components/DateInput';
import ChangeServiceModal from './ChangeServiceModal';
import CancelServiceModal from './CancelServiceModal';
import HotelSuggestInput from '@/components/HotelSuggestInput';
import AddAccompanyingModal from './AddAccompanyingModal';
import { Hotel } from "lucide-react";
import type { SupplierCommission } from '@/lib/types/directory';

const CUSTOM_ROOMS_KEY = "travel-cms-custom-rooms";
const CUSTOM_BOARDS_KEY = "travel-cms-custom-boards";
const BOARD_LABELS: Record<string, string> = {
  room_only: "Room only",
  breakfast: "Breakfast",
  half_board: "Half board",
  full_board: "Full board",
  all_inclusive: "AI (All inclusive)",
  uai: "UAI (Ultra All Inclusive)",
};

// Functional types that determine which features are available
type CategoryType = 'flight' | 'hotel' | 'transfer' | 'tour' | 'insurance' | 'visa' | 'rent_a_car' | 'cruise' | 'other';

interface ServiceCategory {
  id: string;
  name: string;
  type: CategoryType;
  vat_rate: number;
  is_active: boolean;
}

interface Service {
  id: string;
  name: string;
  category: string; // Display name
  categoryId?: string | null; // UUID reference to travel_service_categories
  categoryType?: CategoryType | string | null; // Functional type (API may return string)
  servicePrice: number;
  clientPrice: number;
  vatRate?: number | null;
  resStatus: string | null;
  refNr?: string | null;
  ticketNr?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  supplier?: string | null;
  client?: string | null;
  payer?: string | null;
  supplierPartyId?: string | null;
  clientPartyId?: string | null;
  payerPartyId?: string | null;
  // Payment deadlines
  paymentDeadlineDeposit?: string | null;
  paymentDeadlineFinal?: string | null;
  paymentTerms?: string | null;
  // Hotel-specific
  hotelName?: string;
  hotelAddress?: string;
  hotelPhone?: string;
  hotelEmail?: string;
  hotelRoom?: string;
  hotelStarRating?: string;
  transferType?: string;
  additionalServices?: string;
  hotelBoard?: "room_only" | "breakfast" | "half_board" | "full_board" | "all_inclusive" | "uai";
  mealPlanText?: string;
  hotelBedType?: "king_queen" | "twin" | "not_guaranteed";
  hotelEarlyCheckIn?: boolean;
  hotelLateCheckIn?: boolean;
  hotelHigherFloor?: boolean;
  hotelKingSizeBed?: boolean;
  hotelHoneymooners?: boolean;
  hotelSilentRoom?: boolean;
  hotelRepeatGuests?: boolean;
  hotelRoomsNextTo?: string;
  hotelParking?: boolean;
  hotelPreferencesFreeText?: string;
  supplierBookingType?: "gds" | "direct";
  // Transfer-specific (legacy flat)
  pickupLocation?: string;
  dropoffLocation?: string;
  pickupTime?: string;
  estimatedDuration?: string;
  linkedFlightId?: string;
  // Transfer-specific (new structured)
  transferRoutes?: TransferRoute[];
  transferMode?: string | null;
  vehicleClass?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  driverNotes?: string | null;
  // Flight-specific
  flightSegments?: FlightSegment[];
  baggage?: string;
  cabinClass?: "economy" | "premium_economy" | "business" | "first";
  // Terms & Conditions
  priceType?: "ebd" | "regular" | "spo" | null;
  refundPolicy?: "non_ref" | "refundable" | "fully_ref" | null;
  freeCancellationUntil?: string | null;
  cancellationPenaltyAmount?: number | null;
  cancellationPenaltyPercent?: number | null;
  changeFee?: number | null; // Airline change fee (for Flights)
  invoice_id?: string | null; // When set, service is on an invoice — client price (Sale) is locked
  // Ticket numbers per client
  ticketNumbers?: { clientId: string; clientName: string; ticketNr: string }[];
  // Tour (Package Tour) pricing
  commissionName?: string | null;
  commissionRate?: number | null;
  commissionAmount?: number | null;
  agentDiscountValue?: number | null;
  agentDiscountType?: "%" | "€" | null;
}

interface ClientEntry {
  id: string | null;
  name: string;
}

interface FlightServiceRef {
  id: string;
  name: string;
  flightSegments: FlightSegment[];
}

interface TransferRoute {
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
}

interface LocationSuggestion {
  type: "airport" | "hotel" | "region";
  label: string;
  meta: { iata?: string; hid?: number; regionId?: number; lat?: number; lon?: number; country?: string };
}

interface EditServiceModalProps {
  service: Service;
  orderCode: string;
  onClose: () => void;
  onServiceUpdated: (updated: Partial<Service> & { id: string }) => void;
  companyCurrencyCode?: string;
  initialClients?: ClientEntry[];
  flightServices?: FlightServiceRef[];
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

const RES_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "booked", label: "Booked" },
  { value: "confirmed", label: "Confirmed" },
  { value: "changed", label: "Changed" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

function getCurrencySymbol(code: string): string {
  const c = (code || "EUR").trim().toUpperCase() || "EUR";
  try {
    const parts = new Intl.NumberFormat(undefined, { style: "currency", currency: c, currencyDisplay: "symbol" }).formatToParts(0);
    return parts.find((p: { type: string }) => p.type === "currency")?.value ?? c;
  } catch {
    return c;
  }
}

export default function EditServiceModalNew({
  service,
  orderCode,
  onClose,
  onServiceUpdated,
  companyCurrencyCode = "EUR",
  initialClients,
  flightServices = [],
}: EditServiceModalProps) {
  const currencySymbol = getCurrencySymbol(companyCurrencyCode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Categories: fallback immediately so form opens with correct layout (same as Add when categoryLocked)
  const guessTypeFromService = (): CategoryType => {
    const t = service.categoryType as CategoryType | undefined;
    if (t && t !== "other") return t;
    const lower = (service.category || "").toLowerCase();
    if (lower.includes("flight") || lower.includes("ticket") || lower.includes("авиа")) return "flight";
    if (lower.includes("hotel") || lower.includes("отель") || lower.includes("гостиница")) return "hotel";
    if (lower.includes("transfer") || lower.includes("трансфер")) return "transfer";
    if (lower.includes("tour") || lower.includes("тур") || lower.includes("package")) return "tour";
    if (lower.includes("insurance") || lower.includes("страхов")) return "insurance";
    if (lower.includes("visa") || lower.includes("виза")) return "visa";
    if (lower.includes("rent") || lower.includes("car") || lower.includes("авто") || lower.includes("аренда")) return "rent_a_car";
    if (lower.includes("cruise") || lower.includes("круиз")) return "cruise";
    return "other";
  };
  const [categories, setCategories] = useState<ServiceCategory[]>(FALLBACK_CATEGORIES);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(service.categoryId || null);
  const [categoryType, setCategoryType] = useState<CategoryType>(guessTypeFromService());
  
  // Change/Cancel modals
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Form state - initialized from service
  const [category, setCategory] = useState(service.category); // Display name
  const [serviceName, setServiceName] = useState(service.name);
  const [dateFrom, setDateFrom] = useState<string | undefined>(service.dateFrom || undefined);
  const [dateTo, setDateTo] = useState<string | undefined>(service.dateTo || undefined);
  const [supplierPartyId, setSupplierPartyId] = useState<string | null>(service.supplierPartyId || null);
  const [supplierName, setSupplierName] = useState(service.supplier || "");
  
  // Use pre-resolved clients from parent if available (no extra API round-trip)
  const [clients, setClients] = useState<ClientEntry[]>(() => {
    if (initialClients && initialClients.length > 0) return initialClients;
    const fallback = service.clientPartyId || service.client
      ? [{ id: service.clientPartyId || null, name: service.client || "" }]
      : [{ id: null, name: "" }];
    return fallback;
  });
  // If initialClients provided — already loaded; otherwise we'll fetch
  const [isLoadingClients, setIsLoadingClients] = useState(!initialClients || initialClients.length === 0);
  const clientsLoadedRef = useRef(!!initialClients && initialClients.length > 0);
  
  // Load service travellers from API only when not pre-resolved by parent
  useEffect(() => {
    if (clientsLoadedRef.current) return;
    
    const loadServiceTravellers = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        const response = await fetch(`/api/services/${service.id}/travellers`, {
          headers: {
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          const travellers = data.travellers || [];
          if (travellers.length > 0) {
            setClients(travellers.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })));
          }
        }
      } catch (err) {
        console.error("Load service travellers error:", err);
      } finally {
        setIsLoadingClients(false);
        clientsLoadedRef.current = true;
      }
    };

    loadServiceTravellers();
  }, [service.id]);
  
  const [payerPartyId, setPayerPartyId] = useState<string | null>(service.payerPartyId || null);
  const [payerName, setPayerName] = useState(service.payer || "");
  const [servicePrice, setServicePrice] = useState(String(service.servicePrice || 0));
  const [marge, setMarge] = useState(() => {
    const cat = (service as { categoryType?: string; category?: string }).categoryType;
    const catStr = String((service as { category?: string }).category || "").toLowerCase();
    const isTour = cat === "tour" || catStr.includes("tour") || catStr.includes("package");
    const sale = Number(service.clientPrice ?? 0);
    const cost = Number(service.servicePrice ?? 0);
    if (isTour && (service as { commissionAmount?: number | null }).commissionAmount != null) {
      const comm = Number((service as { commissionAmount?: number | null }).commissionAmount) || 0;
      return String(Math.round((sale - (cost - comm)) * 100) / 100);
    }
    return String(Math.round((sale - cost) * 100) / 100);
  });
  const [clientPrice, setClientPrice] = useState(String(service.clientPrice || 0));
  const [priceUnits, setPriceUnits] = useState((service as { quantity?: number | null }).quantity ?? 1); // Units or nights (from DB)
  // Flight: per-client pricing (from API or fallback to single row)
  const [pricingPerClient, setPricingPerClient] = useState<{ cost: string; marge: string; sale: string }[]>(() => {
    const svc = service as { pricingPerClient?: { cost?: number; marge?: number; sale?: number }[]; pricing_per_client?: { cost?: number; marge?: number; sale?: number }[] };
    const raw = svc.pricingPerClient ?? svc.pricing_per_client;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((p: { cost?: number; marge?: number; sale?: number }) => ({
        cost: String(p.cost ?? ""),
        marge: String(p.marge ?? ""),
        sale: String(p.sale ?? ""),
      }));
    }
    return [];
  });
  // Tour (Package Tour) pricing
  const [supplierCommissions, setSupplierCommissions] = useState<SupplierCommission[]>([]);
  const [selectedCommissionIndex, setSelectedCommissionIndex] = useState<number>(-1);
  const [agentDiscountValue, setAgentDiscountValue] = useState(() => {
    const cat = (service as { categoryType?: string; category?: string }).categoryType;
    const catStr = String((service as { category?: string }).category || "").toLowerCase();
    const isTour = cat === "tour" || catStr.includes("tour") || catStr.includes("package");
    if (isTour) {
      const cost = Number(service.servicePrice ?? 0);
      const sale = Number(service.clientPrice ?? 0);
      const disc = Math.max(0, Math.round((cost - sale) * 100) / 100);
      return disc > 0 ? disc.toFixed(2) : "";
    }
    return service.agentDiscountValue != null ? String(service.agentDiscountValue) : "";
  });
  const [agentDiscountType, setAgentDiscountType] = useState<"%" | "€">(
    (service.agentDiscountType as "%" | "€") || "€"
  );
  // Track which field was last edited to determine calculation direction
  const pricingLastEditedRef = useRef<'cost' | 'marge' | 'sale' | 'agent' | 'commission' | null>(null);
  const [vatRate, setVatRate] = useState<number>(service.vatRate || 0);
  const [resStatus, setResStatus] = useState(service.resStatus || "booked");
  const [refNr, setRefNr] = useState(service.refNr || "");
  // Multiple PNR/Ref per service (flight)
  const [refNrs, setRefNrs] = useState<string[]>(() => {
    const r = (service.refNr || "").trim();
    if (!r) return [];
    return r.split(/\s*,\s*|\n/).map((s) => s.trim()).filter(Boolean);
  });
  const [ticketNr, setTicketNr] = useState(service.ticketNr || "");
  // Ticket numbers per client (for Flights) — clientId can be null for name-only
  const [ticketNumbers, setTicketNumbers] = useState<{ clientId: string | null; clientName: string; ticketNr: string }[]>(
    (service.ticketNumbers || []).map((t) => ({ ...t, clientId: t.clientId ?? null }))
  );
  const [showAddAccompanyingModal, setShowAddAccompanyingModal] = useState(false);
  
  // Hotel-specific fields
  const [hotelName, setHotelName] = useState(service.hotelName || "");
  const [hotelAddress, setHotelAddress] = useState(service.hotelAddress || "");
  const [hotelPhone, setHotelPhone] = useState(service.hotelPhone || "");
  const [hotelEmail, setHotelEmail] = useState(service.hotelEmail || "");
  
  // Additional hotel fields
  const [hotelRoom, setHotelRoom] = useState(service.hotelRoom || "");
  const [hotelStarRating, setHotelStarRating] = useState(service.hotelStarRating || "");
  const [transferType, setTransferType] = useState(service.transferType || "");
  const [additionalServices, setAdditionalServices] = useState(service.additionalServices || "");
  const [hotelBoard, setHotelBoard] = useState<"room_only" | "breakfast" | "half_board" | "full_board" | "all_inclusive" | "uai">(
    (service.hotelBoard as any) || "room_only"
  );
  /** Room types from Ratehawk for selected hotel — click to choose */
  const [hotelRoomOptions, setHotelRoomOptions] = useState<string[]>([]);
  /** Meal types from Ratehawk rate search for selected hotel */
  const [hotelMealOptions, setHotelMealOptions] = useState<string[]>([]);
  const [hotelHid, setHotelHid] = useState<number | null>(null);
  const [mealPlanText, setMealPlanText] = useState<string>(() => {
    const saved = (service as { mealPlanText?: string }).mealPlanText?.trim();
    if (saved) {
      // Already a human-readable label → keep it
      if (Object.values(BOARD_LABELS).includes(saved)) return saved;
      // Board enum key (e.g. "breakfast") → convert to label
      if (BOARD_LABELS[saved]) return BOARD_LABELS[saved];
      // Ratehawk code (BB, HB…) → map to board key then to label
      const mapped = BOARD_LABELS[{ BB: "breakfast", HB: "half_board", FB: "full_board", RO: "room_only", AI: "all_inclusive", UAI: "uai" }[saved.toUpperCase()] || ""] || "";
      if (mapped) return mapped;
      // Custom free text → keep as-is
      return saved;
    }
    // Fallback: use the saved hotelBoard enum to get a label
    return BOARD_LABELS[(service.hotelBoard as string) || "room_only"] || "";
  });
  const [hotelBedType, setHotelBedType] = useState<"king_queen" | "twin" | "not_guaranteed">(
    (service.hotelBedType as any) || "not_guaranteed"
  );
  const [hotelPreferences, setHotelPreferences] = useState({
    earlyCheckIn: service.hotelEarlyCheckIn || false,
    lateCheckIn: service.hotelLateCheckIn || false,
    higherFloor: service.hotelHigherFloor || false,
    kingSizeBed: service.hotelKingSizeBed || false,
    honeymooners: service.hotelHoneymooners || false,
    silentRoom: service.hotelSilentRoom || false,
    repeatGuests: (service as any).hotelRepeatGuests || false,
    roomsNextTo: service.hotelRoomsNextTo || "",
    parking: service.hotelParking || false,
    freeText: service.hotelPreferencesFreeText || "",
  });
  const [supplierBookingType, setSupplierBookingType] = useState<"gds" | "direct">(
    (service.supplierBookingType as any) || "gds"
  );
  const hotelOptionsFetchedForRef = useRef<string | null>(null);
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

  // Transfer-specific fields (legacy)
  const [pickupLocation, setPickupLocation] = useState(service.pickupLocation || "");
  const [dropoffLocation, setDropoffLocation] = useState(service.dropoffLocation || "");
  const [pickupTime, setPickupTime] = useState(service.pickupTime || "");
  const [estimatedDuration, setEstimatedDuration] = useState(service.estimatedDuration || "");
  const [linkedFlightId, setLinkedFlightId] = useState<string | null>(service.linkedFlightId || null);

  // Transfer-specific fields (new structured)
  const initRoutes = (): TransferRoute[] => {
    if (service.transferRoutes && service.transferRoutes.length > 0) return service.transferRoutes;
    if (service.pickupLocation || service.dropoffLocation) {
      return [{
        id: crypto.randomUUID(),
        pickup: service.pickupLocation || "",
        pickupType: "address" as const,
        dropoff: service.dropoffLocation || "",
        dropoffType: "address" as const,
        pickupTime: service.pickupTime || "",
        linkedFlightId: service.linkedFlightId || undefined,
      }];
    }
    return [{ id: crypto.randomUUID(), pickup: "", pickupType: "address" as const, dropoff: "", dropoffType: "address" as const }];
  };
  const [transferRoutes, setTransferRoutes] = useState<TransferRoute[]>(initRoutes);
  const [transferMode, setTransferMode] = useState(service.transferMode || "individual");
  const firstRoute = (service.transferRoutes && service.transferRoutes.length > 0 ? service.transferRoutes[0] : null) as (TransferRoute & { bookingType?: string; hours?: number; chauffeurNotes?: string }) | null;
  const [transferBookingType, setTransferBookingType] = useState<"one_way" | "by_hour">(firstRoute?.bookingType === "by_hour" ? "by_hour" : "one_way");
  const [transferHours, setTransferHours] = useState<number>(firstRoute?.hours || 2);
  const [chauffeurNotes, setChauffeurNotes] = useState(firstRoute?.chauffeurNotes || "");
  const knownClasses = ["economy","comfort","business","premium","minivan","minibus","bus","electric","first",""];
  const rawVC = service.vehicleClass || "";
  const vcParts = rawVC.includes(":") ? rawVC.split(":") : [rawVC, ""];
  const vcBase = vcParts[0].trim();
  const vcDetail = vcParts.slice(1).join(":").trim();
  const [vehicleClass, setVehicleClass] = useState(knownClasses.includes(vcBase) ? vcBase : (vcBase ? "first" : ""));
  const [vehicleClassCustom, setVehicleClassCustom] = useState(vcDetail || (knownClasses.includes(vcBase) ? "" : vcBase));
  const [driverName, setDriverName] = useState(service.driverName || "");
  const [driverPhone, setDriverPhone] = useState(service.driverPhone || "");
  const [driverNotes, setDriverNotes] = useState(service.driverNotes || "");
  const [locationQuery, setLocationQuery] = useState<Record<string, string>>({});
  const [locationResults, setLocationResults] = useState<Record<string, LocationSuggestion[]>>({});
  const [activeLocationField, setActiveLocationField] = useState<string | null>(null);
  const locationDebounceRef = useRef<Record<string, NodeJS.Timeout>>({});

  const searchLocations = useCallback(async (fieldKey: string, query: string) => {
    if (query.length < 2) { setLocationResults(prev => ({ ...prev, [fieldKey]: [] })); return; }
    try {
      const res = await fetch(`/api/geo/location-suggest?q=${encodeURIComponent(query)}`);
      const json = await res.json();
      setLocationResults(prev => ({ ...prev, [fieldKey]: json.data || [] }));
    } catch { setLocationResults(prev => ({ ...prev, [fieldKey]: [] })); }
  }, []);

  const handleLocationInput = useCallback((fieldKey: string, value: string) => {
    setLocationQuery(prev => ({ ...prev, [fieldKey]: value }));
    if (locationDebounceRef.current[fieldKey]) clearTimeout(locationDebounceRef.current[fieldKey]);
    locationDebounceRef.current[fieldKey] = setTimeout(() => searchLocations(fieldKey, value), 300);
  }, [searchLocations]);

  const selectLocation = useCallback((routeId: string, field: "pickup" | "dropoff", suggestion: LocationSuggestion) => {
    setTransferRoutes(prev => prev.map(r => {
      if (r.id !== routeId) return r;
      return {
        ...r,
        [field]: suggestion.label,
        [`${field}Type`]: suggestion.type,
        [`${field}Meta`]: suggestion.meta,
      };
    }));
    const fieldKey = `${routeId}-${field}`;
    setLocationQuery(prev => ({ ...prev, [fieldKey]: suggestion.label }));
    setLocationResults(prev => ({ ...prev, [fieldKey]: [] }));
    setActiveLocationField(null);
  }, []);

  const addTransferRoute = useCallback(() => {
    setTransferRoutes(prev => [...prev, {
      id: crypto.randomUUID(),
      pickup: "",
      pickupType: "address",
      dropoff: "",
      dropoffType: "address",
    }]);
  }, []);

  const removeTransferRoute = useCallback((routeId: string) => {
    setTransferRoutes(prev => prev.length > 1 ? prev.filter(r => r.id !== routeId) : prev);
  }, []);

  const updateRouteField = useCallback((routeId: string, field: string, value: unknown) => {
    setTransferRoutes(prev => prev.map(r => r.id === routeId ? { ...r, [field]: value } : r));
  }, []);

  useEffect(() => {
    transferRoutes.forEach(route => {
      const pickupKey = `${route.id}-pickup`;
      const dropoffKey = `${route.id}-dropoff`;
      if (!locationQuery[pickupKey] && route.pickup) setLocationQuery(prev => ({ ...prev, [pickupKey]: route.pickup }));
      if (!locationQuery[dropoffKey] && route.dropoff) setLocationQuery(prev => ({ ...prev, [dropoffKey]: route.dropoff }));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-calculate distance when both pickup and dropoff have coordinates
  useEffect(() => {
    transferRoutes.forEach(async (route) => {
      if (route.distanceKm != null) return;
      const pMeta = route.pickupMeta;
      const dMeta = route.dropoffMeta;
      if (!pMeta || !dMeta) return;
      if (pMeta.iata && (dMeta.lat != null || route.dropoff)) {
        try {
          const params = new URLSearchParams({ airport: pMeta.iata });
          if (dMeta.lat != null && dMeta.lon != null) {
            params.set("lat", String(dMeta.lat));
            params.set("lon", String(dMeta.lon));
          }
          params.set("address", route.dropoff);
          const res = await fetch(`/api/geo/transfer-distance?${params}`);
          const json = await res.json();
          if (json.data) {
            setTransferRoutes(prev => prev.map(r => r.id === route.id ? { ...r, distanceKm: json.data.distanceKm, durationMin: json.data.durationMin } : r));
          }
        } catch {}
      } else if (dMeta.iata && (pMeta.lat != null || route.pickup)) {
        try {
          const params = new URLSearchParams({ airport: dMeta.iata });
          if (pMeta.lat != null && pMeta.lon != null) {
            params.set("lat", String(pMeta.lat));
            params.set("lon", String(pMeta.lon));
          }
          params.set("address", route.pickup);
          const res = await fetch(`/api/geo/transfer-distance?${params}`);
          const json = await res.json();
          if (json.data) {
            setTransferRoutes(prev => prev.map(r => r.id === route.id ? { ...r, distanceKm: json.data.distanceKm, durationMin: json.data.durationMin } : r));
          }
        } catch {}
      }
    });
  }, [transferRoutes]);

  // Auto-suggest pickup time from linked flights
  const suggestPickupTime = useCallback((routeId: string, flightServiceId: string) => {
    const fs = flightServices.find(f => f.id === flightServiceId);
    if (!fs || !fs.flightSegments?.length) return;
    const route = transferRoutes.find(r => r.id === routeId);
    if (!route || route.pickupTime) return;

    const isPickupAirport = route.pickupMeta?.iata || route.pickupType === "airport";
    const isDropoffAirport = route.dropoffMeta?.iata || route.dropoffType === "airport";

    for (const seg of fs.flightSegments) {
      const s = seg as unknown as Record<string, string>;
      if (isPickupAirport && s.arrivalTimeScheduled) {
        // Arriving at airport → pickup ~45 min after arrival (luggage, customs)
        const [h, m] = s.arrivalTimeScheduled.split(":").map(Number);
        const totalMin = h * 60 + m + 45;
        const suggestedTime = `${String(Math.floor(totalMin / 60) % 24).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
        setTransferRoutes(prev => prev.map(r => r.id === routeId ? { ...r, pickupTime: suggestedTime } : r));
        return;
      }
      if (isDropoffAirport && s.departureTimeScheduled) {
        // Going TO airport → need to be there 2h before departure, minus transfer duration
        const [h, m] = s.departureTimeScheduled.split(":").map(Number);
        const durationBuffer = route.durationMin || 60;
        const totalMin = h * 60 + m - 120 - durationBuffer;
        const adj = totalMin < 0 ? totalMin + 1440 : totalMin;
        const suggestedTime = `${String(Math.floor(adj / 60) % 24).padStart(2, "0")}:${String(adj % 60).padStart(2, "0")}`;
        setTransferRoutes(prev => prev.map(r => r.id === routeId ? { ...r, pickupTime: suggestedTime } : r));
        return;
      }
    }
  }, [flightServices, transferRoutes]);

  // Flight-specific fields (normalize with calendar dateFrom/dateTo so Schedule shows 2026 when calendar is 2026)
  const [flightSegments, setFlightSegments] = useState<FlightSegment[]>(() => {
    const raw = (service.flightSegments || []).map(seg => ({
      ...seg,
      cabinClass: seg.cabinClass || service.cabinClass || "economy",
    }));
    const dateFrom = service.dateFrom ?? undefined;
    const dateTo = service.dateTo ?? service.dateFrom ?? undefined;
    return normalizeSegmentsWithCalendar(raw, dateFrom, dateTo) as FlightSegment[];
  });
  const [showPasteInput, setShowPasteInput] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsingTour, setIsParsingTour] = useState(false);
  const [isDraggingTour, setIsDraggingTour] = useState(false);
  const [showTourPasteInput, setShowTourPasteInput] = useState(false);
  const [tourPasteText, setTourPasteText] = useState("");
  const tourParseInputRef = useRef<HTMLInputElement>(null);
  const [parsedFields, setParsedFields] = useState<Set<string>>(new Set());
  /** Fields parser returned but value empty or not applied — show red outline (mirror Add) */
  const [parseAttemptedButEmpty, setParseAttemptedButEmpty] = useState<Set<string>>(new Set());
  const [depositPercent, setDepositPercent] = useState<string>("");
  const [finalPercent, setFinalPercent] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [isParsingFlight, setIsParsingFlight] = useState(false);
  const [baggage, setBaggage] = useState<string>(service.baggage || "");
  const [cabinClass, setCabinClass] = useState<"economy" | "premium_economy" | "business" | "first">(service.cabinClass || "economy");
  
  // Payment deadline fields
  const [paymentDeadlineDeposit, setPaymentDeadlineDeposit] = useState(service.paymentDeadlineDeposit || "");
  const [paymentDeadlineFinal, setPaymentDeadlineFinal] = useState(service.paymentDeadlineFinal || "");
  const [paymentTerms, setPaymentTerms] = useState(service.paymentTerms || "");

  // Terms & Conditions fields
  const [priceType, setPriceType] = useState<"ebd" | "regular" | "spo">(service.priceType || "regular");
  const [refundPolicy, setRefundPolicy] = useState<"non_ref" | "refundable" | "fully_ref">(service.refundPolicy || "non_ref");
  const [freeCancellationUntil, setFreeCancellationUntil] = useState(service.freeCancellationUntil || "");
  const [cancellationPenaltyAmount, setCancellationPenaltyAmount] = useState(service.cancellationPenaltyAmount?.toString() || "");
  const [cancellationPenaltyPercent, setCancellationPenaltyPercent] = useState(service.cancellationPenaltyPercent?.toString() || "");
  const [changeFee, setChangeFee] = useState(service.changeFee?.toString() || "");

  // Sync pricingPerClient with clients for Flight (same length, preserve existing values)
  // Do not overwrite when validClients is empty (e.g. before travellers load) — keeps initial service.pricingPerClient
  useEffect(() => {
    if (categoryType === "flight") {
      const validClients = clients.filter(c => c.id || c.name);
      if (validClients.length === 0) return;
      setPricingPerClient(prev => {
        const next = validClients.map((_, idx) => prev[idx] ?? { cost: "", marge: "", sale: "" });
        return next;
      });
    }
  }, [categoryType, clients]);

  // When user changes calendar (Dates) to 2026, re-normalize segment years so Schedule shows 2026 (fixes stuck 2024)
  useEffect(() => {
    if (categoryType !== "flight" || flightSegments.length === 0) return;
    setFlightSegments(prev => normalizeSegmentsWithCalendar(prev, dateFrom ?? undefined, dateTo ?? undefined) as FlightSegment[]);
  }, [dateFrom, dateTo, categoryType]);

  // Sync ticketNumbers with clients for Flight
  useEffect(() => {
    if (categoryType === "flight") {
      const validClients = clients.filter(c => c.id && c.name);
      setTicketNumbers(prev => {
        // Build new array preserving existing ticket numbers
        const newTickets = validClients.map((client) => {
          // Find existing ticket by clientId
          const existing = prev.find(t => t.clientId === client.id);
          return { 
            clientId: client.id!, 
            clientName: client.name, 
            ticketNr: existing?.ticketNr || ""
          };
        });
        return newTickets;
      });
    }
  }, [clients, category]);

  // Extract ticket numbers from flightSegments and update ticketNumbers
  useEffect(() => {
    if (categoryType === "flight" && flightSegments && flightSegments.length > 0) {
      // Extract unique ticket numbers from segments
      const segmentTicketNumbers = new Map<string, string>(); // ticketNr -> passengerName
      
      flightSegments.forEach(seg => {
        if (seg.ticketNumber && seg.passengerName) {
          segmentTicketNumbers.set(seg.ticketNumber, seg.passengerName);
        }
      });
      
      // Update ticketNumbers if we found ticket numbers in segments
      if (segmentTicketNumbers.size > 0) {
        setTicketNumbers(prev => {
          // Create a map of existing tickets by ticketNr
          const existingByTicketNr = new Map(
            prev.map(t => [t.ticketNr, t])
          );
          
          // Update or add ticket numbers from segments
          const updated = [...prev];
          
          segmentTicketNumbers.forEach((passengerName, ticketNr) => {
            // Find client by name
            const client = clients.find(c => 
              c.name.toLowerCase().includes(passengerName.toLowerCase()) ||
              passengerName.toLowerCase().includes(c.name.toLowerCase())
            );
            
            if (client) {
              const existing = existingByTicketNr.get(ticketNr);
              if (existing) {
                // Update existing
                const index = updated.findIndex(t => t.ticketNr === ticketNr);
                if (index >= 0) {
                  updated[index] = {
                    clientId: client.id!,
                    clientName: client.name,
                    ticketNr: ticketNr,
                  };
                }
              } else {
                // Add new if client matches
                updated.push({
                  clientId: client.id!,
                  clientName: client.name,
                  ticketNr: ticketNr,
                });
              }
            }
          });
          
          return updated;
        });
      }
    }
  }, [flightSegments, category, clients]);

  // Auto-update service name (route) from flight segments — full city names, format: "date city - city / date city - city"
  useEffect(() => {
    if (categoryType !== "flight" || flightSegments.length === 0) return;
    const groupedByDate: Record<string, FlightSegment[]> = {};
    flightSegments.forEach(seg => {
      const date = seg.departureDate || "unknown";
      if (!groupedByDate[date]) groupedByDate[date] = [];
      groupedByDate[date].push(seg);
    });
    const routeParts = Object.entries(groupedByDate).map(([, segs]) => {
      const dateStr = formatDateShort(segs[0]?.departureDate || "");
      const cities = [
        segs[0].departureCity?.trim() || segs[0].departure || "",
        ...segs.map(s => (s.arrivalCity?.trim() || s.arrival || "")),
      ].filter(Boolean);
      const routeStr = cities.join(" - ");
      return dateStr && dateStr !== "-" ? `${dateStr} ${routeStr}` : routeStr;
    });
    const newRoute = routeParts.join(" / ");
    if (newRoute && newRoute !== serviceName) setServiceName(newRoute);
  }, [flightSegments, categoryType]); // serviceName intentionally omitted so segment edits update the name

  // Commission amount in € - use persisted commission_rate/commission_amount, else supplierCommissions
  const getCommissionAmount = (cost: number): number => {
    if (categoryType !== "tour") return 0;
    if (selectedCommissionIndex >= 0 && supplierCommissions[selectedCommissionIndex]) {
      const rate = supplierCommissions[selectedCommissionIndex].rate;
      if (rate != null && rate > 0) return Math.round((cost * rate / 100) * 100) / 100;
    }
    const rate = Number(service.commissionRate);
    if (rate > 0) return Math.round((cost * rate / 100) * 100) / 100;
    return Math.round((Number(service.commissionAmount) || 0) * 100) / 100;
  };

  const getAgentDiscountAmount = (cost: number): number => {
    if (categoryType !== "tour") return 0;
    const val = parseFloat(agentDiscountValue) || 0;
    if (val <= 0) return 0;
    if (agentDiscountType === "%") return Math.round((cost * val / 100) * 100) / 100;
    return Math.round(val * 100) / 100;
  };

  // Tour: recalc only when user edits Pricing; skip on open (ref === null) — same as Add
  // Formulas: AgentDiscount = Cost - Sale, Sale = Cost - AgentDiscount, Margin = Sale - (Cost - Commission)
  useEffect(() => {
    if (categoryType !== "tour") return;
    if (!pricingLastEditedRef.current) return;
    const cost = Math.round((parseFloat(servicePrice) || 0) * 100) / 100;
    const commissionAmount = getCommissionAmount(cost);
    const netCost = Math.round((cost - commissionAmount) * 100) / 100;

    if (pricingLastEditedRef.current === "sale") {
      const saleVal = Math.round((parseFloat(clientPrice) || 0) * 100) / 100;
      const discount = Math.max(0, Math.round((cost - saleVal) * 100) / 100);
      setAgentDiscountType("€");
      setAgentDiscountValue(discount.toFixed(2));
      setMarge(Math.round((saleVal - netCost) * 100) / 100 + "");
      return;
    }
    // User edited cost, commission, or agent discount → recalc Sale and Margin
    const discountAmount = getAgentDiscountAmount(cost);
    const saleCalculated = Math.round((cost - discountAmount) * 100) / 100;
    setMarge(Math.round((saleCalculated - netCost) * 100) / 100 + "");
    setClientPrice(saleCalculated.toFixed(2));
    pricingLastEditedRef.current = null;
  }, [categoryType, servicePrice, selectedCommissionIndex, supplierCommissions, agentDiscountValue, agentDiscountType, clientPrice]);

  // Non-Tour: Cost, Marge, Sale logic
  useEffect(() => {
    if (categoryType === "tour") return;
    const cost = Math.round((parseFloat(servicePrice) || 0) * 100) / 100;
    const margeVal = Math.round((parseFloat(marge) || 0) * 100) / 100;
    const saleVal = Math.round((parseFloat(clientPrice) || 0) * 100) / 100;
    const expectedSale = Math.round((cost + margeVal) * 100) / 100;
    const expectedSaleRounded = parseFloat(expectedSale.toFixed(2));
    if (!pricingLastEditedRef.current) {
      if (cost > 0 && margeVal !== 0 && Math.abs(expectedSaleRounded - saleVal) > 0.001) {
        setClientPrice(expectedSaleRounded.toFixed(2));
      }
      return;
    }
    if (pricingLastEditedRef.current === "cost" || pricingLastEditedRef.current === "marge") {
      if (Math.abs(expectedSaleRounded - saleVal) > 0.001) {
        pricingLastEditedRef.current = null;
        setClientPrice(expectedSaleRounded.toFixed(2));
      }
    } else if (pricingLastEditedRef.current === "sale") {
      const calculatedMarge = Math.round((saleVal - cost) * 100) / 100;
      const calculatedMargeRounded = parseFloat(calculatedMarge.toFixed(2));
      if (Math.abs(calculatedMargeRounded - margeVal) > 0.001) {
        pricingLastEditedRef.current = null;
        setMarge(calculatedMargeRounded.toFixed(2));
      }
    }
  }, [servicePrice, marge, clientPrice, categoryType]);
  
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

  // Copy service name to hotel name when category is Hotel
  useEffect(() => {
    if (categoryType === "hotel" && serviceName.trim() && !hotelName.trim()) {
      setHotelName(serviceName.trim());
    }
  }, [category, serviceName, hotelName]);

  // For Hotel: when refundPolicy is non_ref, set payment deadline to today
  useEffect(() => {
    if (categoryType === "hotel" && refundPolicy === "non_ref") {
      const today = new Date().toISOString().split('T')[0];
      setPaymentDeadlineFinal(today);
    }
  }, [category, refundPolicy]);

  // For Hotel: when refundPolicy is refundable, set payment deadline to free cancellation until
  useEffect(() => {
    if (categoryType === "hotel" && refundPolicy === "refundable" && freeCancellationUntil) {
      setPaymentDeadlineFinal(freeCancellationUntil);
    }
  }, [category, refundPolicy, freeCancellationUntil]);

  // Load categories from Travel Services on mount
  const loadCategories = useCallback(async () => {
    try {
      setCategoriesLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setCategories(FALLBACK_CATEGORIES);
        return;
      }
      const response = await fetch("/api/travel-service-categories", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        let apiCategories = (data.categories || []) as ServiceCategory[];
        // If service has categoryId not in list (e.g. deleted category), add it so dropdown shows current
        if (service.categoryId && service.category && !apiCategories.some(c => c.id === service.categoryId)) {
          const c = (service.category as string).toLowerCase();
          let t: CategoryType = (service.categoryType as CategoryType) || "other";
          if (t === "other" && (c.includes("tour") || c.includes("package"))) t = "tour";
          else if (t === "other" && (c.includes("flight") || c.includes("air"))) t = "flight";
          else if (t === "other" && (c.includes("hotel"))) t = "hotel";
          else if (t === "other" && c.includes("transfer")) t = "transfer";
          apiCategories = [...apiCategories, {
            id: service.categoryId,
            name: service.category,
            type: t,
            vat_rate: service.vatRate ?? 21,
            is_active: true,
          }];
        }
        setCategories(apiCategories.length > 0 ? apiCategories : FALLBACK_CATEGORIES);
      } else {
        setCategories(FALLBACK_CATEGORIES);
      }
    } catch (err) {
      console.error("Error loading categories:", err);
      setCategories(FALLBACK_CATEGORIES);
    } finally {
      setCategoriesLoading(false);
    }
  }, [service.categoryId, service.category, service.categoryType, service.vatRate]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // When Edit opens with a hotel name, resolve HID + room options from Ratehawk
  useEffect(() => {
    if (categoryType !== "hotel" || !hotelName.trim() || hotelName.trim().length < 2) return;
    const key = hotelName.trim().toLowerCase();
    if (hotelOptionsFetchedForRef.current === key) return;
    let cancelled = false;
    (async () => {
      try {
        const suggestRes = await fetch("/api/ratehawk/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: hotelName.trim(), language: "en" }),
        });
        const suggestJson = await suggestRes.json();
        if (cancelled || !suggestRes.ok || !suggestJson.data?.hotels?.length) return;
        const hotels = suggestJson.data.hotels as { hid: number; name: string }[];
        const first = hotels[0];
        if (cancelled) return;
        setHotelHid(first.hid);
        const contentRes = await fetch("/api/ratehawk/hotel-content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hids: [first.hid], language: "en" }),
        });
        const contentJson = await contentRes.json();
        if (cancelled || !contentRes.ok || !contentJson.data?.[0]) return;
        const h = contentJson.data[0];
        const roomOpts = h.room_groups?.map((rg: { name?: string }) => rg.name?.trim()).filter(Boolean) ?? [];
        const roomOptions = roomOpts.length ? [...new Set(roomOpts)] as string[] : [];
        if (cancelled) return;
        setHotelRoomOptions(roomOptions);
        hotelOptionsFetchedForRef.current = key;
      } catch {
        // ignore — ref not set so next open will retry
      }
    })();
    return () => { cancelled = true; };
  }, [categoryType, hotelName]);

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

  // Close room/board list on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (roomListRef.current?.contains(target) || boardListRef.current?.contains(target)) return;
      setRoomListOpen(false);
      setBoardListOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const roomOptionsForDropdown = useMemo(() => [...new Set([...hotelRoomOptions, ...customRooms])], [hotelRoomOptions, customRooms]);
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
    return [...new Set([...customBoards])];
  }, [hotelMealOptions, customBoards]);

  // Map meal plan abbreviation to hotel_board (AI and UAI are different: AI = All Inclusive, UAI = Ultra All Inclusive)
  const mapMealPlanToBoard = (plan: string): "room_only" | "breakfast" | "half_board" | "full_board" | "all_inclusive" | "uai" => {
    const p = (plan || "").toUpperCase();
    if (p === "RO" || p === "ROOM ONLY") return "room_only";
    if (p === "BB" || p === "BED AND BREAKFAST") return "breakfast";
    if (p === "HB" || p === "HALF BOARD") return "half_board";
    if (p === "FB" || p === "FULL BOARD") return "full_board";
    if (p === "UAI" || p === "ULTRA ALL INCLUSIVE") return "uai";
    if (p === "AI" || p === "ALL INCLUSIVE") return "all_inclusive";
    return "room_only";
  };
  // Ratehawk meal label → hotel_board (for Board dropdown from API; uses .includes for long labels)
  const mapRatehawkMealToBoard = (plan: string): "room_only" | "breakfast" | "half_board" | "full_board" | "all_inclusive" | "uai" => {
    const p = (plan || "").toUpperCase();
    if (p.includes("RO") || p.includes("ROOM ONLY")) return "room_only";
    if (p.includes("BB") || p.includes("BED AND BREAKFAST") || p.includes("BREAKFAST")) return "breakfast";
    if (p.includes("HB") || p.includes("HALF BOARD")) return "half_board";
    if (p.includes("FB") || p.includes("FULL BOARD")) return "full_board";
    if (p.includes("UAI") || p.includes("ULTRA ALL INCLUSIVE")) return "uai";
    if (p.includes("AI") || p.includes("ALL INCLUSIVE")) return "all_inclusive";
    return "room_only";
  };

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
        departureStatus: "scheduled" as const,
        arrivalStatus: "scheduled" as const,
      }));
      const normalized = normalizeSegmentsArrivalYear(mapped) as FlightSegment[];
      setFlightSegments(normalized);
      fields.add("flightSegments");
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
    if (p.pricing != null && typeof p.pricing === "object" && !fields.has("servicePrice")) attemptedEmpty.add("servicePrice");
    if (p.paymentTerms != null && typeof p.paymentTerms === "object") {
      const pt = p.paymentTerms as Record<string, unknown>;
      if (!fields.has("paymentDeadlineDeposit")) attemptedEmpty.add("paymentDeadlineDeposit");
      if (!fields.has("paymentDeadlineFinal")) attemptedEmpty.add("paymentDeadlineFinal");
      if (!fields.has("depositPercent")) attemptedEmpty.add("depositPercent");
      if (!fields.has("finalPercent")) attemptedEmpty.add("finalPercent");
    }
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
            body: JSON.stringify({ travellers }),
          });
          if (res.ok) {
            const data = await res.json();
            const parties = data.parties || [];
            const clientEntries = parties.map((r: { name: string; id: string; displayName: string }) => ({
              id: r.id,
              name: r.displayName || r.name,
            }));
            if (clientEntries.length > 0) {
              setClients(clientEntries);
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
    setResStatus((prev) => (prev === "draft" ? "booked" : prev));
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

  // Helper to guess category type from name (for legacy services without categoryId)
  const guessTypeFromName = (name: string): CategoryType => {
    const lower = name.toLowerCase();
    if (lower.includes('flight') || lower.includes('ticket') || lower.includes('авиа')) return 'flight';
    if (lower.includes('hotel') || lower.includes('отель') || lower.includes('гостиница')) return 'hotel';
    if (lower.includes('transfer') || lower.includes('трансфер')) return 'transfer';
    if (lower.includes('tour') || lower.includes('тур') || lower.includes('package')) return 'tour';
    if (lower.includes('insurance') || lower.includes('страхов')) return 'insurance';
    if (lower.includes('visa') || lower.includes('виза')) return 'visa';
    if (lower.includes('rent') || lower.includes('car') || lower.includes('авто') || lower.includes('аренда')) return 'rent_a_car';
    if (lower.includes('cruise') || lower.includes('круиз')) return 'cruise';
    return 'other';
  };

  // When categories available: sync VAT only (category/type already from service — avoid form flash)
  useEffect(() => {
    const matched = categories.find(c => c.id === categoryId);
    if (matched && matched.vat_rate != null) setVatRate(matched.vat_rate);
  }, [categoryId, categories]);

  // Tour: init depositPercent/finalPercent from paymentTerms on open
  useEffect(() => {
    const pt = service.paymentTerms || "";
    const depMatch = pt.match(/(\d+)\s*%\s*deposit/i) || pt.match(/deposit\s*(\d+)\s*%/i);
    const finMatch = pt.match(/(\d+)\s*%\s*final/i) || pt.match(/final\s*(\d+)\s*%/i);
    if (depMatch) setDepositPercent(depMatch[1]);
    if (finMatch) setFinalPercent(finMatch[1]);
  }, [service.paymentTerms]);

  // Tour: init from persisted commission only. Never auto-fetch; load only on dropdown open.
  // Support: (name+rate), (name+amount), or (amount only) - derive rate from amount/cost for display
  useEffect(() => {
    if (categoryType !== "tour" || !supplierPartyId) {
      setSupplierCommissions([]);
      setSelectedCommissionIndex(-1);
      return;
    }
    const name = service.commissionName;
    let rate = Number(service.commissionRate) || 0;
    const amount = Number(service.commissionAmount) || 0;
    const cost = parseFloat(servicePrice) || parseFloat(String(service.servicePrice)) || 0;
    if (rate <= 0 && amount > 0 && cost > 0) {
      rate = Math.round((amount / cost) * 10000) / 100;
    }
    const displayName = name || (amount > 0 ? "Saved" : null);
    if (displayName && (rate > 0 || amount > 0)) {
      setSupplierCommissions([{ name: displayName, rate: rate || 0, isActive: true }]);
      setSelectedCommissionIndex(0);
    } else {
      setSupplierCommissions([]);
      setSelectedCommissionIndex(-1);
    }
  }, [categoryType, supplierPartyId, service.commissionName, service.commissionRate, service.commissionAmount, servicePrice]);

  const loadSupplierCommissions = useCallback(async () => {
    if (categoryType !== "tour" || !supplierPartyId) return;
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
        const existingName = service.commissionName;
        const idx = existingName ? list.findIndex((c: SupplierCommission) => c.name === existingName) : -1;
        setSelectedCommissionIndex(idx >= 0 ? idx : 0);
      }
    } catch {}
  }, [categoryType, supplierPartyId, service.commissionName]);

  // Legacy: when category (name) changes from elsewhere, sync categoryId (e.g. initial load already set categoryId)
  useEffect(() => {
    if (!category || category.trim() === "" || categories.length === 0) return;
    const matched = categories.find(c => c.name === category);
    if (matched && matched.id !== categoryId) {
      setCategoryId(matched.id);
    } else if (!matched) {
      // For manually entered category names, guess the type
      const guessedType = guessTypeFromName(category);
      setCategoryType(guessedType);
    }
  }, [category, categories]);

  // ESC key handler
  useEscapeKey(onClose);
  const { modalStyle, onHeaderMouseDown } = useDraggableModal();
  
  // Sync cabinClass with flight segments - when user manually changes cabinClass in dropdown, update all segments
  // Use ref to track manual user changes (not from parsing or initial load)
  const cabinClassUpdateRef = useRef(false);
  const skipSyncRef = useRef(false);
  
  useEffect(() => {
    // Only sync if:
    // 1. It's a Flight service
    // 2. There are segments
    // 3. User manually changed cabinClass (cabinClassUpdateRef.current = true)
    // 4. We're not skipping sync (skipSyncRef.current = false)
    if (categoryType === "flight" && flightSegments.length > 0 && cabinClassUpdateRef.current && !skipSyncRef.current) {
      skipSyncRef.current = true;
      setFlightSegments(prevSegments => 
        prevSegments.map(seg => ({
          ...seg,
          cabinClass: cabinClass,
        }))
      );
      cabinClassUpdateRef.current = false;
      // Reset skip flag after update completes
      setTimeout(() => {
        skipSyncRef.current = false;
      }, 100);
    }
  }, [cabinClass, category]);
  
  // Client management functions
  const addClient = () => {
    setClients([...clients, { id: null, name: "" }]);
  };
  
  const updateClient = (index: number, id: string | null, name: string) => {
    const updated = [...clients];
    updated[index] = { id, name };
    setClients(updated);
  };
  
  const removeClient = (index: number) => {
    const next = clients.filter((_, i) => i !== index);
    if (categoryType === "flight") {
      setTicketNumbers((prev) => prev.filter((_, i) => i !== index));
    }
    if (categoryType === "hotel") {
      setClients(next.length > 0 ? next : [{ id: null, name: "" }]);
    } else {
      if (clients.length <= 1) return;
      setClients(next);
    }
  };

  // Determine which fields to show based on category
  const showTicketNr = categoryType === "flight";
  const showHotelFields = categoryType === "hotel";
  const showTransferFields = categoryType === "transfer";
  const showFlightItinerary = categoryType === "flight" || categoryType === "tour";
  const showTourFields = categoryType === "tour";

  // Add clients to order_travellers (sync with Travellers modal)
  const addClientsToOrderTravellers = useCallback(async (clientIds: (string | null)[]) => {
    const validIds = clientIds.filter((id): id is string => id !== null);
    if (validIds.length === 0) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Add each client to order_travellers
      for (const partyId of validIds) {
        await fetch(`/api/orders/${encodeURIComponent(orderCode)}/travellers`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          credentials: "include",
          body: JSON.stringify({ partyId }),
        });
      }
    } catch (err) {
      console.error("Add clients to order_travellers error:", err);
    }
  }, [orderCode]);

  // Handle PDF file drop
  const handleFileDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length === 0) return;
    
    const file = files[0];
    const fileName = file.name.toLowerCase();
    
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
        
        if (!response.ok) {
          throw new Error('Failed to parse PDF');
        }
        
        const { text } = await response.json();
        setPasteText(text);
        setShowPasteInput(true);
      } catch (error) {
        console.error('PDF parsing error:', error);
        setParseError('Failed to read PDF. Try copying text manually.');
      } finally {
        setIsLoadingPdf(false);
      }
    } else if (fileName.endsWith('.txt') || fileName.endsWith('.eml')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setPasteText(text);
        setShowPasteInput(true);
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

  // Apply parsed flight data (shared by AI and regex); normalize arrival year so Schedule shows correct dates
  const applyParsedFlightData = (segments: FlightSegment[], booking: Record<string, unknown>) => {
    setFlightSegments(normalizeSegmentsArrivalYear(segments) as FlightSegment[]);
    const ref = booking.bookingRef ? String(booking.bookingRef).trim() : "";
    if (ref) {
      setRefNr(ref);
      setRefNrs((prev) => (prev.some((r) => r === ref) ? prev : [...prev.filter(Boolean), ref]));
    }
    if (booking.airline) setSupplierName(booking.airline as string);
    if (booking.totalPrice) {
      setClientPrice(String(booking.totalPrice));
      setServicePrice(String(booking.totalPrice));
    }
    if (booking.cabinClass) {
      const validClasses = ["economy", "premium_economy", "business", "first"];
      if (validClasses.includes(booking.cabinClass as string)) {
        const parsedCabinClass = booking.cabinClass as "economy" | "premium_economy" | "business" | "first";
        cabinClassUpdateRef.current = false;
        skipSyncRef.current = true;
        setCabinClass(parsedCabinClass);
        setFlightSegments(prevSegments =>
          prevSegments.map(seg => ({ ...seg, cabinClass: parsedCabinClass }))
        );
        setTimeout(() => { skipSyncRef.current = false; }, 100);
      }
    }
    if (booking.baggage) setBaggage(booking.baggage as string);
    if (booking.refundPolicy) {
      const validPolicies = ["non_ref", "refundable", "fully_ref"];
      if (validPolicies.includes(booking.refundPolicy as string)) {
        setRefundPolicy(booking.refundPolicy as "non_ref" | "refundable" | "fully_ref");
      }
    }
    const passengersRaw = booking.passengers as { name: string; ticketNumber?: string }[] | undefined;
    const ticketNumbersRaw = booking.ticketNumbers as string[] | undefined;
    if (passengersRaw && passengersRaw.length > 0) {
      const titleCased = passengersRaw.map((p) => ({
        id: null as string | null,
        name: toTitleCaseForDisplay(p.name || ""),
      }));
      setClients(titleCased);
      const list = titleCased.map((c, i) => ({
        clientId: null as string | null,
        clientName: c.name,
        ticketNr: passengersRaw[i]?.ticketNumber ?? ticketNumbersRaw?.[i] ?? "",
      }));
      setTicketNumbers(list);
    } else if (ticketNumbersRaw && ticketNumbersRaw.length > 0) {
      setTicketNr(ticketNumbersRaw[0]);
      if (ticketNumbers.length > 0) {
        const updated = [...ticketNumbers];
        updated[0] = { ...updated[0], ticketNr: ticketNumbersRaw[0] };
        setTicketNumbers(updated);
      }
    }
    if (segments[0]?.departureDate) setDateFrom(segments[0].departureDate);
    if (segments.length > 0) {
      const lastSeg = segments[segments.length - 1];
      if (lastSeg.arrivalDate) setDateTo(lastSeg.arrivalDate);
    }
    if (segments.length > 0) {
      const groupedByDate: Record<string, FlightSegment[]> = {};
      segments.forEach(seg => {
        const date = seg.departureDate || "unknown";
        if (!groupedByDate[date]) groupedByDate[date] = [];
        groupedByDate[date].push(seg);
      });
      const routeParts = Object.entries(groupedByDate).map(([, segs]) => {
        const dateStr = formatDateShort(segs[0]?.departureDate || "");
        const cities = [
          segs[0].departureCity?.trim() || segs[0].departure || "",
          ...segs.map(s => (s.arrivalCity?.trim() || s.arrival || "")),
        ].filter(Boolean);
        const routeStr = cities.join(" - ");
        return dateStr && dateStr !== "-" ? `${dateStr} ${routeStr}` : routeStr;
      });
      setServiceName(routeParts.join(" / "));
    }
    setShowPasteInput(false);
    setPasteText("");
  };

  // Parse flight booking text — try AI first, fallback to regex
  const handleParseFlight = async () => {
    if (!pasteText.trim()) return;
    
    setParseError(null);
    const text = pasteText.trim();
    setIsParsingFlight(true);
    
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
        applyParsedFlightData(data.segments, data.booking || {});
        return;
      }
    } catch (e) {
      console.error("AI flight parse error:", e);
    } finally {
      setIsParsingFlight(false);
    }
    
    const result = parseFlightBooking(text);
    if (!result || result.segments.length === 0) {
      setParseError("Could not parse this booking. Try copying the full confirmation text.");
      return;
    }
    
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
    applyParsedFlightData(segments, {
      bookingRef: result.booking.bookingRef,
      airline: result.booking.airline,
      totalPrice: result.booking.totalPrice,
      ticketNumbers: result.booking.ticketNumbers,
      passengers: result.booking.passengers,
      cabinClass: result.booking.cabinClass,
      baggage: result.booking.baggage,
      refundPolicy: result.booking.refundPolicy,
    });
  };

  const handleSave = async () => {
    if (!serviceName.trim()) {
      setError("Service name is required");
      return;
    }

    // Hotel must have at least 1 real client
    if (categoryType === "hotel") {
      const realClients = clients.filter(c => c.id || c.name?.trim());
      if (realClients.length === 0) {
        setError("At least 1 client is required. You can remove this client and add another, but cannot save with no clients.");
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      // Resolve clients: find-or-create for name-only entries so we have ids for payload and service travellers
      let resolvedClients: ClientEntry[] = [...clients];
      const nameOnly = clients.filter(c => (c.name?.trim() ?? "") !== "" && !c.id);
      if (nameOnly.length > 0) {
        const res = await fetch("/api/parties/find-or-create-travellers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({ travellers: nameOnly.map(c => ({ name: c.name })) }),
        });
        if (res.ok) {
          const data = await res.json();
          const parties = (data.parties || []) as { name: string; id: string; displayName: string }[];
          let nameOnlyIdx = 0;
          resolvedClients = clients.map((c) => {
            if ((c.name?.trim() ?? "") !== "" && !c.id && parties[nameOnlyIdx]) {
              const p = parties[nameOnlyIdx++];
              return { id: p.id, name: p.displayName || p.name };
            }
            return c;
          });
        }
      }

      const clientIds = resolvedClients.filter(c => c.id).map(c => c.id as string);
      const primaryClient = resolvedClients.find(c => c.id) || resolvedClients[0];

      const payload: Record<string, unknown> = {
        category,
        category_id: categoryId, // UUID reference to travel_service_categories
        service_name: serviceName.trim(),
        service_date_from: dateFrom || null,
        service_date_to: dateTo || dateFrom || null,
        supplier_party_id: supplierPartyId,
        supplier_name: supplierName,
        client_party_id: primaryClient?.id || null,
        client_name: primaryClient?.name || "",
        clients: resolvedClients.filter(c => c.id).map(c => ({ id: c.id, name: c.name })),
        payer_party_id: payerPartyId,
        payer_name: payerName,
        service_price: categoryType === "flight" && pricingPerClient.length > 0
          ? Math.round(pricingPerClient.reduce((s, p) => s + (parseFloat(p.cost) || 0), 0) * 100) / 100
          : parseFloat(servicePrice) || 0,
        client_price: categoryType === "flight" && pricingPerClient.length > 0
          ? Math.round(pricingPerClient.reduce((s, p) => s + (parseFloat(p.sale) || 0), 0) * 100) / 100
          : parseFloat(clientPrice) || 0,
        quantity: categoryType === "flight" ? 1 : priceUnits,
        vat_rate: vatRate,
        res_status: resStatus || "booked",
        ref_nr: categoryType === "flight" && refNrs.length > 0 ? refNrs.filter(Boolean).join(", ") || null : refNr || null,
        ticket_nr: showTicketNr ? (categoryType === "flight" && ticketNumbers.length > 0 ? ticketNumbers.map(t => t.ticketNr).join(", ") : ticketNr) : null,
        ticket_numbers: categoryType === "flight" ? ticketNumbers : undefined,
      };

      // Add hotel-specific fields
      if (showHotelFields) {
        payload.hotel_name = hotelName;
        payload.hotel_address = hotelAddress;
        payload.hotel_phone = hotelPhone;
        payload.hotel_email = hotelEmail;
        payload.hotel_room = hotelRoom;
        payload.hotel_board = hotelBoard;
        payload.hotel_bed_type = hotelBedType ?? "not_guaranteed";
        payload.hotel_early_check_in = hotelPreferences.earlyCheckIn;
        payload.hotel_late_check_in = hotelPreferences.lateCheckIn;
        payload.hotel_higher_floor = hotelPreferences.higherFloor;
        payload.hotel_king_size_bed = hotelPreferences.kingSizeBed;
        payload.hotel_honeymooners = hotelPreferences.honeymooners;
        payload.hotel_silent_room = hotelPreferences.silentRoom;
        payload.hotel_repeat_guests = hotelPreferences.repeatGuests;
        payload.hotel_rooms_next_to = hotelPreferences.roomsNextTo;
        payload.hotel_parking = hotelPreferences.parking;
        payload.hotel_preferences_free_text = hotelPreferences.freeText;
        payload.supplier_booking_type = supplierBookingType;
      }

      // Add Tour-specific fields (Package Tour)
      if (categoryType === "tour") {
        payload.hotel_name = hotelName || null;
        payload.hotel_address = hotelAddress || null;
        payload.hotel_phone = hotelPhone || null;
        payload.hotel_star_rating = hotelStarRating || null;
        payload.hotel_room = hotelRoom || null;
        payload.hotel_board = hotelBoard || null;
        payload.meal_plan_text = mealPlanText?.trim() || null;
        payload.transfer_type = transferType || null;
        payload.additional_services = additionalServices || null;
        if (flightSegments.length > 0) payload.flight_segments = flightSegments;
      }
      // Add transfer-specific fields
      if (showTransferFields) {
        payload.pickup_location = pickupLocation;
        payload.dropoff_location = dropoffLocation;
        payload.pickup_time = pickupTime;
        payload.estimated_duration = estimatedDuration;
        payload.linked_flight_id = linkedFlightId;
        payload.transfer_routes = transferRoutes.map(r => ({
          ...r,
          bookingType: transferBookingType,
          hours: transferBookingType === "by_hour" ? transferHours : undefined,
          chauffeurNotes: chauffeurNotes || undefined,
        }));
        payload.transfer_mode = transferMode;
        payload.vehicle_class = vehicleClass ? (vehicleClassCustom ? `${vehicleClass}: ${vehicleClassCustom}` : vehicleClass) : (vehicleClassCustom || null);
        payload.driver_name = driverName || null;
        payload.driver_phone = driverPhone || null;
        payload.driver_notes = driverNotes || null;
      }

      // Add flight-specific fields
      if (categoryType === "flight") {
        payload.cabin_class = cabinClass;
        payload.baggage = baggage;
        if (flightSegments.length > 0) {
          payload.flight_segments = flightSegments;
        }
        if (pricingPerClient.length > 0) {
          const validClients = clients.filter(c => c.id || c.name);
          payload.pricingPerClient = validClients.map((c, i) => ({
            partyId: c.id ?? null,
            cost: parseFloat(pricingPerClient[i]?.cost || "0") || 0,
            marge: parseFloat(pricingPerClient[i]?.marge || "0") || 0,
            sale: parseFloat(pricingPerClient[i]?.sale || "0") || 0,
          }));
        }
        console.log("[EditService] Sending cabin_class:", cabinClass, "category:", category);
      }
      
      // Add payment deadline fields
      payload.payment_deadline_deposit = paymentDeadlineDeposit || null;
      payload.payment_deadline_final = paymentDeadlineFinal || null;
      payload.payment_terms = categoryType === "tour" && (depositPercent || finalPercent)
        ? `${depositPercent || 0}% deposit, ${finalPercent || 100}% final`
        : (paymentTerms?.trim() || null);

      // Add terms & conditions fields
      payload.price_type = priceType;
      payload.refund_policy = refundPolicy;
      payload.free_cancellation_until = freeCancellationUntil || null;
      payload.cancellation_penalty_amount = cancellationPenaltyAmount ? parseFloat(cancellationPenaltyAmount) : null;
      payload.cancellation_penalty_percent = cancellationPenaltyPercent ? parseInt(cancellationPenaltyPercent) : null;
      if (categoryType === "flight") {
        payload.change_fee = changeFee ? parseFloat(changeFee) : null;
      }

      // Tour (Package Tour): commission + agent discount + commission_amount + commission_rate (persisted)
      if (categoryType === "tour") {
        const comm = selectedCommissionIndex >= 0 ? supplierCommissions[selectedCommissionIndex] : null;
        payload.commission_name = comm?.name ?? null;
        payload.commission_rate = comm?.rate ?? Number(service.commissionRate) ?? null;
        const cost = parseFloat(servicePrice) || 0;
        const commAmount = comm?.rate != null && comm.rate > 0 ? Math.round((cost * comm.rate / 100) * 100) / 100 : (Number(service.commissionAmount) || 0);
        payload.commission_amount = commAmount;
        const discVal = parseFloat(agentDiscountValue);
        payload.agent_discount_value = Number.isFinite(discVal) ? discVal : null;
        payload.agent_discount_type = agentDiscountValue.trim() ? agentDiscountType : null;
      }

      const response = await fetch(
        `/api/orders/${encodeURIComponent(orderCode)}/services/${service.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {}),
          },
          credentials: 'include',
          body: JSON.stringify(payload),
        }
      );

      if (response.ok) {
        // Sync clients to order_travellers (so they appear in order Travellers column)
        await addClientsToOrderTravellers(clientIds);

        // Persist service travellers (order_service_travellers) so Edit reopens with correct clients
        if (clientIds.length > 0) {
          await fetch(`/api/services/${encodeURIComponent(service.id)}/travellers`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
            },
            credentials: "include",
            body: JSON.stringify({ travellerIds: clientIds }),
          });
        }

        const opt = (v: string | null | undefined) => (v?.trim() ? v.trim() : undefined);
        const finalServicePrice = categoryType === "flight" && pricingPerClient.length > 0
          ? Math.round(pricingPerClient.reduce((s, p) => s + (parseFloat(p.cost) || 0), 0) * 100) / 100
          : parseFloat(servicePrice) || 0;
        const finalClientPrice = categoryType === "flight" && pricingPerClient.length > 0
          ? Math.round(pricingPerClient.reduce((s, p) => s + (parseFloat(p.sale) || 0), 0) * 100) / 100
          : parseFloat(clientPrice) || 0;
        onServiceUpdated({
          id: service.id,
          name: serviceName,
          category,
          supplier: supplierName || "-",
          client: primaryClient?.name || "-",
          payer: payerName || "-",
          supplierPartyId,
          clientPartyId: primaryClient?.id || undefined,
          payerPartyId,
          servicePrice: finalServicePrice,
          clientPrice: finalClientPrice,
          resStatus,
          refNr,
          ticketNr,
          ticketNumbers: categoryType === "flight" ? ticketNumbers.map((t) => ({ clientId: t.clientId ?? "", clientName: t.clientName, ticketNr: t.ticketNr })) : undefined,
          dateFrom,
          dateTo,
          // Flight-specific
          cabinClass: categoryType === "flight" ? cabinClass : undefined,
          baggage: categoryType === "flight" ? baggage : undefined,
          flightSegments: categoryType === "flight" ? flightSegments : undefined,
          // Hotel / Tour: Service expects string | undefined, not null (use opt())
          hotelName: (showHotelFields || categoryType === "tour") ? opt(hotelName) : undefined,
          hotelAddress: (showHotelFields || categoryType === "tour") ? opt(hotelAddress) : undefined,
          hotelPhone: (showHotelFields || categoryType === "tour") ? opt(hotelPhone) : undefined,
          hotelEmail: showHotelFields ? opt(hotelEmail) : undefined,
          hotelRoom: (showHotelFields || categoryType === "tour") ? opt(hotelRoom) : undefined,
          hotelBoard: (showHotelFields || categoryType === "tour") ? (hotelBoard || undefined) : undefined,
          hotelBedType: showHotelFields ? (hotelBedType || undefined) : undefined,
          hotelStarRating: categoryType === "tour" ? opt(hotelStarRating) : undefined,
          mealPlanText: categoryType === "tour" ? opt(mealPlanText) : undefined,
          transferType: categoryType === "tour" ? opt(transferType) : undefined,
          additionalServices: categoryType === "tour" ? opt(additionalServices) : undefined,
          hotelEarlyCheckIn: showHotelFields ? hotelPreferences.earlyCheckIn ?? undefined : undefined,
          hotelLateCheckIn: showHotelFields ? hotelPreferences.lateCheckIn ?? undefined : undefined,
          hotelHigherFloor: showHotelFields ? hotelPreferences.higherFloor ?? undefined : undefined,
          hotelKingSizeBed: showHotelFields ? hotelPreferences.kingSizeBed ?? undefined : undefined,
          hotelHoneymooners: showHotelFields ? hotelPreferences.honeymooners ?? undefined : undefined,
          hotelSilentRoom: showHotelFields ? hotelPreferences.silentRoom ?? undefined : undefined,
          hotelRepeatGuests: showHotelFields ? hotelPreferences.repeatGuests ?? undefined : undefined,
          hotelRoomsNextTo: showHotelFields ? (hotelPreferences.roomsNextTo || undefined) : undefined,
          hotelParking: showHotelFields ? hotelPreferences.parking ?? undefined : undefined,
          hotelPreferencesFreeText: showHotelFields ? (hotelPreferences.freeText || undefined) : undefined,
          // Tour: commission accepts null
          commissionName: categoryType === "tour" ? (selectedCommissionIndex >= 0 ? supplierCommissions[selectedCommissionIndex]?.name ?? null : null) : undefined,
          commissionRate: categoryType === "tour" ? (selectedCommissionIndex >= 0 ? supplierCommissions[selectedCommissionIndex]?.rate ?? null : Number(service.commissionRate) ?? null) : undefined,
          commissionAmount: categoryType === "tour" ? (() => { const c = selectedCommissionIndex >= 0 ? supplierCommissions[selectedCommissionIndex] : null; const cost = parseFloat(servicePrice) || 0; return c?.rate != null && c.rate > 0 ? Math.round((cost * c.rate / 100) * 100) / 100 : (Number(service.commissionAmount) || 0); })() : undefined,
          agentDiscountValue: categoryType === "tour" ? (agentDiscountValue.trim() ? parseFloat(agentDiscountValue) : null) : undefined,
          agentDiscountType: categoryType === "tour" ? agentDiscountType : undefined,
        });
        onClose();
      } else {
        const errData = await response.json().catch(() => ({}));
        setError(errData.error || 'Failed to update service');
      }
    } catch (err) {
      console.error('Update error:', err);
      setError('Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const flightScheduleBlock = showFlightItinerary && flightSegments.length > 0 ? (
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
                        {(() => {
                          let displayDuration = seg.duration;
                          if (!displayDuration && seg.departureTimeScheduled && seg.arrivalTimeScheduled) {
                            const [depH, depM] = seg.departureTimeScheduled.split(":").map(Number);
                            const [arrH, arrM] = seg.arrivalTimeScheduled.split(":").map(Number);
                            let durationMins = (arrH * 60 + arrM) - (depH * 60 + depM);
                            if (durationMins < 0) durationMins += 24 * 60;
                            if (seg.departureDate && seg.arrivalDate && seg.departureDate !== seg.arrivalDate) {
                              const daysDiff = Math.floor((new Date(seg.arrivalDate).getTime() - new Date(seg.departureDate).getTime()) / (1000 * 60 * 60 * 24));
                              if (daysDiff > 0) durationMins += daysDiff * 24 * 60;
                            }
                            const hrs = Math.floor(durationMins / 60);
                            const mns = durationMins % 60;
                            displayDuration = `${hrs}h ${mns}m`;
                          }
                          return displayDuration ? (
                            <div className="text-xs font-medium text-gray-700 mb-1">{displayDuration}</div>
                          ) : (
                            <div className="text-[10px] text-gray-400 mb-1">—</div>
                          );
                        })()}
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
                      <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded" title={seg.baggage}>🧳 {formatBaggageDisplay(seg.baggage)}</span>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-lg" style={modalStyle}>
        <div className="sticky top-0 bg-white border-b border-[#E0E0E0] px-6 py-4 flex items-center justify-between z-10 cursor-grab active:cursor-grabbing select-none" onMouseDown={onHeaderMouseDown}>
          <div className="flex items-center gap-3">
            <div className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded bg-[#E6FAE6]">
              <svg className="h-3.5 w-3.5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-[#343A40]">
              Edit Service{category ? ` — ${category}` : ""}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-[#6C757D] hover:text-gray-900 hover:bg-gray-100" aria-label="Close">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Paste & Parse - unified for Flight and Tour (top of form) */}
        {(categoryType === "flight" || categoryType === "tour") && (
          <div className="px-4 pt-3">
            {categoryType === "flight" ? (
              !showPasteInput ? (
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
                    if (f && (f.type === "application/pdf" || /\.(pdf|txt|eml)$/i.test(f.name || ""))) {
                      e.preventDefault();
                      const dt = new DataTransfer();
                      dt.items.add(f);
                      handleFileDrop({ preventDefault: () => {}, stopPropagation: () => {}, dataTransfer: dt } as React.DragEvent<HTMLDivElement>);
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
                    isDragging
                      ? 'border-blue-500 bg-blue-100 text-blue-700'
                      : 'border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-400'
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
                        📋 Paste & Parse (replace flight)
                      </div>
                      <span className="text-xs text-gray-400">or drop PDF / TXT file, Ctrl+V to paste</span>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-xs text-blue-600 font-medium mb-1">
                    Paste Amadeus ITR or airline confirmation — will replace current flight data
                  </div>
                  <textarea
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
                    placeholder="Paste Amadeus ITR, email, or PDF text here. Or paste file (Ctrl+V)."
                    rows={6}
                    className="w-full rounded-lg border border-blue-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                  {parseError && (
                    <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{parseError}</div>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleParseFlight}
                      disabled={!pasteText.trim() || isParsingFlight}
                      className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {isParsingFlight ? "Parsing…" : "📋 Parse"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowPasteInput(false); setPasteText(""); setParseError(null); }}
                      className="px-4 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )
            ) : (
              /* Tour: PDF / image / paste text */
              !showTourPasteInput ? (
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
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = "copy";
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingTour(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingTour(false);
                  }}
                  onPaste={(e) => {
                    if (isParsingTour) return;
                    const files = e.clipboardData?.files;
                    const f = files?.[0];
                    if (f && isAcceptableTourFile(f)) {
                      e.preventDefault();
                      handleParsePackageTour(f);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (!isParsingTour) tourParseInputRef.current?.click();
                    }
                  }}
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
                      <span className="text-sm text-gray-600">Drop PDF/image, Ctrl+V to paste, or click to parse</span>
                      <span
                        onClick={(e) => { e.stopPropagation(); setShowTourPasteInput(true); }}
                        className="ml-auto text-xs text-blue-600 hover:underline shrink-0 cursor-pointer"
                      >
                        Paste text
                      </span>
                    </>
                  )}
                  <input
                    ref={tourParseInputRef}
                    type="file"
                    accept=".pdf,image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleParsePackageTour(f);
                      e.target.value = "";
                    }}
                  />
                  {parseError && !showTourPasteInput && (
                    <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">{parseError}</div>
                  )}
                </div>
              ) : (
                <div className="space-y-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-xs text-gray-600 font-medium mb-1">
                    Paste document text — will fill tour fields
                  </div>
                  <textarea
                    value={tourPasteText}
                    onChange={(e) => setTourPasteText(e.target.value)}
                    onPaste={(e) => {
                      const files = e.clipboardData?.files;
                      const f = files?.[0];
                      if (f && isAcceptableTourFile(f)) {
                        e.preventDefault();
                        handleParsePackageTour(f);
                      }
                    }}
                    placeholder="Open PDF, Ctrl+A, Ctrl+C, paste here. Or paste file (Ctrl+V)."
                    rows={4}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                    autoFocus
                  />
                  {parseError && (
                    <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{parseError}</div>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleParsePackageTourText}
                      disabled={!tourPasteText.trim() || isParsingTour}
                      className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {isParsingTour ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Parsing...
                        </>
                      ) : (
                        "📋 Parse"
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowTourPasteInput(false); setTourPasteText(""); setParseError(null); }}
                      className="px-4 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {/* Content: light grey background #F8F9FA, two columns left ~65% right ~35% */}
        <div className="p-4 bg-[#F8F9FA]">
          {error && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {error}
            </div>
          )}

          <div className={`grid grid-cols-1 gap-3 ${categoryType === "flight" ? "md:grid-cols-[3fr_2fr]" : categoryType === "hotel" ? "md:grid-cols-[1.65fr_1fr]" : "md:grid-cols-3"}`}>
            
            <div className={`space-y-3 ${categoryType === "hotel" ? "" : ""}`}>
              {categoryType === "hotel" ? (
                /* Hotel left column: BASIC INFO → Supplier → Preferences → Contact → Send to Hotel */
                <div className="space-y-3">

                  {/* BASIC INFO */}
                  <div className="p-3 bg-white rounded-md border border-[#CED4DA] shadow-sm space-y-3">
                    <h4 className="text-xs font-semibold text-[#343A40] uppercase tracking-wide">BASIC INFO</h4>
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
                          setHotelRoomOptions(d.roomOptions ?? []);
                          if (d.hid) {
                            setHotelHid(d.hid);
                            mealFetchedForRef.current = null;
                          }
                        }}
                        placeholder="Search hotel by name..."
                      />
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
                          onChange={(e) => setHotelRoom(e.target.value)}
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
                        {roomListOpen && roomOptionsForDropdown.length > 0 && (
                          <div className="absolute z-50 mt-0.5 w-full max-h-48 overflow-auto rounded-lg border border-amber-200 bg-white shadow-lg">
                            {roomOptionsForDropdown.map((opt) => (
                              <button key={opt} type="button" className="w-full px-2.5 py-1.5 text-left text-sm hover:bg-amber-50 border-b border-amber-50 last:border-0 break-words" onClick={() => { setHotelRoom(opt); setRoomListOpen(false); }}>{opt}</button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div ref={boardListRef} className="relative">
                        <label className="block text-sm font-normal text-[#343A40] mb-1">Board</label>
                        <input
                          type="text"
                          value={mealPlanText || BOARD_LABELS[hotelBoard] || ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setMealPlanText(v);
                            const mapped = (Object.entries(BOARD_LABELS).find(([, l]) => l === v)?.[0] as typeof hotelBoard) ?? mapRatehawkMealToBoard(v);
                            setHotelBoard(mapped);
                          }}
                          onFocus={() => boardOptionsForDropdown.length > 0 && setBoardListOpen(true)}
                          onClick={() => boardOptionsForDropdown.length > 0 && setBoardListOpen(true)}
                          onBlur={() => {
                            const v = (mealPlanText || BOARD_LABELS[hotelBoard] || "").trim();
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
                          <div className="absolute z-50 mt-0.5 w-full max-h-48 overflow-auto rounded-lg border border-amber-200 bg-white shadow-lg">
                            {boardOptionsForDropdown.map((opt) => (
                              <button key={opt} type="button" className="w-full px-2.5 py-1.5 text-left text-sm hover:bg-amber-50 border-b border-amber-50 last:border-0 break-words" onClick={() => { const bk = (Object.entries(BOARD_LABELS).find(([, l]) => l === opt)?.[0] as typeof hotelBoard) ?? mapRatehawkMealToBoard(opt); setMealPlanText(BOARD_LABELS[bk] || opt); setHotelBoard(bk); setBoardListOpen(false); }}>{opt}</button>
                          ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-normal text-[#343A40] mb-1">Bed Type</label>
                        <select value={hotelBedType} onChange={(e) => setHotelBedType(e.target.value as typeof hotelBedType)} className="w-full rounded-md border border-[#CED4DA] px-2.5 py-1.5 text-sm text-[#343A40] bg-white focus:border-[#FFC107] focus:ring-1 focus:ring-amber-400">
                          <option value="king_queen">King/Queen</option>
                          <option value="twin">Twin</option>
                          <option value="not_guaranteed">Not guaranteed</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Supplier */}
                  <div className="p-3 bg-white rounded-md border border-[#CED4DA] shadow-sm space-y-2">
                    <h4 className="text-xs font-semibold text-[#343A40] uppercase tracking-wide">Supplier</h4>
                    <div className="flex gap-2 items-center">
                      <div className="w-[38%] shrink-0">
                        <select
                          value={supplierBookingType}
                          onChange={(e) => {
                            const newType = e.target.value as "gds" | "direct";
                            setSupplierBookingType(newType);
                            if (newType === "direct" && hotelName.trim()) setSupplierName(hotelName.trim());
                          }}
                          className="w-full rounded-md border border-[#CED4DA] px-2.5 py-1.5 text-sm bg-white focus:border-[#FFC107] focus:ring-1 focus:ring-amber-400"
                        >
                          <option value="gds">GDS</option>
                          <option value="direct">Direct booking</option>
                        </select>
                      </div>
                      <div className="flex-1 min-w-0">
                        <PartySelect
                          value={supplierPartyId}
                          onChange={(id, name) => { setSupplierPartyId(id); setSupplierName(name); }}
                          roleFilter="supplier"
                          initialDisplayName={supplierName || hotelName}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-sm font-normal text-[#343A40] mb-1">Booking ref</label>
                        <input
                          type="text"
                          value={refNr}
                          onChange={(e) => setRefNr(e.target.value)}
                          placeholder="Booking ref"
                          className={`w-full rounded-md border px-2.5 py-1.5 text-sm ${parseAttemptedButEmpty.has("refNr") ? "ring-2 ring-red-300 border-red-400 bg-red-50/50" : parsedFields.has("refNr") ? "ring-2 ring-green-300 border-green-400" : "border-[#CED4DA] focus:border-[#FFC107] focus:ring-1 focus:ring-amber-400"}`}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-normal text-[#343A40] mb-1">Status</label>
                        <select
                          value={resStatus}
                          onChange={(e) => setResStatus(e.target.value)}
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
                  <div className="space-y-2">
                    <label className="block text-sm font-normal text-[#343A40]">Preferences</label>
                    <div className="grid grid-cols-4 gap-x-3 gap-y-2">
                      <label className="flex items-center gap-1.5 text-sm font-normal text-[#343A40]">
                        <input type="checkbox" checked={hotelPreferences.earlyCheckIn} onChange={(e) => setHotelPreferences(prev => ({ ...prev, earlyCheckIn: e.target.checked }))} className="rounded border-[#CED4DA] accent-[#387ADF] focus:ring-amber-400" />
                        Early check-in
                      </label>
                      <label className="flex items-center gap-1.5 text-sm font-normal text-[#343A40]">
                        <input type="checkbox" checked={hotelPreferences.lateCheckIn} onChange={(e) => setHotelPreferences(prev => ({ ...prev, lateCheckIn: e.target.checked }))} className="rounded border-[#CED4DA] accent-[#387ADF] focus:ring-amber-400" />
                        Late check-in
                      </label>
                      <label className="flex items-center gap-1.5 text-sm font-normal text-[#343A40]">
                        <input type="checkbox" checked={hotelPreferences.higherFloor} onChange={(e) => setHotelPreferences(prev => ({ ...prev, higherFloor: e.target.checked }))} className="rounded border-[#CED4DA] accent-[#387ADF] focus:ring-amber-400" />
                        Higher floor
                      </label>
                      <label className="flex items-center gap-1.5 text-sm font-normal text-[#343A40]">
                        <input type="checkbox" checked={hotelPreferences.kingSizeBed} onChange={(e) => setHotelPreferences(prev => ({ ...prev, kingSizeBed: e.target.checked }))} className="rounded border-[#CED4DA] accent-[#387ADF] focus:ring-amber-400" />
                        King size bed
                      </label>
                      <label className="flex items-center gap-1.5 text-sm font-normal text-[#343A40]">
                        <input type="checkbox" checked={hotelPreferences.honeymooners} onChange={(e) => setHotelPreferences(prev => ({ ...prev, honeymooners: e.target.checked }))} className="rounded border-[#CED4DA] accent-[#387ADF] focus:ring-amber-400" />
                        Honeymooners
                      </label>
                      <label className="flex items-center gap-1.5 text-sm font-normal text-[#343A40]">
                        <input type="checkbox" checked={hotelPreferences.silentRoom} onChange={(e) => setHotelPreferences(prev => ({ ...prev, silentRoom: e.target.checked }))} className="rounded border-[#CED4DA] accent-[#387ADF] focus:ring-amber-400" />
                        Silent room
                      </label>
                      <label className="flex items-center gap-1.5 text-sm font-normal text-[#343A40]">
                        <input type="checkbox" checked={hotelPreferences.repeatGuests} onChange={(e) => setHotelPreferences(prev => ({ ...prev, repeatGuests: e.target.checked }))} className="rounded border-[#CED4DA] accent-[#387ADF] focus:ring-amber-400" />
                        Repeat Guests
                      </label>
                      <label className="flex items-center gap-1.5 text-sm font-normal text-[#343A40]">
                        <input type="checkbox" checked={hotelPreferences.parking} onChange={(e) => setHotelPreferences(prev => ({ ...prev, parking: e.target.checked }))} className="rounded border-[#CED4DA] accent-[#387ADF] focus:ring-amber-400" />
                        Parking
                      </label>
                    </div>
                    <textarea
                      value={hotelPreferences.freeText}
                      onChange={(e) => setHotelPreferences(prev => ({ ...prev, freeText: e.target.value }))}
                      placeholder="Additional preferences (free text)"
                      rows={2}
                      className="w-full rounded-md border border-[#CED4DA] px-2.5 py-1.5 text-sm text-[#343A40] bg-white placeholder:text-[#6C757D] focus:border-[#FFC107] focus:ring-1 focus:ring-amber-400 resize-y"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const preferencesList = Object.entries(hotelPreferences)
                          .filter(([key, value]) => key !== "roomsNextTo" && key !== "freeText" && value === true)
                          .map(([key]) => key.replace(/([A-Z])/g, " $1").toLowerCase())
                          .join(", ");
                        const message = `We have a reservation for ${hotelName}. Please confirm the reservation exists and consider the following preferences:\n\nRoom: ${hotelRoom || "Not specified"}\nBoard: ${hotelBoard}\nBed Type: ${hotelBedType}\nPreferences: ${preferencesList || "None"}${hotelPreferences.freeText ? `\nAdditional: ${hotelPreferences.freeText}` : ""}`;
                        alert(`Message to hotel:\n\n${message}\n\n(Will be saved to Communication tab)`);
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-[#FF8C00] border border-[#FF8C00] hover:bg-[#FF8C00] hover:text-white rounded-md transition-colors inline-flex items-center gap-1.5"
                    >
                      <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      Send to Hotel
                    </button>
                  </div>

                  {/* Contact: Address / Phone / Email */}
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

                  {/* Cancel / Save */}
                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 disabled:opacity-50">
                      Cancel
                    </button>
                    <button type="button" onClick={handleSave} disabled={isSubmitting} className="px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                      {isSubmitting ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        </>
                      ) : "Save Changes"}
                    </button>
                  </div>

                </div>
              ) : (
              <div className="p-3 bg-white rounded-md border border-[#CED4DA] shadow-sm space-y-2">
                <h4 className="text-xs font-semibold text-[#343A40] uppercase tracking-wide">BASIC INFO</h4>
                
                {/* Category only in header "Edit Service — {category}" (mirror Add). For Hotel: no Name (in Hotel Details), no Dates (in Hotel Details) */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">
                    {categoryType === "flight" ? "Route *" : categoryType === "tour" ? "Direction" : "Name *"}
                  </label>
                  <input
                    type="text"
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    placeholder={categoryType === "flight" ? "25.01 RIX-FRA-NCE / 02.02 NCE-FRA-RIX" : categoryType === "tour" ? "RIX-AYT 19.09-27.09" : "Description"}
                    className={`w-full rounded-lg border px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 ${categoryType === "tour" && parseAttemptedButEmpty.has("serviceName") ? "ring-2 ring-red-300 border-red-400 bg-red-50/50" : categoryType === "tour" && parsedFields.has("serviceName") ? "ring-2 ring-green-300 border-green-400" : "border-gray-300 focus:border-blue-500"}`}
                  />
                </div>

                {categoryType === "flight" ? (
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
                        triggerClassName={parseAttemptedButEmpty.has("dateFrom") || parseAttemptedButEmpty.has("dateTo") ? "ring-2 ring-red-300 border-red-400 bg-red-50/50" : (parsedFields.has("dateFrom") || parsedFields.has("dateTo")) ? "ring-2 ring-green-300 border-green-400" : undefined}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Cabin Class</label>
                      <select
                        value={cabinClass}
                        onChange={(e) => {
                          cabinClassUpdateRef.current = true;
                          setCabinClass(e.target.value as "economy" | "premium_economy" | "business" | "first");
                        }}
                        className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                      >
                        <option value="economy">Economy</option>
                        <option value="premium_economy">Premium Economy</option>
                        <option value="business">Business</option>
                        <option value="first">First</option>
                      </select>
                    </div>
                  </div>
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
                
                {/* Baggage - for Flight (Cabin Class already in Dates row) */}
                {categoryType === "flight" ? (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Baggage</label>
                      <input
                        type="text"
                        value={baggage}
                        onChange={(e) => setBaggage(e.target.value)}
                        placeholder="e.g., personal+cabin+1bag"
                        className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                      />
                      {baggage && (
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          {formatBaggageDisplay(baggage)}
                        </div>
                      )}
                    </div>
                  </>
                ) : null}
                {categoryType !== "flight" && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-0.5">Status</label>
                    <div className="flex items-center gap-2">
                      <select
                        value={resStatus}
                        onChange={(e) => setResStatus(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      >
                        {RES_STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PARTIES — Supplier + Ref Nr + Status (flight only) */}
            {categoryType === "flight" && (
              <div className="p-3 bg-white rounded-md border border-[#CED4DA] shadow-sm space-y-2">
                <h4 className="text-xs font-semibold text-[#343A40] uppercase tracking-wide">SUPPLIER</h4>
                <PartySelect
                  value={supplierPartyId}
                  onChange={(id, name) => { setSupplierPartyId(id); setSupplierName(name); }}
                  roleFilter="supplier"
                  initialDisplayName={supplierName}
                />
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
                            className="flex-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm min-w-0 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
                      onChange={(e) => setResStatus(e.target.value)}
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

            {/* Flight Schedule — in the left column */}
            {categoryType === "flight" && flightScheduleBlock}

            </div>

            {/* Right side: CLIENT + PRICING + REFERENCES */}
            {(() => {
              const needsWrapper = categoryType === "hotel" || categoryType === "flight";
              const RightWrapper = needsWrapper ? "div" : React.Fragment;
              const rightWrapperProps = needsWrapper ? { className: "md:col-span-1 space-y-2" as const } : {};
              return (
                <RightWrapper {...rightWrapperProps}>
            <div className="space-y-3">
              <div className="p-3 bg-white rounded-md border border-[#CED4DA] shadow-sm space-y-2">
                <h4 className="text-xs font-semibold text-[#343A40] uppercase tracking-wide">{categoryType === "hotel" ? "CLIENTS" : categoryType === "flight" ? "CLIENT" : "PARTIES"}</h4>
                
                {/* Supplier: for Flight/Hotel in left column; for Tour/other here */}
                {categoryType !== "flight" && categoryType !== "hotel" && (
                <div className={categoryType === "tour" && parseAttemptedButEmpty.has("supplierName") ? "ring-2 ring-red-300 border-red-400 rounded-lg p-0.5 -m-0.5 bg-red-50/50" : parsedFields.has("supplierName") ? "ring-2 ring-green-300 rounded-lg p-1 -m-1" : ""}>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Supplier</label>
                  <PartySelect
                    value={supplierPartyId}
                    onChange={(id, name) => { setSupplierPartyId(id); setSupplierName(name); }}
                    roleFilter="supplier"
                    initialDisplayName={supplierName}
                  />
                </div>
                )}
                
                <div className={categoryType === "tour" && parseAttemptedButEmpty.has("clients") ? "ring-2 ring-red-300 border-red-400 rounded-lg p-0.5 -m-0.5 bg-red-50/50" : categoryType === "tour" && parsedFields.has("clients") ? "ring-2 ring-green-300 border-green-400 rounded-lg p-0.5 -m-0.5" : ""}>
                  {categoryType !== "flight" && categoryType !== "hotel" && (
                    <label className="block text-xs font-medium text-gray-600 mb-0.5">Client</label>
                  )}
                  {categoryType === "hotel" ? (
                    /* Hotel: simple text pills + ClientMultiSelectDropdown for adding */
                    <div className="space-y-2">
                      {/* Warning when no real clients — only after loading is complete */}
                      {!isLoadingClients && clients.filter(c => c.id || c.name?.trim()).length === 0 && (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                          Minimum 1 client required. Add a client before saving.
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {clients.filter(c => c.id || c.name).map((client, _, arr) => {
                          const realIndex = clients.indexOf(client);
                          return (
                            <span key={realIndex} className="inline-flex items-center gap-1 bg-[#E9ECEF] rounded-xl pl-3 pr-1.5 py-1 text-[13px] text-[#343A40]">
                              {toTitleCaseForDisplay(client.name || "")}
                              <button
                                type="button"
                                onClick={() => removeClient(realIndex)}
                                className="text-[#6C757D] hover:text-red-600 ml-0.5 leading-none"
                                aria-label="Remove"
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
                  ) : categoryType === "flight" ? (
                    /* Flight: client + e-ticket per row, then Add Accompanying Persons */
                    <div className="space-y-2">
                      {!isLoadingClients && clients.filter(c => c.id || c.name?.trim()).length === 0 && (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                          Minimum 1 client required. Add a client before saving.
                        </p>
                      )}
                      <div className="space-y-2">
                        {clients.filter(c => c.id || c.name).map((client, idx) => {
                          const realIndex = clients.indexOf(client);
                          const ticketEntry = ticketNumbers[idx];
                          const displayName = toTitleCaseForDisplay(client.name || "") || "-";
                          return (
                            <div key={client.id ?? realIndex} className="flex items-center gap-2 flex-wrap">
                              <span className="inline-flex items-center gap-1 bg-[#E9ECEF] rounded-xl pl-3 pr-1.5 py-1 text-[13px] text-[#343A40] shrink-0">
                                {displayName}
                                <button
                                  type="button"
                                  onClick={() => removeClient(realIndex)}
                                  className="text-[#6C757D] hover:text-red-600 ml-0.5 leading-none"
                                  aria-label="Remove"
                                >
                                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </span>
                              <input
                                type="text"
                                value={ticketEntry?.ticketNr ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setTicketNumbers((prev) => {
                                    const n = [...prev];
                                    if (n[idx]) n[idx] = { ...n[idx], ticketNr: v };
                                    else n[idx] = { clientId: client.id ?? null, clientName: client.name, ticketNr: v };
                                    return n;
                                  });
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
                  ) : (
                    /* Tour / other: PartySelect rows */
                    <div className="space-y-1.5">
                      {clients.map((client, index) => (
                        <div key={index} className="flex gap-1 items-center">
                          <div className="flex-1 min-w-0">
                            <PartySelect key={`client-${client.id || index}`} value={client.id} onChange={(id, name) => updateClient(index, id, name)} initialDisplayName={client.name} />
                          </div>
                          {clients.length > 1 && (
                            <button type="button" onClick={() => removeClient(index)} className="px-1.5 text-red-400 hover:text-red-600">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          )}
                        </div>
                      ))}
                      <button type="button" onClick={addClient} className="text-sm text-[#387ADF] hover:text-blue-800">+ Add</button>
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Payer</label>
                  <PartySelect
                    key={`payer-${payerPartyId || 'empty'}`}
                    value={payerPartyId}
                    onChange={(id, name) => { setPayerPartyId(id ?? null); setPayerName(name); }}
                    initialDisplayName={payerName}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="p-3 bg-white rounded-md border border-[#CED4DA] shadow-sm space-y-2">
                <h4 className="text-xs font-semibold text-[#343A40] uppercase tracking-wide">PRICING</h4>

                {/* Tour: Row1 Cost | Commission; Row2 Agent discount | Sale; Row3 Marge (calc) | VAT */}
                {categoryType === "tour" ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Cost ({currencySymbol})</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={priceUnits > 0 ? (parseFloat(servicePrice) / priceUnits) || "" : servicePrice}
                          onChange={(e) => {
                            pricingLastEditedRef.current = "cost";
                            const v = parseFloat(e.target.value) || 0;
                            setServicePrice(String(Math.round(v * priceUnits * 100) / 100));
                          }}
                          placeholder="0.00"
                          className={`w-full rounded-lg border px-2.5 py-1.5 text-sm focus:ring-1 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield] ${parseAttemptedButEmpty.has("servicePrice") ? "ring-2 ring-red-300 border-red-400 bg-red-50/50" : parsedFields.has("servicePrice") ? "ring-2 ring-green-300 border-green-400 focus:border-green-500 focus:ring-green-500" : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"}`}
                        />
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
                    <div className="grid grid-cols-2 gap-2">
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
                              setAgentDiscountValue(e.target.value);
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
                          value={priceUnits > 0 ? (parseFloat(clientPrice) / priceUnits) || "" : clientPrice}
                          onChange={(e) => {
                            if (service.invoice_id) return;
                            pricingLastEditedRef.current = "sale";
                            const v = parseFloat(e.target.value) || 0;
                            setClientPrice(String(Math.round(v * priceUnits * 100) / 100));
                          }}
                          placeholder="0.00"
                          disabled={!!service.invoice_id}
                          title={service.invoice_id ? "Amount is locked: service is on an invoice" : undefined}
                          className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">{(categoryType as string) === "hotel" ? "Nights" : "Units"}</label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={priceUnits}
                          onChange={(e) => {
                            const u = Math.max(1, Math.floor(Number(e.target.value) || 1));
                            const perSale = priceUnits > 0 ? (parseFloat(clientPrice) || 0) / priceUnits : 0;
                            const perCost = priceUnits > 0 ? (parseFloat(servicePrice) || 0) / priceUnits : 0;
                            if (!service.invoice_id) setClientPrice(String(Math.round(perSale * u * 100) / 100));
                            setServicePrice(String(Math.round(perCost * u * 100) / 100));
                            setPriceUnits(u);
                          }}
                          className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Marge ({currencySymbol})</label>
                        <input
                          type="text"
                          readOnly
                          value={marge}
                          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm text-gray-700"
                          aria-readonly
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
                  /* Flight: per-client Cost / Marge / Sale + Apply to all + Total Cost, Marge, Sale */
                  <div className="space-y-3">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
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
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={pricingPerClient[idx]?.cost ?? ""}
                                  onChange={(e) => {
                                    const costStr = e.target.value;
                                    const cost = parseFloat(costStr) || 0;
                                    const marge = parseFloat(pricingPerClient[idx]?.marge || "0") || 0;
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
                                  type="number"
                                  step="0.01"
                                  value={pricingPerClient[idx]?.marge ?? ""}
                                  onChange={(e) => {
                                    const margeStr = e.target.value;
                                    const cost = parseFloat(pricingPerClient[idx]?.cost || "0") || 0;
                                    const marge = parseFloat(margeStr) || 0;
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
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={pricingPerClient[idx]?.sale ?? ""}
                                  onChange={(e) => {
                                    if (service.invoice_id) return;
                                    const saleStr = e.target.value;
                                    const cost = parseFloat(pricingPerClient[idx]?.cost || "0") || 0;
                                    const sale = parseFloat(saleStr) || 0;
                                    const marge = Math.round((sale - cost) * 100) / 100;
                                    setPricingPerClient(prev => {
                                      const n = [...prev];
                                      if (!n[idx]) n[idx] = { cost: "", marge: "", sale: "" };
                                      n[idx] = { cost: pricingPerClient[idx]?.cost ?? "", marge: marge ? String(marge) : "", sale: saleStr };
                                      return n;
                                    });
                                  }}
                                  placeholder="0.00"
                                  disabled={!!service.invoice_id}
                                  title={service.invoice_id ? "Amount is locked: service is on an invoice" : undefined}
                                  className="w-full rounded border border-gray-300 px-2 py-1 text-right text-sm [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield] disabled:bg-gray-100 disabled:cursor-not-allowed"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex flex-wrap items-end gap-2 border-t border-gray-200 pt-2">
                      <span className="text-xs font-medium text-gray-600 mr-1">Apply to all:</span>
                      <input type="number" step="0.01" min="0" placeholder="Cost" id="edit-apply-cost"
                        className="w-20 rounded border border-gray-300 px-2 py-1 text-sm text-right [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]" />
                      <input type="number" step="0.01" placeholder="Marge" id="edit-apply-marge"
                        className="w-20 rounded border border-gray-300 px-2 py-1 text-sm text-right [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]" />
                      <input type="number" step="0.01" min="0" placeholder="Sale" id="edit-apply-sale"
                        className="w-20 rounded border border-gray-300 px-2 py-1 text-sm text-right [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]" />
                      <button
                        type="button"
                        onClick={() => {
                          const costEl = document.getElementById("edit-apply-cost") as HTMLInputElement;
                          const margeEl = document.getElementById("edit-apply-marge") as HTMLInputElement;
                          const saleEl = document.getElementById("edit-apply-sale") as HTMLInputElement;
                          const cost = costEl?.value ?? "";
                          const marge = margeEl?.value ?? "";
                          const sale = saleEl?.value ?? "";
                          setPricingPerClient(prev => prev.map(() => ({ cost, marge, sale })));
                        }}
                        className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Apply to all
                      </button>
                    </div>
                    {(() => {
                      const totalCost = pricingPerClient.reduce((s, p) => s + (parseFloat(p.cost) || 0), 0);
                      const totalMarge = pricingPerClient.reduce((s, p) => s + (parseFloat(p.marge) || 0), 0);
                      const totalSale = pricingPerClient.reduce((s, p) => s + (parseFloat(p.sale) || 0), 0);
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
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Cost ({currencySymbol})</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={priceUnits > 0 ? (parseFloat(servicePrice) / priceUnits) || "" : servicePrice}
                        onChange={(e) => {
                          pricingLastEditedRef.current = "cost";
                          const v = parseFloat(e.target.value) || 0;
                          setServicePrice(String(Math.round(v * priceUnits * 100) / 100));
                        }}
                        placeholder="0.00"
                        className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">{(categoryType as string) === "hotel" ? "Margin" : "Marge"} ({currencySymbol})</label>
                      <input
                        type="number"
                        step="0.01"
                        value={marge}
                        onChange={(e) => {
                          pricingLastEditedRef.current = "marge";
                          setMarge(e.target.value);
                        }}
                        placeholder="0.00"
                        className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Sale ({currencySymbol})</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={priceUnits > 0 ? (parseFloat(clientPrice) / priceUnits) || "" : clientPrice}
                        onChange={(e) => {
                          if (service.invoice_id) return;
                          pricingLastEditedRef.current = "sale";
                          const v = parseFloat(e.target.value) || 0;
                          setClientPrice(String(Math.round(v * priceUnits * 100) / 100));
                        }}
                        placeholder="0.00"
                        disabled={!!service.invoice_id}
                        title={service.invoice_id ? "Amount is locked: service is on an invoice" : undefined}
                        className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">{(categoryType as string) === "hotel" ? "Nights" : "Units"}</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={priceUnits}
                        onChange={(e) => {
                          const u = Math.max(1, Math.floor(Number(e.target.value) || 1));
                          const perCost = priceUnits > 0 ? (parseFloat(servicePrice) || 0) / priceUnits : 0;
                          const perSale = priceUnits > 0 ? (parseFloat(clientPrice) || 0) / priceUnits : 0;
                          setServicePrice(String(Math.round(perCost * u * 100) / 100));
                          if (!service.invoice_id) setClientPrice(String(Math.round(perSale * u * 100) / 100));
                          setPriceUnits(u);
                        }}
                        className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                      />
                    </div>
                  </div>
                )}

                {/* Margin / Profit for Tour */}
                {categoryType === "tour" && (parseFloat(marge) || 0) !== 0 && (() => {
                  const margin = parseFloat(marge) || 0;
                  const vatAmount = vatRate > 0 ? margin * vatRate / (100 + vatRate) : 0;
                  const profit = margin - vatAmount;
                  return (
                    <div className="text-xs font-medium pt-1 border-t border-gray-200">
                      {vatRate > 0 ? (
                        <>
                          <div className={margin >= 0 ? "text-green-600" : "text-red-600"}>
                            Margin: {currencySymbol}{margin.toFixed(2)}
                            <span className="text-gray-500 ml-1">(VAT: {currencySymbol}{vatAmount.toFixed(2)})</span>
                          </div>
                          <div className={margin >= 0 ? "text-green-700 font-semibold" : "text-red-600 font-semibold"}>
                            Profit: {currencySymbol}{profit.toFixed(2)}
                          </div>
                        </>
                      ) : (
                        <div className={margin >= 0 ? "text-green-700 font-semibold" : "text-red-600 font-semibold"}>
                          Profit: {currencySymbol}{margin.toFixed(2)}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {categoryType !== "tour" && (
                <div className="flex items-end gap-4 flex-wrap">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-0.5">VAT</label>
                    <select
                      value={vatRate}
                      onChange={(e) => setVatRate(Number(e.target.value))}
                      className="w-16 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      aria-label="VAT"
                    >
                      <option value={0}>0%</option>
                      <option value={21}>21%</option>
                    </select>
                  </div>
                  {(() => {
                    const marginPerUnit = parseFloat(marge) || 0;
                    const totalMargin = Math.round(marginPerUnit * priceUnits * 100) / 100;
                    const vatAmount = vatRate > 0 ? Math.round(totalMargin * vatRate / (100 + vatRate) * 100) / 100 : 0;
                    const profit = totalMargin - vatAmount;
                    return (
                      <div className="text-xs font-medium flex-1 pt-1 border-t border-gray-200 min-w-[140px]">
                        {vatRate > 0 ? (
                          <>
                            <div className={totalMargin >= 0 ? 'text-[#28A745]' : 'text-red-600'}>
                              Margin: {currencySymbol}{totalMargin.toFixed(2)}
                              {priceUnits > 1 && <span className="text-gray-500 ml-1">({marginPerUnit.toFixed(2)}×{priceUnits})</span>}
                              <span className="text-gray-500 ml-1">(VAT: {currencySymbol}{vatAmount.toFixed(2)})</span>
                            </div>
                            <div className={totalMargin >= 0 ? 'text-[#28A745] font-semibold' : 'text-red-600 font-semibold'}>
                              Profit: {currencySymbol}{profit.toFixed(2)}
                            </div>
                          </>
                        ) : (
                          <div className={totalMargin >= 0 ? 'text-[#28A745] font-semibold' : 'text-red-600 font-semibold'}>
                            Profit: {currencySymbol}{totalMargin.toFixed(2)}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
                )}
              </div>

              {/* REFERENCES — for tour/other (flight refs moved to PARTIES in left column) */}
              {categoryType !== "hotel" && categoryType !== "flight" && (
              <div className="p-3 bg-white rounded-md border border-[#CED4DA] shadow-sm space-y-2">
                <h4 className="text-xs font-semibold text-[#343A40] uppercase tracking-wide">REFERENCES</h4>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">
                    {categoryType === "tour" ? "Ref Nr (booking ref)" : "Ref Nr"}
                  </label>
                  <input
                    type="text"
                    value={refNr}
                    onChange={(e) => setRefNr(e.target.value)}
                    placeholder="Booking ref"
                    className={`w-full rounded-lg border px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 ${parseAttemptedButEmpty.has("refNr") ? "ring-2 ring-red-300 border-red-400 bg-red-50/50" : parsedFields.has("refNr") ? "ring-2 ring-green-300 border-green-400" : "border-gray-300 focus:border-blue-500"}`}
                  />
                </div>
                {showTicketNr && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-0.5">Ticket Nr</label>
                    <input
                      type="text"
                      value={ticketNr}
                      onChange={(e) => setTicketNr(e.target.value)}
                      placeholder="555-1234567890"
                      className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
              )}

              {/* Change/Cancel + Save/Close buttons for Flight */}
              {categoryType === "flight" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowChangeModal(true)}
                      className="flex-1 px-3 py-2 text-sm font-medium bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors flex items-center justify-center gap-2"
                      title="Request flight change"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Change
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCancelModal(true)}
                      className="flex-1 px-3 py-2 text-sm font-medium bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors flex items-center justify-center gap-2"
                      title="Cancel flight"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      Cancel
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      type="button" 
                      onClick={handleSave} 
                      disabled={isSubmitting} 
                      className="flex-1 px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        </>
                      ) : "Save Changes"}
                    </button>
                    <button 
                      type="button" 
                      onClick={onClose} 
                      disabled={isSubmitting} 
                      className="flex-1 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
              
              {/* Booking Terms (hidden for Flight) */}
              {categoryType !== "flight" && (
              <div className="p-3 bg-white rounded-md border border-[#CED4DA] shadow-sm space-y-2">
                <h4 className="text-xs font-semibold text-[#343A40] uppercase tracking-wide">Booking Terms</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Price Type - only for Tour, full width so "Early Booking (EBD)" is visible */}
                  {categoryType === "tour" && (
                    <div className="sm:col-span-2 min-w-0">
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Price Type</label>
                      <select
                        value={priceType}
                        onChange={(e) => setPriceType(e.target.value as "ebd" | "regular" | "spo")}
                        className="w-full min-w-[10rem] rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                      >
                        <option value="regular">Regular</option>
                        <option value="ebd">Early Booking (EBD)</option>
                        <option value="spo">Special Offer (SPO)</option>
                      </select>
                    </div>
                  )}
                  
                  {/* PAYMENT TERMS (Hotel) / Refund Policy - hidden for Tour */}
                  {categoryType === "hotel" && (
                    <div className="col-span-2 mt-2 pt-2 border-t border-gray-200">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">PAYMENT TERMS</h4>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5 mt-1">Refund Policy</label>
                      <select
                        value={refundPolicy}
                        onChange={(e) => setRefundPolicy(e.target.value as "non_ref" | "refundable" | "fully_ref")}
                        className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                        aria-label="Refund Policy"
                      >
                        <option value="non_ref">Non-refundable</option>
                        <option value="refundable">Refundable (with conditions)</option>
                        <option value="fully_ref">Fully Refundable</option>
                      </select>
                    </div>
                  )}
                  
                </div>
                
                {/* Cancellation/Refund details - hidden for Tour */}
                {categoryType !== "tour" && refundPolicy !== "non_ref" && (
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
                        onChange={(e) => setCancellationPenaltyAmount(e.target.value)}
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
                
                {/* Payment Deadlines - different for Flight vs Tour vs Other */}
                <div className="border-t border-gray-200 pt-2 mt-2">
                  {categoryType === "tour" ? (
                    // Tour: Deposit Due + %, Final Due + % — 2x2 grid so fields have enough width for date picker & numbers
                    <div className="grid grid-cols-2 gap-3">
                      <div className="min-w-0">
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Deposit Due</label>
                        <DateInput
                          value={paymentDeadlineDeposit}
                          onChange={setPaymentDeadlineDeposit}
                          className={`w-full min-w-[120px] rounded-lg border px-2.5 py-1.5 text-sm bg-white ${parseAttemptedButEmpty.has("paymentDeadlineDeposit") ? "ring-2 ring-red-300 border-red-400 bg-red-50/50" : parsedFields.has("paymentDeadlineDeposit") ? "ring-2 ring-green-300 border-green-400" : "border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"}`}
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Deposit %</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={depositPercent}
                          onChange={(e) => setDepositPercent(e.target.value)}
                          placeholder="10"
                          className={`w-full min-w-[4rem] rounded-lg border px-2.5 py-1.5 text-sm bg-white [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield] ${parseAttemptedButEmpty.has("depositPercent") ? "ring-2 ring-red-300 border-red-400 bg-red-50/50" : parsedFields.has("depositPercent") ? "ring-2 ring-green-300 border-green-400" : "border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"}`}
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Final Due</label>
                        <DateInput
                          value={paymentDeadlineFinal}
                          onChange={setPaymentDeadlineFinal}
                          className={`w-full min-w-[120px] rounded-lg border px-2.5 py-1.5 text-sm bg-white ${parseAttemptedButEmpty.has("paymentDeadlineFinal") ? "ring-2 ring-red-300 border-red-400 bg-red-50/50" : parsedFields.has("paymentDeadlineFinal") ? "ring-2 ring-green-300 border-green-400" : "border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"}`}
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Final %</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={finalPercent}
                          onChange={(e) => setFinalPercent(e.target.value)}
                          placeholder="90"
                          className={`w-full min-w-[4rem] rounded-lg border px-2.5 py-1.5 text-sm bg-white [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield] ${parseAttemptedButEmpty.has("finalPercent") ? "ring-2 ring-red-300 border-red-400 bg-red-50/50" : parsedFields.has("finalPercent") ? "ring-2 ring-green-300 border-green-400" : "border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"}`}
                        />
                      </div>
                    </div>
                  ) : categoryType === "hotel" ? (
                    // Hotel: single Payment Deadline (auto-set based on refund policy)
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Payment Deadline</label>
                      <DateInput
                        value={paymentDeadlineFinal}
                        onChange={setPaymentDeadlineFinal}
                        className="w-full rounded-lg border border-amber-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white"
                      />
                      {refundPolicy === "non_ref" && (
                        <span className="text-xs text-gray-500 mt-1 block">Auto-set to today for non-refundable</span>
                      )}
                      {refundPolicy === "refundable" && (
                        <span className="text-xs text-gray-500 mt-1 block">Auto-set to Free cancel until date</span>
                      )}
                    </div>
                  ) : (
                    // Other categories: single deadline
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Payment Deadline</label>
                      <DateInput
                        value={paymentDeadlineFinal}
                        onChange={setPaymentDeadlineFinal}
                        className="w-full rounded-lg border border-amber-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white"
                      />
                    </div>
                  )}
                </div>
              </div>
              )}
            </div>
            </RightWrapper>
            );
            })()}
          </div>

          {/* Flight Schedule rendered in left column (see flightScheduleBlock above) */}

          {showTransferFields && (
            <div className="mt-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200 space-y-3">
              <h4 className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Transfer Details</h4>

              {/* Row 1: Booking type (One Way / By the Hour) */}
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="transferBookingType" value="one_way" checked={transferBookingType === "one_way"} onChange={() => setTransferBookingType("one_way")} className="accent-emerald-600" />
                  <span className="text-sm">One way</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="transferBookingType" value="by_hour" checked={transferBookingType === "by_hour"} onChange={() => setTransferBookingType("by_hour")} className="accent-emerald-600" />
                  <span className="text-sm">By the hour</span>
                </label>
              </div>

              {/* Row 2: Mode, Vehicle class, Details */}
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
              {transferRoutes.map((route, idx) => (
                <div key={route.id} className="p-2 bg-white rounded-lg border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-emerald-600 uppercase">Route {idx + 1}</span>
                    {transferRoutes.length > 1 && (
                      <button type="button" onClick={() => removeTransferRoute(route.id)} className="text-red-400 hover:text-red-600 text-xs">Remove</button>
                    )}
                  </div>

                  {/* From */}
                  <div className="relative">
                    <label className="block text-[10px] font-medium text-gray-500 mb-0.5">From</label>
                    <input
                      type="text"
                      value={locationQuery[`${route.id}-pickup`] ?? route.pickup}
                      onChange={e => { handleLocationInput(`${route.id}-pickup`, e.target.value); updateRouteField(route.id, "pickup", e.target.value); }}
                      onFocus={() => setActiveLocationField(`${route.id}-pickup`)}
                      onBlur={() => setTimeout(() => setActiveLocationField(null), 200)}
                      placeholder="Airport, hotel, address..."
                      className="w-full rounded-lg border border-emerald-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
                    />
                    {activeLocationField === `${route.id}-pickup` && (locationResults[`${route.id}-pickup`] || []).length > 0 && (
                      <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {(locationResults[`${route.id}-pickup`] || []).map((s, i) => (
                          <button key={i} type="button" onMouseDown={() => selectLocation(route.id, "pickup", s)} className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 flex items-center gap-2">
                            <span className="text-[10px] font-medium text-gray-400 uppercase w-12 shrink-0">{s.type}</span>
                            <span className="truncate">{s.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* To (One Way) or Duration (By the Hour) */}
                  {transferBookingType === "one_way" ? (
                    <div className="relative">
                      <label className="block text-[10px] font-medium text-gray-500 mb-0.5">To</label>
                      <input
                        type="text"
                        value={locationQuery[`${route.id}-dropoff`] ?? route.dropoff}
                        onChange={e => { handleLocationInput(`${route.id}-dropoff`, e.target.value); updateRouteField(route.id, "dropoff", e.target.value); }}
                        onFocus={() => setActiveLocationField(`${route.id}-dropoff`)}
                        onBlur={() => setTimeout(() => setActiveLocationField(null), 200)}
                        placeholder="Airport, hotel, address..."
                        className="w-full rounded-lg border border-emerald-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
                      />
                      {activeLocationField === `${route.id}-dropoff` && (locationResults[`${route.id}-dropoff`] || []).length > 0 && (
                        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {(locationResults[`${route.id}-dropoff`] || []).map((s, i) => (
                            <button key={i} type="button" onMouseDown={() => selectLocation(route.id, "dropoff", s)} className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 flex items-center gap-2">
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

                  {/* Time + Distance/Duration row */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Pickup Time</label>
                      <input type="time" value={route.pickupTime || ""} onChange={e => updateRouteField(route.id, "pickupTime", e.target.value)} className="w-full rounded-lg border border-emerald-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white" />
                    </div>
                    {transferBookingType === "one_way" && (
                      <>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Distance</label>
                          <div className="px-2.5 py-1.5 text-sm text-gray-600 bg-gray-50 rounded-lg border border-gray-200">
                            {route.distanceKm != null ? `~${route.distanceKm} km` : "—"}
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Est. Duration</label>
                          <div className="px-2.5 py-1.5 text-sm text-gray-600 bg-gray-50 rounded-lg border border-gray-200">
                            {route.durationMin != null ? (route.durationMin >= 60 ? `~${Math.floor(route.durationMin / 60)}h ${route.durationMin % 60}min` : `~${route.durationMin} min`) : "—"}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Linked flight */}
                  {flightServices.length > 0 && (
                    <div>
                      <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Flight Number</label>
                      <select value={route.linkedFlightId || ""} onChange={e => { const fid = e.target.value || undefined; updateRouteField(route.id, "linkedFlightId", fid); if (fid) suggestPickupTime(route.id, fid); }} className="w-full rounded-lg border border-emerald-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white">
                        <option value="">No linked flight</option>
                        {flightServices.map(f => {
                          const segs = f.flightSegments || [];
                          const label = segs.length > 0
                            ? segs.map(s => { const r = s as unknown as Record<string, string>; return `${r.flightNumber || ""} ${r.departureCity || ""}→${r.arrivalCity || ""}`; }).join(", ")
                            : f.name;
                          return <option key={f.id} value={f.id}>{label}</option>;
                        })}
                      </select>
                      {route.linkedFlightId && route.pickupTime && (
                        <p className="text-[10px] text-emerald-600 mt-0.5">
                          {(route.pickupMeta?.iata || route.pickupType === "airport") ? "Pickup ~45 min after arrival" : `Be at airport 2h before departure (pickup ${route.pickupTime})`}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}

              <button type="button" onClick={addTransferRoute} className="text-sm text-emerald-600 hover:text-emerald-800 font-medium">
                + Add route
              </button>

              {/* Chauffeur & Driver info */}
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

          {/* Actions - Sticky Footer (hidden for Hotel and Flight — buttons are in right column) */}
          {categoryType !== "hotel" && categoryType !== "flight" && (
            <div className="mt-4 pt-3 border-t flex justify-end gap-2">
              <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={handleSave} disabled={isSubmitting} className="px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : "Save Changes"}
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Change Service Modal */}
      {showChangeModal && (
        <ChangeServiceModal
          service={{
            id: service.id,
            name: serviceName,
            category: category,
            servicePrice: parseFloat(servicePrice) || 0,
            clientPrice: parseFloat(clientPrice) || 0,
            resStatus: resStatus,
            refNr: refNr,
            dateFrom: dateFrom,
            dateTo: dateTo,
            supplier: supplierName,
            supplierPartyId: supplierPartyId,
            clientPartyId: clients.find(c => c.id)?.id || null,
            payerPartyId: payerPartyId,
            flightSegments: flightSegments,
            cabinClass: cabinClass,
            baggage: baggage,
          }}
          orderCode={orderCode}
          onClose={() => setShowChangeModal(false)}
          onChangeConfirmed={() => {
            setShowChangeModal(false);
            // Refresh service data - status will be updated by the modal
            onServiceUpdated({
              id: service.id,
              resStatus: 'changed',
            });
            // Close edit modal to refresh
            onClose();
          }}
        />
      )}
      
      {/* Cancel Service Modal */}
      {showCancelModal && (
        <CancelServiceModal
          service={{
            id: service.id,
            name: serviceName,
            category: category,
            servicePrice: parseFloat(servicePrice) || 0,
            clientPrice: parseFloat(clientPrice) || 0,
            resStatus: resStatus,
            refNr: refNr,
            dateFrom: dateFrom,
            dateTo: dateTo,
            supplier: supplierName,
            supplierPartyId: supplierPartyId,
            clientPartyId: clients.find(c => c.id)?.id || null,
            payerPartyId: payerPartyId,
            flightSegments: flightSegments,
          }}
          orderCode={orderCode}
          onClose={() => setShowCancelModal(false)}
          onCancellationConfirmed={() => {
            setShowCancelModal(false);
            // Refresh service data - status will be updated by the modal
            onServiceUpdated({
              id: service.id,
              resStatus: 'cancelled',
            });
            // Close edit modal to refresh
            onClose();
          }}
        />
      )}
      {showAddAccompanyingModal && (categoryType === "flight" || categoryType === "hotel") && (
        <AddAccompanyingModal
          orderCode={orderCode}
          existingClientIds={clients.filter(c => c.id).map(c => c.id)}
          onAddClients={(toAdd) => {
            const newOnes = toAdd.filter(nc => !clients.some(c => c.id === nc.id));
            setClients(prev => {
              const existing = prev.filter(c => c.id || c.name);
              const next = [...existing, ...newOnes];
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
