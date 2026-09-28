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


