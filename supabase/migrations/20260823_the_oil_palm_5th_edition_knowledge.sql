-- ============================================================================
-- THE OIL PALM (5TH EDITION) - R.H.V. CORLEY & P.B. TINKER
-- Dedicated Supabase Knowledge Base Table, Vector Search & RLS Setup
-- ============================================================================

-- 1. Enable required extensions
create extension if not exists vector;
create extension if not exists pg_trgm;

-- 2. Create dedicated table for 'The Oil Palm, 5th Edition'
create table if not exists the_oil_palm_knowledge (
  id uuid primary key default gen_random_uuid(),
  document_id text default 'top-5th-edition-corley-tinker',
  manual_title text not null default 'The Oil Palm (5th Edition) - R.H.V. Corley & P.B. Tinker',
  category text not null default 'The Oil Palm, 5th Edition',
  chapter text,
  section_title text not null,
  page_number integer not null default 1,
  chunk_index integer default 0,
  content text not null,
  tags text[] default '{}',
  metadata jsonb default '{
    "edition": "5th Edition",
    "authors": "R.H.V. Corley, P.B. Tinker",
    "publisher": "Wiley Blackwell",
    "year": 2016,
    "isbn": "978-1-4051-8939-2"
  }'::jsonb,
  embedding vector(768),
  tsv tsvector generated always as (
    to_tsvector('simple', coalesce(manual_title, '') || ' ' || coalesce(section_title, '') || ' ' || coalesce(content, ''))
  ) stored,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Indexes for Ultra-Fast Retrieval
create index if not exists idx_the_oil_palm_category on the_oil_palm_knowledge(category);
create index if not exists idx_the_oil_palm_page on the_oil_palm_knowledge(page_number);
create index if not exists idx_the_oil_palm_tags on the_oil_palm_knowledge using gin(tags);
create index if not exists idx_the_oil_palm_metadata on the_oil_palm_knowledge using gin(metadata);
create index if not exists idx_the_oil_palm_tsv on the_oil_palm_knowledge using gin(tsv);

-- HNSW Vector Index for Cosine Similarity (Gemini 768-dim embeddings)
create index if not exists idx_the_oil_palm_hnsw_embedding
on the_oil_palm_knowledge
using hnsw (embedding vector_cosine_ops);

-- 4. Enable Row Level Security (RLS)
alter table the_oil_palm_knowledge enable row level security;

-- Permissive read/write policies for authenticated and anon clients
drop policy if exists "Allow read the_oil_palm_knowledge" on the_oil_palm_knowledge;
create policy "Allow read the_oil_palm_knowledge" on the_oil_palm_knowledge for select using (true);

drop policy if exists "Allow insert the_oil_palm_knowledge" on the_oil_palm_knowledge;
create policy "Allow insert the_oil_palm_knowledge" on the_oil_palm_knowledge for insert with check (true);

drop policy if exists "Allow update the_oil_palm_knowledge" on the_oil_palm_knowledge;
create policy "Allow update the_oil_palm_knowledge" on the_oil_palm_knowledge for update using (true);

drop policy if exists "Allow delete the_oil_palm_knowledge" on the_oil_palm_knowledge;
create policy "Allow delete the_oil_palm_knowledge" on the_oil_palm_knowledge for delete using (true);

-- 5. Hybrid Search RPC for The Oil Palm Knowledge
create or replace function match_the_oil_palm_knowledge(
  query_text text,
  query_embedding vector(768),
  match_count int default 10,
  filter_chapter text default null
)
returns table (
  id uuid,
  document_id text,
  manual_title text,
  category text,
  chapter text,
  section_title text,
  page_number int,
  chunk_index int,
  content text,
  metadata jsonb,
  vector_score float8,
  keyword_score float8,
  final_score float8
)
language plpgsql
as $$
declare
  v_query_ts tsquery;
begin
  v_query_ts := plainto_tsquery('simple', query_text);

  return query
  with vector_matches as (
    select
      d.id,
      1.0 - (d.embedding <=> query_embedding) as v_score
    from the_oil_palm_knowledge d
    where d.embedding is not null
      and (filter_chapter is null or d.chapter ilike '%' || filter_chapter || '%')
    order by d.embedding <=> query_embedding
    limit match_count * 2
  ),
  lexical_matches as (
    select
      d.id,
      ts_rank_cd(d.tsv, v_query_ts) as k_score
    from the_oil_palm_knowledge d
    where d.tsv @@ v_query_ts
      and (filter_chapter is null or d.chapter ilike '%' || filter_chapter || '%')
    order by k_score desc
    limit match_count * 2
  )
  select
    d.id,
    d.document_id,
    d.manual_title,
    d.category,
    d.chapter,
    d.section_title,
    d.page_number,
    d.chunk_index,
    d.content,
    d.metadata,
    coalesce(vm.v_score, 0.0)::float8 as vector_score,
    coalesce(lm.k_score, 0.0)::float8 as keyword_score,
    (0.7 * coalesce(vm.v_score, 0.0) + 0.3 * (1.0 / (1.0 + exp(-coalesce(lm.k_score, 0.0)))))::float8 as final_score
  from the_oil_palm_knowledge d
  left join vector_matches vm on d.id = vm.id
  left join lexical_matches lm on d.id = lm.id
  where vm.id is not null or lm.id is not null
  order by final_score desc
  limit match_count;
end;
$$;
