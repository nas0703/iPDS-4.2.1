# PERATURAN & LOGIK SISTEM IPDS (AGENTS.MD)

> Dokumen ini adalah kontrak tingkah laku untuk mana-mana ejen AI / pembangun yang bekerja dalam repo ini.
> Ia mengikat. Jika konflik berlaku, dokumen ini mengalahkan andaian model.

---

## 1. System Identity & Authority

- **FC Tunggal, Admin, dan Super Admin adalah orang yang sama.**
- **Akaun FC Tunggal yang ditetapkan kini memegang kuasa Super Admin merentas SEMUA ladang** (`WILAYAH_JB`, `FPM_TUNGGAL`, `FPM_ADELA`, `FPM_KLEDANG`, `FPM_SENING`).
- **Kuasa Super Admin adalah berdasarkan peranan (role-based) dan TIDAK BOLEH bergantung kepada ladang yang sedang dipilih di UI.** Menukar `activeEstateId` di antaramuka hanyalah perubahan konteks paparan; ia tidak menjejaskan peranan atau kuasa Super Admin.
- Beliau memegang autoriti tertinggi dan mutlak ke atas seluruh platform sistem i-PDS rentas semua ladang.
- Kuasa merangkumi:
  1. **Kelulusan Peranti (Device Approvals)**: Menerima notifikasi dan meluluskan/menolak peranti staf dari SEMUA ladang.
  2. **Pengurusan Keselamatan (RBAC & PIN)**: Menukar PIN, menetapkan peranan staf, dan mengurus kebenaran modul.
  3. **Audit & Log Keselamatan**: Memantau sesi aktif, cubaan rentas ladang, dan amaran keselamatan.
  4. **Kekal Super Admin Merentasi Pertukaran Ladang**: Apabila FC Tunggal menukar pilihan ladang di antaramuka (contohnya untuk melihat status atau menyemak ladang FPM Adela/Kledang), status dan kuasa Super Admin beliau **TIDAK HILANG ATAU TERBATAL**.
- **Sumber kebenaran (SSOT) identiti:** `src/server/services/identity.service.ts` (`IdentityService` / `MASTER_IDENTITY_REGISTRY`) diseal dengan `src/server/services/auth.service.ts`.
- **Semakan Super Admin di server:** `isFCTunggalSuperAdmin()` dan `isSuperAdminIdentity()` dalam `src/server/middleware/auth.ts` (FC Tunggal = `role === 'fc' && (estate === 'FPM_TUNGGAL' || estate === '5155')`; alias Super Admin = `superadmin`/`super_admin`/`admin`). `isSuperAdminIdentity()` digunakan oleh middleware `requireSuperAdmin`, `validateTenantAccess()` untuk akses rentas ladang, `requireRbacAdmin` (`src/server/routes/settings.routes.ts`), pengurusan peranti (`src/server/routes/devices.routes.ts`), dan `actorCanAdministerDeviceEstate` (`src/server/services/deviceSecurity.service.ts`). RC/OC/PF dan FC cawangan **bukan** Super Admin.
- **Semakan Super Admin di klien:** `src/features/auth/services/rbacService.ts` (`isSuperAdmin`, `isFCTunggalOrAdmin`) — sejajar dengan SSOT server. Hanya alias `superadmin`/`super_admin`/`admin` dan FC Tunggal (`FPM_TUNGGAL`/`5155`, PIN sah FC Tunggal (lihat credentials.loader.ts / environment seed), atau `ipds_user_estate` ladang utama) ialah Super Admin merentasi mana-mana ladang. `rc`/`oc`/`pf` dan FC cawangan **bukan** Super Admin. Tiada fallback default-true.
- **JANGAN** sekali-kali menurunkan taraf, menyekat, atau membatalkan sesi FC Tunggal hanya kerana beliau menukar `activeEstateId`.

---

## 2. Multi-Tenant / Estate Isolation — CRITICAL

iPDS ialah platform berbilang ladang (multi-estate). **Kesilapan rentas ladang adalah insiden keselamatan zero-tolerance.**

