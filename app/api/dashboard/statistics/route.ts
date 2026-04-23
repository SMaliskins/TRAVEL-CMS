import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiUser } from "@/lib/auth/getApiUser";
import { computeServiceLineEconomics } from "@/lib/orders/serviceEconomics";

export async function GET(request: NextRequest) {
  try {
    const apiUser = await getApiUser(request);
    if (!apiUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { companyId, userId, role, scope } = apiUser;
    const isOwnScope = scope === "own";

    const { searchParams } = new URL(request.url);
    const periodStart = searchParams.get("periodStart");
    const periodEnd = searchParams.get("periodEnd");

    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        { error: "periodStart and periodEnd are required" },
        { status: 400 }
      );
    }

    const agentFilter = isOwnScope ? `owner_user_id.eq.${userId},manager_user_id.eq.${userId}` : null;

    // 1. Orders count (for the period)
    let ordersQ = supabaseAdmin
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .gte("created_at", periodStart)
      .lte("created_at", periodEnd + "T23:59:59");
    if (agentFilter) ordersQ = ordersQ.or(agentFilter);
    const { count: ordersCount, error: ordersError } = await ordersQ;

    if (ordersError) {
      console.error("Orders count error:", ordersError);
    }

    // 2. Active Bookings (orders that have not started yet)
    let activeQ = supabaseAdmin
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "Active")
      .gt("date_from", new Date().toISOString().split("T")[0]);
    if (agentFilter) activeQ = activeQ.or(agentFilter);
    const { count: activeBookings, error: activeBookingsError } = await activeQ;

    if (activeBookingsError) {
      console.error("Active bookings error:", activeBookingsError);
    }

    // 3. Revenue, Profit & VAT (for the period) — same logic as Orders page
    let servicesQ = supabaseAdmin
      .from("order_services")
      .select("client_price, service_price, res_status, service_type, category, commission_amount, vat_rate, orders!inner(company_id, created_at, owner_user_id, manager_user_id)")
      .eq("orders.company_id", companyId)
      .gte("orders.created_at", periodStart)
      .lte("orders.created_at", periodEnd + "T23:59:59");
    if (isOwnScope) {
      servicesQ = servicesQ.or(`owner_user_id.eq.${userId},manager_user_id.eq.${userId}`, { referencedTable: "orders" });
    }
    const { data: servicesData, error: servicesError } = await servicesQ;

    let revenue = 0;
    let profit = 0;
    let vat = 0;
    let totalCommission = 0;
    if (!servicesError && servicesData) {
      for (const svc of servicesData) {
        const cat = ((svc.category as string) || "").toLowerCase();
        const isTour = cat.includes("tour") || cat.includes("package");
        if (isTour && svc.commission_amount != null) {
          totalCommission += Number(svc.commission_amount) || 0;
        }
        const econ = computeServiceLineEconomics({
          client_price: svc.client_price,
          service_price: svc.service_price,
          service_type: svc.service_type,
          category: svc.category,
          commission_amount: svc.commission_amount,
          vat_rate: svc.vat_rate,
        });
        revenue += econ.clientSigned;
        profit += econ.profitNetOfVat;
        vat += econ.vatOnMargin;
      }
    }

    // 5. Overdue Payments — filtered per user for own-scope roles
    const todayStr = new Date().toISOString().split("T")[0];

    let overdueQ = supabaseAdmin
      .from("invoices")
      .select("id, total, final_payment_date, due_date, orders!inner(owner_user_id, manager_user_id)")
      .eq("company_id", companyId)
      .in("status", ["issued", "sent", "partially_paid"])
      .or(`final_payment_date.lt.${todayStr},due_date.lt.${todayStr}`);
    if (isOwnScope) {
      overdueQ = overdueQ.or(`owner_user_id.eq.${userId},manager_user_id.eq.${userId}`, { referencedTable: "orders" });
    }
    const overdueResult = await overdueQ;
    const overdueInvoices = overdueResult.data;
    const overdueError = overdueResult.error;

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
        const dueRaw = inv.final_payment_date || inv.due_date;
        if (!dueRaw) continue;
        const dueDay = String(dueRaw).slice(0, 10);
        if (dueDay >= todayStr) continue;
        // Match the selected dashboard/card period: only count debt for invoices
        // whose due date falls inside [periodStart, periodEnd]. Otherwise the
        // overdue total never changes when the user changes the period.
        if (dueDay < periodStart || dueDay > periodEnd) continue;
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
      totalCommission: Math.round(totalCommission * 100) / 100,
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

