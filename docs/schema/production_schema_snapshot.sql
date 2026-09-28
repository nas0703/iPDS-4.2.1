-- ==============================================================================
-- iPDS-4.1 PRODUCTION DATABASE SCHEMA SNAPSHOT (READ-ONLY INTROSPECTION)
-- Generated on: 2026-09-18T08:45:17.861Z
-- Source: Live Production Supabase PostgreSQL Instance
-- Safety Guarantee: Read-only inspection; no DB objects modified.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA public;

-- 2. BASE TABLES & COLUMNS
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text NOT NULL,
  value jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  worker_id uuid,
  date date NOT NULL,
  status text NOT NULL,
  created_by text,
  created_at timestamp with time zone DEFAULT now(),
  estate_id character varying(50) DEFAULT 'FPM_TUNGGAL'::character varying
);

CREATE TABLE IF NOT EXISTS public.block_annual_yields (
  id bigint DEFAULT nextval('block_annual_yields_id_seq'::regclass) NOT NULL,
  year integer NOT NULL,
  block text NOT NULL,
  yield numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  estate_id text DEFAULT 'FPM_TUNGGAL'::text
);

CREATE TABLE IF NOT EXISTS public.bts_submissions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  no_akuan_terima text NOT NULL,
  tarikh_urusniaga date NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  kilang text NOT NULL,
  no_pass text,
  mspo_validity text,
  kod_penjual text,
  nama_penjual text NOT NULL,
  no_lesen_mpob text,
  pur_berat text,
  sampel text,
  no_lori text NOT NULL,
  pemandu text NOT NULL,
  nota_hantaran text,
  kpa_kpg text,
  hantaran_bi numeric,
  masak integer,
  pct_masak numeric,
  s_tikus numeric,
  b_asing numeric,
  gross_tonne numeric NOT NULL,
  gross_masa time without time zone,
  tare_tonne numeric NOT NULL,
  tare_masa time without time zone,
  reject_tonne numeric DEFAULT 0,
  nett_tonne numeric NOT NULL,
  kod_grader text,
  harga_tan numeric NOT NULL,
  jum_premium numeric DEFAULT 0,
  penalti_bts numeric DEFAULT 0,
  jumlah_nilai numeric NOT NULL,
  penjual_wakil text,
  ic text,
  ditimbang_oleh text,
  pegawai text NOT NULL,
  changed_fields ARRAY,
  original_ocr_data jsonb,
  image_url text,
  status text DEFAULT 'completed'::text,
  estate_id text DEFAULT 'FPM_TUNGGAL'::text
);

CREATE TABLE IF NOT EXISTS public.companies (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL,
  code character varying(50) NOT NULL,
  name character varying(255) NOT NULL,
  registration_no character varying(100),
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.data_hujan (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  tarikh date,
  stesen text,
  bacaan_mm numeric DEFAULT 0,
  estate_id text DEFAULT 'FPM_TUNGGAL'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.device_approval_capabilities (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  device_id text NOT NULL,
  estate_id text NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  created_by text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  requester_name text,
  requester_staff_id text,
  device_name text
);

CREATE TABLE IF NOT EXISTS public.employee_assignment_blocks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL,
  assignment_id uuid NOT NULL,
  block_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  created_by character varying(255)
);

CREATE TABLE IF NOT EXISTS public.employee_assignments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  company_id uuid NOT NULL,
  estate_id character varying(50) NOT NULL,
  division_id character varying(50),
  assignment_role character varying(50) DEFAULT 'PRIMARY'::character varying NOT NULL,
  status character varying(30) DEFAULT 'ACTIVE'::character varying NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  transfer_reason text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by character varying(255),
  updated_by character varying(255)
);

CREATE TABLE IF NOT EXISTS public.employees (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL,
  staff_no character varying(50) NOT NULL,
  full_name character varying(255) NOT NULL,
  position_id uuid NOT NULL,
  employment_status character varying(30) DEFAULT 'ACTIVE'::character varying NOT NULL,
  id_card_passport character varying(50),
  contact_number character varying(50),
  email character varying(255),
  hire_date date DEFAULT CURRENT_DATE NOT NULL,
  end_date date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by character varying(255),
  updated_by character varying(255)
);

CREATE TABLE IF NOT EXISTS public.fertilizer_daily_entries (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  entry_date date NOT NULL,
  blok_code text NOT NULL,
  pus integer NOT NULL,
  interval_name text,
  fertilizer_type text,
  workers_count integer,
  total_beg_completed integer,
  productivity_beg_per_worker numeric,
  target_beg_for_selected_pus integer,
  note text,
  created_by text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  estate_id text DEFAULT 'FPM_TUNGGAL'::text
);

CREATE TABLE IF NOT EXISTS public.fertilizer_inventory (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  quantity numeric DEFAULT 0,
  min_threshold numeric DEFAULT 50,
  unit text DEFAULT 'KG'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  estate_id text DEFAULT 'FPM_TUNGGAL'::text
);

CREATE TABLE IF NOT EXISTS public.fertilizer_inventory_transactions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  inventory_id uuid,
  type text,
  quantity numeric NOT NULL,
  reference text,
  created_at timestamp with time zone DEFAULT now(),
  estate_id text DEFAULT 'FPM_TUNGGAL'::text
);

CREATE TABLE IF NOT EXISTS public.fertilizer_master_schedule (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  blok_code text NOT NULL,
  luas_ha numeric,
  dirian integer,
  pokok integer,
  pus1_beg integer,
  pus2_beg integer,
  pus3_beg integer,
  pus4_beg integer,
  compact_total_beg integer,
  organic_total_beg integer,
  grand_total_beg integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  estate_id text DEFAULT 'FPM_TUNGGAL'::text
);

CREATE TABLE IF NOT EXISTS public.hantaran_hasil (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  tarikh date DEFAULT CURRENT_DATE,
  bil text,
  no_resit text NOT NULL,
  no_lori text NOT NULL,
  blok text NOT NULL,
  peringkat text,
  masa_masuk time without time zone,
  masa_keluar time without time zone,
  tan numeric NOT NULL,
  muda integer DEFAULT 0,
  no_seal text,
  url_gambar text,
  created_at timestamp with time zone DEFAULT now(),
  thek numeric,
  no_nota_hantaran text,
  kpg text,
  no_akaun_terima text,
  reject numeric DEFAULT 0,
  sample integer DEFAULT 0,
  rm_mt numeric DEFAULT 0,
  hasil_rm numeric DEFAULT 0,
  estate_id text DEFAULT 'FPM_TUNGGAL'::text
);

CREATE TABLE IF NOT EXISTS public.hantaran_pruning (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  blok text NOT NULL,
  luas numeric DEFAULT 0,
  tarikh_mula date,
  tarikh_siap date,
  hek_siap_pekerja numeric DEFAULT 0,
  hek_pekerja_cekrol numeric DEFAULT 0,
  jum_hektar_siap numeric DEFAULT 0,
  peratus_siap numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  estate_id text DEFAULT 'FPM_TUNGGAL'::text
);

CREATE TABLE IF NOT EXISTS public.hasil_abw_history (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  category text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  estate_id text DEFAULT 'FPM_TUNGGAL'::text
);

CREATE TABLE IF NOT EXISTS public.hasil_backlog_history (
  category text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  estate_id text DEFAULT 'FPM_TUNGGAL'::text
);

CREATE TABLE IF NOT EXISTS public.hasil_bbc_history (
  category text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  estate_id text DEFAULT 'FPM_TUNGGAL'::text
);

CREATE TABLE IF NOT EXISTS public.hujan_rekod (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  bulan text NOT NULL,
  tahun text NOT NULL,
  jumlah numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  estate_id text DEFAULT 'FPM_TUNGGAL'::text
);

