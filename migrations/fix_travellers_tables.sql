-- Migration: Fix travellers tables for order system
-- Run this in Supabase SQL Editor
-- 
-- PROBLEM: order_service_travellers references non-existent client_travellers table
-- SOLUTION: 
--   1. Drop old table with broken FK
--   2. Create order_travellers (travellers at order level)
--   3. Recreate order_service_travellers with FK to party

-- ============================================
-- 1. DROP OLD TABLE WITH BROKEN FK
-- ============================================

DROP TABLE IF EXISTS public.order_service_travellers CASCADE;

-- ============================================
-- 2. CREATE order_travellers
-- Travellers attached to the order (main client + companions)
-- ============================================

CREATE TABLE IF NOT EXISTS public.order_travellers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id),
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    party_id uuid NOT NULL REFERENCES public.party(id) ON DELETE CASCADE,
    is_main_client boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(order_id, party_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_order_travellers_order_id 
ON public.order_travellers(order_id);

CREATE INDEX IF NOT EXISTS idx_order_travellers_party_id 
ON public.order_travellers(party_id);

CREATE INDEX IF NOT EXISTS idx_order_travellers_company_id 
ON public.order_travellers(company_id);

-- ============================================
-- 3. CREATE order_service_travellers (junction table)
-- Links travellers to specific services within an order
-- ============================================

CREATE TABLE IF NOT EXISTS public.order_service_travellers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id),
    service_id uuid NOT NULL REFERENCES public.order_services(id) ON DELETE CASCADE,
    traveller_id uuid NOT NULL REFERENCES public.party(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    UNIQUE(service_id, traveller_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_order_service_travellers_service_id 
ON public.order_service_travellers(service_id);

CREATE INDEX IF NOT EXISTS idx_order_service_travellers_traveller_id 
ON public.order_service_travellers(traveller_id);

CREATE INDEX IF NOT EXISTS idx_order_service_travellers_company_id 
ON public.order_service_travellers(company_id);

-- ============================================
-- 4. ENABLE RLS
-- ============================================

ALTER TABLE public.order_travellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_service_travellers ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. RLS POLICIES
-- ============================================

-- order_travellers policies
DROP POLICY IF EXISTS "Users can view order travellers of their company" ON public.order_travellers;
CREATE POLICY "Users can view order travellers of their company" 
ON public.order_travellers
FOR SELECT
TO authenticated
USING (
    company_id IN (
        SELECT company_id FROM public.user_profiles 
        WHERE id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can insert order travellers for their company" ON public.order_travellers;
CREATE POLICY "Users can insert order travellers for their company" 
ON public.order_travellers
FOR INSERT
TO authenticated
WITH CHECK (
    company_id IN (
        SELECT company_id FROM public.user_profiles 
        WHERE id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can update order travellers of their company" ON public.order_travellers;
CREATE POLICY "Users can update order travellers of their company" 
ON public.order_travellers
FOR UPDATE
TO authenticated
USING (
    company_id IN (
        SELECT company_id FROM public.user_profiles 
        WHERE id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can delete order travellers of their company" ON public.order_travellers;
CREATE POLICY "Users can delete order travellers of their company" 
ON public.order_travellers
FOR DELETE
TO authenticated
USING (
    company_id IN (
        SELECT company_id FROM public.user_profiles 
        WHERE id = auth.uid()
    )
);

-- order_service_travellers policies
DROP POLICY IF EXISTS "Users can view service travellers of their company" ON public.order_service_travellers;
CREATE POLICY "Users can view service travellers of their company" 
ON public.order_service_travellers
FOR SELECT
TO authenticated
USING (
    company_id IN (
        SELECT company_id FROM public.user_profiles 
        WHERE id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can insert service travellers for their company" ON public.order_service_travellers;
CREATE POLICY "Users can insert service travellers for their company" 
ON public.order_service_travellers
FOR INSERT
TO authenticated
WITH CHECK (
    company_id IN (
        SELECT company_id FROM public.user_profiles 
        WHERE id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can update service travellers of their company" ON public.order_service_travellers;
CREATE POLICY "Users can update service travellers of their company" 
ON public.order_service_travellers
FOR UPDATE
TO authenticated
USING (
    company_id IN (
        SELECT company_id FROM public.user_profiles 
        WHERE id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can delete service travellers of their company" ON public.order_service_travellers;
CREATE POLICY "Users can delete service travellers of their company" 
ON public.order_service_travellers
FOR DELETE
TO authenticated
USING (
    company_id IN (
        SELECT company_id FROM public.user_profiles 
        WHERE id = auth.uid()
    )
);

-- ============================================
-- 6. COMMENTS
-- ============================================

COMMENT ON TABLE public.order_travellers IS 'Travellers attached to an order (main client + companions)';
COMMENT ON COLUMN public.order_travellers.is_main_client IS 'True if this traveller is the main/lead client of the order';

COMMENT ON TABLE public.order_service_travellers IS 'Junction table linking travellers to specific services';
COMMENT ON COLUMN public.order_service_travellers.traveller_id IS 'FK to party table (Person/Client type)';

-- ============================================
-- 7. VERIFICATION
-- ============================================

SELECT 
    'order_travellers' as table_name,
    COUNT(*) as column_count
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'order_travellers'
UNION ALL
SELECT 
    'order_service_travellers' as table_name,
    COUNT(*) as column_count
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'order_service_travellers';
