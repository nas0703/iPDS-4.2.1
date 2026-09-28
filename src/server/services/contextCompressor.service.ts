import { RagChunk } from './ragEngine.service.js';

export interface CompressedEvidence {
  citationId: string;
  document: string;
  category: string;
  page: number;
  section: string;
  chunkIndex: number;
  evidence: string;
  evidenceType: 'table' | 'paragraph' | 'formula' | 'rule';
  rrfScore: number;
}

/** Type alias for CompressedEvidence in RAG architecture */
export type CompressedEvidenceChunk = CompressedEvidence;

/**
 * Domain & Operational Synonym Mapping for Query Subsection Extraction
 */
const OPERATIONAL_SYNONYM_MAP: Record<string, string[]> = {
  membaja: ['baja', 'pembajaan', 'tabur baja', 'fertilizer', 'mop', 'urea', 'kieserite', 'borate', 'npk', 'cirp', 'rock phosphate', 'lsu', 'efb', 'mulching', '4t', 'pusingan'],
  meracun: ['racun', 'herbisid', 'rumpai', 'merumput', 'semburan', 'spraying', 'glyphosate', 'metsulfuron', 'glufosinate', 'triclopyr', 'circle weeding', 'woody growth', 'lalang', 'asystasia', 'mikania', 'weeds', 'trunk injection'],
  merumput: ['merumput', 'meracun', 'racun', 'herbisid', 'rumpai', 'semburan', 'spraying', 'glyphosate', 'metsulfuron', 'glufosinate', 'triclopyr', 'circle weeding', 'woody growth', 'lalang', 'asystasia', 'mikania', 'weeds', 'trunk injection'],
  menuai: ['penuaian', 'tuai', 'bts', 'buah relai', 'biji relai', 'loose fruit', 'sabit', 'pahat', 'egrek', 'harvesting', 'abw', 'btp', 'kutipan', 'evakuasi', 'kematangan'],
  parit: ['saliran', 'drain', 'drainage', 'parit utama', 'parit sekunder', 'parit ladang', 'parit sempadan', 'collection drain', 'main drain', 'field drain'],
  teres: ['contour', 'backslope', 'stop bund', 'benteng hentian', 'cerun', 'terrace', 'tapak teres'],
  nursery: ['tapak semaian', 'semai', 'pre-nursery', 'main nursery', 'polibeg', 'cambah', 'culling', 'polybag'],
  pruning: ['pemangkasan', 'pangkas', 'pelepah', 'susun pelepah', 'frond stacking', 'songgo', 'pruning', 'kanopi'],
  perolehan: ['lpo', 'tender', 'sebut harga', 'pembelian terus', 'grn', 'bon pelaksanaan', 'wjp', 'darurat']
};

/**
 * Extracts only the relevant subsection or line items from a larger multi-topic document chunk
 * based on user query intent. Prevents dumping unrelated sections into LLM context while
 * strictly preserving structured tables, categories, units, and notes.
 */
export function extractRelevantSubsection(content: string, userQuery: string): string {
  if (!content || content.length < 250) return content;

  // Always preserve full Markdown tables, rate schedules, and notes without dropping rows
  if (content.includes('|') && content.includes('---')) {
    return content;
  }

  const qLower = (userQuery || '').toLowerCase();

  // For rate, wage, SOP, chemical dosage, or spec queries, preserve chunk intact
  if (/\b(upah|gaji|kadar|jadual|kuk|dos|racun|baja|parit|teres|semai|insentif|elaun|syarat|nota)\b/i.test(qLower)) {
    return content;
  }

  const qWords = qLower
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !['apakah', 'bagaimanakah', 'berapakah', 'kadar', 'upah', 'gaji', 'berapa', 'untuk', 'pada', 'yang', 'dalam', 'dengan', 'dari', 'tentang', 'sila'].includes(w));

  const targetTerms = new Set<string>(qWords);
  for (const [key, syns] of Object.entries(OPERATIONAL_SYNONYM_MAP)) {
    if (qLower.includes(key) || syns.some(s => qLower.includes(s))) {
      targetTerms.add(key);
      syns.forEach(s => targetTerms.add(s));
    }
  }

  if (targetTerms.size === 0) return content;

  // Case A: Numbered lines / list items (e.g. 19.0 ... 20.0 ... 21.0 ...)
  const lines = content.split(/\n+/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length >= 3) {
    const headerLine = lines[0];
    const matchedLines: string[] = [];
    let lastWasMatched = false;

    for (let idx = 1; idx < lines.length; idx++) {
      const line = lines[idx];
      const lineLower = line.toLowerCase();
      const isDirectMatch = Array.from(targetTerms).some(term => lineLower.includes(term));
      const isContextualNote = (lineLower.startsWith('elaun') || lineLower.startsWith('nota') || lineLower.startsWith('syarat') || lineLower.startsWith('insentif') || lineLower.startsWith('kadar standard')) && lastWasMatched;

      if (isDirectMatch || isContextualNote) {
        matchedLines.push(line);
        lastWasMatched = true;
      } else {
        lastWasMatched = false;
      }
    }

    if (matchedLines.length > 0 && matchedLines.length < lines.length - 1) {
      return `${headerLine}\n${matchedLines.join('\n')}`;
    }
  }

  // Case B: Delimited sections / paragraphs
  const sectionDelimiters = /(?=\n\s*(?:[0-9]+[\.\)]|\b(?:BAB|SEKSYEN|KUK|JADUAL|[A-Z\s]{4,}:)\s*|\n))/i;
  const rawParts = content.split(sectionDelimiters).map(p => p.trim()).filter(p => p.length > 0);

  if (rawParts.length > 1) {
    const firstPart = rawParts[0];
    const firstPartIsHeader = firstPart.length < 150 && !firstPart.match(/\b(?:RM|\d+\.\d+|\d+\s*m)\b/);
    const header = firstPartIsHeader ? firstPart : '';

    const matchedParts: string[] = [];
    for (let i = firstPartIsHeader ? 1 : 0; i < rawParts.length; i++) {
      const part = rawParts[i];
      const partLower = part.toLowerCase();
      let hasMatch = false;
      for (const term of targetTerms) {
        if (partLower.includes(term)) {
          hasMatch = true;
          break;
        }
      }
      if (hasMatch) {
        matchedParts.push(part);
      }
    }

    if (matchedParts.length > 0 && matchedParts.length < rawParts.length) {
      return header ? `${header}\n\n${matchedParts.join('\n\n')}` : matchedParts.join('\n\n');
    }
  }

  return content;
}

