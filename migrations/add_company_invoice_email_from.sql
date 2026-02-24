-- Migration: Add invoice_email_from to companies (email address for sending invoices)
-- Run in Supabase SQL Editor. Resend: domain must be verified for this address.

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS invoice_email_from text;

COMMENT ON COLUMN public.companies.invoice_email_from IS 'Email address used as "From" when sending invoices (e.g. invoices@company.com). Display name = company name. Domain must be verified in Resend.';
