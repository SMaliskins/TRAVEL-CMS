-- Fix duplicated services with NULL payer_party_id
-- These services have correct payer_name but missing payer_party_id
-- Root cause: snake_case vs camelCase bug in handleDuplicateConfirm

-- Services to fix (from debug query):
-- 998e6fbe-1e26-4c8b-b3e4-588935548e58 - w333, €222, payer: Bogdans Ignatjevs
-- 2b1caef7-f422-440d-b613-d00da5cf8116 - w333, €222, payer: Bogdans Ignatjevs
-- c4461783-be15-4b05-9a62-7287df7713c9 - test, €900, payer: Bogdans Ignatjevs
-- a7e06d04-7fed-4b96-88f2-ed2c766651b8 - test, €900, payer: Bogdans Ignatjevs

-- Update all services where payer_name = 'Bogdans Ignatjevs' but payer_party_id is NULL
UPDATE order_services
SET payer_party_id = '8a2712aa-7702-4bff-b399-7977c30999a5'
WHERE payer_name = 'Bogdans Ignatjevs'
  AND payer_party_id IS NULL;

-- Also fix client_party_id for same services
UPDATE order_services
SET client_party_id = '8a2712aa-7702-4bff-b399-7977c30999a5'
WHERE client_name = 'Bogdans Ignatjevs'
  AND client_party_id IS NULL;

-- Verify fix
SELECT 
  os.id,
  os.service_name,
  os.client_price,
  os.payer_party_id,
  os.payer_name,
  o.order_code
FROM order_services os
JOIN orders o ON os.order_id = o.id
WHERE os.payer_name = 'Bogdans Ignatjevs'
ORDER BY os.created_at DESC;

-- Verify Total Spent is now correct
SELECT 
  SUM(os.client_price) as total_spent_after_fix
FROM order_services os
WHERE os.payer_party_id = '8a2712aa-7702-4bff-b399-7977c30999a5'
  AND os.res_status != 'cancelled';

-- Expected result: €1782.50 (was correct before) + €2244.00 (4 fixed services) = €4026.50
