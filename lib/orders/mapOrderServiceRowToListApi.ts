/**
 * Maps one `order_services` DB row to the same camelCase object as GET /api/orders/.../services list items.
 * Used by list route and GET .../services/[serviceId] (ORDER_PAGE_PERF Step 2b).
 */

import { clientPriceLockedFromInvoiceLink } from "@/lib/orders/clientPriceInvoiceLock";
import { vatRateFromCategory } from "@/lib/orders/vatRateFromCategory";

export type OrderServiceListMapById = Record<
  string,
  {
    supplier_name?: string | null;
    supplier_party_id?: string | null;
    parent_service_id?: string | null;
    service_type?: string | null;
  }
>;

export type OrderServiceListMapContext = {
  travellerIds: string[];
  categoryMap: Record<string, { type: string; vat_rate: number }>;
  contactOverridesMap: Record<number, { address?: string; phone?: string; email?: string }>;
  byId: OrderServiceListMapById;
  /** When set, used with invoice_id to compute clientPriceLocked (draft/cancelled = editable). */
  invoiceStatusById?: Record<string, string | null>;
};

function resolveSupplierName(row: Record<string, unknown>, byId: OrderServiceListMapById): string {
  const supplierName = (row.supplier_name as string | null | undefined) ?? "";
  const serviceType = row.service_type as string | null | undefined;
  if ((supplierName && supplierName.trim()) || serviceType !== "cancellation") {
    return supplierName || "";
  }
  const parentId = row.parent_service_id as string | null | undefined;
  if (!parentId) return supplierName || "";
  const parent = byId[parentId];
  return parent?.supplier_name && parent.supplier_name.trim() ? parent.supplier_name : supplierName || "";
}

