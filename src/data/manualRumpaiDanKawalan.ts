/**
 * Manual Rumpai & Kawalan Herbisid Knowledge Base (RAG & Multimodal AI)
 * Khusus untuk pengecaman morfologi rumpai, formulasi racun kimia, dan dos bancuhan ladang sawit.
 */

export interface WeedMorphologyAndControl {
  id: string;
  namaTempatan: string;
  namaSaintifik: string;
  kategori: 'Daun Lebar' | 'Rumput' | 'Rusiga' | 'Pakis' | 'Anak Kayu';
  ciriVisual: {
    bentukDaun: string;
    warnaBunga: string;
    corakPertumbuhan: string;
    habitatKerap: string;
    gambarRujukanUrl?: string;
  };
  kawalanKimia: {
    bahanAktifUtama: string;
    jenamaContoh: string;
    dosPam18L: string;
    dosPerHektar: string;
    campuranSinergi?: string;
    kaedahAplikasi: string;
    keadaanOptimum: string;
  }[];
  peringatanKhasMSPO: string;
}

export interface WeedManualChunk {
  manualTitle: string;
  category: 'Manual Rumpai Dan Kawalan';
  sectionTitle: string;
  pageNumber: number;
  content: string;
  tags: string[];
  weedProfiles?: WeedMorphologyAndControl[];
}

