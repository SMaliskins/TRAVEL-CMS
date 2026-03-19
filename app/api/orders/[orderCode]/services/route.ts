import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getApiUser } from "@/lib/auth/getApiUser";
import { upsertOrderServiceEmbedding } from "@/lib/embeddings/upsert";
import { sendPushToClient } from "@/lib/client-push/sendPush";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function syncOrderDatesFromServices(orderId: string) {
  try {
    const { data: services } = await supabaseAdmin
      .from("order_services")
      .select("service_date_from, service_date_to")
      .eq("order_id", orderId)
      .neq("res_status", "cancelled");
    if (!services || services.length === 0) return;

    const froms = services.map(s => s.service_date_from).filter(Boolean).sort();
    const tos = services.map(s => s.service_date_to || s.service_date_from).filter(Boolean).sort();
    const minFrom = froms[0] || null;
    const maxTo = tos[tos.length - 1] || null;

    if (minFrom || maxTo) {
      const upd: Record<string, string | null> = {};
      if (minFrom) upd.date_from = minFrom;
      if (maxTo) upd.date_to = maxTo;
      await supabaseAdmin.from("orders").update(upd).eq("id", orderId);
    }
  } catch (e) {
    console.warn("[syncOrderDatesFromServices]", e);
  }
}

async function getOrderId(orderCode: string, companyId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq("order_code", orderCode)
    .eq("company_id", companyId)
    .single();
  return data?.id || null;
}

