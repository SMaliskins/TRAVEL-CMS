"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import PartySelect from "@/components/PartySelect";
import DateRangePicker from "@/components/DateRangePicker";
import HotelSuggestInput from "@/components/HotelSuggestInput";
import ClientMultiSelectDropdown from "@/components/ClientMultiSelectDropdown";
import { FlightSegment } from "@/components/FlightItineraryInput";
import { parseFlightBooking, getAirportTimezoneOffset } from "@/lib/flights/airlineParsers";
import { useEscapeKey } from '@/lib/hooks/useEscapeKey';
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import type { SupplierCommission } from "@/lib/types/directory";

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
  onClose: () => void;
  onServiceAdded: (service: ServiceData) => void;
}

// Functional types that determine which features are available
type CategoryType = 'flight' | 'hotel' | 'transfer' | 'tour' | 'insurance' | 'visa' | 'rent_a_car' | 'cruise' | 'other';

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
  // Transfer-specific
  pickupLocation?: string;
  dropoffLocation?: string;
  pickupTime?: string;
  estimatedDuration?: string;
  linkedFlightId?: string;
  // Flight-specific
  flightSegments?: FlightSegment[];
  boardingPasses?: { id: string; fileName: string; fileUrl: string; clientId: string; clientName: string; uploadedAt: string }[];
  baggage?: string; // Baggage allowance
  cabinClass?: "economy" | "premium_economy" | "business" | "first";
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
  onClose, 
  onServiceAdded 
}: AddServiceModalProps) {
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
  const [serviceName, setServiceName] = useState("");
  const [dateFrom, setDateFrom] = useState<string | undefined>(orderDateFrom || undefined);
  const [dateTo, setDateTo] = useState<string | undefined>(orderDateTo || undefined);
  const [supplierPartyId, setSupplierPartyId] = useState<string | null>(null);
  const [supplierName, setSupplierName] = useState("");
  
  // Multiple clients support
  interface ClientEntry {
    id: string | null;
    name: string;
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
  
  const [payerPartyId, setPayerPartyId] = useState<string | null>(defaultClientId || null);
  const [payerName, setPayerName] = useState(defaultClientName || "");
  const [servicePrice, setServicePrice] = useState("");
  const [marge, setMarge] = useState("");
  const [clientPrice, setClientPrice] = useState("");
  // Tour (Package Tour) pricing: commission from Supplier settings, agent discount (% or €)
  const [supplierCommissions, setSupplierCommissions] = useState<SupplierCommission[]>([]);
  const [selectedCommissionIndex, setSelectedCommissionIndex] = useState<number>(-1);
  const [agentDiscountValue, setAgentDiscountValue] = useState("");
  const [agentDiscountType, setAgentDiscountType] = useState<"%" | "€">("%");
  
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
  const [ticketNr, setTicketNr] = useState(""); // Legacy single ticket
  // Ticket numbers per client (for Flights)
  const [ticketNumbers, setTicketNumbers] = useState<{ clientId: string; clientName: string; ticketNr: string }[]>([]);
  
  // Hotel-specific fields
  const [hotelName, setHotelName] = useState("");
  const [hotelAddress, setHotelAddress] = useState("");
  const [hotelPhone, setHotelPhone] = useState("");
  const [hotelEmail, setHotelEmail] = useState("");
  const [hotelBedType, setHotelBedType] = useState<"king_queen" | "twin" | "not_guaranteed">("not_guaranteed");
  const [hotelPreferences, setHotelPreferences] = useState({
    earlyCheckIn: false,
    lateCheckIn: false,
    higherFloor: false,
    kingSizeBed: false,
    honeymooners: false,
    silentRoom: false,
    roomsNextTo: "",
    parking: false,
    freeText: "",
  });
  const [supplierBookingType, setSupplierBookingType] = useState<"gds" | "direct">("gds");
  
  // Transfer-specific fields
  const [pickupLocation, setPickupLocation] = useState("");
  const [dropoffLocation, setDropoffLocation] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [estimatedDuration, setEstimatedDuration] = useState("");
  const [linkedFlightId, setLinkedFlightId] = useState<string | null>(null);
  
  // Flight-specific fields
  const [flightSegments, setFlightSegments] = useState<FlightSegment[]>([]);
  const [showPasteInput, setShowPasteInput] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [isAIParsing, setIsAIParsing] = useState(false);
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
  /** Meal types from Ratehawk for selected hotel — click to choose */
  const [hotelMealOptions, setHotelMealOptions] = useState<string[]>([]);
  const [mealPlanText, setMealPlanText] = useState("");
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
  const [baggage, setBaggage] = useState<string>(""); // Baggage allowance

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

  // Load supplier commissions only on dropdown open (lazy), not on supplier change
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
        setSelectedCommissionIndex((prev) => (prev < 0 ? 0 : prev));
      }
    } catch {}
  }, [categoryType, supplierPartyId]);

  useEffect(() => {
    if (categoryType !== "tour" || !supplierPartyId) {
      setSupplierCommissions([]);
      setSelectedCommissionIndex(-1);
    } else {
      loadSupplierCommissions();
    }
  }, [categoryType, supplierPartyId, loadSupplierCommissions]);

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
  
  // Sync ticketNumbers with clients for Flight
  useEffect(() => {
    if (categoryType === "flight") {
      const validClients = clients.filter(c => c.id && c.name);
      setTicketNumbers(prev => {
        // Update ref with current values before change
        prev.forEach((t, i) => {
          if (t.ticketNr) {
            ticketNumbersRef.current[i] = t.ticketNr;
          }
        });
        
        // Build new array preserving ticket numbers by index
        const newTickets = validClients.map((client, index) => {
          // First try to find by clientId
          const existingById = prev.find(t => t.clientId === client.id);
          // Get ticket from: 1) existing by ID, 2) previous at same index, 3) ref at same index
          const ticketNr = existingById?.ticketNr || prev[index]?.ticketNr || ticketNumbersRef.current[index] || "";
          
          return { 
            clientId: client.id!, 
            clientName: client.name, 
            ticketNr
          };
        });
        return newTickets;
      });
    }
  }, [clients, category]);

  // Commission amount in € from selected commission (Tour): Cost * rate / 100
  const getCommissionAmount = (cost: number): number => {
    if (categoryType !== "tour" || selectedCommissionIndex < 0 || !supplierCommissions[selectedCommissionIndex]) return 0;
    const rate = supplierCommissions[selectedCommissionIndex].rate;
    if (rate == null || rate <= 0) return 0;
    return Math.round((cost * rate / 100) * 100) / 100;
  };

  // Agent discount amount in € (Tour)
  const getAgentDiscountAmount = (cost: number): number => {
    if (categoryType !== "tour") return 0;
    const val = parseFloat(agentDiscountValue) || 0;
    if (val <= 0) return 0;
    if (agentDiscountType === "%") return Math.round((cost * val / 100) * 100) / 100;
    return Math.round(val * 100) / 100;
  };

  // Tour: recalc only when user edits Pricing; skip on open (ref === null)
  useEffect(() => {
    if (categoryType !== "tour") return;
    if (!pricingLastEditedRef.current) return;
    const cost = Math.round((parseFloat(servicePrice) || 0) * 100) / 100;
    const commissionAmount = getCommissionAmount(cost);
    if (pricingLastEditedRef.current === "sale") {
      const saleVal = Math.round((parseFloat(clientPrice) || 0) * 100) / 100;
      if (saleVal < cost) {
        const agentDiscountAmount = Math.round((cost - saleVal) * 100) / 100;
        setAgentDiscountType("€");
        setAgentDiscountValue(agentDiscountAmount.toFixed(2));
        const margeCalculated = Math.round(((cost - agentDiscountAmount) - (cost - commissionAmount)) * 100) / 100;
        setMarge(margeCalculated.toFixed(2));
        return;
      }
      setAgentDiscountType("€");
      setAgentDiscountValue("0");
      setMarge(commissionAmount.toFixed(2));
      return;
    }
    const discountAmount = getAgentDiscountAmount(cost);
    const margeCalculated = Math.round(((cost - discountAmount) - (cost - commissionAmount)) * 100) / 100;
    const saleCalculated = Math.round((cost - discountAmount) * 100) / 100;
    setMarge(margeCalculated.toFixed(2));
    // At this point we already returned when lastEdited === "sale", so update clientPrice and clear ref
    setClientPrice(saleCalculated.toFixed(2));
    pricingLastEditedRef.current = null;
  }, [categoryType, servicePrice, selectedCommissionIndex, supplierCommissions, agentDiscountValue, agentDiscountType, clientPrice]);

  // Auto-calculate logic for non-Tour: Cost, Marge, and Sale
  useEffect(() => {
    if (categoryType === "tour") return;

    const cost = Math.round((parseFloat(servicePrice) || 0) * 100) / 100;
    const margeVal = Math.round((parseFloat(marge) || 0) * 100) / 100;
    const saleVal = Math.round((parseFloat(clientPrice) || 0) * 100) / 100;

    // Non-tour: Sale = Cost + Marge
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
  
  // Reset to draft when category changes to Flight/Hotel
  useEffect(() => {
    if ((categoryType === "flight" || categoryType === "hotel") && resStatus === "booked") {
      setResStatus("draft");
    }
  }, [category]);

  // ESC key handler
  useEscapeKey(onClose);
  
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
    if (clients.length <= 1) return; // Keep at least one client
    setClients(clients.filter((_, i) => i !== index));
  };

  // Determine which fields to show based on category
  const showTicketNr = categoryType === "flight";
  const showHotelFields = categoryType === "hotel";
  const showTransferFields = categoryType === "transfer";
  
  // Auto-generate service name (route) from flight segments
  useEffect(() => {
    if (categoryType === "flight" && flightSegments.length > 0) {
      // Build route string: group by day and show route
      // e.g., "25.01 TLL-FRA-NCE / 02.02 NCE-FRA-TLL"
      const groupedByDate: Record<string, FlightSegment[]> = {};
      
      flightSegments.forEach(seg => {
        const date = seg.departureDate || "unknown";
        if (!groupedByDate[date]) groupedByDate[date] = [];
        groupedByDate[date].push(seg);
      });
      
      const routeParts = Object.entries(groupedByDate).map(([date, segs]) => {
        // Format date as DD.MM
        const d = new Date(date + "T00:00:00");
        const dateStr = isNaN(d.getTime()) ? "" : `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
        
        // Build route for this day: DEP1-ARR1-ARR2...
        const cities = segs.map(s => s.departure).concat(segs[segs.length - 1]?.arrival || "").filter(Boolean);
        const routeStr = cities.join("-");
        
        return dateStr ? `${dateStr} ${routeStr}` : routeStr;
      });
      
      const newRoute = routeParts.join(" / ");
      if (newRoute && newRoute !== serviceName) {
        setServiceName(newRoute);
      }
      
      // Auto-set dates from segments
      const firstDep = flightSegments[0]?.departureDate;
      const lastArr = flightSegments[flightSegments.length - 1]?.arrivalDate || firstDep;
      if (firstDep && !dateFrom) {
        setDateFrom(firstDep);
      }
      if (lastArr && !dateTo) {
        setDateTo(lastArr);
      }
    }
  }, [flightSegments, category, dateFrom, dateTo]); // removed serviceName from deps to allow auto-update

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
        cabinClass: result.booking.cabinClass,
        refundPolicy: result.booking.refundPolicy,
        baggage: result.booking.baggage,
      },
      parser: result.parser,
    };
  };
  
  // Apply parsed data to form
  const applyParsedData = (segments: FlightSegment[], booking: Record<string, unknown>) => {
    // Fill form fields from booking info
    if (booking.bookingRef) setRefNr(booking.bookingRef as string);
    if (booking.airline) setSupplierName(booking.airline as string);
    if (booking.totalPrice) {
      setClientPrice(String(booking.totalPrice));
      setServicePrice(String(booking.totalPrice));
    }
    if (booking.cabinClass) {
      const validClasses = ["economy", "premium_economy", "business", "first"];
      if (validClasses.includes(booking.cabinClass as string)) {
        setCabinClass(booking.cabinClass as "economy" | "premium_economy" | "business" | "first");
      }
    }
    if (booking.baggage) {
      setBaggage(booking.baggage as string);
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
    
    // Handle ticket numbers
    const ticketNumbers = booking.ticketNumbers as string[] | undefined;
    if (ticketNumbers && ticketNumbers.length > 0) {
      const firstTicket = ticketNumbers[0];
      if (firstTicket) {
        setTicketNr(firstTicket);
        if (clients[0]?.id) {
          setTicketNumbers([{ clientId: clients[0].id, clientName: clients[0].name, ticketNr: firstTicket }]);
          ticketNumbersRef.current[0] = firstTicket;
        }
      }
    }
    
    setFlightSegments(segments);
    
    // Set dates
    if (segments[0]?.departureDate) {
      setDateFrom(segments[0].departureDate);
    }
    if (segments.length > 0) {
      const lastSeg = segments[segments.length - 1];
      setDateTo(lastSeg.arrivalDate || lastSeg.departureDate);
    }
    
    // Auto-confirm if we have ticket numbers
    if (ticketNumbers && ticketNumbers.length > 0) {
      setResStatus("confirmed");
    }
    
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
    
    // Check if it's a PDF or text file
    if (fileName.endsWith('.pdf')) {
      setIsLoadingPdf(true);
      setParseError(null);
      
      try {
        // Send to API to extract text from PDF
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
      // Read text file directly
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
  
  // Parse pasted flight booking text - regex only (no AI)
  const handleParseFlight = () => {
    if (!pasteText.trim()) return;
    
    setParseError(null);
    const text = pasteText.trim();
    
    // Parse with regex (Amadeus ITR format works for all airlines)
    const regexResult = parseWithRegex(text);
    if (regexResult && regexResult.segments.length > 0) {
      applyParsedData(regexResult.segments, regexResult.booking);
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
    
    // Show error if parsing failed
    setParseError("Could not parse this booking. Best results with Amadeus ITR format. Try copying the full booking confirmation text.");
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
      setFlightSegments(segs.map((s, i) => ({
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
        departureStatus: "scheduled",
        arrivalStatus: "scheduled",
      })));
      fields.add("flightSegments");
      // Dates from flight segments when not already set from accommodation
      if (segs.length > 0) {
        const first = segs[0];
        const last = segs[segs.length - 1];
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
              if (clientEntries.length === 1) {
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
    
    if (!serviceName.trim()) {
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
        categoryId, // UUID reference to travel_service_categories
        serviceName: serviceName.trim(),
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
        servicePrice: parseFloat(servicePrice) || 0,
        clientPrice: parseFloat(clientPrice) || 0,
        vatRate,
        resStatus,
        refNr,
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
        payload.hotelAddress = hotelAddress || null;
        payload.hotelPhone = hotelPhone || null;
        payload.hotelEmail = hotelEmail || null;
        payload.hotelRoom = hotelRoom || null;
        payload.hotelBoard = hotelBoard || null;
        payload.hotelBedType = hotelBedType || null;
        payload.hotelEarlyCheckIn = hotelPreferences.earlyCheckIn;
        payload.hotelLateCheckIn = hotelPreferences.lateCheckIn;
        payload.hotelHigherFloor = hotelPreferences.higherFloor;
        payload.hotelKingSizeBed = hotelPreferences.kingSizeBed;
        payload.hotelHoneymooners = hotelPreferences.honeymooners;
        payload.hotelSilentRoom = hotelPreferences.silentRoom;
        payload.hotelRoomsNextTo = hotelPreferences.roomsNextTo || null;
        payload.hotelParking = hotelPreferences.parking;
        payload.hotelPreferencesFreeText = hotelPreferences.freeText || null;
        payload.supplierBookingType = supplierBookingType || null;
      }
      
      // Add transfer-specific fields
      if (showTransferFields) {
        payload.pickupLocation = pickupLocation;
        payload.dropoffLocation = dropoffLocation;
        payload.pickupTime = pickupTime;
        payload.estimatedDuration = estimatedDuration;
        payload.linkedFlightId = linkedFlightId;
      }
      
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

      // Tour (Package Tour): hotel fields + commission + agent discount
      if (categoryType === "tour") {
        payload.hotelName = hotelName || null;
        payload.hotelStarRating = hotelStarRating || null;
        payload.hotelRoom = hotelRoom || null;
        payload.hotelBoard = hotelBoard || null;
        payload.mealPlanText = mealPlanText?.trim() || null;
        payload.transferType = transferType?.trim() || null;
        payload.additionalServices = additionalServices?.trim() || null;
        const comm = selectedCommissionIndex >= 0 ? supplierCommissions[selectedCommissionIndex] : null;
        payload.commissionName = comm?.name ?? null;
        payload.commissionRate = comm?.rate ?? null;
        const cost = parseFloat(servicePrice) || 0;
        payload.commissionAmount = comm?.rate != null && comm.rate > 0 ? Math.round((cost * comm.rate / 100) * 100) / 100 : null;
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
        onServiceAdded(data.service);
        onClose();
      } else {
        const errData = await response.json().catch(() => ({}));
        setError(errData.error || "Failed to create service");
      }
    } catch (err) {
      console.error("Create service error:", err);
      setError("Network error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const RightWrapper = categoryType === "hotel" ? "div" : React.Fragment;
  const rightWrapperProps = categoryType === "hotel" ? { className: "md:col-span-1 space-y-3" as const } : {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl">
        {/* Compact Header */}
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
              <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-gray-900">
              Add Service{category ? ` — ${category}` : ""}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Paste & Parse for Flight or Tour */}
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
                  if (f && (f.type === "application/pdf" || f.name?.toLowerCase().endsWith(".pdf") || f.name?.toLowerCase().endsWith(".txt") || f.name?.toLowerCase().endsWith(".eml"))) {
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
                      📋 Paste & Parse
                    </div>
                    <span className="text-xs text-gray-400">or drop PDF / TXT file, Ctrl+V to paste</span>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-xs text-blue-600 font-medium mb-1">
                  Paste Amadeus ITR or airline confirmation
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
                    disabled={!pasteText.trim()}
                    className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    📋 Parse
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowPasteInput(false); setPasteText(""); setParseError(null); }}
                    className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-900"
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
                      <span className="text-sm text-gray-600">Drop PDF/image, Ctrl+V to paste, or click to parse Tour Package</span>
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

        <form onSubmit={handleSubmit} className="p-4">
          {error && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Main Grid - 3 columns; for Hotel: left 2/3 = Hotel Details (with Dates), right 1/3 = Parties + Pricing */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            
            {/* Column 1: For Hotel = Hotel Details (2/3) with Hotel Name, then Dates; else Basic Info */}
            <div className={`space-y-3 ${categoryType === "hotel" ? "md:col-span-2" : ""}`}>
              {categoryType === "hotel" ? (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-3">
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
                        setHotelMealOptions(d.mealOptions ?? []);
                      }}
                      placeholder="Search hotel by name..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-0.5">Dates</label>
                    <DateRangePicker
                      label=""
                      from={dateFrom}
                      to={dateTo}
                      onChange={(from, to) => { setDateFrom(from); setDateTo(to); }}
                      triggerClassName="border-amber-300"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Room</label>
                      <input
                        type="text"
                        list="add-hotel-room-datalist"
                        value={hotelRoom}
                        onChange={(e) => setHotelRoom(e.target.value)}
                        placeholder="Room type (or choose from hotel)"
                        title={hotelRoom || undefined}
                        className="w-full rounded-lg border border-amber-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white"
                      />
                      {hotelRoomOptions.length > 0 && (
                        <>
                          <p className="text-xs text-amber-600 mb-1 mt-0.5">From hotel: {hotelRoomOptions.map((opt) => (
                            <button key={opt} type="button" onClick={() => setHotelRoom(opt)} title={opt} className="mr-1.5 mt-0.5 px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 truncate max-w-[120px] inline-block align-middle" style={{ maxWidth: "120px" }}>{opt}</button>
                          ))}</p>
                          <datalist id="add-hotel-room-datalist">
                            {hotelRoomOptions.map((opt) => (
                              <option key={opt} value={opt} />
                            ))}
                          </datalist>
                        </>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Board</label>
                      {hotelMealOptions.length > 0 && (
                        <p className="text-xs text-amber-600 mb-1">From hotel: {hotelMealOptions.map((meal) => (
                          <button key={meal} type="button" onClick={() => setHotelBoard(mapRatehawkMealToBoard(meal))} title={meal} className="mr-1.5 px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 truncate max-w-[120px] inline-block align-middle" style={{ maxWidth: "120px" }}>{meal}</button>
                        ))}</p>
                      )}
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
                        <input type="checkbox" checked={hotelPreferences.earlyCheckIn} onChange={(e) => setHotelPreferences(prev => ({ ...prev, earlyCheckIn: e.target.checked }))} className="rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                        Early check-in
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-gray-700">
                        <input type="checkbox" checked={hotelPreferences.lateCheckIn} onChange={(e) => setHotelPreferences(prev => ({ ...prev, lateCheckIn: e.target.checked }))} className="rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                        Late check-in
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-gray-700">
                        <input type="checkbox" checked={hotelPreferences.higherFloor} onChange={(e) => setHotelPreferences(prev => ({ ...prev, higherFloor: e.target.checked }))} className="rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                        Higher floor
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-gray-700">
                        <input type="checkbox" checked={hotelPreferences.kingSizeBed} onChange={(e) => setHotelPreferences(prev => ({ ...prev, kingSizeBed: e.target.checked }))} className="rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                        King size bed
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-gray-700">
                        <input type="checkbox" checked={hotelPreferences.honeymooners} onChange={(e) => setHotelPreferences(prev => ({ ...prev, honeymooners: e.target.checked }))} className="rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                        Honeymooners
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-gray-700">
                        <input type="checkbox" checked={hotelPreferences.silentRoom} onChange={(e) => setHotelPreferences(prev => ({ ...prev, silentRoom: e.target.checked }))} className="rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                        Silent room
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-gray-700">
                        <input type="checkbox" checked={hotelPreferences.parking} onChange={(e) => setHotelPreferences(prev => ({ ...prev, parking: e.target.checked }))} className="rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                        Parking
                      </label>
                    </div>
                    <div className="mb-2">
                      <input type="text" value={hotelPreferences.roomsNextTo} onChange={(e) => setHotelPreferences(prev => ({ ...prev, roomsNextTo: e.target.value }))} placeholder="Rooms next to..." className="w-full rounded-lg border border-amber-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white" />
                    </div>
                    <div>
                      <textarea value={hotelPreferences.freeText} onChange={(e) => setHotelPreferences(prev => ({ ...prev, freeText: e.target.value }))} placeholder="Additional preferences (free text)" rows={2} className="w-full rounded-lg border border-amber-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white" />
                    </div>
                    <button type="button" onClick={() => { const preferencesList = Object.entries(hotelPreferences).filter(([key, value]) => key !== "roomsNextTo" && key !== "freeText" && value === true).map(([key]) => key.replace(/([A-Z])/g, " $1").toLowerCase()).join(", "); const message = `We have a reservation for ${hotelName}. Please confirm the reservation exists and consider the following preferences:\n\nRoom: ${hotelRoom || "Not specified"}\nBoard: ${hotelBoard}\nBed Type: ${hotelBedType}\nPreferences: ${preferencesList || "None"}${hotelPreferences.roomsNextTo ? `\nRooms next to: ${hotelPreferences.roomsNextTo}` : ""}${hotelPreferences.freeText ? `\nAdditional: ${hotelPreferences.freeText}` : ""}`; alert(`Message to hotel:\n\n${message}\n\n(Will be saved to Communication tab)`); }} className="w-full px-3 py-2 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors">📧 Send to Hotel</button>
                  </div>
                </div>
              ) : (
              <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Basic Info</h4>
                
                {!categoryLocked && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Category *</label>
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
                
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">
                    {categoryType === "flight" ? "Route *" : categoryType === "tour" ? "Direction" : "Name *"}
                  </label>
                  <input
                    type="text"
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    placeholder={categoryType === "flight" ? "RIX - FRA - NCE / NCE - FRA - RIX" : categoryType === "tour" ? "RIX-AYT 19.09-27.09" : "Description"}
                    className={`w-full rounded-lg border px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 ${categoryType === "tour" && parseAttemptedButEmpty.has("serviceName") ? "ring-2 ring-red-300 border-red-400 bg-red-50/50" : categoryType === "tour" && parsedFields.has("serviceName") ? "ring-2 ring-green-300 border-green-400" : "border-gray-300 focus:border-blue-500"}`}
                  />
                </div>

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
                
                {/* Tour: Hotel + Stars in one row */}
                {categoryType === "tour" && (
                  <div className="grid grid-cols-[1fr_4rem] gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Hotel</label>
                      <input
                        type="text"
                        value={hotelName}
                        onChange={(e) => setHotelName(e.target.value)}
                        placeholder="Hotel name"
                        className={`w-full rounded-lg border px-2.5 py-1.5 text-sm bg-white ${parseAttemptedButEmpty.has("hotelName") ? "ring-2 ring-red-300 border-red-400 bg-red-50/50" : parsedFields.has("hotelName") ? "ring-2 ring-green-300 border-green-400" : "border-gray-300 focus:border-blue-500 focus:ring-1"}`}
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
                
                {/* Cabin Class + Change Fee - for Flight in main section */}
                {categoryType === "flight" ? (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Cabin Class</label>
                      <select
                        value={cabinClass}
                        onChange={(e) => setCabinClass(e.target.value as "economy" | "premium_economy" | "business" | "first")}
                        className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                      >
                        <option value="economy">Economy</option>
                        <option value="premium_economy">Premium Economy</option>
                        <option value="business">Business</option>
                        <option value="first">First</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Change Fee €</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={changeFee}
                        onChange={(e) => setChangeFee(e.target.value)}
                        placeholder="0 = free"
                        className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                      />
                      <span className="text-[10px] text-gray-400">+ class diff</span>
                    </div>
                  </>
                ) : (
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
                )}
              </div>
              )}
            </div>

            {/* Right side: Parties + Pricing (when Hotel: one column 1/3) */}
            <RightWrapper {...rightWrapperProps}>
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Parties</h4>
                
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Supplier</label>
                  {categoryType === "hotel" ? (
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-0.5">Booking Type</label>
                        <select
                          value={supplierBookingType}
                          onChange={(e) => {
                            const newType = e.target.value as "gds" | "direct";
                            setSupplierBookingType(newType);
                            if (newType === "direct" && hotelName.trim()) {
                              setSupplierName(hotelName.trim());
                            }
                          }}
                          className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                        >
                          <option value="gds">GDS</option>
                          <option value="direct">Direct booking</option>
                        </select>
                      </div>
                      {supplierBookingType === "direct" ? (
                        <div className="flex gap-1">
                          <div className="flex-1">
                            <PartySelect
                              value={supplierPartyId}
                              onChange={(id, name) => { setSupplierPartyId(id); setSupplierName(name); }}
                              roleFilter="supplier"
                              initialDisplayName={supplierName || hotelName}
                            />
                          </div>
                          {!supplierPartyId && hotelName.trim() && (
                            <button
                              type="button"
                              onClick={() => alert(`Add "${hotelName}" to directory as supplier?`)}
                              className="px-2 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                              title="Add supplier to directory"
                            >
                              +
                            </button>
                          )}
                        </div>
                      ) : (
                        <PartySelect
                          value={supplierPartyId}
                          onChange={(id, name) => { setSupplierPartyId(id); setSupplierName(name); }}
                          roleFilter="supplier"
                          initialDisplayName={supplierName}
                        />
                      )}
                    </div>
                  ) : (
                    <div className={categoryType === "tour" ? (parseAttemptedButEmpty.has("supplierName") ? "ring-2 ring-red-300 border-red-400 rounded-lg p-0.5 -m-0.5 bg-red-50/50" : parsedFields.has("supplierName") ? "ring-2 ring-green-300 border-green-400 rounded-lg p-0.5 -m-0.5" : "") : undefined}>
                      <PartySelect
                        value={supplierPartyId}
                        onChange={(id, name) => { setSupplierPartyId(id); setSupplierName(name); }}
                        roleFilter="supplier"
                        initialDisplayName={supplierName}
                      />
                    </div>
                  )}
                </div>
                
                <div className={categoryType === "tour" ? (parseAttemptedButEmpty.has("clients") ? "ring-2 ring-red-300 border-red-400 rounded-lg p-0.5 -m-0.5 bg-red-50/50" : parsedFields.has("clients") ? "ring-2 ring-green-300 border-green-400 rounded-lg p-0.5 -m-0.5" : "") : undefined}>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="text-xs font-medium text-gray-600">Client{clients.length > 1 ? "s" : ""}</label>
                    <ClientMultiSelectDropdown
                      onAddClients={(toAdd) => setClients(prev => {
                        const existing = prev.filter(c => c.id);
                        const next = [...existing, ...toAdd];
                        return next.length > 0 ? next : [{ id: null, name: "" }];
                      })}
                      existingClientIds={clients.map(c => c.id).filter((id): id is string => id !== null)}
                    />
                  </div>
                  {/* Selected clients as chips (default from order + added from directory dropdown) */}
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {clients.filter(c => c.id || c.name).map((client, index) => {
                      const ticket = ticketNumbers.find(t => t.clientId === client.id);
                      const displayName = client.name || (index === 0 ? defaultClientName : "") || "-";
                      return (
                        <div key={client.id || index} className="flex items-center gap-1">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-md text-sm">
                            {displayName}
                            {clients.filter(c => c.id || c.name).length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const idx = clients.findIndex(c => (c.id || "") === (client.id || "") && (c.name || "") === (client.name || ""));
                                  if (idx >= 0) removeClient(idx);
                                }}
                                className="text-gray-400 hover:text-red-600"
                                aria-label={`Remove ${displayName}`}
                              >
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </span>
                          {showTicketNr && categoryType === "flight" && client.id && (
                            <input
                              type="text"
                              value={ticket?.ticketNr || ""}
                              onChange={(e) => {
                                const ticketIndex = ticketNumbers.findIndex(t => t.clientId === client.id);
                                if (ticketIndex >= 0) {
                                  const updated = [...ticketNumbers];
                                  updated[ticketIndex] = { ...updated[ticketIndex], ticketNr: e.target.value };
                                  setTicketNumbers(updated);
                                }
                              }}
                              placeholder="Ticket"
                              className="w-24 rounded border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
                          )}
                        </div>
                      );
                    })}
                    {clients.filter(c => c.id || c.name).length === 0 && (
                      <span className="text-xs text-gray-400">No clients — use &quot;+ Add from directory&quot; above</span>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Payer</label>
                  <PartySelect
                    key={`payer-${payerPartyId || 'empty'}`}
                    value={payerPartyId}
                    onChange={(id, name) => { setPayerPartyId(id); setPayerName(name); }}
                    initialDisplayName={payerName}
                  />
                </div>
              </div>
            </div>

            {/* Column 3: Pricing, Refs, Booking Terms (same layout as Edit Service) */}
            <div className="space-y-2">
              <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pricing</h4>

                {/* Tour: Row1 Cost | Commission; Row2 Agent discount | Sale; Row3 Marge (calc) | VAT */}
                {categoryType === "tour" ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Cost (€)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={servicePrice}
                          onChange={(e) => {
                            pricingLastEditedRef.current = "cost";
                            setServicePrice(e.target.value);
                          }}
                          placeholder="0.00"
                          className={`w-full rounded-lg border px-2.5 py-1.5 text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield] ${parseAttemptedButEmpty.has("servicePrice") ? "ring-2 ring-red-300 border-red-400 bg-red-50/50" : parsedFields.has("servicePrice") ? "ring-2 ring-green-300 border-green-400 focus:border-green-500 focus:ring-green-500" : "border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"}`}
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
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Agent discount</label>
                        <div className="flex gap-1.5">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={agentDiscountValue}
                            onChange={(e) => setAgentDiscountValue(e.target.value)}
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
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Sale (€)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={clientPrice}
                          onChange={(e) => {
                            pricingLastEditedRef.current = "sale";
                            setClientPrice(e.target.value);
                          }}
                          placeholder="0.00"
                          className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield] focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Marge (€)</label>
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
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Cost (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={servicePrice}
                        onChange={(e) => {
                          pricingLastEditedRef.current = "cost";
                          setServicePrice(e.target.value);
                        }}
                        placeholder="0.00"
                        className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Marge (€)</label>
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
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Sale (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={clientPrice}
                        onChange={(e) => {
                          pricingLastEditedRef.current = "sale";
                          setClientPrice(e.target.value);
                        }}
                        placeholder="0.00"
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
                            Margin: €{margin.toFixed(2)}
                            <span className="text-gray-500 ml-1">(VAT: €{vatAmount.toFixed(2)})</span>
                          </div>
                          <div className={margin >= 0 ? "text-green-700 font-semibold" : "text-red-600 font-semibold"}>
                            Profit: €{profit.toFixed(2)}
                          </div>
                        </>
                      ) : (
                        <div className={margin >= 0 ? "text-green-700 font-semibold" : "text-red-600 font-semibold"}>
                          Profit: €{margin.toFixed(2)}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {categoryType !== "tour" && (
                <div className="flex items-end gap-4">
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
                  {(parseFloat(marge) || 0) !== 0 && (() => {
                    const margin = parseFloat(marge) || 0;
                    const vatAmount = vatRate > 0 ? margin * vatRate / (100 + vatRate) : 0;
                    const profit = margin - vatAmount;
                    return (
                      <div className="text-xs font-medium flex-1">
                        {vatRate > 0 ? (
                          <>
                            <div className={margin >= 0 ? 'text-green-600' : 'text-red-600'}>
                              Margin: €{margin.toFixed(2)}
                              <span className="text-gray-500 ml-1">(VAT: €{vatAmount.toFixed(2)})</span>
                            </div>
                            <div className="text-green-700 font-semibold">
                              Profit: €{profit.toFixed(2)}
                            </div>
                          </>
                        ) : (
                          <div className={margin >= 0 ? 'text-green-700 font-semibold' : 'text-red-600 font-semibold'}>
                            Profit: €{margin.toFixed(2)}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
                )}
              </div>

              <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">References</h4>
                
                <div className={categoryType === "flight" || categoryType === "hotel" ? "grid grid-cols-2 gap-2" : ""}>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-0.5">{categoryType === "tour" ? "Ref Nr (booking ref)" : "Ref Nr"}</label>
                    <input
                      type="text"
                      value={refNr}
                      onChange={(e) => setRefNr(e.target.value)}
                      placeholder="Booking ref"
                      className={`w-full rounded-lg border px-2.5 py-1.5 text-sm focus:ring-1 ${parseAttemptedButEmpty.has("refNr") ? "ring-2 ring-red-300 border-red-400 bg-red-50/50" : parsedFields.has("refNr") ? "ring-2 ring-green-300 border-green-400 focus:border-green-500 focus:ring-green-500" : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"}`}
                    />
                  </div>
                  
                  {/* Status - for Flight and Hotel in References section */}
                  {(categoryType === "flight" || categoryType === "hotel") && (
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
                  )}
                </div>
                
                {showTicketNr && categoryType !== "flight" && (
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

              {/* Booking Terms (hidden for Flight) - inside Column 3, same as Edit Service */}
              {categoryType !== "flight" && (
              <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Booking Terms</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Price Type - only for Tour */}
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
                  
                  {/* Refund Policy - hidden for Tour */}
                  {categoryType !== "tour" && (
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
                  )}
                </div>
                
                {/* Cancellation/Refund details - hidden for Tour */}
                {categoryType !== "tour" && refundPolicy === "refundable" && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Free cancel until</label>
                      <input
                        type="date"
                        value={freeCancellationUntil}
                        onChange={(e) => setFreeCancellationUntil(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
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
                
                {/* Payment Deadlines - Tour (2x2) or Other */}
                <div className="border-t border-gray-200 pt-2 mt-2">
                  {categoryType === "tour" ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="min-w-0">
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Deposit Due</label>
                        <input
                          type="date"
                          value={paymentDeadlineDeposit}
                          onChange={(e) => setPaymentDeadlineDeposit(e.target.value)}
                          className={`w-full min-w-[120px] rounded-lg border px-2.5 py-1.5 text-sm bg-white [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer ${parseAttemptedButEmpty.has("paymentDeadlineDeposit") ? "ring-2 ring-red-300 border-red-400 bg-red-50/50" : parsedFields.has("paymentDeadlineDeposit") ? "ring-2 ring-green-300 border-green-400 focus:border-green-500 focus:ring-green-500" : "border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"}`}
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
                          className={`w-full min-w-[4rem] rounded-lg border px-2.5 py-1.5 text-sm bg-white [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield] ${parseAttemptedButEmpty.has("depositPercent") ? "ring-2 ring-red-300 border-red-400 bg-red-50/50" : parsedFields.has("depositPercent") ? "ring-2 ring-green-300 border-green-400 focus:border-green-500 focus:ring-green-500" : "border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"}`}
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Final Due</label>
                        <input
                          type="date"
                          value={paymentDeadlineFinal}
                          onChange={(e) => setPaymentDeadlineFinal(e.target.value)}
                          className={`w-full min-w-[120px] rounded-lg border px-2.5 py-1.5 text-sm bg-white [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer ${parseAttemptedButEmpty.has("paymentDeadlineFinal") ? "ring-2 ring-red-300 border-red-400 bg-red-50/50" : parsedFields.has("paymentDeadlineFinal") ? "ring-2 ring-green-300 border-green-400 focus:border-green-500 focus:ring-green-500" : "border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"}`}
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
                          className={`w-full min-w-[4rem] rounded-lg border px-2.5 py-1.5 text-sm bg-white [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield] ${parseAttemptedButEmpty.has("finalPercent") ? "ring-2 ring-red-300 border-red-400 bg-red-50/50" : parsedFields.has("finalPercent") ? "ring-2 ring-green-300 border-green-400 focus:border-green-500 focus:ring-green-500" : "border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"}`}
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Payment Deadline</label>
                      <input
                        type="date"
                        value={paymentDeadlineFinal}
                        onChange={(e) => setPaymentDeadlineFinal(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                      />
                    </div>
                  )}
                </div>
              </div>
              )}
            </div>
          </RightWrapper>
          </div>

          {/* Flight Schedule - show parsed segments (Flight or Tour) */}
          {(categoryType === "flight" || categoryType === "tour") && flightSegments.length > 0 && (
            <div className={`mt-3 p-3 rounded-lg border ${parseAttemptedButEmpty.has("flightSegments") ? "bg-red-50 border-red-200 ring-2 ring-red-300" : parsedFields.has("flightSegments") ? "bg-green-50 border-green-200 ring-2 ring-green-300" : "bg-sky-50 border-sky-200"}`}>
              <h4 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${parseAttemptedButEmpty.has("flightSegments") ? "text-red-700" : parsedFields.has("flightSegments") ? "text-green-700" : "text-sky-700"}`}>Flight Schedule</h4>
              <div className="space-y-2">
                {flightSegments.map((seg, idx) => {
                  // Calculate time between segments
                  let gapInfo: { type: "layover" | "stay" | null; time: string; location: string } = { type: null, time: "", location: "" };
                  
                  if (idx > 0) {
                    const prevSeg = flightSegments[idx - 1];
                    const firstSeg = flightSegments[0];
                    
                    if (prevSeg.arrivalDate && prevSeg.arrivalTimeScheduled && seg.departureDate && seg.departureTimeScheduled) {
                      // Account for timezone differences
                      const prevArrTzOffset = getAirportTimezoneOffset(prevSeg.arrival);
                      const currDepTzOffset = getAirportTimezoneOffset(seg.departure);
                      
                      const prevArrival = new Date(`${prevSeg.arrivalDate}T${prevSeg.arrivalTimeScheduled}`);
                      const currDeparture = new Date(`${seg.departureDate}T${seg.departureTimeScheduled}`);
                      
                      // Convert to UTC for accurate comparison
                      const prevArrivalUTC = prevArrival.getTime() - (prevArrTzOffset * 60 * 60 * 1000);
                      const currDepartureUTC = currDeparture.getTime() - (currDepTzOffset * 60 * 60 * 1000);
                      const diffMs = currDepartureUTC - prevArrivalUTC;
                      
                      if (diffMs > 0) {
                        const totalMinutes = Math.floor(diffMs / (1000 * 60));
                        const hours = Math.floor(totalMinutes / 60);
                        const minutes = totalMinutes % 60;
                        
                        // Format for layover (short): "2h 30m"
                        const shortTimeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
                        
                        // Format for stay (with days): "3 day(s) 21h 55m"
                        const days = Math.floor(hours / 24);
                        const remainingHours = hours % 24;
                        const longTimeStr = days > 0 
                          ? `${days} day${days > 1 ? "s" : ""} ${remainingHours}h ${minutes}m`
                          : shortTimeStr;
                        
                        // Check if this is a return leg (arriving back to origin)
                        const isReturnLeg = seg.arrival === firstSeg.departure;
                        
                        // Layover: same airport connection, < 12 hours
                        // Stay: different location OR >= 12 hours at same place
                        if (prevSeg.arrival === seg.departure && hours < 12) {
                          // Short connection at same airport = layover
                          gapInfo = { type: "layover", time: shortTimeStr, location: prevSeg.arrivalCity || prevSeg.arrival };
                        } else if (hours >= 6) {
                          // Long gap = stay in destination city
                          const city = prevSeg.arrivalCity || prevSeg.arrival;
                          gapInfo = { type: "stay", time: longTimeStr, location: city };
                        }
                      }
                    }
                  }
                  
                  const formatDate = (dateStr: string) => (dateStr ? formatDateDDMMYYYY(dateStr) : "");
                  
                  return (
                    <div key={seg.id || idx}>
                      {/* Gap indicator: Layover or Stay */}
                      {gapInfo.type === "layover" && (
                        <div className="flex items-center justify-center py-1 text-xs text-amber-600">
                          <span className="bg-amber-100 px-2 py-0.5 rounded">⏱ Layover: {gapInfo.time} in {gapInfo.location}</span>
                        </div>
                      )}
                      {gapInfo.type === "stay" && (
                        <div className="flex items-center justify-center py-1 text-xs text-green-600">
                          <span className="bg-green-100 px-2 py-0.5 rounded">🏨 Stay in {gapInfo.location}: {gapInfo.time}</span>
                        </div>
                      )}
                      
                      {/* Flight segment */}
                      <div className="bg-white rounded-lg px-3 py-2 border border-sky-100">
                        <div className="flex items-center gap-3 text-sm">
                          <div className="flex flex-col items-center">
                            <span className="font-semibold text-sky-700">{seg.flightNumber}</span>
                            <span className="text-[10px] text-gray-400">{seg.airline}</span>
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <div className="text-center min-w-[80px]">
                                <div className="text-xs text-gray-400">{formatDate(seg.departureDate)}</div>
                                <div className="font-medium">{seg.departure}</div>
                                <div className="text-[10px] text-gray-500">
                                  {seg.departureCity}{seg.departureCountry && `, ${seg.departureCountry}`}
                                </div>
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
                                <div className="text-xs text-gray-400">{formatDate(seg.arrivalDate)}</div>
                                <div className="font-medium">{seg.arrival}</div>
                                <div className="text-[10px] text-gray-500">
                                  {seg.arrivalCity}{seg.arrivalCountry && `, ${seg.arrivalCountry}`}
                                </div>
                                <div className="text-sm font-semibold">{seg.arrivalTimeScheduled}</div>
                                {seg.arrivalTerminal && <div className="text-[10px] text-gray-400">{seg.arrivalTerminal.toLowerCase().startsWith("terminal") ? seg.arrivalTerminal : `T${seg.arrivalTerminal}`}</div>}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-end gap-1">
                            {seg.cabinClass && (
                              <span className="text-xs bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded capitalize">
                                {seg.cabinClass.replace("_", " ")}
                              </span>
                            )}
                            {seg.baggage && (
                              <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                🧳 {seg.baggage}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {/* Total travel time (with timezone adjustment) */}
                {flightSegments.length > 0 && (
                  <div className="text-xs text-gray-500 text-right pt-1">
                    Total travel time: {(() => {
                      const first = flightSegments[0];
                      const last = flightSegments[flightSegments.length - 1];
                      if (first.departureDate && first.departureTimeScheduled && last.arrivalDate && last.arrivalTimeScheduled) {
                        // Get timezone offsets for departure and arrival airports
                        const depTzOffset = getAirportTimezoneOffset(first.departure);
                        const arrTzOffset = getAirportTimezoneOffset(last.arrival);
                        
                        // Create dates in local time
                        const start = new Date(`${first.departureDate}T${first.departureTimeScheduled}`);
                        const end = new Date(`${last.arrivalDate}T${last.arrivalTimeScheduled}`);
                        
                        // Adjust for timezone difference (convert both to UTC)
                        // Local time - offset = UTC, so we subtract the offset
                        const startUTC = start.getTime() - (depTzOffset * 60 * 60 * 1000);
                        const endUTC = end.getTime() - (arrTzOffset * 60 * 60 * 1000);
                        
                        const diffMs = endUTC - startUTC;
                        if (diffMs > 0) {
                          const totalMinutes = Math.floor(diffMs / (1000 * 60));
                          const days = Math.floor(totalMinutes / (24 * 60));
                          const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
                          const minutes = totalMinutes % 60;
                          const parts: string[] = [];
                          if (days > 0) parts.push(`${days} day${days > 1 ? "s" : ""}`);
                          if (hours > 0) parts.push(`${hours}h`);
                          if (minutes > 0) parts.push(`${minutes}m`);
                          return parts.join(", ") || "—";
                        }
                      }
                      return "—";
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}

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
                    setHotelMealOptions(d.mealOptions ?? []);
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
                    <>
                      <p className="text-xs text-amber-600 mb-1 mt-0.5">From hotel: {hotelRoomOptions.map((opt) => (
                        <button key={opt} type="button" onClick={() => setHotelRoom(opt)} title={opt} className="mr-1.5 mt-0.5 px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 truncate max-w-[120px] inline-block align-middle" style={{ maxWidth: "120px" }}>{opt}</button>
                      ))}</p>
                      <datalist id="add-hotel-room-datalist-2">
                        {hotelRoomOptions.map((opt) => (
                          <option key={opt} value={opt} />
                        ))}
                      </datalist>
                    </>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Board</label>
                  {hotelMealOptions.length > 0 && (
                    <p className="text-xs text-amber-600 mb-1">From hotel: {hotelMealOptions.map((meal) => (
                      <button key={meal} type="button" onClick={() => setHotelBoard(mapRatehawkMealToBoard(meal))} title={meal} className="mr-1.5 px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 truncate max-w-[120px] inline-block align-middle" style={{ maxWidth: "120px" }}>{meal}</button>
                    ))}</p>
                  )}
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
                    <input type="checkbox" checked={hotelPreferences.earlyCheckIn} onChange={(e) => setHotelPreferences(prev => ({ ...prev, earlyCheckIn: e.target.checked }))} className="rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                    Early check-in
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input type="checkbox" checked={hotelPreferences.lateCheckIn} onChange={(e) => setHotelPreferences(prev => ({ ...prev, lateCheckIn: e.target.checked }))} className="rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                    Late check-in
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input type="checkbox" checked={hotelPreferences.higherFloor} onChange={(e) => setHotelPreferences(prev => ({ ...prev, higherFloor: e.target.checked }))} className="rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                    Higher floor
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input type="checkbox" checked={hotelPreferences.kingSizeBed} onChange={(e) => setHotelPreferences(prev => ({ ...prev, kingSizeBed: e.target.checked }))} className="rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                    King size bed
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input type="checkbox" checked={hotelPreferences.honeymooners} onChange={(e) => setHotelPreferences(prev => ({ ...prev, honeymooners: e.target.checked }))} className="rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                    Honeymooners
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input type="checkbox" checked={hotelPreferences.silentRoom} onChange={(e) => setHotelPreferences(prev => ({ ...prev, silentRoom: e.target.checked }))} className="rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                    Silent room
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input type="checkbox" checked={hotelPreferences.parking} onChange={(e) => setHotelPreferences(prev => ({ ...prev, parking: e.target.checked }))} className="rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                    Parking
                  </label>
                </div>
                <div className="mb-2">
                  <input type="text" value={hotelPreferences.roomsNextTo} onChange={(e) => setHotelPreferences(prev => ({ ...prev, roomsNextTo: e.target.value }))} placeholder="Rooms next to..." className="w-full rounded-lg border border-amber-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white" />
                </div>
                <div>
                  <textarea value={hotelPreferences.freeText} onChange={(e) => setHotelPreferences(prev => ({ ...prev, freeText: e.target.value }))} placeholder="Additional preferences (free text)" rows={2} className="w-full rounded-lg border border-amber-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white" />
                </div>
                <button type="button" onClick={() => {
                  const preferencesList = Object.entries(hotelPreferences).filter(([key, value]) => key !== "roomsNextTo" && key !== "freeText" && value === true).map(([key]) => key.replace(/([A-Z])/g, " $1").toLowerCase()).join(", ");
                  const message = `We have a reservation for ${hotelName}. Please confirm the reservation exists and consider the following preferences:\n\nRoom: ${hotelRoom || "Not specified"}\nBoard: ${hotelBoard}\nBed Type: ${hotelBedType}\nPreferences: ${preferencesList || "None"}${hotelPreferences.roomsNextTo ? `\nRooms next to: ${hotelPreferences.roomsNextTo}` : ""}${hotelPreferences.freeText ? `\nAdditional: ${hotelPreferences.freeText}` : ""}`;
                  alert(`Message to hotel:\n\n${message}\n\n(Will be saved to Communication tab)`);
                }} className="w-full px-3 py-2 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors">
                  📧 Send to Hotel
                </button>
              </div>
            </div>
          )}

          {showTransferFields && (
            <div className="mt-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <h4 className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">Transfer Details</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <div>
                  <input type="text" value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} placeholder="Pickup" className="w-full rounded-lg border border-emerald-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white" />
                </div>
                <div>
                  <input type="text" value={dropoffLocation} onChange={(e) => setDropoffLocation(e.target.value)} placeholder="Dropoff" className="w-full rounded-lg border border-emerald-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white" />
                </div>
                <div>
                  <input type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} className="w-full rounded-lg border border-emerald-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white" />
                </div>
                <div>
                  <input type="text" value={estimatedDuration} onChange={(e) => setEstimatedDuration(e.target.value)} placeholder="Duration" className="w-full rounded-lg border border-emerald-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white" />
                </div>
                <div>
                  <select value={linkedFlightId || ""} onChange={(e) => setLinkedFlightId(e.target.value || null)} className="w-full rounded-lg border border-emerald-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white">
                    <option value="">No linked flight</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Actions - Sticky Footer */}
          <div className="mt-4 pt-3 border-t flex justify-end gap-2">
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
          </div>
        </form>
      </div>
    </div>
  );
}
