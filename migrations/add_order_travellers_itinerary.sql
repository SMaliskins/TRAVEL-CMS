-- MULTI-ROUTE-01 Step 1: per-traveller itinerary on existing order_travellers.
--
-- Adds itinerary, individual dates and display position to the existing
-- order_travellers table so each passenger of an order can have their own
-- route (Nice → London → Rome → Nice) with its own dates, instead of being
-- forced to share the single orders.countries_cities string.
--
-- Backwards compatible: rows with NULL/empty itinerary keep falling back to
-- orders.countries_cities and orders.date_from/date_to (handled in UI/API).

ALTER TABLE public.order_travellers
  ADD COLUMN IF NOT EXISTS itinerary jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS date_from date,
  ADD COLUMN IF NOT EXISTS date_to   date,
  ADD COLUMN IF NOT EXISTS position  int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS order_travellers_order_position_idx
  ON public.order_travellers(order_id, position);

COMMENT ON COLUMN public.order_travellers.itinerary IS
  'Per-traveller route, shape: { origin: {city,country,countryCode}, destinations: [...], returnCity: {...} }. Empty => fall back to orders.countries_cities.';
COMMENT ON COLUMN public.order_travellers.date_from IS
  'Per-traveller start date. NULL => fall back to orders.date_from.';
COMMENT ON COLUMN public.order_travellers.date_to IS
  'Per-traveller end date. NULL => fall back to orders.date_to.';
COMMENT ON COLUMN public.order_travellers.position IS
  'Display order in the passengers section (lead first, then by position).';
