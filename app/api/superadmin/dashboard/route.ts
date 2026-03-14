import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/superadmin/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: NextRequest) {
  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "month";
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date = now;

    if (period === "custom" && from && to) {
      periodStart = new Date(from);
      periodEnd = new Date(to);
    } else if (period === "week") {
      periodStart = new Date(now);
      periodStart.setDate(now.getDate() - 7);
    } else if (period === "year") {
      periodStart = new Date(now);
      periodStart.setFullYear(now.getFullYear() - 1);
    } else {
      periodStart = new Date(now);
      periodStart.setMonth(now.getMonth() - 1);
    }

    const [
      companiesResult,
      pendingRegsResult,
      subsResult,
      plansResult,
      addonsResult,
      companyAddonsResult,
      recentRegsResult,
      aiUsageResult,
      storageResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("companies")
        .select(
          `id, name, legal_name, country, is_demo, demo_expires_at, created_at,
           tariff_plan_id, stripe_customer_id, stripe_subscription_id,
           subscription_status, storage_used_bytes, storage_checked_at, trial_ends_at,
           supabase_status, supabase_configured`
        )
        .order("created_at", { ascending: false }),

      supabaseAdmin
        .from("company_registrations")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),

      supabaseAdmin
        .from("company_subscriptions")
        .select(
          `id, company_id, status, billing_cycle, current_period_start, current_period_end,
           stripe_subscription_id, created_at,
           subscription_plans ( id, name, slug, monthly_price_eur )`
        ),

      supabaseAdmin
        .from("tariff_plans")
        .select("id, name, slug, price_monthly, price_yearly, storage_limit_gb, orders_limit, users_limit, features")
        .eq("is_active", true)
        .order("sort_order"),

      supabaseAdmin
        .from("plan_addons")
        .select("id, name, slug, price_monthly, category")
        .eq("is_active", true),

      supabaseAdmin
        .from("company_addons")
        .select("id, company_id, addon_id, quantity, is_active, activated_at")
        .eq("is_active", true),

      supabaseAdmin
        .from("company_registrations")
        .select("id, status, company_data, users_data, plan_id, submitted_at, reviewed_at, subscription_plans(name)")
        .order("submitted_at", { ascending: false })
        .limit(10),

      supabaseAdmin
        .from("ai_usage_log")
        .select("company_id, total_tokens, estimated_cost_usd, created_at")
        .gte("created_at", periodStart.toISOString())
        .lte("created_at", periodEnd.toISOString()),

      supabaseAdmin
        .from("storage_usage_log")
        .select("company_id, storage_used_bytes, checked_at")
        .order("checked_at", { ascending: false })
        .limit(200),
    ]);

    const companies = companiesResult.data || [];
    const subscriptions = subsResult.data || [];
    const plans = plansResult.data || [];
    const addons = addonsResult.data || [];
    const activeCompanyAddons = companyAddonsResult.data || [];
    const recentRegistrations = recentRegsResult.data || [];
    const aiUsageLogs = aiUsageResult.data || [];
    const storageLogs = storageResult.data || [];

    const subByCompany = new Map<string, (typeof subscriptions)[0]>();
    for (const s of subscriptions) {
      if (s.company_id) subByCompany.set(s.company_id, s);
    }

    const addonsByCompany = new Map<string, typeof activeCompanyAddons>();
    for (const a of activeCompanyAddons) {
      const list = addonsByCompany.get(a.company_id) || [];
      list.push(a);
      addonsByCompany.set(a.company_id, list);
    }

    const aiByCompany = new Map<string, { calls: number; cost: number }>();
    for (const log of aiUsageLogs) {
      const existing = aiByCompany.get(log.company_id) || { calls: 0, cost: 0 };
      existing.calls += 1;
      existing.cost += parseFloat(log.estimated_cost_usd) || 0;
      aiByCompany.set(log.company_id, existing);
    }

    // --- KPI Stats ---
    const totalCompanies = companies.length;
    const activeCompanies = companies.filter(
      (c) => c.subscription_status === "active" || (c.is_demo && c.demo_expires_at && new Date(c.demo_expires_at) > now)
    ).length;
    const trialCompanies = companies.filter(
      (c) => c.trial_ends_at && new Date(c.trial_ends_at) > now
    ).length;
    const expiredTrials = companies.filter(
      (c) => c.trial_ends_at && new Date(c.trial_ends_at) <= now && c.subscription_status !== "active"
    ).length;

    const mrr = subscriptions
      .filter((s) => s.status === "active")
      .reduce((sum, s) => {
        const plan = s.subscription_plans as { monthly_price_eur?: number } | null;
        return sum + (plan?.monthly_price_eur || 0);
      }, 0);

    const addonMrr = activeCompanyAddons.reduce((sum, a) => {
      const addon = addons.find((ad) => ad.id === a.addon_id);
      return sum + (addon ? Number(addon.price_monthly) * a.quantity : 0);
    }, 0);

    // --- Plan distribution ---
    const planMap = new Map(plans.map((p) => [p.id, p]));
    const planDistribution = plans.map((plan) => {
      const count = companies.filter((c) => c.tariff_plan_id === plan.id).length;
      return { name: plan.name, slug: plan.slug, count, price: Number(plan.price_monthly) };
    });

    // --- Addon popularity ---
    const addonUsageMap = new Map<string, number>();
    for (const ca of activeCompanyAddons) {
      addonUsageMap.set(ca.addon_id, (addonUsageMap.get(ca.addon_id) || 0) + ca.quantity);
    }
    const addonPopularity = addons.map((a) => ({
      name: a.name,
      slug: a.slug,
      category: a.category,
      activeCount: addonUsageMap.get(a.id) || 0,
      revenue: (addonUsageMap.get(a.id) || 0) * Number(a.price_monthly),
    })).sort((a, b) => b.activeCount - a.activeCount);

    // --- Total platform storage ---
    const totalStorageBytes = companies.reduce((s, c) => s + (Number(c.storage_used_bytes) || 0), 0);

    // --- Companies with alerts ---
    const alerts: Array<{ companyId: string; companyName: string; type: string; detail: string }> = [];
    for (const c of companies) {
      if (c.subscription_status === "past_due") {
        alerts.push({ companyId: c.id, companyName: c.name, type: "past_due", detail: "Payment overdue" });
      }
      if (c.trial_ends_at) {
        const trialEnd = new Date(c.trial_ends_at);
        const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000);
        if (daysLeft > 0 && daysLeft <= 3) {
          alerts.push({ companyId: c.id, companyName: c.name, type: "trial_expiring", detail: `Trial expires in ${daysLeft} day(s)` });
        }
        if (daysLeft <= 0 && c.subscription_status !== "active") {
          alerts.push({ companyId: c.id, companyName: c.name, type: "trial_expired", detail: "Trial expired, no subscription" });
        }
      }
    }

    // --- Enriched companies list ---
    const enrichedCompanies = companies.map((c) => {
      const sub = subByCompany.get(c.id);
      const plan = sub?.subscription_plans as { name?: string; slug?: string; monthly_price_eur?: number } | null;
      const tariff = c.tariff_plan_id ? planMap.get(c.tariff_plan_id) : null;
      const compAddons = addonsByCompany.get(c.id) || [];
      const ai = aiByCompany.get(c.id) || { calls: 0, cost: 0 };

      let status: string;
      if (c.subscription_status === "active") status = "active";
      else if (c.trial_ends_at && new Date(c.trial_ends_at) > now) status = "trial";
      else if (c.is_demo && c.demo_expires_at && new Date(c.demo_expires_at) > now) status = "demo";
      else if (c.subscription_status === "past_due") status = "past_due";
      else if (c.subscription_status === "cancelled") status = "cancelled";
      else if (c.trial_ends_at && new Date(c.trial_ends_at) <= now) status = "trial_expired";
      else status = "inactive";

      return {
        id: c.id,
        name: c.name,
        legalName: c.legal_name,
        country: c.country,
        createdAt: c.created_at,
        status,
        plan: plan?.name || tariff?.name || "Free",
        planPrice: plan?.monthly_price_eur || (tariff ? Number(tariff.price_monthly) : 0),
        subscriptionStatus: c.subscription_status || "none",
        trialEndsAt: c.trial_ends_at,
        storageUsedBytes: Number(c.storage_used_bytes) || 0,
        storageLimit: tariff ? Number(tariff.storage_limit_gb) * 1073741824 : 0,
        addonsCount: compAddons.length,
        addonsList: compAddons.map((a) => {
          const addonDef = addons.find((ad) => ad.id === a.addon_id);
          return { name: addonDef?.name || "Unknown", quantity: a.quantity };
        }),
        aiCalls: ai.calls,
        aiCost: ai.cost,
        supabaseStatus: c.supabase_status,
        supabaseConfigured: c.supabase_configured,
        hasStripe: !!c.stripe_customer_id,
      };
    });

    // --- Registration stats ---
    const registrationsByMonth: Record<string, number> = {};
    for (const c of companies) {
      const d = new Date(c.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      registrationsByMonth[key] = (registrationsByMonth[key] || 0) + 1;
    }

    // --- AI usage total ---
    const totalAiCalls = aiUsageLogs.length;
    const totalAiCost = aiUsageLogs.reduce((s, l) => s + (parseFloat(l.estimated_cost_usd) || 0), 0);

    return NextResponse.json({
      kpi: {
        totalCompanies,
        activeCompanies,
        trialCompanies,
        expiredTrials,
        pendingRegistrations: pendingRegsResult.count || 0,
        mrr,
        addonMrr,
        totalMrr: mrr + addonMrr,
        totalStorageBytes,
        totalAiCalls,
        totalAiCost,
      },
      planDistribution,
      addonPopularity,
      companies: enrichedCompanies,
      recentRegistrations: (recentRegistrations || []).map((r) => ({
        id: r.id,
        status: r.status,
        companyName: (r.company_data as { name?: string })?.name || "Unknown",
        email: (r.company_data as { email?: string })?.email || "",
        planName: (r.subscription_plans as { name?: string })?.name || "Unknown",
        usersCount: Array.isArray(r.users_data) ? r.users_data.length : 0,
        submittedAt: r.submitted_at,
      })),
      alerts,
      registrationsByMonth,
      period: { start: periodStart.toISOString(), end: periodEnd.toISOString() },
    });
  } catch (err) {
    console.error("[SuperAdmin Dashboard] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
