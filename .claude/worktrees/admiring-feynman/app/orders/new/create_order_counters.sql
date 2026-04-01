-- Optional: Create order_counters table for order code generation
-- This provides a transactional way to generate unique order codes without race conditions
-- If this table doesn't exist, the API route will fall back to querying the orders table

CREATE TABLE IF NOT EXISTS public.order_counters (
  year INTEGER PRIMARY KEY,
  seq INTEGER NOT NULL DEFAULT 1
);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.order_counters TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.order_counters TO anon;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_order_counters_year ON public.order_counters(year);

-- Optional: Insert initial counter for current year
-- INSERT INTO public.order_counters (year, seq) VALUES (EXTRACT(YEAR FROM NOW())::INTEGER, 1)
-- ON CONFLICT (year) DO NOTHING;

