-- ============================================================================
-- Parse Pipeline Tables: parse_runs, parse_feedback, parse_rules
--
-- Part of the unified document parsing pipeline refactoring.
-- See PARSING_PIPELINE_SPEC.md for full architecture details.
-- ============================================================================

-- 1. parse_runs — Log of every parsing attempt
-- Used by parseWithAI.ts to track all AI parsing calls with full context.
CREATE TABLE IF NOT EXISTS parse_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'passport', 'flight_ticket', 'package_tour', 'invoice', 'company_doc', 'expense'
  )),
  provider TEXT NOT NULL, -- openai, anthropic
  model TEXT NOT NULL, -- gpt-4o, claude-sonnet-4-5, etc.
  content_mode TEXT NOT NULL CHECK (content_mode IN ('text', 'vision', 'hybrid')),
  prompt_version TEXT, -- for tracking prompt changes
  rules_applied UUID[], -- array of parse_rules.id that were injected
  validation_status TEXT NOT NULL DEFAULT 'unknown' CHECK (validation_status IN (
    'valid', 'partial', 'invalid', 'unknown'
  )),
  confidence NUMERIC(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  retry_count INTEGER DEFAULT 0,
  latency_ms INTEGER,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  estimated_cost_usd NUMERIC(10,6),
  raw_output JSONB, -- raw AI response
  normalized_output JSONB, -- after Zod parsing & normalization
  warnings TEXT[],
  error_message TEXT,
  success BOOLEAN DEFAULT true,
  -- context
  order_id UUID, -- if parsing was for a specific order
  document_id UUID, -- if linked to order_documents
  file_hash TEXT, -- SHA-256 for dedup
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parse_runs_company ON parse_runs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_parse_runs_document_type ON parse_runs(document_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_parse_runs_file_hash ON parse_runs(file_hash) WHERE file_hash IS NOT NULL;

-- RLS
ALTER TABLE parse_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own company parse runs" ON parse_runs
  FOR SELECT USING (company_id IN (
    SELECT company_id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "System can insert parse runs" ON parse_runs
  FOR INSERT WITH CHECK (true);


-- 2. parse_feedback — User corrections
-- Stores field-level corrections from users. Used to build few-shot examples
-- and auto-generate parse_rules when patterns emerge.
CREATE TABLE IF NOT EXISTS parse_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID REFERENCES parse_runs(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  field_name TEXT NOT NULL, -- e.g. "accommodation.hotelName", "travellers[0].firstName"
  old_value TEXT, -- what AI returned
  new_value TEXT, -- what user corrected to
  feedback_type TEXT DEFAULT 'correction' CHECK (feedback_type IN (
    'correction', 'missing_field', 'wrong_format', 'other'
  )),
  comment TEXT, -- optional user comment
  document_type TEXT NOT NULL CHECK (document_type IN (
    'passport', 'flight_ticket', 'package_tour', 'invoice', 'company_doc', 'expense'
  )),
  detected_operator TEXT, -- for operator-specific learning (Novatours, ANEX, etc.)
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parse_feedback_company ON parse_feedback(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_parse_feedback_run ON parse_feedback(run_id) WHERE run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_parse_feedback_field ON parse_feedback(document_type, field_name);
CREATE INDEX IF NOT EXISTS idx_parse_feedback_operator ON parse_feedback(detected_operator)
  WHERE detected_operator IS NOT NULL;

-- RLS
ALTER TABLE parse_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own company feedback" ON parse_feedback
  FOR ALL USING (company_id IN (
    SELECT company_id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "System can insert feedback" ON parse_feedback
  FOR INSERT WITH CHECK (true);


-- 3. parse_rules — Confirmed extraction/correction rules
-- Rules injected into AI prompts. Can be global (company_id IS NULL) or per-company.
-- rule_type: extraction (how to parse), correction (what to fix), validation (extra checks), fallback (alt strategy)
CREATE TABLE IF NOT EXISTS parse_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE, -- NULL = global rule
  document_type TEXT NOT NULL CHECK (document_type IN (
    'passport', 'flight_ticket', 'package_tour', 'invoice', 'company_doc', 'expense'
  )),
  rule_type TEXT NOT NULL CHECK (rule_type IN (
    'extraction', 'correction', 'validation', 'fallback'
  )),
  scope TEXT, -- operator name (e.g. "Novatours"), field name, or NULL for global
  priority INTEGER DEFAULT 100, -- lower = higher priority
  rule_text TEXT NOT NULL, -- human-readable rule to inject into prompt
  is_active BOOLEAN DEFAULT true,
  source_feedback_count INTEGER DEFAULT 0, -- how many parse_feedback entries led to this rule
  example_before TEXT, -- optional: what AI typically gets wrong
  example_after TEXT, -- optional: what the correct value should be
  created_by UUID, -- user or system
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parse_rules_lookup ON parse_rules(document_type, is_active)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_parse_rules_scope ON parse_rules(scope)
  WHERE scope IS NOT NULL;

-- RLS
ALTER TABLE parse_rules ENABLE ROW LEVEL SECURITY;

-- Global rules (company_id IS NULL) visible to all authenticated users
CREATE POLICY "Global rules visible to all" ON parse_rules
  FOR SELECT USING (
    company_id IS NULL
    OR company_id IN (
      SELECT company_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Only supervisors/admins can manage rules
CREATE POLICY "Admins manage company rules" ON parse_rules
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE user_id = auth.uid() AND role IN ('supervisor', 'admin')
    )
  );

CREATE POLICY "System can insert rules" ON parse_rules
  FOR INSERT WITH CHECK (true);


-- 4. Seed initial global extraction rules (from known operator patterns)
INSERT INTO parse_rules (company_id, document_type, rule_type, scope, priority, rule_text, is_active)
VALUES
  -- Novatours
  (NULL, 'package_tour', 'extraction', 'Novatours', 10,
   'Novatours uses comma as decimal separator: 1,478,00 = 1478.00. Always parse amounts accordingly.', true),
  (NULL, 'package_tour', 'extraction', 'Novatours', 11,
   'Novatours traveller names format: "Mrs Surname, Firstname" — strip title (Mrs/Mr/Miss), comma separates surname from firstname.', true),
  (NULL, 'package_tour', 'extraction', 'Novatours', 12,
   'Novatours flight codes starting with BT = airBaltic (NOT Bulgaria Air or other).', true),

  -- Tez Tour
  (NULL, 'package_tour', 'extraction', 'Tez Tour', 20,
   'Tez Tour: BT flight prefix = airBaltic, NOT Bulgaria Air. BT755 = airBaltic flight 755.', true),
  (NULL, 'package_tour', 'extraction', 'Tez Tour', 21,
   'Tez Tour dates are in DD.MM.YYYY format. Convert to YYYY-MM-DD. Never swap day and month.', true),

  -- ANEX
  (NULL, 'package_tour', 'extraction', 'ANEX', 30,
   'ANEX Tour: traveller names may be ALL CAPS and concatenated (e.g. "INESEELIZABETE" with surname "PAGA"). Split into sensible firstName/lastName.', true),
  (NULL, 'package_tour', 'extraction', 'ANEX', 31,
   'ANEX Tour: mealPlan "Ultra AI" = "UAI" (Ultra All Inclusive). "AI" = All Inclusive. These are DIFFERENT — do not confuse.', true),

  -- General passport
  (NULL, 'passport', 'extraction', NULL, 50,
   'European dates DD.MM.YYYY: NEVER swap day and month. 07.09 = 7 September, not 9 July.', true),
  (NULL, 'passport', 'extraction', NULL, 51,
   'Preserve EXACT diacritics from passport visual zone: ā, č, ē, ģ, ī, ķ, ļ, ņ, š, ū, ž (Latvian). Never strip diacritics.', true)
ON CONFLICT DO NOTHING;
