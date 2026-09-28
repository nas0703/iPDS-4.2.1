import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase, isMissingTableError } from '../db.js';
import { auditService } from './audit.service.js';
import { withSpan } from '../observability/tracing.js';
import { AppError, ValidationError } from '../utils/errorUtils.js';
import { normalizeGradingBlock, normalizeGradingLorry } from '../../utils/gradingRules.js';

export type GradingTaskStatus = 'OPEN' | 'FIELD_RESOLVED' | 'FINAL_VERIFIED';
export type ReceiptMatchOutcome = 'MATCHED' | 'NOT_FOUND' | 'AMBIGUOUS' | 'INVALID_RATES';

export interface GradingTaskRecord {
  id: string;
  estate_id: string;
  task_date: string;
  block: string;
  rank: number;
  source_window_start: string;
  source_window_end: string;
  cumulative_bts_muda: number;
  source_receipt_count: number;
  status: GradingTaskStatus;
  grading_session_id?: string | null;
  field_grade?: string | null;
  field_muda_count?: number | null;
  field_lorry?: string | null;
  matched_receipt_id?: string | null;
  matched_no_resit?: string | null;
  mill_muda?: number | null;
  mill_kpg?: number | null;
  mill_kpa?: number | null;
  kpg_achieved?: boolean | null;
  final_verified_at?: string | null;
}

export interface MudaSourceRecord {
  id?: string;
  tarikh: string;
  blok: string;
  muda: number | string | null;
  peringkat?: string | null;
  is_efb?: boolean | null;
}

export interface RankedBlockEvidence {
  block: string;
  cumulative_bts_muda: number;
  source_receipt_count: number;
  most_recent_muda_date: string;
}

export interface TaskWindow {
  taskDate: string;
  sourceWindowStart: string;
  sourceWindowEnd: string;
}

export interface AuditActor {
  userId?: string;
  userName?: string;
  role?: string;
  requestId?: string;
}

export interface ReceiptMatchInput {
  estate_id: string;
  tarikh: string;
  blok: string;
  no_lori: string;
}

function shiftIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) throw new ValidationError('Tarikh tugasan tidak sah.');
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));
  return date.toISOString().slice(0, 10);
}

export function getMalaysiaDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
}

export function getGradingTaskWindow(taskDate: string = getMalaysiaDate()): TaskWindow {
  return {
    taskDate,
    sourceWindowStart: shiftIsoDate(taskDate, -7),
    sourceWindowEnd: shiftIsoDate(taskDate, -1)
  };
}

export function aggregateSevenDayMuda(
  records: MudaSourceRecord[],
  taskDate: string
): RankedBlockEvidence[] {
  const { sourceWindowStart, sourceWindowEnd } = getGradingTaskWindow(taskDate);
  const grouped = new Map<string, RankedBlockEvidence>();

  for (const record of records) {
    const recordDate = String(record.tarikh || '').slice(0, 10);
    if (recordDate < sourceWindowStart || recordDate > sourceWindowEnd) continue;
    if (record.is_efb || String(record.peringkat || '').toUpperCase() === 'EFB') continue;

    const block = normalizeGradingBlock(record.blok);
    if (!block) continue;

    const muda = Number(record.muda || 0);
    const current = grouped.get(block) || {
      block,
      cumulative_bts_muda: 0,
      source_receipt_count: 0,
      most_recent_muda_date: ''
    };

    current.source_receipt_count += 1;
    if (Number.isFinite(muda) && muda > 0) {
      current.cumulative_bts_muda += Math.trunc(muda);
      if (recordDate > current.most_recent_muda_date) current.most_recent_muda_date = recordDate;
    }
    grouped.set(block, current);
  }

  return Array.from(grouped.values())
    .filter((item) => item.cumulative_bts_muda > 0)
    .sort((a, b) =>
      b.cumulative_bts_muda - a.cumulative_bts_muda
      || b.most_recent_muda_date.localeCompare(a.most_recent_muda_date)
      || a.block.localeCompare(b.block, 'en', { numeric: true })
    )
    .slice(0, 5);
}

