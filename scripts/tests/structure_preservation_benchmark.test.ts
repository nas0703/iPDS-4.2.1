process.env.NODE_ENV = 'test';

import { extractRelevantSubsection, compressContextChunks } from '../../src/server/services/contextCompressor.service.js';
import { retrieveGroundedCandidates, detectOperationalIntent } from '../../src/server/services/ragEngine.service.js';

async function runStructurePreservationTests() {
  console.log('================================================================');
  console.log('RAG STRUCTURE-AWARE EVIDENCE PRESERVATION BENCHMARK');
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

  // Test 1: Kadar upah membaja
  console.log('--- Query 1: "Kadar upah membaja" ---');
  const resMembaja = await retrieveGroundedCandidates('Kadar upah membaja', 'Semua', null, null);
  const compMembaja = compressContextChunks(resMembaja.candidates.slice(0, 4), 'Kadar upah membaja');
  const textMembaja = compMembaja.map(c => c.evidence).join('\n\n');

  assertTest(
    textMembaja.includes('Baja Berbutir') && textMembaja.includes('Borate') && textMembaja.includes('EFB Mulching'),
    '1.1 Preserves all complete fertilization wage categories (Urea/MOP/RP/NPK, Borate, EFB)',
    textMembaja
  );
  assertTest(
    !textMembaja.toLowerCase().includes('pemandu traktor') && !textMembaja.toLowerCase().includes('pekerja am operasi'),
    '1.2 Strictly excludes unrelated wage categories (pemandu traktor, pekerja am)',
    textMembaja
  );

  // Test 2: Kadar upah meracun
  console.log('\n--- Query 2: "Kadar upah meracun" ---');
  const resMeracun = await retrieveGroundedCandidates('Kadar upah meracun', 'Semua', null, null);
  const compMeracun = compressContextChunks(resMeracun.candidates.slice(0, 4), 'Kadar upah meracun');
  const textMeracun = compMeracun.map(c => c.evidence).join('\n\n');

  assertTest(
    textMeracun.includes('Semburan Piringan/Lorong Menuai') && 
    textMeracun.includes('Woody Growth') && 
    textMeracun.includes('Circle Weeding') && 
    textMeracun.includes('Trunk Injection'),
    '2.1 Preserves all complete spraying wage categories (Piringan, Woody growth, Circle weeding, Trunk injection)',
    textMeracun
  );
  assertTest(
    !textMembaja.toLowerCase().includes('menuai bts sawit') && !textMeracun.toLowerCase().includes('menuai bts'),
    '2.2 Strictly excludes unrelated harvesting rates',
    textMeracun
  );

  // Test 3: Kadar upah menuai
  console.log('\n--- Query 3: "Kadar upah menuai" ---');
  const resMenuai = await retrieveGroundedCandidates('Kadar upah menuai', 'Semua', null, null);
  const compMenuai = compressContextChunks(resMenuai.candidates.slice(0, 4), 'Kadar upah menuai');
  const textMenuai = compMenuai.map(c => c.evidence).join('\n\n');

  assertTest(
    textMenuai.includes('Pokok Rendah') && 
    textMenuai.includes('Pokok Sederhana') && 
    textMenuai.includes('Pokok Tinggi') && 
    textMenuai.includes('Elaun KUK SIRI 8'),
    '3.1 Preserves all complete harvesting height tiers (<3m, 3-6m, 6-12m) and KUK Siri 8 allowances',
    textMenuai
  );
  assertTest(
    !textMenuai.toLowerCase().includes('semburan racun herbisid'),
    '3.2 Strictly excludes unrelated spraying rates',
    textMenuai
  );

  // Test 4: Markdown Table Preservation
  console.log('\n--- Test 4: Markdown Table Preservation ---');
  const sampleTableChunk = `| Kategori Kerja | Kadar Upah (RM) | Unit | Syarat / Catatan |
|---|---|---|---|
| Tabur Baja NPK/MOP | 25.00 - 35.00 | Tan | Taburan rata di lorong pelepah |
| Tabur Baja Borate | 0.15 - 0.25 | Pokok | Pokok pra-matang dan matang |
| Semburan Racun Herbisid | 25.00 - 35.00 | Hektar | Piringan dan lorong menuai |
| Pemandu Traktor | 1800.00 | Sebulan | Lesen GDL sah |

Nota: Tertakluk kepada kelulusan Pengurus Rancangan.`;

  const extractedTable = extractRelevantSubsection(sampleTableChunk, 'Kadar upah tabur baja');
  assertTest(
    extractedTable.includes('| Kategori Kerja |') && 
    extractedTable.includes('| Tabur Baja NPK/MOP |') && 
    extractedTable.includes('| Tabur Baja Borate |') && 
    !extractedTable.includes('| Pemandu Traktor |'),
    '4.1 Markdown table headers and columns are preserved while filtering unrelated rows',
    extractedTable
  );

  console.log('\n================================================================');
  console.log(`STRUCTURE PRESERVATION RESULTS: ${passed}/${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('================================================================');
}

runStructurePreservationTests().catch(console.error);
