-- Migration: Create SuperAdmin System Tables
-- Run this in Supabase SQL Editor
-- This creates the foundation for multi-tenant SaaS management

-- ============================================
-- 1. SUPERADMINS TABLE
-- ============================================
-- Separate from regular users, not tied to any company

CREATE TABLE IF NOT EXISTS public.superadmins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  name text NOT NULL,
  is_active boolean DEFAULT true,
  last_login_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_superadmins_email ON public.superadmins(email);

COMMENT ON TABLE public.superadmins IS 'Super administrators with access to all companies';

-- ============================================
-- 2. MODULES TABLE
-- ============================================
-- Available system modules that can be enabled/disabled per company

CREATE TABLE IF NOT EXISTS public.modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  is_paid boolean DEFAULT false,
  monthly_price_eur numeric(10,2) DEFAULT 0,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Insert default modules
INSERT INTO public.modules (code, name, description, is_paid, monthly_price_eur, sort_order) VALUES
  ('core', 'Core', 'Orders, Services, Directory, Invoices - базовый функционал', false, 0, 1),
  ('ai_parsing', 'AI Parsing', 'Парсинг рейсов и туров из PDF/email через GPT', true, 15, 2),
  ('reports_basic', 'Basic Reports', 'Базовые отчёты и статистика', false, 0, 3),
  ('reports_advanced', 'Advanced Reports', 'PTAC, IATA и расширенные отчёты', true, 20, 4),
  ('accounting', 'Accounting', 'Бухгалтерия и финансовый учёт', true, 25, 5),
  ('notifications', 'Client Notifications', 'SMS/Email уведомления клиентам', true, 10, 6),
  ('ai_agent', 'AI Agent', 'AI помощник для автоматизации задач', true, 30, 7)
ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE public.modules IS 'Available system modules for subscription plans';

-- ============================================
-- 3. SUBSCRIPTION PLANS TABLE
-- ============================================
-- Pricing plans with included modules

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  monthly_price_eur numeric(10,2) NOT NULL DEFAULT 0,
  yearly_price_eur numeric(10,2), -- Optional yearly pricing
  stripe_monthly_price_id text, -- Stripe Price ID for monthly
  stripe_yearly_price_id text, -- Stripe Price ID for yearly
  included_modules text[] NOT NULL DEFAULT '{}', -- Array of module codes
  max_users integer, -- NULL = unlimited
  max_orders_per_month integer, -- NULL = unlimited
  is_active boolean DEFAULT true,
  is_featured boolean DEFAULT false, -- Highlight on pricing page
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Insert default plans
INSERT INTO public.subscription_plans (name, description, monthly_price_eur, included_modules, max_users, is_featured, sort_order) VALUES
  ('Free', 'Для начала работы', 0, ARRAY['core', 'reports_basic'], 2, false, 1),
  ('Starter', 'Для малых агентств', 29, ARRAY['core', 'reports_basic', 'notifications'], 5, false, 2),
  ('Pro', 'Полный функционал', 99, ARRAY['core', 'ai_parsing', 'reports_basic', 'reports_advanced', 'notifications', 'ai_agent'], 20, true, 3),
  ('Enterprise', 'Для крупных компаний', 299, ARRAY['core', 'ai_parsing', 'reports_basic', 'reports_advanced', 'accounting', 'notifications', 'ai_agent'], NULL, false, 4)
ON CONFLICT (name) DO NOTHING;

COMMENT ON TABLE public.subscription_plans IS 'Subscription pricing plans with included modules';

-- ============================================
-- 4. COMPANY SUBSCRIPTIONS TABLE
-- ============================================
-- Active subscriptions for each company

CREATE TABLE IF NOT EXISTS public.company_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'trialing', 'paused')),
  billing_cycle text DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  cancel_at_period_end boolean DEFAULT false,
  canceled_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(company_id) -- One subscription per company
);

CREATE INDEX IF NOT EXISTS idx_company_subscriptions_company ON public.company_subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_company_subscriptions_status ON public.company_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_company_subscriptions_stripe ON public.company_subscriptions(stripe_subscription_id);

COMMENT ON TABLE public.company_subscriptions IS 'Active subscriptions for companies';

-- ============================================
-- 5. COMPANY MODULES TABLE
-- ============================================
-- Override: manually enable/disable specific modules for a company
-- (beyond what their plan includes)

