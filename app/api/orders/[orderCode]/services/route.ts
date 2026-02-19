import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { upsertOrderServiceEmbedding } from "@/lib/embeddings/upsert";

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
      };
      return {
        id: s.id,
        category: s.category || "",
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
        hotelStarRating: row.hotel_star_rating ?? null,
        hotelRoom: row.hotel_room ?? null,
        hotelBoard: row.hotel_board ?? null,
        mealPlanText: row.meal_plan_text ?? null,
        transferType: row.transfer_type ?? null,
        additionalServices: row.additional_services ?? null,
        hotelAddress: row.hotel_address ?? null,
        hotelPhone: row.hotel_phone ?? null,
        hotelEmail: row.hotel_email ?? null,
        hotelBedType: row.hotel_bed_type ?? null,
        hotelEarlyCheckIn: row.hotel_early_check_in ?? null,
        hotelLateCheckIn: row.hotel_late_check_in ?? null,
        hotelHigherFloor: row.hotel_higher_floor ?? null,
        hotelKingSizeBed: row.hotel_king_size_bed ?? null,
        hotelHoneymooners: row.hotel_honeymooners ?? null,
        hotelSilentRoom: row.hotel_silent_room ?? null,
        hotelRepeatGuests: row.hotel_repeat_guests ?? null,
        hotelRoomsNextTo: row.hotel_rooms_next_to ?? null,
        hotelParking: row.hotel_parking ?? null,
        hotelPreferencesFreeText: row.hotel_preferences_free_text ?? null,
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

    // Build insert payload: base + Tour/Hotel/terms (so Package Tour Add persists parsed fields for Edit)
    const serviceData: Record<string, unknown> = {
      company_id: companyId,
      order_id: orderId,
      category: body.category || null,
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
      res_status: body.resStatus || "booked",
      ref_nr: body.refNr || null,
      ticket_nr: body.ticketNr || null,
    };

    // Hotel / Package Tour fields (camelCase from frontend → snake_case for DB)
    if (body.hotelName !== undefined) serviceData.hotel_name = body.hotelName || null;
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
    if (body.hotelHigherFloor !== undefined) serviceData.hotel_higher_floor = !!body.hotelHigherFloor;
    if (body.hotelKingSizeBed !== undefined) serviceData.hotel_king_size_bed = !!body.hotelKingSizeBed;
    if (body.hotelHoneymooners !== undefined) serviceData.hotel_honeymooners = !!body.hotelHoneymooners;
    if (body.hotelSilentRoom !== undefined) serviceData.hotel_silent_room = !!body.hotelSilentRoom;
    if (body.hotelRepeatGuests !== undefined) serviceData.hotel_repeat_guests = !!body.hotelRepeatGuests;
    if (body.hotelRoomsNextTo !== undefined) serviceData.hotel_rooms_next_to = body.hotelRoomsNextTo || null;
    if (body.hotelParking !== undefined) serviceData.hotel_parking = !!body.hotelParking;
    if (body.hotelPreferencesFreeText !== undefined) serviceData.hotel_preferences_free_text = body.hotelPreferencesFreeText || null;
    if (body.supplierBookingType !== undefined) serviceData.supplier_booking_type = body.supplierBookingType || null;
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
    // Transfer
    if (body.pickupLocation !== undefined) serviceData.pickup_location = body.pickupLocation || null;
    if (body.dropoffLocation !== undefined) serviceData.dropoff_location = body.dropoffLocation || null;
    if (body.pickupTime !== undefined) serviceData.pickup_time = body.pickupTime || null;
    if (body.estimatedDuration !== undefined) serviceData.estimated_duration = body.estimatedDuration || null;
    if (body.linkedFlightId !== undefined) serviceData.linked_flight_id = body.linkedFlightId || null;
    // Flight
    if (body.cabinClass !== undefined) serviceData.cabin_class = body.cabinClass || "economy";
    if (body.baggage !== undefined) serviceData.baggage = body.baggage || null;
    if (body.flightSegments !== undefined && Array.isArray(body.flightSegments)) serviceData.flight_segments = body.flightSegments;
    if (body.ticketNumbers !== undefined && Array.isArray(body.ticketNumbers)) serviceData.ticket_numbers = body.ticketNumbers;

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

    const inserted = service as { ticket_numbers?: unknown };
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
        resStatus: service.res_status,
        refNr: service.ref_nr,
        ticketNr: service.ticket_nr,
        ticketNumbers: Array.isArray(inserted.ticket_numbers) ? inserted.ticket_numbers : [],
        travellerIds: effectiveTravellerIds,
      }
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Services POST error:", errorMsg);
    return NextResponse.json({ error: `Server error: ${errorMsg}` }, { status: 500 });
  }
}
