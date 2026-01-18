-- Debug: Check all services for Bogdans Ignatjevs as payer
-- Party ID: 8a2712aa-7702-4bff-b399-7977c30999a5

SELECT 
  os.id,
  os.service_name,
  os.client_price,
  os.res_status,
  os.payer_party_id,
  os.payer_name,
  os.created_at,
  o.order_code
FROM order_services os
JOIN orders o ON os.order_id = o.id
WHERE os.payer_name = 'Bogdans Ignatjevs'
ORDER BY os.created_at DESC
LIMIT 10;

-- Also check if there are services with NULL payer_party_id but correct payer_name
SELECT 
  COUNT(*) as count_with_null_party_id
FROM order_services
WHERE payer_name = 'Bogdans Ignatjevs'
  AND payer_party_id IS NULL;

-- Check Total Spent calculation manually
SELECT 
  SUM(os.client_price) as total_spent_manual
FROM order_services os
WHERE os.payer_party_id = '8a2712aa-7702-4bff-b399-7977c30999a5'
  AND os.res_status != 'cancelled';
