-- Optional fixed referral commission per service line (currency of service). When set, overrides % / category rate.
ALTER TABLE public.order_services
  ADD COLUMN IF NOT EXISTS referral_commission_fixed_amount numeric(14, 2) NULL;

COMMENT ON COLUMN public.order_services.referral_commission_fixed_amount IS 'If set, referral commission for this line is this amount (signed allowed). Null = use % override or partner category rate on profit net of VAT.';
