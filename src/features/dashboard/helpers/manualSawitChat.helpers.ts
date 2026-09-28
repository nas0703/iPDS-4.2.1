export const CATEGORY_STRUCTURE = [
  {
    id: 'Semua',
    name: 'Semua',
    badge: 'Semua Dokumen',
  },
  {
    id: 'The Oil Palm, 5th Edition',
    name: 'The Oil Palm (5th Edition) - Corley & Tinker',
    badge: 'Buku Rujukan Antarabangsa',
    subItems: [
      { id: 'The Oil Palm, 5th Edition', name: 'Semua Bab (The Oil Palm 5th Ed)', badge: 'Corley & Tinker (2016)' },
      { id: 'TOP - Fisiologi & Fotosintesis', name: 'Bab 4: Vegetatif, Pertumbuhan & Fisiologi', badge: 'Canopy & Photosynthesis' },
      { id: 'TOP - Pembiakbakaan & Genetik', name: 'Bab 6: Pembiakbakaan & Varieti Komersial', badge: 'Deli Dura x Pisifera' },
      { id: 'TOP - Kepadatan Penanaman', name: 'Bab 8: Kepadatan & Corak Penanaman', badge: 'Optimum Density & SPH' },
      { id: 'TOP - Pemakanan & Pembajaan', name: 'Bab 11: Pemakanan & Pembajaan Pokok', badge: 'Critical Leaf Nutrient Levels' },
      { id: 'TOP - Penyakit Ganoderma', name: 'Bab 14: Penyakit & Serangan Ganoderma', badge: 'BSR / Stem Rot Management' },
      { id: 'TOP - Kematangan & Kualiti Minyak', name: 'Bab 16: Penuaian & Kualiti Minyak Sawit', badge: 'FFA & OER Optimization' },
    ],
  },
  {
    id: 'Kadar Upah Kerja (KUK) SIRI 8',
    name: 'Kadar Upah Kerja (KUK) SIRI 8',
    badge: 'KUK Siri 8',
  },
  {
    id: 'Manual Perolehan 2023 Pind. 2025',
    name: 'Manual Perolehan 2023 Pind. 2025',
    badge: 'Perolehan 2023 (Pind. 2025)',
  },
  {
    id: 'Manual Rumpai Dan Kawalan',
    name: 'Manual Rumpai Dan Kawalan',
    badge: 'Kawalan Herbisid & RAG',
  },
  {
    id: 'Manual Sawit Lestari Edisi 3',
    name: 'Manual Sawit Lestari Edisi 3',
    badge: 'MSL Edisi 3',
    subItems: [
      { id: 'Manual Sawit Lestari Edisi 3', name: 'Semua MSL (Edisi 3)', badge: 'Rangkumi Semua Modul MSL' },
      { id: 'MSL - Tapak Semaian', name: 'MSL - Tapak Semaian', badge: 'Pre & Main Nursery' },
      { id: 'MSL - Pembangunan Tanam Semula', name: 'MSL - Pembangunan Tanam Semula', badge: 'Replanting & LCC' },
      { id: 'MSL - Pokok Pra Matang', name: 'MSL - Pokok Pra Matang', badge: 'Ablasi & Sulaman' },
      { id: 'MSL - Pokok Matang', name: 'MSL - Pokok Matang', badge: 'Penuaian & Pruning' },
      { id: 'MSL - Pembajaan', name: 'MSL - Pembajaan', badge: 'Prinsip 4T & LSU' },
    ],
  },
];

export const CATEGORIES = [
  'Semua',
  'The Oil Palm, 5th Edition',
  'TOP - Fisiologi & Fotosintesis',
  'TOP - Pembiakbakaan & Genetik',
  'TOP - Kepadatan Penanaman',
  'TOP - Pemakanan & Pembajaan',
  'TOP - Penyakit Ganoderma',
  'TOP - Kematangan & Kualiti Minyak',
  'Kadar Upah Kerja (KUK) SIRI 8',
  'Manual Perolehan 2023 Pind. 2025',
  'Manual Rumpai Dan Kawalan',
  'Manual Sawit Lestari Edisi 3',
  'MSL - Tapak Semaian',
  'MSL - Pembangunan Tanam Semula',
  'MSL - Pokok Pra Matang',
  'MSL - Pokok Matang',
  'MSL - Pembajaan',
];

