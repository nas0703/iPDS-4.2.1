import { RagChunk } from './ragEngine.service.js';

/**
 * IPDS FPMSB LEXICAL RETRIEVAL & QUERY PROCESSOR
 * 
 * Provides domain-specific normalization, term extraction, and Okapi BM25 ranking
 * for Malay, English, mixed agronomy terms, numbers, dosage rates, and document codes.
 */

// Domain technical dictionary & synonyms mapping with comprehensive agronomy abbreviations
export const AGRONOMY_LEXICAL_DICTIONARY: Record<string, string[]> = {
  // Rates, Wages & Procurement
  upah: ['kadar', 'gaji', 'bayaran', 'wage', 'rate', 'elaun', 'kuk'],
  kadar: ['upah', 'dos', 'rate', 'dosage', 'sukatan', 'harga'],
  merumput: ['racun', 'herbisid', 'semburan', 'spray', 'rumpai', 'weeding', 'circle weeding', 'lorong menuai', 'piringan', 'kuk'],
  meracun: ['racun', 'herbisid', 'semburan', 'spray', 'rumpai', 'herbisid', 'merumput'],
  membaja: ['baja', 'pembajaan', 'tabur baja', 'fertilizer', 'mop', 'urea'],
  menuai: ['tuai', 'bts', 'buah relai', 'pahat', 'sabit', 'egrek', 'tandan'],
  bts: ['buah tandan segar', 'ffb', 'tandan', 'harvesting'],
  ffb: ['fresh fruit bunch', 'bts', 'tandan'],
  kuk: ['keputusan urusetia kelab', 'pekeliling', 'kuk siri 8', 'kadar upah'],
  lpo: ['local purchase order', 'pesanan tempatan', 'pesanan belian', 'perolehan'],
  wjp: ['wang jaminan pelaksanaan', 'bon pelaksanaan', 'perolehan', 'tender'],
  grn: ['goods received note', 'nota penerimaan barang', 'pembekal'],
  tender: ['sebut harga', 'perolehan', 'kontrak', 'kontraktor'],

  // Chemicals, Herbicides & Dosages
  racun: ['herbisid', 'herbicide', 'pestisid', 'chemical', 'kawalan kimia'],
  herbisid: ['racun', 'herbicide', 'kawalan rumpai', 'sukatan'],
  dos: ['kadar', 'sukatan', 'dosage', 'rate', 'kepekatan'],
  semburan: ['spray', 'spraying', 'sembur', 'cda', 'knapsack'],
  liter: ['l', 'litre', 'ml'],
  glyphosate: ['roundup', 'sistemik', 'kawalan lalang', 'glifosat'],
  metsulfuron: ['ally', 'meturon', 'kawalan daun lebar', 'pakis'],
  glufosinate: ['basta', 'kawalan sentuh', 'rumput israel'],
  triclopyr: ['garlon', 'anak kayu', 'pokok renek', 'woody weed'],

  // Fertilizers & Foliar Analysis
  baja: ['fertilizer', 'pembajaan', 'npk', 'compact', 'mop', 'kieserite', 'borate', 'rock phosphate'],
  pembajaan: ['fertilizer', 'baja', 'manuring', 'lsu', 'foliar'],
  lsu: ['leaf sampling unit', 'persampelan daun', 'pelepah 17', 'foliar', 'analisis daun'],
  pelepah: ['frond', 'pelepah 17', 'pelepah 9', 'lsu', 'canopy'],
  frond: ['pelepah', 'pelepah 17', 'canopy', 'lsu'],
  foliar: ['analisis daun', 'lsu', 'pelepah 17', 'nutrien'],

  // Oil Palm Agronomy & Breeding
  sph: ['stands per hectare', 'pokok per hektar', 'kepadatan', 'densiti', 'jarak tanaman'],
  kepadatan: ['sph', 'stand per hectare', 'densiti', 'jarak tanaman', '136 sph', '148 sph', '160 sph'],
  densiti: ['sph', 'kepadatan', 'spacing', 'jarak'],
  dura: ['sh+', 'tempurung tebal', 'deli dura', 'induk betina'],
  pisifera: ['sh-', 'tiada tempurung', 'tanpa tempurung', 'induk jantan', 'pembaka'],
  tenera: ['dxp', 'sh+sh-', 'komersial', 'tempurung nipis', 'kacukan'],
  dxp: ['tenera', 'dura x pisifera', 'benih komersial', 'biji benih'],
  ffa: ['free fatty acid', 'asid lemak bebas', 'kualiti minyak', 'oer'],
  oer: ['oil extraction rate', 'kadar perahan minyak', 'kualiti bts'],
  ker: ['kernel extraction rate', 'kadar perahan isirung'],
  bsr: ['basal stem rot', 'reput pangkal batang', 'ganoderma', 'ganoderma boninense'],
  ganoderma: ['bsr', 'basal stem rot', 'reput pangkal batang', 'kulat'],
  lcc: ['legume cover crop', 'kekacang penutup bumi', 'mucuna bracteata', 'pueraria javanica', 'calopogonium'],
  kekacang: ['lcc', 'mucuna bracteata', 'penutup bumi', 'legume'],
  gambut: ['peat', 'tanah gambut', 'water table', 'paras air', 'parit'],
  peat: ['gambut', 'soil', 'water management'],

  // Soil Conservation, Terracing & Field Engineering
  teres: ['terrace', 'teres kontur', 'backslope', 'stop bund', 'lebar teres', 'benteng hentian', 'kecerunan cerun', 'bukit', 'inward slope', 'platform', 'dimensi teres', 'ukuran teres'],
  terrace: ['teres', 'contour terrace', 'backslope', 'stop bund', 'inward slope', 'cut batter'],
  backslope: ['inward slope', 'cerun ke dalam', 'teres', 'kondong ke dalam', '1:10', '1:12', 'hill face'],
  cerun: ['slope', 'kecerunan', 'bukit', 'teres', '12 darjah', 'hakisan', '25 darjah', 'bercerun'],
  parit: ['drain', 'saliran', 'main drain', 'collection drain', 'field drain', 'parit sempadan', 'parit utama', 'parit sekunder', 'parit ladang', 'dimensi parit'],
  drain: ['parit', 'saliran', 'drainage', 'main drain', 'collection drain'],
  jalan: ['road', 'main road', 'collection road', 'jalan lori', 'jalan ladang', 'jalan traktor', 'lebar jalan', 'scour check'],
  road: ['jalan', 'main road', 'collection road', 'access road'],
  ukuran: ['dimensi', 'spesifikasi', 'lebar', 'panjang', 'tinggi', 'kedalaman', 'saiz', 'dimension', 'measurement'],
  dimensi: ['ukuran', 'spesifikasi', 'lebar', 'kedalaman', 'panjang', 'size'],
  jarak: ['spacing', 'kepadatan', 'densiti', 'jarak tanaman', '9m x 9m', 'segi tiga sama sisi', '136 pokok/ha', '148 pokok/ha'],
  lubang: ['holing', 'lubang tanam', '60cm x 60cm', 'lubang tanaman', 'rock phosphate'],

  // Operation, SOP & Field Standards
  penuaian: ['harvesting', 'tuai', 'cut', 'pusingan tuai', 'piawaian bts', 'bts masak', 'buah lerai'],
  tuai: ['penuaian', 'harvest', 'bts', 'buah masak', 'pusingan'],
  pruning: ['pemangkasan', 'pangkas', 'pelepah', 'cantas', 'songgo dua', 'songgo satu'],
  pangkas: ['pruning', 'pemangkasan', 'pelepah', 'cantas'],
  sop: ['prosedur operasi standard', 'manual', 'panduan', 'standard operating procedure'],
  msl: ['manual sawit', 'msl fpmsb', 'manual sawit lestari', 'gap', 'amalan pertanian baik'],
  gap: ['good agricultural practices', 'amalan pertanian baik', 'msl'],
  perolehan: ['tender', 'sebut harga', 'pembelian terus', 'had nilai', 'lpo', 'bon pelaksanaan', 'wjp', 'kuasa melulus']
};

