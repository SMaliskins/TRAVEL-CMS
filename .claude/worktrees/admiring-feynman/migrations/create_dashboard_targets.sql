-- Migration: Create dashboard_targets table for Target settings
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. CREATE dashboard_targets TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.dashboard_targets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL = для всего офиса
    office_id uuid REFERENCES public.offices(id) ON DELETE SET NULL, -- NULL = для всего company
    target_amount numeric(12,2) NOT NULL DEFAULT 0,
    target_period text NOT NULL DEFAULT 'monthly', -- 'monthly', 'quarterly', 'yearly'
    period_start date NOT NULL, -- начало периода
    period_end date NOT NULL, -- конец периода
    created_by uuid NOT NULL REFERENCES auth.users(id), -- директор, который создал таргет
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT dashboard_targets_unique UNIQUE(company_id, user_id, office_id, target_period, period_start),
    CONSTRAINT dashboard_targets_period_check CHECK (period_end > period_start),
    CONSTRAINT dashboard_targets_target_period_check CHECK (target_period IN ('monthly', 'quarterly', 'yearly'))
);

-- ============================================
-- 2. ADD COMMENTS
-- ============================================

COMMENT ON TABLE public.dashboard_targets IS 'Target settings for agents and offices (set by director)';
COMMENT ON COLUMN public.dashboard_targets.user_id IS 'NULL = target for entire office/company';
COMMENT ON COLUMN public.dashboard_targets.office_id IS 'NULL = target for entire company';
COMMENT ON COLUMN public.dashboard_targets.target_period IS 'monthly, quarterly, yearly';
COMMENT ON COLUMN public.dashboard_targets.period_start IS 'Start date of target period';
COMMENT ON COLUMN public.dashboard_targets.period_end IS 'End date of target period';
COMMENT ON COLUMN public.dashboard_targets.target_amount IS 'Target amount in EUR';

-- ============================================
-- 3. CREATE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_dashboard_targets_company_id 
ON public.dashboard_targets(company_id) WHERE company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dashboard_targets_user_id 
ON public.dashboard_targets(user_id) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dashboard_targets_office_id 
ON public.dashboard_targets(office_id) WHERE office_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dashboard_targets_period 
ON public.dashboard_targets(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_dashboard_targets_target_period 
ON public.dashboard_targets(target_period) WHERE target_period IS NOT NULL;

-- ============================================
-- 4. ENABLE RLS
-- ============================================

ALTER TABLE public.dashboard_targets ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. RLS POLICIES
-- ============================================

-- Policy: Users can read targets for their company
DROP POLICY IF EXISTS "Users can read targets for their company" ON public.dashboard_targets;
CREATE POLICY "Users can read targets for their company" 
ON public.dashboard_targets FOR SELECT
TO authenticated
USING (
    company_id IN (
        SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
    )
);

-- Policy: Only directors/admins can create/update targets
DROP POLICY IF EXISTS "Directors can manage targets" ON public.dashboard_targets;
CREATE POLICY "Directors can manage targets" 
ON public.dashboard_targets FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() 
        AND role IN ('director', 'admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() 
        AND role IN ('director', 'admin')
    )
);

-- ============================================
-- 6. CREATE TRIGGER FOR updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_dashboard_targets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_dashboard_targets_updated_at ON public.dashboard_targets;
CREATE TRIGGER trigger_update_dashboard_targets_updated_at
    BEFORE UPDATE ON public.dashboard_targets
    FOR EACH ROW
    EXECUTE FUNCTION update_dashboard_targets_updated_at();

