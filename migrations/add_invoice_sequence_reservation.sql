-- Reserve invoice numbers atomically so parallel requests never get the same range.
-- Table: last allocated sequence per company/year. Function: lock row, reserve next N numbers.

CREATE TABLE IF NOT EXISTS public.invoice_sequence (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  year text NOT NULL,
  last_sequence int NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, year)
);

COMMENT ON TABLE public.invoice_sequence IS 'Last allocated invoice sequence per company/year for atomic reservation';

CREATE OR REPLACE FUNCTION public.reserve_invoice_sequences(
  p_company_id uuid,
  p_year text,
  p_count int,
  p_min_sequence int DEFAULT 0
)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_current int;
  v_start int;
BEGIN
  IF p_count < 1 OR p_count > 100 THEN
    RAISE EXCEPTION 'reserve_invoice_sequences: count must be between 1 and 100';
  END IF;

  INSERT INTO public.invoice_sequence (company_id, year, last_sequence)
  VALUES (p_company_id, p_year, 0)
  ON CONFLICT (company_id, year) DO NOTHING;

  SELECT last_sequence INTO v_current
  FROM public.invoice_sequence
  WHERE company_id = p_company_id AND year = p_year
  FOR UPDATE;

  v_start := GREATEST(COALESCE(v_current, 0), p_min_sequence) + 1;

  UPDATE public.invoice_sequence
  SET last_sequence = v_start + p_count - 1
  WHERE company_id = p_company_id AND year = p_year;

  RETURN v_start;
END;
$$;

COMMENT ON FUNCTION public.reserve_invoice_sequences IS 'Reserves next p_count invoice sequence numbers for company/year; returns first sequence. Uses row lock to prevent parallel allocation.';