CREATE TABLE IF NOT EXISTS public.company_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  is_enabled boolean DEFAULT true,
  enabled_at timestamp with time zone DEFAULT now(),
  enabled_by uuid, -- superadmin who enabled it
  notes text,
  UNIQUE(company_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_company_modules_company ON public.company_modules(company_id);

COMMENT ON TABLE public.company_modules IS 'Manual module overrides per company';

-- ============================================
-- 6. COMPANY REGISTRATIONS TABLE
-- ============================================
-- Pending company registration requests

CREATE TABLE IF NOT EXISTS public.company_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  
  -- Company information (JSONB for flexibility)
  company_data jsonb NOT NULL DEFAULT '{}',
  -- Expected structure:
  -- {
  --   "name": "Company Name",
  --   "legal_name": "Legal Name Ltd",
  --   "registration_number": "123456",
  --   "vat_number": "LV123456",
  --   "country": "LV",
  --   "address": "Street 1, Riga",
  --   "email": "contact@company.com",
  --   "phone": "+371 12345678"
  -- }
  
  -- Users to create (JSONB array)
  users_data jsonb NOT NULL DEFAULT '[]',
  -- Expected structure:
  -- [
  --   { "email": "admin@company.com", "name": "John Doe", "role": "supervisor" },
  --   { "email": "agent@company.com", "name": "Jane Doe", "role": "agent" }
  -- ]
  
  selected_plan_id uuid REFERENCES public.subscription_plans(id),
  
  -- Audit
  submitted_at timestamp with time zone DEFAULT now(),
  reviewed_at timestamp with time zone,
  reviewed_by uuid REFERENCES public.superadmins(id),
  rejection_reason text,
  
  -- Result
  created_company_id uuid REFERENCES public.companies(id)
);

CREATE INDEX IF NOT EXISTS idx_company_registrations_status ON public.company_registrations(status);
CREATE INDEX IF NOT EXISTS idx_company_registrations_submitted ON public.company_registrations(submitted_at DESC);

COMMENT ON TABLE public.company_registrations IS 'Pending company registration requests';

-- ============================================
-- 7. DEMO SIGNUPS TABLE
-- ============================================
-- Quick demo signups from landing page

CREATE TABLE IF NOT EXISTS public.demo_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text,
  company_name text,
  
  -- Created demo company
  demo_company_id uuid REFERENCES public.companies(id),
  demo_user_id uuid, -- The created demo user
  
  -- Demo period
  created_at timestamp with time zone DEFAULT now(),
  demo_expires_at timestamp with time zone DEFAULT (now() + interval '3 days'),
  
  -- Conversion tracking
  converted_to_paid boolean DEFAULT false,
  converted_at timestamp with time zone,
  
  -- Follow-up tracking
  followup_emails jsonb DEFAULT '{}',
  -- { "day1_sent": "2024-01-01T10:00:00Z", "day2_sent": null, ... }
  
  -- Source tracking
  utm_source text,
  utm_medium text,
  utm_campaign text
);

CREATE INDEX IF NOT EXISTS idx_demo_signups_email ON public.demo_signups(email);
CREATE INDEX IF NOT EXISTS idx_demo_signups_expires ON public.demo_signups(demo_expires_at);
CREATE INDEX IF NOT EXISTS idx_demo_signups_converted ON public.demo_signups(converted_to_paid);

COMMENT ON TABLE public.demo_signups IS 'Demo signups from landing page with 3-day trial';

-- ============================================
-- 8. ADD is_demo COLUMN TO COMPANIES
-- ============================================
-- Mark demo companies for easy filtering

ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS is_demo boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS demo_expires_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_companies_is_demo ON public.companies(is_demo) WHERE is_demo = true;

-- ============================================
-- 9. HELPER FUNCTION: Check if company has module
-- ============================================

CREATE OR REPLACE FUNCTION public.company_has_module(p_company_id uuid, p_module_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_module boolean := false;
  v_plan_modules text[];
  v_override_enabled boolean;
BEGIN
  -- Check manual override first
  SELECT cm.is_enabled INTO v_override_enabled
  FROM public.company_modules cm
  JOIN public.modules m ON m.id = cm.module_id
  WHERE cm.company_id = p_company_id AND m.code = p_module_code;
  
  IF v_override_enabled IS NOT NULL THEN
    RETURN v_override_enabled;
  END IF;
  
  -- Check subscription plan
  SELECT sp.included_modules INTO v_plan_modules
  FROM public.company_subscriptions cs
  JOIN public.subscription_plans sp ON sp.id = cs.plan_id
  WHERE cs.company_id = p_company_id AND cs.status IN ('active', 'trialing');
  
  IF v_plan_modules IS NOT NULL THEN
    RETURN p_module_code = ANY(v_plan_modules);
  END IF;
  
  -- Default: only core module
  RETURN p_module_code = 'core';
END;
$$;

COMMENT ON FUNCTION public.company_has_module IS 'Check if company has access to a specific module';

-- ============================================
-- 10. RLS POLICIES
-- ============================================

-- Superadmins table - no RLS, accessed only via service role
ALTER TABLE public.superadmins ENABLE ROW LEVEL SECURITY;

-- Modules - readable by all authenticated
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Modules are readable by all" ON public.modules FOR SELECT USING (true);

-- Subscription plans - readable by all
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plans are readable by all" ON public.subscription_plans FOR SELECT USING (true);

-- Company subscriptions - only own company
ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own company subscription" ON public.company_subscriptions FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

-- Company modules - only own company
ALTER TABLE public.company_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own company modules" ON public.company_modules FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

-- Company registrations - no public access, only superadmins via service role
ALTER TABLE public.company_registrations ENABLE ROW LEVEL SECURITY;

-- Demo signups - no public access
ALTER TABLE public.demo_signups ENABLE ROW LEVEL SECURITY;
