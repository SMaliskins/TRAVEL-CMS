-- A2: Orders list amount / profit (net of VAT) / VAT on margin — same rules as lib/orders/serviceEconomics.ts
-- Apply via Supabase SQL Editor or migration runner. API falls back to JS if RPC missing.

CREATE OR REPLACE FUNCTION public.category_uses_commission_adjusted_net_cost(p_category text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  c text;
BEGIN
  c := lower(btrim(regexp_replace(coalesce(p_category, ''), '\s+', ' ', 'g')));
  IF c = '' THEN
    RETURN false;
  END IF;
  RETURN (
    c LIKE '%tour%' OR c LIKE '%package%'
    OR c LIKE '%insurance%' OR c LIKE '%страхов%'
    OR c LIKE '%ancillary%'
    OR c LIKE '%cruise%'
    OR c LIKE '%rent a car%' OR c LIKE '%rent_a_car%' OR c LIKE '%car rental%'
    OR c LIKE '%transfer%'
    OR (c LIKE '%airport%' AND c LIKE '%service%')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_vat_rate_percent(p_vat_rate numeric, p_category text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  c text;
BEGIN
  IF p_vat_rate IS NOT NULL AND p_vat_rate >= 0 THEN
    RETURN p_vat_rate;
  END IF;
  c := lower(coalesce(p_category, ''));
  IF c ~* 'flight' OR c ~* 'air ticket' THEN
    RETURN 0;
  END IF;
  RETURN 21;
END;
$$;

CREATE OR REPLACE FUNCTION public.orders_list_service_economics(
  p_company_id uuid,
  p_order_ids uuid[]
)
RETURNS TABLE (
  order_id uuid,
  amount_sum numeric,
  profit_sum numeric,
  vat_sum numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      s.order_id,
      s.category,
      s.service_type,
      s.vat_rate,
      CASE
        WHEN s.service_type = 'cancellation' THEN -abs(COALESCE(s.client_price, 0)::numeric)
        ELSE COALESCE(s.client_price, 0)::numeric
      END AS cp,
      CASE
        WHEN s.service_type = 'cancellation' THEN -abs(COALESCE(s.service_price, 0)::numeric)
        ELSE COALESCE(s.service_price, 0)::numeric
      END AS sp,
      CASE
        WHEN s.service_type = 'cancellation' THEN -abs(COALESCE(s.commission_amount, 0)::numeric)
        ELSE COALESCE(s.commission_amount, 0)::numeric
      END AS comm
    FROM public.order_services s
    WHERE s.company_id = p_company_id
      AND s.order_id = ANY (p_order_ids)
  ),
  marg AS (
    SELECT
      b.order_id,
      b.cp,
      CASE
        WHEN public.category_uses_commission_adjusted_net_cost(b.category)
        THEN b.cp - (b.sp - b.comm)
        ELSE b.cp - b.sp
      END AS margin_gross,
      public.resolve_vat_rate_percent(b.vat_rate, b.category) AS vat_pct
    FROM base b
  ),
  lines AS (
    SELECT
      m.order_id,
      m.cp,
      CASE
        WHEN m.vat_pct > 0 AND m.margin_gross >= 0
        THEN round((m.margin_gross * m.vat_pct / (100.0 + m.vat_pct))::numeric, 2)
        ELSE 0::numeric
      END AS vat_line,
      m.margin_gross
    FROM marg m
  )
  SELECT
    l.order_id,
    sum(l.cp) AS amount_sum,
    sum(l.margin_gross - l.vat_line) AS profit_sum,
    sum(l.vat_line) AS vat_sum
  FROM lines l
  GROUP BY l.order_id;
$$;

COMMENT ON FUNCTION public.orders_list_service_economics(uuid, uuid[]) IS
  'Aggregates list-row economics per order (matches computeServiceLineEconomics in Node).';

GRANT EXECUTE ON FUNCTION public.category_uses_commission_adjusted_net_cost(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_vat_rate_percent(numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.orders_list_service_economics(uuid, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.category_uses_commission_adjusted_net_cost(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_vat_rate_percent(numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.orders_list_service_economics(uuid, uuid[]) TO authenticated;
