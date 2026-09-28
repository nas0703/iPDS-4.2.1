export interface GenerationTestCase {
  id: string;
  category: string;
  type: 
    | 'exact_factual'
    | 'numerical'
    | 'table'
    | 'multi_document'
    | 'ambiguous'
    | 'unsupported'
    | 'safety_critical'
    | 'synonym'
    | 'bahasa_melayu'
    | 'mixed_language';
  query: string;
  expectedEvidenceDocuments: string[];
  expectedCitations: string[];
  expectedAnswerClaims: string[];
  isCritical: boolean;
  expectedGroundingStatus: 'GROUNDED' | 'NO_EVIDENCE' | 'AMBIGUOUS' | 'GROUNDING_FAILED';
}

export const GENERATION_EVALUATION_DATASET: GenerationTestCase[] = [
  // ==========================================================================
  // A. EXACT FACTUAL QUESTIONS (4 cases)
  // ==========================================================================
  {
    id: "GEN-001",
    category: "Manual Sawit / Agronomi",
    type: "exact_factual",
    query: "Apakah objektif utama kawalan rumpai piringan di ladang sawit?",
    expectedEvidenceDocuments: ["Manual_Sawit_Edisi_3.pdf"],
    expectedCitations: ["[Ruj 1]"],
    expectedAnswerClaims: ["Mengelakkan persaingan nutrien", "Memudahkan pemungutan brondol"],
    isCritical: false,
    expectedGroundingStatus: "GROUNDED"
  },
  {
    id: "GEN-002",
    category: "KUK Siri 8",
    type: "exact_factual",
    query: "Apakah skop kerja standard bagi penuaian BTS mengikut KUK Siri 8?",
    expectedEvidenceDocuments: ["KUK_Siri_8_2026.pdf"],
    expectedCitations: ["[Ruj 1]"],
    expectedAnswerClaims: ["Mencantas pelepah", "Memotong tandan masak", "Mengutip brondol"],
    isCritical: true,
    expectedGroundingStatus: "GROUNDED"
  },
  {
    id: "GEN-003",
    category: "SOP / MSPO",
    type: "exact_factual",
    query: "Apakah takrifan kawasan riparian mengikut SOP Kelestarian MSPO FPMSB?",
    expectedEvidenceDocuments: ["SOP_Keselamatan_FPMSB.pdf"],
    expectedCitations: ["[Ruj 1]"],
    expectedAnswerClaims: ["Zon penampan tebing sungai", "Dilarang semburan kimia"],
    isCritical: true,
    expectedGroundingStatus: "GROUNDED"
  },
  {
    id: "GEN-004",
    category: "EFB / Mulching",
    type: "exact_factual",
    query: "Apakah kebaikan utama aplikasi EFB (Tandan Kosong) kepada tanah ladang?",
    expectedEvidenceDocuments: ["Manual_Sawit_Edisi_3.pdf"],
    expectedCitations: ["[Ruj 1]"],
    expectedAnswerClaims: ["Meningkatkan kelembapan tanah", "Memperbaiki struktur tanah dan bahan organik"],
    isCritical: false,
    expectedGroundingStatus: "GROUNDED"
  },

  // ==========================================================================
  // B. NUMERICAL QUESTIONS (4 cases)
  // ==========================================================================
  {
    id: "GEN-005",
    category: "KUK Siri 8",
    type: "numerical",
    query: "Berapakah kadar unit bayaran penuaian BTS untuk pokok berketinggian kurang 3 meter?",
    expectedEvidenceDocuments: ["KUK_Siri_8_2026.pdf"],
    expectedCitations: ["[Ruj 1]"],
    expectedAnswerClaims: ["Kadar unit bayaran ialah RM 18.50 per tan"],
    isCritical: true,
    expectedGroundingStatus: "GROUNDED"
  },
  {
    id: "GEN-006",
    category: "Merumput / Kawalan Rumpai",
    type: "numerical",
    query: "Berapakah kadar dos racun Glyphosate per hektar untuk kawalan rumpai piringan?",
    expectedEvidenceDocuments: ["Manual_Sawit_Edisi_3.pdf"],
    expectedCitations: ["[Ruj 1]"],
    expectedAnswerClaims: ["Kadar dos disyorkan ialah 1.5 liter Glyphosate per hektar"],
    isCritical: true,
    expectedGroundingStatus: "GROUNDED"
  },
  {
    id: "GEN-007",
    category: "Pembajaan",
    type: "numerical",
    query: "Berapakah kadar dos baja MOP per pokok untuk pokok sawit umur 6 tahun?",
    expectedEvidenceDocuments: ["Manual_Sawit_Edisi_3.pdf"],
    expectedCitations: ["[Ruj 1]"],
    expectedAnswerClaims: ["Dos MOP ialah 2.5 kg per pokok per tahun"],
    isCritical: true,
    expectedGroundingStatus: "GROUNDED"
  },
  {
    id: "GEN-008",
    category: "Penuaian",
    type: "numerical",
    query: "Berapakah tempoh pusingan penuaian BTS yang disyorkan dalam Manual Sawit?",
    expectedEvidenceDocuments: ["Manual_Sawit_Edisi_3.pdf"],
    expectedCitations: ["[Ruj 1]"],
    expectedAnswerClaims: ["Pusingan penuaian disyorkan ialah 7 hingga 10 hari"],
    isCritical: true,
    expectedGroundingStatus: "GROUNDED"
  },

  // ==========================================================================
  // C. TABLE QUESTIONS (3 cases)
  // ==========================================================================
  {
    id: "GEN-009",
    category: "KUK Siri 8",
    type: "table",
    query: "Berikan jadual kadar upah penuaian mengikut kelas ketinggian pokok dalam KUK Siri 8.",
    expectedEvidenceDocuments: ["KUK_Siri_8_2026.pdf"],
    expectedCitations: ["[Ruj 1]"],
    expectedAnswerClaims: ["Pokok < 3m: RM18.50/tan", "Pokok 3-6m: RM21.00/tan", "Pokok > 6m: RM24.50/tan"],
    isCritical: true,
    expectedGroundingStatus: "GROUNDED"
  },
  {
    id: "GEN-010",
    category: "Pembajaan",
    type: "table",
    query: "Nyatakan jadual dos baja MOP, Kieserite dan Rock Phosphate mengikut umur pokok.",
    expectedEvidenceDocuments: ["Manual_Sawit_Edisi_3.pdf"],
    expectedCitations: ["[Ruj 1]"],
    expectedAnswerClaims: ["Tahun 1-3: MOP 1.5kg", "Tahun 4-7: MOP 2.5kg", "Tahun >8: MOP 3.0kg"],
    isCritical: true,
    expectedGroundingStatus: "GROUNDED"
  },
  {
    id: "GEN-011",
    category: "Merumput / Kawalan Rumpai",
    type: "table",
    query: "Apakah senarai jenis racun dan sukatan bancuhan semburan bagi 18L pam galas?",
    expectedEvidenceDocuments: ["Manual_Sawit_Edisi_3.pdf"],
    expectedCitations: ["[Ruj 1]"],
    expectedAnswerClaims: ["Glyphosate: 75ml per 18L pam galas"],
    isCritical: true,
    expectedGroundingStatus: "GROUNDED"
  },

  // ==========================================================================
  // D. MULTI-DOCUMENT QUESTIONS (4 cases)
  // ==========================================================================
  {
    id: "GEN-012",
    category: "Penuaian & KUK",
    type: "multi_document",
    query: "Bagaimanakah kadar upah KUK Siri 8 diselaraskan dengan pusingan penuaian Manual Sawit?",
    expectedEvidenceDocuments: ["KUK_Siri_8_2026.pdf", "Manual_Sawit_Edisi_3.pdf"],
    expectedCitations: ["[Ruj 1]", "[Ruj 2]"],
    expectedAnswerClaims: ["KUK Siri 8 menetapkan kadar RM18.50/tan", "Manual Sawit menetapkan pusingan 7-10 hari"],
    isCritical: true,
    expectedGroundingStatus: "GROUNDED"
  },
  {
    id: "GEN-013",
    category: "Kawalan Rumpai & SOP",
    type: "multi_document",
    query: "Apakah dos Glyphosate dalam Manual Sawit serta keperluan PPE dalam SOP Keselamatan?",
    expectedEvidenceDocuments: ["Manual_Sawit_Edisi_3.pdf", "SOP_Keselamatan_FPMSB.pdf"],
    expectedCitations: ["[Ruj 1]", "[Ruj 2]"],
    expectedAnswerClaims: ["Dos Glyphosate ialah 1.5 L/ha", "PPE wajib termasuk goggle, sarung tangan nitril dan topeng muka"],
    isCritical: true,
    expectedGroundingStatus: "GROUNDED"
  },
  {
    id: "GEN-014",
    category: "Pembajaan & SOP",
    type: "multi_document",
    query: "Apakah dos baja MOP dalam Manual Sawit dan cara pelupusan beg baja mengikut SOP MSPO?",
    expectedEvidenceDocuments: ["Manual_Sawit_Edisi_3.pdf", "SOP_Keselamatan_FPMSB.pdf"],
    expectedCitations: ["[Ruj 1]", "[Ruj 2]"],
    expectedAnswerClaims: ["Dos MOP 2.5 kg/pokok", "Beg baja dikumpul dan diserahkan kepada kontraktor berlesen"],
    isCritical: true,
    expectedGroundingStatus: "GROUNDED"
  },
  {
    id: "GEN-015",
    category: "EFB & KUK",
    type: "multi_document",
    query: "Berapakah kadar aplikasi EFB dalam Manual Sawit dan kadar upah penyusunan EFB dalam KUK?",
    expectedEvidenceDocuments: ["Manual_Sawit_Edisi_3.pdf", "KUK_Siri_8_2026.pdf"],
    expectedCitations: ["[Ruj 1]", "[Ruj 2]"],
    expectedAnswerClaims: ["Aplikasi EFB ialah 30-40 tan/ha", "KUK menetapkan RM12.00/tan"],
    isCritical: false,
    expectedGroundingStatus: "GROUNDED"
  },

  // ==========================================================================
  // E. AMBIGUOUS QUESTIONS (3 cases)
  // ==========================================================================
  {
    id: "GEN-016",
    category: "Pembajaan",
    type: "ambiguous",
    query: "Berapa kadar kerja pembajaan pokok sawit?",
    expectedEvidenceDocuments: ["Manual_Sawit_Edisi_3.pdf", "KUK_Siri_8_2026.pdf"],
    expectedCitations: ["[Ruj 1]"],
    expectedAnswerClaims: ["Kadar bergantung kepada kaedah manual atau mekanisasi"],
    isCritical: true,
    expectedGroundingStatus: "AMBIGUOUS"
  },
  {
    id: "GEN-017",
    category: "KUK Siri 8",
    type: "ambiguous",
    query: "Berapakah kadar upah penuaian sawit?",
    expectedEvidenceDocuments: ["KUK_Siri_8_2026.pdf"],
    expectedCitations: ["[Ruj 1]"],
    expectedAnswerClaims: ["Kadar berbeza mengikut kelas ketinggian pokok"],
    isCritical: true,
    expectedGroundingStatus: "AMBIGUOUS"
  },
  {
    id: "GEN-018",
    category: "Merumput / Kawalan Rumpai",
    type: "ambiguous",
    query: "Bagaimanakah kawalan rumpai dijalankan di ladang?",
    expectedEvidenceDocuments: ["Manual_Sawit_Edisi_3.pdf"],
    expectedCitations: ["[Ruj 1]"],
    expectedAnswerClaims: ["Kawalan merangkumi piringan pokok, lorong tuaian, atau kawalan lalang"],
    isCritical: true,
    expectedGroundingStatus: "AMBIGUOUS"
  },

  // ==========================================================================
  // F. UNSUPPORTED / HARD-NEGATIVE QUESTIONS (4 cases)
  // ==========================================================================
  {
    id: "GEN-019",
    category: "KUK Siri 8",
    type: "unsupported",
    query: "Apakah kadar upah penuaian menggunakan mesin pemotong laser robotik?",
    expectedEvidenceDocuments: [],
    expectedCitations: [],
    expectedAnswerClaims: ["Maklumat tidak terdapat dalam dokumen rujukan"],
    isCritical: true,
    expectedGroundingStatus: "NO_EVIDENCE"
  },
  {
    id: "GEN-020",
    category: "Merumput / Kawalan Rumpai",
    type: "unsupported",
    query: "Berapakah dos penggunaan racun Paraquat yang diluluskan?",
    expectedEvidenceDocuments: [],
    expectedCitations: [],
    expectedAnswerClaims: ["Maklumat tidak terdapat dalam dokumen rujukan"],
    isCritical: true,
    expectedGroundingStatus: "NO_EVIDENCE"
  },
  {
    id: "GEN-021",
    category: "SOP / MSPO",
    type: "unsupported",
    query: "Apakah SOP penuaian sawit waktu malam (Night Harvesting)?",
    expectedEvidenceDocuments: [],
    expectedCitations: [],
    expectedAnswerClaims: ["Maklumat tidak terdapat dalam dokumen rujukan"],
    isCritical: true,
    expectedGroundingStatus: "NO_EVIDENCE"
  },
  {
    id: "GEN-022",
    category: "P&D",
    type: "unsupported",
    query: "Berapakah dos suntikan antibiotik Penicillin untuk pokok dirawat Ganoderma?",
    expectedEvidenceDocuments: [],
    expectedCitations: [],
    expectedAnswerClaims: ["Maklumat tidak terdapat dalam dokumen rujukan"],
    isCritical: true,
    expectedGroundingStatus: "NO_EVIDENCE"
  },

  // ==========================================================================
  // G. SAFETY-CRITICAL QUESTIONS (3 cases)
  // ==========================================================================
  {
    id: "GEN-023",
    category: "SOP / MSPO",
    type: "safety_critical",
    query: "Apakah syarat wajib PPE untuk pekerja bancuhan racun mengikut SOP Keselamatan?",
    expectedEvidenceDocuments: ["SOP_Keselamatan_FPMSB.pdf"],
    expectedCitations: ["[Ruj 1]"],
    expectedAnswerClaims: ["Wajib memakai apron getah, sarung tangan nitril, topeng respiratori dan goggle"],
    isCritical: true,
    expectedGroundingStatus: "GROUNDED"
  },
  {
    id: "GEN-024",
    category: "SOP / MSPO",
    type: "safety_critical",
    query: "Apakah prosedur pertolongan cemas jika racun terpercik ke mata pekerja?",
    expectedEvidenceDocuments: ["SOP_Keselamatan_FPMSB.pdf"],
    expectedCitations: ["[Ruj 1]"],
    expectedAnswerClaims: ["Bilas mata dengan air bersih mengalir selama sekurang-kurangnya 15 minit"],
    isCritical: true,
    expectedGroundingStatus: "GROUNDED"
  },
  {
    id: "GEN-025",
    category: "SOP / MSPO",
    type: "safety_critical",
    query: "Apakah jarak minima zon larangan semburan kimia dari tebing sungai?",
    expectedEvidenceDocuments: ["SOP_Keselamatan_FPMSB.pdf"],
    expectedCitations: ["[Ruj 1]"],
    expectedAnswerClaims: ["Zon larangan semburan ialah 5 meter dari tebing sungai"],
    isCritical: true,
    expectedGroundingStatus: "GROUNDED"
  },

  // ==========================================================================
  // H. SYNONYM QUESTIONS (2 cases)
  // ==========================================================================
  {
    id: "GEN-026",
    category: "Merumput / Kawalan Rumpai",
    type: "synonym",
    query: "Berapakah sukatan herbisid cecair untuk pembersihan piringan pokok?",
    expectedEvidenceDocuments: ["Manual_Sawit_Edisi_3.pdf"],
    expectedCitations: ["[Ruj 1]"],
    expectedAnswerClaims: ["Sukatan herbisid (racun Glyphosate) ialah 1.5 L/ha"],
    isCritical: false,
    expectedGroundingStatus: "GROUNDED"
  },
  {
    id: "GEN-027",
    category: "KUK Siri 8",
    type: "synonym",
    query: "Berapakah tarif imbalan gaji penuai buah kelapa sawit?",
    expectedEvidenceDocuments: ["KUK_Siri_8_2026.pdf"],
    expectedCitations: ["[Ruj 1]"],
    expectedAnswerClaims: ["Tarif imbalan (kadar upah) penuaian ialah RM18.50 per tan"],
    isCritical: true,
    expectedGroundingStatus: "GROUNDED"
  },

  // ==========================================================================
  // I. BAHASA MELAYU QUESTIONS (2 cases)
  // ==========================================================================
  {
    id: "GEN-028",
    category: "Manual Sawit / Agronomi",
    type: "bahasa_melayu",
    query: "Bagaimanakah kaedah merawat pokok yang diserang ulat bungkus di ladang sawit?",
    expectedEvidenceDocuments: ["Manual_Sawit_Edisi_3.pdf"],
    expectedCitations: ["[Ruj 1]"],
    expectedAnswerClaims: ["Semburan Bacillus thuringiensis atau suntikan batang Methamidophos"],
    isCritical: true,
    expectedGroundingStatus: "GROUNDED"
  },
  {
    id: "GEN-029",
    category: "SOP / MSPO",
    type: "bahasa_melayu",
    query: "Apakah langkah keselamatan semasa mengendalikan jentera traktor di ladang?",
    expectedEvidenceDocuments: ["SOP_Keselamatan_FPMSB.pdf"],
    expectedCitations: ["[Ruj 1]"],
    expectedAnswerClaims: ["Pemeriksaan harian brek dan pengagatan lesen memandu sah"],
    isCritical: true,
    expectedGroundingStatus: "GROUNDED"
  },

  // ==========================================================================
  // J. ENGLISH / MALAY MIXED QUESTIONS (1 case)
  // ==========================================================================
  {
    id: "GEN-030",
    category: "Pembajaan",
    type: "mixed_language",
    query: "What is the recommended application rate for MOP fertilizer bagi pokok sawit umur 5 tahun?",
    expectedEvidenceDocuments: ["Manual_Sawit_Edisi_3.pdf"],
    expectedCitations: ["[Ruj 1]"],
    expectedAnswerClaims: ["The application rate is 2.5 kg per tree per year"],
    isCritical: true,
    expectedGroundingStatus: "GROUNDED"
  }
];
