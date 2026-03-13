import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/getApiUser";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { stripe, isStripeConfigured } from "@/lib/stripe";

const appUrl = process.env.NEXT_PUBLIC_APP_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export async function POST(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.role !== "supervisor" && user.role !== "Supervisor") {
    return NextResponse.json({ error: "Only supervisors can manage database plans" }, { status: 403 });
  }

  if (!isStripeConfigured() || !stripe) {
    return NextResponse.json({ error: "Payment system is not configured" }, { status: 503 });
  }

  const body = await request.json();
  const { planId } = body;

  if (!planId) {
    return NextResponse.json({ error: "Plan ID is required" }, { status: 400 });
  }

  const { data: plan } = await supabaseAdmin
    .from("tariff_plans")
    .select("*")
    .eq("id", planId)
    .single();

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  if (plan.slug === "starter") {
    return NextResponse.json({ error: "Starter plan uses shared database — no payment needed" }, { status: 400 });
  }

  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("id, name, supabase_configured, supabase_status, stripe_customer_id")
    .eq("id", user.companyId)
    .single();

  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  if (company.supabase_configured && company.supabase_status === "active") {
    return NextResponse.json({ error: "Database already provisioned. Contact support to change plans." }, { status: 400 });
  }

  if (!plan.stripe_price_id_monthly) {
    return NextResponse.json(
      { error: `Plan "${plan.name}" does not have Stripe pricing configured yet. Contact platform admin.` },
      { status: 400 }
    );
  }

  try {
    const sessionParams: Record<string, unknown> = {
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: plan.stripe_price_id_monthly, quantity: 1 }],
      success_url: `${appUrl}/settings/database?success=true`,
      cancel_url: `${appUrl}/settings/database?canceled=true`,
      metadata: {
        company_id: user.companyId,
        plan_id: planId,
        tariff_plan_id: planId,
      },
      subscription_data: {
        metadata: {
          company_id: user.companyId,
          plan_id: planId,
          tariff_plan_id: planId,
        },
      },
    };

    if (company.stripe_customer_id) {
      sessionParams.customer = company.stripe_customer_id;
    } else {
      sessionParams.customer_email = user.userId
        ? (await supabaseAdmin.from("user_profiles").select("email").eq("id", user.userId).single()).data?.email
        : undefined;
    }

    const session = await stripe.checkout.sessions.create(
      sessionParams as Parameters<typeof stripe.checkout.sessions.create>[0]
    );

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[Database Provision] Stripe error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create payment session" },
      { status: 500 }
    );
  }
}
