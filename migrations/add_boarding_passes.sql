-- Migration: Add boarding_passes column to order_services
-- Date: 2026-01-19

-- Add boarding_passes JSONB column
ALTER TABLE public.order_services 
ADD COLUMN IF NOT EXISTS boarding_passes JSONB DEFAULT '[]'::jsonb;

-- Add comment
COMMENT ON COLUMN public.order_services.boarding_passes IS 'Array of boarding pass files: [{id, fileName, fileUrl, clientId, clientName, uploadedAt, fileSize, mimeType}]';

-- Create index for querying
CREATE INDEX IF NOT EXISTS idx_order_services_boarding_passes 
ON public.order_services USING gin (boarding_passes);
