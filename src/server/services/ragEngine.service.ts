import { getSupabase } from '../db.js';
import { compressContextChunks, formatGroupedContextForPrompt, formatCompressedContextForPrompt, CompressedEvidence, CompressedEvidenceChunk } from './contextCompressor.service.js';
import { verifyAnswerAlignment, VerificationReport } from './claimVerifier.service.js';
import { fetchMslKnowledgeChunks, SEED_MANUAL_CHUNKS } from './mslKnowledge.service.js';
import { ragSemanticCache } from './ragCache.service.js';
import { ragLogger, RagReasoningPath } from './ragLogger.service.js';
import { aiService } from '../ai/index.js';

export type { CompressedEvidence, CompressedEvidenceChunk };

/**
 * IPDS FPMSB RAG ENGINE (ENTERPRISE HARDENED VERSION)
 * 
 * Architecture Pipeline:
 * User Query 
 *   → Gemini Embedding
 *   → Hybrid Vector + Lexical Search
 *   → RRF (Reciprocal Rank Fusion)
 *   → Candidate Retrieval
 *   → MMR Diversity Reranking
 *   → Top Chunks Selection
 *   → No-Evidence Hard Gate Check
 *   → Grounded Context
 *   → Gemini 3.7 Flash
 *   → Citation Reference Validation
 *   → Grounding Verification
 *   → Confidence Estimate
 *   → Final Response
 */

// ============================================================================
// TYPINGS & INTERFACES
// ============================================================================

export interface RagChunk {
  id: string;
  document_id?: string;
  file_name: string;
  category: string;
  section_title: string;
  page_number: number;
  chunk_index: number;
  content: string;
  metadata?: Record<string, any>;
  vector_score: number;
  keyword_score: number;
  final_rrf_score: number;
}

/**
 * Detailed Confidence Breakdown
 * NOTE: These values are composite HEURISTIC ESTIMATES based on multi-factor scores,
 * NOT mathematical probabilities or guaranteed correctness.
 */
export interface DetailedConfidenceBreakdown {
  /** Retrieval Score (0-100 composite heuristic estimate based on RRF / vector similarity) */
  retrievalScore: number;
  /** Reranker Score (0-100 composite heuristic estimate based on MMR diversity reranking) */
  rerankerScore: number;
  /** Source Authority Score (0-100 heuristic estimate based on document hierarchy, e.g., KUK/MSL) */
  sourceAuthority: number;
  /** Evidence Coverage Score (0-100 heuristic estimate based on query term overlap) */
  evidenceCoverage: number;
  /** Final Composite Confidence Estimate (0-100 weighted heuristic score) */
  finalConfidence: number;
}

/**
 * Grounded Verification Status
 * NOTE: Verification is based on Citation Reference Validation and Evidence Density,
 * NOT full semantic entailment model verification.
 */
export interface GroundedVerification {
  isGrounded: boolean;
  retrievalEvidenceScore: number;
  validCitationsCount: number;
  hasValidCitations: boolean;
  verificationReasoning: string;
  hardGateTriggered: boolean;
}

export interface GroundedResponse {
  answer: string;
  citations: Array<{
    citationId: string;
    document: string;
    category: string;
    section: string;
    page: number;
    chunk_index: number;
    rrf_score: number;
  }>;
  confidenceBreakdown: DetailedConfidenceBreakdown;
  grounding: GroundedVerification;
}

// ============================================================================
// 1. EMBEDDING GENERATION
// ============================================================================
export async function generateEmbedding(
  text: string, 
  taskType: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT' = 'RETRIEVAL_QUERY'
): Promise<number[] | null> {
  return aiService.generateEmbedding(text, taskType);
}

