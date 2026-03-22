-- Cancellation refund type: fully_refunded | partial_refunded | non_refunded
ALTER TABLE public.order_services
ADD COLUMN IF NOT EXISTS cancellation_refund_type TEXT DEFAULT NULL;

COMMENT ON COLUMN public.order_services.cancellation_refund_type IS 'How the cancelled service was refunded: fully_refunded, partial_refunded, or non_refunded';
