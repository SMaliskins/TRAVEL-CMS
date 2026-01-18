-- Migration: Link old orders to party records based on client_display_name
-- This fixes orders created before client_party_id was saved
-- Run this in Supabase SQL Editor

-- STEP 1: Update orders.client_party_id based on matching display_name
-- This links orders to party records when display_name matches

WITH matched_parties AS (
  SELECT 
    o.id as order_id,
    o.client_display_name,
    p.id as party_id,
    p.display_name as party_display_name
  FROM orders o
  CROSS JOIN party p
  WHERE o.client_party_id IS NULL
    AND o.client_display_name IS NOT NULL
    AND (
      -- Exact match on display_name
      p.display_name = o.client_display_name
      OR
      -- Match on concatenated first_name + last_name (for person records)
      CONCAT(p.first_name, ' ', p.last_name) = o.client_display_name
      OR
      -- Match on company name
      p.name = o.client_display_name
    )
    -- Ensure client role exists
    AND 'client' = ANY(p.roles)
)
UPDATE orders o
SET client_party_id = mp.party_id
FROM matched_parties mp
WHERE o.id = mp.order_id;

-- Report: How many orders were updated
SELECT 
  COUNT(*) as orders_updated,
  'Orders linked to party records' as description
FROM orders
WHERE client_party_id IS NOT NULL
  AND updated_at >= NOW() - INTERVAL '1 minute';

-- STEP 2: Update order_services to inherit client_party_id from order
-- For services where client_name matches order.client_display_name

UPDATE order_services os
SET 
  client_party_id = o.client_party_id,
  payer_party_id = COALESCE(os.payer_party_id, o.client_party_id)
FROM orders o
WHERE os.order_id = o.id
  AND o.client_party_id IS NOT NULL
  AND os.client_party_id IS NULL
  AND (
    os.client_name = o.client_display_name
    OR os.client_name IS NULL
  );

-- Report: How many services were updated
SELECT 
  COUNT(*) as services_updated,
  'Services linked to party records' as description
FROM order_services
WHERE client_party_id IS NOT NULL
  AND updated_at >= NOW() - INTERVAL '1 minute';

-- STEP 3: Verification Report
SELECT 
  'Orders with client_party_id' as metric,
  COUNT(*) as count
FROM orders
WHERE client_party_id IS NOT NULL
UNION ALL
SELECT 
  'Orders without client_party_id' as metric,
  COUNT(*) as count
FROM orders
WHERE client_party_id IS NULL AND client_display_name IS NOT NULL
UNION ALL
SELECT 
  'Services with client_party_id' as metric,
  COUNT(*) as count
FROM order_services
WHERE client_party_id IS NOT NULL
UNION ALL
SELECT 
  'Services with payer_party_id' as metric,
  COUNT(*) as count
FROM order_services
WHERE payer_party_id IS NOT NULL;
