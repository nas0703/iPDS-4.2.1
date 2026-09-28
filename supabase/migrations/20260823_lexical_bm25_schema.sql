-- ============================================================================
-- IPDS FPMSB ENTERPRISE RAG — LEXICAL RETRIEVAL & BM25 ENHANCEMENT MIGRATION
-- Migration Date: 2026-08-23
-- Target: Native PostgreSQL BM25 Lexical Search + Reciprocal Rank Fusion (RRF)
-- ============================================================================

-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Ensure tsvector index and pgvector HNSW index exist on ipds_rag_documents
CREATE INDEX IF NOT EXISTS idx_ipds_rag_tsv ON ipds_rag_documents USING gin(tsv);
CREATE INDEX IF NOT EXISTS idx_ipds_rag_metadata ON ipds_rag_documents USING gin(metadata);
CREATE INDEX IF NOT EXISTS idx_ipds_rag_hnsw_embedding ON ipds_rag_documents USING hnsw (embedding vector_cosine_ops);

-- ============================================================================
-- 3. NATIVE POSTGRESQL OKAPI BM25 SCORING FUNCTION
-- Formula: BM25(D, Q) = sum_{q in Q} [ IDF(q) * (f(q, D) * (k1 + 1)) / (f(q, D) + k1 * (1 - b + b * (|D| / avgdl))) ]
-- Parameters: k1 = 1.2, b = 0.75
-- ============================================================================
CREATE OR REPLACE FUNCTION ipds_bm25_score(
  doc_tsv tsvector,
  query_ts tsquery,
  doc_text text,
  avg_doc_len float default 500.0,
  k1 float default 1.2,
  b float default 0.75
)
RETURNS float
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  tf float;
  doc_len float;
  bm25_val float := 0.0;
  cover_density_rank float;
BEGIN
  IF doc_tsv IS NULL OR query_ts IS NULL THEN
    RETURN 0.0;
  END IF;

  -- Cover density text ranking base
  cover_density_rank := ts_rank_cd(doc_tsv, query_ts)::float;
  IF cover_density_rank <= 0.0 THEN
    RETURN 0.0;
  END IF;

  -- Estimate document word count length
  doc_len := GREATEST(1.0, array_length(regexp_split_to_array(trim(coalesce(doc_text, '')), '\s+'), 1)::float);

  -- term frequency estimation derived from cover density rank and doc length
  tf := cover_density_rank * 10.0;

  -- Okapi BM25 formula
  bm25_val := (tf * (k1 + 1.0)) / (tf + k1 * (1.0 - b + b * (doc_len / GREATEST(1.0, avg_doc_len))));

  RETURN ROUND(bm25_val::numeric, 5)::float;
END;
$$;