export function selectReceiptMatchCandidates(
  tasks: GradingTaskRecord[],
  receipt: ReceiptMatchInput
): GradingTaskRecord[] {
  const estateId = receipt.estate_id.trim().toUpperCase();
  const receiptDate = String(receipt.tarikh).slice(0, 10);
  const block = normalizeGradingBlock(receipt.blok);
  const lorry = normalizeGradingLorry(receipt.no_lori);

  return tasks.filter((task) =>
    task.status === 'FIELD_RESOLVED'
    && task.estate_id === estateId
    && task.task_date === receiptDate
    && task.block === block
    && normalizeGradingLorry(task.field_lorry) === lorry
  );
}

export function isMillKpgAchieved(kpg: number, kpa: number): boolean {
  if (!Number.isFinite(kpg) || !Number.isFinite(kpa)) return false;
  return kpg >= kpa;
}

function recordTaskAudit(
  event: string,
  estateId: string,
  result: 'SUCCESS' | 'FAILURE' | 'ERROR' | 'PENDING',
  actor: AuditActor,
  details: Record<string, unknown>,
  resourceId?: string
): void {
  auditService.record({
    requestId: actor.requestId,
    userId: actor.userId || 'system:grading-tasks',
    userName: actor.userName || 'GRADING_TASK_WORKER',
    role: actor.role || 'system',
    authorizedEstate: estateId,
    action: 'ADMIN_OPERATION',
    resource: 'grading_tasks',
    resourceId,
    result,
    details: { event, estate_id: estateId, ...details }
  });
}

export class GradingTaskService {
  async generateDailyTasks(
    estateId: string,
    taskDate: string = getMalaysiaDate(),
    jobId?: string
  ): Promise<{ tasks: GradingTaskRecord[]; evidence: RankedBlockEvidence[]; window: TaskWindow }> {
    const cleanEstateId = estateId.trim().toUpperCase();
    const window = getGradingTaskWindow(taskDate);
    const supabase = getSupabase();
    if (!supabase) throw new AppError('Pangkalan data tidak tersedia untuk penjanaan Grading Task.', 503, 'DATABASE_UNAVAILABLE');

    return withSpan('grading_tasks.generate_daily', async () => {
      const { data: sourceRows, error: sourceError } = await supabase
        .from('hantaran_hasil')
        .select('id, tarikh, blok, muda, peringkat')
        .eq('estate_id', cleanEstateId)
        .gte('tarikh', window.sourceWindowStart)
        .lte('tarikh', window.sourceWindowEnd);

      if (sourceError) {
        if (isMissingTableError(sourceError)) {
          return { tasks: [], evidence: [], window };
        }
        throw new AppError('Gagal membaca sumber BTS Muda.', 500, 'GRADING_SOURCE_READ_FAILED');
      }

      const evidence = aggregateSevenDayMuda((sourceRows || []) as MudaSourceRecord[], taskDate);
      if (evidence.length > 0) {
        const rows = evidence.map((item, index) => ({
          estate_id: cleanEstateId,
          task_date: taskDate,
          block: item.block,
          rank: index + 1,
          source_window_start: window.sourceWindowStart,
          source_window_end: window.sourceWindowEnd,
          cumulative_bts_muda: item.cumulative_bts_muda,
          source_receipt_count: item.source_receipt_count,
          status: 'OPEN',
          created_by: 'system:grading-task-generation'
        }));

        const { error: insertError } = await supabase
          .from('grading_tasks')
          .upsert(rows, {
            onConflict: 'estate_id,task_date,block',
            ignoreDuplicates: true
          });

        if (insertError) {
          if (isMissingTableError(insertError)) {
            return { tasks: [], evidence, window };
          }
          throw new AppError('Gagal mencipta Grading Task.', 500, 'GRADING_TASK_CREATE_FAILED');
        }
      }

      const { data: tasks, error: listError } = await supabase
        .from('grading_tasks')
        .select('*')
        .eq('estate_id', cleanEstateId)
        .eq('task_date', taskDate)
        .order('rank', { ascending: true });

      if (listError) {
        if (isMissingTableError(listError)) {
          return { tasks: [], evidence, window };
        }
        throw new AppError('Gagal membaca Grading Task yang dijana.', 500, 'GRADING_TASK_LIST_FAILED');
      }

      recordTaskAudit('GRADING_TASKS_GENERATED', cleanEstateId, 'SUCCESS', {}, {
        task_date: taskDate,
        source_window_start: window.sourceWindowStart,
        source_window_end: window.sourceWindowEnd,
        task_count: tasks?.length || 0,
        job_id: jobId || null
      });

      return { tasks: (tasks || []) as GradingTaskRecord[], evidence, window };
    }, {
      category: 'database',
      metadata: { estate_id: cleanEstateId, task_date: taskDate }
    });
  }

