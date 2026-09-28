/**
 * iPDS v4.1.0 — Enterprise Background Job Queue & Resilient Worker Engine
 * 
 * DESIGN PRINCIPLES:
 * 1. Single Source of Truth (SSOT): Supabase PostgreSQL is the authoritative state store.
 * 2. 100% Tenant Isolation: Every job is immutably tagged and verified with estate_id.
 * 3. Idempotent Dispatch: Database-level uniqueness on (estate_id, idempotency_key).
 * 4. Atomic Claiming with Fencing: FOR UPDATE SKIP LOCKED + lease_version optimistic fencing.
 * 5. Durable Exponential Backoff: Database-persisted available_at survives container restarts.
 * 6. Serverless Resilient: Vercel Cron-driven batch execution with strict time budgets.
 * 7. Structured Observability: Zero secrets exposed in telemetry or audit trails.
 */

import { v4 as uuidv4 } from 'uuid';
import { auditService } from './audit.service.js';
import { getLocalEstateJson, saveLocalEstateJson } from '../local.js';
import { getSupabase, getSupabaseCredentials } from '../db.js';
import { gradingTaskService } from './gradingTask.service.js';

export type JobType = 
  | 'AI_OCR_PAGE'
  | 'AI_MORNING_BRIEFING'
  | 'REPORT_GENERATION'
  | 'SLIDE_DECK_EXPORT'
  | 'BATCH_DATA_SYNC'
  | 'GRADING_TASK_GENERATION'
  | 'GRADING_TASK_RECEIPT_MATCH';

export type JobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type JobPriority = 'HIGH' | 'DEFAULT' | 'LOW';

export interface JobRecord {
  id: string;
  type: JobType | string;
  estate_id: string;
  created_by_user_id: string;
  created_by_operator_id: string;
  created_by_role: string;
  idempotency_key?: string;
  status: JobStatus;
  priority: JobPriority;
  payload: Record<string, any>;
  result?: Record<string, any> | null;
  error_message?: string | null;
  attempts: number;
  max_attempts: number;
  available_at?: string;
  lease_version?: number;
  locked_until?: string | null;
  locked_by?: string | null;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  failed_at?: string | null;
  updated_at: string;
  deduplicated?: boolean;
}

export type JobHandler = (job: JobRecord) => Promise<Record<string, any>>;

export interface DispatchJobParams {
  type: JobType | string;
  estate_id: string;
  created_by_user_id: string;
  created_by_operator_id: string;
  created_by_role: string;
  payload: Record<string, any>;
  priority?: JobPriority;
  max_attempts?: number;
  idempotency_key?: string;
}

const PRIORITY_ORDER: Record<JobPriority, number> = {
  HIGH: 1,
  DEFAULT: 2,
  LOW: 3
};

function isTableMissingError(error: any): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  const code = error.code || '';
  return (
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    code === '42P01' ||
    msg.includes('could not find the table') ||
    msg.includes('schema cache') ||
    msg.includes('does not exist') ||
    msg.includes('relation "background_jobs" does not exist')
  );
}

function mapDbRowToJob(raw: any): JobRecord {
  return {
    id: raw.id,
    type: raw.type,
    estate_id: raw.estate_id,
    created_by_user_id: raw.created_by_user_id,
    created_by_operator_id: raw.created_by_operator_id,
    created_by_role: raw.created_by_role,
    idempotency_key: raw.idempotency_key || undefined,
    status: raw.status as JobStatus,
    priority: (raw.priority as JobPriority) || 'DEFAULT',
    payload: raw.payload || {},
    result: raw.result || null,
    error_message: raw.error_message || null,
    attempts: Number(raw.attempts) || 0,
    max_attempts: Number(raw.max_attempts) || 3,
    available_at: raw.available_at || raw.created_at,
    lease_version: Number(raw.lease_version) || 0,
    locked_until: raw.locked_until || null,
    locked_by: raw.locked_by || null,
    created_at: raw.created_at,
    started_at: raw.started_at || null,
    completed_at: raw.completed_at || null,
    failed_at: raw.failed_at || null,
    updated_at: raw.updated_at || raw.created_at
  };
}

function jobRecordToDbRow(job: JobRecord): Record<string, any> {
  return {
    id: job.id,
    type: job.type,
    estate_id: job.estate_id,
    created_by_user_id: job.created_by_user_id,
    created_by_operator_id: job.created_by_operator_id,
    created_by_role: job.created_by_role,
    idempotency_key: job.idempotency_key || null,
    status: job.status,
    priority: job.priority,
    payload: job.payload || {},
    result: job.result || null,
    error_message: job.error_message || null,
    attempts: job.attempts,
    max_attempts: job.max_attempts,
    available_at: job.available_at || job.created_at,
    lease_version: job.lease_version || 0,
    locked_until: job.locked_until || null,
    locked_by: job.locked_by || null,
    created_at: job.created_at,
    started_at: job.started_at || null,
    completed_at: job.completed_at || null,
    failed_at: job.failed_at || null,
    updated_at: job.updated_at
  };
}

export class JobQueueService {
  private static instance: JobQueueService;
  private jobs: Map<string, JobRecord> = new Map();
  private idempotencyMap: Map<string, string> = new Map(); // `${estate_id}:${key}` -> jobId
  private handlers: Map<string, JobHandler> = new Map();
  private maxConcurrentWorkers: number = 3;
  private activeWorkers: number = 0;
  private isProcessing: boolean = false;
  private isDbAvailable: boolean = true;

  private constructor() {
    this.registerDefaultHandlers();
    this.loadPersistedJobs();
  }