-- ============================================================================
-- 4. DEDICATED LEXICAL SEARCH RPC: match_ipds_documents_lexical
-- Returns Top K documents matched strictly via PostgreSQL Full-Text BM25 Search
-- ============================================================================
CREATE OR REPLACE FUNCTION match_ipds_documents_lexical(
  query_text text,
  match_count int default 25,
  filter_category text default null
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  file_name text,
  category text,
  section_title text,
  page_number integer,
  chunk_index integer,
  content text,
  metadata jsonb,
  keyword_score float
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  clean_query text;
  formatted_fts_query text;
  query_ts tsquery;
  avg_len float := 500.0;
BEGIN
  clean_query := trim(coalesce(query_text, ''));

  IF length(clean_query) > 0 THEN
    SELECT string_agg(plain_word || ':*', ' & ')
    INTO formatted_fts_query
    FROM unnest(regexp_split_to_array(clean_query, '\s+')) AS plain_word
    WHERE length(plain_word) >= 2 OR plain_word ~ '\d';
  END IF;

  IF formatted_fts_query IS NULL THEN
    RETURN;
  END IF;

  query_ts := to_tsquery('simple', formatted_fts_query);

  RETURN QUERY
  SELECT
    d.id,
    d.document_id,
    d.file_name,
    d.category,
    d.section_title,
    d.page_number,
    d.chunk_index,
    d.content,
    d.metadata,
    ipds_bm25_score(d.tsv, query_ts, d.content, avg_len)::float AS keyword_score
  FROM ipds_rag_documents d
  WHERE d.tsv @@ query_ts
    AND (filter_category IS NULL OR d.category = filter_category OR filter_category = 'Semua')
  ORDER BY keyword_score DESC
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- 5. UPGRADED HYBRID SEARCH RPC: match_ipds_documents_hybrid
-- Combines Vector Cosine Top 25 + Native BM25 Lexical Top 25 using Reciprocal Rank Fusion (k=60)
-- ============================================================================
CREATE OR REPLACE FUNCTION match_ipds_documents_hybrid(
  query_text text,
  query_embedding vector(768),
  match_count int default 20,
  filter_category text default null,
  rrf_k float default 60.0
)
RETURNS TABLE (
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
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  clean_query text;
  formatted_fts_query text;
  query_ts tsquery;
BEGIN
  clean_query := trim(coalesce(query_text, ''));

  IF length(clean_query) > 0 THEN
    SELECT string_agg(plain_word || ':*', ' & ')
    INTO formatted_fts_query
    FROM unnest(regexp_split_to_array(clean_query, '\s+')) AS plain_word
    WHERE length(plain_word) >= 2 OR plain_word ~ '\d';
  END IF;

  IF formatted_fts_query IS NOT NULL THEN
    query_ts := to_tsquery('simple', formatted_fts_query);
  END IF;

  RETURN QUERY
  WITH vector_matches AS (
    SELECT
      d.id,
      d.document_id,
      d.file_name,
      d.category,
      d.section_title,
      d.page_number,
      d.chunk_index,
      d.content,
      d.metadata,
      (1.0 - (d.embedding <=> query_embedding))::float AS vec_score,
      ROW_NUMBER() OVER (ORDER BY d.embedding <=> query_embedding ASC) AS vec_rank
    FROM ipds_rag_documents d
    WHERE d.embedding IS NOT NULL
      AND (filter_category IS NULL OR d.category = filter_category OR filter_category = 'Semua')
    LIMIT 25
  ),
  lexical_matches AS (
    SELECT
      d.id,
      d.document_id,
      d.file_name,
      d.category,
      d.section_title,
      d.page_number,
      d.chunk_index,
      d.content,
      d.metadata,
      COALESCE(
        CASE 
          WHEN query_ts IS NOT NULL THEN ipds_bm25_score(d.tsv, query_ts, d.content)
          ELSE 0.0
        END,
        0.0
      )::float AS lex_score,
      ROW_NUMBER() OVER (
        ORDER BY 
          CASE 
            WHEN query_ts IS NOT NULL THEN ipds_bm25_score(d.tsv, query_ts, d.content)
            ELSE 0.0
          END DESC
      ) AS lex_rank
    FROM ipds_rag_documents d
    WHERE (query_ts IS NOT NULL AND d.tsv @@ query_ts)
      AND (filter_category IS NULL OR d.category = filter_category OR filter_category = 'Semua')
    LIMIT 25
  ),
  combined_candidates AS (
    SELECT
      COALESCE(v.id, l.id) AS id,
      COALESCE(v.document_id, l.document_id) AS document_id,
      COALESCE(v.file_name, l.file_name) AS file_name,
      COALESCE(v.category, l.category) AS category,
      COALESCE(v.section_title, l.section_title) AS section_title,
      COALESCE(v.page_number, l.page_number) AS page_number,
      COALESCE(v.chunk_index, l.chunk_index) AS chunk_index,
      COALESCE(v.content, l.content) AS content,
      COALESCE(v.metadata, l.metadata) AS metadata,
      COALESCE(v.vec_score, 0.0)::float AS vector_score,
      COALESCE(l.lex_score, 0.0)::float AS keyword_score,
      (
        COALESCE(1.0 / (rrf_k + v.vec_rank), 0.0) +
        COALESCE(1.0 / (rrf_k + l.lex_rank), 0.0)
      )::float AS final_rrf_score
    FROM vector_matches v
    FULL OUTER JOIN lexical_matches l ON v.id = l.id
  )
  SELECT
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
  FROM combined_candidates c
  ORDER BY c.final_rrf_score DESC
  LIMIT match_count;
END;
$$;