export function mapOrderServiceRowToListApiItem(
  row: Record<string, unknown>,
  ctx: OrderServiceListMapContext
): Record<string, unknown> {
  const { travellerIds, categoryMap, contactOverridesMap, byId, invoiceStatusById } = ctx;
  const categoryId = row.category_id as string | null | undefined;
  const hotelHid = row.hotel_hid as number | null | undefined;
  const override = hotelHid != null ? contactOverridesMap[hotelHid] : undefined;

  const r = row as Record<string, unknown> & {
    flight_segments?: unknown;
    ticket_numbers?: unknown;
    boarding_passes?: unknown;
    baggage?: string | null;
    cabin_class?: string | null;
    hotel_name?: string | null;
    hotel_star_rating?: string | null;
    hotel_room?: string | null;
    hotel_board?: string | null;
    meal_plan_text?: string | null;
    transfer_type?: string | null;
    additional_services?: string | null;
    hotel_address?: string | null;
    hotel_phone?: string | null;
    hotel_email?: string | null;
    hotel_bed_type?: string | null;
    hotel_early_check_in?: boolean | null;
    hotel_late_check_in?: boolean | null;
    hotel_higher_floor?: boolean | null;
    hotel_king_size_bed?: boolean | null;
    hotel_honeymooners?: boolean | null;
    hotel_silent_room?: boolean | null;
    hotel_repeat_guests?: boolean | null;
    hotel_rooms_next_to?: string | null;
    hotel_parking?: boolean | null;
    hotel_preferences_free_text?: string | null;
    supplier_booking_type?: string | null;
    payment_deadline_deposit?: string | null;
    payment_deadline_final?: string | null;
    payment_terms?: string | null;
    price_type?: string | null;
    refund_policy?: string | null;
    free_cancellation_until?: string | null;
    cancellation_penalty_amount?: string | number | null;
    cancellation_penalty_percent?: number | null;
    commission_name?: string | null;
    commission_rate?: number | null;
    commission_amount?: number | null;
    agent_discount_value?: number | null;
    agent_discount_type?: string | null;
    pickup_location?: string | null;
    dropoff_location?: string | null;
    pickup_time?: string | null;
    estimated_duration?: string | null;
    linked_flight_id?: string | null;
    transfer_routes?: unknown;
    transfer_mode?: string | null;
    vehicle_class?: string | null;
    driver_name?: string | null;
    driver_phone?: string | null;
    driver_notes?: string | null;
  };

  const vatRate = (() => {
    const raw = row.vat_rate as number | string | null | undefined;
    const n = raw != null && raw !== "" ? Number(raw) : NaN;
    const catMeta = categoryId ? categoryMap[categoryId] : undefined;
    // Explicit positive rate on the line wins (user override).
    if (Number.isFinite(n) && n > 0) return n;
    // 0 / null / missing: use Travel Service category defaults (same as Settings).
    if (catMeta) {
      return vatRateFromCategory({
        type: catMeta.type,
        vat_rate: catMeta.vat_rate,
        vatRate: catMeta.vat_rate,
      });
    }
    if (Number.isFinite(n)) return n;
    return null;
  })();

  const supplierPartyId = (() => {
    const svc = row as { supplier_party_id?: string | null; parent_service_id?: string | null; service_type?: string | null };
    if (svc.supplier_party_id || svc.service_type !== "cancellation") return row.supplier_party_id as string | null | undefined;
    const parent = svc.parent_service_id ? byId[svc.parent_service_id] : null;
    return (parent?.supplier_party_id ?? row.supplier_party_id) ?? null;
  })();

  const invoiceId = (row.invoice_id as string | null | undefined) ?? null;
  const clientPriceLocked = clientPriceLockedFromInvoiceLink(invoiceId, invoiceStatusById);

  return {
    id: row.id,
    category: (row.category as string) || "",
    categoryId: categoryId ?? null,
    categoryType: (categoryId && categoryMap[categoryId]?.type) || null,
    vatRate,
    serviceName: row.service_name,
    dateFrom: row.service_date_from,
    dateTo: row.service_date_to,
    supplierPartyId,
    supplierName: resolveSupplierName(row, byId),
    airlineChannel: row.airline_channel || false,
    airlineChannelSupplierId: row.airline_channel_supplier_id || null,
    airlineChannelSupplierName: row.airline_channel_supplier_name || "",
    clientPartyId: row.client_party_id,
    clientName: (row.client_name as string) || "",
    payerPartyId: row.payer_party_id,
    payerName: (row.payer_name as string) || "",
    servicePrice: parseFloat(String(row.service_price || "0")),
    clientPrice: parseFloat(String(row.client_price || "0")),
    serviceCurrency: (row.service_currency as string | null | undefined) ?? null,
    servicePriceForeign:
      row.service_price_foreign != null ? parseFloat(String(row.service_price_foreign)) : null,
    exchangeRate: row.exchange_rate != null ? parseFloat(String(row.exchange_rate)) : null,
    actuallyPaid: row.actually_paid != null ? parseFloat(String(row.actually_paid)) : null,
    quantity: (row.quantity as number | null | undefined) ?? 1,
    resStatus: (row.res_status as string) || "booked",
    refNr: (row.ref_nr as string) || "",
    ticketNr: (row.ticket_nr as string) || "",
    travellerIds,
    invoice_id: invoiceId,
    clientPriceLocked,
    referralIncludeInCommission: (row.referral_include_in_commission as boolean | null | undefined) !== false,
    referralCommissionPercentOverride: (() => {
      const v = row.referral_commission_percent_override as number | string | null | undefined;
      if (v == null || v === "") return null;
      const n = parseFloat(String(v));
      return Number.isFinite(n) ? n : null;
    })(),
    referralCommissionFixedAmount: (() => {
      const v = row.referral_commission_fixed_amount as number | string | null | undefined;
      if (v == null || v === "") return null;
      const n = parseFloat(String(v));
      return Number.isFinite(n) ? n : null;
    })(),
    splitGroupId: (row.split_group_id as string | null | undefined) ?? null,
    flightSegments: Array.isArray(r.flight_segments) ? r.flight_segments : [],
    ticketNumbers: Array.isArray(r.ticket_numbers) ? r.ticket_numbers : [],
    boardingPasses: Array.isArray(r.boarding_passes) ? r.boarding_passes : [],
    baggage: r.baggage ?? "",
    cabinClass: r.cabin_class ?? "economy",
    hotelName: r.hotel_name ?? null,
    hotelHid: hotelHid ?? null,
    hotelStarRating: r.hotel_star_rating ?? null,
    hotelRoom: r.hotel_room ?? null,
    hotelBoard: r.hotel_board ?? null,
    mealPlanText: r.meal_plan_text ?? null,
    transferType: r.transfer_type ?? null,
    additionalServices: r.additional_services ?? null,
    hotelAddress: (r.hotel_address?.trim() || override?.address) ?? null,
    hotelPhone: (r.hotel_phone?.trim() || override?.phone) ?? null,
    hotelEmail: (r.hotel_email?.trim() || override?.email) ?? null,
    hotelBedType: r.hotel_bed_type ?? null,
    hotelEarlyCheckIn: r.hotel_early_check_in ?? null,
    hotelLateCheckIn: r.hotel_late_check_in ?? null,
    hotelEarlyCheckInTime: (row.hotel_early_check_in_time as string | null | undefined) ?? null,
    hotelLateCheckInTime: (row.hotel_late_check_in_time as string | null | undefined) ?? null,
    hotelRoomUpgrade: (row.hotel_room_upgrade as boolean | null | undefined) ?? null,
    hotelLateCheckOut: (row.hotel_late_check_out as boolean | null | undefined) ?? null,
    hotelLateCheckOutTime: (row.hotel_late_check_out_time as string | null | undefined) ?? null,
    hotelHigherFloor: r.hotel_higher_floor ?? null,
    hotelKingSizeBed: r.hotel_king_size_bed ?? null,
    hotelHoneymooners: r.hotel_honeymooners ?? null,
    hotelSilentRoom: r.hotel_silent_room ?? null,
    hotelRepeatGuests: r.hotel_repeat_guests ?? null,
    hotelRoomsNextTo: r.hotel_rooms_next_to ?? null,
    hotelParking: r.hotel_parking ?? null,
    hotelPreferencesFreeText: r.hotel_preferences_free_text ?? null,
    hotelPricePer: (row.hotel_price_per as string | null | undefined) ?? null,
    supplierBookingType: r.supplier_booking_type ?? null,
    paymentDeadlineDeposit: r.payment_deadline_deposit ?? null,
    paymentDeadlineFinal: r.payment_deadline_final ?? null,
    paymentTerms: r.payment_terms ?? null,
    priceType: r.price_type ?? null,
    refundPolicy: r.refund_policy ?? null,
    freeCancellationUntil: r.free_cancellation_until ?? null,
    cancellationPenaltyAmount:
      r.cancellation_penalty_amount != null ? parseFloat(String(r.cancellation_penalty_amount)) : null,
    cancellationPenaltyPercent: r.cancellation_penalty_percent ?? null,
    commissionName: r.commission_name ?? null,
    commissionRate: r.commission_rate ?? null,
    commissionAmount: r.commission_amount ?? null,
    agentDiscountValue: r.agent_discount_value ?? null,
    agentDiscountType: r.agent_discount_type ?? null,
    servicePriceLineItems: Array.isArray(row.service_price_line_items)
      ? (row.service_price_line_items as Array<{ description?: string; amount?: number; commissionable?: boolean }>)
      : [],
    pickupLocation: r.pickup_location ?? null,
    dropoffLocation: r.dropoff_location ?? null,
    pickupTime: r.pickup_time ?? null,
    estimatedDuration: r.estimated_duration ?? null,
    linkedFlightId: r.linked_flight_id ?? null,
    airportServiceFlow: (row.airport_service_flow as string | null | undefined) ?? null,
    transferRoutes: Array.isArray(r.transfer_routes) ? r.transfer_routes : [],
    transferMode: r.transfer_mode ?? null,
    vehicleClass: r.vehicle_class ?? null,
    driverName: r.driver_name ?? null,
    driverPhone: r.driver_phone ?? null,
    driverNotes: r.driver_notes ?? null,
    pricingPerClient: Array.isArray(row.pricing_per_client)
      ? (row.pricing_per_client as unknown[])
      : null,
    parentServiceId: (row.parent_service_id as string | null | undefined) ?? null,
    serviceType: (row.service_type as string | null | undefined) ?? "original",
    ancillaryType: (row.ancillary_type as string | null | undefined) ?? null,
    cancellationFee:
      row.cancellation_fee != null ? parseFloat(String(row.cancellation_fee)) : null,
    refundAmount: row.refund_amount != null ? parseFloat(String(row.refund_amount)) : null,
    changeFee: row.change_fee != null ? parseFloat(String(row.change_fee)) : null,
    cancellationRefundType: (row.cancellation_refund_type as string | null | undefined) ?? null,
  };
}
