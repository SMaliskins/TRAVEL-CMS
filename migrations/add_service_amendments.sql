-- Migration: Add service amendments support (change/cancellation)
-- This enables tracking of flight changes and cancellations as child services

-- Add parent service reference for change/cancellation tracking
ALTER TABLE public.order_services
ADD COLUMN IF NOT EXISTS parent_service_id UUID REFERENCES public.order_services(id) ON DELETE SET NULL;

-- Add service type to distinguish original, change, and cancellation services
ALTER TABLE public.order_services
ADD COLUMN IF NOT EXISTS service_type TEXT DEFAULT 'original';

-- Add constraint for service_type values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'order_services_service_type_check'
    ) THEN
        ALTER TABLE public.order_services
        ADD CONSTRAINT order_services_service_type_check
        CHECK (service_type IN ('original', 'change', 'cancellation'));
    END IF;
END $$;

-- Add cancellation fee field (change_fee already exists for flights)
ALTER TABLE public.order_services
ADD COLUMN IF NOT EXISTS cancellation_fee DECIMAL(10,2) DEFAULT NULL;

-- Add refund amount field for cancellations
ALTER TABLE public.order_services
ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10,2) DEFAULT NULL;

-- Create index for parent-child relationship queries
CREATE INDEX IF NOT EXISTS idx_order_services_parent_service_id
ON public.order_services(parent_service_id)
WHERE parent_service_id IS NOT NULL;

-- Create index for service type filtering
CREATE INDEX IF NOT EXISTS idx_order_services_service_type
ON public.order_services(service_type)
WHERE service_type != 'original';

-- Add comments for documentation
COMMENT ON COLUMN public.order_services.parent_service_id IS 'Reference to original service for change/cancellation services';
COMMENT ON COLUMN public.order_services.service_type IS 'Type of service: original, change, or cancellation';
COMMENT ON COLUMN public.order_services.cancellation_fee IS 'Fee charged for cancellation (supplier cost)';
COMMENT ON COLUMN public.order_services.refund_amount IS 'Amount refunded to agency from supplier on cancellation';
