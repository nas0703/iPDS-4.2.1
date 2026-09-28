-- ============================================================================
-- IPDS RAG ENGINE: RAG PERFORMANCE & REASONING LOGS
-- MIGRATION: 20260827_rag_performance_logs.sql
--
-- Captures user questions, retrieval candidates, MMR reranking details,
-- hard-gate evaluation, context compression, alignment verification,
-- and the complete reasoning path for deep diagnostics of failing queries.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rag_performance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Query Input Metadata
    user_query TEXT NOT NULL,
    category_filter VARCHAR(100) NOT NULL DEFAULT 'Semua',
    user_id VARCHAR(100),
    project_id VARCHAR(100),
    
    -- Execution Outcome & Status
    execution_status VARCHAR(50) NOT NULL, -- 'SUCCESS', 'HARD_GATE_BLOCKED', 'NO_EVIDENCE', 'GENERATION_ERROR', 'UNGROUNDED', 'CACHED'
    is_grounded BOOLEAN NOT NULL DEFAULT false,
    hard_gate_triggered BOOLEAN NOT NULL DEFAULT false,
    failure_reason TEXT,
    
    -- Key Numerical & Quality Metrics
    latency_ms INTEGER NOT NULL DEFAULT 0,
    is_cached BOOLEAN NOT NULL DEFAULT false,
    final_confidence NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    evidence_coverage NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    retrieval_score NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    source_authority NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    numerical_accuracy_rate NUMERIC(5, 2) DEFAULT 100.00,
    
    -- Citation & Evidence Summary
    citations_count INTEGER NOT NULL DEFAULT 0,
    citations JSONB DEFAULT '[]'::jsonb,
    
    -- Detailed Step-by-Step Reasoning Path
    -- Stores { queryAnalysis, retrievalStage, rerankingStage, hardGateCheck, contextCompression, generationStage, verificationReport }
    reasoning_path JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Result Preview
    response_preview TEXT
);

-- Dedicated Indexes for Fast Analysis & Troubleshooting
CREATE INDEX IF NOT EXISTS idx_rag_logs_created_at 
ON public.rag_performance_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rag_logs_status 
ON public.rag_performance_logs (execution_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rag_logs_hard_gate 
ON public.rag_performance_logs (hard_gate_triggered, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rag_logs_query_trgm 
ON public.rag_performance_logs USING gin (user_query gin_trgm_ops);

-- Enable Row Level Security
ALTER TABLE public.rag_performance_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated backend and service role full access
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'rag_performance_logs' 
        AND policyname = 'Allow service_role full access to rag_performance_logs'
    ) THEN
        CREATE POLICY "Allow service_role full access to rag_performance_logs"
        ON public.rag_performance_logs
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'rag_performance_logs' 
        AND policyname = 'Allow authenticated read access to rag_performance_logs'
    ) THEN
        CREATE POLICY "Allow authenticated read access to rag_performance_logs"
        ON public.rag_performance_logs
        FOR SELECT
        TO authenticated
        USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'rag_performance_logs' 
        AND policyname = 'Allow anon insert access for logging'
    ) THEN
        CREATE POLICY "Allow anon insert access for logging"
        ON public.rag_performance_logs
        FOR INSERT
        TO anon, authenticated
        WITH CHECK (true);
    END IF;
END $$;
