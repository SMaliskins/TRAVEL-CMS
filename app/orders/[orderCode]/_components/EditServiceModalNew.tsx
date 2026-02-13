'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import PartySelect from '@/components/PartySelect';
import DateRangePicker from '@/components/DateRangePicker';
import { FlightSegment } from '@/components/FlightItineraryInput';
import { getAirportTimezoneOffset, parseFlightBooking, formatBaggageDisplay } from '@/lib/flights/airlineParsers';
import { useEscapeKey } from '@/lib/hooks/useEscapeKey';
import { formatDateDDMMYYYY } from '@/utils/dateFormat';
import ChangeServiceModal from './ChangeServiceModal';
import CancelServiceModal from './CancelServiceModal';
import type { SupplierCommission } from '@/lib/types/directory';

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
  categoryType?: CategoryType; // Functional type for conditional logic
  servicePrice: number;
  clientPrice: number;
  vatRate?: number;
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
  hotelBedType?: "king_queen" | "twin" | "not_guaranteed";
  hotelEarlyCheckIn?: boolean;
  hotelLateCheckIn?: boolean;
  hotelHigherFloor?: boolean;
  hotelKingSizeBed?: boolean;
  hotelHoneymooners?: boolean;
  hotelSilentRoom?: boolean;
  hotelRoomsNextTo?: string;
  hotelParking?: boolean;
  hotelPreferencesFreeText?: string;
  supplierBookingType?: "gds" | "direct";
  // Transfer-specific
  pickupLocation?: string;
  dropoffLocation?: string;
  pickupTime?: string;
  estimatedDuration?: string;
  linkedFlightId?: string;
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

