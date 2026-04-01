-- Migration: AI usage limits per tariff plan
-- Run this in Supabase SQL Editor
-- Date: 2026-03-14

-- 1. Add ai_calls_limit to tariff_plans (NULL = unlimited)
ALTER TABLE public.tariff_plans
  ADD COLUMN IF NOT EXISTS ai_calls_monthly integer;

COMMENT ON COLUMN public.tariff_plans.ai_calls_monthly IS 'Monthly AI call limit. NULL = unlimited.';

-- 2. Set limits per plan
UPDATE public.tariff_plans SET ai_calls_monthly = 10  WHERE slug = 'trial';
UPDATE public.tariff_plans SET ai_calls_monthly = 50  WHERE slug = 'starter';
UPDATE public.tariff_plans SET ai_calls_monthly = 300 WHERE slug = 'professional';
UPDATE public.tariff_plans SET ai_calls_monthly = NULL WHERE slug = 'enterprise';

-- 3. Add ai_calls_extra from AI add-ons (when purchased, grants extra calls)
-- ai_parsing add-on grants +200 calls/month
-- ai_concierge add-on grants +500 messages/month
ALTER TABLE public.plan_addons
  ADD COLUMN IF NOT EXISTS ai_calls_bonus integer NOT NULL DEFAULT 0;

UPDATE public.plan_addons SET ai_calls_bonus = 200 WHERE slug = 'ai_parsing';
UPDATE public.plan_addons SET ai_calls_bonus = 500 WHERE slug = 'ai_concierge';

-- 4. Function to check if company can make AI calls
CREATE OR REPLACE FUNCTION public.check_ai_usage_limit(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan_limit integer;
  v_addon_bonus integer;
  v_total_limit integer;
  v_used integer;
  v_month_start timestamptz;
BEGIN
  v_month_start := date_trunc('month', now());

  -- Get plan limit
  SELECT tp.ai_calls_monthly INTO v_plan_limit
  FROM public.companies c
  JOIN public.tariff_plans tp ON tp.id = c.tariff_plan_id
  WHERE c.id = p_company_id;

  -- NULL means unlimited
  IF v_plan_limit IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'limit', -1, 'used', 0, 'remaining', -1);
  END IF;

  -- Get bonus from active add-ons
  SELECT COALESCE(SUM(pa.ai_calls_bonus * ca.quantity), 0) INTO v_addon_bonus
  FROM public.company_addons ca
  JOIN public.plan_addons pa ON pa.id = ca.addon_id
  WHERE ca.company_id = p_company_id AND ca.is_active = true;

  v_total_limit := v_plan_limit + v_addon_bonus;

  -- Count usage this month
  SELECT COUNT(*) INTO v_used
  FROM public.ai_usage_log
  WHERE company_id = p_company_id
    AND created_at >= v_month_start;

  RETURN jsonb_build_object(
    'allowed', v_used < v_total_limit,
    'limit', v_total_limit,
    'used', v_used,
    'remaining', GREATEST(0, v_total_limit - v_used)
  );
END;
$$;
