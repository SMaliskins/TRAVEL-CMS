-- Migration: Add payer and payment terms fields to invoices table
-- Run this in Supabase SQL Editor

-- Add payer fields
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

-- Add payment terms fields
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS deposit_amount numeric(12,2),
ADD COLUMN IF NOT EXISTS deposit_date date,
ADD COLUMN IF NOT EXISTS final_payment_amount numeric(12,2),
ADD COLUMN IF NOT EXISTS final_payment_date date;

-- Add processed fields for accounting
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS processed_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS processed_at timestamptz;

-- Update status constraint to include 'processed'
ALTER TABLE public.invoices
DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE public.invoices
ADD CONSTRAINT invoices_status_check 
CHECK (status IN ('draft', 'sent', 'paid', 'cancelled', 'overdue', 'processed'));

-- Add service_client to invoice_items
ALTER TABLE public.invoice_items
ADD COLUMN IF NOT EXISTS service_client text;

-- Comments
COMMENT ON COLUMN public.invoices.payer_name IS 'Payer name (Bill To)';
COMMENT ON COLUMN public.invoices.payer_type IS 'Payer type: company or person';
COMMENT ON COLUMN public.invoices.deposit_amount IS 'Deposit amount for payment terms';
COMMENT ON COLUMN public.invoices.deposit_date IS 'Deposit due date';
COMMENT ON COLUMN public.invoices.final_payment_amount IS 'Final payment amount (remaining)';
COMMENT ON COLUMN public.invoices.final_payment_date IS 'Final payment due date';
COMMENT ON COLUMN public.invoice_items.service_client IS 'Client name for this service line';
