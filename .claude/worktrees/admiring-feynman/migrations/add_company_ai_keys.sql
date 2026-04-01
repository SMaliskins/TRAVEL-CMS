-- Per-company AI API keys for multi-tenant AI parsing
-- Companies can configure their own keys; falls back to global env key if not set

ALTER TABLE companies ADD COLUMN IF NOT EXISTS openai_api_key_encrypted text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS anthropic_api_key_encrypted text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS ai_model_preference text DEFAULT 'auto';
