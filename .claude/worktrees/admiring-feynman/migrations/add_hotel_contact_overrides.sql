-- Migration: Hotel Contact Overrides + hotel_hid in order_services
-- Saves our corrected hotel contacts (email, phone, address) when RateHawk data is outdated
-- Run this in Supabase SQL Editor

-- 1. Add hotel_hid to order_services (RateHawk hotel ID)
ALTER TABLE public.order_services
ADD COLUMN IF NOT EXISTS hotel_hid integer;

COMMENT ON COLUMN public.order_services.hotel_hid IS 'RateHawk hotel ID (hid) for contact overrides lookup';

-- 2. Create hotel_contact_overrides table
CREATE TABLE IF NOT EXISTS public.hotel_contact_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  hotel_hid integer NOT NULL,
  hotel_name text NOT NULL,
  email text,
  phone text,
  address text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, hotel_hid)
);

CREATE INDEX IF NOT EXISTS idx_hotel_contact_overrides_company_hid
  ON public.hotel_contact_overrides(company_id, hotel_hid);

ALTER TABLE public.hotel_contact_overrides ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent - safe to re-run)
DROP POLICY IF EXISTS hotel_contact_overrides_company ON public.hotel_contact_overrides;
DROP POLICY IF EXISTS hotel_contact_overrides_insert ON public.hotel_contact_overrides;
DROP POLICY IF EXISTS hotel_contact_overrides_update ON public.hotel_contact_overrides;

-- RLS: users see only their company's overrides
CREATE POLICY hotel_contact_overrides_company
  ON public.hotel_contact_overrides
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- Allow insert/update for users in same company
CREATE POLICY hotel_contact_overrides_insert
  ON public.hotel_contact_overrides
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY hotel_contact_overrides_update
  ON public.hotel_contact_overrides
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.hotel_contact_overrides IS 'Our corrected hotel contacts when RateHawk data is outdated. Used when selecting hotel from RateHawk.';

-- 3. Drop hotel_board CHECK constraint to allow UAI and free text from RateHawk
ALTER TABLE public.order_services DROP CONSTRAINT IF EXISTS order_services_hotel_board_check;
