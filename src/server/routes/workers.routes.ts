/**
 * iPDS v4.1.0 — Workers & Work Assignments API Proxy Routes
 * Enforces server-side authentication and 100% tenant isolation (estate_id).
 */

import express, { Request, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getSupabase } from '../db.js';
import { getLocalEstateJson, saveLocalEstateJson } from '../local.js';
import { getSafeErrorMessage } from '../utils/errorUtils.js';

const router = express.Router();

export interface WorkerRecord {
  id: string;
  name?: string;
  estate_id?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface WorkAssignmentRecord {
  id?: string;
  worker_id: string;
  date: string;
  work_type?: string;
  blok?: string;
  peringkat?: string;
  notes?: string | null;
  estate_id?: string;
  [key: string]: unknown;
}

/**
 * GET /api/workers
 * Retrieve workers for caller's estate
 */
router.get('/workers', requireAuth, async (req: Request, res: Response) => {
  try {
    const estateId = req.estateId || 'FPM_TUNGGAL';

    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from('workers')
        .select('*')
        .eq('estate_id', estateId)
        .order('name');

      if (!error && data) {
        return res.json({
          success: true,
          estate_id: estateId,
          data
        });
      }
    }

    // Local JSON fallback
    const local = getLocalEstateJson('workers', estateId, { workers: [] });
    return res.json({
      success: true,
      estate_id: estateId,
      data: local.workers || []
    });
  } catch (err: unknown) {
    console.error('Error fetching workers:', err);
    return res.status(500).json({
      success: false,
      error: getSafeErrorMessage(err, 'Gagal mengambil senarai pekerja.')
    });
  }
});

/**
 * POST /api/workers
 * Create or update worker record bound to caller's estate
 */
router.post('/workers', requireRole(['pf', 'fc']), async (req: Request, res: Response) => {
  try {
    const estateId = req.estateId || 'FPM_TUNGGAL';
    const workerData = req.body || {};

    const payload: WorkerRecord = {
      ...workerData,
      estate_id: estateId,
      updated_at: new Date().toISOString()
    };

    let savedWorker = payload;
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from('workers')
        .upsert([payload])
        .select();

      if (!error && data && data[0]) {
        savedWorker = data[0] as WorkerRecord;
      }
    }

    // Local fallback save
    const local = getLocalEstateJson('workers', estateId, { workers: [] });
    const list: WorkerRecord[] = Array.isArray(local.workers) ? local.workers : [];
    const idx = list.findIndex((w: WorkerRecord) => w.id === savedWorker.id);
    if (idx >= 0) {
      list[idx] = savedWorker;
    } else {
      list.push(savedWorker);
    }
    saveLocalEstateJson('workers', estateId, { workers: list });

    return res.json({
      success: true,
      data: savedWorker
    });
  } catch (err: unknown) {
    console.error('Error saving worker:', err);
    return res.status(500).json({
      success: false,
      error: getSafeErrorMessage(err, 'Gagal menyimpan maklumat pekerja.')
    });
  }
});

/**
 * DELETE /api/workers/:id
 * Delete worker record bound to caller's estate
 */
router.delete('/workers/:id', requireRole(['pf', 'fc']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const estateId = req.estateId || 'FPM_TUNGGAL';

    const supabase = getSupabase();
    if (supabase) {
      await supabase
        .from('workers')
        .delete()
        .eq('id', id)
        .eq('estate_id', estateId);
    }

    // Local JSON update
    const local = getLocalEstateJson('workers', estateId, { workers: [] });
    const list: WorkerRecord[] = Array.isArray(local.workers) ? local.workers : [];
    const filtered = list.filter((w: WorkerRecord) => w.id !== id);
    saveLocalEstateJson('workers', estateId, { workers: filtered });

    return res.json({
      success: true,
      message: 'Pekerja berjaya dipadam.'
    });
  } catch (err: unknown) {
    console.error('Error deleting worker:', err);
    return res.status(500).json({
      success: false,
      error: getSafeErrorMessage(err, 'Gagal memadam pekerja.')
    });
  }
});