export const MANUAL_RUMPAI_DAN_KAWALAN_KNOWLEDGE: WeedManualChunk[] = [
  {
    manualTitle: "Manual Rumpai Dan Kawalan",
    category: "Manual Rumpai Dan Kawalan",
    sectionTitle: "Klasifikasi Rumpai Ladang Sawit & Pengecaman Morfologi Visual",
    pageNumber: 5,
    content: `Klasifikasi Rumpai Utama di Ladang Kelapa Sawit (GAP/MSPO):
1. Rumpai Daun Lebar (Broadleaf Weeds):
   - Asystasia gangetica (Akar Ruas-ruas): Batang lembut bersegi 4, bunga corong putih/ungu lembut, daun bujur bertentangan, sangat cepat memanjat pelepah sawit muda.
   - Mikania micrantha (Selaput Tunggul / Mile-a-minute): Daun bentuk jantung (cordate), bunga putih kecil berkelompok, menghasilkan alelopati membantutkan anak sawit.
   - Clidemia hirta (Senduduk Bulu): Daun berbulu kasar dengan 5 urat membujur ketara, buah beri ungu kehitaman, tumbuh di lorong dan tanah terbuka.
   - Borreria latifolia / Spermacoce: Daun berpasangan dengan stipul berbulu, bunga putih kecil di ketiak daun.
2. Rumpai Jenis Rumput (Grasses):
   - Paspalum conjugatum (Rumput Kerbau): Jambak bunga bercabang 2 (T-shape), daun berbulu halus di tepi, rumput penutup bumi yang sederhana jika terkawal.
   - Ottochloa nodosa (Rumput Pait): Daun lembut tirus, sangat toleran naungan tebal sawit matang.
   - Imperata cylindrica (Lalang): Rumpai berbahaya Kelas A. Daun berurat putih tajam di tengah, rizom bawah tanah tebal, perlu pembasmian tuntas.
   - Eleusine indica (Rumput Sambau): Rumpun tegak berakar tunjang liat, jambak bunga jejari (digitata), kerap rintang racun Glyphosate.
3. Rumpai Jenis Rusiga (Sedges):
   - Cyperus rotundus & Cyperus kyllingia: Batang bersegi tiga tanpa buku, menghasilkan umbisi (tubers) di dalam tanah, kerap di kawasan lembap.
4. Rumpai Pakis Liar & Epifit:
   - Stenochlaena palustris (Paku Miding): Pakis memanjat batang sawit, boleh bersaing nutrien jika tebal.
   - Dicranopteris linearis (Resam): Pakis bercabang garpu di tanah berasid/miskin nutrien.`,
    tags: ["manual rumpai dan kawalan", "klasifikasi", "morfologi", "asystasia", "mikania", "lalang", "rumput kerbau", "ottochloa", "eleusine", "resam"],
    weedProfiles: [
      {
        id: 'asystasia-gangetica',
        namaTempatan: 'Akar Ruas-ruas / Asystasia',
        namaSaintifik: 'Asystasia gangetica',
        kategori: 'Daun Lebar',
        ciriVisual: {
          bentukDaun: 'Bujur telur (ovate), bertentangan, urat daun berselang',
          warnaBunga: 'Putih berkrim dengan tompok ungu / ungu lembut berbentuk corong',
          corakPertumbuhan: 'Menjalar pantas dan memanjat pelepah bawah sawit',
          habitatKerap: 'Kawasan terbuka, piringan pokok, dan lorong tuai'
        },
        kawalanKimia: [
          {
            bahanAktifUtama: 'Fluroxypyr 200 g/L (Starane 200) / Triclopyr butotyl 32.1%',
            jenamaContoh: 'Starane 200 / Garlon 250',
            dosPam18L: '20 ml - 30 ml Fluroxypyr ATAU 15 ml - 20 ml Triclopyr + 1.5 g Metsulfuron',
            dosPerHektar: '0.5 L - 0.75 L / Ha',
            campuranSinergi: 'Campur Metsulfuron-methyl 20% (1.5g per 18L) untuk kesan sistemik menyeluruh',
            kaedahAplikasi: 'Semburan bertompok (spot spraying) pada rumpun aktif',
            keadaanOptimum: 'Sembur sebelum rumpai berbunga lebat dan sebelum memanjat pelepah'
          }
        ],
        peringatanKhasMSPO: 'Kawal sebelum menghasilkan kapsul biji benih yang meletup dan membiak meluas.'
      },
      {
        id: 'mikania-micrantha',
        namaTempatan: 'Selaput Tunggul / Mikania',
        namaSaintifik: 'Mikania micrantha',
        kategori: 'Daun Lebar',
        ciriVisual: {
          bentukDaun: 'Bentuk hati/jantung (cordate) dengan hujung tirus, tepi bergerigi halus',
          warnaBunga: 'Putih kehijauan berkelompok kecil di hujung tangkai',
          corakPertumbuhan: 'Memanjat dan menutup kanopi anak sawit (smothering vine)',
          habitatKerap: 'Kawasan tanam semula, sawit muda, dan tepi jalan ladang'
        },
        kawalanKimia: [
          {
            bahanAktifUtama: 'Triclopyr butotyl 32.1% w/w ATAU Fluroxypyr',
            jenamaContoh: 'Garlon 250 / Triclopyr 321',
            dosPam18L: '15 ml - 20 ml Triclopyr + 1.5 g Metsulfuron-methyl',
            dosPerHektar: '0.4 L - 0.6 L / Ha',
            kaedahAplikasi: 'Semburan rata pada daun menjalar, tarik turun daripada pelepah sawit jika memanjat',
            keadaanOptimum: 'Sembur semasa rumpai subur aktif sebelum membentuk kanopi tebal'
          }
        ],
        peringatanKhasMSPO: 'Jangan biarkan melilit pucuk anak sawit muda kerana menghalang fotosintesis.'
      },
      {
        id: 'imperata-cylindrica',
        namaTempatan: 'Lalang / Cogon Grass',
        namaSaintifik: 'Imperata cylindrica',
        kategori: 'Rumput',
        ciriVisual: {
          bentukDaun: 'Tegak, tirus tajam dengan urat tengah putih yang menonjol dan tepi berpasir tajam',
          warnaBunga: 'Bulu putih kapas sutera ditiup angin',
          corakPertumbuhan: 'Rumpun padat dengan rangkaian rizom bawah tanah yang menjalar agresif',
          habitatKerap: 'Kawasan terbuka, sempadan ladang, dan piringan sawit'
        },
        kawalanKimia: [
          {
            bahanAktifUtama: 'Glyphosate isopropylamine 41% w/w',
            jenamaContoh: 'Roundup / Spark / Ecomax',
            dosPam18L: '100 ml - 120 ml Glyphosate + 20 ml pelekat penetran (organosilicone)',
            dosPerHektar: '4.0 L - 5.5 L / Ha',
            campuranSinergi: 'Sapuan lalang (wiping) guna kain/sarung tangan racun (1 bahagian Glyphosate : 3 bahagian air)',
            kaedahAplikasi: 'Semburan basah menyeluruh pada daun lalang matang',
            keadaanOptimum: 'Sembur pada hari panas terik dengan minimum 4-6 jam bebas hujan'
          }
        ],
        peringatanKhasMSPO: 'Rumpai Kelas A - toleransi sifar (Zero Lalang Policy) mengikut piawaian MSPO.'
      },
      {
        id: 'eleusine-indica',
        namaTempatan: 'Rumput Sambau / Goosegrass',
        namaSaintifik: 'Eleusine indica',
        kategori: 'Rumput',
        ciriVisual: {
          bentukDaun: 'Daun tirus leper, pangkal pelepah keputihan, akar tunjang sangat kuat',
          warnaBunga: 'Jambak 2-6 jejari terminal bercabang dari satu titik (seperti kaki burung)',
          corakPertumbuhan: 'Rumpun leper mendatar, liat dan tahan dipijak traktor',
          habitatKerap: 'Lorong menuai, jalan ladang, tapak pemunggah (platform)'
        },
        kawalanKimia: [
          {
            bahanAktifUtama: 'Glufosinate-ammonium 13.5% w/w ATAU Clethodim / Fluazifop',
            jenamaContoh: 'Basta 15 / Fasinate / Fusilade',
            dosPam18L: '80 ml - 100 ml Glufosinate-ammonium',
            dosPerHektar: '2.5 L - 3.0 L / Ha',
            kaedahAplikasi: 'Semburan basah menggunakan nozel kipas rata (flat fan) sebelum rumpai berbuah/biji',
            keadaanOptimum: 'Kerap rintang Glyphosate; rotasikan kepada Glufosinate untuk elak kerintangan herbisid'
          }
        ],
        peringatanKhasMSPO: 'Lakukan rotasi kumpulan tindakan herbisid (HRAC) untuk mencegah populasi rintang racun.'
      }
    ]
  },
  {
    manualTitle: "Manual Rumpai Dan Kawalan",
    category: "Manual Rumpai Dan Kawalan",
    sectionTitle: "Jadual Master Bancuhan & Dos Racun Herbisid Ladang Sawit",
    pageNumber: 18,
    content: `Protokol Bancuhan Herbisid & Dos Pam Galas 18 Liter / Traktor Semburan:
1. Kawalan Rumpai Campuran (Rumput + Daun Lebar Lembut) di Piringan & Lorong Menuai:
   - Bahan Aktif: Glyphosate isopropylamine 41% w/w + Metsulfuron-methyl 20% w/w.
   - Sukatan Pam 18L: 60 ml - 80 ml Glyphosate + 1.5 g - 2.0 g Metsulfuron.
   - Kadar per Hektar: 1.5 - 2.0 Liter Glyphosate + 50 - 75 gram Metsulfuron.
   - Isipadu Semburan: 200 - 300 Liter air sehektar.
2. Kawalan Khusus Rumpai Berkayu & Anak Kayu (Woody Brush):
   - Bahan Aktif: Triclopyr 32.1% (Garlon) + Metsulfuron 20%.
   - Sukatan Pam 18L: 20 ml - 30 ml Triclopyr + 2.5 g Metsulfuron.
   - Kaedah: Semburan daun basah atau sapuan tunggul (basal bark application 1:19 minyak diesel).
3. Kawalan Khusus Kawasan Pokok Sawit Muda (< 3 Tahun - Bebas Kerosakan Pelepah):
   - Bahan Aktif: Glufosinate-ammonium 13.5% (Basta / Fasinate).
   - Sukatan Pam 18L: 60 ml - 80 ml.
   - Peraturan: WAJIB gunakan sungkup nozel (spray hood/cone) untuk mengelakkan titisan terkena pelepah hijau pokok muda.
4. Kawalan Pakis Liar Menjalar (Stenochlaena / Nephrolepis / Resam):
   - Bahan Aktif: Metsulfuron-methyl 20% w/w.
   - Sukatan Pam 18L: 2.0 g - 3.0 g per 18 Liter air.
   - Tambahan: 10 ml pelekat penembus untuk menembusi lapisan lilin daun pakis.`,
    tags: ["manual rumpai dan kawalan", "bancuhan racun", "dos 18l", "glyphosate", "metsulfuron", "triclopyr", "glufosinate", "sawit muda", "pakis", "herbisid"]
  },
  {
    manualTitle: "Manual Rumpai Dan Kawalan",
    category: "Manual Rumpai Dan Kawalan",
    sectionTitle: "SOP Keselamatan Semburan, Pengurusan PPE & Garis Panduan MSPO",
    pageNumber: 32,
    content: `Garis Panduan Keselamatan & Pematuhan Alam Sekitar MSPO:
1. Kelengkapan Perlindungan Diri (PPE) Wajib:
   - Topeng muka / respirator separuh muka (katrij wap organik).
   - Sarung tangan nitril / neoprena tebal tahan bahan kimia.
   - Apron kalis air, gogal pelindung mata bertutup dan but getah keselamatan.
2. Larangan Penggunaan Bahan Kimia Terhad:
   - Larangan mutlak Paraquat Dichloride selaras dengan Akta Racun Makhluk Perosak 1974 dan pensijilan MSPO/RSPO.
3. Zon Penampan Ekologi (Buffer Zone):
   - Dilarang menyembur racun herbisid dalam jarak sekurang-kurangnya 5 meter dari tebing parit utama, anak sungai dan rizab riparian.
4. Tempoh Masuk Semula Kawasan (Re-entry Interval - REI):
   - Minimum 24 hingga 48 jam selepas semburan dilakukan sebelum pekerja menuai dibenarkan masuk ke blok berkenaan.`,
    tags: ["manual rumpai dan kawalan", "keselamatan", "ppe", "mspo", "buffer zone", "paraquat", "rei", "garis panduan racun"]
  }
];
