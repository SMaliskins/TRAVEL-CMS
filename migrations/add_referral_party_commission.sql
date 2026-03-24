-- Referral role: party extension, per-category rates, accrual lines, settlements, order attribution.
-- Apply in Supabase SQL Editor (idempotent DO blocks).
-- After apply: verify RLS in dashboard; adjust policies if your auth uses user_profiles instead of profiles.

-- ---------------------------------------------------------------------------
-- referral_party: Referral role flag + defaults (one row per party when role enabled)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referral_party (
  party_id uuid PRIMARY KEY REFERENCES public.party(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  default_currency text NOT NULL DEFAULT 'EUR',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_party_company_id ON public.referral_party(company_id);

COMMENT ON TABLE public.referral_party IS 'Directory Referral role: passive commission partners';

-- ---------------------------------------------------------------------------
-- Per travel_service_categories rates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referral_party_category_rate (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.referral_party(party_id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.travel_service_categories(id) ON DELETE CASCADE,
  rate_kind text NOT NULL CHECK (rate_kind IN ('percent', 'fixed')),
  rate_value numeric(14, 4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (party_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_party_category_rate_company ON public.referral_party_category_rate(company_id);

-- ---------------------------------------------------------------------------
-- Accrual lines (planned vs accrued); order/service IDs for backend only
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referral_accrual_line (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  referral_party_id uuid NOT NULL REFERENCES public.party(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  order_service_id uuid REFERENCES public.order_services(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.travel_service_categories(id) ON DELETE SET NULL,
  base_amount numeric(14, 2) NOT NULL DEFAULT 0,
  commission_amount numeric(14, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'accrued', 'void')),
  reporting_period date,
  created_at timestamptz NOT NULL DEFAULT now(),
  accrued_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_accrual_line_referral ON public.referral_accrual_line(referral_party_id);
CREATE INDEX IF NOT EXISTS idx_referral_accrual_line_company_status ON public.referral_accrual_line(company_id, status);
CREATE INDEX IF NOT EXISTS idx_referral_accrual_line_order ON public.referral_accrual_line(order_id);
CREATE INDEX IF NOT EXISTS idx_referral_accrual_line_period ON public.referral_accrual_line(referral_party_id, reporting_period)
  WHERE reporting_period IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Settlements (payouts / spend on referral request)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referral_settlement_entry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  referral_party_id uuid NOT NULL REFERENCES public.party(id) ON DELETE CASCADE,
  amount numeric(14, 2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'EUR',
  note text,
  entry_date date NOT NULL DEFAULT (CURRENT_DATE),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_referral_settlement_entry_referral ON public.referral_settlement_entry(referral_party_id);
CREATE INDEX IF NOT EXISTS idx_referral_settlement_entry_company_date ON public.referral_settlement_entry(company_id, entry_date);

-- ---------------------------------------------------------------------------
-- Orders: link to referral + confirmation flag
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'referral_party_id'
  ) THEN
    ALTER TABLE public.orders
      ADD COLUMN referral_party_id uuid REFERENCES public.party(id) ON DELETE SET NULL;
    COMMENT ON COLUMN public.orders.referral_party_id IS 'Referral / influencer party for passive commission';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'referral_commission_confirmed'
  ) THEN
    ALTER TABLE public.orders
      ADD COLUMN referral_commission_confirmed boolean NOT NULL DEFAULT false;
    COMMENT ON COLUMN public.orders.referral_commission_confirmed IS 'When true and trip ended, planned referral lines can be promoted to accrued';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'referral_commission_confirmed_at'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN referral_commission_confirmed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'referral_commission_confirmed_by'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN referral_commission_confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_referral_party_id ON public.orders(referral_party_id) WHERE referral_party_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- RLS (same company as party / orders)
-- ---------------------------------------------------------------------------
ALTER TABLE public.referral_party ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_party_category_rate ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_accrual_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_settlement_entry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "referral_party_company" ON public.referral_party;
CREATE POLICY "referral_party_company"
ON public.referral_party FOR ALL
TO authenticated
USING (
  company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
)
WITH CHECK (
  company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "referral_party_category_rate_company" ON public.referral_party_category_rate;
CREATE POLICY "referral_party_category_rate_company"
ON public.referral_party_category_rate FOR ALL
TO authenticated
USING (
  company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
)
WITH CHECK (
  company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "referral_accrual_line_company" ON public.referral_accrual_line;
CREATE POLICY "referral_accrual_line_company"
ON public.referral_accrual_line FOR ALL
TO authenticated
USING (
  company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
)
WITH CHECK (
  company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "referral_settlement_entry_company" ON public.referral_settlement_entry;
CREATE POLICY "referral_settlement_entry_company"
ON public.referral_settlement_entry FOR ALL
TO authenticated
USING (
  company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
)
WITH CHECK (
  company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
);
