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
import { Map as MapIcon, ClipboardList, Mail, Send, XCircle, Loader2 } from "lucide-react";
import TripMap from "@/components/TripMap";
import { CityWithCountry } from "@/components/CityMultiSelect";
import { getCityByName, getCityByIATA, searchCities, resolveCity } from "@/lib/data/cities";
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
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useModalOverlay } from "@/contexts/ModalOverlayContext";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { t } from "@/lib/i18n";
import { computeServiceLineEconomics } from "@/lib/orders/serviceEconomics";

// ---------------------------------------------------------------------------
// Column config — drag-reorder + resize + localStorage persistence
// ---------------------------------------------------------------------------

type ColumnKey =
  | "invoice" | "category" | "name" | "client" | "payer"
  | "clientPrice" | "servicePrice" | "grossMargin" | "vat" | "netProfit"
  | "supplier" | "travellers" | "status" | "terms";

interface ColumnDef {
  key: ColumnKey;
  i18nKey: string;
  defaultWidth: number;
  minWidth: number;
  align?: "left" | "center" | "right";
}

const DEFAULT_COLUMNS: ColumnDef[] = [
  { key: "invoice",      i18nKey: "order.servInvoice",      defaultWidth: 80,  minWidth: 50,  align: "center" },
  { key: "category",     i18nKey: "order.servCategory",     defaultWidth: 100, minWidth: 60 },
  { key: "name",         i18nKey: "order.servName",         defaultWidth: 140, minWidth: 80 },
  { key: "client",       i18nKey: "order.servClient",       defaultWidth: 120, minWidth: 60 },
  { key: "payer",        i18nKey: "order.servPayer",        defaultWidth: 120, minWidth: 60 },
  { key: "clientPrice",  i18nKey: "order.servClientPrice",  defaultWidth: 80,  minWidth: 60 },
  { key: "servicePrice", i18nKey: "order.servServicePrice", defaultWidth: 80,  minWidth: 60 },
  { key: "grossMargin",  i18nKey: "order.servGrossMargin",  defaultWidth: 80,  minWidth: 50 },
  { key: "vat",          i18nKey: "order.servVat",          defaultWidth: 60,  minWidth: 40 },
  { key: "netProfit",    i18nKey: "order.servNetProfit",    defaultWidth: 80,  minWidth: 50 },
  { key: "supplier",     i18nKey: "order.servSupplier",     defaultWidth: 120, minWidth: 60 },
  { key: "travellers",   i18nKey: "order.servTravellers",   defaultWidth: 160, minWidth: 100 },
  { key: "status",       i18nKey: "order.servStatus",       defaultWidth: 80,  minWidth: 50 },
  { key: "terms",        i18nKey: "order.servTerms",        defaultWidth: 80,  minWidth: 50 },
];

const LS_KEY = "travelcms:services-table-columns";

type ColumnsConfig = { order: ColumnKey[]; widths: Record<string, number> };

function loadColumnsConfig(): ColumnsConfig {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultColumnsConfig();
    const parsed = JSON.parse(raw) as Partial<ColumnsConfig>;
    const allKeys = DEFAULT_COLUMNS.map((c) => c.key);
    let order = Array.isArray(parsed.order) ? (parsed.order as ColumnKey[]).filter((k) => allKeys.includes(k)) : [];
    for (const k of allKeys) {
      if (!order.includes(k)) order.push(k);
    }
    const widths: Record<string, number> = {};
    for (const col of DEFAULT_COLUMNS) {
      widths[col.key] = (parsed.widths && typeof parsed.widths[col.key] === "number") ? parsed.widths[col.key] : col.defaultWidth;
    }
    return { order, widths };
  } catch {
    return defaultColumnsConfig();
  }
}

function defaultColumnsConfig(): ColumnsConfig {
  return {
    order: DEFAULT_COLUMNS.map((c) => c.key),
    widths: Object.fromEntries(DEFAULT_COLUMNS.map((c) => [c.key, c.defaultWidth])),
  };
}

function saveColumnsConfig(cfg: ColumnsConfig) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(cfg)); } catch { /* quota */ }
}

function getColumnDef(key: ColumnKey): ColumnDef {
  return DEFAULT_COLUMNS.find((c) => c.key === key) || DEFAULT_COLUMNS[0];
}

/**
 * BSP + airline channel: show "Agency / Airline" only when the two names differ.
 * Prevents "Turkish Airlines / Turkish Airlines" when supplier_name equals airline_channel_supplier_name.
 */
function formatServiceSupplierDisplay(
  supplierName: string | null | undefined,
  airlineChannel: boolean,
  airlineChannelSupplierName: string | null | undefined
): string {
  const base = String(supplierName ?? "").trim();
  const air = String(airlineChannelSupplierName ?? "").trim();
  if (!airlineChannel || !air) {
    return base || "-";
  }
  if (base && air && base.toLowerCase() === air.toLowerCase()) {
    return base;
  }
  const left = !base || base === "-" ? "BSP" : base;
  return `${left}/${air}`;
}

