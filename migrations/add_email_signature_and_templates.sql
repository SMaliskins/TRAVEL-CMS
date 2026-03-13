-- Add email_signature column to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email_signature TEXT;

-- Email templates table (per-company, reusable)
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,

  -- Template metadata
  name TEXT NOT NULL,                    -- e.g. "Hotel Confirmation", "Payment Reminder"
  category TEXT NOT NULL DEFAULT 'custom', -- invoice, payment_reminder, hotel, self_reminder, client_reminder, birthday, partner_notification, custom
  subject TEXT NOT NULL DEFAULT '',       -- Subject template (supports {{variables}})
  body TEXT NOT NULL DEFAULT '',          -- Body HTML (supports {{variables}})
  is_default BOOLEAN DEFAULT false,      -- Company-wide default for this category
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_templates_company ON email_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates(category);

-- RLS
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company templates"
  ON email_templates FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their company templates"
  ON email_templates FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );
