-- Make orders.search_text diacritic-insensitive.
-- ILIKE in Postgres is case-insensitive but NOT diacritic-insensitive,
-- so "Ulja" did not match "Uļjanova". Wrap the maintained blob with
-- unaccent() so the stored value is normalized; the API will normalize
-- the search input the same way before running ILIKE.
--
-- Run in Supabase SQL Editor (or your migration runner). Idempotent.

-- In Supabase the unaccent extension lives in the `extensions` schema; on
-- self-hosted setups it may be in `public`. Make sure both lookups work.
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Rebuild search_text for one order, normalized: lower + unaccent.
CREATE OR REPLACE FUNCTION public.refresh_order_search_text(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  blob text := '';
  oc text;
  cdn text;
  svc text;
  ot text;
  ost text;
BEGIN
  SELECT o.order_code, o.client_display_name INTO oc, cdn
  FROM public.orders o
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  blob := concat_ws(
    ' ',
    lower(coalesce(btrim(oc), '')),
    lower(coalesce(btrim(cdn), ''))
  );

  SELECT string_agg(DISTINCT t, ' ')
  INTO svc
  FROM (
    SELECT lower(btrim(s.client_name)) AS t
    FROM public.order_services s
    WHERE s.order_id = p_order_id
      AND s.res_status IS DISTINCT FROM 'cancelled'
      AND s.client_name IS NOT NULL
      AND btrim(s.client_name) <> ''
    UNION
    SELECT lower(btrim(s.payer_name)) AS t
    FROM public.order_services s
    WHERE s.order_id = p_order_id
      AND s.res_status IS DISTINCT FROM 'cancelled'
      AND s.payer_name IS NOT NULL
      AND btrim(s.payer_name) <> ''
  ) s;

  IF svc IS NOT NULL THEN
    blob := concat_ws(' ', blob, svc);
  END IF;

  SELECT string_agg(DISTINCT lbl, ' ')
  INTO ot
  FROM (
    SELECT lower(
      btrim(
        coalesce(
          nullif(btrim(p.display_name), ''),
          (SELECT btrim(concat_ws(' ', pp.first_name, pp.last_name))
           FROM public.party_person pp
           WHERE pp.party_id = p.id
           LIMIT 1)
        )
      )
    ) AS lbl
    FROM public.order_travellers ot2
    JOIN public.party p ON p.id = ot2.party_id
    WHERE ot2.order_id = p_order_id
      AND (p.status IS NULL OR p.status = 'active')
  ) q
  WHERE lbl IS NOT NULL AND lbl <> '';

  IF ot IS NOT NULL THEN
    blob := concat_ws(' ', blob, ot);
  END IF;

  SELECT string_agg(DISTINCT lbl, ' ')
  INTO ost
  FROM (
    SELECT lower(
      btrim(
        coalesce(
          nullif(btrim(p.display_name), ''),
          (SELECT btrim(concat_ws(' ', pp.first_name, pp.last_name))
           FROM public.party_person pp
           WHERE pp.party_id = p.id
           LIMIT 1)
        )
      )
    ) AS lbl
    FROM public.order_service_travellers ost2
    JOIN public.order_services sv ON sv.id = ost2.service_id AND sv.order_id = p_order_id
    JOIN public.party p ON p.id = ost2.traveller_id
    WHERE (p.status IS NULL OR p.status = 'active')
  ) q2
  WHERE lbl IS NOT NULL AND lbl <> '';

  IF ost IS NOT NULL THEN
    blob := concat_ws(' ', blob, ost);
  END IF;

  -- Normalize the whole blob: strip diacritics (ļ→l, ā→a, š→s, ñ→n, …)
  -- and ensure lowercase so the API can ILIKE against a normalized input.
  UPDATE public.orders
  SET search_text = lower(unaccent(blob))
  WHERE id = p_order_id;
END;
$$;

-- Backfill all rows with the new normalization.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.orders LOOP
    PERFORM public.refresh_order_search_text(r.id);
  END LOOP;
END $$;