- **Ladang disokong:** `WILAYAH_JB`, `FPM_TUNGGAL`, `FPM_ADELA`, `FPM_KLEDANG`, `FPM_SENING` (lihat pendaftaran penuh di bawah).
- **Pengguna biasa diasingkan secara ketat kepada ladang yang dibenarkan sahaja.**
- **Super Admin dibenarkan beroperasi merentas semua ladang.**
- **Menukar ladang terpilih di UI TIDAK BOLEH sama sekali:**
  - membatalkan / menanggalkan keistimewaan Super Admin;
  - mengubah peranan global (global role) pengguna yang telah disahkan;
  - memintas (bypass) kebenaran / autorisasi;
  - membenarkan pengguna biasa mengakses ladang lain.
- **Pemilihan ladang hanyalah konteks UI/aplikasi. Autoriti ditentukan secara berasingan daripada state UI.**
- **Pengasingan pangkalan data dikuatkuasakan oleh Supabase RLS dan autorisasi pihak server**, bukan oleh UI.

- Setiap rekod operasi MESTI mempunyai `estate_id`. Tiada pengecualian tanpa justifikasi bertulis.
- Ladang sah: `FPM_TUNGGAL` (fallback selamat), `FPM_ADELA`, `FPM_KLEDANG` (standby), `FPM_SENING` (standby), `WILAYAH_JB` (agregat HQ/`0001`/`WJB`).
- **Registry:** `src/config/estateRegistry.ts` — `ESTATES_REGISTRY`, `REGIONS`, `ZONES`, `ESTATE_NUMERIC_CODES`.
- **Konteks runtime:** `src/utils/estateContext.ts` — `getActiveEstateId`, `setRuntimeEstateId`, `getActiveEstateConfig`, `inferEstateFromReceipt`. Nilai disimpan dalam `window.__IPDS_ACTIVE_ESTATE_ID__` + `sessionStorage`/`localStorage` `ipds_active_estate_id`.
- **Sempadan akses:** `validateTenantAccess()` dalam `src/server/middleware/auth.ts`:
  - `rc` / `superadmin` / `executive_hq` / **FC Tunggal** (`isFCTunggalSuperAdmin`) → semua ladang.
  - `oc` / `pf` → `'ALL'` atau `ZON_ADELA_ESTATES` sahaja.
  - Peranan ladang (`fc`, `afc`, `fs`, `staff`, `mandur`, `eqi`) → ladang sendiri sahaja; pelanggaran → `403 FORBIDDEN_ESTATE`/`FORBIDDEN_ZONE` + audit + `metricsCollector.recordSecurityEvent('estate_denied')` + `alertManager.triggerSecurityViolation`.
- Penapisan aplikasi WAJIB disertai RLS pangkalan data (lihat §5). Kedua-dua lapisan mesti selaras.
- **Kesilapan rentas ladang adalah insiden keselamatan zero-tolerance.** Jangan sekali-kali "memperbaiki" ujian dengan melemahkan pengasingan.

### Peraturan modul & circular dependency
- Pembolehubah `ESTATE_CHANGED_EVENT` ditakrifkan dalam `src/config/estateRegistry.ts` bagi mengelakkan ralat circular import dengan `src/utils/estateContext.ts`.
- Fungsi `getEstateConfig` dan `getActiveEstateConfig` wajib sentiasa mempunyai nilai sandaran selamat (*safe fallback*) kepada `FPM_TUNGGAL` bagi menghalang ralat `TypeError: Cannot read properties of undefined (reading 'FPM_TUNGGAL')`.
- `getActiveEstateId()` rantaian fallback: runtime → `window.__IPDS_ACTIVE_ESTATE_ID__` → storage → `VITE_DEFAULT_ESTATE_ID` → `'FPM_TUNGGAL'`.

---

## 3. Authentication & RBAC

