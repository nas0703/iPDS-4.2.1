-- ==============================================================================
-- iPDS P1 — SAFE SOFT-MERGE of duplicate registered_devices rows
-- ==============================================================================
-- PREREQUISITE: run migration 20260926_p1_device_merge_tracking.sql first.
--
-- OPERATOR INSTRUCTIONS
--   1. Determine HIGH-CONFIDENCE canonical -> duplicate pairs from the live rows
--      (see the candidate query at the bottom; HIGH confidence requires multiple
--      matching signals, NOT just device_name/operator_name/user_agent).
--   2. Replace the VALUES in the merge_map INSERT below. Only HIGH-confidence
--      pairs. Never merge across estate_id.
--   3. Set v_op to a unique operation id.
--   4. Run this file inside psql (it manages its own BEGIN/COMMIT).
--
-- SAFETY
--   * soft-merge only: duplicates are PRESERVED, marked merged_into, and set to
--     status 'REVOKED' so their existing credential can no longer authenticate.
--   * NEVER copies/overwrites credential_hash (unique constraint safe).
--   * NEVER deletes a registered_devices row.
--   * NEVER touches security_audit_logs.
--   * Transactional with pre-COMMIT verification; ROLLBACK on any failure.
--   * No credential_hash value is ever selected into the output below.
-- ==============================================================================

\set ON_ERROR_STOP on

BEGIN;

-- --- Operation id -------------------------------------------------------------
CREATE TEMP TABLE merge_op (merge_operation_id TEXT) ON COMMIT DROP;
INSERT INTO merge_op VALUES ('MERGE-2026-<REPLACE-WITH-UNIQUE-ID>');

-- --- Mapping (ONLY HIGH-CONFIDENCE PAIRS) -------------------------------------
CREATE TEMP TABLE merge_map (canonical_device_id TEXT, duplicate_device_id TEXT) ON COMMIT DROP;
INSERT INTO merge_map (canonical_device_id, duplicate_device_id) VALUES
    ('DEV-XXXXXXXX-XXXX', 'DEV-YYYYYYYY-YYYY')
    -- , ('DEV-...', 'DEV-...')
;

-- --- Guard: archive schema must exist (do not invent tables here) -------------
DO $$
BEGIN
    IF to_regclass('public.registered_devices_archive') IS NULL THEN
        RAISE EXCEPTION 'MERGE_ABORT: archive table missing; apply migration 20260926 first';
    END IF;
END $$;

-- --- Guard: pair integrity (existence, same estate, both APPROVED, not self) --
DO $$
DECLARE bad text;
BEGIN
    SELECT string_agg(m.duplicate_device_id, ',') INTO bad
    FROM merge_map m
    LEFT JOIN public.registered_devices c ON c.device_id = m.canonical_device_id
    LEFT JOIN public.registered_devices d ON d.device_id = m.duplicate_device_id
    WHERE c.device_id IS NULL OR d.device_id IS NULL
       OR c.device_id = d.device_id
       OR c.estate_id IS DISTINCT FROM d.estate_id
       OR c.status <> 'APPROVED' OR d.status <> 'APPROVED'
       OR d.merged_into IS NOT NULL;
    IF bad IS NOT NULL THEN
        RAISE EXCEPTION 'MERGE_ABORT: guard failed for duplicate(s): %', bad;
    END IF;
END $$;

-- --- Guard: canonical must not be a duplicate of another canonical -------------
DO $$
DECLARE bad text;
BEGIN
    SELECT string_agg(m.canonical_device_id, ',') INTO bad
    FROM merge_map m
    WHERE EXISTS (SELECT 1 FROM merge_map m2 WHERE m2.duplicate_device_id = m.canonical_device_id);
    IF bad IS NOT NULL THEN
        RAISE EXCEPTION 'MERGE_ABORT: canonical also listed as duplicate: %', bad;
    END IF;
END $$;

-- --- Archive the complete original rows (canonical-before and duplicates) -----
INSERT INTO public.registered_devices_archive
    (merge_operation_id, row_role, canonical_device_id, device_id, row_data)
SELECT o.merge_operation_id, 'CANONICAL_BEFORE', m.canonical_device_id, c.device_id, to_jsonb(c)
FROM merge_map m
CROSS JOIN merge_op o
JOIN public.registered_devices c ON c.device_id = m.canonical_device_id;

