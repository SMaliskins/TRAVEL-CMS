-- Migration: Allow manual invoice lines (no service_id)
-- Date: 2026-02-19
-- Description: Make service_id nullable so invoices can have manually added rows

-- 1. Drop the unique constraint (invoice_id, service_id) so we can have multiple rows with service_id NULL
ALTER TABLE public.invoice_items
  DROP CONSTRAINT IF EXISTS invoice_items_invoice_service_key;

-- 2. Make service_id nullable
ALTER TABLE public.invoice_items
  ALTER COLUMN service_id DROP NOT NULL;

-- 3. Re-add unique constraint only for rows that have service_id (prevent duplicate service per invoice)
CREATE UNIQUE INDEX IF NOT EXISTS invoice_items_invoice_service_key
  ON public.invoice_items (invoice_id, service_id)
  WHERE service_id IS NOT NULL;

COMMENT ON COLUMN public.invoice_items.service_id IS 'Optional: link to order_services. NULL for manually added lines.';
