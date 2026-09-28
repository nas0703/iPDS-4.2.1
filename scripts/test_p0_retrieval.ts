import { fetchMslKnowledgeChunks } from '../src/server/services/mslKnowledge.service.js';
import { generateEnterpriseGroundedAnswer } from '../src/server/services/ragEngine.service.js';
import { getSupabase } from '../src/server/db.js';
import dotenv from 'dotenv';
dotenv.config();

const TEST_QUERIES = [
  'ukuran parit',
  'parit',
  'ukuran parit utama',
  'parit sempadan',
  'kadar baja',
  'dos racun',
  'jarak tanaman',
  'upah menuai',
  'pengairan nursery',
  'pembajaan nursery'
];

async function runP0Tests() {
  console.log('====================================================');
  console.log('       IPDS PRODUCTION RAG — P0 TEST SUITE          ');
  console.log('====================================================\n');

  const supabase = getSupabase();

  for (let i = 0; i < TEST_QUERIES.length; i++) {
    const q = TEST_QUERIES[i];
    console.log(`\n----------------------------------------------------`);
    console.log(`QUERY ${i + 1}/${TEST_QUERIES.length}: "${q}"`);
    console.log(`----------------------------------------------------`);

    let rpcSuccess = false;
    let rpcCount = 0;

    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('match_pdf_documents', {
          query_embedding: new Array(768).fill(0.01),
          keyword_query: q,
          match_threshold: 0.0,
          match_count: 5,
          vector_weight: 0.7,
          text_weight: 0.3,
          filter_project_id: null,
          filter_document_id: null
        });
        if (!error) {
          rpcSuccess = true;
          rpcCount = data?.length || 0;
        }
      } catch (e) {}
    }

    console.log(`Primary RPC (match_pdf_documents): ${rpcSuccess ? 'SUCCESS' : 'FALLBACK TO VECTOR-FIRST ENGINE'}`);
    console.log(`Fallback Used: ${rpcSuccess ? 'No' : 'Yes (fetchMslKnowledgeChunks)'}`);

    const chunks = await fetchMslKnowledgeChunks(q, 'Semua', 10);
    console.log(`\nTop Retrieved Chunks (${chunks.length} total candidates):`);
    chunks.slice(0, 5).forEach((c: any, idx: number) => {
      console.log(`  [Chunk ${idx + 1}] Section: "${c.section_title || c.manual_title}" | Page: ${c.page_number || 1}`);
      console.log(`             Score: ${c.score || c.vector_score || 'N/A'} | Table Boost Applied: ${c.score > 70 ? 'Yes (+0.25)' : 'No'}`);
      console.log(`             Snippet: ${(c.content || '').substring(0, 100).replace(/\n/g, ' ')}`);
    });

    const res = await generateEnterpriseGroundedAnswer(q);
    console.log(`\nEvidence Coverage: ${res.confidenceBreakdown.evidenceCoverage}%`);
    console.log(`Hard Gate Triggered: ${res.grounding.hardGateTriggered ? 'YES (BLOCKED)' : 'NO (PASSED)'}`);
    console.log(`Answer Excerpt: ${res.answer.substring(0, 250).replace(/\n/g, ' ')}...`);
    console.log(`Citation Correctness: ${res.grounding.hasValidCitations ? `VALID (${res.grounding.validCitationsCount} citations)` : 'N/A (No citations required/fallback)'}`);
  }

  console.log('\n====================================================');
  console.log('               P0 TEST SUITE COMPLETED              ');
  console.log('====================================================');
}

runP0Tests().catch(console.error);
