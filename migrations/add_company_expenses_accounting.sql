-- Adds accountant workflow ("Process") to company expenses, mirroring the
-- pattern already used by /finances/invoices and /finances/suppliers-invoices.
--
-- Company expenses are not linked to order services, so we don't need the
-- attention/replaced/changed states. A simple pending → processed toggle
-- is enough; cancelling a processed expense reverts to pending.

ALTER TABLE public.company_expense_invoices
  ADD COLUMN IF NOT EXISTS accounting_state text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS accounting_processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS accounting_processed_by uuid;

ALTER TABLE public.company_expense_invoices
  DROP CONSTRAINT IF EXISTS company_expense_invoices_accounting_state_check,
  ADD CONSTRAINT company_expense_invoices_accounting_state_check
    CHECK (accounting_state IN ('pending', 'processed'));

CREATE INDEX IF NOT EXISTS idx_company_expense_invoices_accounting_state
  ON public.company_expense_invoices (company_id, accounting_state);

COMMENT ON COLUMN public.company_expense_invoices.accounting_state IS
  'Accountant workflow state: pending until reviewed, processed once posted to accounting.';
COMMENT ON COLUMN public.company_expense_invoices.accounting_processed_at IS
  'Timestamp when an accountant marked the expense as processed.';
COMMENT ON COLUMN public.company_expense_invoices.accounting_processed_by IS
  'auth.users.id of the accountant who flipped the expense to processed.';