- **Peranan kanonik server** (`AuthRole`): `staff`, `mandur`, `pf`, `fc`, `afc`, `fs`, `eqi`, `oc`, `rc`, `superadmin`.
- **Peranan klien tambahan** (`rbacService.ts`): `kerani_kewangan`, `kerani_stok`, `kerani_resit`. Klien melayan `admin`/`super_admin` sebagai super admin.
- **Sesi:** cookie `ipds_session` (`httpOnly`, `secure` dalam prod, `sameSite: 'lax'`, 12 jam). JWT HS256, `aud: 'authenticated'`, `iss` = Supabase issuer, luput 1 jam; refresh melalui `POST /api/auth/refresh` + `SessionManagerService`.
- **Endpoint auth:** `POST /api/auth/verify-staff` (Kod Ladang + bcrypt-verified `staff_no_hash`), `refresh`, `logout`; `GET /api/auth/session-status`, `/me` (`/session`); `super-admin/*`. Legacy `/verify-pin` and `/verify-password` login routes return `410 AUTH_METHOD_REMOVED`.
- **Middleware:** `src/server/middleware/auth.ts` — `authenticate`, `requireAuth`, `requireRole`, `requireEstateAccess`, `validateTenantAccess`, `extractUserFromRequest`.
- **Rate limit + lockout:** `authRateLimiter` dan lockout dalam-memori (`MAX_FAILED_ATTEMPTS=10`, tetingkap 60s, `LOCKOUT_MS=60s`) dalam `auth.routes.ts`.
- **Klien:** `src/features/auth/hooks/useAuth.ts`, `src/features/auth/services/rbacService.ts`. Pemulihan sesi normal hanya menggunakan JWT/sesi server; No. Kakitangan tidak disimpan sebagai PIN. PIN kekal untuk pengesahan langkah tambahan Super Admin dan operasi keselamatan peranti yang eksplisit.
- **Peraturan keras:**
  - Jangan simpan `SUPABASE_SERVICE_ROLE_KEY` atau mana-mana rahsia dalam kod klien / bundle.
  - Jangan percayai `role`/`localStorage` dari klien untuk kebenaran server. Server mesti mengesahkan dari JWT.
  - Perubahan kepada peranan/PIN mesti melalui `updateServerPinConfig()` / `IdentityService` supaya registry kekal SSOT.
  - **Utang teknikal yang diketahui:** PIN/password kini disimpan *plaintext* dan dibanding dengan `===`; terdapat fallback JWT secret hardcoded. Jangan tambah lagi kelemahan ini; anggap ia sebagai hutang untuk dibaiki, bukan corak untuk diikuti.

---

## 4. API Security

- **Semua laluan API didaftarkan** di `src/server/routes/` dan dipasang dalam `src/server/serverless.ts` (produksi) serta `server.ts` (dev). Kekalkan kedua-duanya selaras.
- **Pengesahan peranti (device approvals):** Endpoint `/api/devices/pending-count` dan `/api/devices/list` mesti menyemak peranti menunggu kelulusan bagi seluruh ladang (`estateId=ALL`) untuk memastikan Admin menerima notifikasi bagi mana-mana staf yang cuba mendaftar di mana-mana cawangan ladang.
  - Perlaksanaan: `src/server/routes/devices.routes.ts`, `src/server/services/deviceSecurity.service.ts` (`listDevices`, status `PENDING|APPROVED|BLOCKED|REVOKED`).
  - Header memanggil `?estateId=ALL` setiap 10s apabila `isSuperAdmin`. `WILAYAH_JB` bermakna semua ladang dalam `listDevices`; semua nilai lain ditapis `.eq('estate_id', ...)`.
- **Middleware keselamatan:**
  - CSRF: `src/server/middleware/csrf.ts` — menolak `Sec-Fetch-Site: cross-site`, semak `Origin`/`Referer`; pengecualian didaftarkan (cth `/api/health`, `/api/cron`, `/api/auth/logout`).
  - Rate limiter: `src/server/middleware/rateLimiter.ts` — `authRateLimiter` (10/min), `aiChatRateLimiter` (30/min), `aiMultimodalRateLimiter` (15/min), `benchmarkRateLimiter` (5/min), `adminRateLimiter` (30/min), `generalApiRateLimiter` (150/min). Header RFC 6585 (`Retry-After`, `X-RateLimit-*`).
  - Cron: `src/server/middleware/cronAuth.ts` — `Authorization: Bearer <CRON_SECRET>`, perbandingan masa-tetap; produksi tanpa `CRON_SECRET` → 500.
  - Observability/header keselamatan: `src/server/middleware/observability.ts` (`X-Request-ID`, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, blok probe scanner). Version header dari `src/config/version.ts`.
