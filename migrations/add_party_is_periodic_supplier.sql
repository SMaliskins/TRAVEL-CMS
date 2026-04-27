-- Add a per-supplier flag that marks suppliers issuing periodic (e.g. monthly) invoices.
-- When set, new order services for that supplier should default to
-- order_services.supplier_invoice_requirement = 'periodic' (UI-driven). The flag also
-- allows a one-shot backfill of existing services in active orders for the same company.

ALTER TABLE public.party
  ADD COLUMN IF NOT EXISTS is_periodic_supplier boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.party.is_periodic_supplier IS
  'When true, new order services using this supplier default to supplier_invoice_requirement = ''periodic''. Toggling this on can also trigger a backfill across active orders.';

-- Optional partial index helps when scanning suppliers flagged as periodic.
CREATE INDEX IF NOT EXISTS idx_party_is_periodic_supplier
  ON public.party (company_id)
  WHERE is_periodic_supplier = true;
