-- MAP-01 Step 2: global city geocode cache.
-- Stores resolved (city, country) → (lat, lng) pairs so the dashboard map
-- can answer instantly for repeat lookups and new cities (e.g. Tashkent,
-- Bishkek) are auto-added on first request via Nominatim.
--
-- Table is GLOBAL (no company_id): coordinates of a city don't depend on
-- tenant. All companies benefit from every resolved entry.

CREATE TABLE IF NOT EXISTS public.city_geocache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- normalized inputs (lower-cased, diacritics stripped, trimmed)
  query_norm text NOT NULL,
  country_norm text NOT NULL DEFAULT '',
  -- canonical resolved values (English), may be null if resolver failed
  city text,
  country text,
  lat numeric(9,6),
  lng numeric(9,6),
  -- 'builtin' | 'alias' | 'nominatim' | 'manual' | 'unmapped'
  source text NOT NULL,
  -- true when lat/lng point at a country/region instead of the exact city
  approximate boolean NOT NULL DEFAULT false,
  hits int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS city_geocache_query_unique
  ON public.city_geocache(query_norm, country_norm);

CREATE INDEX IF NOT EXISTS city_geocache_city_idx
  ON public.city_geocache((lower(city)));

-- updated_at auto-touch
CREATE OR REPLACE FUNCTION public.city_geocache_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS city_geocache_touch_updated_at ON public.city_geocache;
CREATE TRIGGER city_geocache_touch_updated_at
  BEFORE UPDATE ON public.city_geocache
  FOR EACH ROW EXECUTE FUNCTION public.city_geocache_touch_updated_at();

-- RLS: readable by any authenticated user, writes via service_role only
ALTER TABLE public.city_geocache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS city_geocache_select_authenticated ON public.city_geocache;
CREATE POLICY city_geocache_select_authenticated
  ON public.city_geocache FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE public.city_geocache IS
  'Global geocode cache. MAP-01 Step 2: auto-populated by Nominatim on first miss.';
