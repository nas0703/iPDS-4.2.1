-- ============================================================================
-- IPDS OBSERVABILITY STEP 4B: ADDITIVE SUPABASE DATABASE MIGRATION
-- MIGRATION NAME: 20260826_observability_persistent_history.sql
-- 
-- STRICT ZERO-DISRUPTION COMPLIANCE:
-- 1. ADDITIVE ONLY: Creates new isolated observability_* tables & indexes.
-- 2. ZERO MODIFICATIONS to existing plantation domain tables (hantaran, timbangan, etc.).
-- 3. UNTOUCHED: Existing migrations, business logic, auth, and plantation RLS policies.
-- 4. BACKEND-ONLY SECURITY: RLS enabled with full anon lockout; only service_role can access.
-- ============================================================================

-- 1. Create table for system operational metric snapshots (Hourly aggregations)
CREATE TABLE IF NOT EXISTS public.observability_metric_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    window_start TIMESTAMPTZ NOT NULL,
    window_end TIMESTAMPTZ NOT NULL,
    environment VARCHAR(50) NOT NULL DEFAULT 'production',
    
    -- Request & Error Aggregates
    total_requests INTEGER NOT NULL DEFAULT 0,
    success_requests INTEGER NOT NULL DEFAULT 0,
    client_errors INTEGER NOT NULL DEFAULT 0,
    server_errors INTEGER NOT NULL DEFAULT 0,
    error_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.0000,
    
    -- Latency Metrics (Milliseconds)
    latency_min_ms NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    latency_avg_ms NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    latency_max_ms NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    latency_p50_ms NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    latency_p95_ms NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    latency_p99_ms NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    
    -- Server Runtime & Resource Metrics
    heap_used_mb NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    heap_total_mb NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    rss_mb NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    uptime_seconds INTEGER NOT NULL DEFAULT 0,
    
    -- Operational Alert State at Snapshot Time
    active_alert_state VARCHAR(20) NOT NULL DEFAULT 'NORMAL', -- 'NORMAL', 'WARNING', 'CRITICAL'
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Idempotency constraint to prevent multi-instance duplicate writes for the same window
    CONSTRAINT uq_metric_snapshot_window UNIQUE (window_start, window_end, environment)
);

-- 2. Create table for alert incident events & state transitions
CREATE TABLE IF NOT EXISTS public.observability_incident_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    environment VARCHAR(50) NOT NULL DEFAULT 'production',
    
    event_type VARCHAR(50) NOT NULL, -- 'observability.alert.warning', 'observability.alert.critical', 'observability.alert.recovered'
    alert_type VARCHAR(50) NOT NULL, -- 'error_rate', 'latency_p95', 'latency_p99', 'memory_pressure'
    severity VARCHAR(20) NOT NULL,   -- 'info', 'warning', 'critical'
    
    previous_state VARCHAR(20) NOT NULL, -- 'NORMAL', 'WARNING', 'CRITICAL'
    new_state VARCHAR(20) NOT NULL,      -- 'NORMAL', 'WARNING', 'CRITICAL'
    
    metric_value NUMERIC(12, 4) NOT NULL,
    threshold_value NUMERIC(12, 4) NOT NULL,
    
    trace_id VARCHAR(64),
    request_id VARCHAR(64),
    
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Dedicated lightweight indexes for fast dashboard queries
CREATE INDEX IF NOT EXISTS idx_obs_snapshots_window 
ON public.observability_metric_snapshots (recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_obs_incidents_timeline 
ON public.observability_incident_events (occurred_at DESC, severity);

CREATE INDEX IF NOT EXISTS idx_obs_incidents_trace_lookup 
ON public.observability_incident_events (trace_id) 
WHERE trace_id IS NOT NULL;

-- 4. Enable Row Level Security (RLS) on new observability tables
ALTER TABLE public.observability_metric_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observability_incident_events ENABLE ROW LEVEL SECURITY;

-- 5. Strict Backend-Only RLS Policies (Service Role Access Only; Full Anon/Public Lockout)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'observability_metric_snapshots' 
        AND policyname = 'Allow backend service full access to metric snapshots'
    ) THEN
        CREATE POLICY "Allow backend service full access to metric snapshots"
        ON public.observability_metric_snapshots
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'observability_incident_events' 
        AND policyname = 'Allow backend service full access to incident events'
    ) THEN
        CREATE POLICY "Allow backend service full access to incident events"
        ON public.observability_incident_events
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;