export interface Traveller {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  dob?: string;
  personalCode?: string;
  contactNumber?: string;
  avatarUrl?: string | null;
  isMainClient?: boolean;
  dateFrom?: string | null;
  dateTo?: string | null;
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
  supplierNameRaw?: string;
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
  /** When true, client/sale price must not be edited (issued invoice). Draft/cancelled → false. */
  clientPriceLocked?: boolean;
  splitGroupId?: string | null;
  // Hotel-specific
  hotelName?: string;
  hotelHid?: number | null;
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
  airportServiceFlow?: string | null;
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
  airlineChannel?: boolean;
  airlineChannelSupplierId?: string | null;
  airlineChannelSupplierName?: string;
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
  serviceType?: "original" | "change" | "cancellation" | "ancillary";
  ancillaryType?: "extra_baggage" | "seat_selection" | "meal" | "other_ancillary" | null;
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

/** Air / flight ticket rows (category name or categoryType). */
function isFlightLikeService(s: Service): boolean {
  const t = (s.categoryType || getCategoryTypeFromName(s.category) || "").toString().toLowerCase();
  if (t === "flight") return true;
  const cat = (s.category || "").toLowerCase();
  return cat.includes("flight") || cat.includes("air ticket");
}

function serviceHasChangeChild(serviceId: string, all: Service[]): boolean {
  return all.some((x) => x.parentServiceId === serviceId && x.serviceType === "change");
}

/** Original row fully replaced by a change service (no segments left) — omit from map (matches itinerary rule). */
function isSupersededFlightOriginal(s: Service, all: Service[]): boolean {
  if (s.serviceType === "change") return false;
  if (s.resStatus !== "changed") return false;
  if (!serviceHasChangeChild(s.id, all)) return false;
  return !s.flightSegments || s.flightSegments.length === 0;
}

function serviceRowForChangeModal(s: Service) {
  const clientParty = s.clientPartyId ?? s.client_party_id ?? null;
  const payerParty = s.payerPartyId ?? s.payer_party_id ?? null;
  const supplierParty = s.supplierPartyId ?? s.supplier_party_id ?? null;
  const tickets = (s.ticketNumbers || []).filter(
    (tn): tn is { clientId: string; clientName: string; ticketNr: string } =>
      typeof tn.clientId === "string" && tn.clientId.length > 0
  );
  return {
    id: s.id,
    name: s.name,
    category: s.category,
    categoryId: s.categoryId ?? null,
    servicePrice: s.servicePrice,
    clientPrice: s.clientPrice,
    resStatus: s.resStatus,
    refNr: s.refNr,
    dateFrom: s.dateFrom,
    dateTo: s.dateTo,
    supplier: s.supplier,
    supplierPartyId: supplierParty,
    client: s.client && s.client !== "-" ? s.client : null,
    clientPartyId: clientParty,
    payer: s.payer && s.payer !== "-" ? s.payer : null,
    payerPartyId: payerParty,
    flightSegments: s.flightSegments || [],
    ticketNumbers: tickets.length > 0 ? tickets : undefined,
    assignedTravellerIds: s.assignedTravellerIds || [],
    cabinClass: s.cabinClass,
    baggage: s.baggage,
  };
}

/** Client price for sums (matches table row): cancellation lines are credits; DB often stores positive amount. */
function signedClientPriceForSum(s: Pick<Service, "clientPrice" | "serviceType">): number {
  const p = Number(s.clientPrice) || 0;
  if (s.serviceType === "cancellation") return -Math.abs(p);
  return p;
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Map `/api/orders/.../services` list items (camelCase API shape) to `Service` — shared by internal fetch and parent-provided rows. */
function mapOrderServicesApiRowsToServices(rows: unknown): Service[] {
  const list = Array.isArray(rows) ? rows : [];
  return list.map((rawRow) => {
    const s = rawRow as Record<string, unknown>;
    return {
      id: String(s.id),
      dateFrom: String(s.dateFrom ?? s.service_date_from ?? ""),
      dateTo: String(s.dateTo ?? s.service_date_to ?? s.dateFrom ?? s.service_date_from ?? ""),
      category: String(s.category ?? "Other"),
      categoryId: (s.categoryId ?? s.category_id) as string | null,
      categoryType: ((s.categoryType ?? s.category_type) || undefined) as Service["categoryType"],
      vatRate: numOrNull(s.vatRate ?? s.vat_rate),
      name: String(s.serviceName ?? s.service_name ?? ""),
      supplierNameRaw: String(s.supplierName ?? s.supplier_name ?? ""),
      supplier: formatServiceSupplierDisplay(
        (s.supplierName ?? s.supplier_name) as string | null | undefined,
        !!(s.airlineChannel ?? s.airline_channel),
        (s.airlineChannelSupplierName ?? s.airline_channel_supplier_name) as string | null | undefined
      ),
      client: String(s.clientName ?? s.client_name ?? "-"),
      payer: String(s.payerName ?? s.payer_name ?? "-"),
      supplierPartyId: (s.supplierPartyId ?? s.supplier_party_id) as string | undefined,
      payerPartyId: (s.payerPartyId ?? s.payer_party_id) as string | undefined,
      clientPartyId: (s.clientPartyId ?? s.client_party_id) as string | undefined,
      servicePrice: Number(s.servicePrice ?? s.service_price ?? 0),
      clientPrice: Number(s.clientPrice ?? s.client_price ?? 0),
      serviceCurrency: (() => {
        const v = s.serviceCurrency ?? (s as { service_currency?: unknown }).service_currency;
        return typeof v === "string" ? v : null;
      })(),
      servicePriceForeign: numOrNull(s.servicePriceForeign ?? (s as { service_price_foreign?: unknown }).service_price_foreign),
      exchangeRate: numOrNull(s.exchangeRate ?? (s as { exchange_rate?: unknown }).exchange_rate),
      actuallyPaid: numOrNull(s.actuallyPaid ?? (s as { actually_paid?: unknown }).actually_paid),
      quantity: Number(s.quantity ?? (s as { quantity?: number }).quantity ?? 1),
      resStatus: String(s.resStatus ?? s.res_status ?? "booked") as Service["resStatus"],
      refNr: String(s.refNr ?? s.ref_nr ?? ""),
      ticketNr: String(s.ticketNr ?? s.ticket_nr ?? ""),
      assignedTravellerIds: (s.travellerIds ?? s.traveller_ids ?? []) as string[],
      invoice_id: (s.invoice_id ?? null) as string | null,
      clientPriceLocked:
        typeof (s as { clientPriceLocked?: unknown }).clientPriceLocked === "boolean"
          ? (s as { clientPriceLocked: boolean }).clientPriceLocked
          : !!(s.invoice_id ?? null),
      splitGroupId: (s.splitGroupId ?? s.split_group_id ?? null) as string | null,
      flightSegments: (s.flightSegments ?? s.flight_segments ?? []) as FlightSegment[],
      ticketNumbers: (s.ticketNumbers ?? s.ticket_numbers ?? []) as Service["ticketNumbers"],
      boardingPasses: (s.boardingPasses ?? s.boarding_passes ?? []) as Service["boardingPasses"],
      baggage: String(s.baggage ?? ""),
      cabinClass: String(s.cabinClass ?? s.cabin_class ?? "economy") as Service["cabinClass"],
      airlineChannel: !!(s.airlineChannel ?? s.airline_channel),
      airlineChannelSupplierId: (s.airlineChannelSupplierId ?? s.airline_channel_supplier_id ?? null) as string | null,
      airlineChannelSupplierName: String(s.airlineChannelSupplierName ?? s.airline_channel_supplier_name ?? ""),
      pricingPerClient: Array.isArray(s.pricingPerClient ?? s.pricing_per_client) ? (s.pricingPerClient ?? s.pricing_per_client) as Service["pricingPerClient"] : null,
      priceType: (s.priceType ?? s.price_type ?? null) as Service["priceType"],
      refundPolicy: (s.refundPolicy ?? s.refund_policy ?? null) as Service["refundPolicy"],
      freeCancellationUntil: (s.freeCancellationUntil ?? s.free_cancellation_until ?? null) as string | null,
      cancellationPenaltyAmount: (s.cancellationPenaltyAmount ?? s.cancellation_penalty_amount ?? null) as number | null,
      cancellationPenaltyPercent: (s.cancellationPenaltyPercent ?? s.cancellation_penalty_percent ?? null) as number | null,
      parentServiceId: (s.parentServiceId ?? s.parent_service_id ?? null) as string | null,
      serviceType: String(s.serviceType ?? s.service_type ?? "original") as Service["serviceType"],
      ancillaryType: (s.ancillaryType ?? s.ancillary_type ?? null) as Service["ancillaryType"],
      cancellationFee: (s.cancellationFee ?? s.cancellation_fee ?? null) as number | null,
      refundAmount: (s.refundAmount ?? s.refund_amount ?? null) as number | null,
      changeFee: (s.changeFee ?? s.change_fee ?? null) as number | null,
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
      hotelName: (s.hotelName ?? s.hotel_name ?? null) as string | null,
      hotelHid: (s.hotelHid ?? (s as { hotel_hid?: number }).hotel_hid ?? null) as number | null,
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
      airportServiceFlow: (s.airportServiceFlow ?? (s as { airport_service_flow?: string }).airport_service_flow ?? null) as string | null,
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
    } as Service;
  });
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

type LoadedServiceCategory = { id: string; name: string; type: string; vat_rate?: number };

let travelServiceCategoriesCache: LoadedServiceCategory[] | null = null;
let travelServiceCategoriesInflight: Promise<LoadedServiceCategory[]> | null = null;

function mapFallbackCategories(): LoadedServiceCategory[] {
  return CHOOSE_CATEGORY_FALLBACK.map((c) => ({
    id: c.id,
    name: c.name,
    type: typeof c.type === "string" ? c.type.toLowerCase() : "other",
    vat_rate: typeof c.vat_rate === "number" ? c.vat_rate : 21,
  }));
}

/** One fetch per browser session (shared across order pages); avoids repeat /api/travel-service-categories on tab remounts. */
async function loadTravelServiceCategoriesOnce(): Promise<LoadedServiceCategory[]> {
  if (travelServiceCategoriesCache && travelServiceCategoriesCache.length > 0) {
    return travelServiceCategoriesCache;
  }
  if (travelServiceCategoriesInflight) return travelServiceCategoriesInflight;

  travelServiceCategoriesInflight = (async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        const fb = mapFallbackCategories();
        travelServiceCategoriesCache = fb;
        return fb;
      }
      const res = await fetch("/api/travel-service-categories", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const list = (data.categories || []).filter((c: { is_active?: boolean }) => c.is_active !== false);
        if (list.length > 0) {
          const mapped = list.map((c: { id: string; name: string; type?: string; vat_rate?: number }) => ({
            id: c.id,
            name: c.name,
            type: typeof c.type === "string" ? c.type.toLowerCase() : "other",
            vat_rate: typeof c.vat_rate === "number" ? c.vat_rate : 21,
          }));
          travelServiceCategoriesCache = mapped;
          return mapped;
        }
      }
      const fb = mapFallbackCategories();
      travelServiceCategoriesCache = fb;
      return fb;
    } catch {
      const fb = mapFallbackCategories();
      travelServiceCategoriesCache = fb;
      return fb;
    } finally {
      travelServiceCategoriesInflight = null;
    }
  })();

  return travelServiceCategoriesInflight;
}

function ChooseServiceTypeModal({
  lang,
  categories,
  onSelect,
  onClose,
}: {
  lang: string;
  categories: { id: string; name: string; type?: string; vat_rate?: number }[];
  onSelect: (categoryId: string, category?: { id: string; name: string; type?: string; vat_rate?: number }) => void;
  onClose: () => void;
}) {
  const trapRef = useFocusTrap<HTMLDivElement>(true);
  useModalOverlay();
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        ref={trapRef}
        className="w-full max-w-md rounded-xl bg-white shadow-xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">{t(lang, "order.whatServiceAdding")}</h2>
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
  lang,
  onSelect,
  onClose,
}: {
  lang: string;
  onSelect: (type: "one_way" | "return" | "by_hour") => void;
  onClose: () => void;
}) {
  const trapRef = useFocusTrap<HTMLDivElement>(true);
  useModalOverlay();
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
        ref={trapRef}
        className="w-full max-w-md rounded-xl bg-white shadow-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">{t(lang, "order.transferType")}</h2>
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
        <p className="text-sm text-gray-600 mb-4">{t(lang, "order.transferTypeHint")}</p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onSelect("one_way")}
            className="flex items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800"
          >
            {t(lang, "order.oneWay")}
          </button>
          <button
            type="button"
            onClick={() => onSelect("return")}
            className="flex items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800"
          >
            {t(lang, "order.returnTransfer")}
          </button>
          <button
            type="button"
            onClick={() => onSelect("by_hour")}
            className="flex items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800"
          >
            {t(lang, "order.byHour")}
          </button>
        </div>
      </div>
    </div>
  );
}

