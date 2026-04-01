-- ============================================
-- Add missing fields to orders table
-- ============================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ 
BEGIN
    -- Add order_payment_status if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'order_payment_status'
    ) THEN
        ALTER TABLE public.orders 
        ADD COLUMN order_payment_status text DEFAULT 'none' 
        CHECK (order_payment_status IN ('none', 'partial', 'full'));
        
        COMMENT ON COLUMN public.orders.order_payment_status IS 'Payment status: none, partial, or full';
    END IF;

    -- Add all_services_invoiced if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'all_services_invoiced'
    ) THEN
        ALTER TABLE public.orders 
        ADD COLUMN all_services_invoiced boolean DEFAULT false;
        
        COMMENT ON COLUMN public.orders.all_services_invoiced IS 'Indicates if all services in this order have been invoiced';
    END IF;

    -- Add client_payment_due_date if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'client_payment_due_date'
    ) THEN
        ALTER TABLE public.orders 
        ADD COLUMN client_payment_due_date date;
        
        COMMENT ON COLUMN public.orders.client_payment_due_date IS 'Payment due date for the client';
    END IF;

    -- Add order_date if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'order_date'
    ) THEN
        ALTER TABLE public.orders 
        ADD COLUMN order_date date;
        
        COMMENT ON COLUMN public.orders.order_date IS 'Date when the order was placed';
    END IF;
END $$;

-- ============================================
-- CREATE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(order_payment_status) WHERE order_payment_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_all_services_invoiced ON public.orders(all_services_invoiced) WHERE all_services_invoiced IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_client_payment_due_date ON public.orders(client_payment_due_date) WHERE client_payment_due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON public.orders(order_date) WHERE order_date IS NOT NULL;

-- ============================================
-- OPTIONAL: Update existing orders with calculated values
-- ============================================

-- Update order_payment_status based on amount_paid and amount_total
UPDATE public.orders
SET order_payment_status = CASE
    WHEN amount_total > 0 AND amount_paid >= amount_total THEN 'full'
    WHEN amount_paid > 0 AND amount_paid < amount_total THEN 'partial'
    ELSE 'none'
END
WHERE order_payment_status IS NULL OR order_payment_status = 'none';

-- Set order_date to created_at if order_date is NULL and created_at exists
UPDATE public.orders
SET order_date = created_at::date
WHERE order_date IS NULL AND created_at IS NOT NULL;

-- ============================================
-- Migration complete!
-- ============================================

