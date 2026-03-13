import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiUser } from "@/lib/auth/getApiUser";

export async function GET(request: NextRequest) {
  try {
    const apiUser = await getApiUser(request);
    if (!apiUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { companyId, userId, scope } = apiUser;
    const isOwnScope = scope === "own";

    const today = new Date();
    const rangeStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const rangeEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);

    const startStr = rangeStart.toISOString().slice(0, 10);
    const endStr = rangeEnd.toISOString().slice(0, 10);

    let calQ = supabaseAdmin
      .from("orders")
      .select("id, order_code, date_from, date_to, status, owner_user_id, manager_user_id")
      .eq("company_id", companyId)
      .or(`date_from.gte.${startStr},date_to.gte.${startStr}`)
      .or(`date_from.lte.${endStr},date_to.lte.${endStr}`);
    if (isOwnScope) {
      calQ = calQ.or(`owner_user_id.eq.${userId},manager_user_id.eq.${userId}`);
    }
    const { data: orders, error } = await calQ;

    if (error) {
      console.error("Calendar query error:", error);
      return NextResponse.json({ error: "Query failed" }, { status: 500 });
    }

    const todayStr = today.toISOString().slice(0, 10);
    const eventMap: Record<string, { count: number; status: "upcoming" | "in-progress" | "completed"; orderCode: string; orderId: string }> = {};

    for (const order of orders || []) {
      if (!order.date_from) continue;
      const from = order.date_from;
      const to = order.date_to || from;

      let status: "upcoming" | "in-progress" | "completed";
      if (from > todayStr) {
        status = "upcoming";
      } else if (to < todayStr) {
        status = "completed";
      } else {
        status = "in-progress";
      }

      const addEvent = (dateStr: string) => {
        if (dateStr < startStr || dateStr > endStr) return;
        if (!eventMap[dateStr]) {
          eventMap[dateStr] = { count: 0, status, orderCode: order.order_code, orderId: order.id };
        }
        eventMap[dateStr].count += 1;
        if (status === "in-progress") eventMap[dateStr].status = "in-progress";
      };

      const d = new Date(from);
      const endDate = new Date(to);
      while (d <= endDate) {
        addEvent(d.toISOString().slice(0, 10));
        d.setDate(d.getDate() + 1);
      }
    }

    const events = Object.entries(eventMap).map(([date, ev]) => ({
      date,
      status: ev.status,
      orderCode: ev.orderCode,
      orderId: ev.orderId,
      count: ev.count,
    }));

    return NextResponse.json({ events });
  } catch (err) {
    console.error("Calendar error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
