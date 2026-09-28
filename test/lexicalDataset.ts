export interface LexicalTestCase {
  id: string;
  category: 'exact' | 'numerical' | 'mixed_en_bm' | 'document_code';
  question: string;
  expectedDocument: string;
  expectedPage: number;
  expectedKeywords: string[];
  description: string;
}

export const LEXICAL_TEST_DATASET: LexicalTestCase[] = [
  // ==========================================================================
  // 1. EXACT TERMINOLOGY QUERIES (5 TEST CASES)
  // ==========================================================================
  {
    id: "LEX-EX-001",
    category: "exact",
    question: "Berapakah kadar upah bagi kerja menuai BTS?",
    expectedDocument: "KUK_Siri_8_2026.pdf",
    expectedPage: 47,
    expectedKeywords: ["kadar", "upah", "menuai", "BTS", "RM18.50"],
    description: "Exact Malay terminology query for BTS harvesting wage rate"
  },
  {
    id: "LEX-EX-002",
    category: "exact",
    question: "Apakah jenis racun herbisid yang digunakan untuk kawalan Eleusine indica?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 104,
    expectedKeywords: ["Eleusine indica", "herbisid", "racun", "Glufosinate"],
    description: "Exact weed scientific name and herbicide control search"
  },
  {
    id: "LEX-EX-003",
    category: "exact",
    question: "Apakah prosedur pemakaian kelengkapan perlindungan diri PPE dalam SOP keselamatan?",
    expectedDocument: "SOP_Keselamatan_FPMSB_2025.pdf",
    expectedPage: 12,
    expectedKeywords: ["PPE", "kelengkapan", "perlindungan", "keselamatan"],
    description: "Exact safety PPE SOP procedure inquiry"
  },
  {
    id: "LEX-EX-004",
    category: "exact",
    question: "Berapakah kadar peratusan buah masak minimum yang ditetapkan di pentas penuaian?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 85,
    expectedKeywords: ["peratusan", "buah", "masak", "minimum", "pentas"],
    description: "Exact quality standard ripeness percentage query"
  },
  {
    id: "LEX-EX-005",
    category: "exact",
    question: "Apakah pusingan penuaian sawit yang disyorkan dalam Manual Sawit Edisi 3?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 82,
    expectedKeywords: ["pusingan", "penuaian", "hari", "disyorkan"],
    description: "Exact harvesting cycle interval query"
  },

  // ==========================================================================
  // 2. NUMERICAL / RATE / DOSAGE QUERIES (5 TEST CASES)
  // ==========================================================================
  {
    id: "LEX-NUM-001",
    category: "numerical",
    question: "Apakah dos racun Glufosinate-ammonium untuk pam muatan 18 liter?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 110,
    expectedKeywords: ["Glufosinate", "18 liter", "18L", "dos", "75ml"],
    description: "Numerical dosage query per 18L spray pump"
  },
  {
    id: "LEX-NUM-002",
    category: "numerical",
    question: "Berapakah kadar baja Compact Felda 12 yang disyorkan sebanyak 2.5 kg/ha?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 64,
    expectedKeywords: ["Compact Felda 12", "2.5 kg/ha", "baja", "kadar"],
    description: "Numerical fertilizer rate query in kg/ha"
  },
  {
    id: "LEX-NUM-003",
    category: "numerical",
    question: "Apakah kadar bayaran upah penuaian BTS RM18.50 per tan?",
    expectedDocument: "KUK_Siri_8_2026.pdf",
    expectedPage: 47,
    expectedKeywords: ["RM18.50", "per tan", "upah", "penuaian", "BTS"],
    description: "Numerical rate search with RM currency and per tan metric"
  },
  {
    id: "LEX-NUM-004",
    category: "numerical",
    question: "Berapakah pusingan merumput lorong 60 hari sekali?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 98,
    expectedKeywords: ["pusingan", "merumput", "lorong", "60 hari"],
    description: "Numerical day interval search for weeding round"
  },
  {
    id: "LEX-NUM-005",
    category: "numerical",
    question: "Apakah kadar upah pemangkasan pelepah RM1.80 per pokok?",
    expectedDocument: "KUK_Siri_8_2026.pdf",
    expectedPage: 52,
    expectedKeywords: ["RM1.80", "per pokok", "pemangkasan", "pelepah"],
    description: "Numerical rate search per palm tree for pruning"
  },

  // ==========================================================================
  // 3. MALAY-ENGLISH MIXED QUERIES (5 TEST CASES)
  // ==========================================================================
  {
    id: "LEX-MIX-001",
    category: "mixed_en_bm",
    question: "What is the harvesting wage rate for BTS in KUK Siri 8?",
    expectedDocument: "KUK_Siri_8_2026.pdf",
    expectedPage: 47,
    expectedKeywords: ["harvesting", "wage", "rate", "BTS", "KUK Siri 8"],
    description: "Mixed English-Malay query for harvesting wage rate"
  },
  {
    id: "LEX-MIX-002",
    category: "mixed_en_bm",
    question: "What is the recommended herbicide spraying rate for weed control in circle and path?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 102,
    expectedKeywords: ["herbicide", "spraying", "rate", "weed control", "circle", "path"],
    description: "Mixed agronomy spraying rate query in English"
  },
  {
    id: "LEX-MIX-003",
    category: "mixed_en_bm",
    question: "What is the fertilizer application schedule for PUS 1 in FPMSB estates?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 60,
    expectedKeywords: ["fertilizer", "application", "schedule", "PUS 1", "FPMSB"],
    description: "Mixed fertilizer schedule query with PUS code"
  },
  {
    id: "LEX-MIX-004",
    category: "mixed_en_bm",
    question: "What are the pruning quality standards according to MSPO and FPMSB guidelines?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 75,
    expectedKeywords: ["pruning", "quality", "standards", "MSPO", "FPMSB"],
    description: "Mixed pruning standards query referencing MSPO and FPMSB"
  },
  {
    id: "LEX-MIX-005",
    category: "mixed_en_bm",
    question: "What safety equipment PPE is mandatory for chemical spraying workers?",
    expectedDocument: "SOP_Keselamatan_FPMSB_2025.pdf",
    expectedPage: 14,
    expectedKeywords: ["safety", "equipment", "PPE", "mandatory", "chemical", "spraying"],
    description: "Mixed safety equipment query for chemical workers"
  },

  // ==========================================================================
  // 4. DOCUMENT CODE & SPECIFICATION QUERIES (5 TEST CASES)
  // ==========================================================================
  {
    id: "LEX-DOC-001",
    category: "document_code",
    question: "Apakah penetapan rasmi dalam KUK Siri 8 Tahun 2026?",
    expectedDocument: "KUK_Siri_8_2026.pdf",
    expectedPage: 1,
    expectedKeywords: ["KUK Siri 8", "2026", "penetapan", "rasmi"],
    description: "Exact document identifier search for KUK Siri 8 2026"
  },
  {
    id: "LEX-DOC-002",
    category: "document_code",
    question: "Apakah panduan utama dalam Manual Sawit Edisi 3?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 1,
    expectedKeywords: ["Manual Sawit Edisi 3", "panduan", "utama"],
    description: "Exact document code search for Manual Sawit Edisi 3"
  },
  {
    id: "LEX-DOC-003",
    category: "document_code",
    question: "Apakah piawaian kawalan mutu dalam MSL FPMSB 2025?",
    expectedDocument: "MSL_FPMSB_2025.pdf",
    expectedPage: 5,
    expectedKeywords: ["MSL", "FPMSB", "2025", "kawalan", "mutu"],
    description: "Document code search for MSL FPMSB 2025"
  },
  {
    id: "LEX-DOC-004",
    category: "document_code",
    question: "Apakah langkah keselamatan mengikut SOP Keselamatan FPMSB 2025?",
    expectedDocument: "SOP_Keselamatan_FPMSB_2025.pdf",
    expectedPage: 1,
    expectedKeywords: ["SOP Keselamatan", "FPMSB", "2025"],
    description: "Document code search for SOP Keselamatan FPMSB 2025"
  },
  {
    id: "LEX-DOC-005",
    category: "document_code",
    question: "Apakah arahan pentadbiran dalam Pekeliling FPMSB 2026?",
    expectedDocument: "Pekeliling_FPMSB_2026.pdf",
    expectedPage: 1,
    expectedKeywords: ["Pekeliling FPMSB", "2026", "arahan"],
    description: "Document code search for Pekeliling FPMSB 2026"
  }
];

