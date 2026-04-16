-- Backfill for flight/air ticket services where a previous save stored service_price = 0
-- (or client_price = 0) but pricing_per_client has real per-passenger amounts.
-- Writes sum(cost)/sum(sale) into service_price/client_price so the services list, invoices
-- and reports reflect what was actually entered per passenger. Run once after verifying
-- the affected rows in a preview query.

-- 1) Preview affected rows (run first to confirm)
-- SELECT
--   s.id,
--   s.order_id,
--   s.category,
--   s.service_price,
--   s.client_price,
--   (
--     SELECT COALESCE(SUM((e->>'cost')::numeric), 0)
--     FROM jsonb_array_elements(s.pricing_per_client) e
--   ) AS sum_cost,
--   (
--     SELECT COALESCE(SUM((e->>'sale')::numeric), 0)
--     FROM jsonb_array_elements(s.pricing_per_client) e
--   ) AS sum_sale
-- FROM public.order_services s
-- WHERE s.pricing_per_client IS NOT NULL
--   AND jsonb_typeof(s.pricing_per_client) = 'array'
--   AND jsonb_array_length(s.pricing_per_client) > 0
--   AND (
--     (COALESCE(s.service_price, 0) = 0 AND (
--       SELECT COALESCE(SUM((e->>'cost')::numeric), 0)
--       FROM jsonb_array_elements(s.pricing_per_client) e
--     ) > 0)
--     OR
--     (COALESCE(s.client_price, 0) = 0 AND (
--       SELECT COALESCE(SUM((e->>'sale')::numeric), 0)
--       FROM jsonb_array_elements(s.pricing_per_client) e
--     ) > 0)
--   );

-- 2) Apply fix: write sums into service_price / client_price
UPDATE public.order_services AS s
SET
  service_price = CASE
    WHEN COALESCE(s.service_price, 0) = 0
      AND sums.sum_cost > 0
    THEN sums.sum_cost
    ELSE s.service_price
  END,
  client_price = CASE
    WHEN COALESCE(s.client_price, 0) = 0
      AND sums.sum_sale > 0
    THEN sums.sum_sale
    ELSE s.client_price
  END,
  updated_at = NOW()
FROM (
  SELECT
    os.id,
    (SELECT COALESCE(SUM((e->>'cost')::numeric), 0)
       FROM jsonb_array_elements(os.pricing_per_client) e) AS sum_cost,
    (SELECT COALESCE(SUM((e->>'sale')::numeric), 0)
       FROM jsonb_array_elements(os.pricing_per_client) e) AS sum_sale
  FROM public.order_services os
  WHERE os.pricing_per_client IS NOT NULL
    AND jsonb_typeof(os.pricing_per_client) = 'array'
    AND jsonb_array_length(os.pricing_per_client) > 0
) AS sums
WHERE s.id = sums.id
  AND (
    (COALESCE(s.service_price, 0) = 0 AND sums.sum_cost > 0)
    OR
    (COALESCE(s.client_price, 0) = 0 AND sums.sum_sale > 0)
  );
