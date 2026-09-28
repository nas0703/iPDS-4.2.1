import assert from 'assert';
import { 
  detectOperationalIntent, 
  isBroadCategoryQuery, 
  retrieveGroundedCandidates, 
  filterCandidatesByTopicAndIntent 
} from '../../src/server/services/ragEngine.service.js';
import { 
  compressContextChunks, 
  formatGroupedContextForPrompt 
} from '../../src/server/services/contextCompressor.service.js';

async function runCompletenessBenchmark() {
  console.log('================================================================');
  console.log('RAG ANSWER COMPLETENESS & BROAD RETRIEVAL BENCHMARK');
  console.log('================================================================');

  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => void) {
    total++;
    try {
      fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ [FAIL] ${name}: ${err.message}`);
    }
  }

  // --- 1. Broad Category Detection ---
  console.log('\n--- 1. Broad Category Query Detection ---');
  test('Detects "kadar upah menuai" as broad category query', () => {
    const intent = detectOperationalIntent('kadar upah menuai');
    assert.strictEqual(isBroadCategoryQuery('kadar upah menuai', intent), true);
  });

  test('Detects "kadar upah merumput" as broad category query', () => {
    const intent = detectOperationalIntent('kadar upah merumput');
    assert.strictEqual(isBroadCategoryQuery('kadar upah merumput', intent), true);
  });

  test('Detects "kadar upah membaja" as broad category query', () => {
    const intent = detectOperationalIntent('kadar upah membaja');
    assert.strictEqual(isBroadCategoryQuery('kadar upah membaja', intent), true);
  });

  test('Detects "kadar upah pruning" as broad category query', () => {
    const intent = detectOperationalIntent('kadar upah pruning');
    assert.strictEqual(isBroadCategoryQuery('kadar upah pruning', intent), true);
  });

  test('Detects narrow specific query "berapa dos glyphosate" as NOT broad', () => {
    const intent = detectOperationalIntent('berapa dos glyphosate');
    assert.strictEqual(isBroadCategoryQuery('berapa dos glyphosate', intent), false);
  });

  // --- 2. Broad Retrieval & Expansion ---
  console.log('\n--- 2. Broad Category Retrieval & Expansion ---');
  const dummyEmbed = new Array(768).fill(0.01);
  
  const menuaiResult = await retrieveGroundedCandidates('kadar upah menuai', 'Semua', dummyEmbed, null);
  test('Query "kadar upah menuai" retrieves harvesting height tiers AND loose fruit rates', () => {
    const combinedContent = menuaiResult.candidates.map(c => c.content).join(' ');
    assert.ok(combinedContent.includes('Pahat') || combinedContent.includes('Rendah') || combinedContent.includes('22.00'), 'Must include harvesting tier rates');
    assert.ok(combinedContent.includes('Biji Relai') || combinedContent.includes('Loose Fruits') || combinedContent.includes('0.18') || combinedContent.includes('guni'), 'Must include loose fruit collection rates');
  });

  const merumputResult = await retrieveGroundedCandidates('kadar upah merumput', 'Semua', dummyEmbed, null);
  test('Query "kadar upah merumput" retrieves multiple spraying categories (piringan, woody growth, circle weeding, trunk injection)', () => {
    const combinedContent = merumputResult.candidates.map(c => c.content).join(' ');
    assert.ok(combinedContent.includes('Piringan') || combinedContent.includes('Herbisid'), 'Must include piringan/lorong spraying');
    assert.ok(combinedContent.includes('Woody Growth') || combinedContent.includes('Rumpai Liar'), 'Must include woody growth');
    assert.ok(combinedContent.includes('Circle Weeding') || combinedContent.includes('Pokok Muda'), 'Must include circle weeding');
    assert.ok(combinedContent.includes('Trunk Injection'), 'Must include trunk injection');
  });

  const membajaResult = await retrieveGroundedCandidates('kadar upah membaja', 'Semua', dummyEmbed, null);
  test('Query "kadar upah membaja" retrieves granular, micronutrient Borate, and EFB mulching rates', () => {
    const combinedContent = membajaResult.candidates.map(c => c.content).join(' ');
    assert.ok(combinedContent.includes('Baja Berbutir') || combinedContent.includes('Urea') || combinedContent.includes('25.00'), 'Must include granular fertilizer');
    assert.ok(combinedContent.includes('Borate') || combinedContent.includes('0.15'), 'Must include Borate');
    assert.ok(combinedContent.includes('EFB') || combinedContent.includes('Tandan Kosong'), 'Must include EFB mulching');
  });

  // --- 3. Hierarchical Context Grouping ---
  console.log('\n--- 3. Context Grouping & Structure Preservation ---');
  test('Hierarchical context grouping organizes chunks with source headers', () => {
    const compressed = compressContextChunks(menuaiResult.candidates, 'kadar upah menuai');
    const formatted = formatGroupedContextForPrompt(compressed);
    assert.ok(formatted.includes('### '), 'Must format with document or section headings');
    assert.ok(formatted.includes('KUK SIRI 8') || formatted.includes('Menuai'), 'Must include relevant section or document title');
  });

  console.log('================================================================');
  console.log(`COMPLETENESS BENCHMARK RESULTS: ${passed}/${total} TESTS PASSED (${Math.round((passed/total)*100)}%)`);
  console.log('================================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runCompletenessBenchmark().catch(err => {
  console.error('Fatal benchmark failure:', err);
  process.exit(1);
});