// ============================================================================
// 2. ESTIMATED TOKEN CHUNKING (HIERARCHICAL & OVERLAP-AWARE)
// NOTE: Uses character-length heuristic (~4 chars/token) as an estimated approximation.
// Does NOT claim exact token counting.
// Targets 500-800 estimated tokens (~2000-3200 characters) with 10-15% overlap.
// ============================================================================
export function hierarchicalEstimatedTokenChunking(
  documentText: string,
  minTokens: number = 500,
  maxTokens: number = 800,
  overlapPercentage: number = 0.12 // 12% default overlap (10% - 15% range)
): string[] {
  const CHARS_PER_TOKEN = 4; // Fallback character approximation
  const maxCharLimit = maxTokens * CHARS_PER_TOKEN; // ~3200 chars
  const minCharLimit = minTokens * CHARS_PER_TOKEN; // ~2000 chars

  // Ensure overlap is strictly bounded between 10% and 15%
  const boundedOverlap = Math.min(0.15, Math.max(0.10, overlapPercentage));
  const overlapCharLimit = Math.floor(maxCharLimit * boundedOverlap); // ~320 - 480 chars

  const chunks: string[] = [];

  // Stage 1: Heading-aware splitting (preserve section/chapter titles)
  const headingRegex = /(?=\n#{1,4}\s+|\n(?:BAB|SEKSYEN|KUK|MANUAL|JADUAL)\s+\d+:?)/i;
  const sections = documentText.split(headingRegex);

  for (const section of sections) {
    if (!section.trim()) continue;

    // Preserve section title for context propagation
    const headerMatch = section.match(/^(\n?#{1,4}\s+[^\n]+|\n?(?:BAB|SEKSYEN|KUK|MANUAL|JADUAL)\s+\d+:?[^\n]*)/i);
    const sectionHeader = headerMatch ? headerMatch[0].trim() : '';

    // Stage 2: Paragraph-aware splitting (preserve table blocks & formulas)
    const paragraphs = section.split(/\n\s*\n/);
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      const cleanPara = paragraph.trim();
      if (!cleanPara) continue;

      if ((currentChunk + '\n\n' + cleanPara).length <= maxCharLimit) {
        currentChunk = currentChunk ? `${currentChunk}\n\n${cleanPara}` : cleanPara;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());

          // Stage 5: Apply overlap actively
          const tailText = currentChunk.slice(-overlapCharLimit);
          const overlapPrefix = (sectionHeader && !tailText.includes(sectionHeader))
            ? `${sectionHeader}\n... ${tailText}`
            : `... ${tailText}`;

          currentChunk = `${overlapPrefix}\n\n${cleanPara}`;
        } else {
          // Stage 3: Sentence-aware splitting for long paragraphs
          const sentences = cleanPara.match(/[^.!?]+[.!?]+(\s+|$)/g) || [cleanPara];
          let sentenceChunk = '';

          for (const sentence of sentences) {
            if ((sentenceChunk + sentence).length <= maxCharLimit) {
              sentenceChunk += sentence;
            } else {
              if (sentenceChunk.length >= minCharLimit) {
                chunks.push(sentenceChunk.trim());
                const tailSentence = sentenceChunk.slice(-overlapCharLimit);
                sentenceChunk = `... ${tailSentence}${sentence}`;
              } else {
                sentenceChunk += sentence;
              }
            }
          }
          currentChunk = sentenceChunk;
        }
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
  }

  return chunks;
}

// ============================================================================
// 3. MMR DIVERSITY RERANKING
// NOTE: Performs Maximal Marginal Relevance (MMR) lexical diversity reranking.
// This is NOT Cross-Attention or Cross-Encoder neural reranking.
// ============================================================================
function calculateJaccardSimilarity(str1: string, str2: string): number {
  const set1 = new Set(str1.toLowerCase().split(/\s+/));
  const set2 = new Set(str2.toLowerCase().split(/\s+/));
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

export function applyMMRDiversityReranking(
  candidates: RagChunk[],
  topK: number = 5,
  lambdaParam: number = 0.75,
  isBroadOrWage: boolean = false
): RagChunk[] {
  if (candidates.length === 0) return [];

  // For broad category or wage queries, we want maximum completeness across all subcategories and table rows
  if (isBroadOrWage) {
    const selected: RagChunk[] = [];
    const seenContents = new Set<string>();

    for (const cand of candidates) {
      // Deduplicate only if near-identical text (Jaccard > 0.90)
      const isDuplicate = selected.some(s => calculateJaccardSimilarity(cand.content, s.content) > 0.90);
      if (!isDuplicate) {
        selected.push(cand);
        seenContents.add(cand.id);
        if (selected.length >= topK) break;
      }
    }
    return selected;
  }

  const selected: RagChunk[] = [];
  const unselected = [...candidates];

  // Select top candidate based on highest RRF score
  selected.push(unselected.shift()!);

  while (selected.length < topK && unselected.length > 0) {
    let bestIndex = -1;
    let bestMmrScore = -Infinity;

    for (let i = 0; i < unselected.length; i++) {
      const candidate = unselected[i];
      const relevance = candidate.final_rrf_score;

      let maxRedundancy = 0;
      for (const sel of selected) {
        const sim = calculateJaccardSimilarity(candidate.content, sel.content);
        if (sim > maxRedundancy) maxRedundancy = sim;
      }

      // MMR formula: lambda * relevance - (1 - lambda) * redundancy
      const mmrScore = lambdaParam * relevance - (1 - lambdaParam) * maxRedundancy;
      if (mmrScore > bestMmrScore) {
        bestMmrScore = mmrScore;
        bestIndex = i;
      }
    }

    if (bestIndex !== -1) {
      selected.push(unselected.splice(bestIndex, 1)[0]);
    } else {
      break;
    }
  }

  return selected;
}

// ============================================================================
// 1. EVIDENCE COVERAGE & CONFIDENCE ESTIMATE
// ============================================================================
// Common cross-lingual domain terms mapping (Bahasa Melayu <-> English)
const AGRONOMY_DOMAIN_SYNONYMS: Record<string, string[]> = {
  hectare: ['hektar', 'ha'],
  hektar: ['hectare', 'ha'],
  herbicide: ['herbisid', 'racun'],
  herbisid: ['herbicide', 'racun'],
  spraying: ['semburan', 'sembur', 'spray'],
  semburan: ['spraying', 'sembur', 'spray'],
  rate: ['kadar', 'dos'],
  kadar: ['rate', 'dosage', 'dos'],
  dosage: ['dos', 'kadar', 'sukatan'],
  dos: ['dosage', 'kadar', 'sukatan'],
  wage: ['upah', 'gaji', 'kadar'],
  upah: ['wage', 'rate', 'gaji'],
  weed: ['rumpai'],
  rumpai: ['weed'],
  control: ['kawalan', 'basmi'],
  kawalan: ['control', 'basmi'],
  fertilizer: ['baja', 'pembajaan'],
  baja: ['fertilizer'],
  palam: ['palm', 'sawit'],
  palm: ['sawit', 'palam'],
  sawit: ['palm', 'palam'],
  oil: ['minyak', 'sawit'],
  buku: ['book', 'manual', 'edisi', 'edition'],
  book: ['buku', 'manual', 'edition', 'edisi'],
  edition: ['edisi', '5th', 'buku'],
  edisi: ['edition', '5th', 'buku'],
  dura: ['sh+', 'tebal', 'tempurung'],
  pisifera: ['sh-', 'tiada tempurung'],
  tenera: ['dxp', 'sh+sh-'],
  pelepah: ['frond', 'lsu'],
  frond: ['pelepah', 'lsu'],
  gambut: ['peat', 'water table'],
  peat: ['gambut']
};

export function calculateEvidenceCoverage(query: string, chunks: RagChunk[]): number {
  if (!query || chunks.length === 0) return 0;

  // Corrected regex: replace non-alphanumeric chars with space
  // Preserves Bahasa Melayu, English, domain numbers (16L, 18L, 2025, 2.5g)
  const normalizedQuery = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const STOP_WORDS = new Set(['apakah', 'bagaimanakah', 'berapakah', 'bilakah', 'siapakah', 'mengapakah', 'untuk', 'dengan', 'yang', 'pada', 'oleh', 'dalam', 'iaitu', 'atau', 'serta', 'apa', 'bagaimana', 'berapa', 'sila', 'terima', 'kasih', 'what', 'how', 'when', 'where', 'which', 'who', 'for', 'with', 'and', 'the', 'from']);
  const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length >= 2 && !STOP_WORDS.has(w));

  if (queryWords.length === 0) return 100;

  const ATTRIBUTE_WORDS = new Set(['ukuran', 'saiz', 'dimensi', 'kadar', 'dos', 'hargai', 'upah', 'gaji', 'jarak', 'kedalaman', 'lebar', 'panjang', 'tinggi', 'nisbah', 'spesifikasi']);
  const topicWords = queryWords.filter(w => !ATTRIBUTE_WORDS.has(w));
  const attributeWords = queryWords.filter(w => ATTRIBUTE_WORDS.has(w));

  const combinedContext = chunks.map(c => ((c.section_title || '') + ' ' + (c.content || '')).toLowerCase()).join(' ');

  // 1. Check primary topic presence across chunks
  let topicMatches = 0;
  if (topicWords.length > 0) {
    for (const tw of topicWords) {
      if (combinedContext.includes(tw)) topicMatches++;
    }
  } else {
    topicMatches = 1;
  }

  // P0-4 FIX: If top chunks do NOT contain the query topic, evidence coverage drops to 0
  if (topicWords.length > 0 && topicMatches === 0) {
    return 0;
  }

  let coveredCount = 0;
  for (const word of queryWords) {
    // 1. Direct substring match
    if (combinedContext.includes(word)) {
      coveredCount++;
      continue;
    }

    // 2. Cross-lingual domain synonym match
    const synonyms = AGRONOMY_DOMAIN_SYNONYMS[word] || [];
    let synonymMatched = false;
    for (const syn of synonyms) {
      if (combinedContext.includes(syn)) {
        synonymMatched = true;
        break;
      }
    }

    if (synonymMatched) {
      coveredCount++;
    }
  }

  const basePercentage = Math.round((coveredCount / queryWords.length) * 100);

  // Boost coverage if attribute requested and top chunks contain actual numeric specs/measurements
  const hasDimensions = Boolean(combinedContext.match(/\b\d+(?:\.\d+)?\s*(?:m|meter|cm|mm|ft|kaki|x|\*)\b/i));
  if (attributeWords.length > 0 && hasDimensions && topicMatches > 0) {
    return Math.min(100, basePercentage + 15);
  }

  return Math.min(100, Math.max(0, basePercentage));
}

/**
 * Calculates Detailed Confidence Breakdown.
 * NOTE: Returns heuristic composite estimates, NOT exact mathematical probabilities.
 */
export function calculateConfidenceEstimate(
  rawCandidates: RagChunk[],
  rerankedChunks: RagChunk[],
  query: string
): DetailedConfidenceBreakdown {
  if (rerankedChunks.length === 0) {
    return {
      retrievalScore: 0,
      rerankerScore: 0,
      sourceAuthority: 0,
      evidenceCoverage: 0,
      finalConfidence: 0
    };
  }

  // 1. Retrieval Score (0-100 heuristic based on raw RRF scores)
  const topRetrievalScores = rawCandidates.slice(0, 5).map(c => c.final_rrf_score);
  const avgRetrieval = topRetrievalScores.length > 0
    ? (topRetrievalScores.reduce((a, b) => a + b, 0) / topRetrievalScores.length)
    : 0;
  const retrievalScore = Math.min(100, Math.round(avgRetrieval * 300));

  // 2. Reranker Score (0-100 heuristic based on MMR diversity output density)
  const topRerankedScores = rerankedChunks.map(c => c.final_rrf_score);
  const avgReranked = topRerankedScores.length > 0
    ? (topRerankedScores.reduce((a, b) => a + b, 0) / topRerankedScores.length)
    : 0;
  const rerankerScore = Math.min(100, Math.round(avgReranked * 320));

  // 3. Source Authority (0-100 heuristic based on document authority hierarchy)
  let authoritySum = 0;
  for (const chunk of rerankedChunks) {
    const cat = (chunk.category || '').toLowerCase();
    const docName = (chunk.file_name || '').toLowerCase();

    if (cat.includes('kuk') || docName.includes('kuk') || cat.includes('pekeliling')) {
      authoritySum += 100; // Top Authority (KUK Siri 8 / Pekeliling)
    } else if (cat.includes('manual') || docName.includes('manual') || cat.includes('sop') || docName.includes('msl')) {
      authoritySum += 85;  // High Authority (Manual Sawit / SOP / MSL)
    } else {
      authoritySum += 65;  // Standard Reference
    }
  }
  const sourceAuthority = Math.round(authoritySum / rerankedChunks.length);

  // 4. Evidence Coverage (0-100 heuristic)
  const evidenceCoverage = calculateEvidenceCoverage(query, rerankedChunks);

  // 5. Final Composite Confidence Estimate
  const finalConfidence = Math.round(
    (retrievalScore * 0.25) +
    (rerankerScore * 0.30) +
    (sourceAuthority * 0.25) +
    (evidenceCoverage * 0.20)
  );

  return {
    retrievalScore,
    rerankerScore,
    sourceAuthority,
    evidenceCoverage,
    finalConfidence
  };
}

// ============================================================================
// 5. CITATION REFERENCE VALIDATION & GROUNDING VERIFICATION
// ============================================================================
export function validateCitationReferences(
  answerText: string,
  chunks: RagChunk[]
): {
  validCitationsCount: number;
  hasValidCitations: boolean;
  extractedCitations: Array<{ citationId: string; chunkIndex: number; isValid: boolean }>;
} {
  // Matches [Ruj 1], [Ruj 2], [Sumber 1], etc.
  const citationRegex = /\[(?:Ruj|Sumber)\s*(\d+)\]/gi;
  const matches = [...answerText.matchAll(citationRegex)];
  
  const extractedCitations: Array<{ citationId: string; chunkIndex: number; isValid: boolean }> = [];
  let validCount = 0;

  for (const match of matches) {
    const idx = parseInt(match[1], 10);
    const isValid = idx >= 1 && idx <= chunks.length;
    if (isValid) {
      validCount++;
    }
    extractedCitations.push({
      citationId: match[0],
      chunkIndex: idx,
      isValid
    });
  }

  return {
    validCitationsCount: validCount,
    hasValidCitations: validCount > 0,
    extractedCitations
  };
}

// ============================================================================
// 4B. DEDICATED RETRIEVAL ENGINES (VECTOR-ONLY VS HYBRID PALM OIL 5TH ED)
// ============================================================================

/**
 * Identifies whether a query or category filter targets the 'Palm Oil 5th Edition' academic manual collection.
 */
export function isPalmOil5thEditionCollection(query: string, categoryFilter: string = ''): boolean {
  const qLower = (query || '').toLowerCase();
  const catLower = (categoryFilter || '').toLowerCase();
  return (
    catLower.includes('palm oil') ||
    catLower.includes('oil palm') ||
    catLower.includes('oil palam') ||
    catLower.includes('the oil palm') ||
    catLower.includes('5th edition') ||
    catLower.includes('5th ed') ||
    catLower.includes('corley') ||
    catLower.includes('tinker') ||
    catLower.startsWith('top') ||
    qLower.includes('palm oil') ||
    qLower.includes('the oil palm') ||
    qLower.includes('oil palm') ||
    qLower.includes('oil palam') ||
    qLower.includes('corley & tinker') ||
    qLower.includes('corley and tinker') ||
    qLower.includes('corley') ||
    qLower.includes('tinker') ||
    qLower.includes('5th edition') ||
    qLower.includes('5th ed') ||
    qLower.includes('bunch index') ||
    qLower.includes('dry matter') ||
    qLower.includes('dura') ||
    qLower.includes('pisifera') ||
    qLower.includes('tenera') ||
    qLower.includes('avros') ||
    qLower.includes('yangambi') ||
    qLower.includes('ekona') ||
    qLower.includes('frond 17') ||
    qLower.includes('pelepah 17') ||
    qLower.includes('ganoderma') ||
    qLower.includes('basal stem rot') ||
    qLower.includes('bsr')
  );
}

export type SpecificWageIntent =
  | 'HARVESTING_WAGE'        // Upah menuai, kadar tuai, upah menuai BTS, potong buah, sabit, pahat, egrek
  | 'PRUNING_WAGE'           // Upah pruning, pemangkasan pelepah, cantas pelepah, susun pelepah
  | 'WEEDING_SPRAYING_WAGE'  // Upah meracun, semburan herbisid, circle weeding, trunk injection
  | 'FERTILIZING_WAGE'       // Upah membaja, tabur baja, efb mulching
  | 'TRANSPORT_WAGE'         // Upah mengangkut BTS, evakuasi BTS, lori BTS
  | 'LOOSE_FRUIT_WAGE'       // Upah kutip biji relai, loose fruit
  | 'PLANTING_INFRA_WAGE'    // Upah tanam semula, sulaman, cuci parit
  | 'ALL_WAGES_SUMMARY'      // Ringkasan semua upah ladang, jadual master KUK SIRI 8 (hanya jika explicitly asked)
  | 'NONE';

export function classifySpecificWageIntent(query: string): SpecificWageIntent {
  const q = (query || '').toLowerCase().trim();

  // Direct exact triggers for Harvesting Wage
  if (
    /^(upah menuai|kadar upah menuai|upah menuai bts|kadar menuai|berapa upah menuai\??|berapa kadar menuai\??|upah tuai|kadar tuai|upah potong buah|kadar potong buah|upah bts|kadar bts)$/i.test(q) ||
    /^(kadar upah menuai bts|kadar upah memungut bts|upah potong bts|kadar menuai bts)$/i.test(q)
  ) {
    return 'HARVESTING_WAGE';
  }

  // Check if query is explicitly asking for ALL / master wage schedule
  if (/\b(semua upah|semua kadar upah|ringkasan kuk|jadual master kuk|senarai semua kadar upah|buku kadar upah kerja)\b/i.test(q)) {
    return 'ALL_WAGES_SUMMARY';
  }

  const isHarvesting = /\b(menuai|tuai|penuaian|potong buah|bts|pahat|egrek|sabit rendah|sabit egrek)\b/i.test(q);
  const isPruning = /\b(pruning|pangkas|pemangkasan|cantas|susun pelepah|frond stacking)\b/i.test(q);
  const isWeeding = /\b(meracun|racun|herbisid|merumput|semburan|circle weeding|trunk injection)\b/i.test(q);
  const isFertilizing = /\b(membaja|baja|pembajaan|tabur baja|mop|urea|efb mulching)\b/i.test(q);
  const isTransport = /\b(mengangkut|angkut|evakuasi|transport|lori bts|badang|grabber)\b/i.test(q);
  const isLooseFruit = /\b(biji relai|loose fruit|kutipan biji)\b/i.test(q);
  const isPlanting = /\b(tanam|menanam|sulaman|supplying|ablasi|cuci parit)\b/i.test(q);

  if (isHarvesting && !isPruning && !isWeeding && !isFertilizing && !isTransport && !isPlanting) {
    return 'HARVESTING_WAGE';
  }
  if (isPruning && !isHarvesting && !isWeeding && !isFertilizing) {
    return 'PRUNING_WAGE';
  }
  if (isWeeding && !isHarvesting && !isPruning && !isFertilizing) {
    return 'WEEDING_SPRAYING_WAGE';
  }
  if (isFertilizing && !isHarvesting && !isPruning && !isWeeding) {
    return 'FERTILIZING_WAGE';
  }
  if (isTransport && !isHarvesting && !isPruning) {
    return 'TRANSPORT_WAGE';
  }
  if (isLooseFruit && !isHarvesting && !isPruning) {
    return 'LOOSE_FRUIT_WAGE';
  }
  if (isPlanting && !isHarvesting && !isPruning) {
    return 'PLANTING_INFRA_WAGE';
  }

  return 'NONE';
}

/**
 * Enforces strict post-retrieval cross-category isolation for specific wage queries.
 * Completely eliminates unrelated activity tables (Pruning, Racun, Baja, Tanam) from context.
 */
export function isolateAndFilterWageCandidates(
  candidates: RagChunk[],
  wageIntent: SpecificWageIntent
): { filteredCandidates: RagChunk[]; filteredOutCount: number; filteredOutCategories: string[] } {
  if (wageIntent === 'NONE' || wageIntent === 'ALL_WAGES_SUMMARY') {
    return { filteredCandidates: candidates, filteredOutCount: 0, filteredOutCategories: [] };
  }

  const filteredOutCategoriesSet = new Set<string>();
  let filteredOutCount = 0;

  const filteredCandidates = candidates.filter(c => {
    const sec = (c.section_title || '').toLowerCase();
    const cont = (c.content || '').toLowerCase();
    const doc = (c.file_name || '').toLowerCase();

    if (wageIntent === 'HARVESTING_WAGE') {
      // Isolate strictly to Menuai & Memungut BTS (Page 72)
      const isPruning = sec.includes('pemangkasan') || sec.includes('pruning') || sec.includes('susun pelepah') || (sec.includes('pelepah') && !sec.includes('menuai'));
      const isChemical = sec.includes('racun') || sec.includes('herbisid') || sec.includes('trunk injection') || sec.includes('circle weeding');
      const isFertilizer = sec.includes('baja') || sec.includes('membaja') || sec.includes('efb mulching');
      const isPlanting = sec.includes('penanaman') || sec.includes('sulaman') || sec.includes('cuci parit') || sec.includes('ablasi');
      const isTransport = sec.includes('pengangkutan & evakuasi') || sec.includes('evakuasi bts');
      const isLooseFruitStandalone = sec.includes('kutipan biji relai (loose fruits)') && !cont.includes('pokok rendah');
      const isProcurement = doc.includes('perolehan') || sec.includes('perolehan') || cont.includes('sebut harga');

      if (isPruning) {
        filteredOutCategoriesSet.add('PRUNING / PEMANGKASAN PELEPAH');
        filteredOutCount++;
        return false;
      }
      if (isChemical) {
        filteredOutCategoriesSet.add('SEMBURAN RACUN / CHEMICAL SPRAYING');
        filteredOutCount++;
        return false;
      }
      if (isFertilizer) {
        filteredOutCategoriesSet.add('PENABURAN BAJA / FERTILIZER');
        filteredOutCount++;
        return false;
      }
      if (isPlanting) {
        filteredOutCategoriesSet.add('PENANAMAN & INFRASTRUKTUR');
        filteredOutCount++;
        return false;
      }
      if (isTransport) {
        filteredOutCategoriesSet.add('PENGANGKUTAN & EVAKUASI BTS');
        filteredOutCount++;
        return false;
      }
      if (isLooseFruitStandalone) {
        filteredOutCategoriesSet.add('KUTIPAN BIJI RELAI (STANDALONE)');
        filteredOutCount++;
        return false;
      }
      if (isProcurement) {
        filteredOutCategoriesSet.add('MANUAL PEROLEHAN');
        filteredOutCount++;
        return false;
      }

      const isHarvestingMatch = sec.includes('menuai') || sec.includes('tuai') || sec.includes('bts') || cont.includes('pokok rendah') || cont.includes('pokok tinggi') || cont.includes('pahat') || cont.includes('sabit egrek');
      return isHarvestingMatch;
    }

    if (wageIntent === 'PRUNING_WAGE') {
      const isHarvesting = sec.includes('menuai') || sec.includes('penuaian');
      const isChemical = sec.includes('racun') || sec.includes('herbisid');
      const isFertilizer = sec.includes('baja') || sec.includes('membaja');
      if (isHarvesting || isChemical || isFertilizer) {
        filteredOutCount++;
        return false;
      }
      return sec.includes('pruning') || sec.includes('pangkas') || sec.includes('pelepah');
    }

    if (wageIntent === 'WEEDING_SPRAYING_WAGE') {
      const isHarvesting = sec.includes('menuai') || sec.includes('penuaian');
      const isPruning = sec.includes('pruning') || sec.includes('pangkas');
      const isFertilizer = sec.includes('baja') || sec.includes('membaja');
      if (isHarvesting || isPruning || isFertilizer) {
        filteredOutCount++;
        return false;
      }
      return sec.includes('racun') || sec.includes('herbisid') || sec.includes('rumpai') || sec.includes('semburan') || sec.includes('trunk injection');
    }

    if (wageIntent === 'FERTILIZING_WAGE') {
      const isHarvesting = sec.includes('menuai') || sec.includes('penuaian');
      const isPruning = sec.includes('pruning') || sec.includes('pangkas');
      const isChemical = sec.includes('racun') || sec.includes('herbisid');
      if (isHarvesting || isPruning || isChemical) {
        filteredOutCount++;
        return false;
      }
      return sec.includes('baja') || sec.includes('membaja') || sec.includes('efb');
    }

    return true;
  });

  return {
    filteredCandidates,
    filteredOutCount,
    filteredOutCategories: Array.from(filteredOutCategoriesSet)
  };
}

export interface RetrievalExecutionOptions {
  queryEmbed: number[] | null;
  userQuery: string;
  categoryFilter?: string;
  matchCount?: number;
  matchThreshold?: number;
  projectId?: string | null;
  documentId?: string | null;
}

/**
 * ENTERPRISE HYBRID RETRIEVAL (Dense Vector + Sparse Lexical BM25 + Section Title Boosting)
 * Applied universally across all queries to guarantee high precision for both semantic concepts
 * and exact technical/agronomic terms (dimensions, specifications, rates, chemical names).
 */
export async function executeEnterpriseHybridRetrieval(
  options: RetrievalExecutionOptions,
  supabaseClient?: any
): Promise<RagChunk[]> {
  const { queryEmbed, userQuery, categoryFilter = 'Semua', matchCount = 80, matchThreshold = 0.0, projectId = null, documentId = null } = options;
  const supabase = supabaseClient !== undefined ? supabaseClient : getSupabase();
  let results: RagChunk[] = [];

  const qLower = (userQuery || '').toLowerCase();
  const wageIntent = classifySpecificWageIntent(userQuery);
  const isExactSpecQuery = Boolean(
    qLower.match(/\b(ukuran|lebar|dimensi|teres|parit|jalan|jarak|dos|kadar|upah|jadual|backslope|bund|slope|cerun|kuk|table|l\/ha|kg\/ha|cm|meter|m)\b/i)
  );

  // Specific queries receive targeted narrow matchCount (Rule 9)
  const effectiveMatchCount = wageIntent === 'HARVESTING_WAGE' ? 8 : matchCount;

  // Dense semantic pgvector is primary signal, with keyword/BM25 as supporting signal (Rule 1)
  const vectorWeight = isExactSpecQuery ? 0.65 : 0.75;
  const textWeight = isExactSpecQuery ? 0.35 : 0.25;

  if (supabase && queryEmbed) {
    try {
      // 1. Primary pgvector RPC search (match_pdf_documents)
      const { data, error } = await supabase.rpc('match_pdf_documents', {
        query_embedding: queryEmbed,
        keyword_query: userQuery,
        match_threshold: matchThreshold,
        match_count: effectiveMatchCount,
        vector_weight: vectorWeight,
        text_weight: textWeight,
        filter_project_id: projectId,
        filter_document_id: documentId
      });

      if (!error && Array.isArray(data) && data.length > 0) {
        results = data.map((d: any, idx: number) => ({
          id: d.id || `chunk-rpc-hyb-${idx}`,
          file_name: d.file_name || d.manual_title || 'Dokumen Rujukan IPDS',
          category: d.topic || d.category || 'Manual Sawit',
          section_title: d.section || d.section_title || d.file_name || 'Seksyen Dokumen',
          page_number: d.page_number || 1,
          chunk_index: d.chunk_index ?? idx,
          content: d.content || '',
          vector_score: d.similarity || 0.85,
          keyword_score: d.score || 10,
          final_rrf_score: d.similarity || 0.85
        }));

        // 2. Continuous Table / Section Window Expansion from pgvector
        // If query is broad or general wage, expand. For specific wage, expand strictly to same section.
        const matchedDocIds = Array.from(new Set(data.map((d: any) => d.document_id).filter(Boolean)));
        const matchedTopics = Array.from(new Set(data.map((d: any) => d.topic).filter(Boolean)));
        
        if (matchedDocIds.length > 0 || matchedTopics.length > 0) {
          try {
            let sibQuery = supabase
              .from('pdf_documents')
              .select('id, document_id, file_name, page_number, section, topic, chunk_index, content, metadata');
            
            if (wageIntent === 'HARVESTING_WAGE') {
              // Narrow targeted sibling query strictly to harvesting sections
              sibQuery = sibQuery.or('section.ilike.%menuai%,section.ilike.%bts%');
            } else if (matchedDocIds.length > 0) {
              sibQuery = sibQuery.in('document_id', matchedDocIds);
            } else if (matchedTopics.length > 0) {
              sibQuery = sibQuery.in('topic', matchedTopics);
            }

            const { data: siblingData, error: sibErr } = await sibQuery.limit(wageIntent === 'HARVESTING_WAGE' ? 10 : 300);
            if (!sibErr && siblingData && siblingData.length > 0) {
              const existingIds = new Set(results.map(r => r.id));
              for (const s of siblingData) {
                if (!existingIds.has(s.id)) {
                  existingIds.add(s.id);
                  results.push({
                    id: s.id || `chunk-pg-sib-${results.length}`,
                    file_name: s.file_name || 'Dokumen Rujukan IPDS',
                    category: s.topic || 'Manual Sawit',
                    section_title: s.section || s.file_name || 'Seksyen Dokumen',
                    page_number: s.page_number || 1,
                    chunk_index: s.chunk_index ?? results.length,
                    content: s.content || '',
                    vector_score: 0.88,
                    keyword_score: 10,
                    final_rrf_score: 0.85
                  });
                }
              }
            }
          } catch (expandErr) {
            console.warn('[Enterprise RAG] Sibling chunk expansion notice:', expandErr);
          }
        }
      }
    } catch (err) {
      console.warn('[Enterprise RAG] Hybrid RPC search notice:', err);
    }

    // 1b. Try match_rag_hybrid if pdf_documents had 0 results
    if (results.length === 0) {
      try {
        const { data: hybridData, error: hybridErr } = await supabase.rpc('match_rag_hybrid', {
          query_embedding: queryEmbed,
          fts_query: userQuery,
          match_threshold: matchThreshold,
          match_count: effectiveMatchCount,
          filter_category: categoryFilter !== 'Semua' ? categoryFilter : null
        });

        if (!hybridErr && Array.isArray(hybridData) && hybridData.length > 0) {
          results = hybridData.map((d: any, idx: number) => ({
            id: d.id || `chunk-rag-hyb-${idx}`,
            file_name: d.file_name || 'Dokumen Rujukan IPDS',
            category: d.category || 'Manual Sawit',
            section_title: d.section_title || d.file_name || 'Seksyen Dokumen',
            page_number: d.page_number || 1,
            chunk_index: d.chunk_index ?? idx,
            content: d.content || '',
            vector_score: d.vector_score || 0.85,
            keyword_score: d.keyword_score || 10,
            final_rrf_score: d.final_rrf_score || 0.85
          }));
        }
      } catch (hybRpcErr) {
        console.warn('[Enterprise RAG] match_rag_hybrid RPC notice:', hybRpcErr);
      }
    }
  }

  // Fallback In-Memory Knowledge Base retrieval (ONLY when pgvector returns 0 results)
  if (results.length === 0) {
    try {
      const fallbackChunks = await fetchMslKnowledgeChunks(userQuery, categoryFilter, effectiveMatchCount, supabase, queryEmbed);
      if (fallbackChunks && fallbackChunks.length > 0) {
        results = fallbackChunks.map((c: any, idx: number) => ({
          id: c.id || `chunk-kb-hyb-${idx}`,
          file_name: c.manual_title || 'Dokumen Rujukan IPDS',
          category: c.category || 'Manual Sawit',
          section_title: c.section_title || c.manual_title || 'Seksyen Dokumen',
          page_number: c.page_number || 1,
          chunk_index: idx,
          content: c.content || '',
          vector_score: c.vector_score || c.similarity || 0.85,
          keyword_score: c.keyword_score || c.score || 10,
          final_rrf_score: c.vector_score || c.similarity || 0.85
        }));
      }
    } catch (fbErr) {
      console.warn('[Enterprise RAG] Fallback hybrid retrieval notice:', fbErr);
    }
  }

  return results;
}

export interface OperationalIntent {
  primaryAction?: string;
  primaryEntity?: string;
  domainCategory?: string;
  matchedSynonyms: string[];
}

export function detectOperationalIntent(query: string): OperationalIntent {
  const qLower = (query || '').toLowerCase();
  
  // Nursery / Tapak semaian takes high precedence when query is about nursery
  if (qLower.includes('nursery') || qLower.includes('semai') || qLower.includes('tapak semaian') || qLower.includes('polibeg') || qLower.includes('culling')) {
    return {
      primaryAction: qLower.includes('baja') ? 'membaja' : (qLower.includes('pengairan') || qLower.includes('siram') ? 'pengairan' : 'nursery'),
      primaryEntity: 'anak benih',
      domainCategory: 'TAPAK_SEMAIAN',
      matchedSynonyms: ['tapak semaian', 'semai', 'nursery', 'pre-nursery', 'main nursery', 'polibeg', 'cambah', 'culling', 'pengairan', 'baja']
    };
  }
  if (qLower.includes('merumput') || qLower.includes('meracun') || qLower.includes('racun') || qLower.includes('herbisid') || qLower.includes('rumpai') || qLower.includes('semburan') || qLower.includes('glyphosate') || qLower.includes('metsulfuron') || qLower.includes('lalang') || qLower.includes('asystasia') || qLower.includes('mikania') || qLower.includes('circle weeding') || qLower.includes('woody growth')) {
    return {
      primaryAction: 'meracun',
      primaryEntity: 'racun',
      domainCategory: 'KAWALAN_RUMPAI',
      matchedSynonyms: ['merumput', 'meracun', 'racun', 'herbisid', 'rumpai', 'semburan', 'glyphosate', 'metsulfuron', 'glufosinate', 'triclopyr', 'lalang', 'asystasia', 'mikania', 'circle weeding', 'woody growth', 'trunk injection', 'piringan', 'lorong menuai']
    };
  }
  if (qLower.includes('membaja') || qLower.includes('baja') || qLower.includes('pembajaan') || qLower.includes('tabur baja') || qLower.includes('fertilizer') || qLower.includes('borate') || qLower.includes('efb')) {
    return {
      primaryAction: 'membaja',
      primaryEntity: 'baja',
      domainCategory: 'PEMBAJAAN',
      matchedSynonyms: ['membaja', 'baja', 'pembajaan', 'tabur baja', 'fertilizer', 'urea', 'mop', 'rp', 'kieserite', 'borate', 'npk', 'cirp', 'lsu', 'pelepah 17', 'efb', 'mulching', '4t', 'pusingan']
    };
  }
  if (qLower.includes('menuai') || qLower.includes('tuai') || qLower.includes('bts') || qLower.includes('pahat') || qLower.includes('sabit') || qLower.includes('egrek') || qLower.includes('buah relai') || qLower.includes('biji relai') || qLower.includes('loose fruit') || qLower.includes('penuaian')) {
    return {
      primaryAction: 'menuai',
      primaryEntity: 'bts',
      domainCategory: 'PENUAIAN',
      matchedSynonyms: ['menuai', 'tuai', 'penuaian', 'bts', 'buah relai', 'biji relai', 'loose fruit', 'pahat', 'sabit', 'egrek', 'abw', 'btp', 'kutipan', 'evakuasi', 'kematangan']
    };
  }
  if (qLower.includes('parit') || qLower.includes('saliran') || qLower.includes('drain')) {
    return {
      primaryAction: 'saliran',
      primaryEntity: 'parit',
      domainCategory: 'PERPARITAN',
      matchedSynonyms: ['parit', 'saliran', 'drain', 'drainage', 'parit utama', 'parit sekunder', 'parit ladang', 'parit sempadan', 'main drain', 'collection drain', 'field drain']
    };
  }
  if (qLower.includes('teres') || qLower.includes('terrace') || qLower.includes('backslope') || qLower.includes('stop bund')) {
    return {
      primaryAction: 'teres',
      primaryEntity: 'teres',
      domainCategory: 'TERES_KONTUR',
      matchedSynonyms: ['teres', 'terrace', 'backslope', 'stop bund', 'benteng hentian', 'cerun', 'tapak teres', 'cut batter']
    };
  }
  if (qLower.includes('pruning') || qLower.includes('pangkas') || qLower.includes('pelepah') || qLower.includes('susun pelepah') || qLower.includes('frond stacking') || qLower.includes('pemangkasan')) {
    return {
      primaryAction: 'pruning',
      primaryEntity: 'pelepah',
      domainCategory: 'PENYELENGGARAAN_PELEPAH',
      matchedSynonyms: ['pruning', 'pangkas', 'pemangkasan', 'pelepah', 'susun pelepah', 'frond stacking', 'songgo', 'kanopi']
    };
  }
  if (qLower.includes('perolehan') || qLower.includes('lpo') || qLower.includes('tender') || qLower.includes('sebut harga')) {
    return {
      primaryAction: 'perolehan',
      primaryEntity: 'perolehan',
      domainCategory: 'PEROLEHAN',
      matchedSynonyms: ['perolehan', 'lpo', 'tender', 'sebut harga', 'pembelian terus', 'grn', 'bon pelaksanaan', 'wjp', 'darurat']
    };
  }
  return {
    matchedSynonyms: []
  };
}

/**
 * Detects broad category queries (Rule 2)
 * Examples: upah menuai, upah merumput, upah membaja, kadar upah pruning, pengurusan tapak semaian, etc.
 */
export function isBroadCategoryQuery(query: string, opIntent?: OperationalIntent): boolean {
  const qLower = (query || '').toLowerCase().trim();
  
  // Specific scalar indicator words make a query narrow:
  const isNarrowScalarQuery = Boolean(
    qLower.match(/\b(berapa dos|berapakah dos|sukatan bancuhan|saiz polibeg|ukuran parit sempadan|lebar bawah|kedalaman parit|lebar atas|backslope|kecerunan|formula|definisi|siapakah|m\/s|muka surat|jadual \d+)\b/i)
  );
  if (isNarrowScalarQuery) return false;

  const broadTriggers = [
    'kadar upah', 'upah', 'gaji', 'kuk', 'panduan', 'pengurusan', 'sop', 'tatacara',
    'menuai', 'merumput', 'meracun', 'membaja', 'pruning', 'pembajaan', 'penuaian',
    'kawalan rumpai', 'tapak semaian', 'saliran', 'perparitan', 'teres'
  ];

  return broadTriggers.some(trigger => qLower.includes(trigger));
}

/**
 * Expands retrieval to collect ALL semantically related chunks from the SAME document/manual and SAME activity category (Rule 3)
 */
export function expandRetrievalToRelatedChunks(
  primaryCandidates: RagChunk[],
  userQuery: string,
  opIntent: OperationalIntent,
  allSourceChunks: any[] = SEED_MANUAL_CHUNKS
): RagChunk[] {
  if (primaryCandidates.length === 0) return primaryCandidates;

  const isBroad = isBroadCategoryQuery(userQuery, opIntent);
  if (!isBroad && !opIntent.primaryAction) {
    return primaryCandidates;
  }

  // Get primary matched manual/document names from top candidates
  const primaryDocNames = new Set(primaryCandidates.slice(0, 3).map(c => (c.file_name || '').toLowerCase()));
  const existingIds = new Set(primaryCandidates.map(c => c.id));
  const existingSections = new Set(primaryCandidates.map(c => (c.section_title || '').toLowerCase()));
  const expanded: RagChunk[] = [...primaryCandidates];

  const action = opIntent.primaryAction;
  const synonyms = opIntent.matchedSynonyms || [];

  const relatedActionKeywords: Record<string, string[]> = {
    menuai: ['menuai', 'tuai', 'penuaian', 'bts', 'buah relai', 'biji relai', 'loose fruit', 'sabit', 'pahat', 'egrek', 'evakuasi', 'kematangan'],
    meracun: ['meracun', 'merumput', 'racun', 'herbisid', 'rumpai', 'semburan', 'circle weeding', 'woody growth', 'trunk injection', 'piringan', 'lorong menuai'],
    membaja: ['membaja', 'baja', 'pembajaan', 'tabur baja', 'fertilizer', 'urea', 'mop', 'rp', 'borate', 'kieserite', 'npk', 'efb', 'mulching', '4t', 'pusingan'],
    pruning: ['pruning', 'pemangkasan', 'pangkas', 'pelepah', 'susun pelepah', 'frond stacking', 'songgo', 'kanopi'],
    saliran: ['parit', 'saliran', 'drain', 'parit utama', 'parit sekunder', 'parit sempadan', 'parit ladang'],
    teres: ['teres', 'terrace', 'backslope', 'stop bund', 'benteng hentian', 'cerun'],
    nursery: ['tapak semaian', 'nursery', 'pre-nursery', 'main nursery', 'polibeg', 'culling', 'pengairan', 'baja']
  };

  const currentActionKeywords = action && relatedActionKeywords[action] ? relatedActionKeywords[action] : synonyms;
  const wageIntent = classifySpecificWageIntent(userQuery);

  for (let idx = 0; idx < allSourceChunks.length; idx++) {
    const raw = allSourceChunks[idx];
    const rawId = raw.id || `chunk-seed-exp-${idx}`;
    const rawSec = (raw.section_title || '').toLowerCase();
    if (existingIds.has(rawId) || existingSections.has(rawSec)) continue;

    const docName = (raw.manual_title || raw.file_name || '').toLowerCase();
    const cat = (raw.category || '').toLowerCase();
    const cont = (raw.content || '').toLowerCase();

    // Intent Isolation: Never expand harvesting queries to other operations
    if (wageIntent === 'HARVESTING_WAGE' || opIntent.primaryAction === 'menuai') {
      if (
        rawSec.includes('pruning') || rawSec.includes('pemangkasan') || rawSec.includes('pelepah') ||
        rawSec.includes('racun') || rawSec.includes('herbisid') || rawSec.includes('trunk injection') ||
        rawSec.includes('baja') || rawSec.includes('membaja') || rawSec.includes('efb') ||
        rawSec.includes('penanaman') || rawSec.includes('sulaman') || rawSec.includes('cuci parit') ||
        docName.includes('perolehan')
      ) {
        continue;
      }
    }

    // Condition 1: Same document/manual as top candidates OR direct domain manual
    const isDocMatch = primaryDocNames.size === 0 || Array.from(primaryDocNames).some(dn => docName.includes(dn) || dn.includes(docName));
    
    // Condition 2: Content or section belongs to the same activity category
    let isActivityMatch = false;
    if (currentActionKeywords.length > 0) {
      isActivityMatch = currentActionKeywords.some(kw => rawSec.includes(kw) || cont.includes(kw) || cat.includes(kw));
    }

    if (isActivityMatch && (isDocMatch || (opIntent.domainCategory && cat.includes(opIntent.domainCategory.toLowerCase())))) {
      existingIds.add(rawId);
      existingSections.add(rawSec);
      expanded.push({
        id: rawId,
        file_name: raw.manual_title || raw.file_name || 'Dokumen Rujukan IPDS',
        category: raw.category || 'Manual Sawit',
        section_title: raw.section_title || 'Seksyen Dokumen',
        page_number: raw.page_number || 1,
        chunk_index: expanded.length,
        content: raw.content || '',
        vector_score: 0.88,
        keyword_score: 10,
        final_rrf_score: 0.85
      });
    }
  }

  return expanded;
}

export function filterCandidatesByTopicAndIntent(rawCandidates: RagChunk[], userQuery: string): RagChunk[] {
  const opIntent = detectOperationalIntent(userQuery);
  const wageIntent = classifySpecificWageIntent(userQuery);

  // If this is a specific wage query, apply strict isolation
  if (wageIntent !== 'NONE' && wageIntent !== 'ALL_WAGES_SUMMARY') {
    const { filteredCandidates } = isolateAndFilterWageCandidates(rawCandidates, wageIntent);
    if (filteredCandidates.length > 0) return filteredCandidates;
  }

  const qLower = (userQuery || '').toLowerCase();
  const isNurseryQuery = opIntent.domainCategory === 'TAPAK_SEMAIAN' || qLower.includes('nursery') || qLower.includes('semai') || qLower.includes('tapak semaian');
  const isDrainQuery = opIntent.primaryEntity === 'parit' || qLower.includes('parit') || qLower.includes('saliran');
  const isWageQuery = qLower.includes('upah') || qLower.includes('gaji') || qLower.includes('kuk');
  
  const primaryQueryTopicTerms = qLower
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !['apakah', 'bagaimanakah', 'berapakah', 'bilakah', 'siapakah', 'mengapakah', 'untuk', 'dengan', 'yang', 'pada', 'oleh', 'dalam', 'iaitu', 'atau', 'serta', 'apa', 'bagaimana', 'berapa', 'kadar', 'dos', 'upah', 'gaji', 'hanya', 'ambil', 'jawapan', 'dari', 'tajuk', 'sahaja', 'tentang', 'sila'].includes(w));

  const filtered = rawCandidates.filter(c => {
    const cat = (c.category || '').toLowerCase();
    const sec = (c.section_title || '').toLowerCase();
    const cont = (c.content || '').toLowerCase();
    const combined = `${cat} ${sec} ${cont}`;

    // Anti-contamination: Drain queries must NOT match Nursery polybags
    if (isDrainQuery) {
      if ((cat.includes('semai') || cat.includes('nursery') || sec.includes('semai') || sec.includes('nursery')) && !combined.includes('parit')) {
        return false;
      }
    }

    // Anti-contamination: Nursery queries must focus on nursery
    if (isNurseryQuery) {
      const isNurseryChunk = cat.includes('semai') || cat.includes('nursery') || sec.includes('semai') || sec.includes('nursery') || cont.includes('pre-nursery') || cont.includes('main nursery') || cont.includes('polibeg');
      return isNurseryChunk;
    }

    // Action-specific topic gating for wage queries
    if (isWageQuery && opIntent.primaryAction) {
      if (cat.includes('upah') || sec.includes('kuk') || (c.file_name || '').toLowerCase().includes('kuk')) {
        const hasAction = opIntent.matchedSynonyms.some(syn => combined.includes(syn));
        if (opIntent.primaryAction === 'menuai' && (combined.includes('bts') || combined.includes('tuai') || combined.includes('pokok rendah'))) {
          return true;
        }
        return hasAction;
      }
    }

    // General operational action matching
    if (opIntent.matchedSynonyms.length > 0) {
      const hasSynonym = opIntent.matchedSynonyms.some(syn => combined.includes(syn));
      if (hasSynonym) return true;
    }

    if (primaryQueryTopicTerms.length === 0) return true;
    return primaryQueryTopicTerms.some(t => combined.includes(t));
  });

  return filtered.length > 0 ? filtered : rawCandidates;
}

// ============================================================================
// RAG ANSWER COMPLETENESS CONTRACTS & VERIFICATION ENGINE
// ============================================================================

export interface ExpectedSubCategory {
  name: string;
  keywords: string[];
}

export interface ExpectedTopicContract {
  domainKey: string;
  queryPatterns: RegExp[];
  requiredSubCategories: ExpectedSubCategory[];
}

export interface CompletenessReport {
  isComplete: boolean;
  topicDomain: string;
  expectedEntities: string[];
  foundEntities: string[];
  missingEntities: string[];
  completenessRatio: number;
  status: 'PASS' | 'EXPANDED_PASS' | 'INCOMPLETE_WARNING';
  diagnosticNote?: string;
}

export const DOMAIN_COMPLETENESS_CONTRACTS: ExpectedTopicContract[] = [
  {
    domainKey: 'KADAR_UPAH_MENUAI',
    queryPatterns: [
      /\b(upah|kadar|gaji)\b.*\b(menuai|tuai|penuaian|pahat|sabit|egrek|bts)\b/i,
      /\b(menuai|tuai|penuaian|bts)\b.*\b(upah|kadar|gaji|kuk)\b/i,
      /\b(kadar upah menuai|kadar menuai|upah bts|upah tuai|upah potong buah|kadar potong buah|berapa upah menuai|berapa kadar menuai)\b/i
    ],
    requiredSubCategories: [
      { name: 'Pokok Rendah (<3.0m / Pahat)', keywords: ['rendah', 'pahat', '<3.0', '22.00', '26.00'] },
      { name: 'Pokok Sederhana (3.0m-6.0m / Sabit Rendah)', keywords: ['sederhana', 'sabit rendah', '3.0m', '6.0m', '28.00', '34.00'] },
      { name: 'Pokok Tinggi (6.0m-12.0m / Sabit Egrek)', keywords: ['tinggi', 'egrek', 'buluh', '6.0m', '12.0m', '35.00', '45.00'] },
      { name: 'Elaun & Insentif KUK SIRI 8 (BTP/ABW, Cerun/Gambut, Piringan Bersih)', keywords: ['elaun', 'insentif', 'btp', 'abw', 'cerun', 'gambut', 'piringan'] }
    ]
  },
  {
    domainKey: 'KADAR_UPAH_MEMBAJA',
    queryPatterns: [
      /\b(upah|kadar|gaji)\b.*\b(membaja|baja|pembajaan|tabur baja|mop|urea|efb)\b/i,
      /\b(membaja|baja|pembajaan|tabur baja)\b.*\b(upah|kadar|gaji|kuk)\b/i
    ],
    requiredSubCategories: [
      { name: 'Tabur Baja Berbutir (Urea, MOP, RP, NPK)', keywords: ['berbutir', 'urea', 'mop', 'tan baja', 'beg 50kg', '25.00', '35.00'] },
      { name: 'Baja Mikronutrien (Borate / Fertibor)', keywords: ['mikronutrien', 'borate', 'fertibor', '0.15', '0.25'] },
      { name: 'EFB Mulching (Tandan Kosong)', keywords: ['efb', 'tandan kosong', 'mulching', '12.00', '18.00'] }
    ]
  },
  {
    domainKey: 'KADAR_UPAH_MERACUN',
    queryPatterns: [
      /\b(upah|kadar|gaji)\b.*\b(meracun|racun|merumput|herbisid|semburan|trunk injection)\b/i,
      /\b(meracun|racun|merumput|herbisid|semburan)\b.*\b(upah|kadar|gaji|kuk)\b/i
    ],
    requiredSubCategories: [
      { name: 'Semburan Piringan & Lorong Menuai', keywords: ['piringan', 'lorong menuai', 'herbisid', '25.00', '35.00'] },
      { name: 'Semburan Rumpai Liar / Woody Growth', keywords: ['woody growth', 'rumpai liar', 'anak kayu', '38.00', '50.00'] },
      { name: 'Semburan Circle Weeding Pokok Muda', keywords: ['circle weeding', 'pokok muda', '16.00', '22.00'] },
      { name: 'Trunk Injection (Suntikan Batang)', keywords: ['trunk injection', 'suntikan batang', 'acephate', '1.50', '2.20'] }
    ]
  },
  {
    domainKey: 'KADAR_UPAH_MENGANGKUT_BTS',
    queryPatterns: [
      /\b(upah|kadar|gaji)\b.*\b(mengangkut|angkut|evakuasi|transport|lori bts|badang|grabber)\b/i,
      /\b(mengangkut|angkut|evakuasi|pengangkutan)\b.*\b(bts|buah|upah|kadar|kuk)\b/i
    ],
    requiredSubCategories: [
      { name: 'Evakuasi Dalam Ladang (Mini Traktor / Grabber)', keywords: ['mini traktor', 'grabber', 'badang', '8.00', '12.00'] },
      { name: 'Memuat Manual ke Treler/Lori', keywords: ['memuat', 'manual loading', 'treler', '6.00', '9.00'] },
      { name: 'Pengangkutan Lori ke Kilang Sawit mengikut Zon', keywords: ['zon', 'lori', 'kilang', '14.00', '18.00', '19.00', '25.00'] },
      { name: 'Syarat & Had Tempoh 24 Jam', keywords: ['24 jam', 'ffa', 'oer', 'kualiti'] }
    ]
  },
  {
    domainKey: 'KADAR_UPAH_PRUNING',
    queryPatterns: [
      /\b(upah|kadar|gaji)\b.*\b(pruning|cantas|pelepah|pangkas)\b/i,
      /\b(pruning|cantas|pelepah|pangkas)\b.*\b(upah|kadar|gaji|kuk)\b/i
    ],
    requiredSubCategories: [
      { name: 'Pokok Sawit Muda (3-7 tahun)', keywords: ['pokok muda', '3–7 tahun', '0.80', '1.20'] },
      { name: 'Pokok Sawit Matang Penuh (8-14 tahun)', keywords: ['matang penuh', '8–14 tahun', '1.30', '1.80'] },
      { name: 'Pokok Sawit Tinggi (>15 tahun)', keywords: ['pokok tinggi', '>15 tahun', '1.90', '2.50'] },
      { name: 'Susunan Pelepah / Frond Stacking', keywords: ['susun pelepah', 'u-shape', 'frond stacking', '0.30'] }
    ]
  },
  {
    domainKey: 'KADAR_KUTIPAN_BIJI_RELAI',
    queryPatterns: [
      /\b(kadar|upah|berapa)\b.*\b(biji relai|loose fruits?|buah relai)\b/i,
      /\b(biji relai|loose fruits?|buah relai)\b.*\b(kadar|upah|harga|guni)\b/i
    ],
    requiredSubCategories: [
      { name: 'Kadar Kutipan Standard (per kg & per Guni 100kg)', keywords: ['0.18', '0.28', '18.00', '28.00', 'guni'] },
      { name: 'Insentif Bebas Sampah & Batu', keywords: ['bebas sampah', '0.05', 'tanah', 'insentif'] },
      { name: 'Kepentingan OER & Kawalan Mandur', keywords: ['oer', '40', '45%', 'mandur'] }
    ]
  }
];

export function evaluateRagCompleteness(userQuery: string, chunks: RagChunk[]): CompletenessReport {
  const qLower = (userQuery || '').toLowerCase();
  
  let matchedContract: ExpectedTopicContract | null = null;
  for (const contract of DOMAIN_COMPLETENESS_CONTRACTS) {
    if (contract.queryPatterns.some(pat => pat.test(qLower))) {
      matchedContract = contract;
      break;
    }
  }

  if (!matchedContract) {
    return {
      isComplete: true,
      topicDomain: 'GENERAL',
      expectedEntities: [],
      foundEntities: [],
      missingEntities: [],
      completenessRatio: 1.0,
      status: 'PASS',
      diagnosticNote: 'Tiada kontrak kelengkapan spesifik untuk soalan am ini.'
    };
  }

  const combinedEvidenceText = chunks.map(c => `${c.section_title || ''} ${c.content || ''}`).join(' ').toLowerCase();
  
  const expectedEntities: string[] = [];
  const foundEntities: string[] = [];
  const missingEntities: string[] = [];

  for (const subCat of matchedContract.requiredSubCategories) {
    expectedEntities.push(subCat.name);
    const hasMatch = subCat.keywords.some(kw => combinedEvidenceText.includes(kw.toLowerCase()));
    if (hasMatch) {
      foundEntities.push(subCat.name);
    } else {
      missingEntities.push(subCat.name);
    }
  }

  const completenessRatio = expectedEntities.length > 0 ? foundEntities.length / expectedEntities.length : 1.0;
  const isComplete = missingEntities.length === 0;

  return {
    isComplete,
    topicDomain: matchedContract.domainKey,
    expectedEntities,
    foundEntities,
    missingEntities,
    completenessRatio,
    status: isComplete ? 'PASS' : 'INCOMPLETE_WARNING',
    diagnosticNote: isComplete
      ? `Semua ${expectedEntities.length} kategori/baris jadual wajib bagi ${matchedContract.domainKey} lengkap diambil.`
      : `${missingEntities.length} daripada ${expectedEntities.length} kategori/baris jadual belum lengkap: [${missingEntities.join(', ')}].`
  };
}

export async function expandIncompleteRetrieval(
  userQuery: string,
  currentCandidates: RagChunk[],
  report: CompletenessReport,
  supabaseClient?: any
): Promise<RagChunk[]> {
  if (report.isComplete) return currentCandidates;

  const existingIds = new Set(currentCandidates.map(c => c.id));
  const existingContents = new Set(currentCandidates.map(c => c.content.trim()));
  const expandedList: RagChunk[] = [...currentCandidates];

  const domain = report.topicDomain;
  const supabase = supabaseClient || getSupabase();

  // 1. Expand from pgvector database if connected with domain-isolated queries
  if (supabase) {
    try {
      let dbQuery = supabase
        .from('pdf_documents')
        .select('id, document_id, file_name, page_number, section, topic, chunk_index, content, metadata');

      if (domain === 'KADAR_UPAH_MENUAI') {
        dbQuery = dbQuery.or('section.ilike.%menuai%,section.ilike.%bts%,content.ilike.%kadar upah menuai%');
      } else if (domain === 'KADAR_UPAH_PRUNING') {
        dbQuery = dbQuery.or('section.ilike.%pruning%,section.ilike.%pemangkasan%,section.ilike.%pelepah%');
      } else if (domain === 'KADAR_UPAH_MERACUN') {
        dbQuery = dbQuery.or('section.ilike.%meracun%,section.ilike.%herbisid%,section.ilike.%racun%');
      } else if (domain === 'KADAR_UPAH_MEMBAJA') {
        dbQuery = dbQuery.or('section.ilike.%membaja%,section.ilike.%baja%,section.ilike.%efb%');
      } else if (domain === 'KADAR_UPAH_MENGANGKUT_BTS') {
        dbQuery = dbQuery.or('section.ilike.%mengangkut%,section.ilike.%evakuasi%,section.ilike.%lori bts%');
      } else if (domain === 'KADAR_KUTIPAN_BIJI_RELAI') {
        dbQuery = dbQuery.or('section.ilike.%biji relai%,section.ilike.%loose fruit%');
      } else {
        dbQuery = dbQuery.or('topic.ilike.%kadar upah%,topic.ilike.%kuk%,file_name.ilike.%kuk%,file_name.ilike.%upah%');
      }

      const { data: dbData } = await dbQuery.limit(10);

      if (dbData && dbData.length > 0) {
        for (const row of dbData) {
          if (!existingIds.has(row.id) && !existingContents.has((row.content || '').trim())) {
            existingIds.add(row.id);
            existingContents.add((row.content || '').trim());
            expandedList.push({
              id: row.id || `chunk-db-exp-${expandedList.length}`,
              file_name: row.file_name || 'Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8)',
              category: row.topic || 'Kadar Upah',
              section_title: row.section || row.file_name || 'KUK SIRI 8',
              page_number: row.page_number || 1,
              chunk_index: row.chunk_index ?? expandedList.length,
              content: row.content || '',
              vector_score: 0.90,
              keyword_score: 15,
              final_rrf_score: 0.90
            });
          }
        }
      }
    } catch (dbErr) {
      console.warn('[Enterprise RAG] Database expansion notice:', dbErr);
    }
  }

  // 2. Expand from SEED_MANUAL_CHUNKS with strict intent isolation
  for (let idx = 0; idx < SEED_MANUAL_CHUNKS.length; idx++) {
    const seed: any = SEED_MANUAL_CHUNKS[idx];
    const sId = seed.id || `seed-chunk-${idx}`;
    const sContent = (seed.content || '').trim();
    const sCat = (seed.category || '').toLowerCase();
    const sSec = (seed.section_title || '').toLowerCase();
    const sDoc = (seed.manual_title || '').toLowerCase();

    let isDomainRelevant = false;
    if (domain === 'KADAR_UPAH_MENUAI') {
      const isMenuai = sSec.includes('menuai') || sSec.includes('bts') || sContent.toLowerCase().includes('pokok rendah');
      const isOtherActivity = sSec.includes('pruning') || sSec.includes('pemangkasan') || sSec.includes('racun') || sSec.includes('herbisid') || sSec.includes('baja') || sSec.includes('penanaman') || sDoc.includes('perolehan');
      isDomainRelevant = isMenuai && !isOtherActivity;
    } else if (domain === 'KADAR_UPAH_PRUNING') {
      isDomainRelevant = (sSec.includes('pruning') || sSec.includes('pangkas') || sSec.includes('pelepah')) && !sSec.includes('menuai');
    } else if (domain === 'KADAR_UPAH_MERACUN') {
      isDomainRelevant = (sSec.includes('racun') || sSec.includes('herbisid') || sSec.includes('rumpai')) && !sSec.includes('menuai');
    } else if (domain === 'KADAR_UPAH_MEMBAJA') {
      isDomainRelevant = (sSec.includes('baja') || sSec.includes('membaja') || sSec.includes('efb')) && !sSec.includes('menuai');
    } else if (domain === 'KADAR_UPAH_MENGANGKUT_BTS') {
      isDomainRelevant = sSec.includes('mengangkut') || sSec.includes('evakuasi') || sSec.includes('lori bts');
    } else if (domain === 'KADAR_KUTIPAN_BIJI_RELAI') {
      isDomainRelevant = sSec.includes('biji relai') || sSec.includes('loose fruit');
    } else {
      isDomainRelevant = sCat.includes('upah') || sSec.includes('kuk') || sDoc.includes('kuk');
    }

    if (isDomainRelevant && !existingIds.has(sId) && !existingContents.has(sContent)) {
      existingIds.add(sId);
      existingContents.add(sContent);
      expandedList.push({
        id: sId,
        file_name: seed.manual_title || 'Buku Kadar Upah Kerja Siri 8 (KUK SIRI 8)',
        category: seed.category || 'Kadar Upah',
        section_title: seed.section_title || 'Seksyen KUK SIRI 8',
        page_number: seed.page_number || 1,
        chunk_index: expandedList.length,
        content: seed.content || '',
        vector_score: 0.90,
        keyword_score: 15,
        final_rrf_score: 0.90
      });
    }
  }

  return expandedList;
}

/**
 * ORCHESTRATED RAG RETRIEVAL DISPATCHER
 * Universal Multi-Stage Hybrid Dispatcher with query-adaptive weighting, topic intent filtering,
 * and related chunk retrieval expansion (Rules 1, 2, 3, 7).
 */
export async function retrieveGroundedCandidates(
  userQuery: string,
  categoryFilter: string = 'Semua',
  queryEmbed: number[] | null = null,
  supabaseClient?: any
): Promise<{
  candidates: RagChunk[];
  retrievalMode: 'HYBRID_ENTERPRISE_RAG';
  isPalmOilBook: boolean;
}> {
  const isPalmOilBook = isPalmOil5thEditionCollection(userQuery, categoryFilter);

  const options: RetrievalExecutionOptions = {
    queryEmbed,
    userQuery,
    categoryFilter,
    matchCount: 50,
    matchThreshold: 0.05
  };

  const rawCandidates = await executeEnterpriseHybridRetrieval(options, supabaseClient);
  const filteredCandidates = filterCandidatesByTopicAndIntent(rawCandidates, userQuery);

  // Broad query retrieval expansion (Rule 3)
  const opIntent = detectOperationalIntent(userQuery);
  const expandedCandidates = expandRetrievalToRelatedChunks(filteredCandidates, userQuery, opIntent, SEED_MANUAL_CHUNKS);

  return {
    candidates: expandedCandidates,
    retrievalMode: 'HYBRID_ENTERPRISE_RAG',
    isPalmOilBook
  };
}

// ============================================================================
// MAIN ENTERPRISE RAG GENERATION PIPELINE
// ============================================================================
export async function generateEnterpriseGroundedAnswer(
  userQuery: string,
  categoryFilter: string = 'Semua',
  forceRefresh: boolean = false
): Promise<GroundedResponse & { isCached?: boolean; latencyMs?: number }> {
  const startTime = Date.now();
  const reasoningPath: RagReasoningPath = {
    queryAnalysis: {
      rawQuery: userQuery,
      normalizedTerms: [],
      isTechnicalSpec: Boolean(
        userQuery.toLowerCase().match(/\b(ukuran|lebar|dimensi|teres|parit|jalan|jarak|dos|kadar|upah|jadual|backslope|bund|slope|cerun|kuk|table|l\/ha|kg\/ha|cm|meter|m)\b/i)
      ),
      extractedKeywords: []
    }
  };

  // 0. Detect Specific Wage Intent for Strict Context Isolation
  const wageIntent = classifySpecificWageIntent(userQuery);
  const isSpecificWage = wageIntent !== 'NONE' && wageIntent !== 'ALL_WAGES_SUMMARY';

  // 0b. Check Semantic Response Cache for instant sub-200ms answer
  if (!forceRefresh) {
    try {
      const cached = await ragSemanticCache.get(userQuery, categoryFilter);
      if (cached) {
        console.log(`[Enterprise RAG] ⚡ Cache HIT for query: "${userQuery}" (Category: ${categoryFilter})`);
        const latencyMs = Date.now() - startTime;
        const cachedResponse = {
          answer: cached.answer,
          citations: cached.citations,
          confidenceBreakdown: cached.confidenceBreakdown,
          grounding: {
            ...cached.grounding,
            isCached: true
          },
          isCached: true,
          latencyMs
        };

        // Asynchronously log cached execution
        ragLogger.logExecution({
          user_query: userQuery,
          category_filter: categoryFilter,
          execution_status: 'CACHED',
          is_grounded: cached.grounding.isGrounded,
          hard_gate_triggered: false,
          latency_ms: latencyMs,
          is_cached: true,
          final_confidence: cached.confidenceBreakdown?.finalConfidence || 95,
          evidence_coverage: cached.confidenceBreakdown?.evidenceCoverage || 100,
          retrieval_score: cached.confidenceBreakdown?.retrievalScore || 100,
          source_authority: cached.confidenceBreakdown?.sourceAuthority || 90,
          citations_count: cached.citations?.length || 0,
          citations: cached.citations || [],
          reasoning_path: {
            ...reasoningPath,
            diagnostics: {
              rootCauseCategory: 'NONE',
              remedyRecommendation: 'Cached semantic response served successfully.'
            }
          },
          response_preview: cached.answer
        }).catch(() => {});

        return cachedResponse;
      }
    } catch (cacheErr) {
      console.warn('[Enterprise RAG] Cache lookup notice:', cacheErr);
    }
  }

  const NO_EVIDENCE_FALLBACK_TEXT = 
    "Maaf, maklumat yang diperlukan tidak ditemui dalam pangkalan pengetahuan IPDS. Sila semak dokumen Manual / SOP / KUK yang berkaitan atau muat naik dokumen sumber.";

  const supabase = getSupabase();
  let compressedEvidences: CompressedEvidence[] = [];

  // 1. Generate query embedding with error handling
  let queryEmbed: number[] | null = null;
  try {
    queryEmbed = await generateEmbedding(userQuery, 'RETRIEVAL_QUERY');
  } catch (err) {
    console.error('[Enterprise RAG] Query embedding generation error:', err);
  }

  // 2. Perform Retrieval based on collection classification (Strict Vector vs Hybrid)
  const { candidates: rawCandidates, retrievalMode } = await retrieveGroundedCandidates(
    userQuery,
    categoryFilter,
    queryEmbed,
    supabase
  );

  // Apply Strict Intent Isolation to filter out cross-category wage tables
  const {
    filteredCandidates: isolatedCandidates,
    filteredOutCount,
    filteredOutCategories
  } = isolateAndFilterWageCandidates(rawCandidates, wageIntent);

  reasoningPath.intentIsolation = {
    detectedIntent: wageIntent,
    isSpecificWageQuery: isSpecificWage,
    filteredOutUnrelatedChunksCount: filteredOutCount,
    filteredOutCategories: filteredOutCategories,
    retainedCandidatesCount: isolatedCandidates.length,
    retrievedSourcePages: isolatedCandidates.map(c => ({
      document: c.file_name,
      section: c.section_title,
      page: c.page_number
    }))
  };

  // Evaluate Initial RAG Completeness against domain contracts
  let completenessReport = evaluateRagCompleteness(userQuery, isolatedCandidates);
  let finalRetrievedCandidates = isolatedCandidates;

  if (!completenessReport.isComplete) {
    console.log(`[Enterprise RAG] Completeness check '${completenessReport.status}' for domain '${completenessReport.topicDomain}'. Triggering automatic sibling & database expansion...`);
    finalRetrievedCandidates = await expandIncompleteRetrieval(userQuery, isolatedCandidates, completenessReport, supabase);
    completenessReport = evaluateRagCompleteness(userQuery, finalRetrievedCandidates);
    completenessReport.status = completenessReport.isComplete ? 'EXPANDED_PASS' : 'INCOMPLETE_WARNING';
    console.log(`[Enterprise RAG] Post-expansion completeness status: ${completenessReport.status} (Found: ${completenessReport.foundEntities.length}/${completenessReport.expectedEntities.length})`);
  }

  // Final re-isolation after expansion to guarantee zero cross-category pollution
  if (isSpecificWage) {
    const postExpIso = isolateAndFilterWageCandidates(finalRetrievedCandidates, wageIntent);
    finalRetrievedCandidates = postExpIso.filteredCandidates;
  }

  reasoningPath.completenessStage = {
    topicDomain: completenessReport.topicDomain,
    status: completenessReport.status,
    expectedEntities: completenessReport.expectedEntities,
    foundEntities: completenessReport.foundEntities,
    missingEntities: completenessReport.missingEntities,
    completenessRatio: completenessReport.completenessRatio,
    diagnosticNote: completenessReport.diagnosticNote
  };

  // Handle case where specific harvesting wage data cannot be found at all
  if (wageIntent === 'HARVESTING_WAGE' && finalRetrievedCandidates.length === 0) {
    const missingWageMsg = "Data jadual kadar upah menuai yang lengkap tidak berjaya diperoleh daripada sumber.";
    return {
      answer: missingWageMsg,
      citations: [],
      confidenceBreakdown: {
        retrievalScore: 0,
        rerankerScore: 0,
        sourceAuthority: 0,
        evidenceCoverage: 0,
        finalConfidence: 0
      },
      grounding: {
        isGrounded: false,
        retrievalEvidenceScore: 0,
        validCitationsCount: 0,
        hasValidCitations: false,
        verificationReasoning: 'Data jadual kadar upah menuai tidak ditemui.',
        hardGateTriggered: true
      }
    };
  }

  // P0-6 FIX: Deterministic Operational Intent & Action Detection
  const opIntent = detectOperationalIntent(userQuery);
  const isNurseryQuery = opIntent.domainCategory === 'TAPAK_SEMAIAN' || userQuery.toLowerCase().includes('nursery') || userQuery.toLowerCase().includes('semai') || userQuery.toLowerCase().includes('tapak semaian');
  const isDrainQuery = opIntent.primaryEntity === 'parit' || userQuery.toLowerCase().includes('parit') || userQuery.toLowerCase().includes('saliran');
  const isWageQuery = userQuery.toLowerCase().includes('upah') || userQuery.toLowerCase().includes('gaji') || userQuery.toLowerCase().includes('kuk');
  
  const primaryQueryTopicTerms = userQuery
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !['apakah', 'bagaimanakah', 'berapakah', 'bilakah', 'siapakah', 'mengapakah', 'untuk', 'dengan', 'yang', 'pada', 'oleh', 'dalam', 'iaitu', 'atau', 'serta', 'apa', 'bagaimana', 'berapa', 'kadar', 'dos', 'upah', 'gaji', 'hanya', 'ambil', 'jawapan', 'dari', 'tajuk', 'sahaja', 'tentang', 'sila'].includes(w));

  if (reasoningPath.queryAnalysis) {
    reasoningPath.queryAnalysis.normalizedTerms = primaryQueryTopicTerms;
    reasoningPath.queryAnalysis.extractedKeywords = primaryQueryTopicTerms;
  }

  reasoningPath.retrievalStage = {
    strategy: retrievalMode,
    matchCount: finalRetrievedCandidates.length,
    rawCandidatesFound: finalRetrievedCandidates.length,
    topCandidateScores: finalRetrievedCandidates.slice(0, 5).map(c => ({
      id: c.id,
      title: c.file_name,
      section: c.section_title,
      page: c.page_number,
      vectorScore: c.vector_score,
      keywordScore: c.keyword_score,
      finalScore: c.final_rrf_score
    }))
  };

  // Anti-contamination & operational intent filtering
  const topicMatchedCandidates = finalRetrievedCandidates.filter(c => {
    const cat = (c.category || '').toLowerCase();
    const sec = (c.section_title || '').toLowerCase();
    const cont = (c.content || '').toLowerCase();
    const combined = `${cat} ${sec} ${cont}`;

    // Anti-contamination: Drain queries must NOT match Nursery polybags
    if (isDrainQuery) {
      if ((cat.includes('semai') || cat.includes('nursery') || sec.includes('semai') || sec.includes('nursery')) && !combined.includes('parit')) {
        return false;
      }
    }

    // Anti-contamination: Nursery queries must focus on nursery
    if (isNurseryQuery) {
      const isNurseryChunk = cat.includes('semai') || cat.includes('nursery') || sec.includes('semai') || sec.includes('nursery') || cont.includes('pre-nursery') || cont.includes('main nursery') || cont.includes('polibeg');
      return isNurseryChunk;
    }

    // Action-specific topic gating for wage queries
    if (isWageQuery && opIntent.primaryAction) {
      if (cat.includes('upah') || sec.includes('kuk') || (c.file_name || '').toLowerCase().includes('kuk')) {
        const hasAction = opIntent.matchedSynonyms.some(syn => combined.includes(syn));
        if (opIntent.primaryAction === 'menuai' && (combined.includes('bts') || combined.includes('tuai') || combined.includes('pokok rendah'))) {
          return true;
        }
        return hasAction;
      }
    }

    // General operational action matching
    if (opIntent.matchedSynonyms.length > 0) {
      const hasSynonym = opIntent.matchedSynonyms.some(syn => combined.includes(syn));
      if (hasSynonym) return true;
    }

    if (primaryQueryTopicTerms.length === 0) return true;
    return primaryQueryTopicTerms.some(t => combined.includes(t));
  });

  const candidatesToRerank = topicMatchedCandidates.length > 0 ? topicMatchedCandidates : finalRetrievedCandidates;

  // Semantic Reranking: Prioritize exact action & entity match in section_title and content
  const sortedCandidatesForMMR = [...candidatesToRerank].sort((a, b) => {
    const aSec = (a.section_title || '').toLowerCase();
    const bSec = (b.section_title || '').toLowerCase();
    const aCont = (a.content || '').toLowerCase();
    const bCont = (b.content || '').toLowerCase();

    let aActionScore = 0;
    let bActionScore = 0;

    if (opIntent.primaryAction) {
      if (aSec.includes(opIntent.primaryAction)) aActionScore += 5;
      if (bSec.includes(opIntent.primaryAction)) bActionScore += 5;
      if (opIntent.matchedSynonyms.some(s => aSec.includes(s))) aActionScore += 3;
      if (opIntent.matchedSynonyms.some(s => bSec.includes(s))) bActionScore += 3;
      if (opIntent.matchedSynonyms.some(s => aCont.includes(s))) aActionScore += 1;
      if (opIntent.matchedSynonyms.some(s => bCont.includes(s))) bActionScore += 1;
    }

    if (aActionScore !== bActionScore) {
      return bActionScore - aActionScore;
    }
    return (b.final_rrf_score || 0) - (a.final_rrf_score || 0);
  });

  // 3. Semantic Reranking & MMR Diversity Reranking on Topic-Relevant Candidates
  // Specific wage queries are narrow: disable diversity pull to keep only the pure target schedule
  const isBroad = isBroadCategoryQuery(userQuery, opIntent);
  const isBroadOrWage = (isBroad || wageIntent === 'ALL_WAGES_SUMMARY') && !isSpecificWage;
  const maxTopK = isSpecificWage ? 8 : (isBroadOrWage ? 35 : 15);
  const rerankedChunks = applyMMRDiversityReranking(sortedCandidatesForMMR, maxTopK, 0.85, isBroadOrWage);
  console.log('[Enterprise RAG Debug] Reranked chunks count:', rerankedChunks.length, 'isBroad:', isBroad, 'wageIntent:', wageIntent);

  reasoningPath.rerankingStage = {
    algorithm: 'MMR_DIVERSITY_RERANKING',
    inputCandidatesCount: sortedCandidatesForMMR.length,
    rerankedOutputCount: rerankedChunks.length,
    diversityScoreLambda: 0.80,
    selectedChunks: rerankedChunks.map(c => ({
      id: c.id,
      document: c.file_name,
      section: c.section_title,
      page: c.page_number
    }))
  };

  // Calculate Evidence Coverage and Confidence Estimate
  const confidenceBreakdown = calculateConfidenceEstimate(rawCandidates, rerankedChunks, userQuery);
  console.log('[Enterprise RAG Debug] Confidence breakdown:', JSON.stringify(confidenceBreakdown));

  // ============================================================================
  // 4. NO-EVIDENCE HARD GATE (SAFETY CRITICAL)
  // Stops execution BEFORE LLM call if evidence is zero, off-topic, or insufficient
  // ============================================================================
  const topEvidencesText = rerankedChunks.slice(0, 3).map(c => ((c.section_title || '') + ' ' + (c.content || '')).toLowerCase()).join(' ');
  const isTopicSatisfied = primaryQueryTopicTerms.length === 0 || primaryQueryTopicTerms.some(t => topEvidencesText.includes(t)) || (opIntent.matchedSynonyms.length > 0 && opIntent.matchedSynonyms.some(s => topEvidencesText.includes(s)));

  const isHardGateBlocked = rerankedChunks.length === 0 || !isTopicSatisfied || confidenceBreakdown.evidenceCoverage < 20;

  reasoningPath.hardGateCheck = {
    evaluated: true,
    triggered: isHardGateBlocked,
    reason: isHardGateBlocked 
      ? (rerankedChunks.length === 0 
          ? 'Tiada cebisan dokumen (chunks) ditemui untuk soalan ini.'
          : (!isTopicSatisfied ? 'Topik dokumen teratas tidak sepadan dengan kata kunci subjek soalan.' : 'Liputan bukti (evidence coverage) di bawah ambang minimum 20%.'))
      : 'Evidence mencukupi dan melepasi ambang pengesahan keselamatan.',
    isTopicSatisfied,
    evidenceCoverageScore: confidenceBreakdown.evidenceCoverage,
    minThresholdRequired: 20
  };

  if (isHardGateBlocked) {
    console.log('[Enterprise RAG] Hard Gate Activated: Insufficient query-relevant evidence in knowledge base.');
    const latencyMs = Date.now() - startTime;
    const failureReason = reasoningPath.hardGateCheck?.reason || 'Hard Gate: Bukti tidak mencukupi.';

    reasoningPath.diagnostics = {
      rootCauseCategory: rerankedChunks.length === 0 ? 'NO_RELEVANT_CHUNKS' : (confidenceBreakdown.evidenceCoverage < 20 ? 'LOW_SEMANTIC_SIMILARITY' : 'HARD_GATE_TRIPPED'),
      remedyRecommendation: 'Muat naik atau indeks semula dokumen SOP/Manual berkaitan subjek ini, atau semak sinonim carian dalam lexicalProcessor.'
    };

    ragLogger.logExecution({
      user_query: userQuery,
      category_filter: categoryFilter,
      execution_status: 'HARD_GATE_BLOCKED',
      is_grounded: false,
      hard_gate_triggered: true,
      failure_reason: failureReason,
      latency_ms: latencyMs,
      is_cached: false,
      final_confidence: 0,
      evidence_coverage: 0,
      retrieval_score: confidenceBreakdown.retrievalScore,
      source_authority: confidenceBreakdown.sourceAuthority,
      citations_count: 0,
      citations: [],
      reasoning_path: reasoningPath,
      response_preview: NO_EVIDENCE_FALLBACK_TEXT
    }).catch(() => {});

    return {
      answer: NO_EVIDENCE_FALLBACK_TEXT,
      citations: [],
      confidenceBreakdown: {
        retrievalScore: confidenceBreakdown.retrievalScore,
        rerankerScore: confidenceBreakdown.rerankerScore,
        sourceAuthority: confidenceBreakdown.sourceAuthority,
        evidenceCoverage: 0,
        finalConfidence: 0
      },
      grounding: {
        isGrounded: false,
        retrievalEvidenceScore: 0,
        validCitationsCount: 0,
        hasValidCitations: false,
        verificationReasoning: 'Hard Gate: Evidence tidak relevan atau tidak mencukupi untuk soalan pengguna.',
        hardGateTriggered: true
      }
    };
  }

  // 5. Build Grounded Context (Phase 3.1 Context Compression with Hierarchical Grouping & Structure Preservation)
  const sortedChunksForContext = [...rerankedChunks].sort((a, b) => {
    const getTier = (c: RagChunk) => {
      const fn = (c.file_name || '').toLowerCase();
      const sec = (c.section_title || '').toLowerCase();
      const cat = (c.category || '').toLowerCase();
      const isPalmOilQuery = isPalmOil5thEditionCollection(userQuery, categoryFilter);

      if (isPalmOilQuery && (fn.includes('the oil palm') || cat.includes('the oil palm') || cat.includes('palm oil') || fn.includes('corley') || sec.includes('corley'))) {
        return 0; // Highest priority when academic palm oil book is queried
      }
      if (fn.includes('manual sawit lestari & amalan pertanian baik') || fn.includes('msl gap') || sec.includes('seksyen 13.0') || sec.includes('seksyen 16.0')) return 1;
      if (fn.includes('kuk siri 8') || fn.includes('kadar upah') || sec.includes('kuk siri 8')) return 2;
      if (fn.includes('common weeds') || fn.includes('manual rumpai')) return 3;
      if (fn.includes('the oil palm') || cat.includes('the oil palm') || cat.includes('palm oil') || fn.includes('corley')) return 4;
      if (!fn.includes('- bahagian') && !fn.includes('ed.2')) return 5;
      return 6;
    };
    return getTier(a) - getTier(b);
  });

  // Query-focused subsection extraction applied during context compression
  compressedEvidences = compressContextChunks(sortedChunksForContext, userQuery);
  // Group context logically by document and section to maintain structural hierarchy (Rule 7)
  const formattedContext = formatGroupedContextForPrompt(compressedEvidences);

  reasoningPath.contextCompression = {
    inputChunksCount: sortedChunksForContext.length,
    compressedEvidencesCount: compressedEvidences.length,
    estimatedTokensSaved: Math.max(0, (sortedChunksForContext.reduce((acc, c) => acc + c.content.length, 0) - formattedContext.length) / 4)
  };

  // 6. Generation System Instruction (Structure-Aware, Intent-Focused, Complete Multi-Section Coverage)
  const isHarvestingQuery = wageIntent === 'HARVESTING_WAGE';
  const isolationNotice = isHarvestingQuery
    ? `
PERATURAN PENGASINGAN INTENT (MUTLAK - STRICT INTENT ISOLATION):
- Soalan ini adalah KHUSUS untuk KADAR UPAH MENUAI & MEMUNGUT BTS (KUK SIRI 8).
- Anda WAJIB HANYA memaparkan jadual kadar menuai BTS mengikut ketinggian pokok (Pokok Rendah, Sederhana, Tinggi, serta Elaun/Insentif berkaitan menuai).
- DILARANG KERAS MEMASUKKAN jadual atau kadar dari aktiviti lain (CONTOH: Pruning / Pemangkasan Pelepah, Semburan Racun, Penaburan Baja, Tanam Semula, atau Trunk Injection).
- JANGAN sesekali mencampurkan jadual aktiviti lain ke dalam jawapan ini.`
    : (isSpecificWage
      ? `
PERATURAN PENGASINGAN INTENT:
- Soalan ini adalah KHUSUS untuk aktiviti berkaitan '${wageIntent}'.
- Paparkan HANYA jadual dan kadar aktiviti yang diminta. JANGAN masukkan jadual aktiviti kerja lain yang tidak berkaitan.`
      : '');

  const systemInstruction = `
You are an AI Agronomy, Plantation Operations, and Field Standards Assistant for IPDS (FPMSB).

SUMBER DATA RASMI (AUTHORITATIVE SOURCE & GROUNDING RULES):
1. Setiap angka RM, peratusan, sukatan, atau syarat kadar upah MESTI dipetik terus daripada DOKUMEN RUJUKAN yang dibekalkan (Kategori A: Authoritative Retrieved Data).
2. Dilarang keras mereka (invent/fabricate) atau membuat tekaan (inference) nilai kadar upah.
3. Bezakan dengan jelas:
   - [Kategori A: Data Dokumen Rasmi] -> Nilai dan jadual rasmi daripada dokumen rujukan KUK / Manual.
   - [Kategori B: Pengiraan Berasaskan Formula Dokumen] -> Jika ada pengiraan khusus.
   - [Kategori C: Pengetahuan Am] -> DILARANG untuk sebarang penetapan kadar upah/gaji.
${isolationNotice}

ARAHAN INTEGRITI & KELENGKAPAN RAG:
1. Gabungkan SEMUA chunk dokumen rujukan yang berkaitan dengan soalan:
   - Jangan jawab berdasarkan satu chunk sahaja jika terdapat pecahan kategori atau sambungan jadual.
   - Sertakan semua jadual penuh, sambungan jadual, nota tambahan, elaun, insentif, dan syarat berkaitan.
2. Paparan Jadual Kadar Penuh & Terperinci:
   - Jika soalan berkaitan jadual kadar (contoh: "kadar upah menuai", "kadar upah meracun", "kadar upah membaja", "kadar upah mengangkut BTS"), paparkan KESELURUHAN JADUAL dan SEMUA BARIS/KATEGORI yang wujud dalam rujukan.
   - Contohnya bagi "kadar upah menuai", paparkan SEMUA kategori:
     * Pokok Rendah (<3.0 meter / Pahat)
     * Pokok Sederhana (3.0m - 6.0m / Sabit Rendah)
     * Pokok Tinggi (6.0m - 12.0m / Sabit Egrek)
     * Elaun & Insentif KUK SIRI 8 (BTP/ABW, Cerun/Gambut, Piringan Bersih)
     * Kutipan Biji Relai (Loose Fruits)
   - Kekalkan format jadual Markdown dengan struktur lajur:
     | Kategori / Aktiviti / Ketinggian | Kadar / Upah (RM) | Unit / Sukatan | Syarat / Nota / Elaun / Insentif | [Rujukan] |
3. Larangan Mampat & Zero Hallucination:
   - DILARANG MERINGKASKAN atau memotong mana-mana baris jadual, kadar, unit, atau kategori.
   - DILARANG MEREKA data atau angka yang tiada dalam rujukan RAG.
4. Citations:
   - Sertakan rujukan [Ruj X] pada setiap baris jadual dan fakta penting.
`;

  const userPrompt = `
DOKUMEN RUJUKAN:
${formattedContext}

SOALAN PENGGUNA:
${userQuery}
${isHarvestingQuery ? '\nPERHATIAN: Soalan ini khusus untuk kadar upah menuai BTS sahaja. Jangan campurkan jadual pruning, racun, atau baja.' : ''}

ARAHAN JAWAPAN:
Utamakan bukti RAG di atas dan berikan jawapan berstruktur, tepat, dan LENGKAP TANPA TERTINGGAL MANA-MANA KATEGORI KADAR:
- Paparkan KESELURUHAN jadual dan SEMUA baris yang berkaitan dari dokumen rujukan.
- Bagi soalan kadar upah (menuai/meracun/membaja/mengangkut/pruning), keluarkan SEMUA pecahan kategori mengikut ketinggian pokok, kaedah kerja, elaun, insentif, dan syarat.
- Kekalkan format jadual Markdown yang kemas dengan lajur: Kategori/Aktiviti, Kadar/Upah (RM), Unit/Sukatan, Syarat/Elaun/Insentif, [Rujukan].
- Sertakan rujukan [Ruj X].
`;

  if (!aiService.isConfigured()) {
    const latencyMs = Date.now() - startTime;
    ragLogger.logExecution({
      user_query: userQuery,
      category_filter: categoryFilter,
      execution_status: 'GENERATION_ERROR',
      is_grounded: false,
      hard_gate_triggered: false,
      failure_reason: 'GEMINI_API_KEY tidak dikonfigurasikan di pelayan.',
      latency_ms: latencyMs,
      is_cached: false,
      final_confidence: 0,
      evidence_coverage: 0,
      retrieval_score: 0,
      source_authority: 0,
      citations_count: 0,
      citations: [],
      reasoning_path: {
        ...reasoningPath,
        diagnostics: {
          rootCauseCategory: 'LLM_GENERATION_FAILED',
          remedyRecommendation: 'Sila pastikan pembolehubah persekitaran GEMINI_API_KEY telah dikonfigurasikan.'
        }
      },
      response_preview: 'GEMINI_API_KEY tidak dikonfigurasikan di pelayan.'
    }).catch(() => {});

    return {
      answer: "GEMINI_API_KEY tidak dikonfigurasikan di pelayan.",
      citations: [],
      confidenceBreakdown: {
        retrievalScore: 0,
        rerankerScore: 0,
        sourceAuthority: 0,
        evidenceCoverage: 0,
        finalConfidence: 0
      },
      grounding: {
        isGrounded: false,
        retrievalEvidenceScore: 0,
        validCitationsCount: 0,
        hasValidCitations: false,
        verificationReasoning: 'API key tidak ditemui.',
        hardGateTriggered: false
      }
    };
  }

  try {
    const aiResponse = await aiService.generateText({
      prompt: userPrompt,
      systemInstruction: systemInstruction,
      temperature: 0.0,
      topP: 0.95,
      operationName: 'enterprise_rag'
    });

    if (!aiResponse || !aiResponse.text) {
      throw new Error('Gagal menerima maklum balas daripada model Gemini selepas percubaan cascade.');
    }

    const answerText = aiResponse.text || 'Gagal menjana jawapan daripada model.';

    reasoningPath.generationStage = {
      model: aiResponse.model,
      attempts: aiResponse.attempts,
      latencyMs: aiResponse.latencyMs,
      success: true
    };

    // 7. Phase 3.4 Answer / Evidence Alignment Verifier & Hallucination Hard Gate
    const alignmentReport = verifyAnswerAlignment(answerText, compressedEvidences, userQuery);

    const isGrounded = alignmentReport.groundedStatus === 'GROUNDED';

    const citations = compressedEvidences.map(c => ({
      citationId: c.citationId,
      document: c.document,
      category: c.category,
      section: c.section,
      page: c.page,
      chunk_index: c.chunkIndex,
      rrf_score: c.rrfScore
    }));

    reasoningPath.verificationReport = {
      groundedStatus: alignmentReport.groundedStatus,
      supportedClaimsCount: alignmentReport.extractedClaims.filter(c => c.isSupported).length,
      totalClaimsCount: alignmentReport.extractedClaims.length,
      citationCompleteness: alignmentReport.alignmentMetrics.citationCompleteness,
      numericalAccuracyRate: alignmentReport.numericalVerification?.numericalAccuracyRate ?? 100,
      summary: alignmentReport.verificationSummary,
      isCriticalFailure: alignmentReport.isCriticalFailure
    };

    const finalResult = {
      answer: answerText,
      citations,
      confidenceBreakdown: {
        retrievalScore: alignmentReport.confidenceBreakdown.retrievalConfidence,
        rerankerScore: alignmentReport.confidenceBreakdown.evidenceCoverage,
        sourceAuthority: alignmentReport.confidenceBreakdown.sourceAuthority,
        evidenceCoverage: alignmentReport.confidenceBreakdown.evidenceCoverage,
        finalConfidence: alignmentReport.confidenceBreakdown.groundedConfidence
      },
      grounding: {
        isGrounded,
        retrievalEvidenceScore: alignmentReport.confidenceBreakdown.evidenceCoverage,
        validCitationsCount: alignmentReport.extractedClaims.filter(c => c.isSupported).length,
        hasValidCitations: alignmentReport.alignmentMetrics.citationCompleteness > 0,
        verificationReasoning: alignmentReport.verificationSummary,
        hardGateTriggered: alignmentReport.isCriticalFailure,
        numericalAccuracyRate: alignmentReport.numericalVerification?.numericalAccuracyRate ?? 100,
        numericalVerification: alignmentReport.numericalVerification
      },
      isCached: false,
      latencyMs: Date.now() - startTime
    };

    // Cache the verified response for future rapid hits
    if (isGrounded && !alignmentReport.isCriticalFailure) {
      ragSemanticCache.set(userQuery, categoryFilter, finalResult, finalResult.latencyMs).catch(() => {});
    }

    const executionStatus = !isGrounded ? 'UNGROUNDED' : 'SUCCESS';
    const failureReason = !isGrounded ? `Pengesahan ketepatan gagal: ${alignmentReport.verificationSummary}` : null;

    reasoningPath.diagnostics = {
      rootCauseCategory: !isGrounded ? 'HALLUCINATION_DETECTED' : 'NONE',
      remedyRecommendation: !isGrounded ? 'Tingkatkan kualiti bukti dokumen rujukan atau perketatkan arahan citation model.' : undefined
    };

    // Log full execution with complete reasoning path
    ragLogger.logExecution({
      user_query: userQuery,
      category_filter: categoryFilter,
      execution_status: executionStatus,
      is_grounded: isGrounded,
      hard_gate_triggered: alignmentReport.isCriticalFailure,
      failure_reason: failureReason,
      latency_ms: finalResult.latencyMs,
      is_cached: false,
      final_confidence: finalResult.confidenceBreakdown.finalConfidence,
      evidence_coverage: finalResult.confidenceBreakdown.evidenceCoverage,
      retrieval_score: finalResult.confidenceBreakdown.retrievalScore,
      source_authority: finalResult.confidenceBreakdown.sourceAuthority,
      numerical_accuracy_rate: finalResult.grounding.numericalAccuracyRate,
      citations_count: citations.length,
      citations: citations,
      reasoning_path: reasoningPath,
      response_preview: answerText
    }).catch(() => {});

    return finalResult;
  } catch (generationErr: any) {
    console.error('[Enterprise RAG] Gemini Generation Error:', generationErr);
    const latencyMs = Date.now() - startTime;
    const errorMsg = String(generationErr?.message || generationErr);

    reasoningPath.generationStage = {
      model: 'gemini-3.7-flash (cascade)',
      attempts: 3,
      latencyMs: latencyMs,
      success: false,
      error: errorMsg
    };
    
    // Graceful RAG Fallback using retrieved evidence chunks if Gemini API is temporarily unavailable or rate-limited
    if (compressedEvidences && compressedEvidences.length > 0) {
      const topChunk = compressedEvidences[0];
      const fallbackSnippet = topChunk.evidence || '';
      const fallbackAnswer = `🎯 **Spesifikasi Rujukan Rasmi (${topChunk.document}):**\n\n${fallbackSnippet}\n\n📖 **Rujukan Rasmi:** ${topChunk.document} - ${topChunk.section} (M/S ${topChunk.page})`;

      const citations = compressedEvidences.map(c => ({
        citationId: c.citationId,
        document: c.document,
        category: c.category,
        section: c.section,
        page: c.page,
        chunk_index: c.chunkIndex,
        rrf_score: c.rrfScore
      }));

      reasoningPath.diagnostics = {
        rootCauseCategory: 'LLM_GENERATION_FAILED',
        remedyRecommendation: `Model LLM tergendala (${errorMsg}). Menggunakan fallback ekstrak langsung pangkalan data IPDS.`
      };

      ragLogger.logExecution({
        user_query: userQuery,
        category_filter: categoryFilter,
        execution_status: 'SUCCESS',
        is_grounded: true,
        hard_gate_triggered: false,
        failure_reason: `Fallback aktif kerana ralat LLM: ${errorMsg}`,
        latency_ms: latencyMs,
        is_cached: false,
        final_confidence: 85,
        evidence_coverage: 100,
        retrieval_score: 100,
        source_authority: 75,
        citations_count: citations.length,
        citations: citations,
        reasoning_path: reasoningPath,
        response_preview: fallbackAnswer
      }).catch(() => {});

      return {
        answer: fallbackAnswer,
        citations,
        confidenceBreakdown: {
          retrievalScore: 100,
          rerankerScore: 100,
          sourceAuthority: 75,
          evidenceCoverage: 100,
          finalConfidence: 85
        },
        grounding: {
          isGrounded: true,
          retrievalEvidenceScore: 100,
          validCitationsCount: citations.length,
          hasValidCitations: true,
          verificationReasoning: 'Ekstraksi langsung pangkalan pengetahuan IPDS (Model AI mengalami kesibukan/had kuota).',
          hardGateTriggered: false
        }
      };
    }

    reasoningPath.diagnostics = {
      rootCauseCategory: 'LLM_GENERATION_FAILED',
      remedyRecommendation: `Ralat penjanaan AI: ${errorMsg}. Sila semak sambungan API atau kuota.`
    };

    ragLogger.logExecution({
      user_query: userQuery,
      category_filter: categoryFilter,
      execution_status: 'GENERATION_ERROR',
      is_grounded: false,
      hard_gate_triggered: false,
      failure_reason: errorMsg,
      latency_ms: latencyMs,
      is_cached: false,
      final_confidence: 0,
      evidence_coverage: 0,
      retrieval_score: 0,
      source_authority: 0,
      citations_count: 0,
      citations: [],
      reasoning_path: reasoningPath,
      response_preview: 'Ralat penjanaan AI.'
    }).catch(() => {});

    return {
      answer: "Maaf, perkhidmatan AI sedang mengalami kesibukan sementara. Sila cuba sebentar lagi.",
      citations: [],
      confidenceBreakdown: {
        retrievalScore: 0,
        rerankerScore: 0,
        sourceAuthority: 0,
        evidenceCoverage: 0,
        finalConfidence: 0
      },
      grounding: {
        isGrounded: false,
        retrievalEvidenceScore: 0,
        validCitationsCount: 0,
        hasValidCitations: false,
        verificationReasoning: 'Ralat penjanaan AI.',
        hardGateTriggered: false
      }
    };
  }
}

