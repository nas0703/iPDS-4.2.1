/**
 * Manual Sawit Lestari Knowledge Base & SOP Agronomi (MPOB / MSPO / GAP)
 * 5 Tajuk Utama:
 * 1. Tapak Semaian (Nursery)
 * 2. Pembangunan Tanam Semula (Replanting)
 * 3. Pra Matang (Immature)
 * 4. Pokok Matang (Mature Estate Management & Harvesting SOP)
 * 5. Pembajaan & Pengurusan Nutrisi (Fertilizer Program & Soil-Plant Health)
 */

import { MANUAL_RUMPAI_DAN_KAWALAN_KNOWLEDGE } from './manualRumpaiDanKawalan';
import { THE_OIL_PALM_5TH_EDITION_KNOWLEDGE_BASE } from './theOilPalmKnowledge';

export interface ManualChunk {
  id?: string;
  documentId?: string;
  manualTitle: string;
  category: 'Tapak Semaian' | 'Pembangunan Tanam Semula' | 'Pra Matang' | 'Pokok Matang' | 'Matang' | 'Pembajaan' | 'Kadar Upah' | 'Manual Perolehan 2023 Pind. 2025' | 'Manual Perolehan 2023' | 'Perolehan' | 'Manual Rumpai Dan Kawalan' | 'Kawalan Rumpai' | 'The Oil Palm, 5th Edition' | (string & {});
  sectionTitle: string;
  pageNumber: number;
  content: string;
  tags: string[];
  weedProfiles?: any[];
}

