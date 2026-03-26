import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/superadmin/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  try {
    const [companyRes, subsRes, modulesRes, addonsRes, compModulesRes, compAddonsRes, usersRes, plansRes] =
      await Promise.all([
        supabaseAdmin
          .from("companies")
          .select("id, name, legal_name, country, reg_number, vat_number, address, phone, email, website, is_demo, demo_expires_at, created_at, tariff_plan_id, subscription_status, trial_ends_at, storage_used_bytes, supabase_status, supabase_configured, stripe_customer_id")
          .eq("id", id)
          .single(),
        supabaseAdmin
          .from("company_subscriptions")
          .select("id, plan_id, status, billing_cycle, current_period_start, current_period_end, stripe_subscription_id, created_at, subscription_plans(id, name, monthly_price_eur)")
          .eq("company_id", id)
          .maybeSingle(),
        supabaseAdmin.from("modules").select("id, code, name, is_paid, monthly_price_eur, sort_order").order("sort_order"),
        supabaseAdmin.from("plan_addons").select("id, name, slug, price_monthly, category, is_active, sort_order").eq("is_active", true).order("sort_order"),
        supabaseAdmin.from("company_modules").select("id, module_id, is_enabled, notes").eq("company_id", id),
        supabaseAdmin.from("company_addons").select("id, addon_id, quantity, is_active, activated_at").eq("company_id", id),
        supabaseAdmin.from("user_profiles").select("id, full_name, email, role, is_active, last_sign_in_at").eq("company_id", id).order("full_name"),
        supabaseAdmin.from("tariff_plans").select("id, name, slug, price_monthly, price_yearly, storage_limit_gb, orders_limit, users_limit").eq("is_active", true).order("sort_order"),
      ]);

    if (companyRes.error || !companyRes.data) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const company = companyRes.data;
    const sub = subsRes.data;
    const plan = sub?.subscription_plans as { id?: string; name?: string; monthly_price_eur?: number } | null;
    const tariff = company.tariff_plan_id ? (plansRes.data || []).find((p) => p.id === company.tariff_plan_id) : null;

    const now = new Date();
    let status: string;
    if (company.subscription_status === "active") status = "active";
    else if (company.trial_ends_at && new Date(company.trial_ends_at) > now) status = "trial";
    else if (company.is_demo && company.demo_expires_at && new Date(company.demo_expires_at) > now) status = "demo";
    else if (company.subscription_status === "past_due") status = "past_due";
    else if (company.subscription_status === "cancelled") status = "cancelled";
    else if (company.trial_ends_at && new Date(company.trial_ends_at) <= now) status = "trial_expired";
    else status = "inactive";

    return NextResponse.json({
      company: {
        id: company.id,
        name: company.name,
        legalName: company.legal_name,
        country: company.country,
        regNumber: company.reg_number,
        vatNumber: company.vat_number,
        address: company.address,
        phone: company.phone,
        email: company.email,
        website: company.website,
        isDemo: company.is_demo,
        demoExpiresAt: company.demo_expires_at,
        createdAt: company.created_at,
        trialEndsAt: company.trial_ends_at,
        status,
        planId: company.tariff_plan_id,
        planName: plan?.name || tariff?.name || "Free",
        planPrice: plan?.monthly_price_eur || (tariff ? Number(tariff.price_monthly) : 0),
        subscriptionStatus: sub?.status || "none",
        billingCycle: sub?.billing_cycle || null,
        storageUsedBytes: Number(company.storage_used_bytes) || 0,
        storageLimit: tariff ? Number(tariff.storage_limit_gb) * 1073741824 : 0,
        supabaseStatus: company.supabase_status,
        supabaseConfigured: company.supabase_configured,
        hasStripe: !!company.stripe_customer_id,
      },
      modules: modulesRes.data || [],
      addons: addonsRes.data || [],
      companyModules: (compModulesRes.data || []).map((cm) => ({ moduleId: cm.module_id, isEnabled: cm.is_enabled })),
      companyAddons: (compAddonsRes.data || []).map((ca) => ({ addonId: ca.addon_id, quantity: ca.quantity, isActive: ca.is_active })),
      users: (usersRes.data || []).map((u) => ({
        id: u.id, name: u.full_name, email: u.email, role: u.role, isActive: u.is_active, lastSignIn: u.last_sign_in_at,
      })),
      plans: plansRes.data || [],
    });
  } catch (err) {
    console.error("[SuperAdmin Company Detail]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