export const SUGGESTED_QUESTIONS = [
  "Apakah nilai optimum kepadatan pokok (SPH) & formula Bunch Index mengikut buku The Oil Palm (Corley & Tinker)?",
  "Apakah paras kritikal nutrien daun (N, P, K, Mg, B) pada pelepah 17 mengikut Corley & Tinker 5th Edition?",
  "Bagaimanakah mekanisme kawalan dan pencegahan Ganoderma Basal Stem Rot (BSR) mengikut The Oil Palm 5th Edition?",
  "Apakah dos racun Glyphosate + Metsulfuron bagi semburan piringan dan lorong menuai?",
  "Bagaimanakah cara kawalan kimia khusus bagi Asystasia gangetica dan Mikania micrantha?",
  "Berapakah kadar upah menuai BTS per tan mengikut ketinggian pokok?",
  "Berapakah had nilai kuasa melulus pembelian terus vs sebut harga mengikut Manual Perolehan 2023 Pind. 2025?",
  "Apakah syarat bon pelaksanaan (5%) dan wang jaminan pelaksanaan (WJP) kontraktor ladang?",
  "Apakah kadar upah pruning pelepah & susun pelepah per pokok?",
  "Berapa kadar upah semburan racun herbisid & meracun per hektar?",
  "Berapa kadar upah penaburan baja urea/MOP & EFB mulching?",
  "Apakah standard kematangan BTS & kriteria penuaian pokok matang mengikut MSL?",
  "Apakah prinsip 4T dan jadual master pembajaan sawit (P1 - P4) mengikut MSL?",
];

export const matchCategoryFilter = (itemCategory: string, selected: string, query?: string): boolean => {
  if (!selected || selected === 'Semua') return true;
  const s = selected.toLowerCase().trim();
  const c = itemCategory.toLowerCase().trim();
  if (c === s) return true;

  if (s.includes('the oil palm') || s.includes('corley') || s.includes('tinker') || s.startsWith('top -') || s.includes('5th edition')) {
    if (s.startsWith('top -')) {
      if (s.includes('fisiologi') || s.includes('fotosintesis')) return c.includes('fisiologi') || c.includes('fotosintesis') || c.includes('canopy');
      if (s.includes('pembiakbakaan') || s.includes('genetik')) return c.includes('pembiakbakaan') || c.includes('genetik') || c.includes('deli dura');
      if (s.includes('kepadatan')) return c.includes('kepadatan') || c.includes('sph') || c.includes('spacing');
      if (s.includes('pemakanan') || s.includes('pembajaan')) return c.includes('pemakanan') || c.includes('leaf nutrient') || c.includes('pelepah 17');
      if (s.includes('ganoderma') || s.includes('penyakit')) return c.includes('ganoderma') || c.includes('stem rot');
      if (s.includes('kematangan') || s.includes('minyak')) return c.includes('kematangan') || c.includes('kualiti minyak') || c.includes('oer');
    }
    return c.includes('the oil palm') || c.includes('corley') || c.includes('tinker') || c.includes('oil palm, 5th') || c.startsWith('top');
  }

  if (s.includes('kadar upah') || s.includes('kuk') || s.includes('upah')) {
    return c.includes('upah') || c.includes('kadar') || c.includes('kuk');
  }

  if (s.includes('perolehan') || s.includes('manual perolehan') || s.includes('pind. 2025') || s.includes('pindaan 2025')) {
    return c.includes('perolehan');
  }

  if (s.includes('rumpai') || s.includes('herbisid')) {
    return c.includes('rumpai') || c.includes('herbisid');
  }

  if (s.includes('msl') || s.includes('sawit lestari')) {
    if (s.startsWith('msl -')) {
      if (s.includes('tapak semaian')) return c.includes('tapak semaian') || c.includes('nursery');
      if (s.includes('tanam semula')) return c.includes('tanam semula') || c.includes('replanting');
      if (s.includes('pra matang')) return c.includes('pra matang') || c.includes('immature');
      if (s.includes('pokok matang')) return c.includes('matang') || c.includes('mature');
      if (s.includes('pembajaan')) return c.includes('pembajaan') || c.includes('fertilizer');
    }
    return c.includes('msl') || c.includes('sawit lestari');
  }

  return true;
};
