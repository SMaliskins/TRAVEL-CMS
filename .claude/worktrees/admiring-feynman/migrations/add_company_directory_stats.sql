-- ============================================
-- company_directory_stats — pre-computed stats per company
-- ============================================
-- Stats are updated on create/update/delete of directory records.
-- Dashboard reads from this table instead of recalculating.
-- ============================================

CREATE TABLE IF NOT EXISTS company_directory_stats (
  company_id uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  clients_count integer NOT NULL DEFAULT 0,
  suppliers_count integer NOT NULL DEFAULT 0,
  subagents_count integer NOT NULL DEFAULT 0,
  clients_by_nationality jsonb NOT NULL DEFAULT '[]'::jsonb,
  suppliers_by_country jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE company_directory_stats IS 'Pre-computed directory statistics per company. Updated on create/update/delete.';
COMMENT ON COLUMN company_directory_stats.clients_by_nationality IS 'Array of {country, count} sorted by count desc';
COMMENT ON COLUMN company_directory_stats.suppliers_by_country IS 'Array of {country, count} sorted by count desc';
