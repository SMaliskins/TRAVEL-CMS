-- =============================================================================
-- Migration 001: MyTravelConcierge Client App Tables
-- =============================================================================
-- Apply via: Supabase Dashboard → SQL Editor → paste → Run
-- Target DB: Supabase PostgreSQL (Travel CMS)
--
-- Existing table references verified from codebase:
--   • party        — CRM clients/contacts  (app/api/party/route.ts)
--   • orders       — booking orders        (app/api/orders/route.ts)
--   • profiles     — agent auth profiles   (app/api/orders/route.ts)
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. client_profiles
--    Mobile app auth profile that extends an existing CRM party (client) record.
--    One-to-one with party.id (a CRM client can have at most one app login).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_profiles (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- FK → party.id  (the CRM client this mobile account belongs to)
  crm_client_id       UUID        NOT NULL UNIQUE
                        REFERENCES party(id) ON DELETE CASCADE,

  -- Hashed credentials (bcrypt / argon2 — never store plaintext)
  password_hash       TEXT        NOT NULL,
  refresh_token_hash  TEXT,

  -- Profile extras
  avatar_url          TEXT,
  notification_token  TEXT,          -- FCM / APNs push token

  -- MLM tree: which agent invited this client
  -- References profiles.user_id (agent's CRM profile row)
  invited_by_agent_id UUID
                        REFERENCES profiles(user_id) ON DELETE SET NULL,

  -- Unique referral code used to invite new clients (defaults to a UUID string)
  referral_code       TEXT        NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,

  -- Stripe customer id for in-app payments (nullable until first payment)
  stripe_customer_id  TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at       TIMESTAMPTZ
);

COMMENT ON TABLE  client_profiles IS 'Mobile app auth profiles extending CRM party records (one-to-one).';
COMMENT ON COLUMN client_profiles.crm_client_id       IS 'FK → party.id — the CRM client this account belongs to.';
COMMENT ON COLUMN client_profiles.invited_by_agent_id IS 'FK → profiles.user_id — the agent who invited this client (MLM level-1 parent).';
COMMENT ON COLUMN client_profiles.referral_code       IS 'Unique shareable code; new clients who sign up via this code are linked as level-2.';


-- -----------------------------------------------------------------------------
-- 2. commission_payouts
--    Payout records for agents.  Created BEFORE commission_ledger so the ledger
--    can reference it via FK.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commission_payouts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The agent receiving the payout (references client_profiles, not auth.users)
  agent_profile_id UUID        NOT NULL REFERENCES client_profiles(id) ON DELETE RESTRICT,

  total_amount     DECIMAL(12,2) NOT NULL,
  invoice_number   TEXT,

  payment_method   TEXT        NOT NULL DEFAULT 'BANK_TRANSFER'
                     CHECK (payment_method IN ('BANK_TRANSFER','INVOICE','AUTO')),

  status           TEXT        NOT NULL DEFAULT 'PENDING'
                     CHECK (status IN ('PENDING','PROCESSING','PAID')),

  paid_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE commission_payouts IS 'Payout batches for agent MLM commissions.';


-- -----------------------------------------------------------------------------
-- 3. commission_ledger
--    One row per (booking × agent × MLM level) commission entry.
--    level 1 = direct agent, level 2 = their referrer, level 3 = grand-referrer.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commission_ledger (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- FK → orders.id  (the booking that generated this commission)
  booking_id        UUID        NOT NULL
                      REFERENCES orders(id) ON DELETE CASCADE,

  -- The agent earning the commission
  agent_profile_id  UUID        NOT NULL REFERENCES client_profiles(id) ON DELETE RESTRICT,

  -- MLM level: 1 = direct booking agent, 2 = their inviter, 3 = grand-inviter
  level             INT         NOT NULL CHECK (level IN (1, 2, 3)),

  -- Financials
  gross_margin      DECIMAL(12,2) NOT NULL,
  commission_rate   DECIMAL(5,4)  NOT NULL,  -- e.g. 0.1000 = 10%
  commission_amount DECIMAL(12,2) NOT NULL,

  status            TEXT        NOT NULL DEFAULT 'PENDING'
                      CHECK (status IN ('PENDING','PAYABLE','PAID')),

  -- Set when included in a payout batch
  payout_id         UUID        REFERENCES commission_payouts(id) ON DELETE SET NULL,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  commission_ledger IS 'MLM commission entries: one row per booking × agent × level.';
COMMENT ON COLUMN commission_ledger.booking_id   IS 'FK → orders.id — the booking that generated this commission.';
COMMENT ON COLUMN commission_ledger.level        IS '1 = direct booking agent, 2 = their referrer, 3 = grand-referrer.';
COMMENT ON COLUMN commission_ledger.payout_id    IS 'Set once this entry is included in a commission_payouts batch.';


-- -----------------------------------------------------------------------------
-- 4. concierge_sessions
--    AI concierge chat history, one session per client conversation thread.
--    messages is a JSONB array of {role, content, ts} objects.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS concierge_sessions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID        NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
  messages   JSONB       NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  concierge_sessions IS 'AI concierge chat sessions per client.';
COMMENT ON COLUMN concierge_sessions.messages IS 'JSONB array of chat messages: [{role, content, ts}, …]';

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_concierge_sessions_updated_at
  BEFORE UPDATE ON concierge_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =============================================================================
-- Indexes
-- =============================================================================

-- client_profiles
CREATE INDEX IF NOT EXISTS idx_client_profiles_invited_by
  ON client_profiles(invited_by_agent_id);

-- commission_ledger
CREATE INDEX IF NOT EXISTS idx_commission_ledger_booking_id
  ON commission_ledger(booking_id);

CREATE INDEX IF NOT EXISTS idx_commission_ledger_agent_profile_id
  ON commission_ledger(agent_profile_id);

CREATE INDEX IF NOT EXISTS idx_commission_ledger_status
  ON commission_ledger(status);

CREATE INDEX IF NOT EXISTS idx_commission_ledger_payout_id
  ON commission_ledger(payout_id);

-- commission_payouts
CREATE INDEX IF NOT EXISTS idx_commission_payouts_agent_profile_id
  ON commission_payouts(agent_profile_id);

CREATE INDEX IF NOT EXISTS idx_commission_payouts_status
  ON commission_payouts(status);

-- concierge_sessions
CREATE INDEX IF NOT EXISTS idx_concierge_sessions_client_id
  ON concierge_sessions(client_id);

CREATE INDEX IF NOT EXISTS idx_concierge_sessions_updated_at
  ON concierge_sessions(updated_at DESC);


-- =============================================================================
-- Row Level Security (enable but leave policies to be added per-feature)
-- =============================================================================
ALTER TABLE client_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_ledger    ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_payouts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE concierge_sessions   ENABLE ROW LEVEL SECURITY;

-- NOTE: Add RLS policies in subsequent migrations once the auth strategy
--       for the mobile app is finalised (JWT claims vs. service-role calls).
