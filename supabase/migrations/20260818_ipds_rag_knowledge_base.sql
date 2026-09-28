-- ============================================
-- IPDS RAG KNOWLEDGE BASE (VERSION FINAL)
-- ============================================

-- 1. Aktifkan pgvector
create extension if not exists vector;


-- 2. Jadual dokumen/chunks
create table if not exists pdf_documents (
  id uuid primary key default gen_random_uuid(),

  project_id text not null,
  document_id uuid not null,
  file_name text not null,

  -- Lokasi kandungan
  page_number integer,
  section text,
  topic text,
  chunk_index integer not null,

  -- Kandungan sebenar
  content text not null,

  -- Metadata tambahan
  metadata jsonb default '{}'::jsonb,

  -- Dimensions: 1536 (OpenAI/DeepSeek), 768 (Gemini)
  embedding vector(1536),

  -- Audit
  created_at timestamptz default now(),

  unique(document_id, chunk_index)
);


-- 3. Index biasa (B-Tree) untuk kelajuan carian spesifik
create index if not exists idx_pdf_project on pdf_documents(project_id);
create index if not exists idx_pdf_document on pdf_documents(document_id);
create index if not exists idx_pdf_page on pdf_documents(page_number);


-- 4. HNSW Vector Index untuk kelajuan Carian Vektor
create index if not exists pdf_documents_embedding_idx
on pdf_documents
using hnsw (embedding vector_cosine_ops);


-- 5. Similarity Search Function (Diperbaikkan susunan Similarity)
create or replace function match_pdf_documents (
  query_embedding vector(1536),
  match_threshold float default 0.30,
  match_count int default 8,
  filter_project_id text default null
)
returns table (
  id uuid,
  document_id uuid,
  file_name text,
  page_number integer,
  section text,
  topic text,
  content text,
  metadata jsonb,
  similarity float
)
language sql
stable
as $$

  select
    d.id,
    d.document_id,
    d.file_name,
    d.page_number,
    d.section,
    d.topic,
    d.content,
    d.metadata,
    1 - (d.embedding <=> query_embedding) as similarity

  from pdf_documents d

  where
    d.embedding is not null
    and (filter_project_id is null or d.project_id = filter_project_id)
    and (1 - (d.embedding <=> query_embedding)) >= match_threshold

  order by
    similarity desc  -- Disusun daripada paling relevan (1.0) ke bawah

  limit match_count;

$$;


-- 6. Row Level Security (RLS) & Polisi Akses (PENAMBAHBAIKAN KESELAMATAN)
alter table pdf_documents enable row level security;

-- Membenarkan carian/bacaan data
create policy "Allow read access to pdf_documents"
on pdf_documents for select
using (true);

-- Membenarkan tambah & kemaskini dokumen
create policy "Allow insert access to pdf_documents"
on pdf_documents for insert
with check (true);

-- Membenarkan pemadaman dokumen
create policy "Allow delete access to pdf_documents"
on pdf_documents for delete
using (true);
