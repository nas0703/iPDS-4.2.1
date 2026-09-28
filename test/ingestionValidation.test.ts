process.env.NODE_ENV = 'test';

import { 
  generateHierarchicalIngestionChunks, 
  executeHardenedDocumentIngestion,
  PageExtractionInput 
} from '../src/server/services/pdfIngestion.service.js';

async function runIngestionValidationTests() {
  console.log("=========================================================");
  console.log("IPDS FPMSB TUNGGAL — RAG INGESTION VALIDATION SUITE TEST");
  console.log("=========================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (detail) console.error(`   Details: ${detail}`);
    }
  }

  // --------------------------------------------------------------------------
  // TEST 1: Hierarchical Chunking & Page Traceability Metadata
  // --------------------------------------------------------------------------
  const mockPages: PageExtractionInput[] = [
    {
      pageNum: 1,
      text: "BAB 1: PENGURUSAN PELEPAH SAWIT\n\nPelepah kelapa sawit perlu dipotong mengikut piawaian MSPO dan FPMSB. Semua pelepah tua yang kekuningan hendaklah disusun rapi di piringan atau pokok.",
      isOcr: false,
      status: 'EXTRACTED'
    },
    {
      pageNum: 2,
      text: "JADUAL KADAR UPAH PRUNING 2026\n| Jenis Pekerjaan | Kadar (RM/pokok) | Catatan |\n| Pruning Ringan | RM 1.20 | Pokok umur < 8 tahun |\n| Pruning Berat | RM 1.80 | Pokok umur > 8 tahun |",
      isOcr: true,
      status: 'OCR_SUCCESS'
    }
  ];

  const mockDocId = "11111111-2222-3333-4444-555555555555";
  const mockFileName = "Manual_Pruning_2026.pdf";
  const mockCategory = "Manual Pruning";

  const chunks = generateHierarchicalIngestionChunks(
    mockPages,
    mockFileName,
    mockCategory,
    mockDocId
  );

  assert(chunks.length >= 2, "Test 1.1: Hierarchical Chunking generated expected chunks", `Generated ${chunks.length} chunks`);
  
  const chunk1 = chunks[0];
  assert(chunk1.metadata.document_id === mockDocId, "Test 1.2: Chunk 1 retains document_id traceability");
  assert(chunk1.metadata.file_name === mockFileName, "Test 1.3: Chunk 1 retains file_name metadata");
  assert(chunk1.metadata.page_number === 1, "Test 1.4: Chunk 1 retains accurate page_number (M/S 1)");
  assert(chunk1.metadata.extraction_method === 'digital', "Test 1.5: Chunk 1 retains extraction_method ('digital')");

  const chunk2 = chunks.find(c => c.pageNumber === 2);
  assert(chunk2 !== undefined && chunk2.contentType === 'table', "Test 1.6: Table auto-detection flags contentType 'table'");
  assert(chunk2 !== undefined && chunk2.metadata.extraction_method === 'ocr', "Test 1.7: Chunk 2 retains extraction_method ('ocr')");

  // --------------------------------------------------------------------------
  // TEST 2: Hardened Ingestion Pipeline & Missing Page Detection
  // --------------------------------------------------------------------------
  const testPagesWithMissing: PageExtractionInput[] = [
    { pageNum: 1, text: "Kandungan Halaman 1 ...", isOcr: false, status: 'EXTRACTED' },
    { pageNum: 2, text: "Kandungan Halaman 2 ...", isOcr: false, status: 'EXTRACTED' },
    { pageNum: 4, text: "Kandungan Halaman 4 ...", isOcr: false, status: 'EXTRACTED' } // Page 3 missing!
  ];

  const auditSummary = await executeHardenedDocumentIngestion({
    documentId: mockDocId,
    fileName: "Dokumen_Ujian_Terputus.pdf",
    category: "Manual Sawit",
    expectedTotalPages: 4, // Expected 1,2,3,4
    pages: testPagesWithMissing
  });

  assert(auditSummary.pages.missingPages.includes(3), "Test 2.1: Ingestion Pipeline flags missing page 3", `Missing pages: ${auditSummary.pages.missingPages.join(', ')}`);
  assert(auditSummary.overallStatus.startsWith('WARNING') || auditSummary.overallStatus.startsWith('FAIL'), "Test 2.2: Incomplete ingestion flags non-PASS status", `Status: ${auditSummary.overallStatus}`);
  assert(auditSummary.embeddings.dimension === 768, "Test 2.3: Embedding dimension validated as 768-dim");

  // --------------------------------------------------------------------------
  // TEST 3: Complete Ingestion Pipeline Audit Formatting
  // --------------------------------------------------------------------------
  const completePages: PageExtractionInput[] = [
    { pageNum: 1, text: "SOP Pembasmian Rumpai Lalang di kawasan piringan. Sukatan 150ml racun per 18 liter air.", isOcr: false, status: 'EXTRACTED' },
    { pageNum: 2, text: "Jadual Semburan Berkala: Semburan Pusingan 1 setiap 3 bulan sekali.", isOcr: false, status: 'EXTRACTED' }
  ];

  const passAudit = await executeHardenedDocumentIngestion({
    documentId: crypto.randomUUID(),
    fileName: "SOP_Rumpai_Complete.pdf",
    category: "Kawalan Rumpai",
    expectedTotalPages: 2,
    pages: completePages
  });

  assert(passAudit.overallStatus === 'PASS — INGESTION COMPLETE', "Test 3.1: 100% complete ingestion returns PASS status", `Status: ${passAudit.overallStatus}`);
  assert(passAudit.traceability.isFullyTraceable === true, "Test 3.2: 100% complete ingestion verifies isFullyTraceable");
  assert(passAudit.chunks.generated === passAudit.chunks.stored, "Test 3.3: All generated chunks stored successfully");

  console.log("\n=========================================================");
  console.log(`RESULTS: ${passedTests}/${totalTests} Tests Passed`);
  console.log("=========================================================");

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runIngestionValidationTests();
