import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCompanyIdForUser } from "@/lib/stripe";

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

/**
 * GET /api/stripe/subscription
 * Get current company subscription and available plans
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const companyId = await getCompanyIdForUser(user.id);
    if (!companyId) {
      return NextResponse.json(
        { error: "User has no company assigned" },
        { status: 400 }
      );
    }

    // Get current subscription
    const { data: subscription } = await supabaseAdmin
      .from("company_subscriptions")
      .select(`
        id,
        status,
        billing_cycle,
        current_period_start,
        current_period_end,
        cancel_at_period_end,
        stripe_customer_id,
        plan_id,
        subscription_plans (
          id,
          name,
          monthly_price_eur,
          description,
          included_modules
        )
      `)
      .eq("company_id", companyId)
      .single();

    // Get all plans for upgrade options
    const { data: plans } = await supabaseAdmin
      .from("subscription_plans")
      .select("id, name, monthly_price_eur, description, stripe_monthly_price_id")
      .eq("is_active", true)
      .order("monthly_price_eur", { ascending: true });

    const rawPlan = subscription?.subscription_plans;
    const plan = Array.isArray(rawPlan) ? rawPlan[0] : rawPlan;

    const planData = plan && typeof plan === "object"
      ? {
          id: (plan as { id?: string }).id,
          name: (plan as { name?: string }).name,
          monthlyPrice: (plan as { monthly_price_eur?: number }).monthly_price_eur ?? 0,
          description: (plan as { description?: string }).description ?? "",
          includedModules: (plan as { included_modules?: string[] }).included_modules ?? [],
        }
      : null;

    return NextResponse.json({
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            billingCycle: subscription.billing_cycle,
            currentPeriodStart: subscription.current_period_start,
            currentPeriodEnd: subscription.current_period_end,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            hasStripeCustomer: !!subscription.stripe_customer_id,
            plan: planData,
          }
        : null,
      plans: (plans || []).map((p) => ({
        id: p.id,
        name: p.name,
        monthlyPrice: p.monthly_price_eur,
        description: p.description,
        canSubscribe: !!p.stripe_monthly_price_id && p.monthly_price_eur > 0,
      })),
    });
  } catch (err) {
    console.error("[Stripe Subscription] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 }
    );
  }
}
