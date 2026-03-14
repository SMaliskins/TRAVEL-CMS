import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/getApiUser";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { stripe, isStripeConfigured } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.role !== "supervisor" && user.role !== "Supervisor") {
    return NextResponse.json({ error: "Only supervisors can manage add-ons" }, { status: 403 });
  }

  const { addonId } = await request.json();

  if (!addonId) {
    return NextResponse.json({ error: "addonId is required" }, { status: 400 });
  }

  const { data: companyAddon } = await supabaseAdmin
    .from("company_addons")
    .select("id, stripe_subscription_item_id, is_active")
    .eq("company_id", user.companyId)
    .eq("addon_id", addonId)
    .single();

  if (!companyAddon || !companyAddon.is_active) {
    return NextResponse.json({ error: "Add-on is not active" }, { status: 400 });
  }

  if (companyAddon.stripe_subscription_item_id && isStripeConfigured() && stripe) {
    try {
      await stripe.subscriptionItems.del(companyAddon.stripe_subscription_item_id);
    } catch (err) {
      console.error("[Add-on Deactivate] Stripe error:", err);
    }
  }

  await supabaseAdmin
    .from("company_addons")
    .update({
      is_active: false,
      deactivated_at: new Date().toISOString(),
      stripe_subscription_item_id: null,
    })
    .eq("id", companyAddon.id);

  return NextResponse.json({ deactivated: true });
}
