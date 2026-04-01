-- Migration: Multi-tenant Supabase — separate database per agency
-- Run this in Supabase SQL Editor (master database)
-- Date: 2026-03-13

-- ============================================
-- 1. TARIFF PLANS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.tariff_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  price_monthly numeric(10,2) NOT NULL DEFAULT 0,
  price_yearly numeric(10,2) NOT NULL DEFAULT 0,
  storage_limit_gb numeric(10,2) NOT NULL DEFAULT 0.5,
  db_limit_gb numeric(10,2) NOT NULL DEFAULT 0.5,
  orders_limit integer,
  users_limit integer,
  supabase_plan text NOT NULL DEFAULT 'free',
  stripe_product_id text,
  stripe_price_id_monthly text,
  stripe_price_id_yearly text,
  features jsonb DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tariff_plans IS 'Platform tariff plans for agencies. Each plan maps to a Supabase tier and Stripe pricing.';
COMMENT ON COLUMN public.tariff_plans.supabase_plan IS 'Which Supabase tier to provision: free or pro';
COMMENT ON COLUMN public.tariff_plans.orders_limit IS 'Max orders allowed. NULL = unlimited';
COMMENT ON COLUMN public.tariff_plans.users_limit IS 'Max users allowed. NULL = unlimited';

-- Seed default plans
INSERT INTO public.tariff_plans (name, slug, description, price_monthly, price_yearly, storage_limit_gb, db_limit_gb, orders_limit, users_limit, supabase_plan, sort_order, features)
VALUES
  ('Starter', 'starter', 'Shared database, perfect for getting started', 0, 0, 0.5, 0.5, 50, 3, 'shared', 1, '{"shared_db": true, "ai_parsing": false, "email_templates": false}'),
  ('Business', 'business', 'Own database with full isolation and unlimited orders', 39, 390, 1, 1, NULL, 10, 'free', 2, '{"shared_db": false, "ai_parsing": true, "email_templates": true}'),
  ('Enterprise', 'enterprise', 'Premium storage, priority support, all features', 99, 990, 100, 8, NULL, NULL, 'pro', 3, '{"shared_db": false, "ai_parsing": true, "email_templates": true, "priority_support": true, "custom_domain": true}')
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- 2. COMPANIES TABLE — Supabase + billing fields
-- ============================================

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS tariff_plan_id uuid REFERENCES public.tariff_plans(id);
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS supabase_project_ref text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS supabase_url text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS supabase_anon_key text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS supabase_service_role_key text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS supabase_configured boolean NOT NULL DEFAULT false;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS supabase_status text NOT NULL DEFAULT 'none' CHECK (supabase_status IN ('none', 'provisioning', 'active', 'paused', 'archived'));
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS supabase_region text DEFAULT 'eu-central-1';

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'none' CHECK (subscription_status IN ('none', 'active', 'past_due', 'cancelled', 'paused'));
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz;

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS storage_used_bytes bigint NOT NULL DEFAULT 0;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS storage_checked_at timestamptz;

COMMENT ON COLUMN public.companies.supabase_project_ref IS 'Supabase project ref for Management API operations';
COMMENT ON COLUMN public.companies.supabase_url IS 'Supabase project URL (encrypted at app level)';
COMMENT ON COLUMN public.companies.supabase_anon_key IS 'Supabase anon key (encrypted at app level)';
COMMENT ON COLUMN public.companies.supabase_service_role_key IS 'Supabase service role key (encrypted at app level)';
COMMENT ON COLUMN public.companies.supabase_status IS 'Lifecycle: none -> provisioning -> active -> paused -> archived';
COMMENT ON COLUMN public.companies.subscription_status IS 'Stripe subscription status mirror';

-- ============================================
-- 3. COMPANY USERS MAPPING (email -> company for login routing)
-- ============================================

CREATE TABLE IF NOT EXISTS public.company_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(email)
);

CREATE INDEX IF NOT EXISTS idx_company_users_email ON public.company_users(email);
CREATE INDEX IF NOT EXISTS idx_company_users_company_id ON public.company_users(company_id);

COMMENT ON TABLE public.company_users IS 'Maps user emails to companies for login routing. Updated on user creation/invitation.';

-- ============================================
-- 4. STORAGE USAGE LOG
-- ============================================

CREATE TABLE IF NOT EXISTS public.storage_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  checked_at timestamptz NOT NULL DEFAULT now(),
  storage_used_bytes bigint NOT NULL DEFAULT 0,
  storage_limit_bytes bigint NOT NULL DEFAULT 0,
  db_size_bytes bigint NOT NULL DEFAULT 0,
  usage_percent numeric(5,2) NOT NULL DEFAULT 0,
  alert_sent boolean NOT NULL DEFAULT false,
  alert_level text CHECK (alert_level IN ('none', 'warning_80', 'warning_90', 'critical_100'))
);

CREATE INDEX IF NOT EXISTS idx_storage_usage_log_company_id ON public.storage_usage_log(company_id);
CREATE INDEX IF NOT EXISTS idx_storage_usage_log_checked_at ON public.storage_usage_log(checked_at);

COMMENT ON TABLE public.storage_usage_log IS 'Daily storage and DB usage snapshots per company. Used for billing alerts and usage dashboards.';

-- ============================================
-- 5. RLS POLICIES
-- ============================================

ALTER TABLE public.tariff_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tariff_plans_read_all" ON public.tariff_plans FOR SELECT USING (true);

CREATE POLICY "company_users_read_own" ON public.company_users FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()));

CREATE POLICY "storage_usage_log_read_own" ON public.storage_usage_log FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()));
