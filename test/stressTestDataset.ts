export interface StressTestCase {
  id: string;
  type: 'hard_negative' | 'ambiguous' | 'cross_document';
  category: string;
  question: string;
  expectedBehavior: string;
  expectedDocuments: string[]; // Document name(s) or ["NONE"] for hard_negative
  expectedPages: (number | null)[];
  expectedSections: string[];
  expectedStatus: 'NO_EVIDENCE' | 'AMBIGUOUS' | 'MULTI_SOURCE';
  expectedKeywords: string[];
  isVerified: boolean;
  isCritical: boolean;
}

export const STRESS_TEST_DATASET: StressTestCase[] = [
  // ==========================================================================
  // A. HARD-NEGATIVE TESTS — 10 CASES
  // In-domain oil palm terms, but asking for non-existent methods/machinery/years
  // ==========================================================================
  {
    id: "HN-001",
    type: "hard_negative",
    category: "KUK Siri 8",
    question: "Apakah kadar upah bagi kaedah menuai menggunakan mesin pemotong automatik robotik laser dalam KUK Siri 8?",
    expectedBehavior: "Sistem mengesan kaedah robotik laser tiada dalam KUK Siri 8 dan memulangkan NO_EVIDENCE.",
    expectedDocuments: ["NONE"],
    expectedPages: [null],
    expectedSections: ["NONE"],
    expectedStatus: "NO_EVIDENCE",
    expectedKeywords: ["robotik", "laser", "automatik"],
    isVerified: true,
    isCritical: true
  },
  {
    id: "HN-002",
    type: "hard_negative",
    category: "Merumput / Kawalan Rumpai",
    question: "Apakah kadar racun Paraquat yang dibenarkan untuk kawalan rumpai piringan dalam Manual Sawit?",
    expectedBehavior: "Sistem mengesan racun Paraquat diharamkan dan tiada dalam Manual Sawit Edisi 3 (hanya Glyphosate), lalu memulangkan NO_EVIDENCE.",
    expectedDocuments: ["NONE"],
    expectedPages: [null],
    expectedSections: ["NONE"],
    expectedStatus: "NO_EVIDENCE",
    expectedKeywords: ["Paraquat"],
    isVerified: true,
    isCritical: true
  },
  {
    id: "HN-003",
    type: "hard_negative",
    category: "KUK Siri 8",
    question: "Berapakah kadar unit bayaran bagi pemungutan BTS menggunakan jentolak kabin berhawa dingin dalam KUK Siri 8?",
    expectedBehavior: "Sistem mengesan tiada perincian jentolak berhawa dingin dalam KUK Siri 8, lalu memulangkan NO_EVIDENCE.",
    expectedDocuments: ["NONE"],
    expectedPages: [null],
    expectedSections: ["NONE"],
    expectedStatus: "NO_EVIDENCE",
    expectedKeywords: ["jentolak", "kabin", "hawa", "dingin"],
    isVerified: true,
    isCritical: true
  },
  {
    id: "HN-004",
    type: "hard_negative",
    category: "KUK Siri 8",
    question: "Apakah kadar upah pekerja bagi aktiviti menyusun pelepah pada tahun 2012 mengikut KUK Siri 8?",
    expectedBehavior: "Sistem mengesan KUK Siri 8 untuk kadar 2026 dan tiada rekod sejarah 2012, lalu memulangkan NO_EVIDENCE.",
    expectedDocuments: ["NONE"],
    expectedPages: [null],
    expectedSections: ["NONE"],
    expectedStatus: "NO_EVIDENCE",
    expectedKeywords: ["2012", "sejarah"],
    isVerified: true,
    isCritical: true
  },
  {
    id: "HN-005",
    type: "hard_negative",
    category: "Pembajaan",
    question: "Berapakah dos pembajaan baja NPK cecair melalui semburan helikopter untuk pokok matang dalam Manual Sawit?",
    expectedBehavior: "Sistem mengesan Manual Sawit hanya menyokong baja pepejal taburan, tiada semburan helikopter, lalu memulangkan NO_EVIDENCE.",
    expectedDocuments: ["NONE"],
    expectedPages: [null],
    expectedSections: ["NONE"],
    expectedStatus: "NO_EVIDENCE",
    expectedKeywords: ["helikopter", "cecair", "NPK"],
    isVerified: true,
    isCritical: true
  },
  {
    id: "HN-006",
    type: "hard_negative",
    category: "SOP / MSPO",
    question: "Apakah SOP keselamatan bagi pusingan penuaian sawit waktu malam (Night Harvesting) dalam SOP FPMSB?",
    expectedBehavior: "Sistem mengesan penuaian malam tidak dibenarkan atau didokumenkan dalam SOP, lalu memulangkan NO_EVIDENCE.",
    expectedDocuments: ["NONE"],
    expectedPages: [null],
    expectedSections: ["NONE"],
    expectedStatus: "NO_EVIDENCE",
    expectedKeywords: ["malam", "night", "harvesting"],
    isVerified: true,
    isCritical: true
  },
  {
    id: "HN-007",
    type: "hard_negative",
    category: "EFB / Mulching",
    question: "Berapakah kadar aplikasi kompos sisa plastik termampat per hektar di ladang FPMSB?",
    expectedBehavior: "Sistem mengesan hanya EFB (Tandan Kosong) didokumenkan, tiada kompos sisa plastik, lalu memulangkan NO_EVIDENCE.",
    expectedDocuments: ["NONE"],
    expectedPages: [null],
    expectedSections: ["NONE"],
    expectedStatus: "NO_EVIDENCE",
    expectedKeywords: ["plastik", "termampat"],
    isVerified: true,
    isCritical: false
  },
  {
    id: "HN-008",
    type: "hard_negative",
    category: "KUK Siri 8",
    question: "Apakah kadar upah memangkas pelepah menggunakan gergaji berantai petrol 50cc dalam KUK Siri 8?",
    expectedBehavior: "Sistem mengesan gergaji petrol 50cc tiada dalam KUK Siri 8 (hanya cantas/pahat/sabit), lalu memulangkan NO_EVIDENCE.",
    expectedDocuments: ["NONE"],
    expectedPages: [null],
    expectedSections: ["NONE"],
    expectedStatus: "NO_EVIDENCE",
    expectedKeywords: ["gergaji", "petrol", "50cc"],
    isVerified: true,
    isCritical: true
  },
  {
    id: "HN-009",
    type: "hard_negative",
    category: "P&D",
    question: "Apakah sukatan kawalan penyakit Ganoderma menggunakan suntikan antibiotik Penicillin pada pokok sawit?",
    expectedBehavior: "Sistem mengesan antibiotik Penicillin tiada dalam rawatan Ganoderma (hanya sanitasi/Hexaconazole), lalu memulangkan NO_EVIDENCE.",
    expectedDocuments: ["NONE"],
    expectedPages: [null],
    expectedSections: ["NONE"],
    expectedStatus: "NO_EVIDENCE",
    expectedKeywords: ["Penicillin", "antibiotik"],
    isVerified: true,
    isCritical: false
  },
  {
    id: "HN-010",
    type: "hard_negative",
    category: "Penuaian",
    question: "Apakah pusingan penuaian BTS 3 hari sekali untuk kawasan tanah tinggi berbukit dalam Manual Sawit?",
    expectedBehavior: "Sistem mengesan pusingan 3 hari sekali tiada dalam Manual Sawit (yang disyorkan ialah 7-10 hari), lalu memulangkan NO_EVIDENCE.",
    expectedDocuments: ["NONE"],
    expectedPages: [null],
    expectedSections: ["NONE"],
    expectedStatus: "NO_EVIDENCE",
    expectedKeywords: ["3 hari sekali", "pusingan 3 hari"],
    isVerified: true,
    isCritical: true
  },

  // ==========================================================================
  // B. AMBIGUOUS QUERY TESTS — 5 CASES
  // Queries with multiple interpretations (manual vs semi-mech vs full-mech)
  // ==========================================================================
  {
    id: "AMB-001",
    type: "ambiguous",
    category: "Pembajaan",
    question: "Berapa kadar kerja membaja pokok sawit?",
    expectedBehavior: "Sistem mengesan keambiguan (manual vs mekanisasi vs EFB) dan menyediakan liputan pelbagai varian atau meminta pencerahan.",
    expectedDocuments: ["Manual_Sawit_Edisi_3.pdf", "KUK_Siri_8_2026.pdf"],
    expectedPages: [112, 47],
    expectedSections: ["Program Pembajaan", "Pembajaan"],
    expectedStatus: "AMBIGUOUS",
    expectedKeywords: ["kadar", "membaja", "pembajaan"],
    isVerified: true,
    isCritical: true
  },
  {
    id: "AMB-002",
    type: "ambiguous",
    category: "KUK Siri 8",
    question: "Apakah kadar upah kerja penuaian sawit?",
    expectedBehavior: "Sistem mengesan keambiguan (mengikut ketinggian pokok rendah/tinggi atau mengikut unit tan/pokok).",
    expectedDocuments: ["KUK_Siri_8_2026.pdf"],
    expectedPages: [47],
    expectedSections: ["Penuaian BTS"],
    expectedStatus: "AMBIGUOUS",
    expectedKeywords: ["kadar", "upah", "penuaian"],
    isVerified: true,
    isCritical: true
  },
  {
    id: "AMB-003",
    type: "ambiguous",
    category: "Merumput / Kawalan Rumpai",
    question: "Bagaimanakah kawalan rumpai dilakukan di ladang FPMSB?",
    expectedBehavior: "Sistem mengesan keambiguan antara kawalan piringan pokok, lorong tuaian, atau kawalan lalang.",
    expectedDocuments: ["Manual_Sawit_Edisi_3.pdf"],
    expectedPages: [64, 66],
    expectedSections: ["Kawalan Rumpai Piringan", "Kawalan Lalang"],
    expectedStatus: "AMBIGUOUS",
    expectedKeywords: ["kawalan", "rumpai", "piringan", "lalang"],
    isVerified: true,
    isCritical: true
  },
  {
    id: "AMB-004",
    type: "ambiguous",
    category: "Manual Sawit / Agronomi",
    question: "Apakah pusingan kerja penyelenggaraan ladang?",
    expectedBehavior: "Sistem mengesan keambiguan antara pusingan penuaian (7-10 hari), pusingan merumput (3 bulan), atau pusingan membaja.",
    expectedDocuments: ["Manual_Sawit_Edisi_3.pdf"],
    expectedPages: [64, 82, 112],
    expectedSections: ["Pusingan Penuaian", "Kawalan Rumpai Piringan", "Program Pembajaan"],
    expectedStatus: "AMBIGUOUS",
    expectedKeywords: ["pusingan", "penyelenggaraan"],
    isVerified: true,
    isCritical: false
  },
  {
    id: "AMB-005",
    type: "ambiguous",
    category: "SOP / MSPO",
    question: "Apakah keperluan kelengkapan keselamatan pekerja ladang?",
    expectedBehavior: "Sistem mengesan keambiguan mengikut jenis tugas (semburan racun vs penuaian vs pembajaan).",
    expectedDocuments: ["SOP_Keselamatan_FPMSB.pdf"],
    expectedPages: [18],
    expectedSections: ["Penggunaan PPE"],
    expectedStatus: "AMBIGUOUS",
    expectedKeywords: ["kelengkapan", "keselamatan", "PPE"],
    isVerified: true,
    isCritical: true
  },

  // ==========================================================================
  // C. CROSS-DOCUMENT TESTS — 5 CASES
  // Queries requiring evidence from >1 document
  // ==========================================================================
  {
    id: "XDOC-001",
    type: "cross_document",
    category: "Penuaian & KUK",
    question: "Bagaimanakah kadar upah penuaian BTS dalam KUK berkaitan dengan pusingan penuaian dan standard brondol lerai dalam Manual Sawit?",
    expectedBehavior: "Sistem mengambil bukti daripada KUK_Siri_8_2026.pdf (Kadar Upah M/S 47) DAN Manual_Sawit_Edisi_3.pdf (Pusingan & Standard M/S 82, 85).",
    expectedDocuments: ["KUK_Siri_8_2026.pdf", "Manual_Sawit_Edisi_3.pdf"],
    expectedPages: [47, 82, 85],
    expectedSections: ["Penuaian BTS", "Pusingan Penuaian", "Standard Buah Masak"],
    expectedStatus: "MULTI_SOURCE",
    expectedKeywords: ["kadar", "upah", "pusingan", "brondol"],
    isVerified: true,
    isCritical: true
  },
  {
    id: "XDOC-002",
    type: "cross_document",
    category: "Kawalan Rumpai & SOP",
    question: "Apakah dos racun Glyphosate dalam Manual Sawit dan garis panduan PPE wajib mengikut SOP Keselamatan FPMSB?",
    expectedBehavior: "Sistem mengambil bukti daripada Manual_Sawit_Edisi_3.pdf (Dos Glyphosate M/S 64) DAN SOP_Keselamatan_FPMSB.pdf (PPE M/S 18).",
    expectedDocuments: ["Manual_Sawit_Edisi_3.pdf", "SOP_Keselamatan_FPMSB.pdf"],
    expectedPages: [64, 18],
    expectedSections: ["Kawalan Rumpai Piringan", "Penggunaan PPE"],
    expectedStatus: "MULTI_SOURCE",
    expectedKeywords: ["Glyphosate", "dos", "PPE", "keselamatan"],
    isVerified: true,
    isCritical: true
  },
  {
    id: "XDOC-003",
    type: "cross_document",
    category: "Pembajaan & SOP",
    question: "Apakah kadar pembajaan MOP mengikut Manual Sawit serta syarat pelupusan beg sisa kimia mengikut SOP MSPO?",
    expectedBehavior: "Sistem mengambil bukti daripada Manual_Sawit_Edisi_3.pdf (Dos MOP M/S 112) DAN SOP_Keselamatan_FPMSB.pdf (Pelupusan M/S 24).",
    expectedDocuments: ["Manual_Sawit_Edisi_3.pdf", "SOP_Keselamatan_FPMSB.pdf"],
    expectedPages: [112, 24],
    expectedSections: ["Program Pembajaan", "Pelupusan Sisa Kimia"],
    expectedStatus: "MULTI_SOURCE",
    expectedKeywords: ["MOP", "pembajaan", "pelupusan", "sisa"],
    isVerified: true,
    isCritical: true
  },
  {
    id: "XDOC-004",
    type: "cross_document",
    category: "KUK & SOP",
    question: "Bagaimanakah kadar upah penyemburan racun dalam KUK Siri 8 berbanding dengan keperluan PPE pekerja semburan dalam SOP FPMSB?",
    expectedBehavior: "Sistem mengambil bukti daripada KUK_Siri_8_2026.pdf (M/S 47) DAN SOP_Keselamatan_FPMSB.pdf (M/S 18).",
    expectedDocuments: ["KUK_Siri_8_2026.pdf", "SOP_Keselamatan_FPMSB.pdf"],
    expectedPages: [47, 18],
    expectedSections: ["Penuaian BTS", "Penggunaan PPE"],
    expectedStatus: "MULTI_SOURCE",
    expectedKeywords: ["upah", "semburan", "PPE", "pekerja"],
    isVerified: true,
    isCritical: true
  },
  {
    id: "XDOC-005",
    type: "cross_document",
    category: "EFB & KUK",
    question: "Apakah piawaian aplikasi EFB mulching dalam Manual Sawit serta kadar upah penyusunan EFB mengikut KUK Siri 8?",
    expectedBehavior: "Sistem mengambil bukti daripada Manual_Sawit_Edisi_3.pdf (Aplikasi EFB M/S 98) DAN KUK_Siri_8_2026.pdf (M/S 47).",
    expectedDocuments: ["Manual_Sawit_Edisi_3.pdf", "KUK_Siri_8_2026.pdf"],
    expectedPages: [98, 47],
    expectedSections: ["Aplikasi EFB", "Penuaian BTS"],
    expectedStatus: "MULTI_SOURCE",
    expectedKeywords: ["EFB", "mulching", "upah", "penyusunan"],
    isVerified: true,
    isCritical: false
  }
];
