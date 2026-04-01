-- Migration: Add per-company email configuration (Resend API key + domain verification status)
-- Each company provides their own Resend API key and verified domain for email sending.

ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS resend_api_key text;

ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS email_domain_verified boolean DEFAULT false;

COMMENT ON COLUMN public.companies.resend_api_key IS 'Company-specific Resend API key for sending emails. Each company registers at resend.com and provides their own key.';
COMMENT ON COLUMN public.companies.email_domain_verified IS 'Whether the company email domain has been verified in Resend (DNS records configured).';
