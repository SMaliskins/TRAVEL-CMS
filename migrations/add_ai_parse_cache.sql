-- ai_parse_cache: deduplicate identical AI parse requests across users.
--
-- Each row is an immutable cache entry: a SHA-256 hash of (document_type +
-- normalized input) maps to the structured JSON the AI returned, plus
-- bookkeeping for hit/expiry.
--
-- Reads are by hash equality (PK lookup). Writes happen only on a successful
-- high-confidence parse (>= 0.7) so we never poison the cache with garbage.

create table if not exists public.ai_parse_cache (
  hash            text primary key,
  document_type   text not null,
  parsed_data     jsonb not null,
  confidence      numeric(4,3) not null,
  model           text,
  provider        text,
  hit_count       integer not null default 0,
  created_at      timestamptz not null default now(),
  last_hit_at     timestamptz not null default now()
);

create index if not exists ai_parse_cache_doctype_idx
  on public.ai_parse_cache (document_type);

create index if not exists ai_parse_cache_created_idx
  on public.ai_parse_cache (created_at);

-- Service role only — this is a server-side cache, never accessed from
-- client code. RLS stays enabled with no policies to deny by default.
alter table public.ai_parse_cache enable row level security;

comment on table public.ai_parse_cache is
  'Server-side cache of AI parse results keyed by sha256(documentType + normalized input). Populated only on confidence >= 0.7. Eviction is best-effort via TTL on read.';
