import { getPrivilegedSupabase } from '../db.js';
import { THE_OIL_PALM_5TH_EDITION_KNOWLEDGE_BASE } from '../../data/theOilPalmKnowledge.js';

export interface WeedDefinition {
  scientific: string[];
  malay: string[];
  english: string[];
  tablePages: number[];
  profilePages: number[];
  category: string;
  imageUrl?: string;
}

export const WEED_DATABASE: WeedDefinition[] = [
  // 1. Senduduk Bulu (Clidemia hirta)
  {
    scientific: ['clidemia hirta', 'clidemia'],
    malay: ['senduduk bulu', 'akar kala', 'terman', 'keduduk bulu', 'sendudok bulu'],
    english: ['koster\'s curse', 'soapbush', 'hairy clidemia', 'hairy sendudok'],
    tablePages: [152, 154],
    profilePages: [87],
    category: 'Broadleaved weeds (woody)',
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Clidemia_hirta_leaves.JPG?width=800'
  },
  // 2. Senduduk (Melastoma malabathricum)
  {
    scientific: ['melastoma malabathricum', 'melastoma polyanthum', 'melastoma'],
    malay: ['senduduk', 'pokok senduduk', 'kedudukan', 'sendudok'],
    english: ['singapore rhododendron', 'indian rhododendron', 'malabar melastome'],
    tablePages: [152],
    profilePages: [95, 96],
    category: 'Broadleaved weeds (woody)',
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Melastoma_malabathricum_flower.jpg?width=800'
  },
  // 3. Pokok Kapal Terbang (Chromolaena odorata)
  {
    scientific: ['chromolaena odorata', 'eupatorium odoratum', 'chromolaena', 'eupatorium'],
    malay: ['pokok kapal terbang', 'kapal terbang', 'rumput belalang', 'pokok jepun', 'pokok german'],
    english: ['siam weed', 'bitter bush', 'christmas bush', 'jack in the bush'],
    tablePages: [152],
    profilePages: [87],
    category: 'Broadleaved weeds (woody)',
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Chromolaena_odorata_flowers.jpg?width=800'
  },
  // 4. Rumput Israel / Asystasia gangetica
  {
    scientific: ['asystasia gangetica', 'asystasia intrusa', 'asystasia coromandeliana', 'asystasia'],
    malay: ['rumput israel', 'rumput bunga putih', 'israel', 'pengarak'],
    english: ['chinese violet', 'coromandel', 'creeping foxglove', 'common asystasia'],
    tablePages: [150, 151, 154],
    profilePages: [45],
    category: 'Broadleaved weeds (non-creeping)',
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Asystasia_gangetica_11_05_2010.JPG?width=800'
  },
  // 5. Paku Resam / Dicranopteris linearis
  {
    scientific: ['dicranopteris linearis', 'gleichenia linearis', 'dicranopteris'],
    malay: ['paku resam', 'resam', 'resam paku'],
    english: ['tropical bracken', 'old world forked fern', 'bracken fern'],
    tablePages: [153, 154],
    profilePages: [108],
    category: 'Ferns & Allies',
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Dicranopteris_linearis_%28Gleicheniaceae%29_habit.JPG?width=800'
  },
  // 6. Paku Larat / Nephrolepis biserrata
  {
    scientific: ['nephrolepis biserrata', 'nephrolepis acuta', 'nephrolepis'],
    malay: ['paku larat', 'paku larut', 'paku kikir', 'paku uban', 'paku harimau', 'paku pedang'],
    english: ['broad sword fern', 'sword fern', 'fishbone fern'],
    tablePages: [153, 154],
    profilePages: [111, 120],
    category: 'Ferns & Allies / Epiphytes',
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Nephrolepis_biserrata_%28Lomariopsidaceae%29_habit.JPG?width=800'
  },
  // 7. Paku Miding / Midin / Stenochlaena palustris
  {
    scientific: ['stenochlaena palustris', 'stenochlaena'],
    malay: ['paku miding', 'paku midin', 'lamiding', 'paku ramu', 'paku naga', 'paku mesin', 'akar paku'],
    english: ['giant fern', 'climbing fern'],
    tablePages: [153, 154],
    profilePages: [113],
    category: 'Ferns & Allies / Epiphytes',
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Stenochlaena_palustris_fronds.jpg?width=800'
  },
  // 8. Selaput Tunggul / Mikania micrantha
  {
    scientific: ['mikania micrantha', 'mikania cordata', 'mikania'],
    malay: ['selaput tunggul', 'ceroma', 'ulam tikus', 'mile-a-minute'],
    english: ['mile-a-minute', 'mile a minute', 'climbing hempvine', 'guaco'],
    tablePages: [150, 151],
    profilePages: [61, 70],
    category: 'Broadleaved weeds (creeping)',
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Mikania_micrantha_at_Kadavoor.jpg?width=800'
  },
  // 9. Lalang / Imperata cylindrica
  {
    scientific: ['imperata cylindrica', 'imperata'],
    malay: ['lalang', 'rumput lalang'],
    english: ['cogongrass', 'speargrass', 'blady grass'],
    tablePages: [148, 149],
    profilePages: [12, 14],
    category: 'Grasses (rhizomatous)',
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Imperata_cylindrica_Inflorescence.jpg?width=800'
  },
  // 10. Rumput Sembilu / Ottochloa nodosa
  {
    scientific: ['ottochloa nodosa', 'ottochloa'],
    malay: ['rumput sembilu', 'rumput sarang buaya', 'ottochloa'],
    english: ['slender bamboo grass', 'ottochloa grass'],
    tablePages: [148, 149],
    profilePages: [22],
    category: 'Grasses',
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Ottochloa_nodosa.jpg?width=800'
  }
];

export function resolveWeedFromQuery(query: string): { weed: WeedDefinition | null; expandedTerms: string[] } {
  if (!query) return { weed: null, expandedTerms: [] };
  const qLower = query.toLowerCase().trim();

  for (const item of WEED_DATABASE) {
    const allNames = [...item.scientific, ...item.malay, ...item.english];
    for (const name of allNames) {
      if (qLower.includes(name.toLowerCase())) {
        const expandedTerms = Array.from(new Set([...item.scientific, ...item.malay, ...item.english]));
        return { weed: item, expandedTerms };
      }
    }
  }
  return { weed: null, expandedTerms: [] };
}