- **Format respons ralat standard:** `{ success: false, error, code, correlationId }`. Guna `src/server/utils/errorUtils.ts` (`AppError`, `ValidationError` 400, `AuthenticationError` 401, `ForbiddenError` 403, `NotFoundError` 404). Jangan bocorkan detail dalaman (`postgres://`, `supabase`, path sumber, `password`, `secret`) — redaksi telah dilaksana di `serverless.ts`.
- **Peraturan keras:**
  - Mana-mana endpoint yang mengakses data estet MESTI melalui `authenticate`/`requireAuth`/`requireRole` + `validateTenantAccess`, dan guna `req.supabase` (`getScopedSupabase`) supaya RLS menghormati JWT pemanggil.
  - Jangan lulus `SUPABASE_URL`/kunci service role ke klien. Klien hanya anon key (`src/services/supabaseClient.ts`).
  - Jangan matikan CSRF, rate limiter, atau semakan tenant untuk "memudahkan ujian". Ujian bypass berada di `scripts/tests/auth_bypass_test.ts`.
  - Endpoint peranti yang mengubah status (register/approve/revoke) mesti kekal dijejaki melalui audit (`DEVICE_*` events).

---

## 5. Database / Supabase / RLS

- **Klien server sahaja:** `src/server/db.ts` — `getScopedSupabase(userJwt, { mode })`, `getWriteSupabase()`, `getReadSupabase()`, `getReadReplicaSupabase()`, `getSupabase()`. Fail ini **tidak boleh** dibundel ke browser.
- **Klien browser:** `src/services/supabaseClient.ts` (re-export `src/config/supabaseClient.ts`) — anon key SAHAJA. Dilarang mengeksport service role.
- **Rantaian kredensial:** `SUPABASE_URL || VITE_SUPABASE_URL || NEXT_PUBLIC_SUPABASE_URL`; pooler `SUPABASE_POOLED_URL`; replica `SUPABASE_READ_REPLICA_URL`; service role `SUPABASE_SERVICE_ROLE_KEY`.
- **Migrasi adalah sumber kebenaran:** `supabase/migrations/*.sql`. Skrip `*.sql` di akar repo (cth `disable_all_rls.sql`) adalah **legacy/permissive** dan **BUKAN** keadaan pengeluaran. Jangan jadikannya rujukan.
- **RLS:** Jadual pengeluaran diaktifkan + `FORCE ROW LEVEL SECURITY`. Helper: `public.auth_estate_id()`, `public.auth_app_role()`, `public.auth_is_super_admin()`, `public.auth_is_cross_estate_role()` (`rc`,`oc`,`admin`,`super_admin`).
  - Corak polisi: `USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())`.
  - Jadual `observability_*` adalah `service_role` sahaja (anon lockout penuh).
  - `REVOKE ALL ... FROM anon` + `GRANT ... TO authenticated, service_role` untuk jadual operasi.
  - Storage bucket (`receipt-images`, `reports`, `audit-exports`) diskop mengikut `(storage.foldername(name))[1] = public.auth_estate_id()`.
- **Jadual utama:** lihat `DATABASE_AUDIT_REPORT_STAGE_A.md` untuk matriks penuh + 5 konflik skema yang didokumenkan (`merumput_progress` vs `merumput_daily_entries`, `hujan_rekod` vs `data_hujan`, `workers`/`attendance` vs `data_pekerja`, `penggredan_rekod` tanpa RLS, `annual_yield` vs `hasil_abw`/`hasil_bbc`).
- **Peraturan keras:**
  - Migrasi baharu mesti: tetapkan `estate_id`, aktifkan RLS + `FORCE`, tulis polisi, `REVOKE` anon, `GRANT` kepada `authenticated`/`service_role`.
  - Jangan sekali-kali `DISABLE ROW LEVEL SECURITY` pada jadual pengeluaran.
  - Jangan tambah polisi `USING (true)` pada data estet.
  - Sentiasa guna `getScopedSupabase` untuk laluan berkonteks pengguna; `getSupabase()` memintas RLS apabila service role dikonfigurasikan.

---

## 6. Frontend Architecture

