import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Placeholder URLs for build-time (replaced at runtime)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";

// Create Supabase admin client with service role key (bypasses RLS)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

interface CreateOrderRequest {
  clientPartyId: string;
  clientDisplayName?: string;
  orderType: "TA" | "TO" | "CORP" | "NON";
  ownerAgent: string;
  ownerName?: string;
  cities: string[];
  countries: string[];
  checkIn: string | null;
  return: string | null;
  status?: string;
}

// Get company_id from user's profile
async function getCompanyId(userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("company_id")
    .eq("user_id", userId)
    .single();

  if (error || !data?.company_id) {
    return null;
  }
  return data.company_id;
}

// Generate order_no for company+year, returns { order_no, order_code }
async function generateOrderNumber(
  companyId: string,
  ownerInitials: string
): Promise<{ orderNo: number; orderYear: number; orderCode: string }> {
  const currentYear = new Date().getFullYear();
  const yearSuffix = currentYear.toString().slice(-2);

  // Get max order_no for this company and year
  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("order_no")
    .eq("company_id", companyId)
    .eq("order_year", currentYear)
    .order("order_no", { ascending: false })
    .limit(1);

  const maxOrderNo = orders?.[0]?.order_no || 0;
  const nextOrderNo = maxOrderNo + 1;

  const seqStr = nextOrderNo.toString().padStart(4, "0");
  const agentSuffix = (ownerInitials || "XX").trim().toUpperCase().slice(0, 10);
  const orderCode = `${seqStr}/${yearSuffix}-${agentSuffix}`;

  return {
    orderNo: nextOrderNo,
    orderYear: currentYear,
    orderCode,
  };
}

// Get client display name from party
async function getClientDisplayName(partyId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("parties")
    .select("display_name, name, first_name, last_name")
    .eq("id", partyId)
    .single();

  if (!data) return null;
  
  return data.display_name || 
         data.name || 
         [data.first_name, data.last_name].filter(Boolean).join(" ") || 
         null;
}

export async function POST(request: NextRequest) {
  try {
    // Check if service role key is set
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Server configuration error", details: "SUPABASE_SERVICE_ROLE_KEY is not set" },
        { status: 500 }
      );
    }

    // Get authenticated user
    let user = null;
    
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
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

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: CreateOrderRequest = await request.json();

    // Validate required fields
    if (!body.clientPartyId) {
      return NextResponse.json({ error: "clientPartyId is required" }, { status: 400 });
    }
    if (!body.orderType) {
      return NextResponse.json({ error: "orderType is required" }, { status: 400 });
    }

    // Get company_id from user's profile
    const companyId = await getCompanyId(user.id);
    if (!companyId) {
      return NextResponse.json(
        { error: "User has no company assigned. Please contact administrator." },
        { status: 400 }
      );
    }

    // Generate order number
    const { orderNo, orderYear, orderCode } = await generateOrderNumber(
      companyId,
      body.ownerAgent || "XX"
    );

    // Get client display name
    const clientDisplayName = body.clientDisplayName || 
                              await getClientDisplayName(body.clientPartyId) ||
                              "Unknown Client";

    // Build countries_cities string
    const countriesCities = [...new Set([...body.countries, ...body.cities])].join(", ");

    // Build insert payload with correct field names
    // Start with required fields only
    const payload: Record<string, unknown> = {
      company_id: companyId,
      owner_user_id: user.id,
      order_no: orderNo,
      order_year: orderYear,
      order_code: orderCode,
      order_type: body.orderType,
      status: body.status || "Active",
    };

    // Add optional fields if they have values
    // These columns may not exist in all deployments
    if (clientDisplayName) {
      payload.client_display_name = clientDisplayName;
    }
    if (countriesCities) {
      payload.countries_cities = countriesCities;
    }
    if (body.checkIn) {
      payload.date_from = body.checkIn;
    }
    if (body.return) {
      payload.date_to = body.return;
    }

    // Insert order with retry logic for missing columns
    let insertedOrder = null;
    let currentPayload = { ...payload };

    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error: insertError } = await supabaseAdmin
        .from("orders")
        .insert(currentPayload)
        .select("id, order_code")
        .single();

      if (!insertError) {
        insertedOrder = data;
        break;
      }

      // Check if error is about missing column
      const isColumnError = insertError.message?.includes("column") || 
                           insertError.code === "42703";
      
      if (isColumnError) {
        // Extract column name and remove it from payload
        const match = insertError.message?.match(/column[^"]*"([^"]+)"/i) ||
                     insertError.message?.match(/Could not find[^']*'([^']+)'/i);
        const columnName = match?.[1];
        
        if (columnName && columnName in currentPayload) {
          console.log(`Removing missing column: ${columnName}`);
          delete currentPayload[columnName];
          continue;
        }
      }

      // Non-recoverable error
      console.error("Order insert error:", insertError);
      return NextResponse.json(
        { error: `Failed to create order: ${insertError.message}` },
        { status: 500 }
      );
    }

    if (!insertedOrder) {
      return NextResponse.json(
        { error: "Failed to create order after retries" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      order_id: insertedOrder.id,
      order_number: insertedOrder.order_code, // Return as order_number for frontend compatibility
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Order create error:", errorMsg);
    return NextResponse.json({ error: `Server error: ${errorMsg}` }, { status: 500 });
  }
}