// GET - List services for an order
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string }> }
) {
  try {
    const { orderCode } = await params;

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const companyId = await getCompanyId(user.id);
    if (!companyId) {
      return NextResponse.json({ error: "User has no company assigned" }, { status: 400 });
    }

    const orderId = await getOrderId(orderCode, companyId);
    if (!orderId) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Fetch services with all columns
    const { data: services, error } = await supabaseAdmin
      .from("order_services")
      .select("*")
      .eq("order_id", orderId)
      .eq("company_id", companyId)
      .order("service_date_from", { ascending: true });

    if (error) {
      console.error("Fetch services error:", error);
      return NextResponse.json({ error: "Failed to fetch services" }, { status: 500 });
    }

    // Fetch travellers for each service
    const serviceIds = (services || []).map(s => s.id);
    let travellerMap: Record<string, string[]> = {};
    
    if (serviceIds.length > 0) {
      const { data: serviceTravellers } = await supabaseAdmin
        .from("order_service_travellers")
        .select("service_id, traveller_id")
        .in("service_id", serviceIds);

      if (serviceTravellers) {
        travellerMap = serviceTravellers.reduce((acc, st) => {
          if (!acc[st.service_id]) acc[st.service_id] = [];
          acc[st.service_id].push(st.traveller_id);
          return acc;
        }, {} as Record<string, string[]>);
      }
    }

    // Batch lookup category types from travel_service_categories for services with category_id
    const categoryIds = [...new Set((services || []).map((s: { category_id?: string | null }) => (s as { category_id?: string }).category_id).filter((id): id is string => !!id))];
    let categoryMap: Record<string, { type: string; vat_rate: number }> = {};
    if (categoryIds.length > 0) {
      const { data: cats } = await supabaseAdmin
        .from("travel_service_categories")
        .select("id, type, vat_rate")
        .in("id", categoryIds);
      if (cats) {
        categoryMap = cats.reduce((acc, c) => {
          acc[c.id] = { type: c.type, vat_rate: c.vat_rate };
          return acc;
        }, {} as Record<string, { type: string; vat_rate: number }>);
      }
    }

    // Enrich hotel services with contacts from hotel_contact_overrides when order_services has hotel_hid
    const hotelHids = [...new Set((services || []).map((s: { hotel_hid?: number | null }) => (s as { hotel_hid?: number }).hotel_hid).filter((hid): hid is number => hid != null))];
    let contactOverridesMap: Record<number, { address?: string; phone?: string; email?: string }> = {};
    if (hotelHids.length > 0 && companyId) {
      const { data: overrides } = await supabaseAdmin
        .from("hotel_contact_overrides")
        .select("hotel_hid, address, phone, email")
        .eq("company_id", companyId)
        .in("hotel_hid", hotelHids);
      if (overrides) {
        contactOverridesMap = overrides.reduce((acc, o) => {
          acc[o.hotel_hid] = {
            address: o.address?.trim() || undefined,
            phone: o.phone?.trim() || undefined,
            email: o.email?.trim() || undefined,
          };
          return acc;
        }, {} as Record<number, { address?: string; phone?: string; email?: string }>);
      }
    }

    // Map to API format (flight for Itinerary; Tour/hotel/terms for Edit)
    type Row = typeof services extends (infer R)[] ? R : never;
    const mappedServices = (services || []).map(s => {
      const row = s as Row & {
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
        // Transfer fields
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
      return {
        id: s.id,
        category: s.category || "",
        categoryId: (row as { category_id?: string | null }).category_id ?? null,
        categoryType: ((row as { category_id?: string | null }).category_id && categoryMap[(row as { category_id: string }).category_id]?.type) || null,
        vatRate: ((row as { category_id?: string | null }).category_id && categoryMap[(row as { category_id: string }).category_id]?.vat_rate) ?? null,
        serviceName: s.service_name,
        dateFrom: s.service_date_from,
        dateTo: s.service_date_to,
        supplierPartyId: s.supplier_party_id,
        supplierName: s.supplier_name || "",
        airlineChannel: s.airline_channel || false,
        airlineChannelSupplierId: s.airline_channel_supplier_id || null,
        airlineChannelSupplierName: s.airline_channel_supplier_name || "",
        clientPartyId: s.client_party_id,
        clientName: s.client_name || "",
        payerPartyId: s.payer_party_id,
        payerName: s.payer_name || "",
        servicePrice: parseFloat(s.service_price || "0"),
        clientPrice: parseFloat(s.client_price || "0"),
        serviceCurrency: (row as { service_currency?: string | null }).service_currency ?? null,
        servicePriceForeign: (row as { service_price_foreign?: number | null }).service_price_foreign != null ? parseFloat(String((row as { service_price_foreign?: number }).service_price_foreign)) : null,
        exchangeRate: (row as { exchange_rate?: number | null }).exchange_rate != null ? parseFloat(String((row as { exchange_rate?: number }).exchange_rate)) : null,
        actuallyPaid: (row as { actually_paid?: number | null }).actually_paid != null ? parseFloat(String((row as { actually_paid?: number }).actually_paid)) : null,
        quantity: (s as { quantity?: number | null }).quantity ?? 1,
        resStatus: s.res_status || "booked",
        refNr: s.ref_nr || "",
        ticketNr: s.ticket_nr || "",
        travellerIds: travellerMap[s.id] || [],
        invoice_id: (s as { invoice_id?: string | null }).invoice_id ?? null,
        splitGroupId: (s as { split_group_id?: string | null }).split_group_id ?? null,
        flightSegments: Array.isArray(row.flight_segments) ? row.flight_segments : [],
        ticketNumbers: Array.isArray(row.ticket_numbers) ? row.ticket_numbers : [],
        boardingPasses: Array.isArray(row.boarding_passes) ? row.boarding_passes : [],
        baggage: row.baggage ?? "",
        cabinClass: row.cabin_class ?? "economy",
        // Tour / Hotel / terms (for Edit modal)
        hotelName: row.hotel_name ?? null,
        hotelHid: (row as { hotel_hid?: number | null }).hotel_hid ?? null,
        hotelStarRating: row.hotel_star_rating ?? null,
        hotelRoom: row.hotel_room ?? null,
        hotelBoard: row.hotel_board ?? null,
        mealPlanText: row.meal_plan_text ?? null,
        transferType: row.transfer_type ?? null,
        additionalServices: row.additional_services ?? null,
        hotelAddress: (row.hotel_address?.trim() || contactOverridesMap[(row as { hotel_hid?: number }).hotel_hid as number]?.address) ?? null,
        hotelPhone: (row.hotel_phone?.trim() || contactOverridesMap[(row as { hotel_hid?: number }).hotel_hid as number]?.phone) ?? null,
        hotelEmail: (row.hotel_email?.trim() || contactOverridesMap[(row as { hotel_hid?: number }).hotel_hid as number]?.email) ?? null,
        hotelBedType: row.hotel_bed_type ?? null,
        hotelEarlyCheckIn: row.hotel_early_check_in ?? null,
        hotelLateCheckIn: row.hotel_late_check_in ?? null,
        hotelEarlyCheckInTime: (row as { hotel_early_check_in_time?: string | null }).hotel_early_check_in_time ?? null,
        hotelLateCheckInTime: (row as { hotel_late_check_in_time?: string | null }).hotel_late_check_in_time ?? null,
        hotelRoomUpgrade: (row as { hotel_room_upgrade?: boolean | null }).hotel_room_upgrade ?? null,
        hotelLateCheckOut: (row as { hotel_late_check_out?: boolean | null }).hotel_late_check_out ?? null,
        hotelLateCheckOutTime: (row as { hotel_late_check_out_time?: string | null }).hotel_late_check_out_time ?? null,
        hotelHigherFloor: row.hotel_higher_floor ?? null,
        hotelKingSizeBed: row.hotel_king_size_bed ?? null,
        hotelHoneymooners: row.hotel_honeymooners ?? null,
        hotelSilentRoom: row.hotel_silent_room ?? null,
        hotelRepeatGuests: row.hotel_repeat_guests ?? null,
        hotelRoomsNextTo: row.hotel_rooms_next_to ?? null,
        hotelParking: row.hotel_parking ?? null,
        hotelPreferencesFreeText: row.hotel_preferences_free_text ?? null,
        hotelPricePer: (row as { hotel_price_per?: string | null }).hotel_price_per ?? null,
        supplierBookingType: row.supplier_booking_type ?? null,
        paymentDeadlineDeposit: row.payment_deadline_deposit ?? null,
        paymentDeadlineFinal: row.payment_deadline_final ?? null,
        paymentTerms: row.payment_terms ?? null,
        priceType: row.price_type ?? null,
        refundPolicy: row.refund_policy ?? null,
        freeCancellationUntil: row.free_cancellation_until ?? null,
        cancellationPenaltyAmount: row.cancellation_penalty_amount != null ? parseFloat(String(row.cancellation_penalty_amount)) : null,
        cancellationPenaltyPercent: row.cancellation_penalty_percent ?? null,
        commissionName: row.commission_name ?? null,
        commissionRate: row.commission_rate ?? null,
        commissionAmount: row.commission_amount ?? null,
        agentDiscountValue: row.agent_discount_value ?? null,
        agentDiscountType: row.agent_discount_type ?? null,
        servicePriceLineItems: Array.isArray((row as { service_price_line_items?: unknown }).service_price_line_items)
          ? (row as { service_price_line_items: Array<{ description?: string; amount?: number; commissionable?: boolean }> }).service_price_line_items
          : [],
        // Transfer
        pickupLocation: row.pickup_location ?? null,
        dropoffLocation: row.dropoff_location ?? null,
        pickupTime: row.pickup_time ?? null,
        estimatedDuration: row.estimated_duration ?? null,
        linkedFlightId: row.linked_flight_id ?? null,
        airportServiceFlow: row.airport_service_flow ?? null,
        transferRoutes: Array.isArray(row.transfer_routes) ? row.transfer_routes : [],
        transferMode: row.transfer_mode ?? null,
        vehicleClass: row.vehicle_class ?? null,
        driverName: row.driver_name ?? null,
        driverPhone: row.driver_phone ?? null,
        driverNotes: row.driver_notes ?? null,
        pricingPerClient: Array.isArray((s as { pricing_per_client?: unknown }).pricing_per_client) ? (s as { pricing_per_client: unknown[] }).pricing_per_client : null,
        // Amendment fields (change/cancellation)
        parentServiceId: (row as { parent_service_id?: string | null }).parent_service_id ?? null,
        serviceType: (row as { service_type?: string | null }).service_type ?? "original",
        ancillaryType: (row as { ancillary_type?: string | null }).ancillary_type ?? null,
        cancellationFee: (row as { cancellation_fee?: number | null }).cancellation_fee != null ? parseFloat(String((row as { cancellation_fee?: number }).cancellation_fee)) : null,
        refundAmount: (row as { refund_amount?: number | null }).refund_amount != null ? parseFloat(String((row as { refund_amount?: number }).refund_amount)) : null,
        changeFee: (row as { change_fee?: number | null }).change_fee != null ? parseFloat(String((row as { change_fee?: number }).change_fee)) : null,
      };
    });

    return NextResponse.json({ services: mappedServices });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Services GET error:", errorMsg);
    return NextResponse.json({ error: `Server error: ${errorMsg}` }, { status: 500 });
  }
}

// POST - Create a new service
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string }> }
) {
  try {
    const { orderCode } = await params;
    const body = await request.json();

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const apiUser = await getApiUser(request);
    if (!apiUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { companyId } = apiUser;

    const orderId = await getOrderId(orderCode, companyId);
    if (!orderId) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Validate required fields
    if (!body.serviceName) {
      return NextResponse.json({ error: "Service name is required" }, { status: 400 });
    }

    // Build insert payload: base + Tour/Hotel/terms (so Package Tour Add persists parsed fields for Edit)
    const serviceData: Record<string, unknown> = {
      company_id: companyId,
      order_id: orderId,
      category: body.category || null,
      category_id: body.categoryId || null,
      service_name: body.serviceName,
      service_date_from: body.dateFrom || null,
      service_date_to: body.dateTo || null,
      supplier_party_id: body.supplierPartyId || null,
      supplier_name: body.supplierName || null,
      client_party_id: body.clientPartyId || null,
      client_name: body.clientName || null,
      payer_party_id: body.payerPartyId || null,
      payer_name: body.payerName || null,
      service_price: (() => {
        const foreign = body.servicePriceForeign != null ? parseFloat(String(body.servicePriceForeign)) : null;
        const rate = body.exchangeRate != null ? parseFloat(String(body.exchangeRate)) : null;
        const curr = body.serviceCurrency || "EUR";
        if (foreign != null && rate != null && curr && curr.toUpperCase() !== "EUR") {
          return Math.round(foreign * rate * 100) / 100;
        }
        return body.servicePrice ?? 0;
      })(),
      client_price: body.clientPrice || 0,
      quantity: body.quantity ?? body.priceUnits ?? 1,
      res_status: body.resStatus || "booked",
      ref_nr: body.refNr || null,
      ticket_nr: body.ticketNr || null,
    };

    // Hotel / Package Tour fields (camelCase from frontend → snake_case for DB)
    if (body.hotelName !== undefined) serviceData.hotel_name = body.hotelName || null;
    if (body.hotelHid !== undefined && body.hotelHid != null) serviceData.hotel_hid = body.hotelHid;
    if (body.hotelStarRating !== undefined) serviceData.hotel_star_rating = body.hotelStarRating || null;
    if (body.hotelRoom !== undefined) serviceData.hotel_room = body.hotelRoom || null;
    if (body.hotelBoard !== undefined) serviceData.hotel_board = body.hotelBoard || null;
    if (body.mealPlanText !== undefined) serviceData.meal_plan_text = body.mealPlanText || null;
    if (body.transferType !== undefined) serviceData.transfer_type = body.transferType || null;
    if (body.additionalServices !== undefined) serviceData.additional_services = body.additionalServices || null;
    if (body.hotelAddress !== undefined) serviceData.hotel_address = body.hotelAddress || null;
    if (body.hotelPhone !== undefined) serviceData.hotel_phone = body.hotelPhone || null;
    if (body.hotelEmail !== undefined) serviceData.hotel_email = body.hotelEmail || null;
    if (body.hotelBedType !== undefined) serviceData.hotel_bed_type = body.hotelBedType || null;
    if (body.hotelEarlyCheckIn !== undefined) serviceData.hotel_early_check_in = !!body.hotelEarlyCheckIn;
    if (body.hotelLateCheckIn !== undefined) serviceData.hotel_late_check_in = !!body.hotelLateCheckIn;
    if (body.hotelEarlyCheckInTime !== undefined) serviceData.hotel_early_check_in_time = body.hotelEarlyCheckInTime || null;
    if (body.hotelLateCheckInTime !== undefined) serviceData.hotel_late_check_in_time = body.hotelLateCheckInTime || null;
    if (body.hotelRoomUpgrade !== undefined) serviceData.hotel_room_upgrade = !!body.hotelRoomUpgrade;
    if (body.hotelLateCheckOut !== undefined) serviceData.hotel_late_check_out = !!body.hotelLateCheckOut;
    if (body.hotelLateCheckOutTime !== undefined) serviceData.hotel_late_check_out_time = body.hotelLateCheckOutTime || null;
    if (body.hotelHigherFloor !== undefined) serviceData.hotel_higher_floor = !!body.hotelHigherFloor;
    if (body.hotelKingSizeBed !== undefined) serviceData.hotel_king_size_bed = !!body.hotelKingSizeBed;
    if (body.hotelHoneymooners !== undefined) serviceData.hotel_honeymooners = !!body.hotelHoneymooners;
    if (body.hotelSilentRoom !== undefined) serviceData.hotel_silent_room = !!body.hotelSilentRoom;
    if (body.hotelRepeatGuests !== undefined) serviceData.hotel_repeat_guests = !!body.hotelRepeatGuests;
    if (body.hotelRoomsNextTo !== undefined) serviceData.hotel_rooms_next_to = body.hotelRoomsNextTo || null;
    if (body.hotelParking !== undefined) serviceData.hotel_parking = !!body.hotelParking;
    if (body.hotelPreferencesFreeText !== undefined) serviceData.hotel_preferences_free_text = body.hotelPreferencesFreeText || null;
    if (body.hotelPricePer !== undefined) serviceData.hotel_price_per = body.hotelPricePer === "stay" ? "stay" : (body.hotelPricePer || "night");
    if (body.serviceCurrency !== undefined) serviceData.service_currency = body.serviceCurrency || "EUR";
    if (body.servicePriceForeign !== undefined) serviceData.service_price_foreign = body.servicePriceForeign != null ? parseFloat(String(body.servicePriceForeign)) : null;
    if (body.exchangeRate !== undefined) serviceData.exchange_rate = body.exchangeRate != null ? parseFloat(String(body.exchangeRate)) : null;
    if (body.actuallyPaid !== undefined) serviceData.actually_paid = body.actuallyPaid != null && body.actuallyPaid !== "" ? parseFloat(String(body.actuallyPaid)) : null;
    if (body.supplierBookingType !== undefined) serviceData.supplier_booking_type = body.supplierBookingType || null;
    if (body.airlineChannel !== undefined) serviceData.airline_channel = !!body.airlineChannel;
    if (body.airlineChannelSupplierId !== undefined) serviceData.airline_channel_supplier_id = body.airlineChannelSupplierId || null;
    if (body.airlineChannelSupplierName !== undefined) serviceData.airline_channel_supplier_name = body.airlineChannelSupplierName || null;
    // Payment / terms
    if (body.paymentDeadlineDeposit !== undefined) serviceData.payment_deadline_deposit = body.paymentDeadlineDeposit || null;
    if (body.paymentDeadlineFinal !== undefined) serviceData.payment_deadline_final = body.paymentDeadlineFinal || null;
    if (body.paymentTerms !== undefined) serviceData.payment_terms = body.paymentTerms || null;
    if (body.priceType !== undefined) serviceData.price_type = body.priceType || null;
    if (body.refundPolicy !== undefined) serviceData.refund_policy = body.refundPolicy || null;
    if (body.freeCancellationUntil !== undefined) serviceData.free_cancellation_until = body.freeCancellationUntil || null;
    if (body.cancellationPenaltyAmount !== undefined) serviceData.cancellation_penalty_amount = body.cancellationPenaltyAmount != null ? parseFloat(body.cancellationPenaltyAmount) : null;
    if (body.cancellationPenaltyPercent !== undefined) serviceData.cancellation_penalty_percent = body.cancellationPenaltyPercent != null ? parseInt(body.cancellationPenaltyPercent, 10) : null;
    if (body.changeFee !== undefined) serviceData.change_fee = body.changeFee != null ? parseFloat(body.changeFee) : null;
    // Tour commission / agent discount
    if (body.commissionName !== undefined) serviceData.commission_name = body.commissionName || null;
    if (body.commissionRate !== undefined) serviceData.commission_rate = body.commissionRate != null ? parseFloat(body.commissionRate) : null;
    if (body.commissionAmount !== undefined) serviceData.commission_amount = body.commissionAmount != null ? parseFloat(body.commissionAmount) : null;
    if (body.agentDiscountValue !== undefined) serviceData.agent_discount_value = body.agentDiscountValue != null && body.agentDiscountValue !== "" ? parseFloat(body.agentDiscountValue) : null;
    if (body.agentDiscountType !== undefined) serviceData.agent_discount_type = body.agentDiscountType || null;
    if (body.servicePriceLineItems !== undefined && Array.isArray(body.servicePriceLineItems)) {
      serviceData.service_price_line_items = body.servicePriceLineItems;
      // service_price is sent by client as base + line items total; do not overwrite
    }
    // Transfer (legacy flat fields)
    if (body.pickupLocation !== undefined) serviceData.pickup_location = body.pickupLocation || null;
    if (body.dropoffLocation !== undefined) serviceData.dropoff_location = body.dropoffLocation || null;
    if (body.pickupTime !== undefined) serviceData.pickup_time = body.pickupTime || null;
    if (body.estimatedDuration !== undefined) serviceData.estimated_duration = body.estimatedDuration || null;
    if (body.linkedFlightId !== undefined) serviceData.linked_flight_id = body.linkedFlightId || null;
    if (body.airportServiceFlow !== undefined) serviceData.airport_service_flow = body.airportServiceFlow || null;
    // Transfer (new structured fields)
    if (body.transferRoutes !== undefined) serviceData.transfer_routes = Array.isArray(body.transferRoutes) ? body.transferRoutes : null;
    if (body.transferMode !== undefined) serviceData.transfer_mode = body.transferMode || null;
    if (body.vehicleClass !== undefined) serviceData.vehicle_class = body.vehicleClass || null;
    if (body.driverName !== undefined) serviceData.driver_name = body.driverName || null;
    if (body.driverPhone !== undefined) serviceData.driver_phone = body.driverPhone || null;
    if (body.driverNotes !== undefined) serviceData.driver_notes = body.driverNotes || null;
    // Flight
    if (body.cabinClass !== undefined) serviceData.cabin_class = body.cabinClass || "economy";
    if (body.baggage !== undefined) serviceData.baggage = body.baggage || null;
    if (body.flightSegments !== undefined && Array.isArray(body.flightSegments)) serviceData.flight_segments = body.flightSegments;
    if (body.ticketNumbers !== undefined && Array.isArray(body.ticketNumbers)) serviceData.ticket_numbers = body.ticketNumbers;
    if (body.pricingPerClient !== undefined && Array.isArray(body.pricingPerClient)) serviceData.pricing_per_client = body.pricingPerClient;
    // Amendment fields (change/cancellation)
    if (body.parentServiceId) serviceData.parent_service_id = body.parentServiceId;
    if (body.serviceType && body.serviceType !== "original") serviceData.service_type = body.serviceType;
    if (body.ancillaryType) serviceData.ancillary_type = body.ancillaryType;
    if (body.cancellationFee != null) serviceData.cancellation_fee = parseFloat(String(body.cancellationFee)) || null;
    if (body.refundAmount != null) serviceData.refund_amount = parseFloat(String(body.refundAmount)) || null;

    const { data: service, error } = await supabaseAdmin
      .from("order_services")
      .insert(serviceData)
      .select()
      .single();

    if (error) {
      console.error("Create service error:", error);
      // Try without new columns if they don't exist yet
      if (error.code === "42703") {
        // Column doesn't exist - use minimal payload
        const minimalData = {
          company_id: companyId,
          order_id: orderId,
          service_name: body.serviceName,
          service_date_from: body.dateFrom || null,
          service_date_to: body.dateTo || null,
        };
        
        const { data: minService, error: minError } = await supabaseAdmin
          .from("order_services")
          .insert(minimalData)
          .select()
          .single();
          
        if (minError) {
          return NextResponse.json({ error: "Failed to create service" }, { status: 500 });
        }
        
        return NextResponse.json({ 
          service: { id: minService.id, ...body },
          warning: "Some columns not available - run migration"
        });
      }
      return NextResponse.json({ error: "Failed to create service" }, { status: 500 });
    }

    // Add traveller associations: use travellerIds from payload, or fallback to primary client so CLIENT always appears in TRAVELLERS
    const effectiveTravellerIds: string[] =
      body.travellerIds && body.travellerIds.length > 0
        ? body.travellerIds
        : body.clientPartyId
          ? [body.clientPartyId]
          : [];

    if (effectiveTravellerIds.length > 0) {
      const travellerInserts = effectiveTravellerIds.map((tid: string) => ({
        company_id: companyId,
        service_id: service.id,
        traveller_id: tid,
      }));

      await supabaseAdmin
        .from("order_service_travellers")
        .insert(travellerInserts);

      // Ensure travellers appear in order_travellers so they show in TRAVELLERS column
      const { data: existingOrderTravellers } = await supabaseAdmin
        .from("order_travellers")
        .select("party_id")
        .eq("order_id", orderId)
        .eq("company_id", companyId)
        .in("party_id", effectiveTravellerIds);
      const existingPartyIds = new Set((existingOrderTravellers || []).map((r: { party_id: string }) => r.party_id));
      const toAdd = effectiveTravellerIds.filter((tid: string) => !existingPartyIds.has(tid));
      if (toAdd.length > 0) {
        await supabaseAdmin
          .from("order_travellers")
          .insert(toAdd.map((party_id: string) => ({
            company_id: companyId,
            order_id: orderId,
            party_id,
            is_main_client: false,
          })));
      }
    }

    upsertOrderServiceEmbedding(service.id).catch((e) => console.warn("[POST services] upsertOrderServiceEmbedding:", e));

    syncOrderDatesFromServices(orderId).catch(() => {});

    const { data: orderForPush } = await supabaseAdmin
      .from("orders")
      .select("client_party_id")
      .eq("id", orderId)
      .single();

    if (orderForPush?.client_party_id) {
      sendPushToClient(orderForPush.client_party_id, {
        title: "New service added",
        body: `${body.category || "Service"}: ${body.serviceName}`,
        type: "service_update",
        refId: orderId,
      }).catch((e: unknown) => console.error("[Push] fire-and-forget:", e));
    }

    const inserted = service as Record<string, unknown>;
    // Look up category type and vat_rate from travel_service_categories
    let resolvedCategoryType: string | null = null;
    let resolvedVatRate: number | null = null;
    if (inserted.category_id) {
      const { data: cat } = await supabaseAdmin
        .from("travel_service_categories")
        .select("type, vat_rate")
        .eq("id", inserted.category_id)
        .single();
      if (cat) {
        resolvedCategoryType = cat.type ?? null;
        resolvedVatRate = cat.vat_rate ?? null;
      }
    }
    return NextResponse.json({
      service: {
        id: service.id,
        category: service.category,
        categoryId: inserted.category_id ?? null,
        categoryType: resolvedCategoryType,
        vatRate: resolvedVatRate,
        serviceType: inserted.service_type ?? "original",
        serviceName: service.service_name,
        dateFrom: service.service_date_from,
        dateTo: service.service_date_to,
        supplierPartyId: service.supplier_party_id,
        supplierName: service.supplier_name,
        clientPartyId: service.client_party_id,
        clientName: service.client_name,
        payerPartyId: service.payer_party_id,
        payerName: service.payer_name,
        servicePrice: parseFloat(service.service_price || "0"),
        clientPrice: parseFloat(service.client_price || "0"),
        quantity: (service as { quantity?: number | null }).quantity ?? 1,
        resStatus: service.res_status,
        refNr: service.ref_nr,
        ticketNr: service.ticket_nr,
        ticketNumbers: Array.isArray(inserted.ticket_numbers) ? inserted.ticket_numbers : [],
        travellerIds: effectiveTravellerIds,
        flightSegments: Array.isArray(inserted.flight_segments) ? inserted.flight_segments : [],
        cabinClass: inserted.cabin_class ?? null,
        baggage: inserted.baggage ?? null,
        airlineChannel: !!inserted.airline_channel,
        airlineChannelSupplierId: inserted.airline_channel_supplier_id ?? null,
        airlineChannelSupplierName: inserted.airline_channel_supplier_name ?? null,
        pricingPerClient: Array.isArray(inserted.pricing_per_client) ? inserted.pricing_per_client : null,
        parentServiceId: inserted.parent_service_id ?? null,
        ancillaryType: inserted.ancillary_type ?? null,
        hotelName: inserted.hotel_name ?? null,
        hotelHid: inserted.hotel_hid ?? null,
        hotelRoom: inserted.hotel_room ?? null,
        hotelBoard: inserted.hotel_board ?? null,
        hotelAddress: inserted.hotel_address ?? null,
        hotelPhone: inserted.hotel_phone ?? null,
        hotelEmail: inserted.hotel_email ?? null,
        transferRoutes: Array.isArray(inserted.transfer_routes) ? inserted.transfer_routes : [],
        transferMode: inserted.transfer_mode ?? null,
        vehicleClass: inserted.vehicle_class ?? null,
      }
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Services POST error:", errorMsg);
    return NextResponse.json({ error: `Server error: ${errorMsg}` }, { status: 500 });
  }
}
