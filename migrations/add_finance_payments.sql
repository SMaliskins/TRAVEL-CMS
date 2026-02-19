-- Migration: Finance Payments Module
-- Date: 2026-02-18
-- Description: Add company_bank_accounts table and extend payments table

-- 1. Company Bank Accounts
CREATE TABLE IF NOT EXISTS company_bank_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    account_name text NOT NULL,
    bank_name text,
    iban text,
    swift text,
    currency text NOT NULL DEFAULT 'EUR',
    is_default boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_company_bank_accounts_company ON company_bank_accounts(company_id);

-- RLS
ALTER TABLE company_bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_bank_accounts_tenant_isolation"
    ON company_bank_accounts
    FOR ALL
    USING (company_id IN (
        SELECT p.company_id FROM profiles p WHERE p.user_id = auth.uid()
    ));

-- 2. Extend payments table with account_id, payer_name, payer_party_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payments' AND column_name = 'account_id'
    ) THEN
        ALTER TABLE payments ADD COLUMN account_id uuid REFERENCES company_bank_accounts(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payments' AND column_name = 'payer_name'
    ) THEN
        ALTER TABLE payments ADD COLUMN payer_name text;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payments' AND column_name = 'payer_party_id'
    ) THEN
        ALTER TABLE payments ADD COLUMN payer_party_id uuid;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payments_account_id ON payments(account_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at);
CREATE INDEX IF NOT EXISTS idx_payments_method ON payments(method);
