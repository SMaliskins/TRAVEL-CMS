-- Migration: Add supplier logo URL to party table
-- When party has role Supplier, allow uploading their logo

ALTER TABLE public.party
ADD COLUMN IF NOT EXISTS supplier_logo_url text;

COMMENT ON COLUMN public.party.supplier_logo_url IS 'Logo URL for suppliers (parties with supplier role)';
