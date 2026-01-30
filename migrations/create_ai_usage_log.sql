-- Migration: Create ai_usage_log table for tracking AI API usage per company
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  operation text NOT NULL, -- 'parse_flight', 'parse_package_tour', etc.
  model text NOT NULL, -- 'gpt-4o', 'gpt-4o-mini', etc.
  input_tokens integer DEFAULT 0,
  output_tokens integer DEFAULT 0,
  total_tokens integer DEFAULT 0,
  estimated_cost_usd numeric(10,6) DEFAULT 0, -- Estimated cost in USD
  success boolean DEFAULT true,
  error_message text,
  metadata jsonb DEFAULT '{}', -- Additional info like file size, parsing type
  created_at timestamp with time zone DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_company_id ON public.ai_usage_log(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_created_at ON public.ai_usage_log(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_company_created ON public.ai_usage_log(company_id, created_at);

-- Comments
COMMENT ON TABLE public.ai_usage_log IS 'Tracks AI API usage (OpenAI) per company for billing purposes';
COMMENT ON COLUMN public.ai_usage_log.operation IS 'Type of AI operation: parse_flight, parse_package_tour, etc.';
COMMENT ON COLUMN public.ai_usage_log.estimated_cost_usd IS 'Estimated cost based on OpenAI pricing at time of call';

-- RLS policies
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

-- Users can only view their own company's usage
CREATE POLICY "Users can view own company usage"
  ON public.ai_usage_log FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  ));

-- Only service role can insert (API routes use service role)
CREATE POLICY "Service role can insert usage logs"
  ON public.ai_usage_log FOR INSERT
  WITH CHECK (true);
