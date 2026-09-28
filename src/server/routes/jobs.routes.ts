/**
 * iPDS v4.1.0 — Enterprise Background Job Queue API Routes
 * 
 * REST API ENDPOINTS:
 * - POST /api/jobs/dispatch        - Dispatch a new heavy background task
 * - GET  /api/jobs                 - List background jobs for caller tenant
 * - GET  /api/jobs/:job_id         - Get job status and execution output
 * - POST /api/jobs/:job_id/cancel  - Cancel a pending or running job
 * - GET  /api/jobs/metrics/health  - Worker queue metrics and health stats
 */

import express, { Request, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { jobQueueService, JobType, JobPriority, JobStatus } from '../services/jobQueue.service.js';
import { getSafeErrorMessage } from '../utils/errorUtils.js';

const router = express.Router();

/**
 * POST /api/jobs/dispatch
 * Dispatch a heavy task to the background queue with 100% tenant isolation
 */
router.post('/jobs/dispatch', requireAuth, async (req: Request, res: Response) => {
  try {
    const { type, payload = {}, priority = 'DEFAULT', max_attempts = 3 } = req.body || {};
    const idempotency_key = (req.headers['x-idempotency-key'] as string) || req.body?.idempotency_key;

    if (!type || typeof type !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Sila nyatakan jenis tugasan (type) yang sah.'
      });
    }

    const estate_id = req.estateId || 'FPM_TUNGGAL';
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Sesi pengesahan tidak sah.'
      });
    }

    const created_by_user_id = user.sub;
    const created_by_operator_id = user.app_metadata?.operator_id || user.user_metadata?.operator_name || 'STAFF';
    const created_by_role = user.app_metadata?.app_role || 'staff';

    const job = await jobQueueService.dispatchJob({
      type: type as JobType,
      estate_id,
      created_by_user_id,
      created_by_operator_id,
      created_by_role,
      payload,
      priority: priority as JobPriority,
      max_attempts: Number(max_attempts) || 3,
      idempotency_key
    });

    const statusCode = job.deduplicated ? 200 : 202;

    return res.status(statusCode).json({
      success: true,
      message: job.deduplicated
        ? 'Tugasan serupa telah ditemui (Idempotent Request).'
        : 'Tugasan berjaya didaftarkan dalam barisan pemprosesan latar belakang.',
      job
    });
  } catch (err: unknown) {
    console.error('Error dispatching background job:', err);
    return res.status(500).json({
      success: false,
      error: getSafeErrorMessage(err, 'Gagal mendaftarkan tugasan latar belakang.')
    });
  }
});

/**
 * GET /api/jobs
 * Retrieve list of background jobs for caller's estate
 */
router.get('/jobs', requireAuth, async (req: Request, res: Response) => {
  try {
    const estateId = req.estateId || 'FPM_TUNGGAL';
    const userRole = req.authRole || 'staff';

    const { status, type, limit, offset } = req.query;

    const jobs = await jobQueueService.listJobs(estateId, userRole, {
      status: status as JobStatus,
      type: type as string,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0
    });

    return res.json({
      success: true,
      estate_id: estateId,
      total: jobs.length,
      jobs
    });
  } catch (err: unknown) {
    console.error('Error listing background jobs:', err);
    return res.status(500).json({
      success: false,
      error: getSafeErrorMessage(err, 'Gagal mendapatkan senarai tugasan latar belakang.')
    });
  }
});

/**
 * GET /api/jobs/metrics/health
 * Queue health and operational worker metrics
 */
router.get('/jobs/metrics/health', requireRole(['staff', 'mandur', 'fc', 'pf', 'oc', 'rc']), async (req: Request, res: Response) => {
  try {
    const estateId = req.estateId || 'FPM_TUNGGAL';
    const userRole = req.authRole || 'staff';

    const metrics = await jobQueueService.getQueueMetrics(estateId, userRole);

    return res.json({
      success: true,
      estate_id: estateId,
      metrics
    });
  } catch (err: unknown) {
    console.error('Error getting job queue metrics:', err);
    return res.status(500).json({
      success: false,
      error: getSafeErrorMessage(err, 'Gagal mendapatkan statistik barisan pemprosesan.')
    });
  }
});

/**
 * GET /api/jobs/:job_id
 * Retrieve status and output of a specific job (enforces tenant boundary)
 */
router.get('/jobs/:job_id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { job_id } = req.params;
    const estateId = req.estateId || 'FPM_TUNGGAL';
    const userRole = req.authRole || 'staff';

    const job = await jobQueueService.getJob(job_id, estateId, userRole);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Tugasan latar belakang tidak ditemui atau akses dinafikan bagi ladang ini.'
      });
    }

    return res.json({
      success: true,
      job
    });
  } catch (err: unknown) {
    console.error('Error getting job status:', err);
    return res.status(500).json({
      success: false,
      error: getSafeErrorMessage(err, 'Gagal mengambil status tugasan.')
    });
  }
});

/**
 * POST /api/jobs/:job_id/cancel
 * Cancel a pending or running background job
 */
router.post('/jobs/:job_id/cancel', requireAuth, async (req: Request, res: Response) => {
  try {
    const { job_id } = req.params;
    const estateId = req.estateId || 'FPM_TUNGGAL';
    const userRole = req.authRole || 'staff';

    const cancelledJob = await jobQueueService.cancelJob(job_id, estateId, userRole);

    if (!cancelledJob) {
      return res.status(404).json({
        success: false,
        error: 'Tugasan tidak ditemui atau kebenaran membatalkan dinafikan.'
      });
    }

    return res.json({
      success: true,
      message: 'Tugasan latar belakang berjaya dibatalkan.',
      job: cancelledJob
    });
  } catch (err: unknown) {
    console.error('Error cancelling job:', err);
    return res.status(500).json({
      success: false,
      error: getSafeErrorMessage(err, 'Gagal membatalkan tugasan.')
    });
  }
});

export default router;
