-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. SERVICE CATEGORIES
-- ============================================

CREATE TABLE IF NOT EXISTS public.service_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id),
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 2. SUPPLIERS
-- ============================================

CREATE TABLE IF NOT EXISTS public.suppliers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id),
    name text NOT NULL,
    contact_person text,
    email text,
    phone text,
    address text,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 3. SUPPLIER COMMISSIONS
-- ============================================

CREATE TABLE IF NOT EXISTS public.supplier_commissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id),
    supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    service_category_id uuid REFERENCES public.service_categories(id),
    commission_rate numeric(5,2) NOT NULL,
    commission_type text NOT NULL DEFAULT 'percentage' CHECK (commission_type IN ('percentage', 'fixed')),
    valid_from date,
    valid_to date,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 4. CLIENT TRAVELLERS
-- ============================================

CREATE TABLE IF NOT EXISTS public.client_travellers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id),
    client_id uuid REFERENCES public.clients(id),
    first_name text NOT NULL,
    last_name text NOT NULL,
    date_of_birth date,
    passport_number text,
    passport_expiry date,
    nationality text,
    email text,
    phone text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 5. ORDER SERVICES
-- ============================================

CREATE TABLE IF NOT EXISTS public.order_services (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id),
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    service_category_id uuid REFERENCES public.service_categories(id),
    supplier_id uuid REFERENCES public.suppliers(id),
    service_name text NOT NULL,
    service_date_from date,
    service_date_to date,
    quantity int DEFAULT 1,
    unit_price numeric(12,2) DEFAULT 0,
    total_price numeric(12,2) DEFAULT 0,
    commission_rate numeric(5,2),
    commission_amount numeric(12,2) DEFAULT 0,
    status text DEFAULT 'Active' CHECK (status IN ('Draft', 'Active', 'Cancelled', 'Completed')),
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 6. SERVICE DOCUMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS public.service_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id),
    service_id uuid NOT NULL REFERENCES public.order_services(id) ON DELETE CASCADE,
    document_type text NOT NULL,
    document_name text NOT NULL,
    file_url text,
    file_size bigint,
    mime_type text,
    uploaded_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

-- Indexes on company_id
CREATE INDEX IF NOT EXISTS idx_service_categories_company_id ON public.service_categories(company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_company_id ON public.suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_supplier_commissions_company_id ON public.supplier_commissions(company_id);
CREATE INDEX IF NOT EXISTS idx_client_travellers_company_id ON public.client_travellers(company_id);
CREATE INDEX IF NOT EXISTS idx_order_services_company_id ON public.order_services(company_id);
CREATE INDEX IF NOT EXISTS idx_service_documents_company_id ON public.service_documents(company_id);

-- Indexes on order_id and service_id
CREATE INDEX IF NOT EXISTS idx_order_services_order_id ON public.order_services(order_id);
CREATE INDEX IF NOT EXISTS idx_service_documents_service_id ON public.service_documents(service_id);

-- Additional useful indexes
CREATE INDEX IF NOT EXISTS idx_supplier_commissions_supplier_id ON public.supplier_commissions(supplier_id);
CREATE INDEX IF NOT EXISTS idx_client_travellers_client_id ON public.client_travellers(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_services_service_category_id ON public.order_services(service_category_id) WHERE service_category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_services_supplier_id ON public.order_services(supplier_id) WHERE supplier_id IS NOT NULL;

