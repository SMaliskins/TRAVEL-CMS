import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiUser } from "@/lib/auth/getApiUser";

function shiftYearBack(dateStr: string): string {
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  try {
    const apiUser = await getApiUser(request);
    if (!apiUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { companyId, userId, scope } = apiUser;
    const isOwnScope = scope === "own";

    const { searchParams } = new URL(request.url);
    const periodStart = searchParams.get("periodStart");
    const periodEnd = searchParams.get("periodEnd");
    if (!periodStart || !periodEnd) {
      return NextResponse.json({ error: "periodStart and periodEnd required" }, { status: 400 });
    }

    const prevStart = shiftYearBack(periodStart);
    const prevEnd = shiftYearBack(periodEnd);

    const agentFilter = isOwnScope ? `owner_user_id.eq.${userId},manager_user_id.eq.${userId}` : null;

    let ordersQ = supabaseAdmin.from("orders").select("*", { count: "exact", head: true })
      .eq("company_id", companyId).gte("created_at", prevStart).lte("created_at", prevEnd + "T23:59:59");
    if (agentFilter) ordersQ = ordersQ.or(agentFilter);

    let activeQ = supabaseAdmin.from("orders").select("*", { count: "exact", head: true })
      .eq("company_id", companyId).eq("status", "Active").gte("created_at", prevStart).lte("created_at", prevEnd + "T23:59:59");
    if (agentFilter) activeQ = activeQ.or(agentFilter);

    let revenueQ = supabaseAdmin.from("order_services")
      .select("client_price, res_status, orders!inner(company_id, created_at, owner_user_id, manager_user_id)")
      .eq("orders.company_id", companyId).gte("orders.created_at", prevStart).lte("orders.created_at", prevEnd + "T23:59:59");
    if (isOwnScope) {
      revenueQ = revenueQ.or(`owner_user_id.eq.${userId},manager_user_id.eq.${userId}`, { referencedTable: "orders" });
    }

    const [ordersRes, activeRes, revenueRes] = await Promise.all([ordersQ, activeQ, revenueQ]);

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
