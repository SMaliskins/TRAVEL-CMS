-- Encrypted secret columns for companies (dual-read migration)
-- This migration is backward-compatible: legacy columns remain for fallback reads.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS resend_api_key_ciphertext text,
  ADD COLUMN IF NOT EXISTS openai_api_key_ciphertext text,
  ADD COLUMN IF NOT EXISTS anthropic_api_key_ciphertext text,
  ADD COLUMN IF NOT EXISTS supabase_anon_key_ciphertext text,
  ADD COLUMN IF NOT EXISTS supabase_service_role_key_ciphertext text;

COMMENT ON COLUMN public.companies.resend_api_key_ciphertext IS
  'Encrypted company Resend API key. Ciphertext format: enc:v1:<base64>';
COMMENT ON COLUMN public.companies.openai_api_key_ciphertext IS
  'Encrypted company OpenAI API key. Ciphertext format: enc:v1:<base64>';
COMMENT ON COLUMN public.companies.anthropic_api_key_ciphertext IS
  'Encrypted company Anthropic API key. Ciphertext format: enc:v1:<base64>';
COMMENT ON COLUMN public.companies.supabase_anon_key_ciphertext IS
  'Encrypted dedicated Supabase anon key. Ciphertext format: enc:v1:<base64>';
COMMENT ON COLUMN public.companies.supabase_service_role_key_ciphertext IS
  'Encrypted dedicated Supabase service-role key. Ciphertext format: enc:v1:<base64>';
