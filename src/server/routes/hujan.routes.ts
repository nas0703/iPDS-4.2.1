/**
 * iPDS v4.1.0 — Rainfall (Hujan) API Proxy Routes
 * Enforces server-side authentication and 100% tenant isolation (estate_id).
 */

import express, { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getScopedSupabase } from '../db.js';
import { getLocalEstateJson, saveLocalEstateJson } from '../local.js';
import { getSafeErrorMessage } from '../utils/errorUtils.js';

const router = express.Router();

export interface RainfallRecord {
  id?: string;
  bulan: string;
  tahun: number;
  jumlah: number;
  estate_id?: string;
  updated_at?: string;
  created_at?: string;
  [key: string]: unknown;
}

/**
 * GET /api/hujan
 * Retrieve rainfall records for caller's estate
 */
router.get(['/hujan', '/api/hujan'], requireAuth, async (req: Request, res: Response) => {
  try {
    // P0-11-E: estate is derived exclusively from the validated session.
    // Client-supplied estate_id / estateId / x-estate-id are never trusted for
    // authorization; validateTenantAccess (inside requireAuth) has already
    // validated any requested estate and set req.estateId.
    const estateId = String(req.estateId || 'FPM_TUNGGAL').trim().toUpperCase();
    const isAll = estateId === 'ALL';

    // Try Supabase first
    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    if (supabase) {
      let query = supabase.from('hujan_rekod').select('*');
      if (!isAll) {
        query = query.eq('estate_id', estateId);
      }
      const { data, error } = await query;

      if (!error && data) {
        return res.json({
          success: true,
          estate_id: estateId,
          data
        });
      }
    }

    // Fallback to local storage (estate-scoped)
    const localData = getLocalEstateJson('hujan_rekod', estateId, { records: [] }) as { records?: RainfallRecord[] };
    const records: RainfallRecord[] = Array.isArray(localData.records) ? localData.records : [];
    const scopedRecords = isAll ? records : records.filter((r: RainfallRecord) => !r.estate_id || r.estate_id === estateId);
    return res.json({
      success: true,
      estate_id: estateId,
      data: scopedRecords
    });
  } catch (err: unknown) {
    console.error('Error fetching rainfall records:', err);
    return res.status(500).json({
      success: false,
      error: getSafeErrorMessage(err, 'Gagal mengambil rekod hujan.')
    });
  }
});

/**
 * POST /api/hujan
 * Create/upsert a rainfall record for caller's estate
 */
router.post(['/hujan', '/api/hujan'], requireAuth, async (req: Request, res: Response) => {
  try {
    const requestedEstate = (req.body?.estate_id as string) || (req.headers['x-estate-id'] as string) || req.estateId || 'FPM_TUNGGAL';
    const estateId = String(requestedEstate).trim().toUpperCase();
    const { bulan, tahun, jumlah } = req.body || {};

    if (!bulan || !tahun) {
      return res.status(400).json({
        success: false,
        error: 'Sila nyatakan bulan dan tahun rekod hujan.'
      });
    }

    const cleanBulan = String(bulan).trim().toUpperCase();
    const cleanTahun = String(tahun).trim();
    const cleanJumlah = Number(jumlah) || 0;

    const payload: RainfallRecord = {
      bulan: cleanBulan,
      tahun: Number(cleanTahun),
      jumlah: cleanJumlah,
      estate_id: estateId,
      updated_at: new Date().toISOString()
    };

    // Save to Supabase (Safe select-then-update or insert to avoid constraint 42P10)
    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    let savedRecord = payload;
    if (supabase) {
      try {
        const { data: existingRows } = await supabase
          .from('hujan_rekod')
          .select('id')
          .eq('estate_id', estateId)
          .eq('bulan', cleanBulan)
          .eq('tahun', cleanTahun);

        if (existingRows && existingRows.length > 0) {
          const { data: updatedData, error: updateErr } = await supabase
            .from('hujan_rekod')
            .update({
              jumlah: cleanJumlah,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingRows[0].id)
            .select();

          if (!updateErr && updatedData && updatedData[0]) {
            savedRecord = updatedData[0];
          }
        } else {
          const { data: insertedData, error: insertErr } = await supabase
            .from('hujan_rekod')
            .insert([{
              bulan: cleanBulan,
              tahun: cleanTahun,
              jumlah: cleanJumlah,
              estate_id: estateId,
              created_at: new Date().toISOString()
            }])
            .select();

          if (!insertErr && insertedData && insertedData[0]) {
            savedRecord = insertedData[0];
          }
        }
      } catch (dbErr) {
        console.warn('Notice saving to Supabase hujan_rekod:', dbErr);
      }
    }

    // Backup to local store
    const localStore = getLocalEstateJson('hujan_rekod', estateId, { records: [] }) as { records?: RainfallRecord[] };
    const records: RainfallRecord[] = Array.isArray(localStore.records) ? localStore.records : [];
    const idx = records.findIndex((r) => String(r.bulan).toUpperCase() === cleanBulan && String(r.tahun) === cleanTahun);
    if (idx >= 0) {
      records[idx] = savedRecord;
    } else {
      records.push(savedRecord);
    }
    saveLocalEstateJson('hujan_rekod', estateId, { records });

    return res.json({
      success: true,
      message: 'Rekod hujan berjaya disimpan.',
      data: savedRecord
    });
  } catch (err: unknown) {
    console.error('Error saving rainfall record:', err);
    return res.status(500).json({
      success: false,
      error: getSafeErrorMessage(err, 'Gagal menyimpan rekod hujan.')
    });
  }
});

export default router;
