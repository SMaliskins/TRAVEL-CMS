-- Migration: Add order_source and order_type columns to orders table if missing
-- Run this in Supabase SQL Editor

-- Add order_source column (TA/TO/CORP/NON)
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS order_source text DEFAULT 'TA';

COMMENT ON COLUMN public.orders.order_source IS 'Order source type: TA (Travel Agent), TO (Tour Operator), CORP (Corporate), NON (Direct)';

-- Add order_type column (leisure/business/lifestyle) if it doesn't exist with the correct type
DO $$ 
BEGIN
    -- Check if column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'order_type'
    ) THEN
        ALTER TABLE public.orders 
        ADD COLUMN order_type text DEFAULT 'leisure';
    END IF;
END $$;

COMMENT ON COLUMN public.orders.order_type IS 'Order type: leisure, business, lifestyle';

-- Create indexes for filtering
CREATE INDEX IF NOT EXISTS idx_orders_order_source 
ON public.orders(order_source) WHERE order_source IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_order_type 
ON public.orders(order_type) WHERE order_type IS NOT NULL;
