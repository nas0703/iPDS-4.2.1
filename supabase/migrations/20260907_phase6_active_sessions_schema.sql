-- ======================================================================================
-- MIGRATION: 20260907_phase6_active_sessions_schema.sql
-- DESCRIPTION: Active Sessions, Sliding Window State & Instantaneous Token Revocation
-- AUTHOR: IPDS Principal Security & Architecture Team
-- ======================================================================================

-- 1. Create table for persistent active sessions and device tokens
CREATE TABLE IF NOT EXISTS public.active_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL UNIQUE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    operator_id VARCHAR(50) NOT NULL,
    operator_name VARCHAR(150) NOT NULL,
    app_role VARCHAR(20) NOT NULL,
    assigned_estate VARCHAR(50) NOT NULL REFERENCES public.org_estates(estate_id) ON UPDATE CASCADE,
    connected_estate VARCHAR(50) NOT NULL REFERENCES public.org_estates(estate_id) ON UPDATE CASCADE,
    kiosk_id VARCHAR(100) NOT NULL,
    station_name VARCHAR(150),
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED', 'EXPIRED')),
    revoked_by VARCHAR(150),
    revoked_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '12 hours')
);

-- 2. Indexes for fast session verification, cleanup, and audit inspection
CREATE INDEX IF NOT EXISTS idx_active_sessions_lookup 
ON public.active_sessions (session_id, status, expires_at);

CREATE INDEX IF NOT EXISTS idx_active_sessions_operator 
ON public.active_sessions (operator_id, connected_estate);

CREATE INDEX IF NOT EXISTS idx_active_sessions_estate 
ON public.active_sessions (assigned_estate, created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies:
-- 4a. Users can view and inspect their own active sessions
DROP POLICY IF EXISTS "Users can view own active sessions" ON public.active_sessions;
CREATE POLICY "Users can view own active sessions"
ON public.active_sessions
FOR SELECT
USING (
    operator_id = current_setting('request.jwt.claim.app_metadata.operator_id', true)
    OR
    user_id = (SELECT id FROM public.user_profiles WHERE staff_no = current_setting('request.jwt.claim.app_metadata.operator_id', true) LIMIT 1)
);

-- 4b. Super Admin (FC Tunggal) and Regional Controllers (RC) have full audit visibility across all sessions
DROP POLICY IF EXISTS "Super Admin and RC can view all sessions" ON public.active_sessions;
CREATE POLICY "Super Admin and RC can view all sessions"
ON public.active_sessions
FOR SELECT
USING (
    current_setting('request.jwt.claim.app_metadata.app_role', true) IN ('rc', 'superadmin')
    OR (
        current_setting('request.jwt.claim.app_metadata.app_role', true) = 'fc'
        AND current_setting('request.jwt.claim.app_metadata.estate_id', true) = 'FPM_TUNGGAL'
    )
);

-- 4c. Super Admin can revoke or update session records
DROP POLICY IF EXISTS "Super Admin can manage sessions" ON public.active_sessions;
CREATE POLICY "Super Admin can manage sessions"
ON public.active_sessions
FOR UPDATE
USING (
    current_setting('request.jwt.claim.app_metadata.app_role', true) IN ('rc', 'superadmin')
    OR (
        current_setting('request.jwt.claim.app_metadata.app_role', true) = 'fc'
        AND current_setting('request.jwt.claim.app_metadata.estate_id', true) = 'FPM_TUNGGAL'
    )
);

-- 4d. Server service role has full access
DROP POLICY IF EXISTS "Service role full session access" ON public.active_sessions;
CREATE POLICY "Service role full session access"
ON public.active_sessions
FOR ALL
USING (auth.role() = 'service_role');

-- 5. Comments
COMMENT ON TABLE public.active_sessions IS 'Tracks stateful active session sliding windows, device heartbeats, and blacklist revocations for Supabase JWT tokens.';
