-- Check what Turnover API actually sums
-- Should match €2080.75 from UI

SELECT 
  os.order_id,
  o.order_code,
  os.service_name,
  os.client_price,
  os.res_status
FROM order_services os
JOIN orders o ON o.id = os.order_id
WHERE os.payer_party_id = '8a2712aa-7702-4bff-b399-7977c30999a5'
  AND os.res_status != 'cancelled'
ORDER BY o.order_code, os.service_name;

-- Sum (should be €2080.75)
SELECT 
  SUM(os.client_price) as turnover_from_services
FROM order_services os
WHERE os.payer_party_id = '8a2712aa-7702-4bff-b399-7977c30999a5'
  AND os.res_status != 'cancelled';
