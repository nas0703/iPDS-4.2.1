export interface OilPalmBookChunk {
  id: string;
  manualTitle: string;
  category: string;
  chapter: string;
  sectionTitle: string;
  pageNumber: number;
  content: string;
  tags: string[];
  metadata?: {
    edition: string;
    authors: string;
    publisher: string;
    year: number;
    isbn: string;
    keyTopics: string[];
  };
}

export const THE_OIL_PALM_5TH_EDITION_KNOWLEDGE_BASE: OilPalmBookChunk[] = [
  // Chapter 1 & 2: Origin, Botany & Morphology
  {
    id: 'top5-ch2-01',
    manualTitle: 'The Oil Palm (5th Edition) - R.H.V. Corley & P.B. Tinker',
    category: 'The Oil Palm, 5th Edition',
    chapter: 'Chapter 2: The Classification and Morphology of the Oil Palm',
    sectionTitle: 'Klasifikasi Genetik Sawit: Dura, Pisifera dan Tenera',
    pageNumber: 28,
    content: `Menurut buku rujukan antarabangsa 'The Oil Palm' (5th Edition, ms 28-35), Elaeis guineensis dikelaskan kepada tiga bentuk buah (fruit forms) utama berasaskan ketebalan tempurung (shell thickness) yang dikawal oleh gen tunggal 'sh':
1. **Dura (sh+ sh+)**: Mempunyai tempurung tebal (2–8 mm), tiada cecincin serat (fibre ring) di sekeliling tempurung, nisbah mesokarpa kepada buah rendah (35–55%), dan isirung (kernel) yang besar. Digunakan sebagai pokok induk betina (female parent) dalam program pembiakbakaan komersial.
2. **Pisifera (sh- sh-)**: Tidak mempunyai tempurung (shell-less), mempunyai cecincin serat di sekeliling embrio kecil, peratusan mesokarpa sangat tinggi (>90%). Kebanyakan pisifera betina adalah mandul (female sterile) di mana tandan gugur sebelum matang, tetapi debunganya (pollen) digunakan sebagai induk jantan (male parent).
3. **Tenera (sh+ sh-)**: Hasil kacukan Dura x Pisifera (D x P). Mempunyai tempurung nipis (0.5–3 mm) yang dikelilingi oleh cecincin serat (fibre ring / halo), peratusan mesokarpa tinggi (60–90%), dan hasil minyak (oil yield per palm) jauh lebih tinggi berbanding Dura (peningkatan 25–35% hasil minyak per hektar). Tenera merupakan piawaian komersial bagi semua penanaman sawit moden di seluruh dunia.`,
    tags: ['dura', 'pisifera', 'tenera', 'botani', 'morfologi', 'dxp', 'genetik', 'corley', 'tinker'],
    metadata: {
      edition: '5th Edition',
      authors: 'R.H.V. Corley, P.B. Tinker',
      publisher: 'Wiley Blackwell',
      year: 2016,
      isbn: '978-1-4051-8939-2',
      keyTopics: ['Dura', 'Pisifera', 'Tenera', 'Fruit Forms', 'Shell Gene']
    }
  },
  {
    id: 'top5-ch2-02',
    manualTitle: 'The Oil Palm (5th Edition) - R.H.V. Corley & P.B. Tinker',
    category: 'The Oil Palm, 5th Edition',
    chapter: 'Chapter 2: The Classification and Morphology of the Oil Palm',
    sectionTitle: 'Morfologi Pelepah, Kanopi & Sistem Akar Sawit',
    pageNumber: 42,
    content: `Morfologi struktur pokok sawit matang (The Oil Palm 5th Ed, ms 42-56):
- **Kanopi & Filotaksis**: Pokok sawit dewasa mengekalkan 35 hingga 48 pelepah hidup dalam susunan filotaksis spiral (kebiasaannya 8 susunan spiral ke kiri atau kanan). Kadar pengeluaran pelepah ialah 1.5 - 2.5 pelepah sebulan (20-30 pelepah setahun) pada pokok muda, dan berkurangan kepada 18-24 pelepah setahun pada pokok matang (>10 tahun).
- **Pelepah Rujukan Standard (Frond 17)**: Pelepah ke-17 merupakan pelepah piawai indeks antarabangsa untuk diagnosis nutrisi dan pensampelan daun (Leaf Sampling Unit / LSU) bagi pokok matang, manakala Pelepah ke-9 digunakan untuk sawit muda (<3 tahun).
- **Sistem Akar (Root System)**: Sistem perakaran sawit adalah jenis serabut (fibrous adventitious root system) tanpa akar tunjang (taproot). Terbahagi kepada 4 peringkat:
  1. *Primary Roots (Akar Primer)*: Diameter 6–10 mm, tumbuh mendatar dan mencancang ke bawah sehingga kedalaman 1–2 meter.
  2. *Secondary Roots (Akar Sekunder)*: Diameter 2–4 mm, bercabang daripada akar primer, menyebar ke zon atas tanah.
  3. *Tertiary Roots (Akar Tertier)*: Diameter 0.7–1.5 mm, bertumpu di lapisan 0–30 cm atas tanah.
  4. *Quaternary Roots (Akar Kuaternari)*: Diameter 0.2–0.5 mm, tiada rambut akar (root hairs), tetapi berfungsi sebagai zon utama penyerapan air dan nutrien dengan mikoriza (arbuscular mycorrhiza).`,
    tags: ['pelepah', 'akar', 'frond 17', 'morfologi', 'filotaksis', 'akar kuaternari', 'kanopi'],
    metadata: {
      edition: '5th Edition',
      authors: 'R.H.V. Corley, P.B. Tinker',
      publisher: 'Wiley Blackwell',
      year: 2016,
      isbn: '978-1-4051-8939-2',
      keyTopics: ['Frond 17', 'Root System', 'Canopy Architecture']
    }
  },

  // Chapter 3: Physiology of the Oil Palm
  {
    id: 'top5-ch3-01',
    manualTitle: 'The Oil Palm (5th Edition) - R.H.V. Corley & P.B. Tinker',
    category: 'The Oil Palm, 5th Edition',
    chapter: 'Chapter 3: Physiology of the Oil Palm',
    sectionTitle: 'Fisiologi Fotosintesis, Dry Matter Production & Bunch Index (BI)',
    pageNumber: 88,
    content: `Fisiologi pengeluaran bahan kering dan indeks tandan (The Oil Palm 5th Ed, ms 88-112):
- **Total Dry Matter Production (TDM)**: Pokok sawit yang sihat di kawasan tropika mampu menghasilkan antara 30 hingga 38 tan bahan kering per hektar setahun (t DM/ha/tahun).
- **Pengagihan Bahan Kering (Dry Matter Partitioning)**:
  - *Vegetative Dry Matter (VDM)*: Bahan kering untuk pertumbuhan batang, pelepah baru, dan akar (biasanya 10–16 t DM/ha/tahun).
  - *Bunch Dry Matter (BDM)*: Bahan kering yang disalurkan kepada penghasilan Tandan Buah Segar (FFB) dan minyak.
- **Bunch Index (BI)**: Nisbah BDM kepada TDM (BI = BDM / TDM). Pada baka moden Tenera berprestasi tinggi, Bunch Index mencecah 0.45 hingga 0.55. Pembiakbakaan sawit moden menumpukan pada peningkatan BI tanpa memerlukan peningkatan saiz kanopi vegetatif yang berlebihan.
- **Tekanan Air (Water Stress) & Penentuan Jantina Bunga (Sex Determination)**:
  - Pembentukan primordium bunga berlaku 24–30 bulan sebelum penuaian.
  - Pembezaan jantina bunga (sex determination) berlaku kira-kira 14–18 bulan sebelum bunga mekar (anthesis).
  - Tekanan kemarau (soil moisture deficit >200–300 mm) mendorong penghasilan bunga jantan (male inflorescence) dan menyebabkan pengguguran bunga betina (flower abortion) 4–6 bulan sebelum mekar, mengakibatkan kejatuhan hasil FFB 10–18 bulan kemudian.`,
    tags: ['fisiologi', 'dry matter', 'bunch index', 'fotosintesis', 'sex ratio', 'kemarau', 'water deficit'],
    metadata: {
      edition: '5th Edition',
      authors: 'R.H.V. Corley, P.B. Tinker',
      publisher: 'Wiley Blackwell',
      year: 2016,
      isbn: '978-1-4051-8939-2',
      keyTopics: ['Bunch Index', 'Dry Matter', 'Water Deficit', 'Sex Ratio']
    }
  },

  // Chapter 4: Breeding & Genetic Selection
  {
    id: 'top5-ch4-01',
    manualTitle: 'The Oil Palm (5th Edition) - R.H.V. Corley & P.B. Tinker',
    category: 'The Oil Palm, 5th Edition',
    chapter: 'Chapter 4: Selection and Breeding',
    sectionTitle: 'Asal-Usul Varieti Pembiakbakaan Komersial: Deli Dura, AVROS, Ekona, Yangambi & Calabar',
    pageNumber: 134,
    content: `Sejarah genetik dan sumber induk sawit utama dunia (The Oil Palm 5th Ed, ms 134-162):
1. **Deli Dura**: Berasal daripada 4 pokok sawit di Kebun Botani Bogor (Indonesia, 1848). Mempunyai ciri mesokarpa tebal, tandan berat, tetapi pertumbuhan menegak agak sederhana. Merupakan asas genetik induk betina utama di Malaysia (MARDI, MPOB, Felda, Sime Darby, IOI).
2. **AVROS Pisifera (Algemene Vereniging van Rubberplanters ter Oostkust van Sumatra)**: Berasal daripada pokok Djongo di Eala (Congo). Mempunyai ciri mesokarpa tinggi, pertambahan minyak sangat lebat, pembungaan awal, dan penyeragaman tinggi. Kacukan Deli x AVROS adalah varieti komersial paling meluas di Asia Tenggara.
3. **Yangambi Pisifera**: Berasal daripada INEAC (Institut National pour l'Etude Agronomique du Congo). Ciri tandan besar, minyak tinggi, tetapi pertumbuhan batang menegak sedikit lebih laju berbanding AVROS.
4. **Ekona Pisifera**: Berasal daripada Cameroon. Mempunyai rintangan lebih baik terhadap layu Fusarium (Fusarium wilt) dan kadar pertumbuhan menegak yang lebih perlahan (slow vertical height increment).
5. **Calabar / NIFOR (Nigeria)**: Memberikan bilangan tandan tinggi (high bunch number) dan adaptasi baik kepada musim kering bermusim.`,
    tags: ['pembiakbakaan', 'deli dura', 'avros', 'yangambi', 'ekona', 'calabar', 'genetik', 'dxp'],
    metadata: {
      edition: '5th Edition',
      authors: 'R.H.V. Corley, P.B. Tinker',
      publisher: 'Wiley Blackwell',
      year: 2016,
      isbn: '978-1-4051-8939-2',
      keyTopics: ['Deli Dura', 'AVROS', 'Yangambi', 'Ekona', 'Breeding Origins']
    }
  },

  // Chapter 6 & 8: Climate, Soils, Planting Density & LCC
  {
    id: 'top5-ch6-01',
    manualTitle: 'The Oil Palm (5th Edition) - R.H.V. Corley & P.B. Tinker',
    category: 'The Oil Palm, 5th Edition',
    chapter: 'Chapter 6 & 8: Climate, Soils and Planting Practices',
    sectionTitle: 'Keperluan Iklim, Densiti Penanaman (136–148 Pokok/Ha) & Pengurusan Tanaman Penutup Bumi (LCC)',
    pageNumber: 215,
    content: `Piawaian agronomik penanaman sawit (The Oil Palm 5th Ed, ms 215-248):
- **Keperluan Iklim Optimum**:
  - *Hujan tahunan*: 2,000–2,500 mm setahun yang sekata tanpa musim kering berpanjangan (>3 bulan defisit air <100 mm/bulan).
  - *Suhu*: Purata minimum 22–24°C, purata maksimum 29–33°C.
  - *Pancaran Suria (Sunshine hours)*: Minimum 5–6 jam sehari (>16–17 MJ/m²/hari).
- **Densiti Penanaman Piawai**:
  - *Kawasan Tanah Mineral / Beralun*: 136 hingga 148 pokok/hektar (jarak 8.8m hingga 9.2m dalam susunan segi tiga sama sisi / equilateral triangular spacing).
  - *Kawasan Tanah Gambut*: 148 hingga 160 pokok/hektar bagi mengimbangi kemungkinan pokok condong dan memaksimumkan pintasan cahaya kanopi.
- **Kacang Penutup Bumi (Legume Cover Crops - LCC)**:
  - Penanaman campuran *Mucuna bracteata*, *Pueraria javanica*, dan *Calopogonium caeruleum*.
  - *Mucuna bracteata*: Mampu mengikat nitrogen atmosfera (biological N2 fixation) sehingga 150–200 kg N/ha/tahun, menghasilkan biojisim sisa daun (litter fall) yang tinggi, menekan pertumbuhan rumpai berbahaya (Lalang, Mikania, Asystasia), mengawal hakisan tanah, dan mengurangkan populasi larva kumbang badak (*Oryctes rhinoceros*).`,
    tags: ['densiti', 'iklim', 'jarak tanaman', 'lcc', 'mucuna bracteata', 'tanah mineral', 'hujan'],
    metadata: {
      edition: '5th Edition',
      authors: 'R.H.V. Corley, P.B. Tinker',
      publisher: 'Wiley Blackwell',
      year: 2016,
      isbn: '978-1-4051-8939-2',
      keyTopics: ['Planting Density', 'Equilateral Triangle', 'LCC', 'Mucuna bracteata']
    }
  },

  // Chapter 9: Soil and Water Management - Peat Soil Management
  {
    id: 'top5-ch9-01',
    manualTitle: 'The Oil Palm (5th Edition) - R.H.V. Corley & P.B. Tinker',
    category: 'The Oil Palm, 5th Edition',
    chapter: 'Chapter 9: Soil and Water Management and Conservation',
    sectionTitle: 'Pengurusan Tanah Gambut Tropika (Tropical Peat Management): Paras Air 50–75 cm & Pemadatan (Compaction)',
    pageNumber: 278,
    content: `Prinsip utama pengurusan sawit di atas tanah gambut tropika (The Oil Palm 5th Ed, ms 278-305):
1. **Kawalan Paras Air Tanah (Water Table Management)**:
   - Paras air dalam parit ladang (collection drain / field drain) mesti dikekalkan secara konsisten pada kedalaman **50 cm hingga 75 cm** dari permukaan tanah gambut menggunakan pintu air kawalan (weirs, stop logs, dan water gates).
   - *Kesan jika terlalu kering (<80-100 cm)*: Mempercepatkan pengoksidaan dan pemendapan gambut (peat subsidence rate >3–5 cm setahun), meningkatkan pelepasan CO2, dan meningkatkan risiko kebakaran gambut bawah permukaan.
   - *Kesan jika terlebih basah (<30-40 cm)*: Mengakibatkan keadaan anaerobik akar, melemahkan penyerapan nutrien, dan menggalakkan penyakit reput pucuk.
2. **Pemadatan Gambut Mekanikal (Mechanical Peat Compaction)**:
   - Pemadatan 4 hingga 8 laluan jentera bertrek (crawler excavator / bulldozer) pada laluan penanaman (planting rows) sebelum penanaman.
   - *Fungsi*: Meningkatkan ketumpatan pukal tanah (bulk density dari 0.1 g/cm³ kepada >0.2 g/cm³), meningkatkan daya sokongan akar untuk mencegah pokok tumbang (leaning palms), dan memperbaiki keupayaan pegangan air kapilari tanah.
3. **Nutrisi Mikro Khas Gambut**:
   - Tanah gambut mengalami kekurangan kritikal unsur Kuprum (Cu), Zink (Zn), dan Boron (B).
   - Aplikasi Kuprum Sulfat (Copper Sulphate, CuSO4 @ 15–30 g/pokok) dan Zink Sulfat (ZnSO4 @ 15–30 g/pokok) adalah wajib bagi mengelakkan penyakit 'Peat Yellow' dan 'Mid-crown Chlorosis'.`,
    tags: ['tanah gambut', 'peat', 'paras air', 'water table', '50-75cm', 'pemadatan', 'compaction', 'kuprum', 'zink'],
    metadata: {
      edition: '5th Edition',
      authors: 'R.H.V. Corley, P.B. Tinker',
      publisher: 'Wiley Blackwell',
      year: 2016,
      isbn: '978-1-4051-8939-2',
      keyTopics: ['Tropical Peat', 'Water Table Control', 'Peat Subsidence', 'Micronutrients']
    }
  },

  // Chapter 10 & 11: Mineral Nutrition & Fertilizer Management
  {
    id: 'top5-ch10-01',
    manualTitle: 'The Oil Palm (5th Edition) - R.H.V. Corley & P.B. Tinker',
    category: 'The Oil Palm, 5th Edition',
    chapter: 'Chapter 10 & 11: Mineral Nutrition and Fertilizer Management',
    sectionTitle: 'Paras Kritikal Nutrisi Daun (Frond 17 LSU) & Simptom Kekurangan Makro & Mikro Nutrien',
    pageNumber: 342,
    content: `Ambang piawai analisis daun Pelepah 17 (Frond 17 Leaf Nutrient Concentration) bagi pokok matang (>6 tahun) menurut Corley & Tinker (The Oil Palm 5th Ed, Jadual 11.2, ms 342-378):
- **Nitrogen (N)**: Kritikal < 2.30%, Optimum: **2.50% – 2.80%**, Berlebihan: > 3.00%. (Simptom kurus: daun kuning pucat seragam, pelepah pendek).
- **Fosforus (P)**: Kritikal < 0.140%, Optimum: **0.150% – 0.180%**, Nisbah P/N optimum ~ 0.065. (Simptom kurus: pertumbuhan terbantut, batang berbentuk kon piramid).
- **Kalium (K)**: Kritikal < 0.80%, Optimum: **0.90% – 1.25%**. (Simptom: 'Confluent Orange Spotting' (bintik oren bertaut) dan 'Orange Frond' pada pelepah tua, nekrosis tepi anak daun).
- **Magnesium (Mg)**: Kritikal < 0.20%, Optimum: **0.25% – 0.40%**. (Simptom: 'Orange Spotting' dan klorosis kuning-keemasan terang pada helaian daun yang terdedah terus kepada cahaya matahari, pelepah bawah kekal hijau di bahagian terlindung).
- **Kalsium (Ca)**: Optimum: **0.50% – 0.75%**.
- **Boron (B)**: Kritikal < 12 mg/kg, Optimum: **15 – 25 mg/kg (ppm)**. (Simptom: 'Hook Leaf' (daun cangkuk), 'Blind Leaf', 'Little Leaf', daun berkedut dan rapuh, kegagalan pembentukan bunga betina).
- **Kuprum (Cu)**: Optimum: **4 – 8 mg/kg (ppm)** di tanah mineral, > 5 mg/kg di gambut (mencegah 'Peat Yellow').
- **Zink (Zn)**: Optimum: **12 – 20 mg/kg (ppm)**.
- **Keseimbangan Antagonisme K/Mg**: Penggunaan baja Kalium (MOP) secara berlebihan tanpa bekalan Magnesium (Kieserite/GML) yang mencukupi akan mencetuskan kekurangan Mg (antagonisme ion K+ terhadap Mg2+).`,
    tags: ['lsu', 'frond 17', 'nutrisi', 'nitrogen', 'fosforus', 'kalium', 'magnesium', 'boron', 'kuprum', 'orange spotting', 'hook leaf'],
    metadata: {
      edition: '5th Edition',
      authors: 'R.H.V. Corley, P.B. Tinker',
      publisher: 'Wiley Blackwell',
      year: 2016,
      isbn: '978-1-4051-8939-2',
      keyTopics: ['Frond 17 Critical Levels', 'Nutrient Deficiency', 'K/Mg Antagonism', 'Boron']
    }
  },

  // Chapter 13: Pests of the Oil Palm
  {
    id: 'top5-ch13-01',
    manualTitle: 'The Oil Palm (5th Edition) - R.H.V. Corley & P.B. Tinker',
    category: 'The Oil Palm, 5th Edition',
    chapter: 'Chapter 13: Pests of the Oil Palm',
    sectionTitle: 'Pengurusan Perosak Bersepadu (IPM): Kumbang Badak (Oryctes rhinoceros), Ulat Bungkus & Tikus',
    pageNumber: 420,
    content: `Kawalan perosak utama sawit berasaskan ekologi ladang (The Oil Palm 5th Ed, ms 420-465):
1. **Kumbang Badak (*Oryctes rhinoceros*)**:
   - *Kerosakan*: Mengorek pucuk muda (spear) dan pangkal pelepah mengakibatkan bentuk daun 'potongan kipas' atau 'V-shape'.
   - *Strategi IPM*:
     - Menanam kacang penutup bumi (*Mucuna bracteata*) dengan cepat untuk menutup sisa batang sawit reput (breeding site).
     - Pengawalan biologi menggunakan virus *Oryctes rhinoceros nudivirus* (OrNV) dan kulat entomopatogenik *Metarhizium anisopliae*.
     - Perangkap feromon agregasi sintetis (*Ethyl 4-methyloctanoate*) pada kadar 1 perangkap per 2 hektar di kawasan berisiko tinggi.
     - Semburan Cypermethrin (0.1%) pada pucuk pokok muda setiap 2 minggu semasa serangan tinggi.
2. **Ulat Bungkus (*Metisa plana*, *Mahasena corbetti*, *Pteroma pendula*)**:
   - *Ambang Tindakan Ekonomi (Economic Threshold Level - ETL)*:
     - *Metisa plana*: >10 larva hidup per pelepah (Pelepah 17).
     - *Mahasena corbetti*: >5 larva hidup per pelepah.
   - *Kawalan*:
     - Menanam tanaman bermanfaat (beneficial plants) pembekal nektar untuk parasitoid/predator: *Turnera subulata*, *Antigonon leptopus*, dan *Cassia cobanensis*.
     - Semburan biopestisid *Bacillus thuringiensis* (Bt @ 500g–1kg/ha) untuk larva muda (Instar 1-3).
     - Suntikan batang (trunk injection) dengan Methamidophos atau Acephate bagi pokok matang tinggi (>5 tahun).
3. **Tikus Ladang (*Rattus tiomanicus*, *Rattus argentiventer*)**:
   - *Kerosakan*: Memakan buah masak, putik bunga betina, dan pangkal pokok muda.
   - *Kawalan Biologi*: Pemasangan kotak sarang Burung Hantu Pungguk Jelapang (*Tyto alba*) pada nisbah 1 kotak bagi setiap 5 hingga 10 hektar. Mampu mengawal populasi tikus secara mampan tanpa bergantung kepada racun antikoagulan.`,
    tags: ['ipm', 'perosak', 'oryctes rhinoceros', 'ulat bungkus', 'metisa plana', 'tikus', 'tyto alba', 'turnera subulata', 'trunk injection'],
    metadata: {
      edition: '5th Edition',
      authors: 'R.H.V. Corley, P.B. Tinker',
      publisher: 'Wiley Blackwell',
      year: 2016,
      isbn: '978-1-4051-8939-2',
      keyTopics: ['IPM', 'Oryctes rhinoceros', 'Bagworms', 'Tyto alba', 'Beneficial Plants']
    }
  },

  // Chapter 14: Diseases of the Oil Palm
  {
    id: 'top5-ch14-01',
    manualTitle: 'The Oil Palm (5th Edition) - R.H.V. Corley & P.B. Tinker',
    category: 'The Oil Palm, 5th Edition',
    chapter: 'Chapter 14: Diseases of the Oil Palm',
    sectionTitle: 'Penyakit Reput Pangkal Batang (Basal Stem Rot - Ganoderma boninense) & Amalan Sanitasi Tanam Semula',
    pageNumber: 480,
    content: `Epidemiologi dan pengurusan penyakit kulat sawit paling berbahaya (The Oil Palm 5th Ed, ms 480-512):
- **Etiologi & Patogen**: Disebabkan oleh kulat basidiomiset *Ganoderma boninense* (dan *G. zonatum* / *G. miniatocinctum*).
- **Simptom Lapangan**:
  - Pucuk tidak terbuka (multiple unopened spear leaves, 3–5 pucuk).
  - Pelepah bawah patah terkulai membentuk skirt di sekeliling batang ('skirting effect').
  - Daun menguning klorosis dan nekrosis.
  - Kemunculan jasad buah kulat (basidiocarp / bracket fungi) di pangkal batang pokok.
  - Tisu vaskular pangkal reput reput kering berbau cendawan, menyebabkan pokok tumbang.
- **Protokol Sanitasi Tanam Semula (Sanitary Replanting Protocol)**:
  - Pembajakan & Pencincangan Hablur Batang (Chipping): Batang sawit lama dicincang halus (ketebalan <5–10 cm) dan dibajak (ploughing & harrowing) untuk mempercepatkan pereputan oleh mikrob tanah dan mendedahkan inokulum kepada haba matahari.
  - Mengorek lubang soket akar (De-boling): Tunggul akar dikorek keluar dalam saiz lubang minimum 2m x 2m x 1m untuk membuang punca makanan inokulum kulat.
  - Penanaman lubang baru dilarang sama sekali berada di atas titik sisa pokok mati lama (jarak minimum 1.5–2 meter dari tapak lama).
- **Kawalan Biologi & Kimia**:
  - Inokulasi kulat endofit antagonis *Trichoderma harzianum* / *Trichoderma asperellum* atau *Mycorrhiza* ke dalam polibeg anak benih di tapak semaian dan semasa penanaman di ladang.
  - Rawatan pengorekan cerucuk (mounding / surgery) dan pemendapan tanah di sekeliling batang pokok muda yang dijangkiti untuk merangsang akar adventitius baru.
  - Suntikan fungisid Hexaconazole atau Difenoconazole pada pokok bergejala awal untuk memperlahankan pereputan dalaman.`,
    tags: ['ganoderma', 'basal stem rot', 'reput pangkal batang', 'sanitasi', 'chipping', 'deboling', 'trichoderma', 'hexaconazole'],
    metadata: {
      edition: '5th Edition',
      authors: 'R.H.V. Corley, P.B. Tinker',
      publisher: 'Wiley Blackwell',
      year: 2016,
      isbn: '978-1-4051-8939-2',
      keyTopics: ['Ganoderma boninense', 'Basal Stem Rot', 'Sanitary Replanting', 'Deboling']
    }
  },

  // Chapter 15 & 16: Harvesting, Oil Quality & Mill Processing
  {
    id: 'top5-ch15-01',
    manualTitle: 'The Oil Palm (5th Edition) - R.H.V. Corley & P.B. Tinker',
    category: 'The Oil Palm, 5th Edition',
    chapter: 'Chapter 15 & 16: Harvesting, Oil Quality and Processing',
    sectionTitle: 'Standard Kematangan Buah, Pembentukan Minyak Mesokarpa & Kawalan Asid Lemak Bebas (FFA < 2-3%)',
    pageNumber: 535,
    content: `Dinamik penuaian dan kualiti minyak sawit mentah (CPO) (The Oil Palm 5th Ed, ms 535-578):
- **Sintesis Minyak & Biji Relai**:
  - Minyak mesokarpa disintesis secara aktif pada fasa 3–4 minggu terakhir kematangan buah.
  - Apabila buah mencapai kematangan fisiologi maksima, lapisan absisi (abscission zone) terbentuk pada pangkal tangkai buah, menyebabkan buah terlerai (loose fruit).
  - *Standard Penuaian*: Kriteria penuaian antarabangsa ialah minimum **1 hingga 5 biji relai segar per tandan** di atas tanah sebelum pemotongan tandan.
  - Menuai tandan mentah (unripe bunches) mengakibatkan kehilangan kadar perahan minyak (Oil Extraction Rate - OER) sehingga 2–5% dan kesukaran semasa proses penanggalan buah di kilang (stripping process).
- **Asid Lemak Bebas (Free Fatty Acid - FFA)**:
  - Buah sawit segar yang tidak rosak pada pokok mempunyai FFA <0.2–0.5%.
  - Apabila buah gugur, lebam mekanikal (bruising), atau rosak, enzim lipolitik endogenus (*lipase*) dalam mesokarpa akan aktif dan menghidrolisis trigliserida kepada asid lemak bebas (FFA) dan gliserol pada kadar yang sangat pantas.
  - *Kawalan FFA Kilang*:
    1. Mengelakkan buah terbiar di ladang >24 jam (evakuasi FFB harian).
    2. Menghantar semua biji relai bersih (kutipan biji relai 100% kerana biji relai mengandungi kandungan minyak tertinggi >50% tetapi paling cepat terdedah kepada kenaikan FFA jika tercemar).
    3. Pensterilan kilang (sterilization pada 130–145°C di bawah tekanan stim 3 bar selama 60–90 minit) untuk mematikan enzim lipase sepenuhnya dan melembutkan mesokarpa.
    4. Had piawai FFA bagi CPO eksport premium ialah **< 3.0%** (atau < 5.0% had standard bursa).`,
    tags: ['penuaian', 'kematangan', 'biji relai', 'ffa', 'oer', 'lipase', 'sterilisasi', 'cpo', 'kilang sawit'],
    metadata: {
      edition: '5th Edition',
      authors: 'R.H.V. Corley, P.B. Tinker',
      publisher: 'Wiley Blackwell',
      year: 2016,
      isbn: '978-1-4051-8939-2',
      keyTopics: ['Harvesting Standards', 'Free Fatty Acid (FFA)', 'OER', 'Lipase Inactivation']
    }
  },

  // Chapter 17: Sustainability, Carbon Footprint & Certification
  {
    id: 'top5-ch17-01',
    manualTitle: 'The Oil Palm (5th Edition) - R.H.V. Corley & P.B. Tinker',
    category: 'The Oil Palm, 5th Edition',
    chapter: 'Chapter 17: Environmental and Sustainability Standards',
    sectionTitle: 'Standard Kelestarian MSPO, RSPO, Kawasan Nilai Pemuliharaan Tinggi (HCV) & Pemerangkapan Metana',
    pageNumber: 590,
    content: `Prinsip kelestarian industri sawit global (The Oil Palm 5th Ed, ms 590-624):
- **Dasar NDPE (No Deforestation, No Peat, No Exploitation)**:
  - Komitmen menghentikan sebarang pembukaan hutan primer, hutan nilai pemuliharaan tinggi (High Conservation Value - HCV), dan tanah gambut baru.
- **Piawaian Persijilan MSPO (Malaysian Sustainable Palm Oil) & RSPO**:
  - Prinsip 1-7: Kepatuhan undang-undang, tanggungjawab ketelusan, hak pekerja dan keselamatan (OHS), pengurusan alam sekitar dan kepelbagaian biologi, dan pembangunan penambahbaikan berterusan.
- **Pengekalan Zon Penampan Riparian (Riparian Buffer Zone)**:
  - Mengekalkan zon tebing sungai semulajadi selebar **5 meter hingga 50 meter** bergantung kepada kelebaran sungai untuk menapis larian air sedimen ladang, mencegah hakisan tebing, dan melindungi ekosistem akuatik.
  - Penggunaan sebarang racun kimia dan baja tidak dibenarkan di dalam zon riparian.
- **Pemerangkapan Metana POME (Biogas Methane Capture)**:
  - Efluen Kilang Minyak Sawit (Palm Oil Mill Effluent - POME) menghasilkan gas metana (CH4) yang mempunyai potensi pemanasan global (GWP) 28 kali ganda lebih tinggi berbanding CO2.
  - Pemasangan loji pemerangkap biogas (closed anaerobic digester lagoons/tanks) menukar gas metana kepada tenaga elektrik hijau bagi grid elektrik negara atau kegunaan operasi kilang, mengurangkan jejak karbon (carbon footprint) CPO secara signifikan.`,
    tags: ['kelestarian', 'mspo', 'rspo', 'ndpe', 'hcv', 'zon riparian', 'pome', 'biogas', 'metana', 'karbon'],
    metadata: {
      edition: '5th Edition',
      authors: 'R.H.V. Corley, P.B. Tinker',
      publisher: 'Wiley Blackwell',
      year: 2016,
      isbn: '978-1-4051-8939-2',
      keyTopics: ['Sustainability', 'MSPO', 'RSPO', 'Riparian Buffer', 'Biogas Methane Capture']
    }
  }
];
