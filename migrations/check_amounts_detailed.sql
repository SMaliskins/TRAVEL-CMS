-- Check all amount fields for Bogdans orders
SELECT 
  o.order_code,
  o.amount_total,
  o.amount_paid,
  o.amount_debt,
  SUM(os.client_price) as calculated_total,
  (o.amount_total - o.amount_paid) as calculated_debt
FROM orders o
LEFT JOIN order_services os ON os.order_id = o.id AND os.res_status != 'cancelled'
WHERE o.id IN (
  SELECT DISTINCT order_id
  FROM order_services
  WHERE payer_party_id = '8a2712aa-7702-4bff-b399-7977c30999a5'
)
GROUP BY o.order_code, o.amount_total, o.amount_paid, o.amount_debt
ORDER BY o.order_code;
