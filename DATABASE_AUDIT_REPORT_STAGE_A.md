# LAPORAN AUDIT TEKNIKAL PANGKALAN DATA & KOD SUMBER
## IPDS Ver. 3.7 — Database Architecture Hardening
### STAGE A: READ-ONLY DATABASE & CODE AUDIT REPORT

**Tarikh Audit:** 24 Ogos 2026
**Status Audit:** **INSPECTION ONLY (READ-ONLY)**
**Peraturan Keselamatan:** Tiada fail diubah suai, tiada skrip SQL dieksekusi, tiada modifikasi dibuat pada Supabase Database.

---

## 1. PENGENALAN & SKOP AUDIT

Laporan ini disediakan khusus untuk mendokumentasikan arkitektur pangkalan data semasa bagi sistem **IPDS Ver. 3.7**, mengenal pasti kebergantungan kod aplikasi terhadap jadual pangkalan data Supabase, mengaudit status pengasingan multi-estate (*estate isolation*), menilai keteguhan *Row Level Security (RLS)*, mengenal pasti konflik penamaan jadual (*schema divergence*), dan merangka pelan penambahbaikan berfasa yang selamat untuk persekitaran pengeluaran (*production environment*).

---

## 2. INVENTORI LENGKAP JADUAL PANGKALAN DATA (DATABASE DEPENDENCY MAP)

Berikut adalah senarai kesemua **31 jadual** yang dirujuk secara langsung dalam kod aplikasi, backend Express API, fail skrip, mahupun skema migrasi SQL:

