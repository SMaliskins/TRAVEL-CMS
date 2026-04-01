-- Check the service with Leo Malik as client
-- Should still count for Bogdans as payer

SELECT 
  os.id,
  os.service_name,
  os.client_price,
  os.client_name,
  os.client_party_id,
  os.payer_name,
  os.payer_party_id,
  os.res_status,
  o.order_code
FROM order_services os
JOIN orders o ON os.order_id = o.id
WHERE os.payer_name = 'Bogdans Ignatjevs'
  AND os.client_name = 'Leo Malik'
ORDER BY os.created_at DESC;

-- Check if payer_party_id is correct for this service
SELECT 
  os.id,
  os.service_name,
  os.client_price,
  os.payer_party_id,
  os.res_status
FROM order_services os
WHERE os.payer_party_id = '8a2712aa-7702-4bff-b399-7977c30999a5'
  AND os.res_status != 'cancelled'
ORDER BY os.created_at DESC;

-- Manual calculation
SELECT 
  SUM(os.client_price) as total
FROM order_services os
WHERE os.payer_party_id = '8a2712aa-7702-4bff-b399-7977c30999a5'
  AND os.res_status != 'cancelled';
