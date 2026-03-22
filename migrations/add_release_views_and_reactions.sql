-- Release notes: who saw/read and emoji reactions (Facebook-style)
-- release_version = date string from ref_id e.g. '2026-03-20'

CREATE TABLE IF NOT EXISTS public.release_views (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  release_version text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seen_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  PRIMARY KEY (company_id, release_version, user_id)
);

CREATE INDEX IF NOT EXISTS idx_release_views_version ON public.release_views (company_id, release_version);

COMMENT ON TABLE public.release_views IS 'Tracks which staff saw/read each release (system_update notification)';

ALTER TABLE public.release_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "release_views_select_same_company" ON public.release_views
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "release_views_insert_own" ON public.release_views
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "release_views_update_own" ON public.release_views
  FOR UPDATE USING (
    auth.uid() = user_id
    AND company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
  );

-- Reactions: one per user per release, emoji = like | love | wow | celebrate | thumbsup
CREATE TABLE IF NOT EXISTS public.release_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  release_version text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (emoji IN ('like', 'love', 'wow', 'celebrate', 'thumbsup')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, release_version, user_id)
);

CREATE INDEX IF NOT EXISTS idx_release_reactions_version ON public.release_reactions (company_id, release_version);

COMMENT ON TABLE public.release_reactions IS 'Emoji reactions per release (Facebook-style); one reaction per user per release';

ALTER TABLE public.release_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "release_reactions_select_same_company" ON public.release_reactions
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "release_reactions_insert_own" ON public.release_reactions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "release_reactions_update_own" ON public.release_reactions
  FOR UPDATE USING (
    auth.uid() = user_id
    AND company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "release_reactions_delete_own" ON public.release_reactions
  FOR DELETE USING (
    auth.uid() = user_id
    AND company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
  );
