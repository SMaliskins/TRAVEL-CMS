import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function getCompanyId(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("company_id")
    .eq("user_id", userId)
    .single();
  return data?.company_id || null;
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

async function getCurrentUser(request: NextRequest) {
  let user = null;
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await authClient.auth.getUser(token);
    if (!error && data?.user) {
      user = data.user;
    }
  }

  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (cookieHeader) {
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
        global: { headers: { Cookie: cookieHeader } },
      });
      const { data, error } = await authClient.auth.getUser();
      if (!error && data?.user) {
        user = data.user;
      }
    }
  }

  return user;
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

    // Debug: log cabin_class from DB
    console.log("[Services GET] cabin_class values from DB:", 
      (services || []).map(s => ({ id: s.id.slice(-8), cabin_class: s.cabin_class, category: s.category }))
    );

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

    // Fetch category types and names for Tour/commission display and correct category label
    const { data: categories } = await supabaseAdmin
      .from("travel_service_categories")
      .select("id, type, name")
      .eq("company_id", companyId);
    const categoryTypeMap: Record<string, string> = {};
    const categoryNameMap: Record<string, string> = {};
    (categories || []).forEach((c: { id: string; type?: string; name?: string }) => {
      if (c.id && c.type) categoryTypeMap[c.id] = (c.type as string).toLowerCase();
      if (c.id && c.name) categoryNameMap[c.id] = c.name;
    });

    // Map to API format
    function getCategoryType(s: { category_id?: string | null; category?: string | null }): string {
      if (s.category_id && categoryTypeMap[s.category_id]) return categoryTypeMap[s.category_id];
      if (!s.category) return "other";
      const c = String(s.category).toLowerCase();
      if (c.includes("tour") || c.includes("package") || c.includes("тур")) return "tour";
      if (c.includes("flight") || c.includes("рейс") || c.includes("air")) return "flight";
      if (c.includes("hotel") || c.includes("отель")) return "hotel";
      if (c.includes("transfer")) return "transfer";
      return "other";
    }
    function getCategoryName(s: { category_id?: string | null; category?: string | null }): string {
      if (s.category_id && categoryNameMap[s.category_id]) return categoryNameMap[s.category_id];
      return s.category || "";
    }
    const mappedServices = (services || []).map(s => {
      const catType = getCategoryType(s);
      const catName = getCategoryName(s);
      return {
        id: s.id,
        category: catName,
        categoryId: s.category_id || null,
        categoryType: catType,
        serviceName: s.service_name,
        dateFrom: s.service_date_from,
        dateTo: s.service_date_to,
        supplierPartyId: s.supplier_party_id,
        supplierName: s.supplier_name || "",
        clientPartyId: s.client_party_id,
        clientName: s.client_name || "",
        payerPartyId: s.payer_party_id,
        payerName: s.payer_name || "",
        servicePrice: parseFloat(s.service_price || "0"),
        clientPrice: parseFloat(s.client_price || "0"),
        vatRate: s.vat_rate || 0,
        resStatus: s.res_status || "booked",
        refNr: s.ref_nr || "",
        ticketNr: s.ticket_nr || "",
        travellerIds: travellerMap[s.id] || [],
        invoice_id: s.invoice_id || null,
        splitGroupId: s.split_group_id || null,
        flightSegments: s.flight_segments || [],
        cabinClass: s.cabin_class || "economy",
        priceType: s.price_type || null,
        refundPolicy: s.refund_policy || null,
        freeCancellationUntil: s.free_cancellation_until || null,
        cancellationPenaltyAmount: s.cancellation_penalty_amount || null,
        cancellationPenaltyPercent: s.cancellation_penalty_percent || null,
        changeFee: s.change_fee || null,
        ticketNumbers: s.ticket_numbers || [],
        boardingPasses: s.boarding_passes || [],
        baggage: s.baggage || "",
        hotelName: s.hotel_name || null,
        hotelStarRating: s.hotel_star_rating || null,
        hotelAddress: s.hotel_address || null,
        paymentDeadlineDeposit: s.payment_deadline_deposit || null,
        paymentDeadlineFinal: s.payment_deadline_final || null,
        paymentTerms: s.payment_terms || null,
        hotelPhone: s.hotel_phone || null,
        hotelEmail: s.hotel_email || null,
        hotelRoom: s.hotel_room || null,
        hotelBoard: s.hotel_board || null,
        mealPlanText: s.meal_plan_text || null,
        transferType: s.transfer_type || null,
        additionalServices: s.additional_services || null,
        hotelBedType: s.hotel_bed_type || null,
        hotelEarlyCheckIn: s.hotel_early_check_in || false,
        hotelLateCheckIn: s.hotel_late_check_in || false,
        hotelHigherFloor: s.hotel_higher_floor || false,
        hotelKingSizeBed: s.hotel_king_size_bed || false,
        hotelHoneymooners: s.hotel_honeymooners || false,
        hotelSilentRoom: s.hotel_silent_room || false,
        hotelRoomsNextTo: s.hotel_rooms_next_to || null,
        hotelParking: s.hotel_parking || false,
        hotelPreferencesFreeText: s.hotel_preferences_free_text || null,
        supplierBookingType: s.supplier_booking_type || null,
        pickupLocation: s.pickup_location || null,
        dropoffLocation: s.dropoff_location || null,
        pickupTime: s.pickup_time || null,
        estimatedDuration: s.estimated_duration || null,
        linkedFlightId: s.linked_flight_id || null,
        parentServiceId: s.parent_service_id || null,
        serviceType: s.service_type || "original",
        cancellationFee: s.cancellation_fee || null,
        refundAmount: s.refund_amount || null,
        commissionName: s.commission_name ?? null,
        commissionRate: s.commission_rate != null ? Number(s.commission_rate) : null,
        commissionAmount: s.commission_amount != null ? Number(s.commission_amount) : null,
        agentDiscountValue: s.agent_discount_value != null ? Number(s.agent_discount_value) : null,
        agentDiscountType: (s.agent_discount_type === "%" || s.agent_discount_type === "€") ? s.agent_discount_type : null,
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

    // Validate required fields
    if (!body.serviceName) {
      return NextResponse.json({ error: "Service name is required" }, { status: 400 });
    }

    // Debug logging for party IDs
    console.log("[Services POST] Request body party IDs:", {
      supplierPartyId: body.supplierPartyId,
      clientPartyId: body.clientPartyId,
      payerPartyId: body.payerPartyId,
      payerName: body.payerName,
    });

    // Build insert payload using confirmed mapping
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
      service_price: body.servicePrice || 0,
      client_price: body.clientPrice || 0,
      vat_rate: body.vatRate || 0,
      res_status: body.resStatus || "booked",
      ref_nr: body.refNr || null,
      ticket_nr: body.ticketNr || null,
      // Payment deadline fields
      payment_deadline_deposit: body.paymentDeadlineDeposit || null,
      payment_deadline_final: body.paymentDeadlineFinal || null,
      payment_terms: body.paymentTerms || null,
      // Hotel-specific fields
      hotel_name: body.hotelName || null,
      hotel_address: body.hotelAddress || null,
      hotel_phone: body.hotelPhone || null,
      hotel_email: body.hotelEmail || null,
      hotel_room: body.hotelRoom || null,
      hotel_board: body.hotelBoard || null,
      meal_plan_text: body.mealPlanText || null,
      hotel_bed_type: body.hotelBedType || null,
      hotel_early_check_in: body.hotelEarlyCheckIn || false,
      hotel_late_check_in: body.hotelLateCheckIn || false,
      hotel_higher_floor: body.hotelHigherFloor || false,
      hotel_king_size_bed: body.hotelKingSizeBed || false,
      hotel_honeymooners: body.hotelHoneymooners || false,
      hotel_silent_room: body.hotelSilentRoom || false,
      hotel_rooms_next_to: body.hotelRoomsNextTo || null,
      hotel_parking: body.hotelParking || false,
      hotel_preferences_free_text: body.hotelPreferencesFreeText || null,
      supplier_booking_type: body.supplierBookingType || null,
      transfer_type: body.transferType || null,
      additional_services: body.additionalServices || null,
      // Transfer-specific fields
      pickup_location: body.pickupLocation || null,
      dropoff_location: body.dropoffLocation || null,
      pickup_time: body.pickupTime || null,
      estimated_duration: body.estimatedDuration || null,
      linked_flight_id: body.linkedFlightId || null,
      // Terms & conditions fields
      price_type: body.priceType || "regular",
      refund_policy: body.refundPolicy || "non_ref",
      free_cancellation_until: body.freeCancellationUntil || null,
      cancellation_penalty_amount: body.cancellationPenaltyAmount || null,
      cancellation_penalty_percent: body.cancellationPenaltyPercent || null,
      // Ticket numbers array (for Flights)
      ticket_numbers: body.ticketNumbers || [],
      // Change fee (for Flights)
      change_fee: body.changeFee || null,
      // Flight segments (for Flights)
      flight_segments: body.flightSegments || [],
      // Cabin class (for Flights)
      cabin_class: body.cabinClass || "economy",
      // Baggage info
      baggage: body.baggage || "",
      // Amendment fields (change/cancellation)
      parent_service_id: body.parentServiceId || null,
      service_type: body.serviceType || "original",
      cancellation_fee: body.cancellationFee || null,
      refund_amount: body.refundAmount || null,
      // Tour: commission + agent discount
      commission_name: body.commissionName ?? null,
      commission_rate: body.commissionRate ?? null,
      commission_amount: body.commissionAmount ?? null,
      agent_discount_value: body.agentDiscountValue ?? null,
      agent_discount_type: body.agentDiscountType ?? null,
    };

    const { data: service, error } = await supabaseAdmin
      .from("order_services")
      .insert(serviceData)
      .select()
      .single();

    console.log("[Services POST] Insert result:", {
      success: !error,
      serviceId: service?.id,
      payerPartyIdSaved: service?.payer_party_id,
      error: error?.message,
    });

    if (error) {
      console.error("Create service error:", error);
      return NextResponse.json({ error: "Failed to create service: " + error.message }, { status: 500 });
    }

    // Add traveller associations if provided
    if (body.travellerIds && body.travellerIds.length > 0) {
      const travellerInserts = body.travellerIds.map((tid: string) => ({
        company_id: companyId,
        service_id: service.id,
        traveller_id: tid,
      }));

      await supabaseAdmin
        .from("order_service_travellers")
        .insert(travellerInserts);
    }

    // Handle multiple clients: add to order_travellers and order_service_travellers
    // Collect all client party IDs from clients array or single clientPartyId
    let clientPartyIds: string[] = [];
    
    if (body.clients && Array.isArray(body.clients) && body.clients.length > 0) {
      clientPartyIds = body.clients
        .filter((c: { partyId?: string }) => c.partyId)
        .map((c: { partyId: string }) => c.partyId);
    } else if (body.clientPartyId) {
      // Fallback: use single clientPartyId if no clients array
      clientPartyIds = [body.clientPartyId];
    }

    if (clientPartyIds.length > 0) {
      // Add each client to order_travellers (if not exists)
      for (const partyId of clientPartyIds) {
        await supabaseAdmin
          .from("order_travellers")
          .upsert({
            company_id: companyId,
            order_id: orderId,
            party_id: partyId,
            is_main_client: partyId === body.clientPartyId,
          }, { onConflict: "order_id,party_id" });
      }

      // Add clients to order_service_travellers for this service
      const serviceTravellerInserts = clientPartyIds.map((partyId: string) => ({
        company_id: companyId,
        service_id: service.id,
        traveller_id: partyId,
      }));

      await supabaseAdmin
        .from("order_service_travellers")
        .upsert(serviceTravellerInserts, { onConflict: "service_id,traveller_id" });
      
      console.log("[Services POST] Added clients to service_travellers:", clientPartyIds);
    }

    return NextResponse.json({
      service: {
        id: service.id,
        category: service.category,
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
        vatRate: service.vat_rate || 0,
        resStatus: service.res_status,
        refNr: service.ref_nr,
        ticketNr: service.ticket_nr,
        travellerIds: body.travellerIds || [],
      }
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Services POST error:", errorMsg);
    return NextResponse.json({ error: `Server error: ${errorMsg}` }, { status: 500 });
  }
}
