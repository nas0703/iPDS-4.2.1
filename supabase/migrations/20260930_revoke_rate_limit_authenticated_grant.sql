-- ==============================================================================
-- MIGRATION: 20260930_revoke_rate_limit_authenticated_grant.sql
-- DESCRIPTION: Security Hardening - Revoke authenticated execute grant on rate limiter RPCs
-- AUTHOR: CTO / Senior Full-Stack Architect
-- SPECIFICATION:
--   1. Revoke EXECUTE on increment_rate_limit_bucket from authenticated and PUBLIC/anon
--   2. Grant EXECUTE on increment_rate_limit_bucket to service_role only
--   3. Confirm cleanup_stale_rate_limit_buckets is strictly service_role only
--   4. Prevents authenticated clients from invoking the RPC directly via PostgREST
-- ==============================================================================

-- 1. Ensure increment_rate_limit_bucket can only be executed by service_role (server backend)
REVOKE ALL ON FUNCTION public.increment_rate_limit_bucket(TEXT, TEXT, INT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_rate_limit_bucket(TEXT, TEXT, INT, BIGINT) TO service_role;

-- 2. Ensure cleanup_stale_rate_limit_buckets can only be executed by service_role (cron / maintenance)
REVOKE ALL ON FUNCTION public.cleanup_stale_rate_limit_buckets(INTERVAL) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_rate_limit_buckets(INTERVAL) TO service_role;
