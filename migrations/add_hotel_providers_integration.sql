-- Hotel providers integration: multi-tenant provider config and hotel_offers provider fields
-- Supports RateHawk, GoGlobal, Booking.com

-- 1. company_hotel_providers: per-company provider configuration
CREATE TABLE IF NOT EXISTS public.company_hotel_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider_name text NOT NULL CHECK (provider_name IN ('ratehawk', 'goglobal', 'booking')),
  enabled boolean NOT NULL DEFAULT true,
  credentials_encrypted text,
  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, provider_name)
);

CREATE INDEX IF NOT EXISTS idx_company_hotel_providers_company_id
  ON public.company_hotel_providers(company_id);
CREATE INDEX IF NOT EXISTS idx_company_hotel_providers_provider_name
  ON public.company_hotel_providers(provider_name);

-- updated_at trigger for company_hotel_providers
CREATE OR REPLACE FUNCTION public.update_company_hotel_providers_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_hotel_providers_updated_at ON public.company_hotel_providers;
CREATE TRIGGER trg_company_hotel_providers_updated_at
BEFORE UPDATE ON public.company_hotel_providers
FOR EACH ROW
EXECUTE FUNCTION public.update_company_hotel_providers_updated_at();

-- 2. hotel_offers: add provider-related columns (idempotent)
ALTER TABLE public.hotel_offers
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'ratehawk'
    CHECK (provider IN ('ratehawk', 'goglobal', 'booking')),
  ADD COLUMN IF NOT EXISTS provider_booking_code text,
  ADD COLUMN IF NOT EXISTS valuation_data jsonb,
  ADD COLUMN IF NOT EXISTS provider_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 3. Indexes on hotel_offers new columns
CREATE INDEX IF NOT EXISTS idx_hotel_offers_provider
  ON public.hotel_offers(provider);
CREATE INDEX IF NOT EXISTS idx_hotel_offers_provider_booking_code
  ON public.hotel_offers(provider_booking_code)
  WHERE provider_booking_code IS NOT NULL;
