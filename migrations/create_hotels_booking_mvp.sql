-- Hotels Booking MVP
-- Creates dedicated offers table and audit event table for RateHawk-based hotel sales flow.

CREATE TABLE IF NOT EXISTS public.hotel_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  client_party_id uuid REFERENCES public.party(id) ON DELETE SET NULL,
  client_name text,
  client_email text,

  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft',
      'sent',
      'viewed',
      'confirmed',
      'payment_pending',
      'paid',
      'invoice_pending',
      'booking_started',
      'booking_confirmed',
      'booking_failed',
      'cancelled'
    )),
  payment_mode text NOT NULL DEFAULT 'online'
    CHECK (payment_mode IN ('online', 'invoice')),
  payment_status text NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'failed', 'cancelled')),

  hotel_hid integer NOT NULL,
  hotel_name text NOT NULL,
  hotel_address text,
  hotel_stars integer,
  hotel_image_url text,
  room_name text,
  meal text,

  tariff_type text NOT NULL DEFAULT 'refundable'
    CHECK (tariff_type IN ('refundable', 'non_refundable')),
  cancellation_policy text,

  check_in date NOT NULL,
  check_out date NOT NULL,
  guests integer NOT NULL DEFAULT 2,

  currency text NOT NULL DEFAULT 'EUR',
  ratehawk_amount numeric(12,2),
  client_amount numeric(12,2) NOT NULL,
  markup_percent numeric(6,2) NOT NULL DEFAULT 0,

  search_hash text,
  match_hash text,
  book_hash text,
  partner_order_id text UNIQUE,
  ratehawk_order_id integer,

  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,

  confirmation_token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),

  sent_at timestamptz,
  confirmed_at timestamptz,
  paid_at timestamptz,
  booked_at timestamptz,
  cancelled_at timestamptz,

  error_message text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hotel_offers_company_created_at
  ON public.hotel_offers(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hotel_offers_status
  ON public.hotel_offers(status);
CREATE INDEX IF NOT EXISTS idx_hotel_offers_payment_status
  ON public.hotel_offers(payment_status);
CREATE INDEX IF NOT EXISTS idx_hotel_offers_partner_order_id
  ON public.hotel_offers(partner_order_id);
CREATE INDEX IF NOT EXISTS idx_hotel_offers_client_party_id
  ON public.hotel_offers(client_party_id);

CREATE TABLE IF NOT EXISTS public.hotel_offer_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.hotel_offers(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hotel_offer_events_offer_created
  ON public.hotel_offer_events(offer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hotel_offer_events_company_created
  ON public.hotel_offer_events(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hotel_offer_events_type
  ON public.hotel_offer_events(event_type);

CREATE OR REPLACE FUNCTION public.update_hotel_offers_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hotel_offers_updated_at ON public.hotel_offers;
CREATE TRIGGER trg_hotel_offers_updated_at
BEFORE UPDATE ON public.hotel_offers
FOR EACH ROW
EXECUTE FUNCTION public.update_hotel_offers_updated_at();
