-- Add 'type' column to travel_service_categories
-- This is the fixed functional type that determines which features are available
-- The 'name' field can be freely renamed by users without affecting functionality

ALTER TABLE public.travel_service_categories
ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'other'
CHECK (type IN ('flight', 'hotel', 'transfer', 'tour', 'insurance', 'visa', 'rent_a_car', 'cruise', 'other'));

-- Add category_id to order_services to link services to categories by ID (not name)
ALTER TABLE public.order_services
ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.travel_service_categories(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_order_services_category_id ON public.order_services(category_id);

-- Update existing travel_service_categories to set type based on name (one-time migration)
UPDATE public.travel_service_categories SET type = 'flight' WHERE LOWER(name) LIKE '%flight%';
UPDATE public.travel_service_categories SET type = 'hotel' WHERE LOWER(name) LIKE '%hotel%';
UPDATE public.travel_service_categories SET type = 'transfer' WHERE LOWER(name) LIKE '%transfer%';
UPDATE public.travel_service_categories SET type = 'tour' WHERE LOWER(name) IN ('tour', 'package tour');
UPDATE public.travel_service_categories SET type = 'insurance' WHERE LOWER(name) LIKE '%insurance%';
UPDATE public.travel_service_categories SET type = 'visa' WHERE LOWER(name) LIKE '%visa%';
UPDATE public.travel_service_categories SET type = 'rent_a_car' WHERE LOWER(name) LIKE '%rent%' OR LOWER(name) LIKE '%car%';
UPDATE public.travel_service_categories SET type = 'cruise' WHERE LOWER(name) LIKE '%cruise%';
-- 'other' is the default, so no need to update explicitly
