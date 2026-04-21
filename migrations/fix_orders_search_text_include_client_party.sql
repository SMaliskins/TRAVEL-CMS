-- Fix: orders list search must find orders by the live client name from the
-- Directory (party.display_name / party_person.first_name+last_name), not
-- just the denormalized orders.client_display_name snapshot.
--
-- Symptoms before this fix:
--   - "Gilc" finds order, but "Gilch" does NOT, even though the client is
--     "Sergiy Gilchenko" — because orders.client_display_name was a stale
--     value (e.g. typo or old short form) while the Directory party already
--     had the corrected name.
--
-- Changes:
--   1. CREATE EXTENSION unaccent (idempotent; needed if the previous
--      add_unaccent_to_orders_search_text.sql wasn't applied yet).
--   2. refresh_order_search_text now also concatenates the LIVE
--      party.display_name and party_person.first_name/last_name resolved
--      via orders.client_party_id, in addition to the denormalized
--      orders.client_display_name and the existing traveller/service
--      contributions.
--   3. Triggers added: when a party is renamed (or its party_person row
--      changes), all orders linked via client_party_id are refreshed.
--   4. The orders trigger UPDATE OF list now includes client_party_id so
--      reassigning a client also rebuilds search_text.
--   5. Backfill all rows.
--
-- Run in Supabase SQL Editor. Idempotent.

CREATE EXTENSION IF NOT EXISTS unaccent;

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
  cpid uuid;
  cpn text;       -- party.display_name for client_party_id
  cppn text;      -- party_person "first last" for client_party_id
  svc text;
  ot text;
  ost text;
BEGIN
  SELECT o.order_code, o.client_display_name, o.client_party_id
    INTO oc, cdn, cpid
  FROM public.orders o
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Live names for orders.client_party_id (source of truth in Directory).
  IF cpid IS NOT NULL THEN
    SELECT btrim(p.display_name) INTO cpn FROM public.party p WHERE p.id = cpid;
    SELECT btrim(concat_ws(' ', pp.first_name, pp.last_name)) INTO cppn
    FROM public.party_person pp
    WHERE pp.party_id = cpid
    LIMIT 1;
  END IF;

  blob := concat_ws(
    ' ',
    coalesce(btrim(oc), ''),
    coalesce(btrim(cdn), ''),
    coalesce(cpn, ''),
    coalesce(cppn, '')
  );

  SELECT string_agg(DISTINCT t, ' ')
  INTO svc
  FROM (
    SELECT btrim(s.client_name) AS t
    FROM public.order_services s
    WHERE s.order_id = p_order_id
      AND s.res_status IS DISTINCT FROM 'cancelled'
      AND s.client_name IS NOT NULL
      AND btrim(s.client_name) <> ''
    UNION
    SELECT btrim(s.payer_name) AS t
    FROM public.order_services s
    WHERE s.order_id = p_order_id
      AND s.res_status IS DISTINCT FROM 'cancelled'
      AND s.payer_name IS NOT NULL
      AND btrim(s.payer_name) <> ''
  ) s;

  IF svc IS NOT NULL THEN
    blob := concat_ws(' ', blob, svc);
  END IF;

  -- Travellers (live party display_name + party_person names).
  SELECT string_agg(DISTINCT lbl, ' ')
  INTO ot
  FROM (
    SELECT btrim(
      coalesce(
        nullif(btrim(p.display_name), ''),
        (SELECT btrim(concat_ws(' ', pp.first_name, pp.last_name))
         FROM public.party_person pp
         WHERE pp.party_id = p.id
         LIMIT 1)
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
    SELECT btrim(
      coalesce(
        nullif(btrim(p.display_name), ''),
        (SELECT btrim(concat_ws(' ', pp.first_name, pp.last_name))
         FROM public.party_person pp
         WHERE pp.party_id = p.id
         LIMIT 1)
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

  -- Diacritic-insensitive, lowercased final value.
  UPDATE public.orders
  SET search_text = lower(unaccent(blob))
  WHERE id = p_order_id;
END;
$$;

-- Re-create the orders trigger so it also fires when the client is reassigned.
DROP TRIGGER IF EXISTS trg_orders_refresh_search_text ON public.orders;
CREATE TRIGGER trg_orders_refresh_search_text
  AFTER INSERT OR UPDATE OF order_code, client_display_name, client_party_id
  ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_orders_refresh_search_text();

-- New trigger: refresh all orders that point at a party via client_party_id
-- whenever that party's display_name changes (e.g. Directory rename).
CREATE OR REPLACE FUNCTION public.tg_party_refresh_client_orders_search_text()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.refresh_order_search_text(o.id)
  FROM public.orders o
  WHERE o.client_party_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_party_refresh_client_orders_search_text ON public.party;
CREATE TRIGGER trg_party_refresh_client_orders_search_text
  AFTER UPDATE OF display_name, status
  ON public.party
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_party_refresh_client_orders_search_text();

-- And: when party_person changes, refresh orders that point at the same
-- party via client_party_id (in addition to the existing traveller-side
-- refresh).
CREATE OR REPLACE FUNCTION public.tg_party_person_refresh_client_orders_search_text()
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
  PERFORM public.refresh_order_search_text(o.id)
  FROM public.orders o
  WHERE o.client_party_id = pid;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_party_person_refresh_client_orders_search_text ON public.party_person;
CREATE TRIGGER trg_party_person_refresh_client_orders_search_text
  AFTER INSERT OR UPDATE OR DELETE
  ON public.party_person
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_party_person_refresh_client_orders_search_text();

-- Backfill all rows with the new blob (includes live client party names).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.orders LOOP
    PERFORM public.refresh_order_search_text(r.id);
  END LOOP;
END $$;
