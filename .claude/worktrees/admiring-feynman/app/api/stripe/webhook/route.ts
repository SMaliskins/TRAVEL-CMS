import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { provisionCompanyDatabase, suspendCompanyDatabase } from "@/lib/supabase/provisioning";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * POST /api/stripe/webhook
 * Handles Stripe webhook events - signature verification required
 */
export async function POST(request: NextRequest) {
  if (!isStripeConfigured() || !stripe || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook not configured" },
      { status: 503 }
    );
  }

  let event: Stripe.Event;

  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
    }
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Stripe Webhook] Signature verification failed:", message);
    return NextResponse.json(
      { error: `Webhook Error: ${message}` },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const companyId = session.metadata?.company_id;
        const metaType = session.metadata?.type;

        // --- Add-on checkout ---
        if (metaType === "addon" && companyId) {
          const addonId = session.metadata?.addon_id;
          const subscriptionId = session.subscription as string;
          const customerId = session.customer as string;

          if (addonId && subscriptionId) {
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            const itemId = sub.items.data[0]?.id;

            const { data: existingAddon } = await supabaseAdmin
              .from("company_addons")
              .select("id")
              .eq("company_id", companyId)
              .eq("addon_id", addonId)
              .single();

            if (existingAddon) {
              await supabaseAdmin
                .from("company_addons")
                .update({
                  is_active: true,
                  stripe_subscription_item_id: itemId || null,
                  activated_at: new Date().toISOString(),
                  deactivated_at: null,
                })
                .eq("id", existingAddon.id);
            } else {
              await supabaseAdmin.from("company_addons").insert({
                company_id: companyId,
                addon_id: addonId,
                quantity: 1,
                stripe_subscription_item_id: itemId || null,
                is_active: true,
              });
            }

            if (customerId) {
              await supabaseAdmin
                .from("companies")
                .update({ stripe_customer_id: customerId })
                .eq("id", companyId);
            }

            console.log(`[Stripe Webhook] Add-on ${addonId} activated for company ${companyId}`);
          }
          break;
        }

        // --- Plan checkout ---
        const planId = session.metadata?.plan_id;

        if (!companyId || !planId) {
          console.error("[Stripe Webhook] Missing metadata in checkout.session.completed");
          break;
        }

        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;

        if (!subscriptionId || !customerId) {
          console.error("[Stripe Webhook] Missing subscription or customer in session");
          break;
        }

        // Fetch subscription details for period dates
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const sub = subscription as unknown as { current_period_start?: number; current_period_end?: number };
        const currentPeriodStart = new Date((sub.current_period_start ?? 0) * 1000);
        const currentPeriodEnd = new Date((sub.current_period_end ?? 0) * 1000);

        // Upsert company_subscriptions (idempotent - check by stripe_subscription_id)
        const { data: existing } = await supabaseAdmin
          .from("company_subscriptions")
          .select("id")
          .eq("stripe_subscription_id", subscriptionId)
          .single();

        if (existing) {
          await supabaseAdmin
            .from("company_subscriptions")
            .update({
              stripe_customer_id: customerId,
              status: subscription.status === "active" ? "active" : subscription.status,
              current_period_start: currentPeriodStart.toISOString(),
              current_period_end: currentPeriodEnd.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
        } else {
          const { data: existingSub } = await supabaseAdmin
            .from("company_subscriptions")
            .select("id")
            .eq("company_id", companyId)
            .single();

          if (existingSub) {
            await supabaseAdmin
              .from("company_subscriptions")
              .update({
                plan_id: planId,
                stripe_customer_id: customerId,
                stripe_subscription_id: subscriptionId,
                status: subscription.status === "active" ? "active" : subscription.status,
                billing_cycle: "monthly",
                current_period_start: currentPeriodStart.toISOString(),
                current_period_end: currentPeriodEnd.toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("company_id", companyId);
          } else {
            await supabaseAdmin.from("company_subscriptions").insert({
              company_id: companyId,
              plan_id: planId,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              status: subscription.status === "active" ? "active" : subscription.status,
              billing_cycle: "monthly",
              current_period_start: currentPeriodStart.toISOString(),
              current_period_end: currentPeriodEnd.toISOString(),
            });
          }
        }

        // Auto-provision dedicated Supabase database if tariff requires it
        const tariffPlanId = session.metadata?.tariff_plan_id;
        if (tariffPlanId && companyId) {
          const { data: tariff } = await supabaseAdmin
            .from("tariff_plans")
            .select("slug, supabase_plan")
            .eq("id", tariffPlanId)
            .single();

          if (tariff && tariff.slug !== "starter") {
            const { data: companyCheck } = await supabaseAdmin
              .from("companies")
              .select("supabase_configured, supabase_status, name")
              .eq("id", companyId)
              .single();

            if (companyCheck && !companyCheck.supabase_configured) {
              await supabaseAdmin
                .from("companies")
                .update({
                  tariff_plan_id: tariffPlanId,
                  stripe_customer_id: customerId,
                  stripe_subscription_id: subscriptionId,
                  subscription_status: "active",
                  subscription_expires_at: currentPeriodEnd.toISOString(),
                })
                .eq("id", companyId);

              provisionCompanyDatabase(companyId, companyCheck.name, "eu-central-1")
                .then(() => console.log(`[Stripe Webhook] Database provisioned for company ${companyId}`))
                .catch((err) => console.error(`[Stripe Webhook] Provisioning failed for ${companyId}:`, err));
            }
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;
        const sub = subscription as unknown as { current_period_start?: number; current_period_end?: number; cancel_at_period_end?: boolean };

        const { data: existing } = await supabaseAdmin
          .from("company_subscriptions")
          .select("id")
          .eq("stripe_subscription_id", subscriptionId)
          .single();

        if (existing) {
          const statusMap: Record<string, string> = {
            active: "active",
            trialing: "trialing",
            past_due: "past_due",
            canceled: "canceled",
            unpaid: "canceled",
          };
          const status = statusMap[subscription.status] || subscription.status;

          await supabaseAdmin
            .from("company_subscriptions")
            .update({
              status,
              current_period_start: sub.current_period_start
                ? new Date(sub.current_period_start * 1000).toISOString()
                : undefined,
              current_period_end: sub.current_period_end
                ? new Date(sub.current_period_end * 1000).toISOString()
                : undefined,
              cancel_at_period_end: sub.cancel_at_period_end ?? false,
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_subscription_id", subscriptionId);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;

        await supabaseAdmin
          .from("company_subscriptions")
          .update({
            status: "canceled",
            canceled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscriptionId);

        // Suspend the dedicated database when subscription is cancelled
        const { data: affectedCompany } = await supabaseAdmin
          .from("companies")
          .select("id, supabase_configured")
          .eq("stripe_subscription_id", subscriptionId)
          .single();

        if (affectedCompany?.supabase_configured) {
          await supabaseAdmin
            .from("companies")
            .update({ subscription_status: "cancelled" })
            .eq("id", affectedCompany.id);

          suspendCompanyDatabase(affectedCompany.id)
            .then(() => console.log(`[Stripe Webhook] Database suspended for company ${affectedCompany.id}`))
            .catch((err) => console.error(`[Stripe Webhook] Suspend failed for ${affectedCompany.id}:`, err));
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const parentSub = invoice.parent?.subscription_details?.subscription;
        const paidSubId = typeof parentSub === "string" ? parentSub : parentSub?.id || "";
        if (paidSubId) {
          const { data: paidCompany } = await supabaseAdmin
            .from("companies")
            .select("id")
            .eq("stripe_subscription_id", paidSubId)
            .single();
          if (paidCompany) {
            await supabaseAdmin
              .from("companies")
              .update({ subscription_status: "active" })
              .eq("id", paidCompany.id);
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const failedInvoice = event.data.object as Stripe.Invoice;
        const failedParentSub = failedInvoice.parent?.subscription_details?.subscription;
        const failedSubId = typeof failedParentSub === "string" ? failedParentSub : failedParentSub?.id || "";
        if (failedSubId) {
          const { data: failedCompany } = await supabaseAdmin
            .from("companies")
            .select("id")
            .eq("stripe_subscription_id", failedSubId)
            .single();
          if (failedCompany) {
            await supabaseAdmin
              .from("companies")
              .update({ subscription_status: "past_due" })
              .eq("id", failedCompany.id);
          }
        }
        break;
      }

      default:
        // Unhandled event type
        break;
    }
  } catch (err) {
    console.error("[Stripe Webhook] Handler error:", err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
