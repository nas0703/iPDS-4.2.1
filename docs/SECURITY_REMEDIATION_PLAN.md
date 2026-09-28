# iPDS 4.1 — Security & Isolation Remediation Plan

> Status: PROPOSED — not implemented.
> Source: read-only review against `AGENTS.md` (2026-09-16).
> Constraint: each item is independently scoped and must be verified with `npm run lint` and `npm run test:all`
> (plus `npm run dr:check` when migrations/DR are touched), with a regression test in the matching test module
> (see `AGENTS.md` §8). No commit without explicit approval (`AGENTS.md` §13).

---

## Severity legend

| Level | Meaning |
| --- | --- |
| P0 / Critical | Active tenant-isolation break or unauthenticated privilege/action. Fix immediately. |
| P1 / High | Rule/implementation contradiction with material security or functional impact. |
| P2 / Medium | Defense-in-depth, consistency, or latent exposure. |
| P3 / Low | Hygiene / documentation drift. |

---

## P0 — Critical

### R1. Lock down public / optional-auth estate routes
- **Contradicts:** `AGENTS.md` §2 (tenant isolation), §4 (auth + `validateTenantAccess` + `req.supabase`), §5 (scoped Supabase).
- **Evidence:**
  - `src/server/routes/hujan.routes.ts:17` — `GET /api/hujan` has no auth middleware; estate from `?estate_id` at `:20-22`; privileged `getSupabase()` at `:25`.
  - `src/server/routes/penggredan.routes.ts:148` — `GET /api/penggredan` uses optional `authenticate`; estate from query/header at `:19`; privileged `getSupabase()` at `:21`; unscoped fallback `return true` at `:34`.
- **Fix:**
  - Require auth (`requireAuth`) on both routes.
  - Read estate only from `req.estateId` (validated by `validateTenantAccess`); remove query/header estate fallbacks.
  - Replace `getSupabase()` with `req.supabase || getScopedSupabase(req.rawToken)`.
  - Remove the `return true` default in the penggredan filter.
- **Regression test:** `scripts/tests/modules/tenant_isolation.test.ts` — anonymous and single-estate callers requesting `?estate_id=FPM_ADELA` must receive 401/403 and no data.
- **Acceptance:** no estate data returned without a validated JWT + tenant scope.

### R2. Lock RBAC registry (mutation + exposure)
- **Contradicts:** `AGENTS.md` §3 (PIN/role changes must be authenticated and go through SSOT), §4.
- **Evidence:**
  - `src/server/routes/settings.routes.ts:316` — `POST /api/settings/rbac` uses optional `authenticate` + `adminRateLimiter` only; anonymous callers can rewrite PINs via `updateServerPinConfig()` and persist to disk (`:336-345`).
  - `src/server/routes/settings.routes.ts:382` — `GET /api/settings/rbac` has no middleware; fallback returns PINs and plaintext `password` fields (`:418-438`).
  - `src/server/middleware/csrf.ts:30-33` — `/api/settings/rbac` and `/api/rbac` are CSRF-exempt (not listed in `AGENTS.md` §4).
- **Fix:**
  - `POST /rbac`: `requireAuth` + super-admin gate (`isFCTunggalSuperAdmin`); no unauthenticated `updateServerPinConfig` path.
  - `GET /rbac`: `requireAuth` + super-admin gate; strip `password`/plaintext PIN from responses.
  - Remove the two CSRF exemptions.
  - Update client `syncPinRegistryFromServer()` (`src/features/auth/services/rbacService.ts:527`) to send authentication or restrict it to admins.
- **Regression test:** `scripts/tests/modules/security_compliance.test.ts` — anonymous GET/POST `/rbac` denied; response contains no `password` field.

### R3. Lock device control endpoints
- **Contradicts:** `AGENTS.md` §1 (device approvals are Super Admin authority), §4 (status-changing device endpoints must be controlled and audited).
- **Evidence:** `src/server/routes/devices.routes.ts`
  - `:197` `GET /quick-approve` — no auth; `action=revoke` needs no PIN (`:246-249`); `action=approve` checks a query-string PIN (`:237`).
  - `:493` `POST /approve-direct` — no session; only body PIN equality against hardcoded admin PINs (see credentials.loader.ts / environment seed) (`:500-502`).
  - `:40` register, `:140` pending-count, `:160/:176` fc-contact — no auth.
  - `:93/:118` approve/revoke use `requireAuth` but no role/super-admin gate; approver role defaults to `'fc'` (`:101`).
- **Fix:**
  - `quick-approve`: require a valid PIN for `revoke` (parity with `approve`), rate-limit, and prefer a signed single-use token over query PINs.
  - `approve-direct`: verify a server-side session/role, not body PIN equality.
  - `approve`/`revoke`: add super-admin role gate; remove the `'fc'` default.
  - `register`/`pending-count`/`fc-contact` POST: require auth; keep GET `fc-contact` public only if non-sensitive.
  - Ensure `DEVICE_*` audit events are emitted for all state changes.
