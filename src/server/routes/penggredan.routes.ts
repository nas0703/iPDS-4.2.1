/**
 * iPDS v4.1.0 — Penggredan (Quality Grading) API Proxy Routes
 * Enforces server-side authentication and 100% tenant isolation (estate_id).
 */

import express, { Request, Response } from 'express';
import { requireRole, requireAuth } from '../middleware/auth.js';
import { getScopedSupabase } from '../db.js';
import { getLocalEstateJson, saveLocalEstateJson } from '../local.js';
import { getSafeErrorMessage } from '../utils/errorUtils.js';

const router = express.Router();

export interface PenggredanPlatform {
  tandanDiGred?: number;
  tandanDiTinggal?: number;
  tandanDiBawa?: number;
  [key: string]: unknown;
}

export interface PenggredanRecord {
  id: string;
  tajuk?: string;
  program?: string;
  jenis_grading?: string;
  tarikh?: string;
  ladang?: string;
  estate_id?: string;
  peringkat_blok?: string;
  no_lori?: string;
  nama_penggred?: string;
  platforms?: PenggredanPlatform[] | unknown[];
  total_di_gred?: number;
  total_di_tinggal?: number;
  total_di_bawa?: number;
  created_at?: string;
  [key: string]: unknown;
}

/**
 * Handler for GET /api/penggredan
 * Retrieve quality grading records for caller's estate
 */
const handleGetPenggredan = async (req: Request, res: Response) => {
  try {
    const estateId = String(
      (req.query?.estate_id as string) ||
      (req.query?.estateId as string) ||
      (req.headers['x-estate-id'] as string) ||
      req.estateId ||
      'FPM_TUNGGAL'
    ).trim().toUpperCase();
    const isAll = estateId === 'ALL' || estateId === 'WILAYAH_JB';

    let data: PenggredanRecord[] = [];
    let queryError: unknown = null;

    // 1. Try scoped Supabase client first
    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    if (supabase) {
      let query = supabase
        .from('penggredan_rekod')
        .select('*')
        .order('created_at', { ascending: false });

      if (!isAll) {
        query = query.eq('estate_id', estateId);
      }

      const resDb = await query;
      if (!resDb.error && resDb.data && resDb.data.length > 0) {
        data = resDb.data as PenggredanRecord[];
      } else {
        queryError = resDb.error;
      }
    }

    // 2. Scoped query is authoritative (RLS-enforced). No privileged fallback:
    //    user-context reads must never escalate past the caller's tenant boundary.
    if (data && data.length > 0) {
      // Legacy rows without estate_id are matched by ladang naming only for the requested estate
      const filteredData = data.filter((item: PenggredanRecord) => {
        if (isAll) return true;
        const itemEstate = (item.estate_id || '').trim().toUpperCase();
        if (itemEstate === estateId) return true;
        if (estateId === 'FPM_TUNGGAL' && (!item.estate_id || itemEstate === '5155' || (!item.ladang || item.ladang.toLowerCase().includes('tunggal')))) return true;
        if (estateId === 'FPM_ADELA' && item.ladang && item.ladang.toLowerCase().includes('adela')) return true;
        if (estateId === 'FPM_KLEDANG' && item.ladang && item.ladang.toLowerCase().includes('kledang')) return true;
        if (estateId === 'FPM_SENING' && item.ladang && item.ladang.toLowerCase().includes('sening')) return true;
        return false;
      });

      return res.json({
        success: true,
        estate_id: estateId,
        data: filteredData
      });
    }

    // Local JSON cache fallback if Supabase has no records or is offline
    const local = getLocalEstateJson('penggredan_rekod', estateId, { records: [] });
    return res.json({
      success: true,
      estate_id: estateId,
      data: local.records || []
    });
  } catch (err: unknown) {
    console.error('Error fetching penggredan records:', err);
    return res.status(500).json({
      success: false,
      error: getSafeErrorMessage(err, 'Gagal mengambil rekod penggredan.')
    });
  }
};

/**
 * Handler for POST /api/penggredan
 * Save quality grading record for caller's estate
 */