/**
 * Context Compression Layer (Phase 3.1)
 * 
 * Takes Top-K chunks from retrieval/reranking and prepares
 * a structured, dense evidence bundle for LLM generation without losing
 * key domain facts (rates, dosages, units, conditions, table structures, dates).
 */
export function compressContextChunks(chunks: RagChunk[], userQuery?: string): CompressedEvidence[] {
  return chunks.map((c, idx) => {
    const citationId = `[Ruj ${idx + 1}]`;
    const document = c.file_name || 'Dokumen Tidak Dinamakan';
    const page = c.page_number || 1;
    const section = c.section_title || 'Seksyen Am';
    const category = c.category || 'Am';
    const chunkIndex = c.chunk_index ?? idx;
    const rrfScore = c.final_rrf_score || 0;

    // Detect evidence type
    let evidenceType: 'table' | 'paragraph' | 'formula' | 'rule' = 'paragraph';
    let content = c.content || '';

    // Apply Query-focused subsection extraction if userQuery is provided
    if (userQuery) {
      content = extractRelevantSubsection(content, userQuery);
    }

    if (content.includes('|') && content.includes('---')) {
      evidenceType = 'table';
    } else if (/\b(SOP|Peraturan|Garis Panduan|Syarat|Wajib|Dilarang)\b/i.test(content)) {
      evidenceType = 'rule';
    } else if (/[=\+\*\/]\s*\d+|\b(Formula|Persamaan|Dos =|Kadar =)\b/i.test(content)) {
      evidenceType = 'formula';
    }

    // Perform non-lossy compression:
    // Remove excess blank lines while strictly preserving numbers, units, tables, and rules
    const cleanedEvidence = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');

    return {
      citationId,
      document,
      category,
      page,
      section,
      chunkIndex,
      evidence: cleanedEvidence,
      evidenceType,
      rrfScore
    };
  });
}

/**
 * Formats Compressed Evidence into a structured, highly-readable string for LLM System Instruction
 */
export function formatCompressedContextForPrompt(compressedEvidences: CompressedEvidence[]): string {
  return formatGroupedContextForPrompt(compressedEvidences);
}

/**
 * Groups retrieved chunks by document -> section -> activity before sending to the LLM (Rule 4)
 */
export function formatGroupedContextForPrompt(compressedEvidences: CompressedEvidence[]): string {
  if (compressedEvidences.length === 0) return '';

  const docMap = new Map<string, CompressedEvidence[]>();
  for (const ce of compressedEvidences) {
    const docKey = ce.document || 'Dokumen Rujukan IPDS';
    if (!docMap.has(docKey)) {
      docMap.set(docKey, []);
    }
    docMap.get(docKey)!.push(ce);
  }

  const output: string[] = [];
  for (const [docName, chunks] of docMap.entries()) {
    output.push(`================================================================================`);
    output.push(`### DOKUMEN SUMBER: ${docName}`);
    output.push(`================================================================================`);

    for (const ce of chunks) {
      output.push(`\n### ${ce.citationId} [SEKSYEN: ${ce.section} | KATEGORI/AKTIVITI: ${ce.category} | M/S: ${ce.page}]`);
      output.push(`KANDUNGAN BUKTI:`);
      output.push(ce.evidence);
      output.push(`--------------------------------------------------`);
    }
    output.push('');
  }

  return output.join('\n').trim();
}


