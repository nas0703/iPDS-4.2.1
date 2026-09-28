-- ==============================================================================
-- Migration: 20261001_revoke_rate_limit_buckets_authenticated_table_grant.sql
-- Description: Defense-in-depth hardening: Revoke table-level access on
--              public.rate_limit_buckets from authenticated role.
-- Pattern: Aligns with P0-04 hardening pattern where internal security infrastructure
--          tables must never be granted directly to authenticated users.
-- Note: While RLS (FORCE ROW LEVEL SECURITY with service_role-only policy) already
--       blocks authenticated users from reading/writing rows, revoking the table-level
--       grant closes the gap where RLS alone was the only barrier.
-- ==============================================================================

-- 1. Revoke all privileges on rate_limit_buckets table from authenticated users
REVOKE ALL ON public.rate_limit_buckets FROM authenticated;

-- 2. Explicitly ensure service_role retains full administrative privileges
GRANT ALL ON public.rate_limit_buckets TO service_role;

-- 3. Document table security model
COMMENT ON TABLE public.rate_limit_buckets IS 'Internal rate limiting durable bucket store. Restricted exclusively to service_role (P0-04 defense-in-depth model).';
