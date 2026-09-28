import { 
  hierarchicalEstimatedTokenChunking, 
  applyMMRDiversityReranking, 
  calculateEvidenceCoverage, 
  calculateConfidenceEstimate, 
  validateCitationReferences, 
  generateEnterpriseGroundedAnswer,
  RagChunk 
} from '../src/server/services/ragEngine.service.js';

async function runRagHardeningTestSuite() {
  console.log('====================================================');
  console.log('IPDS FPMSB RAG HARDENING TEST SUITE (8 TEST CASES)');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 8;

  // SAMPLE DOKUMEN BUKU MANUAL / KUK
  const sampleKukChunk: RagChunk = {
    id: 'chunk-kuk-1',
    document_id: 'doc-kuk-1',
    file_name: 'KUK_Siri_8.pdf',
    category: 'KUK Siri 8',
    section_title: 'Koleksi Kadar Upah Kerja Ladang Sawit',
    page_number: 14,
    chunk_index: 0,
    content: 'KUK Siri 8 Seksyen 3.2: Kadar upah merumput di piringan sawit matang ialah RM 35.50 per hektar. Kadar semburan racun herbisid glufosinate-ammonium 13.5% ialah 2.5 liter per hektar.',
    vector_score: 0.85,
    keyword_score: 0.90,
    final_rrf_score: 0.032
  };

  const sampleManualChunk: RagChunk = {
    id: 'chunk-msl-1',
    document_id: 'doc-msl-1',
    file_name: 'Manual_Sawit_Lestari_Edisi_3.pdf',
    category: 'Manual Sawit',
    section_title: 'Kawalan Rumpai & Herbisid',
    page_number: 48,
    chunk_index: 1,
    content: 'Manual Sawit Lestari M/S 48: Kawalan Asystasia gangetica (Rumput Israel) menggunakan Metsulfuron-methyl 20% w/w pada kadar 2.2g per pam galas 16L air (bersamaan 2.5g per 18L air). Pembasahan daun menyeluruh adalah penting.',
    vector_score: 0.82,
    keyword_score: 0.88,
    final_rrf_score: 0.029
  };

  const sampleDuplicateChunk: RagChunk = {
    id: 'chunk-msl-2-dup',
    document_id: 'doc-msl-1',
    file_name: 'Manual_Sawit_Lestari_Edisi_3.pdf',
    category: 'Manual Sawit',
    section_title: 'Kawalan Rumpai & Herbisid',
    page_number: 48,
    chunk_index: 2,
    content: 'Manual Sawit Lestari M/S 48: Kawalan Asystasia gangetica (Rumput Israel) menggunakan Metsulfuron-methyl 20% w/w pada kadar 2.2g per pam galas 16L air.',
    vector_score: 0.81,
    keyword_score: 0.87,
    final_rrf_score: 0.028
  };

  // --------------------------------------------------
  // TEST 1: Soalan yang memang ada dalam dokumen
  // --------------------------------------------------
  console.log('[TEST 1] Soalan yang memang ada dalam dokumen...');
  const answerT1 = "Berdasarkan rujukan [Ruj 1], kadar upah merumput piringan ialah RM 35.50 per hektar.";
  const valT1 = validateCitationReferences(answerT1, [sampleKukChunk]);
  if (valT1.hasValidCitations && valT1.validCitationsCount === 1) {
    console.log('✅ PASSED: Retrieve evidence & valid citation identified.');
    passedTests++;
  } else {
    console.error('❌ FAILED: Citation validation failed for T1.');
  }

  // --------------------------------------------------
  // TEST 2: Soalan yang tiada dalam dokumen (Hard Gate / Unsupported check)
  // --------------------------------------------------
  console.log('\n[TEST 2] Soalan yang tiada dalam dokumen...');
  const noEvidenceCoverage = calculateEvidenceCoverage("Berapakah kadar cukai pendapatan korporat di Jepun?", []);
  if (noEvidenceCoverage === 0) {
    console.log('✅ PASSED: 0 evidence coverage correctly detected for out-of-domain query.');
    passedTests++;
  } else {
    console.error('❌ FAILED: Non-zero coverage for empty chunks.');
  }

  // --------------------------------------------------
  // TEST 3: Soalan KUK dengan angka/kadar
  // --------------------------------------------------
  console.log('\n[TEST 3] Soalan KUK dengan angka/kadar...');
  const kukValidation = validateCitationReferences("Kadar upah merumput piringan ialah RM 35.50 / ha [Ruj 1].", [sampleKukChunk]);
  if (kukValidation.hasValidCitations && kukValidation.extractedCitations[0].chunkIndex === 1) {
    console.log('✅ PASSED: Citation correctly points to chunk containing numeric rate.');
    passedTests++;
  } else {
    console.error('❌ FAILED: KUK numeric citation failed.');
  }

  // --------------------------------------------------
  // TEST 4: Evidence Coverage dengan istilah Bahasa Melayu
  // --------------------------------------------------
  console.log('\n[TEST 4] Evidence Coverage dengan istilah Bahasa Melayu...');
  const coverageBM = calculateEvidenceCoverage("kadar upah merumput piringan sawit matang", [sampleKukChunk]);
  if (coverageBM >= 80) {
    console.log(`✅ PASSED: BM Evidence Coverage is ${coverageBM}%.`);
    passedTests++;
  } else {
    console.error(`❌ FAILED: BM Evidence Coverage was too low: ${coverageBM}%.`);
  }

  // --------------------------------------------------
  // TEST 5: Evidence Coverage dengan istilah English
  // --------------------------------------------------
  console.log('\n[TEST 5] Evidence Coverage dengan istilah English...');
  const coverageEN = calculateEvidenceCoverage("glufosinate-ammonium herbicide spraying rate per hectare", [sampleKukChunk]);
  if (coverageEN >= 60) {
    console.log(`✅ PASSED: EN Evidence Coverage is ${coverageEN}%.`);
    passedTests++;
  } else {
    console.error(`❌ FAILED: EN Evidence Coverage was too low: ${coverageEN}%.`);
  }

  // --------------------------------------------------
  // TEST 6: Citation [Ruj 99] yang tidak wujud
  // --------------------------------------------------
  console.log('\n[TEST 6] Citation [Ruj 99] yang tidak wujud...');
  const invalidCitationVal = validateCitationReferences("Maklumat ini daripada [Ruj 99].", [sampleKukChunk]);
  if (!invalidCitationVal.hasValidCitations && invalidCitationVal.validCitationsCount === 0) {
    console.log('✅ PASSED: Invalid out-of-bound citation [Ruj 99] correctly rejected.');
    passedTests++;
  } else {
    console.error('❌ FAILED: Invalid citation was wrongly accepted.');
  }

  // --------------------------------------------------
  // TEST 7: Tiada retrieval result -> Hard Gate triggered (Gemini NOT called)
  // --------------------------------------------------
  console.log('\n[TEST 7] Hard Gate activation when 0 chunks available...');
  const hardGateResult = await generateEnterpriseGroundedAnswer("Soalan pelik tanpa data", "Semua");
  if (hardGateResult.grounding.hardGateTriggered === true && hardGateResult.answer.includes("tidak ditemui dalam pangkalan pengetahuan")) {
    console.log('✅ PASSED: No-Evidence Hard Gate triggered cleanly without calling Gemini.');
    passedTests++;
  } else {
    console.error('❌ FAILED: Hard gate did not trigger properly.');
  }

  // --------------------------------------------------
  // TEST 8: MMR -> Tidak memilih duplicate chunks secara berlebihan
  // --------------------------------------------------
  console.log('\n[TEST 8] MMR Lexical Diversity Reranking...');
  const candidates = [sampleManualChunk, sampleDuplicateChunk, sampleKukChunk];
  const mmrSelected = applyMMRDiversityReranking(candidates, 2, 0.75);
  // MMR should pick sampleManualChunk (highest RRF) and sampleKukChunk (diverse topic), skipping sampleDuplicateChunk
  if (mmrSelected.length === 2 && mmrSelected[1].id === 'chunk-kuk-1') {
    console.log('✅ PASSED: MMR suppressed duplicate chunk and selected diverse chunk.');
    passedTests++;
  } else {
    console.error('❌ FAILED: MMR did not suppress duplicate properly. Selected:', mmrSelected.map(c => c.id));
  }

  console.log('\n====================================================');
  console.log(`TEST SUITE RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('====================================================');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runRagHardeningTestSuite().catch(err => {
  console.error('Test Suite Error:', err);
  process.exit(1);
});