/**
 * GET /api/work-assignments
 * Retrieve work assignments for caller's estate
 */
router.get('/work-assignments', requireAuth, async (req: Request, res: Response) => {
  try {
    const estateId = req.estateId || 'FPM_TUNGGAL';

    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from('work_assignments')
        .select('*')
        .eq('estate_id', estateId);

      if (!error && data) {
        return res.json({
          success: true,
          estate_id: estateId,
          data
        });
      }
    }

    const local = getLocalEstateJson('work_assignments', estateId, { assignments: [] });
    return res.json({
      success: true,
      estate_id: estateId,
      data: local.assignments || []
    });
  } catch (err: unknown) {
    console.error('Error fetching work assignments:', err);
    return res.status(500).json({
      success: false,
      error: getSafeErrorMessage(err, 'Gagal mengambil rekod tugasan kerja.')
    });
  }
});

/**
 * DELETE /api/work-assignments
 * Delete work assignments by date for caller's estate
 */
router.delete('/work-assignments', requireRole(['pf', 'fc']), async (req: Request, res: Response) => {
  try {
    const { date } = req.query;
    const estateId = req.estateId || 'FPM_TUNGGAL';

    if (!date) {
      return res.status(400).json({ success: false, error: 'Tarikh diperlukan.' });
    }

    const supabase = getSupabase();
    if (supabase) {
      await supabase
        .from('work_assignments')
        .delete()
        .eq('date', date as string)
        .eq('estate_id', estateId);
    }

    const local = getLocalEstateJson('work_assignments', estateId, { assignments: [] });
    const list: WorkAssignmentRecord[] = Array.isArray(local.assignments) ? local.assignments : [];
    const filtered = list.filter((a: WorkAssignmentRecord) => a.date !== date);
    saveLocalEstateJson('work_assignments', estateId, { assignments: filtered });

    return res.json({
      success: true,
      message: 'Tugasan kerja berjaya dipadam.'
    });
  } catch (err: unknown) {
    console.error('Error deleting work assignment:', err);
    return res.status(500).json({
      success: false,
      error: getSafeErrorMessage(err, 'Gagal memadam tugasan kerja.')
    });
  }
});

/**
 * ============================================================================
 * P0-16B.1 — Authenticated attendance & work-assignment persistence
 * ============================================================================
 * Browser -> authenticated API -> authorization + estate isolation ->
 * server-side service_role -> PostgreSQL. The browser never touches these
 * tables directly and the service_role key is never exposed.
 *
 * Authorization mirrors the database RLS model:
 *   - reads / upserts: any authenticated session (estate-scoped)
 *   - deletes: pf / fc (existing DELETE /work-assignments already enforces this)
 *
 * Estate isolation: the authorized estate is ALWAYS taken from req.estateId
 * (resolved server-side by requireAuth/requireRole -> validateTenantAccess).
 * A client-supplied estate_id is only ever accepted if it equals the authorized
 * estate; it is never used as the authorization boundary.
 */

const MAX_BATCH_ITEMS = 500;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_ATTENDANCE_STATUSES = ['Hadir', 'Tidak Hadir', 'Cuti', 'Sakit', 'Cuti Mingguan', 'Cuti Umum'];

function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidDateString(value: unknown): boolean {
  return typeof value === 'string' && DATE_RE.test(value.trim());
}

function extractItems(input: unknown, key: 'records' | 'assignments'): unknown[] | null {
  if (Array.isArray(input)) return input;
  if (input && typeof input === 'object' && Array.isArray((input as Record<string, unknown>)[key])) {
    return (input as Record<string, unknown>)[key] as unknown[];
  }
  return null;
}

/**
 * Returns true when every client-supplied estate_id matches the authorized
 * estate. Items without an estate_id are allowed (the server assigns it).
 */
