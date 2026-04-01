-- Add split columns to order_services table
-- Run this in Supabase SQL Editor if split services fail with "Could not find split_index column"

-- 1. split_group_id - UUID shared by all services from same split
ALTER TABLE public.order_services
ADD COLUMN IF NOT EXISTS split_group_id UUID NULL;

CREATE INDEX IF NOT EXISTS idx_order_services_split_group_id 
ON public.order_services(split_group_id) WHERE split_group_id IS NOT NULL;

COMMENT ON COLUMN public.order_services.split_group_id IS 'UUID shared by all services created from the same split operation';

-- 2. split_index and split_total - position and count in split group
ALTER TABLE public.order_services
ADD COLUMN IF NOT EXISTS split_index INTEGER NULL;

ALTER TABLE public.order_services
ADD COLUMN IF NOT EXISTS split_total INTEGER NULL;

COMMENT ON COLUMN public.order_services.split_index IS 'Index of this service in the split group (1-based)';
COMMENT ON COLUMN public.order_services.split_total IS 'Total number of services in the split group';

-- Optional: check constraint (drop first if exists to avoid errors on re-run)
ALTER TABLE public.order_services DROP CONSTRAINT IF EXISTS check_split_index_valid;

ALTER TABLE public.order_services
ADD CONSTRAINT check_split_index_valid 
CHECK (split_index IS NULL OR split_total IS NULL OR (split_index > 0 AND split_index <= split_total));
