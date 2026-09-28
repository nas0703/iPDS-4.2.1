/**
 * iPDS v4.1.0 — Protected Vercel Cron API Routes
 * 
 * ENDPOINTS:
 * - GET  /cron/process-jobs - Protected Vercel Cron Runner to process pending background tasks
 * - POST /cron/process-jobs - Protected manual trigger for cron execution
 * - GET  /cron/health       - Health check for background job subsystem & cron runner
 */

import express, { Request, Response } from 'express';
import { requireCronAuth } from '../middleware/cronAuth.js';
import { jobQueueService } from '../services/jobQueue.service.js';
import { auditService } from '../services/audit.service.js';
import { v4 as uuidv4 } from 'uuid';
import { getSafeErrorMessage } from '../utils/errorUtils.js';
import { getMalaysiaDate } from '../services/gradingTask.service.js';
import { ZONES } from '../../config/estateRegistry.js';

const router = express.Router();

/**
 * Handler for /cron/process-jobs (Handles both GET and POST)
 */
async function handleProcessJobs(req: Request, res: Response) {
  const executionId = `cron_exec_${Date.now().toString(36)}_${uuidv4().substring(0, 6)}`;
  const startTime = Date.now();

  try {
    // Extract optional execution tunables
    const rawBatchSize = req.query?.batch_size || req.query?.limit || (req.body && req.body.batch_size);
    const rawTimeBudget = req.query?.time_budget_ms || (req.body && req.body.time_budget_ms);
    const rawLease = req.query?.lease_duration_seconds || (req.body && req.body.lease_duration_seconds);

    const batchSize = Math.max(1, Math.min(50, Number(rawBatchSize) || 15));
    const timeBudgetMs = Math.max(5000, Math.min(55000, Number(rawTimeBudget) || 45000));
    const leaseDurationSeconds = Math.max(30, Math.min(600, Number(rawLease) || 300));

    console.log(`[VERCEL_CRON] [${executionId}] Started background job queue batch processing (Budget: ${timeBudgetMs}ms, Batch: ${batchSize})...`);

    const taskDate = getMalaysiaDate();
    for (const estateId of ZONES.ZON_ADELA.estates) {
      await jobQueueService.dispatchJob({
        type: 'GRADING_TASK_GENERATION',
        estate_id: estateId,
        created_by_user_id: 'system:vercel-cron',
        created_by_operator_id: 'VERCEL_CRON_SCHEDULER',
        created_by_role: 'rc',
        payload: { task_date: taskDate },
        priority: 'HIGH',
        idempotency_key: `grading-generation:${estateId}:${taskDate}`
      });
    }

    // Execute batch processing via resilient worker engine
    const batchResult = await jobQueueService.processBatch({
      workerId: `vercel-cron-${executionId}`,
      batchSize,
      timeBudgetMs,
      leaseDurationSeconds
    });

    // Capture latest queue metrics after batch run
    const queueMetrics = await jobQueueService.getQueueMetrics();

    // Audit Logging
    auditService.record({
      userId: 'system:vercel-cron',
      userName: 'VERCEL_CRON_SCHEDULER',
      role: 'rc',
      authorizedEstate: 'GLOBAL',
      action: 'ADMIN_OPERATION',
      resource: 'cron_process_jobs',
      resourceId: executionId,
      result: 'SUCCESS',
      details: {
        executionId,
        processed: batchResult.processed,
        successful: batchResult.successful,
        failed: batchResult.failed,
        durationMs: batchResult.durationMs,
        queueMetrics,
        gradingTaskDate: taskDate
      }
    });

    console.log(`[VERCEL_CRON] [${executionId}] Finished batch processing. Processed: ${batchResult.processed}, Success: ${batchResult.successful}, Failed: ${batchResult.failed}, Duration: ${batchResult.durationMs}ms`);

    return res.status(200).json({
      success: true,
      message: 'Pemprosesan tugas barisan latar belakang Vercel Cron berjaya diselesaikan.',
      execution_id: executionId,
      timestamp: new Date().toISOString(),
      summary: {
        processed: batchResult.processed,
        successful: batchResult.successful,
        failed: batchResult.failed,
        durationMs: batchResult.durationMs
      },
      queueMetrics,
      gradingTaskDate: taskDate
    });
  } catch (err: unknown) {
    const durationMs = Date.now() - startTime;
    console.error(`[VERCEL_CRON_ERROR] [${executionId}] Exception during batch job processing:`, err);

    auditService.record({
      userId: 'system:vercel-cron',
      userName: 'VERCEL_CRON_SCHEDULER',
      role: 'rc',
      authorizedEstate: 'GLOBAL',
      action: 'ADMIN_OPERATION',
      resource: 'cron_process_jobs',
      resourceId: executionId,
      result: 'ERROR',
      errorMessage: err instanceof Error ? err.message : 'Unknown cron batch processing failure',
      details: { executionId, durationMs }
    });

    return res.status(500).json({
      success: false,
      error: 'Ralat semasa memproses tugasan barisan latar belakang melalui Vercel Cron.',
      execution_id: executionId,
      message: getSafeErrorMessage(err, 'Internal processing exception'),
      durationMs
    });
  }
}

// Map endpoints for both GET and POST (supports mounting with or without /cron prefix)
router.get('/cron/process-jobs', requireCronAuth, handleProcessJobs);
router.post('/cron/process-jobs', requireCronAuth, handleProcessJobs);
router.get('/process-jobs', requireCronAuth, handleProcessJobs);
router.post('/process-jobs', requireCronAuth, handleProcessJobs);

/**
 * GET /cron/health & /health
 * Readiness status of the cron runner subsystem and background queue
 */
function handleHealth(req: Request, res: Response) {
  const queueMetrics = jobQueueService.getQueueMetricsSync();
  res.status(200).json({
    success: true,
    status: 'READY',
    service: 'iPDS Vercel Cron Job Processor',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    queueMetrics
  });
}

router.get('/cron/health', handleHealth);
router.get('/health', handleHealth);

export default router;
