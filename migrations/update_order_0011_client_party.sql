-- Migration: Link order 0011-26-sm to party 8a2712aa-7702-4bff-b399-7977c30999a5
-- Run this in Supabase SQL Editor

-- 1. Update order to set client_party_id
UPDATE orders
SET client_party_id = '8a2712aa-7702-4bff-b399-7977c30999a5'
WHERE order_code = '0011-26-sm'
  AND client_party_id IS NULL;

-- 2. Update all services in this order to set client_party_id and payer_party_id
UPDATE order_services
SET 
  client_party_id = '8a2712aa-7702-4bff-b399-7977c30999a5',
  payer_party_id = '8a2712aa-7702-4bff-b399-7977c30999a5'
WHERE order_id = (SELECT id FROM orders WHERE order_code = '0011-26-sm')
  AND client_party_id IS NULL;

-- 3. Verify update
SELECT 
  o.order_code,
  o.client_party_id,
  o.client_display_name,
  COUNT(os.id) as services_count
FROM orders o
LEFT JOIN order_services os ON os.order_id = o.id AND os.client_party_id = '8a2712aa-7702-4bff-b399-7977c30999a5'
WHERE o.order_code = '0011-26-sm'
GROUP BY o.id, o.order_code, o.client_party_id, o.client_display_name;
