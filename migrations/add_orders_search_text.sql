-- A1.3: Denormalized full-text blob for /api/orders search (travellers, payers, service client names).
-- Run in Supabase SQL Editor (or your migration runner). Service role / API unchanged except new filter.

-- Optional: faster ILIKE '%term%' on large tables
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS search_text text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.orders.search_text IS
  'Lowercased concat of order_code, client_display_name, service client/payer names, traveller party labels; maintained by triggers.';

-- ---------------------------------------------------------------------------
-- Rebuild search_text for one order (SECURITY DEFINER: used only from triggers)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_order_search_text(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  UPDATE public.orders
  SET search_text = blob
  WHERE id = p_order_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_orders_refresh_search_text()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.refresh_order_search_text(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_refresh_search_text ON public.orders;
CREATE TRIGGER trg_orders_refresh_search_text
  AFTER INSERT OR UPDATE OF order_code, client_display_name
  ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_orders_refresh_search_text();

CREATE OR REPLACE FUNCTION public.tg_order_travellers_refresh_search_text()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  oid uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    oid := OLD.order_id;
  ELSE
    oid := NEW.order_id;
  END IF;
  IF oid IS NOT NULL THEN
    PERFORM public.refresh_order_search_text(oid);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_order_travellers_refresh_search_text ON public.order_travellers;
CREATE TRIGGER trg_order_travellers_refresh_search_text
  AFTER INSERT OR UPDATE OR DELETE
  ON public.order_travellers
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_order_travellers_refresh_search_text();

CREATE OR REPLACE FUNCTION public.tg_order_services_refresh_search_text()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  oid uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    oid := OLD.order_id;
  ELSE
    oid := NEW.order_id;
  END IF;
  IF oid IS NOT NULL THEN
    PERFORM public.refresh_order_search_text(oid);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_order_services_refresh_search_text ON public.order_services;
CREATE TRIGGER trg_order_services_refresh_search_text
  AFTER INSERT OR UPDATE OR DELETE
  ON public.order_services
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_order_services_refresh_search_text();

CREATE OR REPLACE FUNCTION public.tg_order_service_travellers_refresh_search_text()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  sid uuid;
  oid uuid;
BEGIN
  sid := COALESCE(NEW.service_id, OLD.service_id);
  IF sid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  SELECT s.order_id INTO oid FROM public.order_services s WHERE s.id = sid LIMIT 1;
  IF oid IS NOT NULL THEN
    PERFORM public.refresh_order_search_text(oid);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_order_service_travellers_refresh_search_text ON public.order_service_travellers;
CREATE TRIGGER trg_order_service_travellers_refresh_search_text
  AFTER INSERT OR UPDATE OR DELETE
  ON public.order_service_travellers
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_order_service_travellers_refresh_search_text();

CREATE OR REPLACE FUNCTION public.tg_party_refresh_linked_orders_search_text()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.refresh_order_search_text(ot.order_id)
  FROM public.order_travellers ot
  WHERE ot.party_id = NEW.id;

  PERFORM public.refresh_order_search_text(sv.order_id)
  FROM public.order_service_travellers ost
  JOIN public.order_services sv ON sv.id = ost.service_id
  WHERE ost.traveller_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_party_refresh_linked_orders_search_text ON public.party;
CREATE TRIGGER trg_party_refresh_linked_orders_search_text
  AFTER UPDATE OF display_name, status
  ON public.party
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_party_refresh_linked_orders_search_text();

CREATE OR REPLACE FUNCTION public.tg_party_person_refresh_linked_orders_search_text()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  pid uuid;
BEGIN
  pid := COALESCE(NEW.party_id, OLD.party_id);
  IF pid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  PERFORM public.refresh_order_search_text(ot.order_id)
  FROM public.order_travellers ot
  WHERE ot.party_id = pid;

  PERFORM public.refresh_order_search_text(sv.order_id)
  FROM public.order_service_travellers ost
  JOIN public.order_services sv ON sv.id = ost.service_id
  WHERE ost.traveller_id = pid;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_party_person_refresh_linked_orders_search_text ON public.party_person;
CREATE TRIGGER trg_party_person_refresh_linked_orders_search_text
  AFTER INSERT OR UPDATE OR DELETE
  ON public.party_person
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_party_person_refresh_linked_orders_search_text();

-- ---------------------------------------------------------------------------
-- Backfill existing rows (may take time on large DBs)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.orders LOOP
    PERFORM public.refresh_order_search_text(r.id);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_search_text_trgm
  ON public.orders
  USING gin (search_text gin_trgm_ops);
