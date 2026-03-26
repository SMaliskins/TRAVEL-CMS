import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/superadmin/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: NextRequest) {
  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const statusFilter = searchParams.get("status") || "";
    const planFilter = searchParams.get("plan") || "";

    const [companiesRes, subsRes, plansRes, modulesRes, addonsRes, compModulesRes, compAddonsRes] =
      await Promise.all([
        supabaseAdmin
          .from("companies")
          .select("id, name, legal_name, country, is_demo, demo_expires_at, created_at, tariff_plan_id, subscription_status, trial_ends_at")
          .order("created_at", { ascending: false }),
        supabaseAdmin.from("company_subscriptions").select("id, company_id, plan_id, status, billing_cycle, current_period_end"),
        supabaseAdmin.from("tariff_plans").select("*").eq("is_active", true).order("sort_order"),
        supabaseAdmin.from("modules").select("id, code, name, is_paid, monthly_price_eur, sort_order").order("sort_order"),
        supabaseAdmin.from("plan_addons").select("id, name, slug, price_monthly, category, is_active, sort_order").order("sort_order"),
        supabaseAdmin.from("company_modules").select("id, company_id, module_id, is_enabled"),
        supabaseAdmin.from("company_addons").select("id, company_id, addon_id, quantity, is_active"),
      ]);

    const companies = companiesRes.data || [];
    const subscriptions = subsRes.data || [];
    const plans = plansRes.data || [];
    const modules = modulesRes.data || [];
    const addons = addonsRes.data || [];
    const compModules = compModulesRes.data || [];
    const compAddons = compAddonsRes.data || [];

    const subByCompany = new Map(subscriptions.map((s) => [s.company_id, s]));
    const modulesByCompany = new Map<string, typeof compModules>();
    for (const cm of compModules) {
      const list = modulesByCompany.get(cm.company_id) || [];
      list.push(cm);
      modulesByCompany.set(cm.company_id, list);
    }
    const addonsByCompany = new Map<string, typeof compAddons>();
    for (const ca of compAddons) {
      const list = addonsByCompany.get(ca.company_id) || [];
      list.push(ca);
      addonsByCompany.set(ca.company_id, list);
    }

    const planMap = new Map(plans.map((p) => [p.id, p]));
    const now = new Date();

    let enriched = companies.map((c) => {
      const sub = subByCompany.get(c.id);
      const tariff = c.tariff_plan_id ? planMap.get(c.tariff_plan_id) : null;
      const cms = modulesByCompany.get(c.id) || [];
      const cas = addonsByCompany.get(c.id) || [];

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
        planId: c.tariff_plan_id,
        planName: tariff?.name || "Free",
        planPrice: tariff ? Number(tariff.price_monthly) : 0,
        subscriptionStatus: sub?.status || "none",
        billingCycle: sub?.billing_cycle || null,
        modules: cms.map((cm) => ({
          moduleId: cm.module_id,
          isEnabled: cm.is_enabled,
        })),
        addons: cas.map((ca) => ({
          addonId: ca.addon_id,
          quantity: ca.quantity,
          isActive: ca.is_active,
        })),
      };
    });

    if (search) {
      const q = search.toLowerCase();
      enriched = enriched.filter(
        (c) => c.name.toLowerCase().includes(q) || (c.legalName && c.legalName.toLowerCase().includes(q))
      );
    }
    if (statusFilter) enriched = enriched.filter((c) => c.status === statusFilter);
    if (planFilter) enriched = enriched.filter((c) => c.planId === planFilter);

    return NextResponse.json({ companies: enriched, plans, modules, addons });
  } catch (err) {
    console.error("[SuperAdmin Subscriptions GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const { companyId, planId, modules, addons } = body as {
      companyId: string;
      planId?: string | null;
      modules?: Array<{ moduleId: string; isEnabled: boolean }>;
      addons?: Array<{ addonId: string; quantity: number; isActive: boolean }>;
    };

    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }

    if (planId !== undefined) {
      await supabaseAdmin
        .from("companies")
        .update({ tariff_plan_id: planId })
        .eq("id", companyId);
    }

    if (modules && modules.length > 0) {
      for (const m of modules) {
        await supabaseAdmin
          .from("company_modules")
          .upsert(
            { company_id: companyId, module_id: m.moduleId, is_enabled: m.isEnabled, notes: "Superadmin override" },
            { onConflict: "company_id,module_id" }
          );
      }
    }

    if (addons && addons.length > 0) {
      for (const a of addons) {
        if (a.isActive && a.quantity > 0) {
          await supabaseAdmin
            .from("company_addons")
            .upsert(
              { company_id: companyId, addon_id: a.addonId, quantity: a.quantity, is_active: true },
              { onConflict: "company_id,addon_id" }
            );
        } else {
          await supabaseAdmin
            .from("company_addons")
            .update({ is_active: false, deactivated_at: new Date().toISOString() })
            .eq("company_id", companyId)
            .eq("addon_id", a.addonId);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[SuperAdmin Subscriptions PUT]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
