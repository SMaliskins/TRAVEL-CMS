-- Migration: Add Stripe Price IDs to subscription_plans
-- Run this AFTER creating Products and Prices in Stripe Dashboard
--
-- Steps:
-- 1. Go to https://dashboard.stripe.com/products
-- 2. Create a Product for each plan (e.g. "TravelCMS Starter", "TravelCMS Pro", "TravelCMS Enterprise")
-- 3. Add a recurring Price (monthly) to each Product
-- 4. Copy the Price IDs (they start with price_)
-- 5. Run the UPDATE statements below with your actual Price IDs
--
-- Example:
-- UPDATE subscription_plans SET stripe_monthly_price_id = 'price_1ABC123...' WHERE name = 'Starter';
-- UPDATE subscription_plans SET stripe_monthly_price_id = 'price_1DEF456...' WHERE name = 'Pro';
-- UPDATE subscription_plans SET stripe_monthly_price_id = 'price_1GHI789...' WHERE name = 'Enterprise';

-- Placeholder updates - replace with your actual Stripe Price IDs
-- UPDATE subscription_plans SET stripe_monthly_price_id = 'price_xxx' WHERE name = 'Starter';
-- UPDATE subscription_plans SET stripe_monthly_price_id = 'price_xxx' WHERE name = 'Pro';
-- UPDATE subscription_plans SET stripe_monthly_price_id = 'price_xxx' WHERE name = 'Enterprise';

-- Verify columns exist (from create_superadmin_system.sql)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'subscription_plans'
    AND column_name = 'stripe_monthly_price_id'
  ) THEN
    ALTER TABLE public.subscription_plans ADD COLUMN stripe_monthly_price_id text;
  END IF;
END $$;

COMMENT ON COLUMN public.subscription_plans.stripe_monthly_price_id IS 'Stripe Price ID for monthly billing - set after creating Product in Stripe Dashboard';
