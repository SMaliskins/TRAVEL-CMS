-- Check amount_debt for orders where Bogdans is payer

SELECT 
  o.order_code,
  o.amount_debt,
  o.amount_paid,
  COUNT(DISTINCT os.id) as services_count
FROM orders o
LEFT JOIN order_services os ON os.order_id = o.id
WHERE o.id IN (
  SELECT DISTINCT order_id
  FROM order_services
  WHERE payer_party_id = '8a2712aa-7702-4bff-b399-7977c30999a5'
)
GROUP BY o.order_code, o.amount_debt, o.amount_paid
ORDER BY o.order_code;

-- Total debt
SELECT 
  SUM(o.amount_debt) as total_debt
FROM orders o
WHERE o.id IN (
  SELECT DISTINCT order_id
  FROM order_services
  WHERE payer_party_id = '8a2712aa-7702-4bff-b399-7977c30999a5'
);