INSERT INTO public.registered_devices_archive
    (merge_operation_id, row_role, canonical_device_id, device_id, row_data)
SELECT o.merge_operation_id, 'DUPLICATE', m.canonical_device_id, d.device_id, to_jsonb(d)
FROM merge_map m
CROSS JOIN merge_op o
JOIN public.registered_devices d ON d.device_id = m.duplicate_device_id;

-- --- Refresh canonical last_seen_at (no credential change) --------------------
UPDATE public.registered_devices c
SET last_seen_at = GREATEST(c.last_seen_at, d.last_seen_at)
FROM public.registered_devices d
JOIN merge_map m ON m.duplicate_device_id = d.device_id
WHERE c.device_id = m.canonical_device_id;

-- --- Soft-merge duplicates: mark + revoke (row preserved, hash preserved) -----
UPDATE public.registered_devices rd
SET merged_into = m.canonical_device_id,
    merged_at = NOW(),
    merge_operation_id = o.merge_operation_id,
    status = 'REVOKED'
FROM merge_map m
CROSS JOIN merge_op o
WHERE rd.device_id = m.duplicate_device_id;

-- ============================ VERIFICATION ====================================
-- 1. row count unchanged vs baseline (captured by operator)
-- 2. every duplicate has merged_into populated
-- 3. every canonical remains APPROVED
-- 4. no cross-estate merge
-- 5. no credential_hash uniqueness violation
-- 6. archive captured every involved row
-- ==============================================================================
DO $$
DECLARE n_bad int;
BEGIN
    SELECT count(*) INTO n_bad FROM merge_map m
    JOIN public.registered_devices d ON d.device_id = m.duplicate_device_id
    WHERE d.merged_into IS DISTINCT FROM m.canonical_device_id;
    IF n_bad > 0 THEN RAISE EXCEPTION 'VERIFY_FAIL: duplicate not marked merged'; END IF;

    SELECT count(*) INTO n_bad FROM merge_map m
    JOIN public.registered_devices c ON c.device_id = m.canonical_device_id
    WHERE c.status <> 'APPROVED';
    IF n_bad > 0 THEN RAISE EXCEPTION 'VERIFY_FAIL: canonical not APPROVED'; END IF;

    SELECT count(*) INTO n_bad FROM merge_map m
    JOIN public.registered_devices c ON c.device_id = m.canonical_device_id
    JOIN public.registered_devices d ON d.device_id = m.duplicate_device_id
    WHERE c.estate_id IS DISTINCT FROM d.estate_id;
    IF n_bad > 0 THEN RAISE EXCEPTION 'VERIFY_FAIL: cross-estate merge'; END IF;

    -- Never SELECT credential_hash values; detect duplicates by counting only.
    SELECT (count(*) - count(DISTINCT credential_hash)) INTO n_bad
    FROM public.registered_devices WHERE credential_hash IS NOT NULL;
    IF n_bad > 0 THEN RAISE EXCEPTION 'VERIFY_FAIL: credential_hash uniqueness violated'; END IF;

    SELECT count(*) INTO n_bad FROM merge_map m
    WHERE (SELECT count(*) FROM public.registered_devices_archive a
           WHERE a.canonical_device_id = m.canonical_device_id
             AND a.device_id IN (m.canonical_device_id, m.duplicate_device_id)) < 2;
    IF n_bad > 0 THEN RAISE EXCEPTION 'VERIFY_FAIL: archive incomplete'; END IF;
END $$;

-- All guards passed:
COMMIT;
-- On any error above, the transaction aborts automatically (ON_ERROR_STOP + BEGIN/EXCEPTION).

-- ==============================================================================
-- HIGH-CONFIDENCE CANDIDATE QUERY (READ-ONLY; run BEFORE choosing merge_map)
-- Review only — cluster membership is NOT proof of same physical device.
-- ==============================================================================
-- SELECT device_id, device_name, estate_id, status,
--        (credential_hash IS NOT NULL) AS credential_present,
--        credential_version, credential_rotated_at,
--        operator_name, role, ip_address, user_agent, created_at, last_seen_at
-- FROM public.registered_devices
-- WHERE estate_id = 'FPM_TUNGGAL'
-- ORDER BY device_name, created_at;
