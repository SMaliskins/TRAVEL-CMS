-- Migration: Add Stripe Price IDs to subscription_plans
-- Run this AFTER creating Products and Prices in Stripe Dashboard
--
-- Steps:
-- 1. Go to https://dashboard.stripe.com/products
-- 2. Create a Product for each paid plan (Starter, Pro, Enterprise)
-- 3. Add a recurring Price (monthly) to each Product
-- 4. Copy the Price IDs (they start with price_)
-- 5. Run the UPDATE statements below with your actual Price IDs
--
-- Example Stripe setup:
--   Product: "Starter Plan" -> Price: €29/month -> price_xxx
--   Product: "Pro Plan" -> Price: €99/month -> price_xxx
--   Product: "Enterprise Plan" -> Price: €299/month -> price_xxx
--
-- Free plan has no Stripe Price ID (activated manually)

-- Add column if not exists (already in create_superadmin_system.sql)
ALTER TABLE public.subscription_plans
ADD COLUMN IF NOT EXISTS stripe_monthly_price_id text,
ADD COLUMN IF NOT EXISTS stripe_yearly_price_id text;

-- Update with your Stripe Price IDs after creating them in Stripe Dashboard
-- Replace price_xxx with actual IDs from Stripe

-- UPDATE public.subscription_plans SET stripe_monthly_price_id = 'price_xxx' WHERE name = 'Starter';
-- UPDATE public.subscription_plans SET stripe_monthly_price_id = 'price_xxx' WHERE name = 'Pro';
-- UPDATE public.subscription_plans SET stripe_monthly_price_id = 'price_xxx' WHERE name = 'Enterprise';

-- Comment: Run the UPDATE statements above after creating Products/Prices in Stripe.
-- Free plan is left with NULL stripe_monthly_price_id.
--
-- Environment variables required:
--   STRIPE_SECRET_KEY=sk_live_xxx or sk_test_xxx
--   STRIPE_WEBHOOK_SECRET=whsec_xxx (from Stripe Dashboard -> Webhooks -> Add endpoint)
--   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_xxx (optional, for client-side)
--
-- Webhook setup:
--   1. Stripe Dashboard -> Developers -> Webhooks -> Add endpoint
--   2. URL: https://your-domain.com/api/stripe/webhook
--   3. Events: checkout.session.completed, customer.subscription.updated,
--      customer.subscription.deleted, invoice.payment_failed
--   4. Copy Signing secret to STRIPE_WEBHOOK_SECRET
--
-- Local development: stripe listen --forward-to localhost:3000/api/stripe/webhook