- **Stack:** React 19 + Vite 6 + TypeScript 5.8 + Tailwind CSS v4 (`@tailwindcss/vite`). Alias `@` → `src/`.
- **Struktur folder:**
  - `src/features/<domain>/` — logik domain (co-located `components/`, `hooks/`, `services/`, `helpers/`, `types/`). Domain: auth, dashboard, hasil, kualiti, fertilizer, pruning, merumput, pekerja, hujan, input, sejarah, export, admin, ai_executive.
  - `src/components/` — UI kongsi (`common/` app-wide, `ui/` primitif, `presentation/` laporan).
  - `src/layout/` — shell aplikasi (`Header`, `BottomNav`, `AppModalsContainer`).
  - `src/hooks/` — hook peringkat aplikasi; `src/utils/` — helper tulen; `src/services/` — servis frontend; `src/config/` — konfigurasi; `src/data/` — seed/knowledge statik.
  - `src/server/` — backend Express (routes/services/middleware/reliability/observability).
- **Tiada client router.** Navigasi adalah state tab dalam `src/hooks/useAppUIState.ts` (`activeTab`, `handleTabChange`), dirender bersyarat oleh `App.tsx`. Jangan tambah `react-router` tanpa kelulusan.
- **State:** React hooks + prop drilling (bukan Redux/Context global). App state dikongsi dari `App.tsx` + hook dalam `src/hooks/`.
- **Konteks estet:** event-driven singleton (`ESTATE_CHANGED_EVENT`), bukan React Context. Listen melalui `window.addEventListener(ESTATE_CHANGED_EVENT, ...)`.
- **Lazy loading:** komponen modal menggunakan `React.lazy` dalam `src/layout/AppModalsContainer.tsx`, dibalut `<ErrorBoundary compact moduleName=...>`. Tab utama kekal *static imports* untuk elak chunk version skew / dua instance React. `src/utils/lazyWithRetry.ts` wujud untuk retry chunk; jangan tukar corak tanpa alasan.
- **PWA/offline:** `public/manifest.json`, `public/sw.js` (daftar produksi sahaja melalui `src/hooks/usePWA.ts`), `src/utils/offlineStore.ts` (IndexedDB + sync queue), `src/utils/safeStorage.ts` (fallback memori).
- **Styling:** Tailwind v4 utiliti; dark mode melalui kelas `.dark` (localStorage `theme`); `motion/react` untuk animasi; `lucide-react` untuk ikon. `src/index.css` ada `@theme`, `@utility`, dan peraturan cetak.
- **Peraturan keras:**
  - Jangan import modul server (`src/server/*`) ke kod klien.
  - Jangan perkenalkan library baharu tanpa menyemak `package.json` terlebih dahulu.
  - Ikut konvensyen `features/` untuk logik domain dan `components/` untuk UI kongsi.
  - Semua panggilan rangkaian klien mesti melalui `src/utils/safeFetch.ts` supaya `x-estate-id`, `Authorization`, dan `x-auth-*` disuntik.

---

## 7. AI / RAG Rules

- **Pembekal tunggal:** Google Gemini melalui `@google/genai`. Kunci `GEMINI_API_KEY` (disuntik ke klien melalui Vite `define`). Jangan tambah pembekal lain tanpa kelulusan.
- **Laluan:** semua di bawah `/api/ai` (`src/server/routes/ai.routes.ts` + sub-router `ai/`). RAG: `manual-rag`, `enterprise-rag`, `ingest-pdf`, `ingest-pdf-hardened`, `validate-document`, `diagnose-knowledge`. Chat: `estate-chat`, `morning-briefing` (`requireRole(['fc','pf'])`). Vision: `diagnose-weed-image`, `ocr-receipt`, `ocr-page`, `transcribe-audio`. Evaluasi: `evaluate-*`.
- **Enjin:** `src/server/services/ragEngine.service.ts`. Saluran: `Gemini Embedding → Hybrid Vector + Lexical Search → RRF (k=60) → MMR Reranking → No-Evidence Hard Gate → Gemini → Citation Validation → Grounding Verification`.
- **Retrieval:** pgvector RPC `match_pdf_documents` (hybrid `vector_weight`/`text_weight`, `matchCount 50`, `matchThreshold 0.05`) + fallback BM25 Okapi (`lexicalProcessor.service.ts`, `k1=1.2`, `b=0.75`) + knowledge fallback dalam-memori.
- **Grounding & sitasi (WAJIB):**
  - Nilai angka/kadar upah MESTI dipetik terus daripada dokumen rujukan. **Dilarang mereka (invent/fabricate) atau membuat tekaan.** Kategori C (pengetahuan am) dilarang untuk kadar upah.
  - Setiap fakta/baris jadual mesti mempunyai sitasi `[Ruj X]` yang sah.
  - **No-Evidence Hard Gate:** jika tiada calon, topik tidak dipenuhi, atau `evidenceCoverage < 20`, pulangkan mesej "tidak ditemui dalam pangkalan pengetahuan" dan JANGAN panggil LLM.
  - Verifikasi selepas penjanaan (`claimVerifier.service.ts`): sahkan sitasi dan angka; status `GROUNDED` / `NEEDS_REVIEW` / `GROUNDING_FAILED`. Hanya jawapan `GROUNDED` boleh dicache.
  - "Confidence" adalah **heuristik**, bukan kebarangkalian. Jangan dokumen/ label ia sebagai ketepatan statistik.
