-- Company contacts: link person parties to company parties with roles
-- Roles: 'financial' (responsible for orders/payments), 'administrative' (receives correspondence)

CREATE TABLE IF NOT EXISTS company_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_party_id UUID NOT NULL REFERENCES party(id) ON DELETE CASCADE,
  contact_party_id UUID NOT NULL REFERENCES party(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('financial', 'administrative')),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_party_id, contact_party_id, role)
);

CREATE INDEX IF NOT EXISTS idx_company_contacts_company ON company_contacts(company_party_id);
CREATE INDEX IF NOT EXISTS idx_company_contacts_contact ON company_contacts(contact_party_id);

-- RLS
ALTER TABLE company_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_contacts_select" ON company_contacts
  FOR SELECT USING (true);

CREATE POLICY "company_contacts_insert" ON company_contacts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "company_contacts_update" ON company_contacts
  FOR UPDATE USING (true);

CREATE POLICY "company_contacts_delete" ON company_contacts
  FOR DELETE USING (true);
