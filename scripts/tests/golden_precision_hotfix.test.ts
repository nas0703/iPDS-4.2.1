process.env.NODE_ENV = 'test';

import { extractRelevantSubsection, compressContextChunks } from '../../src/server/services/contextCompressor.service.js';
import { detectOperationalIntent, retrieveGroundedCandidates, RagChunk } from '../../src/server/services/ragEngine.service.js';

async function runGoldenPrecisionHotfixBenchmark() {
  console.log('================================================================');
  console.log('IPDS RAG PRODUCTION HOTFIX — GOLDEN PRECISION BENCHMARK SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assertTest(condition: boolean, title: string, details?: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${title}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${title}`);
      if (details) console.error(`   Details: ${details}`);
    }
  }

  // 1. Test Operational Intent Detection
  console.log('--- TEST SET 1: Operational Intent & Action Detection ---');
  
  const intent1 = detectOperationalIntent('Kadar upah membaja sawit matang');
  assertTest(intent1.primaryAction === 'membaja' && intent1.domainCategory === 'PEMBAJAAN', 
    'Test 1.1: Detects "membaja" action and PEMBAJAAN domain category');

  const intent2 = detectOperationalIntent('Kadar upah meracun piringan dan lalang');
  assertTest(intent2.primaryAction === 'meracun' && intent2.domainCategory === 'KAWALAN_RUMPAI', 
    'Test 1.2: Detects "meracun" action and KAWALAN_RUMPAI domain category');

  const intent3 = detectOperationalIntent('Ukuran parit utama dan parit ladang');
  assertTest(intent3.primaryEntity === 'parit' && intent3.domainCategory === 'PERPARITAN', 
    'Test 1.3: Detects "parit" entity and PERPARITAN domain category');

  const intent4 = detectOperationalIntent('Spesifikasi teres kontur dan benteng hentian');
  assertTest(intent4.primaryAction === 'teres' && intent4.domainCategory === 'TERES_KONTUR', 
    'Test 1.4: Detects "teres" action and TERES_KONTUR domain category');

  const intent5 = detectOperationalIntent('Pengairan dan pembajaan anak benih tapak semaian');
  assertTest(intent5.domainCategory === 'TAPAK_SEMAIAN', 
    'Test 1.5: Detects TAPAK_SEMAIAN domain category for nursery query');

  // 2. Test Query-Focused Subsection Extraction
  console.log('\n--- TEST SET 2: Query-Focused Subsection Extraction ---');

  const multiSectionWageChunk = `Jadual Rasmi KUK SIRI 8 - Kadar Upah Pekerja Ladang:
19.0 Upah Pekerja Am Operasi: RM1500 sebulan untuk kerja am ladang dan pembersihan jalan.
20.0 Pemandu Traktor: RM1800 sebulan serta elaun perjalanan RM200.
21.0 Menuai BTS Sawit: RM22.00 – RM26.00 / Tan untuk pokok rendah.
22.0 Semburan Racun Herbisid: RM25.00 – RM35.00 / Hektar untuk piringan dan lorong.
23.0 Tabur Baja Berbutir (Urea, MOP, RP): RM25.00 – RM35.00 / Tan Baja (atau RM0.35–RM0.50 / Pokok).
24.0 Pemangkasan Pelepah (Pruning): RM0.80 – RM1.20 / Pokok muda.`;

  const extractedFertilizer = extractRelevantSubsection(multiSectionWageChunk, 'Kadar upah membaja');
  assertTest(
    extractedFertilizer.includes('23.0 Tabur Baja') && 
    !extractedFertilizer.includes('19.0 Upah Pekerja Am') &&
    !extractedFertilizer.includes('20.0 Pemandu Traktor'),
    'Test 2.1: "Kadar upah membaja" extracts ONLY fertilizing subsection, pruning unrelated jobs',
    extractedFertilizer
  );

  const extractedSpraying = extractRelevantSubsection(multiSectionWageChunk, 'Kadar upah meracun');
  assertTest(
    extractedSpraying.includes('22.0 Semburan Racun') && 
    !extractedSpraying.includes('19.0 Upah Pekerja Am') &&
    !extractedSpraying.includes('23.0 Tabur Baja'),
    'Test 2.2: "Kadar upah meracun" extracts ONLY spraying subsection',
    extractedSpraying
  );

  const extractedHarvesting = extractRelevantSubsection(multiSectionWageChunk, 'Upah menuai BTS');
  assertTest(
    extractedHarvesting.includes('21.0 Menuai BTS') && 
    !extractedHarvesting.includes('19.0 Upah Pekerja Am') &&
    !extractedHarvesting.includes('24.0 Pemangkasan Pelepah'),
    'Test 2.3: "Upah menuai BTS" extracts ONLY harvesting subsection',
    extractedHarvesting
  );

  // 3. Test Golden Queries End-to-End Retrieval & Context Assembly
  console.log('\n--- TEST SET 3: Golden Query Suite Retrieval & Compression ---');

  const goldenQueries = [
    { query: 'Kadar upah membaja', expectedKeyword: 'baja', forbiddenKeyword: 'pemandu' },
    { query: 'Kadar upah meracun', expectedKeyword: 'racun', forbiddenKeyword: 'menuai bts' },
    { query: 'Ukuran parit', expectedKeyword: 'parit', forbiddenKeyword: 'polibeg' },
    { query: 'Parit sempadan', expectedKeyword: 'sempadan', forbiddenKeyword: 'polibeg' },
    { query: 'Dos racun glyphosate', expectedKeyword: 'glyphosate', forbiddenKeyword: 'pembajaan' },
    { query: 'Pengairan nursery', expectedKeyword: 'pengairan', forbiddenKeyword: 'pruning' },
    { query: 'Pembajaan nursery', expectedKeyword: 'semai', forbiddenKeyword: 'parit' },
    { query: 'Upah menuai', expectedKeyword: 'menuai', forbiddenKeyword: 'meracun' },
    { query: 'Jarak tanaman', expectedKeyword: 'tanaman', forbiddenKeyword: 'pemandu' },
    { query: 'Spesifikasi teres', expectedKeyword: 'teres', forbiddenKeyword: 'polibeg' }
  ];

  for (let i = 0; i < goldenQueries.length; i++) {
    const gq = goldenQueries[i];
    const { candidates } = await retrieveGroundedCandidates(gq.query, 'Semua', null, null);
    const compressed = compressContextChunks(candidates.slice(0, 4), gq.query);
    const combinedEvidence = compressed.map(c => c.evidence.toLowerCase()).join(' ');

    const hasExpected = combinedEvidence.includes(gq.expectedKeyword.toLowerCase());
    assertTest(
      hasExpected, 
      `Test 3.${i + 1}: Golden Query "${gq.query}" retrieves evidence containing "${gq.expectedKeyword}"`,
      `Combined evidence snippet: ${combinedEvidence.slice(0, 150)}...`
    );
  }

  console.log('\n================================================================');
  console.log(`GOLDEN PRECISION HOTFIX RESULTS: ${passed}/${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('================================================================');

  if (passed === total) {
    console.log('🎯 ALL GOLDEN PRECISION HOTFIX BENCHMARKS PASSED 100%!');
  } else {
    process.exit(1);
  }
}

runGoldenPrecisionHotfixBenchmark().catch(err => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
