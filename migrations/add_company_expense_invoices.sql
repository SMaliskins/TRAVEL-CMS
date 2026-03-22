-- Company expense invoices: utility bills, insurance, etc. (not linked to orders).
-- Visible only to Supervisor and Finance users.
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.company_expense_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  supplier text NOT NULL DEFAULT '',
  invoice_date date NOT NULL,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  description text,

  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_company_expense_invoices_company_id ON public.company_expense_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_company_expense_invoices_invoice_date ON public.company_expense_invoices(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_company_expense_invoices_created_at ON public.company_expense_invoices(created_at DESC);

ALTER TABLE public.company_expense_invoices ENABLE ROW LEVEL SECURITY;

-- Only Supervisor and Finance can see and edit (same company)
CREATE POLICY "Company expense invoices: supervisor/finance select"
  ON public.company_expense_invoices FOR SELECT
  USING (
    company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
    AND (SELECT r.name FROM public.user_profiles up JOIN public.roles r ON r.id = up.role_id WHERE up.id = auth.uid()) IN ('supervisor', 'finance')
  );

CREATE POLICY "Company expense invoices: supervisor/finance insert"
  ON public.company_expense_invoices FOR INSERT
  WITH CHECK (
    company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
    AND (SELECT r.name FROM public.user_profiles up JOIN public.roles r ON r.id = up.role_id WHERE up.id = auth.uid()) IN ('supervisor', 'finance')
  );

CREATE POLICY "Company expense invoices: supervisor/finance update"
  ON public.company_expense_invoices FOR UPDATE
  USING (
    company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
    AND (SELECT r.name FROM public.user_profiles up JOIN public.roles r ON r.id = up.role_id WHERE up.id = auth.uid()) IN ('supervisor', 'finance')
  );

CREATE POLICY "Company expense invoices: supervisor/finance delete"
  ON public.company_expense_invoices FOR DELETE
  USING (
    company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
    AND (SELECT r.name FROM public.user_profiles up JOIN public.roles r ON r.id = up.role_id WHERE up.id = auth.uid()) IN ('supervisor', 'finance')
  );

COMMENT ON TABLE public.company_expense_invoices IS 'Company expense invoices (utilities, insurance, etc.) — not linked to orders. Supervisor/Finance only.';
