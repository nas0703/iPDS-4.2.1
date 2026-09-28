import fs from 'fs';
import path from 'path';
import gradingTasksRoutes from '../../../src/server/routes/gradingTasks.routes.js';
import {
  aggregateSevenDayMuda,
  getGradingTaskWindow,
  getMalaysiaDate,
  isMillKpgAchieved,
  selectReceiptMatchCandidates,
  type GradingTaskRecord
} from '../../../src/server/services/gradingTask.service.js';
import { evaluateFieldGrade, normalizeGradingBlock, normalizeGradingLorry } from '../../../src/utils/gradingRules.js';

export async function runGradingTaskTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 60: IPDS GRADING TASK WORKFLOW');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 60.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 60.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`Test 60.${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  const taskDate = '2026-09-25';
  const window = getGradingTaskWindow(taskDate);
  assert(window.sourceWindowStart === '2026-09-18' && window.sourceWindowEnd === '2026-09-24', 'Seven-day source window is exactly D-7 through D-1');
  assert(getMalaysiaDate(new Date('2026-09-24T16:30:00.000Z')) === '2026-09-25', 'Task date uses Asia/Kuala_Lumpur instead of the UTC calendar date');

  const windowRecords = [
    { tarikh: '2026-09-17', blok: '1', muda: 100 },
    { tarikh: '2026-09-18', blok: '1', muda: 2 },
    { tarikh: '2026-09-24', blok: '1', muda: 3 },
    { tarikh: '2026-09-25', blok: '1', muda: 200 }
  ];
  const windowResult = aggregateSevenDayMuda(windowRecords, taskDate);
  assert(windowResult[0]?.cumulative_bts_muda === 5, 'D-7 and D-1 are included while today and D-8 are excluded');
  assert(windowResult[0]?.source_receipt_count === 2, 'Source receipt count preserves qualifying window evidence');

  const ranked = aggregateSevenDayMuda([
    { tarikh: '2026-09-20', blok: '1', muda: 3 },
    { tarikh: '2026-09-21', blok: '1', muda: 4 },
    { tarikh: '2026-09-22', blok: '2', muda: 9 },
    { tarikh: '2026-09-22', blok: '3', muda: 8 },
    { tarikh: '2026-09-22', blok: '4', muda: 6 },
    { tarikh: '2026-09-22', blok: '5', muda: 5 },
    { tarikh: '2026-09-22', blok: '6', muda: 4 }
  ], taskDate);
  assert(ranked[0]?.block === '2' && ranked[1]?.block === '3' && ranked[2]?.block === '1', 'SUM(muda) is aggregated and ranked highest-first per block');
  assert(ranked.length === 5, 'Exactly five tasks are selected when more than five blocks qualify');

  const fewer = aggregateSevenDayMuda([
    { tarikh: '2026-09-20', blok: '1', muda: 1 },
    { tarikh: '2026-09-20', blok: '2', muda: 0 },
    { tarikh: '2026-09-20', blok: '3', muda: 2 }
  ], taskDate);
  assert(fewer.length === 2 && fewer.every((item) => item.cumulative_bts_muda > 0), 'Fewer than five qualifying blocks creates no manufactured zero-data tasks');

  const tie = aggregateSevenDayMuda([
    { tarikh: '2026-09-20', blok: '10', muda: 5 },
    { tarikh: '2026-09-22', blok: '2', muda: 5 },
    { tarikh: '2026-09-22', blok: '1', muda: 5 }
  ], taskDate);
  assert(tie.map((item) => item.block).join(',') === '1,2,10', 'Tie-breaking uses latest positive muda date then normalized block order');

  assert(normalizeGradingBlock('01/02') === '2' && normalizeGradingBlock('BLOK 02') === '2' && normalizeGradingBlock('LF PKT 1') === '88F', 'Existing grading block formats normalize to persisted block identity');
  assert(normalizeGradingLorry('jgx 7725') === normalizeGradingLorry('JGX-7725'), 'Lorry matching uses deterministic existing-format normalization');

  const fieldCases = [
    evaluateFieldGrade(100, 2, 90).grade,
    evaluateFieldGrade(100, 3, 90).grade,
    evaluateFieldGrade(100, 6, 90).grade,
    evaluateFieldGrade(100, 11, 90).grade
  ];
  assert(fieldCases.join(',') === 'A,B,C,D', 'Extracted field-grade helper preserves existing A/B/C/D thresholds');

  const baseTask: GradingTaskRecord = {
    id: 'task-1', estate_id: 'FPM_TUNGGAL', task_date: taskDate, block: '2', rank: 1,
    source_window_start: '2026-09-18', source_window_end: '2026-09-24', cumulative_bts_muda: 10,
    source_receipt_count: 2, status: 'FIELD_RESOLVED', field_lorry: 'JGX 7725'
  };
  const receipt = { estate_id: 'FPM_TUNGGAL', tarikh: taskDate, blok: '02', no_lori: 'JGX-7725' };
  assert(selectReceiptMatchCandidates([baseTask], receipt).length === 1, 'One exact estate/date/block/lorry match is selected');
  assert(selectReceiptMatchCandidates([{ ...baseTask, estate_id: 'FPM_ADELA' }], receipt).length === 0, 'Receipt matching rejects cross-estate candidates');
  assert(selectReceiptMatchCandidates([{ ...baseTask, field_lorry: 'OTHER 1' }], receipt).length === 0, 'Receipt matching never uses block alone');
  assert(selectReceiptMatchCandidates([baseTask, { ...baseTask, id: 'task-2' }], receipt).length === 2, 'Multiple exact candidates remain explicitly ambiguous');

  assert(isMillKpgAchieved(21, 21) && isMillKpgAchieved(21.5, 21.5) && isMillKpgAchieved(22.1, 22), 'KPG equal to or above variable actual KPA achieves final verification');
  assert(!isMillKpgAchieved(20.99, 21) && !isMillKpgAchieved(21.49, 21.5) && !isMillKpgAchieved(21.99, 22), 'KPG below each actual KPA remains unresolved');

  const migrationPath = path.join(process.cwd(), 'supabase/migrations/20260930_ipds_grading_tasks.sql');
  const migration = fs.readFileSync(migrationPath, 'utf8');
  assert(migration.includes('UNIQUE INDEX IF NOT EXISTS uq_grading_tasks_estate_date_block') && migration.includes('(estate_id, task_date, block)'), 'Database uniqueness prevents duplicate and concurrent task creation');
  assert(migration.includes("status IN ('OPEN', 'FIELD_RESOLVED', 'FINAL_VERIFIED')") && migration.includes('trg_grading_tasks_transition'), 'Database constrains statuses and server-authoritative transitions');
  assert(migration.includes('save_task_grading_session') && migration.includes('FOR UPDATE') && migration.includes('grading_task_id'), 'Field session persistence and OPEN to FIELD_RESOLVED transition are atomic');
  assert(migration.includes('GRADING_TASK_BLOCK_MISMATCH') && migration.includes('GRADING_TASK_DATE_MISMATCH'), 'Database rejects task block and date mismatches');
  assert(migration.includes('verify_grading_task_receipt') && migration.includes('v_receipt.kpg::NUMERIC >= v_receipt.kpa'), 'Final verification compares actual mill KPG against actual mill KPA');
  assert(migration.includes("status = CASE WHEN v_achieved THEN 'FINAL_VERIFIED' ELSE 'FIELD_RESOLVED' END"), 'Failed KPG/KPA remains FIELD_RESOLVED');
  assert(migration.includes('ADD COLUMN IF NOT EXISTS kpa') && migration.includes('mill_kpa'), 'Actual receipt KPA and immutable task snapshot are persisted');
  assert(migration.includes('ENABLE ROW LEVEL SECURITY') && migration.includes('FORCE ROW LEVEL SECURITY') && migration.includes('REVOKE ALL ON public.grading_tasks FROM PUBLIC, anon'), 'Grading tasks enforce RLS, FORCE RLS, and anon revocation');
  assert(migration.includes('estate_id = public.auth_estate_id()') && migration.includes('public.auth_is_super_admin()'), 'Database SELECT/UPDATE policies preserve tenant and Super Admin boundaries');
  assert(migration.includes('REVOKE ALL ON FUNCTION public.verify_grading_task_receipt(UUID, UUID) FROM PUBLIC, anon, authenticated'), 'Browser clients cannot invoke final verification');

  const routeStack = (gradingTasksRoutes as any).stack || [];
  const listRoute = routeStack.find((layer: any) => layer.route?.path === '/' && layer.route?.methods?.get);
  const completeRoute = routeStack.find((layer: any) => layer.route?.path === '/:id/field-complete' && layer.route?.methods?.post);
  const finalRoute = routeStack.find((layer: any) => String(layer.route?.path || '').includes('final'));
  assert(Boolean(listRoute) && listRoute.route.stack.length >= 2, 'Task listing requires authentication middleware');
  assert(Boolean(completeRoute) && completeRoute.route.stack.length >= 2, 'Field completion is protected by role and tenant middleware');
  assert(!finalRoute, 'No browser endpoint can force FINAL_VERIFIED');

  const penggredanRouteSource = fs.readFileSync(path.join(process.cwd(), 'src/server/routes/penggredan.routes.ts'), 'utf8');
  assert(penggredanRouteSource.includes("'eqi'") && penggredanRouteSource.includes('GRADING_TASK_FLOW_REQUIRED'), 'EQI is authorized for grading while task linkage cannot bypass the task endpoint');

  const jobSource = fs.readFileSync(path.join(process.cwd(), 'src/server/services/jobQueue.service.ts'), 'utf8');
  const hantaranSource = fs.readFileSync(path.join(process.cwd(), 'src/server/routes/hantaran.routes.ts'), 'utf8');
  const cronSource = fs.readFileSync(path.join(process.cwd(), 'src/server/routes/cron.routes.ts'), 'utf8');
  assert(jobSource.includes('GRADING_TASK_GENERATION') && jobSource.includes('GRADING_TASK_RECEIPT_MATCH'), 'Existing job queue registers only the required Grading Task job types');
  assert(hantaranSource.includes('grading-receipt-match:${targetEstate}:${payload.no_resit}'), 'Receipt matching uses estate-and-receipt idempotency');
  assert(cronSource.includes('getMalaysiaDate()') && cronSource.includes('grading-generation:${estateId}:${taskDate}'), 'Existing cron dispatches Malaysia-date generation idempotently');

  return { passed, total, failedTests };
}