interface EditServiceModalProps {
  service: Service;
  orderCode: string;
  onClose: () => void;
  onServiceUpdated: (updated: Partial<Service> & { id: string }) => void;
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

export default function EditServiceModalNew({
  service,
  orderCode,
  onClose,
  onServiceUpdated,
}: EditServiceModalProps) {
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
  
  // Client (multiple clients from order_service_travellers)
  interface ClientEntry {
    id: string | null;
    name: string;
  }
  const [clients, setClients] = useState<ClientEntry[]>([
    { id: service.clientPartyId || null, name: service.client || "" }
  ]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const clientsLoadedRef = useRef(false);
  
  // Load service travellers (clients) from API
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
          
          console.log("Loaded service travellers:", travellers);
          
          if (travellers.length > 0) {
            const clientEntries: ClientEntry[] = travellers.map((t: { id: string; name: string }) => ({
              id: t.id,
              name: t.name,
            }));
            setClients(clientEntries);
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
    if (service.commissionAmount != null) {
      const disc = Number(service.agentDiscountValue) || 0;
      return String(Math.round(((Number(service.commissionAmount) || 0) - disc) * 100) / 100);
    }
    return String(Math.round(((service.clientPrice || 0) - (service.servicePrice || 0)) * 100) / 100);
  });
  const [clientPrice, setClientPrice] = useState(String(service.clientPrice || 0));
  // Tour (Package Tour) pricing
  const [supplierCommissions, setSupplierCommissions] = useState<SupplierCommission[]>([]);
  const [selectedCommissionIndex, setSelectedCommissionIndex] = useState<number>(-1);
  const [agentDiscountValue, setAgentDiscountValue] = useState(
    service.agentDiscountValue != null ? String(service.agentDiscountValue) : ""
  );
  const [agentDiscountType, setAgentDiscountType] = useState<"%" | "€">(
    (service.agentDiscountType as "%" | "€") || "%"
  );
  // Track which field was last edited to determine calculation direction
  const pricingLastEditedRef = useRef<'cost' | 'marge' | 'sale' | 'agent' | 'commission' | null>(null);
  const [vatRate, setVatRate] = useState<number>(service.vatRate || 0);
  const [resStatus, setResStatus] = useState(service.resStatus || "booked");
  const [refNr, setRefNr] = useState(service.refNr || "");
  const [ticketNr, setTicketNr] = useState(service.ticketNr || "");
  // Ticket numbers per client (for Flights)
  const [ticketNumbers, setTicketNumbers] = useState<{ clientId: string; clientName: string; ticketNr: string }[]>(
    service.ticketNumbers || []
  );
  
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
  const [mealPlanText, setMealPlanText] = useState<string>(() => {
    if ((service as { mealPlanText?: string }).mealPlanText?.trim()) return (service as { mealPlanText?: string }).mealPlanText!.trim();
    const b = (service.hotelBoard as any) || "room_only";
    const labels: Record<string, string> = { room_only: "RO", breakfast: "BB", half_board: "HB", full_board: "FB", all_inclusive: "AI", uai: "UAI" };
    return labels[b] || b;
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
    roomsNextTo: service.hotelRoomsNextTo || "",
    parking: service.hotelParking || false,
    freeText: service.hotelPreferencesFreeText || "",
  });
  const [supplierBookingType, setSupplierBookingType] = useState<"gds" | "direct">(
    (service.supplierBookingType as any) || "gds"
  );
  
  // Transfer-specific fields
  const [pickupLocation, setPickupLocation] = useState(service.pickupLocation || "");
  const [dropoffLocation, setDropoffLocation] = useState(service.dropoffLocation || "");
  const [pickupTime, setPickupTime] = useState(service.pickupTime || "");
  const [estimatedDuration, setEstimatedDuration] = useState(service.estimatedDuration || "");
  const [linkedFlightId, setLinkedFlightId] = useState<string | null>(service.linkedFlightId || null);
  
  // Flight-specific fields
  const [flightSegments, setFlightSegments] = useState<FlightSegment[]>(
    (service.flightSegments || []).map(seg => ({
      ...seg,
      // Ensure all segments have the same cabinClass as the service
      cabinClass: seg.cabinClass || service.cabinClass || "economy",
    }))
  );
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
    // At this point we already returned when lastEdited === "sale", so update clientPrice and clear ref (same as Add)
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
        departureStatus: "scheduled" as const,
        arrivalStatus: "scheduled" as const,
      })));
      fields.add("flightSegments");
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
    if (clients.length <= 1) return;
    setClients(clients.filter((_, i) => i !== index));
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

  // Parse flight booking text
  const handleParseFlight = () => {
    if (!pasteText.trim()) return;
    
    setParseError(null);
    const text = pasteText.trim();
    
    const result = parseFlightBooking(text);
    if (!result || result.segments.length === 0) {
      setParseError("Could not parse this booking. Best results with Amadeus ITR format.");
      return;
    }
    
    // Convert to FlightSegment[]
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
    
    // Apply parsed data
    setFlightSegments(segments);
    if (result.booking.bookingRef) setRefNr(result.booking.bookingRef);
    if (result.booking.airline) setSupplierName(result.booking.airline);
    if (result.booking.totalPrice) {
      setClientPrice(String(result.booking.totalPrice));
      setServicePrice(String(result.booking.totalPrice));
    }
    if (result.booking.cabinClass) {
      const validClasses = ["economy", "premium_economy", "business", "first"];
      if (validClasses.includes(result.booking.cabinClass)) {
        const parsedCabinClass = result.booking.cabinClass as "economy" | "premium_economy" | "business" | "first";
        // Don't trigger useEffect sync - update directly
        cabinClassUpdateRef.current = false;
        skipSyncRef.current = true;
        setCabinClass(parsedCabinClass);
        // Also update cabinClass in all segments (directly, not through useEffect)
        setFlightSegments(prevSegments => 
          prevSegments.map(seg => ({
            ...seg,
            cabinClass: parsedCabinClass,
          }))
        );
        setTimeout(() => {
          skipSyncRef.current = false;
        }, 100);
      }
    }
    if (result.booking.baggage) {
      setBaggage(result.booking.baggage);
    }
    if (result.booking.refundPolicy) {
      const validPolicies = ["non_ref", "refundable", "fully_ref"];
      if (validPolicies.includes(result.booking.refundPolicy)) {
        setRefundPolicy(result.booking.refundPolicy as "non_ref" | "refundable" | "fully_ref");
      }
    }
    
    // Update ticket numbers
    if (result.booking.ticketNumbers && result.booking.ticketNumbers.length > 0) {
      const firstTicket = result.booking.ticketNumbers[0];
      if (firstTicket) {
        setTicketNr(firstTicket);
        // Update ticketNumbers array if we have clients
        if (ticketNumbers.length > 0) {
          const updated = [...ticketNumbers];
          updated[0] = { ...updated[0], ticketNr: firstTicket };
          setTicketNumbers(updated);
        }
      }
    }
    
    // Update dates
    if (segments[0]?.departureDate) {
      setDateFrom(segments[0].departureDate);
    }
    if (segments.length > 0) {
      const lastSeg = segments[segments.length - 1];
      if (lastSeg.arrivalDate) {
        setDateTo(lastSeg.arrivalDate);
      }
    }
    
    // Generate route name
    if (segments.length > 0) {
      const routeParts = segments.map(seg => {
        const date = new Date(seg.departureDate);
        const dd = date.getDate().toString().padStart(2, "0");
        const mm = (date.getMonth() + 1).toString().padStart(2, "0");
        return `${dd}.${mm} ${seg.departure}-${seg.arrival}`;
      });
      setServiceName(routeParts.join(" / "));
    }
    
    // Close paste input
    setShowPasteInput(false);
    setPasteText("");
  };

  const handleSave = async () => {
    if (!serviceName.trim()) {
      setError("Service name is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const primaryClient = clients.find(c => c.id) || clients[0];

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
        // All clients for order_service_travellers
        clients: clients.filter(c => c.id).map(c => ({ id: c.id, name: c.name })),
        payer_party_id: payerPartyId,
        payer_name: payerName,
        service_price: parseFloat(servicePrice) || 0,
        client_price: parseFloat(clientPrice) || 0,
        vat_rate: vatRate,
        res_status: resStatus || "booked",
        ref_nr: refNr || null,
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
        payload.hotel_bed_type = hotelBedType;
        payload.hotel_early_check_in = hotelPreferences.earlyCheckIn;
        payload.hotel_late_check_in = hotelPreferences.lateCheckIn;
        payload.hotel_higher_floor = hotelPreferences.higherFloor;
        payload.hotel_king_size_bed = hotelPreferences.kingSizeBed;
        payload.hotel_honeymooners = hotelPreferences.honeymooners;
        payload.hotel_silent_room = hotelPreferences.silentRoom;
        payload.hotel_rooms_next_to = hotelPreferences.roomsNextTo;
        payload.hotel_parking = hotelPreferences.parking;
        payload.hotel_preferences_free_text = hotelPreferences.freeText;
        payload.supplier_booking_type = supplierBookingType;
      }

      // Add Tour-specific fields (Package Tour)
      if (categoryType === "tour") {
        payload.hotel_name = hotelName || null;
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
      }

      // Add flight-specific fields
      if (categoryType === "flight") {
        payload.cabin_class = cabinClass;
        payload.baggage = baggage;
        if (flightSegments.length > 0) {
          payload.flight_segments = flightSegments;
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
        // Sync clients to order_travellers
        await addClientsToOrderTravellers(clients.map(c => c.id));
        
        onServiceUpdated({
          id: service.id,
          name: serviceName,
          category,
          supplier: supplierName || "-",
          client: (clients.find(c => c.id) || clients[0])?.name || "-",
          payer: payerName || "-",
          supplierPartyId,
          clientPartyId: (clients.find(c => c.id) || clients[0])?.id || undefined,
          payerPartyId,
          servicePrice: parseFloat(servicePrice) || 0,
          clientPrice: parseFloat(clientPrice) || 0,
          resStatus,
          refNr,
          ticketNr,
          ticketNumbers: categoryType === "flight" ? ticketNumbers : undefined,
          dateFrom,
          dateTo,
          // Flight-specific fields
          cabinClass: categoryType === "flight" ? cabinClass : undefined,
          baggage: categoryType === "flight" ? baggage : undefined,
          flightSegments: categoryType === "flight" ? flightSegments : undefined,
          // Tour: so list keeps discount and Edit reopens with correct values
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl">
        {/* Compact Header */}
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
              <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-gray-900">
              Edit Service{category ? ` — ${category}` : ""}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      disabled={!pasteText.trim()}
                      className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      📋 Parse
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

        <div className="p-4">
          {error && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Main Grid - 3 columns; for Hotel: left 2/3 = Hotel Details (with Dates) + Basic Info hidden, right 1/3 = Parties, Pricing, References */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-3">
            
            {/* Column 1: For Hotel = Hotel Details (with Dates) in 2/3; else Basic Info + Tour details */}
            <div className={`space-y-2 ${categoryType === "hotel" ? "md:col-span-2" : ""}`}>
              {categoryType === "hotel" ? (
                /* Hotel: Hotel Details at top — Dates under Hotel Name */
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-3">
                  <h4 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Hotel Details</h4>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-0.5">Hotel Name</label>
                    <input
                      type="text"
                      value={hotelName}
                      onChange={(e) => setHotelName(e.target.value)}
                      placeholder="Hotel name"
                      className="w-full rounded-lg border border-amber-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white"
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
                      <input type="text" value={hotelRoom} onChange={(e) => setHotelRoom(e.target.value)} placeholder="Room type" className="w-full rounded-lg border border-amber-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white" />
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
                    <button type="button" onClick={async () => { const preferencesList = Object.entries(hotelPreferences).filter(([key, value]) => key !== "roomsNextTo" && key !== "freeText" && value === true).map(([key]) => key.replace(/([A-Z])/g, " $1").toLowerCase()).join(", "); const message = `We have a reservation for ${hotelName}. Please confirm the reservation exists and consider the following preferences:\n\nRoom: ${hotelRoom || "Not specified"}\nBoard: ${hotelBoard}\nBed Type: ${hotelBedType}\nPreferences: ${preferencesList || "None"}${hotelPreferences.roomsNextTo ? `\nRooms next to: ${hotelPreferences.roomsNextTo}` : ""}${hotelPreferences.freeText ? `\nAdditional: ${hotelPreferences.freeText}` : ""}`; alert(`Message to hotel:\n\n${message}\n\n(Will be saved to Communication tab)`); }} className="w-full px-3 py-2 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors">📧 Send to Hotel</button>
                  </div>
                </div>
              ) : (
              <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Basic Info</h4>
                
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
                
                {/* Cabin Class & Baggage - for Flight */}
                {categoryType === "flight" ? (
                  <>
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
                ) : (
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
            </div>

            {/* Right side: Parties + Pricing (when Hotel: one column 1/3; else two columns) */}
            {(() => {
              const RightWrapper = categoryType === "hotel" ? "div" : React.Fragment;
              const rightWrapperProps = categoryType === "hotel" ? { className: "md:col-span-1 space-y-2" as const } : {};
              return (
                <RightWrapper {...rightWrapperProps}>
            <div className="space-y-2">
              <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Parties</h4>
                
                <div className={categoryType === "tour" && parseAttemptedButEmpty.has("supplierName") ? "ring-2 ring-red-300 border-red-400 rounded-lg p-0.5 -m-0.5 bg-red-50/50" : parsedFields.has("supplierName") ? "ring-2 ring-green-300 rounded-lg p-1 -m-1" : ""}>
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
                              onChange={(id, name) => { 
                                setSupplierPartyId(id); 
                                setSupplierName(name); 
                              }}
                              roleFilter="supplier"
                              initialDisplayName={supplierName || hotelName}
                            />
                          </div>
                          {!supplierPartyId && hotelName.trim() && (
                            <button
                              type="button"
                              onClick={() => {
                                // TODO: Open add supplier modal or navigate to directory
                                alert(`Add "${hotelName}" to directory as supplier?`);
                              }}
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
                    <PartySelect
                      value={supplierPartyId}
                      onChange={(id, name) => { setSupplierPartyId(id); setSupplierName(name); }}
                      roleFilter="supplier"
                      initialDisplayName={supplierName}
                    />
                  )}
                </div>
                
                <div className={categoryType === "tour" && parseAttemptedButEmpty.has("clients") ? "ring-2 ring-red-300 border-red-400 rounded-lg p-0.5 -m-0.5 bg-red-50/50" : categoryType === "tour" && parsedFields.has("clients") ? "ring-2 ring-green-300 border-green-400 rounded-lg p-0.5 -m-0.5" : ""}>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="text-xs font-medium text-gray-600">Client{clients.length > 1 ? "s" : ""}</label>
                    <button type="button" onClick={addClient} className="text-xs text-blue-600 hover:text-blue-800 font-medium">+ Add</button>
                  </div>
                  <div className="space-y-1.5">
                    {clients.map((client, index) => {
                      // Find ticket for this client
                      const ticket = ticketNumbers.find(t => t.clientId === client.id);
                      return (
                        <div key={index} className="flex gap-1 items-center">
                          <div className="flex-1">
                            <PartySelect
                              key={`client-${client.id || index}`}
                              value={client.id}
                              onChange={(id, name) => updateClient(index, id, name)}
                              initialDisplayName={client.name}
                            />
                          </div>
                          {/* Ticket Nr field for Flight - shown next to client */}
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
                              className="w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
                          )}
                          {clients.length > 1 && (
                            <button type="button" onClick={() => removeClient(index)} className="px-1.5 text-red-400 hover:text-red-600">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      );
                    })}
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

            {/* Column 3: Pricing, Ref Nr, Booking Terms */}
            <div className="space-y-2">
              <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pricing</h4>

                {/* Tour: Row1 Cost | Commission; Row2 Agent discount | Sale; Row3 Marge (calc) | VAT */}
                {categoryType === "tour" ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
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
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Sale (€)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={clientPrice}
                          onChange={(e) => {
                            if (service.invoice_id) return;
                            pricingLastEditedRef.current = "sale";
                            setClientPrice(e.target.value);
                          }}
                          placeholder="0.00"
                          disabled={!!service.invoice_id}
                          title={service.invoice_id ? "Amount is locked: service is on an invoice" : undefined}
                          className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
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
                          if (service.invoice_id) return;
                          pricingLastEditedRef.current = "sale";
                          setClientPrice(e.target.value);
                        }}
                        placeholder="0.00"
                        disabled={!!service.invoice_id}
                        title={service.invoice_id ? "Amount is locked: service is on an invoice" : undefined}
                        className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
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
                  
                  {/* Status - for Flight and Hotel in References section */}
                  {(categoryType === "flight" || categoryType === "hotel") && (
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
                  )}
                </div>
                
                {/* Change/Cancel buttons for Flight - under Ref Nr and Status */}
                {categoryType === "flight" && (
                  <div className="space-y-2 pt-2">
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
                
                {showTicketNr && category !== "Flight" && (
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
              
              {/* Booking Terms (hidden for Flight) */}
              {category !== "Flight" && (
              <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Booking Terms</h4>
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
                  
                  {/* Refund Policy - hidden for Tour */}
                  {categoryType !== "tour" && (
                    <div className={categoryType === "flight" ? "" : "col-span-2"}>
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
                  
                  {/* Change Fee - only for Flight */}
                  {categoryType === "flight" && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Change Fee €</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={changeFee}
                        onChange={(e) => setChangeFee(e.target.value)}
                        placeholder="0 = free"
                        className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                      />
                      <span className="text-[10px] text-gray-400">+ class diff</span>
                    </div>
                  )}
                </div>
                
                {/* Cancellation/Refund details - hidden for Tour */}
                {categoryType !== "tour" && refundPolicy !== "non_ref" && (
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
                
                {/* Payment Deadlines - different for Flight vs Tour vs Other */}
                <div className="border-t border-gray-200 pt-2 mt-2">
                  {categoryType === "flight" ? (
                    // Flight: single deadline (typically +1 day)
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Payment Deadline</label>
                        <input
                          type="date"
                          value={paymentDeadlineFinal}
                          onChange={(e) => setPaymentDeadlineFinal(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                        />
                      </div>
                      <div className="flex items-end">
                        <span className="text-xs text-gray-500 pb-2">Usually +1 day from booking</span>
                      </div>
                    </div>
                  ) : categoryType === "tour" ? (
                    // Tour: Deposit Due + %, Final Due + % — 2x2 grid so fields have enough width for date picker & numbers
                    <div className="grid grid-cols-2 gap-3">
                      <div className="min-w-0">
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Deposit Due</label>
                        <input
                          type="date"
                          value={paymentDeadlineDeposit}
                          onChange={(e) => setPaymentDeadlineDeposit(e.target.value)}
                          className={`w-full min-w-[120px] rounded-lg border px-2.5 py-1.5 text-sm bg-white [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer ${parseAttemptedButEmpty.has("paymentDeadlineDeposit") ? "ring-2 ring-red-300 border-red-400 bg-red-50/50" : parsedFields.has("paymentDeadlineDeposit") ? "ring-2 ring-green-300 border-green-400" : "border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"}`}
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
                        <input
                          type="date"
                          value={paymentDeadlineFinal}
                          onChange={(e) => setPaymentDeadlineFinal(e.target.value)}
                          className={`w-full min-w-[120px] rounded-lg border px-2.5 py-1.5 text-sm bg-white [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer ${parseAttemptedButEmpty.has("paymentDeadlineFinal") ? "ring-2 ring-red-300 border-red-400 bg-red-50/50" : parsedFields.has("paymentDeadlineFinal") ? "ring-2 ring-green-300 border-green-400" : "border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"}`}
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
                      <input
                        type="date"
                        value={paymentDeadlineFinal}
                        onChange={(e) => setPaymentDeadlineFinal(e.target.value)}
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
                      <input
                        type="date"
                        value={paymentDeadlineFinal}
                        onChange={(e) => setPaymentDeadlineFinal(e.target.value)}
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

          {/* Category-specific fields - Hotel Details moved to top left for hotel; only show bottom block for non-hotel */}
          {!showHotelFields && (
            <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-3">
              <h4 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Hotel Details</h4>
              
              {/* Hotel Name - auto-filled from Name field */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">Hotel Name</label>
                <input 
                  type="text" 
                  value={hotelName} 
                  onChange={(e) => setHotelName(e.target.value)} 
                  placeholder="Hotel name" 
                  className="w-full rounded-lg border border-amber-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white" 
                />
              </div>
              
              {/* Room, Board, Bed Type */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Room</label>
                  <input 
                    type="text" 
                    value={hotelRoom} 
                    onChange={(e) => setHotelRoom(e.target.value)} 
                    placeholder="Room type" 
                    className="w-full rounded-lg border border-amber-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Board</label>
                  <select
                    value={hotelBoard}
                    onChange={(e) => setHotelBoard(e.target.value as typeof hotelBoard)}
                    className="w-full rounded-lg border border-amber-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white"
                  >
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
                  <select
                    value={hotelBedType}
                    onChange={(e) => setHotelBedType(e.target.value as typeof hotelBedType)}
                    className="w-full rounded-lg border border-amber-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white"
                  >
                    <option value="king_queen">King/Queen</option>
                    <option value="twin">Twin</option>
                    <option value="not_guaranteed">Not guaranteed</option>
                  </select>
                </div>
              </div>
              
              {/* Hotel Contact Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Address</label>
                  <input 
                    type="text" 
                    value={hotelAddress} 
                    onChange={(e) => setHotelAddress(e.target.value)} 
                    placeholder="Address" 
                    className="w-full rounded-lg border border-amber-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Phone</label>
                  <input 
                    type="tel" 
                    value={hotelPhone} 
                    onChange={(e) => setHotelPhone(e.target.value)} 
                    placeholder="Phone" 
                    className="w-full rounded-lg border border-amber-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Email</label>
                  <input 
                    type="email" 
                    value={hotelEmail} 
                    onChange={(e) => setHotelEmail(e.target.value)} 
                    placeholder="Email" 
                    className="w-full rounded-lg border border-amber-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white" 
                  />
                </div>
              </div>
              
              {/* Preferences */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Preferences</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                  <label className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={hotelPreferences.earlyCheckIn}
                      onChange={(e) => setHotelPreferences(prev => ({ ...prev, earlyCheckIn: e.target.checked }))}
                      className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                    />
                    Early check-in
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={hotelPreferences.lateCheckIn}
                      onChange={(e) => setHotelPreferences(prev => ({ ...prev, lateCheckIn: e.target.checked }))}
                      className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                    />
                    Late check-in
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={hotelPreferences.higherFloor}
                      onChange={(e) => setHotelPreferences(prev => ({ ...prev, higherFloor: e.target.checked }))}
                      className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                    />
                    Higher floor
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={hotelPreferences.kingSizeBed}
                      onChange={(e) => setHotelPreferences(prev => ({ ...prev, kingSizeBed: e.target.checked }))}
                      className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                    />
                    King size bed
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={hotelPreferences.honeymooners}
                      onChange={(e) => setHotelPreferences(prev => ({ ...prev, honeymooners: e.target.checked }))}
                      className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                    />
                    Honeymooners
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={hotelPreferences.silentRoom}
                      onChange={(e) => setHotelPreferences(prev => ({ ...prev, silentRoom: e.target.checked }))}
                      className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                    />
                    Silent room
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={hotelPreferences.parking}
                      onChange={(e) => setHotelPreferences(prev => ({ ...prev, parking: e.target.checked }))}
                      className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                    />
                    Parking
                  </label>
                </div>
                <div className="mb-2">
                  <input
                    type="text"
                    value={hotelPreferences.roomsNextTo}
                    onChange={(e) => setHotelPreferences(prev => ({ ...prev, roomsNextTo: e.target.value }))}
                    placeholder="Rooms next to..."
                    className="w-full rounded-lg border border-amber-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white"
                  />
                </div>
                <div className="mb-2">
                  <textarea
                    value={hotelPreferences.freeText}
                    onChange={(e) => setHotelPreferences(prev => ({ ...prev, freeText: e.target.value }))}
                    placeholder="Additional preferences (free text)"
                    rows={2}
                    className="w-full rounded-lg border border-amber-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    // TODO: Implement sending message to hotel
                    const preferencesList = Object.entries(hotelPreferences)
                      .filter(([key, value]) => key !== 'roomsNextTo' && key !== 'freeText' && value === true)
                      .map(([key]) => key.replace(/([A-Z])/g, ' $1').toLowerCase())
                      .join(', ');
                    
                    const message = `We have a reservation for ${hotelName}. Please confirm the reservation exists and consider the following preferences:

Room: ${hotelRoom || 'Not specified'}
Board: ${hotelBoard}
Bed Type: ${hotelBedType}
Preferences: ${preferencesList || 'None'}${hotelPreferences.roomsNextTo ? `\nRooms next to: ${hotelPreferences.roomsNextTo}` : ''}${hotelPreferences.freeText ? `\nAdditional: ${hotelPreferences.freeText}` : ''}`;
                    
                    // TODO: Send to Communication tab
                    alert(`Message to hotel:

${message}

(Will be saved to Communication tab)`);
                  }}
                  className="w-full px-3 py-2 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                >
                  📧 Send to Hotel
                </button>
              </div>
            </div>
          )}

          {/* Flight Schedule - show parsed segments */}
          {showFlightItinerary && flightSegments.length > 0 && (
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
                                <div className="text-[10px] text-gray-500">{seg.departureCity}</div>
                                <div className="text-sm font-semibold">{seg.departureTimeScheduled}</div>
                                {seg.departureTerminal && <div className="text-[10px] text-gray-400">{seg.departureTerminal.toLowerCase().startsWith("terminal") ? seg.departureTerminal : `T${seg.departureTerminal}`}</div>}
                              </div>
                              
                              <div className="flex-1 flex flex-col items-center px-2">
                                {(() => {
                                  // Use existing duration or calculate from times
                                  let displayDuration = seg.duration;
                                  if (!displayDuration && seg.departureTimeScheduled && seg.arrivalTimeScheduled) {
                                    const [depH, depM] = seg.departureTimeScheduled.split(":").map(Number);
                                    const [arrH, arrM] = seg.arrivalTimeScheduled.split(":").map(Number);
                                    let durationMins = (arrH * 60 + arrM) - (depH * 60 + depM);
                                    if (durationMins < 0) durationMins += 24 * 60; // Next day
                                    if (seg.departureDate && seg.arrivalDate && seg.departureDate !== seg.arrivalDate) {
                                      const days = Math.floor((new Date(seg.arrivalDate).getTime() - new Date(seg.departureDate).getTime()) / (1000 * 60 * 60 * 24));
                                      if (days > 0) durationMins += days * 24 * 60;
                                    }
                                    const hours = Math.floor(durationMins / 60);
                                    const mins = durationMins % 60;
                                    displayDuration = `${hours}h ${mins}m`;
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
                                <div className="text-xs text-gray-400">{formatDate(seg.arrivalDate)}</div>
                                <div className="font-medium">{seg.arrival}</div>
                                <div className="text-[10px] text-gray-500">{seg.arrivalCity}</div>
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
                              <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded" title={seg.baggage}>
                                🧳 {formatBaggageDisplay(seg.baggage)}
                              </span>
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
                        // Get timezone offsets for departure and arrival airports
                        const depTzOffset = getAirportTimezoneOffset(first.departure);
                        const arrTzOffset = getAirportTimezoneOffset(last.arrival);
                        
                        // Create dates in local time
                        const start = new Date(`${first.departureDate}T${first.departureTimeScheduled}`);
                        const end = new Date(`${last.arrivalDate}T${last.arrivalTimeScheduled}`);
                        
                        // Adjust for timezone difference (convert both to UTC)
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
          {category !== "Flight" && (
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
    </div>
  );
}