- **Data rujukan & ujian:** `src/data/*` (knowledge statik), `test/retrievalDataset.ts`, `test/lexicalDataset.ts`, `test/generationDataset.ts`, `test/stressTestDataset.ts`.
- **Peraturan keras:**
  - Jangan lumpuhkan hard gate, verifikasi sitasi, atau perlindungan upah.
  - Jangan ubah suai dataset evaluasi untuk lulus ujian; perbaiki enjin.
  - Cache hanya jawapan `GROUNDED`; jangan cache `NO_EVIDENCE`/`GROUNDING_FAILED`.
  - Jangan dedahkan `GEMINI_API_KEY` baharu atau kunci rahsia dalam respons.

---

## 8. Testing Requirements

- **Tiada Jest/Vitest.** Ujian ialah skrip TypeScript tulen dijalankan dengan `tsx`, menggunakan `assert()` sendiri dan `process.exit(0|1)`.
- **Perintah wajib sebelum selesai sebarang perubahan:** `npm run lint` (`tsc --noEmit`) dan `npm run test:all` (`tsx scripts/tests/run_all_tests.ts`, 20 modul). Jika berkaitan DR, tambah `npm run dr:check`.
- Perintah setara CI: `npm run lint && npm run test:all && npm run dr:check && npm run build` (`npm run ci:pipeline`).
- **Suite:** `scripts/tests/run_all_tests.ts` menjalankan 20 modul termasuk Auth, RBAC, Hasil, Hantaran, Pruning, Merumput, DB Writes, Security & Compliance, Auth Bypass, Multi-Tenant Schema, RLS Policies, JWT Claims, Scoped Supabase, Unified Identity, Session Lifecycle, RLS Matrix, Tenant Isolation, Job Queue, Anon Remediation, Cron.
- **Suite khas:** `npm run test:auth-bypass`, `npm run test:security`, `npm run test:pruning`, `npm run test:cron`, `npm run test:load`.
- **Ujian RAG/governance** di `test/` (`retrievalEvaluation.test.ts`, `ragHardening.test.ts`, `ingestionValidation.test.ts`, `p1_governance.test.ts`) dijalankan manual dengan `npx tsx test/<fail>`.
- **Peraturan keras:**
  - Jangan tandakan kerja selesai tanpa menjalankan lint + test:all (atau jelaskan mengapa tidak boleh).
  - Jangan padam, `skip`, atau longgar mana-mana ujian keselamatan/tenant untuk "menghijaukan" CI.
  - Sebarang pembaikan bug mesti disertai ujian regresi dalam suite yang sesuai.
  - Jika menambah skrip/test baharu, kemas kini `run_all_tests.ts` dan `scripts/dr/ci_preflight.ts` supaya konsisten.

---

## 9. Deployment / Vercel

- **Konfigurasi:** `vercel.json` — framework vite, `buildCommand: npm run build`, `outputDirectory: dist`, `cleanUrls: true`.
- **Build:** `vite build` → `dist/`; esbuild `server.ts` → `dist/server.cjs`; esbuild `src/server/serverless.ts` → `api/index.js` (fungsi serverless Vercel).
- **Fungsi serverless:** `api/index.js` — `maxDuration: 60`, `memory: 1024`.
- **Cron:** `GET/POST /api/cron/process-jobs`, jadual `0 0 * * *`, dilindungi `CRON_SECRET` (lihat §4).
- **Rewrites:** `/api/(.*)` dan `/api` → `/api`; selebihnya → `/index.html` (SPA fallback).
- **CI gates:**
  - `.github/workflows/security_ci_gate.yml` (push `main`/`develop`/`release/*`, PR): `npm run lint` → `test:auth-bypass` → `test:all` → `build`.
  - `.github/workflows/dr_preflight.yml`: `test:all` → `dr:check` → `lint` → `build` → `restore_preflight.ts` (`TARGET_ENV=staging`).
