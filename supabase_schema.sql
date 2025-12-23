-- 1. companies
CREATE TABLE companies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- 2. profiles
CREATE TABLE profiles (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    role text NOT NULL DEFAULT 'agent' CHECK (role IN ('agent', 'supervisor')),
    initials text,
    display_name text,
    created_at timestamptz DEFAULT now()
);

-- 3. orders
CREATE TABLE orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id),
    owner_user_id uuid NOT NULL REFERENCES auth.users(id),
    order_no int NOT NULL,
    order_year int NOT NULL,
    order_code text NOT NULL,
    order_type text NOT NULL DEFAULT 'TA' CHECK (order_type IN ('TA', 'TO', 'CORP', 'NON')),
    status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Draft', 'Active', 'Cancelled', 'Completed', 'On hold')),
    client_display_name text,
    countries_cities text,
    date_from date,
    date_to date,
    amount_total numeric(12,2) NOT NULL DEFAULT 0,
    amount_paid numeric(12,2) NOT NULL DEFAULT 0,
    amount_debt numeric(12,2) NOT NULL DEFAULT 0,
    profit_estimated numeric(12,2) NOT NULL DEFAULT 0,
    updated_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    UNIQUE(company_id, order_year, order_no),
    UNIQUE(company_id, order_code)
);

-- 4. order_access
CREATE TABLE order_access (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id),
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    granted_by uuid REFERENCES auth.users(id),
    reason text,
    valid_from timestamptz DEFAULT now(),
    valid_to timestamptz,
    created_at timestamptz DEFAULT now(),
    UNIQUE(order_id, user_id)
);

-- 5. invoices
CREATE TABLE invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id),
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    invoice_seq int NOT NULL,
    invoice_no text NOT NULL,
    status text NOT NULL DEFAULT 'Issued' CHECK (status IN ('Draft', 'Issued', 'Cancelled', 'Paid')),
    currency text NOT NULL DEFAULT 'EUR',
    amount_total numeric(12,2) NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(company_id, invoice_no),
    UNIQUE(order_id, invoice_seq)
);

-- 6. payments
CREATE TABLE payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id),
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    invoice_id uuid REFERENCES invoices(id),
    method text NOT NULL CHECK (method IN ('cash', 'bank', 'card')),
    amount numeric(12,2) NOT NULL,
    currency text NOT NULL DEFAULT 'EUR',
    paid_at timestamptz DEFAULT now(),
    note text,
    created_at timestamptz DEFAULT now()
);

-- Indexes on company_id
CREATE INDEX idx_orders_company_id ON orders(company_id);
CREATE INDEX idx_order_access_company_id ON order_access(company_id);
CREATE INDEX idx_invoices_company_id ON invoices(company_id);
CREATE INDEX idx_payments_company_id ON payments(company_id);

-- Additional indexes for orders
CREATE INDEX idx_orders_updated_at ON orders(updated_at);
CREATE INDEX idx_orders_date_from ON orders(date_from);
CREATE INDEX idx_orders_date_to ON orders(date_to);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_order_type ON orders(order_type);
CREATE INDEX idx_orders_owner_user_id ON orders(owner_user_id);

