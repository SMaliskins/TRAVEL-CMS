-- Migration: Concierge settings on companies table
-- Run in Supabase Dashboard > SQL Editor

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS concierge_hotel_markup numeric(5,2) DEFAULT 0;

COMMENT ON COLUMN public.companies.concierge_hotel_markup
  IS 'Markup percentage applied to hotel prices shown via Concierge (e.g. 15 = 15%)';