- **DR:** sasaran RPO ≤ 5 min, RTO ≤ 60 min (`docs/DR_ARCHITECTURE.md`, `docs/DR_RUNBOOK.md`). Pemulihan mesti melalui `dr:restore:preflight` yang **menolak produksi** (safety lockout).
- **Peraturan keras:**
  - Jangan deploy/ubah konfigurasi produksi tanpa diminta.
  - `api/index.js` dan `api/index.js.map` dijejaki dalam git (output esbuild) — jangan keliru dengan `dist/` yang diabaikan.
  - Jangan longgarkan gate CI atau safety lockout DR.

---

## 10. Data Integrity

- **Setiap tulis** mesti menyertakan `estate_id` yang sah dan konsisten dengan sesi/JWT.
- **Migrasi & skema:** sumber kebenaran = `supabase/migrations/`. Sebarang konflik dengan skrip akar mesti diselesaikan memihak migrasi.
- **Validasi input:** gunakan `zod` di mana sesuai (contoh sedia ada: `src/features/fertilizer/types.ts` `DailyEntrySchema`). Jangan percaya input klien.
- **Penyimpanan setempat:** `src/utils/safeStorage.ts` (fallback memori) dan `src/utils/offlineStore.ts` (IndexedDB `ipds_offline_db` + `sync_queue`). `src/server/estateStore.ts` memetakan resit → estet (`data/receipt_estate_map.json`).
- **Backup/DR:** `scripts/dr/backup.ts` (`IPDS_TABLE_REGISTRY`, manifest SHA-256), `verify_backup.ts`, `restore.ts` (`RESTORATION_ORDER`), `reconciliation.ts`, `safety.ts` (`assertNonProductionTarget`).
- **Pangkalan data mungkin tiada:** kod mesti tahan kegagalan Supabase dan jatuh balik ke setempat/memori dengan selamat (lihat `isMissingTableError`, `src/server/local.ts`).
- **Peraturan keras:**
  - Jangan tulis rekod tanpa `estate_id`.
  - Jangan ubah skema tanpa migrasi berpasangan (naik + polisi RLS).
  - Jangan simpan data produksi sebenar dalam `data/*.json` yang dijejaki git.
  - Jangan jalankan `restore` terhadap produksi.

---

## 11. Error Handling

- **Rangka kerja ketahanan:** `src/server/reliability/`
  - `classifyError.ts` — kategori `TIMEOUT`, `RATE_LIMITED`, `TRANSIENT`, `PERMANENT` + `isRetryable`.
  - `retry.ts` — `withRetry` (max 3, backoff eksponen + jitter; hanya retry yang boleh dicuba).
  - `timeout.ts` — `withTimeout` (`TimeoutError`, `AbortController`).
  - `circuitBreaker.ts` — `CircuitBreaker` (`CLOSED`/`OPEN`/`HALF_OPEN`), `getCircuitBreaker(name)`.
- **Format respons:** `{ success: false, error, code, correlationId }`; guna kelas ralat dalam `src/server/utils/errorUtils.ts`.
- **Observability:** `src/server/observability/` — `structuredLog` + redaksi, `AlertIntelligenceManager` (`alertManager`, webhook `ALERT_WEBHOOK_URL`), `metrics`, `tracing` (`withSpan`). Klien: `src/lib/observability.ts` (`reportClientError`, redaksi, dedupe 5s → `/api/telemetry/client-error`).
- **Frontend:** `src/components/common/ErrorBoundary.tsx` (termasuk varian `compact`) membalut modal/tab; jangan biarkan ralat memakan seluruh aplikasi.
- **Peraturan keras:**
  - Jangan `throw` rentetan mentah; gunakan kelas ralat berstruktur.
  - Jangan log rahsia/JWT/PII; gunakan `sanitizeString`/`redactSensitiveData`.
  - Jangan keluarkan mesej ralat dalaman (SQL, path, kunci) kepada klien.
  - Utamakan gagal-selamat (fail-safe) yang tidak menghalang permintaan kritikal, kecuali laluan keselamatan.

