-- Electronic Z-report journal for daily cash register reports.

CREATE TABLE IF NOT EXISTS public.z_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  report_date date NOT NULL,
  z_amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  file_name text,
  file_path text,
  file_size bigint,
  mime_type text,
  note text,
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT z_reports_company_date_unique UNIQUE (company_id, report_date)
);

ALTER TABLE public.z_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "z_reports_select_company" ON public.z_reports;
CREATE POLICY "z_reports_select_company"
  ON public.z_reports
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "z_reports_insert_company" ON public.z_reports;
CREATE POLICY "z_reports_insert_company"
  ON public.z_reports
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "z_reports_update_company" ON public.z_reports;
CREATE POLICY "z_reports_update_company"
  ON public.z_reports
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

COMMENT ON TABLE public.z_reports IS
  'Electronic journal of daily cash register Z-reports with uploaded report image/PDF.';