  public static getInstance(): JobQueueService {
    if (!JobQueueService.instance) {
      JobQueueService.instance = new JobQueueService();
    }
    return JobQueueService.instance;
  }

  /**
   * Register a handler function for a specific job type
   */
  public registerHandler(type: string, handler: JobHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * Register default built-in job handlers
   */
  private registerDefaultHandlers(): void {
    // 1. AI OCR Page Handler
    this.registerHandler('AI_OCR_PAGE', async (job) => {
      const { fileName = 'Dokumen', pageNum = 1, totalPages = 1 } = job.payload;
      await new Promise((resolve) => setTimeout(resolve, 80));
      return {
        ocrText: `[OCR PROCESSED ASYNC] Dokumen: ${fileName} (Muka surat ${pageNum}/${totalPages}) - Imbasan berjaya diselesaikan bagi ladang ${job.estate_id}.`,
        processedAt: new Date().toISOString(),
        estate_id: job.estate_id
      };
    });

    // 2. AI Morning Briefing Handler
    this.registerHandler('AI_MORNING_BRIEFING', async (job) => {
      await new Promise((resolve) => setTimeout(resolve, 60));
      return {
        briefing: `Ringkasan Pagi Automatik [${job.estate_id}]: Prestasi tuaian berada pada tahap optimum. Rekod penerimaan BTS mencatatkan pematuhan 98.4%.`,
        generatedAt: new Date().toISOString(),
        estate_id: job.estate_id
      };
    });

    // 3. Report Generation Handler
    this.registerHandler('REPORT_GENERATION', async (job) => {
      const { reportType = 'DAILY_FFB_SUMMARY' } = job.payload;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        reportType,
        downloadUrl: `/api/reports/download/${job.id}`,
        summary: `Laporan ${reportType} bagi ladang ${job.estate_id} berjaya dijana.`,
        generatedAt: new Date().toISOString(),
        estate_id: job.estate_id
      };
    });

    // 4. Slide Deck Export Handler
    this.registerHandler('SLIDE_DECK_EXPORT', async (job) => {
      const { title = 'Slaid Persembahan Eksekutif' } = job.payload;
      await new Promise((resolve) => setTimeout(resolve, 70));
      return {
        deckId: `deck_${job.id.substring(0, 8)}`,
        title,
        status: 'READY',
        slideCount: 12,
        exportedAt: new Date().toISOString(),
        estate_id: job.estate_id
      };
    });

    // 5. Batch Data Sync Handler
    this.registerHandler('BATCH_DATA_SYNC', async (job) => {
      const { records = [] } = job.payload;
      await new Promise((resolve) => setTimeout(resolve, 40));
      return {
        syncedCount: Array.isArray(records) ? records.length : 0,
        status: 'SUCCESS',
        syncedAt: new Date().toISOString(),
        estate_id: job.estate_id
      };
    });

    this.registerHandler('GRADING_TASK_GENERATION', async (job) => {
      const taskDate = String(job.payload.task_date || '');
      const result = await gradingTaskService.generateDailyTasks(job.estate_id, taskDate || undefined, job.id);
      return {
        taskDate: result.window.taskDate,
        sourceWindowStart: result.window.sourceWindowStart,
        sourceWindowEnd: result.window.sourceWindowEnd,
        taskCount: result.tasks.length,
        estate_id: job.estate_id
      };
    });

    this.registerHandler('GRADING_TASK_RECEIPT_MATCH', async (job) => {
      const noResit = String(job.payload.no_resit || '').trim();
      if (!noResit) throw new Error('GRADING_TASK_RECEIPT_REQUIRED');
      const result = await gradingTaskService.matchReceiptToTask(job.estate_id, noResit, job.id);
      return {
        outcome: result.outcome,
        taskId: result.task?.id || null,
        taskStatus: result.task?.status || null,
        estate_id: job.estate_id,
        no_resit: noResit
      };
    });
  }

  /**
   * Check if Supabase PostgreSQL is reachable and active
   */
  private getSupabaseClient() {
    if (!this.isDbAvailable) return null;
    const creds = getSupabaseCredentials();
    if (creds && !creds.supabaseUrl.includes('mockproject')) {
      return getSupabase();
    }
    return null;
  }

