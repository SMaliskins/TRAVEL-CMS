-- Migration: concierge_booking_requests
-- Stores hotel booking requests initiated through the Concierge AI chat.
-- Tracks the full lifecycle: selection → prebook → payment → confirmation.

CREATE TABLE IF NOT EXISTS concierge_booking_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  session_id UUID REFERENCES concierge_sessions(id) ON DELETE SET NULL,

  -- Status lifecycle
  status TEXT NOT NULL DEFAULT 'pending_selection'
    CHECK (status IN (
      'pending_selection',   -- AI showed options, client selected one
      'prebooked',           -- RateHawk prebook confirmed availability
      'payment_pending',     -- Stripe checkout session created
      'paid',                -- Stripe payment received
      'booking_confirmed',   -- RateHawk booking finished successfully
      'booking_failed',      -- RateHawk booking failed after payment
      'cancelled',           -- Client or system cancelled
      'refunded'             -- Payment refunded
    )),

  -- Hotel details
  hotel_hid INTEGER NOT NULL,
  hotel_name TEXT NOT NULL,
  hotel_address TEXT,
  hotel_stars INTEGER,
  hotel_image_url TEXT,

  -- Booking dates & guests
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  guests INTEGER NOT NULL DEFAULT 2,

  -- Selected rate details
  room_name TEXT,
  meal TEXT,
  match_hash TEXT,
  book_hash TEXT,
  search_hash TEXT,

  -- Pricing
  ratehawk_amount NUMERIC(12,2),
  ratehawk_currency TEXT DEFAULT 'EUR',
  client_amount NUMERIC(12,2) NOT NULL,
  client_currency TEXT DEFAULT 'EUR',
  markup_percent NUMERIC(5,2) DEFAULT 0,

  -- RateHawk booking references
  partner_order_id TEXT UNIQUE,
  ratehawk_order_id INTEGER,

  -- Stripe payment references
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,

  -- Guest info (filled at booking step)
  guest_first_name TEXT,
  guest_last_name TEXT,
  guest_email TEXT,
  guest_phone TEXT,

  -- Error tracking
  error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cbr_client_id ON concierge_booking_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_cbr_status ON concierge_booking_requests(status);
CREATE INDEX IF NOT EXISTS idx_cbr_partner_order ON concierge_booking_requests(partner_order_id);
CREATE INDEX IF NOT EXISTS idx_cbr_stripe_session ON concierge_booking_requests(stripe_checkout_session_id);

-- RLS: backend uses service role (supabaseAdmin) which bypasses RLS.
-- Enable RLS with a permissive service-role policy only.
ALTER TABLE concierge_booking_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY cbr_service_all ON concierge_booking_requests
  FOR ALL USING (true) WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_cbr_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cbr_updated_at
  BEFORE UPDATE ON concierge_booking_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_cbr_updated_at();
