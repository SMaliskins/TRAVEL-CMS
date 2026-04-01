-- Migration: Directory Improvements
-- Adds display_id (unique sequential ID), service_areas, supplier_commissions columns to party table

-- Add display_id column (unique sequential ID that never changes)
-- Each record gets a permanent ID upon creation
ALTER TABLE public.party 
ADD COLUMN IF NOT EXISTS display_id INTEGER;

-- Add service_areas column for suppliers (array of service category names)
ALTER TABLE public.party 
ADD COLUMN IF NOT EXISTS service_areas text[];

-- Add supplier_commissions column (JSONB array for commission data)
ALTER TABLE public.party 
ADD COLUMN IF NOT EXISTS supplier_commissions jsonb;

-- Add country column if not exists
ALTER TABLE public.party 
ADD COLUMN IF NOT EXISTS country text;

-- Create sequence for display_id if not exists
CREATE SEQUENCE IF NOT EXISTS party_display_id_seq START WITH 1;

-- Set default value for display_id using sequence
ALTER TABLE public.party 
ALTER COLUMN display_id SET DEFAULT nextval('party_display_id_seq');

-- Create unique index for display_id (each ID is unique and permanent)
CREATE UNIQUE INDEX IF NOT EXISTS idx_party_display_id_unique ON public.party(display_id) WHERE display_id IS NOT NULL;

-- Create index for service_areas (GIN for array containment queries)
CREATE INDEX IF NOT EXISTS idx_party_service_areas ON public.party USING GIN(service_areas);

-- Update existing records to have unique display_id values based on creation order
-- This ensures existing records get permanent sequential IDs
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) as rn
  FROM public.party
  WHERE display_id IS NULL
)
UPDATE public.party p
SET display_id = n.rn
FROM numbered n
WHERE p.id = n.id;

-- Update sequence to start after the highest existing display_id
SELECT setval('party_display_id_seq', COALESCE((SELECT MAX(display_id) FROM public.party), 0) + 1, false);

-- Verify migration
SELECT 
  'display_id' as column_name,
  COUNT(*) as total_records,
  COUNT(display_id) as records_with_display_id,
  MAX(display_id) as max_display_id
FROM public.party;
