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

    // Map to API format
    const mappedServices = (services || []).map(s => ({
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
    }));

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

    // Build insert payload using confirmed mapping
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
        travellerIds: body.travellerIds || [],
      }
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Services POST error:", errorMsg);
    return NextResponse.json({ error: `Server error: ${errorMsg}` }, { status: 500 });
  }
}
