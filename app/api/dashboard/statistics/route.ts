import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

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

async function getUser(request: NextRequest) {
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

  return user;
}

export async function GET(request: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const companyId = await getCompanyId(user.id);
    if (!companyId) {
      return NextResponse.json(
        { error: "User has no company assigned" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const periodStart = searchParams.get("periodStart");
    const periodEnd = searchParams.get("periodEnd");

    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        { error: "periodStart and periodEnd are required" },
        { status: 400 }
      );
    }

    // 1. Orders count (for the period)
    const { count: ordersCount, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .gte("created_at", periodStart)
      .lt("created_at", periodEnd);

    if (ordersError) {
      console.error("Orders count error:", ordersError);
    }

    // 2. Active Bookings (orders that have not started yet)
    const { count: activeBookings, error: activeBookingsError } = await supabaseAdmin
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "Active")
      .gt("date_from", new Date().toISOString().split("T")[0]);

    if (activeBookingsError) {
      console.error("Active bookings error:", activeBookingsError);
    }

    // 3. Revenue (for the period) — sum of client_price from order_services
    const { data: revenueData, error: revenueError } = await supabaseAdmin
      .from("order_services")
      .select("client_price, orders!inner(company_id, created_at)")
      .eq("orders.company_id", companyId)
      .gte("orders.created_at", periodStart)
      .lt("orders.created_at", periodEnd);

    let revenue = 0;
    if (!revenueError && revenueData) {
      revenue = revenueData.reduce((sum, item) => {
        const price = parseFloat(item.client_price?.toString() || "0");
        return sum + price;
      }, 0);
    }

    // 4. Profit (for the period) — sum of (client_price - service_price)
    const { data: profitData, error: profitError } = await supabaseAdmin
      .from("order_services")
      .select("client_price, service_price, orders!inner(company_id, created_at)")
      .eq("orders.company_id", companyId)
      .gte("orders.created_at", periodStart)
      .lt("orders.created_at", periodEnd);

    let profit = 0;
    if (!profitError && profitData) {
      profit = profitData.reduce((sum, item) => {
        const clientPrice = parseFloat(item.client_price?.toString() || "0");
        const servicePrice = parseFloat(item.service_price?.toString() || "0");
        return sum + (clientPrice - servicePrice);
      }, 0);
    }

    // 5. Overdue Payments (past due)
    // Check that columns amount, paid, due_date exist
    const { data: overdueData, error: overdueError } = await supabaseAdmin
      .from("orders")
      .select("amount, paid, due_date")
      .eq("company_id", companyId)
      .eq("status", "Active")
      .lt("due_date", new Date().toISOString().split("T")[0]);

    let overdueAmount = 0;
    if (!overdueError && overdueData) {
      overdueAmount = overdueData.reduce((sum, order) => {
        const amount = parseFloat(order.amount?.toString() || "0");
        const paid = parseFloat(order.paid?.toString() || "0");
        const debt = amount - paid;
        return sum + (debt > 0 ? debt : 0);
      }, 0);
    }

    return NextResponse.json({
      ordersCount: ordersCount || 0,
      activeBookings: activeBookings || 0,
      revenue: Math.round(revenue * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      overdueAmount: Math.round(overdueAmount * 100) / 100,
    });
  } catch (error) {
    console.error("Dashboard statistics error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

