/**
 * iPDS 4.1 — AI Service Wrapper Unit & Integration Test Suite
 */

import { aiService, AI_CONFIG } from '../../../src/server/ai/index.js';

export async function runAiServiceWrapperTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 54: CENTRALIZED AI SERVICE WRAPPER VERIFICATION');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 54.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 54.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
    }
  }

  // 1. Verify Configuration Integrity
  assert(
    Array.isArray(AI_CONFIG.models.textCascade) && AI_CONFIG.models.textCascade.length >= 2,
    'AI_CONFIG textCascade models properly defined with fallback candidates'
  );
  assert(
    Array.isArray(AI_CONFIG.models.receiptOcr) && AI_CONFIG.models.receiptOcr.length >= 2,
    'AI_CONFIG receiptOcr models properly defined with candidate models'
  );
  assert(
    AI_CONFIG.models.embedding === 'gemini-embedding-2-preview' || typeof AI_CONFIG.models.embedding === 'string',
    'AI_CONFIG embedding model properly configured'
  );
  assert(
    AI_CONFIG.timeouts.textCascadeMs === 45000 && AI_CONFIG.timeouts.receiptOcrMs === 25000,
    'AI_CONFIG timeout parameters preserve original operational bounds'
  );

  // 2. Verify aiService Singleton & API Methods
  assert(
    typeof aiService.generateText === 'function',
    'aiService exposes generateText() method'
  );
  assert(
    typeof aiService.extractVision === 'function',
    'aiService exposes extractVision() method'
  );
  assert(
    typeof aiService.generateEmbedding === 'function',
    'aiService exposes generateEmbedding() method'
  );
  assert(
    typeof aiService.isConfigured === 'function',
    'aiService exposes isConfigured() check'
  );

  // 3. Test Test-Environment Embedding Generation (768 Dimensions)
  {
    const embedding = await aiService.generateEmbedding({
      text: 'Ujian kadar upah menuai sawit',
      outputDimensionality: 768
    });
    assert(
      Array.isArray(embedding) && embedding.length === 768,
      'generateEmbedding generates exact 768-dimensional mock vector in test environment'
    );
  }

  // 4. Test generateText with unconfigured/mock key
  {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    (aiService as any).client = null;

    const res = await aiService.generateText({
      prompt: 'Hello',
      operationName: 'test_text'
    });

    assert(
      res.text === null,
      'generateText gracefully returns null text when GEMINI_API_KEY is unset'
    );

    if (originalKey) {
      process.env.GEMINI_API_KEY = originalKey;
    }
  }

  // 5. Test extractVision with unconfigured key
  {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    (aiService as any).client = null;

    const res = await aiService.extractVision({
      prompt: 'Extract',
      base64Data: 'dGVzdA==',
      mimeType: 'image/jpeg',
      operationName: 'test_vision'
    });

    assert(
      res === null,
      'extractVision gracefully returns null when GEMINI_API_KEY is unset'
    );

    if (originalKey) {
      process.env.GEMINI_API_KEY = originalKey;
    }
  }

  console.log(`\nModule 54 Summary: ${passed}/${total} assertions passed.`);
  return { passed, total };
}

if (process.argv[1]?.endsWith('ai_service_wrapper.test.ts') || process.argv[1]?.endsWith('ai_service_wrapper.test.js')) {
  runAiServiceWrapperTests().then(({ passed, total }) => {
    if (passed !== total) process.exit(1);
    else process.exit(0);
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