---

## 12. Performance

- **Cache:** `hasilCache`/`pruningCache` (TTL 3s, invalidasi pada tulis), `ragSemanticCache` (`src/server/services/ragCache.service.ts`, max 200, 24h + `rag_query_cache`), `cachedLogoUrl`/`cachedRbacRegistry`. Cache mesti diinvalidasi apabila data berubah.
- **Code splitting:** `vite.config.ts` `manualChunks` (`vendor-react`, `vendor-excel`, `vendor-presentation`, `vendor-pdf`, `vendor-charts`, `vendor-markdown`, `vendor-icons`, `vendor-motion`, `vendor-supabase`), `chunkSizeWarningLimit: 1000`.
- **Lazy:** modal melalui `React.lazy`; `React.Suspense` di peringkat modal. Tab utama kekal statik.
- **Debounce/throttle:** contoh `useIdleTimeout` (activity di-throttle 1s).
- **Peraturan keras:**
  - Jangan tambah kebergantungan besar tanpa mempertimbangkan `manualChunks` dan saiz bundle.
  - Jangan buat pertanyaan pangkalan data dalam gelung atau setiap render tanpa cache.
  - Kekalkan TTL cache pendek dan invalidasi pada mutasi untuk data operasi.

---

## 13. Git / Change Management

- **Gaya commit:** Conventional Commits — `feat:`, `feat(scope):`, `fix:`, `refactor(scope):`, `style(scope):`, `chore:`, subjek huruf kecil imperatif. Body guna senarai `- ` untuk perubahan berbilang.
- **Branch:** `main` (default), `develop`, `release/*`, `stage-*`, `feature/*`, `fix/p0-NN-<desc>`, `test/*`, `chore/*`.
- **Jangan sekali-kali commit:** `.env*` (kecuali `.env.example`), `node_modules/`, `dist/`, `build/`, `coverage/`, `*.log`, `backups/`, rahsia/kunci.
- **Sebelum commit:** semak `git status`, `git diff`, `git log --oneline -10`; stage hanya fail yang diniatkan.
- **Peraturan keras:**
  - **Jangan commit, amend, push, atau buka PR melainkan diminta secara eksplisit.**
  - Jangan `force-push`, skip hook, atau `git config` tanpa kebenaran.
  - Jangan commit rahsia atau data produksi.
  - Jika commit gagal/hook menolak, perbaiki dan buat commit baharu (jangan amend kegagalan).

---

## 14. Agent Operating Rules

1. **Baca dahulu.** Sebelum mengubah kod, fahami fail berkaitan dan konvensyen sedia ada. Guna carian meluas.
2. **Kekal skop.** Buat hanya apa yang diminta. Jangan refactor/rename secara meluas tanpa arahan.
3. **Keselamatan mengalahkan kepraktisan.** Jangan longgarkan auth, tenant isolation, RLS, CSRF, rate limit, atau guardrail RAG untuk memudahkan kerja.
4. **Jangan tambah komen** melainkan diminta.
5. **Jangan tambah kebergantungan** tanpa menyemak `package.json` dan justifikasi.
6. **Uji sebelum selesai.** Jalankan `npm run lint` dan `npm run test:all` (dan `dr:check` jika berkaitan). Jangan tandakan selesai tanpa pengesahan.
7. **Bahasa:** kod dan pengecam dalam bahasa Inggeris; UI/mesej pengguna dalam Bahasa Melayu (kekalkan nada sedia ada).
8. **Dokumen hidup:** jika anda menemui percanggahan antara kod dan dokumen ini, laporkan dan kemas kini dokumen dengan bukti (`file:line`), jangan diamkan.
9. **Tiada commit tanpa kebenaran** (lihat §13).
10. **Rujuk laluan pengurusan konfigurasi** seperti `AGENTS.md` ini, `DATABASE_AUDIT_REPORT_STAGE_A.md`, dan `docs/DR_*` bila berkenaan.


