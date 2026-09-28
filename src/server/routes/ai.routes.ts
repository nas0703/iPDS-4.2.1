import express from 'express';
import { aiChatRateLimiter, aiMultimodalRateLimiter, benchmarkRateLimiter } from '../middleware/rateLimiter.js';
import morningBriefingRouter from './ai/morningBriefing.routes.js';
import estateChatRouter from './ai/estateChat.routes.js';
import ragRouter from './ai/rag.routes.js';
import visionRouter from './ai/vision.routes.js';
import evaluationRouter from './ai/evaluation.routes.js';

const router = express.Router();

// DEBUG: Log all incoming requests to AI routes
router.use((req, res, next) => {
  console.log(`[AI_ROUTES_DEBUG] ${new Date().toISOString()} ${req.method} ${req.url} (Path: ${req.path})`);
  next();
});

// 1. Morning Briefing Routes (AI Chat & Report Generation - 30 req/min)
router.use('/', aiChatRateLimiter, morningBriefingRouter);

// 2. Estate Chat Routes (Interactive Analytics & Operations Assistant - 30 req/min)
router.use('/', aiChatRateLimiter, estateChatRouter);

// 3. RAG Knowledge Routes (Manual Sawit, Grounded Search, Cache, Ingestion - 30 req/min)
router.use('/', aiChatRateLimiter, ragRouter);

// 4. Vision & Multimodal Routes (WeedVision™, OCR, Audio Transcription - 15 req/min)
router.use('/', aiMultimodalRateLimiter, visionRouter);

// 5. Benchmark & Evaluation Routes (Retrieval, Stress Test, Generation, Lexical)
router.use('/evaluate-retrieval', benchmarkRateLimiter);
router.use('/evaluate-stress-test', benchmarkRateLimiter);
router.use('/evaluate-generation', benchmarkRateLimiter);
router.use('/evaluate-lexical', benchmarkRateLimiter);
router.use('/evaluate-ablation', benchmarkRateLimiter);
router.use('/', evaluationRouter);

export default router;

