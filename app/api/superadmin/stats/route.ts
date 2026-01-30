import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/superadmin/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * GET /api/superadmin/stats - Dashboard statistics
 */
export async function GET(request: NextRequest) {
  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    // Total companies
    const { count: totalCompanies } = await supabaseAdmin
      .from("companies")
      .select("id", { count: "exact", head: true });

    // Active companies (with active subscription or demo not expired)
    const { count: activeCompanies } = await supabaseAdmin
      .from("companies")
      .select("id", { count: "exact", head: true })
      .or("is_demo.eq.false,demo_expires_at.gt.now()");

    // Pending registrations
    const { count: pendingRegistrations } = await supabaseAdmin
      .from("company_registrations")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    // Total MRR from active subscriptions
    const { data: subscriptions } = await supabaseAdmin
      .from("company_subscriptions")
      .select(`
        subscription_plans (
          monthly_price_eur
        )
      `)
      .eq("status", "active");

    const totalRevenue = (subscriptions || []).reduce((sum, sub) => {
      const plan = sub.subscription_plans as { monthly_price_eur?: number } | null;
      return sum + (plan?.monthly_price_eur || 0);
    }, 0);

    // AI usage this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: aiUsage } = await supabaseAdmin
      .from("ai_usage_log")
      .select("total_tokens, estimated_cost_usd")
      .gte("created_at", startOfMonth.toISOString());

    const aiUsageThisMonth = {
      calls: aiUsage?.length || 0,
      cost: (aiUsage || []).reduce((sum, row) => sum + (parseFloat(row.estimated_cost_usd) || 0), 0),
    };

    return NextResponse.json({
      totalCompanies: totalCompanies || 0,
      activeCompanies: activeCompanies || 0,
      pendingRegistrations: pendingRegistrations || 0,
      totalRevenue,
      aiUsageThisMonth,
    });
  } catch (err) {
    console.error("[SuperAdmin Stats] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