  async listTasks(
    supabase: SupabaseClient,
    estateId: string,
    taskDate: string = getMalaysiaDate()
  ): Promise<GradingTaskRecord[]> {
    const { data, error } = await supabase
      .from('grading_tasks')
      .select('*')
      .eq('estate_id', estateId)
      .eq('task_date', taskDate)
      .order('rank', { ascending: true });
    if (error) {
      if (isMissingTableError(error)) {
        return [];
      }
      throw new AppError('Gagal mendapatkan senarai Grading Task.', 500, 'GRADING_TASK_LIST_FAILED');
    }
    return (data || []) as GradingTaskRecord[];
  }

  async getTask(supabase: SupabaseClient, estateId: string, taskId: string): Promise<GradingTaskRecord | null> {
    const { data, error } = await supabase
      .from('grading_tasks')
      .select('*')
      .eq('estate_id', estateId)
      .eq('id', taskId)
      .maybeSingle();
    if (error) {
      if (isMissingTableError(error)) {
        return null;
      }
      throw new AppError('Gagal mendapatkan Grading Task.', 500, 'GRADING_TASK_READ_FAILED');
    }
    return data as GradingTaskRecord | null;
  }

  async resolveFieldTask(
    supabase: SupabaseClient,
    estateId: string,
    taskId: string,
    sessionRecord: Record<string, unknown>,
    actor: AuditActor
  ): Promise<GradingTaskRecord> {
    return withSpan('grading_tasks.resolve_field', async () => {
      const task = await this.getTask(supabase, estateId, taskId);
      if (!task) throw new AppError('Grading Task tidak ditemui.', 404, 'GRADING_TASK_NOT_FOUND');
      if (task.status !== 'OPEN') throw new ValidationError('Grading Task bukan lagi berstatus OPEN.');

      const { data, error } = await supabase.rpc('save_task_grading_session', {
        p_task_id: taskId,
        p_record: sessionRecord
      });

      if (error || !data?.[0]) {
        const code = String(error?.message || '').match(/GRADING_TASK_[A-Z_]+/)?.[0] || 'GRADING_TASK_FIELD_RESOLVE_FAILED';
        const status = code.includes('NOT_FOUND') ? 404 : code.includes('DENIED') ? 403 : 400;
        throw new AppError('Gagal menyelesaikan Grading Task. Semak blok, tarikh dan status tugasan.', status, code);
      }

      const resolved = data[0] as GradingTaskRecord;
      recordTaskAudit('GRADING_TASK_FIELD_RESOLVED', estateId, 'SUCCESS', actor, {
        task_date: resolved.task_date,
        block: resolved.block,
        grading_session_id: resolved.grading_session_id || null
      }, taskId);
      return resolved;
    }, { category: 'database', metadata: { estate_id: estateId, task_id: taskId } });
  }

