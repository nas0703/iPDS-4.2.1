-- ==============================================================================
-- MIGRATION: 20260927_p1_device_merge_function.sql
-- PURPOSE: P1 — transactional, idempotent device-merge primitive used by the
--          admin UI / API. Single atomic operation with row locks and guards.
--
-- PREREQUISITE: 20260926_p1_device_merge_tracking.sql (columns + archive table).
--
-- SAFETY:
--   * SECURITY INVOKER (no privilege escalation); EXECUTE granted only to
--     service_role.
--   * NEVER deletes registered_devices rows; duplicates are marked merged_into
--     and set to status='REVOKED'.
--   * NEVER copies or overwrites credential_hash.
--   * Archive preserves the complete original rows.
--   * Raises an exception (=> full rollback) on any guard failure.
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.merge_registered_devices(
    p_operation_id TEXT,
    p_canonical_device_id TEXT,
    p_duplicate_device_ids TEXT[]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_canonical public.registered_devices%ROWTYPE;
    v_dup public.registered_devices%ROWTYPE;
    v_dup_id TEXT;
    v_estate TEXT;
    v_archived INT := 0;
    v_merged TEXT[] := ARRAY[]::TEXT[];
    v_already TEXT[] := ARRAY[]::TEXT[];
BEGIN
    IF p_operation_id IS NULL OR btrim(p_operation_id) = '' THEN
        RAISE EXCEPTION 'MERGE_INVALID_OPERATION_ID';
    END IF;
    IF p_canonical_device_id IS NULL OR btrim(p_canonical_device_id) = '' THEN
        RAISE EXCEPTION 'MERGE_CANONICAL_REQUIRED';
    END IF;
    IF p_duplicate_device_ids IS NULL OR array_length(p_duplicate_device_ids, 1) IS NULL THEN
        RAISE EXCEPTION 'MERGE_DUPLICATES_REQUIRED';
    END IF;
    IF to_regclass('public.registered_devices_archive') IS NULL THEN
        RAISE EXCEPTION 'MERGE_ARCHIVE_MISSING';
    END IF;

    -- Lock the canonical row for the whole transaction.
    SELECT * INTO v_canonical
      FROM public.registered_devices
     WHERE device_id = p_canonical_device_id
       FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'MERGE_CANONICAL_NOT_FOUND'; END IF;
    IF v_canonical.status <> 'APPROVED' THEN RAISE EXCEPTION 'MERGE_CANONICAL_NOT_APPROVED'; END IF;
    IF v_canonical.merged_into IS NOT NULL THEN RAISE EXCEPTION 'MERGE_CANONICAL_IS_DUPLICATE'; END IF;
    v_estate := v_canonical.estate_id;

    -- Archive canonical-before state exactly once per (operation, canonical).
    IF NOT EXISTS (
        SELECT 1 FROM public.registered_devices_archive a
         WHERE a.merge_operation_id = p_operation_id
           AND a.row_role = 'CANONICAL_BEFORE'
           AND a.device_id = p_canonical_device_id
    ) THEN
        INSERT INTO public.registered_devices_archive
            (merge_operation_id, row_role, canonical_device_id, device_id, row_data)
        VALUES
            (p_operation_id, 'CANONICAL_BEFORE', p_canonical_device_id, p_canonical_device_id, to_jsonb(v_canonical));
        v_archived := v_archived + 1;
    END IF;

    FOREACH v_dup_id IN ARRAY p_duplicate_device_ids LOOP
        IF v_dup_id = p_canonical_device_id THEN RAISE EXCEPTION 'MERGE_SELF_MERGE'; END IF;

        SELECT * INTO v_dup
          FROM public.registered_devices
         WHERE device_id = v_dup_id
           FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'MERGE_DUPLICATE_NOT_FOUND: %', v_dup_id; END IF;

        -- Idempotency: same operation re-submitted -> no second merge.
        IF v_dup.merged_into = p_canonical_device_id AND v_dup.merge_operation_id = p_operation_id THEN
            v_already := array_append(v_already, v_dup_id);
            CONTINUE;
        END IF;

        IF v_dup.merged_into IS NOT NULL THEN RAISE EXCEPTION 'MERGE_DUPLICATE_ALREADY_MERGED: %', v_dup_id; END IF;
        IF v_dup.status <> 'APPROVED' THEN RAISE EXCEPTION 'MERGE_DUPLICATE_NOT_APPROVED: %', v_dup_id; END IF;
        IF v_dup.estate_id IS DISTINCT FROM v_estate THEN RAISE EXCEPTION 'MERGE_CROSS_ESTATE: %', v_dup_id; END IF;

        INSERT INTO public.registered_devices_archive
            (merge_operation_id, row_role, canonical_device_id, device_id, row_data)
        VALUES
            (p_operation_id, 'DUPLICATE', p_canonical_device_id, v_dup_id, to_jsonb(v_dup));
        v_archived := v_archived + 1;

        UPDATE public.registered_devices
           SET merged_into = p_canonical_device_id,
               merged_at = NOW(),
               merge_operation_id = p_operation_id,
               status = 'REVOKED'
         WHERE device_id = v_dup_id;
        v_merged := array_append(v_merged, v_dup_id);
    END LOOP;

    -- Refresh canonical last_seen_at from the duplicates merged by this operation.
    UPDATE public.registered_devices c
       SET last_seen_at = GREATEST(
             COALESCE(c.last_seen_at, c.created_at),
             COALESCE((SELECT MAX(d.last_seen_at) FROM public.registered_devices d
                        WHERE d.merged_into = p_canonical_device_id
                          AND d.merge_operation_id = p_operation_id), c.last_seen_at, c.created_at)
           )
     WHERE c.device_id = p_canonical_device_id;

    RETURN jsonb_build_object(
        'status', 'OK',
        'operation_id', p_operation_id,
        'canonical_device_id', p_canonical_device_id,
        'estate_id', v_estate,
        'merged_duplicate_ids', to_jsonb(v_merged),
        'already_merged_ids', to_jsonb(v_already),
        'archived_rows', v_archived,
        'merged_at', NOW()
    );
END;
$$;

REVOKE ALL ON FUNCTION public.merge_registered_devices(TEXT, TEXT, TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_registered_devices(TEXT, TEXT, TEXT[]) FROM anon;
REVOKE ALL ON FUNCTION public.merge_registered_devices(TEXT, TEXT, TEXT[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.merge_registered_devices(TEXT, TEXT, TEXT[]) TO service_role;

COMMENT ON FUNCTION public.merge_registered_devices(TEXT, TEXT, TEXT[]) IS
'P1 transactional device soft-merge. service_role only. Validates same-estate/APPROVED/not-already-merged, archives originals, revokes duplicates, never deletes or copies credential_hash.';

COMMIT;
