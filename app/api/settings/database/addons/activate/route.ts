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
    return NextResponse.json({ error: "Only supervisors can manage add-ons" }, { status: 403 });
  }

  const { addonId, quantity = 1 } = await request.json();

  if (!addonId) {
    return NextResponse.json({ error: "addonId is required" }, { status: 400 });
  }

  const { data: addon } = await supabaseAdmin
    .from("plan_addons")
    .select("*")
    .eq("id", addonId)
    .eq("is_active", true)
    .single();

  if (!addon) {
    return NextResponse.json({ error: "Add-on not found" }, { status: 404 });
  }

  const { data: existing } = await supabaseAdmin
    .from("company_addons")
    .select("id, is_active")
    .eq("company_id", user.companyId)
    .eq("addon_id", addonId)
    .single();

  if (existing?.is_active) {
    return NextResponse.json({ error: "Add-on is already active" }, { status: 400 });
  }

  if (!addon.stripe_price_id || !isStripeConfigured() || !stripe) {
    if (existing) {
      await supabaseAdmin
        .from("company_addons")
        .update({ is_active: true, quantity, activated_at: new Date().toISOString(), deactivated_at: null })
        .eq("id", existing.id);
    } else {
      await supabaseAdmin.from("company_addons").insert({
        company_id: user.companyId,
        addon_id: addonId,
        quantity,
        is_active: true,
      });
    }
    return NextResponse.json({ activated: true });
  }

  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("id", user.companyId)
    .single();

  if (company?.stripe_subscription_id) {
    try {
      const subItem = await stripe.subscriptionItems.create({
        subscription: company.stripe_subscription_id,
        price: addon.stripe_price_id,
        quantity,
      });

      if (existing) {
        await supabaseAdmin
          .from("company_addons")
          .update({
            is_active: true,
            quantity,
            stripe_subscription_item_id: subItem.id,
            activated_at: new Date().toISOString(),
            deactivated_at: null,
          })
          .eq("id", existing.id);
      } else {
        await supabaseAdmin.from("company_addons").insert({
          company_id: user.companyId,
          addon_id: addonId,
          quantity,
          stripe_subscription_item_id: subItem.id,
          is_active: true,
        });
      }

      return NextResponse.json({ activated: true });
    } catch (err) {
      console.error("[Add-on Activate] Stripe error:", err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to add to subscription" },
        { status: 500 }
      );
    }
  }

  try {
    const sessionParams: Record<string, unknown> = {
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: addon.stripe_price_id, quantity }],
      success_url: `${appUrl}/settings/database?success=true&addon=${addon.slug}`,
      cancel_url: `${appUrl}/settings/database?canceled=true`,
      metadata: {
        company_id: user.companyId,
        addon_id: addonId,
        addon_slug: addon.slug,
        type: "addon",
      },
    };

    if (company?.stripe_customer_id) {
      sessionParams.customer = company.stripe_customer_id;
    }

    const session = await stripe.checkout.sessions.create(
      sessionParams as Parameters<typeof stripe.checkout.sessions.create>[0]
    );

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[Add-on Activate] Checkout error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create checkout" },
      { status: 500 }
    );
  }
}