export const MANUAL_SAWIT_KNOWLEDGE_BASE: ManualChunk[] = [
  // ==========================================
  // 1. TAPAK SEMAIAN (NURSERY)
  // ==========================================
  {
    manualTitle: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Tapak Semaian",
    sectionTitle: "Pengurusan Tapak Semaian Peringkat Awal (Pre-Nursery)",
    pageNumber: 8,
    content: `Tapak semaian peringkat awal (Pre-Nursery) dijalankan selama 3 hingga 4 bulan menggunakan polibeg kecil (saiz 15 cm x 23 cm) yang diisi dengan tanah atas (topsoil) bertekstur lempung berpasir yang telah diayak.
Keperluan utama:
1. Naungan: Sediakan jaring naungan 50% untuk bulan pertama bagi mengelakkan daun anak benih terbakar oleh terik matahari.
2. Penyiraman: Siram 2 kali sehari (pagi dan lewat petang) dengan kadar sekurang-kurangnya 4–5 mm air sehari.
3. Penyingkiran Benih Abnormal (Culling): Singkirkan anak benih yang menunjukkan tanda 'twisted leaf', 'crinkled leaf', daun sempit (narrow leaf), daun bergulung, atau bantut. Kadar penyingkiran standard peringkat pre-nursery adalah 5% hingga 8%.`,
    tags: ["tapak semaian", "pre-nursery", "polibeg", "culling", "penyiraman", "naungan", "anak benih"]
  },
  {
    manualTitle: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Tapak Semaian",
    sectionTitle: "Pengurusan Tapak Semaian Utama (Main Nursery) & Culling Akhir",
    pageNumber: 12,
    content: `Main Nursery menempatkan anak benih dari umur 4 bulan hingga 12–14 bulan dalam polibeg besar (saiz 38 cm x 50 cm atau 45 cm x 45 cm) dengan jarak susunan segi tiga 0.9 m x 0.9 m.
Amalan Pengurusan:
1. Pengairan: Sistem pengairan renjis (sprinkler system) dengan bekalan air minimum 8–10 liter setiap polibeg sehari.
2. Pembajaan: Gunakan baja sebatian berbutir (cth. NPK 15:15:6:4 atau baja pelepasan terkawal/CRF) setiap 4 minggu bersama aplikasi mikronutrien jika perlu.
3. Standard Culling Peringkat Akhir: Sebelum dihantar ke ladang, lakukan pemilihan ketat (final culling rate 5%–10%). Tolak pokok steril, pokok 'juvenile', 'erect/vertikal', 'flat top', 'short internode', atau diserang penyakit Curvularia/bintik daun yang teruk. Jumlah culling kumulatif (pre + main) adalah antara 10%–15%.`,
    tags: ["main nursery", "pengairan renjis", "polibeg besar", "culling rate", "npk nursery", "pemilihan anak benih"]
  },

  // ==========================================
  // 2. PEMBANGUNAN TANAM SEMULA (REPLANTING)
  // ==========================================
  {
    manualTitle: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Pembangunan Tanam Semula",
    sectionTitle: "Jarak Tanaman Sawit di Ladang, Pembarisan (Linning) & Lubang Tanaman (Holing)",
    pageNumber: 21,
    content: `Spesifikasi Jarak Tanaman Sawit, Kepadatan & Lubang Tanaman di Ladang:

1. Sistem & Jarak Tanaman Standard:
   - Sistem Susunan: Segi Tiga Sama Sisi (Equilateral Triangular Pattern) arah Utara-Selatan bagi memastikan setiap pokok menerima taburan cahaya matahari maksimum (mengurangkan kesan teduhan kanopi).
   - Jarak Tanaman Standard: 9.0 m x 9.0 m x 9.0 m (Jarak antara pokok = 9.0 meter, Jarak antara barisan pokok = 7.79 meter / 7.8 meter).
   - Kepadatan Pokok (Planting Density): 136 hingga 148 pokok/hektar (bersamaan 55 hingga 60 pokok/ekar).
     * Tanah Mineral (Rata/Beralun): 136 pokok/hektar (9.0 m x 9.0 m).
     * Tanah Berpasir / Gambut / Klon Pelepah Tegak (cth. Dumpy/Compact): 148 pokok/hektar (8.5 m x 8.5 m x 8.5 m).

2. Kerja Pembarisan & Penandaan (Linning):
   - Gunakan pancang kayu dan dawai pembaris bertanda untuk menetapkan titik penanaman yang lurus dan tepat mengikut grid segi tiga sama.

3. Penyediaan Lubang Tanaman (Holing) & Pembajaan Asas:
   - Saiz Lubang: 60 cm x 60 cm x 60 cm (atau sekurang-kurangnya 1.5 kali saiz polibeg anak benih).
   - Rawatan Lubang: Tabur 500 gram baja Rock Phosphate (RP / CIRP - Christmas Island Rock Phosphate) di dasar lubang dan gaul bersama tanah atas (topsoil) sebelum memasukkan anak benih bagi merangsang pertumbuhan akar baharu.
   - Penanaman: Potong dan tanggalkan plastik polibeg dengan cermat tanpa memecahkan bebola tanah (root ball). Timbus tanah dan padatkan keliling pangkal pokok setinggi paras kolar tanah anak benih.`,
    tags: ["jarak tanaman", "jarak sawit", "jarak tanaman sawit", "kepadatan pokok", "segi tiga sama", "9m x 9m", "136 pokok", "148 pokok", "lubang tanaman", "holing", "linning", "pembarisan", "rock phosphate"]
  },
  {
    manualTitle: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Pembangunan Tanam Semula",
    sectionTitle: "Penyediaan Kawasan, Teknik Tebang Cincang & Kawalan Ganoderma",
    pageNumber: 16,
    content: `Pembangunan Tanam Semula (Replanting) mengikut piawaian MSPO dan Akta Kualiti Alam Sekeliling mewajibkan Teknik Tanpa Bakar (Zero Burning Technique).
Langkah Utama:
1. Penumbangan & Pencincangan: Pokok tua ditumbang dan batang dicincang halus (ketebalan 5–10 cm) menggunakan jentera ekskavator dengan 'chipping bucket'. Batang disusun di lorong antara barisan pokok bagi mempercepatkan pereputan semula jadi.
2. Pencegahan Ganoderma: Korek lubang penanaman dan buat sanitasi fasa tanah (de-stumping / sanitasi tunggul dan akar) terutamanya di kawasan bekas serangan reput pangkal batang (BSR - Ganoderma boninense).
3. Pengawalan Kumbang Tanduk (Oryctes rhinoceros): Pencincangan batang yang cepat reput mengurangkan tapak pembiakan kumbang tanduk secara biologi tanpa bergantung kepada racun kimia berlebihan.`,
    tags: ["tanam semula", "replanting", "zero burning", "tebang cincang", "ganoderma", "kumbang tanduk", "sanitasi tunggul"]
  },
  {
    manualTitle: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Pembangunan Tanam Semula",
    sectionTitle: "Penanaman Tanaman Penutup Bumi Kekacang (LCC) - Spesies & Amalan Agronomi",
    pageNumber: 20,
    content: `Penanaman Tanaman Penutup Bumi Kekacang (Legume Cover Crop - LCC) adalah mandatori dalam amalan agronomi lestari tanam semula:
1. Spesies Disyorkan: Campuran Mucuna bracteata bersama Pueraria javanica (PJ) dan Calopogonium mucunoides (CM). Mucuna bracteata mempunyai daya tahan kemarau tinggi, pertumbuhan kanopi tebal, dan sistem perakaran dalam.
2. Fungsi LCC: Menghalang hakisan tanah di kawasan berbukit dan terbuka, memelihara kelembapan tanah, menyekat pertumbuhan rumpai liar berbahaya (seperti lalang dan Mikania), serta mengikat Nitrogen atmosfera ke dalam tanah (sehingga 150–200 kg N/ha/tahun).
3. Kadar Campuran & Inokulasi: 50 g Mucuna bracteata + 2.0 kg PJ + 3.0 kg CM sehektar. Biji benih digaul bersama inokulan Rhizobium dan Rock Phosphate (RP/CIRP) sebelum disemai di lorong antara barisan.`,
    tags: ["lcc", "mucuna bracteata", "pueraria javanica", "calopogonium", "penutup bumi", "legume cover crop", "nitrogen fixation", "hakisan"]
  },
  {
    manualTitle: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Pembangunan Tanam Semula",
    sectionTitle: "Spesifikasi Pembinaan Teres Kontur, Ukuran Tapak Teres, Back-slope & Benteng Hentian (Stop Bunds)",
    pageNumber: 21,
    content: `Spesifikasi Lengkap Ukuran Teres Kontur & Pembinaan Teres Bukit mengikut Piawaian Manual Sawit Lestari (MSL) & GAP:

### 1. Jadual Spesifikasi Dimensi & Ukuran Teres

| Elemen Teres | Spesifikasi Standard MSL | Julat Operasi Ladang | Fungsi & Kawalan Kualiti |
| :--- | :--- | :--- | :--- |
| **Lebar Tapak Teres (Width)** | **3.5 meter – 4.0 meter** | 3.5 m hingga 4.5 m | Menyediakan laluan jentera mekanisasi (mini traktor / grabber), laluan pekerja menuai & keselamatan operasi. |
| **Cerun Ke Dalam (Back-slope / Inward Slope)** | **5° hingga 10° (Nisbah 1:10 hingga 1:12)** | 1:10 – 1:12 | Tapak teres dipotong condong ke arah dinding bukit (hill face) untuk memerangkap air hujan & baja serta menghalang runtuhan tebing luar. |
| **Benteng Hentian (Stop Bunds / Earth Stops)** | **Tinggi 30 cm – 45 cm, Lebar 45 cm – 60 cm** | Selang setiap **20 m – 30 m** | Dibina melintang teres untuk menyekat larian air deras (prevent gullying), menakung air setempat & memelihara kelembapan tanah. |
| **Kecerunan Tebing Potongan (Cut Batter)** | **1:1 (45°)** | 1:0.5 (tanah keras) hingga 1:1 (tanah biasa) | Sudut pemotongan dinding tebing bukit yang stabil bagi mengelakkan tanah runtuh menimbus teres. |
| **Kedudukan Lubang Tanam (Planting Point)** | **1.0 m – 1.5 m dari bibir luar teres** | 1/3 ke arah dinding bukit | Anak benih ditanam pada tanah potongan asal yang kukuh dan subur (cut portion), bukan pada tanah timbusan luar yang longgar (fill portion). |
| **Jarak Antara Barisan Teres** | **7.8 m – 8.5 m** | Mengikut formula cerun bukit | Mengekalkan kepadatan tanaman standard 136 hingga 148 pokok per hektar mengikut kontur bumi. |

### 2. Jadual Klasifikasi Kecerunan Cerun & Keperluan Teres

| Kecerunan Cerun | Sudut Cerun (Darjah) | Peratus Kecerunan (%) | Keperluan Kejuruteraan & Teres |
| :--- | :--- | :--- | :--- |
| **Rata / Landai** | 0° – 6° | 0% – 10% | Tiada teres. Penanaman lurus sistem segi tiga (9.0 m x 9.0 m). |
| **Beralun (Undulating)** | 6° – 12° | 10% – 20% | Teres mini / platform individu (Individual Platforms) + Parit Kontur / Silt Pits. |
| **Berbukit (Hilly)** | **12° – 25°** | **20% – 45%** | **Wajib Bina Teres Kontur Bersambung (Continuous Contour Terraces)** selebar 3.5 m – 4.0 m. |
| **Curam (Steep)** | > 25° | > 45% | Kawasan pemuliharaan cerun / rizab tadahan air mengikut piawaian MSPO & Jabatan Alam Sekitar (JAS). |

### 3. Syarat & SOP Pembinaan Teres:
1. Pemotongan Teres: Dilaksanakan menggunakan ekskavator hidraulik kelas 20-tan bermula dari aras teres paling atas menuruni lereng bukit.
2. Penyimpanan Tanah Atas (Topsoil): Tanah atas yang subur hendaklah ditolak ke bahagian tapak penanaman teres bagi memastikan pertumbuhan akar anak sawit optimum.
3. Penanaman LCC Segera: Selepas teres siap dibina, tanam kekacang penutup bumi (Mucuna bracteata) di tebing dan bibir teres untuk mengikat struktur tanah daripada hakisan hujan.`,
    tags: ["ukuran teres", "teres", "teres kontur", "dimensi teres", "lebar teres", "backslope", "stop bund", "benteng hentian", "kecerunan bukit", "cerun", "platform individu", "konservasi tanah", "inward slope", "lebar tapak teres"]
  },
  {
    manualTitle: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Perparitan & Saliran",
    sectionTitle: "Seksyen 13.0 / 13.3 Membina Parit Ladang, Parit Sekunder & Parit Utama (Main Drain)",
    pageNumber: 22,
    content: `Spesifikasi Ukuran & Dimensi Parit mengikut MSL Seksyen 13.0 & 13.3:

| Jenis Parit | Lebar Atas | Lebar Bawah | Kedalaman | Kecerunan Tebing |
| :--- | :--- | :--- | :--- | :--- |
| **Parit Utama (Main Drain / Seksyen 13.1)** | 3.0 m – 4.5 m | 1.5 m – 2.0 m | 1.8 m – 2.5 m | 1:1 hingga 1:1.5 |
| **Parit Sekunder (Collection Drain / Seksyen 13.2)** | 1.8 m – 2.4 m | 0.9 m – 1.2 m | 1.2 m – 1.5 m | 1:1 |
| **Parit Ladang (Field Drain / Seksyen 13.3)** | 1.2 m – 1.5 m | 0.6 m – 0.9 m | 0.9 m – 1.2 m | 1:1 |

Langkah Pematuhan SOP Perparitan:
1. Parit Ladang dibina selari dengan barisan pokok (biasanya 1 parit setiap 2–4 baris pokok mengikut jenis tanah).
2. Parit Sekunder mengalirkan air dari Parit Ladang ke Parit Utama.
3. Parit Utama dibina dengan pintu kawalan air (water gate / stopbund) untuk mengawal paras air bawah tanah (groundwater level) terutamanya di kawasan tanah gambut (0.4 m - 0.6 m dari permukaan).`,
    tags: ["ukuran parit", "parit", "dimensi parit", "parit utama", "parit sekunder", "parit ladang", "main drain", "field drain", "collection drain", "saliran", "tanah gambut"]
  },

  // ==========================================
  // 3. PRA MATANG (IMMATURE)
  // ==========================================
  {
    manualTitle: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Pra Matang",
    sectionTitle: "Penjagaan Pokok Sawit Peringkat Pra Matang (Umur 1 - 30 Bulan)",
    pageNumber: 24,
    content: `Peringkat Pra Matang (Immature) merangkumi tempoh dari penanaman di ladang sehingga pokok berumur 30 bulan:
1. Pembersihan Piringan (Circle Weeding): Piringan pokok mesti sentiasa bebas rumpai dengan jejari 1.0 meter (Tahun 1) hingga 1.5 meter (Tahun 2). Elakkan semburan racun sistemik (cth. glifosat) terkena pangkal anak pokok yang masih hijau.
2. Amalan Ablasi / Sanitasi Bunga Awal (Castration / Ablation):
   - Waktu Pelaksanaan: Bermula bulan ke-14 hingga ke-20 atau ke-22 selepas menanam.
   - Pusingan: Setiap 4 hingga 6 minggu sekali.
   - Kaedah: Buang semua kudup bunga jantan dan betina serta buah awal menggunakan pahat kecil tanpa merosakkan ketiak pelepah.
   - Faedah: Mengalihkan fotosintat dan nutrien ke arah tumbesaran vegetatif (lilitan batang, kanopi daun, dan perkembangan akar) supaya pokok menghasilkan BTS yang seragam dan berat apabila dibuka tuai pada bulan ke-24 hingga 30.`,
    tags: ["pra matang", "immature", "circle weeding", "ablasi", "castration", "sanitasi bunga", "lilitan batang"]
  },
  {
    manualTitle: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Pra Matang",
    sectionTitle: "Kawalan Perosak & Perlindungan Sawit Muda (Kumbang Tanduk, Tikus & Babi Hutan)",
    pageNumber: 28,
    content: `Anak pokok sawit muda sangat rentan terhadap serangan perosak:
1. Kumbang Tanduk (Oryctes rhinoceros): Mengorek pucuk tengah (spear leaf). Kawalan: Gunakan jaring perangkap feromon (1 perangkap bagi setiap 2 hektar) atau semburan bio-pestisid / racun piretroid di pucuk jika tahap serangan melebihi 5%.
2. Serangan Tikus & Haiwan Liar: Pasang zink pelindung kolar dawai (wire mesh collar) setinggi 45 cm di sekeliling pangkal anak pokok pada tahun pertama untuk mengelakkan gigitan tikus dan serangan landak/babi hutan.
3. Pemantauan Pokok Sulam (Supplying): Lakukan sulaman secepat mungkin dalam tempoh 6 bulan pertama jika terdapat pokok mati atau terbantut supaya barisan pokok seragam dan tidak mengalami 'shading effect'.`,
    tags: ["kumbang tanduk", "oryctes", "kolar zink", "tikus", "pokok sulam", "sawit muda", "feromon"]
  },

  // ==========================================
  // 4. POKOK MATANG (MATURE ESTATE & HARVESTING)
  // ==========================================
  {
    manualTitle: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Pokok Matang",
    sectionTitle: "Standard Kematangan BTS & Kriteria Penuaian Pokok Matang",
    pageNumber: 32,
    content: `Penuaian Buah Tandan Segar (BTS) sawit matang adalah penentu utama Kadar Perahan Minyak (OER) dan Asid Lemak Bebas (FFA):
1. Standard Kematangan (MPOB / Kilang):
   - Kategori Buah Masak: Tandan mempunyai sekurang-kurangnya 1 hingga 5 biji buah relai segar di atas tanah/piringan sebelum tandan dipotong.
   - Buah Mengkal (Under-ripe): Kurang daripada 1 biji relai segar (dilarang dituai melainkan dalam zon kematangan spesifik).
   - Buah Muda (Unripe): Sifar biji relai, warna ungu/hitam gelap, mesokarpa keras (DILARANG SAMA SEKALI - penalti tolak gred kilang).
   - Buah Busuk / Lewat Tuai (Over-ripe): Buah lerai melebihi 50%, bertukar warna coklat gelap dan busuk (meningkatkan FFA > 5%).
2. Pusingan Menuai (Harvesting Interval):
   - Standard industri: 10 hingga 15 hari sepusingan (maksimum 3 pusingan sebulan).
   - Kelewatan pusingan (>18 hari) mengakibatkan buah terlebih masak, biji relai reput di celah pelepah, dan kehilangan OER ladang.`,
    tags: ["pokok matang", "matang", "bts masak", "buah relai", "bts muda", "oer", "ffa", "pusingan menuai", "kematangan bts"]
  },
  {
    manualTitle: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Pokok Matang",
    sectionTitle: "SOP Pemangkasan Pelepah (Pruning) & Kawalan Kanopi Pokok Matang",
    pageNumber: 36,
    content: `Pemangkasan pelepah (Pruning) bertujuan mengekalkan kanopi fotosintesis optimum sambil memudahkan kerja menuai dan pembajaan:
1. Bilangan Pelepah Minimum:
   - Sawit Muda Matang (Umur 3–8 tahun): Kekalkan minimum 48 hingga 56 pelepah (minimum 2 pelepah menyokong tandan bawah / 'two fronds under bunch').
   - Sawit Matang Penuh (Umur 9–14 tahun): Kekalkan minimum 40 hingga 48 pelepah (minimum 1 hingga 2 pelepah penyokong tandan).
   - Sawit Tinggi / Tua (>15 tahun): Kekalkan 32 hingga 40 pelepah (1 pelepah penyokong atau potong rapat jika penuaian pokok tinggi).
2. Larangan 'Over-Pruning' (Cantas Berlebihan):
   - Cantas berlebihan menyebabkan pokok mengalami tekanan fisiologi, pengguguran bunga betina, nisbah jantina (sex ratio) merosot kepada bunga jantan, dan hasil BTS merosot 15%–30% bagi 12–18 bulan berikutnya.
3. Susunan Pelepah (Frond Stacking):
   - Pelepah yang dipotong mesti dicantas rapat ke pangkal batang (elakkan tinggalkan tunggul pelepah panjang).
   - Pelepah disusun kemas dalam bentuk 'U-shape' atau lorong pelepah (inter-row) secara selang sebaris untuk memulihara bahan organik tanah.`,
    tags: ["pemangkasan pelepah", "pruning", "pokok matang", "over-pruning", "bilangan pelepah", "frond stacking", "susunan pelepah"]
  },
  {
    manualTitle: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Pokok Matang",
    sectionTitle: "Kutipan Biji Relai & Pengurusan Platform Timbang (RAM/Kilang)",
    pageNumber: 40,
    content: `Biji relai (loose fruits) mengandungi peratusan minyak sawit (OER) tertinggi iaitu sekitar 40%–45% berbanding badan tandan:
1. Kutipan Bersih: Semua biji relai di atas piringan, lorong menuai, dan celah pelepah mesti disapu dan dimasukkan ke dalam guni/lori. Biji relai yang ditinggalkan di ladang adalah kerugian hasil tunai secara langsung.
2. Evakuasi Cepat: BTS dan biji relai wajib dihantar ke kilang sawit dalam tempoh 24 jam selepas dipotong bagi memastikan FFA kekal di bawah 2.5% dan OER kilang melebihi 20.0%.
3. Integriti Timbangan: Pastikan semakan nombor resit timbangan, berat bersih lori (Nett Weight), serta penarafan penggredan (KPG = KPA) disahkan setiap hari oleh Field Controller (FC) dan Mandur Penimbang.`,
    tags: ["biji relai", "loose fruits", "kutipan biji", "evakuasi 24 jam", "kpg kpa", "timbangan kilang", "ram bts", "ffa rendah"]
  },
  {
    manualTitle: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Pokok Matang",
    sectionTitle: "Pengurusan Tandan Kosong (EFB) & Mulsa Organik di Pokok Matang",
    pageNumber: 44,
    content: `Aplikasi Tandan Kosong Kelapa Sawit (Empty Fruit Bunches - EFB) di blok sawit matang:
1. Kadar Aplikasi: 30 hingga 40 tan EFB sehektar setahun (sekitar 200–250 kg setiap pokok) untuk blok sawit matang berpasir, tanah cerun, atau kawasan kurang subur.
2. Cara Meletak: Letakkan EFB secara rata 1 lapisan setebal 15–20 cm di lorong pelepah atau di luar zon piringan pokok (jarak 1 meter dari pangkal batang untuk elak serangan kumbang/kulat).
3. Manfaat Agronomi: EFB membekalkan Kalium (K) dan bahan organik semulajadi, meningkatkan kelembapan tanah, merangsang aktiviti cacing tanah, dan mengurangkan kos baja kimia sehingga 15%–20%.`,
    tags: ["efb", "tandan kosong", "mulsa organik", "pokok matang", "kalium", "kelembapan tanah", "bahan organik"]
  },

  // ==========================================
  // 5. PEMBAJAAN (FERTILIZATION & NUTRIENT MANAGEMENT)
  // ==========================================
  {
    manualTitle: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Pembajaan",
    sectionTitle: "Prinsip 4T & Amalan Terbaik Program Pembajaan Sawit",
    pageNumber: 48,
    content: `Program pembajaan sawit mesti mematuhi Prinsip 4T secara berdisiplin:
1. Tepat Jenis (Right Source):
   - MOP (Muriate of Potash - 60% K2O): Nutrien utama untuk pengisian tandan, berat tandan purata (BTP/ABW), dan daya tahan kemarau.
   - Urea / Ammonium Nitrate (N): Untuk pembentukan klorofil daun, luas kanopi fotosintesis, dan pembungaan.
   - Rock Phosphate (RP - 28–32% P2O5): Merangsang pertumbuhan perakaran aktif dan penyerapan nutrien tanah.
   - Kieserite (27% MgO): Membekalkan Magnesium untuk fotosintesis optimum (elak 'orange spotting').
   - Borate (Baja Boron - Fertibor): Mengelakkan tandan tanpa biji ('parthenocarpy') dan daun cangkuk ('hook leaf').
2. Tepat Dos (Right Rate): Berdasarkan syor tahunan keputusan Analisis Daun (Leaf Sampling Unit - LSU) dan Analisis Tanah (Soil Sampling Unit - SSU).
3. Tepat Masa (Right Time):
   - Tabur baja semasa tanah lembap (bulan awal musim hujan).
   - DILARANG menabur semasa hujan lebat berterusan (elak hanyutan larian permukaan/run-off) atau musim kemarau terik (elak volatilisasi gas ammonia).
4. Tepat Tempat (Right Placement):
   - Pokok Muda (<3 tahun): Tabur sekata dalam zon piringan bersih (50 cm – 150 cm dari batang).
   - Pokok Matang (>4 tahun): Tabur di zon perakaran aktif di bawah kanopi luar pokok atau lorong susunan pelepah yang reput.`,
    tags: ["pembajaan", "prinsip 4t", "mop", "urea", "rp", "kieserite", "boron", "dos baja", "waktu baja", "zon perakaran"]
  },
  {
    manualTitle: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Pembajaan",
    sectionTitle: "Jadual Master & Kitaran Pusingan Pembajaan Setahun",
    pageNumber: 52,
    content: `Jadual Master Pembajaan FPMSB Tunggal & Standard Industri:
1. Pusingan 1 (Suku Pertama - Jan hingga Mac):
   - Aplikasi Baja Fosfat (Rock Phosphate / RP) dan Magnesium (Kieserite).
   - Sasaran siap: 100% sebelum akhir Mac bagi merangsang akar baharu awal tahun.
2. Pusingan 2 (Suku Kedua - April hingga Jun):
   - Aplikasi Baja Sebatian NPK atau MOP Pusingan 1 bersama Nitrogen (Urea/Ammonium).
   - Sasaran siap: 100% sebelum cuti pertengahan tahun.
3. Pusingan 3 (Suku Ketiga - Julai hingga September):
   - Aplikasi MOP Pusingan 2 untuk menyokong fasa pembentukan tandan puncak ('peak crop season').
   - Sasaran siap: Minimum 80%–100% menjelang September.
4. Pusingan 4 (Suku Keempat - Oktober hingga Disember):
   - Aplikasi Baja Pembetulan Mikronutrien (Borate / Kieserite tambahan) dan pusingan baki sebelum musim monsun lebat tiba.
5. Kawalan Kualiti Taburan: Mandur wajib memeriksa kalibrasi mangkuk sukatan dos, taburan rata tanpa gumpalan, dan tiada karung baja tertinggal di blok.`,
    tags: ["jadual pembajaan", "pusingan baja", "master schedule", "p1 p2 p3 p4", "kalibrasi dos", "mop", "kieserite"]
  },
  {
    manualTitle: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Pembajaan",
    sectionTitle: "Diagnostik Gejala Kekurangan Nutrien (Deficiency Symptoms) Pada Pokok",
    pageNumber: 56,
    content: `Pengecaman awal simptom kekurangan nutrien di lapangan membolehkan tindakan pembetulan segera:
1. Kekurangan Nitrogen (N): Daun bertukar warna kuning pucat seragam (pale yellow/chlorosis) bermula dari kanopi atas, pertumbuhan pelepah pendek dan kanopi mengecil.
2. Kekurangan Kalium / Potasium (K): Bintik kuning-oranye (Confluent Orange Spotting) pada pelepah tua, tepi anak daun kering terbakar (leaf margin necrosis), dan saiz tandan BTS mengecil ketara.
3. Kekurangan Magnesium (Mg): Daun tua yang terdedah kepada cahaya matahari bertukar menjadi warna oren/kuning tembaga terang (Orange Frond), manakala bahagian anak daun yang terlindung kekal hijau.
4. Kekurangan Boron (B): Daun muda bergulung, hujung pelepah membengkok seperti cangkuk ('hook leaf'), daun kerdil berbentuk kipas ('little leaf / blind leaf'), dan tandan buah tidak lekat/berbiji kosong.`,
    tags: ["gejala kekurangan nutrien", "deficiency symptoms", "nitrogen", "kalium", "magnesium", "boron", "orange spotting", "hook leaf"]
  },
  {
    manualTitle: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Pembajaan",
    sectionTitle: "Kaedah Persampelan Daun (LSU) & Ujian Tanah (SSU)",
    pageNumber: 60,
    content: `Persampelan Daun (Leaf Sampling Unit - LSU) dijalankan sekali setahun (biasanya bulan Julai–September) untuk menentukan ketepatan formulasi baja tahun berikutnya:
1. Pemilihan Pelepah Rujukan:
   - Pokok Pra-matang / Muda (1–3 tahun): Ambil sampel dari Pelepah Ke-9 (Frond 9).
   - Pokok Matang (>3 tahun): Ambil sampel dari Pelepah Ke-17 (Frond 17).
2. Kaedah Pengambilan: Ambil 4 hingga 8 anak daun dari bahagian tengah pelepah (tengah-tengah panjang pelepah) pada pokok sampel terpilih (1 pokok sampel mewakili setiap 10–20 pokok dalam grid).
3. Pengeringan & Analisis Makmal: Buang tulang tengah anak daun (rachis), bersihkan habuk, keringkan dalam ketuhar (oven 60°C–70°C) selama 48 jam sebelum dihantar ke makmal akreditasi untuk analisis peratusan N, P, K, Mg, Ca, dan B.`,
    tags: ["lsu", "ssu", "persampelan daun", "pelepah 17", "pelepah 9", "analisis makmal", "nutrisi sawit"]
  },

  // ==========================================
  // 6. KAWALAN PEROSAK & PIAWAIAN MSPO
  // ==========================================
  {
    manualTitle: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Pokok Matang",
    sectionTitle: "Pengurusan Perosak Bersepadu (IPM) & Burung Hantu (Tyto alba)",
    pageNumber: 64,
    content: `Pengurusan Perosak Bersepadu (Integrated Pest Management - IPM) mengurangkan kebergantungan kepada racun kimia berbahaya:
1. Kawalan Tikus Secara Biologi:
   - Pasang kotak sarang burung hantu (Tyto alba) dengan nisbah 1 sarang bagi setiap 5 hingga 10 hektar.
   - Sepasang burung hantu mampu memburu antara 800 hingga 1,200 ekor tikus setahun, mengekalkan kadar kerosakan buah di bawah ambang ekonomi (<5%).
2. Kawalan Ulat Bungkus (Bagworm - Metisa plana / Mahasena corbetti):
   - Tanam tanaman berfaedah pembekal nektar (Beneficial Plants) seperti Turnera subulata, Antigonon leptopus, dan Cassia cobanensis di rizab jalan ladang.
   - Tanaman ini menyokong populasi parasitoid dan pemangsa semulajadi yang menyerang larva ulat bungkus.
   - Rawatan kimia (seperti suntikan batang / trunk injection menggunakan Acephate) hanya dibenarkan jika paras ambang kritikal melebihi 10 ekor ulat bagi setiap pelepah.`,
    tags: ["ipm", "burung hantu", "tyto alba", "kawalan tikus", "ulat bungkus", "beneficial plants", "turnera subulata", "suntikan batang"]
  },
  {
    manualTitle: "Manual Sawit Lestari & Amalan Pertanian Baik (GAP)",
    category: "Pokok Matang",
    sectionTitle: "Piawaian MSPO & Zon Penampan Sungai (Riparian Buffer Zone)",
    pageNumber: 68,
    content: `Piawaian Pensijilan Minyak Sawit Mampan Malaysia (MSPO - MS 2530:2022) menetapkan perlindungan ketat terhadap zon ekologi dan keselamatan pekerja:
1. Zon Penampan Sungai (Riparian Buffer Zone):
   - Lebar sungai >40 meter: Zon penampan minimum 50 meter di kedua-dua tebing sungai.
   - Lebar sungai 20–40 meter: Zon penampan minimum 40 meter.
   - Lebar sungai 10–20 meter: Zon penampan minimum 20 meter.
   - Lebar sungai 5–10 meter: Zon penampan minimum 10 meter.
   - Lebar anak sungai <5 meter: Zon penampan minimum 5 meter.
2. Larangan Dalam Zon Riparian: Dilarang sama sekali melakukan aktiviti semburan racun kimia herbisid atau penaburan baja kimia di dalam zon riparian. Pokok sawit yang ada tidak boleh ditebang secara drastik sebaliknya dibiarkan memulihkan tumbuhan semulajadi tebing sungai.
3. Kesejahteraan & Keselamatan Pekerja (OSH): Mandur wajib memastikan pekerja memakai Peralatan Perlindungan Diri (PPE) lengkap semasa meracun dan membaja, serta menjalani latihan audit MSPO berkala.`,
    tags: ["mspo", "zon riparian", "penampan sungai", "alam sekitar", "keselamatan pekerja", "ppe", "lestari"]
  },

  // ==========================================
  // 7. KADAR UPAH KERJA LADANG SAWIT (KUK SIRI 8)
  // ==========================================
  {
    manualTitle: "Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8)",
    category: "Kadar Upah",
    sectionTitle: "KUK SIRI 8: Kadar Upah Menuai & Memungut Buah Tandan Segar (BTS) Mengikut Ketinggian Pokok",
    pageNumber: 72,
    content: `Jadual Rasmi Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8) - Menuai & Memungut Buah Tandan Segar (BTS):
1. Pokok Rendah (Ketinggian <3.0 meter / Penuaian Guna Pahat):
   - Kadar Upah Asas KUK SIRI 8: RM22.00 – RM26.00 bagi setiap Tan BTS.
2. Pokok Sederhana (Ketinggian 3.0m – 6.0m / Penuaian Guna Sabit Rendah):
   - Kadar Upah Asas KUK SIRI 8: RM28.00 – RM34.00 bagi setiap Tan BTS.
3. Pokok Tinggi (Ketinggian 6.0m – 12.0m / Penuaian Guna Sabit Egrek / Buluh Pole):
   - Kadar Upah Asas KUK SIRI 8: RM35.00 – RM45.00 bagi setiap Tan BTS.
4. Elaun & Insentif Tambahan KUK SIRI 8:
   - Insentif Berat Tandan Purata (BTP / ABW >15.0 kg): Tambahan RM3.00 per Tan.
   - Elaun Kesukaran Cerun (>15 darjah) / Tanah Gambut: Tambahan RM3.50 – RM5.00 per Tan.
   - Insentif Tanpa Biji Relai Cicir / Piringan Bersih: RM2.00 per Tan.`,
    tags: ["kuk siri 8", "kadar upah", "upah tuai", "upah bts", "pahat", "sabit", "pokok tinggi", "pokok rendah", "abw", "elaun cerun", "upah menuai", "kuk 8"]
  },
  {
    manualTitle: "Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8)",
    category: "Kadar Upah",
    sectionTitle: "KUK SIRI 8: Kadar Upah Pemangkasan Pelepah (Pruning) & Susun Pelepah",
    pageNumber: 74,
    content: `Jadual Rasmi Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8) - Pemangkasan Pelepah (Pruning):
1. Pruning Pokok Sawit Muda (Umur 3–7 tahun):
   - Kadar Upah KUK SIRI 8: RM0.80 – RM1.20 bagi setiap Pokok (SOP 48–56 pelepah ditinggalkan).
2. Pruning Pokok Sawit Matang Penuh (Umur 8–14 tahun):
   - Kadar Upah KUK SIRI 8: RM1.30 – RM1.80 bagi setiap Pokok (SOP 40–48 pelepah ditinggalkan).
3. Pruning Pokok Sawit Tinggi (>15 tahun):
   - Kadar Upah KUK SIRI 8: RM1.90 – RM2.50 bagi setiap Pokok (SOP 32–40 pelepah ditinggalkan).
4. Susunan Pelepah (Frond Stacking):
   - Susunan pelepah bentuk U-shape atau inter-row yang kemas disertakan sekali dalam pakej pruning atau diberi elaun tambahan RM0.30 per pokok.`,
    tags: ["kuk siri 8", "kadar upah", "upah pruning", "pemangkasan pelepah", "susun pelepah", "frond stacking", "upah cantas", "kuk 8"]
  },
  {
    manualTitle: "Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8)",
    category: "Kadar Upah",
    sectionTitle: "KUK SIRI 8: Kadar Upah Kutipan Biji Relai (Loose Fruits)",
    pageNumber: 76,
    content: `Jadual Rasmi Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8) - Kutipan Biji Relai:
1. Kadar Kutipan Standard KUK SIRI 8 (Manual Guna Penyapu / Tray / Tangan):
   - Kadar Upah: RM0.18 – RM0.28 bagi setiap Kilogram (kg) Biji Relai Bersih.
   - Atau RM18.00 – RM28.00 bagi setiap Guni / Beg 100 kg Biji Relai.
2. Insentif Biji Relai Kualiti Tinggi:
   - Bebas Sampah, Tanah & Batu: Insentif bonus tambahan RM0.05 per kg.
3. Catatan Agronomi: Biji relai mengandungi OER tertinggi (40–45%). Kutipan bersih dikuatkuasakan secara ketat oleh Mandur & Field Controller.`,
    tags: ["kuk siri 8", "kadar upah", "upah biji relai", "loose fruits", "kutipan biji", "upah guni", "kuk 8"]
  },
  {
    manualTitle: "Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8)",
    category: "Kadar Upah",
    sectionTitle: "KUK SIRI 8: Kadar Upah Semburan Racun Herbisid, Pesticide & Trunk Injection",
    pageNumber: 78,
    content: `Jadual Rasmi Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8) - Semburan Racun Kimia:
1. Semburan Piringan & Lorong Menuai (Herbisid / Glifosat / Metsulfuron):
   - Kadar Upah KUK SIRI 8: RM25.00 – RM35.00 bagi setiap Hektar per pusingan.
2. Semburan Rumpai Liar / Woody Growth (Triclopyr / Picloram / Anak Kayu):
   - Kadar Upah KUK SIRI 8: RM38.00 – RM50.00 bagi setiap Hektar.
3. Semburan Anak Pokok Sawit Muda (Circle Weeding Manual / Naungan):
   - Kadar Upah KUK SIRI 8: RM16.00 – RM22.00 bagi setiap Hektar.
4. Suntikan Batang (Trunk Injection Acephate Kawalan Ulat Bungkus):
   - Kadar Upah KUK SIRI 8: RM1.50 – RM2.20 bagi setiap Pokok (termasuk gerudi & suntikan racun).`,
    tags: ["kuk siri 8", "kadar upah", "upah meracun", "semburan racun", "herbisid", "trunk injection", "circle weeding", "kuk 8"]
  },
  {
    manualTitle: "Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8)",
    category: "Kadar Upah",
    sectionTitle: "KUK SIRI 8: Kadar Upah Penaburan Baja Kimia, Mikronutrien & EFB",
    pageNumber: 80,
    content: `Jadual Rasmi Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8) - Penaburan Baja & EFB:
1. Tabur Baja Berbutir (Urea, MOP, Rock Phosphate, NPK, Kieserite):
   - Kadar Upah KUK SIRI 8: RM25.00 – RM35.00 bagi setiap Tan Baja (atau RM1.25 – RM1.75 per Beg 50kg / RM0.35 – RM0.50 per Pokok).
2. Tabur Baja Mikronutrien (Borate / Fertibor):
   - Kadar Upah KUK SIRI 8: RM0.15 – RM0.25 bagi setiap Pokok.
3. Penaburan Tandan Kosong (EFB Mulching):
   - Kadar Upah KUK SIRI 8: RM12.00 – RM18.00 bagi setiap Tan EFB (termasuk meratakan 1 lapisan di lorong pelepah).`,
    tags: ["kuk siri 8", "kadar upah", "upah membaja", "tabur baja", "upah baja", "mop", "urea", "efb mulching", "kuk 8"]
  },
  {
    manualTitle: "Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8)",
    category: "Kadar Upah",
    sectionTitle: "KUK SIRI 8: Kadar Upah Penanaman, Sulaman (Supplying) & Kerja Infrastruktur",
    pageNumber: 82,
    content: `Jadual Rasmi Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8) - Tanam Semula, Sulaman & Infrastruktur:
1. Menanam Anak Benih Sawit (Replanting):
   - Kadar Upah KUK SIRI 8: RM2.80 – RM4.00 bagi meletak & menanam setiap Pokok (termasuk gali lubang, buka polibeg, & baja RP).
2. Kerja Sulaman Anak Pokok Mati / Terbantut (Supplying):
   - Kadar Upah KUK SIRI 8: RM4.50 – RM6.00 bagi setiap Pokok.
3. Ablasi / Castration Bunga Awal Pokok Muda (Umur 14–22 Bulan):
   - Kadar Upah KUK SIRI 8: RM0.40 – RM0.60 bagi setiap Pokok per pusingan.
4. Pembersihan & Cuci Parit Kontur / Parit Ladang (Manual):
   - Kadar Upah KUK SIRI 8: RM1.80 – RM3.00 bagi setiap Meter Panjang.`,
    tags: ["kuk siri 8", "kadar upah", "upah tanam", "upah sulam", "supplying", "ablasi", "cuci parit", "kuk 8"]
  },

  {
    manualTitle: "Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8)",
    category: "Kadar Upah",
    sectionTitle: "KUK SIRI 8: Kadar Upah Pengangkutan & Evakuasi BTS (Internal Evacuation & Transport)",
    pageNumber: 84,
    content: `Jadual Rasmi Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8) - Pengangkutan & Evakuasi BTS:
1. Evakuasi Dalam Ladang (Mini Traktor Grabber / Badang / Kereta Sorong Motor):
   - Kadar Upah KUK SIRI 8: RM8.00 – RM12.00 bagi setiap Tan BTS (kutip dari lorong buah & hantar ke platform/ramp timbang).
2. Memungut & Memuat BTS Manual ke Treler / Lori (Manual Loading):
   - Kadar Upah KUK SIRI 8: RM6.00 – RM9.00 bagi setiap Tan BTS.
3. Pengangkutan Lori ke Kilang Sawit (Mengikut Zon Jarak):
   - Zon 1 (Jarak 0–15 km): RM14.00 – RM18.00 bagi setiap Tan BTS.
   - Zon 2 (Jarak >15–30 km): RM19.00 – RM25.00 bagi setiap Tan BTS.
   - Zon 3 (Jarak >30 km): RM26.00 – RM35.00 bagi setiap Tan BTS (mengikut formula tan-kilometer).
4. Syarat & Prosedur KUK SIRI 8:
   - Evakuasi wajib selesai dalam 24 jam selepas dipotong bagi memastikan FFA kekal di bawah 2.5% dan OER melebihi 20.0%.`,
    tags: ["kuk siri 8", "kadar upah", "upah mengangkut", "evakuasi bts", "pengangkutan bts", "lori bts", "mini traktor", "grabber", "ramp", "kuk 8"]
  },
  // ==========================================
  // 8. MANUAL PEROLEHAN 2023 PIND. 2025 (FPMSB / FELDA)
  // ==========================================
  {
    manualTitle: "Manual Perolehan 2023 Pind. 2025",
    category: "Manual Perolehan 2023 Pind. 2025",
    sectionTitle: "Had Nilai Kuasa Melulus & Kaedah Perolehan Ladang",
    pageNumber: 14,
    content: `Garis Panduan Had Nilai Kuasa Melulus & Kaedah Perolehan Mengikut Manual Perolehan 2023 Pind. 2025:
1. Pembelian Terus / Runcit (Had Nilai sehingga RM20,000):
   - Boleh dilaksanakan melalui satu (1) sebut harga pembekal berdaftar yang sah.
   - Kuasa Melulus: Pengurus Rancangan / Pengurus Ladang.
2. Sebut Harga Terhad Peringkat Wilayah (RM20,001 hingga RM50,000):
   - Wajib mendapatkan sekurang-kurangnya tiga (3) sebut harga bertulis daripada pembekal/kontraktor berdaftar.
   - Kuasa Melulus: Jawatankuasa Sebut Harga Wilayah / Pengurus Besar Wilayah (PBW).
3. Sebut Harga Terbuka / Ibu Pejabat (RM50,001 hingga RM500,000):
   - Memerlukan sekurang-kurangnya lima (5) sebut harga rasmi dengan notis sebut harga diedarkan kepada kontraktor panel berdaftar.
   - Kuasa Melulus: Jawatankuasa Sebut Harga Ibu Pejabat (JSHIP).
4. Tender Terbuka (Melebihi RM500,000):
   - Pengiklanan tender terbuka di portal rasmi dan akhbar utama, tempoh jualan tender minimum 14–21 hari.
   - Kuasa Melulus: Lembaga Perolehan / Jawatankuasa Lembaga Pengarah.`,
    tags: ["manual perolehan 2023 pind. 2025", "manual perolehan 2023", "perolehan 2023", "perolehan 2025", "perolehan", "had kuasa", "sebut harga", "tender", "pembelian terus", "kuasa melulus", "lpo", "procurement"]
  },
  {
    manualTitle: "Manual Perolehan 2023 Pind. 2025",
    category: "Manual Perolehan 2023 Pind. 2025",
    sectionTitle: "Prosedur Pesanan Belian Tempatan (LPO), Nota Hantaran (DO) & Penerimaan Barangan (GRN)",
    pageNumber: 28,
    content: `Tatacara Pengurusan Pesanan Belian & Penerimaan Barangan Mengikut Manual Perolehan 2023 Pind. 2025:
1. Pengeluaran Pesanan Belian Tempatan (LPO / PO):
   - LPO rasmi wajib dikeluarkan dan diluluskan SEBELUM sebarang pembekalan barangan atau kerja fizikal dimulakan.
   - Dilarang sama sekali mengeluarkan LPO kebelakangan (Backdated LPO/PO).
2. Penerimaan & Pengesahan Barangan (DO & GRN):
   - Penerimaan barangan fizikal di ladang (seperti baja, racun, alat ganti jentera, anak benih) wajib disemak kuantiti dan spesifikasi mengikut Surat Nota Hantaran (DO).
   - Pengesahan Penerimaan Barangan (Goods Received Note - GRN) ditandatangani oleh Eksekutif/Kerani Penerima bersama cop tarikh penerimaan.
3. Perakuan Bayaran & Padanan 3 Dokumen (3-Way Matching):
   - Bayaran kepada pembekal hanya diproses setelah padanan lengkap antara Pesanan Belian (LPO), Nota Hantaran (DO/GRN) dan Invois Pembekal disahkan betul tanpa percanggahan harga atau kuantiti.`,
    tags: ["manual perolehan 2023 pind. 2025", "manual perolehan 2023", "perolehan", "lpo", "po", "do", "grn", "nota hantaran", "invois", "pesanan belian", "tatacara bayaran"]
  },
  {
    manualTitle: "Manual Perolehan 2023 Pind. 2025",
    category: "Manual Perolehan 2023 Pind. 2025",
    sectionTitle: "Pengurusan Kontraktor Ladang, Bon Pelaksanaan & Wang Jaminan Pelaksanaan (WJP)",
    pageNumber: 42,
    content: `Syarat Kelayakan Kontraktor & Pengurusan Jaminan Kontrak Mengikut Manual Perolehan 2023 Pind. 2025:
1. Pendaftaran & Sijil Sah:
   - Kontraktor wajib berdaftar secara sah dengan SSM, MOF (bagi bekalan/perkhidmatan), CIDB (bagi kerja pembinaan/infrastruktur), dan Lesen Panel Berdaftar Syarikat.
2. Bon Pelaksanaan (Performance Bond):
   - Dikenakan bagi kontrak kerja ladang atau pembekalan bernilai melebihi RM200,000.
   - Kadar Bon Pelaksanaan adalah 5% daripada nilai keseluruhan kontrak dalam bentuk Jaminan Bank (Bank Guarantee) atau Draf Bank.
3. Wang Jaminan Pelaksanaan (WJP / Retention Sum):
   - Bagi kontrak kerja yang tiada Bon Pelaksanaan, potongan 5% dikenakan ke atas setiap pembayaran kemajuan interim sehingga mencapai had maksimum 5% nilai kontrak.
   - WJP dilepaskan selepas tamat Tempoh Tanggungan Kecacatan (Defects Liability Period - DLP) dan pengeluaran Sijil Perakuan Siap Kerja (CPC).`,
    tags: ["manual perolehan 2023 pind. 2025", "manual perolehan 2023", "perolehan", "kontraktor", "bon pelaksanaan", "wjp", "retention sum", "cidb", "ssm", "dlp", "cpc"]
  },
  {
    manualTitle: "Manual Perolehan 2023 Pind. 2025",
    category: "Manual Perolehan 2023 Pind. 2025",
    sectionTitle: "Perolehan Darurat (Emergency Procurement) & Pembaikan Jentera Segera",
    pageNumber: 56,
    content: `Tatacara Perolehan Darurat Mengikut Manual Perolehan 2023 Pind. 2025:
1. Takrifan Darurat Perladangan:
   - Keadaan yang tidak dijangka yang boleh menjejaskan keselamatan nyawa, kerosakan teruk hasil BTS, kerosakan loji penimbang kilang, benteng pecah atau serangan wabak perosak sawit mendadak (cth. Ulat Bungkus/Kumbang Tanduk).
2. Kaedah Pelaksanaan Segera:
   - Kerja pembaikan atau pembelian alat ganti boleh dimulakan serta-merta dengan kelulusan lisan Pengurus Besar Wilayah / Pengarah Operasi.
3. Dokumentasi Rasmi Susulan:
   - Laporan Justifikasi Darurat dan Pesanan Belian (LPO) rasmi wajib diselesaikan dan disahkan dalam tempoh tidak melebihi tujuh (7) hari bekerja selepas arahan lisan dikeluarkan.`,
    tags: ["manual perolehan 2023 pind. 2025", "manual perolehan 2023", "perolehan darurat", "emergency procurement", "pembaikan jentera", "benteng pecah", "ulat bungkus", "kelulusan darurat"]
  },
  // ==========================================
  // 7. MANUAL RUMPAI DAN KAWALAN KIMIA (FAIL BERASINGAN)
  // ==========================================
  ...MANUAL_RUMPAI_DAN_KAWALAN_KNOWLEDGE,
  // ==========================================
  // 8. THE OIL PALM (5TH EDITION) - CORLEY & TINKER
  // ==========================================
  ...THE_OIL_PALM_5TH_EDITION_KNOWLEDGE_BASE.map(k => ({
    manualTitle: k.manualTitle,
    category: k.category,
    sectionTitle: `${k.chapter} - ${k.sectionTitle}`,
    pageNumber: k.pageNumber,
    content: k.content,
    tags: k.tags || []
  }))
];
