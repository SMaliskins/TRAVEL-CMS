-- Migration: Update tariff plans to final pricing + add add-ons system
-- Run this in Supabase SQL Editor
-- Date: 2026-03-13

-- ============================================
-- 1. UPDATE EXISTING PLANS to final EUR pricing
-- ============================================

-- Delete old seed data
DELETE FROM public.tariff_plans WHERE slug IN ('starter', 'business', 'enterprise');

-- Insert updated plans
INSERT INTO public.tariff_plans (name, slug, description, price_monthly, price_yearly, storage_limit_gb, db_limit_gb, orders_limit, users_limit, supabase_plan, sort_order, features)
VALUES
  ('Trial', 'trial', '7-day free trial — explore TravelCMS with full access', 0, 0, 0.5, 0.5, 50, 1, 'shared', 0,
   '{"trial_days": 7, "invoices": true, "finances": true, "boarding_passes": true, "dashboard_analytics": true, "white_label": true, "branding": "custom", "priority_support": true}'),

  ('Starter', 'starter', 'Essential tools for a solo travel agent', 39, 390, 2, 1, NULL, 1, 'shared', 1,
   '{"invoices": true, "finances": true, "boarding_passes": false, "dashboard_analytics": false, "white_label": false, "branding": "powered_by"}'),

  ('Professional', 'professional', 'For growing agencies with a small team', 79, 790, 10, 2, NULL, 2, 'shared', 2,
   '{"invoices": true, "finances": true, "boarding_passes": true, "dashboard_analytics": true, "white_label": true, "branding": "custom"}'),

  ('Enterprise', 'enterprise', 'Full-featured platform for established agencies', 149, 1490, 50, 8, NULL, NULL, 'pro', 3,
   '{"invoices": true, "finances": true, "boarding_passes": true, "dashboard_analytics": true, "white_label": true, "branding": "custom", "priority_support": true}')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  storage_limit_gb = EXCLUDED.storage_limit_gb,
  db_limit_gb = EXCLUDED.db_limit_gb,
  orders_limit = EXCLUDED.orders_limit,
  users_limit = EXCLUDED.users_limit,
  supabase_plan = EXCLUDED.supabase_plan,
  sort_order = EXCLUDED.sort_order,
  features = EXCLUDED.features;

-- ============================================
-- 2. ADD-ONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.plan_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  price_monthly numeric(10,2) NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'feature',
  unit_label text,
  stripe_product_id text,
  stripe_price_id text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.plan_addons IS 'Add-on features that can be purchased on top of any tariff plan.';
COMMENT ON COLUMN public.plan_addons.category IS 'Category: feature, communication, ai, storage, integration';
COMMENT ON COLUMN public.plan_addons.unit_label IS 'Label for per-unit pricing, e.g. "per user", "per 5 GB"';

-- Seed add-ons
INSERT INTO public.plan_addons (name, slug, description, price_monthly, category, unit_label, sort_order)
VALUES
  -- Communication
  ('Invoice Mailing',     'invoice_mailing',     'Auto-send invoices to clients via email',              9,  'communication', NULL, 1),
  ('Payment Reminders',   'payment_reminders',   'Automated payment reminder emails to clients',         9,  'communication', NULL, 2),
  ('Email Templates',     'email_templates',     'Custom email templates for hotels, clients, reminders', 9,  'communication', NULL, 3),
  ('SMS Notifications',   'sms_notifications',   'SMS alerts to clients (check-in, changes, reminders)', 12, 'communication', NULL, 4),

  -- Client-facing
  ('Client App',          'client_app',          'Mobile app for clients: bookings, documents, chat',    19, 'feature', NULL, 5),
  ('White Label',         'white_label',         'Your brand on invoices, emails, and documents',        15, 'feature', NULL, 6),

  -- AI
  ('AI Flight Parsing',   'ai_parsing',          'Smart flight ticket parsing with self-learning',       14, 'ai', NULL, 7),
  ('AI Concierge',        'ai_concierge',        'AI-powered travel assistant for your clients',         29, 'ai', NULL, 8),

  -- Infrastructure
  ('Dedicated Database',  'dedicated_db',        'Fully isolated Supabase project for your agency',      25, 'infrastructure', NULL, 9),
  ('Extra Storage',       'extra_storage',       'Additional file storage capacity',                      5, 'storage', 'per 5 GB', 10),
  ('Extra Users',         'extra_users',         'Additional user seats beyond plan limit',               5, 'storage', 'per user', 11),

  -- Integrations
  ('Hotel Booking (RateHawk)', 'hotel_booking',  'Direct hotel booking via RateHawk API',                19, 'integration', NULL, 12),
  ('API Access',          'api_access',          'REST API for integration with external systems',        29, 'integration', NULL, 13),
  ('Custom Domain',       'custom_domain',       'Your own domain for Client App (app.youragency.com)',  15, 'integration', NULL, 14)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- 3. COMPANY ADD-ONS (active add-ons per company)
-- ============================================

CREATE TABLE IF NOT EXISTS public.company_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  addon_id uuid NOT NULL REFERENCES public.plan_addons(id),
  quantity integer NOT NULL DEFAULT 1,
  stripe_subscription_item_id text,
  is_active boolean NOT NULL DEFAULT true,
  activated_at timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz,
  UNIQUE(company_id, addon_id)
);

CREATE INDEX IF NOT EXISTS idx_company_addons_company_id ON public.company_addons(company_id);

COMMENT ON TABLE public.company_addons IS 'Tracks which add-ons each company has activated.';

-- ============================================
-- 4. ADD trial_ends_at TO COMPANIES
-- ============================================

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

COMMENT ON COLUMN public.companies.trial_ends_at IS 'When the free trial expires. After this date, payment is required.';

-- ============================================
-- 5. RLS POLICIES
-- ============================================

ALTER TABLE public.plan_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_addons_read_all" ON public.plan_addons FOR SELECT USING (true);

CREATE POLICY "company_addons_read_own" ON public.company_addons FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()));