- **Regression test:** `scripts/tests/modules/auth_bypass.test.ts` + `security_compliance.test.ts` — anonymous revoke/approve denied; audit events present.

### R4. Remove committed credentials + rotate secrets
- **Contradicts:** `AGENTS.md` §10 (no production data in tracked `data/*.json`), §13 (never commit secrets).
- **Evidence:** `data/rbac_registry.json` is git-tracked with 25 PIN-keyed entries containing plaintext `pin` and `password`; also review other tracked `data/*.json` (`data/fc_contact.json`, `data/receipt_estate_map.json`) for PII.
- **Fix:**
  - Remove `data/rbac_registry.json` from the repo and add it to `.gitignore`.
  - Because the file exists in git history, **rotate all PINs and the FC Tunggal super-admin credential**.
  - Audit remaining tracked `data/*.json` for production data.
- **Acceptance:** `git ls-files data` contains no credential-bearing files; rotated credentials verified.

---

## P1 — High

### R5. Implement `estateId=ALL` for devices (or correct the rule)
- **Contradicts:** `AGENTS.md` §4 claims `/api/devices/pending-count` and `/list` default to whole-estate (`estateId=ALL`).
- **Evidence:** `devices.routes.ts:142` defaults `req.estateId || 'FPM_TUNGGAL'`; `deviceSecurity.service.ts` `listDevices()` filters `.eq('estate_id', …)` unless `WILAYAH_JB`; `ALL` is not translated. Client polls `?estateId=ALL` at `src/layout/Header.tsx:131`.
- **Decision:** (a) implement `ALL` → all-estate query, gated to `isFCTunggalSuperAdmin` (recommended), or (b) change the client + `AGENTS.md` §4 to a supported scope.
- **Files:** `src/server/routes/devices.routes.ts`, `src/server/services/deviceSecurity.service.ts`, `src/layout/Header.tsx`.

### R6. Remove privileged Supabase client from user-context routes
- **Contradicts:** `AGENTS.md` §5 ("always use `getScopedSupabase` for user-context paths").
- **Evidence:** `src/server/routes/workers.routes.ts:21,70,115,151,195`; `src/server/routes/penggredan.routes.ts:21,76,121`; `src/server/routes/hujan.routes.ts:25,82`.
- **Fix:** use `req.supabase` (set by `requireAuth`) with `getScopedSupabase(req.rawToken)` fallback only.
- **Regression test:** `scripts/tests/modules/scoped_supabase_client.test.ts`.

### R7. Reconcile RLS role SSOT (app ↔ DB)
- **Contradicts:** `AGENTS.md` §1, §2, §5 (single source of truth).
- **Evidence:**
  - App cross-estate (`src/server/middleware/auth.ts:287`): `rc`, `superadmin`, `executive_hq` (+ FC Tunggal).
  - DB `auth_is_cross_estate_role()` (`supabase/migrations/20260911_consolidate_schema_and_rls_alignment.sql`): `('rc','oc','admin','super_admin')`.
  - DB `auth_is_super_admin()` (`supabase/migrations/20260908_phase7_complete_rls_coverage_matrix.sql`): `super_admin, superadmin, executive_hq, rc, regional_controller` OR (`fc` AND `FPM_TUNGGAL`).
  - `supabase/migrations/20260912_finalize_all_tenant_policies.sql:15-63` policies use only `auth_is_cross_estate_role()`, so app-allowed `superadmin`/`executive_hq`/FC-Tunggal are not cross-estate at DB for those tables, while DB allows `admin`/`super_admin` that the app rejects.
- **Decision:** choose one canonical role set; define FC Tunggal cross-estate consistently; regenerate policies so app and DB agree.
- **Fix:** new paired migration (up + policies + `REVOKE`/`GRANT`), no `DISABLE RLS`, no `USING (true)`.
- **Regression test:** `scripts/tests/modules/rls_policies.test.ts`, `version_and_rls_matrix.test.ts`.

### R8. Allow FC Tunggal UI estate switching
- **Contradicts:** `AGENTS.md` §1/§2 (Super Admin operates across estates; UI estate change must not affect authority).
- **Evidence:** `src/config/estateRegistry.ts:471` `canSwitchEstates()` → only `rc/oc/pf`; `getAccessibleEstatesForUser()` returns only own estate for `fc`; `src/components/EstateSwitcherModal.tsx:32-41` blocks selection.
- **Fix:** include FC Tunggal (via super-admin check) in the switchable/accessible estate sets, matching the server behavior.

