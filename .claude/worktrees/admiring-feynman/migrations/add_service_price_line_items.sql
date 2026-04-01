-- Service Price line items: positions with description, amount, commissionable flag
-- Used when part of Service Price is commissionable, part is not
ALTER TABLE public.order_services
  ADD COLUMN IF NOT EXISTS service_price_line_items jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.order_services.service_price_line_items IS 'Array of {description, amount, commissionable}. When present, service_price = sum(amount), commission applies only to commissionable amounts';
