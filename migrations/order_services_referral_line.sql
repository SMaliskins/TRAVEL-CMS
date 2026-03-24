-- Per-service referral commission: include in accrual sync + optional manual % (signed; negative for refunds).
-- Apply in Supabase SQL Editor.

ALTER TABLE public.order_services
  ADD COLUMN IF NOT EXISTS referral_include_in_commission boolean NOT NULL DEFAULT true;

ALTER TABLE public.order_services
  ADD COLUMN IF NOT EXISTS referral_commission_percent_override numeric(14, 4) NULL;

COMMENT ON COLUMN public.order_services.referral_include_in_commission IS 'When true, line may appear in referral accrual sync if order has referral partner and rules match.';
COMMENT ON COLUMN public.order_services.referral_commission_percent_override IS 'If set, commission = signed client base * (value/100). NULL = use referral partner category rate.';