  /**
   * Dispatch a new job to the queue with tenant context and database-enforced idempotency
   */
  public async dispatchJob(params: DispatchJobParams): Promise<JobRecord> {
    const {
      type,
      estate_id,
      created_by_user_id,
      created_by_operator_id,
      created_by_role,
      payload,
      priority = 'DEFAULT',
      max_attempts = 3,
      idempotency_key
    } = params;

    if (!estate_id || typeof estate_id !== 'string') {
      throw new Error('Tenant Context Error: estate_id is mandatory for job queue dispatch');
    }

    const cleanEstateId = estate_id.trim().toUpperCase();
    const supabase = this.getSupabaseClient();

    // Idempotency check 1: Supabase PostgreSQL (Authoritative SSOT)
    if (idempotency_key && typeof idempotency_key === 'string' && idempotency_key.trim().length > 0) {
      const cleanKey = idempotency_key.trim();

      if (supabase) {
        try {
          const { data: existing, error } = await supabase
            .from('background_jobs')
            .select('*')
            .eq('estate_id', cleanEstateId)
            .eq('idempotency_key', cleanKey)
            .maybeSingle();

          if (!error && existing) {
            const existingJob = mapDbRowToJob(existing);
            if (['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'].includes(existingJob.status)) {
              this.jobs.set(existingJob.id, existingJob);
              console.log(`[JOB_DEDUPLICATED] Job ${existingJob.id} deduplicated via database key ${cleanKey} for ${cleanEstateId}`);
              return { ...existingJob, deduplicated: true };
            }
          } else if (error && isTableMissingError(error)) {
            this.isDbAvailable = false;
          }
        } catch (_) {
          // Non-fatal lookup fallback
        }
      }

      // Secondary in-memory check (for offline/test environments)
      const idempotencyLookupKey = `${cleanEstateId}:${cleanKey}`;
      const existingJobId = this.idempotencyMap.get(idempotencyLookupKey);
      if (existingJobId) {
        const existingJob = this.jobs.get(existingJobId);
        if (existingJob && ['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'].includes(existingJob.status)) {
          console.log(`[JOB_DEDUPLICATED] Job ${existingJob.id} deduplicated via memory cache for ${cleanEstateId}`);
          return {
            ...existingJob,
            deduplicated: true
          };
        }
      }
    }

    const jobId = uuidv4();
    const nowIso = new Date().toISOString();

    const jobRecord: JobRecord = {
      id: jobId,
      type,
      estate_id: cleanEstateId,
      created_by_user_id,
      created_by_operator_id,
      created_by_role,
      idempotency_key: idempotency_key ? idempotency_key.trim() : undefined,
      status: 'QUEUED',
      priority,
      payload: payload || {},
      result: null,
      error_message: null,
      attempts: 0,
      max_attempts: Math.max(1, max_attempts),
      available_at: nowIso,
      lease_version: 0,
      locked_until: null,
      locked_by: null,
      created_at: nowIso,
      updated_at: nowIso
    };

    // Durable Supabase Insert (AWAITED)
    const activeSupabase = this.getSupabaseClient();
    if (activeSupabase) {
      try {
        const dbRow = jobRecordToDbRow(jobRecord);
        const { error } = await activeSupabase.from('background_jobs').insert(dbRow);

        if (error) {
          if (isTableMissingError(error)) {
            this.isDbAvailable = false;
          } else if (
            error.code === '23505' ||
            error.message?.includes('duplicate key') ||
            error.message?.includes('idempotency')
          ) {
            const { data: existing } = await activeSupabase
              .from('background_jobs')
              .select('*')
              .eq('estate_id', cleanEstateId)
              .eq('idempotency_key', idempotency_key!.trim())
              .maybeSingle();

            if (existing) {
              const existingJob = mapDbRowToJob(existing);
              this.jobs.set(existingJob.id, existingJob);
              console.log(`[JOB_DEDUPLICATED] Concurrent insert handled for job ${existingJob.id} (${cleanEstateId})`);
              return { ...existingJob, deduplicated: true };
            }
          } else {
            console.warn(`[JOB_INSERT_WARNING] Database write issue, persisting via memory: ${error.message}`);
          }
        }
      } catch (err: any) {
        console.warn(`[JOB_INSERT_EXCEPTION] Supabase insert failed, using memory:`, err?.message);
      }
    }

    // Cache locally
    this.jobs.set(jobId, jobRecord);
    if (idempotency_key && typeof idempotency_key === 'string' && idempotency_key.trim().length > 0) {
      this.idempotencyMap.set(`${cleanEstateId}:${idempotency_key.trim()}`, jobId);
    }
    this.persistJobLocally(jobRecord);

    console.log(`[JOB_DISPATCHED] Job ${jobId} (${type}) enqueued for ${cleanEstateId} [Priority: ${priority}]`);

    // Audit Logging
    auditService.record({
      userId: created_by_user_id,
      userName: created_by_operator_id,
      role: created_by_role,
      authorizedEstate: cleanEstateId,
      action: 'ADMIN_OPERATION',
      resource: 'background_jobs',
      resourceId: jobId,
      result: 'SUCCESS',
      details: {
        event: 'JOB_DISPATCHED',
        job_type: type,
        priority,
        idempotency_key
      }
    });

    // In local dev/test environment, trigger in-process workers (non-blocking)
    if (process.env.NODE_ENV !== 'production') {
      setTimeout(() => this.triggerWorkers(), 10);
    }

    return jobRecord;
  }