  async matchReceiptToTask(
    estateId: string,
    noResit: string,
    jobId?: string
  ): Promise<{ outcome: ReceiptMatchOutcome; task?: GradingTaskRecord }> {
    const cleanEstateId = estateId.trim().toUpperCase();
    const cleanNoResit = noResit.trim().toUpperCase();
    const supabase = getSupabase();
    if (!supabase) throw new AppError('Pangkalan data tidak tersedia untuk padanan resit.', 503, 'DATABASE_UNAVAILABLE');

    return withSpan('grading_tasks.match_receipt', async () => {
      const { data: receipt, error: receiptError } = await supabase
        .from('hantaran_hasil')
        .select('id, estate_id, no_resit, no_lori, blok, tarikh, muda, kpg, kpa')
        .eq('estate_id', cleanEstateId)
        .eq('no_resit', cleanNoResit)
        .maybeSingle();

      if (receiptError) throw new AppError('Gagal membaca resit untuk padanan.', 500, 'GRADING_RECEIPT_READ_FAILED');
      if (!receipt) {
        recordTaskAudit('GRADING_TASK_MATCH_NOT_FOUND', cleanEstateId, 'PENDING', {}, {
          no_resit: cleanNoResit,
          job_id: jobId || null,
          reason: 'RECEIPT_NOT_FOUND'
        });
        return { outcome: 'NOT_FOUND' };
      }

      const receiptBlock = normalizeGradingBlock(receipt.blok);
      const receiptLorry = normalizeGradingLorry(receipt.no_lori);
      const receiptDate = String(receipt.tarikh).slice(0, 10);

      const { data: possibleTasks, error: taskError } = await supabase
        .from('grading_tasks')
        .select('*')
        .eq('estate_id', cleanEstateId)
        .eq('status', 'FIELD_RESOLVED')
        .eq('task_date', receiptDate)
        .eq('block', receiptBlock);

      if (taskError) throw new AppError('Gagal mencari Grading Task untuk resit.', 500, 'GRADING_TASK_MATCH_FAILED');

      const candidates = selectReceiptMatchCandidates((possibleTasks || []) as GradingTaskRecord[], {
        estate_id: cleanEstateId,
        tarikh: receiptDate,
        blok: receiptBlock,
        no_lori: receiptLorry
      });

      if (candidates.length === 0) {
        recordTaskAudit('GRADING_TASK_MATCH_NOT_FOUND', cleanEstateId, 'PENDING', {}, {
          no_resit: cleanNoResit,
          block: receiptBlock,
          job_id: jobId || null
        });
        return { outcome: 'NOT_FOUND' };
      }

      if (candidates.length > 1) {
        recordTaskAudit('GRADING_TASK_MATCH_AMBIGUOUS', cleanEstateId, 'PENDING', {}, {
          no_resit: cleanNoResit,
          block: receiptBlock,
          candidate_count: candidates.length,
          job_id: jobId || null
        });
        return { outcome: 'AMBIGUOUS' };
      }

      const millKpg = Number(receipt.kpg);
      const millKpa = Number(receipt.kpa);
      if (
        receipt.kpa === null
        || receipt.kpa === undefined
        || !String(receipt.kpg ?? '').trim()
        || !Number.isFinite(millKpg)
        || !Number.isFinite(millKpa)
      ) {
        recordTaskAudit('GRADING_TASK_MATCH_NOT_FOUND', cleanEstateId, 'PENDING', {}, {
          no_resit: cleanNoResit,
          task_id: candidates[0].id,
          reason: 'MILL_RATES_REQUIRED',
          job_id: jobId || null
        }, candidates[0].id);
        return { outcome: 'INVALID_RATES', task: candidates[0] };
      }

      return this.finalizeTask(supabase, candidates[0], receipt.id, jobId);
    }, { category: 'database', metadata: { estate_id: cleanEstateId, no_resit: cleanNoResit } });
  }

  async finalizeTask(
    supabase: SupabaseClient,
    task: GradingTaskRecord,
    receiptId: string,
    jobId?: string
  ): Promise<{ outcome: 'MATCHED'; task: GradingTaskRecord }> {
    const { data, error } = await supabase.rpc('verify_grading_task_receipt', {
      p_task_id: task.id,
      p_receipt_id: receiptId
    });

    if (error || !data?.[0]) throw new AppError('Gagal mengesahkan keputusan kilang.', 500, 'GRADING_TASK_VERIFY_FAILED');
    const finalized = data[0] as GradingTaskRecord;

    recordTaskAudit(
      finalized.status === 'FINAL_VERIFIED' ? 'GRADING_TASK_FINAL_VERIFIED' : 'GRADING_TASK_KPG_NOT_ACHIEVED',
      finalized.estate_id,
      'SUCCESS',
      {},
      {
        task_date: finalized.task_date,
        block: finalized.block,
        no_resit: finalized.matched_no_resit || null,
        kpg_achieved: finalized.kpg_achieved ?? null,
        job_id: jobId || null
      },
      finalized.id
    );

    return { outcome: 'MATCHED', task: finalized };
  }
}

export const gradingTaskService = new GradingTaskService();
