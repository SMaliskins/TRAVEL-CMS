-- Migration: Add client_display_name and countries_cities to orders
-- Run this in Supabase SQL Editor

DO $$ 
BEGIN
    -- Add client_display_name if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'client_display_name'
    ) THEN
        ALTER TABLE public.orders 
        ADD COLUMN client_display_name text;
        
        COMMENT ON COLUMN public.orders.client_display_name IS 'Client name for display purposes';
    END IF;

    -- Add countries_cities if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'countries_cities'
    ) THEN
        ALTER TABLE public.orders 
        ADD COLUMN countries_cities text;
        
        COMMENT ON COLUMN public.orders.countries_cities IS 'Comma-separated list of countries and cities';
    END IF;

    -- Add date_from if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'date_from'
    ) THEN
        ALTER TABLE public.orders 
        ADD COLUMN date_from date;
    END IF;

    -- Add date_to if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'date_to'
    ) THEN
        ALTER TABLE public.orders 
        ADD COLUMN date_to date;
    END IF;
END $$;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_orders_client_display_name ON public.orders(client_display_name) WHERE client_display_name IS NOT NULL;
