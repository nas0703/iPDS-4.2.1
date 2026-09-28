export interface RetrievalTestCase {
  id: string;
  category: string;
  queryType: 'exact' | 'natural_bm' | 'mixed_en_bm' | 'synonym' | 'operational' | 'negative';
  question: string;
  expectedDocument: string;
  expectedPage: number | null;
  expectedSection: string;
  expectedKeywords: string[];
  isVerified: boolean;
  isCritical: boolean;
  isNegative?: boolean;
}

export const RETRIEVAL_EVALUATION_DATASET: RetrievalTestCase[] = [
  // --------------------------------------------------------------------------
  // KATEGORI 1: KUK Siri 8 / Kadar Upah (Critical)
  // --------------------------------------------------------------------------
  {
    id: "KUK-001",
    category: "KUK Siri 8",
    queryType: "exact",
    question: "Berapakah kadar upah bagi kerja menuai BTS?",
    expectedDocument: "KUK_Siri_8_2026.pdf",
    expectedPage: 47,
    expectedSection: "Penuaian BTS",
    expectedKeywords: ["menuai", "BTS", "kadar", "tan", "upah"],
    isVerified: true,
    isCritical: true
  },
  {
    id: "KUK-002",
    category: "KUK Siri 8",
    queryType: "natural_bm",
    question: "Berapa bayaran untuk seorang pekerja yang menuai buah sawit mengikut tan?",
    expectedDocument: "KUK_Siri_8_2026.pdf",
    expectedPage: 47,
    expectedSection: "Penuaian BTS",
    expectedKeywords: ["bayaran", "pekerja", "menuai", "sawit", "tan"],
    isVerified: true,
    isCritical: true
  },
  {
    id: "KUK-003",
    category: "KUK Siri 8",
    queryType: "mixed_en_bm",
    question: "What is the harvesting wage rate for BTS per tonne in FPMSB?",
    expectedDocument: "KUK_Siri_8_2026.pdf",
    expectedPage: 47,
    expectedSection: "Penuaian BTS",
    expectedKeywords: ["harvesting", "wage", "rate", "BTS", "tonne"],
    isVerified: true,
    isCritical: true
  },
  {
    id: "KUK-004",
    category: "KUK Siri 8",
    queryType: "synonym",
    question: "Apakah ganjaran bagi kerja-kerja memotong tandan buah segar?",
    expectedDocument: "KUK_Siri_8_2026.pdf",
    expectedPage: 47,
    expectedSection: "Penuaian BTS",
    expectedKeywords: ["ganjaran", "memotong", "tandan", "buah", "segar"],
    isVerified: true,
    isCritical: true
  },
  {
    id: "KUK-005",
    category: "KUK Siri 8",
    queryType: "operational",
    question: "Jika pekerja ditugaskan menuai BTS di ladang, kadar unit bayaran yang digunakan ialah apa?",
    expectedDocument: "KUK_Siri_8_2026.pdf",
    expectedPage: 47,
    expectedSection: "Penuaian BTS",
    expectedKeywords: ["ditugaskan", "menuai", "BTS", "kadar", "unit"],
    isVerified: true,
    isCritical: true
  },

  // --------------------------------------------------------------------------
  // KATEGORI 2: Penuaian (Critical)
  // --------------------------------------------------------------------------
  {
    id: "HARV-001",
    category: "Penuaian",
    queryType: "exact",
    question: "Apakah pusingan penuaian sawit yang disyorkan dalam Manual Sawit?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 82,
    expectedSection: "Pusingan Penuaian",
    expectedKeywords: ["pusingan", "penuaian", "hari", "disyorkan"],
    isVerified: true,
    isCritical: true
  },
  {
    id: "HARV-002",
    category: "Penuaian",
    queryType: "natural_bm",
    question: "Berapa hari sekali pemotong sawit perlu masuk ke blok untuk mengambil buah masak?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 82,
    expectedSection: "Pusingan Penuaian",
    expectedKeywords: ["hari", "pemotong", "masuk", "blok", "buah", "masak"],
    isVerified: true,
    isCritical: true
  },
  {
    id: "HARV-003",
    category: "Penuaian",
    queryType: "mixed_en_bm",
    question: "What is the recommended harvesting interval standard in days?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 82,
    expectedSection: "Pusingan Penuaian",
    expectedKeywords: ["harvesting", "interval", "standard", "days"],
    isVerified: true,
    isCritical: true
  },
  {
    id: "HARV-004",
    category: "Penuaian",
    queryType: "operational",
    question: "Bagaimanakah penentuan buah masak minimum mengikut standard brondol lerai?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 85,
    expectedSection: "Standard Buah Masak",
    expectedKeywords: ["penentuan", "buah", "masak", "brondol", "lerai"],
    isVerified: true,
    isCritical: true
  },

  // --------------------------------------------------------------------------
  // KATEGORI 3: Pembajaan (Critical)
  // --------------------------------------------------------------------------
  {
    id: "FERT-001",
    category: "Pembajaan",
    queryType: "exact",
    question: "Apakah dos pembajaan MOP untuk pokok matured di kawasan tanah laterit?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 112,
    expectedSection: "Program Pembajaan",
    expectedKeywords: ["dos", "pembajaan", "MOP", "pokok", "matang", "laterit"],
    isVerified: true,
    isCritical: true
  },
  {
    id: "FERT-002",
    category: "Pembajaan",
    queryType: "natural_bm",
    question: "Berapa banyak baja MOP perlu ditabur pada setiap pokok sawit dewasa setahun?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 112,
    expectedSection: "Program Pembajaan",
    expectedKeywords: ["banyak", "baja", "MOP", "ditabur", "pokok", "dewasa"],
    isVerified: true,
    isCritical: true
  },
  {
    id: "FERT-003",
    category: "Pembajaan",
    queryType: "mixed_en_bm",
    question: "What is the fertilizer application rate for Muriate of Potash MOP per palm?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 112,
    expectedSection: "Program Pembajaan",
    expectedKeywords: ["fertilizer", "application", "rate", "MOP", "palm"],
    isVerified: true,
    isCritical: true
  },
  {
    id: "FERT-004",
    category: "Pembajaan",
    queryType: "synonym",
    question: "Apakah sukatan pemakanan pokok bagi baja MOP untuk kawasan tanam?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 112,
    expectedSection: "Program Pembajaan",
    expectedKeywords: ["sukatan", "pemakanan", "pokok", "baja", "MOP"],
    isVerified: true,
    isCritical: true
  },

  // --------------------------------------------------------------------------
  // KATEGORI 4: Merumput / Kawalan Rumpai (Critical)
  // --------------------------------------------------------------------------
  {
    id: "WEED-001",
    category: "Merumput / Kawalan Rumpai",
    queryType: "exact",
    question: "Apakah dos racun Glyphosate yang disyorkan bagi semburan piringan pokok?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 64,
    expectedSection: "Kawalan Rumpai Piringan",
    expectedKeywords: ["dos", "racun", "Glyphosate", "semburan", "piringan"],
    isVerified: true,
    isCritical: true
  },
  {
    id: "WEED-002",
    category: "Merumput / Kawalan Rumpai",
    queryType: "natural_bm",
    question: "Berapa liter racun Glyphosate diperlukan untuk satu tangki pam galas 18 liter?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 64,
    expectedSection: "Kawalan Rumpai Piringan",
    expectedKeywords: ["liter", "racun", "Glyphosate", "tangki", "pam", "galas"],
    isVerified: true,
    isCritical: true
  },
  {
    id: "WEED-003",
    category: "Merumput / Kawalan Rumpai",
    queryType: "operational",
    question: "Jika menyembur lalang di lorong tuaian, apakah jenis herbisid dan kadar per hektar yang betul?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 66,
    expectedSection: "Kawalan Lalang",
    expectedKeywords: ["menyembur", "lalang", "lorong", "herbisid", "hektar"],
    isVerified: true,
    isCritical: true
  },

  // --------------------------------------------------------------------------
  // KATEGORI 5: P&D (Perosak & Penyakit)
  // --------------------------------------------------------------------------
  {
    id: "PND-001",
    category: "P&D",
    queryType: "exact",
    question: "Apakah langkah kawalan biologi bagi perosak ulat bungkus di ladang sawit?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 140,
    expectedSection: "Kawalan Ulat Bungkus",
    expectedKeywords: ["kawalan", "biologi", "ulat", "bungkus", "sawit"],
    isVerified: true,
    isCritical: false
  },
  {
    id: "PND-002",
    category: "P&D",
    queryType: "natural_bm",
    question: "Bagaimana cara mengatasi serangan kumbang tanduk pada pokok sawit muda?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 145,
    expectedSection: "Kawalan Kumbang Tanduk",
    expectedKeywords: ["mengatasi", "serangan", "kumbang", "tanduk", "muda"],
    isVerified: true,
    isCritical: false
  },
  {
    id: "PND-003",
    category: "P&D",
    queryType: "synonym",
    question: "Apakah kaedah pembasmian penyakit kulat Ganoderma pada pangkal pokok?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 152,
    expectedSection: "Penyakit Ganoderma",
    expectedKeywords: ["kaedah", "pembasmian", "penyakit", "Ganoderma", "pangkal"],
    isVerified: true,
    isCritical: false
  },

  // --------------------------------------------------------------------------
  // KATEGORI 6: EFB / Mulching
  // --------------------------------------------------------------------------
  {
    id: "EFB-001",
    category: "EFB / Mulching",
    queryType: "exact",
    question: "Berapakah kadar aplikasi Tandan Kosong EFB per hektar yang disyorkan?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 98,
    expectedSection: "Aplikasi EFB",
    expectedKeywords: ["kadar", "aplikasi", "Tandan", "Kosong", "EFB", "hektar"],
    isVerified: true,
    isCritical: false
  },
  {
    id: "EFB-002",
    category: "EFB / Mulching",
    queryType: "natural_bm",
    question: "Di manakah tandan kosong sawit patut disusun di sekeliling pokok?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 98,
    expectedSection: "Aplikasi EFB",
    expectedKeywords: ["tandan", "kosong", "patut", "disusun", "sekeliling", "pokok"],
    isVerified: true,
    isCritical: false
  },

  // --------------------------------------------------------------------------
  // KATEGORI 7: Manual Sawit / Agronomi
  // --------------------------------------------------------------------------
  {
    id: "AGRO-001",
    category: "Manual Sawit / Agronomi",
    queryType: "exact",
    question: "Apakah kepadatan saliran dan perparitan bagi kawasan tanah gambut?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 35,
    expectedSection: "Pengurusan Tanah Gambut",
    expectedKeywords: ["kepadatan", "saliran", "perparitan", "tanah", "gambut"],
    isVerified: true,
    isCritical: false
  },
  {
    id: "AGRO-002",
    category: "Manual Sawit / Agronomi",
    queryType: "mixed_en_bm",
    question: "What is the optimum planting density per hectare for oil palm in FPMSB estates?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 42,
    expectedSection: "Kepadatan Penanaman",
    expectedKeywords: ["planting", "density", "hectare", "oil", "palm"],
    isVerified: true,
    isCritical: false
  },
  {
    id: "AGRO-003",
    category: "Manual Sawit / Agronomi",
    queryType: "operational",
    question: "Apakah teknik susunan pelepah yang betul semasa kerja pemangkasan di kawasan bukit?",
    expectedDocument: "Manual_Sawit_Edisi_3.pdf",
    expectedPage: 78,
    expectedSection: "Pemangkasan Pelepah",
    expectedKeywords: ["teknik", "susunan", "pelepah", "pemangkasan", "bukit"],
    isVerified: true,
    isCritical: false
  },

  // --------------------------------------------------------------------------
  // KATEGORI 8: SOP / MSPO (Critical)
  // --------------------------------------------------------------------------
  {
    id: "SOP-001",
    category: "SOP / MSPO",
    queryType: "exact",
    question: "Apakah garis panduan keselamatan PPE wajib semasa mengendalikan racun herbisid mengikut SOP?",
    expectedDocument: "SOP_Keselamatan_FPMSB.pdf",
    expectedPage: 18,
    expectedSection: "Penggunaan PPE",
    expectedKeywords: ["garis", "panduan", "keselamatan", "PPE", "racun", "SOP"],
    isVerified: true,
    isCritical: true
  },
  {
    id: "SOP-002",
    category: "SOP / MSPO",
    queryType: "natural_bm",
    question: "Pekerja semburan racun mesti pakai sarung tangan dan topeng jenis apa mengikut piawaian MSPO?",
    expectedDocument: "SOP_Keselamatan_FPMSB.pdf",
    expectedPage: 18,
    expectedSection: "Penggunaan PPE",
    expectedKeywords: ["pekerja", "semburan", "sarung", "tangan", "topeng", "MSPO"],
    isVerified: true,
    isCritical: true
  },
  {
    id: "SOP-003",
    category: "SOP / MSPO",
    queryType: "mixed_en_bm",
    question: "What are the MSPO compliance requirements for chemical waste disposal in oil palm estates?",
    expectedDocument: "SOP_Keselamatan_FPMSB.pdf",
    expectedPage: 24,
    expectedSection: "Pelupusan Sisa Kimia",
    expectedKeywords: ["MSPO", "compliance", "chemical", "waste", "disposal"],
    isVerified: true,
    isCritical: true
  },

  // --------------------------------------------------------------------------
  // CONTOH TEST CASE "UNVERIFIED" (Akan dikesan & tidak dikira dalam akurasi)
  // --------------------------------------------------------------------------
  {
    id: "UNV-001",
    category: "Manual Sawit / Agronomi",
    queryType: "exact",
    question: "Berapakah kuantiti air hujan tahunan ideal di ladang sawit mengikut data unverified?",
    expectedDocument: "Unverified_Doc.pdf",
    expectedPage: null,
    expectedSection: "Hujan",
    expectedKeywords: ["air", "hujan"],
    isVerified: false,
    isCritical: false
  },

  // --------------------------------------------------------------------------
  // PHASE 2.6: NEGATIVE / NO-EVIDENCE TEST CASES (At least 5 queries)
  // --------------------------------------------------------------------------
  {
    id: "NEG-001",
    category: "KUK Siri 8",
    queryType: "negative",
    question: "Apakah kadar upah pembedahan laser dan pemindahan organ untuk pokok kelapa sawit?",
    expectedDocument: "NONE",
    expectedPage: null,
    expectedSection: "NONE",
    expectedKeywords: ["laser", "pemindahan", "organ"],
    isVerified: true,
    isCritical: false,
    isNegative: true
  },
  {
    id: "NEG-002",
    category: "Penuaian",
    queryType: "negative",
    question: "Apakah prosedur memetik buah sawit menggunakan dron angkasa lepas pada ketinggian 100km?",
    expectedDocument: "NONE",
    expectedPage: null,
    expectedSection: "NONE",
    expectedKeywords: ["dron", "angkasa", "lepas"],
    isVerified: true,
    isCritical: false,
    isNegative: true
  },
  {
    id: "NEG-003",
    category: "Pembajaan",
    queryType: "negative",
    question: "Berapakah sukatan baja cecair uranium dan plutonium yang perlu diberikan kepada biji benih?",
    expectedDocument: "NONE",
    expectedPage: null,
    expectedSection: "NONE",
    expectedKeywords: ["uranium", "plutonium"],
    isVerified: true,
    isCritical: false,
    isNegative: true
  },
  {
    id: "NEG-004",
    category: "Manual Sawit / Agronomi",
    queryType: "negative",
    question: "Apakah kadar bayaran mata wang Bitcoin yang diterima oleh pengurus ladang FPMSB?",
    expectedDocument: "NONE",
    expectedPage: null,
    expectedSection: "NONE",
    expectedKeywords: ["Bitcoin", "crypto"],
    isVerified: true,
    isCritical: false,
    isNegative: true
  },
  {
    id: "NEG-005",
    category: "SOP / MSPO",
    queryType: "negative",
    question: "Apakah syarat kelayakan memandu kapal selam di terusan parit ladang kelapa sawit?",
    expectedDocument: "NONE",
    expectedPage: null,
    expectedSection: "NONE",
    expectedKeywords: ["kapal", "selam"],
    isVerified: true,
    isCritical: false,
    isNegative: true
  }
];
