-- ==============================================================================
-- MIGRATION: 20261016_passkey_tables.sql
-- PURPOSE: Provision WebAuthn Passkey Tables & Durable Challenge Store for iPDS
-- SPECIFICATION:
--   1. public.user_passkeys: Stores WebAuthn public keys, sign counters, transports,
--      aaguid, and references to user_profiles and registered_devices.
--   2. public.passkey_challenges: Ephemeral challenge store supporting atomic
--      single-use consumption, expiration, and cross-instance serverless operation.
--   3. RPC function consume_passkey_challenge: Race-condition-free challenge validator.
--   4. RLS enabled + forced, service_role execution, and individual user self-management.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. PASSKEY CREDENTIALS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_passkeys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    credential_id TEXT NOT NULL UNIQUE,
    public_key TEXT NOT NULL,
    counter BIGINT NOT NULL DEFAULT 0,
    device_type TEXT NOT NULL DEFAULT 'singleDevice' CHECK (device_type IN ('singleDevice', 'multiDevice')),
    backed_up BOOLEAN NOT NULL DEFAULT FALSE,
    transports TEXT[] DEFAULT '{}',
    aaguid TEXT,
    friendly_name TEXT,
    device_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_passkeys_user_id ON public.user_passkeys (user_id);
CREATE INDEX IF NOT EXISTS idx_user_passkeys_credential_id ON public.user_passkeys (credential_id);
CREATE INDEX IF NOT EXISTS idx_user_passkeys_device_id ON public.user_passkeys (device_id);

-- Row Level Security for user_passkeys
ALTER TABLE public.user_passkeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_passkeys FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.user_passkeys FROM PUBLIC, anon;
GRANT SELECT, DELETE ON public.user_passkeys TO authenticated;
GRANT ALL ON public.user_passkeys TO service_role;

DROP POLICY IF EXISTS "service_role_all_user_passkeys" ON public.user_passkeys;
CREATE POLICY "service_role_all_user_passkeys"
ON public.user_passkeys
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_select_own_passkeys" ON public.user_passkeys;
CREATE POLICY "authenticated_select_own_passkeys"
ON public.user_passkeys
FOR SELECT
TO authenticated
USING (
    user_id::text = (auth.jwt() -> 'app_metadata' ->> 'user_id') OR
    user_id::text = (auth.jwt() ->> 'sub')
);

DROP POLICY IF EXISTS "authenticated_delete_own_passkeys" ON public.user_passkeys;
CREATE POLICY "authenticated_delete_own_passkeys"
ON public.user_passkeys
FOR DELETE
TO authenticated
USING (
    user_id::text = (auth.jwt() -> 'app_metadata' ->> 'user_id') OR
    user_id::text = (auth.jwt() ->> 'sub')
);

-- ------------------------------------------------------------------------------
-- 2. PASSKEY CHALLENGES TABLE (SERVERLESS ATOMIC SINGLE-USE STORE)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.passkey_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge TEXT NOT NULL UNIQUE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL CHECK (purpose IN ('registration', 'authentication')),
    session_id TEXT,
    device_id TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_passkey_challenges_lookup
ON public.passkey_challenges (challenge, expires_at);

CREATE INDEX IF NOT EXISTS idx_passkey_challenges_consumed
ON public.passkey_challenges (consumed_at);

-- Row Level Security: Server-managed internal security table
ALTER TABLE public.passkey_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passkey_challenges FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.passkey_challenges FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.passkey_challenges TO service_role;

DROP POLICY IF EXISTS "service_role_passkey_challenges" ON public.passkey_challenges;
CREATE POLICY "service_role_passkey_challenges"
ON public.passkey_challenges
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 3. ATOMIC CHALLENGE CONSUMPTION STORED FUNCTION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_passkey_challenge(
    p_challenge TEXT,
    p_purpose TEXT,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now TIMESTAMPTZ := clock_timestamp();
    v_row public.passkey_challenges%ROWTYPE;
BEGIN
    UPDATE public.passkey_challenges
    SET consumed_at = v_now
    WHERE challenge = p_challenge
      AND purpose = p_purpose
      AND consumed_at IS NULL
      AND expires_at > v_now
      AND (p_user_id IS NULL OR user_id = p_user_id)
    RETURNING * INTO v_row;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'CHALLENGE_INVALID_OR_EXPIRED',
            'error', 'Cabar keselamatan tidak sah, telah digunakan, atau telah tamat tempoh.'
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'challenge', v_row.challenge,
        'purpose', v_row.purpose,
        'user_id', v_row.user_id,
        'device_id', v_row.device_id,
        'consumed_at', v_row.consumed_at
    );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_passkey_challenge(TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_passkey_challenge(TEXT, TEXT, UUID) TO service_role;

COMMENT ON TABLE public.user_passkeys IS 'Registered WebAuthn passkey credentials per user identity.';
COMMENT ON TABLE public.passkey_challenges IS 'Ephemeral atomic challenge store for serverless WebAuthn flows.';

COMMIT;
