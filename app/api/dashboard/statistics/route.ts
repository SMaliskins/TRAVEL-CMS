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
      .lte("created_at", periodEnd + "T23:59:59");

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

    // 3. Revenue, Profit & VAT (for the period) — same logic as Orders page
    const { data: servicesData, error: servicesError } = await supabaseAdmin
      .from("order_services")
      .select("client_price, service_price, res_status, category, commission_amount, vat_rate, orders!inner(company_id, created_at)")
      .eq("orders.company_id", companyId)
      .gte("orders.created_at", periodStart)
      .lte("orders.created_at", periodEnd + "T23:59:59");

    let revenue = 0;
    let profit = 0;
    let vat = 0;
    if (!servicesError && servicesData) {
      for (const svc of servicesData) {
        if (svc.res_status === "cancelled") continue;
        const cp = parseFloat(svc.client_price?.toString() || "0");
        const sp = parseFloat(svc.service_price?.toString() || "0");
        const cat = ((svc.category as string) || "").toLowerCase();
        const isTour = cat.includes("tour") || cat.includes("package");
        const dbRate = Number(svc.vat_rate) || 0;
        const vatRate = dbRate > 0 ? dbRate : (cat.includes("flight") ? 0 : 21);

        let margin = 0;
        if (isTour && svc.commission_amount != null) {
          const commission = Number(svc.commission_amount) || 0;
          margin = cp - (sp - commission);
        } else {
          margin = cp - sp;
        }

        const vatAmount = vatRate > 0 && margin >= 0
          ? Math.round(margin * vatRate / (100 + vatRate) * 100) / 100
          : 0;

        revenue += cp;
        profit += margin - vatAmount;
        vat += vatAmount;
      }
    }

    // 5. Overdue Payments — via invoices with due_date/final_payment_date in the past
    const todayStr = new Date().toISOString().split("T")[0];

    const { data: overdueInvoices, error: overdueError } = await supabaseAdmin
      .from("invoices")
      .select("id, total, final_payment_date, due_date")
      .eq("company_id", companyId)
      .in("status", ["issued", "sent", "partially_paid"])
      .or(`final_payment_date.lt.${todayStr},due_date.lt.${todayStr}`);

    let overdueAmount = 0;
    if (!overdueError && overdueInvoices && overdueInvoices.length > 0) {
      const invoiceIds = overdueInvoices.map((inv) => inv.id);
      const { data: paymentsData } = await supabaseAdmin
        .from("payments")
        .select("invoice_id, amount")
        .in("invoice_id", invoiceIds)
        .eq("status", "completed");

      const paidByInvoice: Record<string, number> = {};
      for (const p of paymentsData || []) {
        paidByInvoice[p.invoice_id] = (paidByInvoice[p.invoice_id] || 0) + parseFloat(p.amount?.toString() || "0");
      }

      for (const inv of overdueInvoices) {
        const dueDate = inv.final_payment_date || inv.due_date;
        if (!dueDate || dueDate >= todayStr) continue;
        const total = parseFloat(inv.total?.toString() || "0");
        const paid = paidByInvoice[inv.id] || 0;
        const debt = total - paid;
        if (debt > 0) overdueAmount += debt;
      }
    }

    // 6. Company targets
    const { data: companyData } = await supabaseAdmin
      .from("companies")
      .select("target_profit_monthly, target_revenue_monthly, target_orders_monthly")
      .eq("id", companyId)
      .single();

    return NextResponse.json({
      ordersCount: ordersCount || 0,
      activeBookings: activeBookings || 0,
      revenue: Math.round(revenue * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      vat: Math.round(vat * 100) / 100,
      overdueAmount: Math.round(overdueAmount * 100) / 100,
      targetProfitMonthly: parseFloat(companyData?.target_profit_monthly?.toString() || "0"),
      targetRevenueMonthly: parseFloat(companyData?.target_revenue_monthly?.toString() || "0"),
      targetOrdersMonthly: companyData?.target_orders_monthly || 0,
    });
  } catch (error) {
    console.error("Dashboard statistics error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

