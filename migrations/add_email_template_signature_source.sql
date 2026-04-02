-- Per-template: use company-wide or sender personal signature when sending
ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS email_signature_source TEXT DEFAULT 'personal';

UPDATE email_templates
SET email_signature_source = 'personal'
WHERE email_signature_source IS NULL OR email_signature_source NOT IN ('personal', 'company');

ALTER TABLE email_templates
  ALTER COLUMN email_signature_source SET DEFAULT 'personal';

ALTER TABLE email_templates
  ALTER COLUMN email_signature_source SET NOT NULL;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS email_signature TEXT;