export interface AdversarialTestCase {
  id: string;
  biasTarget: 'bm25_favored' | 'vector_favored' | 'hybrid_favored';
  categoryName: string;
  question: string;
  expectedDocument: string;
  expectedPage: number;
  expectedKeywords: string[];
  description: string;
}

export const ADVERSARIAL_LEXICAL_DATASET: AdversarialTestCase[] = [
  // ==========================================================================
  // 1. BM25 FAVORED (10 TEST CASES) - Exact numbers, codes, dosages, scientific names
  // ==========================================================================
  {
    id: "ADV-BM25-001",
    biasTarget: "bm25_favored",
    categoryName: "Exact Rate & Code",
    question: "Berapakah kadar upah penuaian BTS RM18.50 per tan?",
    expectedDocument: "KUK_Siri_8_2026.pdf",
    expectedPage: 47,
    expectedKeywords: ["RM18.50", "per tan", "BTS"],
    description: "Exact currency RM18.50 and metric per tan"
  },
  {
    id: "ADV-BM25-002",
    biasTarget: "bm25_favored",
    categoryName: "Exact Dosage Code",
    question: "Apakah dos racun Glufosinate-ammonium 18 liter?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 110,
    expectedKeywords: ["18 liter", "75ml", "Glufosinate"],
    description: "Exact volume code 18 liter and chemical name"
  },
  {
    id: "ADV-BM25-003",
    biasTarget: "bm25_favored",
    categoryName: "Exact Fertilizer Rate",
    question: "Apakah sukatan baja Compact Felda 12 sebanyak 2.5 kg/ha?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 64,
    expectedKeywords: ["2.5 kg/ha", "Compact Felda 12"],
    description: "Exact unit rate 2.5 kg/ha"
  },
  {
    id: "ADV-BM25-004",
    biasTarget: "bm25_favored",
    categoryName: "Document Identifier",
    question: "Apakah penetapan rasmi KUK Siri 8 2026?",
    expectedDocument: "KUK_Siri_8_2026.pdf",
    expectedPage: 1,
    expectedKeywords: ["KUK Siri 8", "2026"],
    description: "Exact document code KUK Siri 8 2026"
  },
  {
    id: "ADV-BM25-005",
    biasTarget: "bm25_favored",
    categoryName: "Scientific Weed Name",
    question: "Apakah racun herbisid untuk Eleusine indica?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 104,
    expectedKeywords: ["Eleusine indica", "Glufosinate-ammonium 15%"],
    description: "Exact botanical weed species name Eleusine indica"
  },
  {
    id: "ADV-BM25-006",
    biasTarget: "bm25_favored",
    categoryName: "Pruning Rate",
    question: "Berapakah kadar upah pemangkasan pelepah RM1.80 per pokok?",
    expectedDocument: "KUK_Siri_8_2026.pdf",
    expectedPage: 52,
    expectedKeywords: ["RM1.80", "per pokok", "pruning"],
    description: "Exact pruning unit wage RM1.80 per tree"
  },
  {
    id: "ADV-BM25-007",
    biasTarget: "bm25_favored",
    categoryName: "Exact Day Interval",
    question: "Berapakah pusingan merumput lorong 60 hari sekali?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 98,
    expectedKeywords: ["60 hari", "merumput", "lorong"],
    description: "Exact numerical interval 60 hari"
  },
  {
    id: "ADV-BM25-008",
    biasTarget: "bm25_favored",
    categoryName: "Quality Percentage",
    question: "Apakah syarat 95% buah masak di pentas penuaian?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 85,
    expectedKeywords: ["95%", "pentas penuaian"],
    description: "Exact numerical percentage 95%"
  },
  {
    id: "ADV-BM25-009",
    biasTarget: "bm25_favored",
    categoryName: "Document Code MSL",
    question: "Apakah piawaian kawalan mutu MSL FPMSB 2025?",
    expectedDocument: "MSL_FPMSB_2025.pdf",
    expectedPage: 5,
    expectedKeywords: ["MSL", "FPMSB", "2025"],
    description: "Exact code identifier MSL FPMSB 2025"
  },
  {
    id: "ADV-BM25-010",
    biasTarget: "bm25_favored",
    categoryName: "Document Code SOP",
    question: "Apakah kandungan SOP Keselamatan FPMSB 2025?",
    expectedDocument: "SOP_Keselamatan_FPMSB_2025.pdf",
    expectedPage: 1,
    expectedKeywords: ["SOP Keselamatan", "FPMSB", "2025"],
    description: "Exact code identifier SOP Keselamatan FPMSB 2025"
  },

  // ==========================================================================
  // 2. VECTOR FAVORED (10 TEST CASES) - Conceptual, synonym & paraphrased queries with minimal exact keyword overlap
  // ==========================================================================
  {
    id: "ADV-VEC-001",
    biasTarget: "vector_favored",
    categoryName: "Conceptual Weed Control",
    question: "Bagaimanakah cara mengawal tumbuhan perosak liar di ladang kelapa sawit?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 104,
    expectedKeywords: ["rumpai", "herbisid", "Eleusine indica"],
    description: "Paraphrased query for weed control without using literal word rumpai"
  },
  {
    id: "ADV-VEC-002",
    biasTarget: "vector_favored",
    categoryName: "Conceptual Wage Payment",
    question: "Berapakah bayaran ganjaran wang untuk mengutip buah kelapa sawit?",
    expectedDocument: "KUK_Siri_8_2026.pdf",
    expectedPage: 47,
    expectedKeywords: ["kadar", "upah", "BTS"],
    description: "Paraphrased wage query for BTS harvesting"
  },
  {
    id: "ADV-VEC-003",
    biasTarget: "vector_favored",
    categoryName: "Conceptual Safety Protection",
    question: "Apakah panduan menjaga keselamatan diri pekerja daripada bahan kimia beracun?",
    expectedDocument: "SOP_Keselamatan_FPMSB_2025.pdf",
    expectedPage: 14,
    expectedKeywords: ["PPE", "chemical spraying", "respirator"],
    description: "Semantic query for chemical spraying safety protection"
  },
  {
    id: "ADV-VEC-004",
    biasTarget: "vector_favored",
    categoryName: "Conceptual Cycle Interval",
    question: "Apakah selang masa pusingan pengambilan hasil sawit dari pokok?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 82,
    expectedKeywords: ["pusingan", "penuaian", "10 hingga 12 hari"],
    description: "Semantic query for harvesting cycle without literal word penuaian"
  },
  {
    id: "ADV-VEC-005",
    biasTarget: "vector_favored",
    categoryName: "Conceptual Soil Nutrition",
    question: "Bagaimanakah kaedah pemberian nutrisi galian untuk kesihatan pokok sawit?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 60,
    expectedKeywords: ["pembajaan", "PUS 1", "Compact Felda 12"],
    description: "Semantic query for palm fertilization program"
  },
  {
    id: "ADV-VEC-006",
    biasTarget: "vector_favored",
    categoryName: "Conceptual Quality Standard",
    question: "Apakah syarat kualiti kelayakan buah sawit di tempat pengumpulan?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 85,
    expectedKeywords: ["pentas penuaian", "buah masak"],
    description: "Semantic query for harvesting ramp fruit quality"
  },
  {
    id: "ADV-VEC-007",
    biasTarget: "vector_favored",
    categoryName: "Conceptual Tree Maintenance",
    question: "Apakah amalan kebersihan pokok dengan memotong daun tua?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 75,
    expectedKeywords: ["pruning", "pemangkasan", "pelepah"],
    description: "Semantic query for frond pruning"
  },
  {
    id: "ADV-VEC-008",
    biasTarget: "vector_favored",
    categoryName: "Conceptual Work Discipline",
    question: "Apakah peraturan tatatertib dan masa bekerja kakitangan estate?",
    expectedDocument: "Pekeliling_FPMSB_2026.pdf",
    expectedPage: 1,
    expectedKeywords: ["Pekeliling", "waktu kerja", "disiplin"],
    description: "Semantic query for estate administration circular"
  },
  {
    id: "ADV-VEC-009",
    biasTarget: "vector_favored",
    categoryName: "Conceptual Sustainability Audit",
    question: "Apakah kelayakan pensijilan pematuhan pengeluaran minyak sawit mampan?",
    expectedDocument: "MSL_FPMSB_2025.pdf",
    expectedPage: 5,
    expectedKeywords: ["MSL", "MSPO", "kebolehkesanan"],
    description: "Semantic query for sustainable palm oil certification audit"
  },
  {
    id: "ADV-VEC-010",
    biasTarget: "vector_favored",
    categoryName: "Conceptual Hazard Protection",
    question: "Bagaimanakah langkah perlindungan daripada kecederaan di kawasan kerja perladangan?",
    expectedDocument: "SOP_Keselamatan_FPMSB_2025.pdf",
    expectedPage: 1,
    expectedKeywords: ["SOP Keselamatan", "kawalan hazad"],
    description: "Semantic query for workplace hazard controls"
  },

  // ==========================================================================
  // 3. HYBRID FAVORED (10 TEST CASES) - Combined exact codes/rates AND conceptual descriptions
  // ==========================================================================
  {
    id: "ADV-HYB-001",
    biasTarget: "hybrid_favored",
    categoryName: "Hybrid Weed & Pump",
    question: "Bagaimanakah kawalan rumpai degil Eleusine indica menggunakan racun herbisid dilarutkan dalam pam 18L?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 110,
    expectedKeywords: ["18 liter", "75ml", "Glufosinate"],
    description: "Combines exact term 18L + Eleusine indica AND conceptual spray intent"
  },
  {
    id: "ADV-HYB-002",
    biasTarget: "hybrid_favored",
    categoryName: "Hybrid Wage & Circular",
    question: "Berapakah kadar bayaran imbalan penuaian BTS RM18.50 mengikut pekeliling KUK Siri 8?",
    expectedDocument: "KUK_Siri_8_2026.pdf",
    expectedPage: 47,
    expectedKeywords: ["RM18.50", "BTS", "KUK Siri 8"],
    description: "Combines exact rate RM18.50 + code KUK Siri 8 AND conceptual wage phrasing"
  },
  {
    id: "ADV-HYB-003",
    biasTarget: "hybrid_favored",
    categoryName: "Hybrid Fertilizer & Dosage",
    question: "Apakah jadual pemberian nutrisi tanaman PUS 1 menggunakan baja Compact Felda 12 pada kadar 2.5 kg/ha?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 64,
    expectedKeywords: ["2.5 kg/ha", "Compact Felda 12", "PUS 1"],
    description: "Combines exact PUS 1 + 2.5 kg/ha AND conceptual nutrition phrasing"
  },
  {
    id: "ADV-HYB-004",
    biasTarget: "hybrid_favored",
    categoryName: "Hybrid Safety & PPE",
    question: "Bagaimanakah garis panduan keselamatan pemakaian kelengkapan PPE untuk semburan bahan beracun mengikut SOP FPMSB 2025?",
    expectedDocument: "SOP_Keselamatan_FPMSB_2025.pdf",
    expectedPage: 14,
    expectedKeywords: ["PPE", "chemical spraying", "SOP Keselamatan"],
    description: "Combines exact PPE + SOP FPMSB 2025 AND conceptual safety phrasing"
  },
  {
    id: "ADV-HYB-005",
    biasTarget: "hybrid_favored",
    categoryName: "Hybrid Harvesting & Manual",
    question: "Apakah selang pusingan penuaian FFB yang ideal untuk menjaga kualiti minyak mengikut Manual Sawit Edisi 3?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 82,
    expectedKeywords: ["10 hingga 12 hari", "FFB", "Manual Sawit Edisi 3"],
    description: "Combines exact FFB + Manual Sawit Edisi 3 AND conceptual quality phrasing"
  },
  {
    id: "ADV-HYB-006",
    biasTarget: "hybrid_favored",
    categoryName: "Hybrid Quality & Percentage",
    question: "Apakah kriteria peratusan minimum 95% kualiti buah kelayakan di pentas penuaian?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 85,
    expectedKeywords: ["95%", "pentas penuaian"],
    description: "Combines exact 95% AND conceptual quality criteria phrasing"
  },
  {
    id: "ADV-HYB-007",
    biasTarget: "hybrid_favored",
    categoryName: "Hybrid Pruning & Wage Code",
    question: "Berapakah kadar imbalan bayaran pemangkasan pelepah RM1.80 mengikut penetapan KUK Siri 8?",
    expectedDocument: "KUK_Siri_8_2026.pdf",
    expectedPage: 52,
    expectedKeywords: ["RM1.80", "KUK Siri 8", "pemangkasan"],
    description: "Combines exact RM1.80 + KUK Siri 8 AND conceptual pruning wage phrasing"
  },
  {
    id: "ADV-HYB-008",
    biasTarget: "hybrid_favored",
    categoryName: "Hybrid Weeding & Day Interval",
    question: "Bagaimanakah kaedah merumput lorong bulatan pusingan 60 hari untuk mengelakkan rumpai liar?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 98,
    expectedKeywords: ["60 hari", "merumput", "lorong"],
    description: "Combines exact 60 hari AND conceptual weed prevention phrasing"
  },
  {
    id: "ADV-HYB-009",
    biasTarget: "hybrid_favored",
    categoryName: "Hybrid Sustainability & MSL",
    question: "Apakah audit piawaian kebolehkesanan minyak sawit mampan mengikut MSL FPMSB 2025?",
    expectedDocument: "MSL_FPMSB_2025.pdf",
    expectedPage: 5,
    expectedKeywords: ["MSL FPMSB 2025", "kebolehkesanan", "MSPO"],
    description: "Combines exact code MSL FPMSB 2025 AND conceptual audit phrasing"
  },
  {
    id: "ADV-HYB-010",
    biasTarget: "hybrid_favored",
    categoryName: "Hybrid Work Hours & Circular",
    question: "Apakah arahan kedatangan dan waktu kerja disiplin kakitangan mengikut Pekeliling FPMSB 2026?",
    expectedDocument: "Pekeliling_FPMSB_2026.pdf",
    expectedPage: 1,
    expectedKeywords: ["Pekeliling FPMSB 2026", "waktu kerja", "disiplin"],
    description: "Combines exact code Pekeliling FPMSB 2026 AND conceptual work hours phrasing"
  }
];

