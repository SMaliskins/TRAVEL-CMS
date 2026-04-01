-- Add supplier_documents jsonb to party for Directory - Supplier
-- Documents: brochures, rate cards, etc. [{id, fileName, fileUrl, uploadedAt}]

ALTER TABLE public.party
ADD COLUMN IF NOT EXISTS supplier_documents jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.party.supplier_documents IS 'Supplier info documents: [{id, fileName, fileUrl, uploadedAt}]';
