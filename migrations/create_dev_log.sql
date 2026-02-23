-- Migration: Create dev_log table for bug reporting (Ctrl+E)
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.dev_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  reported_by uuid REFERENCES auth.users(id),
  reporter_name text,
  page_url text NOT NULL,
  comment text,
  screenshot_url text,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id),
  resolution_note text
);

CREATE INDEX IF NOT EXISTS idx_dev_log_company_id ON public.dev_log(company_id);
CREATE INDEX IF NOT EXISTS idx_dev_log_status ON public.dev_log(status);

-- Storage bucket for screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('dev-log', 'dev-log', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload screenshots
CREATE POLICY "Authenticated users can upload dev-log screenshots"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'dev-log');

-- Allow public read access for screenshot previews
CREATE POLICY "Public read access for dev-log screenshots"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'dev-log');
