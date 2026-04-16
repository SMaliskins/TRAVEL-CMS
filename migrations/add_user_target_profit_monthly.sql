-- Per-user monthly profit target (used by Dashboard TARGET widget when an agent is selected).
-- Company-level target stays in `companies.target_profit_monthly` (used for "Company" / "All Agents" view).
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS target_profit_monthly numeric(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.user_profiles.target_profit_monthly
  IS 'Personal monthly profit target for this user (EUR). 0 = not set (falls back to company-level target in UI).';
