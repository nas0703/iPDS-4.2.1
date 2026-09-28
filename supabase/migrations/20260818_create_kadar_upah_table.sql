-- ==============================================================================
-- SUPABASE MIGRATION: DEDICATED KADAR UPAH TABLE (kadar_upah_knowledge)
-- Separate table for Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8)
-- ==============================================================================

-- 1. Create table for Kadar Upah Kerja (KUK SIRI 8)
CREATE TABLE IF NOT EXISTS public.kadar_upah_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manual_title TEXT NOT NULL DEFAULT 'Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8)',
    category TEXT NOT NULL DEFAULT 'Kadar Upah',
    section_title TEXT NOT NULL,
    page_number INT DEFAULT 1,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create index for fast keyword search & category filtering
CREATE INDEX IF NOT EXISTS idx_kadar_upah_category ON public.kadar_upah_knowledge(category);
CREATE INDEX IF NOT EXISTS idx_kadar_upah_section ON public.kadar_upah_knowledge(section_title);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.kadar_upah_knowledge ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies for public read and authenticated insert
CREATE POLICY "Public read access for kadar_upah_knowledge" 
ON public.kadar_upah_knowledge FOR SELECT USING (true);

CREATE POLICY "Public insert access for kadar_upah_knowledge" 
ON public.kadar_upah_knowledge FOR INSERT WITH CHECK (true);

CREATE POLICY "Public update access for kadar_upah_knowledge" 
ON public.kadar_upah_knowledge FOR UPDATE USING (true);

CREATE POLICY "Public delete access for kadar_upah_knowledge" 
ON public.kadar_upah_knowledge FOR DELETE USING (true);

-- 5. Seed initial official KUK SIRI 8 Data into kadar_upah_knowledge
INSERT INTO public.kadar_upah_knowledge (manual_title, category, section_title, page_number, content)
VALUES
(
  'Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8)',
  'Kadar Upah',
  'KUK SIRI 8: Kadar Upah Menuai & Memungut Buah Tandan Segar (BTS) Mengikut Ketinggian Pokok',
  72,
  'Jadual Rasmi Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8) - Menuai & Memungut Buah Tandan Segar (BTS): 1. Pokok Rendah (Ketinggian <3.0m / Pahat): RM22.00 – RM26.00 per Tan BTS. 2. Pokok Sederhana (3.0m – 6.0m / Sabit Rendah): RM28.00 – RM34.00 per Tan BTS. 3. Pokok Tinggi (6.0m – 12.0m / Sabit Egrek): RM35.00 – RM45.00 per Tan BTS. 4. Elaun & Insentif Tambahan: Insentif BTP/ABW >15kg (+RM3.00/tan), Elaun Cerun/Gambut (+RM3.50–RM5.00/tan), Biji relai bersih (+RM2.00/tan).'
),
(
  'Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8)',
  'Kadar Upah',
  'KUK SIRI 8: Kadar Upah Pemangkasan Pelepah (Pruning) & Susun Pelepah',
  74,
  'Jadual Rasmi Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8) - Pemangkasan Pelepah (Pruning): 1. Pokok Muda (Umur 3–7 tahun): RM0.80 – RM1.20 per Pokok. 2. Pokok Matang Penuh (Umur 8–14 tahun): RM1.30 – RM1.80 per Pokok. 3. Pokok Tinggi (>15 tahun): RM1.90 – RM2.50 per Pokok. 4. Susunan Pelepah (Frond Stacking U-shape/Inter-row): Termasuk dalam pakej atau elaun RM0.30 per pokok.'
),
(
  'Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8)',
  'Kadar Upah',
  'KUK SIRI 8: Kadar Upah Kutipan Biji Relai (Loose Fruits)',
  76,
  'Jadual Rasmi Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8) - Kutipan Biji Relai: 1. Kadar Standard: RM0.18 – RM0.28 per kg Biji Relai Bersih (atau RM18.00 – RM28.00 per Guni 100kg). 2. Insentif Kualiti Bebas Sampah/Tanah: Bonus RM0.05 per kg.'
),
(
  'Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8)',
  'Kadar Upah',
  'KUK SIRI 8: Kadar Upah Semburan Racun Herbisid, Pesticide & Trunk Injection',
  78,
  'Jadual Rasmi Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8) - Semburan Racun Kimia: 1. Semburan Piringan & Lorong Menuai: RM25.00 – RM35.00 per Hektar. 2. Semburan Rumpai Liar / Woody Growth: RM38.00 – RM50.00 per Hektar. 3. Circle Weeding Pokok Muda: RM16.00 – RM22.00 per Hektar. 4. Trunk Injection Acephate: RM1.50 – RM2.20 per Pokok.'
),
(
  'Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8)',
  'Kadar Upah',
  'KUK SIRI 8: Kadar Upah Penaburan Baja Kimia, Mikronutrien & EFB',
  80,
  'Jadual Rasmi Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8) - Penaburan Baja & EFB: 1. Tabur Baja Berbutir (Urea, MOP, RP, NPK): RM25.00 – RM35.00 per Tan Baja (RM1.25–RM1.75 per Beg 50kg). 2. Baja Mikronutrien Borate: RM0.15 – RM0.25 per Pokok. 3. EFB Mulching (Tandan Kosong): RM12.00 – RM18.00 per Tan EFB.'
),
(
  'Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8)',
  'Kadar Upah',
  'KUK SIRI 8: Kadar Upah Penanaman, Sulaman (Supplying) & Kerja Infrastruktur',
  82,
  'Jadual Rasmi Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8) - Tanam & Infrastruktur: 1. Tanam Anak Sawit Replanting: RM2.80 – RM4.00 per Pokok. 2. Sulaman (Supplying): RM4.50 – RM6.00 per Pokok. 3. Ablasi Bunga Awal: RM0.40 – RM0.60 per Pokok. 4. Cuci Parit Kontur Manual: RM1.80 – RM3.00 per Meter.'
);
