# PR: P0 — Harden unauthenticated estate, RBAC and device access

**Branch:** `fix/p0-01-unauth-access-hardening`
**Base:** `main` (or `develop`)
**Commits:**
- `acfbf91` fix(security): harden unauthenticated estate, rbac and device access
- `568b2b6` docs: expand AGENTS.md rules and add security remediation plan

---

## Summary

Closes the P0 findings from the read-only review against `AGENTS.md`. Fixes active
tenant-isolation breaks and unauthenticated privilege/action paths in the API layer.

## Why

- `GET /api/hujan` required no authentication and accepted `?estate_id=` directly.
- `GET /api/penggredan` used optional `authenticate`, so anonymous callers could read another estate.
- `GET/POST /api/settings/rbac` were effectively public and returned plaintext passwords.
- Device revoke was possible without authentication or PIN via the WhatsApp quick-approve link.
- `data/rbac_registry.json` (25 plaintext PIN/password entries) was tracked in git.

## Changes

### R1 — Estate route authentication
- `src/server/routes/hujan.routes.ts`: `GET /api/hujan` now `requireAuth`; estate read only from
  validated `req.estateId`; privileged `getSupabase()` replaced with scoped client.
- `src/server/routes/penggredan.routes.ts`: `GET /api/penggredan` switched from optional `authenticate`
  to `requireAuth`; estate from `req.estateId` only; scoped client; unscoped filter default removed;
  DELETE now scoped by `estate_id`.

### R2 — RBAC registry lockdown
- `src/server/routes/settings.routes.ts`: `GET`/`POST /api/settings/rbac` require
  `requireAuth + requireSuperAdmin`; `password` stripped from all responses via `sanitizeRbacRegistry`.
- `src/server/middleware/csrf.ts`: removed `/api/settings/rbac` and `/api/rbac` exemptions.

### R3 — Device control hardening
- `src/server/routes/devices.routes.ts`:
  - `list`, `approve`, `revoke`, `fc-contact` (POST), `approve-direct` → `requireAuth + requireSuperAdmin`.
  - `pending-count` → `requireAuth`.
  - `quick-approve` requires a valid PIN for **revoke** (not just approve); revoke form now includes a PIN input.
  - Removed the implicit `'fc'` approver-role default.

### Super Admin SSOT
- `src/server/middleware/auth.ts`: added exported `isFCTunggalSuperAdmin()` and `requireSuperAdmin()`;
  `validateTenantAccess()` now grants FC Tunggal cross-estate authority independent of UI estate selection.
- `src/server/routes/auth.routes.ts`: uses the shared `requireSuperAdmin` (removed the local duplicate).

### R4 — Credential hygiene
- Untracked `data/rbac_registry.json`; added to `.gitignore`.

### Tests & docs
- New `scripts/tests/modules/p0_unauth_hardening.test.ts` (10 regression tests) registered in
  `scripts/tests/run_all_tests.ts` and `scripts/dr/ci_preflight.ts`.
- Tenant-isolation module extended with FC Tunggal cross-estate cases (17.13–17.17).
- `AGENTS.md` restructured; `docs/SECURITY_REMEDIATION_PLAN.md` added.

## Testing

```
npm run lint        # clean
npm run test:all    # 192/192 passed
npm run dr:check    # ALL GATES PASSED
```

## Behavior changes to note

- Non-super-admin clients no longer receive the RBAC registry from the server; they fall back to local
  registry. PIN login still works via `/api/auth/verify-pin`.
- FC Tunggal can now request cross-estate data at the application layer. **DB RLS is not yet aligned**
  (see Follow-ups / H3) — cross-estate reads may be filtered by RLS until that migration lands.
- Pre-login "Tukar No. WhatsApp FC" now requires an authenticated super admin session; the device-approval
  screen updates it locally only.

## Follow-ups (not in this PR)

- **Required operational step:** rotate ALL PINs and the FC Tunggal credential — `data/rbac_registry.json`
  remains in git history.
- **H3 / R7:** reconcile `auth_is_super_admin()` / `auth_is_cross_estate_role()` role vocabulary with the
  application layer (paired migration).
- **H1 / R5:** implement `estateId=ALL` device aggregation (currently not honored).
- **R6:** replace privileged `getSupabase()` with scoped client in `workers`/`hujan`/`penggredan` write paths.
- **R8/R9:** align client estate-switching and super-admin definitions with the server.

## Checklist

- [x] Lint (`npm run lint`)
- [x] Full regression (`npm run test:all`, 192/192)
- [x] DR preflight (`npm run dr:check`)
- [x] Regression tests added
- [ ] Secrets rotated (manual, operational)
- [ ] RLS role SSOT migration (H3/R7)
