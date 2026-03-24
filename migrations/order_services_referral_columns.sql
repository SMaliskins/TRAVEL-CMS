-- =============================================================================
-- order_services: referral commission fields (Referral tab + syncOrderReferralAccruals)
-- =============================================================================
-- Run once in Supabase SQL Editor (Dashboard → SQL). Idempotent (IF NOT EXISTS).
--
-- If % / Fixed / Ref checkbox do not persist: these columns are missing — apply this file.
-- =============================================================================

ALTER TABLE public.order_services
  ADD COLUMN IF NOT EXISTS referral_include_in_commission boolean NOT NULL DEFAULT true;

ALTER TABLE public.order_services
  ADD COLUMN IF NOT EXISTS referral_commission_percent_override numeric(14, 4) NULL;

ALTER TABLE public.order_services
  ADD COLUMN IF NOT EXISTS referral_commission_fixed_amount numeric(14, 2) NULL;

COMMENT ON COLUMN public.order_services.referral_include_in_commission IS
  'When true, line may be included in referral accrual sync if order has referral partner and rules match.';

COMMENT ON COLUMN public.order_services.referral_commission_percent_override IS
  'If set, commission = (profit net of VAT on line) * (value/100). NULL = use referral partner category rate. Signed % allowed (e.g. refunds).';

COMMENT ON COLUMN public.order_services.referral_commission_fixed_amount IS
  'If set, referral commission for this line is this fixed amount (signed allowed). Overrides percent and category rate.';
