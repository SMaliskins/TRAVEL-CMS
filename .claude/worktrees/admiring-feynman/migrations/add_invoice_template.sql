-- Add invoice template and accent color columns to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS invoice_template text DEFAULT 'classic';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS invoice_accent_color text DEFAULT '#1e40af';
