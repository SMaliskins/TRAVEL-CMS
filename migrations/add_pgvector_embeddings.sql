-- Migration: Add pgvector embeddings for semantic search
-- Scenarios 1 & 2: Directory (party) + Orders/Services
-- Run this in Supabase SQL Editor
-- Date: 2026-01-26

-- ============================================
-- 1. ENABLE VECTOR EXTENSION
-- ============================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- 2. PARTY EMBEDDINGS (Directory semantic search)
-- ============================================

CREATE TABLE IF NOT EXISTS public.party_embeddings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id uuid NOT NULL REFERENCES public.party(id) ON DELETE CASCADE,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    search_text text NOT NULL,
    embedding vector(1536) NOT NULL,
    updated_at timestamptz DEFAULT now(),
    UNIQUE(party_id)
);

CREATE INDEX IF NOT EXISTS idx_party_embeddings_company_id 
ON public.party_embeddings(company_id);

CREATE INDEX IF NOT EXISTS idx_party_embeddings_embedding 
ON public.party_embeddings 
USING hnsw (embedding vector_cosine_ops);

COMMENT ON TABLE public.party_embeddings IS 'Vector embeddings for party records (Directory) - semantic search';
COMMENT ON COLUMN public.party_embeddings.search_text IS 'Original text used to generate embedding';
COMMENT ON COLUMN public.party_embeddings.embedding IS 'OpenAI text-embedding-3-small vector (1536 dims)';

-- ============================================
-- 3. ORDER SERVICE EMBEDDINGS (Orders/Services semantic search)
-- ============================================

CREATE TABLE IF NOT EXISTS public.order_service_embeddings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id uuid NOT NULL REFERENCES public.order_services(id) ON DELETE CASCADE,
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    search_text text NOT NULL,
    embedding vector(1536) NOT NULL,
    updated_at timestamptz DEFAULT now(),
    UNIQUE(service_id)
);

CREATE INDEX IF NOT EXISTS idx_order_service_embeddings_company_id 
ON public.order_service_embeddings(company_id);

CREATE INDEX IF NOT EXISTS idx_order_service_embeddings_embedding 
ON public.order_service_embeddings 
USING hnsw (embedding vector_cosine_ops);

COMMENT ON TABLE public.order_service_embeddings IS 'Vector embeddings for order services - semantic search';
COMMENT ON COLUMN public.order_service_embeddings.search_text IS 'Original text used to generate embedding';
COMMENT ON COLUMN public.order_service_embeddings.embedding IS 'OpenAI text-embedding-3-small vector (1536 dims)';

-- ============================================
-- 4. SEARCH FUNCTIONS (RLS via company_id)
-- ============================================

-- Drop ALL overloads to avoid "function name is not unique" on re-run
DO $$
DECLARE r text;
BEGIN
  FOR r IN SELECT (p.oid::regprocedure)::text FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'search_party_semantic'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r || ' CASCADE';
  END LOOP;
  FOR r IN SELECT (p.oid::regprocedure)::text FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'search_order_service_semantic'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r || ' CASCADE';
  END LOOP;
END $$;

-- Semantic search for Directory (party)
CREATE OR REPLACE FUNCTION public.search_party_semantic(
    query_embedding vector(1536),
    p_company_id uuid,
    match_limit int DEFAULT 10,
    match_threshold float DEFAULT 0.5
)
RETURNS TABLE (
    party_id uuid,
    similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        pe.party_id,
        1 - (pe.embedding <=> query_embedding)::float AS similarity
    FROM public.party_embeddings pe
    WHERE pe.company_id = p_company_id
      AND 1 - (pe.embedding <=> query_embedding) > match_threshold
    ORDER BY pe.embedding <=> query_embedding
    LIMIT match_limit;
END;
$$;

COMMENT ON FUNCTION public.search_party_semantic(vector, uuid, int, double precision) IS 'Semantic search for party records by embedding. Uses cosine distance.';

-- Semantic search for Orders/Services
CREATE OR REPLACE FUNCTION public.search_order_service_semantic(
    query_embedding vector(1536),
    p_company_id uuid,
    match_limit int DEFAULT 10,
    match_threshold float DEFAULT 0.5
)
RETURNS TABLE (
    service_id uuid,
    order_id uuid,
    similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ose.service_id,
        ose.order_id,
        1 - (ose.embedding <=> query_embedding)::float AS similarity
    FROM public.order_service_embeddings ose
    WHERE ose.company_id = p_company_id
      AND 1 - (ose.embedding <=> query_embedding) > match_threshold
    ORDER BY ose.embedding <=> query_embedding
    LIMIT match_limit;
END;
$$;

COMMENT ON FUNCTION public.search_order_service_semantic(vector, uuid, int, double precision) IS 'Semantic search for order services by embedding. Uses cosine distance.';

-- ============================================
-- 5. RLS POLICIES (optional - if RLS enabled)
-- ============================================

ALTER TABLE public.party_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_service_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "party_embeddings_company_isolation" ON public.party_embeddings;
CREATE POLICY "party_embeddings_company_isolation" ON public.party_embeddings
    FOR ALL TO authenticated
    USING (company_id IN (
        SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
    ))
    WITH CHECK (company_id IN (
        SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
    ));

DROP POLICY IF EXISTS "order_service_embeddings_company_isolation" ON public.order_service_embeddings;
CREATE POLICY "order_service_embeddings_company_isolation" ON public.order_service_embeddings
    FOR ALL TO authenticated
    USING (company_id IN (
        SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
    ))
    WITH CHECK (company_id IN (
        SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
    ));
