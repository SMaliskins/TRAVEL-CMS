-- Service (e.g. hotel) can be in supplier currency; we store converted amount in company currency (service_price).
-- service_currency = currency of the entered amount (e.g. CHF); service_price_foreign = amount in that currency;
-- exchange_rate = rate to company currency (e.g. 1 CHF = 0.95 EUR). service_price (existing) = converted amount in company currency.
ALTER TABLE public.order_services
ADD COLUMN IF NOT EXISTS service_currency text DEFAULT 'EUR';

ALTER TABLE public.order_services
ADD COLUMN IF NOT EXISTS service_price_foreign numeric;

ALTER TABLE public.order_services
ADD COLUMN IF NOT EXISTS exchange_rate numeric;

COMMENT ON COLUMN public.order_services.service_currency IS 'Currency of the supplier/service (e.g. CHF). When different from company currency, service_price_foreign and exchange_rate are used to derive service_price.';
COMMENT ON COLUMN public.order_services.service_price_foreign IS 'Amount in service_currency. Converted to company currency via exchange_rate to fill service_price.';
COMMENT ON COLUMN public.order_services.exchange_rate IS 'Rate: 1 unit of service_currency = this many units of company currency (e.g. 0.95 for CHF to EUR).';

-- Real amount charged (e.g. by bank); used for Profit = Sale - Actually paid.
ALTER TABLE public.order_services
ADD COLUMN IF NOT EXISTS actually_paid numeric;

COMMENT ON COLUMN public.order_services.actually_paid IS 'Actually paid in company currency (e.g. bank charge). Profit is calculated from Sale - actually_paid when set.';
