-- Check if order_type and order_source columns exist in orders table

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'orders'
  AND column_name IN ('order_type', 'order_source')
ORDER BY column_name;

-- If columns don't exist, run this migration:
-- ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_source text;
-- ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_type text;
