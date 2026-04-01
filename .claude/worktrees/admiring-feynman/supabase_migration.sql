-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. CREATE NEW TABLES
-- ============================================

-- Companies table
CREATE TABLE IF NOT EXISTS public.companies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Order access table
CREATE TABLE IF NOT EXISTS public.order_access (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id),
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    granted_by uuid REFERENCES auth.users(id),
    reason text,
    valid_from timestamptz DEFAULT now(),
    valid_to timestamptz,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT order_access_order_user_unique UNIQUE (order_id, user_id)
);

-- Invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id),
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    invoice_seq int NOT NULL,
    invoice_no text NOT NULL,
    status text NOT NULL DEFAULT 'Issued' CHECK (status IN ('Draft', 'Issued', 'Cancelled', 'Paid')),
    currency text NOT NULL DEFAULT 'EUR',
    amount_total numeric(12,2) NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT invoices_company_invoice_no_unique UNIQUE (company_id, invoice_no),
    CONSTRAINT invoices_order_seq_unique UNIQUE (order_id, invoice_seq)
);

-- Payments table
CREATE TABLE IF NOT EXISTS public.payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id),
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    invoice_id uuid REFERENCES public.invoices(id),
    method text NOT NULL CHECK (method IN ('cash', 'bank', 'card')),
    amount numeric(12,2) NOT NULL,
    currency text NOT NULL DEFAULT 'EUR',
    paid_at timestamptz DEFAULT now(),
    note text,
    created_at timestamptz DEFAULT now()
);

-- ============================================
-- 2. ALTER EXISTING TABLES - PROFILES
-- ============================================

DO $$ 
BEGIN
    -- Add company_id if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'company_id'
    ) THEN
        ALTER TABLE public.profiles 
        ADD COLUMN company_id uuid REFERENCES public.companies(id);
    END IF;

    -- Add role if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'role'
    ) THEN
        ALTER TABLE public.profiles 
        ADD COLUMN role text DEFAULT 'agent';
        
        ALTER TABLE public.profiles 
        ADD CONSTRAINT profiles_role_check 
        CHECK (role IN ('agent', 'supervisor'));
    END IF;

    -- Add initials if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'initials'
    ) THEN
        ALTER TABLE public.profiles 
        ADD COLUMN initials text;
    END IF;

    -- Add display_name if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'display_name'
    ) THEN
        ALTER TABLE public.profiles 
        ADD COLUMN display_name text;
    END IF;
END $$;

-- ============================================
-- 3. ALTER EXISTING TABLES - CLIENTS
-- ============================================

DO $$ 
BEGIN
    -- Check if clients table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'clients'
    ) THEN
        -- Add company_id if not exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'clients' 
            AND column_name = 'company_id'
        ) THEN
            ALTER TABLE public.clients 
            ADD COLUMN company_id uuid REFERENCES public.companies(id);
        END IF;
    ELSE
        -- Create clients table if not exists
        CREATE TABLE public.clients (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id uuid NOT NULL REFERENCES public.companies(id),
            created_at timestamptz DEFAULT now()
        );
    END IF;
END $$;

-- ============================================
-- 4. ALTER EXISTING TABLES - ORDERS
-- ============================================

DO $$ 
BEGIN
    -- Add company_id if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'company_id'
    ) THEN
        ALTER TABLE public.orders 
        ADD COLUMN company_id uuid REFERENCES public.companies(id);
    END IF;

    -- Add owner_user_id if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'owner_user_id'
    ) THEN
        ALTER TABLE public.orders 
        ADD COLUMN owner_user_id uuid REFERENCES auth.users(id);
    END IF;

    -- Add order_no if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'order_no'
    ) THEN
        ALTER TABLE public.orders 
        ADD COLUMN order_no int;
    END IF;

    -- Add order_year if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'order_year'
    ) THEN
        ALTER TABLE public.orders 
        ADD COLUMN order_year int;
    END IF;

    -- Add order_code if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'order_code'
    ) THEN
        ALTER TABLE public.orders 
        ADD COLUMN order_code text;
    END IF;

    -- Add order_type if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'order_type'
    ) THEN
        ALTER TABLE public.orders 
        ADD COLUMN order_type text DEFAULT 'TA';
        
        ALTER TABLE public.orders 
        ADD CONSTRAINT orders_order_type_check 
        CHECK (order_type IN ('TA', 'TO', 'CORP', 'NON'));
    END IF;

    -- Add status if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE public.orders 
        ADD COLUMN status text DEFAULT 'Active';
        
        ALTER TABLE public.orders 
        ADD CONSTRAINT orders_status_check 
        CHECK (status IN ('Draft', 'Active', 'Cancelled', 'Completed', 'On hold'));
    END IF;

    -- Add amount_total if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'amount_total'
    ) THEN
        ALTER TABLE public.orders 
        ADD COLUMN amount_total numeric(12,2) DEFAULT 0;
    END IF;

    -- Add amount_paid if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'amount_paid'
    ) THEN
        ALTER TABLE public.orders 
        ADD COLUMN amount_paid numeric(12,2) DEFAULT 0;
    END IF;

    -- Add amount_debt if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'amount_debt'
    ) THEN
        ALTER TABLE public.orders 
        ADD COLUMN amount_debt numeric(12,2) DEFAULT 0;
    END IF;

    -- Add profit_estimated if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'profit_estimated'
    ) THEN
        ALTER TABLE public.orders 
        ADD COLUMN profit_estimated numeric(12,2) DEFAULT 0;
    END IF;

    -- Add created_at if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE public.orders 
        ADD COLUMN created_at timestamptz DEFAULT now();
    END IF;

    -- Add updated_at if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.orders 
        ADD COLUMN updated_at timestamptz DEFAULT now();
    END IF;
END $$;

-- ============================================
-- 5. ADD UNIQUE CONSTRAINTS (if not exists)
-- ============================================

DO $$ 
BEGIN
    -- Add unique constraint for orders (company_id, order_year, order_no)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'orders_company_year_no_unique'
    ) THEN
        ALTER TABLE public.orders 
        ADD CONSTRAINT orders_company_year_no_unique 
        UNIQUE (company_id, order_year, order_no);
    END IF;

    -- Add unique constraint for orders (company_id, order_code)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'orders_company_code_unique'
    ) THEN
        ALTER TABLE public.orders 
        ADD CONSTRAINT orders_company_code_unique 
        UNIQUE (company_id, order_code);
    END IF;
END $$;

-- ============================================
-- 6. CREATE INDEXES
-- ============================================

-- Indexes on company_id
CREATE INDEX IF NOT EXISTS idx_companies_id ON public.companies(id);
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_company_id ON public.clients(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_company_id ON public.orders(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_access_company_id ON public.order_access(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON public.invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_company_id ON public.payments(company_id);

-- Additional indexes for orders
CREATE INDEX IF NOT EXISTS idx_orders_updated_at ON public.orders(updated_at) WHERE updated_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_date_from ON public.orders(date_from) WHERE date_from IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_date_to ON public.orders(date_to) WHERE date_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status) WHERE status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON public.orders(order_type) WHERE order_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_owner_user_id ON public.orders(owner_user_id) WHERE owner_user_id IS NOT NULL;

