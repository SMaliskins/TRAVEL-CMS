-- Fix payer_party_id for services where payer_name matches Bogdans Ignatjevs
-- This fixes services that have correct name but wrong party_id

-- Update services with payer_name = 'Bogdans Ignatjevs' to use correct party_id
UPDATE order_services
SET payer_party_id = '8a2712aa-7702-4bff-b399-7977c30999a5'
WHERE payer_name = 'Bogdans Ignatjevs'
  AND (payer_party_id IS NULL OR payer_party_id != '8a2712aa-7702-4bff-b399-7977c30999a5');

-- Verify update
SELECT 
  'Services updated' as description,
  COUNT(*) as count
FROM order_services
WHERE payer_name = 'Bogdans Ignatjevs'
  AND payer_party_id = '8a2712aa-7702-4bff-b399-7977c30999a5';

-- Show all services with Bogdans as payer (excluding cancelled)
SELECT 
  o.order_code,
  os.service_name,
  os.client_price,
  os.payer_party_id,
  os.res_status
FROM order_services os
LEFT JOIN orders o ON o.id = os.order_id
WHERE os.payer_party_id = '8a2712aa-7702-4bff-b399-7977c30999a5'
  AND os.res_status != 'cancelled'
ORDER BY o.order_code;

-- Calculate total
SELECT 
  'Total Spent (excluding cancelled)' as description,
  SUM(os.client_price) as total,
  COUNT(*) as services_count
FROM order_services os
WHERE os.payer_party_id = '8a2712aa-7702-4bff-b399-7977c30999a5'
  AND os.res_status != 'cancelled';