export function allItemsInEstate(input: unknown, key: 'records' | 'assignments', estateId: string): boolean {
  const items = extractItems(input, key) || [];
  return items.every((item: unknown) => {
    if (!item || typeof item !== 'object') return true;
    const estate = (item as Record<string, unknown>).estate_id;
    if (estate == null || String(estate).trim() === '') return true;
    return String(estate).trim().toUpperCase() === estateId;
  });
}

export interface AttendanceValidationResult {
  ok: boolean;
  error?: string;
  records?: Array<{ id?: string; worker_id: string; date: string; status: string }>;
}

export function validateAttendancePayload(input: unknown): AttendanceValidationResult {
  const raw = extractItems(input, 'records');
  if (!raw) return { ok: false, error: 'Senarai rekod kehadiran diperlukan.' };
  if (raw.length === 0) return { ok: false, error: 'Senarai rekod kehadiran kosong.' };
  if (raw.length > MAX_BATCH_ITEMS) return { ok: false, error: `Maksimum ${MAX_BATCH_ITEMS} rekod setiap permintaan.` };

  const records: Array<{ id?: string; worker_id: string; date: string; status: string }> = [];
  for (let i = 0; i < raw.length; i++) {
    const r = (raw[i] || {}) as Record<string, unknown>;
    if (!isNonEmptyString(r.worker_id)) return { ok: false, error: `Rekod ${i + 1}: worker_id diperlukan.` };
    if (!isValidDateString(r.date)) return { ok: false, error: `Rekod ${i + 1}: tarikh tidak sah (YYYY-MM-DD).` };
    if (!isNonEmptyString(r.status)) return { ok: false, error: `Rekod ${i + 1}: status diperlukan.` };
    if (!VALID_ATTENDANCE_STATUSES.includes(String(r.status).trim())) {
      return { ok: false, error: `Rekod ${i + 1}: status tidak dikenali.` };
    }
    records.push({
      id: isNonEmptyString(r.id) ? String(r.id).trim() : undefined,
      worker_id: String(r.worker_id).trim(),
      date: String(r.date).trim(),
      status: String(r.status).trim()
    });
  }
  return { ok: true, records };
}

export interface WorkAssignmentValidationResult {
  ok: boolean;
  error?: string;
  assignments?: Array<{ id?: string; worker_id: string; date: string; work_type: string; blok: string; peringkat: string; notes: string | null }>;
}

export function validateWorkAssignmentPayload(input: unknown): WorkAssignmentValidationResult {
  const raw = extractItems(input, 'assignments');
  if (!raw) return { ok: false, error: 'Senarai tugasan kerja diperlukan.' };
  if (raw.length === 0) return { ok: false, error: 'Senarai tugasan kerja kosong.' };
  if (raw.length > MAX_BATCH_ITEMS) return { ok: false, error: `Maksimum ${MAX_BATCH_ITEMS} tugasan setiap permintaan.` };

  const assignments: Array<{ id?: string; worker_id: string; date: string; work_type: string; blok: string; peringkat: string; notes: string | null }> = [];
  for (let i = 0; i < raw.length; i++) {
    const a = (raw[i] || {}) as Record<string, unknown>;
    if (!isNonEmptyString(a.worker_id)) return { ok: false, error: `Tugasan ${i + 1}: worker_id diperlukan.` };
    if (!isValidDateString(a.date)) return { ok: false, error: `Tugasan ${i + 1}: tarikh tidak sah (YYYY-MM-DD).` };
    if (!isNonEmptyString(a.work_type)) return { ok: false, error: `Tugasan ${i + 1}: work_type diperlukan.` };
    if (!isNonEmptyString(a.blok)) return { ok: false, error: `Tugasan ${i + 1}: blok diperlukan.` };
    if (!isNonEmptyString(a.peringkat)) return { ok: false, error: `Tugasan ${i + 1}: peringkat diperlukan.` };
    assignments.push({
      id: isNonEmptyString(a.id) ? String(a.id).trim() : undefined,
      worker_id: String(a.worker_id).trim(),
      date: String(a.date).trim(),
      work_type: String(a.work_type).trim(),
      blok: String(a.blok).trim(),
      peringkat: String(a.peringkat).trim(),
      notes: a.notes == null ? null : String(a.notes)
    });
  }
  return { ok: true, assignments };
}

