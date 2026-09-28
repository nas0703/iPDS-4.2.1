-- ==============================================================================
-- ROLLBACK: 20260929_p1_1d_employee_create_atomic_rpc_rollback.sql
-- Reverses: 20260929_p1_1d_employee_create_atomic_rpc.sql
--
-- Location note: kept OUTSIDE supabase/migrations/ on purpose so the Supabase
-- CLI does not auto-apply this destructive script as a forward migration when
-- `supabase db push` runs (it applies every *.sql in supabase/migrations/).
-- Apply manually only during a reviewed rollback.
-- ==============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.create_employee_with_assignment(
    uuid, uuid, uuid, varchar, varchar, varchar, varchar, varchar, varchar,
    date, varchar, varchar, varchar, date, text
);

COMMIT;
