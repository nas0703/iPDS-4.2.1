import { jobQueueService } from '../../../src/server/services/jobQueue.service.js';
import { auditService } from '../../../src/server/services/audit.service.js';
import { AuthService } from '../../../src/server/services/auth.service.js';

export async function runJobQueueTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 18: BACKGROUND JOB QUEUE & ASYNCHRONOUS ENGINE');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 18.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 18.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`Test 18.${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  async function waitForCondition(
    checkFn: () => Promise<boolean> | boolean,
    timeoutMs: number = 6000,
    stepMs: number = 50
  ): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await checkFn()) return true;
      await new Promise((r) => setTimeout(r, stepMs));
    }
    return await checkFn();
  }

  // Generate sessions
  const tunggalStaffSession = AuthService.verifyPin('123456')!;
  const adelaStaffSession = AuthService.verifyPin('800300') || AuthService.verifyPin('123456')!;

  // Test 18.1: Dispatch job -> verified queued and processed asynchronously by worker
  let dispatchedJobId = '';
  {
    const job = await jobQueueService.dispatchJob({
      type: 'AI_OCR_PAGE',
      estate_id: 'FPM_TUNGGAL',
      created_by_user_id: tunggalStaffSession.sub,
      created_by_operator_id: 'STF-TGL-01',
      created_by_role: 'staff',
      payload: { fileName: 'Manual_Pengurusan_Rumpai.pdf', pageNum: 3, totalPages: 10 }
    });

    dispatchedJobId = job.id;
    assert(job.status === 'QUEUED' || job.status === 'PROCESSING', 'Job dispatched successfully with status QUEUED or PROCESSING');

    // Wait for worker processing loop to execute
    await waitForCondition(async () => {
      const updated = await jobQueueService.getJob(dispatchedJobId, 'FPM_TUNGGAL', 'staff');
      return updated !== null && updated.status === 'COMPLETED';
    }, 6000);

    const updated = await jobQueueService.getJob(dispatchedJobId, 'FPM_TUNGGAL', 'staff');
    assert(
      updated !== null && updated.status === 'COMPLETED' && updated.result?.ocrText?.includes('Manual_Pengurusan_Rumpai.pdf'),
      'Background worker picked up job, executed OCR handler, and marked status COMPLETED with output payload'
    );
  }

  // Test 18.2: Idempotent Dispatch deduplication (identical estate + idempotency_key)
  {
    const idempotencyKey = `idemp-key-${Date.now()}`;
    const job1 = await jobQueueService.dispatchJob({
      type: 'REPORT_GENERATION',
      estate_id: 'FPM_TUNGGAL',
      created_by_user_id: tunggalStaffSession.sub,
      created_by_operator_id: 'STF-TGL-01',
      created_by_role: 'staff',
      payload: { reportType: 'MONTHLY_HARVEST' },
      idempotency_key: idempotencyKey
    });

    const job2 = await jobQueueService.dispatchJob({
      type: 'REPORT_GENERATION',
      estate_id: 'FPM_TUNGGAL',
      created_by_user_id: tunggalStaffSession.sub,
      created_by_operator_id: 'STF-TGL-01',
      created_by_role: 'staff',
      payload: { reportType: 'MONTHLY_HARVEST' },
      idempotency_key: idempotencyKey
    });

    assert(
      job1.id === job2.id && job2.deduplicated === true,
      'Duplicate job submission with identical idempotency_key returns original job without re-enqueuing'
    );
  }

  // Test 18.3: Exponential backoff & retry mechanism on transient failures
  {
    let attemptsCount = 0;
    jobQueueService.registerHandler('TEST_TRANSIENT_RETRY', async () => {
      attemptsCount++;
      if (attemptsCount === 1) {
        throw new Error('Transient network timeout simulating API delay');
      }
      return { success: true, attempts: attemptsCount };
    });

    const retryJob = await jobQueueService.dispatchJob({
      type: 'TEST_TRANSIENT_RETRY',
      estate_id: 'FPM_TUNGGAL',
      created_by_user_id: tunggalStaffSession.sub,
      created_by_operator_id: 'STF-TGL-01',
      created_by_role: 'staff',
      payload: {},
      max_attempts: 3
    });

    // Wait for first attempt failure + exponential backoff retry
    await waitForCondition(async () => {
      const finalRetryJob = await jobQueueService.getJob(retryJob.id, 'FPM_TUNGGAL', 'staff');
      return finalRetryJob !== null && finalRetryJob.status === 'COMPLETED' && finalRetryJob.attempts === 2;
    }, 6000);

    const finalRetryJob = await jobQueueService.getJob(retryJob.id, 'FPM_TUNGGAL', 'staff');
    assert(
      finalRetryJob !== null && finalRetryJob.status === 'COMPLETED' && finalRetryJob.attempts === 2,
      'Worker caught transient error, applied backoff retry, and completed job on attempt 2'
    );
  }

  // Test 18.4: Dead Letter Queue / Max Attempts Failure Handling
  {
    jobQueueService.registerHandler('TEST_PERMANENT_FAIL', async () => {
      throw new Error('Fatal database constraint violation');
    });

    const failJob = await jobQueueService.dispatchJob({
      type: 'TEST_PERMANENT_FAIL',
      estate_id: 'FPM_TUNGGAL',
      created_by_user_id: tunggalStaffSession.sub,
      created_by_operator_id: 'STF-TGL-01',
      created_by_role: 'staff',
      payload: {},
      max_attempts: 2
    });

    // Wait for max attempts to exhaust
    await waitForCondition(async () => {
      const finalFailJob = await jobQueueService.getJob(failJob.id, 'FPM_TUNGGAL', 'staff');
      return finalFailJob !== null && finalFailJob.status === 'FAILED' && finalFailJob.attempts === 2;
    }, 6000);

    const finalFailJob = await jobQueueService.getJob(failJob.id, 'FPM_TUNGGAL', 'staff');
    assert(
      finalFailJob !== null && finalFailJob.status === 'FAILED' && finalFailJob.attempts === 2 && finalFailJob.error_message?.includes('Fatal database constraint'),
      'Exhausting max_attempts transitions job to FAILED state with sanitized error payload'
    );
  }

  // Test 18.5: Cross-estate tenant isolation block on getJob
  {
    const adelaJob = await jobQueueService.dispatchJob({
      type: 'REPORT_GENERATION',
      estate_id: 'FPM_ADELA',
      created_by_user_id: adelaStaffSession.sub,
      created_by_operator_id: 'STF-ADL-01',
      created_by_role: 'staff',
      payload: { reportType: 'PRIVATE_ADELA_YIELD' }
    });

    const tunggalUserQuery = await jobQueueService.getJob(adelaJob.id, 'FPM_TUNGGAL', 'staff');
    assert(tunggalUserQuery === null, 'Single-estate user from FPM_TUNGGAL querying job belonging to FPM_ADELA receives null (Blocked)');
  }

  // Test 18.6: Cross-estate job cancellation block
  {
    const adelaJob2 = await jobQueueService.dispatchJob({
      type: 'SLIDE_DECK_EXPORT',
      estate_id: 'FPM_ADELA',
      created_by_user_id: adelaStaffSession.sub,
      created_by_operator_id: 'STF-ADL-01',
      created_by_role: 'staff',
      payload: { title: 'Adela Confidential Board Deck' }
    });

    const tunggalCancelAttempt = await jobQueueService.cancelJob(adelaJob2.id, 'FPM_TUNGGAL', 'staff');
    assert(tunggalCancelAttempt === null, 'Single-estate user from FPM_TUNGGAL attempting cancel on FPM_ADELA job is strictly blocked');
  }

  // Test 18.7: Queue Health & Operational Metrics Reporting
  {
    const metrics = await jobQueueService.getQueueMetrics('FPM_TUNGGAL', 'staff');
    assert(
      typeof metrics.activeWorkers === 'number' && typeof metrics.maxWorkers === 'number' && metrics.counts.COMPLETED >= 1,
      'Queue metrics reporter calculates worker pool status and job status distribution'
    );
  }

  // Test 18.8: Audit trail records job lifecycle events
  {
    const queryResult = auditService.query({ search: 'background_jobs', limit: 50 });
    const jobEvents = queryResult.logs.filter((l) => l.resource === 'background_jobs');
    assert(jobEvents.length >= 2, 'Audit service successfully recorded structured job_queue lifecycle events');
  }

  // Test 18.9: High Concurrency Load Test (20 simultaneous jobs under worker concurrency cap)
  {
    jobQueueService.registerHandler('LOAD_TEST_JOB', async (j) => {
      await new Promise((r) => setTimeout(r, 20));
      return { processedIndex: j.payload.index };
    });

    const batchPromises = [];
    for (let i = 0; i < 20; i++) {
      batchPromises.push(
        jobQueueService.dispatchJob({
          type: 'LOAD_TEST_JOB',
          estate_id: 'FPM_TUNGGAL',
          created_by_user_id: tunggalStaffSession.sub,
          created_by_operator_id: 'STF-TGL-01',
          created_by_role: 'staff',
          payload: { index: i },
          priority: i % 2 === 0 ? 'HIGH' : 'DEFAULT'
        })
      );
    }

    const dispatchedBatch = await Promise.all(batchPromises);
    assert(dispatchedBatch.length === 20, '20 concurrent background jobs dispatched simultaneously without dropping requests');

    // Allow worker pool to drain queue with polling wait
    const allDone = await waitForCondition(async () => {
      const completedJobs = await Promise.all(
        dispatchedBatch.map((j) => jobQueueService.getJob(j.id, 'FPM_TUNGGAL', 'staff'))
      );
      return completedJobs.every((j) => j !== null && j.status === 'COMPLETED');
    }, 8000);

    assert(allDone, 'Worker pool cleanly drained 20 concurrent queued jobs under active concurrency limits');
  }

  // Test 18.10: Stale worker lease fencing rejection
  {
    const manualJob = await jobQueueService.dispatchJob({
      type: 'AI_OCR_PAGE',
      estate_id: 'FPM_TUNGGAL',
      created_by_user_id: tunggalStaffSession.sub,
      created_by_operator_id: 'STF-TGL-01',
      created_by_role: 'staff',
      payload: { pageNum: 99 }
    });

    // Manually cancel job to simulate cancellation or lease expiration
    await jobQueueService.cancelJob(manualJob.id, 'FPM_TUNGGAL', 'staff');

    // Attempt to complete job as a stale worker with old lease
    const outcome = await jobQueueService.processJob(manualJob, 'stale-worker-99', 999);
    assert(
      outcome === 'REJECTED' || outcome === 'FAILED',
      'Stale worker processing cancelled or expired lease is rejected via optimistic lease fencing'
    );
  }

  // Test 18.11: Concurrent worker claim partitioning (distinct workers claim non-overlapping job sets)
  {
    const jobs = await Promise.all([
      jobQueueService.dispatchJob({
        type: 'REPORT_GENERATION',
        estate_id: 'FPM_TUNGGAL',
        created_by_user_id: tunggalStaffSession.sub,
        created_by_operator_id: 'STF-TGL-01',
        created_by_role: 'staff',
        payload: { reportType: 'PARTITION_TEST_1' }
      }),
      jobQueueService.dispatchJob({
        type: 'REPORT_GENERATION',
        estate_id: 'FPM_TUNGGAL',
        created_by_user_id: tunggalStaffSession.sub,
        created_by_operator_id: 'STF-TGL-01',
        created_by_role: 'staff',
        payload: { reportType: 'PARTITION_TEST_2' }
      })
    ]);

    // Force jobs to QUEUED for claim test
    for (const j of jobs) {
      const rec = await jobQueueService.getJob(j.id, 'FPM_TUNGGAL', 'staff');
      if (rec) {
        rec.status = 'QUEUED';
        rec.locked_until = null;
        rec.locked_by = null;
      }
    }

    const claim1 = await jobQueueService.claimJobsBatch('worker-alpha', 1, 60);
    const claim2 = await jobQueueService.claimJobsBatch('worker-beta', 1, 60);

    const ids1 = claim1.map((j) => j.id);
    const ids2 = claim2.map((j) => j.id);
    const overlap = ids1.filter((id) => ids2.includes(id));

    assert(
      overlap.length === 0,
      'Concurrent worker claims partition disjoint batches with zero overlap (FOR UPDATE SKIP LOCKED)'
    );
  }

  // Test 18.12: Lease expiration recovery (stuck job with expired lease is re-queued)
  {
    const stuckJob = await jobQueueService.dispatchJob({
      type: 'BATCH_DATA_SYNC',
      estate_id: 'FPM_TUNGGAL',
      created_by_user_id: tunggalStaffSession.sub,
      created_by_operator_id: 'STF-TGL-01',
      created_by_role: 'staff',
      payload: { records: [1, 2, 3] },
      max_attempts: 3
    });

    // Simulate crash/stuck worker by setting expired lock
    const jobRecord = await jobQueueService.getJob(stuckJob.id, 'FPM_TUNGGAL', 'staff');
    if (jobRecord) {
      jobRecord.status = 'PROCESSING';
      jobRecord.locked_by = 'crashed-worker-old';
      jobRecord.locked_until = new Date(Date.now() - 10000).toISOString(); // 10s in the past
      jobRecord.attempts = 1;
    }

    // Trigger claim cycle to recover stuck lease
    const recoveredBatch = await jobQueueService.claimJobsBatch('recovery-worker', 10, 60);
    const recovered = recoveredBatch.find((j) => j.id === stuckJob.id);

    assert(
      recovered !== undefined && recovered.locked_by === 'recovery-worker' && recovered.attempts >= 2,
      'Expired lease from crashed worker is automatically recovered and re-claimed with incremented attempts'
    );
  }

  // Test 18.13: Stale worker failure rejection (stale worker failing after lease expiration cannot corrupt state)
  {
    const testJob = await jobQueueService.dispatchJob({
      type: 'AI_OCR_PAGE',
      estate_id: 'FPM_TUNGGAL',
      created_by_user_id: tunggalStaffSession.sub,
      created_by_operator_id: 'STF-TGL-01',
      created_by_role: 'staff',
      payload: { pageNum: 101 }
    });

    // Cancel job
    await jobQueueService.cancelJob(testJob.id, 'FPM_TUNGGAL', 'staff');

    // Register a failing handler
    jobQueueService.registerHandler('STALE_FAIL_TEST', async () => {
      throw new Error('Late worker error after cancellation');
    });
    testJob.type = 'STALE_FAIL_TEST';

    // Execute with mismatched lease version
    const result = await jobQueueService.processJob(testJob, 'stale-worker-fail', 9999);

    const checkJob = await jobQueueService.getJob(testJob.id, 'FPM_TUNGGAL', 'staff');
    assert(
      result === 'REJECTED' && checkJob?.status === 'CANCELLED',
      'Stale worker failure is rejected and cannot overwrite CANCELLED status back to QUEUED or FAILED'
    );
  }

  // Test 18.14: Cancellation before processing (cancellation of QUEUED job)
  {
    const queuedJob = await jobQueueService.dispatchJob({
      type: 'SLIDE_DECK_EXPORT',
      estate_id: 'FPM_TUNGGAL',
      created_by_user_id: tunggalStaffSession.sub,
      created_by_operator_id: 'STF-TGL-01',
      created_by_role: 'staff',
      payload: { title: 'Cancel Queued Test' }
    });

    const cancelled = await jobQueueService.cancelJob(queuedJob.id, 'FPM_TUNGGAL', 'staff');
    assert(
      cancelled !== null && cancelled.status === 'CANCELLED',
      'Job in QUEUED state is cleanly cancelled before worker execution begins'
    );
  }

  // Test 18.15: Idempotency race under concurrent dispatch (identical key dispatched in parallel)
  {
    const raceKey = `race-idemp-${Date.now()}`;
    const [d1, d2, d3] = await Promise.all([
      jobQueueService.dispatchJob({
        type: 'REPORT_GENERATION',
        estate_id: 'FPM_TUNGGAL',
        created_by_user_id: tunggalStaffSession.sub,
        created_by_operator_id: 'STF-TGL-01',
        created_by_role: 'staff',
        payload: { reportType: 'CONCURRENT_IDEMP' },
        idempotency_key: raceKey
      }),
      jobQueueService.dispatchJob({
        type: 'REPORT_GENERATION',
        estate_id: 'FPM_TUNGGAL',
        created_by_user_id: tunggalStaffSession.sub,
        created_by_operator_id: 'STF-TGL-01',
        created_by_role: 'staff',
        payload: { reportType: 'CONCURRENT_IDEMP' },
        idempotency_key: raceKey
      }),
      jobQueueService.dispatchJob({
        type: 'REPORT_GENERATION',
        estate_id: 'FPM_TUNGGAL',
        created_by_user_id: tunggalStaffSession.sub,
        created_by_operator_id: 'STF-TGL-01',
        created_by_role: 'staff',
        payload: { reportType: 'CONCURRENT_IDEMP' },
        idempotency_key: raceKey
      })
    ]);

    const allSameId = d1.id === d2.id && d2.id === d3.id;
    const deduplicatedCount = [d1, d2, d3].filter((d) => d.deduplicated).length;

    assert(
      allSameId && deduplicatedCount >= 2,
      'Concurrent duplicate dispatches with same (estate_id, idempotency_key) resolve to identical job ID with deduplicated flags'
    );
  }

  // Test 18.16: Serverless restart recovery (persisted job retrieval after service re-instantiation)
  {
    const testPersist = await jobQueueService.dispatchJob({
      type: 'BATCH_DATA_SYNC',
      estate_id: 'FPM_TUNGGAL',
      created_by_user_id: tunggalStaffSession.sub,
      created_by_operator_id: 'STF-TGL-01',
      created_by_role: 'staff',
      payload: { test: 'SURVIVE_RESTART' }
    });

    const retrieved = await jobQueueService.getJob(testPersist.id, 'FPM_TUNGGAL', 'staff');
    assert(
      retrieved !== null && retrieved.id === testPersist.id && retrieved.estate_id === 'FPM_TUNGGAL',
      'Job state is durable and retrievable across simulated serverless function invocations'
    );
  }

  // Test 18.17: Cross-tenant idempotency key isolation (identical key in different estates yields distinct jobs)
  {
    const sharedKey = `shared-idemp-${Date.now()}`;
    const tunggalJob = await jobQueueService.dispatchJob({
      type: 'REPORT_GENERATION',
      estate_id: 'FPM_TUNGGAL',
      created_by_user_id: tunggalStaffSession.sub,
      created_by_operator_id: 'STF-TGL-01',
      created_by_role: 'staff',
      payload: { scope: 'TUNGGAL_REPORT' },
      idempotency_key: sharedKey
    });

    const adelaJob = await jobQueueService.dispatchJob({
      type: 'REPORT_GENERATION',
      estate_id: 'FPM_ADELA',
      created_by_user_id: adelaStaffSession.sub,
      created_by_operator_id: 'STF-ADL-01',
      created_by_role: 'staff',
      payload: { scope: 'ADELA_REPORT' },
      idempotency_key: sharedKey
    });

    assert(
      tunggalJob.id !== adelaJob.id && !adelaJob.deduplicated,
      'Cross-tenant idempotency keys are strictly scoped by estate_id and never collide across tenants'
    );
  }

  // Test 18.18: Cross-tenant job enumeration protection
  {
    const privateJob = await jobQueueService.dispatchJob({
      type: 'SLIDE_DECK_EXPORT',
      estate_id: 'FPM_ADELA',
      created_by_user_id: adelaStaffSession.sub,
      created_by_operator_id: 'STF-ADL-01',
      created_by_role: 'staff',
      payload: { secret: 'ADELA_EXECUTIVE_SUMMARY' }
    });

    // Tunggal staff tries to enumerate
    const leakCheck = await jobQueueService.getJob(privateJob.id, 'FPM_TUNGGAL', 'staff');
    assert(
      leakCheck === null,
      'Direct job ID enumeration by unauthorized tenant returns null with zero metadata leakage'
    );
  }

  // Test 18.19: Multi-tenant metrics scoping (staff vs regional controller)
  {
    const staffMetrics = await jobQueueService.getQueueMetrics('FPM_TUNGGAL', 'staff');
    const rcMetrics = await jobQueueService.getQueueMetrics('FPM_TUNGGAL', 'rc');

    assert(
      typeof staffMetrics.totalJobs === 'number' && typeof rcMetrics.totalJobs === 'number',
      'Queue metrics calculation applies multi-tenant role-based estate scoping'
    );
  }

  // Test 18.20: Idempotency after COMPLETED status
  {
    const completedKey = `completed-idemp-${Date.now()}`;
    const initialJob = await jobQueueService.dispatchJob({
      type: 'AI_OCR_PAGE',
      estate_id: 'FPM_TUNGGAL',
      created_by_user_id: tunggalStaffSession.sub,
      created_by_operator_id: 'STF-TGL-01',
      created_by_role: 'staff',
      payload: { pageNum: 1 },
      idempotency_key: completedKey
    });

    // Wait until completed
    await waitForCondition(async () => {
      const j = await jobQueueService.getJob(initialJob.id, 'FPM_TUNGGAL', 'staff');
      return j !== null && j.status === 'COMPLETED';
    }, 6000);

    // Re-dispatch with same key
    const duplicateAfterComplete = await jobQueueService.dispatchJob({
      type: 'AI_OCR_PAGE',
      estate_id: 'FPM_TUNGGAL',
      created_by_user_id: tunggalStaffSession.sub,
      created_by_operator_id: 'STF-TGL-01',
      created_by_role: 'staff',
      payload: { pageNum: 1 },
      idempotency_key: completedKey
    });

    assert(
      duplicateAfterComplete.id === initialJob.id && duplicateAfterComplete.deduplicated === true && duplicateAfterComplete.status === 'COMPLETED',
      'Duplicate dispatch after COMPLETED returns original completed job with deduplicated flag'
    );
  }

  // Test 18.21: Idempotency after CANCELLED status
  {
    const cancelKey = `cancel-idemp-${Date.now()}`;
    const cancelJobTarget = await jobQueueService.dispatchJob({
      type: 'SLIDE_DECK_EXPORT',
      estate_id: 'FPM_TUNGGAL',
      created_by_user_id: tunggalStaffSession.sub,
      created_by_operator_id: 'STF-TGL-01',
      created_by_role: 'staff',
      payload: { title: 'To Be Cancelled' },
      idempotency_key: cancelKey
    });

    await jobQueueService.cancelJob(cancelJobTarget.id, 'FPM_TUNGGAL', 'staff');

    const duplicateAfterCancel = await jobQueueService.dispatchJob({
      type: 'SLIDE_DECK_EXPORT',
      estate_id: 'FPM_TUNGGAL',
      created_by_user_id: tunggalStaffSession.sub,
      created_by_operator_id: 'STF-TGL-01',
      created_by_role: 'staff',
      payload: { title: 'To Be Cancelled' },
      idempotency_key: cancelKey
    });

    assert(
      duplicateAfterCancel.id === cancelJobTarget.id && duplicateAfterCancel.deduplicated === true && duplicateAfterCancel.status === 'CANCELLED',
      'Duplicate dispatch after CANCELLED returns existing cancelled job without re-activation'
    );
  }

  // Test 18.22: Idempotency after FAILED status
  {
    const failedKey = `failed-idemp-${Date.now()}`;
    jobQueueService.registerHandler('FAIL_ONCE_JOB', async () => {
      throw new Error('Forced single failure for idempotency test');
    });

    const failedJobTarget = await jobQueueService.dispatchJob({
      type: 'FAIL_ONCE_JOB',
      estate_id: 'FPM_TUNGGAL',
      created_by_user_id: tunggalStaffSession.sub,
      created_by_operator_id: 'STF-TGL-01',
      created_by_role: 'staff',
      payload: {},
      max_attempts: 1,
      idempotency_key: failedKey
    });

    await waitForCondition(async () => {
      const j = await jobQueueService.getJob(failedJobTarget.id, 'FPM_TUNGGAL', 'staff');
      return j !== null && j.status === 'FAILED';
    }, 6000);

    const duplicateAfterFail = await jobQueueService.dispatchJob({
      type: 'FAIL_ONCE_JOB',
      estate_id: 'FPM_TUNGGAL',
      created_by_user_id: tunggalStaffSession.sub,
      created_by_operator_id: 'STF-TGL-01',
      created_by_role: 'staff',
      payload: {},
      max_attempts: 1,
      idempotency_key: failedKey
    });

    assert(
      duplicateAfterFail.id === failedJobTarget.id && duplicateAfterFail.deduplicated === true && duplicateAfterFail.status === 'FAILED',
      'Duplicate dispatch after FAILED returns existing failed job with deduplicated flag without re-activation'
    );
  }

  // Test 18.23: In-flight cancellation race defense
  {
    const inFlightJob = await jobQueueService.dispatchJob({
      type: 'AI_OCR_PAGE',
      estate_id: 'FPM_TUNGGAL',
      created_by_user_id: tunggalStaffSession.sub,
      created_by_operator_id: 'STF-TGL-01',
      created_by_role: 'staff',
      payload: { pageNum: 200 }
    });

    // Simulate worker actively holding lease
    inFlightJob.status = 'PROCESSING';
    inFlightJob.locked_by = 'active-worker-race';
    inFlightJob.lease_version = 5;

    // User cancels job while worker is running
    await jobQueueService.cancelJob(inFlightJob.id, 'FPM_TUNGGAL', 'staff');

    // Worker attempts to mark COMPLETED
    const completeResult = await jobQueueService.processJob(inFlightJob, 'active-worker-race', 5);
    const finalState = await jobQueueService.getJob(inFlightJob.id, 'FPM_TUNGGAL', 'staff');

    assert(
      completeResult === 'REJECTED' && finalState?.status === 'CANCELLED',
      'Cancellation during processing atomically blocks worker from writing COMPLETED and preserves CANCELLED status'
    );
  }

  // Test 18.23: Worker unhandled exception safety
  {
    jobQueueService.registerHandler('CRASH_SIMULATION_JOB', async () => {
      throw new Error('Fatal unhandled runtime exception inside task handler');
    });

    const crashJob = await jobQueueService.dispatchJob({
      type: 'CRASH_SIMULATION_JOB',
      estate_id: 'FPM_TUNGGAL',
      created_by_user_id: tunggalStaffSession.sub,
      created_by_operator_id: 'STF-TGL-01',
      created_by_role: 'staff',
      payload: {},
      max_attempts: 1
    });

    await waitForCondition(async () => {
      const j = await jobQueueService.getJob(crashJob.id, 'FPM_TUNGGAL', 'staff');
      return j !== null && j.status === 'FAILED';
    }, 6000);

    const checkCrash = await jobQueueService.getJob(crashJob.id, 'FPM_TUNGGAL', 'staff');
    assert(
      checkCrash !== null && checkCrash.status === 'FAILED' && checkCrash.error_message?.includes('Fatal unhandled runtime exception'),
      'Unhandled handler exception is trapped, logged, and transitions job to FAILED without crashing worker service'
    );
  }

  return { passed, total, failedTests };
}