function resolveAuthorizedEstate(req: Request): string | null {
  const estateId = String(req.estateId || '').trim().toUpperCase();
  if (!estateId || estateId === 'ALL') return null;
  return estateId;
}

async function getEstateWorkerIds(supabase: unknown, estateId: string): Promise<Set<string>> {
  const client = supabase as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: unknown) => Promise<{ data: unknown[] | null; error: unknown }>;
      };
    };
  };
  const { data, error } = await client.from('workers').select('id').eq('estate_id', estateId);
  if (error) throw error;
  return new Set((data || []).map((w: unknown) => String((w as Record<string, unknown>).id)));
}

/**
 * GET /api/workers/attendance
 * Read attendance for the authorized estate by exact date or by from/to range.
 */
router.get('/attendance', requireAuth, async (req: Request, res: Response) => {
  try {
    const estateId = resolveAuthorizedEstate(req);
    if (!estateId) {
      return res.status(400).json({ success: false, error: 'Ladang tidak sah untuk operasi ini.' });
    }

    const date = req.query.date as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    if (date !== undefined && !isValidDateString(date)) {
      return res.status(400).json({ success: false, error: 'Parameter tarikh tidak sah (YYYY-MM-DD).' });
    }
    if ((from !== undefined && !isValidDateString(from)) || (to !== undefined && !isValidDateString(to))) {
      return res.status(400).json({ success: false, error: 'Parameter julat tarikh tidak sah (YYYY-MM-DD).' });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Pangkalan data tidak tersedia.' });
    }

    let query = supabase.from('attendance_records').select('*').eq('estate_id', estateId);
    if (date) query = query.eq('date', date);
    if (from) query = query.gte('date', from);
    if (to) query = query.lte('date', to);

    const { data, error } = await query.order('date', { ascending: true });
    if (error) throw error;

    return res.json({ success: true, estate_id: estateId, data: data || [] });
  } catch (err: unknown) {
    console.error('Error fetching attendance:', err);
    return res.status(500).json({ success: false, error: getSafeErrorMessage(err, 'Gagal mengambil rekod kehadiran.') });
  }
});

/**
 * POST /api/workers/attendance
 * Upsert attendance for the authorized estate. Natural key: (estate_id,
 * worker_id, date). No unique constraint exists in the current schema, so the
 * upsert is resolved deterministically server-side (select-then-insert/update).
 */
router.post('/attendance', requireAuth, async (req: Request, res: Response) => {
  try {
    const estateId = resolveAuthorizedEstate(req);
    if (!estateId) {
      return res.status(400).json({ success: false, error: 'Ladang tidak sah untuk operasi ini.' });
    }

    const parsed = validateAttendancePayload(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ success: false, error: parsed.error });
    }
    if (!allItemsInEstate(req.body, 'records', estateId)) {
      return res.status(403).json({ success: false, error: 'Akses dinafikan: rekod mengandungi ladang lain.' });
    }
    const records = parsed.records || [];

    const supabase = getSupabase();
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Pangkalan data tidak tersedia.' });
    }

    // Validate worker ownership BEFORE any mutation (prevents cross-estate writes).
    const workerIds = await getEstateWorkerIds(supabase, estateId);
    for (const r of records) {
      if (!workerIds.has(r.worker_id)) {
        return res.status(400).json({ success: false, error: 'Pekerja tidak sah untuk ladang ini.' });
      }
    }

    // Database-native atomic upsert. Requires the unique key from migration
    // 20260922: (estate_id, worker_id, date). estate_id is always taken from the
    // authorized server context (never the client body).
    const payloads = records.map((r) => ({
      worker_id: r.worker_id,
      date: r.date,
      status: r.status,
      estate_id: estateId
    }));

    const { data, error } = await supabase
      .from('attendance_records')
      .upsert(payloads, { onConflict: 'estate_id,worker_id,date' })
      .select();
    if (error) throw error;

    return res.json({ success: true, estate_id: estateId, data: data || [] });
  } catch (err: unknown) {
    console.error('Error saving attendance:', err);
    return res.status(500).json({ success: false, error: getSafeErrorMessage(err, 'Gagal menyimpan rekod kehadiran.') });
  }
});

