"use client";

import React, { useState, useEffect, useCallback, useMemo, useImperativeHandle, forwardRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
// Ensure components are actual functions (fix ESM/CJS interop "got: object" error)
import AssignedTravellersModalModule from "./AssignedTravellersModal";
import AddServiceModalModule, { ServiceData } from "./AddServiceModal";

const AssignedTravellersModal = (typeof AssignedTravellersModalModule === "function"
  ? AssignedTravellersModalModule
  : (AssignedTravellersModalModule as { default?: React.ComponentType })?.default) as React.ComponentType<any>;
const AddServiceModal = (typeof AddServiceModalModule === "function"
  ? AddServiceModalModule
  : (AddServiceModalModule as { default?: React.ComponentType })?.default) as React.ComponentType<any>;
import DateRangePicker from "@/components/DateRangePicker";
import PartyCombobox from "./PartyCombobox";
import EditServiceModalNewModule from "./EditServiceModalNew";
import SplitServiceModal from "./SplitServiceModal";

const EditServiceModalNew = (typeof EditServiceModalNewModule === "function"
  ? EditServiceModalNewModule
  : (EditServiceModalNewModule as { default?: React.ComponentType })?.default) as React.ComponentType<any>;
import SplitModalMulti from "./SplitModalMulti";
import MergeServicesModal from "./MergeServicesModal";
import ConfirmModal from "@/components/ConfirmModal";
import ContentModal from "@/components/ContentModal";
import ChangeServiceModal from "./ChangeServiceModal";
import CancelServiceModal from "./CancelServiceModal";
import { FlightSegment } from "@/components/FlightItineraryInput";
import { Map as MapIcon, ClipboardList } from "lucide-react";
import TripMap from "@/components/TripMap";
import { CityWithCountry } from "@/components/CityMultiSelect";
import { getCityByName, getCityByIATA } from "@/lib/data/cities";
import { getCategoryTypeFromName } from "@/lib/invoices/generateInvoiceHTML";
import { orderCodeToSlug } from "@/lib/orders/orderCode";
import ItineraryTabs from "./ItineraryTabs";
import SmartHintRow from "./SmartHintRow";
import ItineraryTimeline, { SelectedBoardingPass } from "./ItineraryTimeline";
import { 
  getRefundPolicyBadge, 
  getDeadlineUrgency, 
  formatDeadlineFull,
  calculateInternalDeadline,
  getEarliestDeadline,
  getRefundPolicyLabel,
  getPriceTypeLabel
} from "@/lib/services/deadlineCalculator";
import { getServiceDisplayName } from "@/lib/services/serviceDisplayName";
import { generateSmartHints, SmartHint, ServiceForHint } from "@/lib/itinerary/smartHints";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";

interface Traveller {
  id: string;
  firstName: string;
  lastName: string;
  title: "Mr" | "Mrs" | "Chd";
  dob?: string;
  personalCode?: string;
  contactNumber?: string;
}

// Functional types that determine which features are available
type CategoryType = 'flight' | 'hotel' | 'transfer' | 'tour' | 'insurance' | 'visa' | 'rent_a_car' | 'cruise' | 'other';

interface Service {
  id: string;
  dateFrom: string;
  dateTo: string;
  category: string;
  categoryId?: string | null;
  categoryType?: string | null;
  vatRate?: number | null;
  name: string;
  supplier: string;
  client: string;
  payer: string;
  supplierPartyId?: string;
  payerPartyId?: string;
  clientPartyId?: string;
  supplier_party_id?: string;
  client_party_id?: string;
  payer_party_id?: string;
  servicePrice: number;
  clientPrice: number;
  serviceCurrency?: string | null;
  servicePriceForeign?: number | null;
  exchangeRate?: number | null;
  actuallyPaid?: number | null;
  quantity?: number; // Units or nights for PRICING multiply (default 1)
  resStatus: "draft" | "booked" | "confirmed" | "changed" | "rejected" | "cancelled";
  refNr?: string;
  ticketNr?: string;
  ticketNumbers?: { clientId: string; clientName: string; ticketNr: string }[];
  assignedTravellerIds: string[];
  invoice_id?: string | null;
  splitGroupId?: string | null;
  // Hotel-specific
  hotelName?: string;
  hotelStarRating?: string | null;
  hotelRoom?: string | null;
  hotelBoard?: string | null;
  hotelBedType?: "king_queen" | "twin" | "not_guaranteed" | string | null;
  mealPlanText?: string | null;
  transferType?: string | null;
  additionalServices?: string | null;
  hotelAddress?: string;
  hotelPhone?: string;
  hotelEmail?: string;
  hotelEarlyCheckIn?: boolean | null;
  hotelEarlyCheckInTime?: string | null;
  hotelLateCheckIn?: boolean | null;
  hotelLateCheckInTime?: string | null;
  hotelRoomUpgrade?: boolean | null;
  hotelLateCheckOut?: boolean | null;
  hotelLateCheckOutTime?: string | null;
  hotelHigherFloor?: boolean | null;
  hotelKingSizeBed?: boolean | null;
  hotelHoneymooners?: boolean | null;
  hotelSilentRoom?: boolean | null;
  hotelRepeatGuests?: boolean | null;
  hotelRoomsNextTo?: string | null;
  hotelParking?: boolean | null;
  hotelPreferencesFreeText?: string | null;
  supplierBookingType?: string | null;
  // Transfer-specific
  pickupLocation?: string;
  dropoffLocation?: string;
  pickupTime?: string;
  estimatedDuration?: string;
  linkedFlightId?: string;
  transferRoutes?: { pickup: string; pickupType?: string; pickupMeta?: { iata?: string }; dropoff: string; dropoffType?: string; dropoffMeta?: { iata?: string }; pickupTime?: string; distanceKm?: number; durationMin?: number; bookingType?: string; hours?: number; linkedFlightId?: string }[];
  transferMode?: string | null;
  vehicleClass?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  driverNotes?: string | null;
  // Flight-specific
  flightSegments?: FlightSegment[];
  boardingPasses?: { id: string; fileName: string; fileUrl: string; clientId: string; clientName: string; uploadedAt: string }[];
  baggage?: string; // Baggage info
  cabinClass?: "economy" | "premium_economy" | "business" | "first";
  /** Flight: per-client cost/marge/sale (from API pricing_per_client) */
  pricingPerClient?: { cost: number; marge: number; sale: number }[] | null;
  // Terms & Conditions
  priceType?: "ebd" | "regular" | "spo" | null;
  /** Hotel only: 'night' = price × nights, 'stay' = total for stay */
  hotelPricePer?: "night" | "stay" | null;
  refundPolicy?: "non_ref" | "refundable" | "fully_ref" | null;
  paymentDeadlineDeposit?: string | null;
  paymentDeadlineFinal?: string | null;
  paymentTerms?: string | null;
  freeCancellationUntil?: string | null;
  cancellationPenaltyAmount?: number | null;
  cancellationPenaltyPercent?: number | null;
  // Amendment fields (change/cancellation)
  parentServiceId?: string | null;
  serviceType?: "original" | "change" | "cancellation";
  cancellationFee?: number | null;
  refundAmount?: number | null;
  changeFee?: number | null;
  // Tour
  commissionName?: string | null;
  commissionRate?: number | null;
  commissionAmount?: number | null;
  agentDiscountValue?: number | null;
  agentDiscountType?: "%" | "€" | null;
  /** Tour: Extra line items (Agent discount etc.) */
  servicePriceLineItems?: { description: string; amount: number; commissionable: boolean }[];
}

// Fallback when API is unavailable (for "What service?" chooser)
const CHOOSE_CATEGORY_FALLBACK: { id: string; name: string; type: string; vat_rate?: number }[] = [
  { id: "fallback-flight", name: "Flight", type: "flight", vat_rate: 0 },
  { id: "fallback-hotel", name: "Hotel", type: "hotel", vat_rate: 21 },
  { id: "fallback-transfer", name: "Transfer", type: "transfer", vat_rate: 21 },
  { id: "fallback-tour", name: "Package Tour", type: "tour", vat_rate: 21 },
  { id: "fallback-insurance", name: "Insurance", type: "insurance", vat_rate: 21 },
  { id: "fallback-visa", name: "Visa", type: "visa", vat_rate: 21 },
  { id: "fallback-rent_a_car", name: "Rent a Car", type: "rent_a_car", vat_rate: 21 },
  { id: "fallback-cruise", name: "Cruise", type: "cruise", vat_rate: 21 },
  { id: "fallback-other", name: "Other", type: "other", vat_rate: 21 },
];

function ChooseServiceTypeModal({
  categories,
  onSelect,
  onClose,
}: {
  categories: { id: string; name: string; type?: string; vat_rate?: number }[];
  onSelect: (categoryId: string, category?: { id: string; name: string; type?: string; vat_rate?: number }) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">What service are you adding?</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelect(cat.id, cat)}
              className="flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-800"
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TransferTypeChooserPopup({
  onSelect,
  onClose,
}: {
  onSelect: (type: "one_way" | "return" | "by_hour") => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Transfer type</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">Choose type so we can suggest Linked Services correctly.</p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onSelect("one_way")}
            className="flex items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800"
          >
            One way
          </button>
          <button
            type="button"
            onClick={() => onSelect("return")}
            className="flex items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800"
          >
            Return Transfer
          </button>
          <button
            type="button"
            onClick={() => onSelect("by_hour")}
            className="flex items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800"
          >
            By the hour
          </button>
        </div>
      </div>
    </div>
  );
}

function toTitleCase(str: string): string {
  return str
    .trim()
    .split(/\s+/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

// Format hotel/tour name: Title Case hotel + " 5*" + Title Case room + meal (parsed text for Package Tour, else board labels)
function formatHotelDisplayName(s: { hotelName?: string; hotelStarRating?: string | null; hotelRoom?: string | null; hotelBoard?: string | null; mealPlanText?: string | null }, fallback: string): string {
  const name = (s.hotelName || "").trim();
  const parts: string[] = [];
  if (name) parts.push(toTitleCase(name));
  if (s.hotelStarRating?.trim()) parts.push(`${s.hotelStarRating.trim().replace(/\*/g, "")}*`);
  if (s.hotelRoom?.trim()) parts.push(toTitleCase(s.hotelRoom.trim()));
  const boardLabels: Record<string, string> = {
    room_only: "Room Only",
    breakfast: "Breakfast",
    half_board: "Half Board",
    full_board: "Full Board",
    all_inclusive: "All Inclusive",
  };
  const board = s.mealPlanText?.trim()
    ? toTitleCase(s.mealPlanText.trim())
    : s.hotelBoard
      ? boardLabels[String(s.hotelBoard)] || toTitleCase(String(s.hotelBoard))
      : null;
  if (board) parts.push(board);
  return parts.length > 0 ? parts.join(" · ").replace(/\* · /g, "*· ") : toTitleCase(fallback);
}

export interface OrderServicesBlockHandle {
  triggerAddService: () => void;
}

interface OrderServicesBlockProps {
  orderCode: string;
  defaultClientId?: string | null;
  defaultClientName?: string;
  orderDateFrom?: string | null;
  orderDateTo?: string | null;
  onIssueInvoice?: (services: any[]) => void;
  itineraryDestinations?: CityWithCountry[];
  orderSource?: 'TA' | 'TO' | 'CORP' | 'NON';
  /** Company default currency from Company Settings / Regional Settings / Currency; passed to Add/Edit service modals */
  companyCurrencyCode?: string;
  onDestinationsFromServices?: (destinations: CityWithCountry[]) => void;
  onTotalsChanged?: (totals: { amount_total: number; profit_estimated: number }) => void;
  stickyTopOffset?: number;
}

const OrderServicesBlock = forwardRef<OrderServicesBlockHandle, OrderServicesBlockProps>(function OrderServicesBlock({ 
  orderCode,
  defaultClientId,
  defaultClientName,
  orderDateFrom,
  orderDateTo,
  onIssueInvoice,
  itineraryDestinations = [],
  orderSource = 'NON',
  companyCurrencyCode = 'EUR', // fallback; parent (order page) passes from Company Settings / Regional Settings / Currency
  onDestinationsFromServices,
  onTotalsChanged,
  stickyTopOffset = 0,
}, ref) {
  const router = useRouter();
  const [orderTravellers, setOrderTravellers] = useState<Traveller[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [modalServiceId, setModalServiceId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showChooseCategoryModal, setShowChooseCategoryModal] = useState(false);
  const [addServiceCategoryId, setAddServiceCategoryId] = useState<string | null>(null);
  const [addServiceCategoryType, setAddServiceCategoryType] = useState<string | null>(null);
  const [addServiceCategoryName, setAddServiceCategoryName] = useState<string | null>(null);
  const [addServiceCategoryVatRate, setAddServiceCategoryVatRate] = useState<number | null>(null);
  const [addServiceTransferBookingType, setAddServiceTransferBookingType] = useState<"one_way" | "return" | "by_hour" | null>(null);
  const [showTransferTypePopup, setShowTransferTypePopup] = useState(false);
  const [serviceCategories, setServiceCategories] = useState<{ id: string; name: string; type?: string; vat_rate?: number }[]>([]);
  const [pendingOpenChooseModal, setPendingOpenChooseModal] = useState(false);
  const [editServiceId, setEditServiceId] = useState<string | null>(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  
  // Cancelled filter with localStorage persistence
  const [hideCancelled, setHideCancelled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('travel-cms:hide-cancelled-services') === 'true';
    }
    return false;
  });
  
  // Traveller filter for itinerary tabs
  const [selectedTravellerId, setSelectedTravellerId] = useState<string | null>(null);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [filterPayer, setFilterPayer] = useState("");
  const filterMenuRef = React.useRef<HTMLDivElement>(null);
  const [contentModal, setContentModal] = useState<{ url: string; title: string } | null>(null);

  useImperativeHandle(ref, () => ({
    triggerAddService: () => {
      if (serviceCategories.length > 0) {
        setShowChooseCategoryModal(true);
      } else {
        setPendingOpenChooseModal(true);
      }
    },
  }), [serviceCategories]);

  const getDisplayClient = useCallback((s: Service) =>
    (s.assignedTravellerIds?.length && orderTravellers.length)
      ? orderTravellers.filter((t) => s.assignedTravellerIds!.includes(t.id)).map((t) => `${(t.firstName || "").trim()} ${(t.lastName || "").trim()}`.trim()).filter(Boolean).join(", ") || s.client
      : s.client,
  [orderTravellers]);

  // Filter services based on cancelled, traveller, and column filters
  const visibleServices = useMemo(() => {
    return services.filter(s => {
      if (hideCancelled && s.resStatus === 'cancelled') return false;
      if (selectedTravellerId && !s.assignedTravellerIds.includes(selectedTravellerId)) return false;
      if (filterCategory && s.category !== filterCategory) return false;
      if (filterSupplier && s.supplier !== filterSupplier) return false;
      if (filterClient && getDisplayClient(s) !== filterClient) return false;
      if (filterPayer && s.payer !== filterPayer) return false;
      return true;
    });
  }, [services, hideCancelled, selectedTravellerId, filterCategory, filterSupplier, filterClient, filterPayer, getDisplayClient]);

  const filterOptions = useMemo(() => {
    const categories = [...new Set(services.map(s => s.category).filter(Boolean))].sort();
    const suppliers = [...new Set(services.map(s => s.supplier).filter(s => s && s !== "-"))].sort();
    const clients = [...new Set(services.map(s => getDisplayClient(s)).filter(Boolean))].sort();
    const payers = [...new Set(services.map(s => s.payer).filter(s => s && s !== "-"))].sort();
    return { categories, suppliers, clients, payers };
  }, [services, getDisplayClient]);

  const hasActiveFilters = !!(filterCategory || filterSupplier || filterClient || filterPayer);
  const clearFilters = () => { setFilterCategory(""); setFilterSupplier(""); setFilterClient(""); setFilterPayer(""); };

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (filterMenuOpen && filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) setFilterMenuOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [filterMenuOpen]);

  // Get visible services without invoice for "select all" functionality (excluding cancelled)
  const visibleServicesWithoutInvoice = useMemo(() => {
    return visibleServices.filter(s => !s.invoice_id && s.resStatus !== 'cancelled').map(s => s.id);
  }, [visibleServices]);
  
  // Filter out cancelled and invoiced services from selectedServiceIds (can't invoice again while invoice is active)
  useEffect(() => {
    setSelectedServiceIds(prev => prev.filter(id => {
      const service = services.find(s => s.id === id);
      return service && service.resStatus !== 'cancelled' && !service.invoice_id;
    }));
  }, [services]);
  
  // Check if all visible services without invoice are selected
  const allNonInvoicedSelected = useMemo(() => {
    if (visibleServicesWithoutInvoice.length === 0) return false;
    return visibleServicesWithoutInvoice.every(id => selectedServiceIds.includes(id));
  }, [visibleServicesWithoutInvoice, selectedServiceIds]);
  
  // Handle "select all" checkbox - only for visible services
  const handleSelectAllNonInvoiced = (checked: boolean) => {
    if (checked) {
      // Select all visible services without invoice
      setSelectedServiceIds(prev => {
        const newIds = [...prev];
        visibleServicesWithoutInvoice.forEach(id => {
          const service = services.find(s => s.id === id);
          // Double check: don't add cancelled services
          if (service && service.resStatus !== 'cancelled' && !newIds.includes(id)) {
            newIds.push(id);
          }
        });
        return newIds;
      });
    } else {
      // Deselect all visible services without invoice
      setSelectedServiceIds(prev => prev.filter(id => !visibleServicesWithoutInvoice.includes(id)));
    }
  };
  
  const [splitMultiModalOpen, setSplitMultiModalOpen] = useState(false);
  const [splitServiceId, setSplitServiceId] = useState<string | null>(null);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [duplicateConfirmService, setDuplicateConfirmService] = useState<Service | null>(null);
  const [cancelConfirmService, setCancelConfirmService] = useState<Service | null>(null);
  // New modals for change/cancellation with fees
  const [changeModalService, setChangeModalService] = useState<Service | null>(null);
  const [cancelModalService, setCancelModalService] = useState<Service | null>(null);
  
  // Bulk actions state
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkAction, setBulkAction] = useState<string | null>(null);
  const bulkActionsRef = React.useRef<HTMLDivElement>(null);
  const [bulkSearchQuery, setBulkSearchQuery] = useState("");
  const [bulkSearchResults, setBulkSearchResults] = useState<Array<{ id: string; displayName: string; type: string }>>([]);
  const [bulkSearchLoading, setBulkSearchLoading] = useState(false);
  const [bulkSelectedClients, setBulkSelectedClients] = useState<Array<{ id: string; displayName: string }>>([]);
  const [geocodedCoords, setGeocodedCoords] = useState<Record<string, { lat: number; lng: number }>>({});
  
  // Draggable floating bar state
  const [floatingBarPosition, setFloatingBarPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = React.useRef<{ x: number; y: number; barX: number; barY: number } | null>(null);
  const floatingBarRef = React.useRef<HTMLDivElement>(null);
  
  // Handle drag
  React.useEffect(() => {
    if (!isDragging) return;
    
    // Prevent text selection while dragging
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      e.preventDefault();
      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;
      setFloatingBarPosition({
        x: dragStartRef.current.barX + deltaX,
        y: dragStartRef.current.barY + deltaY,
      });
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging]);
  
  const handleDragStart = (e: React.MouseEvent) => {
    // Don't start drag on buttons
    if ((e.target as HTMLElement).closest('button')) return;
    
    e.preventDefault();
    
    const bar = floatingBarRef.current;
    if (!bar) return;
    
    const currentX = floatingBarPosition?.x ?? (window.innerWidth / 2);
    const currentY = floatingBarPosition?.y ?? (window.innerHeight - 60);
    
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      barX: currentX,
      barY: currentY,
    };
    setIsDragging(true);
    
    // Initialize position if not set
    if (!floatingBarPosition) {
      setFloatingBarPosition({ x: currentX, y: currentY });
    }
  };
  
  // Track Ctrl key and hovered party for Ctrl+click navigation hint
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [hoveredPartyId, setHoveredPartyId] = useState<string | null>(null);
  
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) setIsCtrlPressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) setIsCtrlPressed(false);
    };
    const handleBlur = () => setIsCtrlPressed(false);
    
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);
  
  // Close bulk actions dropdown on outside click
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bulkActionsRef.current && !bulkActionsRef.current.contains(event.target as Node)) {
        setShowBulkActions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  const toggleHideCancelled = () => {
    const newValue = !hideCancelled;
    setHideCancelled(newValue);
    if (typeof window !== 'undefined') {
      localStorage.setItem('travel-cms:hide-cancelled-services', String(newValue));
    }
  };
  
  // Multi-select boarding passes across services
  const [selectedBoardingPasses, setSelectedBoardingPasses] = useState<SelectedBoardingPass[]>([]);
  
  const handleToggleBoardingPassSelection = useCallback((pass: SelectedBoardingPass) => {
    setSelectedBoardingPasses(prev => {
      const exists = prev.some(p => p.passId === pass.passId);
      if (exists) {
        return prev.filter(p => p.passId !== pass.passId);
      } else {
        return [...prev, pass];
      }
    });
  }, []);

  const handleClearBoardingPassSelection = useCallback(() => {
    setSelectedBoardingPasses([]);
  }, []);

  const handleSendSelectedBoardingPasses = useCallback(async (method: "whatsapp" | "email") => {
    if (selectedBoardingPasses.length === 0) return;
    
    try {
      const files: File[] = [];
      for (const pass of selectedBoardingPasses) {
        try {
          const response = await fetch(pass.fileUrl);
          const blob = await response.blob();
          const ext = pass.fileName.split(".").pop()?.toLowerCase();
          let mimeType = blob.type;
          if (ext === "pkpass") mimeType = "application/vnd.apple.pkpass";
          else if (ext === "pdf") mimeType = "application/pdf";
          files.push(new File([blob], pass.fileName, { type: mimeType }));
        } catch (err) {
          console.error("Failed to download:", pass.fileName, err);
        }
      }

      if (files.length === 0) {
        alert("Failed to download files");
        return;
      }

      // Try Web Share API (works on mobile)
      if (navigator.share && navigator.canShare?.({ files })) {
        await navigator.share({
          title: "Boarding Passes",
          text: `Boarding Passes: ${selectedBoardingPasses.map(p => p.flightNumber).filter((v, i, a) => a.indexOf(v) === i).join(", ")}`,
          files,
        });
        handleClearBoardingPassSelection();
        return;
      }

      // Desktop fallback: download files first
      for (const file of files) {
        const url = window.URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }

      const fileNames = selectedBoardingPasses.map(p => p.fileName).join(", ");
      
      if (method === "whatsapp") {
        alert(`Files downloaded: ${fileNames}\n\nOpen WhatsApp and attach the downloaded files.`);
        setContentModal({ url: "https://web.whatsapp.com/", title: "WhatsApp" });
      } else {
        const flights = selectedBoardingPasses.map(p => p.flightNumber).filter((v, i, a) => a.indexOf(v) === i).join(", ");
        window.location.href = `mailto:?subject=${encodeURIComponent(`Boarding Passes - ${flights}`)}`;
        alert(`Files downloaded: ${fileNames}\n\nAttach them to your email.`);
      }
      
      handleClearBoardingPassSelection();
    } catch (err) {
      console.error("Share failed:", err);
    }
  }, [selectedBoardingPasses, handleClearBoardingPassSelection]);
  
  // Calculate service count by traveller
  const serviceCountByTraveller = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const service of services) {
      if (hideCancelled && service.resStatus === 'cancelled') continue;
      for (const tid of service.assignedTravellerIds) {
        counts[tid] = (counts[tid] || 0) + 1;
      }
    }
    return counts;
  }, [services, hideCancelled]);
  
  // Map route points — FIXED. See .ai/specs/itinerary-map-spec.md
  // Origin = where they fly FROM. Destinations = where they go. Full path = origin + each arrival.
  const mapRoutePoints = useMemo(() => {
    const routePoints: CityWithCountry[] = [];
    const seenCities = new Set<string>();
    
    const activeServices = services.filter(s => {
      if (s.resStatus === "cancelled") return false;
      if (selectedTravellerId && !s.assignedTravellerIds.includes(selectedTravellerId)) return false;
      return true;
    });
    
    const flightServices = activeServices
      .filter(s => {
        const cat = (s.category || "").toLowerCase();
        const isFlight = cat.includes("flight") || cat.includes("air ticket") || cat.includes("tour");
        return isFlight && s.flightSegments && s.flightSegments.length > 0;
      })
      .sort((a, b) => {
        const dateA = a.flightSegments?.[0]?.departureDate || a.dateFrom;
        const dateB = b.flightSegments?.[0]?.departureDate || b.dateFrom;
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      });
    
    const allSegments: Array<{
      arrival: string;
      arrivalCity?: string;
      arrivalDate: string;
      arrivalTime: string;
      departure: string;
      departureDate: string;
      departureTime: string;
    }> = [];
    for (const service of flightServices) {
      for (const seg of service.flightSegments || []) {
        const s = seg as unknown as Record<string, unknown>;
        allSegments.push({
          arrival: String(s.arrival ?? ""),
          arrivalCity: (s.arrivalCity ?? s.arrival_city) as string | undefined,
          arrivalDate: String(s.arrivalDate ?? s.arrival_date ?? ""),
          arrivalTime: String(s.arrivalTimeScheduled ?? s.arrival_time_scheduled ?? s.arrivalTime ?? s.arrival_time ?? ""),
          departure: String(s.departure ?? ""),
          departureDate: String(s.departureDate ?? s.departure_date ?? ""),
          departureTime: String(s.departureTimeScheduled ?? s.departure_time_scheduled ?? s.departureTime ?? s.departure_time ?? ""),
        });
      }
    }
    allSegments.sort((a, b) => {
      const dateTimeA = new Date(`${a.departureDate}T${a.departureTime}`);
      const dateTimeB = new Date(`${b.departureDate}T${b.departureTime}`);
      return dateTimeA.getTime() - dateTimeB.getTime();
    });
    
    // Full route: origin (first departure) + each arrival (TLL, FRA, NCE, FRA, TLL)
    if (allSegments.length > 0) {
      const depCode = allSegments[0].departure; // Origin = where they fly FROM
      if (depCode) {
        const cityData = getCityByIATA(depCode) || getCityByName(allSegments[0].departure);
        if (cityData) {
          routePoints.push({
            city: cityData.name,
            country: cityData.country || "",
            countryCode: cityData.countryCode,
            lat: cityData.lat,
            lng: cityData.lng,
          });
        }
      }
      for (const seg of allSegments) {
        const arrCode = seg.arrival; // Destinations + transits
        if (arrCode) {
          const cityData = getCityByIATA(arrCode) || getCityByName(seg.arrivalCity || seg.arrival);
          if (cityData) {
            routePoints.push({
              city: cityData.name,
              country: cityData.country || "",
              countryCode: cityData.countryCode,
              lat: cityData.lat,
              lng: cityData.lng,
            });
          }
        }
      }
    }
    
    if (routePoints.length === 0) {
      const flightNoSegments = activeServices.filter(s => {
        const cat = (s.category || "").toLowerCase();
        const isFlight = cat.includes("flight") || cat.includes("air ticket") || cat.includes("tour");
        return isFlight && (!s.flightSegments || s.flightSegments.length === 0) && s.name;
      });
      for (const service of flightNoSegments) {
        const parsed = parseRouteFromName(service.name);
        if (parsed && parsed.length >= 2) {
          routePoints.push(parsed[0], parsed[1]);
          break;
        }
      }
    }
    
    if (routePoints.length === 0) {
      const cat = (s: { category?: string }) => (s.category || "").trim().toLowerCase();
      const hotelServices = activeServices.filter(s =>
        cat(s) === "hotel" || (cat(s) === "tour" && (s as { hotelName?: string }).hotelName)
      );
      for (const hotel of hotelServices) {
        const rawName = (hotel as { hotelName?: unknown; hotel_name?: unknown }).hotelName
          ?? (hotel as { hotel_name?: unknown }).hotel_name ?? hotel.name ?? hotel.supplier ?? "";
        const rawAddr = (hotel as { hotelAddress?: unknown; hotel_address?: unknown }).hotelAddress
          ?? (hotel as { hotel_address?: unknown }).hotel_address ?? "";
        const hotelName = (typeof rawName === "string" ? rawName : String(rawName || "")).trim();
        const hotelAddress = (typeof rawAddr === "string" ? rawAddr : String(rawAddr || "")).trim();
        const query = hotelAddress || hotelName;
        if (!query) continue;
        const key = `${hotel.id}|${query}`;
        const coords = geocodedCoords[key];
        if (!coords) continue;
        routePoints.push({
          city: [hotelName, hotelAddress].filter(Boolean).join(" — ") || query,
          country: "",
          countryCode: undefined,
          lat: coords.lat,
          lng: coords.lng,
        });
      }
    }
    
    // Don't fall back to itineraryDestinations when all services are cancelled
    if (routePoints.length > 0) return routePoints;
    const hasActiveServices = services.some(s => s.resStatus !== "cancelled");
    return hasActiveServices ? itineraryDestinations : [];
  }, [services, itineraryDestinations, selectedTravellerId, geocodedCoords]);

  // Geocode hotel addresses via Nominatim when no flight route (so map shows hotel points)
  const geocodedCacheRef = React.useRef<Record<string, { lat: number; lng: number }>>({});

  useEffect(() => {
    const activeServices = services.filter(s => {
      if (s.resStatus === "cancelled") return false;
      if (selectedTravellerId && !s.assignedTravellerIds.includes(selectedTravellerId)) return false;
      return true;
    });
    const cat = (s: { category?: string }) => (s.category || "").trim().toLowerCase();
    const hotelServices = activeServices.filter(s =>
      cat(s) === "hotel" || (cat(s) === "tour" && (s as { hotelName?: string }).hotelName)
    );
    let cancelled = false;
    (async () => {
      const batch: Record<string, { lat: number; lng: number }> = {};
      for (const hotel of hotelServices) {
        if (cancelled) break;
        const rawName = (hotel as { hotelName?: unknown; hotel_name?: unknown }).hotelName
          ?? (hotel as { hotel_name?: unknown }).hotel_name ?? hotel.name ?? hotel.supplier ?? "";
        const rawAddr = (hotel as { hotelAddress?: unknown; hotel_address?: unknown }).hotelAddress
          ?? (hotel as { hotel_address?: unknown }).hotel_address ?? "";
        const hotelName = (typeof rawName === "string" ? rawName : String(rawName || "")).trim();
        const hotelAddress = (typeof rawAddr === "string" ? rawAddr : String(rawAddr || "")).trim();
        const query = (hotelAddress || hotelName).trim();
        if (!query) continue;
        const key = `${hotel.id}|${query}`;
        if (geocodedCacheRef.current[key]) {
          batch[key] = geocodedCacheRef.current[key];
          continue;
        }
        try {
          const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, { credentials: "include" });
          if (cancelled) break;
          if (!res.ok) continue;
          const json = await res.json();
          const lat = json?.data?.lat;
          const lng = json?.data?.lng;
          if (typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng)) {
            geocodedCacheRef.current[key] = { lat, lng };
            batch[key] = { lat, lng };
          }
        } catch {
          // ignore
        }
        await new Promise(r => setTimeout(r, 1100));
      }
      if (!cancelled && Object.keys(batch).length > 0) {
        setGeocodedCoords(prev => ({ ...prev, ...batch }));
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, selectedTravellerId]);

  // Colors for different travellers
  const ROUTE_COLORS = [
    "#3b82f6", // blue
    "#ef4444", // red
    "#22c55e", // green
    "#f59e0b", // amber
    "#8b5cf6", // purple
    "#ec4899", // pink
    "#14b8a6", // teal
    "#f97316", // orange
  ];

  // Helper: get route key from destinations (for grouping identical routes)
  const getRouteKey = (destinations: CityWithCountry[]): string => {
    return destinations.map(d => `${d.city}|${d.countryCode || ""}`).join("→");
  };

  // Parse "Origin - Destination" from flight service name (e.g. "03.02 Nice-Côte d'Azur - London Heathrow")
  function parseRouteFromName(name: string): CityWithCountry[] | null {
    const parts = name.split(/\s*-\s*/).map(p => p.trim());
    if (parts.length < 2) return null;
    let originStr = parts[0];
    const destStr = parts[parts.length - 1];
    if (originStr.match(/^\d{1,2}\.\d{1,2}\.(?:\d{2})?\d{0,2}\s+/)) {
      originStr = originStr.replace(/^\d{1,2}\.\d{1,2}\.(?:\d{2})?\d{0,2}\s+/, "").trim();
    }
    const originCity = getCityByName(originStr) || (originStr.length <= 4 ? getCityByIATA(originStr) : undefined);
    const destCity = getCityByName(destStr) || getCityByName(destStr.replace(/\s+(Airport|Heathrow|Airport)$/i, "").trim()) || (destStr.length <= 4 ? getCityByIATA(destStr) : undefined);
    if (!originCity || !destCity) return null;
    return [
      { city: originCity.name, country: originCity.country || "", countryCode: originCity.countryCode, lat: originCity.lat, lng: originCity.lng },
      { city: destCity.name, country: destCity.country || "", countryCode: destCity.countryCode, lat: destCity.lat, lng: destCity.lng },
    ];
  }

  // Helper: build full flight route for a traveller
  // Origin (first departure) = where they fly FROM. Destinations = where they go (incl. transits like Frankfurt)
  const buildTravellerRoute = (travellerId: string): CityWithCountry[] => {
    const routePoints: CityWithCountry[] = [];
    const seenCities = new Set<string>();
    
    const travellerServices = services.filter(s => 
      s.resStatus !== "cancelled" && s.assignedTravellerIds.includes(travellerId)
    );
    
    const flightServices = travellerServices
      .filter(s => {
        const cat = (s.category || "").toLowerCase();
        const isFlight = cat.includes("flight") || cat.includes("air ticket") || cat.includes("tour");
        return isFlight && s.flightSegments && s.flightSegments.length > 0;
      })
      .sort((a, b) => {
        const dateA = a.flightSegments?.[0]?.departureDate || a.dateFrom;
        const dateB = b.flightSegments?.[0]?.departureDate || b.dateFrom;
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      });
    
    const allSegments: Array<{
      arrival: string;
      arrivalCity?: string;
      arrivalDate: string;
      arrivalTime: string;
      departure: string;
      departureDate: string;
      departureTime: string;
    }> = [];
    for (const service of flightServices) {
      for (const seg of service.flightSegments || []) {
        const s = seg as unknown as Record<string, unknown>;
        allSegments.push({
          arrival: String(s.arrival ?? ""),
          arrivalCity: (s.arrivalCity ?? s.arrival_city) as string | undefined,
          arrivalDate: String(s.arrivalDate ?? s.arrival_date ?? ""),
          arrivalTime: String(s.arrivalTimeScheduled ?? s.arrival_time_scheduled ?? s.arrivalTime ?? s.arrival_time ?? ""),
          departure: String(s.departure ?? ""),
          departureDate: String(s.departureDate ?? s.departure_date ?? ""),
          departureTime: String(s.departureTimeScheduled ?? s.departure_time_scheduled ?? s.departureTime ?? s.departure_time ?? ""),
        });
      }
    }
    allSegments.sort((a, b) => {
      const dateTimeA = new Date(`${a.departureDate}T${a.departureTime}`);
      const dateTimeB = new Date(`${b.departureDate}T${b.departureTime}`);
      return dateTimeA.getTime() - dateTimeB.getTime();
    });
    
    // Full route: origin (first departure) + each arrival (TLL, FRA, NCE, FRA, TLL)
    if (allSegments.length > 0) {
      const depCode = allSegments[0].departure; // Origin = where they fly FROM
      if (depCode) {
        const cityData = getCityByIATA(depCode) || getCityByName(allSegments[0].departure);
        if (cityData) {
          routePoints.push({
            city: cityData.name,
            country: cityData.country || "",
            countryCode: cityData.countryCode,
            lat: cityData.lat,
            lng: cityData.lng,
          });
        }
      }
      for (const seg of allSegments) {
        const arrCode = seg.arrival; // Destinations + transits
        if (arrCode) {
          const cityData = getCityByIATA(arrCode) || getCityByName(seg.arrivalCity || seg.arrival);
          if (cityData) {
            routePoints.push({
              city: cityData.name,
              country: cityData.country || "",
              countryCode: cityData.countryCode,
              lat: cityData.lat,
              lng: cityData.lng,
            });
          }
        }
      }
    }
    
    if (routePoints.length === 0) {
      const hotelServices = travellerServices.filter(s => 
        (s.category === "Hotel" || s.category === "Tour") && s.dateFrom && s.dateTo
      );
      for (const hotel of hotelServices) {
        if (hotel.dateFrom && hotel.dateTo) {
          const checkIn = new Date(hotel.dateFrom);
          const checkOut = new Date(hotel.dateTo);
          const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
          if (nights >= 1) {
            const hotelCity = (hotel as { hotelName?: string }).hotelName?.split(",")[0]?.trim()
              || hotel.name?.split(",")[0]?.trim()
              || hotel.supplier?.split(",")[0]?.trim();
            if (hotelCity && !seenCities.has(hotelCity.toLowerCase())) {
              seenCities.add(hotelCity.toLowerCase());
              const cityData = getCityByName(hotelCity);
              if (cityData) {
                routePoints.push({
                  city: cityData.name,
                  country: cityData.country || "",
                  countryCode: cityData.countryCode,
                  lat: cityData.lat,
                  lng: cityData.lng,
                });
              }
            }
          }
        }
      }
    }
    
    return routePoints;
  };

  // Build routes for each traveller (for multi-route map)
  // Group travellers with identical routes under one color
  const travellerRoutes = useMemo(() => {
    // If a specific traveller is selected, show only their route with legend
    if (selectedTravellerId) {
      const traveller = orderTravellers.find(t => t.id === selectedTravellerId);
      if (!traveller) return [];
      
      const destinations = buildTravellerRoute(selectedTravellerId);
      if (destinations.length === 0) return [];
      
      return [{
        travellerId: traveller.id,
        travellerName: `${traveller.firstName} ${traveller.lastName}`,
        color: ROUTE_COLORS[0],
        destinations,
      }];
    }
    
    const travellersWithServices = orderTravellers.filter(t => 
      services.some(s => s.resStatus !== "cancelled" && s.assignedTravellerIds.includes(t.id))
    );
    
    if (travellersWithServices.length === 0) {
      return [];
    }
    
    // Build destinations for each traveller and group by route
    const routeGroups = new Map<string, {
      travellerIds: string[];
      travellerNames: string[];
      destinations: CityWithCountry[];
    }>();
    
    for (const traveller of travellersWithServices) {
      const destinations = buildTravellerRoute(traveller.id);
      if (destinations.length === 0) continue;
      
      const routeKey = getRouteKey(destinations);
      const existing = routeGroups.get(routeKey);
      
      if (existing) {
        existing.travellerIds.push(traveller.id);
        existing.travellerNames.push(`${traveller.firstName} ${traveller.lastName}`);
      } else {
        routeGroups.set(routeKey, {
          travellerIds: [traveller.id],
          travellerNames: [`${traveller.firstName} ${traveller.lastName}`],
          destinations,
        });
      }
    }
    
    // Convert groups to routes with colors
    return Array.from(routeGroups.values()).map((group, idx) => ({
      travellerId: group.travellerIds.join(","),
      travellerName: group.travellerNames.join(", "),
      color: ROUTE_COLORS[idx % ROUTE_COLORS.length],
      destinations: group.destinations,
    }));
  }, [services, orderTravellers, selectedTravellerId]);

  const { travellerIdToColor, routeColorsUsed } = useMemo(() => {
    const idToColor: Record<string, string> = {};
    const used: string[] = [];
    for (const r of travellerRoutes) {
      used.push(r.color);
      for (const id of r.travellerId.split(",").map((s) => s.trim()).filter(Boolean)) {
        idToColor[id] = r.color;
      }
    }
    return { travellerIdToColor: idToColor, routeColorsUsed: used };
  }, [travellerRoutes]);
  
  // Smart hints state - load from localStorage
  const dismissedHintsKey = React.useMemo(() => `dismissedHints_${orderCode}`, [orderCode]);
  
  const [dismissedHintIds, setDismissedHintIds] = useState<Set<string>>(new Set());
  const [hintsLoaded, setHintsLoaded] = useState(false);
  
  // Load dismissed hints from localStorage on mount and when orderCode changes
  useEffect(() => {
    if (typeof window !== 'undefined' && orderCode) {
      try {
        const saved = localStorage.getItem(dismissedHintsKey);
        if (saved) {
          const parsed = JSON.parse(saved) as string[];
          const loadedSet = new Set(parsed);
          console.log(`[Hints] Loaded ${loadedSet.size} dismissed hints for order ${orderCode}:`, Array.from(loadedSet));
          setDismissedHintIds(loadedSet);
        } else {
          console.log(`[Hints] No dismissed hints found for order ${orderCode}`);
          setDismissedHintIds(new Set());
        }
      } catch (e) {
        console.error('Failed to load dismissed hints from localStorage:', e);
        setDismissedHintIds(new Set());
      } finally {
        setHintsLoaded(true);
      }
    }
  }, [orderCode, dismissedHintsKey]);
  
  // Save dismissed hints to localStorage whenever they change (but only after initial load)
  useEffect(() => {
    if (typeof window !== 'undefined' && orderCode && hintsLoaded) {
      try {
        const arrayToSave = Array.from(dismissedHintIds);
        localStorage.setItem(
          dismissedHintsKey,
          JSON.stringify(arrayToSave)
        );
        console.log(`[Hints] Saved ${arrayToSave.length} dismissed hints for order ${orderCode}:`, arrayToSave);
      } catch (e) {
        console.error('Failed to save dismissed hints to localStorage:', e);
      }
    }
  }, [dismissedHintIds, dismissedHintsKey, orderCode, hintsLoaded]);
  
  // Generate smart hints based on services and order source (only after hints are loaded)
  const smartHints = React.useMemo(() => {
    if (!hintsLoaded) {
      return []; // Don't show hints until dismissed hints are loaded
    }
    
    const servicesForHint: ServiceForHint[] = services.map(s => ({
      id: s.id,
      category: s.category,
      dateFrom: s.dateFrom,
      dateTo: s.dateTo,
      name: s.name,
      resStatus: s.resStatus,
      flightSegments: s.flightSegments,
      transferRoutes: s.transferRoutes,
    }));
    
    const allHints = generateSmartHints(servicesForHint, orderSource);
    const filtered = allHints.filter(h => !dismissedHintIds.has(h.id));
    console.log(`[Hints] Generated ${allHints.length} hints, ${filtered.length} visible (${dismissedHintIds.size} dismissed)`);
    return filtered;
  }, [services, orderSource, dismissedHintIds, hintsLoaded]);
  
  // Get hints for a specific service
  const getHintsAfterService = (serviceId: string): SmartHint[] => {
    return smartHints.filter(h => h.afterServiceId === serviceId);
  };
  
  // Handle hint action (open add service modal or edit modal)
  const handleHintAction = (hint: SmartHint) => {
    if (!hint.action) return;
    if (hint.action.editServiceId) {
      setEditServiceId(hint.action.editServiceId);
      return;
    }
    if (serviceCategories.length > 0) {
      setShowChooseCategoryModal(true);
    } else {
      setPendingOpenChooseModal(true);
    }
  };
  
  // Dismiss a hint
  const handleDismissHint = (hintId: string) => {
    console.log(`[Hints] Dismissing hint: ${hintId}`);
    setDismissedHintIds(prev => {
      const newSet = new Set([...prev, hintId]);
      // Save to localStorage immediately
      if (typeof window !== 'undefined') {
        try {
          const arrayToSave = Array.from(newSet);
          localStorage.setItem(
            dismissedHintsKey,
            JSON.stringify(arrayToSave)
          );
          console.log(`[Hints] Immediately saved dismissed hint ${hintId}. Total dismissed: ${arrayToSave.length}`);
        } catch (e) {
          console.error('Failed to save dismissed hint to localStorage:', e);
        }
      }
      return newSet;
    });
  };

  // Fetch services from API (noCache = true after edit so Itinerary gets fresh dates)
  const fetchServices = useCallback(async (noCache?: boolean) => {
    if (!orderCode) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `/api/orders/${encodeURIComponent(orderCode)}/services${noCache ? `?_=${Date.now()}` : ""}`;
      const response = await fetch(url, {
        headers: {
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
        },
        credentials: "include",
        ...(noCache ? { cache: "no-store" } : {}),
      });

      if (response.ok) {
        const data = await response.json();
        // Map API response to Service interface
        const mappedServices: Service[] = (data.services || []).map((raw: unknown) => {
          const s = raw as Record<string, unknown>;
          return {
          id: String(s.id),
          dateFrom: String(s.dateFrom ?? s.service_date_from ?? ""),
          dateTo: String(s.dateTo ?? s.service_date_to ?? s.dateFrom ?? s.service_date_from ?? ""),
          category: String(s.category ?? "Other"),
          categoryId: (s.categoryId ?? s.category_id) as string | null,
          categoryType: ((s.categoryType ?? s.category_type) || undefined) as Service["categoryType"],
          vatRate: (s.vatRate ?? s.vat_rate) as number | null,
          name: String(s.serviceName ?? s.service_name ?? ""),
          supplier: String(s.supplierName ?? s.supplier_name ?? "-"),
          client: String(s.clientName ?? s.client_name ?? "-"),
          payer: String(s.payerName ?? s.payer_name ?? "-"),
          supplierPartyId: (s.supplierPartyId ?? s.supplier_party_id) as string | undefined,
          payerPartyId: (s.payerPartyId ?? s.payer_party_id) as string | undefined,
          clientPartyId: (s.clientPartyId ?? s.client_party_id) as string | undefined,
          servicePrice: Number(s.servicePrice ?? s.service_price ?? 0),
          clientPrice: Number(s.clientPrice ?? s.client_price ?? 0),
          serviceCurrency: (s.serviceCurrency ?? (s as { service_currency?: string }).service_currency) ?? null,
          servicePriceForeign: (s.servicePriceForeign ?? (s as { service_price_foreign?: number }).service_price_foreign) ?? null,
          exchangeRate: (s.exchangeRate ?? (s as { exchange_rate?: number }).exchange_rate) ?? null,
          actuallyPaid: (s.actuallyPaid ?? (s as { actually_paid?: number }).actually_paid) ?? null,
          quantity: Number(s.quantity ?? (s as { quantity?: number }).quantity ?? 1),
          resStatus: String(s.resStatus ?? s.res_status ?? "booked") as Service["resStatus"],
          refNr: String(s.refNr ?? s.ref_nr ?? ""),
          ticketNr: String(s.ticketNr ?? s.ticket_nr ?? ""),
          assignedTravellerIds: (s.travellerIds ?? s.traveller_ids ?? []) as string[],
          invoice_id: (s.invoice_id ?? null) as string | null,
          splitGroupId: (s.splitGroupId ?? s.split_group_id ?? null) as string | null,
          // Flight-specific
          flightSegments: (s.flightSegments ?? s.flight_segments ?? []) as FlightSegment[],
          ticketNumbers: (s.ticketNumbers ?? s.ticket_numbers ?? []) as Service["ticketNumbers"],
          boardingPasses: (s.boardingPasses ?? s.boarding_passes ?? []) as Service["boardingPasses"],
          baggage: String(s.baggage ?? ""),
          cabinClass: String(s.cabinClass ?? s.cabin_class ?? "economy") as Service["cabinClass"],
          pricingPerClient: Array.isArray(s.pricingPerClient ?? s.pricing_per_client) ? (s.pricingPerClient ?? s.pricing_per_client) as Service["pricingPerClient"] : null,
          // Terms & Conditions
          priceType: (s.priceType ?? s.price_type ?? null) as Service["priceType"],
          refundPolicy: (s.refundPolicy ?? s.refund_policy ?? null) as Service["refundPolicy"],
          freeCancellationUntil: (s.freeCancellationUntil ?? s.free_cancellation_until ?? null) as string | null,
          cancellationPenaltyAmount: (s.cancellationPenaltyAmount ?? s.cancellation_penalty_amount ?? null) as number | null,
          cancellationPenaltyPercent: (s.cancellationPenaltyPercent ?? s.cancellation_penalty_percent ?? null) as number | null,
          // Amendment fields
          parentServiceId: (s.parentServiceId ?? s.parent_service_id ?? null) as string | null,
          serviceType: String(s.serviceType ?? s.service_type ?? "original") as Service["serviceType"],
          cancellationFee: (s.cancellationFee ?? s.cancellation_fee ?? null) as number | null,
          refundAmount: (s.refundAmount ?? s.refund_amount ?? null) as number | null,
          changeFee: (s.changeFee ?? s.change_fee ?? null) as number | null,
          // Tour (persisted commission - must pass all for Edit modal to display)
          commissionName: (s.commissionName ?? s.commission_name ?? null) as string | null,
          commissionRate: (s.commissionRate ?? s.commission_rate ?? null) as number | null,
          commissionAmount: (s.commissionAmount ?? s.commission_amount ?? null) as number | null,
          agentDiscountValue: (s.agentDiscountValue ?? s.agent_discount_value ?? null) as number | null,
          agentDiscountType: (s.agentDiscountType ?? s.agent_discount_type ?? null) as string | null,
          servicePriceLineItems: Array.isArray(s.servicePriceLineItems ?? s.service_price_line_items)
            ? ((s.servicePriceLineItems ?? s.service_price_line_items) as { description?: string; amount?: number; commissionable?: boolean }[]).map((it) => ({
                description: String(it.description ?? ""),
                amount: Number(it.amount ?? 0),
                commissionable: !!it.commissionable,
              }))
            : [],
          // Tour/Hotel fields (must pass for Edit modal to display after save)
          hotelName: (s.hotelName ?? s.hotel_name ?? null) as string | null,
          hotelStarRating: (s.hotelStarRating ?? s.hotel_star_rating ?? null) as string | null,
          hotelRoom: (s.hotelRoom ?? s.hotel_room ?? null) as string | null,
          hotelBoard: (s.hotelBoard ?? s.hotel_board ?? null) as string | null,
          hotelBedType: (s.hotelBedType ?? s.hotel_bed_type ?? null) as Service["hotelBedType"],
          mealPlanText: (s.mealPlanText ?? s.meal_plan_text ?? null) as string | null,
          transferType: (s.transferType ?? s.transfer_type ?? null) as string | null,
          transferRoutes: (Array.isArray(s.transferRoutes ?? s.transfer_routes) ? (s.transferRoutes ?? s.transfer_routes) : []) as Service["transferRoutes"],
          transferMode: (s.transferMode ?? s.transfer_mode ?? null) as string | null,
          vehicleClass: (s.vehicleClass ?? s.vehicle_class ?? null) as string | null,
          pickupLocation: (s.pickupLocation ?? (s as { pickup_location?: string }).pickup_location ?? null) as string | null,
          dropoffLocation: (s.dropoffLocation ?? (s as { dropoff_location?: string }).dropoff_location ?? null) as string | null,
          pickupTime: (s.pickupTime ?? (s as { pickup_time?: string }).pickup_time ?? null) as string | null,
          estimatedDuration: (s.estimatedDuration ?? (s as { estimated_duration?: string }).estimated_duration ?? null) as string | null,
          linkedFlightId: (s.linkedFlightId ?? (s as { linked_flight_id?: string }).linked_flight_id ?? null) as string | null,
          driverName: (s.driverName ?? (s as { driver_name?: string }).driver_name ?? null) as string | null,
          driverPhone: (s.driverPhone ?? (s as { driver_phone?: string }).driver_phone ?? null) as string | null,
          driverNotes: (s.driverNotes ?? (s as { driver_notes?: string }).driver_notes ?? null) as string | null,
          additionalServices: (s.additionalServices ?? s.additional_services ?? null) as string | null,
          hotelAddress: (s.hotelAddress ?? s.hotel_address ?? null) as string | null,
          hotelPhone: (s.hotelPhone ?? s.hotel_phone ?? null) as string | null,
          hotelEmail: (s.hotelEmail ?? s.hotel_email ?? null) as string | null,
          hotelEarlyCheckIn: (s.hotelEarlyCheckIn ?? s.hotel_early_check_in ?? null) as boolean | null,
          hotelEarlyCheckInTime: (s.hotelEarlyCheckInTime ?? (s as { hotel_early_check_in_time?: string }).hotel_early_check_in_time ?? null) as string | null,
          hotelLateCheckIn: (s.hotelLateCheckIn ?? s.hotel_late_check_in ?? null) as boolean | null,
          hotelLateCheckInTime: (s.hotelLateCheckInTime ?? (s as { hotel_late_check_in_time?: string }).hotel_late_check_in_time ?? null) as string | null,
          hotelRoomUpgrade: (s.hotelRoomUpgrade ?? (s as { hotel_room_upgrade?: boolean }).hotel_room_upgrade ?? null) as boolean | null,
          hotelLateCheckOut: (s.hotelLateCheckOut ?? (s as { hotel_late_check_out?: boolean }).hotel_late_check_out ?? null) as boolean | null,
          hotelLateCheckOutTime: (s.hotelLateCheckOutTime ?? (s as { hotel_late_check_out_time?: string }).hotel_late_check_out_time ?? null) as string | null,
          hotelHigherFloor: (s.hotelHigherFloor ?? s.hotel_higher_floor ?? null) as boolean | null,
          hotelKingSizeBed: (s.hotelKingSizeBed ?? s.hotel_king_size_bed ?? null) as boolean | null,
          hotelHoneymooners: (s.hotelHoneymooners ?? s.hotel_honeymooners ?? null) as boolean | null,
          hotelSilentRoom: (s.hotelSilentRoom ?? s.hotel_silent_room ?? null) as boolean | null,
          hotelRepeatGuests: (s.hotelRepeatGuests ?? s.hotel_repeat_guests ?? null) as boolean | null,
          hotelRoomsNextTo: (s.hotelRoomsNextTo ?? s.hotel_rooms_next_to ?? null) as string | null,
          hotelParking: (s.hotelParking ?? s.hotel_parking ?? null) as boolean | null,
          hotelPreferencesFreeText: (s.hotelPreferencesFreeText ?? s.hotel_preferences_free_text ?? null) as string | null,
          hotelPricePer: (s.hotelPricePer ?? (s as { hotel_price_per?: string }).hotel_price_per ?? null) as Service["hotelPricePer"],
          supplierBookingType: (s.supplierBookingType ?? s.supplier_booking_type ?? null) as string | null,
          paymentDeadlineDeposit: (s.paymentDeadlineDeposit ?? s.payment_deadline_deposit ?? null) as string | null,
          paymentDeadlineFinal: (s.paymentDeadlineFinal ?? s.payment_deadline_final ?? null) as string | null,
          paymentTerms: (s.paymentTerms ?? s.payment_terms ?? null) as string | null,
        };
        });
        setServices(mappedServices);
      }
    } catch (err) {
      console.error("Fetch services error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [orderCode]);

  // Fetch travellers from API
  const fetchTravellers = useCallback(async () => {
    if (!orderCode) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/travellers`, {
        headers: {
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
        },
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setOrderTravellers(data.travellers || []);
      }
    } catch (err) {
      console.error("Fetch travellers error:", err);
    }
  }, [orderCode]);

  useEffect(() => {
    fetchServices();
    fetchTravellers();
  }, [fetchServices, fetchTravellers]);

  // Recalculate totals whenever services change
  const prevTotalsRef = React.useRef<{ amount_total: number; profit_estimated: number } | null>(null);
  useEffect(() => {
    if (!onTotalsChanged) return;
    const active = services.filter(s => s.resStatus !== "cancelled");
    const amount_total = active.reduce((sum, s) => sum + (Number(s.clientPrice) || 0), 0);
    const profit_estimated = active.reduce((sum, s) => {
      const sale = Number(s.clientPrice) || 0;
      const cost = Number(s.servicePrice) || 0;
      const isTour = s.categoryType === "tour";
      if (isTour && s.commissionAmount != null) {
        const commission = Number(s.commissionAmount) || 0;
        return sum + (sale - (cost - commission));
      }
      return sum + (sale - cost);
    }, 0);
    const prev = prevTotalsRef.current;
    if (prev && prev.amount_total === amount_total && prev.profit_estimated === profit_estimated) return;
    prevTotalsRef.current = { amount_total, profit_estimated };
    onTotalsChanged({ amount_total, profit_estimated });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services]);

  // Auto-detect destinations: (1) where they spend the most time (nights), (2) where the most services are
  useEffect(() => {
    if (!onDestinationsFromServices || services.length === 0) return;
    type CityEntry = { city: CityWithCountry; nights: number; serviceCount: number };
    const byKey = new Map<string, CityEntry>();

    const nightsBetween = (from: string | undefined, to: string | undefined): number => {
      if (!from || !to) return 0;
      const d1 = new Date(from);
      const d2 = new Date(to);
      if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return 0;
      const days = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return Math.max(0, days);
    };

    const addCity = (candidate: string, nights: number, serviceDelta: number = 1) => {
      if (!candidate?.trim()) return;
      const cityData = getCityByName(candidate.trim()) || getCityByIATA(candidate.trim());
      if (!cityData) return;
      const key = cityData.name.toLowerCase();
      const existing = byKey.get(key);
      if (existing) {
        existing.nights += nights;
        existing.serviceCount += serviceDelta;
      } else {
        byKey.set(key, {
          city: { city: cityData.name, country: cityData.country || "", countryCode: cityData.countryCode, lat: cityData.lat, lng: cityData.lng },
          nights,
          serviceCount: serviceDelta,
        });
      }
    };

    for (const service of services) {
      if (service.resStatus === "cancelled") continue;
      const categoryType = ((service as any).categoryType ?? (service as any).category_type ?? getCategoryTypeFromName(service.category) ?? service.category?.toLowerCase()) as string | undefined;
      const dateFrom = (service as any).dateFrom ?? (service as any).service_date_from;
      const dateTo = (service as any).dateTo ?? (service as any).service_date_to;
      const nights = nightsBetween(dateFrom, dateTo);

      // Hotel/tour: unique cities per service get (nights, +1 service)
      if (categoryType === "hotel" || categoryType === "tour") {
        const cityDataByKey = new Map<string, { city: CityWithCountry }>();
        const candidates: string[] = [];
        const hotelAddress = (service as any).hotelAddress as string | undefined;
        const hotelName = (service as any).hotelName as string | undefined;
        if (hotelAddress) candidates.push(...hotelAddress.split(",").map((p: string) => p.trim()));
        if (hotelName) candidates.push(...hotelName.split(",").map((p: string) => p.trim()));
        candidates.push(service.name?.split(",")[0]?.trim() || "");
        for (const c of candidates) {
          if (!c) continue;
          const cityData = getCityByName(c) || getCityByIATA(c);
          if (cityData) {
            const key = cityData.name.toLowerCase();
            if (!cityDataByKey.has(key)) {
              cityDataByKey.set(key, { city: { city: cityData.name, country: cityData.country || "", countryCode: cityData.countryCode, lat: cityData.lat, lng: cityData.lng } });
            }
          }
        }
        for (const [, { city }] of cityDataByKey) {
          const key = city.city.toLowerCase();
          const existing = byKey.get(key);
          if (existing) {
            existing.nights += nights;
            existing.serviceCount += 1;
          } else {
            byKey.set(key, { city, nights, serviceCount: 1 });
          }
        }
      }

    }

    // Flight: destination = WHERE they fly TO (arrival). Origin = first departure across all flights — not a destination.
    const flightSegmentsAll: Array<{ arrival: string; arrivalCity?: string; departure: string; departureDate: string; departureTime: string }> = [];
    for (const service of services) {
      if (service.resStatus === "cancelled") continue;
      const catType = ((service as any).categoryType ?? getCategoryTypeFromName(service.category) ?? service.category?.toLowerCase()) as string | undefined;
      if (catType !== "flight" || !(service as any).flightSegments?.length) continue;
      const segs = (service as any).flightSegments as Array<Record<string, unknown>>;
      for (const s of segs) {
        flightSegmentsAll.push({
          arrival: String(s.arrival ?? ""),
          arrivalCity: (s.arrivalCity ?? s.arrival_city) as string | undefined,
          departure: String(s.departure ?? ""),
          departureDate: String(s.departureDate ?? s.departure_date ?? ""),
          departureTime: String(s.departureTimeScheduled ?? s.departure_time_scheduled ?? s.departureTime ?? s.departure_time ?? ""),
        });
      }
    }
    flightSegmentsAll.sort((a, b) => new Date(`${a.departureDate}T${a.departureTime}`).getTime() - new Date(`${b.departureDate}T${b.departureTime}`).getTime());
    const originCode = flightSegmentsAll[0]?.departure?.trim();
    const originCityData = originCode ? (getCityByIATA(originCode) || getCityByName(originCode)) : undefined;
    const originCityName = originCityData?.name?.toLowerCase();
    for (const seg of flightSegmentsAll) {
      const arrCode = seg.arrival?.trim();
      if (!arrCode) continue;
      const arrCityData = getCityByIATA(arrCode) || getCityByName(seg.arrivalCity || seg.arrival);
      if (!arrCityData) continue;
      if (originCityName && arrCityData.name?.toLowerCase() === originCityName) continue; // return home = not destination
      addCity(arrCityData.name, 0, 1);
    }

    // Sort: first by nights (most time), then by service count (most services)
    const sorted = Array.from(byKey.values()).sort((a, b) => b.nights - a.nights || b.serviceCount - a.serviceCount);
    const withNights = sorted.filter((e) => e.nights > 0);
    // Prefer cities where they stay; if none (e.g. flight-only), use flight arrivals (where they fly TO)
    const list = withNights.length > 0 ? withNights : sorted;
    const destinations = list.map((e) => e.city);
    if (destinations.length > 0) {
      onDestinationsFromServices(destinations);
    }
  }, [services, onDestinationsFromServices]);

  // Load categories for "What service?" chooser
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          if (!cancelled) setServiceCategories(CHOOSE_CATEGORY_FALLBACK);
          return;
        }
        const res = await fetch("/api/travel-service-categories", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          credentials: "include",
        });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          const list = (data.categories || []).filter((c: { is_active?: boolean }) => c.is_active !== false);
          if (list.length > 0) {
            setServiceCategories(list.map((c: { id: string; name: string; type?: string; vat_rate?: number }) => ({
              id: c.id,
              name: c.name,
              type: typeof c.type === "string" ? c.type.toLowerCase() : "other",
              vat_rate: typeof c.vat_rate === "number" ? c.vat_rate : 21,
            })));
          } else {
            setServiceCategories(CHOOSE_CATEGORY_FALLBACK);
          }
        } else {
          setServiceCategories(CHOOSE_CATEGORY_FALLBACK);
        }
      } catch {
        if (!cancelled) setServiceCategories(CHOOSE_CATEGORY_FALLBACK);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // When categories load and user had clicked Add Service, open chooser
  useEffect(() => {
    if (serviceCategories.length > 0 && pendingOpenChooseModal) {
      setPendingOpenChooseModal(false);
      setShowChooseCategoryModal(true);
    }
  }, [serviceCategories.length, pendingOpenChooseModal]);

  // Handle new service added
  const handleServiceAdded = (service: ServiceData) => {
    const newService: Service = {
      id: service.id,
      dateFrom: service.dateFrom || "",
      dateTo: service.dateTo || service.dateFrom || "",
      category: service.category || "Other",
      name: service.serviceName,
      supplier: service.supplierName || "-",
      client: service.clientName || "-",
      payer: service.payerName || "-",
      supplierPartyId: service.supplierPartyId || undefined,
      clientPartyId: service.clientPartyId || undefined,
      payerPartyId: service.payerPartyId || undefined,
      invoice_id: null,
      servicePrice: service.servicePrice || 0,
      clientPrice: service.clientPrice || 0,
      quantity: service.quantity ?? 1,
      resStatus: service.resStatus || "booked",
      refNr: service.refNr || "",
      ticketNr: service.ticketNr || "",
      assignedTravellerIds: service.travellerIds || [],
    };
    setServices(prev => [...prev, newService]);
    // Refresh travellers so new clients appear in TRAVELLERS column (they're added to order_travellers by API)
    fetchTravellers();
  };

  const selectedService = services.find((s) => s.id === modalServiceId);

  const getTravellerInitials = (travellerId: string) => {
    const traveller = orderTravellers.find((t) => t.id === travellerId);
    if (!traveller) return "??";
    return (
      traveller.firstName.charAt(0) + traveller.lastName.charAt(0)
    ).toUpperCase();
  };

  const getResStatusColor = (status: Service["resStatus"]) => {
    switch (status) {
      case "draft":
        return "bg-slate-100 text-slate-600 border border-dashed border-slate-300";
      case "confirmed":
        return "bg-green-100 text-green-800";
      case "booked":
        return "bg-blue-100 text-blue-800";
      case "changed":
        return "bg-yellow-100 text-yellow-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      case "cancelled":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Generate consistent color for split group
  const getSplitGroupColor = (splitGroupId: string) => {
    // Hash the splitGroupId to get a number
    let hash = 0;
    for (let i = 0; i < splitGroupId.length; i++) {
      hash = splitGroupId.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Define color palette (8 distinct colors)
    const colors = [
      { border: 'border-l-green-500', bg: 'bg-green-100', text: 'text-green-800' },
      { border: 'border-l-blue-500', bg: 'bg-blue-100', text: 'text-blue-800' },
      { border: 'border-l-purple-500', bg: 'bg-purple-100', text: 'text-purple-800' },
      { border: 'border-l-pink-500', bg: 'bg-pink-100', text: 'text-pink-800' },
      { border: 'border-l-orange-500', bg: 'bg-orange-100', text: 'text-orange-800' },
      { border: 'border-l-teal-500', bg: 'bg-teal-100', text: 'text-teal-800' },
      { border: 'border-l-indigo-500', bg: 'bg-indigo-100', text: 'text-indigo-800' },
      { border: 'border-l-rose-500', bg: 'bg-rose-100', text: 'text-rose-800' },
    ];
    
    // Pick color based on hash
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const formatDateForGrouping = (dateString?: string | null): string => {
    return formatDateDDMMYYYY(dateString);
  };
  const getDateRangeKey = (service: Service) => {
    const startDate = formatDateForGrouping(service.dateFrom);
    const endDate = service.dateTo
      ? formatDateForGrouping(service.dateTo)
      : formatDateForGrouping(service.dateFrom);
    return `${startDate} - ${endDate}`;
  };

  // Group services by dateRangeKey
  const groupedServices = visibleServices.reduce(
    (acc, service) => {
      const key = getDateRangeKey(service);
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(service);
      return acc;
    },
    {} as Record<string, Service[]>
  );

  // Sort groups by startDate ASC
  const sortedGroupKeys = Object.keys(groupedServices).sort((a, b) => {
    const aStartDate = a.split(" - ")[0];
    const bStartDate = b.split(" - ")[0];
    // Compare DD.MM.YYYY format
    const [aDay, aMonth, aYear] = aStartDate.split(".").map(Number);
    const [bDay, bMonth, bYear] = bStartDate.split(".").map(Number);
    const aDate = new Date(aYear, aMonth - 1, aDay);
    const bDate = new Date(bYear, bMonth - 1, bDay);
    return aDate.getTime() - bDate.getTime();
  });

  // Handle duplicate service confirmation
  const handleDuplicateConfirm = async () => {
    if (!duplicateConfirmService) return;
    
    const service = duplicateConfirmService;
    setDuplicateConfirmService(null);
    
    console.log('[Duplicate] Confirmed, duplicating...', {
      supplierPartyId: service.supplierPartyId,
      clientPartyId: service.clientPartyId,
      payerPartyId: service.payerPartyId,
      assignedTravellerIds: service.assignedTravellerIds,
    });
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Build duplicate payload with ALL fields (including hotel, pricing, booking terms)
      const duplicatePayload: Record<string, unknown> = {
        // Basic info with "(copy)" suffix
        serviceName: service.name + " (copy)",
        category: service.category,
        
        // Dates
        dateFrom: service.dateFrom,
        dateTo: service.dateTo,
        
        // Parties - copy all IDs and names
        supplierPartyId: service.supplierPartyId || service.supplier_party_id,
        supplierName: service.supplier !== "-" ? service.supplier : null,
        clientPartyId: service.clientPartyId || service.client_party_id,
        clientName: service.client !== "-" ? service.client : null,
        payerPartyId: service.payerPartyId || service.payer_party_id,
        payerName: service.payer !== "-" ? service.payer : null,
        
        // Pricing (preserve quantity, hotelPricePer for correct totals)
        servicePrice: service.servicePrice,
        clientPrice: service.clientPrice,
        quantity: service.quantity ?? 1,
        hotelPricePer: service.hotelPricePer ?? null,
        serviceCurrency: service.serviceCurrency ?? null,
        servicePriceForeign: service.servicePriceForeign ?? null,
        exchangeRate: service.exchangeRate ?? null,
        actuallyPaid: service.actuallyPaid ?? null,
        
        // Status - keep same status
        resStatus: service.resStatus,
        refNr: service.refNr,
        ticketNr: service.ticketNr,
        
        // Flight-specific fields
        cabinClass: service.cabinClass,
        baggage: service.baggage,
        flightSegments: service.flightSegments,
        ticketNumbers: service.ticketNumbers,
        
        // Terms & conditions
        priceType: service.priceType,
        refundPolicy: service.refundPolicy,
        freeCancellationUntil: service.freeCancellationUntil,
        cancellationPenaltyAmount: service.cancellationPenaltyAmount,
        cancellationPenaltyPercent: service.cancellationPenaltyPercent,
        
        // Booking terms (payment deadlines, payment terms)
        paymentDeadlineDeposit: service.paymentDeadlineDeposit ?? null,
        paymentDeadlineFinal: service.paymentDeadlineFinal ?? null,
        paymentTerms: service.paymentTerms ?? null,
        
        // Hotel fields - room, board, beds, preferences
        hotelName: service.hotelName ?? null,
        hotelStarRating: service.hotelStarRating ?? null,
        hotelRoom: service.hotelRoom ?? null,
        hotelBoard: service.hotelBoard ?? null,
        hotelBedType: service.hotelBedType ?? null,
        mealPlanText: service.mealPlanText ?? null,
        hotelEarlyCheckIn: service.hotelEarlyCheckIn ?? null,
        hotelEarlyCheckInTime: service.hotelEarlyCheckInTime ?? null,
        hotelLateCheckIn: service.hotelLateCheckIn ?? null,
        hotelLateCheckInTime: service.hotelLateCheckInTime ?? null,
        hotelRoomUpgrade: service.hotelRoomUpgrade ?? null,
        hotelLateCheckOut: service.hotelLateCheckOut ?? null,
        hotelLateCheckOutTime: service.hotelLateCheckOutTime ?? null,
        hotelHigherFloor: service.hotelHigherFloor ?? null,
        hotelKingSizeBed: service.hotelKingSizeBed ?? null,
        hotelHoneymooners: service.hotelHoneymooners ?? null,
        hotelSilentRoom: service.hotelSilentRoom ?? null,
        hotelRepeatGuests: service.hotelRepeatGuests ?? null,
        hotelRoomsNextTo: service.hotelRoomsNextTo ?? null,
        hotelParking: service.hotelParking ?? null,
        hotelPreferencesFreeText: service.hotelPreferencesFreeText ?? null,
        hotelAddress: service.hotelAddress ?? null,
        hotelPhone: service.hotelPhone ?? null,
        hotelEmail: service.hotelEmail ?? null,
        additionalServices: service.additionalServices ?? null,
        transferType: service.transferType ?? null,
        supplierBookingType: service.supplierBookingType ?? null,
        
        // Tour commission / line items
        commissionName: service.commissionName ?? null,
        commissionRate: service.commissionRate ?? null,
        commissionAmount: service.commissionAmount ?? null,
        agentDiscountValue: service.agentDiscountValue ?? null,
        agentDiscountType: service.agentDiscountType ?? null,
        servicePriceLineItems: Array.isArray(service.servicePriceLineItems) && service.servicePriceLineItems.length > 0 ? service.servicePriceLineItems : undefined,
        
        // Travellers - copy assigned travellers (API expects travellerIds)
        travellerIds: service.assignedTravellerIds || [],
      };
      
      console.log('[Duplicate] Sending payload:', duplicatePayload);
      
      const response = await fetch(
        `/api/orders/${encodeURIComponent(orderCode)}/services`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify(duplicatePayload)
        }
      );
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        console.error('[Duplicate] Failed:', errData);
        throw new Error("Failed to duplicate service");
      }
      console.log('[Duplicate] Success!');
      fetchServices();
      fetchTravellers();
    } catch (error) {
      console.error("Error duplicating service:", error);
      alert("Failed to duplicate service");
    }
  };

  // Handle cancel service confirmation
  const handleCancelConfirm = async () => {
    if (!cancelConfirmService) return;
    
    const service = cancelConfirmService;
    setCancelConfirmService(null);
    
    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(orderCode)}/services/${service.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...service,
            res_status: "cancelled"
          })
        }
      );
      if (!response.ok) throw new Error("Failed to cancel service");
      fetchServices();
    } catch (error) {
      console.error("Error cancelling service:", error);
      alert("Failed to cancel service");
    }
  };

  // Initialize expandedGroups - all groups expanded by default
  useEffect(() => {
    const initialExpanded: Record<string, boolean> = {};
    sortedGroupKeys.forEach((key) => {
      initialExpanded[key] = true;
    });
    setExpandedGroups(initialExpanded);
  }, [services.length]); // Re-initialize if services change

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  const formatCurrency = (amount: number) => {
    return `€${amount.toLocaleString()}`;
  };

  const handleOpenModal = (serviceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setModalServiceId(serviceId);
  };

  const handleCloseModal = () => {
    setModalServiceId(null);
  };

  const servicesTableContent = isLoading ? (
    <div className="rounded-lg bg-white shadow-sm overflow-hidden">
      <style>{`
        @keyframes services-skeleton-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .services-skeleton-cell {
          background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
          background-size: 200% 100%;
          animation: services-skeleton-shimmer 1.2s ease-in-out infinite;
        }
      `}</style>
      <div className="border-b border-gray-200 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList size={18} strokeWidth={1.6} className="text-gray-500" />
          <h2 className="text-base font-semibold text-gray-900">Services</h2>
        </div>
      </div>
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="h-8 rounded-md services-skeleton-cell w-48" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="w-20 px-2 py-1.5" /><th className="px-2 py-1.5" /><th className="px-2 py-1.5" /><th className="px-2 py-1.5" /><th className="px-2 py-1.5" /><th className="px-2 py-1.5" /><th className="w-20 px-1 py-1.5" /><th className="w-20 px-1 py-1.5" /><th className="min-w-[180px] px-2 py-1.5" /><th className="px-2 py-1.5" /><th className="px-2 py-1.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="px-2 py-2"><div className="h-4 rounded services-skeleton-cell mx-auto w-4" /></td>
                <td className="px-2 py-2"><div className="h-4 rounded services-skeleton-cell w-16" /></td>
                <td className="px-2 py-2"><div className="h-4 rounded services-skeleton-cell w-32" /></td>
                <td className="px-2 py-2"><div className="h-4 rounded services-skeleton-cell w-20" /></td>
                <td className="px-2 py-2"><div className="h-4 rounded services-skeleton-cell w-24" /></td>
                <td className="px-2 py-2"><div className="h-4 rounded services-skeleton-cell w-20" /></td>
                <td className="px-2 py-2"><div className="h-4 rounded services-skeleton-cell w-14" /></td>
                <td className="px-2 py-2"><div className="h-4 rounded services-skeleton-cell w-14" /></td>
                <td className="px-2 py-2"><div className="h-4 rounded services-skeleton-cell w-20" /></td>
                <td className="px-2 py-2"><div className="h-4 rounded services-skeleton-cell w-16" /></td>
                <td className="px-2 py-2"><div className="h-4 rounded services-skeleton-cell w-12" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  ) : null;

  return (
    <>
      <style>{`
        @keyframes services-row-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .services-row-in {
          opacity: 0;
          animation: services-row-in 0.35s ease-out forwards;
        }
      `}</style>
      {/* Vertical layout: Services on top, Itinerary + Map below */}
      <div className="space-y-4">
        {/* Services table — skeleton when loading; Itinerary block always rendered below */}
        {isLoading ? servicesTableContent : (
        <div className="rounded-lg bg-white shadow-sm">
        <div className="border-b border-gray-200 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList size={18} strokeWidth={1.6} className="text-gray-500" />
            <h2 className="text-base font-semibold text-gray-900">Services</h2>
            <span className="text-xs text-gray-500">({visibleServices.length}{hideCancelled && services.length > visibleServices.length ? ` of ${services.length}` : ""})</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Filter menu */}
            <div className="relative" ref={filterMenuRef}>
              <button
                onClick={() => setFilterMenuOpen(o => !o)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  hasActiveFilters ? "bg-blue-100 text-blue-700 hover:bg-blue-200" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                title="Filter by Category, Supplier, Client, Payer"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filter{hasActiveFilters ? ` (${[filterCategory, filterSupplier, filterClient, filterPayer].filter(Boolean).length})` : ""}
              </button>
              {filterMenuOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-white rounded-lg border border-gray-200 shadow-lg py-2 px-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-700">Filter by</span>
                    {hasActiveFilters && (
                      <button onClick={clearFilters} className="text-xs text-blue-600 hover:text-blue-800">Clear</button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">Category</label>
                      <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full text-xs border border-gray-300 rounded px-2 py-1">
                        <option value="">All</option>
                        {filterOptions.categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">Supplier</label>
                      <select value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)} className="w-full text-xs border border-gray-300 rounded px-2 py-1">
                        <option value="">All</option>
                        {filterOptions.suppliers.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">Client</label>
                      <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)} className="w-full text-xs border border-gray-300 rounded px-2 py-1">
                        <option value="">All</option>
                        {filterOptions.clients.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">Payer</label>
                      <select value={filterPayer} onChange={(e) => setFilterPayer(e.target.value)} className="w-full text-xs border border-gray-300 rounded px-2 py-1">
                        <option value="">All</option>
                        {filterOptions.payers.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {/* Hide Cancelled toggle */}
            <button
              onClick={toggleHideCancelled}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                hideCancelled 
                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={hideCancelled ? "Show cancelled services" : "Hide cancelled services"}
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {hideCancelled ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                )}
              </svg>
              {hideCancelled ? "Show" : "Hide"} Cancelled
            </button>
          </div>
        </div>

        {/* Itinerary Tabs - filter by traveller */}
        <div className="px-3">
          <ItineraryTabs
            travellers={orderTravellers}
            selectedTravellerId={selectedTravellerId}
            onSelectTraveller={setSelectedTravellerId}
            serviceCountByTraveller={serviceCountByTraveller}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="w-20 px-2 py-1.5 text-center text-sm font-medium uppercase tracking-wider leading-tight text-gray-700">
                  <div className="flex items-center justify-center gap-2">
                    {visibleServicesWithoutInvoice.length > 0 && (
                      <input
                        type="checkbox"
                        checked={allNonInvoicedSelected}
                        onChange={(e) => handleSelectAllNonInvoiced(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        title="Select all visible services without invoice"
                        aria-label="Select all visible services without invoice"
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    <span>Invoice</span>
                  </div>
                </th>
                <th className="px-2 py-1.5 text-left text-sm font-medium uppercase tracking-wider leading-tight text-gray-700">
                  Category
                </th>
                <th className="px-2 py-1.5 text-left text-sm font-medium uppercase tracking-wider leading-tight text-gray-700">
                  Name
                </th>
                <th className="px-2 py-1.5 text-left text-sm font-medium uppercase tracking-wider leading-tight text-gray-700">
                  Supplier
                </th>
                <th className="px-2 py-1.5 text-left text-sm font-medium uppercase tracking-wider leading-tight text-gray-700">
                  Client
                </th>
                <th className="px-2 py-1.5 text-left text-sm font-medium uppercase tracking-wider leading-tight text-gray-700">
                  Payer
                </th>
                <th className="w-20 px-1 py-1.5 text-left text-sm font-medium uppercase tracking-wider leading-tight text-gray-700">
                  Service Price
                </th>
                <th className="w-20 px-1 py-1.5 text-left text-sm font-medium uppercase tracking-wider leading-tight text-gray-700">
                  Client Price
                </th>
                <th className="min-w-[180px] px-2 py-1.5 text-left text-sm font-medium uppercase tracking-wider leading-tight text-gray-700">
                  Travellers
                </th>
                <th className="px-2 py-1.5 text-left text-sm font-medium uppercase tracking-wider leading-tight text-gray-700">
                  Status
                </th>
                <th className="px-2 py-1.5 text-left text-sm font-medium uppercase tracking-wider leading-tight text-gray-700">
                  Terms
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {(() => {
                let serviceRowIndex = 0;
                return sortedGroupKeys.map((groupKey) => {
                const groupServices = groupedServices[groupKey].sort((a, b) => {
                  // Sort within group: category, then name
                  const categoryCompare = a.category.localeCompare(b.category);
                  if (categoryCompare !== 0) return categoryCompare;
                  return a.name.localeCompare(b.name);
                });
                const isExpanded = expandedGroups[groupKey] ?? true;

                return (
                  <React.Fragment key={`group-${groupKey}`}>
                    {/* Group header row */}
                    <tr
                      className="cursor-pointer bg-gray-100 hover:bg-gray-200"
                      onClick={() => toggleGroup(groupKey)}
                    >
                      <td className="px-3 py-1.5" colSpan={12}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600">
                              {isExpanded ? "▼" : "▶"}
                            </span>
                            <span className="text-xs font-medium text-gray-900">
                              {groupKey}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {groupServices.length}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {/* Services in group */}
                    {isExpanded &&
                      groupServices.map((service) => {
                        const assignedIds = service.assignedTravellerIds;
                        const visibleIds = assignedIds.slice(0, 3);
                        const remainingCount = assignedIds.length - 3;

                        // Calculate split group info
                        let splitInfo = null;
                        if (service.splitGroupId) {
                          const splitGroupServices = services.filter(s => s.splitGroupId === service.splitGroupId);
                          const splitIndex = splitGroupServices.findIndex(s => s.id === service.id) + 1;
                          splitInfo = { index: splitIndex, total: splitGroupServices.length };
                        }

                        // Calculate color and connector for split groups
                        const splitGroupColor = service.splitGroupId ? getSplitGroupColor(service.splitGroupId) : null;

                        // CLIENT: prefer traveller names (matches Edit modal) when available, else service.client
                        const displayClientName = (service.assignedTravellerIds?.length && orderTravellers.length)
                          ? orderTravellers
                              .filter((t) => service.assignedTravellerIds!.includes(t.id))
                              .map((t) => `${(t.firstName || "").trim()} ${(t.lastName || "").trim()}`.trim())
                              .filter(Boolean)
                              .join(", ") || service.client
                          : service.client;
                        const displayClientPartyId = (service.assignedTravellerIds?.length && orderTravellers.length)
                          ? orderTravellers.find((t) => service.assignedTravellerIds!.includes(t.id))?.id ?? service.clientPartyId
                          : service.clientPartyId;

                        const rowDelay = serviceRowIndex++ * 40;
                        return (
                          <React.Fragment key={service.id}>
                          <tr
                            className={`services-row-in group border-b border-gray-100 hover:bg-gray-50 leading-tight transition-colors cursor-pointer relative ${
                              service.splitGroupId ? `border-l-4 ${splitGroupColor?.border}` : ""
                            }`}
                            style={{ animationDelay: `${rowDelay}ms` }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              console.log('🔍 DoubleClick triggered on row! Service ID:', service.id);
                              setEditServiceId(service.id);
                            }}
                            title="Double-click to edit"
                          >
                            <td className="w-20 px-2 py-1 text-center relative">
                              {/* Connector icon between split group rows */}
                              {splitInfo && splitInfo.index > 1 && splitGroupColor && (
                                <div className="absolute -left-3 -top-3 z-20">
                                  <div className="flex items-center justify-center w-5 h-5 bg-white rounded-full shadow-md border-2" style={{ borderColor: splitGroupColor.border.includes('green') ? '#22c55e' : splitGroupColor.border.includes('blue') ? '#3b82f6' : splitGroupColor.border.includes('purple') ? '#a855f7' : splitGroupColor.border.includes('pink') ? '#ec4899' : splitGroupColor.border.includes('orange') ? '#f97316' : splitGroupColor.border.includes('teal') ? '#14b8a6' : splitGroupColor.border.includes('indigo') ? '#6366f1' : '#f43f5e' }}>
                                    <span style={{ fontSize: '10px' }}>🔗</span>
                                  </div>
                                </div>
                              )}
                              <div className="flex items-center justify-center gap-1">
                                {service.invoice_id ? (
                                  <div className="flex items-center justify-center">
                                    {/* Invoiced: show icon, link to invoice; cannot select for new invoice while active */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(`/orders/${orderCodeToSlug(orderCode)}?tab=finance&invoice=${service.invoice_id}`);
                                      }}
                                      className="flex items-center justify-center text-green-600 hover:text-green-800 hover:scale-110 transition-all cursor-pointer"
                                      title="Invoiced — view invoice (cannot issue another invoice for this service)"
                                    >
                                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                    </button>
                                  </div>
                                ) : service.resStatus === 'cancelled' ? (
                                  <span className="text-gray-400 text-xs" title="Cancelled service cannot be invoiced">-</span>
                                ) : (
                                  <input
                                    type="checkbox"
                                    checked={selectedServiceIds.includes(service.id)}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      if (e.target.checked) {
                                        setSelectedServiceIds(prev => [...prev, service.id]);
                                      } else {
                                        setSelectedServiceIds(prev => prev.filter(id => id !== service.id));
                                      }
                                    }}
                                    disabled={(service as Service).resStatus === 'cancelled'}
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    aria-label={`Select ${service.name} for invoice`}
                                    title="Select for invoice"
                                  />
                                )}
                              </div>
                            </td>
                            <td 
                              className="px-2 py-1 text-sm text-gray-700 leading-tight"
                            >
                              {service.category}
                            </td>
                            <td className="px-2 py-1 text-sm font-medium text-gray-900 leading-tight">
                              <div className="flex items-center gap-2">
                                {splitInfo && (
                                  <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${splitGroupColor?.bg} ${splitGroupColor?.text}`}>
                                  </span>
                                )}
                                <span>
                                  {getServiceDisplayName(service, service.name)}
                                </span>
                              </div>
                            </td>
                            <td 
                              className={`px-2 py-1 text-sm leading-tight ${service.supplierPartyId && isCtrlPressed && hoveredPartyId === `supplier-${service.id}` ? 'cursor-pointer text-blue-600 underline' : 'text-gray-700'}`}
                              onClick={(e) => {
                                if ((e.ctrlKey || e.metaKey) && service.supplierPartyId) {
                                  e.preventDefault();
                                  router.push(`/directory/${service.supplierPartyId}`);
                                }
                              }}
                              onMouseEnter={() => service.supplierPartyId && setHoveredPartyId(`supplier-${service.id}`)}
                              onMouseLeave={() => setHoveredPartyId(null)}
                            >
                              {service.supplier}
                            </td>
                            <td 
                              className={`px-2 py-1 text-sm leading-tight ${(displayClientPartyId ?? service.clientPartyId) && isCtrlPressed && hoveredPartyId === `client-${service.id}` ? 'cursor-pointer text-blue-600 underline' : 'text-gray-700'}`}
                              onClick={(e) => {
                                const partyId = displayClientPartyId ?? service.clientPartyId;
                                if ((e.ctrlKey || e.metaKey) && partyId) {
                                  e.preventDefault();
                                  router.push(`/directory/${partyId}`);
                                }
                              }}
                              onMouseEnter={() => (displayClientPartyId ?? service.clientPartyId) && setHoveredPartyId(`client-${service.id}`)}
                              onMouseLeave={() => setHoveredPartyId(null)}
                            >
                              {displayClientName}
                            </td>
                            <td 
                              className={`px-2 py-1 text-sm leading-tight ${service.payerPartyId && isCtrlPressed && hoveredPartyId === `payer-${service.id}` ? 'cursor-pointer text-blue-600 underline' : 'text-gray-700'}`}
                              onClick={(e) => {
                                if ((e.ctrlKey || e.metaKey) && service.payerPartyId) {
                                  e.preventDefault();
                                  router.push(`/directory/${service.payerPartyId}`);
                                }
                              }}
                              onMouseEnter={() => service.payerPartyId && setHoveredPartyId(`payer-${service.id}`)}
                              onMouseLeave={() => setHoveredPartyId(null)}
                            >
                              {service.payer}
                            </td>
                            <td className="w-20 whitespace-nowrap px-1 py-1 text-left text-sm text-gray-700 leading-tight">
                              {formatCurrency(service.servicePrice)}
                            </td>
                            <td className="w-20 whitespace-nowrap px-1 py-1 text-left text-sm font-medium text-gray-900 leading-tight">
                              {formatCurrency(service.clientPrice)}
                            </td>
                            <td 
                              className="min-w-[180px] px-2 py-1 leading-tight cursor-pointer hover:bg-blue-50 transition-colors"
                              onClick={(e) => handleOpenModal(service.id, e)}
                              title="Click to manage travellers"
                            >
                              <div className="flex items-center gap-1">
                                <div className="flex items-center gap-0.5">
                                  {visibleIds.map((travellerId) => (
                                    <div
                                      key={travellerId}
                                      className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-800"
                                      title={
                                        orderTravellers.find(
                                          (t) => t.id === travellerId
                                        )?.firstName +
                                        " " +
                                        orderTravellers.find(
                                          (t) => t.id === travellerId
                                        )?.lastName
                                      }
                                    >
                                      {getTravellerInitials(travellerId)}
                                    </div>
                                  ))}
                                  {remainingCount > 0 && (
                                    <span className="text-xs text-gray-500">
                                      +{remainingCount}
                                    </span>
                                  )}
                                </div>
                                <span className="ml-1 flex h-5 w-5 items-center justify-center rounded border border-gray-300 bg-white text-xs text-gray-600">
                                  +
                                </span>
                              </div>
                            </td>
                            {/* Status */}
                            <td className="px-2 py-1 text-sm leading-tight">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getResStatusColor(
                                  service.resStatus
                                )}`}
                              >
                                {service.resStatus}
                              </span>
                            </td>
                            {/* Terms */}
                            <td className="px-2 py-1 text-sm leading-tight">
                              {(() => {
                                const policy = service.refundPolicy || "non_ref";
                                const freeCancelDate = service.freeCancellationUntil || null;
                                const badge = getRefundPolicyBadge(policy as "non_ref" | "refundable" | "fully_ref", freeCancelDate);
                                const urgency = getDeadlineUrgency(freeCancelDate);
                                
                                // Badge colors based on policy and urgency
                                let badgeClass = "";
                                if (policy === "non_ref") {
                                  badgeClass = "bg-red-100 text-red-700 border border-red-200";
                                } else if (policy === "fully_ref") {
                                  badgeClass = "bg-green-100 text-green-700 border border-green-200";
                                } else {
                                  // Refundable - color by urgency
                                  if (urgency === "overdue") {
                                    badgeClass = "bg-red-100 text-red-700 border border-red-200";
                                  } else if (urgency === "urgent") {
                                    badgeClass = "bg-red-100 text-red-700 border border-red-200 animate-pulse";
                                  } else if (urgency === "warning") {
                                    badgeClass = "bg-yellow-100 text-yellow-700 border border-yellow-200";
                                  } else {
                                    badgeClass = "bg-green-100 text-green-700 border border-green-200";
                                  }
                                }
                                
                                // Build tooltip content
                                const tooltipParts: string[] = [];
                                tooltipParts.push(`Refund: ${getRefundPolicyLabel(policy as "non_ref" | "refundable" | "fully_ref")}`);
                                if (service.categoryType === "tour" && service.priceType) {
                                  tooltipParts.push(`Price: ${getPriceTypeLabel(service.priceType)}`);
                                }
                                if (freeCancelDate) {
                                  tooltipParts.push(`Free cancel until: ${formatDeadlineFull(freeCancelDate)}`);
                                  const internalDeadline = calculateInternalDeadline(
                                    getEarliestDeadline(freeCancelDate)
                                  );
                                  if (internalDeadline) {
                                    tooltipParts.push(`Internal deadline: ${formatDeadlineFull(internalDeadline)}`);
                                  }
                                }
                                if (service.cancellationPenaltyAmount) {
                                  tooltipParts.push(`Penalty: €${service.cancellationPenaltyAmount}`);
                                }
                                if (service.cancellationPenaltyPercent) {
                                  tooltipParts.push(`Penalty: ${service.cancellationPenaltyPercent}%`);
                                }
                                
                                return badge ? (
                                  <span
                                    className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium cursor-help ${badgeClass}`}
                                    title={tooltipParts.join("\n")}
                                  >
                                    {badge}
                                  </span>
                                ) : null;
                              })()}
                            </td>
                          </tr>
                          {/* Smart hints after this service */}
                          {getHintsAfterService(service.id).map(hint => (
                            <SmartHintRow
                              key={hint.id}
                              hint={hint}
                              onAction={handleHintAction}
                              onDismiss={handleDismissHint}
                            />
                          ))}
                          </React.Fragment>
                        );
                      })}
                  </React.Fragment>
                );
              });
              })()}
            </tbody>
          </table>
        </div>

        {/* Itinerary Timeline — attached under Services; header z-[60] so scrolling content goes under, not over */}
        <div className="border-t border-gray-200 bg-white">
          <div id="itinerary" className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:items-start">
          <div className="lg:col-span-2">
            <ItineraryTimeline
              services={visibleServices.map(s => ({
                id: s.id,
                dateFrom: s.dateFrom,
                dateTo: s.dateTo,
                category: s.category,
                categoryType: s.categoryType,
                serviceType: s.serviceType,
                name: s.name,
                supplier: s.supplier,
                resStatus: s.resStatus,
                hotelName: s.hotelName,
                hotelAddress: (s as { hotelAddress?: string }).hotelAddress,
                hotelPhone: (s as { hotelPhone?: string }).hotelPhone,
                flightSegments: s.flightSegments,
                refNr: s.refNr,
                ticketNumbers: s.ticketNumbers,
                boardingPasses: s.boardingPasses,
                baggage: s.baggage,
                transferType: s.transferType,
                transferRoutes: s.transferRoutes,
                transferMode: s.transferMode,
                vehicleClass: s.vehicleClass,
                splitGroupId: s.splitGroupId ?? null,
                assignedTravellerIds: s.assignedTravellerIds ?? [],
              }))}
              travellers={orderTravellers.filter(t => (serviceCountByTraveller[t.id] || 0) > 0)}
              selectedTravellerId={selectedTravellerId}
              onSelectTraveller={setSelectedTravellerId}
              onUploadBoardingPass={async (serviceId, file, clientId, flightNumber) => {
                const client = orderTravellers.find(t => t.id === clientId);
                const clientName = client ? `${client.firstName} ${client.lastName}` : "Unknown";
                const formData = new FormData();
                formData.append("file", file);
                formData.append("clientId", clientId);
                formData.append("clientName", clientName);
                formData.append("flightNumber", flightNumber);
                const response = await fetch(`/api/services/${serviceId}/boarding-passes`, { method: "POST", body: formData });
                if (response.ok) fetchServices();
                else { const err = await response.json(); alert(err.error || "Failed to upload boarding pass"); }
              }}
              onViewBoardingPass={(pass) => setContentModal({ url: pass.fileUrl, title: pass.fileName || "Boarding pass" })}
              onDeleteBoardingPass={async (serviceId, passId) => {
                if (!confirm("Delete this boarding pass?")) return;
                const response = await fetch(`/api/services/${serviceId}/boarding-passes?passId=${passId}`, { method: "DELETE" });
                if (response.ok) fetchServices(); else alert("Failed to delete boarding pass");
              }}
              onEditService={(serviceId) => setEditServiceId(serviceId)}
              selectedBoardingPasses={selectedBoardingPasses}
              onToggleBoardingPassSelection={handleToggleBoardingPassSelection}
              travellerIdToColor={travellerIdToColor}
              routeColorsUsed={routeColorsUsed}
              stickyTopOffset={stickyTopOffset}
            />
          </div>
          <div className="rounded-lg bg-white shadow-sm lg:sticky lg:self-start" style={{ top: stickyTopOffset }}>
            <div className="border-b border-gray-200 px-3 py-2">
              <div className="flex items-center gap-2">
                <MapIcon size={18} strokeWidth={1.6} className="text-gray-500" />
                <h2 className="text-base font-semibold text-gray-900">Map</h2>
              </div>
            </div>
            {mapRoutePoints.length > 0 || travellerRoutes.length > 0 ? (
              <TripMap
                destinations={mapRoutePoints}
                travellerRoutes={travellerRoutes.length > 0 ? travellerRoutes : undefined}
                dateFrom={orderDateFrom || undefined}
                dateTo={orderDateTo || undefined}
                className="h-[500px]"
              />
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No destinations set</div>
            )}
          </div>
        </div>
        </div>
      </div>
        )}

      </div>

      {selectedService && (
        <AssignedTravellersModal
          service={selectedService}
          orderTravellers={orderTravellers}
          setOrderTravellers={setOrderTravellers}
          services={services}
          setServices={setServices}
          mainClientId={defaultClientId || ""}
          orderCode={orderCode}
          onClose={handleCloseModal}
        />
      )}

      {showChooseCategoryModal && (
        <ChooseServiceTypeModal
          categories={serviceCategories.length > 0 ? serviceCategories : CHOOSE_CATEGORY_FALLBACK}
          onSelect={(categoryId, category) => {
            setAddServiceCategoryId(categoryId);
            setAddServiceCategoryType(category?.type ?? null);
            setAddServiceCategoryName(category?.name ?? null);
            setAddServiceCategoryVatRate(category?.vat_rate ?? null);
            setShowChooseCategoryModal(false);
            const type = (category?.type ?? "").toString().toLowerCase();
            if (type === "transfer") {
              setShowTransferTypePopup(true);
            } else {
              setTimeout(() => setShowAddModal(true), 0);
            }
          }}
          onClose={() => setShowChooseCategoryModal(false)}
        />
      )}

      {showTransferTypePopup && (
        <TransferTypeChooserPopup
          onSelect={(transferType) => {
            setAddServiceTransferBookingType(transferType);
            setShowTransferTypePopup(false);
            setTimeout(() => setShowAddModal(true), 0);
          }}
          onClose={() => {
            setShowTransferTypePopup(false);
            setAddServiceCategoryId(null);
            setAddServiceCategoryType(null);
            setAddServiceCategoryName(null);
            setAddServiceCategoryVatRate(null);
          }}
        />
      )}

      {showAddModal && (
        <AddServiceModal
          orderDateFrom={orderDateFrom}
          orderDateTo={orderDateTo}
          orderCode={orderCode}
          defaultClientId={defaultClientId}
          defaultClientName={defaultClientName}
          companyCurrencyCode={companyCurrencyCode}
          initialCategoryId={addServiceCategoryId ?? undefined}
          initialCategoryType={addServiceCategoryType ?? undefined}
          initialCategoryName={addServiceCategoryName ?? undefined}
          initialVatRate={addServiceCategoryVatRate ?? undefined}
          initialTransferBookingType={addServiceTransferBookingType ?? undefined}
          flightServices={services.filter(s => (s.categoryType || getCategoryTypeFromName(s.category) || "").toString().toLowerCase() === "flight").map(s => ({ id: s.id, name: s.name, flightSegments: s.flightSegments || [] }))}
          hotelServices={services.filter(s => { const t = (s.categoryType || getCategoryTypeFromName(s.category) || "").toString().toLowerCase(); return t === "hotel" || (t === "tour" && !!(s as { hotelName?: string }).hotelName); }).map(s => ({ id: s.id, hotelName: (s as { hotelName?: string }).hotelName || s.name, dateFrom: s.dateFrom ?? undefined, dateTo: s.dateTo ?? undefined }))}
          orderTravellers={orderTravellers}
          onClose={() => {
            setShowAddModal(false);
            setAddServiceCategoryId(null);
            setAddServiceCategoryType(null);
            setAddServiceCategoryName(null);
            setAddServiceCategoryVatRate(null);
            setAddServiceTransferBookingType(null);
          }}
          onServiceAdded={handleServiceAdded}
        />
      )}


      {/* Edit Service Modal - simple inline editor */}
      {editServiceId && (
        <>
          <EditServiceModalNew
            service={services.find(s => s.id === editServiceId)! as React.ComponentProps<typeof EditServiceModalNew>['service']}
            orderCode={orderCode}
            orderDateFrom={orderDateFrom}
            orderDateTo={orderDateTo}
            companyCurrencyCode={companyCurrencyCode}
            flightServices={services.filter(s => (s.categoryType || getCategoryTypeFromName(s.category) || "").toString().toLowerCase() === "flight" && s.id !== editServiceId).map(s => ({ id: s.id, name: s.name, flightSegments: s.flightSegments || [] }))}
            hotelServices={services.filter(s => { const t = (s.categoryType || getCategoryTypeFromName(s.category) || "").toString().toLowerCase(); return t === "hotel" || (t === "tour" && !!(s as { hotelName?: string }).hotelName); }).map(s => ({ id: s.id, hotelName: (s as { hotelName?: string }).hotelName || s.name, dateFrom: s.dateFrom ?? undefined, dateTo: s.dateTo ?? undefined }))}
            initialClients={(() => {
              const svc = services.find(s => s.id === editServiceId);
              if (!svc) return undefined;
              const resolved = (svc.assignedTravellerIds || [])
                .map(id => orderTravellers.find(t => t.id === id))
                .filter(Boolean)
                .map(t => ({ id: t!.id, name: `${t!.firstName || ""} ${t!.lastName || ""}`.trim() || t!.id }));
              return resolved.length > 0 ? resolved : undefined;
            })()}
            orderTravellers={orderTravellers}
            onClose={() => setEditServiceId(null)}
            onServiceUpdated={(updated: Partial<Service> & { id: string; _keepModalOpen?: boolean }) => {
              const { _keepModalOpen, ...rest } = updated;
              setServices(prev => prev.map(s => s.id === rest.id ? { ...s, ...rest } as Service : s));
              if (!_keepModalOpen) setEditServiceId(null);
              fetchTravellers();
              // Refetch after short delay so backend has committed; noCache so Itinerary gets fresh dates
              setTimeout(() => fetchServices(true), 150);
            }}
          />
        </>
      )}


      {/* Split Service Modal (Single) */}
      {splitServiceId && (() => {
        const splitService = services.find(s => s.id === splitServiceId);
        const serviceTravellerIds = splitService?.assignedTravellerIds ?? [];
        const travellers = orderTravellers.filter(t => serviceTravellerIds.includes(t.id));
        return (
          <SplitServiceModal
            service={splitService!}
            orderCode={orderCode}
            travellers={travellers}
            orderTravellers={orderTravellers}
            mainClientId={defaultClientId ?? undefined}
            onTravellersRefetch={fetchTravellers}
            onClose={() => setSplitServiceId(null)}
            onSuccess={() => {
              fetchServices();
              setSplitServiceId(null);
            }}
          />
        );
      })()}
      {/* Split Multi Modal */}
      {splitMultiModalOpen && (
        <SplitModalMulti
          services={services.filter(s => selectedServiceIds.includes(s.id))}
          orderCode={orderCode}
          onClose={() => setSplitMultiModalOpen(false)}
          onServicesUpdated={() => {
            fetchServices();
            setSplitMultiModalOpen(false);
            setSelectedServiceIds([]);
          }}
        />
      )}
      
      {/* Merge Services Modal */}
      {mergeModalOpen && (
        <MergeServicesModal
          services={services.filter(s => selectedServiceIds.includes(s.id))}
          orderCode={orderCode}
          onClose={() => setMergeModalOpen(false)}
          onSuccess={() => {
            fetchServices();
            setMergeModalOpen(false);
            setSelectedServiceIds([]);
          }}
        />
      )}

      {/* Floating Action Bar - hide when modals are open */}
      {selectedServiceIds.length > 0 && !splitMultiModalOpen && !splitServiceId && !mergeModalOpen && (
        <div 
          ref={floatingBarRef}
          className={`fixed z-50 ${floatingBarPosition ? '' : 'bottom-6 left-1/2 -translate-x-1/2'} ${!floatingBarPosition ? 'animate-[slideUp_0.3s_ease-out]' : ''}`}
          style={floatingBarPosition ? {
            left: floatingBarPosition.x,
            top: floatingBarPosition.y,
            transform: 'translate(-50%, -50%)',
          } : undefined}
        >
          <div 
            className={`bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 px-2 py-2 flex items-center gap-1 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            onMouseDown={handleDragStart}
          >
            {/* Drag handle - double click to reset position */}
            <div 
              className="px-1 py-2 cursor-grab active:cursor-grabbing text-white/30 hover:text-white/50" 
              title="Drag to move, double-click to reset"
              onDoubleClick={() => setFloatingBarPosition(null)}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM14 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM14 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" />
              </svg>
            </div>
            
            {/* Selection info */}
            <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-xl mr-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <span className="text-blue-400 font-bold text-sm">{selectedServiceIds.length}</span>
                </div>
                <span className="text-white/70 text-sm hidden sm:block">selected</span>
              </div>
              <div className="w-px h-6 bg-white/10" />
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-400 font-semibold">
                  €{services
                    .filter(s => selectedServiceIds.includes(s.id))
                    .reduce((sum, s) => sum + s.clientPrice, 0)
                    .toLocaleString()}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <button
              onClick={() => {
                if (onIssueInvoice) {
                  // Filter out cancelled services before passing to onIssueInvoice
                  const selectedServicesData = services
                    .filter(s => selectedServiceIds.includes(s.id) && s.resStatus !== 'cancelled')
                    .map(s => {
                      const clientNames = (s.assignedTravellerIds?.length && orderTravellers.length)
                        ? orderTravellers
                            .filter((t) => s.assignedTravellerIds!.includes(t.id))
                            .map((t) => `${(t.firstName || "").trim()} ${(t.lastName || "").trim()}`.trim())
                            .filter(Boolean)
                            .join(", ") || s.client
                        : s.client;
                      return {
                        ...s,
                        id: s.id,
                        name: s.name,
                        clientPrice: s.clientPrice,
                        category: s.category,
                        dateFrom: s.dateFrom,
                        dateTo: s.dateTo,
                        client: clientNames,
                        clientPartyId: s.clientPartyId,
                        payer: s.payer,
                        payerPartyId: s.payerPartyId,
                        paymentDeadlineDeposit: s.paymentDeadlineDeposit,
                        paymentDeadlineFinal: s.paymentDeadlineFinal,
                        paymentTerms: s.paymentTerms,
                        resStatus: s.resStatus,
                        hotelName: (s as { hotelName?: string | null }).hotelName ?? null,
                        hotelStarRating: (s as { hotelStarRating?: string | null }).hotelStarRating ?? null,
                        hotelRoom: (s as { hotelRoom?: string | null }).hotelRoom ?? null,
                        hotelBoard: (s as { hotelBoard?: string | null }).hotelBoard ?? null,
                        mealPlanText: (s as { mealPlanText?: string | null }).mealPlanText ?? null,
                      };
                    });
                  
                  if (selectedServicesData.length === 0) {
                    alert('No active, non-invoiced services selected. Cancelled and already-invoiced services are excluded.');
                    return;
                  }
                  onIssueInvoice(selectedServicesData);
                  setSelectedServiceIds([]);
                }
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-slate-900 text-sm font-semibold rounded-xl hover:bg-gray-100 transition-all hover:scale-105 active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="hidden sm:inline">Invoice</span>
            </button>

            <button
              onClick={() => {
                if (selectedServiceIds.length === 1) {
                  setSplitServiceId(selectedServiceIds[0]);
                } else if (selectedServiceIds.length > 1) {
                  setSplitMultiModalOpen(true);
                }
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-400 transition-all hover:scale-105 active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <span className="hidden sm:inline">Split</span>
            </button>

            {selectedServiceIds.length >= 2 && (
              <button
                onClick={() => setMergeModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-purple-500 text-white text-sm font-semibold rounded-xl hover:bg-purple-400 transition-all hover:scale-105 active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden sm:inline">Merge</span>
              </button>
            )}

            {/* More Actions Dropdown */}
            <div className="relative" ref={bulkActionsRef}>
              <button
                onClick={() => setShowBulkActions(!showBulkActions)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all hover:scale-105 active:scale-95 ${
                  showBulkActions 
                    ? 'bg-white/20 text-white' 
                    : 'bg-white/10 text-white/80 hover:bg-white/15 hover:text-white'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                </svg>
                <span className="hidden sm:inline">More</span>
              </button>
              
              {showBulkActions && (
                <div className={`absolute right-0 w-52 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 overflow-hidden max-h-80 overflow-y-auto ${
                  (floatingBarPosition?.y ?? window.innerHeight) < window.innerHeight / 2 
                    ? 'top-full mt-3' 
                    : 'bottom-full mb-3'
                }`}>
                  <div className="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider">Assign</div>
                  <button
                    onClick={() => { setBulkAction("status"); setShowBulkActions(false); }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Set Status
                  </button>
                  <button
                    onClick={() => { setBulkAction("payer"); setShowBulkActions(false); }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Set Payer
                  </button>
                  <button
                    onClick={() => { setBulkAction("supplier"); setShowBulkActions(false); }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Set Supplier
                  </button>
                  <button
                    onClick={() => { setBulkAction("client"); setShowBulkActions(false); }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Set Client
                  </button>
                  
                  <div className="border-t border-gray-100 my-2" />
                  <div className="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</div>
                  
                  <button
                    onClick={() => { setBulkAction("duplicate"); setShowBulkActions(false); }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Duplicate
                  </button>
                  <button
                    onClick={() => { setBulkAction("cancel"); setShowBulkActions(false); }}
                    className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    Cancel Services
                  </button>
                </div>
              )}
            </div>

            {/* Close button */}
            <button
              onClick={() => setSelectedServiceIds([])}
              className="ml-1 p-2.5 text-white/40 hover:text-white hover:bg-white/10 rounded-xl transition-all"
              aria-label="Clear selection"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      
      {/* Duplicate Service Confirmation Modal */}
      <ConfirmModal
        isOpen={duplicateConfirmService !== null}
        onCancel={() => setDuplicateConfirmService(null)}
        onConfirm={handleDuplicateConfirm}
        title="Duplicate Service"
        message={`Create a copy of "${duplicateConfirmService?.name}"?`}
        confirmText="Duplicate"
        cancelText="Cancel"
      />
      
      {/* Cancel Service Confirmation Modal */}
      <ConfirmModal
        isOpen={cancelConfirmService !== null}
        onCancel={() => setCancelConfirmService(null)}
        onConfirm={handleCancelConfirm}
        title="Cancel Service"
        message={`Cancel service "${cancelConfirmService?.name}"?`}
        confirmText="Cancel Service"
        cancelText="Keep"
      />
      
      {/* Change Service Modal (for Flights) */}
      {changeModalService && (
        <ChangeServiceModal
          service={changeModalService}
          orderCode={orderCode}
          onClose={() => setChangeModalService(null)}
          onChangeConfirmed={() => {
            fetchServices();
            fetchTravellers();
          }}
        />
      )}
      
      {/* Cancel Service with Fees Modal */}
      {cancelModalService && (
        <CancelServiceModal
          service={cancelModalService}
          orderCode={orderCode}
          onClose={() => setCancelModalService(null)}
          onCancellationConfirmed={() => {
            fetchServices();
            fetchTravellers();
          }}
        />
      )}

      {contentModal && (
        <ContentModal
          isOpen={true}
          onClose={() => setContentModal(null)}
          title={contentModal.title}
          url={contentModal.url}
        />
      )}
      
      {/* Bulk Actions Popovers - appear near the floating bar */}
      {bulkAction === "status" && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] animate-[slideUp_0.2s_ease-out]">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-4 w-72">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Set Status</h3>
              <button onClick={() => setBulkAction(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-1">
              {["booked", "confirmed", "changed", "rejected", "cancelled"].map(status => (
                <button
                  key={status}
                  onClick={async () => {
                    const { data: { session } } = await supabase.auth.getSession();
                    for (const serviceId of selectedServiceIds) {
                      await fetch(`/api/orders/${encodeURIComponent(orderCode)}/services/${serviceId}`, {
                        method: "PATCH",
                        headers: {
                          "Content-Type": "application/json",
                          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
                        },
                        body: JSON.stringify({ res_status: status }),
                      });
                    }
                    fetchServices();
                    setBulkAction(null);
                  }}
                  className="w-full px-3 py-2 text-left rounded-lg hover:bg-gray-100 capitalize text-sm"
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {bulkAction === "cancel" && (
        <ConfirmModal
          isOpen={true}
          onCancel={() => setBulkAction(null)}
          onConfirm={async () => {
            const { data: { session } } = await supabase.auth.getSession();
            for (const serviceId of selectedServiceIds) {
              await fetch(`/api/orders/${encodeURIComponent(orderCode)}/services/${serviceId}`, {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
                },
                body: JSON.stringify({ res_status: "cancelled" }),
              });
            }
            fetchServices();
            setBulkAction(null);
          }}
          title="Cancel Services"
          message={`Cancel ${selectedServiceIds.length} selected services?`}
          confirmText="Cancel Services"
          cancelText="Keep"
        />
      )}
      
      {bulkAction === "duplicate" && (
        <ConfirmModal
          isOpen={true}
          onCancel={() => setBulkAction(null)}
          onConfirm={async () => {
            const { data: { session } } = await supabase.auth.getSession();
            for (const serviceId of selectedServiceIds) {
              const serviceData = services.find(s => s.id === serviceId);
              if (serviceData) {
                await fetch(`/api/orders/${encodeURIComponent(orderCode)}/services`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
                  },
                  body: JSON.stringify({
                    serviceName: serviceData.name + " (copy)",
                    category: serviceData.category,
                    dateFrom: serviceData.dateFrom,
                    dateTo: serviceData.dateTo,
                    supplierPartyId: serviceData.supplierPartyId || serviceData.supplier_party_id,
                    supplierName: serviceData.supplier !== "-" ? serviceData.supplier : null,
                    clientPartyId: serviceData.clientPartyId || serviceData.client_party_id,
                    clientName: serviceData.client !== "-" ? serviceData.client : null,
                    payerPartyId: serviceData.payerPartyId || serviceData.payer_party_id,
                    payerName: serviceData.payer !== "-" ? serviceData.payer : null,
                    servicePrice: serviceData.servicePrice,
                    clientPrice: serviceData.clientPrice,
                    resStatus: serviceData.resStatus,
                    refNr: serviceData.refNr,
                    ticketNr: serviceData.ticketNr,
                    cabinClass: serviceData.cabinClass,
                    baggage: serviceData.baggage,
                    flightSegments: serviceData.flightSegments,
                    clients: serviceData.assignedTravellerIds?.map(id => ({ partyId: id })) || [],
                  }),
                });
              }
            }
            fetchServices();
            fetchTravellers();
            setBulkAction(null);
          }}
          title="Duplicate Services"
          message={`Duplicate ${selectedServiceIds.length} selected services?`}
          confirmText="Duplicate"
          cancelText="Cancel"
        />
      )}
      
      {/* Set Payer Popover */}
      {bulkAction === "payer" && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] animate-[slideUp_0.2s_ease-out]">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-4 w-80">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Set Payer</h3>
              <button onClick={() => { setBulkAction(null); setBulkSearchQuery(""); setBulkSearchResults([]); }} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <input
              type="text"
              placeholder="Search payer..."
              value={bulkSearchQuery}
              autoFocus
              onChange={async (e) => {
                const query = e.target.value;
                setBulkSearchQuery(query);
                if (query.length < 2) {
                  setBulkSearchResults([]);
                  return;
                }
                setBulkSearchLoading(true);
                const { data: { session } } = await supabase.auth.getSession();
                const res = await fetch(`/api/directory?search=${encodeURIComponent(query)}&limit=10`, {
                  headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
                });
                if (res.ok) {
                  const data = await res.json();
                  const mapped = (data.data || []).map((r: { id: string; type: string; firstName?: string; lastName?: string; companyName?: string }) => ({
                    id: r.id,
                    type: r.type,
                    displayName: r.type === "person" 
                      ? [r.firstName, r.lastName].filter(Boolean).join(" ") 
                      : r.companyName || "Unknown",
                  }));
                  setBulkSearchResults(mapped);
                }
                setBulkSearchLoading(false);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {bulkSearchLoading && <p className="text-xs text-gray-500 mb-2">Searching...</p>}
            <div className="max-h-48 overflow-y-auto space-y-1">
              {bulkSearchResults.map(party => (
                <button
                  key={party.id}
                  onClick={async () => {
                    const { data: { session } } = await supabase.auth.getSession();
                    for (const serviceId of selectedServiceIds) {
                      await fetch(`/api/orders/${encodeURIComponent(orderCode)}/services/${serviceId}`, {
                        method: "PATCH",
                        headers: {
                          "Content-Type": "application/json",
                          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
                        },
                        body: JSON.stringify({ payer_party_id: party.id, payer_name: party.displayName }),
                      });
                    }
                    fetchServices();
                    setBulkAction(null);
                    setBulkSearchQuery("");
                    setBulkSearchResults([]);
                  }}
                  className="w-full px-3 py-2 text-left rounded-lg hover:bg-gray-100 flex items-center gap-2 text-sm"
                >
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{party.type}</span>
                  <span>{party.displayName}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Set Supplier Popover */}
      {bulkAction === "supplier" && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] animate-[slideUp_0.2s_ease-out]">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-4 w-80">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Set Supplier</h3>
              <button onClick={() => { setBulkAction(null); setBulkSearchQuery(""); setBulkSearchResults([]); }} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <input
              type="text"
              placeholder="Search supplier..."
              value={bulkSearchQuery}
              autoFocus
              onChange={async (e) => {
                const query = e.target.value;
                setBulkSearchQuery(query);
                if (query.length < 2) {
                  setBulkSearchResults([]);
                  return;
                }
                setBulkSearchLoading(true);
                const { data: { session } } = await supabase.auth.getSession();
                const res = await fetch(`/api/directory?search=${encodeURIComponent(query)}&role=supplier&limit=10`, {
                  headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
                });
                if (res.ok) {
                  const data = await res.json();
                  const mapped = (data.data || []).map((r: { id: string; type: string; firstName?: string; lastName?: string; companyName?: string }) => ({
                    id: r.id,
                    type: r.type,
                    displayName: r.type === "person" 
                      ? [r.firstName, r.lastName].filter(Boolean).join(" ") 
                      : r.companyName || "Unknown",
                  }));
                  setBulkSearchResults(mapped);
                }
                setBulkSearchLoading(false);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {bulkSearchLoading && <p className="text-xs text-gray-500 mb-2">Searching...</p>}
            <div className="max-h-48 overflow-y-auto space-y-1">
              {bulkSearchResults.map(party => (
                <button
                  key={party.id}
                  onClick={async () => {
                    const { data: { session } } = await supabase.auth.getSession();
                    for (const serviceId of selectedServiceIds) {
                      await fetch(`/api/orders/${encodeURIComponent(orderCode)}/services/${serviceId}`, {
                        method: "PATCH",
                        headers: {
                          "Content-Type": "application/json",
                          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
                        },
                        body: JSON.stringify({ supplier_party_id: party.id, supplier_name: party.displayName }),
                      });
                    }
                    fetchServices();
                    setBulkAction(null);
                    setBulkSearchQuery("");
                    setBulkSearchResults([]);
                  }}
                  className="w-full px-3 py-2 text-left rounded-lg hover:bg-gray-100 flex items-center gap-2 text-sm"
                >
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{party.type}</span>
                  <span>{party.displayName}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Set Client Popover - Multiple Selection */}
      {bulkAction === "client" && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] animate-[slideUp_0.2s_ease-out]">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-4 w-80">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Add Clients</h3>
              <button onClick={() => { setBulkAction(null); setBulkSearchQuery(""); setBulkSearchResults([]); setBulkSelectedClients([]); }} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Selected clients */}
            {bulkSelectedClients.length > 0 && (
              <div className="mb-3 p-2 bg-blue-50 rounded-lg">
                <div className="flex flex-wrap gap-1">
                  {bulkSelectedClients.map(client => (
                    <span key={client.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs">
                      {client.displayName}
                      <button
                        onClick={() => setBulkSelectedClients(prev => prev.filter(c => c.id !== client.id))}
                        className="hover:text-blue-600"
                      >
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            <input
              type="text"
              placeholder="Search clients..."
              value={bulkSearchQuery}
              autoFocus
              onChange={async (e) => {
                const query = e.target.value;
                setBulkSearchQuery(query);
                if (query.length < 2) {
                  setBulkSearchResults([]);
                  return;
                }
                setBulkSearchLoading(true);
                const { data: { session } } = await supabase.auth.getSession();
                const res = await fetch(`/api/directory?search=${encodeURIComponent(query)}&limit=10`, {
                  headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
                });
                if (res.ok) {
                  const data = await res.json();
                  const mapped = (data.data || []).map((r: { id: string; type: string; firstName?: string; lastName?: string; companyName?: string }) => ({
                    id: r.id,
                    type: r.type,
                    displayName: r.type === "person" 
                      ? [r.firstName, r.lastName].filter(Boolean).join(" ") 
                      : r.companyName || "Unknown",
                  }));
                  setBulkSearchResults(mapped);
                }
                setBulkSearchLoading(false);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {bulkSearchLoading && <p className="text-xs text-gray-500 mb-2">Searching...</p>}
            <div className="max-h-36 overflow-y-auto space-y-1 mb-3">
              {bulkSearchResults
                .filter(party => !bulkSelectedClients.some(c => c.id === party.id))
                .map(party => (
                <button
                  key={party.id}
                  onClick={() => {
                    setBulkSelectedClients(prev => [...prev, { id: party.id, displayName: party.displayName }]);
                    setBulkSearchQuery("");
                    setBulkSearchResults([]);
                  }}
                  className="w-full px-3 py-2 text-left rounded-lg hover:bg-gray-100 flex items-center gap-2 text-sm"
                >
                  <svg className="h-3 w-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{party.type}</span>
                  <span>{party.displayName}</span>
                </button>
              ))}
            </div>
            
            <button
              onClick={async () => {
                if (bulkSelectedClients.length === 0) return;
                const { data: { session } } = await supabase.auth.getSession();
                for (const serviceId of selectedServiceIds) {
                  await fetch(`/api/orders/${encodeURIComponent(orderCode)}/services/${serviceId}`, {
                    method: "PATCH",
                    headers: {
                      "Content-Type": "application/json",
                      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
                    },
                    body: JSON.stringify({ 
                      clients: bulkSelectedClients.map(c => ({ id: c.id, name: c.displayName })),
                      client_party_id: bulkSelectedClients[0]?.id,
                      client_name: bulkSelectedClients[0]?.displayName,
                    }),
                  });
                }
                fetchServices();
                fetchTravellers();
                setBulkAction(null);
                setBulkSearchQuery("");
                setBulkSearchResults([]);
                setBulkSelectedClients([]);
              }}
              disabled={bulkSelectedClients.length === 0}
              className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              Apply ({bulkSelectedClients.length})
            </button>
          </div>
        </div>
      )}

      {/* Floating panel for selected boarding passes */}
      {selectedBoardingPasses.length > 0 && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 bg-white rounded-xl shadow-2xl border border-gray-200 px-4 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">
              {selectedBoardingPasses.length} boarding pass{selectedBoardingPasses.length > 1 ? "es" : ""} selected
            </span>
            <div className="flex gap-1 max-w-xs overflow-x-auto">
              {selectedBoardingPasses.slice(0, 3).map(pass => (
                <span key={pass.passId} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs whitespace-nowrap">
                  {pass.flightNumber}
                </span>
              ))}
              {selectedBoardingPasses.length > 3 && (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                  +{selectedBoardingPasses.length - 3}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSendSelectedBoardingPasses("whatsapp")}
              className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center gap-1"
            >
              <span>📱</span> WhatsApp
            </button>
            <button
              onClick={() => handleSendSelectedBoardingPasses("email")}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-1"
            >
              <span>✉️</span> Email
            </button>
            <button
              onClick={handleClearBoardingPassSelection}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
              title="Clear selection"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
});

export default OrderServicesBlock;
