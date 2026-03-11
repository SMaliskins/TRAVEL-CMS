import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

async function getUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await authClient.auth.getUser(token);
    if (!error && data?.user) return data.user;
  }
  const cookieHeader = request.headers.get("cookie") || "";
  if (cookieHeader) {
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Cookie: cookieHeader } },
    });
    const { data, error } = await authClient.auth.getUser();
    if (!error && data?.user) return data.user;
  }
  return null;
}

async function getCompanyId(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("user_profiles")
    .select("company_id")
    .eq("id", userId)
    .single();
  if (data?.company_id) return data.company_id;

  const { data: d2 } = await supabaseAdmin
    .from("profiles")
    .select("company_id")
    .eq("user_id", userId)
    .single();
  return d2?.company_id || null;
}

function shiftYearBack(dateStr: string): string {
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const companyId = await getCompanyId(user.id);
    if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const periodStart = searchParams.get("periodStart");
    const periodEnd = searchParams.get("periodEnd");
    if (!periodStart || !periodEnd) {
      return NextResponse.json({ error: "periodStart and periodEnd required" }, { status: 400 });
    }

    const prevStart = shiftYearBack(periodStart);
    const prevEnd = shiftYearBack(periodEnd);

    const [ordersRes, activeRes, revenueRes] = await Promise.all([
      supabaseAdmin
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId)
        .gte("created_at", prevStart)
        .lte("created_at", prevEnd + "T23:59:59"),

      supabaseAdmin
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("status", "Active")
        .gte("created_at", prevStart)
        .lte("created_at", prevEnd + "T23:59:59"),

      supabaseAdmin
        .from("order_services")
        .select("client_price, res_status, orders!inner(company_id, created_at)")
        .eq("orders.company_id", companyId)
        .gte("orders.created_at", prevStart)
        .lte("orders.created_at", prevEnd + "T23:59:59"),
    ]);

    let revenue = 0;
    if (!revenueRes.error && revenueRes.data) {
      revenue = revenueRes.data.reduce((sum, item) => {
        if (item.res_status === "cancelled") return sum;
        return sum + parseFloat(item.client_price?.toString() || "0");
      }, 0);
    }

    return NextResponse.json({
      ordersCount: ordersRes.count || 0,
      activeBookings: activeRes.count || 0,
      revenue: Math.round(revenue * 100) / 100,
    });
  } catch (err) {
    console.error("Previous year error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