/**
 * POST /api/workers/work-assignments
 * Upsert one or many work assignments for the authorized estate. Natural key:
 * (estate_id, worker_id, date). When `replaceDate` is true the batch represents
 * the authoritative set for `date`; rows for that date that are no longer in
 * the batch are removed AFTER the upsert (never delete-then-reinsert).
 */
router.post('/work-assignments', requireAuth, async (req: Request, res: Response) => {
  try {
    const estateId = resolveAuthorizedEstate(req);
    if (!estateId) {
      return res.status(400).json({ success: false, error: 'Ladang tidak sah untuk operasi ini.' });
    }

    const parsed = validateWorkAssignmentPayload(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ success: false, error: parsed.error });
    }
    if (!allItemsInEstate(req.body, 'assignments', estateId)) {
      return res.status(403).json({ success: false, error: 'Akses dinafikan: tugasan mengandungi ladang lain.' });
    }
    const assignments = parsed.assignments || [];

    const replaceDate = req.body?.replaceDate === true;
    const replaceDateValue = replaceDate ? String(req.body?.date || '').trim() : '';
    if (replaceDate && !isValidDateString(replaceDateValue)) {
      return res.status(400).json({ success: false, error: 'Tarikh penggantian tidak sah (YYYY-MM-DD).' });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Pangkalan data tidak tersedia.' });
    }

    // Validate worker ownership BEFORE any mutation.
    const workerIds = await getEstateWorkerIds(supabase, estateId);
    for (const a of assignments) {
      if (!workerIds.has(a.worker_id)) {
        return res.status(400).json({ success: false, error: 'Pekerja tidak sah untuk ladang ini.' });
      }
    }

    // Database-native atomic upsert of the batch. Requires the unique key from
    // migration 20260922: (estate_id, worker_id, date). estate_id is always
    // taken from the authorized server context (never the client body).
    const payloads = assignments.map((a) => ({
      worker_id: a.worker_id,
      date: a.date,
      work_type: a.work_type,
      blok: a.blok,
      peringkat: a.peringkat,
      notes: a.notes,
      estate_id: estateId
    }));

    const { data, error } = await supabase
      .from('work_assignments')
      .upsert(payloads, { onConflict: 'estate_id,worker_id,date' })
      .select();
    if (error) throw error;
    const saved = data || [];

    // Reconciliation for a full-day replace: remove rows no longer in the batch.
    // This is a SEPARATE statement (not transactional with the upsert above);
    // it runs strictly AFTER the upsert and is scoped to the authorized estate
    // and the requested date only. Never delete-before-insert.
    if (replaceDate) {
      const incoming = new Set(assignments.filter(a => a.date === replaceDateValue).map(a => a.worker_id));
      const { data: existingRows, error } = await supabase
        .from('work_assignments')
        .select('id, worker_id')
        .eq('estate_id', estateId)
        .eq('date', replaceDateValue);
      if (error) throw error;

      const toRemove = (existingRows || [])
        .filter((row: { id?: string; worker_id?: string }) => !incoming.has(String(row.worker_id)))
        .map((row: { id?: string; worker_id?: string }) => row.id as string)
        .filter(Boolean);

      if (toRemove.length > 0) {
        const { error: removeError } = await supabase
          .from('work_assignments')
          .delete()
          .eq('estate_id', estateId)
          .in('id', toRemove);
        if (removeError) throw removeError;
      }
    }

    return res.json({ success: true, estate_id: estateId, data: saved });
  } catch (err: unknown) {
    console.error('Error saving work assignments:', err);
    return res.status(500).json({ success: false, error: getSafeErrorMessage(err, 'Gagal menyimpan tugasan kerja.') });
  }
});

export default router;
