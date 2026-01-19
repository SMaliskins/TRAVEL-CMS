-- INVESTIGATION: Why do these 4 services have NULL payer_party_id?
-- Are they legitimately old data, or broken duplicates?

-- 1. Check creation timestamps - are they recent (duplicates) or old (manual entry)?
SELECT 
  os.id,
  os.service_name,
  os.client_price,
  os.payer_party_id,
  os.payer_name,
  os.created_at,
  o.order_code,
  o.created_at as order_created_at
FROM order_services os
JOIN orders o ON os.order_id = o.id
WHERE os.payer_name = 'Bogdans Ignatjevs'
  AND os.payer_party_id IS NULL
ORDER BY os.created_at DESC;

-- 2. Check if these services were part of the ORIGINAL order creation
--    or added later (which would indicate duplication or manual add)
-- Compare service created_at with order created_at

-- 3. Check ALL services in the same orders
--    Do other services in same order have correct party_ids?
SELECT 
  o.order_code,
  os.service_name,
  os.payer_name,
  os.payer_party_id,
  os.client_party_id,
  os.created_at
FROM order_services os
JOIN orders o ON os.order_id = o.id
WHERE o.order_code IN (
  SELECT DISTINCT o2.order_code
  FROM order_services os2
  JOIN orders o2 ON os2.order_id = o2.id
  WHERE os2.payer_name = 'Bogdans Ignatjevs'
    AND os2.payer_party_id IS NULL
)
ORDER BY o.order_code, os.created_at;

-- 4. Check order's client_party_id - does it match?
SELECT 
  o.order_code,
  o.client_party_id as order_client_party_id,
  o.client_display_name,
  COUNT(os.id) as services_count,
  COUNT(CASE WHEN os.payer_party_id IS NULL THEN 1 END) as null_payer_count
FROM orders o
LEFT JOIN order_services os ON os.order_id = o.id
WHERE o.order_code IN (
  SELECT DISTINCT o2.order_code
  FROM order_services os2
  JOIN orders o2 ON os2.order_id = o2.id
  WHERE os2.payer_name = 'Bogdans Ignatjevs'
    AND os2.payer_party_id IS NULL
)
GROUP BY o.order_code, o.client_party_id, o.client_display_name;
