-- ============================================================================
-- IPDS FPMSB ENTERPRISE RAG KNOWLEDGE BASE & VALIDATION SUITE SCHEMA
-- Source of Truth Table: ipds_rag_documents
-- Ingestion & Page Tracker: ipds_rag_ingestion_log, ipds_rag_pages
-- Embedding Dimensions: vector(768) (Gemini Embedding 2 Preview / text-embedding-004)
-- ============================================================================

-- 1. Enable pgvector & pg_trgm extensions
create extension if not exists vector;
create extension if not exists pg_trgm;

-- 2. Ingestion Document Log (Document-level Validation Source)
create table if not exists ipds_rag_ingestion_log (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null unique,
  file_name text not null,
  category text not null,
  file_size_bytes bigint default 0,
  expected_pages integer not null,
  extracted_pages integer default 0,
  failed_pages integer default 0,
  missing_pages text[] default '{}',
  total_chunks integer default 0,
  upload_status text default 'PENDING',
  extraction_status text default 'NOT_STARTED',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Page Extraction Log (Page-level Validation Source)
create table if not exists ipds_rag_pages (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references ipds_rag_ingestion_log(document_id) on delete cascade,
  page_number integer not null,
  status text not null, -- EXTRACTED, EMPTY, OCR_REQUIRED, OCR_SUCCESS, OCR_FAILED, FAILED
  extraction_method text default 'digital', -- digital, ocr, none
  char_count integer default 0,
  error_message text,
  created_at timestamptz default now(),
  unique(document_id, page_number)
);

-- 4. Enterprise RAG Document Chunks (Chunk-level Validation & Retrieval Source of Truth)
create table if not exists ipds_rag_documents (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references ipds_rag_ingestion_log(document_id) on delete cascade,
  file_name text not null,
  category text not null,
  page_number integer not null,
  section_title text default '',
  chunk_index integer not null,
  content text not null,
  metadata jsonb default '{}'::jsonb,
  embedding vector(768), -- Gemini 768-dimension embeddings
  tsv tsvector generated always as (to_tsvector('simple', coalesce(content, ''))) stored,
  created_at timestamptz default now(),
  unique(document_id, chunk_index)
);

-- 5. Performance & Search Indexes
create index if not exists idx_ipds_rag_doc_id on ipds_rag_documents(document_id);
create index if not exists idx_ipds_rag_category on ipds_rag_documents(category);
create index if not exists idx_ipds_rag_page on ipds_rag_documents(page_number);
create index if not exists idx_ipds_rag_metadata on ipds_rag_documents using gin(metadata);
create index if not exists idx_ipds_rag_tsv on ipds_rag_documents using gin(tsv);

-- HNSW Cosine Index for Vector Search
create index if not exists idx_ipds_rag_hnsw_embedding
on ipds_rag_documents
using hnsw (embedding vector_cosine_ops);

-- RLS Policies
alter table ipds_rag_ingestion_log enable row level security;
alter table ipds_rag_pages enable row level security;
alter table ipds_rag_documents enable row level security;

create policy "Allow read ipds_rag_ingestion_log" on ipds_rag_ingestion_log for select using (true);
create policy "Allow insert ipds_rag_ingestion_log" on ipds_rag_ingestion_log for insert with check (true);
create policy "Allow update ipds_rag_ingestion_log" on ipds_rag_ingestion_log for update using (true);

create policy "Allow read ipds_rag_pages" on ipds_rag_pages for select using (true);
create policy "Allow insert ipds_rag_pages" on ipds_rag_pages for insert with check (true);
create policy "Allow update ipds_rag_pages" on ipds_rag_pages for update using (true);

create policy "Allow read ipds_rag_documents" on ipds_rag_documents for select using (true);
create policy "Allow insert ipds_rag_documents" on ipds_rag_documents for insert with check (true);
create policy "Allow update ipds_rag_documents" on ipds_rag_documents for update using (true);
create policy "Allow delete ipds_rag_documents" on ipds_rag_documents for delete using (true);


-- ============================================================================
-- HYBRID SEARCH RPC: match_ipds_documents_hybrid
-- Vector Cosine Search (768-dim) + Lexical FTS ('simple' configuration for BM/EN)
-- Reciprocal Rank Fusion (RRF) Reranking
-- ============================================================================
create or replace function match_ipds_documents_hybrid(
  query_text text,
  query_embedding vector(768),
  match_count int default 20,
  filter_category text default null,
  rrf_k float default 60.0
)
returns table (
  id uuid,
  document_id uuid,
  file_name text,
  category text,
  section_title text,
  page_number integer,
  chunk_index integer,
  content text,
  metadata jsonb,
  vector_score float,
  keyword_score float,
  final_rrf_score float
)
language plpgsql
stable
as $$
declare
  clean_query text;
  formatted_fts_query text;
begin
  clean_query := trim(coalesce(query_text, ''));
  
  -- Convert query text into formatted simple tsquery with prefix wildcarding
  if length(clean_query) > 0 then
    select string_agg(plain_word || ':*', ' & ')
    into formatted_fts_query
    from unnest(regexp_split_to_array(clean_query, '\s+')) as plain_word
    where length(plain_word) >= 2;
  end if;

  return query
  with vector_matches as (
    select
      d.id,
      d.document_id,
      d.file_name,
      d.category,
      d.section_title,
      d.page_number,
      d.chunk_index,
      d.content,
      d.metadata,
      (1 - (d.embedding <=> query_embedding))::float as vec_score,
      row_number() over (order by d.embedding <=> query_embedding asc) as vec_rank
    from ipds_rag_documents d
    where d.embedding is not null
      and (filter_category is null or d.category = filter_category or filter_category = 'Semua')
    limit match_count * 2
  ),
  fts_matches as (
    select
      d.id,
      d.document_id,
      d.file_name,
      d.category,
      d.section_title,
      d.page_number,
      d.chunk_index,
      d.content,
      d.metadata,
      ts_rank_cd(d.tsv, to_tsquery('simple', coalesce(formatted_fts_query, '')))::float as kw_score,
      row_number() over (order by ts_rank_cd(d.tsv, to_tsquery('simple', coalesce(formatted_fts_query, ''))) desc) as fts_rank
    from ipds_rag_documents d
    where (formatted_fts_query is not null and d.tsv @@ to_tsquery('simple', formatted_fts_query))
      and (filter_category is null or d.category = filter_category or filter_category = 'Semua')
    limit match_count * 2
  ),
  combined_candidates as (
    select
      coalesce(v.id, f.id) as id,
      coalesce(v.document_id, f.document_id) as document_id,
      coalesce(v.file_name, f.file_name) as file_name,
      coalesce(v.category, f.category) as category,
      coalesce(v.section_title, f.section_title) as section_title,
      coalesce(v.page_number, f.page_number) as page_number,
      coalesce(v.chunk_index, f.chunk_index) as chunk_index,
      coalesce(v.content, f.content) as content,
      coalesce(v.metadata, f.metadata) as metadata,
      coalesce(v.vec_score, 0.0)::float as vector_score,
      coalesce(f.kw_score, 0.0)::float as keyword_score,
      (
        coalesce(1.0 / (rrf_k + v.vec_rank), 0.0) +
        coalesce(1.0 / (rrf_k + f.fts_rank), 0.0)
      )::float as final_rrf_score
    from vector_matches v
    full outer join fts_matches f on v.id = f.id
  )
  select
    c.id,
    c.document_id,
    c.file_name,
    c.category,
    c.section_title,
    c.page_number,
    c.chunk_index,
    c.content,
    c.metadata,
    c.vector_score,
    c.keyword_score,
    c.final_rrf_score
  from combined_candidates c
  order by c.final_rrf_score desc
  limit match_count;
end;
$$;


-- ============================================================================
-- SQL VALIDATION SUITE FUNCTIONS
-- ============================================================================

-- A. get_document_ingestion_status(p_document_id uuid)
create or replace function get_document_ingestion_status(p_document_id uuid)
returns table (
  document_id uuid,
  file_name text,
  category text,
  file_size_bytes bigint,
  expected_pages integer,
  extracted_pages integer,
  failed_pages integer,
  missing_pages text[],
  total_chunks bigint,
  chunks_with_embedding bigint,
  chunks_without_embedding bigint,
  upload_status text,
  extraction_status text,
  validation_status text
)
language plpgsql
stable
as $$
begin
  return query
  select
    l.document_id,
    l.file_name,
    l.category,
    l.file_size_bytes,
    l.expected_pages,
    l.extracted_pages,
    l.failed_pages,
    l.missing_pages,
    count(d.id) as total_chunks,
    count(case when d.embedding is not null then 1 end) as chunks_with_embedding,
    count(case when d.embedding is null then 1 end) as chunks_without_embedding,
    l.upload_status,
    l.extraction_status,
    case
      when l.expected_pages = l.extracted_pages 
           and count(case when d.embedding is null then 1 end) = 0
           and count(d.id) > 0
           and l.failed_pages = 0
        then 'PASS'
      when l.extracted_pages > 0 and (l.failed_pages > 0 or count(case when d.embedding is null then 1 end) > 0)
        then 'WARNING'
      else 'FAIL'
    end as validation_status
  from ipds_rag_ingestion_log l
  left join ipds_rag_documents d on l.document_id = d.document_id
  where l.document_id = p_document_id
  group by l.document_id, l.file_name, l.category, l.file_size_bytes,
           l.expected_pages, l.extracted_pages, l.failed_pages, l.missing_pages,
           l.upload_status, l.extraction_status;
end;
$$;

-- B. get_failed_document_pages(p_document_id uuid)
create or replace function get_failed_document_pages(p_document_id uuid)
returns table (
  document_id uuid,
  page_number integer,
  status text,
  extraction_method text,
  char_count integer,
  error_message text
)
language plpgsql
stable
as $$
begin
  return query
  select
    p.document_id,
    p.page_number,
    p.status,
    p.extraction_method,
    p.char_count,
    p.error_message
  from ipds_rag_pages p
  where p.document_id = p_document_id
    and p.status in ('EMPTY', 'OCR_FAILED', 'FAILED')
  order by p.page_number asc;
end;
$$;

-- C. get_document_chunk_validation(p_document_id uuid)
create or replace function get_document_chunk_validation(p_document_id uuid)
returns table (
  total_chunks bigint,
  null_or_empty_content bigint,
  duplicate_chunks bigint,
  missing_page_numbers bigint,
  missing_metadata bigint,
  missing_embeddings bigint,
  abnormal_short_chunks bigint,
  abnormal_long_chunks bigint,
  validation_status text
)
language plpgsql
stable
as $$
declare
  v_null_content bigint;
  v_duplicate_indices bigint;
  v_missing_pages bigint;
  v_missing_metadata bigint;
  v_missing_embeddings bigint;
  v_abnormal_short bigint;
  v_abnormal_long bigint;
  v_total bigint;
begin
  select count(*) into v_total from ipds_rag_documents where document_id = p_document_id;

  select count(*) into v_null_content
  from ipds_rag_documents
  where document_id = p_document_id and (content is null or trim(content) = '');

  select count(*) into v_duplicate_indices
  from (
    select chunk_index
    from ipds_rag_documents
    where document_id = p_document_id
    group by chunk_index
    having count(*) > 1
  ) dups;

  select count(*) into v_missing_pages
  from ipds_rag_documents
  where document_id = p_document_id and (page_number is null or page_number <= 0);

  select count(*) into v_missing_metadata
  from ipds_rag_documents
  where document_id = p_document_id and (metadata is null or metadata = '{}'::jsonb);

  select count(*) into v_missing_embeddings
  from ipds_rag_documents
  where document_id = p_document_id and embedding is null;

  select count(*) into v_abnormal_short
  from ipds_rag_documents
  where document_id = p_document_id and length(trim(content)) < 30;

  select count(*) into v_abnormal_long
  from ipds_rag_documents
  where document_id = p_document_id and length(trim(content)) > 10000;

  total_chunks := v_total;
  null_or_empty_content := v_null_content;
  duplicate_chunks := v_duplicate_indices;
  missing_page_numbers := v_missing_pages;
  missing_metadata := v_missing_metadata;
  missing_embeddings := v_missing_embeddings;
  abnormal_short_chunks := v_abnormal_short;
  abnormal_long_chunks := v_abnormal_long;

  if v_null_content = 0 and v_duplicate_indices = 0 and v_missing_pages = 0 and v_missing_embeddings = 0 and v_total > 0 then
    validation_status := 'PASS';
  elsif v_total > 0 then
    validation_status := 'WARNING';
  else
    validation_status := 'FAIL';
  end if;

  return next;
end;
$$;

-- D. get_document_embedding_status(p_document_id uuid)
create or replace function get_document_embedding_status(p_document_id uuid)
returns table (
  total_chunks bigint,
  embedded_chunks bigint,
  missing_embeddings bigint,
  invalid_dimensions bigint,
  validation_status text
)
language plpgsql
stable
as $$
declare
  v_total bigint;
  v_embedded bigint;
  v_missing bigint;
  v_invalid_dim bigint;
begin
  select count(*) into v_total from ipds_rag_documents where document_id = p_document_id;
  select count(*) into v_embedded from ipds_rag_documents where document_id = p_document_id and embedding is not null;
  select count(*) into v_missing from ipds_rag_documents where document_id = p_document_id and embedding is null;
  select count(*) into v_invalid_dim from ipds_rag_documents where document_id = p_document_id and vector_dims(embedding) != 768;

  total_chunks := v_total;
  embedded_chunks := v_embedded;
  missing_embeddings := v_missing;
  invalid_dimensions := v_invalid_dim;

  if v_total > 0 and v_missing = 0 and v_invalid_dim = 0 then
    validation_status := 'PASS';
  elsif v_embedded > 0 then
    validation_status := 'WARNING';
  else
    validation_status := 'FAIL';
  end if;

  return next;
end;
$$;

-- E. Master Function: validate_rag_document(p_document_id uuid)
create or replace function validate_rag_document(p_document_id uuid)
returns jsonb
language plpgsql
stable
as $$
declare
  v_log record;
  v_chunk_val record;
  v_embed_val record;
  v_overall_status text := 'PASS';
  v_issues text[] := '{}';
begin
  -- Fetch document log
  select * into v_log from ipds_rag_ingestion_log where document_id = p_document_id;
  if not found then
    return jsonb_build_object(
      'status', 'FAIL',
      'error', 'Document ID tidak dijumpai dalam ipds_rag_ingestion_log'
    );
  end if;

  -- Fetch chunk validation
  select * into v_chunk_val from get_document_chunk_validation(p_document_id);
  
  -- Fetch embedding status
  select * into v_embed_val from get_document_embedding_status(p_document_id);

  -- Evaluate Issues & Overall Status
  if v_log.expected_pages != v_log.extracted_pages then
    v_issues := array_append(v_issues, format('Missing pages: expected %s, extracted %s', v_log.expected_pages, v_log.extracted_pages));
    v_overall_status := 'FAIL';
  end if;

  if v_log.failed_pages > 0 then
    v_issues := array_append(v_issues, format('Failed pages count: %s', v_log.failed_pages));
    v_overall_status := 'FAIL';
  end if;

  if v_embed_val.missing_embeddings > 0 then
    v_issues := array_append(v_issues, format('Missing embeddings: %s chunks', v_embed_val.missing_embeddings));
    v_overall_status := 'FAIL';
  end if;

  if v_chunk_val.duplicate_chunks > 0 then
    v_issues := array_append(v_issues, format('Duplicate chunk indices: %s', v_chunk_val.duplicate_chunks));
    v_overall_status := 'FAIL';
  end if;

  if v_chunk_val.null_or_empty_content > 0 then
    v_issues := array_append(v_issues, format('Empty chunk content: %s', v_chunk_val.null_or_empty_content));
    v_overall_status := 'FAIL';
  end if;

  return jsonb_build_object(
    'document_id', p_document_id,
    'file_name', v_log.file_name,
    'category', v_log.category,
    'status', v_overall_status,
    'issues', v_issues,
    'document_summary', jsonb_build_object(
      'file_size_bytes', v_log.file_size_bytes,
      'upload_status', v_log.upload_status,
      'extraction_status', v_log.extraction_status
    ),
    'page_extraction', jsonb_build_object(
      'expected_pages', v_log.expected_pages,
      'extracted_pages', v_log.extracted_pages,
      'failed_pages', v_log.failed_pages,
      'missing_pages', v_log.missing_pages
    ),
    'chunking', jsonb_build_object(
      'total_chunks', v_chunk_val.total_chunks,
      'duplicate_chunks', v_chunk_val.duplicate_chunks,
      'null_or_empty_content', v_chunk_val.null_or_empty_content,
      'missing_page_numbers', v_chunk_val.missing_page_numbers
    ),
    'embeddings', jsonb_build_object(
      'total_chunks', v_embed_val.total_chunks,
      'embedded_chunks', v_embed_val.embedded_chunks,
      'missing_embeddings', v_embed_val.missing_embeddings,
      'invalid_dimensions', v_embed_val.invalid_dimensions
    )
  );
end;
$$;
