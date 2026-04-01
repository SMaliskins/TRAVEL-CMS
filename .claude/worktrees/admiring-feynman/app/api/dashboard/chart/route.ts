import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiUser } from "@/lib/auth/getApiUser";

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

    let servicesQ = supabaseAdmin
      .from("order_services")
      .select("client_price, service_price, res_status, orders!inner(id, company_id, created_at, owner_user_id, manager_user_id)")
      .eq("orders.company_id", companyId)
      .gte("orders.created_at", periodStart)
      .lte("orders.created_at", periodEnd + "T23:59:59");
    if (isOwnScope) {
      servicesQ = servicesQ.or(`owner_user_id.eq.${userId},manager_user_id.eq.${userId}`, { referencedTable: "orders" });
    }
    const { data: services, error } = await servicesQ;

    if (error) {
      console.error("Chart query error:", error);
      return NextResponse.json({ error: "Query failed" }, { status: 500 });
    }

    const dayMap: Record<string, { profit: number; orderIds: Set<string> }> = {};

    for (const svc of services || []) {
      if (svc.res_status === "cancelled") continue;
      const order = svc.orders as unknown as { id: string; created_at: string };
      const day = order.created_at?.slice(0, 10);
      if (!day) continue;

      if (!dayMap[day]) dayMap[day] = { profit: 0, orderIds: new Set() };
      const cp = parseFloat(svc.client_price?.toString() || "0");
      const sp = parseFloat(svc.service_price?.toString() || "0");
      dayMap[day].profit += cp - sp;
      dayMap[day].orderIds.add(order.id);
    }

    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    const data: { date: string; profit: number; orders: number }[] = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      const entry = dayMap[key];
      data.push({
        date: key,
        profit: Math.round((entry?.profit || 0) * 100) / 100,
        orders: entry?.orderIds.size || 0,
      });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("Dashboard chart error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
