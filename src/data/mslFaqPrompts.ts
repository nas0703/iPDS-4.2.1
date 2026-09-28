export interface MslFaqPrompt {
  id: string;
  title: string;
  category: 'Kadar Upah' | 'Manual Perolehan 2023 Pind. 2025' | 'Manual Perolehan 2023' | 'Manual Rumpai Dan Kawalan' | 'Pembajaan' | 'Perparitan & Jalan' | 'Penuaian & Pruning' | 'Tapak Semaian' | 'Pra Matang' | 'MSPO & Perosak' | 'Mekanisasi';
  badge: string;
  query: string;
  description: string;
  tags: string[];
}

export const MSL_FAQ_CATEGORIES = [
  'Semua',
  'Manual Rumpai Dan Kawalan',
  'Kadar Upah',
  'Manual Perolehan 2023 Pind. 2025',
  'Pembajaan',
  'Perparitan & Jalan',
  'Penuaian & Pruning',
  'Tapak Semaian',
  'Pra Matang',
  'MSPO & Perosak',
  'Mekanisasi'
] as const;

export const MSL_FAQ_PROMPTS: MslFaqPrompt[] = [
  // 0. Manual Rumpai & Kawalan Kimia
  {
    id: 'faq-rumpai-1',
    title: 'Dos Herbisid Semburan Piringan & Lorong Menuai',
    category: 'Manual Rumpai Dan Kawalan',
    badge: 'Kawalan Herbisid',
    query: 'Apakah formulasi bahan aktif dan dos campuran racun herbisid (Glyphosate + Metsulfuron) untuk semburan bulatan piringan dan lorong menuai bagi setiap pam 18 Liter?',
    description: 'Panduan sukatan racun per pam 18L dan per hektar untuk rumput campuran dan daun lebar lembut.',
    tags: ['manual rumpai dan kawalan', 'rumpai', 'glyphosate', 'metsulfuron', 'dos pam 18l', 'piringan', 'lorong menuai']
  },
  {
    id: 'faq-rumpai-2',
    title: 'Kawalan Khusus Asystasia & Mikania micrantha',
    category: 'Manual Rumpai Dan Kawalan',
    badge: 'Rumpai Daun Lebar',
    query: 'Bagaimanakah kaedah kawalan kimia terbaik bagi rumpai menjalar Asystasia gangetica (Akar Ruas-ruas) dan Mikania micrantha menggunakan Fluroxypyr / Triclopyr?',
    description: 'SOP pembasmian rumpai pemanjat agresif di bawah pelepah sawit matang dan kawasan terbuka.',
    tags: ['manual rumpai dan kawalan', 'asystasia', 'mikania', 'fluroxypyr', 'triclopyr', 'daun lebar', 'racun']
  },
  {
    id: 'faq-rumpai-3',
    title: 'SOP Meracun Sawit Pra-Matang (<3 Tahun) & Glufosinate',
    category: 'Manual Rumpai Dan Kawalan',
    badge: 'Sawit Muda & GAP',
    query: 'Mengapakah Glyphosate dilarang pada pokok sawit muda (< 3 tahun) dan apakah dos bancuhan Glufosinate-ammonium (Basta) dengan nozel bersungkup?',
    description: 'Perlindungan pelepah muda dan sistem akar pokok muda daripada fitotoksisiti racun serap.',
    tags: ['manual rumpai dan kawalan', 'glufosinate', 'basta', 'sawit muda', 'pra matang', 'sungkup', 'nozel']
  },
  // 0. Kadar Upah Kerja Ladang
  {
    id: 'faq-upah-1',
    title: 'Kadar Upah Menuai BTS & Elaun Pokok Tinggi',
    category: 'Kadar Upah',
    badge: 'Kadar Upah & Kontrak',
    query: 'Berapakah jadual kadar upah menuai dan memungut BTS per tan mengikut ketinggian pokok (pahat vs sabit) berserta elaun cerun dan BTP?',
    description: 'Rincian kadar upah penuaian mengikut fasa pokok rendah, sederhana dan tinggi berserta insentif.',
    tags: ['kadar upah', 'upah tuai', 'bts', 'pahat', 'sabit', 'pokok tinggi', 'abw', 'gaji']
  },
  {
    id: 'faq-upah-2',
    title: 'Kadar Upah Pruning & Susun Pelepah',
    category: 'Kadar Upah',
    badge: 'Kadar Upah & Kontrak',
    query: 'Apakah jadual kadar upah pemangkasan pelepah (pruning) dan susun pelepah mengikut peringkat umur pokok sawit?',
    description: 'Kadar upah per pokok untuk pruning pokok muda, matang dan tinggi.',
    tags: ['kadar upah', 'upah pruning', 'pemangkasan pelepah', 'susun pelepah', 'cantas pelepah']
  },
  {
    id: 'faq-upah-3',
    title: 'Kadar Upah Meracun & Semburan Herbisid',
    category: 'Kadar Upah',
    badge: 'Kadar Upah & Kontrak',
    query: 'Berapa kadar upah kerja semburan racun herbisid piringan, meracun rumpai liar per hektar, dan trunk injection?',
    description: 'Kadar upah semburan racun mengikut hektar dan pokok.',
    tags: ['kadar upah', 'upah meracun', 'semburan racun', 'herbisid', 'trunk injection']
  },
  {
    id: 'faq-upah-4',
    title: 'Kadar Upah Tabur Baja & EFB Mulching',
    category: 'Kadar Upah',
    badge: 'Kadar Upah & Kontrak',
    query: 'Berapa kadar upah penaburan baja kimia per tan/beg dan kadar upah aplikasi tandan kosong (EFB mulching)?',
    description: 'Kadar upah tabur baja berbutir, borat dan tandan kosong.',
    tags: ['kadar upah', 'upah membaja', 'tabur baja', 'efb', 'mop', 'urea']
  },
  {
    id: 'faq-upah-5',
    title: 'Kadar Upah Kutipan Biji Relai',
    category: 'Kadar Upah',
    badge: 'Kadar Upah & Kontrak',
    query: 'Berapakah kadar upah kutipan biji relai bersih per kg atau per guni 100kg berserta insentif kualiti?',
    description: 'Kadar upah kutipan loose fruits per kg dan per guni 100kg.',
    tags: ['kadar upah', 'upah biji relai', 'loose fruits', 'guni', 'biji relai']
  },
  // 0.1 Manual Perolehan 2023 Pind. 2025
  {
    id: 'faq-perolehan-1',
    title: 'Had Nilai Kuasa Melulus & Kaedah Perolehan Ladang',
    category: 'Manual Perolehan 2023 Pind. 2025',
    badge: 'Perolehan 2023 (Pind. 2025)',
    query: 'Berapakah had nilai kuasa melulus untuk pembelian terus, sebut harga terhad wilayah, dan tender terbuka mengikut Manual Perolehan 2023 Pind. 2025?',
    description: 'Panduan had nilai kuasa melulus pembelian ladang dari Pengurus Rancangan hingga Lembaga Perolehan.',
    tags: ['manual perolehan 2023 pind. 2025', 'manual perolehan 2023', 'perolehan', 'had kuasa', 'sebut harga', 'tender', 'pembelian terus']
  },
  {
    id: 'faq-perolehan-2',
    title: 'Prosedur LPO, Penerimaan DO & Perakuan Bayaran 3-Way Matching',
    category: 'Manual Perolehan 2023 Pind. 2025',
    badge: 'Perolehan 2023 (Pind. 2025)',
    query: 'Bagaimanakah SOP pengeluaran Pesanan Belian Tempatan (LPO), pengesahan Nota Hantaran (DO/GRN) dan perakuan bayaran kontraktor mengikut Manual Perolehan 2023 Pind. 2025?',
    description: 'Tatacara pengeluaran pesanan belian sebelum kerja dimulakan dan padanan dokumen bayaran.',
    tags: ['manual perolehan 2023 pind. 2025', 'manual perolehan 2023', 'lpo', 'po', 'do', 'grn', 'pesanan belian', 'bayaran kontraktor']
  },
  {
    id: 'faq-perolehan-3',
    title: 'Syarat Kontraktor Ladang, Bon Pelaksanaan & Wang Jaminan (WJP)',
    category: 'Manual Perolehan 2023 Pind. 2025',
    badge: 'Perolehan 2023 (Pind. 2025)',
    query: 'Apakah syarat kelayakan kontraktor ladang serta kadar Bon Pelaksanaan (5%) dan Wang Jaminan Pelaksanaan (WJP) dalam Manual Perolehan 2023 Pind. 2025?',
    description: 'Syarat pendaftaran SSM/CIDB, jaminan bank bon pelaksanaan, dan potongan retention sum.',
    tags: ['manual perolehan 2023 pind. 2025', 'manual perolehan 2023', 'kontraktor', 'bon pelaksanaan', 'wjp', 'retention sum', 'cidb']
  },
  // 1. Pembajaan
  {
    id: 'faq-baja-1',
    title: 'Jadual & Pusingan Pembajaan 4T',
    category: 'Pembajaan',
    badge: 'Amalan 4T & Produktiviti',
    query: 'Apakah piawaian produktiviti membaja, prinsip 4T dan jadual master pusingan pembajaan sawit (P1 - P4) mengikut kaedah manual dan mekanisasi?',
    description: 'Rangkuman jadual pusingan (P1-P4), kadar keluasan harian, dan prinsip Tepat Masa, Dos, Kaedah & Tempat.',
    tags: ['pembajaan', '4t', 'produktiviti', 'jadual', 'pusingan', 'spreader', 'subsoil', 'manual']
  },
  {
    id: 'faq-baja-2',
    title: 'Diagnostik Kekurangan Nutrien Daun',
    category: 'Pembajaan',
    badge: 'Nutrisi & Agronomi',
    query: 'Bagaimana mendiagnosis simptom visual kekurangan nutrien N, P, K, Mg dan Boron pada daun pokok sawit serta dos pembetulan yang disyorkan?',
    description: 'Panduan visual simptom kekurangan zat utama (daun oren/kuning/putih) dan kaedah pemulihan.',
    tags: ['nutrien', 'daun', 'boron', 'magnesium', 'nitrogen', 'kieserite', 'mop', 'simptom']
  },
  {
    id: 'faq-baja-3',
    title: 'SOP Pembajaan Pokok Pra Matang vs Matang',
    category: 'Pembajaan',
    badge: 'SOP & Zon Taburan',
    query: 'Apakah perbezaan SOP zon taburan baja, jejari piring taburan, dan jenis baja antara pokok pra matang (T1 - T3) dengan pokok matang (T4 ke atas)?',
    description: 'Ukuran jejari taburan baja dari pangkal pokok dan jenis baja sebatian vs lurus mengikut fasa umur.',
    tags: ['pra matang', 'pokok matang', 'jejari taburan', 'piring', 'sebatian', 'lurus', 'dos']
  },

  // 2. Perparitan & Jalan
  {
    id: 'faq-parit-1',
    title: 'Spesifikasi Saiz & Nisbah Parit Ladang',
    category: 'Perparitan & Jalan',
    badge: 'Spesifikasi Teknikal',
    query: 'Apakah spesifikasi ukuran lebar atas, lebar bawah, kedalaman dan nisbah kecerunan bagi Parit Utama (Main Drain), Parit Sekunder (Collection Drain) dan Parit Ladang (Field Drain) mengikut MSL?',
    description: 'Ukuran dimensi dan piawaian kejuruteraan saliran ladang untuk mengelakkan banjir dan air bertakung.',
    tags: ['parit', 'saliran', 'main drain', 'field drain', 'collection drain', 'kedalaman', 'lebar']
  },
  {
    id: 'faq-parit-2',
    title: 'Lebar Jalan Pertanian & Parit Tepi Jalan',
    category: 'Perparitan & Jalan',
    badge: 'Infrastruktur Jalan',
    query: 'Berapakah standard lebar Jalan Utama (Main Road), Jalan Pengumpulan (Collection Road) dan spesifikasi pembinaan parit tepi jalan serta parit pintas (Scour Check)?',
    description: 'Piawaian lebar jalan lori, jalan traktor, parit jalan dan benteng penahan hakisan air bukit.',
    tags: ['jalan', 'main road', 'collection road', 'lebar jalan', 'scour check', 'parit jalan']
  },
  {
    id: 'faq-parit-3',
    title: 'Pembinaan Teres Bukit & Benteng Kontur',
    category: 'Perparitan & Jalan',
    badge: 'Konservasi Tanah',
    query: 'Apakah kriteria pembinaan teres bukit bagi tanah bercerun melebihi 12 darjah, spesifikasi lebar tapak teres (Backslope), sudut pemotongan dan parit penahan air (Stop Bund)?',
    description: 'SOP pembinaan teres kontur lereng bukit bagi memelihara kelembapan tanah dan memudahkan operasi menuai.',
    tags: ['teres', 'kecerunan', 'bukit', 'backslope', 'stop bund', 'hakisan', 'kontur']
  },

  // 3. Penuaian & Pruning
  {
    id: 'faq-tuai-1',
    title: 'Standard Kematangan BTS & Biji Relai',
    category: 'Penuaian & Pruning',
    badge: 'Kualiti BTS & OER',
    query: 'Apakah standard kematangan Buah Tandan Segar (BTS) mengikut MSL, kriteria tandan masak (minimum biji relai segar), kadar penalti denda buah mentah dan SOP kutipan biji relai di piring?',
    description: 'Kriteria penerimaan kilang (1 biji relai segar/tandan) dan kawalan penalti buah mentah/tangkai panjang.',
    tags: ['bts', 'kematangan', 'biji relai', 'buah mentah', 'penuaian', 'penalti', 'oer']
  },
  {
    id: 'faq-tuai-2',
    title: 'SOP Pruning & Bilangan Pelepah Pokok Matang',
    category: 'Penuaian & Pruning',
    badge: 'Kuantiti Pelepah',
    query: 'Berapakah bilangan pelepah minimum yang wajib ditinggalkan bagi pokok sawit matang mengikut peringkat umur (bawah 8 tahun vs atas 8 tahun) dan SOP pemotongan pelepah (Songgo 1 vs Songgo 2)?',
    description: 'Piawaian bilangan pelepah (40-48 pelepah) dan amalan songgo satu / songgo dua semasa menuai.',
    tags: ['pruning', 'pelepah', 'cantas', 'pokok matang', 'songgo satu', 'songgo dua', 'umur']
  },
  {
    id: 'faq-tuai-3',
    title: 'Pusingan Penuaian & Kawalan Buah Busuk',
    category: 'Penuaian & Pruning',
    badge: 'Pusingan & FFA',
    query: 'Apakah piawaian selang masa pusingan penuaian (Harvesting Interval 10-14 hari), had kelewatan pusingan, dan cara mencegah peningkatan kadar Asid Lemak Bebas (FFA)?',
    description: 'Kawalan pusingan tuai optimum untuk mengekalkan FFA rendah dan mencegah buah rosak/terlepas pusingan.',
    tags: ['pusingan tuai', 'interval', 'ffa', 'buah busuk', 'kualiti', 'penuaian']
  },

  // 4. Tapak Semaian
  {
    id: 'faq-semai-1',
    title: 'Kriteria Penakaian (Culling) Anak Benih',
    category: 'Tapak Semaian',
    badge: 'Kualiti Benih',
    query: 'Apakah kriteria visual dan peratusan penakaian (culling rate) anak benih sawit di tapak semaian awal (Pre-Nursery) dan tapak semaian utama (Main Nursery) mengikut MSL?',
    description: 'Mengenal pasti abnormaliti anak benih seperti chimera, daun tegak (erect), berpintal (twisted) dan kerdil.',
    tags: ['tapak semaian', 'culling', 'penakaian', 'anak benih', 'pre-nursery', 'main nursery', 'abnormal']
  },
  {
    id: 'faq-semai-2',
    title: 'Penyiraman & Pembajaan Tapak Semaian',
    category: 'Tapak Semaian',
    badge: 'Pengairan & Nutrisi',
    query: 'Apakah jadual kadar penyiraman harian (sistem sprinkler/titik) dan program pembajaan anak benih di tapak semaian dari umur 1 hingga 12 bulan?',
    description: 'Keperluan air per anak benih sehari (25-30mm) dan formulasi baja foliar serta sebatian semaian.',
    tags: ['penyiraman', 'sprinkler', 'baja semaian', 'pre-nursery', 'main nursery', 'polibeg']
  },

  // 5. Pra Matang & Tanam Semula
  {
    id: 'faq-pra-1',
    title: 'Penanaman Kekacang Penutup Bumi (LCC)',
    category: 'Pra Matang',
    badge: 'LCC Mucuna Bracteata',
    query: 'Apakah SOP penyediaan, kadar penanaman biji benih kekacang penutup bumi Mucuna bracteata, dan jadual kawalan rumpai liar di kawasan tanam semula?',
    description: 'Faedah LCC untuk kawalan hakisan, pengikatan nitrogen, penindasan rumpai, dan kawalan Oryctes.',
    tags: ['lcc', 'mucuna bracteata', 'penutup bumi', 'tanam semula', 'rumpai', 'pra matang']
  },
  {
    id: 'faq-pra-2',
    title: 'Jarak Tanaman & Kepadatan Hektar',
    category: 'Pra Matang',
    badge: 'Geometri Tanaman',
    query: 'Apakah spesifikasi jarak tanaman sistem segitiga sama sisi 9.0 meter, formula penentuan kepadatan pokok per hektar (148 p/ha) dan teknik pembarisan di kawasan beralun/berteres?',
    description: 'Piawaian 9.0m x 9.0m x 9.0m sistem segitiga untuk 148 pokok/hektar dan garisan panduan kontur.',
    tags: ['jarak tanaman', 'kepadatan', '148 pokok', 'segitiga', 'lining', 'barisan']
  },

  // 6. MSPO & Kawalan Perosak
  {
    id: 'faq-mspo-1',
    title: 'Zon Penampan Sungai (Riparian Reserve)',
    category: 'MSPO & Perosak',
    badge: 'Piawaian MSPO 2022',
    query: 'Berapakah ukuran kelebaran zon penampan sungai (Riparian Reserve) mengikut kelebaran alur sungai berdasarkan piawaian MSPO, serta senarai aktiviti yang dilarang di zon ini?',
    description: 'Had lebar zon rizab sungai (5m hingga 50m) dan larangan aplikasi racun/baja kimia serta penanaman baharu.',
    tags: ['mspo', 'riparian', 'sungai', 'zon penampan', 'kelestarian', 'alam sekitar']
  },
  {
    id: 'faq-mspo-2',
    title: 'Pengurusan Perosak Bersepadu (IPM)',
    category: 'MSPO & Perosak',
    badge: 'IPM & Biologi',
    query: 'Apakah nisbah pemasangan kotak sarang burung hantu (Tyto alba) per hektar untuk kawalan tikus dan ambang tindakan (ETL) bagi semburan ulat bungkus (Metisa plana/Mahasena corbetti)?',
    description: 'SOP 1 kotak sarang setiap 10-15 hektar dan had ambang kritikal (10 larva/pelepah) sebelum rawatan kimia.',
    tags: ['ipm', 'burung hantu', 'tyto alba', 'ulat bungkus', 'tikus', 'metisa plana', 'etl']
  },

  // 7. Mekanisasi Ladang
  {
    id: 'faq-mekanisasi-1',
    title: 'Mekanisasi Pembajaan (Spreader & Subsoil)',
    category: 'Mekanisasi',
    badge: 'Jentera & Produktiviti',
    query: 'Apakah spesifikasi operasi mekanisasi pembajaan menggunakan traktor spreader (tabur rawak) dan subsoil pocketing, perbandingan produktiviti (hektar/hari), dan kesesuaian jenis tanah?',
    description: 'Perbandingan output 15-25 ha/hari (Spreader) vs 8-12 ha/hari (Subsoiler) dan topografi yang dibenarkan.',
    tags: ['mekanisasi', 'spreader', 'subsoil', 'traktor', 'pocketing', 'produktiviti']
  },
  {
    id: 'faq-mekanisasi-2',
    title: 'Mekanisasi Pengangkutan Dalam Ladang (In-Field)',
    category: 'Mekanisasi',
    badge: 'Kutipan BTS Lapangan',
    query: 'Apakah kriteria penggunaan jentera pengangkut dalam ladang seperti Badang, Mini Tractor Grabber dan Treler Hi-Lift untuk mengoptimumkan kutipan BTS ke platform?',
    description: 'SOP penggunaan mesin Badang & Mini Grabber bagi mengurangkan kebergantungan buruh menuai.',
    tags: ['badang', 'mini tractor', 'grabber', 'in-field', 'kutipan bts', 'mekanisasi']
  }
];
