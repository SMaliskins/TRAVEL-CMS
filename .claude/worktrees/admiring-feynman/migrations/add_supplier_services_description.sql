-- Add supplier_services_description (rich text) to party for Directory - Supplier
-- Description of services provided by the supplier

ALTER TABLE public.party
ADD COLUMN IF NOT EXISTS supplier_services_description text;

COMMENT ON COLUMN public.party.supplier_services_description IS 'Rich text description of services provided by supplier (Directory - Supplier)';