function AirportServiceTypePopup({
  onSelect,
  onClose,
}: {
  onSelect: (type: "meet_and_greet" | "fast_track") => void;
  onClose: () => void;
}) {
  const trapRef = useFocusTrap<HTMLDivElement>(true);
  useModalOverlay();
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
        ref={trapRef}
        className="w-full max-w-md rounded-xl bg-white shadow-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Airport service type</h2>
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
        <p className="text-sm text-gray-600 mb-4">Choose the airport service you want to add.</p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onSelect("meet_and_greet")}
            className="flex items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-800"
          >
            Meet &amp; Greet
          </button>
          <button
            type="button"
            onClick={() => onSelect("fast_track")}
            className="flex items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-800"
          >
            Fast Track
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
  onDatesFromServices?: (dates: { dateFrom: string | null; dateTo: string | null }) => void;
  stickyTopOffset?: number;
  userRole?: string | null;
  /** Open draggable directory card popup (order page) */
  onOpenDirectoryParty?: (partyId: string) => void;
  /**
   * When set, travellers list is owned by the parent (single GET .../travellers for header + services block).
   */
  travellersState?: readonly [Traveller[], React.Dispatch<React.SetStateAction<Traveller[]>>];
  /**
   * Parent-owned `/api/orders/.../services` rows (order page shares one fetch with Finances). `null` = loading.
   */
  servicesFromParent?: unknown[] | null;
  /** Refetch shared list; when set, this block does not fetch services on its own. */
  reloadServicesFromParent?: (noCache?: boolean) => Promise<void>;
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
  onDatesFromServices,
  stickyTopOffset = 0,
  userRole,
  onOpenDirectoryParty,
  travellersState,
  servicesFromParent,
  reloadServicesFromParent,
}, ref) {
  const { prefs } = useUserPreferences();
  const lang = prefs.language;
  const router = useRouter();

  // --- Column order + widths (persisted per-user in localStorage) ---
  const [colCfg, setColCfg] = useState<ColumnsConfig>(defaultColumnsConfig);
  useEffect(() => { setColCfg(loadColumnsConfig()); }, []);
  const orderedColumns = colCfg.order;
  const colWidths = colCfg.widths;
  const servicesTableColSpan = orderedColumns.length;

  const updateColumnOrder = useCallback((newOrder: ColumnKey[]) => {
    setColCfg((prev) => { const next = { ...prev, order: newOrder }; saveColumnsConfig(next); return next; });
  }, []);
  const updateColumnWidth = useCallback((key: ColumnKey, w: number) => {
    setColCfg((prev) => { const next = { ...prev, widths: { ...prev.widths, [key]: w } }; saveColumnsConfig(next); return next; });
  }, []);

  // Drag state for column reorder
  const [dragCol, setDragCol] = useState<ColumnKey | null>(null);
  const [dragOverCol, setDragOverCol] = useState<ColumnKey | null>(null);

  // Resize state
  const resizeRef = React.useRef<{ key: ColumnKey; startX: number; startW: number } | null>(null);
  const [localTravellers, setLocalTravellers] = useState<Traveller[]>([]);
  const orderTravellers = travellersState ? travellersState[0] : localTravellers;
  const setOrderTravellers = travellersState ? travellersState[1] : setLocalTravellers;
  const skipTravellersFetch = !!travellersState;
  const parentControlsServices = reloadServicesFromParent != null;
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
  const [addServiceAirportServiceType, setAddServiceAirportServiceType] = useState<"meet_and_greet" | "fast_track" | null>(null);
  const [showAirportServiceTypePopup, setShowAirportServiceTypePopup] = useState(false);
  const [ancillaryParentServiceId, setAncillaryParentServiceId] = useState<string | null>(null);
  const [serviceCategories, setServiceCategories] = useState<{ id: string; name: string; type?: string; vat_rate?: number }[]>([]);
  const [pendingOpenChooseModal, setPendingOpenChooseModal] = useState(false);
  const [editServiceId, setEditServiceId] = useState<string | null>(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  
  // Hide Cancelled: hides "garbage" (wrong entry, simple cancel). Formal annulments (serviceType=cancellation or has cancellation child) always visible.
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
  const [bpEmailModal, setBpEmailModal] = useState<{ to: string; subject: string; message: string } | null>(null);
  const [bpEmailSending, setBpEmailSending] = useState(false);
  const bpEmailTrapRef = useFocusTrap<HTMLDivElement>(!!bpEmailModal);
  useModalOverlay(!!bpEmailModal);

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

  // Parent IDs that have a formal cancellation child (always show those originals)
  const parentIdsWithCancellation = useMemo(() => {
    const set = new Set<string>();
    for (const s of services) {
      if (s.serviceType === 'cancellation' && s.parentServiceId) set.add(s.parentServiceId);
    }
    return set;
  }, [services]);

  // Filter: formal annulments always visible; "garbage" (simple cancel, no formal record) hideable
  const visibleServices = useMemo(() => {
    return services.filter(s => {
      if (s.resStatus === 'cancelled') {
        const isFormalAnnulment = s.serviceType === 'cancellation' || parentIdsWithCancellation.has(s.id);
        if (!isFormalAnnulment && hideCancelled) return false;
      }
      if (selectedTravellerId && !s.assignedTravellerIds.includes(selectedTravellerId)) return false;
      if (filterCategory && s.category !== filterCategory) return false;
      if (filterSupplier && s.supplier !== filterSupplier) return false;
      if (filterClient && getDisplayClient(s) !== filterClient) return false;
      if (filterPayer && s.payer !== filterPayer) return false;
      return true;
    });
  }, [services, hideCancelled, parentIdsWithCancellation, selectedTravellerId, filterCategory, filterSupplier, filterClient, filterPayer, getDisplayClient]);

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

  // Selectable services: non-invoiced only (incl. cancelled — for settlement / offset invoices)
  const visibleServicesWithoutInvoice = useMemo(() => {
    return visibleServices.filter(s => !s.invoice_id).map(s => s.id);
  }, [visibleServices]);
  
  // Filter selectedServiceIds: keep only non-invoiced (invoiced have no checkbox; change supplier via Edit)
  useEffect(() => {
    setSelectedServiceIds(prev => prev.filter(id => {
      const service = services.find(s => s.id === id);
      return service && !service.invoice_id;
    }));
  }, [services]);
  
  // Check if all selectable (non-invoiced) services are selected
  const allVisibleWithoutInvoiceSelected = useMemo(() => {
    if (visibleServicesWithoutInvoice.length === 0) return false;
    return visibleServicesWithoutInvoice.every(id => selectedServiceIds.includes(id));
  }, [visibleServicesWithoutInvoice, selectedServiceIds]);

  // Handle "select all" — only non-invoiced services
  const handleSelectAllVisible = (checked: boolean) => {
    if (checked) {
      setSelectedServiceIds(prev => {
        const newIds = [...prev];
        visibleServicesWithoutInvoice.forEach(id => {
          if (!newIds.includes(id)) newIds.push(id);
        });
        return newIds;
      });
    } else {
      setSelectedServiceIds(prev => prev.filter(id => !visibleServicesWithoutInvoice.includes(id)));
    }
  };
  
  const [splitMultiModalOpen, setSplitMultiModalOpen] = useState(false);
  const [splitServiceId, setSplitServiceId] = useState<string | null>(null);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [duplicateConfirmService, setDuplicateConfirmService] = useState<Service | null>(null);
  const [changeModalService, setChangeModalService] = useState<React.ComponentProps<typeof ChangeServiceModal>["service"] | null>(null);
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
    setBpEmailModal(null);
  }, []);

  const handleOpenBoardingPassEmailModal = useCallback(() => {
    if (selectedBoardingPasses.length === 0) return;
    const flights = [...new Set(selectedBoardingPasses.map((p) => p.flightNumber))].join(", ");
    setBpEmailModal({
      to: "",
      subject: `Boarding passes — ${flights}`,
      message: "Please find your boarding pass(es) attached.",
    });
  }, [selectedBoardingPasses]);

  const handleSendBoardingPassEmail = useCallback(async () => {
    if (!bpEmailModal || selectedBoardingPasses.length === 0) return;
    if (!bpEmailModal.to.trim()) {
      alert("Please enter recipient email.");
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setBpEmailSending(true);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/boarding-passes/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          to: bpEmailModal.to.trim(),
          subject: bpEmailModal.subject,
          message: bpEmailModal.message,
          attachments: selectedBoardingPasses.map((p) => ({ fileName: p.fileName, url: p.fileUrl })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setBpEmailModal(null);
        setSelectedBoardingPasses([]);
      } else {
        alert(data.error || "Failed to send email.");
      }
    } finally {
      setBpEmailSending(false);
    }
  }, [bpEmailModal, selectedBoardingPasses, orderCode]);

  const handleSendSelectedBoardingPasses = useCallback(async (method: "whatsapp" | "email") => {
    if (selectedBoardingPasses.length === 0) return;
    if (method === "email") {
      handleOpenBoardingPassEmailModal();
      return;
    }
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
      alert(`Files downloaded: ${fileNames}\n\nOpen WhatsApp and attach the downloaded files.`);
      setContentModal({ url: "https://web.whatsapp.com/", title: "WhatsApp" });
      handleClearBoardingPassSelection();
    } catch (err) {
      console.error("Share failed:", err);
    }
  }, [selectedBoardingPasses, handleClearBoardingPassSelection, handleOpenBoardingPassEmailModal]);
  
  // Calculate service count by traveller (respects hideCancelled for "garbage" only)
  const serviceCountByTraveller = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const service of services) {
      if (service.resStatus === 'cancelled') {
        const isFormalAnnulment = service.serviceType === 'cancellation' || parentIdsWithCancellation.has(service.id);
        if (!isFormalAnnulment && hideCancelled) continue;
      }
      for (const tid of service.assignedTravellerIds) {
        counts[tid] = (counts[tid] || 0) + 1;
      }
    }
    return counts;
  }, [services, hideCancelled, parentIdsWithCancellation]);
  
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
        if (isSupersededFlightOriginal(s, services)) return false;
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
        if (isSupersededFlightOriginal(s, services)) return false;
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
        if (isSupersededFlightOriginal(s, services)) return false;
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
    if (reloadServicesFromParent) {
      try {
        await reloadServicesFromParent(noCache);
      } catch (err) {
        console.error("Fetch services error:", err);
      } finally {
        setIsLoading(false);
      }
      return;
    }
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
        setServices(mapOrderServicesApiRowsToServices(data.services));
      }
    } catch (err) {
      console.error("Fetch services error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [orderCode, reloadServicesFromParent]);

  useEffect(() => {
    if (!parentControlsServices) return;
    if (servicesFromParent === null || servicesFromParent === undefined) {
      setIsLoading(true);
      return;
    }
    setIsLoading(false);
    setServices(mapOrderServicesApiRowsToServices(servicesFromParent));
  }, [parentControlsServices, servicesFromParent]);

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
    if (!reloadServicesFromParent) {
      void fetchServices();
    }
    if (!skipTravellersFetch) fetchTravellers();
  }, [fetchServices, fetchTravellers, skipTravellersFetch, reloadServicesFromParent]);

  useEffect(() => {
    if (!editServiceId || !orderCode) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(
          `/api/orders/${encodeURIComponent(orderCode)}/services/${editServiceId}`,
          {
            headers: {
              ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
            },
            credentials: "include",
          }
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { service?: unknown };
        if (!data.service || cancelled) return;
        const [mapped] = mapOrderServicesApiRowsToServices([data.service]);
        setServices((prev) => prev.map((svc) => (svc.id === editServiceId ? { ...svc, ...mapped } : svc)));
      } catch (e) {
        console.warn("[OrderServicesBlock] service detail for edit", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editServiceId, orderCode]);

  // Recalculate totals whenever services change
  // Include: active services + cancelled with penalty/credit (formal annulment: original + cancellation child)
  // Cancellation services = negative; cancelled originals with cancellation child = positive (they cancel out)
  const prevTotalsRef = React.useRef<{ amount_total: number; profit_estimated: number } | null>(null);
  useEffect(() => {
    if (!onTotalsChanged) return;
    const amount_total = services.reduce((sum, s) => {
      // Exclude cancelled unless it has a cancellation child (formal annulment)
      if (s.resStatus === "cancelled" && !parentIdsWithCancellation.has(s.id)) return sum;
      const price = Number(s.clientPrice) || 0;
      const isCancellation = s.serviceType === "cancellation";
      return sum + (isCancellation ? -Math.abs(price) : price);
    }, 0);
    const profit_estimated = services.reduce((sum, s) => {
      if (s.resStatus === "cancelled" && !parentIdsWithCancellation.has(s.id)) return sum;
      const sale = Number(s.clientPrice) || 0;
      const cost = Number(s.servicePrice) || 0;
      const isCancellation = s.serviceType === "cancellation";
      const saleSigned = isCancellation ? -Math.abs(sale) : sale;
      const costSigned = isCancellation ? -Math.abs(cost) : cost;
      const isTour = s.categoryType === "tour";
      if (isTour && s.commissionAmount != null) {
        const commission = Number(s.commissionAmount) || 0;
        const commissionSigned = isCancellation ? -Math.abs(commission) : commission;
        return sum + (saleSigned - (costSigned - commissionSigned));
      }
      return sum + (saleSigned - costSigned);
    }, 0);
    const prev = prevTotalsRef.current;
    if (prev && prev.amount_total === amount_total && prev.profit_estimated === profit_estimated) return;
    prevTotalsRef.current = { amount_total, profit_estimated };
    onTotalsChanged({ amount_total, profit_estimated });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services]);

  // Auto-sync order dates from services (always recalculate from service date range)
  const prevServiceDatesRef = React.useRef<{ dateFrom: string | null; dateTo: string | null } | null>(null);
  useEffect(() => {
    if (!onDatesFromServices || services.length === 0) return;
    const active = services.filter(s => s.resStatus !== "cancelled");
    const froms = active.map(s => s.dateFrom).filter(Boolean).sort();
    const tos = active.map(s => s.dateTo || s.dateFrom).filter(Boolean).sort();
    const dateFrom = froms[0] || null;
    const dateTo = tos[tos.length - 1] || null;
    const prev = prevServiceDatesRef.current;
    if (prev && prev.dateFrom === dateFrom && prev.dateTo === dateTo) return;
    prevServiceDatesRef.current = { dateFrom, dateTo };
    onDatesFromServices({ dateFrom, dateTo });
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

    const addCity = (candidate: string, nights: number, serviceDelta: number = 1, fallbackCountry?: string, fallbackCountryCode?: string) => {
      if (!candidate?.trim()) return;
      const name = candidate.trim();
      let cityData = getCityByName(name) || getCityByIATA(name);
      if (!cityData) {
        const fuzzy = searchCities(name);
        if (fuzzy.length > 0 && fuzzy[0].name.toLowerCase() === name.toLowerCase()) {
          cityData = fuzzy[0];
        }
      }
      const cityName = cityData?.name || name;
      const country = cityData?.country || fallbackCountry || "";
      const countryCode = cityData?.countryCode || fallbackCountryCode || "";
      const key = cityName.toLowerCase();
      const existing = byKey.get(key);
      if (existing) {
        existing.nights += nights;
        existing.serviceCount += serviceDelta;
        if (!existing.city.country && country) existing.city.country = country;
        if (!existing.city.countryCode && countryCode) existing.city.countryCode = countryCode;
      } else {
        byKey.set(key, {
          city: { city: cityName, country, countryCode, lat: cityData?.lat, lng: cityData?.lng },
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
        const svcCountry = (service as any).country || (service as any).dest_country || "";
        const svcCountryCode = (service as any).countryCode || (service as any).dest_country_code || "";
        const svcCity = (service as any).hotelCity || (service as any).dest_city || "";
        const candidates: string[] = [];
        if (svcCity) candidates.push(svcCity);
        const hotelAddress = (service as any).hotelAddress as string | undefined;
        const hotelName = (service as any).hotelName as string | undefined;
        if (hotelAddress) candidates.push(...hotelAddress.split(",").map((p: string) => p.trim()));
        if (hotelName) candidates.push(...hotelName.split(",").map((p: string) => p.trim()));
        candidates.push(service.name?.split(",")[0]?.trim() || "");
        let found = false;
        for (const c of candidates) {
          if (!c) continue;
          let cityData = getCityByName(c) || getCityByIATA(c);
          if (!cityData) {
            const fuzzy = searchCities(c);
            if (fuzzy.length > 0 && fuzzy[0].name.toLowerCase() === c.toLowerCase()) cityData = fuzzy[0];
          }
          if (cityData) {
            const key = cityData.name.toLowerCase();
            const existing = byKey.get(key);
            if (existing) {
              existing.nights += nights;
              existing.serviceCount += 1;
            } else {
              byKey.set(key, {
                city: { city: cityData.name, country: cityData.country || svcCountry, countryCode: cityData.countryCode || svcCountryCode, lat: cityData.lat, lng: cityData.lng },
                nights, serviceCount: 1,
              });
            }
            found = true;
            break;
          }
        }
        // Fallback when no candidate matched the city DB:
        // Use: 1) explicit hotelCity/dest_city, 2) last part of hotelAddress (most likely city in "Street, City" format),
        // 3) first part (for "City, Region" formats like "Sunny Beach, Sunny Beach").
        // Never fall back to hotel name fragments.
        if (!found) {
          let fallbackCity = svcCity;
          if (!fallbackCity && hotelAddress) {
            const addressParts = hotelAddress.split(",").map((p: string) => p.trim()).filter(Boolean);
            if (addressParts.length >= 2) {
              // Try last part first (typical "Street, City" format), then first part ("City, Region")
              fallbackCity = addressParts[addressParts.length - 1];
            }
          }
          if (fallbackCity) {
            const key = fallbackCity.toLowerCase();
            if (!byKey.has(key)) {
              byKey.set(key, {
                city: { city: fallbackCity, country: svcCountry, countryCode: svcCountryCode },
                nights, serviceCount: 1,
              });
            }
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
    const list = withNights.length > 0 ? withNights : sorted;
    const destinations = list.map((e) => e.city);
    if (destinations.length === 0) return;

    // Find cities missing country — resolve them via Nominatim
    const unresolved = destinations.filter((d) => !d.country && d.city);
    if (unresolved.length === 0) {
      onDestinationsFromServices(destinations);
      return;
    }

    // First emit what we have, then resolve in background
    onDestinationsFromServices(destinations);

    (async () => {
      let updated = false;
      const resolvePromises = unresolved.map(async (dest) => {
        const resolved = await resolveCity(dest.city);
        if (resolved) {
          dest.country = resolved.country;
          dest.countryCode = resolved.countryCode;
          dest.lat = dest.lat || resolved.lat;
          dest.lng = dest.lng || resolved.lng;
          updated = true;
        }
      });
      await Promise.all(resolvePromises);
      if (updated) {
        onDestinationsFromServices([...destinations]);
      }
    })();
  }, [services, onDestinationsFromServices]);

  // Load categories for "What service?" chooser (module cache: one network fetch per session)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await loadTravelServiceCategoriesOnce();
      if (!cancelled) setServiceCategories(list);
    })();
    return () => {
      cancelled = true;
    };
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
    const raw = service as unknown as Record<string, unknown>;
    const newService: Service = {
      id: service.id,
      dateFrom: service.dateFrom || "",
      dateTo: service.dateTo || service.dateFrom || "",
      category: service.category || "Other",
      categoryId: (service.categoryId ?? (raw.categoryId as string) ?? null) as string | null,
      categoryType: (service.categoryType ?? (raw.categoryType as string) ?? null) as Service["categoryType"],
      vatRate: ((raw.vatRate ?? raw.vat_rate) ?? null) as number | null,
      name: service.serviceName,
      supplierNameRaw: service.supplierName || "",
      supplier: formatServiceSupplierDisplay(
        service.supplierName,
        !!(service.airlineChannel ?? raw.airlineChannel),
        (service.airlineChannelSupplierName ?? raw.airlineChannelSupplierName) as string | null | undefined
      ),
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
      ticketNumbers: service.ticketNumbers || [],
      assignedTravellerIds: service.travellerIds || [],
      serviceType: ((raw.serviceType ?? raw.service_type) || "original") as Service["serviceType"],
      parentServiceId: (service.parentServiceId ?? null) as string | null,
      flightSegments: (service.flightSegments ?? (raw.flightSegments as FlightSegment[]) ?? []) as FlightSegment[],
      cabinClass: (service.cabinClass ?? (raw.cabinClass as string) ?? "economy") as Service["cabinClass"],
      baggage: (service.baggage ?? (raw.baggage as string) ?? "") as string,
      airlineChannel: !!(service.airlineChannel ?? raw.airlineChannel),
      airlineChannelSupplierId: (service.airlineChannelSupplierId ?? null) as string | null,
      airlineChannelSupplierName: (service.airlineChannelSupplierName ?? "") as string,
      pricingPerClient: (raw.pricingPerClient ?? raw.pricing_per_client ?? null) as Service["pricingPerClient"],
      hotelName: ((raw.hotelName ?? raw.hotel_name) || undefined) as string | undefined,
      hotelRoom: ((raw.hotelRoom ?? raw.hotel_room) || undefined) as string | undefined,
      hotelBoard: ((raw.hotelBoard ?? raw.hotel_board) || undefined) as string | undefined,
      hotelAddress: ((raw.hotelAddress ?? raw.hotel_address) || undefined) as string | undefined,
      transferRoutes: (Array.isArray(raw.transferRoutes ?? raw.transfer_routes) ? (raw.transferRoutes ?? raw.transfer_routes) : []) as Service["transferRoutes"],
    };
    setServices(prev => [...prev, newService]);
    // Refresh travellers so new clients appear in TRAVELLERS column (they're added to order_travellers by API)
    fetchTravellers();
    // Refetch full service data so Edit modal has all fields (same pattern as handleServiceUpdated)
    setTimeout(() => fetchServices(true), 150);
  };

  const selectedService = services.find((s) => s.id === modalServiceId);

  const getTravellerInitials = (travellerId: string) => {
    const traveller = orderTravellers.find((t) => t.id === travellerId);
    if (!traveller) return "??";
    return (
      traveller.firstName.charAt(0) + traveller.lastName.charAt(0)
    ).toUpperCase();
  };

  const getResStatusColor = (status: Service["resStatus"], _invoiceId?: string | null) => {
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
        // Half green (booked/confirmed side) + half gray (cancelled) — readable on all rows
        return "bg-[linear-gradient(to_right,#bbf7d0_50%,#e5e7eb_50%)] text-gray-800 border border-gray-200/80";
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
        supplierName: service.supplierNameRaw || (service.supplier !== "-" ? service.supplier : null),
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
              {orderedColumns.map((k) => <th key={k} className="px-2 py-1" />)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="px-2 py-1"><div className="h-3.5 rounded services-skeleton-cell mx-auto w-4" /></td>
                <td className="px-2 py-1"><div className="h-3.5 rounded services-skeleton-cell w-16" /></td>
                <td className="px-2 py-1"><div className="h-3.5 rounded services-skeleton-cell w-32" /></td>
                <td className="px-2 py-1"><div className="h-3.5 rounded services-skeleton-cell w-20" /></td>
                <td className="px-2 py-1"><div className="h-3.5 rounded services-skeleton-cell w-24" /></td>
                <td className="px-2 py-1"><div className="h-3.5 rounded services-skeleton-cell w-20" /></td>
                <td className="px-2 py-1"><div className="h-3.5 rounded services-skeleton-cell w-14" /></td>
                <td className="px-2 py-1"><div className="h-3.5 rounded services-skeleton-cell w-14" /></td>
                <td className="px-2 py-1"><div className="h-3.5 rounded services-skeleton-cell w-20" /></td>
                <td className="px-2 py-1"><div className="h-3.5 rounded services-skeleton-cell w-16" /></td>
                <td className="px-2 py-1"><div className="h-3.5 rounded services-skeleton-cell w-12" /></td>
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
      {/* Vertical layout: Services on top, Itinerary + Map below — no overflow-hidden: breaks file drop on itinerary (WebKit) */}
      <div className="space-y-4">
        {/* Services table — skeleton when loading; Itinerary block always rendered below */}
        {isLoading ? servicesTableContent : (
        <>
        <div className="rounded-lg bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 px-3 py-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0 sm:justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList size={18} strokeWidth={1.6} className="text-gray-500" />
            <h2 className="text-base font-semibold text-gray-900">{t(lang, "order.services")}</h2>
            <span className="text-xs text-gray-500">({visibleServices.length}{hideCancelled || hasActiveFilters || selectedTravellerId ? ` of ${services.length}` : ""})</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Filter menu */}
            <div className="relative" ref={filterMenuRef}>
              <button
                onClick={() => setFilterMenuOpen(o => !o)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  hasActiveFilters ? "bg-blue-100 text-blue-700 hover:bg-blue-200" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                title={t(lang, "order.filterBy")}
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                {t(lang, "order.filter")}{hasActiveFilters ? ` (${[filterCategory, filterSupplier, filterClient, filterPayer].filter(Boolean).length})` : ""}
              </button>
              {filterMenuOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-white rounded-lg border border-gray-200 shadow-lg py-2 px-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-700">{t(lang, "order.filterBy")}</span>
                    {hasActiveFilters && (
                      <button onClick={clearFilters} className="text-xs text-blue-600 hover:text-blue-800">{t(lang, "order.clear")}</button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">{t(lang, "order.servCategory")}</label>
                      <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full text-xs border border-gray-300 rounded px-2 py-1">
                        <option value="">All</option>
                        {filterOptions.categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">{t(lang, "order.servSupplier")}</label>
                      <select value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)} className="w-full text-xs border border-gray-300 rounded px-2 py-1">
                        <option value="">All</option>
                        {filterOptions.suppliers.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">{t(lang, "order.servClient")}</label>
                      <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)} className="w-full text-xs border border-gray-300 rounded px-2 py-1">
                        <option value="">All</option>
                        {filterOptions.clients.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">{t(lang, "order.servPayer")}</label>
                      <select value={filterPayer} onChange={(e) => setFilterPayer(e.target.value)} className="w-full text-xs border border-gray-300 rounded px-2 py-1">
                        <option value="">All</option>
                        {filterOptions.payers.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {/* Hide Cancelled — hides "garbage" (wrong entry, simple cancel). Formal annulments always visible. */}
            <button
              onClick={toggleHideCancelled}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                hideCancelled ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={hideCancelled ? t(lang, "order.showCancelled") : t(lang, "order.hideCancelled")}
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {hideCancelled ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                )}
              </svg>
              {hideCancelled ? t(lang, "order.showCancelled") : t(lang, "order.hideCancelled")}
            </button>
          </div>
        </div>

        {/* Itinerary Tabs - filter by traveller */}
        <div className="px-2 pb-0">
          <ItineraryTabs
            travellers={orderTravellers}
            selectedTravellerId={selectedTravellerId}
            onSelectTraveller={setSelectedTravellerId}
            serviceCountByTraveller={serviceCountByTraveller}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[680px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {orderedColumns.map((colKey) => {
                  const def = getColumnDef(colKey);
                  const w = colWidths[colKey] ?? def.defaultWidth;
                  const isInvoice = colKey === "invoice";
                  return (
                    <th
                      key={colKey}
                      draggable
                      onDragStart={() => setDragCol(colKey)}
                      onDragEnd={() => { setDragCol(null); setDragOverCol(null); }}
                      onDragOver={(e) => { e.preventDefault(); if (dragCol && dragCol !== colKey) setDragOverCol(colKey); }}
                      onDragLeave={() => { if (dragOverCol === colKey) setDragOverCol(null); }}
                      onDrop={() => {
                        if (!dragCol || dragCol === colKey) return;
                        const newOrder = [...orderedColumns];
                        const fromIdx = newOrder.indexOf(dragCol);
                        const toIdx = newOrder.indexOf(colKey);
                        newOrder.splice(fromIdx, 1);
                        newOrder.splice(toIdx, 0, dragCol);
                        updateColumnOrder(newOrder);
                        setDragCol(null);
                        setDragOverCol(null);
                      }}
                      style={{ width: w, minWidth: def.minWidth }}
                      className={`relative select-none px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-gray-700 cursor-grab ${
                        def.align === "center" ? "text-center" : "text-left"
                      } ${dragOverCol === colKey ? "border-l-2 border-blue-400" : ""}`}
                    >
                      {isInvoice ? (
                  <div className="flex items-center justify-center gap-2">
                    {visibleServicesWithoutInvoice.length > 0 && (
                      <input
                        type="checkbox"
                        checked={allVisibleWithoutInvoiceSelected}
                        onChange={(e) => handleSelectAllVisible(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        title="Select all non-invoiced services"
                        aria-label="Select all non-invoiced services"
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                          <span>{t(lang, def.i18nKey)}</span>
                  </div>
                      ) : (
                        t(lang, def.i18nKey)
                      )}
                      {/* Resize handle */}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-300 active:bg-blue-400"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          resizeRef.current = { key: colKey, startX: e.clientX, startW: w };
                          const onMove = (ev: MouseEvent) => {
                            if (!resizeRef.current) return;
                            const delta = ev.clientX - resizeRef.current.startX;
                            const newW = Math.max(def.minWidth, resizeRef.current.startW + delta);
                            updateColumnWidth(colKey, newW);
                          };
                          const onUp = () => {
                            resizeRef.current = null;
                            document.removeEventListener("mousemove", onMove);
                            document.removeEventListener("mouseup", onUp);
                          };
                          document.addEventListener("mousemove", onMove);
                          document.addEventListener("mouseup", onUp);
                        }}
                        draggable={false}
                      />
                </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {(() => {
                let serviceRowIndex = 0;
                return sortedGroupKeys.map((groupKey) => {
                const groupServices = (() => {
                  const raw = groupedServices[groupKey];
                  const parents = raw.filter(s => s.serviceType !== "ancillary").sort((a, b) => {
                    const cc = a.category.localeCompare(b.category);
                    return cc !== 0 ? cc : a.name.localeCompare(b.name);
                  });
                  const ancillaries = raw.filter(s => s.serviceType === "ancillary");
                  const result: Service[] = [];
                  for (const p of parents) {
                    result.push(p);
                    for (const a of ancillaries) {
                      if (a.parentServiceId === p.id) result.push(a);
                    }
                  }
                  for (const a of ancillaries) {
                    if (!result.includes(a)) result.push(a);
                  }
                  return result;
                })();
                const isExpanded = expandedGroups[groupKey] ?? true;

                return (
                  <React.Fragment key={`group-${groupKey}`}>
                    {/* Group header row */}
                    <tr
                      className="cursor-pointer bg-gray-100 hover:bg-gray-200"
                      onClick={() => toggleGroup(groupKey)}
                    >
                      <td className="px-2 py-1" colSpan={servicesTableColSpan}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-600 tabular-nums">
                              {isExpanded ? "▼" : "▶"}
                            </span>
                            <span className="text-xs font-semibold text-gray-900 leading-tight">
                              {groupKey}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500 tabular-nums">
                            {groupServices.length}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {/* Services in group */}
                    {isExpanded &&
                      groupServices.map((service) => {
                        const assignedIds = service.assignedTravellerIds;
                        const visibleIds = assignedIds.slice(0, 5);
                        const remainingCount = assignedIds.length - 5;

                        // Calculate split group info
                        let splitInfo = null;
                        if (service.splitGroupId) {
                          const splitGroupServices = services.filter(s => s.splitGroupId === service.splitGroupId);
                          const splitIndex = splitGroupServices.findIndex(s => s.id === service.id) + 1;
                          splitInfo = { index: splitIndex, total: splitGroupServices.length };
                        }

                        // Calculate color and connector for split groups
                        const splitGroupColor = service.splitGroupId ? getSplitGroupColor(service.splitGroupId) : null;

                        // CLIENT: show only the lead client (service.client), not all assigned travellers
                        const displayClientName = service.client;
                        const displayClientPartyId = service.clientPartyId;
                        const isAncillary = service.serviceType === "ancillary";

                        const econ = computeServiceLineEconomics({
                          client_price: service.clientPrice,
                          service_price: service.servicePrice,
                          service_type: service.serviceType,
                          category: service.category,
                          commission_amount: service.commissionAmount,
                          vat_rate: service.vatRate,
                          pricing_per_client: service.pricingPerClient ?? undefined,
                        });

                        const rowDelay = serviceRowIndex++ * 40;
                        return (
                          <React.Fragment key={service.id}>
                          <tr
                            className={`services-row-in group border-b border-gray-100 hover:bg-gray-50 leading-tight transition-colors cursor-pointer relative ${
                              service.splitGroupId ? `border-l-4 ${splitGroupColor?.border}` : ""
                            } ${isAncillary ? "bg-blue-50/30" : ""}`}
                            style={{ animationDelay: `${rowDelay}ms` }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setEditServiceId(service.id);
                            }}
                            title={
                              service.clientPriceLocked ?? !!service.invoice_id
                                ? "Double-click to edit (Supplier only)"
                                : "Double-click to edit"
                            }
                          >
                            {orderedColumns.map((colKey) => {
                              switch (colKey) {
                                case "invoice":
                                  return (
                            <td key={colKey} className="w-20 px-1.5 py-0.5 text-center relative">
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
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(`/orders/${orderCodeToSlug(orderCode)}?tab=finance&invoice=${service.invoice_id}`);
                                      }}
                                      className="p-0.5 text-green-600 hover:text-green-800 hover:scale-110 transition-all cursor-pointer"
                                      title={
                                        service.clientPriceLocked ?? !!service.invoice_id
                                          ? "View invoice · Double-click row to edit (Supplier only)"
                                          : "View invoice · Double-click row to edit"
                                      }
                                    >
                                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                    </button>
                                  </div>
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
                                    className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    aria-label={`Select ${service.name}`}
                                    title={
                                      service.resStatus === "cancelled"
                                        ? "Select for invoice (e.g. settlement with cancellation line)"
                                        : "Select for invoice or bulk ops"
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                )}
                              </div>
                            </td>
                                  );
                                case "category":
                                  return (
                            <td key={colKey} className="px-1.5 py-0.5 text-xs text-gray-700 leading-tight">
                              {isAncillary ? (
                                <span className="inline-flex items-center gap-1">
                                  <span className="text-gray-400">└</span>
                                  <span className="inline-flex items-center rounded px-1 py-0 text-[10px] font-medium bg-blue-100 text-blue-700">
                                    {service.ancillaryType === "extra_baggage" ? "Baggage" : service.ancillaryType === "seat_selection" ? "Seat" : service.ancillaryType === "meal" ? "Meal" : "Add-on"}
                                  </span>
                                </span>
                              ) : service.category}
                            </td>
                                  );
                                case "name":
                                  return (
                            <td key={colKey} className="px-1.5 py-0.5 text-xs font-medium text-gray-900 leading-snug">
                              <div className="flex items-start gap-1.5 min-w-0">
                                {splitInfo && (
                                  <span className={`inline-flex items-center gap-1 rounded px-1 py-0 text-[10px] font-medium shrink-0 mt-0.5 ${splitGroupColor?.bg} ${splitGroupColor?.text}`}>
                                  </span>
                                )}
                                <span className="break-words">{getServiceDisplayName(service, service.name)}</span>
                              </div>
                            </td>
                                  );
                                case "client":
                                  return (
                            <td key={colKey}
                              className={`px-1.5 py-0.5 text-xs text-gray-700 leading-tight ${(() => {
                                const pid = displayClientPartyId ?? service.clientPartyId;
                                if (!pid) return "";
                                if (isCtrlPressed && hoveredPartyId === `client-${service.id}`) {
                                  return "cursor-pointer text-blue-600 underline";
                                }
                                return onOpenDirectoryParty ? "cursor-pointer hover:bg-blue-50/80" : "";
                              })()}`}
                              onClick={(e) => {
                                const partyId = displayClientPartyId ?? service.clientPartyId;
                                if ((e.ctrlKey || e.metaKey) && partyId) {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  router.push(`/directory/${partyId}`);
                                  return;
                                }
                                if (partyId && onOpenDirectoryParty) {
                                  e.stopPropagation();
                                  onOpenDirectoryParty(partyId);
                                }
                              }}
                              onMouseEnter={() => (displayClientPartyId ?? service.clientPartyId) && setHoveredPartyId(`client-${service.id}`)}
                              onMouseLeave={() => setHoveredPartyId(null)}
                            >
                              {displayClientName}
                            </td>
                                  );
                                case "payer":
                                  return (
                            <td key={colKey}
                              className={`px-1.5 py-0.5 text-xs leading-tight ${service.payerPartyId && isCtrlPressed && hoveredPartyId === `payer-${service.id}` ? 'cursor-pointer text-blue-600 underline' : 'text-gray-700'}`}
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
                                  );
                                case "clientPrice":
                                  return (
                            <td key={colKey} className={`w-20 whitespace-nowrap px-1 py-0.5 text-left text-xs font-medium tabular-nums ${service.serviceType === "cancellation" ? "text-red-600" : "text-gray-900"}`}>
                              {service.serviceType === "cancellation"
                                ? formatCurrency(-Math.abs(service.clientPrice))
                                : formatCurrency(service.clientPrice)}
                            </td>
                                  );
                                case "servicePrice":
                                  return (
                            <td key={colKey} className={`w-20 whitespace-nowrap px-1 py-0.5 text-left text-xs tabular-nums ${(service.serviceType === "cancellation" && (service.servicePrice ?? 0) < 0) ? "text-red-600 font-medium" : "text-gray-700"}`} title={service.categoryType === "tour" && service.commissionAmount ? `Gross: ${formatCurrency(service.servicePrice)} | Commission: ${formatCurrency(service.commissionAmount)}` : undefined}>
                              {formatCurrency(
                                service.categoryType === "tour" && service.commissionAmount
                                  ? Math.round((service.servicePrice - service.commissionAmount) * 100) / 100
                                  : service.servicePrice
                              )}
                            </td>
                                  );
                                case "grossMargin":
                                  return (
                            <td key={colKey} className={`whitespace-nowrap px-1 py-0.5 text-left text-xs tabular-nums ${econ.marginGross < 0 ? "text-red-600 font-medium" : "text-gray-700"}`}>
                              {formatCurrency(econ.marginGross)}
                            </td>
                                  );
                                case "vat":
                                  return (
                            <td key={colKey} className="whitespace-nowrap px-1 py-0.5 text-left text-xs tabular-nums text-gray-500">
                              {econ.vatOnMargin > 0 ? formatCurrency(econ.vatOnMargin) : "—"}
                            </td>
                                  );
                                case "netProfit":
                                  return (
                            <td key={colKey} className={`whitespace-nowrap px-1 py-0.5 text-left text-xs font-medium tabular-nums ${econ.profitNetOfVat < 0 ? "text-red-600" : econ.profitNetOfVat > 0 ? "text-green-700" : "text-gray-500"}`}>
                              {formatCurrency(econ.profitNetOfVat)}
                            </td>
                                  );
                                case "supplier":
                                  return (
                            <td key={colKey}
                              className={`px-1.5 py-0.5 text-xs leading-tight ${service.supplierPartyId && isCtrlPressed && hoveredPartyId === `supplier-${service.id}` ? 'cursor-pointer text-blue-600 underline' : 'text-gray-700'}`}
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
                                  );
                                case "travellers":
                                  return (
                            <td key={colKey}
                              className="min-w-[160px] px-1.5 py-0.5 cursor-pointer hover:bg-blue-50 transition-colors"
                              onClick={(e) => handleOpenModal(service.id, e)}
                              title="Click to manage travellers"
                            >
                              <div className="flex items-center gap-1">
                                <div className="flex items-center gap-0.5">
                                  {visibleIds.map((travellerId) => {
                                    const trav = orderTravellers.find((t) => t.id === travellerId);
                                    const fullName = trav ? `${trav.firstName} ${trav.lastName}` : "";
                                    const openCard = (e: React.MouseEvent) => {
                                      e.stopPropagation();
                                      onOpenDirectoryParty?.(travellerId);
                                    };
                                    return trav?.avatarUrl ? (
                                      <button
                                        key={travellerId}
                                        type="button"
                                        onClick={openCard}
                                        disabled={!onOpenDirectoryParty}
                                        title={onOpenDirectoryParty ? `${fullName} — open card` : fullName}
                                        className={`h-4 w-4 rounded-full border border-blue-200 p-0 overflow-hidden shrink-0 ${onOpenDirectoryParty ? "cursor-pointer hover:ring-2 hover:ring-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500" : "cursor-default"}`}
                                      >
                                        <img
                                          src={trav.avatarUrl}
                                          alt=""
                                          className="h-full w-full object-cover pointer-events-none"
                                        />
                                      </button>
                                    ) : (
                                      <button
                                        key={travellerId}
                                        type="button"
                                        onClick={openCard}
                                        disabled={!onOpenDirectoryParty}
                                        title={onOpenDirectoryParty ? `${fullName} — open card` : fullName}
                                        className={`flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-[10px] font-medium text-blue-800 shrink-0 ${onOpenDirectoryParty ? "cursor-pointer hover:ring-2 hover:ring-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500" : ""}`}
                                      >
                                        {getTravellerInitials(travellerId)}
                                      </button>
                                    );
                                  })}
                                  {remainingCount > 0 && (
                                    <span className="text-[10px] text-gray-500 tabular-nums">
                                      +{remainingCount}
                                    </span>
                                  )}
                                </div>
                                <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded border border-gray-300 bg-white text-[10px] text-gray-600 leading-none">
                                  +
                                </span>
                              </div>
                            </td>
                                  );
                                case "status":
                                  return (
                            <td key={colKey} className="px-1.5 py-0.5 align-middle">
                              <span
                                className={`inline-flex rounded-full px-1.5 py-0 text-[10px] font-medium capitalize leading-tight ${getResStatusColor(
                                  service.resStatus,
                                  service.invoice_id
                                )}`}
                              >
                                {service.resStatus}
                              </span>
                            </td>
                                  );
                                case "terms":
                                  return (
                            <td key={colKey} className="px-1.5 py-0.5 align-middle text-xs">
                              {(() => {
                                const policy = service.refundPolicy || "non_ref";
                                const freeCancelDate = service.freeCancellationUntil || null;
                                const badge = getRefundPolicyBadge(policy as "non_ref" | "refundable" | "fully_ref", freeCancelDate);
                                const urgency = getDeadlineUrgency(freeCancelDate);
                                let badgeClass = "";
                                if (policy === "non_ref") {
                                  badgeClass = "bg-red-100 text-red-700 border border-red-200";
                                } else if (policy === "fully_ref") {
                                  badgeClass = "bg-green-100 text-green-700 border border-green-200";
                                } else {
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
                                    className={`inline-flex rounded px-1 py-0 text-[10px] font-medium cursor-help leading-tight ${badgeClass}`}
                                    title={tooltipParts.join("\n")}
                                  >
                                    {badge}
                                  </span>
                                ) : null;
                              })()}
                            </td>
                                  );
                                default:
                                  return <td key={colKey} />;
                              }
                            })}
                          </tr>
                          {/* Smart hints after this service */}
                          {getHintsAfterService(service.id).map(hint => (
                            <SmartHintRow
                              key={hint.id}
                              hint={hint}
                              onAction={handleHintAction}
                              onDismiss={handleDismissHint}
                              tableColSpan={servicesTableColSpan}
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
        </div>

        {/* Itinerary + Map outside Services card: avoid overflow-hidden + sticky (z-60) stacking over table rows */}
        <div className="min-w-0">
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
                parentServiceId: s.parentServiceId ?? null,
                ancillaryType: s.ancillaryType ?? null,
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
                try {
                  const response = await fetch(`/api/services/${serviceId}/boarding-passes`, { method: "POST", body: formData });
                  if (response.ok) {
                    void fetchServices(true);
                  } else {
                    const err = await response.json().catch(() => ({}));
                    alert(err.error || `Upload failed (${response.status})`);
                  }
                } catch (e) {
                  console.error("BP upload error:", e);
                  alert("Network error. Check console for details.");
                }
              }}
              onViewBoardingPass={(pass) => setContentModal({ url: pass.fileUrl, title: pass.fileName || "Boarding pass" })}
              onDeleteBoardingPass={async (serviceId, passId) => {
                if (!confirm("Delete this boarding pass?")) return;
                const response = await fetch(`/api/services/${serviceId}/boarding-passes?passId=${passId}`, { method: "DELETE" });
                if (response.ok) fetchServices(true); else alert("Failed to delete boarding pass");
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
        </>
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
          lang={lang}
          categories={serviceCategories.length > 0 ? serviceCategories : CHOOSE_CATEGORY_FALLBACK}
          onSelect={(categoryId, category) => {
            setAddServiceCategoryId(categoryId);
            setAddServiceCategoryType(category?.type ?? null);
            setAddServiceCategoryName(category?.name ?? null);
            setAddServiceCategoryVatRate(category?.vat_rate ?? null);
            setShowChooseCategoryModal(false);
            const type = (category?.type ?? "").toString().toLowerCase();
            const catName = (category?.name ?? "").toLowerCase();
            const isAirportServices = catName.includes("airport") && catName.includes("service");
            if (type === "transfer") {
              setShowTransferTypePopup(true);
            } else if (isAirportServices) {
              setShowAirportServiceTypePopup(true);
            } else {
              setTimeout(() => setShowAddModal(true), 0);
            }
          }}
          onClose={() => setShowChooseCategoryModal(false)}
        />
      )}

      {showTransferTypePopup && (
        <TransferTypeChooserPopup
          lang={lang}
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

      {showAirportServiceTypePopup && (
        <AirportServiceTypePopup
          onSelect={(airportType) => {
            setAddServiceAirportServiceType(airportType);
            setShowAirportServiceTypePopup(false);
            setTimeout(() => setShowAddModal(true), 0);
          }}
          onClose={() => {
            setShowAirportServiceTypePopup(false);
            setAddServiceCategoryId(null);
            setAddServiceCategoryType(null);
            setAddServiceCategoryName(null);
            setAddServiceCategoryVatRate(null);
          }}
        />
      )}

      {showAddModal && (() => {
        const existingPayer = services.find(s => s.payerPartyId && s.payer && s.payer !== "-" && s.resStatus !== "cancelled");
        return (
        <AddServiceModal
          orderDateFrom={orderDateFrom}
          orderDateTo={orderDateTo}
          orderCode={orderCode}
          defaultClientId={defaultClientId}
          defaultClientName={defaultClientName}
          defaultPayerId={existingPayer?.payerPartyId}
          defaultPayerName={existingPayer?.payer !== "-" ? existingPayer?.payer : undefined}
          companyCurrencyCode={companyCurrencyCode}
          initialCategoryId={addServiceCategoryId ?? undefined}
          initialCategoryType={addServiceCategoryType ?? undefined}
          initialCategoryName={addServiceCategoryName ?? undefined}
          initialVatRate={addServiceCategoryVatRate ?? undefined}
          initialTransferBookingType={addServiceTransferBookingType ?? undefined}
          initialAirportServiceType={addServiceAirportServiceType ?? undefined}
          initialAncillaryParentId={ancillaryParentServiceId}
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
            setAncillaryParentServiceId(null);
          }}
          onServiceAdded={handleServiceAdded}
        />
        );
      })()}


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
            onDeleteService={userRole === "supervisor" ? async (serviceId: string) => {
              const { data: { session } } = await supabase.auth.getSession();
              const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/services/${serviceId}`, {
                method: "DELETE",
                headers: { ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
              });
              if (res.ok) {
                fetchServices();
                fetchTravellers();
              } else {
                alert("Failed to delete service");
              }
            } : undefined}
            onRestoreToOriginal={async (cancellationServiceId: string, originalServiceId: string) => {
              const { data: { session } } = await supabase.auth.getSession();
              const headers: Record<string, string> = { "Content-Type": "application/json" };
              if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;
              const patchRes = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/services/${originalServiceId}`, {
                method: "PATCH",
                headers,
                body: JSON.stringify({ res_status: "confirmed" }),
              });
              if (!patchRes.ok) {
                const err = await patchRes.json().catch(() => ({}));
                throw new Error(err.error || "Failed to restore original service");
              }
              const delRes = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/services/${cancellationServiceId}`, {
                method: "DELETE",
                headers: { ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
              });
              if (!delRes.ok) {
                throw new Error("Failed to remove cancellation record");
              }
              fetchServices();
              fetchTravellers();
              setEditServiceId(null);
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
                    .reduce((sum, s) => sum + signedClientPriceForSum(s), 0)
                    .toLocaleString()}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <button
              onClick={() => {
                if (onIssueInvoice) {
                  // Exclude only already-invoiced lines (cancelled originals allowed for net settlement)
                  const selectedServicesData = services
                    .filter(s => selectedServiceIds.includes(s.id) && !s.invoice_id)
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
                    alert('No billable lines selected. Lines already on an invoice cannot be selected again.');
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
                  {selectedServiceIds.length === 1 && (() => {
                    const svc = services.find((s) => s.id === selectedServiceIds[0]);
                    const canChange =
                      !!svc &&
                      svc.resStatus !== "cancelled" &&
                      svc.serviceType !== "cancellation" &&
                      isFlightLikeService(svc) &&
                      (svc.flightSegments?.length ?? 0) > 0;
                    return canChange ? (
                      <button
                        type="button"
                        onClick={() => {
                          setShowBulkActions(false);
                          if (svc) setChangeModalService(serviceRowForChangeModal(svc));
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-amber-800 hover:bg-amber-50 flex items-center gap-3"
                      >
                        <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Change flight
                      </button>
                    ) : null;
                  })()}
                  <button
                    onClick={() => {
                      setShowBulkActions(false);
                      if (selectedServiceIds.length === 1) {
                        const svc = services.find(s => s.id === selectedServiceIds[0]);
                        if (svc && svc.resStatus !== "cancelled") setCancelModalService(svc);
                      } else {
                        setBulkAction("cancel");
                      }
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    Cancel Services
                  </button>
                  {userRole === "supervisor" && (
                    <>
                      <div className="border-t border-gray-100 my-2" />
                      <div className="px-3 py-1.5 text-xs font-medium text-red-400 uppercase tracking-wider">Danger</div>
                      <button
                        onClick={() => { setBulkAction("delete"); setShowBulkActions(false); }}
                        className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete Permanently
                      </button>
                    </>
                  )}
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
      
      {/* Change Service Modal (for Flights) */}
      {changeModalService && (
        <ChangeServiceModal
          service={changeModalService}
          orderCode={orderCode}
          onClose={() => setChangeModalService(null)}
          onChangeConfirmed={() => {
            setChangeModalService(null);
            setSelectedServiceIds([]);
            if (parentControlsServices) {
              void reloadServicesFromParent?.(true);
            } else {
              void fetchServices(true);
            }
            void fetchTravellers();
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

      {bpEmailModal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/40">
          <div
            ref={bpEmailTrapRef}
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-2 sm:mx-4 overflow-hidden max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-blue-600" />
                <h3 className="text-base font-semibold text-gray-900">Send boarding passes by email</h3>
              </div>
              <button
                onClick={() => setBpEmailModal(null)}
                disabled={bpEmailSending}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 disabled:opacity-50"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                <input
                  type="email"
                  value={bpEmailModal.to}
                  onChange={(e) => setBpEmailModal({ ...bpEmailModal, to: e.target.value })}
                  placeholder="recipient@example.com"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={bpEmailModal.subject}
                  onChange={(e) => setBpEmailModal({ ...bpEmailModal, subject: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  value={bpEmailModal.message}
                  onChange={(e) => setBpEmailModal({ ...bpEmailModal, message: e.target.value })}
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                <ClipboardList className="h-4 w-4 text-gray-400 shrink-0" />
                <span>{selectedBoardingPasses.length} boarding pass{selectedBoardingPasses.length !== 1 ? "es" : ""} will be attached</span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50/50">
              <button
                onClick={() => setBpEmailModal(null)}
                disabled={bpEmailSending}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSendBoardingPassEmail}
                disabled={bpEmailSending || !bpEmailModal.to.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bpEmailSending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send email
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Actions Popovers - appear near the floating bar */}
      {bulkAction === "status" && (
        <>
          <div className="fixed inset-0 z-[65]" onClick={() => setBulkAction(null)} />
          <div className="fixed inset-0 z-[70] flex items-end justify-center pb-24 pointer-events-none">
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-4 w-72 pointer-events-auto animate-[slideUp_0.2s_ease-out]">
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
        </>
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
                    supplierName: serviceData.supplierNameRaw || (serviceData.supplier !== "-" ? serviceData.supplier : null),
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
      
      {bulkAction === "delete" && (
        <ConfirmModal
          isOpen={true}
          onCancel={() => setBulkAction(null)}
          onConfirm={async () => {
            const { data: { session } } = await supabase.auth.getSession();
            let deletedCount = 0;
            for (const serviceId of selectedServiceIds) {
              const response = await fetch(
                `/api/orders/${encodeURIComponent(orderCode)}/services/${serviceId}`,
                {
                  method: "DELETE",
                  headers: {
                    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
                  },
                }
              );
              if (response.ok) deletedCount++;
            }
            if (deletedCount < selectedServiceIds.length) {
              alert(`Deleted ${deletedCount} of ${selectedServiceIds.length} services. Some could not be deleted.`);
            }
            setSelectedServiceIds([]);
            fetchServices();
            fetchTravellers();
            setBulkAction(null);
          }}
          title="Delete Services Permanently"
          message={`Are you sure you want to permanently delete ${selectedServiceIds.length} service(s)? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
        />
      )}

      {/* Set Payer Popover */}
      {bulkAction === "payer" && (
        <>
          <div className="fixed inset-0 z-[65]" onClick={() => { setBulkAction(null); setBulkSearchQuery(""); setBulkSearchResults([]); }} />
          <div className="fixed inset-0 z-[70] flex items-end justify-center pb-24 pointer-events-none">
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-4 w-80 pointer-events-auto animate-[slideUp_0.2s_ease-out]">
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
                    onClick={async (e) => {
                      const btn = e.currentTarget;
                      btn.disabled = true;
                      btn.textContent = "Saving...";
                      try {
                        const { data: { session } } = await supabase.auth.getSession();
                        const promises = selectedServiceIds.map(serviceId =>
                          fetch(`/api/orders/${encodeURIComponent(orderCode)}/services/${serviceId}`, {
                            method: "PATCH",
                            headers: {
                              "Content-Type": "application/json",
                              ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
                            },
                            body: JSON.stringify({ payer_party_id: party.id, payer_name: party.displayName }),
                          })
                        );
                        await Promise.all(promises);
                        fetchServices();
                      } catch (err) {
                        console.error("Failed to set payer:", err);
                      }
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
        </>
      )}
      
      {/* Set Supplier Popover */}
      {bulkAction === "supplier" && (
        <>
          <div className="fixed inset-0 z-[65]" onClick={() => { setBulkAction(null); setBulkSearchQuery(""); setBulkSearchResults([]); }} />
          <div className="fixed inset-0 z-[70] flex items-end justify-center pb-24 pointer-events-none">
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-4 w-80 pointer-events-auto animate-[slideUp_0.2s_ease-out]">
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
                    onClick={async (e) => {
                      const btn = e.currentTarget;
                      btn.disabled = true;
                      btn.textContent = "Saving...";
                      try {
                        const { data: { session } } = await supabase.auth.getSession();
                        const promises = selectedServiceIds.map(serviceId =>
                          fetch(`/api/orders/${encodeURIComponent(orderCode)}/services/${serviceId}`, {
                            method: "PATCH",
                            headers: {
                              "Content-Type": "application/json",
                              ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
                            },
                            body: JSON.stringify({ supplier_party_id: party.id, supplier_name: party.displayName }),
                          })
                        );
                        await Promise.all(promises);
                        fetchServices();
                      } catch (err) {
                        console.error("Failed to set supplier:", err);
                      }
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
        </>
      )}
      
      {/* Set Client Popover - Multiple Selection */}
      {bulkAction === "client" && (
        <>
          <div className="fixed inset-0 z-[65]" onClick={() => { setBulkAction(null); setBulkSearchQuery(""); setBulkSearchResults([]); setBulkSelectedClients([]); }} />
          <div className="fixed inset-0 z-[70] flex items-end justify-center pb-24 pointer-events-none">
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-4 w-80 pointer-events-auto animate-[slideUp_0.2s_ease-out]">
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
        </>
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
