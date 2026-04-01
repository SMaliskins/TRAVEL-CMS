-- Add supplier_website to party for Directory - Supplier

ALTER TABLE public.party
ADD COLUMN IF NOT EXISTS supplier_website text;

COMMENT ON COLUMN public.party.supplier_website IS 'Supplier website URL (Directory - Supplier)';