CREATE TABLE IF NOT EXISTS public.kadar_upah_knowledge (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  manual_title text DEFAULT 'Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8)'::text NOT NULL,
  category text DEFAULT 'Kadar Upah'::text NOT NULL,
  section_title text NOT NULL,
  page_number integer DEFAULT 1,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.manual_rumpai_knowledge (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  manual_title text NOT NULL,
  category text NOT NULL,
  section_title text,
  content text NOT NULL,
  page_number integer,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.manual_sawit_knowledge (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  manual_title text NOT NULL,
  category text NOT NULL,
  section_title text,
  content text NOT NULL,
  page_number integer DEFAULT 1,
  embedding vector,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.merumput_inventory (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  quantity numeric DEFAULT 0,
  min_threshold numeric DEFAULT 10,
  unit text DEFAULT 'LITER'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  estate_id text DEFAULT 'FPM_TUNGGAL'::text
);

CREATE TABLE IF NOT EXISTS public.merumput_inventory_transactions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  inventory_id uuid,
  type text,
  quantity numeric NOT NULL,
  reference text,
  created_at timestamp with time zone DEFAULT now(),
  estate_id text DEFAULT 'FPM_TUNGGAL'::text
);

CREATE TABLE IF NOT EXISTS public.merumput_progress (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  blok text NOT NULL,
  luas numeric DEFAULT 0,
  pusingan integer DEFAULT 1 NOT NULL,
  jenis text NOT NULL,
  tarikh_mula date NOT NULL,
  tarikh_siap date,
  hek_siap numeric DEFAULT 0,
  workers_count integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  estate_id text DEFAULT 'FPM_TUNGGAL'::text
);

CREATE TABLE IF NOT EXISTS public.notebook_chats (
  id text NOT NULL,
  user_id uuid NOT NULL,
  title text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notebook_messages (
  id text NOT NULL,
  chat_id text,
  user_id uuid NOT NULL,
  sender text,
  message text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notebook_resources (
  id text NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  file_size text,
  content text NOT NULL,
  char_count integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.org_blocks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL,
  estate_id character varying(50) NOT NULL,
  division_id character varying(50),
  block_code character varying(50) NOT NULL,
  crop_type character varying(50) DEFAULT 'OIL_PALM'::character varying,
  hectarage numeric DEFAULT 0,
  planting_year integer,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.org_divisions (
  id character varying(50) NOT NULL,
  estate_id character varying(50) NOT NULL,
  name character varying(100) NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.org_estates (
  id character varying(50) NOT NULL,
  name character varying(100) NOT NULL,
  total_area_ha numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.org_positions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL,
  code character varying(50) NOT NULL,
  title character varying(150) NOT NULL,
  category character varying(100) DEFAULT 'OPERATIONS'::character varying NOT NULL,
  department character varying(100) DEFAULT 'LADANG'::character varying,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pdf_documents (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  project_id text NOT NULL,
  document_id uuid NOT NULL,
  file_name text NOT NULL,
  page_number integer,
  section text,
  topic text,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  embedding vector,
  created_at timestamp with time zone DEFAULT now(),
  page_end integer,
  subsection text,
  content_hash text,
  embedding_model text DEFAULT 'models/gemini-embedding-2'::text,
  embedding_status text DEFAULT 'PENDING'::text,
  error_message text,
  updated_at timestamp with time zone DEFAULT now(),
  fts tsvector
);

CREATE TABLE IF NOT EXISTS public.penggredan_rekod (
  id text NOT NULL,
  tajuk text,
  program text,
  jenis_grading text,
  tarikh text,
  ladang text,
  peringkat_blok text,
  no_lori text,
  nama_penggred text,
  platforms jsonb DEFAULT '[]'::jsonb,
  total_di_gred integer DEFAULT 0,
  total_di_tinggal integer DEFAULT 0,
  total_di_bawa integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  estate_id text DEFAULT 'FPM_TUNGGAL'::text
);

CREATE TABLE IF NOT EXISTS public.presentation_decks (
  id text NOT NULL,
  title text NOT NULL,
  description text,
  category text DEFAULT 'Umum'::text,
  slides jsonb DEFAULT '[]'::jsonb NOT NULL,
  author text,
  pptx_base64 text,
  file_name text,
  file_size bigint,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  estate_id text DEFAULT 'FPM_TUNGGAL'::text
);

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  framework text DEFAULT 'Vite + React'::text,
  status text DEFAULT 'Draft'::text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.rag_document_pages (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  document_id uuid NOT NULL,
  page_number integer NOT NULL,
  extracted boolean DEFAULT false NOT NULL,
  text_content text,
  text_length integer DEFAULT 0 NOT NULL,
  has_table boolean DEFAULT false NOT NULL,
  table_count integer DEFAULT 0 NOT NULL,
  chunks_created integer DEFAULT 0 NOT NULL,
  chunks_embedded integer DEFAULT 0 NOT NULL,
  validation_status text DEFAULT 'PENDING'::text NOT NULL,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.rag_documents (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  project_id text DEFAULT 'default'::text NOT NULL,
  file_name text NOT NULL,
  file_type text DEFAULT 'pdf'::text NOT NULL,
  file_hash text,
  title text,
  description text,
  total_pages integer DEFAULT 0 NOT NULL,
  extracted_pages integer DEFAULT 0 NOT NULL,
  failed_pages integer DEFAULT 0 NOT NULL,
  total_chunks integer DEFAULT 0 NOT NULL,
  embedded_chunks integer DEFAULT 0 NOT NULL,
  failed_chunks integer DEFAULT 0 NOT NULL,
  extraction_status text DEFAULT 'PENDING'::text NOT NULL,
  ingestion_status text DEFAULT 'PENDING'::text NOT NULL,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.registered_devices (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  device_id text NOT NULL,
  device_name text NOT NULL,
  estate_id text DEFAULT 'FPM_TUNGGAL'::text NOT NULL,
  registered_by_pin text,
  operator_name text,
  role text,
  status text DEFAULT 'PENDING'::text NOT NULL,
  approved_by text,
  approved_at timestamp with time zone,
  last_seen_at timestamp with time zone DEFAULT now(),
  ip_address text,
  user_agent text,
  created_at timestamp with time zone DEFAULT now(),
  credential_hash text,
  credential_version integer DEFAULT 1 NOT NULL,
  credential_rotated_at timestamp with time zone,
  merged_into text,
  merged_at timestamp with time zone,
  merge_operation_id text
);

CREATE TABLE IF NOT EXISTS public.registered_devices_backup_before_dedup (
  id uuid,
  device_id text,
  device_name text,
  estate_id text,
  registered_by_pin text,
  operator_name text,
  role text,
  status text,
  approved_by text,
  approved_at timestamp with time zone,
  last_seen_at timestamp with time zone,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone,
  credential_hash text,
  credential_version integer,
  credential_rotated_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  code character varying(50) NOT NULL,
  name character varying(255) NOT NULL,
  subscription_tier character varying(50) DEFAULT 'ENTERPRISE'::character varying,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.the_oil_palm_knowledge (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  document_id text DEFAULT 'top-5th-edition-corley-tinker'::text,
  manual_title text DEFAULT 'The Oil Palm (5th Edition) - R.H.V. Corley & P.B. Tinker'::text NOT NULL,
  category text DEFAULT 'The Oil Palm, 5th Edition'::text NOT NULL,
  chapter text,
  section_title text NOT NULL,
  page_number integer DEFAULT 1 NOT NULL,
  chunk_index integer DEFAULT 0,
  content text NOT NULL,
  tags ARRAY DEFAULT '{}'::text[],
  metadata jsonb DEFAULT '{"isbn": "978-1-4051-8939-2", "year": 2016, "authors": "R.H.V. Corley, P.B. Tinker", "edition": "5th Edition", "publisher": "Wiley Blackwell"}'::jsonb,
  embedding vector,
  tsv tsvector,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.weed_knowledge_base (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nama_tempatan text NOT NULL,
  nama_saintifik text NOT NULL,
  kategori text,
  ciri_visual jsonb NOT NULL,
  kawalan_kimia jsonb NOT NULL,
  mspo_guideline text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.weed_scan_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  image_url text NOT NULL,
  detected_weed_id uuid,
  confidence_score numeric,
  lokasi_blok text,
  mandor_id uuid,
  status_tindakan text DEFAULT 'Belum Disembur'::text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  estate_id text DEFAULT 'FPM_TUNGGAL'::text
);

CREATE TABLE IF NOT EXISTS public.work_assignments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  worker_id uuid,
  date date NOT NULL,
  work_type text NOT NULL,
  blok text NOT NULL,
  peringkat text NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  estate_id text DEFAULT 'FPM_TUNGGAL'::text
);

CREATE TABLE IF NOT EXISTS public.workers (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  worker_no text NOT NULL,
  name text NOT NULL,
  role text DEFAULT 'Pekerja Am'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  negara_asal character varying(255) DEFAULT 'Malaysia'::character varying,
  kumpulan character varying(255) DEFAULT 'Kerja Am dan Lain-lain'::character varying,
  estate_id text DEFAULT 'FPM_TUNGGAL'::text
);

-- 3. CONSTRAINTS
-- Table: app_settings (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_settings_pkey') THEN
    ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_pkey PRIMARY KEY (key);
  END IF;
END $$;

-- Table: attendance_records (CHECK)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_records_status_check') THEN
    ALTER TABLE public.attendance_records ADD CONSTRAINT attendance_records_status_check CHECK ((status = ANY (ARRAY['Hadir'::text, 'Tidak Hadir'::text, 'Cuti'::text, 'Sakit'::text])));
  END IF;
END $$;

-- Table: attendance_records (FOREIGN KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_records_worker_id_fkey') THEN
    ALTER TABLE public.attendance_records ADD CONSTRAINT attendance_records_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Table: attendance_records (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_records_pkey') THEN
    ALTER TABLE public.attendance_records ADD CONSTRAINT attendance_records_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: attendance_records (UNIQUE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_records_worker_id_date_key') THEN
    ALTER TABLE public.attendance_records ADD CONSTRAINT attendance_records_worker_id_date_key UNIQUE (worker_id, date);
  END IF;
END $$;

-- Table: block_annual_yields (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'block_annual_yields_pkey') THEN
    ALTER TABLE public.block_annual_yields ADD CONSTRAINT block_annual_yields_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: block_annual_yields (UNIQUE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'block_annual_yields_year_block_key') THEN
    ALTER TABLE public.block_annual_yields ADD CONSTRAINT block_annual_yields_year_block_key UNIQUE (year, block);
  END IF;
END $$;

-- Table: bts_submissions (CHECK)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bts_submissions_status_check') THEN
    ALTER TABLE public.bts_submissions ADD CONSTRAINT bts_submissions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text])));
  END IF;
END $$;

-- Table: bts_submissions (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bts_submissions_pkey') THEN
    ALTER TABLE public.bts_submissions ADD CONSTRAINT bts_submissions_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: bts_submissions (UNIQUE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bts_submissions_no_akuan_terima_key') THEN
    ALTER TABLE public.bts_submissions ADD CONSTRAINT bts_submissions_no_akuan_terima_key UNIQUE (no_akuan_terima);
  END IF;
END $$;

-- Table: companies (FOREIGN KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'companies_tenant_id_fkey') THEN
    ALTER TABLE public.companies ADD CONSTRAINT companies_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Table: companies (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'companies_pkey') THEN
    ALTER TABLE public.companies ADD CONSTRAINT companies_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: companies (UNIQUE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_companies_tenant_code') THEN
    ALTER TABLE public.companies ADD CONSTRAINT uq_companies_tenant_code UNIQUE (tenant_id, code);
  END IF;
END $$;

-- Table: data_hujan (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'data_hujan_pkey') THEN
    ALTER TABLE public.data_hujan ADD CONSTRAINT data_hujan_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: device_approval_capabilities (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'device_approval_capabilities_pkey') THEN
    ALTER TABLE public.device_approval_capabilities ADD CONSTRAINT device_approval_capabilities_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: device_approval_capabilities (UNIQUE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'device_approval_capabilities_token_hash_key') THEN
    ALTER TABLE public.device_approval_capabilities ADD CONSTRAINT device_approval_capabilities_token_hash_key UNIQUE (token_hash);
  END IF;
END $$;

-- Table: employee_assignment_blocks (FOREIGN KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_assignment_blocks_assignment_id_fkey') THEN
    ALTER TABLE public.employee_assignment_blocks ADD CONSTRAINT employee_assignment_blocks_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES employee_assignments(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Table: employee_assignment_blocks (FOREIGN KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_assignment_blocks_block_id_fkey') THEN
    ALTER TABLE public.employee_assignment_blocks ADD CONSTRAINT employee_assignment_blocks_block_id_fkey FOREIGN KEY (block_id) REFERENCES org_blocks(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Table: employee_assignment_blocks (FOREIGN KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_assignment_blocks_tenant_id_fkey') THEN
    ALTER TABLE public.employee_assignment_blocks ADD CONSTRAINT employee_assignment_blocks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Table: employee_assignment_blocks (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_assignment_blocks_pkey') THEN
    ALTER TABLE public.employee_assignment_blocks ADD CONSTRAINT employee_assignment_blocks_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: employee_assignment_blocks (UNIQUE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_assignment_block_pair') THEN
    ALTER TABLE public.employee_assignment_blocks ADD CONSTRAINT uq_assignment_block_pair UNIQUE (assignment_id, block_id);
  END IF;
END $$;

-- Table: employee_assignments (FOREIGN KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_assignments_company_id_fkey') THEN
    ALTER TABLE public.employee_assignments ADD CONSTRAINT employee_assignments_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Table: employee_assignments (FOREIGN KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_assignments_division_id_fkey') THEN
    ALTER TABLE public.employee_assignments ADD CONSTRAINT employee_assignments_division_id_fkey FOREIGN KEY (division_id) REFERENCES org_divisions(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Table: employee_assignments (FOREIGN KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_assignments_employee_id_fkey') THEN
    ALTER TABLE public.employee_assignments ADD CONSTRAINT employee_assignments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Table: employee_assignments (FOREIGN KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_assignments_estate_id_fkey') THEN
    ALTER TABLE public.employee_assignments ADD CONSTRAINT employee_assignments_estate_id_fkey FOREIGN KEY (estate_id) REFERENCES org_estates(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Table: employee_assignments (FOREIGN KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_assignments_tenant_id_fkey') THEN
    ALTER TABLE public.employee_assignments ADD CONSTRAINT employee_assignments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Table: employee_assignments (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_assignments_pkey') THEN
    ALTER TABLE public.employee_assignments ADD CONSTRAINT employee_assignments_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: employees (FOREIGN KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_position_id_fkey') THEN
    ALTER TABLE public.employees ADD CONSTRAINT employees_position_id_fkey FOREIGN KEY (position_id) REFERENCES org_positions(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Table: employees (FOREIGN KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_tenant_id_fkey') THEN
    ALTER TABLE public.employees ADD CONSTRAINT employees_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Table: employees (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_pkey') THEN
    ALTER TABLE public.employees ADD CONSTRAINT employees_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: employees (UNIQUE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_employees_tenant_staff_no') THEN
    ALTER TABLE public.employees ADD CONSTRAINT uq_employees_tenant_staff_no UNIQUE (tenant_id, staff_no);
  END IF;
END $$;

-- Table: fertilizer_daily_entries (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fertilizer_daily_entries_pkey') THEN
    ALTER TABLE public.fertilizer_daily_entries ADD CONSTRAINT fertilizer_daily_entries_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: fertilizer_daily_entries (UNIQUE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fertilizer_daily_entries_entry_date_blok_code_pus_key') THEN
    ALTER TABLE public.fertilizer_daily_entries ADD CONSTRAINT fertilizer_daily_entries_entry_date_blok_code_pus_key UNIQUE (entry_date, blok_code, pus);
  END IF;
END $$;

-- Table: fertilizer_inventory (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fertilizer_inventory_pkey') THEN
    ALTER TABLE public.fertilizer_inventory ADD CONSTRAINT fertilizer_inventory_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: fertilizer_inventory (UNIQUE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fertilizer_inventory_name_key') THEN
    ALTER TABLE public.fertilizer_inventory ADD CONSTRAINT fertilizer_inventory_name_key UNIQUE (name);
  END IF;
END $$;

-- Table: fertilizer_inventory_transactions (CHECK)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fertilizer_inventory_transactions_type_check') THEN
    ALTER TABLE public.fertilizer_inventory_transactions ADD CONSTRAINT fertilizer_inventory_transactions_type_check CHECK ((type = ANY (ARRAY['IN'::text, 'OUT'::text])));
  END IF;
END $$;

-- Table: fertilizer_inventory_transactions (FOREIGN KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fertilizer_inventory_transactions_inventory_id_fkey') THEN
    ALTER TABLE public.fertilizer_inventory_transactions ADD CONSTRAINT fertilizer_inventory_transactions_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES fertilizer_inventory(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Table: fertilizer_inventory_transactions (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fertilizer_inventory_transactions_pkey') THEN
    ALTER TABLE public.fertilizer_inventory_transactions ADD CONSTRAINT fertilizer_inventory_transactions_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: fertilizer_master_schedule (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fertilizer_master_schedule_pkey') THEN
    ALTER TABLE public.fertilizer_master_schedule ADD CONSTRAINT fertilizer_master_schedule_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: fertilizer_master_schedule (UNIQUE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fertilizer_master_schedule_blok_code_key') THEN
    ALTER TABLE public.fertilizer_master_schedule ADD CONSTRAINT fertilizer_master_schedule_blok_code_key UNIQUE (blok_code);
  END IF;
END $$;

-- Table: hantaran_hasil (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hantaran_hasil_pkey') THEN
    ALTER TABLE public.hantaran_hasil ADD CONSTRAINT hantaran_hasil_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: hantaran_hasil (UNIQUE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hantaran_hasil_no_resit_key') THEN
    ALTER TABLE public.hantaran_hasil ADD CONSTRAINT hantaran_hasil_no_resit_key UNIQUE (no_resit);
  END IF;
END $$;

-- Table: hantaran_pruning (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hantaran_pruning_pkey') THEN
    ALTER TABLE public.hantaran_pruning ADD CONSTRAINT hantaran_pruning_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: hantaran_pruning (UNIQUE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hantaran_pruning_blok_key') THEN
    ALTER TABLE public.hantaran_pruning ADD CONSTRAINT hantaran_pruning_blok_key UNIQUE (blok);
  END IF;
END $$;

-- Table: hasil_abw_history (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hasil_abw_history_pkey') THEN
    ALTER TABLE public.hasil_abw_history ADD CONSTRAINT hasil_abw_history_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: hasil_abw_history (UNIQUE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hasil_abw_history_category_key') THEN
    ALTER TABLE public.hasil_abw_history ADD CONSTRAINT hasil_abw_history_category_key UNIQUE (category);
  END IF;
END $$;

-- Table: hasil_backlog_history (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hasil_backlog_history_pkey') THEN
    ALTER TABLE public.hasil_backlog_history ADD CONSTRAINT hasil_backlog_history_pkey PRIMARY KEY (category);
  END IF;
END $$;

-- Table: hasil_bbc_history (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hasil_bbc_history_pkey') THEN
    ALTER TABLE public.hasil_bbc_history ADD CONSTRAINT hasil_bbc_history_pkey PRIMARY KEY (category);
  END IF;
END $$;

-- Table: hujan_rekod (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hujan_rekod_pkey') THEN
    ALTER TABLE public.hujan_rekod ADD CONSTRAINT hujan_rekod_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: kadar_upah_knowledge (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kadar_upah_knowledge_pkey') THEN
    ALTER TABLE public.kadar_upah_knowledge ADD CONSTRAINT kadar_upah_knowledge_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: manual_rumpai_knowledge (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'manual_rumpai_knowledge_pkey') THEN
    ALTER TABLE public.manual_rumpai_knowledge ADD CONSTRAINT manual_rumpai_knowledge_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: manual_sawit_knowledge (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'manual_sawit_knowledge_pkey') THEN
    ALTER TABLE public.manual_sawit_knowledge ADD CONSTRAINT manual_sawit_knowledge_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: merumput_inventory (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'merumput_inventory_pkey') THEN
    ALTER TABLE public.merumput_inventory ADD CONSTRAINT merumput_inventory_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: merumput_inventory (UNIQUE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'merumput_inventory_name_key') THEN
    ALTER TABLE public.merumput_inventory ADD CONSTRAINT merumput_inventory_name_key UNIQUE (name);
  END IF;
END $$;

-- Table: merumput_inventory_transactions (CHECK)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'merumput_inventory_transactions_type_check') THEN
    ALTER TABLE public.merumput_inventory_transactions ADD CONSTRAINT merumput_inventory_transactions_type_check CHECK ((type = ANY (ARRAY['IN'::text, 'OUT'::text])));
  END IF;
END $$;

-- Table: merumput_inventory_transactions (FOREIGN KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'merumput_inventory_transactions_inventory_id_fkey') THEN
    ALTER TABLE public.merumput_inventory_transactions ADD CONSTRAINT merumput_inventory_transactions_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES merumput_inventory(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Table: merumput_inventory_transactions (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'merumput_inventory_transactions_pkey') THEN
    ALTER TABLE public.merumput_inventory_transactions ADD CONSTRAINT merumput_inventory_transactions_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: merumput_progress (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'merumput_progress_pkey') THEN
    ALTER TABLE public.merumput_progress ADD CONSTRAINT merumput_progress_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: merumput_progress (UNIQUE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'merumput_progress_key') THEN
    ALTER TABLE public.merumput_progress ADD CONSTRAINT merumput_progress_key UNIQUE (blok, pusingan, jenis);
  END IF;
END $$;

-- Table: notebook_chats (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notebook_chats_pkey') THEN
    ALTER TABLE public.notebook_chats ADD CONSTRAINT notebook_chats_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: notebook_messages (CHECK)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notebook_messages_sender_check') THEN
    ALTER TABLE public.notebook_messages ADD CONSTRAINT notebook_messages_sender_check CHECK ((sender = ANY (ARRAY['user'::text, 'assistant'::text])));
  END IF;
END $$;

-- Table: notebook_messages (FOREIGN KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notebook_messages_chat_id_fkey') THEN
    ALTER TABLE public.notebook_messages ADD CONSTRAINT notebook_messages_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES notebook_chats(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Table: notebook_messages (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notebook_messages_pkey') THEN
    ALTER TABLE public.notebook_messages ADD CONSTRAINT notebook_messages_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: notebook_resources (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notebook_resources_pkey') THEN
    ALTER TABLE public.notebook_resources ADD CONSTRAINT notebook_resources_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: org_blocks (FOREIGN KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'org_blocks_division_id_fkey') THEN
    ALTER TABLE public.org_blocks ADD CONSTRAINT org_blocks_division_id_fkey FOREIGN KEY (division_id) REFERENCES org_divisions(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Table: org_blocks (FOREIGN KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'org_blocks_estate_id_fkey') THEN
    ALTER TABLE public.org_blocks ADD CONSTRAINT org_blocks_estate_id_fkey FOREIGN KEY (estate_id) REFERENCES org_estates(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Table: org_blocks (FOREIGN KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'org_blocks_tenant_id_fkey') THEN
    ALTER TABLE public.org_blocks ADD CONSTRAINT org_blocks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Table: org_blocks (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'org_blocks_pkey') THEN
    ALTER TABLE public.org_blocks ADD CONSTRAINT org_blocks_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: org_blocks (UNIQUE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_org_blocks_estate_code') THEN
    ALTER TABLE public.org_blocks ADD CONSTRAINT uq_org_blocks_estate_code UNIQUE (estate_id, block_code);
  END IF;
END $$;

-- Table: org_divisions (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'org_divisions_pkey') THEN
    ALTER TABLE public.org_divisions ADD CONSTRAINT org_divisions_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: org_estates (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'org_estates_pkey') THEN
    ALTER TABLE public.org_estates ADD CONSTRAINT org_estates_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: org_positions (FOREIGN KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'org_positions_tenant_id_fkey') THEN
    ALTER TABLE public.org_positions ADD CONSTRAINT org_positions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Table: org_positions (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'org_positions_pkey') THEN
    ALTER TABLE public.org_positions ADD CONSTRAINT org_positions_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: org_positions (UNIQUE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_org_positions_tenant_code') THEN
    ALTER TABLE public.org_positions ADD CONSTRAINT uq_org_positions_tenant_code UNIQUE (tenant_id, code);
  END IF;
END $$;

-- Table: pdf_documents (FOREIGN KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pdf_documents_document_id_fkey') THEN
    ALTER TABLE public.pdf_documents ADD CONSTRAINT pdf_documents_document_id_fkey FOREIGN KEY (document_id) REFERENCES rag_documents(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Table: pdf_documents (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pdf_documents_pkey') THEN
    ALTER TABLE public.pdf_documents ADD CONSTRAINT pdf_documents_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: pdf_documents (UNIQUE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pdf_documents_document_id_chunk_index_key') THEN
    ALTER TABLE public.pdf_documents ADD CONSTRAINT pdf_documents_document_id_chunk_index_key UNIQUE (document_id, chunk_index);
  END IF;
END $$;

-- Table: penggredan_rekod (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'penggredan_rekod_pkey') THEN
    ALTER TABLE public.penggredan_rekod ADD CONSTRAINT penggredan_rekod_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: presentation_decks (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'presentation_decks_pkey') THEN
    ALTER TABLE public.presentation_decks ADD CONSTRAINT presentation_decks_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: projects (FOREIGN KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_user_id_fkey') THEN
    ALTER TABLE public.projects ADD CONSTRAINT projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
  END IF;
END $$;

-- Table: projects (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_pkey') THEN
    ALTER TABLE public.projects ADD CONSTRAINT projects_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: rag_document_pages (CHECK)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rag_document_pages_chunks_created_check') THEN
    ALTER TABLE public.rag_document_pages ADD CONSTRAINT rag_document_pages_chunks_created_check CHECK ((chunks_created >= 0));
  END IF;
END $$;

-- Table: rag_document_pages (CHECK)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rag_document_pages_chunks_embedded_check') THEN
    ALTER TABLE public.rag_document_pages ADD CONSTRAINT rag_document_pages_chunks_embedded_check CHECK ((chunks_embedded >= 0));
  END IF;
END $$;

-- Table: rag_document_pages (CHECK)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rag_document_pages_page_number_check') THEN
    ALTER TABLE public.rag_document_pages ADD CONSTRAINT rag_document_pages_page_number_check CHECK ((page_number > 0));
  END IF;
END $$;

-- Table: rag_document_pages (CHECK)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rag_document_pages_table_count_check') THEN
    ALTER TABLE public.rag_document_pages ADD CONSTRAINT rag_document_pages_table_count_check CHECK ((table_count >= 0));
  END IF;
END $$;

-- Table: rag_document_pages (CHECK)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rag_document_pages_text_length_check') THEN
    ALTER TABLE public.rag_document_pages ADD CONSTRAINT rag_document_pages_text_length_check CHECK ((text_length >= 0));
  END IF;
END $$;

-- Table: rag_document_pages (CHECK)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rag_document_pages_validation_status_check') THEN
    ALTER TABLE public.rag_document_pages ADD CONSTRAINT rag_document_pages_validation_status_check CHECK ((validation_status = ANY (ARRAY['PENDING'::text, 'VALID'::text, 'EMPTY'::text, 'FAILED'::text])));
  END IF;
END $$;

-- Table: rag_document_pages (FOREIGN KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rag_document_pages_document_id_fkey') THEN
    ALTER TABLE public.rag_document_pages ADD CONSTRAINT rag_document_pages_document_id_fkey FOREIGN KEY (document_id) REFERENCES rag_documents(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Table: rag_document_pages (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rag_document_pages_pkey') THEN
    ALTER TABLE public.rag_document_pages ADD CONSTRAINT rag_document_pages_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: rag_document_pages (UNIQUE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rag_document_pages_document_id_page_number_key') THEN
    ALTER TABLE public.rag_document_pages ADD CONSTRAINT rag_document_pages_document_id_page_number_key UNIQUE (document_id, page_number);
  END IF;
END $$;

-- Table: rag_documents (CHECK)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rag_documents_embedded_chunks_check') THEN
    ALTER TABLE public.rag_documents ADD CONSTRAINT rag_documents_embedded_chunks_check CHECK ((embedded_chunks >= 0));
  END IF;
END $$;

-- Table: rag_documents (CHECK)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rag_documents_extracted_pages_check') THEN
    ALTER TABLE public.rag_documents ADD CONSTRAINT rag_documents_extracted_pages_check CHECK ((extracted_pages >= 0));
  END IF;
END $$;

-- Table: rag_documents (CHECK)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rag_documents_extraction_status_check') THEN
    ALTER TABLE public.rag_documents ADD CONSTRAINT rag_documents_extraction_status_check CHECK ((extraction_status = ANY (ARRAY['PENDING'::text, 'PROCESSING'::text, 'COMPLETE'::text, 'PARTIAL'::text, 'FAILED'::text])));
  END IF;
END $$;

-- Table: rag_documents (CHECK)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rag_documents_failed_chunks_check') THEN
    ALTER TABLE public.rag_documents ADD CONSTRAINT rag_documents_failed_chunks_check CHECK ((failed_chunks >= 0));
  END IF;
END $$;

-- Table: rag_documents (CHECK)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rag_documents_failed_pages_check') THEN
    ALTER TABLE public.rag_documents ADD CONSTRAINT rag_documents_failed_pages_check CHECK ((failed_pages >= 0));
  END IF;
END $$;

-- Table: rag_documents (CHECK)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rag_documents_ingestion_status_check') THEN
    ALTER TABLE public.rag_documents ADD CONSTRAINT rag_documents_ingestion_status_check CHECK ((ingestion_status = ANY (ARRAY['PENDING'::text, 'PROCESSING'::text, 'COMPLETE'::text, 'PARTIAL'::text, 'FAILED'::text])));
  END IF;
END $$;

-- Table: rag_documents (CHECK)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rag_documents_total_chunks_check') THEN
    ALTER TABLE public.rag_documents ADD CONSTRAINT rag_documents_total_chunks_check CHECK ((total_chunks >= 0));
  END IF;
END $$;

-- Table: rag_documents (CHECK)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rag_documents_total_pages_check') THEN
    ALTER TABLE public.rag_documents ADD CONSTRAINT rag_documents_total_pages_check CHECK ((total_pages >= 0));
  END IF;
END $$;

-- Table: rag_documents (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rag_documents_pkey') THEN
    ALTER TABLE public.rag_documents ADD CONSTRAINT rag_documents_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: registered_devices (CHECK)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'registered_devices_status_check') THEN
    ALTER TABLE public.registered_devices ADD CONSTRAINT registered_devices_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'APPROVED'::text, 'BLOCKED'::text, 'REVOKED'::text])));
  END IF;
END $$;

-- Table: registered_devices (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'registered_devices_pkey') THEN
    ALTER TABLE public.registered_devices ADD CONSTRAINT registered_devices_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: registered_devices (UNIQUE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'registered_devices_device_id_key') THEN
    ALTER TABLE public.registered_devices ADD CONSTRAINT registered_devices_device_id_key UNIQUE (device_id);
  END IF;
END $$;

-- Table: tenants (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenants_pkey') THEN
    ALTER TABLE public.tenants ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: tenants (UNIQUE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenants_code_key') THEN
    ALTER TABLE public.tenants ADD CONSTRAINT tenants_code_key UNIQUE (code);
  END IF;
END $$;

-- Table: the_oil_palm_knowledge (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'the_oil_palm_knowledge_pkey') THEN
    ALTER TABLE public.the_oil_palm_knowledge ADD CONSTRAINT the_oil_palm_knowledge_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: weed_knowledge_base (CHECK)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'weed_knowledge_base_kategori_check') THEN
    ALTER TABLE public.weed_knowledge_base ADD CONSTRAINT weed_knowledge_base_kategori_check CHECK ((kategori = ANY (ARRAY['Daun Lebar'::text, 'Rumput'::text, 'Rusiga'::text, 'Pakis'::text, 'Anak Kayu'::text])));
  END IF;
END $$;

-- Table: weed_knowledge_base (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'weed_knowledge_base_pkey') THEN
    ALTER TABLE public.weed_knowledge_base ADD CONSTRAINT weed_knowledge_base_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: weed_scan_logs (FOREIGN KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'weed_scan_logs_detected_weed_id_fkey') THEN
    ALTER TABLE public.weed_scan_logs ADD CONSTRAINT weed_scan_logs_detected_weed_id_fkey FOREIGN KEY (detected_weed_id) REFERENCES weed_knowledge_base(id);
  END IF;
END $$;

-- Table: weed_scan_logs (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'weed_scan_logs_pkey') THEN
    ALTER TABLE public.weed_scan_logs ADD CONSTRAINT weed_scan_logs_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: work_assignments (FOREIGN KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_assignments_worker_id_fkey') THEN
    ALTER TABLE public.work_assignments ADD CONSTRAINT work_assignments_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Table: work_assignments (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_assignments_pkey') THEN
    ALTER TABLE public.work_assignments ADD CONSTRAINT work_assignments_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: work_assignments (UNIQUE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_assignments_worker_id_date_work_type_key') THEN
    ALTER TABLE public.work_assignments ADD CONSTRAINT work_assignments_worker_id_date_work_type_key UNIQUE (worker_id, date, work_type);
  END IF;
END $$;

-- Table: workers (PRIMARY KEY)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workers_pkey') THEN
    ALTER TABLE public.workers ADD CONSTRAINT workers_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Table: workers (UNIQUE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workers_worker_no_key') THEN
    ALTER TABLE public.workers ADD CONSTRAINT workers_worker_no_key UNIQUE (worker_no);
  END IF;
END $$;

-- 4. INDEXES
CREATE UNIQUE INDEX IF NOT EXISTS attendance_records_worker_id_date_key ON public.attendance_records USING btree (worker_id, date);
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_estate_worker_date ON public.attendance_records USING btree (estate_id, worker_id, date);
CREATE UNIQUE INDEX IF NOT EXISTS block_annual_yields_year_block_key ON public.block_annual_yields USING btree (year, block);
CREATE INDEX IF NOT EXISTS idx_block_annual_yields_estate ON public.block_annual_yields USING btree (estate_id, year, block);
CREATE UNIQUE INDEX IF NOT EXISTS bts_submissions_no_akuan_terima_key ON public.bts_submissions USING btree (no_akuan_terima);
CREATE INDEX IF NOT EXISTS idx_bts_created ON public.bts_submissions USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bts_kilang ON public.bts_submissions USING btree (kilang);
CREATE INDEX IF NOT EXISTS idx_bts_no_lori ON public.bts_submissions USING btree (no_lori);
CREATE INDEX IF NOT EXISTS idx_bts_submissions_estate_id ON public.bts_submissions USING btree (estate_id);
CREATE INDEX IF NOT EXISTS idx_bts_tarikh ON public.bts_submissions USING btree (tarikh_urusniaga DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_tenant_code ON public.companies USING btree (tenant_id, code);
CREATE INDEX IF NOT EXISTS idx_data_hujan_estate ON public.data_hujan USING btree (estate_id);
CREATE UNIQUE INDEX IF NOT EXISTS device_approval_capabilities_token_hash_key ON public.device_approval_capabilities USING btree (token_hash);
CREATE INDEX IF NOT EXISTS idx_device_approval_capabilities_hash ON public.device_approval_capabilities USING btree (token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS uq_assignment_block_pair ON public.employee_assignment_blocks USING btree (assignment_id, block_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_employees_tenant_staff_no ON public.employees USING btree (tenant_id, staff_no);
CREATE UNIQUE INDEX IF NOT EXISTS fertilizer_daily_entries_entry_date_blok_code_pus_key ON public.fertilizer_daily_entries USING btree (entry_date, blok_code, pus);
CREATE INDEX IF NOT EXISTS idx_entries_blok ON public.fertilizer_daily_entries USING btree (blok_code);
CREATE INDEX IF NOT EXISTS idx_entries_date ON public.fertilizer_daily_entries USING btree (entry_date);
CREATE INDEX IF NOT EXISTS idx_fertilizer_daily_estate_id ON public.fertilizer_daily_entries USING btree (estate_id);
CREATE UNIQUE INDEX IF NOT EXISTS fertilizer_inventory_name_key ON public.fertilizer_inventory USING btree (name);
CREATE INDEX IF NOT EXISTS idx_fertilizer_inventory_estate_id ON public.fertilizer_inventory USING btree (estate_id);
CREATE INDEX IF NOT EXISTS idx_fertilizer_transactions_estate_id ON public.fertilizer_inventory_transactions USING btree (estate_id);
CREATE UNIQUE INDEX IF NOT EXISTS fertilizer_master_schedule_blok_code_key ON public.fertilizer_master_schedule USING btree (blok_code);
CREATE INDEX IF NOT EXISTS idx_fertilizer_master_estate_id ON public.fertilizer_master_schedule USING btree (estate_id);
CREATE UNIQUE INDEX IF NOT EXISTS hantaran_hasil_no_resit_key ON public.hantaran_hasil USING btree (no_resit);
CREATE INDEX IF NOT EXISTS idx_hantaran_blok ON public.hantaran_hasil USING btree (blok);
CREATE INDEX IF NOT EXISTS idx_hantaran_hasil_estate_id ON public.hantaran_hasil USING btree (estate_id);
CREATE INDEX IF NOT EXISTS idx_hantaran_tarikh ON public.hantaran_hasil USING btree (tarikh);
CREATE UNIQUE INDEX IF NOT EXISTS hantaran_pruning_blok_key ON public.hantaran_pruning USING btree (blok);
CREATE INDEX IF NOT EXISTS idx_hantaran_pruning_estate_id ON public.hantaran_pruning USING btree (estate_id);
CREATE UNIQUE INDEX IF NOT EXISTS hasil_abw_history_category_key ON public.hasil_abw_history USING btree (category);
CREATE INDEX IF NOT EXISTS idx_hasil_abw_history_estate_id ON public.hasil_abw_history USING btree (estate_id);
CREATE INDEX IF NOT EXISTS idx_backlog_history_estate ON public.hasil_backlog_history USING btree (estate_id);
CREATE INDEX IF NOT EXISTS idx_hasil_bbc_history_estate_id ON public.hasil_bbc_history USING btree (estate_id);
CREATE INDEX IF NOT EXISTS idx_hujan_rekod_estate ON public.hujan_rekod USING btree (estate_id, tahun, bulan);
CREATE INDEX IF NOT EXISTS idx_hujan_rekod_tahun ON public.hujan_rekod USING btree (tahun);
CREATE INDEX IF NOT EXISTS idx_kadar_upah_category ON public.kadar_upah_knowledge USING btree (category);
CREATE INDEX IF NOT EXISTS idx_kadar_upah_section ON public.kadar_upah_knowledge USING btree (section_title);
CREATE INDEX IF NOT EXISTS idx_manual_sawit_category ON public.manual_sawit_knowledge USING btree (category);
CREATE INDEX IF NOT EXISTS idx_merumput_inventory_estate_id ON public.merumput_inventory USING btree (estate_id);
CREATE UNIQUE INDEX IF NOT EXISTS merumput_inventory_name_key ON public.merumput_inventory USING btree (name);
CREATE INDEX IF NOT EXISTS idx_merumput_transactions_estate_id ON public.merumput_inventory_transactions USING btree (estate_id);
CREATE INDEX IF NOT EXISTS idx_merumput_progress_estate ON public.merumput_progress USING btree (estate_id, blok, pusingan);
CREATE UNIQUE INDEX IF NOT EXISTS merumput_progress_key ON public.merumput_progress USING btree (blok, pusingan, jenis);
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_blocks_estate_code ON public.org_blocks USING btree (estate_id, block_code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_positions_tenant_code ON public.org_positions USING btree (tenant_id, code);
CREATE INDEX IF NOT EXISTS idx_pdf_document ON public.pdf_documents USING btree (document_id);
CREATE INDEX IF NOT EXISTS idx_pdf_documents_document ON public.pdf_documents USING btree (document_id);
CREATE INDEX IF NOT EXISTS idx_pdf_documents_fts ON public.pdf_documents USING gin (fts);
CREATE INDEX IF NOT EXISTS idx_pdf_documents_metadata_gin ON public.pdf_documents USING gin (metadata);
CREATE INDEX IF NOT EXISTS idx_pdf_documents_project ON public.pdf_documents USING btree (project_id);
CREATE INDEX IF NOT EXISTS idx_pdf_page ON public.pdf_documents USING btree (page_number);
CREATE INDEX IF NOT EXISTS idx_pdf_project ON public.pdf_documents USING btree (project_id);
CREATE UNIQUE INDEX IF NOT EXISTS pdf_documents_document_id_chunk_index_key ON public.pdf_documents USING btree (document_id, chunk_index);
CREATE INDEX IF NOT EXISTS pdf_documents_embedding_hnsw_idx ON public.pdf_documents USING hnsw (embedding vector_cosine_ops) WITH (m='16', ef_construction='64');
CREATE INDEX IF NOT EXISTS pdf_documents_embedding_idx ON public.pdf_documents USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_penggredan_created_at ON public.penggredan_rekod USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_penggredan_rekod_estate ON public.penggredan_rekod USING btree (estate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_presentation_decks_estate_id ON public.presentation_decks USING btree (estate_id);
CREATE INDEX IF NOT EXISTS idx_rag_document_pages_document ON public.rag_document_pages USING btree (document_id);
CREATE UNIQUE INDEX IF NOT EXISTS rag_document_pages_document_id_page_number_key ON public.rag_document_pages USING btree (document_id, page_number);
CREATE INDEX IF NOT EXISTS idx_rag_documents_ingestion_status ON public.rag_documents USING btree (ingestion_status);
CREATE INDEX IF NOT EXISTS idx_rag_documents_project ON public.rag_documents USING btree (project_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_rag_documents_project_file_hash ON public.rag_documents USING btree (project_id, file_hash) WHERE (file_hash IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_registered_devices_estate_status ON public.registered_devices USING btree (estate_id, status);
CREATE INDEX IF NOT EXISTS idx_registered_devices_lookup ON public.registered_devices USING btree (device_id, estate_id);
CREATE INDEX IF NOT EXISTS idx_registered_devices_status ON public.registered_devices USING btree (status);
CREATE UNIQUE INDEX IF NOT EXISTS registered_devices_device_id_key ON public.registered_devices USING btree (device_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_registered_devices_credential_hash ON public.registered_devices USING btree (credential_hash) WHERE (credential_hash IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS tenants_code_key ON public.tenants USING btree (code);
CREATE INDEX IF NOT EXISTS idx_the_oil_palm_category ON public.the_oil_palm_knowledge USING btree (category);
CREATE INDEX IF NOT EXISTS idx_the_oil_palm_hnsw_embedding ON public.the_oil_palm_knowledge USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_the_oil_palm_metadata ON public.the_oil_palm_knowledge USING gin (metadata);
CREATE INDEX IF NOT EXISTS idx_the_oil_palm_page ON public.the_oil_palm_knowledge USING btree (page_number);
CREATE INDEX IF NOT EXISTS idx_the_oil_palm_tags ON public.the_oil_palm_knowledge USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_the_oil_palm_tsv ON public.the_oil_palm_knowledge USING gin (tsv);
CREATE INDEX IF NOT EXISTS idx_weed_scan_logs_estate_id ON public.weed_scan_logs USING btree (estate_id);
CREATE INDEX IF NOT EXISTS idx_work_assignments_estate_id ON public.work_assignments USING btree (estate_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_work_assignments_estate_worker_date ON public.work_assignments USING btree (estate_id, worker_id, date);
CREATE UNIQUE INDEX IF NOT EXISTS work_assignments_worker_id_date_work_type_key ON public.work_assignments USING btree (worker_id, date, work_type);
CREATE INDEX IF NOT EXISTS idx_workers_estate ON public.workers USING btree (estate_id, worker_no);
CREATE UNIQUE INDEX IF NOT EXISTS workers_worker_no_key ON public.workers USING btree (worker_no);

-- 5. CUSTOM FUNCTIONS
-- Function: auth_app_role
CREATE OR REPLACE FUNCTION public.auth_app_role()
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'app_role', ''),
    nullif(current_setting('request.jwt.claims', true)::jsonb->>'role', '')
  );
$function$
;

-- Function: auth_estate_id
CREATE OR REPLACE FUNCTION public.auth_estate_id()
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'estate_id', ''),
    nullif(current_setting('request.jwt.claims', true)::jsonb->>'estate_id', '')
  );
$function$
;

-- Function: auth_is_cross_estate_role
CREATE OR REPLACE FUNCTION public.auth_is_cross_estate_role()
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  SELECT public.auth_app_role() IN ('rc', 'oc', 'admin', 'super_admin');
$function$
;

-- Function: match_manual_sawit
CREATE OR REPLACE FUNCTION public.match_manual_sawit(query_embedding vector, match_threshold double precision, match_count integer, filter_category text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, manual_title text, category text, section_title text, content text, page_number integer, similarity double precision)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        m.id,
        m.manual_title,
        m.category,
        m.section_title,
        m.content,
        m.page_number,
        1 - (m.embedding <=> query_embedding) AS similarity
    FROM public.manual_sawit_knowledge m
    WHERE (filter_category IS NULL OR m.category ILIKE '%' || filter_category || '%')
      AND (1 - (m.embedding <=> query_embedding)) > match_threshold
    ORDER BY m.embedding <=> query_embedding
    LIMIT match_count;
END;
$function$
;

-- Function: match_pdf_documents
CREATE OR REPLACE FUNCTION public.match_pdf_documents(query_embedding vector DEFAULT NULL::vector, keyword_query text DEFAULT NULL::text, match_threshold double precision DEFAULT 0.20, match_count integer DEFAULT 8, vector_weight double precision DEFAULT 0.70, text_weight double precision DEFAULT 0.30, filter_project_id text DEFAULT NULL::text, filter_document_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, document_id uuid, project_id text, file_name text, page_number integer, page_end integer, section text, subsection text, topic text, chunk_index integer, content text, metadata jsonb, vector_score double precision, text_score double precision, hybrid_score double precision)
 LANGUAGE sql
 STABLE
AS $function$
  with scored_docs as (
    select
      d.id,
      d.document_id,
      d.project_id,
      d.file_name,
      d.page_number,
      d.page_end,
      d.section,
      d.subsection,
      d.topic,
      d.chunk_index,
      d.content,
      d.metadata,
      case 
        when query_embedding is not null and d.embedding is not null then
          greatest(0.0, (1.0 - (d.embedding <=> query_embedding)))
        else 0.0
      end as v_score,
      case 
        when keyword_query is not null and keyword_query <> '' then
          coalesce(ts_rank_cd(d.fts, plainto_tsquery('simple', keyword_query)), 0.0) +
          case when d.content ilike '%' || keyword_query || '%' then 0.5 else 0.0 end
        else 0.0
      end as t_score
    from pdf_documents d
    where 
      (filter_project_id is null or d.project_id = filter_project_id)
      and (filter_document_id is null or d.document_id = filter_document_id)
  )
  select
    id, document_id, project_id, file_name, page_number, page_end,
    section, subsection, topic, chunk_index, content, metadata,
    v_score as vector_score, t_score as text_score,
    case 
      when query_embedding is not null and (keyword_query is not null and keyword_query <> '') then
        ((v_score * vector_weight) + (t_score * text_weight))
      when query_embedding is not null then v_score
      else t_score
    end as hybrid_score
  from scored_docs
  where 
    (
      case 
        when query_embedding is not null and (keyword_query is not null and keyword_query <> '') then
          ((v_score * vector_weight) + (t_score * text_weight))
        when query_embedding is not null then v_score
        else t_score
      end
    ) >= match_threshold
    or t_score >= 0.10
  order by hybrid_score desc, page_number asc
  limit greatest(match_count, 1);
$function$
;

-- Function: match_pdf_documents
CREATE OR REPLACE FUNCTION public.match_pdf_documents(query_embedding vector, match_threshold double precision DEFAULT 0.30, match_count integer DEFAULT 8, filter_project_id text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, document_id uuid, file_name text, page_number integer, section text, topic text, content text, metadata jsonb, similarity double precision)
 LANGUAGE sql
 STABLE
AS $function$

  select
    d.id,
    d.document_id,
    d.file_name,
    d.page_number,
    d.section,
    d.topic,
    d.content,
    d.metadata,
    1 - (d.embedding <=> query_embedding) as similarity

  from pdf_documents d

  where
    d.embedding is not null
    and (filter_project_id is null or d.project_id = filter_project_id)
    and (1 - (d.embedding <=> query_embedding)) >= match_threshold

  order by
    similarity desc  -- Disusun daripada paling relevan (1.0) ke bawah

  limit match_count;

$function$
;

-- Function: match_the_oil_palm_knowledge
CREATE OR REPLACE FUNCTION public.match_the_oil_palm_knowledge(query_text text, query_embedding vector, match_count integer DEFAULT 10, filter_chapter text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, document_id text, manual_title text, category text, chapter text, section_title text, page_number integer, chunk_index integer, content text, metadata jsonb, vector_score double precision, keyword_score double precision, final_score double precision)
 LANGUAGE plpgsql
AS $function$
                                                                                            declare
                                                                                              v_query_ts tsquery;
                                                                                              begin
                                                                                                v_query_ts := plainto_tsquery('simple', query_text);

                                                                                                  return query
                                                                                                    with vector_matches as (
                                                                                                        select
                                                                                                              d.id,
                                                                                                                    1.0 - (d.embedding <=> query_embedding) as v_score
                                                                                                                        from public.the_oil_palm_knowledge d
                                                                                                                            where d.embedding is not null
                                                                                                                                  and (filter_chapter is null or d.chapter ilike '%' || filter_chapter || '%')
                                                                                                                                      order by d.embedding <=> query_embedding
                                                                                                                                          limit match_count * 2
                                                                                                                                            ),
                                                                                                                                              lexical_matches as (
                                                                                                                                                  select
                                                                                                                                                        d.id,
                                                                                                                                                              ts_rank_cd(d.tsv, v_query_ts) as k_score
                                                                                                                                                                  from public.the_oil_palm_knowledge d
                                                                                                                                                                      where d.tsv @@ v_query_ts
                                                                                                                                                                            and (filter_chapter is null or d.chapter ilike '%' || filter_chapter || '%')
                                                                                                                                                                                order by k_score desc
                                                                                                                                                                                    limit match_count * 2
                                                                                                                                                                                      )
                                                                                                                                                                                        select
                                                                                                                                                                                            d.id,
                                                                                                                                                                                                d.document_id,
                                                                                                                                                                                                    d.manual_title,
                                                                                                                                                                                                        d.category,
                                                                                                                                                                                                            d.chapter,
                                                                                                                                                                                                                d.section_title,
                                                                                                                                                                                                                    d.page_number,
                                                                                                                                                                                                                        d.chunk_index,
                                                                                                                                                                                                                            d.content,
                                                                                                                                                                                                                                d.metadata,
                                                                                                                                                                                                                                    coalesce(vm.v_score, 0.0)::float8 as vector_score,
                                                                                                                                                                                                                                        coalesce(lm.k_score, 0.0)::float8 as keyword_score,
                                                                                                                                                                                                                                            (0.7 * coalesce(vm.v_score, 0.0) + 0.3 * (1.0 / (1.0 + exp(-coalesce(lm.k_score, 0.0)))))::float8 as final_score
                                                                                                                                                                                                                                              from public.the_oil_palm_knowledge d
                                                                                                                                                                                                                                                left join vector_matches vm on d.id = vm.id
                                                                                                                                                                                                                                                  left join lexical_matches lm on d.id = lm.id
                                                                                                                                                                                                                                                    where vm.id is not null or lm.id is not null
                                                                                                                                                                                                                                                      order by final_score desc
                                                                                                                                                                                                                                                        limit match_count;
                                                                                                                                                                                                                                                        end;
                                                                                                                                                                                                                                                        $function$
;

-- Function: rls_auto_enable
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

-- Function: set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

-- Function: update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

-- 6. VIEWS
CREATE OR REPLACE VIEW public.annual_yield AS
 SELECT id,
    year,
    block,
    yield,
    created_at,
    COALESCE(estate_id, 'FPM_TUNGGAL'::text) AS estate_id
   FROM block_annual_yields;;

CREATE OR REPLACE VIEW public.bts_monthly_stats AS
 SELECT date_trunc('month'::text, (tarikh_urusniaga)::timestamp with time zone) AS bulan,
    kilang,
    count(*) AS jumlah_hantaran,
    sum(nett_tonne) AS jumlah_nett_tonne,
    sum(jumlah_nilai) AS nilai_keseluruhan,
    avg(pct_masak) AS purata_masak,
    sum(penalti_bts) AS jumlah_penalti
   FROM bts_submissions
  WHERE (status = 'completed'::text)
  GROUP BY (date_trunc('month'::text, (tarikh_urusniaga)::timestamp with time zone)), kilang
  ORDER BY (date_trunc('month'::text, (tarikh_urusniaga)::timestamp with time zone)) DESC;;

CREATE OR REPLACE VIEW public.data_pekerja AS
 SELECT id,
    worker_no,
    name,
    role,
    created_at,
    updated_at,
    is_active,
    negara_asal,
    kumpulan,
    COALESCE(estate_id, 'FPM_TUNGGAL'::text) AS estate_id
   FROM workers;;

CREATE OR REPLACE VIEW public.merumput_daily_entries AS
 SELECT id,
    blok,
    luas,
    pusingan,
    jenis,
    tarikh_mula,
    tarikh_siap,
    hek_siap,
    workers_count,
    created_at,
    updated_at,
    COALESCE(estate_id, 'FPM_TUNGGAL'::text) AS estate_id
   FROM merumput_progress;;

CREATE OR REPLACE VIEW public.rag_document_health AS
 WITH page_stats AS (
         SELECT d_1.id AS document_id,
            count(p_1.id) AS page_records,
            count(p_1.id) FILTER (WHERE (p_1.extracted = true)) AS extracted_page_records,
            count(p_1.id) FILTER (WHERE (p_1.validation_status = 'VALID'::text)) AS valid_pages,
            count(p_1.id) FILTER (WHERE (p_1.validation_status = 'EMPTY'::text)) AS empty_pages,
            count(p_1.id) FILTER (WHERE (p_1.validation_status = 'FAILED'::text)) AS failed_page_records
           FROM (rag_documents d_1
             LEFT JOIN rag_document_pages p_1 ON ((p_1.document_id = d_1.id)))
          GROUP BY d_1.id
        ), chunk_stats AS (
         SELECT d_1.id AS document_id,
            count(c_1.id) AS total_chunk_records,
            count(c_1.id) FILTER (WHERE ((c_1.embedding_status = 'COMPLETE'::text) AND (c_1.embedding IS NOT NULL))) AS embedded_chunk_records,
            count(c_1.id) FILTER (WHERE (c_1.embedding_status = 'FAILED'::text)) AS failed_chunk_records,
            count(c_1.id) FILTER (WHERE ((c_1.embedding_status <> 'COMPLETE'::text) OR (c_1.embedding IS NULL))) AS incomplete_chunk_records
           FROM (rag_documents d_1
             LEFT JOIN pdf_documents c_1 ON ((c_1.document_id = d_1.id)))
          GROUP BY d_1.id
        )
 SELECT d.id AS document_id,
    d.project_id,
    d.file_name,
    d.total_pages,
    COALESCE(p.page_records, (0)::bigint) AS page_records,
    COALESCE(p.extracted_page_records, (0)::bigint) AS extracted_pages,
    COALESCE(p.valid_pages, (0)::bigint) AS valid_pages,
    COALESCE(p.empty_pages, (0)::bigint) AS empty_pages,
    COALESCE(p.failed_page_records, (0)::bigint) AS failed_pages,
    COALESCE(c.total_chunk_records, (0)::bigint) AS total_chunks,
    COALESCE(c.embedded_chunk_records, (0)::bigint) AS embedded_chunks,
    COALESCE(c.failed_chunk_records, (0)::bigint) AS failed_chunks,
    COALESCE(c.incomplete_chunk_records, (0)::bigint) AS incomplete_chunks,
        CASE
            WHEN (COALESCE(c.total_chunk_records, (0)::bigint) > 0) THEN 'HEALTHY'::text
            ELSE 'INCOMPLETE'::text
        END AS health_status,
    d.extraction_status,
    d.ingestion_status,
    d.created_at,
    d.updated_at
   FROM ((rag_documents d
     LEFT JOIN page_stats p ON ((p.document_id = d.id)))
     LEFT JOIN chunk_stats c ON ((c.document_id = d.id)));;

CREATE OR REPLACE VIEW public.v_current_employee_assignments AS
 SELECT e.id AS employee_id,
    e.tenant_id,
    e.staff_no,
    e.full_name,
    e.employment_status,
    pos.code AS position_code,
    pos.title AS position_title,
    ea.id AS assignment_id,
    ea.company_id,
    c.name AS company_name,
    ea.estate_id,
    est.name AS estate_name,
    ea.division_id,
    div.name AS division_name,
    ea.assignment_role,
    ea.effective_from,
    COALESCE(jsonb_agg(jsonb_build_object('block_id', b.id, 'block_code', b.block_code, 'hectarage', b.hectarage)) FILTER (WHERE (b.id IS NOT NULL)), '[]'::jsonb) AS assigned_blocks
   FROM (((((((employees e
     JOIN org_positions pos ON ((e.position_id = pos.id)))
     LEFT JOIN employee_assignments ea ON (((e.id = ea.employee_id) AND ((ea.status)::text = 'ACTIVE'::text) AND ((ea.effective_to IS NULL) OR (ea.effective_to >= CURRENT_DATE)))))
     LEFT JOIN companies c ON ((ea.company_id = c.id)))
     LEFT JOIN org_estates est ON (((ea.estate_id)::text = (est.id)::text)))
     LEFT JOIN org_divisions div ON (((ea.division_id)::text = (div.id)::text)))
     LEFT JOIN employee_assignment_blocks eab ON ((ea.id = eab.assignment_id)))
     LEFT JOIN org_blocks b ON ((eab.block_id = b.id)))
  GROUP BY e.id, e.tenant_id, e.staff_no, e.full_name, e.employment_status, pos.code, pos.title, ea.id, ea.company_id, c.name, ea.estate_id, est.name, ea.division_id, div.name, ea.assignment_role, ea.effective_from;;

-- 7. ROW LEVEL SECURITY STATUS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records FORCE ROW LEVEL SECURITY;
ALTER TABLE public.block_annual_yields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.block_annual_yields FORCE ROW LEVEL SECURITY;
ALTER TABLE public.bts_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bts_submissions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_hujan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_hujan FORCE ROW LEVEL SECURITY;
ALTER TABLE public.device_approval_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_approval_capabilities FORCE ROW LEVEL SECURITY;
ALTER TABLE public.employee_assignment_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fertilizer_daily_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fertilizer_daily_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fertilizer_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fertilizer_inventory FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fertilizer_inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fertilizer_inventory_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fertilizer_master_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fertilizer_master_schedule FORCE ROW LEVEL SECURITY;
ALTER TABLE public.hantaran_hasil ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hantaran_hasil FORCE ROW LEVEL SECURITY;
ALTER TABLE public.hantaran_pruning ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hantaran_pruning FORCE ROW LEVEL SECURITY;
ALTER TABLE public.hasil_abw_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hasil_abw_history FORCE ROW LEVEL SECURITY;
ALTER TABLE public.hasil_backlog_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hasil_backlog_history FORCE ROW LEVEL SECURITY;
ALTER TABLE public.hasil_bbc_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hasil_bbc_history FORCE ROW LEVEL SECURITY;
ALTER TABLE public.hujan_rekod ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hujan_rekod FORCE ROW LEVEL SECURITY;
ALTER TABLE public.kadar_upah_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_sawit_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merumput_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merumput_inventory FORCE ROW LEVEL SECURITY;
ALTER TABLE public.merumput_inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merumput_inventory_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.merumput_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merumput_progress FORCE ROW LEVEL SECURITY;
ALTER TABLE public.notebook_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebook_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebook_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_estates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdf_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.penggredan_rekod ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.penggredan_rekod FORCE ROW LEVEL SECURITY;
ALTER TABLE public.presentation_decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presentation_decks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_document_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registered_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registered_devices FORCE ROW LEVEL SECURITY;
ALTER TABLE public.registered_devices_backup_before_dedup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.the_oil_palm_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weed_knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weed_scan_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weed_scan_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.work_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers FORCE ROW LEVEL SECURITY;

-- 8. RLS POLICIES
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'app_settings' AND policyname = 'Allow full app access on app_settings'
  ) THEN
    CREATE POLICY "Allow full app access on app_settings" ON public.app_settings
      FOR ALL TO {public}
      USING (true)
      WITH CHECK (true)
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'attendance_records' AND policyname = 'attendance_records_anon_insert'
  ) THEN
    CREATE POLICY "attendance_records_anon_insert" ON public.attendance_records
      FOR INSERT TO {anon}
      WITH CHECK (true)
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'attendance_records' AND policyname = 'attendance_records_anon_select'
  ) THEN
    CREATE POLICY "attendance_records_anon_select" ON public.attendance_records
      FOR SELECT TO {anon}
      USING (true)
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'attendance_records' AND policyname = 'attendance_records_anon_update'
  ) THEN
    CREATE POLICY "attendance_records_anon_update" ON public.attendance_records
      FOR UPDATE TO {anon}
      USING (true)
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'attendance_records' AND policyname = 'attendance_records_delete_policy'
  ) THEN
    CREATE POLICY "attendance_records_delete_policy" ON public.attendance_records
      FOR DELETE TO {authenticated}
      USING ((((estate_id)::text = auth_estate_id()) AND (auth_app_role() = ANY (ARRAY['pf'::text, 'fc'::text, 'admin'::text, 'super_admin'::text]))))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'attendance_records' AND policyname = 'attendance_records_insert_policy'
  ) THEN
    CREATE POLICY "attendance_records_insert_policy" ON public.attendance_records
      FOR INSERT TO {authenticated}
      WITH CHECK (((estate_id)::text = auth_estate_id()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'attendance_records' AND policyname = 'attendance_records_select_policy'
  ) THEN
    CREATE POLICY "attendance_records_select_policy" ON public.attendance_records
      FOR SELECT TO {authenticated}
      USING ((((estate_id)::text = auth_estate_id()) OR auth_is_cross_estate_role()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'attendance_records' AND policyname = 'attendance_records_update_policy'
  ) THEN
    CREATE POLICY "attendance_records_update_policy" ON public.attendance_records
      FOR UPDATE TO {authenticated}
      USING ((((estate_id)::text = auth_estate_id()) OR auth_is_cross_estate_role()))
      WITH CHECK (((estate_id)::text = auth_estate_id()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'block_annual_yields' AND policyname = 'block_annual_yields_select_policy'
  ) THEN
    CREATE POLICY "block_annual_yields_select_policy" ON public.block_annual_yields
      FOR SELECT TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR (auth_app_role() = ANY (ARRAY['rc'::text, 'oc'::text, 'admin'::text, 'super_admin'::text]))))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'block_annual_yields' AND policyname = 'block_annual_yields_write_policy'
  ) THEN
    CREATE POLICY "block_annual_yields_write_policy" ON public.block_annual_yields
      FOR ALL TO {authenticated}
      USING (((estate_id = auth_estate_id()) AND (auth_app_role() = ANY (ARRAY['pf'::text, 'fc'::text, 'admin'::text, 'super_admin'::text]))))
      WITH CHECK (((estate_id = auth_estate_id()) AND (auth_app_role() = ANY (ARRAY['pf'::text, 'fc'::text, 'admin'::text, 'super_admin'::text]))))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'bts_submissions' AND policyname = 'bts_submissions_delete_policy'
  ) THEN
    CREATE POLICY "bts_submissions_delete_policy" ON public.bts_submissions
      FOR DELETE TO {authenticated}
      USING (((estate_id = auth_estate_id()) AND (auth_app_role() = ANY (ARRAY['pf'::text, 'fc'::text, 'admin'::text, 'super_admin'::text]))))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'bts_submissions' AND policyname = 'bts_submissions_insert_policy'
  ) THEN
    CREATE POLICY "bts_submissions_insert_policy" ON public.bts_submissions
      FOR INSERT TO {authenticated}
      WITH CHECK ((estate_id = auth_estate_id()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'bts_submissions' AND policyname = 'bts_submissions_select_policy'
  ) THEN
    CREATE POLICY "bts_submissions_select_policy" ON public.bts_submissions
      FOR SELECT TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR auth_is_cross_estate_role()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'bts_submissions' AND policyname = 'bts_submissions_update_policy'
  ) THEN
    CREATE POLICY "bts_submissions_update_policy" ON public.bts_submissions
      FOR UPDATE TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR auth_is_cross_estate_role()))
      WITH CHECK ((estate_id = auth_estate_id()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'data_hujan' AND policyname = 'data_hujan_delete_policy'
  ) THEN
    CREATE POLICY "data_hujan_delete_policy" ON public.data_hujan
      FOR DELETE TO {authenticated}
      USING (((estate_id = auth_estate_id()) AND (auth_app_role() = ANY (ARRAY['pf'::text, 'fc'::text, 'admin'::text, 'super_admin'::text]))))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'data_hujan' AND policyname = 'data_hujan_insert_policy'
  ) THEN
    CREATE POLICY "data_hujan_insert_policy" ON public.data_hujan
      FOR INSERT TO {authenticated}
      WITH CHECK ((estate_id = auth_estate_id()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'data_hujan' AND policyname = 'data_hujan_select_policy'
  ) THEN
    CREATE POLICY "data_hujan_select_policy" ON public.data_hujan
      FOR SELECT TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR auth_is_cross_estate_role()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'data_hujan' AND policyname = 'data_hujan_update_policy'
  ) THEN
    CREATE POLICY "data_hujan_update_policy" ON public.data_hujan
      FOR UPDATE TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR auth_is_cross_estate_role()))
      WITH CHECK ((estate_id = auth_estate_id()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'device_approval_capabilities' AND policyname = 'device_approval_capabilities_service_role_policy'
  ) THEN
    CREATE POLICY "device_approval_capabilities_service_role_policy" ON public.device_approval_capabilities
      FOR ALL TO {service_role}
      USING (true)
      WITH CHECK (true)
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'fertilizer_daily_entries' AND policyname = 'fertilizer_daily_entries_delete_policy'
  ) THEN
    CREATE POLICY "fertilizer_daily_entries_delete_policy" ON public.fertilizer_daily_entries
      FOR DELETE TO {authenticated}
      USING (((estate_id = auth_estate_id()) AND (auth_app_role() = ANY (ARRAY['pf'::text, 'fc'::text, 'admin'::text, 'super_admin'::text]))))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'fertilizer_daily_entries' AND policyname = 'fertilizer_daily_entries_insert_policy'
  ) THEN
    CREATE POLICY "fertilizer_daily_entries_insert_policy" ON public.fertilizer_daily_entries
      FOR INSERT TO {authenticated}
      WITH CHECK ((estate_id = auth_estate_id()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'fertilizer_daily_entries' AND policyname = 'fertilizer_daily_entries_select_policy'
  ) THEN
    CREATE POLICY "fertilizer_daily_entries_select_policy" ON public.fertilizer_daily_entries
      FOR SELECT TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR auth_is_cross_estate_role()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'fertilizer_daily_entries' AND policyname = 'fertilizer_daily_entries_update_policy'
  ) THEN
    CREATE POLICY "fertilizer_daily_entries_update_policy" ON public.fertilizer_daily_entries
      FOR UPDATE TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR auth_is_cross_estate_role()))
      WITH CHECK ((estate_id = auth_estate_id()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'fertilizer_inventory' AND policyname = 'fertilizer_inventory_delete_policy'
  ) THEN
    CREATE POLICY "fertilizer_inventory_delete_policy" ON public.fertilizer_inventory
      FOR DELETE TO {authenticated}
      USING (((estate_id = auth_estate_id()) AND (auth_app_role() = ANY (ARRAY['pf'::text, 'fc'::text, 'admin'::text, 'super_admin'::text]))))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'fertilizer_inventory' AND policyname = 'fertilizer_inventory_insert_policy'
  ) THEN
    CREATE POLICY "fertilizer_inventory_insert_policy" ON public.fertilizer_inventory
      FOR INSERT TO {authenticated}
      WITH CHECK ((estate_id = auth_estate_id()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'fertilizer_inventory' AND policyname = 'fertilizer_inventory_select_policy'
  ) THEN
    CREATE POLICY "fertilizer_inventory_select_policy" ON public.fertilizer_inventory
      FOR SELECT TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR auth_is_cross_estate_role()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'fertilizer_inventory' AND policyname = 'fertilizer_inventory_update_policy'
  ) THEN
    CREATE POLICY "fertilizer_inventory_update_policy" ON public.fertilizer_inventory
      FOR UPDATE TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR auth_is_cross_estate_role()))
      WITH CHECK ((estate_id = auth_estate_id()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'fertilizer_inventory_transactions' AND policyname = 'fertilizer_inventory_transactions_delete_policy'
  ) THEN
    CREATE POLICY "fertilizer_inventory_transactions_delete_policy" ON public.fertilizer_inventory_transactions
      FOR DELETE TO {authenticated}
      USING (((estate_id = auth_estate_id()) AND (auth_app_role() = ANY (ARRAY['pf'::text, 'fc'::text, 'admin'::text, 'super_admin'::text]))))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'fertilizer_inventory_transactions' AND policyname = 'fertilizer_inventory_transactions_insert_policy'
  ) THEN
    CREATE POLICY "fertilizer_inventory_transactions_insert_policy" ON public.fertilizer_inventory_transactions
      FOR INSERT TO {authenticated}
      WITH CHECK ((estate_id = auth_estate_id()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'fertilizer_inventory_transactions' AND policyname = 'fertilizer_inventory_transactions_select_policy'
  ) THEN
    CREATE POLICY "fertilizer_inventory_transactions_select_policy" ON public.fertilizer_inventory_transactions
      FOR SELECT TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR auth_is_cross_estate_role()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'fertilizer_inventory_transactions' AND policyname = 'fertilizer_inventory_transactions_update_policy'
  ) THEN
    CREATE POLICY "fertilizer_inventory_transactions_update_policy" ON public.fertilizer_inventory_transactions
      FOR UPDATE TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR auth_is_cross_estate_role()))
      WITH CHECK ((estate_id = auth_estate_id()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'fertilizer_master_schedule' AND policyname = 'fertilizer_master_schedule_delete_policy'
  ) THEN
    CREATE POLICY "fertilizer_master_schedule_delete_policy" ON public.fertilizer_master_schedule
      FOR DELETE TO {authenticated}
      USING (((estate_id = auth_estate_id()) AND (auth_app_role() = ANY (ARRAY['pf'::text, 'fc'::text, 'admin'::text, 'super_admin'::text]))))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'fertilizer_master_schedule' AND policyname = 'fertilizer_master_schedule_insert_policy'
  ) THEN
    CREATE POLICY "fertilizer_master_schedule_insert_policy" ON public.fertilizer_master_schedule
      FOR INSERT TO {authenticated}
      WITH CHECK ((estate_id = auth_estate_id()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'fertilizer_master_schedule' AND policyname = 'fertilizer_master_schedule_select_policy'
  ) THEN
    CREATE POLICY "fertilizer_master_schedule_select_policy" ON public.fertilizer_master_schedule
      FOR SELECT TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR auth_is_cross_estate_role()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'fertilizer_master_schedule' AND policyname = 'fertilizer_master_schedule_update_policy'
  ) THEN
    CREATE POLICY "fertilizer_master_schedule_update_policy" ON public.fertilizer_master_schedule
      FOR UPDATE TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR auth_is_cross_estate_role()))
      WITH CHECK ((estate_id = auth_estate_id()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'hantaran_hasil' AND policyname = 'hantaran_hasil_delete_policy'
  ) THEN
    CREATE POLICY "hantaran_hasil_delete_policy" ON public.hantaran_hasil
      FOR DELETE TO {authenticated}
      USING (((estate_id = auth_estate_id()) AND (auth_app_role() = ANY (ARRAY['pf'::text, 'fc'::text, 'admin'::text, 'super_admin'::text]))))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'hantaran_hasil' AND policyname = 'hantaran_hasil_insert_policy'
  ) THEN
    CREATE POLICY "hantaran_hasil_insert_policy" ON public.hantaran_hasil
      FOR INSERT TO {authenticated}
      WITH CHECK ((estate_id = auth_estate_id()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'hantaran_hasil' AND policyname = 'hantaran_hasil_select_policy'
  ) THEN
    CREATE POLICY "hantaran_hasil_select_policy" ON public.hantaran_hasil
      FOR SELECT TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR auth_is_cross_estate_role()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'hantaran_hasil' AND policyname = 'hantaran_hasil_update_policy'
  ) THEN
    CREATE POLICY "hantaran_hasil_update_policy" ON public.hantaran_hasil
      FOR UPDATE TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR auth_is_cross_estate_role()))
      WITH CHECK ((estate_id = auth_estate_id()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'hantaran_pruning' AND policyname = 'hantaran_pruning_delete_policy'
  ) THEN
    CREATE POLICY "hantaran_pruning_delete_policy" ON public.hantaran_pruning
      FOR DELETE TO {authenticated}
      USING (((estate_id = auth_estate_id()) AND (auth_app_role() = ANY (ARRAY['pf'::text, 'fc'::text, 'admin'::text, 'super_admin'::text]))))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'hantaran_pruning' AND policyname = 'hantaran_pruning_insert_policy'
  ) THEN
    CREATE POLICY "hantaran_pruning_insert_policy" ON public.hantaran_pruning
      FOR INSERT TO {authenticated}
      WITH CHECK ((estate_id = auth_estate_id()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'hantaran_pruning' AND policyname = 'hantaran_pruning_select_policy'
  ) THEN
    CREATE POLICY "hantaran_pruning_select_policy" ON public.hantaran_pruning
      FOR SELECT TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR auth_is_cross_estate_role()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'hantaran_pruning' AND policyname = 'hantaran_pruning_update_policy'
  ) THEN
    CREATE POLICY "hantaran_pruning_update_policy" ON public.hantaran_pruning
      FOR UPDATE TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR auth_is_cross_estate_role()))
      WITH CHECK ((estate_id = auth_estate_id()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'hasil_abw_history' AND policyname = 'hasil_abw_history_delete_policy'
  ) THEN
    CREATE POLICY "hasil_abw_history_delete_policy" ON public.hasil_abw_history
      FOR DELETE TO {authenticated}
      USING (((estate_id = auth_estate_id()) AND (auth_app_role() = ANY (ARRAY['pf'::text, 'fc'::text, 'admin'::text, 'super_admin'::text]))))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'hasil_abw_history' AND policyname = 'hasil_abw_history_insert_policy'
  ) THEN
    CREATE POLICY "hasil_abw_history_insert_policy" ON public.hasil_abw_history
      FOR INSERT TO {authenticated}
      WITH CHECK ((estate_id = auth_estate_id()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'hasil_abw_history' AND policyname = 'hasil_abw_history_select_policy'
  ) THEN
    CREATE POLICY "hasil_abw_history_select_policy" ON public.hasil_abw_history
      FOR SELECT TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR auth_is_cross_estate_role()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'hasil_abw_history' AND policyname = 'hasil_abw_history_update_policy'
  ) THEN
    CREATE POLICY "hasil_abw_history_update_policy" ON public.hasil_abw_history
      FOR UPDATE TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR auth_is_cross_estate_role()))
      WITH CHECK ((estate_id = auth_estate_id()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'hasil_backlog_history' AND policyname = 'hasil_backlog_history_delete_policy'
  ) THEN
    CREATE POLICY "hasil_backlog_history_delete_policy" ON public.hasil_backlog_history
      FOR DELETE TO {authenticated}
      USING (((estate_id = auth_estate_id()) AND (auth_app_role() = ANY (ARRAY['pf'::text, 'fc'::text, 'admin'::text, 'super_admin'::text]))))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'hasil_backlog_history' AND policyname = 'hasil_backlog_history_insert_policy'
  ) THEN
    CREATE POLICY "hasil_backlog_history_insert_policy" ON public.hasil_backlog_history
      FOR INSERT TO {authenticated}
      WITH CHECK ((estate_id = auth_estate_id()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'hasil_backlog_history' AND policyname = 'hasil_backlog_history_select_policy'
  ) THEN
    CREATE POLICY "hasil_backlog_history_select_policy" ON public.hasil_backlog_history
      FOR SELECT TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR auth_is_cross_estate_role()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'hasil_backlog_history' AND policyname = 'hasil_backlog_history_update_policy'
  ) THEN
    CREATE POLICY "hasil_backlog_history_update_policy" ON public.hasil_backlog_history
      FOR UPDATE TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR auth_is_cross_estate_role()))
      WITH CHECK ((estate_id = auth_estate_id()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'hasil_bbc_history' AND policyname = 'hasil_bbc_history_delete_policy'
  ) THEN
    CREATE POLICY "hasil_bbc_history_delete_policy" ON public.hasil_bbc_history
      FOR DELETE TO {authenticated}
      USING (((estate_id = auth_estate_id()) AND (auth_app_role() = ANY (ARRAY['pf'::text, 'fc'::text, 'admin'::text, 'super_admin'::text]))))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'hasil_bbc_history' AND policyname = 'hasil_bbc_history_insert_policy'
  ) THEN
    CREATE POLICY "hasil_bbc_history_insert_policy" ON public.hasil_bbc_history
      FOR INSERT TO {authenticated}
      WITH CHECK ((estate_id = auth_estate_id()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'hasil_bbc_history' AND policyname = 'hasil_bbc_history_select_policy'
  ) THEN
    CREATE POLICY "hasil_bbc_history_select_policy" ON public.hasil_bbc_history
      FOR SELECT TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR auth_is_cross_estate_role()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'hasil_bbc_history' AND policyname = 'hasil_bbc_history_update_policy'
  ) THEN
    CREATE POLICY "hasil_bbc_history_update_policy" ON public.hasil_bbc_history
      FOR UPDATE TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR auth_is_cross_estate_role()))
      WITH CHECK ((estate_id = auth_estate_id()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'hujan_rekod' AND policyname = 'hujan_rekod_delete_policy'
  ) THEN
    CREATE POLICY "hujan_rekod_delete_policy" ON public.hujan_rekod
      FOR DELETE TO {authenticated}
      USING (((estate_id = auth_estate_id()) AND (auth_app_role() = ANY (ARRAY['pf'::text, 'fc'::text, 'admin'::text, 'super_admin'::text]))))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'hujan_rekod' AND policyname = 'hujan_rekod_insert_policy'
  ) THEN
    CREATE POLICY "hujan_rekod_insert_policy" ON public.hujan_rekod
      FOR INSERT TO {authenticated}
      WITH CHECK (((estate_id = auth_estate_id()) AND (auth_app_role() = ANY (ARRAY['staff'::text, 'mandur'::text, 'pf'::text, 'fc'::text, 'afc'::text, 'fs'::text, 'admin'::text, 'super_admin'::text]))))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'hujan_rekod' AND policyname = 'hujan_rekod_select_policy'
  ) THEN
    CREATE POLICY "hujan_rekod_select_policy" ON public.hujan_rekod
      FOR SELECT TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR (auth_app_role() = ANY (ARRAY['rc'::text, 'oc'::text, 'admin'::text, 'super_admin'::text]))))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'hujan_rekod' AND policyname = 'hujan_rekod_update_policy'
  ) THEN
    CREATE POLICY "hujan_rekod_update_policy" ON public.hujan_rekod
      FOR UPDATE TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR (auth_app_role() = ANY (ARRAY['rc'::text, 'oc'::text, 'admin'::text, 'super_admin'::text]))))
      WITH CHECK (((estate_id = auth_estate_id()) AND (auth_app_role() = ANY (ARRAY['staff'::text, 'mandur'::text, 'pf'::text, 'fc'::text, 'afc'::text, 'fs'::text, 'admin'::text, 'super_admin'::text]))))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'kadar_upah_knowledge' AND policyname = 'Public delete access for kadar_upah_knowledge'
  ) THEN
    CREATE POLICY "Public delete access for kadar_upah_knowledge" ON public.kadar_upah_knowledge
      FOR DELETE TO {public}
      USING (true)
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'kadar_upah_knowledge' AND policyname = 'Public insert access for kadar_upah_knowledge'
  ) THEN
    CREATE POLICY "Public insert access for kadar_upah_knowledge" ON public.kadar_upah_knowledge
      FOR INSERT TO {public}
      WITH CHECK (true)
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'kadar_upah_knowledge' AND policyname = 'Public read access for kadar_upah_knowledge'
  ) THEN
    CREATE POLICY "Public read access for kadar_upah_knowledge" ON public.kadar_upah_knowledge
      FOR SELECT TO {public}
      USING (true)
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'kadar_upah_knowledge' AND policyname = 'Public update access for kadar_upah_knowledge'
  ) THEN
    CREATE POLICY "Public update access for kadar_upah_knowledge" ON public.kadar_upah_knowledge
      FOR UPDATE TO {public}
      USING (true)
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'manual_sawit_knowledge' AND policyname = 'Allow full app access on manual_sawit_knowledge'
  ) THEN
    CREATE POLICY "Allow full app access on manual_sawit_knowledge" ON public.manual_sawit_knowledge
      FOR ALL TO {public}
      USING (true)
      WITH CHECK (true)
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'merumput_inventory' AND policyname = 'merumput_inventory_delete_policy'
  ) THEN
    CREATE POLICY "merumput_inventory_delete_policy" ON public.merumput_inventory
      FOR DELETE TO {authenticated}
      USING (((estate_id = auth_estate_id()) AND (auth_app_role() = ANY (ARRAY['pf'::text, 'fc'::text, 'admin'::text, 'super_admin'::text]))))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'merumput_inventory' AND policyname = 'merumput_inventory_insert_policy'
  ) THEN
    CREATE POLICY "merumput_inventory_insert_policy" ON public.merumput_inventory
      FOR INSERT TO {authenticated}
      WITH CHECK ((estate_id = auth_estate_id()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'merumput_inventory' AND policyname = 'merumput_inventory_select_policy'
  ) THEN
    CREATE POLICY "merumput_inventory_select_policy" ON public.merumput_inventory
      FOR SELECT TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR auth_is_cross_estate_role()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'merumput_inventory' AND policyname = 'merumput_inventory_update_policy'
  ) THEN
    CREATE POLICY "merumput_inventory_update_policy" ON public.merumput_inventory
      FOR UPDATE TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR auth_is_cross_estate_role()))
      WITH CHECK ((estate_id = auth_estate_id()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'merumput_inventory_transactions' AND policyname = 'merumput_inventory_transactions_delete_policy'
  ) THEN
    CREATE POLICY "merumput_inventory_transactions_delete_policy" ON public.merumput_inventory_transactions
      FOR DELETE TO {authenticated}
      USING (((estate_id = auth_estate_id()) AND (auth_app_role() = ANY (ARRAY['pf'::text, 'fc'::text, 'admin'::text, 'super_admin'::text]))))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'merumput_inventory_transactions' AND policyname = 'merumput_inventory_transactions_insert_policy'
  ) THEN
    CREATE POLICY "merumput_inventory_transactions_insert_policy" ON public.merumput_inventory_transactions
      FOR INSERT TO {authenticated}
      WITH CHECK ((estate_id = auth_estate_id()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'merumput_inventory_transactions' AND policyname = 'merumput_inventory_transactions_select_policy'
  ) THEN
    CREATE POLICY "merumput_inventory_transactions_select_policy" ON public.merumput_inventory_transactions
      FOR SELECT TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR auth_is_cross_estate_role()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'merumput_inventory_transactions' AND policyname = 'merumput_inventory_transactions_update_policy'
  ) THEN
    CREATE POLICY "merumput_inventory_transactions_update_policy" ON public.merumput_inventory_transactions
      FOR UPDATE TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR auth_is_cross_estate_role()))
      WITH CHECK ((estate_id = auth_estate_id()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'merumput_progress' AND policyname = 'merumput_progress_delete_policy'
  ) THEN
    CREATE POLICY "merumput_progress_delete_policy" ON public.merumput_progress
      FOR DELETE TO {authenticated}
      USING (((estate_id = auth_estate_id()) AND (auth_app_role() = ANY (ARRAY['pf'::text, 'fc'::text, 'admin'::text, 'super_admin'::text]))))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'merumput_progress' AND policyname = 'merumput_progress_insert_policy'
  ) THEN
    CREATE POLICY "merumput_progress_insert_policy" ON public.merumput_progress
      FOR INSERT TO {authenticated}
      WITH CHECK (((estate_id = auth_estate_id()) AND (auth_app_role() = ANY (ARRAY['staff'::text, 'mandur'::text, 'pf'::text, 'fc'::text, 'afc'::text, 'fs'::text, 'admin'::text, 'super_admin'::text]))))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'merumput_progress' AND policyname = 'merumput_progress_select_policy'
  ) THEN
    CREATE POLICY "merumput_progress_select_policy" ON public.merumput_progress
      FOR SELECT TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR (auth_app_role() = ANY (ARRAY['rc'::text, 'oc'::text, 'admin'::text, 'super_admin'::text]))))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'merumput_progress' AND policyname = 'merumput_progress_update_policy'
  ) THEN
    CREATE POLICY "merumput_progress_update_policy" ON public.merumput_progress
      FOR UPDATE TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR (auth_app_role() = ANY (ARRAY['rc'::text, 'oc'::text, 'admin'::text, 'super_admin'::text]))))
      WITH CHECK (((estate_id = auth_estate_id()) AND (auth_app_role() = ANY (ARRAY['staff'::text, 'mandur'::text, 'pf'::text, 'fc'::text, 'afc'::text, 'fs'::text, 'admin'::text, 'super_admin'::text]))))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'notebook_chats' AND policyname = 'Allow full app access on notebook_chats'
  ) THEN
    CREATE POLICY "Allow full app access on notebook_chats" ON public.notebook_chats
      FOR ALL TO {public}
      USING (true)
      WITH CHECK (true)
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'notebook_chats' AND policyname = 'Users can CRUD own notebook chats'
  ) THEN
    CREATE POLICY "Users can CRUD own notebook chats" ON public.notebook_chats
      FOR ALL TO {public}
      USING ((auth.uid() = user_id))
      WITH CHECK ((auth.uid() = user_id))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'notebook_messages' AND policyname = 'Allow full app access on notebook_messages'
  ) THEN
    CREATE POLICY "Allow full app access on notebook_messages" ON public.notebook_messages
      FOR ALL TO {public}
      USING (true)
      WITH CHECK (true)
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'notebook_messages' AND policyname = 'Users can CRUD own notebook messages'
  ) THEN
    CREATE POLICY "Users can CRUD own notebook messages" ON public.notebook_messages
      FOR ALL TO {public}
      USING ((auth.uid() = user_id))
      WITH CHECK ((auth.uid() = user_id))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'notebook_resources' AND policyname = 'Allow full app access on notebook_resources'
  ) THEN
    CREATE POLICY "Allow full app access on notebook_resources" ON public.notebook_resources
      FOR ALL TO {public}
      USING (true)
      WITH CHECK (true)
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'notebook_resources' AND policyname = 'Users can CRUD own notebook resources'
  ) THEN
    CREATE POLICY "Users can CRUD own notebook resources" ON public.notebook_resources
      FOR ALL TO {public}
      USING ((auth.uid() = user_id))
      WITH CHECK ((auth.uid() = user_id))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'pdf_documents' AND policyname = 'Allow authenticated and anon to read chunks'
  ) THEN
    CREATE POLICY "Allow authenticated and anon to read chunks" ON public.pdf_documents
      FOR SELECT TO {anon,authenticated}
      USING (true)
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'pdf_documents' AND policyname = 'Allow delete access to pdf_documents'
  ) THEN
    CREATE POLICY "Allow delete access to pdf_documents" ON public.pdf_documents
      FOR DELETE TO {public}
      USING (true)
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'pdf_documents' AND policyname = 'Allow insert access to pdf_documents'
  ) THEN
    CREATE POLICY "Allow insert access to pdf_documents" ON public.pdf_documents
      FOR INSERT TO {public}
      WITH CHECK (true)
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'pdf_documents' AND policyname = 'Allow only authenticated users to modify chunks'
  ) THEN
    CREATE POLICY "Allow only authenticated users to modify chunks" ON public.pdf_documents
      FOR ALL TO {authenticated}
      USING (true)
      WITH CHECK (true)
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'pdf_documents' AND policyname = 'Allow read access to pdf_documents'
  ) THEN
    CREATE POLICY "Allow read access to pdf_documents" ON public.pdf_documents
      FOR SELECT TO {public}
      USING (true)
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'penggredan_rekod' AND policyname = 'penggredan_rekod_delete_policy'
  ) THEN
    CREATE POLICY "penggredan_rekod_delete_policy" ON public.penggredan_rekod
      FOR DELETE TO {authenticated}
      USING (((estate_id = auth_estate_id()) AND (auth_app_role() = ANY (ARRAY['pf'::text, 'fc'::text, 'admin'::text, 'super_admin'::text]))))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'penggredan_rekod' AND policyname = 'penggredan_rekod_insert_policy'
  ) THEN
    CREATE POLICY "penggredan_rekod_insert_policy" ON public.penggredan_rekod
      FOR INSERT TO {authenticated}
      WITH CHECK (((estate_id = auth_estate_id()) AND (auth_app_role() = ANY (ARRAY['staff'::text, 'mandur'::text, 'pf'::text, 'fc'::text, 'afc'::text, 'fs'::text, 'admin'::text, 'super_admin'::text]))))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'penggredan_rekod' AND policyname = 'penggredan_rekod_select_policy'
  ) THEN
    CREATE POLICY "penggredan_rekod_select_policy" ON public.penggredan_rekod
      FOR SELECT TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR (auth_app_role() = ANY (ARRAY['rc'::text, 'oc'::text, 'admin'::text, 'super_admin'::text]))))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'penggredan_rekod' AND policyname = 'penggredan_rekod_update_policy'
  ) THEN
    CREATE POLICY "penggredan_rekod_update_policy" ON public.penggredan_rekod
      FOR UPDATE TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR (auth_app_role() = ANY (ARRAY['rc'::text, 'oc'::text, 'admin'::text, 'super_admin'::text]))))
      WITH CHECK (((estate_id = auth_estate_id()) AND (auth_app_role() = ANY (ARRAY['staff'::text, 'mandur'::text, 'pf'::text, 'fc'::text, 'afc'::text, 'fs'::text, 'admin'::text, 'super_admin'::text]))))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'presentation_decks' AND policyname = 'presentation_decks_delete_policy'
  ) THEN
    CREATE POLICY "presentation_decks_delete_policy" ON public.presentation_decks
      FOR DELETE TO {authenticated}
      USING (((estate_id = auth_estate_id()) AND (auth_app_role() = ANY (ARRAY['pf'::text, 'fc'::text, 'admin'::text, 'super_admin'::text]))))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'presentation_decks' AND policyname = 'presentation_decks_insert_policy'
  ) THEN
    CREATE POLICY "presentation_decks_insert_policy" ON public.presentation_decks
      FOR INSERT TO {authenticated}
      WITH CHECK ((estate_id = auth_estate_id()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'presentation_decks' AND policyname = 'presentation_decks_select_policy'
  ) THEN
    CREATE POLICY "presentation_decks_select_policy" ON public.presentation_decks
      FOR SELECT TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR auth_is_cross_estate_role()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'presentation_decks' AND policyname = 'presentation_decks_update_policy'
  ) THEN
    CREATE POLICY "presentation_decks_update_policy" ON public.presentation_decks
      FOR UPDATE TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR auth_is_cross_estate_role()))
      WITH CHECK ((estate_id = auth_estate_id()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = 'Allow full app access on projects'
  ) THEN
    CREATE POLICY "Allow full app access on projects" ON public.projects
      FOR ALL TO {public}
      USING (true)
      WITH CHECK (true)
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = 'Users can delete their own projects'
  ) THEN
    CREATE POLICY "Users can delete their own projects" ON public.projects
      FOR DELETE TO {public}
      USING ((auth.uid() = user_id))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = 'Users can insert their own projects'
  ) THEN
    CREATE POLICY "Users can insert their own projects" ON public.projects
      FOR INSERT TO {public}
      WITH CHECK ((auth.uid() = user_id))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = 'Users can update their own projects'
  ) THEN
    CREATE POLICY "Users can update their own projects" ON public.projects
      FOR UPDATE TO {public}
      USING ((auth.uid() = user_id))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = 'Users can view their own projects'
  ) THEN
    CREATE POLICY "Users can view their own projects" ON public.projects
      FOR SELECT TO {public}
      USING ((auth.uid() = user_id))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'rag_document_pages' AND policyname = 'Allow authenticated and anon to read pages'
  ) THEN
    CREATE POLICY "Allow authenticated and anon to read pages" ON public.rag_document_pages
      FOR SELECT TO {anon,authenticated}
      USING (true)
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'rag_document_pages' AND policyname = 'Allow only authenticated users to modify pages'
  ) THEN
    CREATE POLICY "Allow only authenticated users to modify pages" ON public.rag_document_pages
      FOR ALL TO {authenticated}
      USING (true)
      WITH CHECK (true)
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'rag_documents' AND policyname = 'Allow authenticated and anon to read documents'
  ) THEN
    CREATE POLICY "Allow authenticated and anon to read documents" ON public.rag_documents
      FOR SELECT TO {anon,authenticated}
      USING (true)
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'rag_documents' AND policyname = 'Allow only authenticated users to modify documents'
  ) THEN
    CREATE POLICY "Allow only authenticated users to modify documents" ON public.rag_documents
      FOR ALL TO {authenticated}
      USING (true)
      WITH CHECK (true)
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'registered_devices' AND policyname = 'registered_devices_service_role_policy'
  ) THEN
    CREATE POLICY "registered_devices_service_role_policy" ON public.registered_devices
      FOR ALL TO {service_role}
      USING (true)
      WITH CHECK (true)
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'the_oil_palm_knowledge' AND policyname = 'Allow delete the_oil_palm_knowledge'
  ) THEN
    CREATE POLICY "Allow delete the_oil_palm_knowledge" ON public.the_oil_palm_knowledge
      FOR DELETE TO {public}
      USING (true)
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'the_oil_palm_knowledge' AND policyname = 'Allow insert the_oil_palm_knowledge'
  ) THEN
    CREATE POLICY "Allow insert the_oil_palm_knowledge" ON public.the_oil_palm_knowledge
      FOR INSERT TO {public}
      WITH CHECK (true)
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'the_oil_palm_knowledge' AND policyname = 'Allow read the_oil_palm_knowledge'
  ) THEN
    CREATE POLICY "Allow read the_oil_palm_knowledge" ON public.the_oil_palm_knowledge
      FOR SELECT TO {public}
      USING (true)
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'the_oil_palm_knowledge' AND policyname = 'Allow update the_oil_palm_knowledge'
  ) THEN
    CREATE POLICY "Allow update the_oil_palm_knowledge" ON public.the_oil_palm_knowledge
      FOR UPDATE TO {public}
      USING (true)
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'weed_scan_logs' AND policyname = 'weed_scan_logs_delete_policy'
  ) THEN
    CREATE POLICY "weed_scan_logs_delete_policy" ON public.weed_scan_logs
      FOR DELETE TO {authenticated}
      USING (((estate_id = auth_estate_id()) AND (auth_app_role() = ANY (ARRAY['pf'::text, 'fc'::text, 'admin'::text, 'super_admin'::text]))))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'weed_scan_logs' AND policyname = 'weed_scan_logs_insert_policy'
  ) THEN
    CREATE POLICY "weed_scan_logs_insert_policy" ON public.weed_scan_logs
      FOR INSERT TO {authenticated}
      WITH CHECK ((estate_id = auth_estate_id()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'weed_scan_logs' AND policyname = 'weed_scan_logs_select_policy'
  ) THEN
    CREATE POLICY "weed_scan_logs_select_policy" ON public.weed_scan_logs
      FOR SELECT TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR auth_is_cross_estate_role()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'weed_scan_logs' AND policyname = 'weed_scan_logs_update_policy'
  ) THEN
    CREATE POLICY "weed_scan_logs_update_policy" ON public.weed_scan_logs
      FOR UPDATE TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR auth_is_cross_estate_role()))
      WITH CHECK ((estate_id = auth_estate_id()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'work_assignments' AND policyname = 'work_assignments_anon_all'
  ) THEN
    CREATE POLICY "work_assignments_anon_all" ON public.work_assignments
      FOR ALL TO {anon}
      USING (true)
      WITH CHECK (true)
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'work_assignments' AND policyname = 'work_assignments_anon_select'
  ) THEN
    CREATE POLICY "work_assignments_anon_select" ON public.work_assignments
      FOR SELECT TO {anon}
      USING (true)
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'work_assignments' AND policyname = 'work_assignments_delete_policy'
  ) THEN
    CREATE POLICY "work_assignments_delete_policy" ON public.work_assignments
      FOR DELETE TO {authenticated}
      USING (((estate_id = auth_estate_id()) AND (auth_app_role() = ANY (ARRAY['pf'::text, 'fc'::text, 'admin'::text, 'super_admin'::text]))))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'work_assignments' AND policyname = 'work_assignments_insert_policy'
  ) THEN
    CREATE POLICY "work_assignments_insert_policy" ON public.work_assignments
      FOR INSERT TO {authenticated}
      WITH CHECK ((estate_id = auth_estate_id()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'work_assignments' AND policyname = 'work_assignments_select_policy'
  ) THEN
    CREATE POLICY "work_assignments_select_policy" ON public.work_assignments
      FOR SELECT TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR auth_is_cross_estate_role()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'work_assignments' AND policyname = 'work_assignments_update_policy'
  ) THEN
    CREATE POLICY "work_assignments_update_policy" ON public.work_assignments
      FOR UPDATE TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR auth_is_cross_estate_role()))
      WITH CHECK ((estate_id = auth_estate_id()))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'workers' AND policyname = 'workers_anon_all'
  ) THEN
    CREATE POLICY "workers_anon_all" ON public.workers
      FOR ALL TO {anon}
      USING (true)
      WITH CHECK (true)
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'workers' AND policyname = 'workers_anon_select'
  ) THEN
    CREATE POLICY "workers_anon_select" ON public.workers
      FOR SELECT TO {anon}
      USING (true)
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'workers' AND policyname = 'workers_delete_policy'
  ) THEN
    CREATE POLICY "workers_delete_policy" ON public.workers
      FOR DELETE TO {authenticated}
      USING (((estate_id = auth_estate_id()) AND (auth_app_role() = ANY (ARRAY['pf'::text, 'fc'::text, 'admin'::text, 'super_admin'::text]))))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'workers' AND policyname = 'workers_insert_policy'
  ) THEN
    CREATE POLICY "workers_insert_policy" ON public.workers
      FOR INSERT TO {authenticated}
      WITH CHECK (((estate_id = auth_estate_id()) AND (auth_app_role() = ANY (ARRAY['staff'::text, 'mandur'::text, 'pf'::text, 'fc'::text, 'afc'::text, 'fs'::text, 'admin'::text, 'super_admin'::text]))))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'workers' AND policyname = 'workers_select_policy'
  ) THEN
    CREATE POLICY "workers_select_policy" ON public.workers
      FOR SELECT TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR (auth_app_role() = ANY (ARRAY['rc'::text, 'oc'::text, 'admin'::text, 'super_admin'::text]))))
    ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'workers' AND policyname = 'workers_update_policy'
  ) THEN
    CREATE POLICY "workers_update_policy" ON public.workers
      FOR UPDATE TO {authenticated}
      USING (((estate_id = auth_estate_id()) OR (auth_app_role() = ANY (ARRAY['rc'::text, 'oc'::text, 'admin'::text, 'super_admin'::text]))))
      WITH CHECK (((estate_id = auth_estate_id()) AND (auth_app_role() = ANY (ARRAY['staff'::text, 'mandur'::text, 'pf'::text, 'fc'::text, 'afc'::text, 'fs'::text, 'admin'::text, 'super_admin'::text]))))
    ;
  END IF;
END $$;

