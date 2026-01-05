import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Placeholder URLs for build-time
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

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

export async function GET(request: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Server configuration error" },
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

    // Get company_id
    const companyId = await getCompanyId(user.id);
    if (!companyId) {
      return NextResponse.json(
        { error: "User has no company assigned" },
        { status: 400 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const orderType = searchParams.get("order_type");

    // Build query
    let query = supabaseAdmin
      .from("orders")
      .select(`
        id,
        order_code,
        order_no,
        order_year,
        order_type,
        status,
        client_display_name,
        countries_cities,
        date_from,
        date_to,
        amount_total,
        amount_paid,
        amount_debt,
        profit_estimated,
        updated_at,
        created_at
      `)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq("status", status);
    }
    if (orderType) {
      query = query.eq("order_type", orderType);
    }

    const { data: orders, error } = await query;

    if (error) {
      console.error("Orders fetch error:", error);
      return NextResponse.json(
        { error: `Failed to fetch orders: ${error.message}` },
        { status: 500 }
      );
    }

    // Transform to frontend format
    const transformedOrders = (orders || []).map((order) => ({
      orderId: order.order_code,
      client: order.client_display_name || "Unknown",
      countriesCities: order.countries_cities || "",
      datesFrom: order.date_from || "",
      datesTo: order.date_to || "",
      amount: Number(order.amount_total) || 0,
      paid: Number(order.amount_paid) || 0,
      debt: Number(order.amount_debt) || 0,
      profit: Number(order.profit_estimated) || 0,
      status: order.status,
      type: order.order_type,
      owner: "", // TODO: get from owner_user_id -> profiles.initials
      access: "Owner",
      updated: order.updated_at?.split("T")[0] || "",
      createdAt: order.created_at?.split("T")[0] || "",
    }));

    return NextResponse.json({ orders: transformedOrders });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Orders GET error:", errorMsg);
    return NextResponse.json({ error: `Server error: ${errorMsg}` }, { status: 500 });
  }
}