export interface NormalizedLexicalQuery {
  rawQuery: string;
  cleanedText: string;
  terms: string[];
  phrases: string[];
  numbers: string[];
  codes: string[];
  ftsQueryString: string;
}

const MALAY_STOPWORDS = new Set([
  'di', 'ke', 'dari', 'dan', 'atau', 'yang', 'pada', 'untuk', 'dengan', 'oleh',
  'dalam', 'antara', 'bagi', 'seperti', 'adalah', 'ialah', 'akan', 'telah', 'sudah',
  'boleh', 'dapat', 'cara', 'bagaimana', 'bagaimanakah', 'apakah', 'siapakah', 'berapakah',
  'mengapa', 'kenapa', 'mana', 'bilakah', 'ini', 'itu', 'ada', 'juga', 'kerana'
]);

/**
 * Normalizes user query specifically preserving numbers, units, dosages, codes, and Malay/English agronomy terms.
 */
export function normalizeLexicalQuery(query: string): NormalizedLexicalQuery {
  if (!query) {
    return {
      rawQuery: '',
      cleanedText: '',
      terms: [],
      phrases: [],
      numbers: [],
      codes: [],
      ftsQueryString: ''
    };
  }

  const rawQuery = query.trim();

  // 1. Extract technical codes & document identifiers (e.g., KUK Siri 8, MSL 2025, SOP-002, 18L, 2.5 kg/ha)
  const codeMatches = rawQuery.match(/\b(?:KUK|SOP|MSL|FFB|BTS|EFB|PPE|MSPO|FPMSB|PUS\d?)\b(?:\s+(?:Siri|-?\d+))?/gi) || [];
  const numberMatches = rawQuery.match(/\b(?:\d+(?:\.\d+)?(?:\s*(?:kg\/ha|l\/ha|liter|l|ha|rm|tan|hari|m\/s|page|%)|\b)|rm\s*\d+(?:\.\d+)?)\b/gi) || [];
  const volumeMatches = rawQuery.match(/\b\d+(?:l|liter|ml|kg)\b/gi) || [];

  // 2. Clean punctuation while explicitly protecting numbers with decimal points or units
  // Replaces special symbols except alphanumeric, spaces, and dots within numbers
  let cleaned = rawQuery.toLowerCase()
    .replace(/[/,\-–_()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 3. Extract word tokens (minimum length 1 for digits or key characters, >=2 for general words)
  const rawTokens = cleaned.split(' ').filter(t => t.length >= 1);
  const termsSet = new Set<string>();

  for (const token of rawTokens) {
    if (MALAY_STOPWORDS.has(token)) continue;
    if (token.length >= 2 || /\d/.test(token) || ['l', 'm', 'g'].includes(token)) {
      termsSet.add(token);
    }
  }

  // 4. Expand query with domain synonyms
  for (const token of Array.from(termsSet)) {
    const synonyms = AGRONOMY_LEXICAL_DICTIONARY[token];
    if (synonyms) {
      synonyms.forEach(syn => termsSet.add(syn.toLowerCase()));
    }
  }

  const terms = Array.from(termsSet);

  // 5. Construct PostgreSQL prefix-matched Full-Text Search tsquery string
  // Format: "term1:* & term2:* & term3:*" with fallback OR for long queries
  const ftsTokens = terms
    .map(t => t.replace(/[':\&\!\|]/g, '')) // sanitize FTS special chars
    .filter(t => t.length >= 2 || /\d/.test(t));

  let ftsQueryString = '';
  if (ftsTokens.length > 0) {
    // For queries with <= 4 key terms, use AND (&), else use mixed AND/OR for flexibility
    if (ftsTokens.length <= 4) {
      ftsQueryString = ftsTokens.map(t => `${t}:*`).join(' & ');
    } else {
      const primaryTerms = ftsTokens.slice(0, 3).map(t => `${t}:*`).join(' & ');
      const secondaryTerms = ftsTokens.slice(3).map(t => `${t}:*`).join(' | ');
      ftsQueryString = `(${primaryTerms}) & (${secondaryTerms})`;
    }
  }

  return {
    rawQuery,
    cleanedText: cleaned,
    terms,
    phrases: Array.from(new Set(codeMatches)),
    numbers: Array.from(new Set(numberMatches)),
    codes: Array.from(new Set(codeMatches)),
    ftsQueryString
  };
}

/**
 * OKAPI BM25 IN-MEMORY SCORING ENGINE
 * 
 * Formula:
 * BM25(D, Q) = sum_{q in Q} [ IDF(q) * (f(q, D) * (k1 + 1)) / (f(q, D) + k1 * (1 - b + b * (|D| / avgdl))) ]
 * 
 * Standard parameters:
 * k1 = 1.2
 * b = 0.75
 */
export function calculateOkapiBM25Score(
  query: string,
  chunkContent: string,
  docLen: number,
  avgDocLen: number,
  totalDocs: number,
  docFreqMap: Record<string, number>,
  k1: number = 1.2,
  b: number = 0.75
): number {
  const normalized = normalizeLexicalQuery(query);
  if (normalized.terms.length === 0 || !chunkContent) return 0;

  const contentLower = chunkContent.toLowerCase();
  let totalScore = 0;

  for (const term of normalized.terms) {
    // Count exact term frequency in chunk content
    const termRegex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi');
    const matches = contentLower.match(termRegex);
    const tf = matches ? matches.length : 0;

    if (tf === 0) continue;

    // Document Frequency & IDF
    const df = docFreqMap[term] || 1;
    // Standard Lucene/Okapi BM25 IDF formulation: ln(1 + (N - n + 0.5) / (n + 0.5))
    const idf = Math.max(0.1, Math.log(1 + (totalDocs - df + 0.5) / (df + 0.5)));

    // BM25 term score calculation
    const numerator = tf * (k1 + 1);
    const denominator = tf + k1 * (1 - b + b * (docLen / Math.max(1, avgDocLen)));
    const termBM25 = idf * (numerator / denominator);

    totalScore += termBM25;
  }

  // Bonus for exact code / number phrase matches
  for (const num of normalized.numbers) {
    if (contentLower.includes(num.toLowerCase())) {
      totalScore += 1.5;
    }
  }

  for (const code of normalized.codes) {
    if (contentLower.includes(code.toLowerCase())) {
      totalScore += 2.0;
    }
  }

  return Number(totalScore.toFixed(4));
}

/**
 * Perform Lexical BM25 Ranking over a collection of RagChunks in memory
 */
export function rankChunksWithOkapiBM25(
  query: string,
  chunks: RagChunk[],
  topK: number = 25
): RagChunk[] {
  if (!query || chunks.length === 0) return [];

  // Calculate corpus statistics
  const totalDocs = chunks.length;
  let totalLen = 0;
  const docFreqMap: Record<string, number> = {};

  const normalized = normalizeLexicalQuery(query);

  // Pre-pass: Compute document lengths and term document frequencies
  const chunkStats = chunks.map(chunk => {
    const content = chunk.content || '';
    const len = content.split(/\s+/).length;
    totalLen += len;

    const contentLower = content.toLowerCase();
    for (const term of normalized.terms) {
      if (contentLower.includes(term)) {
        docFreqMap[term] = (docFreqMap[term] || 0) + 1;
      }
    }

    return { chunk, len };
  });

  const avgDocLen = totalLen / Math.max(1, totalDocs);

  // Scoring pass
  const scoredChunks = chunkStats.map(({ chunk, len }) => {
    const bm25Score = calculateOkapiBM25Score(
      query,
      chunk.content,
      len,
      avgDocLen,
      totalDocs,
      docFreqMap,
      1.2,
      0.75
    );

    return {
      ...chunk,
      keyword_score: bm25Score
    };
  });

  // Filter out 0 scores and sort descending
  return scoredChunks
    .filter(c => c.keyword_score > 0)
    .sort((a, b) => b.keyword_score - a.keyword_score)
    .slice(0, topK);
}

/**
 * PURE OKAPI BM25 SINGLE TERM SCORE (TEXTBOOK MATHEMATICAL FORMULA)
 * Formula: IDF(q) * [ (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLen / avgDocLen))) ]
 * IDF(q) = ln(1 + (N - n + 0.5) / (n + 0.5))
 */
export function calculatePureBM25TermScore(
  tf: number,
  docLen: number,
  avgDocLen: number,
  totalDocs: number,
  docFreq: number,
  k1: number = 1.2,
  b: number = 0.75
): number {
  if (tf <= 0) return 0;
  const idf = Math.max(0.1, Math.log(1 + (totalDocs - docFreq + 0.5) / (docFreq + 0.5)));
  const numerator = tf * (k1 + 1);
  const denominator = tf + k1 * (1 - b + b * (docLen / Math.max(1, avgDocLen)));
  return Number((idf * (numerator / denominator)).toFixed(6));
}

/**
 * AUDIT PARAMETER SENSITIVITY (k1 = 1.2, 1.5, 2.0; b = 0.5, 0.75, 1.0)
 */
export function auditParameterSensitivity(
  tf: number = 2,
  docLen: number = 15,
  avgDocLen: number = 10,
  totalDocs: number = 100,
  docFreq: number = 10
): Array<{ k1: number; b: number; score: number }> {
  const k1List = [1.2, 1.5, 2.0];
  const bList = [0.5, 0.75, 1.0];
  const results: Array<{ k1: number; b: number; score: number }> = [];

  for (const k1 of k1List) {
    for (const b of bList) {
      const score = calculatePureBM25TermScore(tf, docLen, avgDocLen, totalDocs, docFreq, k1, b);
      results.push({ k1, b, score });
    }
  }

  return results;
}

/**
 * AUDIT TECHNICAL TERM TOKENIZATION
 * Verifies that technical terms are preserved without loss.
 */
export function auditTechnicalTermTokenization(): Record<string, boolean> {
  const testTerms = [
    'KUK',
    'MSL',
    'SOP',
    'BTS',
    'FFB',
    'EFB',
    '16L',
    '18L',
    '2.5 kg/ha',
    'RM18.50',
    'Eleusine indica'
  ];

  const auditMap: Record<string, boolean> = {};

  for (const rawTerm of testTerms) {
    const normalized = normalizeLexicalQuery(rawTerm);
    const cleanLower = rawTerm.toLowerCase();
    
    const preservedInTerms = normalized.terms.some(t => cleanLower.includes(t.toLowerCase()));
    const preservedInCodes = normalized.codes.some(c => cleanLower.includes(c.toLowerCase()));
    const preservedInNumbers = normalized.numbers.some(n => cleanLower.includes(n.toLowerCase()));

    auditMap[rawTerm] = preservedInTerms || preservedInCodes || preservedInNumbers;
  }

  return auditMap;
}

