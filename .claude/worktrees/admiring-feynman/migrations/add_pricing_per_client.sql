-- Flight: per-client pricing (cost, marge, sale per passenger). Totals = sum of rows.
-- Format: [{ "partyId": "uuid"|null, "cost": number, "marge": number, "sale": number }, ...]
ALTER TABLE public.order_services
ADD COLUMN IF NOT EXISTS pricing_per_client jsonb DEFAULT NULL;

COMMENT ON COLUMN public.order_services.pricing_per_client IS 'Flight only: per-client cost/marge/sale. When set, service_price/client_price are totals (sum).';