### R9. Align client/server Super Admin definitions
- **Contradicts:** `AGENTS.md` §1/§3.
- **Evidence:** `src/features/auth/services/rbacService.ts:545-553` treats `admin`, `super_admin`, `rc`, `oc` as Super Admin; server `requireSuperAdmin` (`src/server/routes/auth.routes.ts:828-841`) allows only FC Tunggal. `admin`/`super_admin` are absent from `AuthRole` (`src/server/services/auth.service.ts:5`).
- **Decision:** add `admin`/`super_admin` server-side or remove them client-side; resolve the `rc`/`oc` scope mismatch.

---

## P2 — Medium

### R10. Adopt `safeFetch` for client network calls
- **Contradicts:** `AGENTS.md` §6 (all client calls go through `safeFetch`).
- **Evidence:** ~110 direct `fetch(` calls outside `safeFetch.ts`, e.g. `src/layout/Header.tsx:131`, `src/hooks/useRainfallData.ts:106`, `src/features/merumput/MerumputModule.tsx:260`.
- **Fix:** migrate tenant-critical calls first so `x-estate-id`/auth headers are injected.

### R11. Resolve orphan AI endpoint
- **Contradicts:** `AGENTS.md` §7 route inventory.
- **Evidence:** `src/features/dashboard/components/ManualSawitChatModal.tsx:342` calls `POST /api/ai/search-manual`; no server route exists (`rag.routes.ts` exposes `manual-rag`/`enterprise-rag`).
- **Fix:** implement the route or repoint the client.

### R12. Remove `GEMINI_API_KEY` from the client bundle
- **Contradicts:** `AGENTS.md` §4/§13 (never pass secrets to client); also contradicts §7's client-injection note.
- **Evidence:** `vite.config.ts:11` defines `process.env.GEMINI_API_KEY` for client code (currently unreferenced → latent).
- **Fix:** delete the define; keep the key server-only.

### R13. Protect debug endpoints
- **Contradicts:** `AGENTS.md` §4.
- **Evidence:** `src/server/serverless.ts:89` `GET /api/test-direct`, `:186` `GET /db-health` have no auth.
- **Fix:** gate behind auth/super-admin or remove in production.

### R14. Quarantine legacy root SQL
- **Contradicts:** `AGENTS.md` §5 (never `DISABLE ROW LEVEL SECURITY` / `USING (true)`) and §10 (migrations are authoritative).
- **Evidence:** `setup_pekerja.sql:41-54`, `setup_hujan_backlog_multi_estate.sql:103-129` (`USING (true)`), `setup_hujan_rls.sql:5`, `disable_all_rls.sql:4-18`.
- **Fix:** move to a clearly non-production `legacy/` path or add execution guards.

### R15. Remove/relocate on-hold migration
- **Contradicts:** `AGENTS.md` §5 ("migrations are source of truth").
- **Evidence:** `supabase/migrations/20260901_ipds_enterprise_rls_blueprint.sql` marked "PROPOSED — NOT EXECUTED (ON HOLD)".

---

## P3 — Low

- **R16. `lazyWithRetry.ts` is unused** (`AGENTS.md` §6 presents it as the chunk-retry mechanism). Delete it or adopt it in `src/layout/AppModalsContainer.tsx`.
- **R17. Test registry drift:** `scripts/dr/ci_preflight.ts:112-120` enforces 9 modules while `scripts/tests/run_all_tests.ts` runs 20; `AGENTS.md` §8 requires consistency.
- **R18. Role union drift:** `executive_hq` appears in `src/server/middleware/auth.ts:287` but is absent from `AuthRole` (`src/server/services/auth.service.ts:5`) — add it or remove the reference.
- **R19. RLS claim path drift:** `active_sessions` reads `request.jwt.claim.app_metadata` while `public.auth_*` helpers read `request.jwt.claims` — unify.

---

## Sequencing & validation gates

1. **P0 security PR (R1–R4)** — verify `npm run lint && npm run test:all && npm run test:auth-bypass`.
2. **P1 split:**
   - R6 + R8 (application layer).
   - R7 (paired migration; run `npm run dr:check`).
   - R5 + R9 (require product decision).
3. **P2/P3** as backlog; group by area (client, API, DB, tests).

Every change:
- adds a regression test in the matching module (or creates one and registers it in `run_all_tests.ts`);
- keeps `AGENTS.md` in sync when behavior changes;
- never weakens auth, tenant isolation, RLS, CSRF, rate limits, or RAG guardrails (`AGENTS.md` §14.3);
- is not committed without explicit approval (`AGENTS.md` §13).

---

## Open decisions (blocking P1)

| ID | Question | Recommended |
| --- | --- | --- |
| R5 | Should `estateId=ALL` aggregate all estates server-side? | Yes, gated to FC Tunggal super-admin. |
| R7 | What is the canonical cross-estate / super-admin role set? | `rc`, `oc`, `superadmin`, `admin`, `super_admin`, `executive_hq`, plus FC Tunggal (`fc` + `FPM_TUNGGAL`). |
| R9 | Are `admin`/`super_admin` real server roles? | Add them to `AuthRole` for parity, or remove from client `isSuperAdmin`. |
