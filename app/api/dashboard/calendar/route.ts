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

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const companyId = await getCompanyId(user.id);
    if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

    const today = new Date();
    const rangeStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const rangeEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);

    const startStr = rangeStart.toISOString().slice(0, 10);
    const endStr = rangeEnd.toISOString().slice(0, 10);

    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select("id, order_code, date_from, date_to, status")
      .eq("company_id", companyId)
      .or(`date_from.gte.${startStr},date_to.gte.${startStr}`)
      .or(`date_from.lte.${endStr},date_to.lte.${endStr}`);

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
