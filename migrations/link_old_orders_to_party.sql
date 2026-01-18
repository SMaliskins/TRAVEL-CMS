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
    p.display_name as party_display_name,
    ROW_NUMBER() OVER (PARTITION BY o.id ORDER BY 
      CASE 
        WHEN p.display_name = o.client_display_name THEN 1
        ELSE 2
      END
    ) as match_rank
  FROM orders o
  LEFT JOIN party p ON (
    -- Match 1: Exact display_name match
    p.display_name = o.client_display_name
    OR
    -- Match 2: Match on person first_name + last_name
    EXISTS (
      SELECT 1 FROM party_person pp
      WHERE pp.party_id = p.id
      AND CONCAT(pp.first_name, ' ', pp.last_name) = o.client_display_name
    )
    OR
    -- Match 3: Match on company name
    EXISTS (
      SELECT 1 FROM party_company pc
      WHERE pc.party_id = p.id
      AND pc.company_name = o.client_display_name
    )
  )
  WHERE o.client_party_id IS NULL
    AND o.client_display_name IS NOT NULL
    AND p.id IS NOT NULL
    -- Ensure client role exists (check in client_party table)
    AND EXISTS (
      SELECT 1 FROM client_party cp
      WHERE cp.party_id = p.id
    )
)
UPDATE orders o
SET client_party_id = mp.party_id
FROM matched_parties mp
WHERE o.id = mp.order_id
  AND mp.match_rank = 1;

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