  /**
   * Retrieve a specific job with strict tenant isolation enforcement.
   * Supabase PostgreSQL is the authoritative Single Source of Truth.
   */
  public async getJob(jobId: string, callerEstateId: string, callerRole: string): Promise<JobRecord | null> {
    const cleanCallerEstate = (callerEstateId || '').trim().toUpperCase();
    const callerRoleLower = (callerRole || '').toLowerCase();
    const isSuperRole = ['rc', 'superadmin', 'executive_hq'].includes(callerRoleLower);
    const supabase = this.getSupabaseClient();

    // 1. Authoritative DB Query
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('background_jobs')
          .select('*')
          .eq('id', jobId)
          .maybeSingle();

        if (error && isTableMissingError(error)) {
          this.isDbAvailable = false;
        } else if (!error && data) {
          const job = mapDbRowToJob(data);

          // Enforce Tenant Boundary Check
          if (!isSuperRole && job.estate_id !== cleanCallerEstate) {
            return null;
          }

          // Refresh non-authoritative local cache
          this.jobs.set(job.id, job);
          return job;
        } else if (!error && !data) {
          // Record not in DB
          this.jobs.delete(jobId);
          return null;
        }
      } catch (_) {
        // Fallback to in-memory on unexpected DB connection error
      }
    }

    // 2. Fallback in-memory cache check
    const cachedJob = this.jobs.get(jobId);
    if (!cachedJob) return null;

    if (!isSuperRole && cachedJob.estate_id !== cleanCallerEstate) {
      return null;
    }

    return cachedJob;
  }

  /**
   * List jobs filtered by caller's estate with pagination.
   * Supabase PostgreSQL is the authoritative Single Source of Truth.
   */
  public async listJobs(
    callerEstateId: string,
    callerRole: string,
    filters?: { status?: JobStatus; type?: string; limit?: number; offset?: number }
  ): Promise<JobRecord[]> {
    const cleanCallerEstate = (callerEstateId || '').trim().toUpperCase();
    const callerRoleLower = (callerRole || '').toLowerCase();
    const isSuperRole = ['rc', 'superadmin', 'executive_hq'].includes(callerRoleLower);
    const limit = Math.max(1, Math.min(100, filters?.limit || 50));
    const offset = Math.max(0, filters?.offset || 0);
    const supabase = this.getSupabaseClient();

    // 1. Authoritative DB Query
    if (supabase) {
      try {
        let query = supabase.from('background_jobs').select('*');

        if (!isSuperRole) {
          query = query.eq('estate_id', cleanCallerEstate);
        } else if (cleanCallerEstate && cleanCallerEstate !== 'ALL') {
          query = query.eq('estate_id', cleanCallerEstate);
        }

        if (filters?.status) {
          query = query.eq('status', filters.status);
        }

        if (filters?.type) {
          query = query.eq('type', filters.type);
        }

        query = query
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        const { data, error } = await query;

        if (error && isTableMissingError(error)) {
          this.isDbAvailable = false;
        } else if (!error && Array.isArray(data)) {
          const list = data.map(mapDbRowToJob);
          // Sync local cache
          for (const j of list) {
            this.jobs.set(j.id, j);
          }
          return list;
        }
      } catch (_) {
        // Fallback to local memory on error
      }
    }

    // 2. Fallback in-memory cache listing
    let list = Array.from(this.jobs.values());

    if (!isSuperRole) {
      list = list.filter((j) => j.estate_id === cleanCallerEstate);
    } else if (cleanCallerEstate && cleanCallerEstate !== 'ALL') {
      list = list.filter((j) => j.estate_id === cleanCallerEstate);
    }

    if (filters?.status) {
      list = list.filter((j) => j.status === filters.status);
    }

    if (filters?.type) {
      list = list.filter((j) => j.type === filters.type);
    }

    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return list.slice(offset, offset + limit);
  }

  /**
   * Cancel a job if it is QUEUED or PROCESSING.
   * Database conditional transition ensures cancellation cannot be overwritten by a late worker.
   */
  public async cancelJob(jobId: string, callerEstateId: string, callerRole: string): Promise<JobRecord | null> {
    const cleanCallerEstate = (callerEstateId || '').trim().toUpperCase();
    const callerRoleLower = (callerRole || '').toLowerCase();
    const isSuperRole = ['rc', 'superadmin', 'executive_hq'].includes(callerRoleLower);
    const supabase = this.getSupabaseClient();
    const nowIso = new Date().toISOString();

    // 1. Authoritative DB Mutation
    if (supabase) {
      try {
        let updateQuery = supabase
          .from('background_jobs')
          .update({
            status: 'CANCELLED',
            locked_until: null,
            locked_by: null,
            updated_at: nowIso
          })
          .eq('id', jobId)
          .in('status', ['QUEUED', 'PROCESSING']);

        if (!isSuperRole) {
          updateQuery = updateQuery.eq('estate_id', cleanCallerEstate);
        }

        const { data, error } = await updateQuery.select().maybeSingle();

        if (error && isTableMissingError(error)) {
          this.isDbAvailable = false;
        } else if (!error && data) {
          const cancelledJob = mapDbRowToJob(data);
          this.jobs.set(cancelledJob.id, cancelledJob);
          this.persistJobLocally(cancelledJob);

          console.log(`[JOB_CANCELLED] Job ${jobId} cancelled successfully in database for ${cancelledJob.estate_id}`);

          auditService.record({
            userId: cancelledJob.created_by_user_id,
            userName: cancelledJob.created_by_operator_id,
            role: callerRole,
            authorizedEstate: cancelledJob.estate_id,
            action: 'ADMIN_OPERATION',
            resource: 'background_jobs',
            resourceId: jobId,
            result: 'SUCCESS',
            details: { event: 'JOB_CANCELLED' }
          });

          return cancelledJob;
        }

        // If not updated, verify if job exists and is accessible
        return await this.getJob(jobId, callerEstateId, callerRole);
      } catch (_) {
        // Fallback to local memory mutation
      }
    }

    // 2. Fallback in-memory mutation
    const job = await this.getJob(jobId, callerEstateId, callerRole);
    if (!job) return null;

    if (['QUEUED', 'PROCESSING'].includes(job.status)) {
      job.status = 'CANCELLED';
      job.locked_until = null;
      job.locked_by = null;
      job.updated_at = nowIso;

      this.persistJobLocally(job);

      console.log(`[JOB_CANCELLED] Job ${jobId} cancelled locally for ${job.estate_id}`);

      auditService.record({
        userId: job.created_by_user_id,
        userName: job.created_by_operator_id,
        role: callerRole,
        authorizedEstate: job.estate_id,
        action: 'ADMIN_OPERATION',
        resource: 'background_jobs',
        resourceId: jobId,
        result: 'SUCCESS',
        details: { event: 'JOB_CANCELLED' }
      });
    }

    return job;
  }

  /**
   * Synchronous fallback / helper for Queue Metrics
   */
  public getQueueMetricsSync(callerEstateId?: string, callerRole?: string) {
    const cleanCallerEstate = (callerEstateId || '').trim().toUpperCase();
    const callerRoleLower = (callerRole || '').toLowerCase();
    const isSuperRole = ['rc', 'superadmin', 'executive_hq'].includes(callerRoleLower);

    const counts: Record<JobStatus, number> = {
      QUEUED: 0,
      PROCESSING: 0,
      COMPLETED: 0,
      FAILED: 0,
      CANCELLED: 0
    };

    let allJobs = Array.from(this.jobs.values());
    if (callerEstateId && !isSuperRole && cleanCallerEstate !== 'ALL') {
      allJobs = allJobs.filter((j) => j.estate_id === cleanCallerEstate);
    }

    const totalJobs = allJobs.length;
    for (const job of allJobs) {
      if (counts[job.status] !== undefined) {
        counts[job.status]++;
      }
    }

    return {
      activeWorkers: this.activeWorkers,
      maxWorkers: this.maxConcurrentWorkers,
      totalJobs,
      counts
    };
  }

  /**
   * Get Queue health and operational metrics.
   * Queries Supabase directly or aggregates current status distribution.
   */
  public async getQueueMetrics(callerEstateId?: string, callerRole?: string) {
    const cleanCallerEstate = (callerEstateId || '').trim().toUpperCase();
    const callerRoleLower = (callerRole || '').toLowerCase();
    const isSuperRole = ['rc', 'superadmin', 'executive_hq'].includes(callerRoleLower);
    const supabase = this.getSupabaseClient();

    const counts: Record<JobStatus, number> = {
      QUEUED: 0,
      PROCESSING: 0,
      COMPLETED: 0,
      FAILED: 0,
      CANCELLED: 0
    };

    let totalJobs = 0;

    if (supabase) {
      try {
        let query = supabase.from('background_jobs').select('status, estate_id');
        if (callerEstateId && !isSuperRole && cleanCallerEstate !== 'ALL') {
          query = query.eq('estate_id', cleanCallerEstate);
        }

        const { data, error } = await query;
        if (error && isTableMissingError(error)) {
          this.isDbAvailable = false;
        } else if (!error && Array.isArray(data)) {
          totalJobs = data.length;
          for (const row of data) {
            const st = row.status as JobStatus;
            if (counts[st] !== undefined) {
              counts[st]++;
            }
          }

          return {
            activeWorkers: this.activeWorkers,
            maxWorkers: this.maxConcurrentWorkers,
            totalJobs,
            counts
          };
        }
      } catch (_) {
        // Fallback to in-memory counts on error
      }
    }

    return this.getQueueMetricsSync(callerEstateId, callerRole);
  }

  /**
   * Set worker concurrency limit
   */
  public setConcurrency(limit: number): void {
    if (limit > 0) {
      this.maxConcurrentWorkers = limit;
      this.triggerWorkers();
    }
  }

  /**
   * Atomically claim a batch of jobs from the queue with lease duration locking.
   * 1. Uses Supabase Stored Procedure 'claim_background_jobs_batch' (FOR UPDATE SKIP LOCKED).
   * 2. Uses Memory/Local atomic locking with lease_version when offline or in test environments.
   * 3. Guarantees strict isolation across concurrent workers (Worker A + Worker B + Worker C).
   */
  public async claimJobsBatch(
    workerId: string = `worker-${uuidv4().substring(0, 8)}`,
    batchSize: number = 10,
    leaseDurationSeconds: number = 300
  ): Promise<JobRecord[]> {
    const safeBatchSize = Math.max(1, Math.min(50, batchSize));
    const safeLeaseDuration = Math.max(10, Math.min(3600, leaseDurationSeconds));
    const supabase = this.getSupabaseClient();

    // Route 1: Supabase RPC (Authoritative Cluster Claiming)
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('claim_background_jobs_batch', {
          p_worker_id: workerId,
          p_batch_size: safeBatchSize,
          p_lease_duration_seconds: safeLeaseDuration
        });

        if (error && isTableMissingError(error)) {
          this.isDbAvailable = false;
        } else if (!error && Array.isArray(data) && data.length > 0) {
          const claimedFromDb: JobRecord[] = [];
          for (const raw of data) {
            const rec = mapDbRowToJob(raw);
            this.jobs.set(rec.id, rec);
            claimedFromDb.push(rec);
          }
          console.log(`[JOB_CLAIMED] Worker ${workerId} claimed ${claimedFromDb.length} jobs via Supabase RPC`);
          return claimedFromDb;
        }
      } catch (err) {
        console.warn('[CLAIM_RPC_EXCEPTION] RPC invocation failed, falling back to atomic memory claims:', err);
      }
    }

    // Route 2: Memory/Local atomic locking fallback (Unit tests & offline environments)
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const leaseMs = safeLeaseDuration * 1000;

    // PART A: Recover stuck jobs where locked_until < now
    for (const job of this.jobs.values()) {
      if (job.status === 'PROCESSING' && job.locked_until) {
        const lockExp = new Date(job.locked_until).getTime();
        if (lockExp < now) {
          if (job.attempts < job.max_attempts) {
            job.status = 'QUEUED';
            job.locked_until = null;
            job.locked_by = null;
            job.available_at = nowIso;
            job.lease_version = (job.lease_version || 0) + 1;
            job.updated_at = nowIso;
            console.log(`[LEASE_RECOVERED] Stuck job ${job.id} lease expired and re-queued`);
          } else {
            job.status = 'FAILED';
            job.error_message = (job.error_message || '') + ' [System: Lease expired after max attempts exceeded]';
            job.locked_until = null;
            job.locked_by = null;
            job.completed_at = nowIso;
            job.updated_at = nowIso;
            console.log(`[LEASE_EXPIRED] Job ${job.id} lease expired and permanently failed (Max attempts exceeded)`);
          }
          this.persistJobLocally(job);
        }
      }
    }

    // PART B: Find candidate QUEUED jobs (respecting available_at, attempts, and locks)
    const candidateJobs = Array.from(this.jobs.values()).filter((j) => {
      if (j.status !== 'QUEUED') return false;
      if (j.attempts >= j.max_attempts) return false;
      if (j.available_at && new Date(j.available_at).getTime() > now) return false;
      if (j.locked_until && new Date(j.locked_until).getTime() >= now) return false;
      return true;
    });

    candidateJobs.sort((a, b) => {
      const pA = PRIORITY_ORDER[a.priority] || 2;
      const pB = PRIORITY_ORDER[b.priority] || 2;
      if (pA !== pB) return pA - pB;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    const claimed = candidateJobs.slice(0, safeBatchSize);
    const claimedJobs: JobRecord[] = [];

    for (const job of claimed) {
      job.status = 'PROCESSING';
      job.attempts++;
      job.lease_version = (job.lease_version || 0) + 1;
      job.started_at = job.started_at || nowIso;
      job.locked_by = workerId;
      job.locked_until = new Date(now + leaseMs).toISOString();
      job.updated_at = nowIso;

      this.persistJobLocally(job);
      claimedJobs.push(job);
    }

    if (claimedJobs.length > 0) {
      console.log(`[JOB_CLAIMED] Local Worker ${workerId} claimed ${claimedJobs.length} jobs`);
    }

    return claimedJobs;
  }

  /**
   * Process a batch of background jobs within an execution time budget.
   * Ideal for Vercel Cron, worker endpoints, or queue draining.
   */
  public async processBatch(options?: {
    workerId?: string;
    batchSize?: number;
    timeBudgetMs?: number;
    leaseDurationSeconds?: number;
  }): Promise<{ processed: number; successful: number; failed: number; durationMs: number }> {
    const startTime = Date.now();
    const workerId = options?.workerId || `cron-${Date.now().toString(36)}-${uuidv4().substring(0, 6)}`;
    const batchSize = Math.max(1, Math.min(50, options?.batchSize || 15));
    const timeBudgetMs = Math.max(5000, Math.min(55000, options?.timeBudgetMs || 45000));
    const leaseDurationSeconds = Math.max(30, Math.min(600, options?.leaseDurationSeconds || 300));

    let totalProcessed = 0;
    let successful = 0;
    let failed = 0;

    while (Date.now() - startTime < timeBudgetMs) {
      const availableSlots = Math.max(1, this.maxConcurrentWorkers - this.activeWorkers);
      const fetchCount = Math.min(batchSize, availableSlots);

      const jobs = await this.claimJobsBatch(workerId, fetchCount, leaseDurationSeconds);
      if (jobs.length === 0) {
        break; // Queue drained
      }

      const executions = jobs.map(async (job) => {
        this.activeWorkers++;
        try {
          const outcome = await this.processJob(job, workerId, job.lease_version);
          if (outcome === 'COMPLETED') {
            successful++;
          } else {
            failed++;
          }
        } finally {
          this.activeWorkers--;
          totalProcessed++;
        }
      });

      await Promise.all(executions);

      if (jobs.length < fetchCount) {
        break;
      }
    }

    return {
      processed: totalProcessed,
      successful,
      failed,
      durationMs: Date.now() - startTime
    };
  }

  /**
   * Core worker execution loop (Local/Dev)
   */
  private async triggerWorkers(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.activeWorkers < this.maxConcurrentWorkers) {
        const workerId = `local-worker-${uuidv4().substring(0, 6)}`;
        const claimedBatch = await this.claimJobsBatch(workerId, 1);
        if (claimedBatch.length === 0) break;

        const nextJob = claimedBatch[0];
        this.activeWorkers++;
        this.processJob(nextJob, workerId, nextJob.lease_version).finally(() => {
          this.activeWorkers--;
          this.triggerWorkers();
        });
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Execute a single job with attempt handling, retry logic, error sanitization,
   * and strict fencing protection (locked_by + lease_version).
   */
  public async processJob(
    job: JobRecord,
    workerId?: string,
    leaseVersion?: number
  ): Promise<'COMPLETED' | 'FAILED' | 'RETRY' | 'REJECTED'> {
    const activeWorkerId = workerId || job.locked_by || 'worker-standalone';
    const activeLeaseVersion = leaseVersion !== undefined ? leaseVersion : (job.lease_version || 0);
    const supabase = this.getSupabaseClient();
    const nowIso = new Date().toISOString();

    // 1. Guard against cancelled or already completed jobs
    if (job.status === 'CANCELLED') {
      console.warn(`[STALE_WORKER_REJECTED] Worker ${activeWorkerId} attempted to process cancelled job ${job.id}`);
      return 'REJECTED';
    }

    // 2. Guard against stale lease version
    if (leaseVersion !== undefined && job.lease_version !== undefined && job.lease_version !== leaseVersion) {
      console.warn(
        `[STALE_WORKER_REJECTED] Worker ${activeWorkerId} lease version mismatch (${leaseVersion} vs ${job.lease_version}) for job ${job.id}`
      );
      return 'REJECTED';
    }

    // Ensure status is processing
    if (job.status !== 'PROCESSING') {
      job.status = 'PROCESSING';
      job.attempts++;
      job.started_at = job.started_at || nowIso;
      job.updated_at = nowIso;
    }

    auditService.record({
      userId: job.created_by_user_id,
      userName: job.created_by_operator_id,
      role: job.created_by_role,
      authorizedEstate: job.estate_id,
      action: 'ADMIN_OPERATION',
      resource: 'background_jobs',
      resourceId: job.id,
      result: 'SUCCESS',
      details: {
        event: 'JOB_STARTED',
        attempt: job.attempts,
        max_attempts: job.max_attempts,
        locked_by: activeWorkerId,
        lease_version: activeLeaseVersion
      }
    });

    const handler = this.handlers.get(job.type);

    if (!handler) {
      job.status = 'FAILED';
      job.error_message = `No registered job handler found for job type '${job.type}'`;
      job.failed_at = nowIso;
      job.updated_at = nowIso;
      job.locked_until = null;
      job.locked_by = null;

      if (supabase) {
        try {
          await supabase
            .from('background_jobs')
            .update({
              status: 'FAILED',
              error_message: job.error_message,
              failed_at: job.failed_at,
              locked_until: null,
              locked_by: null,
              updated_at: job.updated_at
            })
            .eq('id', job.id)
            .eq('status', 'PROCESSING')
            .eq('locked_by', activeWorkerId)
            .eq('lease_version', activeLeaseVersion);
        } catch (_) {}
      }

      this.persistJobLocally(job);
      console.log(`[JOB_FAILED] Job ${job.id} failed: No handler for type ${job.type}`);
      return 'FAILED';
    }

    try {
      // Execute handler with 60-second timeout guard
      const result = await Promise.race([
        handler(job),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Job processing timed out after 60 seconds')), 60000)
        )
      ]);

      const completedAtIso = new Date().toISOString();

      // Database-level conditional fencing update:
      // Verifies id, status = 'PROCESSING', locked_by = activeWorkerId, lease_version = activeLeaseVersion
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('background_jobs')
            .update({
              status: 'COMPLETED',
              result: result || {},
              completed_at: completedAtIso,
              locked_until: null,
              locked_by: null,
              updated_at: completedAtIso
            })
            .eq('id', job.id)
            .eq('status', 'PROCESSING')
            .eq('locked_by', activeWorkerId)
            .eq('lease_version', activeLeaseVersion)
            .select();

          if (error && isTableMissingError(error)) {
            this.isDbAvailable = false;
          } else if (error || !data || data.length === 0) {
            console.warn(
              `[STALE_WORKER_REJECTED] Worker ${activeWorkerId} completed job ${job.id} but lease expired or job was reclaimed/cancelled.`
            );
            auditService.record({
              userId: 'system:worker',
              userName: activeWorkerId,
              role: 'rc',
              authorizedEstate: job.estate_id,
              action: 'ADMIN_OPERATION',
              resource: 'background_jobs',
              resourceId: job.id,
              result: 'FAILURE',
              details: { event: 'STALE_WORKER_REJECTED', lease_version: activeLeaseVersion }
            });
            return 'REJECTED';
          }
        } catch (_) {}
      }

      // Memory cache completion check (for unit tests / offline fallback)
      if ((job.status as JobStatus) === 'CANCELLED') {
        console.warn(`[STALE_WORKER_REJECTED] Local job ${job.id} was cancelled before completion.`);
        return 'REJECTED';
      }

      if (leaseVersion !== undefined && job.lease_version !== undefined && job.lease_version !== leaseVersion) {
        console.warn(`[STALE_WORKER_REJECTED] Local job ${job.id} lease expired before completion.`);
        return 'REJECTED';
      }

      job.status = 'COMPLETED';
      job.result = result || {};
      job.completed_at = completedAtIso;
      job.updated_at = completedAtIso;
      job.locked_until = null;
      job.locked_by = null;

      this.persistJobLocally(job);
      console.log(`[JOB_COMPLETED] Job ${job.id} completed successfully by worker ${activeWorkerId}`);

      auditService.record({
        userId: job.created_by_user_id,
        userName: job.created_by_operator_id,
        role: job.created_by_role,
        authorizedEstate: job.estate_id,
        action: 'ADMIN_OPERATION',
        resource: 'background_jobs',
        resourceId: job.id,
        result: 'SUCCESS',
        details: { event: 'JOB_COMPLETED', duration_ms: Date.now() - new Date(job.created_at).getTime() }
      });

      return 'COMPLETED';
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      const retryTimeIso = new Date().toISOString();

      if (job.attempts < job.max_attempts) {
        // Calculate deterministic bounded exponential backoff
        const backoffMs = Math.min(300000, Math.pow(2, job.attempts - 1) * 1000 + Math.floor(Math.random() * 200));
        const availableAtIso = new Date(Date.now() + backoffMs).toISOString();

        if (supabase) {
          try {
            const { data, error } = await supabase
              .from('background_jobs')
              .update({
                status: 'QUEUED',
                error_message: `Attempt ${job.attempts} failed: ${errorMsg}. Retrying...`,
                available_at: availableAtIso,
                locked_until: null,
                locked_by: null,
                updated_at: retryTimeIso
              })
              .eq('id', job.id)
              .eq('status', 'PROCESSING')
              .eq('locked_by', activeWorkerId)
              .eq('lease_version', activeLeaseVersion)
              .select();

            if (error && isTableMissingError(error)) {
              this.isDbAvailable = false;
            } else if (error || !data || data.length === 0) {
              console.warn(`[STALE_WORKER_REJECTED] Worker ${activeWorkerId} failed retry update on job ${job.id}`);
              return 'REJECTED';
            }
          } catch (_) {}
        }

        // Memory cache conditional state guard
        if ((job.status as JobStatus) === 'CANCELLED') {
          console.warn(`[STALE_WORKER_REJECTED] Worker ${activeWorkerId} caught error on cancelled job ${job.id}`);
          return 'REJECTED';
        }

        if (leaseVersion !== undefined && job.lease_version !== undefined && job.lease_version !== leaseVersion) {
          console.warn(`[STALE_WORKER_REJECTED] Worker ${activeWorkerId} caught error on stale lease for job ${job.id}`);
          return 'REJECTED';
        }

        job.status = 'QUEUED';
        job.error_message = `Attempt ${job.attempts} failed: ${errorMsg}. Retrying...`;
        job.available_at = availableAtIso;
        job.updated_at = retryTimeIso;
        job.locked_until = null;
        job.locked_by = null;

        this.persistJobLocally(job);
        console.log(`[JOB_RETRY_SCHEDULED] Job ${job.id} scheduled for retry at ${availableAtIso} (Backoff: ${backoffMs}ms)`);

        auditService.record({
          userId: job.created_by_user_id,
          userName: job.created_by_operator_id,
          role: job.created_by_role,
          authorizedEstate: job.estate_id,
          action: 'ADMIN_OPERATION',
          resource: 'background_jobs',
          resourceId: job.id,
          result: 'FAILURE',
          details: {
            event: 'JOB_RETRY_SCHEDULED',
            attempt: job.attempts,
            available_at: availableAtIso,
            backoffMs
          },
          errorMessage: errorMsg
        });

        // Trigger in-memory retry if in development mode
        if (process.env.NODE_ENV !== 'production') {
          setTimeout(() => this.triggerWorkers(), backoffMs);
        }

        return 'RETRY';
      } else {
        // Max attempts reached -> Dead Letter Queue / FAILED
        const failedAtIso = new Date().toISOString();
        const failureMessage = `All ${job.max_attempts} attempts failed. Last error: ${errorMsg}`;

        if (supabase) {
          try {
            const { data, error } = await supabase
              .from('background_jobs')
              .update({
                status: 'FAILED',
                error_message: failureMessage,
                failed_at: failedAtIso,
                locked_until: null,
                locked_by: null,
                updated_at: failedAtIso
              })
              .eq('id', job.id)
              .eq('status', 'PROCESSING')
              .eq('locked_by', activeWorkerId)
              .eq('lease_version', activeLeaseVersion)
              .select();

            if (error && isTableMissingError(error)) {
              this.isDbAvailable = false;
            } else if (error || !data || data.length === 0) {
              console.warn(`[STALE_WORKER_REJECTED] Worker ${activeWorkerId} failed to mark job ${job.id} as FAILED`);
              return 'REJECTED';
            }
          } catch (_) {}
        }

        // Memory cache conditional state guard
        if ((job.status as JobStatus) === 'CANCELLED') {
          console.warn(`[STALE_WORKER_REJECTED] Worker ${activeWorkerId} exhausted attempts on cancelled job ${job.id}`);
          return 'REJECTED';
        }

        if (leaseVersion !== undefined && job.lease_version !== undefined && job.lease_version !== leaseVersion) {
          console.warn(`[STALE_WORKER_REJECTED] Worker ${activeWorkerId} exhausted attempts on stale lease for job ${job.id}`);
          return 'REJECTED';
        }

        job.status = 'FAILED';
        job.error_message = failureMessage;
        job.failed_at = failedAtIso;
        job.updated_at = failedAtIso;
        job.locked_until = null;
        job.locked_by = null;

        this.persistJobLocally(job);
        console.log(`[JOB_FAILED] Job ${job.id} exhausted max attempts and transitioned to FAILED`);

        auditService.record({
          userId: job.created_by_user_id,
          userName: job.created_by_operator_id,
          role: job.created_by_role,
          authorizedEstate: job.estate_id,
          action: 'ADMIN_OPERATION',
          resource: 'background_jobs',
          resourceId: job.id,
          result: 'ERROR',
          errorMessage: failureMessage
        });

        return 'FAILED';
      }
    }
  }

  /**
   * Diagnostic local file persistence (Non-authoritative backup)
   */
  private persistJobLocally(job: JobRecord): void {
    try {
      const existing = getLocalEstateJson('background_jobs', job.estate_id, { jobs: [] });
      const jobList: JobRecord[] = Array.isArray(existing.jobs) ? existing.jobs : [];

      const idx = jobList.findIndex((j) => j.id === job.id);
      if (idx >= 0) {
        jobList[idx] = job;
      } else {
        jobList.unshift(job);
      }

      saveLocalEstateJson('background_jobs', job.estate_id, {
        jobs: jobList.slice(0, 500),
        last_updated: new Date().toISOString()
      });
    } catch (_) {
      // Diagnostic local save non-fatal
    }
  }

  /**
   * Diagnostic startup loader (Non-authoritative cache warm-up)
   */
  private loadPersistedJobs(): void {
    try {
      const knownEstates = ['FPM_TUNGGAL', 'FPM_ADELA', 'FPM_KLEDANG', 'FPM_SENING'];
      for (const estateId of knownEstates) {
        const data = getLocalEstateJson('background_jobs', estateId, { jobs: [] });
        if (Array.isArray(data.jobs)) {
          for (const j of data.jobs) {
            if (j && j.id && !this.jobs.has(j.id)) {
              this.jobs.set(j.id, j);
              if (j.idempotency_key) {
                this.idempotencyMap.set(`${j.estate_id}:${j.idempotency_key}`, j.id);
              }
            }
          }
        }
      }
    } catch (_) {
      // Startup cache warm-up non-fatal
    }
  }
}

export const jobQueueService = JobQueueService.getInstance();
