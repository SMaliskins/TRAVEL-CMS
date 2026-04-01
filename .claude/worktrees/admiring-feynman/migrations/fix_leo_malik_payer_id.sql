-- Fix Leo Malik service with wrong payer_party_id
-- This service has payer_name = 'Bogdans Ignatjevs' but wrong payer_party_id
-- Current: ce033ae3-94c8-483e-aa4a-75e884762b7c
-- Correct: 8a2712aa-7702-4bff-b399-7977c30999a5

UPDATE order_services
SET payer_party_id = '8a2712aa-7702-4bff-b399-7977c30999a5'
WHERE id = '2c75158c-c398-4a74-8975-3539202d9693';

-- Verify the fix
SELECT 
  os.id,
  os.service_name,
  os.client_price,
  os.client_name,
  os.payer_name,
  os.payer_party_id,
  o.order_code
FROM order_services os
JOIN orders o ON os.order_id = o.id
WHERE os.id = '2c75158c-c398-4a74-8975-3539202d9693';

-- Verify Total Spent is now correct (should be €1388.75)
SELECT 
  SUM(os.client_price) as total_spent_correct
FROM order_services os
WHERE os.payer_party_id = '8a2712aa-7702-4bff-b399-7977c30999a5'
  AND os.res_status != 'cancelled';

-- Expected: 555.50 + 555.50 + 277.75 = 1388.75
