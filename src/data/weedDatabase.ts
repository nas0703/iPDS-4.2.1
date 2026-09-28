export interface WeedMasterProfile {
  id: string;
  scientificName: string;
  synonyms?: string[];
  malayName: string;
  englishName: string;
  family: string;
  category: 'Broadleaf' | 'Fern' | 'Grass' | 'Sedge' | 'Woody/Shrub' | 'Climber';
  imageUrl?: string;
  morphology: {
    description: string;
    habitat: string;
    competitionImpact: string;
    spreadMethod: string;
  };
  chemicalControl: {
    target: string;
    activeIngredient: string;
    tradeNameExample: string;
    rate18L: string;
    rate16L: string;
    ratePerHa: string;
    notes: string;
    moaGroup: string; // e.g., 'Group G (EPSP inhibitor)', 'Group B (ALS inhibitor)', etc.
    minPalmAgeMonths: number; // 0 for all, 36 for mature only, etc.
    safeForImmature: boolean; // safe for immature palms
    riparianZoneSafe: boolean; // safe for riparian buffer zone
  }[];
  resistanceManagement: {
    riskLevel: 'Low' | 'Medium' | 'High';
    rotationStrategy: string;
    preventiveTips: string[];
  };
}

export const WEED_DATABASE: WeedMasterProfile[] = [
  {
    id: 'asystasia-gangetica',
    scientificName: 'Asystasia gangetica',
    synonyms: ['Asystasia coromandeliana', 'Asystasia intrusa'],
    malayName: 'Rumput Israel / Asystasia / Pengarak',
    englishName: 'Chinese Violet / Ganges Primrose',
    family: 'Acanthaceae',
    category: 'Broadleaf',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Asystasia_gangetica_09277.jpg/960px-Asystasia_gangetica_09277.jpg',
    morphology: {
      description: 'Herba saka lembut tegak atau menjalar hingga 1-2m. Batang bersegi 4, berakar di ruas. Daun bertentangan, bujur telur dengan hujung tirus. Bunga berbentuk corong berwarna putih krim atau ungu lembut.',
      habitat: 'Kawasan terbuka, lorong piringan sawit, tepi jalan ladang dan parit yang mendapat cahaya separa hingga penuh.',
      competitionImpact: 'Persaingan nutrien yang sangat agresif terhadap sawit muda, cepat merebak melalui biji benih melompat (explosive capsules) dan keratan batang.',
      spreadMethod: 'Biji benih meletup dari kapsul & pembiakan vegetatif melalui ruas batang berakar.'
    },
    chemicalControl: [
      {
        target: 'Asystasia gangetica (Peringkat Aktif / Berbunga)',
        activeIngredient: 'Metsulfuron-methyl 20% w/w',
        tradeNameExample: 'Ally 20DF / Kenly 20WG / Meturon',
        rate18L: '2.5 g – 3.0 g / 18 L',
        rate16L: '2.2 g – 2.67 g / 16 L',
        ratePerHa: '50 g – 75 g / ha',
        notes: 'Semburan basah menyeluruh pada daun aktif. Jangan sembur jika cuaca hendak hujan dalam tempoh 4 jam.',
        moaGroup: 'Group B (ALS / AHAS Inhibitor)',
        minPalmAgeMonths: 12,
        safeForImmature: true,
        riparianZoneSafe: false
      },
      {
        target: 'Asystasia + Rumpai Campuran (Piringan & Lorong)',
        activeIngredient: 'Glyphosate-isopropylamine 41% w/w + Metsulfuron-methyl 20%',
        tradeNameExample: 'Roundup / Spark + Ally 20DF',
        rate18L: '50 ml Glyphosate + 2.0 g Metsulfuron / 18 L',
        rate16L: '44.4 ml Glyphosate + 1.78 g Metsulfuron / 16 L',
        ratePerHa: '1.5 L Glyphosate + 50 g Metsulfuron / ha',
        notes: 'Semburan bertudung (shielded nozzle) pada sawit belum matang (<36 bulan) untuk elak semburan terkena pelepah hijau.',
        moaGroup: 'Group G (EPSP) + Group B (ALS)',
        minPalmAgeMonths: 0,
        safeForImmature: false,
        riparianZoneSafe: false
      },
      {
        target: 'Asystasia di Kawasan Sawit Muda / TBM (Selamat untuk Pelepah Bawah)',
        activeIngredient: 'Glufosinate-ammonium 13.5% w/w',
        tradeNameExample: 'Basta 15 / Ken-Up Glufos / Rely',
        rate18L: '100 ml – 120 ml / 18 L',
        rate16L: '88.9 ml – 106.7 ml / 16 L',
        ratePerHa: '2.5 L – 3.0 L / ha',
        notes: 'Racun sentuhan selektif. Selamat digunakan di keliling sawit muda (<3 tahun) tanpa risiko kerosakan sistemik akar.',
        moaGroup: 'Group H (Glutamine Synthetase Inhibitor)',
        minPalmAgeMonths: 0,
        safeForImmature: true,
        riparianZoneSafe: false
      }
    ],
    resistanceManagement: {
      riskLevel: 'Medium',
      rotationStrategy: 'Gilirkan antara Glufosinate-ammonium (Kumpulan H) dengan Metsulfuron-methyl (Kumpulan B) setiap 2-3 pusingan untuk elak toleransi.',
      preventiveTips: [
        'Kawal sebelum fasa pengeluaran kapsul biji benih meletup.',
        'Kekalkan kekacang penutup bumi (LCC) tebal seperti Mucuna bracteata untuk menekan percambahan Asystasia.',
        'Gunakan nozel deflektor (VLV) untuk liputan titisan rata.'
      ]
    }
  },
  {
    id: 'mikania-micrantha',
    scientificName: 'Mikania micrantha',
    synonyms: ['Mikania cordata'],
    malayName: 'Selaput Tunggul / Ceroma / Pokok Mile-A-Minute',
    englishName: 'Bittervine / Climbing Hempvine / Mile-A-Minute',
    family: 'Asteraceae',
    category: 'Climber',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Mikania_micrantha_129.jpg/960px-Mikania_micrantha_129.jpg',
    morphology: {
      description: 'Rumpai menjalar saka bertumbuh pantas dengan batang beralur halus. Daun berbentuk jantung (cordate) dengan tepi berombak atau bergerigi. Bunga berwarna putih keputihan dalam gugusan jambak.',
      habitat: 'Kawasan tanam semula, ladang sawit muda (TBM), batas teres, dan kawasan terbuka lembap.',
      competitionImpact: 'Menutupi dan melilit pelepah serta pucuk sawit muda sehingga menyekat fotosintesis dan membantutkan tumbesaran pokok.',
      spreadMethod: 'Biji benih berpappus yang terbang ditiup angin jauh & keratan batang ruas.'
    },
    chemicalControl: [
      {
        target: 'Mikania micrantha (Menjalar / Melilit Sawit)',
        activeIngredient: 'Triclopyr-butotyl 32% w/w',
        tradeNameExample: 'Garlon 250 / Triclo 32',
        rate18L: '25 ml – 30 ml / 18 L',
        rate16L: '22.2 ml – 26.7 ml / 16 L',
        ratePerHa: '0.4 L – 0.6 L / ha',
        notes: 'Gunakan semburan titik (spot spraying). Dilarang menyembur terus ke daun/pelepah sawit muda umur <24 bulan.',
        moaGroup: 'Group O (Synthetic Auxins)',
        minPalmAgeMonths: 24,
        safeForImmature: false,
        riparianZoneSafe: false
      },
      {
        target: 'Mikania + Rumput Campuran',
        activeIngredient: 'Metsulfuron-methyl 20% w/w',
        tradeNameExample: 'Ally 20DF / Kenly',
        rate18L: '2.5 g / 18 L',
        rate16L: '2.22 g / 16 L',
        ratePerHa: '50 g – 75 g / ha',
        notes: 'Sangat berkesan untuk mematikan sulur Mikania sehingga ke akar dalam masa 2-3 minggu.',
        moaGroup: 'Group B (ALS Inhibitor)',
        minPalmAgeMonths: 0,
        safeForImmature: true,
        riparianZoneSafe: false
      }
    ],
    resistanceManagement: {
      riskLevel: 'Low',
      rotationStrategy: 'Gunakan Metsulfuron-methyl untuk kawalan pusingan awal; jika rumpai berkayu tebal campur Fluroxypyr atau Triclopyr.',
      preventiveTips: [
        'Leraikan sulur yang melilit pucuk pokok sawit muda secara manual sebelum menyembur racun.',
        'Elakkan semburan racun hormon pada hari berangin kuat.'
      ]
    }
  },
  {
    id: 'nephrolepis-biserrata',
    scientificName: 'Nephrolepis biserrata',
    synonyms: ['Nephrolepis exaltata'],
    malayName: 'Paku Larat / Paku Pedang / Paku Harimau',
    englishName: 'Sword Fern / Fishtail Fern',
    family: 'Nephrolepidaceae / Lomariopsidaceae',
    category: 'Fern',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Nephrolepis_biserrata_-_Botanischer_Garten_M%C3%BCnchen-Nymphenburg_-_DSC08168.JPG/960px-Nephrolepis_biserrata_-_Botanischer_Garten_M%C3%BCnchen-Nymphenburg_-_DSC08168.JPG',
    morphology: {
      description: 'Paku-pakis saka dengan rizom menjalar tebal. Pelepah berukuran 1m hingga 2m panjang, bersegmen pinat dengan anak daun bertepi bergerigi halus dan spora di bawah daun.',
      habitat: 'Bawah naungan kanopi sawit matang, lorong pelepah, batang pokok sawit (epifit), dan tebing parit.',
      competitionImpact: 'Membentuk rumpun tebal yang menyukarkan kutipan buah relai dan pergerakan penuai.',
      spreadMethod: 'Spora halus bawaan angin dan rizom bawah tanah.'
    },
    chemicalControl: [
      {
        target: 'Nephrolepis biserrata (Rumpun Lebat / Atas Tanah)',
        activeIngredient: 'Glyphosate-isopropylamine 41% w/w + Metsulfuron-methyl 20%',
        tradeNameExample: 'Spark 41% + Ally 20DF',
        rate18L: '60 ml Glyphosate + 2.5 g Metsulfuron / 18 L',
        rate16L: '53.3 ml Glyphosate + 2.22 g Metsulfuron / 16 L',
        ratePerHa: '1.8 L Glyphosate + 60 g Metsulfuron / ha',
        notes: 'Semburan basah rata pada permukaan pelepah paku-pakis. Tambah pelekat/surfactant untuk penyerapan lilin daun fern.',
        moaGroup: 'Group G + Group B',
        minPalmAgeMonths: 36,
        safeForImmature: false,
        riparianZoneSafe: false
      },
      {
        target: 'Nephrolepis Atas Batang Sawit (Epifit / Kawalan Selektif)',
        activeIngredient: 'Metsulfuron-methyl 20% w/w',
        tradeNameExample: 'Ally 20DF',
        rate18L: '3.0 g / 18 L',
        rate16L: '2.67 g / 16 L',
        ratePerHa: '75 g / ha',
        notes: 'Sembur pada pangkal rizom di celah batang kelapa sawit tanpa merosakkan tisu pelepah hidup.',
        moaGroup: 'Group B (ALS Inhibitor)',
        minPalmAgeMonths: 48,
        safeForImmature: true,
        riparianZoneSafe: false
      }
    ],
    resistanceManagement: {
      riskLevel: 'Low',
      rotationStrategy: 'Kekalkan Nephrolepis terkawal sebagai penutup bumi ringan untuk kurangkan hakisan dan galakkan musuh semulajadi ulat pemakan daun.',
      preventiveTips: [
        'Jangan basmi 100% di cerun bukit bagi mengelakkan hakisan tanah teres.',
        'Hanya bersihkan di piringan dan lorong menuai.'
      ]
    }
  },
  {
    id: 'imperata-cylindrica',
    scientificName: 'Imperata cylindrica',
    synonyms: ['Lagurus cylindricus'],
    malayName: 'Lalang / Rumput Lalang / Alang-alang',
    englishName: 'Cogon Grass / Speargrass / Bladdy Grass',
    family: 'Poaceae',
    category: 'Grass',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/JapaneseBloodGrass2.JPG/960px-JapaneseBloodGrass2.JPG',
    morphology: {
      description: 'Rumput saka tegak berketinggian 0.6m - 1.5m dengan rizom putih berduri tajam di bawah tanah. Daun berbentuk pita kaku dengan tepi bergerigi halus tajam (silika) dan tulang daun putih jelas di tengah.',
      habitat: 'Kawasan terbiar, tanah lapang tanam semula, dan kawasan berpasir atau kurang subur.',
      competitionImpact: 'Rumpai No. 1 Berbahaya (Noxious Weed). Membebaskan toksin alelopati yang merencatkan akar sawit dan berisiko tinggi kebakaran.',
      spreadMethod: 'Rizom bawah tanah yang menjalar aktif & biji benih berbulu sutera ditiup angin.'
    },
    chemicalControl: [
      {
        target: 'Lalang Padat / Lapisan Lembaran (Sheet Lalang)',
        activeIngredient: 'Glyphosate-isopropylamine 41% w/w',
        tradeNameExample: 'Roundup / Spark / Ken-Up 41',
        rate18L: '150 ml – 200 ml / 18 L',
        rate16L: '133.3 ml – 177.8 ml / 16 L',
        ratePerHa: '4.5 L – 6.0 L / ha (Isipadu air 450 L/ha)',
        notes: 'Sembur pada daun hijau aktif berketinggian 30-45 cm. Elak sembur jika lalang terlalu tua atau berdebu tebal.',
        moaGroup: 'Group G (EPSP Synthase Inhibitor)',
        minPalmAgeMonths: 36,
        safeForImmature: false,
        riparianZoneSafe: false
      },
      {
        target: 'Lalang Tompok / Rawatan Menghapus Lalang Menjalar (Wiping / Spot)',
        activeIngredient: 'Glyphosate 41% (Kaedah Sapuan Sarung Tangan / Glove Wiping)',
        tradeNameExample: 'Roundup Pekat (Nisbah 1:3)',
        rate18L: 'Nisbah 1 bahagian racun + 3 bahagian air bersih',
        rate16L: '1 Bahagian Glyphosate : 3 Bahagian Air',
        ratePerHa: 'Mengikut tompokan titik',
        notes: 'Sapu dengan sarung tangan kain tebal di atas sarung getah kalis kimia terus pada bilah daun lalang. Sangat selamat di keliling anak sawit muda.',
        moaGroup: 'Group G',
        minPalmAgeMonths: 0,
        safeForImmature: true,
        riparianZoneSafe: true
      }
    ],
    resistanceManagement: {
      riskLevel: 'Medium',
      rotationStrategy: 'Selepas semburan pusingan 1 (4-6 minggu), lakukan pusingan semakan (wiping/spot spray) untuk hapuskan sulur lalang yang tertinggal.',
      preventiveTips: [
        'Tanam tanaman penutup bumi Mucuna bracteata dengan segera untuk menyekat cahaya.',
        'Dilarang membakar lalang kerana abu merangsang percambahan rizom bawah tanah.'
      ]
    }
  },
  {
    id: 'chromolaena-odorata',
    scientificName: 'Chromolaena odorata',
    synonyms: ['Eupatorium odoratum'],
    malayName: 'Pokok Kapal Terbang / Pokok Jepun / Rumput Siam',
    englishName: 'Siam Weed / Christmas Bush / Bitter Bush',
    family: 'Asteraceae',
    category: 'Woody/Shrub',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Chromolaena_odorata_by_Ashasathees.jpg/960px-Chromolaena_odorata_by_Ashasathees.jpg',
    morphology: {
      description: 'Pokok renek herba berkayu bercabang banyak berketinggian 1.5m - 3m. Daun bertentangan berbentuk delta-bujur dengan 3 urat daun utama yang sangat jelas dari pangkal. Daun berbau minyak wangi/aromatik kuat apabila diramas.',
      habitat: 'Tanah terbuka, cerun teres tanam semula, dan sempadan ladang.',
      competitionImpact: 'Membentuk semak tebal yang mendominasi kawasan dan membantutkan anak sawit.',
      spreadMethod: 'Biji benih halus dengan bulu berterbangan ditiup angin.'
    },
    chemicalControl: [
      {
        target: 'Pokok Kapal Terbang (Peringkat Pokok Renek Aktif)',
        activeIngredient: 'Triclopyr-butotyl 32% w/w',
        tradeNameExample: 'Garlon 250 / Triclo 32',
        rate18L: '30 ml – 40 ml / 18 L',
        rate16L: '26.7 ml – 35.6 ml / 16 L',
        ratePerHa: '0.6 L – 0.8 L / ha',
        notes: 'Semburan basah rata ke seluruh kanopi semak. Tambahkan pelekat untuk daun berbulu halus.',
        moaGroup: 'Group O (Synthetic Auxins)',
        minPalmAgeMonths: 36,
        safeForImmature: false,
        riparianZoneSafe: false
      },
      {
        target: 'Pokok Kapal Terbang + Rumpai Campuran',
        activeIngredient: 'Metsulfuron-methyl 20% w/w + Glyphosate 41%',
        tradeNameExample: 'Ally 20DF + Spark',
        rate18L: '3.0 g Metsulfuron + 60 ml Glyphosate / 18 L',
        rate16L: '2.67 g Metsulfuron + 53.3 ml Glyphosate / 16 L',
        ratePerHa: '75 g Metsulfuron + 1.8 L Glyphosate / ha',
        notes: 'Sembur sebelum pokok berbunga ungu-putih untuk menghalang pembentukan benih baru.',
        moaGroup: 'Group B + Group G',
        minPalmAgeMonths: 36,
        safeForImmature: false,
        riparianZoneSafe: false
      }
    ],
    resistanceManagement: {
      riskLevel: 'Low',
      rotationStrategy: 'Kawal sebelum fasa pembungaan (Disember - Februari).',
      preventiveTips: [
        'Tebas batang tebal dan sembur pucuk muda yang baru bercambah (regrowth).',
        'Gunakan nozel kon berongga untuk penembusan kanopi semak.'
      ]
    }
  },
  {
    id: 'clidemia-hirta',
    scientificName: 'Clidemia hirta',
    synonyms: ['Melastoma hirtum', 'Miconia crenata'],
    malayName: 'Senduduk Bulu / Daun Bulu',
    englishName: 'Koster\'s Curse / Soapbush',
    family: 'Melastomataceae',
    category: 'Woody/Shrub',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Starr_030729-0107_Clidemia_hirta.jpg/960px-Starr_030729-0107_Clidemia_hirta.jpg',
    morphology: {
      description: 'Pokok renek saka setinggi 0.5m - 2m. Batang dan daun diliputi bulu-bulu kasar kemerahan. Daun berpasangan dengan 5 urat membujur yang melengkung dari pangkal ke hujung daun. Buah beri kecil berwarna ungu gelap/hitam berair.',
      habitat: 'Bawah naungan separa sawit, tepi jalan, dan kawasan lembap.',
      competitionImpact: 'Membentuk belukar berduri bulu yang tebal dan sukar ditembusi.',
      spreadMethod: 'Biji benih dimakan dan disebarkan oleh burung dan kelawar.'
    },
    chemicalControl: [
      {
        target: 'Senduduk Bulu (Clidemia hirta)',
        activeIngredient: 'Metsulfuron-methyl 20% w/w',
        tradeNameExample: 'Ally 20DF / Kenly 20WG',
        rate18L: '3.0 g – 4.0 g / 18 L',
        rate16L: '2.67 g – 3.56 g / 16 L',
        ratePerHa: '75 g – 100 g / ha',
        notes: 'Semburan menyeluruh pada daun berbulu. Wajib guna surfactant bukan ionik (non-ionic surfactant) untuk memastikan titisan racun melekat pada permukaan berbulu.',
        moaGroup: 'Group B (ALS Inhibitor)',
        minPalmAgeMonths: 12,
        safeForImmature: true,
        riparianZoneSafe: false
      },
      {
        target: 'Senduduk Bulu Batang Keras / Matang',
        activeIngredient: 'Triclopyr-butotyl 32% w/w',
        tradeNameExample: 'Garlon 250',
        rate18L: '35 ml – 45 ml / 18 L',
        rate16L: '31.1 ml – 40.0 ml / 16 L',
        ratePerHa: '0.8 L / ha',
        notes: 'Semburan titik pada rumpun pokok renek.',
        moaGroup: 'Group O (Synthetic Auxins)',
        minPalmAgeMonths: 36,
        safeForImmature: false,
        riparianZoneSafe: false
      }
    ],
    resistanceManagement: {
      riskLevel: 'Low',
      rotationStrategy: 'Kawal ketika peringkat anak pokok sebelum menghasilkan buah beri hitam.',
      preventiveTips: [
        'Pastikan larutan dicampur surfactant (pelekat) agar racun tidak melantun daripada bulu daun.'
      ]
    }
  },
  {
    id: 'eleusine-indica',
    scientificName: 'Eleusine indica',
    synonyms: ['Cynosurus indicus'],
    malayName: 'Rumput Sambau / Rumput Karpet / Sambau Degil',
    englishName: 'Goosegrass / Wiregrass / Yardgrass',
    family: 'Poaceae',
    category: 'Grass',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Eleusine_indica%2C_closeup.jpg/960px-Eleusine_indica%2C_closeup.jpg',
    morphology: {
      description: 'Rumput semusim atau saka berumpun padat dengan sistem akar serabut yang amat kuat mencengkam tanah. Batang leper di pangkal. Jambak bunga mempunyai 2-6 spika jejari di hujung tangkai seperti tapak kaki angsa.',
      habitat: 'Lorong piringan sawit, laluan kenderaan traktar ladang, tanah padat, dan tepi jalan.',
      competitionImpact: 'Sangat tahan pijakan dan cepat membina ketahanan/kerintangan terhadap Glyphosate.',
      spreadMethod: 'Biji benih halus yang melekat pada roda jentera dan kasut pekerja.'
    },
    chemicalControl: [
      {
        target: 'Sambau Biasa / Peringkat Muda (2-4 Daun)',
        activeIngredient: 'Glufosinate-ammonium 13.5% w/w',
        tradeNameExample: 'Basta 15 / Ken-Up Glufos',
        rate18L: '120 ml – 150 ml / 18 L',
        rate16L: '106.7 ml – 133.3 ml / 16 L',
        ratePerHa: '3.0 L – 3.5 L / ha',
        notes: 'Racun sentuhan. Sembur semasa rumput masih muda sebelum mengeluarkan tangkai bunga spika.',
        moaGroup: 'Group H (Glutamine Synthetase Inhibitor)',
        minPalmAgeMonths: 0,
        safeForImmature: true,
        riparianZoneSafe: false
      },
      {
        target: 'Sambau Rintang Glyphosate (Degil)',
        activeIngredient: 'Fluazifop-p-butyl 12.5% w/w ATAU Clethodim 24% w/w',
        tradeNameExample: 'Fusilade Forte / Select 240 EC',
        rate18L: '40 ml – 50 ml / 18 L',
        rate16L: '35.6 ml – 44.4 ml / 16 L',
        ratePerHa: '1.0 L – 1.25 L / ha',
        notes: 'Graminicide selektif. Mematikan rumput famili Poaceae tanpa merosakkan pokok kekacang penutup bumi atau pokok sawit.',
        moaGroup: 'Group A (ACCase Inhibitor)',
        minPalmAgeMonths: 0,
        safeForImmature: true,
        riparianZoneSafe: false
      }
    ],
    resistanceManagement: {
      riskLevel: 'High',
      rotationStrategy: 'AMARAN KERINTANGAN: Elakkan menggunakan Glyphosate berulang kali pada Rumput Sambau. Wajib rotasi dengan Glufosinate-ammonium (Kumpulan H) atau Fluazifop-butyl (Kumpulan A).',
      preventiveTips: [
        'Sembur pada peringkat awal anak rumput (sebelum keluar 4 helai daun).',
        'Jangan potong/mesin sebelum sembur racun sistemik.'
      ]
    }
  },
  {
    id: 'paspalum-conjugatum',
    scientificName: 'Paspalum conjugatum',
    synonyms: ['Sour Paspalum'],
    malayName: 'Rumput Kerbau / Buffalo Grass / Rumput T-Bar',
    englishName: 'Buffalo Grass / Sour Grass / T-Grass',
    family: 'Poaceae',
    category: 'Grass',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Starr_070208-4357_Paspalum_conjugatum.jpg/960px-Starr_070208-4357_Paspalum_conjugatum.jpg',
    morphology: {
      description: 'Rumput saka menjalar dengan stolon panjang berakar di buku. Daun lembut berbulu halus di tepi. Jambak bunga berpecah dua membentuk huruf T atau V yang sangat khas di hujung tangkai.',
      habitat: 'Lorong piringan, bawah kanopi naungan separa hingga terbuka, tanah lembap.',
      competitionImpact: 'Rumpai sederhana; jika terkawal baik boleh bertindak sebagai penutup bumi ringan pencegah hakisan cerun.',
      spreadMethod: 'Stolon merayap menjalar dan biji benih melekat pada bulu haiwan/pekerja.'
    },
    chemicalControl: [
      {
        target: 'Rumput Kerbau (Piringan & Lorong)',
        activeIngredient: 'Glyphosate-isopropylamine 41% w/w',
        tradeNameExample: 'Spark 41% / Roundup',
        rate18L: '50 ml – 60 ml / 18 L',
        rate16L: '44.4 ml – 53.3 ml / 16 L',
        ratePerHa: '1.2 L – 1.5 L / ha',
        notes: 'Semburan basah rata pada daun aktif. Elakkan kena pelepah sawit muda.',
        moaGroup: 'Group G (EPSP Inhibitor)',
        minPalmAgeMonths: 24,
        safeForImmature: false,
        riparianZoneSafe: false
      }
    ],
    resistanceManagement: {
      riskLevel: 'Low',
      rotationStrategy: 'Mudah dikawal dengan Glyphosate atau Glufosinate.',
      preventiveTips: [
        'Kekalkan di luar piringan sebagai penutup tanah sederhana jika tiada rumpai berbahaya.'
      ]
    }
  },
  {
    id: 'ottochloa-nodosa',
    scientificName: 'Ottochloa nodosa',
    synonyms: ['Panicum nodosum', 'Ottochloa gracillima'],
    malayName: 'Rumput Pait / Rumput Sarang Buaya',
    englishName: 'Slender Panic Grass',
    family: 'Poaceae',
    category: 'Grass',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Ottochloa_gracillima_flowerhead2_%288240458390%29.jpg/960px-Ottochloa_gracillima_flowerhead2_%288240458390%29.jpg',
    morphology: {
      description: 'Rumput saka menjalar lembut dengan buku berbuku licin dan daun tirus runcing. Sangat toleran terhadap naungan tebal sawit matang (shade tolerant).',
      habitat: 'Di bawah naungan kanopi sawit matang (umur >7 tahun) dan lorong pelepah.',
      competitionImpact: 'Persaingan nutrien rendah ke sederhana, namun boleh membentuk lapisan tebal menyukarkan kutip relai.',
      spreadMethod: 'Keratan ruas batang berakar dan biji benih.'
    },
    chemicalControl: [
      {
        target: 'Rumput Pait di Bawah Naungan Sawit Matang',
        activeIngredient: 'Glyphosate-isopropylamine 41% w/w',
        tradeNameExample: 'Roundup / Spark',
        rate18L: '40 ml – 50 ml / 18 L',
        rate16L: '35.6 ml – 44.4 ml / 16 L',
        ratePerHa: '1.0 L – 1.2 L / ha',
        notes: 'Sangat peka kepada racun Glyphosate pada dos rendah.',
        moaGroup: 'Group G (EPSP Inhibitor)',
        minPalmAgeMonths: 36,
        safeForImmature: false,
        riparianZoneSafe: false
      }
    ],
    resistanceManagement: {
      riskLevel: 'Low',
      rotationStrategy: 'Gunakan dos ekonomi rendah untuk kawalan efisien kos.',
      preventiveTips: ['Sembur apabila ketinggian melepasi 20 cm.']
    }
  },
  {
    id: 'borreria-latifolia',
    scientificName: 'Borreria latifolia',
    synonyms: ['Spermacoce alata', 'Borreria alata'],
    malayName: 'Rumput Setawar / Pokok Butang / Rumput Lidah Tiong',
    englishName: 'Broadleaf Buttonweed',
    family: 'Rubiaceae',
    category: 'Broadleaf',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/Spermacoce_alata1062.jpg/960px-Spermacoce_alata1062.jpg',
    morphology: {
      description: 'Herba daun lebar tegak atau condong dengan batang bersegi 4 bersayap nipis. Daun lebar bertentangan dengan permukaan agak berkedut dan kekuningan. Bunga putih kecil berkumpul di ketiak daun.',
      habitat: 'Kawasan terdedah cahaya matahari penuh, sawit muda TBM, batas teres.',
      competitionImpact: 'Persaingan cepat menyerap baja nitrogen dan fosfat di sekeliling zon perakaran sawit muda.',
      spreadMethod: 'Biji benih halus yang banyak dan berdaya tahan lama di dalam tanah.'
    },
    chemicalControl: [
      {
        target: 'Rumput Setawar (Borreria latifolia)',
        activeIngredient: 'Metsulfuron-methyl 20% + Glyphosate 41%',
        tradeNameExample: 'Ally 20DF + Spark',
        rate18L: '2.5 g Metsulfuron + 50 ml Glyphosate / 18 L',
        rate16L: '2.22 g Metsulfuron + 44.4 ml Glyphosate / 16 L',
        ratePerHa: '50 g Metsulfuron + 1.5 L Glyphosate / ha',
        notes: 'Gunakan campuran Metsulfuron untuk kawalan sempurna sistemik akar.',
        moaGroup: 'Group B + Group G',
        minPalmAgeMonths: 12,
        safeForImmature: true,
        riparianZoneSafe: false
      }
    ],
    resistanceManagement: {
      riskLevel: 'Medium',
      rotationStrategy: 'Gunakan Fluroxypyr jika terdapat kerintangan terhadap Metsulfuron.',
      preventiveTips: ['Kawal sebelum biji butang di ketiak daun matang dan gugur.']
    }
  },
  {
    id: 'melastoma-malabathricum',
    scientificName: 'Melastoma malabathricum',
    synonyms: ['Melastoma polyanthum'],
    malayName: 'Senduduk Biasa / Senduduk Ungu / Keduduk',
    englishName: 'Indian Rhododendron / Malabar Gooseberry',
    family: 'Melastomataceae',
    category: 'Woody/Shrub',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Melastoma_malabathricum_09897.JPG/960px-Melastoma_malabathricum_09897.JPG',
    morphology: {
      description: 'Pokok renek berkayu setinggi 1m - 3m. Daun bujur dengan 3-5 urat daun melengkung membujur dari pangkal. Bunga besar cantik berwarna ungu kemerahan atau merah jambu dengan stamen kuning-ungu. Buah lembut merekah isi ungu kehitaman.',
      habitat: 'Tanah asid terbuka, tepi jalan ladang, bukit teres tanam semula.',
      competitionImpact: 'Membentuk belukar renek tebal yang menyekat operasi ladang dan bersaing kelembapan tanah.',
      spreadMethod: 'Biji benih dimakan dan disebar oleh burung.'
    },
    chemicalControl: [
      {
        target: 'Senduduk Biasa (Melastoma)',
        activeIngredient: 'Triclopyr-butotyl 32% w/w ATAU Metsulfuron-methyl 20%',
        tradeNameExample: 'Garlon 250 / Ally 20DF',
        rate18L: '30 ml Triclopyr ATAU 3.5 g Metsulfuron / 18 L',
        rate16L: '26.7 ml Triclopyr ATAU 3.1 g Metsulfuron / 16 L',
        ratePerHa: '0.6 L Triclopyr / ha',
        notes: 'Sembur basah pada pucuk dan daun aktif. Tambah surfactant penembus.',
        moaGroup: 'Group O (Synthetic Auxins) / Group B',
        minPalmAgeMonths: 24,
        safeForImmature: false,
        riparianZoneSafe: false
      }
    ],
    resistanceManagement: {
      riskLevel: 'Low',
      rotationStrategy: 'Kawal semasa pokok renek masih muda (<1m tinggi).',
      preventiveTips: ['Tebas batang besar dan sembur pucuk baru dengan Triclopyr.']
    }
  },
  {
    id: 'mimosa-pudica',
    scientificName: 'Mimosa pudica',
    synonyms: ['Mimosa hispidula'],
    malayName: 'Semalu / Pokok Tidur / Rumput Duri Semalu',
    englishName: 'Sensitive Plant / Touch-Me-Not / Shameplant',
    family: 'Fabaceae',
    category: 'Woody/Shrub',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Touch_Me_not.jpg/960px-Touch_Me_not.jpg',
    morphology: {
      description: 'Herba renek merayap berduri tajam bengkok ke bawah. Daun majmuk bipinat yang menguncup serta-merta apabila disentuh atau ditiup angin kencang. Bunga berbentuk bebola bulat halus berwarna merah jambu cerah.',
      habitat: 'Lorong piringan, tepi jalan, kawasan lapang berpasir dan lereng bukit.',
      competitionImpact: 'Duri tajam mencucuk tayar traktor & mencederakan kaki pekerja menuai serta pemunggah buah relai.',
      spreadMethod: 'Biji benih berduri halus dalam lenggai yang melekat pada pakaian dan kasut.'
    },
    chemicalControl: [
      {
        target: 'Semalu (Mimosa pudica)',
        activeIngredient: 'Fluroxypyr 200 g/L ATAU Triclopyr 32.1%',
        tradeNameExample: 'Starane 200 / Garlon 250',
        rate18L: '25 ml – 35 ml Starane 200 / 18 L',
        rate16L: '22.2 ml – 31.1 ml Starane 200 / 16 L',
        ratePerHa: '0.5 L – 0.7 L / ha',
        notes: 'Sembur pada waktu pagi sebelum daun menguncup akibat panas terik untuk penyerapan racun maksimum.',
        moaGroup: 'Group O (Synthetic Auxins)',
        minPalmAgeMonths: 12,
        safeForImmature: true,
        riparianZoneSafe: false
      }
    ],
    resistanceManagement: {
      riskLevel: 'Low',
      rotationStrategy: 'Gunakan Fluroxypyr yang sangat selektif dan selamat untuk pokok sawit.',
      preventiveTips: ['Sembur semasa daun kembang terbuka penuh.']
    }
  },
  {
    id: 'dicranopteris-linearis',
    scientificName: 'Dicranopteris linearis',
    synonyms: ['Gleichenia linearis'],
    malayName: 'Resam / Paku Resam',
    englishName: 'Old World Forked Fern',
    family: 'Gleicheniaceae',
    category: 'Fern',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Starr_070405-6757_Dicranopteris_linearis.jpg/960px-Starr_070405-6757_Dicranopteris_linearis.jpg',
    morphology: {
      description: 'Paku-pakis darat bercabang dua (garpu) berulang kali membentuk belukar tebal setinggi 1-3 meter. Batang keras liat dan berserat tinggi.',
      habitat: 'Tanah bukit laterit terhakis, tanah berasid tinggi, lereng bukit terdedah dan tebing teres.',
      competitionImpact: 'Membentuk lapisan belukar tebal yang menyekat pergerakan penuaian dan meningkatkan risiko kebakaran musim kemarau.',
      spreadMethod: 'Spora halus bawaan angin dan rizom bawah tanah yang merebak meluas.'
    },
    chemicalControl: [
      {
        target: 'Resam Belukar Tebal',
        activeIngredient: 'Metsulfuron-methyl 20% + Glyphosate 41%',
        tradeNameExample: 'Ally 20DF + Roundup',
        rate18L: '3.5 g Metsulfuron + 80 ml Glyphosate / 18 L',
        rate16L: '3.1 g Metsulfuron + 71.1 ml Glyphosate / 16 L',
        ratePerHa: '75 g Metsulfuron + 2.5 L Glyphosate / ha',
        notes: 'Picit/tindih belukar resam terlebih dahulu untuk dedahkan pucuk muda sebelum sembur basah bersama surfactant penetran.',
        moaGroup: 'Group B + Group G',
        minPalmAgeMonths: 24,
        safeForImmature: false,
        riparianZoneSafe: false
      }
    ],
    resistanceManagement: {
      riskLevel: 'Low',
      rotationStrategy: 'Gunakan bahan penembus (organosilicone surfactant) untuk menembusi lapisan kutikel berlilin resam.',
      preventiveTips: ['Kawal semasa rumpun masih kecil sebelum membentuk hamparan tebal.']
    }
  },
  {
    id: 'axonopus-compressus',
    scientificName: 'Axonopus compressus',
    synonyms: ['Broadleaf Carpet Grass'],
    malayName: 'Rumput Parit / Rumput Tikar / Carpet Grass',
    englishName: 'Broadleaf Carpet Grass / Savanna Grass',
    family: 'Poaceae',
    category: 'Grass',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Starr_040812-0040_Axonopus_compressus.jpg/960px-Starr_040812-0040_Axonopus_compressus.jpg',
    morphology: {
      description: 'Rumput penutup bumi merayap padat dengan stolon leper. Hujung daun agak tumpul/membulat berbanding rumput lain. Membentuk permaidani hijau padat.',
      habitat: 'Lorong pelepah, kawasan terbuka, tanah lapang lembap dan tebing jalan ladang.',
      competitionImpact: 'Persaingan rendah. Sering dikekalkan di luar piringan sebagai penutup bumi semula jadi pencegah hakisan tanah.',
      spreadMethod: 'Stolon merayap padat di atas permukaan tanah dan biji benih.'
    },
    chemicalControl: [
      {
        target: 'Rumput Parit di Piringan Pokok & Lorong Tuai',
        activeIngredient: 'Glyphosate-isopropylamine 41% w/w',
        tradeNameExample: 'Spark 41% / Roundup',
        rate18L: '45 ml – 55 ml / 18 L',
        rate16L: '40 ml – 48.8 ml / 16 L',
        ratePerHa: '1.2 L – 1.5 L / ha',
        notes: 'Sembur pada kawasan piringan sahaja (radius 1.5m - 2.0m). Kekalkan di lorong tengah jika tidak bersaing.',
        moaGroup: 'Group G (EPSP Inhibitor)',
        minPalmAgeMonths: 18,
        safeForImmature: false,
        riparianZoneSafe: false
      }
    ],
    resistanceManagement: {
      riskLevel: 'Low',
      rotationStrategy: 'Boleh dikawal dengan dos ekonomi rendah Glyphosate atau Glufosinate.',
      preventiveTips: ['Kekalkan sebagai kawalan biologi hakisan di kawasan lereng bukit.']
    }
  },
  {
    id: 'paspalum-commersonii',
    scientificName: 'Paspalum scrobiculatum',
    synonyms: ['Paspalum commersonii'],
    malayName: 'Rumput Mas / Kodo Millet / Paspalum Kasar',
    englishName: 'Kodo Grass / Rice Grass Paspalum',
    family: 'Poaceae',
    category: 'Grass',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Starr_030405-0044_Paspalum_scrobiculatum.jpg/960px-Starr_030405-0044_Paspalum_scrobiculatum.jpg',
    morphology: {
      description: 'Rumput saka berumpun tegak atau condong setinggi 30–80 cm. Jambak bunga mempunyai 2–4 spika berselang dengan biji bulat berwarna coklat gelap berkilat.',
      habitat: 'Kawasan terbuka, parit ladang, tanah berpasir atau lembap bertakung.',
      competitionImpact: 'Persaingan nutrien sederhana di piringan sawit muda.',
      spreadMethod: 'Biji benih bulat banyak yang gugur ke tanah.'
    },
    chemicalControl: [
      {
        target: 'Rumput Mas / Paspalum Kasar',
        activeIngredient: 'Glyphosate 41% w/w ATAU Glufosinate 13.5%',
        tradeNameExample: 'Spark 41% / Basta 15',
        rate18L: '55 ml – 65 ml / 18 L',
        rate16L: '48.8 ml – 57.7 ml / 16 L',
        ratePerHa: '1.5 L – 1.8 L / ha',
        notes: 'Sembur semasa daun masih muda dan aktif tumbuh sebelum biji coklat matang.',
        moaGroup: 'Group G / Group H',
        minPalmAgeMonths: 12,
        safeForImmature: true,
        riparianZoneSafe: false
      }
    ],
    resistanceManagement: {
      riskLevel: 'Low',
      rotationStrategy: 'Gunakan campuran sinergi jika bercampur rumpai daun lebar.',
      preventiveTips: ['Sembur sebelum tangkai bunga mengeluarkan biji benih bulat coklat.']
    }
  },
  {
    id: 'commelina-diffusa',
    scientificName: 'Commelina diffusa',
    synonyms: ['Commelina nudiflora'],
    malayName: 'Rumput Aur / Rumput Lidah Lembu / Spiderwort',
    englishName: 'Climbing Dayflower / Spreading Dayflower',
    family: 'Commelinaceae',
    category: 'Broadleaf',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Commelina_diffusa_pollinator_Layton_171_XTBG.JPG/960px-Commelina_diffusa_pollinator_Layton_171_XTBG.JPG',
    morphology: {
      description: 'Herba lembut berair (succulent) merayap dengan batang berbuku mengeluarkan akar. Bunga kecil sangat cantik berwarna biru terang dengan 3 kelopak. Daun berbentuk bujur tirus.',
      habitat: 'Kawasan lembap, tepi parit ladang, tapak rendang berkabus dan piringan sawit bertanah subur.',
      competitionImpact: 'Sukar mati jika hanya dimesin kerana setiap keratan batang berair boleh hidup semula menjadi pokok baru.',
      spreadMethod: 'Keratan batang berair berakar pada setiap ruas dan biji benih kapsul.'
    },
    chemicalControl: [
      {
        target: 'Rumput Aur / Commelina Merayap',
        activeIngredient: 'Fluroxypyr 200 g/L + Metsulfuron-methyl 20%',
        tradeNameExample: 'Starane 200 + Ally 20DF',
        rate18L: '30 ml Starane + 2.0 g Ally / 18 L',
        rate16L: '26.7 ml Starane + 1.78 g Ally / 16 L',
        ratePerHa: '0.6 L Starane + 40 g Ally / ha',
        notes: 'Glyphosate sahaja kurang berkesan kerana batang herba berair tebal; perlu guna herbisid sistemik hormon (Fluroxypyr / Triclopyr).',
        moaGroup: 'Group O + Group B',
        minPalmAgeMonths: 12,
        safeForImmature: true,
        riparianZoneSafe: false
      }
    ],
    resistanceManagement: {
      riskLevel: 'Medium',
      rotationStrategy: 'Jangan gunakan racun sentuh sahaja (seperti paraquat gantian) kerana akan bertunas semula.',
      preventiveTips: ['Elakkan mencantas atau memesin rumput aur kerana menyebarkan keratan ruas.']
    }
  },
  {
    id: 'praxelis-clematidea',
    scientificName: 'Praxelis clematidea',
    synonyms: ['Eupatorium catarium'],
    malayName: 'Rumput Praxelis / Renek Pokok Kapal Terbang Mini',
    englishName: 'Praxelis',
    family: 'Asteraceae',
    category: 'Broadleaf',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Praxelis_clematidea_%28Griseb.%29_R.M.King_%26_H.Rob._%284798927323%29.jpg/960px-Praxelis_clematidea_%28Griseb.%29_R.M.King_%26_H.Rob._%284798927323%29.jpg',
    morphology: {
      description: 'Herba daun lebar tegak berbulu halus setinggi 20–60 cm. Daun bujur bergerigi kasar berpasangan bertentangan. Bunga jambak berwarna ungu kebiruan/lavender cerah di hujung pucuk.',
      habitat: 'Kawasan tanam semula (replanting), batas teres, lorong piringan sawit muda.',
      competitionImpact: 'Sangat cepat membiak mengeluarkan ribuan biji benih berbulu (pappus) diterbangkan angin.',
      spreadMethod: 'Biji benih ringan berbulu diterbangkan angin jauh merentasi ladang.'
    },
    chemicalControl: [
      {
        target: 'Praxelis clematidea',
        activeIngredient: 'Metsulfuron-methyl 20% w/w ATAU Triclopyr 32.1%',
        tradeNameExample: 'Ally 20DF / Garlon 250',
        rate18L: '2.5 g Ally ATAU 20 ml Garlon / 18 L',
        rate16L: '2.22 g Ally ATAU 17.8 ml Garlon / 16 L',
        ratePerHa: '50 g Ally / ha',
        notes: 'Sangat peka kepada Metsulfuron-methyl pada peringkat muda sebelum berbunga ungu.',
        moaGroup: 'Group B (ALS Inhibitor)',
        minPalmAgeMonths: 12,
        safeForImmature: true,
        riparianZoneSafe: false
      }
    ],
    resistanceManagement: {
      riskLevel: 'Medium',
      rotationStrategy: 'Sembur awal sebelum biji ungu bertukar putih dan ditiup angin.',
      preventiveTips: ['Kawal semasa fasa vegetatif (sebelum pokok mencapai ketinggian 30 cm).']
    }
  },
  {
    id: 'passiflora-foetida',
    scientificName: 'Passiflora foetida',
    synonyms: ['Stinking Passionflower'],
    malayName: 'Pokok Ubi Hutan / Letup-letup / Buah Bulu',
    englishName: 'Wild Water Lemon / Stinking Passionflower',
    family: 'Passifloraceae',
    category: 'Climber',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Passiflora_foetida_1.JPG/960px-Passiflora_foetida_1.JPG',
    morphology: {
      description: 'Tumbuhan memanjat melilit (vine) berbulu melekit dengan sulur paut. Daun berlekuk tiga (3 lobes) berbau hapak bila diramas. Bunga putih berkelopak jejari dengan buah bulat terbungkus dalam braktea berbulu seperti jaring sarang.',
      habitat: 'Kawasan terbuka, sawit muda TBM, memanjat pelepah dan timbunan sisa kayu.',
      competitionImpact: 'Memanjat dan menutup kanopi sawit muda, membantutkan tumbesaran pelepah dan fotosintesis.',
      spreadMethod: 'Biji benih manis disebarkan oleh musang, tupai dan burung.'
    },
    chemicalControl: [
      {
        target: 'Letup-letup / Passiflora memanjat',
        activeIngredient: 'Fluroxypyr 200 g/L ATAU Triclopyr 32.1%',
        tradeNameExample: 'Starane 200 / Garlon 250',
        rate18L: '25 ml – 30 ml Starane / 18 L',
        rate16L: '22.2 ml – 26.7 ml Starane / 16 L',
        ratePerHa: '0.5 L – 0.6 L / ha',
        notes: 'Tarik sulur turun daripada pelepah sawit muda sebelum sembur untuk elak pelepah terkena racun.',
        moaGroup: 'Group O (Synthetic Auxins)',
        minPalmAgeMonths: 12,
        safeForImmature: true,
        riparianZoneSafe: false
      }
    ],
    resistanceManagement: {
      riskLevel: 'Low',
      rotationStrategy: 'Gunakan herbisid selektif daun lebar.',
      preventiveTips: ['Kawal sebelum buah bulat kekuningan masak dan dimakan haiwan perosak.']
    }
  },
  {
    id: 'ficus-fistulosa',
    scientificName: 'Ficus spp. (Anak Ara / Pokok Ara Epifit)',
    synonyms: ['Ficus benjamina', 'Ficus microcarpa', 'Ficus fistulosa'],
    malayName: 'Pokok Ara Epifit / Anak Kayu Ara / Strangler Fig',
    englishName: 'Strangler Fig / Epiphytic Fig',
    family: 'Moraceae',
    category: 'Woody/Shrub',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Ficus_fistulosa03.JPG/960px-Ficus_fistulosa03.JPG',
    morphology: {
      description: 'Pokok kayu ara epifit yang tumbuh di celah ketiak pelepah batang sawit. Menghasilkan akar udara (aerial roots) tebal yang melilit dan mencekik batang sawit sehingga membesar.',
      habitat: 'Ketiak pelepah sawit matang (umur >5 tahun), pokok tua.',
      competitionImpact: 'Akar mencekik batang sawit, memecahkan ketiak pelepah, menyerap nutrien baja sawit dan merosakkan pokok secara kekal.',
      spreadMethod: 'Biji buah ara dimakan oleh burung dan dibuang melalui najis di celah pelepah sawit.'
    },
    chemicalControl: [
      {
        target: 'Ara Epifit di Celah Pelepah Sawit',
        activeIngredient: 'Triclopyr-butotyl 32.1% w/w dalam Minyak Diesel (Nisbah 1 : 19)',
        tradeNameExample: 'Garlon 250 + Diesel',
        rate18L: '50 ml Garlon dalam 1 L Diesel (Sapuan Batang Basal)',
        rate16L: '50 ml Garlon dalam 1 L Diesel',
        ratePerHa: 'Sapuan terus pada pangkal anak ara (Spot Painting)',
        notes: 'Potong batang anak ara dengan parang, kemudian sapu/sembur campuran Triclopyr + Diesel pada permukaan luka keratan dan pangkal akar epifit.',
        moaGroup: 'Group O (Basal Bark / Cut Stump Application)',
        minPalmAgeMonths: 36,
        safeForImmature: false,
        riparianZoneSafe: false
      }
    ],
    resistanceManagement: {
      riskLevel: 'Low',
      rotationStrategy: 'Kaedah potong dan sapu (cut-stump) paling efektif berbanding semburan daun.',
      preventiveTips: ['Cabut anak ara semasa masih kecil pada fasa pusingan pruning / menuai bulanan.']
    }
  },
  {
    id: 'cyperus-rotundus',
    scientificName: 'Cyperus rotundus / Cyperus aromaticus',
    synonyms: ['Cyperus aromaticus', 'Kyllinga polyphylla'],
    malayName: 'Rumput Halia Hitam / Rumput Butang Rusiga / Nut Grass',
    englishName: 'Purple Nutsedge / Navua Sedge',
    family: 'Cyperaceae',
    category: 'Sedge',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/ac/Nutgrass_Cyperus_rotundus02.jpg',
    morphology: {
      description: 'Rusiga saka tegak berakar umbisi (tubers) beraroma harum di dalam tanah. Batang segi tiga licin tanpa buku. Jambak bunga payung berwarna coklat kemerahan atau hijau keputihan.',
      habitat: 'Kawasan terbuka lembap, batas parit, lorong piringan sawit muda tanah gambut dan mineral.',
      competitionImpact: 'Mempunyai sistem umbisi tahan lasak di bawah tanah yang cepat bertunas semula selepas semburan sentuh.',
      spreadMethod: 'Rangkaian umbisi bawah tanah & biji benih halus.'
    },
    chemicalControl: [
      {
        target: 'Rusiga / Halia Hitam (Cyperus spp.)',
        activeIngredient: 'Glyphosate 41% + Metsulfuron-methyl 20%',
        tradeNameExample: 'Spark 41% + Ally 20DF',
        rate18L: '60 ml Glyphosate + 2.5 g Metsulfuron / 18 L',
        rate16L: '53.3 ml Glyphosate + 2.22 g Metsulfuron / 16 L',
        ratePerHa: '1.8 L Glyphosate + 60 g Metsulfuron / ha',
        notes: 'Sembur pada daun aktif sebelum berbunga. Memerlukan penyerapan sistemik hingga ke umbisi tanah.',
        moaGroup: 'Group G + Group B',
        minPalmAgeMonths: 18,
        safeForImmature: false,
        riparianZoneSafe: false
      }
    ],
    resistanceManagement: {
      riskLevel: 'Medium',
      rotationStrategy: 'Jangan tebas atau cangkul kerana menceraikan umbisi menyebabkan percambahan berganda.',
      preventiveTips: ['Kawal semasa fasa vegetatif sebelum umbisi baru terbentuk.']
    }
  },
  {
    id: 'stenochlaena-palustris',
    scientificName: 'Stenochlaena palustris',
    synonyms: ['Lomariobotrys palustris'],
    malayName: 'Paku Midin / Paku Miding / Paku Lemiding',
    englishName: 'Climbing Fern / Edible Fern',
    family: 'Blechnaceae',
    category: 'Fern',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Stenochlaena-palustris-SF24028-01.jpg/960px-Stenochlaena-palustris-SF24028-01.jpg',
    morphology: {
      description: 'Paku-pakis memanjat saka dengan rizom tebal bersisik yang merayap di atas tanah dan memanjat batang pokok sawit. Pelepah pinat berkilat, pucuk muda kemerahan/coklat tembaga.',
      habitat: 'Tanah gambut (peat soil), kawasan sawit bertanah rendah, tebing parit ladang lembap.',
      competitionImpact: 'Memanjat kanopi sawit, menutup buah sawit dan menyukarkan operasi penuaian jika dibiarkan tebal.',
      spreadMethod: 'Rizom menjalar agresif dan spora bawaan angin.'
    },
    chemicalControl: [
      {
        target: 'Paku Miding / Memanjat Batang Sawit',
        activeIngredient: 'Metsulfuron-methyl 20% w/w',
        tradeNameExample: 'Ally 20DF / Kenly 20WG',
        rate18L: '2.5 g – 3.0 g / 18 L',
        rate16L: '2.22 g – 2.67 g / 16 L',
        ratePerHa: '60 g – 75 g / ha',
        notes: 'Sembur pada bahagian pangkal rizom paku miding. Tambah bahan pelekat.',
        moaGroup: 'Group B (ALS Inhibitor)',
        minPalmAgeMonths: 36,
        safeForImmature: true,
        riparianZoneSafe: false
      }
    ],
    resistanceManagement: {
      riskLevel: 'Low',
      rotationStrategy: 'Kawal paku miding yang memanjat lebih daripada 1.5 meter dari pangkal pokok sawit.',
      preventiveTips: ['Tarik turun rizom memanjat semasa pusingan pruning.']
    }
  },
  {
    id: 'tetracera-indica',
    scientificName: 'Tetracera indica',
    synonyms: ['Tetracera assa', 'Tetracera sarmentosa'],
    malayName: 'Akar Mempelas / Daun Mempelas / Empelas',
    englishName: 'Sandpaper Vine / Fire Vine',
    family: 'Dilleniaceae',
    category: 'Climber',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Tetracera_indica01.JPG/960px-Tetracera_indica01.JPG',
    morphology: {
      description: 'Tumbuhan berkayu memanjat melilit yang kuat. Daun bujur kesat tebal seperti kertas pasir (sandpaper) dengan urat daun yang menonjol. Bunga putih wangi dengan buah kapsul kemerahan.',
      habitat: 'Pinggir ladang, batas sempadan hutan, kawasan sawit bertanah mineral dan bukit.',
      competitionImpact: 'Batang berkayu tebal membelit pokok sawit muda dan pelepah matang sehingga merosakkan bentuk kanopi.',
      spreadMethod: 'Biji benih disebar oleh burung dan mamalia kecil.'
    },
    chemicalControl: [
      {
        target: 'Akar Mempelas Berkayu',
        activeIngredient: 'Triclopyr-butotyl 32% w/w ATAU Fluroxypyr 200 g/L',
        tradeNameExample: 'Garlon 250 / Starane 200',
        rate18L: '30 ml – 40 ml Garlon / 18 L',
        rate16L: '26.7 ml – 35.6 ml Garlon / 16 L',
        ratePerHa: '0.6 L – 0.8 L / ha',
        notes: 'Semburan titik pada daun dan batang melilit. Untuk batang kayu besar gunakan kaedah sapuan potong pangkal (cut-stump).',
        moaGroup: 'Group O (Synthetic Auxins)',
        minPalmAgeMonths: 24,
        safeForImmature: false,
        riparianZoneSafe: false
      }
    ],
    resistanceManagement: {
      riskLevel: 'Low',
      rotationStrategy: 'Kawal sebelum batang berkayu melilit melebihi 2 inci tebal.',
      preventiveTips: ['Leraikan lilitan batang daripada pelepah pokok sawit.']
    }
  }
];
