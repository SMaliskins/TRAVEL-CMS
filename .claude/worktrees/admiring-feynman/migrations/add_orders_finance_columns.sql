-- Migration: Add finance columns to orders table (if missing)
-- Run this in Supabase SQL Editor

DO $$ 
BEGIN
    -- Add amount if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'amount'
    ) THEN
        ALTER TABLE public.orders 
        ADD COLUMN amount numeric(12,2) DEFAULT 0;
        
        COMMENT ON COLUMN public.orders.amount IS 'Total order amount (sum of all services client_price)';
    END IF;

    -- Add paid if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'paid'
    ) THEN
        ALTER TABLE public.orders 
        ADD COLUMN paid numeric(12,2) DEFAULT 0;
        
        COMMENT ON COLUMN public.orders.paid IS 'Amount already paid by client';
    END IF;

    -- Add due_date if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'due_date'
    ) THEN
        ALTER TABLE public.orders 
        ADD COLUMN due_date date;
        
        COMMENT ON COLUMN public.orders.due_date IS 'Payment due date';
    END IF;
END $$;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_orders_due_date 
ON public.orders(due_date) WHERE due_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_amount 
ON public.orders(amount) WHERE amount > 0;