| No | Nama Jadual | Lokasi Kod (Files) | Operasi (CRUD) | Kolum Utama Dirujuk | Skop Estate | Kategori Data | Catatan Seni Bina |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `hantaran_hasil` | `api/routes/hantaran.routes.ts`, `api/routes/ai.routes.ts`, `api/index.ts` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | `id`, `tarikh`, `blok`, `peringkat`, `sesi`, `berat_basah`, `berat_bersih`, `kadar_abw`, `estate_id`, `recorded_by_kiosk`, `operator_id`, `operator_name`, `session_id` | Eksplisit (`estate_id`) | Operasi / Transaksi | Transaksi teras hasil buah sawit. Menyokong identiti dual-layer (Kiosk + Operator). |
| 2 | `hantaran_pruning` | `api/routes/pruning.routes.ts`, `setup_supabase.sql` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | `id`, `tarikh`, `blok`, `peringkat`, `luas_blok`, `luas_selesai`, `bilangan_pekerja`, `status`, `estate_id`, `recorded_by_kiosk`, `operator_id` | Eksplisit (`estate_id`) | Operasi / Transaksi | Log kerja cantasan pelepah harian dan status kemajuan blok. |
| 3 | `fertilizer_daily_entries` | `api/routes/fertilizer.routes.ts`, `api/routes/ai.routes.ts` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | `id`, `schedule_id`, `tarikh`, `blok`, `peringkat`, `beg_digunakan`, `hektar_selesai`, `tenaga_kerja`, `estate_id`, `recorded_by_kiosk`, `operator_id` | Eksplisit (`estate_id`) | Operasi / Transaksi | Log harian aktiviti tabur baja berpaut pada jadual induk (*schedule*). |
| 4 | `fertilizer_master_schedule` | `api/routes/fertilizer.routes.ts`, `api/routes/ai.routes.ts` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | `id`, `tahun`, `pusingan`, `jenis_baja`, `blok`, `luas`, `kadar_pokok`, `tarikh_anggaran`, `estate_id` | Eksplisit (`estate_id`) | Data Induk (Master) | Program jadual pembajaan tahunan/pusingan bagi setiap blok. |
| 5 | `fertilizer_inventory` | `api/routes/fertilizer.routes.ts`, `scripts/sync_inv.ts` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | `id`, `nama_baja`, `jenis_baja`, `stok_semasa`, `stok_minimum`, `unit`, `harga_seunit`, `estate_id` | Eksplisit (`estate_id`) | Data Induk / Stok | Baki semasa inventori baja stor ladang. |
| 6 | `fertilizer_inventory_transactions` | `api/routes/fertilizer.routes.ts`, `scripts/sync_inv.ts` | `SELECT`, `INSERT`, `DELETE` | `id`, `inventory_id`, `jenis_transaksi`, `kuantiti`, `tarikh`, `rujukan`, `nota`, `estate_id` | Eksplisit (`estate_id`) | Audit / Lejar | Lejar pergerakan stok keluar/masuk baja (tanpa UPDATE). |
| 7 | `merumput_progress` | `api/routes/merumput.routes.ts`, `setup_supabase.sql` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | `id`, `blok`, `luas`, `pusingan`, `jenis`, `tarikh_mula`, `tarikh_siap`, `hek_siap`, `workers_count` | Implisit / Tiada | Operasi / Transaksi | **Aktif digunakan oleh API Route merumput.** Tiada kolum `estate_id` dalam kod API semasa. |
| 8 | `merumput_daily_entries` | `supabase/migrations/20260824_ipds_granular_rls.sql` | *Hanya dalam skrip RLS* | `id`, `tarikh`, `blok`, `pusingan`, `jenis_racun`, `luas_rawat`, `liter_digunakan`, `tenaga_kerja`, `estate_id` | Eksplisit (`estate_id`) | Operasi / Transaksi | **Pertembungan Nama.** Dirancang dalam RLS tetapi API memanggil `merumput_progress`. |
| 9 | `merumput_inventory` | `api/routes/merumput.routes.ts`, `setup_supabase.sql` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | `id`, `nama_racun`, `jenis_racun`, `stok_semasa`, `stok_minimum`, `unit`, `harga_seunit`, `estate_id` | Eksplisit (`estate_id`) | Data Induk / Stok | Baki semasa inventori racun kimia dan peralatan rumpai. |
| 10 | `merumput_inventory_transactions` | `api/routes/merumput.routes.ts`, `setup_supabase.sql` | `SELECT`, `INSERT`, `DELETE` | `id`, `inventory_id`, `jenis_transaksi`, `kuantiti`, `tarikh`, `rujukan`, `nota`, `estate_id` | Eksplisit (`estate_id`) | Audit / Lejar | Lejar pergerakan stok racun keluar/masuk (tanpa UPDATE). |
| 11 | `hujan_rekod` | `src/hooks/useRainfallData.ts`, `src/features/hujan/components/HujanInput.tsx` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | `bulan`, `2021`, `2022`, `2023`, `2024`, `2025`, `2026`, `2027`, `2028` | Implisit / Tiada | Operasi / Sejarah | **Aktif digunakan oleh Frontend React**. Format mendatar (*wide-pivot table* mengikut tahun). |
| 12 | `data_hujan` | `supabase/migrations/20260824_ipds_granular_rls.sql` | *Hanya dalam skrip RLS* | `id`, `tarikh`, `bacaan_mm`, `stesen`, `catatan`, `estate_id` | Eksplisit (`estate_id`) | Operasi / Sejarah | **Pertembungan Nama.** Format ternormal harian dalam RLS, berbeza daripada `hujan_rekod`. |
| 13 | `workers` | `src/features/pekerja/services.ts`, `setup_pekerja.sql` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | `id`, `worker_id`, `name`, `role`, `department`, `kumpulan`, `negara_asal`, `is_active` | Implisit / Tiada | Data Induk (Master) | **Aktif digunakan oleh UI Pengurusan Pekerja**. Panggilan anon client terus. |
| 14 | `attendance_records` | `src/features/pekerja/services.ts`, `setup_pekerja.sql` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | `id`, `worker_id`, `date`, `status`, `check_in`, `check_out`, `remarks` | Implisit (via worker) | Operasi / Log | Log kehadiran harian pekerja ladang. |
| 15 | `work_assignments` | `src/features/pekerja/services.ts`, `setup_pekerja.sql` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | `id`, `worker_id`, `block_id`, `activity_type`, `date`, `target_amount`, `completed_amount` | Implisit (via worker) | Operasi / Tugasan | Rekod agihan kerja dan blok tugasan harian. |
| 16 | `data_pekerja` | `supabase/migrations/20260824_ipds_granular_rls.sql` | *Hanya dalam skrip RLS* | `id`, `no_pekerja`, `nama`, `jawatan`, `status`, `estate_id` | Eksplisit (`estate_id`) | Data Induk | **Pertembungan Nama.** Skema RLS menganggap `data_pekerja`, tetapi UI menggunakan `workers`. |
| 17 | `hasil_abw_history` | `api/routes/hasil.routes.ts`, `create_abw_table.sql` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | `id`, `tahun`, `bulan`, `blok`, `kadar_abw`, `estate_id` | Eksplisit (`estate_id`) | Analitik Hasil | Sejarah purata berat tandan (*Average Bunch Weight*). |
| 18 | `hasil_bbc_history` | `api/routes/hasil.routes.ts`, `create_bbc_table.sql` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | `id`, `tahun`, `bulan`, `blok`, `peratus_bbc`, `estate_id` | Eksplisit (`estate_id`) | Analitik Hasil | Sejarah peratusan buah belum cukup masak (*Unripe Bunches*). |
| 19 | `hasil_backlog_history` | `api/routes/hasil.routes.ts`, `api/routes/ai.routes.ts` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | `id`, `tarikh`, `blok`, `peringkat`, `anggaran_tandan_tinggal`, `status_kutipan`, `estate_id` | Eksplisit (`estate_id`) | Operasi / Analitik | Log tandan buah tercicir/tertinggal dalam blok. |
| 20 | `annual_yield` | `api/routes/hantaran.routes.ts`, `scripts/test_yield_tables.ts` | `SELECT`, `INSERT` (Upsert) | `tahun`, `ton_sebenar`, `ton_anggaran` | Implisit / Tiada | Analitik Hasil | Ringkasan sasaran vs hasil tahunan peringkat estate. |
| 21 | `block_annual_yields` | `api/routes/hantaran.routes.ts`, `scripts/test_yield_tables.ts` | `SELECT`, `INSERT` (Upsert) | `tahun`, `blok`, `ton_sebenar`, `ton_anggaran`, `yield_per_hektar` | Implisit / Tiada | Analitik Hasil | Pecahan hasil tahunan mengikut blok individu. |
| 22 | `penggredan_rekod` | `src/features/kualiti/services/penggredanService.ts` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | `id`, `tajuk`, `program`, `jenis_grading`, `tarikh`, `ladang`, `peringkat_blok`, `no_lori`, `nama_penggred`, `biji_lerai_peratus`, `tandan_masak`, `created_at` | Implisit (`ladang` string) | Operasi / Kualiti | Log audit penggredan kualiti buah di ladang & kilang sawit. RLS dinyahaktifkan dalam `setup_penggredan.sql`. |
| 23 | `app_settings` | `api/routes/settings.routes.ts`, `src/services/logoService.ts` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | `id`, `key`, `value`, `estate_id`, `updated_at` | Eksplisit (`estate_id`) | Tetapan Sistem | Simpanan konfigurasi seperti logo ladang, nama pengurus, tetapan sistem. |
| 24 | `presentation_decks` | `api/routes/slides.routes.ts`, `src/services/presentationService.ts` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | `id`, `title`, `description`, `slides`, `theme`, `estate_id`, `created_at`, `updated_at` | Eksplisit (`estate_id`) | Pengurusan / Slaid | Dokumen slaid taklimat dan mesyuarat pengurusan ladang. |
| 25 | `the_oil_palm_knowledge` | `api/routes/ai.routes.ts`, `supabase/migrations/20260823_the_oil_palm_5th_edition_knowledge.sql` | `SELECT`, `INSERT`, `DELETE`, `RPC` | `id`, `document_id`, `category`, `page_number`, `chunk_index`, `title`, `content`, `tags`, `embedding`, `tsv` | Global (Semua Estate) | RAG / Knowledge Base | Buku rujukan agronomi sawit *The Oil Palm (5th Ed)* oleh Corley & Tinker. |
| 26 | `manual_sawit_knowledge` | `api/routes/ai.routes.ts`, `src/features/dashboard/components/ManualSawitChatModal.tsx` | `SELECT`, `INSERT`, `DELETE` | `id`, `manual_title`, `category`, `section_title`, `page_number`, `content`, `embedding` | Global (Semua Estate) | RAG / Knowledge Base | Manual Amalan Pertanian Baik Sawit Felda / FGV rasmi. |
| 27 | `manual_rumpai_knowledge` | `api/routes/ai.routes.ts`, `src/analyze_manual.ts`, `src/build_dict.ts` | `SELECT`, `INSERT`, `DELETE` | `id`, `manual_title`, `category`, `section_title`, `page_number`, `content`, `embedding` | Global (Semua Estate) | RAG / Knowledge Base | Manual Kawalan Rumpai & Kalibrasi Semburan Racun. |
| 28 | `kadar_upah_knowledge` | `api/routes/ai.routes.ts`, `supabase/migrations/20260818_create_kadar_upah_table.sql` | `SELECT`, `INSERT`, `DELETE` | `id`, `manual_title`, `category`, `section_title`, `page_number`, `content`, `created_at` | Global (Semua Estate) | RAG / Knowledge Base | Jadual Kesepakatan Kadar Upah Kerja Ladang (KUK Siri 8). |
| 29 | `ipds_rag_documents` | `api/services/pdfIngestion.service.ts`, `supabase/migrations/20260823_enterprise_rag_schema.sql` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | `id`, `document_name`, `category`, `total_pages`, `status`, `hash`, `created_at` | Global / Multi-Tenant | RAG Master Index | Indeks induk dokumen PDF Enterprise RAG. |
| 30 | `ipds_rag_pages` | `api/services/pdfIngestion.service.ts`, `supabase/migrations/20260823_enterprise_rag_schema.sql` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | `id`, `document_id`, `page_number`, `content`, `status`, `error_message`, `processed_at` | Global / Multi-Tenant | RAG Page Chunks | Simpanan kandungan teks dan muka surat per dokumen RAG. |
| 31 | `ipds_rag_ingestion_log` | `api/services/pdfIngestion.service.ts`, `supabase/migrations/20260823_enterprise_rag_schema.sql` | `SELECT`, `INSERT`, `DELETE` | `id`, `document_id`, `action`, `status`, `details`, `timestamp` | Global / Audit | RAG Audit Trail | Log penjejakan aktiviti penyerapan (*ingestion*) dokumen. |

