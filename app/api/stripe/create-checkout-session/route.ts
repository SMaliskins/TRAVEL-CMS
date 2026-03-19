import { NextRequest, NextResponse } from "next/server";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { getApiUser } from "@/lib/auth/getApiUser";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

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
    const apiUser = await getApiUser(request);
    if (!apiUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { companyId } = apiUser;

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
      customer_email: undefined,
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
