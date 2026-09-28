import express from 'express';
import { requireRole } from '../../middleware/auth.js';
import { runRetrievalBenchmarkSuite, generateFormattedRetrievalReport } from '../../services/retrievalEvaluator.service.js';
import { runPhase25StressTestSuite, generateFormattedPhase25Report } from '../../services/stressTestEvaluator.service.js';
import { runPhase3EvaluationSuite, generateFormattedPhase3Report } from '../../services/generationEvaluator.service.js';
import { runLexicalBenchmarkSuite, generateFormattedLexicalReport } from '../../services/lexicalEvaluator.service.js';
import { getSafeErrorMessage } from '../../utils/errorUtils.js';

const router = express.Router();

// GET /api/ai/evaluate-retrieval - Execute Phase 2 Retrieval Quality Benchmark & Diagnostic Evaluation
router.get(['/ai/evaluate-retrieval', '/evaluate-retrieval'], requireRole(['pf', 'fc', 'oc', 'rc']), async (req, res) => {
  try {
    const benchmarkSummary = await runRetrievalBenchmarkSuite();
    const formattedReport = generateFormattedRetrievalReport(benchmarkSummary);

    return res.json({
      success: true,
      summary: benchmarkSummary,
      reportText: formattedReport
    });
  } catch (error: unknown) {
    console.error("Retrieval Evaluation Benchmark Error:", error);
    return res.status(500).json({
      error: 'Ralat semasa menjalankan penilaian penjejakan retrieval RAG.',
      details: getSafeErrorMessage(error)
    });
  }
});

// GET /api/ai/evaluate-stress-test - IPDS FPMSB Enterprise RAG — Phase 2.5 Stress Test Evaluation
router.get(['/ai/evaluate-stress-test', '/evaluate-stress-test'], requireRole(['pf', 'fc', 'oc', 'rc']), async (req, res) => {
  try {
    const summary = await runPhase25StressTestSuite();
    const formattedReport = generateFormattedPhase25Report(summary);

    return res.json({
      success: true,
      summary,
      formattedReport
    });
  } catch (err: unknown) {
    console.error("Phase 2.5 Stress Test Evaluation Error:", err);
    return res.status(500).json({
      success: false,
      error: 'Ralat semasa memproses Fasa 2.5 Stress Test Evaluation',
      details: getSafeErrorMessage(err)
    });
  }
});

// GET /api/ai/evaluate-generation - IPDS FPMSB Enterprise RAG — Phase 3 Generation Evaluation
router.get(['/ai/evaluate-generation', '/evaluate-generation'], requireRole(['pf', 'fc', 'oc', 'rc']), async (req, res) => {
  try {
    const summary = await runPhase3EvaluationSuite();
    const formattedReport = generateFormattedPhase3Report(summary);

    return res.json({
      success: true,
      phase: summary.phase,
      status: summary.status,
      tests: summary.tests,
      metrics: summary.metrics,
      regression: summary.regression,
      failedCases: summary.failedCases,
      rootCauseAnalysis: summary.rootCauseAnalysis,
      recommendation: summary.recommendation,
      formattedReport
    });
  } catch (err: unknown) {
    console.error("Phase 3 Generation Evaluation Error:", err);
    return res.status(500).json({
      success: false,
      error: 'Ralat semasa memproses Fasa 3 Generation Evaluation',
      details: getSafeErrorMessage(err)
    });
  }
});

// GET /api/ai/evaluate-lexical & /evaluate-ablation - Lexical Retrieval & Ablation Evaluation
router.get(['/ai/evaluate-lexical', '/evaluate-lexical', '/ai/evaluate-ablation', '/evaluate-ablation'], requireRole(['pf', 'fc', 'oc', 'rc']), async (req, res) => {
  try {
    const report = await runLexicalBenchmarkSuite();
    const formattedReport = generateFormattedLexicalReport(report);

    return res.json({
      success: true,
      rankingAlgorithmUsed: report.rankingAlgorithmUsed,
      isTrueBM25: report.isTrueBM25,
      statusGrade: report.statusGrade,
      lexicalMetrics: report.lexicalMetrics,
      ablationComparison: report.ablationComparison,
      formattedReport
    });
  } catch (err: unknown) {
    console.error("Lexical Retrieval Evaluation Error:", err);
    return res.status(500).json({
      success: false,
      error: 'Ralat semasa memproses Lexical Retrieval Evaluation',
      details: getSafeErrorMessage(err)
    });
  }
});

export default router;
