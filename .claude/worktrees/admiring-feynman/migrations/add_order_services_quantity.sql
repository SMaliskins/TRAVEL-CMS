-- Add quantity (units/nights) to order_services for PRICING multiply
-- quantity = 1 by default; when > 1, service_price and client_price are totals (unit price × quantity)
ALTER TABLE public.order_services
ADD COLUMN IF NOT EXISTS quantity int NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.order_services.quantity IS 'Units or nights: price totals = unit price × quantity. Default 1.';
