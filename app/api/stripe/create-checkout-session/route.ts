import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe, isStripeConfigured } from "@/lib/stripe";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

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
  return data?.company_id || null;
}

/**
 * POST /api/stripe/create-checkout-session
 * Creates a Stripe Checkout Session for subscription
 */
export async function POST(request: NextRequest) {
  if (!isStripeConfigured() || !stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 503 }
    );
  }

  try {
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

    const body = await request.json();
    const { planId, successUrl, cancelUrl } = body;

    if (!planId) {
      return NextResponse.json(
        { error: "planId is required" },
        { status: 400 }
      );
    }

    // Get plan with Stripe Price ID
    const { data: plan, error: planError } = await supabaseAdmin
      .from("subscription_plans")
      .select("id, name, monthly_price_eur, stripe_monthly_price_id")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    if (!plan.stripe_monthly_price_id) {
      return NextResponse.json(
        { error: `Plan "${plan.name}" does not have Stripe configured. Contact support.` },
        { status: 400 }
      );
    }

    // Check existing subscription
    const { data: existingSub } = await supabaseAdmin
      .from("company_subscriptions")
      .select("id, status")
      .eq("company_id", companyId)
      .single();

    if (existingSub && ["active", "trialing"].includes(existingSub.status)) {
      return NextResponse.json(
        { error: "Company already has an active subscription. Use Manage Billing to change plan." },
        { status: 400 }
      );
    }

    // Get company for customer email
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .single();

    const success = successUrl || `${appUrl}/settings/billing?success=true`;
    const cancel = cancelUrl || `${appUrl}/settings/billing?canceled=true`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: plan.stripe_monthly_price_id,
          quantity: 1,
        },
      ],
      success_url: success,
      cancel_url: cancel,
      metadata: {
        company_id: companyId,
        plan_id: planId,
      },
      customer_email: user.email || undefined,
      subscription_data: {
        metadata: {
          company_id: companyId,
          plan_id: planId,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[Stripe Checkout] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