---

## 3. PERTEMBUNGAN PENAMAAN JADUAL & SCHEMA DIVERGENCE

Terdapat **5 kawasan ketidaksamaan (schema divergence)** antara kod yang sedang berjalan dan definisi skrip SQL:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              SKEMA & NAMING CONFLICT AUDIT                             │
├──────────────────────────┬──────────────────────────┬──────────────────────────────────┤
│ TABLE A (Digunakan Kod)  │ TABLE B (Target dlm RLS) │ IMPAK & PERTEMBUNGAN             │
├──────────────────────────┼──────────────────────────┼──────────────────────────────────┤
│ 1. merumput_progress     │ merumput_daily_entries   │ Kod guna merumput_progress.      │
│    (api/routes/merumput) │ (20260824_ipds_granular) │ RLS menyasarkan nama lain.       │
├──────────────────────────┼──────────────────────────┼──────────────────────────────────┤
│ 2. hujan_rekod           │ data_hujan               │ Frontend guna format pivot tahun │
│    (src/hooks/useRainfall)│ (20260824_ipds_granular)│ RLS menyasarkan format harian.   │
├──────────────────────────┼──────────────────────────┼──────────────────────────────────┤
│ 3. workers (+ attend/work│ data_pekerja             │ Pekerja UI guna 3 jadual relasi  │
│    (src/features/pekerja)│ (20260824_ipds_granular) │ RLS menyasarkan jadual tunggal.  │
├──────────────────────────┼──────────────────────────┼──────────────────────────────────┤
│ 4. penggredan_rekod      │ (Tiada dlm RLS 20260824) │ UI Kualiti simpan rekod di sini. │
│    (src/features/kualiti)│                          │ RLS DINYAHAKTIFKAN dalam SQL lama│
├──────────────────────────┼──────────────────────────┼──────────────────────────────────┤
│ 5. annual_yield          │ hasil_abw / hasil_bbc    │ Endpoint /hantaran guna jadual   │
│    (api/routes/hantaran) │                          │ ini tanpa sebarang RLS.          │
└──────────────────────────┴──────────────────────────┴──────────────────────────────────┘
```

---

## 4. PENILAIAN PENGASINGAN MULTI-ESTATE (ESTATE ISOLATION)

| Jadual | `estate_id` Wujud? | Bentuk Pengasingan | Status RLS Semasa | Tahap Risiko Pencerobohan Rentas Estate |
| :--- | :--- | :--- | :--- | :--- |
| `hantaran_hasil` | Ya | Eksplisit (`estate_id`) | Dilindungi jika RLS 20260824 dipasang | 🟡 Sederhana |
| `hantaran_pruning` | Ya | Eksplisit (`estate_id`) | Dilindungi jika RLS 20260824 dipasang | 🟡 Sederhana |
| `fertilizer_daily_entries` | Ya | Eksplisit (`estate_id`) | Dilindungi jika RLS 20260824 dipasang | 🟡 Sederhana |
| `fertilizer_master_schedule`| Ya | Eksplisit (`estate_id`) | Dilindungi jika RLS 20260824 dipasang | 🟡 Sederhana |
| `fertilizer_inventory` | Ya | Eksplisit (`estate_id`) | Dilindungi jika RLS 20260824 dipasang | 🟡 Sederhana |
| `fertilizer_inventory_transactions` | Ya | Eksplisit (`estate_id`) | Dilindungi jika RLS 20260824 dipasang | 🟡 Sederhana |
| `merumput_progress` | **TIDAK** | Implisit / Berkongsi | **RLS Disabled (setup_supabase.sql)** | 🔴 **CRITICAL** |
| `merumput_inventory` | Ya | Eksplisit (`estate_id`) | Dilindungi jika RLS 20260824 dipasang | 🟡 Sederhana |
| `merumput_inventory_transactions` | Ya | Eksplisit (`estate_id`) | Dilindungi jika RLS 20260824 dipasang | 🟡 Sederhana |
| `hujan_rekod` | **TIDAK** | Implisit / Berkongsi | **RLS Disabled (setup_hujan_rls.sql)** | 🔴 **CRITICAL** |
| `workers` | **TIDAK** | Implisit / Berkongsi | RLS `USING (true)` (setup_pekerja.sql) | 🔴 **CRITICAL** |
| `attendance_records` | **TIDAK** | Implisit (via worker) | RLS `USING (true)` (setup_pekerja.sql) | 🔴 **CRITICAL** |
| `work_assignments` | **TIDAK** | Implisit (via worker) | RLS `USING (true)` (setup_pekerja.sql) | 🔴 **CRITICAL** |
| `penggredan_rekod` | **TIDAK** (ada teks `ladang`)| Implisit / Bebas | **RLS Disabled (setup_penggredan.sql)** | 🔴 **CRITICAL** |
| `annual_yield` / `block_annual_yields` | **TIDAK** | Implisit / Terbuka | Tiada RLS | 🔴 **CRITICAL** |
| `hasil_abw_history` | Ya | Eksplisit (`estate_id`) | Dilindungi jika RLS 20260824 dipasang | 🟡 Sederhana |
| `hasil_bbc_history` | Ya | Eksplisit (`estate_id`) | Dilindungi jika RLS 20260824 dipasang | 🟡 Sederhana |
| `hasil_backlog_history` | Ya | Eksplisit (`estate_id`) | Dilindungi jika RLS 20260824 dipasang | 🟡 Sederhana |
| `app_settings` | Ya | Eksplisit (`estate_id`) | Dilindungi jika RLS 20260824 dipasang | 🟡 Sederhana |
| `presentation_decks` | Ya | Eksplisit (`estate_id`) | Dilindungi jika RLS 20260824 dipasang | 🟡 Sederhana |

---

## 5. PENILAIAN INTEGRITI, INDEKS & AUDITABILITI

1. **Integriti Kekunci & Hubungan (Foreign Keys)**:
   - Hubungan inventori $\rightarrow$ transaksi (`fertilizer_inventory_transactions`, `merumput_inventory_transactions`) dan pekerja $\rightarrow$ kehadiran (`attendance_records`, `work_assignments`) mematuhi integriti rujukan (*Foreign Key with ON DELETE CASCADE*).
   - **Kelemahan**: Jadual transaksi hasil dan pembajaan harian belum mempunyai Foreign Key ketat ke jadual takrifan blok atau master ladang.
2. **Indeks Prestasi (Performance Indexes)**:
   - Terdapat indeks tunggal pada tarikh dan blok.
   - **Kelemahan Kritikal**: Tiada indeks komposit `(estate_id, tarikh)` atau `(estate_id, blok)`. Apabila RLS berkuat kuasa, setiap pertanyaan PostgreSQL wajib menapis `estate_id`. Ketiadaan indeks komposit akan menyebabkan kelembapan ketara (*sequential table scan*) apabila rekod mencecah puluhan ribu baris.
3. **Auditabiliti (Audit Trails & CDC)**:
   - Hanya `hantaran_hasil` dan `hantaran_pruning` yang mencatatkan `recorded_by_kiosk`, `operator_id`, dan `session_id`.
   - Modul pembajaan, merumput, pekerja, dan tetapan belum mempunyai keupayaan menjejak siapa yang mengubah rekod atau apakah nilai lama sebelum pindaan dibuat.

---

## 6. PENILAIAN MODUL RAG (ENTERPRISE KNOWLEDGE BASE)

Modul Agro-AI RAG IPDS Ver. 3.7 berada dalam keadaan sangat kukuh dan teratur:
- **Carian Hibrid Bersepadu**: Menggabungkan vektor HNSW `pgvector` (vektor kosinus) dan indeks teks penuh GIN BM25 (`match_ipds_documents_hybrid`).
- **Domain Books**: Manual Sawit Felda, Manual Kawalan Rumpai, KUK Siri 8, dan *The Oil Palm (5th Ed)* diklasifikasikan sebagai **Global Master Data** (dikongsi merentasi semua estate tanpa sekatan pencerobohan, mematuhi amalan agronomi standard).
- **Metadata Dokumen**: Setiap petikan (*chunk*) mempunyai metadata lengkap (`document_id`, `page_number`, `chunk_index`, `title`, `tags`, `tsv`).

---

## 7. SENARAI ITEM BERISIKO TINGGI (RANKED RISK ASSESSMENT)

| Tahap Risiko | Perkara / Komponen | Punca & Impak Risiko |
| :--- | :--- | :--- |
| 🔴 **CRITICAL** | **Percanggahan Nama Jadual Merumput & Hujan** | Skrip RLS melindungi `merumput_daily_entries` dan `data_hujan`, tetapi kod aplikasi memanggil `merumput_progress` dan `hujan_rekod`. Mengaktifkan RLS serta-merta akan menyebabkan fungsi merumput dan hujan terputus. |
| 🔴 **CRITICAL** | **Panggilan Anon Client Terus pada UI Pekerja & Hujan** | `useRainfallData.ts` dan `pekerja/services.ts` memanggil Supabase terus dari pelayar tanpa menyuntik token berautentikasi `app_metadata`. RLS akan menyekat pertanyaan ini menjadi 0 baris jika diaktifkan. |
| 🔴 **CRITICAL** | **Jadual Kualiti (`penggredan_rekod`) Tiada Kawalan Keselamatan** | Mengandungi data penggredan kualiti buah sawit penting tetapi RLS dinyahaktifkan secara eksplisit dalam `setup_penggredan.sql`. |
| 🟠 **HIGH** | **Token JWT Sesi Lama Tiada `app_metadata.estate_id`** | Sesi pengguna sedia ada yang belum diperbaharui akan memulangkan `NULL` pada `auth.estate_id()`, menyekat capaian mereka kepada sistem. |
| 🟠 **HIGH** | **Ketiadaan Indeks Komposit `estate_id`** | Pertanyaan data bertapis RLS akan menjadi perlahan (*sequential table scan*) apabila volum transaksi meningkat. |
| 🟡 **MEDIUM** | **Ketiadaan Pemicu Automatik `updated_at` & `updated_by`** | Tiada penjejakan sejarah audit untuk mengenal pasti identiti yang meminda data operasi ladang. |
| 🟢 **LOW** | **Pangkalan Pengetahuan RAG** | Modul RAG adalah stabil, diindeks dengan baik menggunakan HNSW dan BM25, serta tidak terjejas oleh sekatan multi-estate. |

---

## 8. CADANGAN PELAN TINDAKAN MIGRASI BERFASA (MIGRATION SEQUENCE)

```
┌────────────────────────────────────────────────────────────────────────┐
│                    CADANGAN URUTAN MIGRASI SISTEM                      │
├────────────────────────────────────────────────────────────────────────┤
│ FASA 1: PENYELARASAN SKEMA & JADUAL (SCHEMA ALIGNMENT)                 │
│ • Tambah kolum estate_id pada jadual merumput_progress, hujan_rekod,  │
│   workers, attendance_records, work_assignments, dan penggredan_rekod. │
│ • Sediakan VIEW atau alias untuk mengelakkan ralat kod sedia ada.      │
├────────────────────────────────────────────────────────────────────────┤
│ FASA 2: KEMAS KINI KOD APLIKASI (APPLICATION CODE ADAPTATION)          │
│ • Selaraskan API Express & Frontend services supaya menyuntik          │
│   estate_id pada semua operasi INSERT/UPDATE.                          │
│ • Halakan modul pekerja, hujan, dan kualiti melalui backend proxy      │
│   berautentikasi (mengelakkan panggilan anon terus).                  │
├────────────────────────────────────────────────────────────────────────┤
│ FASA 3: BACKFILL DATA LEGASI (DATA BACKFILL)                           │
│ • Pastikan semua baris data sedia ada mempunyai nilai estate_id sah.   │
│ • Kemas kini app_metadata pada pengguna sedia ada dalam auth.users.    │
├────────────────────────────────────────────────────────────────────────┤
│ FASA 4: PENGUATKUASAAN RLS GRANULAR (RLS ENFORCEMENT)                  │
│ • Jalankan skrip RLS yang merangkumi kesemua jadual sebenar.           │
│ • Uji akses pengguna mengikut peranan (pf, fc, staff, mandur).         │
├────────────────────────────────────────────────────────────────────────┤
│ FASA 5: INDEKS PRESTASI & LOG AUDIT (PERFORMANCE & AUDIT TRAILS)       │
│ • Pasang indeks komposit (estate_id, tarikh).                          │
│ • Aktifkan jadual audit log untuk transaksi kritikal.                  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 9. SENARAI FAIL YANG PERLU DIKEMAS KINI KEMUDIAN (FILES TO BE MODIFIED)

1. **Backend API Endpoints**:
   - `api/routes/merumput.routes.ts` (Suntik semakan `estate_id` dan selaraskan skema)
   - `api/routes/hantaran.routes.ts` (Sertakan semakan `estate_id` pada analitik `annual_yield`)
   - `api/routes/slides.routes.ts` (Kekalkan konsistensi perlindungan `presentation_decks`)
2. **Frontend Services & Custom Hooks**:
   - `src/features/pekerja/services.ts` (Alihkan dari panggilan Supabase anon terus kepada API backend berautentikasi)
   - `src/hooks/useRainfallData.ts` (Alihkan dari panggilan terus kepada API backend berautentikasi `/api/hujan`)
   - `src/features/kualiti/services/penggredanService.ts` (Sertakan pengurusan `estate_id` & lindungi dengan RLS)
3. **Database Migrations & SQL Clean-up**:
   - `supabase/migrations/20260824_ipds_granular_rls.sql` (Kembangkan skop perlindungan kepada jadual `merumput_progress`, `hujan_rekod`, `workers`, `attendance_records`, `work_assignments`, dan `penggredan_rekod`)
   - Arkibkan atau padam skrip legasi yang menyahaktifkan keselamatan: `disable_all_rls.sql`, `setup_hujan_rls.sql`, `setup_penggredan.sql`.

---
*Laporan disediakan oleh CTO-Level AI Architecture & Security Engineering Audit — IPDS Ver. 3.7.*


