import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/getApiUser";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: NextRequest) {
  try {
    const apiUser = await getApiUser(request);
    if (!apiUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { companyId } = apiUser;

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const method = searchParams.get("method");

    let query = supabaseAdmin
      .from("payments")
      .select(`
        *,
        orders(order_code, client_display_name),
        company_bank_accounts(account_name, bank_name)
      `)
      .eq("company_id", companyId)
      .order("paid_at", { ascending: true });

    if (dateFrom) query = query.gte("paid_at", dateFrom);
    if (dateTo) query = query.lte("paid_at", dateTo + "T23:59:59Z");
    if (method) query = query.eq("method", method);

    const { data, error } = await query;

    if (error) {
      console.error("[cashflow] GET error:", error);
      return NextResponse.json({ error: "Failed to fetch cashflow" }, { status: 500 });
    }

    const payments = (data ?? []).map((p: Record<string, unknown>) => {
      const flat = {
        ...p,
        order_code: (p.orders as Record<string, unknown>)?.order_code ?? null,
        order_client: (p.orders as Record<string, unknown>)?.client_display_name ?? null,
        account_name: (p.company_bank_accounts as Record<string, unknown>)?.account_name ?? null,
        bank_name: (p.company_bank_accounts as Record<string, unknown>)?.bank_name ?? null,
        orders: undefined,
        company_bank_accounts: undefined,
      };
      return flat as Record<string, unknown>;
    });

    // Group by date for Z-report
    const byDate: Record<string, { payments: typeof payments; total: number }> = {};
    for (const p of payments) {
      const day = String(p.paid_at ?? "").slice(0, 10);
      if (!byDate[day]) byDate[day] = { payments: [], total: 0 };
      byDate[day].payments.push(p);
      byDate[day].total += Number(p.amount ?? 0);
    }

    const dailyReport = Object.entries(byDate)
      .map(([date, val]) => ({
        date,
        payments: val.payments,
        total: Math.round(val.total * 100) / 100,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const grandTotal = Math.round(
      payments.reduce((s: number, p: Record<string, unknown>) => s + Number(p.amount ?? 0), 0) * 100
    ) / 100;

    return NextResponse.json({
      data: {
        payments,
        dailyReport,
        grandTotal,
        count: payments.length,
      },
    });
  } catch (err) {
    console.error("[cashflow] GET:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