export function compressMslContent(content: string, maxCharsPerChunk = 3000): string {
  if (!content) return '';
  let cleaned = content
    .replace(/1?\s*Hak\s*Cipta\s*Terpelihara.*?DOKUMEN\s*TERKAWAL/gis, '')
    .replace(/Hak\s*Cipta\s*Terpelihara[^\n.]*/gi, '')
    .replace(/DOKUMEN\s*TERKAWAL[^\n.]*/gi, '')
    .replace(/No\.?\s*Dokumen\s*:[^\n.]*/gi, '')
    .replace(/Tarikh\s*Pindaan\s*:[^\n.]*/gi, '')
    .replace(/Bil\.?\s*Muka\s*Surat\s*:[^\n.]*/gi, '')
    .replace(/MANUAL\s*LADANG\s*SAWIT\s*LESTARI[^\n.]*/gi, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();

  if (cleaned.length > maxCharsPerChunk) {
    const lastNewline = cleaned.lastIndexOf('\n', maxCharsPerChunk);
    if (lastNewline > maxCharsPerChunk * 0.7) {
      cleaned = cleaned.slice(0, lastNewline).trim();
    } else {
      cleaned = cleaned.slice(0, maxCharsPerChunk).trim();
    }
  }
  return cleaned;
}

export function matchCategory(chunkCategory: string, filterCategory?: string | null, questionText?: string): boolean {
  if (!filterCategory || filterCategory === 'Semua' || filterCategory === 'all') return true;
  const f = filterCategory.toLowerCase().trim();
  const c = chunkCategory.toLowerCase().trim();
  if (c === f) return true;

  // 1. The Oil Palm, 5th Edition (Corley & Tinker)
  if (
    f.includes('the oil palm') || f.includes('oil palm') || f.includes('oil palam') ||
    f.includes('5th edition') || f.includes('5th ed') || f.includes('corley') || f.includes('tinker') ||
    f.startsWith('top -') || f.startsWith('top:') || f === 'the oil palm, 5th edition'
  ) {
    const isChunkTop = c.includes('the oil palm') || c.includes('oil palm, 5th') || c.includes('oil palm 5th') || c.includes('corley') || c.includes('tinker') || c.startsWith('top');
    if (!isChunkTop) return false;

    if (f.startsWith('top -') || f.startsWith('top:')) {
      if (f.includes('fisiologi') || f.includes('fotosintesis')) return c.includes('fisiologi') || c.includes('fotosintesis') || c.includes('canopy') || c.includes('dry matter') || c.includes('bunch index');
      if (f.includes('pembiakbakaan') || f.includes('genetik')) return c.includes('pembiakbakaan') || c.includes('genetik') || c.includes('deli dura') || c.includes('dura') || c.includes('pisifera') || c.includes('tenera');
      if (f.includes('kepadatan')) return c.includes('kepadatan') || c.includes('densiti') || c.includes('sph') || c.includes('spacing') || c.includes('jarak') || c.includes('lcc');
      if (f.includes('pemakanan') || f.includes('pembajaan')) return c.includes('pemakanan') || c.includes('leaf nutrient') || c.includes('pelepah 17') || c.includes('frond 17') || c.includes('lsu') || c.includes('nutrisi');
      if (f.includes('ganoderma') || f.includes('penyakit')) return c.includes('ganoderma') || c.includes('stem rot') || c.includes('penyakit') || c.includes('perosak') || c.includes('ipm');
      if (f.includes('kematangan') || f.includes('minyak')) return c.includes('kematangan') || c.includes('kualiti minyak') || c.includes('ffa') || c.includes('oer') || c.includes('penuaian');
    }
    return true;
  }

  // 2. Kadar Upah Kerja (KUK) SIRI 8
  if (f.includes('kadar upah') || f.includes('kuk') || f.includes('upah')) {
    return c.includes('upah') || c.includes('kadar') || c.includes('kuk');
  }

  // 3. Manual Perolehan 2023 Pind. 2025
  if (f.includes('perolehan') || f.includes('pind. 2025') || f.includes('pindaan 2025')) {
    return c.includes('perolehan');
  }

  // 4. Manual Rumpai Dan Kawalan
  if (f.includes('rumpai') || f.includes('kawalan') || f.includes('herbisid')) {
    return c.includes('rumpai') || c.includes('kawalan') || c.includes('herbisid') || c.includes('weeds');
  }

  // 5. Specific MSL Sub-categories
  if (f.includes('tapak semaian') || f.includes('semai') || f === 'msl - tapak semaian') {
    return c.includes('tapak semaian') || c.includes('semai');
  }

  if (f.includes('tanam semula') || f.includes('pembangunan') || f === 'msl - pembangunan tanam semula') {
    return c.includes('pembangunan') || c.includes('tanam semula') || c.includes('replanting');
  }

  if (f.includes('pra matang') || f.includes('pra-matang') || f === 'msl - pokok pra matang') {
    return c.includes('pra matang') || c.includes('pra-matang') || (c.includes('pra') && !c.includes('pruning'));
  }

  if (f.includes('pokok matang') || f === 'msl - pokok matang' || (f.includes('matang') && !f.includes('pra'))) {
    if (c.includes('pra')) return false;
    return c.includes('matang') || c.includes('tuai') || c.includes('penuaian') || c.includes('bts') || c.includes('pruning');
  }

  if (f.includes('pembajaan') || f === 'msl - pembajaan') {
    return c.includes('pembajaan') || c.includes('baja') || c.includes('nutrisi');
  }

  // 6. Manual Sawit Lestari Edisi 3 (All MSL modules)
  if (f.includes('manual sawit lestari') || f.includes('edisi 3') || f === 'msl') {
    const isExternal = c.includes('upah') || c.includes('kuk') || c.includes('perolehan') || c.includes('the oil palm') || c.includes('corley') || c.includes('rumpai');
    return !isExternal;
  }

  return false;
}

export const SEED_MANUAL_CHUNKS = [
  // 1. Tapak Semaian / Nursery
  {
    manual_title: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Tapak Semaian",
    section_title: "Pengurusan Tapak Semaian Peringkat Awal (Pre-Nursery)",
    page_number: 8,
    content: "Tapak semaian peringkat awal (Pre-Nursery) dijalankan selama 3-4 bulan menggunakan polibeg kecil (15 cm x 23 cm / 6 in x 9 in) berkualiti hitam tebal 0.05 mm yang diisi tanah atas (topsoil) diayak dan digaul baja fostat (RP). Keperluan Utama: Naungan jaring para 50% untuk bulan pertama (dibuka berperingkat pada bulan ke-2 dan ke-3), penyiraman 2 kali sehari (pagi dan petang dengan 4-5 mm air/hari atau 0.2 - 0.3 liter/polibeg/hari), kawalan rumpai secara manual (merumput tangan), dan penyingkiran benih abnormal (culling peringkat awal) 5%-8% bagi menyingkirkan anak benih twisted leaf, crinkled leaf, daun sempit (narrow leaf), collante, atau bantut (stunted)."
  },
  {
    manual_title: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Tapak Semaian",
    section_title: "Pengurusan Tapak Semaian Utama (Main Nursery) & Culling Akhir",
    page_number: 12,
    content: "Main Nursery (Tapak Semaian Utama) menempatkan anak benih dari umur 4 bulan hingga 12-14 bulan dalam polibeg besar (38 cm x 50 cm / 15 in x 20 in, tebal 0.12 mm berlubang salir) dengan susunan segi tiga (triangular spacing) 0.9 m x 0.9 m (memberikan kepadatan sekitar 13,800 polibeg/hektar). Sistem pengairan renjis (sprinkler system) berjadual membekalkan 8-10 liter air/polibeg/hari. Program pembajaan sebatian NPK 15:15:6:4 atau 12:12:17:2 setiap 4 minggu berserta mikronutrien Kieserite/Borate. Standard culling akhir 5%-10% untuk menolak pokok steril, juvenile, erect/vertikal (erect frond), flat top (daun rata), narrow pinnae, kerdil, dan bintik daun sebelum dihantar untuk penanaman di ladang."
  },
  {
    manual_title: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Tapak Semaian",
    section_title: "Kawalan Perosak, Penyakit & Rumpai di Tapak Semaian (Nursery Pest & Disease SOP)",
    page_number: 14,
    content: "Kawalan Penyakit & Perosak Tapak Semaian (Nursery): 1. Penyakit Bintik Daun (Curvularia / Anthracnose / Pestalotiopsis / Leaf Spot): Semburan racun kulat Thiram, Mancozeb (2.0 g/L air) atau Difenoconazole berselang-seli setiap 7-10 hari semasa musim hujan. 2. Perosak Belalang & Kumbang Daun (Apogonia / Valanga): Semburan racun serangga Cypermethrin atau Chlorpyrifos mengikut label. 3. Kawalan Rumpai Polibeg: Merumput tangan bersih (hand weeding) bagi mengelak kerosakan akar anak benih; lorong antara polibeg boleh disembur racun sentuh berpelindung (spray hood) mengelak tempias terkena daun anak benih."
  },
  {
    manual_title: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Tapak Semaian",
    section_title: "Kriteria & Standard Culling (Penolakan Anak Benih Abnormal) di Nursery",
    page_number: 15,
    content: "Jadual Kriteria Culling Anak Benih di Tapak Semaian (Nursery Culling Standard):\n1. Pre-Nursery Culling (Umur 2-3 bulan, kadar 5%-8%): Ciri abnormaliti merangkumi Daun Kerekut (Crinkled Leaf), Daun Terpintal (Twisted Leaf), Daun Kerdil / Sempit (Narrow / Spindly Leaf), Daun Melekat (Collante), dan Anak Benih Bantut (Stunted Seedling).\n2. Main Nursery Culling (Umur 4-12 bulan, kadar 5%-10%): Ciri abnormaliti merangkumi Pelepah Tegak / Vertikal (Erect Frond / Chimera), Pucuk Rata (Flat Top / Crown Disease), Susunan Daun Padat / Pendek (Short / Compact Frond), Pelepah Terbuka Luas (Limp / Wide Angle), Anak Daun Halus / Jarang (Narrow / Sparse Pinnae), dan Pokok Kerdil / Steril (Runty / Sterile Seedling).\nJumlah kumulatif culling dari benih cambah ke ladang biasanya antara 10% hingga 15%."
  },
  // 2. Pembangunan Tanam Semula & Penanaman Ladang
  {
    manual_title: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Pembangunan Tanam Semula",
    section_title: "Jarak Tanaman Sawit di Ladang, Kepadatan Pokok & Penyediaan Lubang Tanaman (Holing)",
    page_number: 21,
    content: "Spesifikasi Jarak Tanaman Sawit, Kepadatan & Lubang Tanaman di Ladang:\n1. Sistem & Jarak Tanaman Standard: Sistem susunan Segi Tiga Sama Sisi (Equilateral Triangular Pattern) arah Utara-Selatan. Jarak tanaman standard di ladang ialah 9.0 m x 9.0 m x 9.0 m (jarak antara pokok 9.0 m, jarak antara barisan 7.8 m). Kepadatan pokok (Planting Density) adalah 136 hingga 148 pokok/hektar (55 hingga 60 pokok/ekar). Bagi tanah mineral beralun standard ialah 136 pokok/hektar; manakala tanah gambut/klon pelepah tegak padat menggunakan 148 pokok/hektar (8.5 m x 8.5 m x 8.5 m).\n2. Pembarisan (Linning): Penetapan titik tanaman menggunakan pancang dan dawai pengukur bagi memastikan barisan lurus.\n3. Lubang Tanaman (Holing): Saiz lubang 60 cm x 60 cm x 60 cm. Tabur 500 gram baja Rock Phosphate (RP / CIRP) di dasar lubang dan gaul bersama tanah atas (topsoil) sebelum anak pokok ditanam. Buka plastik polibeg sepenuhnya tanpa memecahkan bebola tanah (root ball)."
  },
  {
    manual_title: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Pembangunan Tanam Semula",
    section_title: "Penyediaan Kawasan, Teknik Tebang Cincang & Kawalan Ganoderma",
    page_number: 16,
    content: "Pembangunan Tanam Semula (Replanting) mengikut piawaian MSPO mewajibkan Teknik Tanpa Bakar (Zero Burning Technique). Pokok ditumbang dan batang dicincang halus (5-10 cm) menggunakan ekskavator untuk mempercepatkan pereputan dan menyekat tapak pembiakan kumbang tanduk. Sanitasi tunggul dan akar (de-stumping) dijalankan bagi mencegah penyakit reput pangkal batang (Ganoderma boninense)."
  },
  {
    manual_title: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Pembangunan Tanam Semula",
    section_title: "Penanaman Tanaman Penutup Bumi Kekacang (LCC) - Spesies & Amalan Agronomi",
    page_number: 20,
    content: "Penanaman Tanaman Penutup Bumi Kekacang (LCC) seperti Mucuna bracteata bersama Pueraria javanica dan Calopogonium mucunoides wajib dilaksanakan dalam tanam semula untuk menghalang hakisan tanah, memelihara kelembapan tanah, menyekat rumpai liar berbahaya (seperti lalang dan Mikania), dan mengikat Nitrogen atmosfera (150-200 kg N/ha/tahun). Kadar campuran: 50 g Mucuna + 2.0 kg PJ + 3.0 kg CM sehektar digaulkan dengan inokulan Rhizobium dan Rock Phosphate (RP/CIRP)."
  },
  {
    manual_title: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Pembangunan Tanam Semula",
    section_title: "Spesifikasi Pembinaan Teres Kontur, Ukuran Tapak Teres, Back-slope & Benteng Hentian (Stop Bunds)",
    page_number: 21,
    content: "Spesifikasi Ukuran Teres Kontur & Kawalan Hakisan Lereng Bukit (MSL & GAP):\n1. Lebar Tapak Teres: 3.5 meter hingga 4.0 meter (minimum 3.5 m, optimum 4.0 m) untuk laluan mini traktor, mekanisasi, dan keselamatan penuai.\n2. Cerun Tapak Ke Dalam (Back-slope / Inward Slope): 5° hingga 10° (nisbah kecerunan 1:10 hingga 1:12) condong ke arah dinding bukit untuk memerangkap air larian dan baja serta mengelakkan runtuhan tebing.\n3. Benteng Hentian (Stop Bunds / Earth Stops): Ketinggian 30 cm – 45 cm dan lebar 45 cm – 60 cm dibina melintang teres setiap selang 20 m – 30 m bagi menyekat aliran air deras dan menakung kelembapan.\n4. Kecerunan Tebing Potongan (Cut Batter): Kecerunan 1:1 (45 darjah) pada tanah biasa dan 1:0.5 pada tanah berbatu/keras.\n5. Kedudukan Lubang Tanam: Diletakkan 1.0 m – 1.5 m dari bibir luar teres (di bahagian 1/3 tapak teres ke arah dinding bukit pada lapisan tanah asal yang kukuh).\n6. Jadual Kecerunan Cerun: (a) 0°-6° (Rata/Landai): Tiada teres, (b) 6°-12° (Beralun): Teres mini / platform individu & parit kontur, (c) 12°-25° (Berbukit): Mandatori bina teres kontur bersambung (selebar 3.5-4.0 m), (d) >25°: Zon pemuliharaan cerun / dilarang tanam mengikut MSPO & JAS."
  },
  // 2b. Sistem Perparitan & Saliran Ladang (Seksyen 13.0 & 16.0)
  {
    manual_title: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Perparitan & Saliran",
    section_title: "Seksyen 13.0 / 13.3 Membina Parit Ladang, Parit Sekunder & Parit Utama (Main Drain)",
    page_number: 22,
    content: "Spesifikasi Ukuran & Dimensi Parit mengikut MSL Seksyen 13.0 & 13.3:\n1. Parit Utama (Main Drain / Seksyen 13.1): Lebar Atas = 3.0 m – 4.5 m, Lebar Bawah = 1.5 m – 2.0 m, Kedalaman = 1.8 m – 2.5 m, Nisbah Kecerunan Tebing = 1:1 hingga 1:1.5.\n2. Parit Sekunder (Collection Drain / Seksyen 13.2): Lebar Atas = 1.8 m – 2.4 m, Lebar Bawah = 0.9 m – 1.2 m, Kedalaman = 1.2 m – 1.5 m, Kecerunan Tebing = 1:1.\n3. Parit Ladang (Field Drain / Seksyen 13.3): Lebar Atas = 1.2 m – 1.5 m, Lebar Bawah = 0.6 m – 0.9 m, Kedalaman = 0.9 m – 1.2 m, Kecerunan Tebing = 1:1."
  },
  {
    manual_title: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Perparitan & Saliran",
    section_title: "Seksyen 16.0 / 16.3 Membina Parit Sempadan (Boundary Drain) & Benteng Kawalan Hakisan",
    page_number: 23,
    content: "Spesifikasi Ukuran Parit Sempadan mengikut MSL Seksyen 16.0 & 16.3:\nParit Sempadan (Boundary Drain): Lebar Atas = 2.4 m – 3.0 m, Lebar Bawah = 1.2 m – 1.5 m, Kedalaman = 1.5 m – 1.8 m, Nisbah Kecerunan Tebing = 1:1. Parit sempadan dibina di sekeliling rizab sempadan ladang untuk menyekat aliran air limpahan dari kawasan luar dan mengelakkan banjir serta hakisan tebing."
  },
  // 3. Pra Matang
  {
    manual_title: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Pra Matang",
    section_title: "Penjagaan Pokok Sawit Peringkat Pra Matang (Umur 1 - 30 Bulan)",
    page_number: 24,
    content: "Sawit peringkat pra-matang (umur 1 hingga 30 bulan di ladang) memerlukan penjagaan rapi piringan pokok (circle weeding) jejari 1.0-1.5 meter. Aktiviti sanitasi bunga awal (ablation / castration) dijalankan pada bulan ke-14 hingga ke-20 atau ke-22 setiap 4-6 minggu dengan membuang kudup bunga dan buah awal untuk merangsang tumbesaran vegetatif (lilitan batang, kanopi daun, dan akar) bagi hasil BTS yang seragam."
  },
  {
    manual_title: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Pra Matang",
    section_title: "Kawalan Perosak Sawit Muda (Kumbang Tanduk & Tikus)",
    page_number: 28,
    content: "Kumbang tanduk (Oryctes rhinoceros) dikawal menggunakan perangkap feromon (1 perangkap bagi setiap 2 hektar) atau semburan di pucuk. Pasang kolar zink/dawai (wire mesh collar) setinggi 45 cm di sekeliling pangkal pokok tahun pertama untuk mengelakkan serangan tikus, babi hutan, dan landak. Lakukan sulaman pokok mati (supplying) dalam tempoh 6 bulan pertama."
  },
  // 4. Pokok Matang
  {
    manual_title: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Pokok Matang",
    section_title: "Standard Kematangan BTS & Kriteria Penuaian Pokok Matang",
    page_number: 32,
    content: "Standard penuaian BTS sawit matang (MPOB/Kilang): Tandan layak dituai mesti mempunyai sekurang-kurangnya 1 hingga 5 biji buah relai segar di atas tanah/piringan sebelum dipotong. Penuaian BTS Muda dilarang sama sekali (penalti gred tolak kilang). Pusingan menuai standard adalah 10 hingga 15 hari bagi memastikan OER optimum (>20%) dan mengelakkan buah peram/busuk yang meningkatkan Asid Lemak Bebas (FFA > 5%)."
  },
  {
    manual_title: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Pokok Matang",
    section_title: "SOP Pemangkasan Pelepah (Pruning) & Kawalan Kanopi Pokok Matang",
    page_number: 36,
    content: "Pemangkasan pelepah (Pruning) mengekalkan kanopi fotosintesis optimum: Sawit muda matang (umur 3-8 tahun) perlu kekalkan minimum 48-56 pelepah (minimum 2 pelepah menyokong tandan bawah / two fronds under bunch). Sawit matang penuh (9-14 tahun) kekalkan 40-48 pelepah. Sawit tinggi (>15 tahun) kekalkan 32-40 pelepah. Dilarang cantas berlebihan (over-pruning) kerana merosotkan hasil BTS 15%-30%. Pelepah disusun kemas di lorong pelepah (inter-row) secara selang sebaris."
  },
  {
    manual_title: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Pokok Matang",
    section_title: "Kutipan Biji Relai & Pengurusan Evakuasi 24 Jam",
    page_number: 40,
    content: "Biji relai (loose fruits) mengandungi peratusan minyak sawit (OER) tertinggi sekitar 40%-45%. Semua biji relai di piringan, lorong menuai, dan celah pelepah wajib dikutip bersih ke dalam guni/lori. BTS dan biji relai mesti dihantar ke kilang sawit dalam tempoh 24 jam selepas dituai untuk mengawal FFA di bawah 2.5%. Semak nombor resit timbangan dan audit KPG = KPA setiap hari."
  },
  {
    manual_title: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Pokok Matang",
    section_title: "Pengurusan Tandan Kosong (EFB) & Mulsa Organik di Pokok Matang",
    page_number: 44,
    content: "Aplikasi Tandan Kosong (Empty Fruit Bunches - EFB) pada kadar 30-40 tan/hektar setahun (sekitar 200-250 kg/pokok) di lorong pelepah membekalkan Kalium (K) dan bahan organik semulajadi, meningkatkan kelembapan tanah, merangsang aktiviti cacing tanah, dan mengurangkan kos baja kimia sehingga 15%-20%."
  },
  // 5. Pembajaan
  {
    manual_title: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Pembajaan",
    section_title: "Prinsip 4T & Amalan Terbaik Program Pembajaan Sawit",
    page_number: 48,
    content: "Program pembajaan sawit mesti mengikut Prinsip 4T: 1. Tepat Jenis (MOP untuk K2O dan berat tandan/BTP; Urea/Ammonium untuk Nitrogen dan klorofil; Rock Phosphate untuk perakaran; Kieserite untuk Magnesium; Borate untuk mengelak tandan kosong). 2. Tepat Dos (berdasarkan Analisis Daun LSU dan Analisis Tanah SSU). 3. Tepat Masa (semasa tanah lembap; elak musim kemarau terik atau hujan lebat berterusan). 4. Tepat Tempat (pokok muda di piringan bersih; pokok matang di zon perakaran aktif kanopi luar atau lorong pelepah reput)."
  },
  {
    manual_title: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Pembajaan",
    section_title: "Jadual Master & Kitaran Pusingan Pembajaan Setahun (P1 - P4)",
    page_number: 52,
    content: "Jadual Master Pembajaan: Pusingan 1 (Jan-Mac): Rock Phosphate (RP) & Kieserite (sasaran siap 100%). Pusingan 2 (Apr-Jun): NPK / MOP Pusingan 1 & Nitrogen/Urea (sasaran 100%). Pusingan 3 (Jul-Sep): MOP Pusingan 2 untuk menyokong fasa pembentukan tandan puncak/peak crop. Pusingan 4 (Okt-Dis): Borate / Kieserite tambahan sebelum monsun. Mandur wajib memeriksa kalibrasi mangkuk sukatan dos dan memastikan taburan rata tanpa gumpalan."
  },
  {
    manual_title: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Pembajaan",
    section_title: "Diagnostik Gejala Kekurangan Nutrien (Deficiency Symptoms)",
    page_number: 56,
    content: "Pengecaman simptom kekurangan nutrien: 1. Kekurangan Nitrogen (N): Daun kuning pucat seragam (chlorosis), pelepah pendek. 2. Kekurangan Kalium (K): Bintik kuning-oranye (Confluent Orange Spotting) pada pelepah tua, tepi anak daun mati terbakar (necrosis), saiz tandan BTS mengecil. 3. Kekurangan Magnesium (Mg): Daun tua terdedah cahaya matahari bertukar oren/kuning tembaga terang (Orange Frond). 4. Kekurangan Boron (B): Hujung pelepah membengkok seperti cangkuk (hook leaf), daun kerdil kipas (blind leaf), buah tidak lekat/berbiji kosong."
  },
  {
    manual_title: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Pembajaan",
    section_title: "Kaedah Persampelan Daun (LSU) & Ujian Tanah (SSU)",
    page_number: 60,
    content: "Persampelan Daun (Leaf Sampling Unit - LSU) dijalankan sekali setahun (Julai-September) untuk merangka program baja: Pokok pra-matang (1-3 tahun) guna Pelepah Ke-9 (Frond 9); Pokok matang (>3 tahun) guna Pelepah Ke-17 (Frond 17). Ambil 4-8 anak daun dari bahagian tengah pelepah, buang tulang tengah, dan keringkan dalam oven 60°C-70°C sebelum dihantar ke makmal akreditasi."
  },
  // 6. Kadar Upah Kerja Ladang (KUK SIRI 8)
  {
    manual_title: "Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8)",
    category: "Kadar Upah",
    section_title: "KUK SIRI 8: Kadar Upah Menuai & Memungut Buah Tandan Segar (BTS) Mengikut Ketinggian Pokok",
    page_number: 72,
    content: "Jadual Rasmi KUK SIRI 8 - Menuai BTS Sawit: 1. Pokok Rendah (<3.0m / Pahat): RM22.00 – RM26.00 / Tan. 2. Pokok Sederhana (3.0m–6.0m / Sabit Rendah): RM28.00 – RM34.00 / Tan. 3. Pokok Tinggi (6.0m–12.0m / Sabit Egrek): RM35.00 – RM45.00 / Tan. Elaun KUK SIRI 8: BTP/ABW >15kg (+RM3.00/tan), Cerun/Gambut (+RM3.50–RM5.00/tan), Biji relai bersih (+RM2.00/tan)."
  },
  {
    manual_title: "Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8)",
    category: "Kadar Upah",
    section_title: "KUK SIRI 8: Kadar Upah Pemangkasan Pelepah (Pruning) & Susun Pelepah",
    page_number: 74,
    content: "Jadual Rasmi KUK SIRI 8 - Pruning Pelepah Sawit: 1. Pokok Muda (3–7 tahun): RM0.80 – RM1.20 / Pokok. 2. Pokok Matang Penuh (8–14 tahun): RM1.30 – RM1.80 / Pokok. 3. Pokok Tinggi (>15 tahun): RM1.90 – RM2.50 / Pokok. Susunan Pelepah (Frond Stacking U-shape/Inter-row): Termasuk dalam pakej atau elaun tambahan RM0.30 / Pokok."
  },
  {
    manual_title: "Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8)",
    category: "Kadar Upah",
    section_title: "KUK SIRI 8: Kadar Upah Kutipan Biji Relai (Loose Fruits)",
    page_number: 76,
    content: "Jadual Rasmi KUK SIRI 8 - Kutipan Biji Relai: Kadar Standard: RM0.18 – RM0.28 / kg Biji Relai Bersih (atau RM18.00 – RM28.00 / Guni 100kg). Insentif Bebas Sampah/Tanah: Bonus RM0.05 / kg."
  },
  {
    manual_title: "Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8)",
    category: "Kadar Upah",
    section_title: "KUK SIRI 8: Kadar Upah Semburan Racun Herbisid, Pesticide & Trunk Injection",
    page_number: 78,
    content: "Jadual Rasmi KUK SIRI 8 - Semburan Racun: 1. Semburan Piringan/Lorong Menuai (Herbisid): RM25.00 – RM35.00 / Hektar. 2. Semburan Rumpai Liar/Woody Growth: RM38.00 – RM50.00 / Hektar. 3. Semburan Circle Weeding Pokok Muda: RM16.00 – RM22.00 / Hektar. 4. Trunk Injection Acephate: RM1.50 – RM2.20 / Pokok."
  },
  {
    manual_title: "Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8)",
    category: "Kadar Upah",
    section_title: "KUK SIRI 8: Kadar Upah Penaburan Baja Kimia, Mikronutrien & EFB",
    page_number: 80,
    content: "Jadual Rasmi KUK SIRI 8 - Tabur Baja & Mulsa: 1. Baja Berbutir (Urea, MOP, RP, NPK): RM25.00 – RM35.00 / Tan Baja (atau RM1.25–RM1.75 / Beg 50kg, RM0.35–RM0.50 / Pokok). 2. Baja Mikronutrien Borate: RM0.15 – RM0.25 / Pokok. 3. EFB Mulching (Tandan Kosong): RM12.00 – RM18.00 / Tan EFB."
  },
  {
    manual_title: "Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8)",
    category: "Kadar Upah",
    section_title: "KUK SIRI 8: Kadar Upah Penanaman, Sulaman (Supplying) & Kerja Infrastruktur",
    page_number: 82,
    content: "Jadual Rasmi KUK SIRI 8 - Tanam & Infrastruktur: 1. Tanam Anak Sawit Replanting: RM2.80 – RM4.00 / Pokok (gali lubang, buka polibeg, baja RP). 2. Sulaman (Supplying): RM4.50 – RM6.00 / Pokok. 3. Ablasi Bunga Awal: RM0.40 – RM0.60 / Pokok. 4. Cuci Parit Kontur Manual: RM1.80 – RM3.00 / Meter."
  },
  {
    manual_title: "Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8)",
    category: "Kadar Upah",
    section_title: "KUK SIRI 8: Kadar Upah Pengangkutan & Evakuasi BTS (Internal Evacuation & Transport)",
    page_number: 84,
    content: "Jadual Rasmi KUK SIRI 8 - Pengangkutan & Evakuasi BTS: 1. Evakuasi Dalam Ladang (Mini Traktor Grabber / Badang / Kereta Sorong Motor): RM8.00 – RM12.00 / Tan. 2. Memungut & Memuat BTS Manual ke Treler / Lori: RM6.00 – RM9.00 / Tan. 3. Pengangkutan Lori ke Kilang Sawit: Zon 1 (0–15 km): RM14.00 – RM18.00 / Tan; Zon 2 (>15–30 km): RM19.00 – RM25.00 / Tan; Zon 3 (>30 km): RM26.00 – RM35.00 / Tan. Syarat: Evakuasi selesai dalam 24 jam untuk kawal FFA <2.5% dan OER >20.0%."
  },
  // 7. Manual Panduan Kawalan Rumpai Ladang (Common Weeds & Herbicides Control)
  {
    manual_title: "Buku Panduan Kawalan Rumpai Ladang Sawit (Common Weeds of Plantations & Their Control)",
    category: "Manual Rumpai & Herbisid",
    section_title: "Kawalan Kimia & Dos Racun Rumput Israel (Asystasia gangetica)",
    page_number: 150,
    content: "Rumput Israel (Asystasia gangetica / Chinese Violet) - Kawalan Kimia & Dos Racun Herbisid: 1. Glyphosate-isopropylammonium (41% w/w): Kadar per hektar 1.5 - 2.0 L/ha. Sukatan bancuhan per pam 16 Liter: 53.3 ml - 71.1 ml / 16 L air (bersamaan 60 - 80 ml / 18 L air). 2. Metsulfuron-methyl (20% w/w): Kadar per hektar 75 - 100 g/ha. Sukatan bancuhan per pam 16 Liter: 2.0 - 2.67 g / 16 L air (bersamaan 2.25 - 3.0 g / 18 L air). Sesuai untuk semburan piringan dan lorong menuai di ladang sawit pra-matang dan matang."
  },
  {
    manual_title: "Buku Panduan Kawalan Rumpai Ladang Sawit (Common Weeds of Plantations & Their Control)",
    category: "Manual Rumpai & Herbisid",
    section_title: "Kawalan Kimia & Dos Racun Paku Larat (Nephrolepis biserrata)",
    page_number: 153,
    content: "Paku Larat / Paku Pedang (Nephrolepis biserrata / Broad Sword Fern) - Kawalan Kimia & Dos Racun: 1. Metsulfuron-methyl (20% w/w): Kadar 75 - 100 g/ha. Sukatan per pam 16 Liter: 2.0 - 2.67 g / 16 L air (bersamaan 2.25 - 3.0 g / 18 L air). 2. Triclopyr butoxyethyl ester (32% w/w): Kadar 0.5 - 0.75 L/ha. Sukatan per pam 16 Liter: 15 - 20 ml / 16 L air. Nota: Paku larat di pangkal pokok boleh dibiarkan nipis sebagai penutup bumi ringan melainkan terlalu tebal menutupi piringan."
  },
  {
    manual_title: "Buku Panduan Kawalan Rumpai Ladang Sawit (Common Weeds of Plantations & Their Control)",
    category: "Manual Rumpai & Herbisid",
    section_title: "Kawalan Kimia & Dos Racun Selaput Tunggul (Mikania micrantha)",
    page_number: 151,
    content: "Selaput Tunggul / Ceroma (Mikania micrantha / Mile-a-Minute) - Kawalan Kimia & Dos Racun: 1. Isopropylamine glyphosate (41% w/w): Kadar 1.0 - 1.5 L/ha. Sukatan per pam 16 Liter: 35.5 - 53.3 ml / 16 L air (bersamaan 40 - 60 ml / 18 L air). 2. Triclopyr (32% w/w): Kadar 0.3 - 0.5 L/ha. Sukatan per pam 16 Liter: 10 - 15 ml / 16 L air. Mikania perlu dikawal segera kerana sifat memanjatnya yang membantutkan pelepah sawit muda."
  },
  {
    manual_title: "Buku Panduan Kawalan Rumpai Ladang Sawit (Common Weeds of Plantations & Their Control)",
    category: "Manual Rumpai & Herbisid",
    section_title: "Kawalan Kimia & Dos Racun Lalang (Imperata cylindrica)",
    page_number: 148,
    content: "Lalang (Imperata cylindrica / Cogongrass) - Kawalan Kimia & Dos Racun: 1. Glyphosate-isopropylammonium (41% w/w): Kadar 4.5 - 6.0 L/ha. Sukatan per pam 16 Liter: 133.3 - 177.8 ml / 16 L air (bersamaan 150 - 200 ml / 18 L air). 2. Fluazifop-p-butyl (13.8% w/w): Kadar 1.5 - 2.0 L/ha. Sukatan per pam 16 Liter: 45 - 60 ml / 16 L air. Wajib lakukan pusingan semburan ulangan (wiping/spot spraying) 3-4 minggu selepas semburan pertama."
  },
  {
    manual_title: "Buku Panduan Kawalan Rumpai Ladang Sawit (Common Weeds of Plantations & Their Control)",
    category: "Manual Rumpai & Herbisid",
    section_title: "Kawalan Kimia & Dos Racun Paku Resam (Dicranopteris linearis)",
    page_number: 154,
    content: "Paku Resam (Dicranopteris linearis / Tropical Bracken) - Kawalan Kimia & Dos Racun: 1. Metsulfuron-methyl (20% w/w): Kadar 100 - 150 g/ha. Sukatan per pam 16 Liter: 2.67 - 4.0 g / 16 L air (bersamaan 3.0 - 4.5 g / 18 L air). 2. Glufosinate-ammonium (13.5% w/w): Kadar 2.5 - 3.0 L/ha. Sukatan per pam 16 Liter: 70 - 85 ml / 16 L air. Resam tebal perlu ditebas dahulu sebelum semburan racun kimia."
  },
  {
    manual_title: "Buku Panduan Kawalan Rumpai Ladang Sawit (Common Weeds of Plantations & Their Control)",
    category: "Manual Rumpai & Herbisid",
    section_title: "Kawalan Kimia & Dos Racun Senduduk & Senduduk Bulu (Melastoma & Clidemia hirta)",
    page_number: 152,
    content: "Senduduk (Melastoma malabathricum) & Senduduk Bulu (Clidemia hirta) - Kawalan Kimia & Dos Racun: 1. Triclopyr butoxyethyl ester (32% w/w): Kadar 0.75 - 1.0 L/ha. Sukatan per pam 16 Liter: 20 - 26.7 ml / 16 L air. 2. Metsulfuron-methyl (20% w/w): Kadar 75 g/ha. Sukatan per pam 16 Liter: 2.0 g / 16 L air. Campuran Triclopyr + Glyphosate sangat berkesan untuk rimbunan kayu renek tebal."
  },
  {
    manual_title: "Buku Panduan Kawalan Rumpai Ladang Sawit (Common Weeds of Plantations & Their Control)",
    category: "Manual Rumpai & Herbisid",
    section_title: "Kawalan Kimia & Dos Racun Pokok Kapal Terbang (Chromolaena odorata)",
    page_number: 152,
    content: "Pokok Kapal Terbang / Pokok Jepun (Chromolaena odorata / Siam Weed) - Kawalan Kimia & Dos Racun: 1. Triclopyr (32% w/w): Kadar 0.5 - 0.75 L/ha. Sukatan per pam 16 Liter: 15 - 20 ml / 16 L air. 2. Glyphosate (41% w/w) + Metsulfuron (20% w/w): Kadar 1.5 L/ha + 75 g/ha. Sukatan per pam 16 Liter: 53.3 ml Glyphosate + 2.0 g Metsulfuron / 16 L air."
  },
  {
    manual_title: "Buku Panduan Kawalan Rumpai Ladang Sawit (Common Weeds of Plantations & Their Control)",
    category: "Manual Rumpai & Herbisid",
    section_title: "Kawalan Kimia & Dos Racun Rumput Sembilu (Ottochloa nodosa)",
    page_number: 149,
    content: "Rumput Sembilu / Rumput Sarang Buaya (Ottochloa nodosa) - Kawalan Kimia & Dos Racun: 1. Glyphosate-isopropylammonium (41% w/w): Kadar 1.5 - 2.0 L/ha. Sukatan per pam 16 Liter: 44.4 - 59.3 ml / 16 L air (bersamaan 50 - 66.7 ml / 18 L air). 2. Glufosinate-ammonium (13.5% w/w): Kadar 1.5 - 2.0 L/ha. Sukatan per pam 16 Liter: 45 - 60 ml / 16 L air."
  },
  // 8. Manual Perolehan 2023 Pind. 2025
  {
    manual_title: "Manual Perolehan 2023 Pind. 2025",
    category: "Manual Perolehan 2023 Pind. 2025",
    section_title: "Had Nilai Kuasa Melulus & Kaedah Perolehan Ladang",
    page_number: 14,
    content: "Garis Panduan Had Nilai Kuasa Melulus & Kaedah Perolehan Mengikut Manual Perolehan 2023 Pind. 2025: 1. Pembelian Terus / Runcit (Had Nilai sehingga RM20,000): Boleh dilaksanakan melalui satu (1) sebut harga pembekal berdaftar yang sah. Kuasa Melulus: Pengurus Rancangan / Pengurus Ladang. 2. Sebut Harga Terhad Peringkat Wilayah (RM20,001 hingga RM50,000): Wajib sekurang-kurangnya tiga (3) sebut harga bertulis. Kuasa Melulus: PBW. 3. Sebut Harga Terbuka / Ibu Pejabat (RM50,001 hingga RM500,000): Sekurang-kurangnya lima (5) sebut harga rasmi. Kuasa Melulus: JSHIP. 4. Tender Terbuka (Melebihi RM500,000): Pengiklanan tender terbuka di portal rasmi dan akhbar utama, tempoh minimum 14–21 hari. Kuasa Melulus: Lembaga Perolehan."
  },
  {
    manual_title: "Manual Perolehan 2023 Pind. 2025",
    category: "Manual Perolehan 2023 Pind. 2025",
    section_title: "Prosedur Pesanan Belian Tempatan (LPO), Nota Hantaran (DO) & Penerimaan Barangan (GRN)",
    page_number: 28,
    content: "Tatacara Pengurusan Pesanan Belian & Penerimaan Barangan Mengikut Manual Perolehan 2023 Pind. 2025: 1. Pengeluaran LPO: LPO rasmi wajib dikeluarkan dan diluluskan SEBELUM sebarang pembekalan barangan atau kerja fizikal dimulakan. Dilarang LPO kebelakangan (Backdated LPO/PO). 2. Penerimaan & Pengesahan Barangan (DO & GRN): Penerimaan barangan fizikal di ladang disemak mengikut Surat Nota Hantaran (DO) dan GRN ditandatangani oleh Eksekutif/Kerani bersama cop tarikh. 3. Padanan 3 Dokumen (3-Way Matching): Bayaran kepada pembekal hanya diproses setelah padanan LPO, DO/GRN dan Invois disahkan betul."
  },
  {
    manual_title: "Manual Perolehan 2023 Pind. 2025",
    category: "Manual Perolehan 2023 Pind. 2025",
    section_title: "Pengurusan Kontraktor Ladang, Bon Pelaksanaan & Wang Jaminan Pelaksanaan (WJP)",
    page_number: 42,
    content: "Syarat Kelayakan Kontraktor & Pengurusan Jaminan Kontrak Mengikut Manual Perolehan 2023 Pind. 2025: 1. Pendaftaran: Kontraktor wajib berdaftar sah dengan SSM, MOF, CIDB, dan Panel Berdaftar Syarikat. 2. Bon Pelaksanaan (Performance Bond): Dikenakan bagi kontrak kerja ladang atau bekalan melebihi RM200,000. Kadar Bon adalah 5% daripada nilai kontrak dalam bentuk Bank Guarantee atau Draf Bank. 3. Wang Jaminan Pelaksanaan (WJP): Potongan 5% dikenakan ke atas setiap pembayaran kemajuan interim sehingga maksimum 5% nilai kontrak jika tiada Bon Pelaksanaan. Dilepaskan selepas DLP dan CPC."
  },
  {
    manual_title: "Manual Perolehan 2023 Pind. 2025",
    category: "Manual Perolehan 2023 Pind. 2025",
    section_title: "Perolehan Darurat (Emergency Procurement) & Pembaikan Jentera Segera",
    page_number: 56,
    content: "Tatacara Perolehan Darurat Mengikut Manual Perolehan 2023 Pind. 2025: 1. Takrifan Darurat Perladangan: Keadaan tidak dijangka yang menjejaskan keselamatan, kerosakan hasil BTS, benteng pecah atau serangan wabak ulat bungkus/kumbang tanduk mendadak. 2. Pelaksanaan Segera: Kerja pembaikan atau pembelian alat ganti boleh dimulakan serta-merta dengan kelulusan lisan Pengurus Besar Wilayah / Pengarah Operasi. 3. Dokumentasi Susulan: Laporan Justifikasi Darurat dan LPO rasmi diselesaikan dalam tempoh 7 hari bekerja."
  },
  // The Oil Palm, 5th Edition (R.H.V. Corley & P.B. Tinker)
  ...THE_OIL_PALM_5TH_EDITION_KNOWLEDGE_BASE.map(k => ({
    manual_title: k.manualTitle,
    category: k.category,
    section_title: `${k.chapter} - ${k.sectionTitle}`,
    page_number: k.pageNumber,
    content: k.content,
    tags: k.tags || []
  }))
];

import { calculateOkapiBM25Score, normalizeLexicalQuery } from './lexicalProcessor.service.js';

export async function fetchMslKnowledgeChunks(
  question: string, 
  category: string = 'Semua', 
  maxChunks: number = 10, 
  userScopedSupabase?: any,
  queryEmbedding?: number[] | null
): Promise<any[]> {
  const qLower = (question || '').toLowerCase();
  const normalizedQuery = normalizeLexicalQuery(question);
  let relevantChunks: any[] = [];
  const supabase = userScopedSupabase || getPrivilegedSupabase();
  let dbRows: any[] = [];

  const resolvedWeedInfo = resolveWeedFromQuery(question);

  if (supabase && process.env.NODE_ENV !== 'test') {
    try {
      const isUpahSearch = category === 'Kadar Upah' || qLower.includes('upah') || qLower.includes('kadar') || qLower.includes('kuk') || qLower.includes('gaji') || qLower.includes('bayaran');
      const isPerolehanSearch = category.toLowerCase().includes('perolehan') || qLower.includes('perolehan') || qLower.includes('tender') || qLower.includes('sebut harga') || qLower.includes('lpo') || qLower.includes('had nilai');
      const isWeedSearch = resolvedWeedInfo.weed !== null ||
                           category.toLowerCase().includes('rumpai') || category.toLowerCase().includes('kawalan') || 
                           category.toLowerCase().includes('herbisid') || qLower.includes('rumpai') || 
                           qLower.includes('racun') || qLower.includes('herbisid') || qLower.includes('lalang') || 
                           qLower.includes('asystasia') || qLower.includes('mikania') || qLower.includes('nephrolepis') || 
                           qLower.includes('paku') || qLower.includes('ottochloa') || qLower.includes('dicranopteris') || 
                           qLower.includes('stenochlaena') || qLower.includes('melastoma') || qLower.includes('clidemia') ||
                           qLower.includes('basmi') || qLower.includes('kimia') || qLower.includes('sembur') ||
                           qLower.includes('glyphosate') || qLower.includes('metsulfuron') || qLower.includes('glufosinate') ||
                           qLower.includes('paraquat') || qLower.includes('triclopyr');

      const isTheOilPalmSearch = category.toLowerCase().includes('the oil palm') || category.toLowerCase().includes('oil palm') || category.toLowerCase().includes('oil palam') || category.toLowerCase().includes('corley') || category.toLowerCase().includes('tinker') || category.toLowerCase().includes('5th') || category.toLowerCase().startsWith('top') ||
                                 qLower.includes('the oil palm') || qLower.includes('oil palm') || qLower.includes('oil palam') || qLower.includes('corley') || qLower.includes('tinker') || qLower.includes('5th edition') || qLower.includes('5th ed') || qLower.includes('bunch index') || qLower.includes('dry matter') || qLower.includes('dura') || qLower.includes('pisifera') || qLower.includes('tenera') || qLower.includes('avros') || qLower.includes('yangambi') || qLower.includes('ekona') || qLower.includes('frond 17') || qLower.includes('pelepah 17') || qLower.includes('ganoderma') || qLower.includes('basal stem rot') || qLower.includes('bsr');

      if (isTheOilPalmSearch || category === 'Semua') {
        try {
          const { data: topRows } = await supabase
            .from('the_oil_palm_knowledge')
            .select('id, manual_title, category, section_title, page_number, content, metadata')
            .limit(300);
          if (topRows && topRows.length > 0) {
            const existingIds = new Set(dbRows.map(r => r.id));
            const newTopRows = topRows.filter(r => !existingIds.has(r.id));
            dbRows = [...dbRows, ...newTopRows];
          }
        } catch (topErr) {
          console.warn("Notice: the_oil_palm_knowledge query:", topErr);
        }
      }

      if (isWeedSearch || category === 'Semua') {
        try {
          const { data: weedRows } = await supabase
            .from('manual_rumpai_knowledge')
            .select('id, manual_title, category, section_title, page_number, content, metadata')
            .limit(500);
          if (weedRows && weedRows.length > 0) {
            dbRows = [...dbRows, ...weedRows];
          }
        } catch (weedErr) {
          console.warn("Notice: manual_rumpai_knowledge query:", weedErr);
        }
      }

      const primaryTable = isUpahSearch ? 'kadar_upah_knowledge' : isWeedSearch ? 'manual_rumpai_knowledge' : 'manual_sawit_knowledge';

      // P0-2 FIX: Query candidates by topic/lexical relevance rather than physical row order truncation
      const coreSearchTerms = (normalizedQuery.terms || []).filter(t => t.length > 2 && !['apa', 'bagaimana', 'siapa', 'berapa', 'berapakah', 'apakah', 'yang', 'dan', 'dengan', 'untuk', 'pada', 'dalam', 'ialah', 'iaitu', 'kadar', 'dos', 'upah', 'gaji', 'jadual', 'table'].includes(t));

      if (coreSearchTerms.length > 0) {
        const ilikeCond = coreSearchTerms.map(t => `content.ilike.%${t}%,section_title.ilike.%${t}%`).join(',');
        const { data: topicRows } = await supabase
          .from(primaryTable)
          .select('id, manual_title, category, section_title, page_number, content, metadata')
          .or(ilikeCond)
          .limit(400);

        if (topicRows && topicRows.length > 0) {
          const existingIds = new Set(dbRows.map(r => r.id));
          const newTopicRows = topicRows.filter(r => !existingIds.has(r.id));
          dbRows = [...dbRows, ...newTopicRows];
        }
      }

      // Also fetch baseline rows if topic search returned few results
      if (dbRows.length < 50) {
        const { data: mainRows, error: dbErr } = await supabase
          .from(primaryTable)
          .select('id, manual_title, category, section_title, page_number, content, metadata')
          .limit(400);

        if (!dbErr && mainRows && mainRows.length > 0) {
          const existingIds = new Set(dbRows.map(r => r.id));
          const newRows = mainRows.filter(r => !existingIds.has(r.id));
          dbRows = [...dbRows, ...newRows];
        }
      }

      if (primaryTable !== 'manual_sawit_knowledge') {
        try {
          const { data: fallbackRows } = await supabase
            .from('manual_sawit_knowledge')
            .select('id, manual_title, category, section_title, page_number, content, metadata')
            .limit(100);
          if (fallbackRows && fallbackRows.length > 0) {
            const existingIds = new Set(dbRows.map(r => r.id));
            const newFallback = fallbackRows.filter(r => !existingIds.has(r.id));
            dbRows = [...dbRows, ...newFallback];
          }
        } catch (e) {}
      }

      try {
        const { data: pdfDocRows, error: pdfDocErr } = await supabase
          .from('pdf_documents')
          .select('id, file_name, topic, section, page_number, content, metadata')
          .limit(400);

        if (!pdfDocErr && pdfDocRows && pdfDocRows.length > 0) {
          const mappedPdfDocs = pdfDocRows.map(p => ({
            id: p.id,
            manual_title: p.file_name || 'Buku Panduan / Dokumen PDF',
            category: p.topic || (isUpahSearch ? 'Kadar Upah' : isPerolehanSearch ? 'Manual Perolehan 2023 Pind. 2025' : 'Manual Sawit'),
            section_title: p.section || p.file_name || 'Seksyen Dokumen',
            page_number: p.page_number || 1,
            content: p.content,
            metadata: p.metadata
          }));
          dbRows = [...dbRows, ...mappedPdfDocs];
        }
      } catch (pdfDocCheckErr) {}
    } catch (tableErr) {
      console.warn("Supabase table query notice in fetchMslKnowledgeChunks:", tableErr);
    }
  }

  const allCandidateChunks: any[] = [
    ...SEED_MANUAL_CHUNKS,
    ...dbRows
  ];

  const filteredChunks = category && category !== 'Semua'
    ? allCandidateChunks.filter(c => matchCategory(c.category || '', category, question))
    : allCandidateChunks;

  const chunksToEvaluate = filteredChunks.length > 0 ? filteredChunks : allCandidateChunks;

  // 1. Detect query characteristics
  const pageMatch = qLower.match(/(?:muka\s*surat|m\/s|ms|page)\s*[:.]?\s*(\d+)/i);
  const targetPage = pageMatch ? parseInt(pageMatch[1], 10) : null;
  const jadualMatch = qLower.match(/(?:jadual|table|no\.?\s*jadual)\s*[:.]?\s*([\d\.]+)/i);
  const targetJadual = jadualMatch ? jadualMatch[1] : null;

  const isNumericalOrTableQuery = Boolean(
    qLower.match(/\b(?:\d+(?:\.\d+)?|kadar|dos|sukatan|bancuhan|upah|gaji|rm|percent|peratus|nisbah|had|jadual|table|l\/ha|g\/ha|ml|kg|tan)\b/i) ||
    qLower.includes('berapa') || qLower.includes('berapakah') || qLower.includes('jadual') || targetJadual
  );

  const catLower = (category || '').toLowerCase();
  const isOilPalmBookQuery = catLower.includes('palm oil') || catLower.includes('oil palm') || catLower.includes('oil palam') || catLower.includes('5th') || catLower.includes('corley') || catLower.includes('tinker') || catLower.startsWith('top') ||
    qLower.includes('palm oil') || qLower.includes('the oil palm') || qLower.includes('oil palm') || qLower.includes('oil palam') || qLower.includes('corley') || qLower.includes('tinker') || qLower.includes('5th edition') || qLower.includes('5th ed') || qLower.includes('bunch index') || qLower.includes('dry matter') || qLower.includes('dura') || qLower.includes('pisifera') || qLower.includes('tenera') || qLower.includes('avros') || qLower.includes('yangambi') || qLower.includes('ekona') || qLower.includes('frond 17') || qLower.includes('pelepah 17');

  const totalDocs = chunksToEvaluate.length;
  let totalLen = 0;
  const docFreqMap: Record<string, number> = {};

  chunksToEvaluate.forEach(c => {
    const content = c.content || '';
    const len = content.split(/\s+/).length;
    totalLen += len;
    const contentLower = content.toLowerCase();
    for (const term of normalizedQuery.terms) {
      if (contentLower.includes(term)) {
        docFreqMap[term] = (docFreqMap[term] || 0) + 1;
      }
    }
  });
  const avgDocLen = totalLen / Math.max(1, totalDocs);

  // 2. Score candidate chunks with VECTOR AS PRIMARY and BM25 AS SECONDARY / LITERATURE OPTION
  const scored = chunksToEvaluate.map((c, index) => {
    const contentLower = (c.content || '').toLowerCase();
    const sectionLower = (c.section_title || '').toLowerCase();
    const titleLower = (c.manual_title || '').toLowerCase();
    const catLower = (c.category || '').toLowerCase();
    const text = `${titleLower} ${sectionLower} ${contentLower} ${catLower}`;

    // A. Vector Semantic Score (Primary)
    let vectorSemanticScore = 0.50; // base score

    // Compute embedding cosine similarity if vector is stored in metadata or DB
    if (queryEmbedding && Array.isArray((c as any).embedding || c.metadata?.embedding)) {
      const chunkEmb = (c as any).embedding || c.metadata?.embedding;
      if (Array.isArray(chunkEmb) && chunkEmb.length === queryEmbedding.length) {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < queryEmbedding.length; i++) {
          dotProduct += queryEmbedding[i] * chunkEmb[i];
          normA += queryEmbedding[i] * queryEmbedding[i];
          normB += chunkEmb[i] * chunkEmb[i];
        }
        if (normA > 0 && normB > 0) {
          vectorSemanticScore = Math.max(0, dotProduct / (Math.sqrt(normA) * Math.sqrt(normB)));
        }
      }
    }

    // Semantic domain term alignment for vector score
    let domainSemanticMatchCount = 0;
    for (const term of normalizedQuery.terms) {
      if (text.includes(term)) domainSemanticMatchCount++;
    }
    const semanticOverlapRatio = normalizedQuery.terms.length > 0 ? (domainSemanticMatchCount / normalizedQuery.terms.length) : 0;
    vectorSemanticScore = Math.min(0.99, vectorSemanticScore + (semanticOverlapRatio * 0.35));

    // Section Title and Tag Alignment Multiplier (Decisive signal)
    let sectionTitleBoost = 0;
    const qWords = qLower.split(/[\s,?.!]+/).filter(w => w.length > 2);
    for (const w of qWords) {
      if (sectionLower.includes(w)) {
        sectionTitleBoost += 0.30;
      }
    }
    // Exact 2-word phrase in section title
    for (let i = 0; i < qWords.length - 1; i++) {
      const phrase = `${qWords[i]} ${qWords[i+1]}`;
      if (phrase.length > 5 && sectionLower.includes(phrase)) {
        sectionTitleBoost += 0.50;
      }
    }

    // B. Table & Numerical Precision Booster
    const hasStructuredTableData = Boolean(
      contentLower.includes('|') || text.match(/\b\d+(?:\.\d+)?\s*(?:l\/ha|g\/ha|ml|kg|rm|tan|%|l|mm|guni|pelepah|cm|m)\b/i) ||
      text.includes('jadual') || text.includes('table') || text.includes('kadar upah') || text.includes('sukatan')
    );

    // P0-3 FIX: Topic Relevance MUST be established before granting numerical table boost
    const primaryTopicTerms = (normalizedQuery.terms || []).filter(t => 
      t.length > 2 && 
      !['kadar', 'dos', 'sukatan', 'bancuhan', 'upah', 'gaji', 'jadual', 'table', 'berapa', 'berapakah', 'apakah', 'ukuran', 'saiz', 'dimensi'].includes(t)
    );
    const hasTopicMatch = primaryTopicTerms.length === 0 || primaryTopicTerms.some(term => text.includes(term));

    let tableBoost = 0;
    if (isNumericalOrTableQuery && hasStructuredTableData && hasTopicMatch) {
      tableBoost += 0.25;
    }

    // Weed Table Precision Alignment
    if (resolvedWeedInfo.weed) {
      const { weed, expandedTerms } = resolvedWeedInfo;
      if (weed.tablePages.includes(c.page_number)) {
        tableBoost += 0.35;
      } else if (weed.profilePages.includes(c.page_number)) {
        tableBoost += 0.25;
      }
      for (const term of expandedTerms) {
        if (text.includes(term.toLowerCase())) {
          tableBoost += 0.05;
        }
      }
    }

    if (targetPage && c.page_number === targetPage) tableBoost += 0.20;
    if (targetJadual && text.includes(`jadual ${targetJadual}`)) tableBoost += 0.25;

    // C. BM25 Lexical Score
    const bm25Score = calculateOkapiBM25Score(
      question,
      c.content || '',
      (c.content || '').split(/\s+/).length,
      avgDocLen,
      totalDocs,
      docFreqMap
    );
    const normalizedBM25 = Math.min(1.0, bm25Score / 10.0);

    // D. True Hybrid Weighting (Balanced Dense Vector + Sparse BM25 + Section Title Boost)
    const vectorWeight = isNumericalOrTableQuery ? 0.50 : 0.60;
    const bm25Weight = isNumericalOrTableQuery ? 0.50 : 0.40;

    const baseScore = (vectorWeight * (vectorSemanticScore + tableBoost + sectionTitleBoost)) + (bm25Weight * normalizedBM25);
    const finalCombinedScore = baseScore + sectionTitleBoost;

    return {
      ...c,
      score: Number((finalCombinedScore * 100).toFixed(2)),
      vector_score: Number((vectorSemanticScore + tableBoost + sectionTitleBoost).toFixed(4)),
      keyword_score: Number(bm25Score.toFixed(4)),
      similarity: Math.min(0.99, Number((vectorSemanticScore + tableBoost + sectionTitleBoost).toFixed(4)))
    };
  });

  scored.sort((a, b) => b.score - a.score || b.vector_score - a.vector_score);
  relevantChunks = scored.slice(0, maxChunks);

  return relevantChunks;
}
