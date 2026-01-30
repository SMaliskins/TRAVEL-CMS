-- Migration: Add payment terms fields to invoices table
-- Run this in Supabase SQL Editor if deposit_amount column doesn't exist

-- Add payment terms fields
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS deposit_amount numeric(12,2),
ADD COLUMN IF NOT EXISTS deposit_date date,
ADD COLUMN IF NOT EXISTS final_payment_amount numeric(12,2),
ADD COLUMN IF NOT EXISTS final_payment_date date;

-- Add payer fields if they don't exist
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS payer_party_id uuid REFERENCES public.party(id),
ADD COLUMN IF NOT EXISTS payer_name text,
ADD COLUMN IF NOT EXISTS payer_type text CHECK (payer_type IN ('company', 'person')),
ADD COLUMN IF NOT EXISTS payer_address text,
ADD COLUMN IF NOT EXISTS payer_email text,
ADD COLUMN IF NOT EXISTS payer_phone text,
ADD COLUMN IF NOT EXISTS payer_reg_nr text,
ADD COLUMN IF NOT EXISTS payer_vat_nr text,
ADD COLUMN IF NOT EXISTS payer_personal_code text,
ADD COLUMN IF NOT EXISTS payer_bank_name text,
ADD COLUMN IF NOT EXISTS payer_bank_account text,
ADD COLUMN IF NOT EXISTS payer_bank_swift text;

-- Add service_client to invoice_items if it doesn't exist
ALTER TABLE public.invoice_items
ADD COLUMN IF NOT EXISTS service_client text;

-- Comments
COMMENT ON COLUMN public.invoices.deposit_amount IS 'Deposit amount for payment terms';
COMMENT ON COLUMN public.invoices.deposit_date IS 'Deposit due date';
COMMENT ON COLUMN public.invoices.final_payment_amount IS 'Final payment amount (remaining)';
COMMENT ON COLUMN public.invoices.final_payment_date IS 'Final payment due date';
COMMENT ON COLUMN public.invoice_items.service_client IS 'Client name for this service line';
