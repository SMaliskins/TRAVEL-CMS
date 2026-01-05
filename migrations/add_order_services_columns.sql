-- Migration: Add missing columns to order_services for full functionality
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. ADD NEW COLUMNS TO order_services
-- ============================================

-- Category as text (simpler than FK for now)
ALTER TABLE public.order_services 
ADD COLUMN IF NOT EXISTS category text;

-- Party references (from Directory)
ALTER TABLE public.order_services 
ADD COLUMN IF NOT EXISTS supplier_party_id uuid REFERENCES public.party(id);

ALTER TABLE public.order_services 
ADD COLUMN IF NOT EXISTS client_party_id uuid REFERENCES public.party(id);

ALTER TABLE public.order_services 
ADD COLUMN IF NOT EXISTS payer_party_id uuid REFERENCES public.party(id);

-- Denormalized names for display
ALTER TABLE public.order_services 
ADD COLUMN IF NOT EXISTS supplier_name text;

ALTER TABLE public.order_services 
ADD COLUMN IF NOT EXISTS client_name text;

ALTER TABLE public.order_services 
ADD COLUMN IF NOT EXISTS payer_name text;

-- Pricing
ALTER TABLE public.order_services 
ADD COLUMN IF NOT EXISTS service_price numeric(12,2) DEFAULT 0;

ALTER TABLE public.order_services 
ADD COLUMN IF NOT EXISTS client_price numeric(12,2) DEFAULT 0;

-- Reservation status with proper values
ALTER TABLE public.order_services 
ADD COLUMN IF NOT EXISTS res_status text DEFAULT 'booked';

-- Add CHECK constraint for res_status (drop if exists first)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'order_services_res_status_check'
    ) THEN
        ALTER TABLE public.order_services 
        ADD CONSTRAINT order_services_res_status_check 
        CHECK (res_status IN ('booked', 'confirmed', 'changed', 'rejected', 'cancelled'));
    END IF;
END $$;

-- Reference numbers
ALTER TABLE public.order_services 
ADD COLUMN IF NOT EXISTS ref_nr text;

ALTER TABLE public.order_services 
ADD COLUMN IF NOT EXISTS ticket_nr text;

-- ============================================
-- 2. CREATE SERVICE-TRAVELLER JUNCTION TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.order_service_travellers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id),
    service_id uuid NOT NULL REFERENCES public.order_services(id) ON DELETE CASCADE,
    traveller_id uuid NOT NULL REFERENCES public.client_travellers(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    UNIQUE(service_id, traveller_id)
);

-- Index for junction table
CREATE INDEX IF NOT EXISTS idx_order_service_travellers_service_id 
ON public.order_service_travellers(service_id);

CREATE INDEX IF NOT EXISTS idx_order_service_travellers_traveller_id 
ON public.order_service_travellers(traveller_id);

-- ============================================
-- 3. ADD INDEXES FOR NEW COLUMNS
-- ============================================

CREATE INDEX IF NOT EXISTS idx_order_services_category 
ON public.order_services(category) WHERE category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_services_supplier_party_id 
ON public.order_services(supplier_party_id) WHERE supplier_party_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_services_res_status 
ON public.order_services(res_status) WHERE res_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_services_date_from 
ON public.order_services(service_date_from) WHERE service_date_from IS NOT NULL;

-- ============================================
-- 4. RLS POLICIES (if RLS enabled)
-- ============================================

-- Enable RLS
ALTER TABLE public.order_service_travellers ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users
CREATE POLICY IF NOT EXISTS "Allow all for authenticated" 
ON public.order_service_travellers
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN public.order_services.category IS 'Service type: Flight, Hotel, Transfer, Tour, Insurance, Visa, Other';
COMMENT ON COLUMN public.order_services.supplier_party_id IS 'FK to party table for supplier';
COMMENT ON COLUMN public.order_services.client_party_id IS 'FK to party table for service client';
COMMENT ON COLUMN public.order_services.payer_party_id IS 'FK to party table for payer';
COMMENT ON COLUMN public.order_services.service_price IS 'Cost price from supplier';
COMMENT ON COLUMN public.order_services.client_price IS 'Sell price to client';
COMMENT ON COLUMN public.order_services.res_status IS 'Reservation status: booked, confirmed, changed, rejected, cancelled';
COMMENT ON COLUMN public.order_services.ref_nr IS 'Supplier booking reference';
COMMENT ON COLUMN public.order_services.ticket_nr IS 'Ticket number (for flights)';