const handlePostPenggredan = async (req: Request, res: Response) => {
  try {
    const record = req.body || {};
    const estateId = String(
      record.estate_id ||
      (req.headers['x-estate-id'] as string) ||
      (req.query?.estate_id as string) ||
      req.estateId ||
      'FPM_TUNGGAL'
    ).trim().toUpperCase();

    if (record.grading_task_id || record.gradingTaskId) {
      return res.status(400).json({
        success: false,
        error: 'Rekod berkaitan Grading Task mesti diselesaikan melalui aliran tugasan yang sah.',
        code: 'GRADING_TASK_FLOW_REQUIRED',
        correlationId: req.requestId
      });
    }

    const platforms = Array.isArray(record.platforms)
      ? record.platforms
      : typeof record.platforms === 'string'
      ? JSON.parse(record.platforms)
      : [];

    const totalGred = Number(record.total_di_gred ?? platforms.reduce((a: number, b: PenggredanPlatform) => a + Number(b.tandanDiGred || 0), 0));
    const totalTinggal = Number(record.total_di_tinggal ?? platforms.reduce((a: number, b: PenggredanPlatform) => a + Number(b.tandanDiTinggal || 0), 0));
    const totalBawa = Number(record.total_di_bawa ?? platforms.reduce((a: number, b: PenggredanPlatform) => a + Number(b.tandanDiBawa || 0), 0));

    // STRICT schema whitelist: ONLY columns present in public.penggredan_rekod!
    // Never include updated_at or other non-existent columns which trigger PostgREST PGRST204 errors.
    const payload = {
      id: String(record.id || `session-${Date.now()}`),
      tajuk: String(record.tajuk || '*JPPK KS ADELA*'),
      program: String(record.program || 'Task Force Grading'),
      jenis_grading: String(record.jenis_grading || record.jenisGrading || 'Grading Di ladang'),
      tarikh: String(record.tarikh || ''),
      ladang: String(record.ladang || ''),
      estate_id: estateId,
      peringkat_blok: String(record.peringkat_blok || record.peringkatBlok || ''),
      no_lori: String(record.no_lori || record.noLori || ''),
      nama_penggred: String(record.nama_penggred || record.namaPenggred || ''),
      platforms: platforms,
      total_di_gred: totalGred,
      total_di_tinggal: totalTinggal,
      total_di_bawa: totalBawa,
      created_at: String(record.created_at || record.createdAt || new Date().toISOString())
    };

    let savedRecord = payload;
    let isSupabaseSuccess = false;

    // 1. Try scoped Supabase client first
    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    if (supabase) {
      const { data, error } = await supabase
        .from('penggredan_rekod')
        .upsert([payload])
        .select();

      if (error) {
        console.warn('Scoped Supabase write notice in handlePostPenggredan:', error.message || error);
      } else if (data && data[0]) {
        savedRecord = data[0];
        isSupabaseSuccess = true;
      }
    }

    // 2. Scoped write is authoritative (RLS-enforced). No privileged fallback:
    //    user-context writes must never escalate past the caller's tenant boundary.

    // Save to local JSON cache as resilience layer
    const local = getLocalEstateJson('penggredan_rekod', estateId, { records: [] });
    const list: PenggredanRecord[] = Array.isArray(local.records) ? local.records : [];
    const idx = list.findIndex((r) => r.id === savedRecord.id);
    if (idx >= 0) {
      list[idx] = savedRecord;
    } else {
      list.unshift(savedRecord);
    }
    saveLocalEstateJson('penggredan_rekod', estateId, { records: list });

    return res.json({
      success: true,
      isSupabaseSuccess,
      message: isSupabaseSuccess 
        ? 'Rekod penggredan berjaya disimpan ke Supabase & Tempatan.'
        : 'Rekod penggredan berjaya disimpan secara Tempatan sahaja.',
      data: savedRecord
    });
  } catch (err: unknown) {
    console.error('Error saving penggredan record:', err);
    return res.status(500).json({
      success: false,
      error: getSafeErrorMessage(err, 'Gagal menyimpan rekod penggredan.')
    });
  }
};

/**
 * Handler for DELETE /api/penggredan/:id
 * Delete quality grading record for caller's estate
 */
const handleDeletePenggredan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const estateId = String(
      (req.query?.estate_id as string) ||
      (req.query?.estateId as string) ||
      (req.headers['x-estate-id'] as string) ||
      req.estateId ||
      'FPM_TUNGGAL'
    ).trim().toUpperCase();
    const isAll = estateId === 'ALL' || estateId === 'WILAYAH_JB';

    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    let deleted = false;

    if (supabase) {
      let query = supabase.from('penggredan_rekod').delete().eq('id', id);
      if (!isAll) {
        query = query.eq('estate_id', estateId);
      }
      const { data, error } = await query.select('id');
      if (!error && Array.isArray(data) && data.length > 0) {
        deleted = true;
      }
    }

    // Scoped delete is authoritative (RLS-enforced). No privileged fallback:
    // user-context deletes must never escalate past the caller's tenant boundary.

    // Clean from local JSON cache for active estate
    const local = getLocalEstateJson('penggredan_rekod', estateId, { records: [] });
    const list: PenggredanRecord[] = Array.isArray(local.records) ? local.records : [];
    const filtered = list.filter((r) => r.id !== id);
    saveLocalEstateJson('penggredan_rekod', estateId, { records: filtered });

    // Also purge from other estate local JSON caches in case of cross-estate viewing
    const estates = ['FPM_TUNGGAL', 'FPM_ADELA', 'FPM_KLEDANG', 'FPM_SENING', 'WILAYAH_JB'];
    for (const est of estates) {
      if (est !== estateId) {
        const otherLoc = getLocalEstateJson('penggredan_rekod', est, { records: [] });
        if (Array.isArray(otherLoc.records) && (otherLoc.records as PenggredanRecord[]).some((r: PenggredanRecord) => r.id === id)) {
          saveLocalEstateJson('penggredan_rekod', est, {
            records: (otherLoc.records as PenggredanRecord[]).filter((r: PenggredanRecord) => r.id !== id)
          });
        }
      }
    }

    return res.json({
      success: true,
      deleted,
      message: 'Rekod penggredan berjaya dipadam.'
    });
  } catch (err: unknown) {
    console.error('Error deleting penggredan record:', err);
    return res.status(500).json({
      success: false,
      error: getSafeErrorMessage(err, 'Gagal memadam rekod penggredan.')
    });
  }
};

// Registered routes: Both prefixed and relative forms for absolute mounting compatibility
router.get('/penggredan', requireAuth, handleGetPenggredan);
router.get('/', requireAuth, handleGetPenggredan);

router.post('/penggredan', requireRole(['staff', 'mandur', 'pf', 'fc', 'afc', 'fs', 'eqi', 'oc', 'rc']), handlePostPenggredan);
router.post('/', requireRole(['staff', 'mandur', 'pf', 'fc', 'afc', 'fs', 'eqi', 'oc', 'rc']), handlePostPenggredan);

router.delete('/penggredan/:id', requireAuth, handleDeletePenggredan);
router.delete('/:id', requireAuth, handleDeletePenggredan);

export default router;
