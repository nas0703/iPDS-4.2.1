import express from 'express';
import { getScopedSupabase, getWriteSupabase, getPrivilegedSupabase, isMissingTableError } from '../db.js';
import { getLocalHantaran, saveLocalHantaran } from '../local.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getReceiptEstate, setReceiptEstate } from '../estateStore.js';
import { getEstateConfig, getBlockArea, getPktDisplayName } from '../../config/estateRegistry.js';
import { generateAdelaBaselineTransactions } from '../../data/adelaBaselineDeliveries.js';
import { cleanAndExtractBlockCode } from '../../utils/formatters.js';
import { jobQueueService } from '../services/jobQueue.service.js';
import { getSafeErrorMessage } from '../utils/errorUtils.js';

const router = express.Router();

export interface HantaranRecord {
  id?: string;
  no_resit: string;
  no_akaun_terima?: string;
  no_lori: string;
  no_seal?: string;
  no_nota_hantaran?: string;
  kpg?: string;
  blok: string;
  peringkat?: string;
  tan?: number;
  berat_tan?: number;
  berat_bersih_tan?: number;
  muda?: number;
  bts_muda?: number;
  reject?: number;
  sample?: number;
  bts_count?: number;
  bil_tandan?: number;
  rm_mt?: number;
  hasil_rm?: number;
  thek?: number;
  tarikh?: string;
  masa_masuk?: string;
  estate_id?: string;
  [key: string]: unknown;
}

// API Routes
router.post("/hantaran", requireRole(['rc', 'oc', 'staff', 'mandur', 'pf', 'fc', 'afc', 'fs']), async (req, res) => {
  try {
    const data = req.body;

    // Basic validation
    if (!data.no_resit || !data.no_lori || !data.blok) {
      return res.status(400).json({
        success: false,
        error: "Maklumat tidak lengkap. Sila pastikan No. Resit, No. Lori dan Blok diisi."
      });
    }

    let targetEstate = (data.estate_id as string) || (req.headers['x-estate-id'] as string) || req.estateId || '';
    const resitNo = String(data.no_resit || '').toUpperCase();
    const nota = String(data.no_nota_hantaran || '').trim();
    const kod = String(data.kod_penjual || '').trim();
    const nama = String(data.nama_penjual || '').toUpperCase();
    const akaun = String(data.no_akaun_terima || '').toUpperCase();

    // 1. Determine inferred estate based on metadata
    let inferredEstate = '';
    let inferredName = '';
    let inferredCode = '';

    if (nota.startsWith('136') || nota.startsWith('5136') || kod.startsWith('5136') || kod.includes('5136') || nama.includes('ADELA') || akaun.includes('ADELA') || resitNo.includes('ADL') || resitNo.startsWith('ADL-')) {
      inferredEstate = 'FPM_ADELA';
      inferredName = 'FPM Adela';
      inferredCode = '5136';
    } else if (nota.startsWith('176') || nota.startsWith('5176') || kod.startsWith('5176') || kod.includes('5176') || nama.includes('KLEDANG') || akaun.includes('KLEDANG') || resitNo.includes('KLD') || resitNo.startsWith('KLD-')) {
      inferredEstate = 'FPM_KLEDANG';
      inferredName = 'FPM Kledang';
      inferredCode = '5176';
    } else if (nota.startsWith('156') || nota.startsWith('5156') || kod.startsWith('5156') || kod.includes('5156') || nama.includes('SENING') || akaun.includes('SENING') || resitNo.includes('SNG') || resitNo.startsWith('SNG-')) {
      inferredEstate = 'FPM_SENING';
      inferredName = 'FPM Sening';
      inferredCode = '5156';
    } else if (nota.startsWith('155') || nota.startsWith('5155') || kod.startsWith('5155') || kod.includes('5155') || nama.includes('TUNGGAL') || akaun.includes('TUNGGAL') || resitNo.includes('TGL') || resitNo.startsWith('TGL-')) {
      inferredEstate = 'FPM_TUNGGAL';
      inferredName = 'FPM Tunggal';
      inferredCode = '5155';
    }

    // 2. Strict Boundary Control: Block cross-estate submissions if targetEstate contradicts inferredEstate
    if (targetEstate && inferredEstate && targetEstate !== inferredEstate) {
      const targetCfg = getEstateConfig(targetEstate);
      return res.status(400).json({
        success: false,
        error: `⛔ SEKATAN PERSEMPADAN LADANG: Resit ini dikesan milik ${inferredName} (Kod ${inferredCode}), tetapi anda membuat serahan ke ${targetCfg.name}. Pemasukan resit merentasi ladang disekat demi ketepatan data!`
      });
    }

    if (!targetEstate) {
      targetEstate = inferredEstate || 'FPM_TUNGGAL';
    }

    const rawBlok = data.blok ? data.blok.toString().trim().toUpperCase() : '';
    const estateCfg = getEstateConfig(targetEstate);

    // Support alphanumeric blocks like 1F, 2F, 125Y, 128Y, 121V or numeric 1-99
    const extractedBlok = cleanAndExtractBlockCode(rawBlok);
    let cleanBlok = extractedBlok || rawBlok;
    const rawUpper = String(cleanBlok || "").toUpperCase().trim();
    const pUpper = String(data.peringkat || "").toUpperCase();
    const kpUpper = String(data.kod_penjual || "").toUpperCase();
    const kaUpper = String(data.kod_akaun_bts || "").toUpperCase();
    const npUpper = String(data.nama_penjual || "").toUpperCase();

    const has020 =
      kpUpper.includes("-020-") ||
      kaUpper.includes("-020-") ||
      /[-_]020[-_]/.test(kpUpper) ||
      /[-_]020[-_]/.test(kaUpper) ||
      /\b\d{4}-020-/.test(kpUpper) ||
      /\b\d{4}-020-/.test(kaUpper) ||
      /\b020\b/.test(kaUpper);

    const isPkt2 =
      rawUpper.startsWith("P2-") || rawUpper.startsWith("P2 ") || rawUpper.startsWith("PKT 2") || rawUpper.startsWith("PKT2") ||
      pUpper.includes("002") || pUpper.includes("PKT 2") || pUpper.includes("PKT2") || pUpper.includes("PERINGKAT 2") ||
      has020 ||
      npUpper.includes("PKT 2") || npUpper.includes("PERINGKAT 2");

    let pkt = "001";
    if (targetEstate === 'FPM_ADELA') {
      const strippedBlok = cleanBlok.replace(/^(?:P[12]|PKT\s*[12])[-\s:]*/i, "").trim();
      const digitsOnly = strippedBlok.replace(/[^0-9]/g, '');
      const bNum = digitsOnly ? parseInt(digitsOnly, 10) : NaN;
      if (isPkt2) {
        pkt = "002";
        if (!isNaN(bNum) && bNum >= 1 && bNum <= 6) {
          cleanBlok = String(bNum + 11);
        } else if (!isNaN(bNum) && bNum >= 12 && bNum <= 17) {
          cleanBlok = String(bNum);
        }
      } else {
        if (!isNaN(bNum) && bNum >= 12 && bNum <= 17) {
          pkt = "002";
          cleanBlok = String(bNum);
        } else if (!isNaN(bNum) && bNum >= 1 && bNum <= 11) {
          pkt = "001";
          cleanBlok = String(bNum);
        } else if (cleanBlok.toUpperCase().includes("F")) {
          pkt = "003";
        } else if (cleanBlok.toUpperCase().includes("Y") || cleanBlok.toUpperCase().includes("V")) {
          pkt = "004";
        } else {
          pkt = "001";
        }
      }
    } else {
      if (estateCfg.blocks && estateCfg.blocks[cleanBlok]) {
        // direct match with estate block definition
      } else {
        const numMatch = rawBlok.match(/^\d+/);
        const num = numMatch ? parseInt(numMatch[0], 10).toString() : rawBlok;
        if (estateCfg.blocks && estateCfg.blocks[num]) {
          cleanBlok = num;
        }
      }
      const blockInfo = estateCfg.blocks ? estateCfg.blocks[cleanBlok] : undefined;
      pkt = blockInfo?.pkt ? blockInfo.pkt.replace('PKT ', '') : "001";
      if (!blockInfo) {
        const bNum = parseInt(cleanBlok.replace(/[^0-9]/g, ''), 10);
        if (targetEstate === 'FPM_TUNGGAL') {
          if (bNum >= 1 && bNum <= 17) pkt = "001";
          else if (bNum >= 18 && bNum <= 22) pkt = "002";
          else if (bNum === 88 || cleanBlok === "LF" || cleanBlok === "88F") pkt = "003";
        } else {
          if (!isNaN(bNum)) {
            if (bNum >= 1 && bNum <= 17) pkt = "001";
            else if (bNum >= 18 && bNum <= 22) pkt = "002";
            else if (bNum >= 23 && bNum <= 30) pkt = "003";
          }
        }
      }
    }

    const now = new Date();
    const myTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    const calendarToday = myTime.toISOString().split('T')[0];

    let dateStr = data.tarikh;
    if (dateStr) {
      dateStr = dateStr.trim();
      if (dateStr.includes('/')) {
        let [d, m, y] = dateStr.split('/');
        if (y && y.length === 2) y = '20' + y;
        dateStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      } else if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts[0].length === 4) {
          // Keep as is
        } else if (parts[2] && parts[2].length === 4) {
          dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      const currentYearStr = String(myTime.getUTCFullYear());
      let parsedParts = dateStr.split('-');
      if (parsedParts.length === 3) {
         if (parsedParts[0].length === 4 && parsedParts[0] !== currentYearStr) {
           parsedParts[0] = currentYearStr;
           dateStr = parsedParts.join('-');
         }
      }
    }

    if (!dateStr || !dateStr.includes('-')) {
      dateStr = calendarToday;
    }

    const tanValue = parseFloat(data.tan) || 0;
    const rm_mt = parseFloat(data.rm_mt) || 0;
    const hasil_rm = parseFloat((tanValue * rm_mt).toFixed(2));
    const luasBlok = getBlockArea(cleanBlok, targetEstate) || 1;
    const thekValue = tanValue / luasBlok;

    // Injected with secure server session claims and estate_id
    const payload = {
      no_resit: data.no_resit.trim().toUpperCase(),
      no_akaun_terima: data.no_akaun_terima?.trim().toUpperCase() || '',
      no_lori: data.no_lori.trim().toUpperCase(),
      no_seal: data.no_seal?.trim().toUpperCase() || '',
      no_nota_hantaran: data.no_nota_hantaran?.trim().toUpperCase() || '',
      kpg: data.kpg?.trim().toUpperCase() || '',
      kpa: data.kpa === '' || data.kpa === null || data.kpa === undefined ? null : parseFloat(data.kpa),
      blok: cleanBlok,
      peringkat: data.is_efb ? "EFB" : getPktDisplayName(pkt, targetEstate),
      tan: tanValue,
      muda: parseInt(data.muda) || 0,
      reject: parseFloat(data.reject) || 0,
      sample: parseInt(data.sample) || 0,
      rm_mt: rm_mt,
      hasil_rm: hasil_rm,
      thek: parseFloat(thekValue.toFixed(2)),
      tarikh: dateStr,
      masa_masuk: data.masa_masuk || now.toLocaleTimeString('en-GB', { hour12: false }),
      created_at: now.toISOString(),
      estate_id: targetEstate,
      recorded_by_kiosk: req.user?.sub,
      operator_id: req.user?.app_metadata.operator_id,
      operator_name: req.user?.user_metadata.operator_name,
      session_id: req.user?.session_id
    };

    // Register receipt to target estate in persistent registry
    setReceiptEstate(payload.no_resit, targetEstate);

    // ==========================================
    // DUPLICATE RECORD DETECTION & BLOCKING GUARD
    // Menghalang kemasukan kali kedua (pencegahan overwrite)
    // ==========================================
    const localData = getLocalHantaran() || [];
    const normalizedNoResit = payload.no_resit.trim().toUpperCase();
    const normalizedNoAkuan = payload.no_akaun_terima ? payload.no_akaun_terima.trim().toUpperCase() : '';

    // 1. Semak pendua dalam storan setempat (No Akuan Terima atau No Resit)
    const duplicateByAkuan = normalizedNoAkuan
      ? (localData as HantaranRecord[]).find((r: HantaranRecord) => String(r.no_akaun_terima || '').trim().toUpperCase() === normalizedNoAkuan)
      : null;
    const duplicateByResit = normalizedNoResit
      ? (localData as HantaranRecord[]).find((r: HantaranRecord) => String(r.no_resit || '').trim().toUpperCase() === normalizedNoResit)
      : null;

    const matchedDuplicate = duplicateByAkuan || duplicateByResit;
    if (matchedDuplicate) {
      const conflictField = duplicateByAkuan
        ? `No. Akuan Terima "${normalizedNoAkuan}"`
        : `No. Resit "${normalizedNoResit}"`;
      return res.status(409).json({
        success: false,
        duplicate: true,
        error: `Pemasukan disekat! Resit dengan ${conflictField} telah pun wujud dalam sistem (${matchedDuplicate.tarikh || ''} - Lori: ${matchedDuplicate.no_lori || ''}, Berat: ${matchedDuplicate.tan || 0} MT). Pemasukan kali kedua dihalang bagi mengelakkan penimpaan (overwrite) data.`,
        existingRecord: {
          no_resit: matchedDuplicate.no_resit,
          no_akaun_terima: matchedDuplicate.no_akaun_terima,
          tarikh: matchedDuplicate.tarikh,
          no_lori: matchedDuplicate.no_lori,
          tan: matchedDuplicate.tan,
          blok: matchedDuplicate.blok
        }
      });
    }

    // 2. Semak pendua dalam pangkalan data Supabase jika bersambung
    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    if (supabase) {
      try {
        if (normalizedNoAkuan) {
          const { data: sbByAkuan } = await supabase
            .from('hantaran_hasil')
            .select('no_resit, no_akaun_terima, tarikh, no_lori, tan, blok')
            .eq('no_akaun_terima', normalizedNoAkuan)
            .limit(1);
          if (sbByAkuan && sbByAkuan.length > 0) {
            const m = sbByAkuan[0];
            return res.status(409).json({
              success: false,
              duplicate: true,
              error: `Pemasukan disekat! Resit dengan No. Akuan Terima "${normalizedNoAkuan}" telah pun wujud dalam pangkalan data (${m.tarikh || ''} - Lori: ${m.no_lori || ''}). Pemasukan kali kedua dihalang bagi mengelakkan overwrite.`,
              existingRecord: m
            });
          }
        }
        if (normalizedNoResit) {
          const { data: sbByResit } = await supabase
            .from('hantaran_hasil')
            .select('no_resit, no_akaun_terima, tarikh, no_lori, tan, blok')
            .eq('no_resit', normalizedNoResit)
            .limit(1);
          if (sbByResit && sbByResit.length > 0) {
            const m = sbByResit[0];
            return res.status(409).json({
              success: false,
              duplicate: true,
              error: `Pemasukan disekat! Resit dengan No. Resit "${normalizedNoResit}" telah pun wujud dalam pangkalan data (${m.tarikh || ''} - Lori: ${m.no_lori || ''}). Pemasukan kali kedua dihalang bagi mengelakkan overwrite.`,
              existingRecord: m
            });
          }
        }
      } catch (checkErr) {
        console.warn("Notice checking duplicate in supabase:", checkErr);
      }
    }

    let dbSuccess = false;
    let supabaseSuccess = false;

    // 1. Always persist to resilient local JSON storage (Dual-Persistence Guarantee)
    try {
      localData.unshift(payload);
      saveLocalHantaran(localData);
      dbSuccess = true;
    } catch (localErr) {
      console.warn("Local storage write warning:", localErr);
    }

    // 2. Scoped Supabase Insert (Pencegahan overwrite pada POST baharu)
    if (supabase) {
      try {
        let { error: sbError } = await supabase.from('hantaran_hasil').insert([payload]);

        // If error is about missing column (e.g. estate_id, recorded_by_kiosk, etc.)
        if (sbError && (sbError.code === '42703' || sbError.message?.includes('column') || sbError.message?.includes('estate_id'))) {
          console.warn("Column not found in hantaran_hasil table, retrying with base fields only...");
          const { estate_id, recorded_by_kiosk, operator_id, operator_name, session_id, ...basePayload } = payload;
          const retryRes = await supabase.from('hantaran_hasil').insert([basePayload]);
          sbError = retryRes.error;
        }

        // If table hantaran_hasil not found, try fallback table hantaran
        if (sbError && (sbError.code === '42P01' || sbError.message?.includes('relation "hantaran_hasil" does not exist'))) {
          const { estate_id, recorded_by_kiosk, operator_id, operator_name, session_id, ...basePayload } = payload;
          const retryRes = await supabase.from('hantaran').insert([basePayload]);
          sbError = retryRes.error;
        }

        if (sbError) {
          console.warn("Supabase upsert warning:", sbError.message);
          // If conflict or constraint, don't fail if local save succeeded
        } else {
          dbSuccess = true;
          supabaseSuccess = true;
        }
      } catch (sbErr: unknown) {
        console.warn("Database operation warning:", getSafeErrorMessage(sbErr));
      }
    }

    if (supabaseSuccess) {
      try {
        await jobQueueService.dispatchJob({
          type: 'GRADING_TASK_RECEIPT_MATCH',
          estate_id: targetEstate,
          created_by_user_id: req.user?.sub || 'authenticated-user',
          created_by_operator_id: req.user?.app_metadata.operator_id || 'unknown-operator',
          created_by_role: req.authRole || req.user?.app_metadata.app_role || 'staff',
          payload: { no_resit: payload.no_resit },
          priority: 'HIGH',
          idempotency_key: `grading-receipt-match:${targetEstate}:${payload.no_resit}`
        });
      } catch (jobError) {
        console.warn('Grading Task receipt-match dispatch warning:', jobError);
      }
    }

    res.json({
      success: true,
      ref: payload.no_resit,
      sync: { db: dbSuccess }
    });
  } catch (err: unknown) {
    console.error("Unexpected server error:", err);
    res.status(500).json({ success: false, error: "Ralat pelayan dalaman. Sila cuba sebentar lagi." });
  }
});

export function inferEstateFromReceipt(record: HantaranRecord | Record<string, unknown>): string {
  return getReceiptEstate(record);
}

router.get("/hantaran", requireAuth, async (req, res) => {
  try {
    const queryEstate = req.query.estate_id ? String(req.query.estate_id).trim().toUpperCase() : undefined;
    const rawTarget = queryEstate || String(req.estateId || 'FPM_TUNGGAL').trim().toUpperCase();
    const targetEstate = rawTarget.trim().toUpperCase();
    const isAll = targetEstate === 'ALL' || targetEstate === 'WILAYAH_JB' || targetEstate === 'WJB' || targetEstate === '0001';

    let allRecords: HantaranRecord[] = [];
    const supabase = req.supabase || getScopedSupabase(req.rawToken);

    if (supabase) {
      let start = 0;
      const limit = 1000;
      let hasMore = true;

      // Tier 1: Query all records from hantaran_hasil
      try {
        while (hasMore) {
          let query = supabase
            .from('hantaran_hasil')
            .select('*')
            .order('tarikh', { ascending: false });

          if (!isAll) {
            query = query.eq('estate_id', targetEstate);
          }

          let { data: records, error } = await query.range(start, start + limit - 1);

          if (error) {
            console.warn("Hantaran_hasil query notice:", error.message || error);
            // Resilient fallback with privileged client if scoped had decode issues
            const priv = getPrivilegedSupabase();
            if (priv) {
              let pQuery = priv.from('hantaran_hasil').select('*').order('tarikh', { ascending: false });
              if (!isAll) pQuery = pQuery.eq('estate_id', targetEstate);
              const pRes = await pQuery.range(start, start + limit - 1);
              records = pRes.data;
              error = pRes.error;
            }
          }

          if (error) {
            break;
          }

          if (records && records.length > 0) {
            allRecords = allRecords.concat(records as HantaranRecord[]);
            if (records.length < limit) {
              hasMore = false;
            } else {
              start += limit;
            }
          } else {
            hasMore = false;
          }
        }
      } catch (ex) {
        console.warn("Hantaran_hasil query exception:", ex);
      }

      // Tier 2: Fallback to 'hantaran' table if 0 records
      if (allRecords.length === 0) {
        try {
          const { data: altRecords } = await supabase
            .from('hantaran')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1000);
          if (altRecords && altRecords.length > 0) {
            allRecords = altRecords as HantaranRecord[];
          }
        } catch (_) {}
      }

      // Tier 3: Merge local JSON backup records
      const local = getLocalHantaran();
      if (Array.isArray(local) && local.length > 0) {
        const existingResits = new Set(allRecords.map(r => String(r.no_resit || '').toUpperCase()));
        for (const locRec of (local as HantaranRecord[])) {
          const resitKey = String(locRec.no_resit || '').toUpperCase();
          if (resitKey && !existingResits.has(resitKey)) {
            allRecords.push(locRec);
          }
        }
      }
    } else {
      allRecords = (getLocalHantaran() as HantaranRecord[]) || [];
    }

    // Tier 4: For FPM_ADELA (or region query), merge and override with official calibrated baseline records
    const adelaBaseline = generateAdelaBaselineTransactions() as HantaranRecord[];
    const baselineMap = new Map(adelaBaseline.map(b => [String(b.no_resit).toUpperCase(), b]));
    const seenBaselines = new Set<string>();

    allRecords = allRecords.map(r => {
      const resitKey = String(r.no_resit || '').toUpperCase();
      if (baselineMap.has(resitKey)) {
        seenBaselines.add(resitKey);
        return { ...r, ...baselineMap.get(resitKey) };
      }
      return r;
    });

    for (const bRec of adelaBaseline) {
      const resitKey = String(bRec.no_resit || '').toUpperCase();
      if (!seenBaselines.has(resitKey)) {
        allRecords.push(bRec);
      }
    }

    // Normalize & classify estate_id on every single record using the persistent estate registry
    const classifiedRecords = allRecords.map(r => {
      const estateId = getReceiptEstate(r);
      return {
        ...r,
        estate_id: estateId
      };
    });

    // Strictly filter records for the requested estate
    const filtered = isAll
      ? classifiedRecords
      : classifiedRecords.filter(r => r.estate_id === targetEstate);

    res.json(filtered);
  } catch (err: unknown) {
    console.error("Fetch error:", err);
    let local = (getLocalHantaran() as HantaranRecord[]) || [];
    const targetEstate = String(req.estateId || 'FPM_TUNGGAL').trim().toUpperCase();
    const isAll = targetEstate === 'ALL' || targetEstate === 'WILAYAH_JB' || targetEstate === 'WJB' || targetEstate === '0001';

    if (!local.some((r: HantaranRecord) => getReceiptEstate(r) === 'FPM_ADELA')) {
      local = [...local, ...(generateAdelaBaselineTransactions() as HantaranRecord[])];
    }

    const classified = local.map((r: HantaranRecord) => ({ ...r, estate_id: getReceiptEstate(r) }));
    const filtered = isAll ? classified : classified.filter((r: HantaranRecord) => r.estate_id === targetEstate);
    res.json(filtered);
  }
});

router.post("/annual-yield", requireRole(['pf', 'fc', 'afc', 'fs']), async (req, res) => {
  try {
    const { year, yield: yieldVal } = req.body;
    if (!year) return res.status(400).json({ error: "Tahun diperlukan." });

    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    if (supabase) {
      let { error } = await supabase
        .from('annual_yield')
        .upsert({
          year: parseInt(year),
          yield: parseFloat(yieldVal) || 0,
          estate_id: req.estateId || 'FPM_TUNGGAL'
        }, { onConflict: 'year' });

      // Resilient fallback: If annual_yield table does not exist, write to block_annual_yields
      if (error && (error.code === '42P01' || error.message?.includes('schema cache'))) {
        const resBlock = await supabase
          .from('block_annual_yields')
          .upsert({
            year: parseInt(year),
            block: 'ALL',
            yield: parseFloat(yieldVal) || 0
          }, { onConflict: 'year,block' });
        error = resBlock.error;
      }

      if (error) throw error;
      res.json({ success: true });
    } else {
      res.status(500).json({ error: "Supabase tidak dikonfigurasi." });
    }
  } catch (err: unknown) {
    console.error("Annual yield save error:", err);
    res.status(500).json({ error: "Gagal menyimpan data tahunan." });
  }
});

router.get("/annual-yield", requireAuth, async (req, res) => {
  try {
    const queryEstate = req.query.estate_id ? String(req.query.estate_id).trim().toUpperCase() : undefined;
    const estateId = queryEstate || String(req.estateId || 'FPM_TUNGGAL').trim().toUpperCase();
    const isAll = estateId === 'ALL' || estateId === 'WILAYAH_JB' || estateId === 'WJB' || estateId === '0001';
    let supabase = req.supabase || getScopedSupabase(req.rawToken);
    if (!supabase || isAll) {
      supabase = getWriteSupabase() || supabase;
    }
    if (supabase) {
      let yQuery = supabase.from('annual_yield').select('*');
      if (!isAll) yQuery = yQuery.eq('estate_id', estateId);
      let { data, error } = await yQuery.order('year', { ascending: true });

      if (error && (error.code === '42P01' || error.message?.includes('schema cache'))) {
        let bQuery = supabase.from('block_annual_yields').select('id, year, block, yield, created_at, estate_id');
        if (!isAll) bQuery = bQuery.eq('estate_id', estateId);
        const resBlock = await bQuery.order('year', { ascending: true });
        data = resBlock.data;
        error = resBlock.error;
      }

      if (error) {
        if (error.code === '42P01' || error.message?.includes('schema cache')) return res.json([]);
        throw error;
      }
      res.json(data || []);
    } else {
      res.json([]);
    }
  } catch (err: unknown) {
    console.error("Annual yield fetch error:", err);
    res.status(500).json({ error: "Gagal mengambil data tahunan." });
  }
});

router.get("/block-annual-yields", requireAuth, async (req, res) => {
  try {
    const queryEstate = req.query.estate_id ? String(req.query.estate_id).trim().toUpperCase() : undefined;
    const estateId = queryEstate || String(req.estateId || 'FPM_TUNGGAL').trim().toUpperCase();
    const isAll = estateId === 'ALL' || estateId === 'WILAYAH_JB' || estateId === 'WJB' || estateId === '0001';
    let supabase = req.supabase || getScopedSupabase(req.rawToken);
    if (!supabase || isAll) {
      supabase = getWriteSupabase() || supabase;
    }
    if (supabase) {
      let blockQuery = supabase.from('block_annual_yields').select('*');
      if (!isAll) blockQuery = blockQuery.eq('estate_id', estateId);
      const { data, error } = await blockQuery.order('year', { ascending: true });

      if (error) {
        if (isMissingTableError(error) || error.code === '42P01' || error.message?.includes('schema cache')) {
          return res.json([]);
        }
        console.warn("Block annual yield fetch error:", error.message);
        return res.json([]);
      }
      res.json(data || []);
    } else {
      res.json([]);
    }
  } catch (err: unknown) {
    console.warn("Block annual yield fetch exception:", err);
    res.json([]);
  }
});

router.post("/seed-historical", requireRole(['pf', 'fc']), async (req, res) => {
  try {
    const { data } = req.body;
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: "Data diperlukan." });
    }

    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    if (supabase) {
      const enriched = (data as Record<string, unknown>[]).map(item => ({
        ...item,
        estate_id: req.estateId || 'FPM_TUNGGAL'
      }));

      const { error } = await supabase
        .from('block_annual_yields')
        .upsert(enriched, { onConflict: 'year,block' });

      if (error) throw error;
      res.json({ success: true, count: data.length });
    } else {
      res.status(500).json({ error: "Supabase tidak dikonfigurasi." });
    }
  } catch (err: unknown) {
    console.error("Seeding error:", err);
    res.status(500).json({ error: "Gagal menyimpan data sejarah." });
  }
});

router.delete("/hantaran/all", requireRole(['rc', 'oc', 'pf', 'fc']), async (req, res) => {
  try {
    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    if (supabase) {
      const { error } = await supabase
        .from('hantaran_hasil')
        .delete()
        .neq('no_resit', '0');

      if (error) throw error;
      res.json({ success: true });
    } else {
      saveLocalHantaran([]);
      res.json({ success: true });
    }
  } catch (err: unknown) {
    console.error("Delete all error:", err);
    res.status(500).json({ success: false, error: "Gagal memadam semua data." });
  }
});

router.put("/hantaran/:no_resit", requireRole(['rc', 'oc', 'staff', 'mandur', 'pf', 'fc', 'afc', 'fs']), async (req, res) => {
  try {
    const { no_resit } = req.params;
    const data = req.body;

    if (!no_resit) return res.status(400).json({ success: false, error: "No. Resit diperlukan." });
    if (!data.no_lori || !data.blok) {
      return res.status(400).json({
        success: false,
        error: "Maklumat tidak lengkap. Sila pastikan No. Lori dan Blok diisi."
      });
    }

    const targetEstate = (
      data.estate_id ||
      req.headers['x-estate-id'] ||
      req.estateId ||
      'FPM_TUNGGAL'
    ).toString().trim().toUpperCase();

    const estateCfg = getEstateConfig(targetEstate);
    const rawBlok = data.blok ? data.blok.toString().trim().toUpperCase() : '';

    // Support alphanumeric blocks like 1F, 2F, 125Y, 128Y, 121V or numeric 1-99
    const extractedBlok = cleanAndExtractBlockCode(rawBlok);
    let cleanBlok = extractedBlok || rawBlok;
    const rawUpper = String(cleanBlok || "").toUpperCase().trim();
    const pUpper = String(data.peringkat || "").toUpperCase();
    const kpUpper = String(data.kod_penjual || "").toUpperCase();
    const kaUpper = String(data.kod_akaun_bts || "").toUpperCase();
    const npUpper = String(data.nama_penjual || "").toUpperCase();

    const has020 =
      kpUpper.includes("-020-") ||
      kaUpper.includes("-020-") ||
      /[-_]020[-_]/.test(kpUpper) ||
      /[-_]020[-_]/.test(kaUpper) ||
      /\b\d{4}-020-/.test(kpUpper) ||
      /\b\d{4}-020-/.test(kaUpper) ||
      /\b020\b/.test(kaUpper);

    const isPkt2 =
      rawUpper.startsWith("P2-") || rawUpper.startsWith("P2 ") || rawUpper.startsWith("PKT 2") || rawUpper.startsWith("PKT2") ||
      pUpper.includes("002") || pUpper.includes("PKT 2") || pUpper.includes("PKT2") || pUpper.includes("PERINGKAT 2") ||
      has020 ||
      npUpper.includes("PKT 2") || npUpper.includes("PERINGKAT 2");

    let pkt = "001";
    if (targetEstate === 'FPM_ADELA') {
      const strippedBlok = cleanBlok.replace(/^(?:P[12]|PKT\s*[12])[-\s:]*/i, "").trim();
      const digitsOnly = strippedBlok.replace(/[^0-9]/g, '');
      const bNum = digitsOnly ? parseInt(digitsOnly, 10) : NaN;
      if (isPkt2) {
        pkt = "002";
        if (!isNaN(bNum) && bNum >= 1 && bNum <= 6) {
          cleanBlok = String(bNum + 11);
        } else if (!isNaN(bNum) && bNum >= 12 && bNum <= 17) {
          cleanBlok = String(bNum);
        }
      } else {
        if (!isNaN(bNum) && bNum >= 12 && bNum <= 17) {
          pkt = "002";
          cleanBlok = String(bNum);
        } else if (!isNaN(bNum) && bNum >= 1 && bNum <= 11) {
          pkt = "001";
          cleanBlok = String(bNum);
        } else if (cleanBlok.toUpperCase().includes("F")) {
          pkt = "003";
        } else if (cleanBlok.toUpperCase().includes("Y") || cleanBlok.toUpperCase().includes("V")) {
          pkt = "004";
        } else {
          pkt = "001";
        }
      }
    } else {
      if (estateCfg.blocks && estateCfg.blocks[cleanBlok]) {
        // direct match with estate block definition
      } else {
        const numMatch = rawBlok.match(/^\d+/);
        const num = numMatch ? parseInt(numMatch[0], 10).toString() : rawBlok;
        if (estateCfg.blocks && estateCfg.blocks[num]) {
          cleanBlok = num;
        }
      }
      const blockInfo = estateCfg.blocks ? estateCfg.blocks[cleanBlok] : undefined;
      pkt = blockInfo?.pkt ? blockInfo.pkt.replace('PKT ', '') : "001";
      if (!blockInfo) {
        const bNum = parseInt(cleanBlok.replace(/[^0-9]/g, ''), 10);
        if (targetEstate === 'FPM_TUNGGAL') {
          if (bNum >= 1 && bNum <= 17) pkt = "001";
          else if (bNum >= 18 && bNum <= 22) pkt = "002";
          else if (bNum === 88 || cleanBlok === "LF" || cleanBlok === "88F") pkt = "003";
        } else {
          if (!isNaN(bNum)) {
            if (bNum >= 1 && bNum <= 17) pkt = "001";
            else if (bNum >= 18 && bNum <= 22) pkt = "002";
            else if (bNum >= 23 && bNum <= 30) pkt = "003";
          }
        }
      }
    }

    let dateStr = data.tarikh;
    if (dateStr) {
      dateStr = dateStr.trim();
      if (dateStr.includes('/')) {
        let [d, m, y] = dateStr.split('/');
        if (y && y.length === 2) y = '20' + y;
        dateStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      } else if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts[0].length === 4) {
          // Keep as is
        } else if (parts[2] && parts[2].length === 4) {
          dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
    }

    const tanValue = parseFloat(data.tan) || 0;
    const rm_mt = parseFloat(data.rm_mt) || 0;
    const hasil_rm = parseFloat((tanValue * rm_mt).toFixed(2));
    const luasBlok = getBlockArea(cleanBlok, targetEstate) || 1;
    const thekValue = tanValue / luasBlok;

    const payload: HantaranRecord = {
      no_resit: no_resit.toUpperCase(),
      no_akaun_terima: data.no_akaun_terima?.trim().toUpperCase() || '',
      no_lori: data.no_lori.trim().toUpperCase(),
      no_seal: data.no_seal?.trim().toUpperCase() || '',
      no_nota_hantaran: data.no_nota_hantaran?.trim().toUpperCase() || '',
      kpg: data.kpg?.trim().toUpperCase() || '',
      kpa: data.kpa === '' || data.kpa === null || data.kpa === undefined ? null : parseFloat(data.kpa),
      blok: cleanBlok,
      peringkat: data.is_efb ? "EFB" : getPktDisplayName(pkt, targetEstate),
      tan: tanValue,
      muda: parseInt(data.muda) || 0,
      reject: parseFloat(data.reject) || 0,
      sample: parseInt(data.sample) || 0,
      rm_mt: rm_mt,
      hasil_rm: hasil_rm,
      thek: parseFloat(thekValue.toFixed(2)),
      tarikh: dateStr,
      masa_masuk: data.masa_masuk || undefined,
      estate_id: targetEstate
    };

    setReceiptEstate(no_resit.toUpperCase(), targetEstate);

    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    let dbSuccess = false;

    // Always update local cache
    try {
      const localData = (getLocalHantaran() as HantaranRecord[]) || [];
      const updatedData = localData.map((r: HantaranRecord) =>
        String(r.no_resit || '').toUpperCase() === no_resit.toUpperCase() ? { ...r, ...payload } : r
      );
      saveLocalHantaran(updatedData);
      dbSuccess = true;
    } catch (localErr) {
      console.warn("Local update warning:", localErr);
    }

    if (supabase) {
      try {
        const { error } = await supabase
          .from('hantaran_hasil')
          .update(payload)
          .eq('no_resit', no_resit.toUpperCase());

        if (error) {
          console.warn("Supabase update error:", error.message);
        } else {
          dbSuccess = true;
        }
      } catch (e: unknown) {
        console.warn("Supabase update exception:", getSafeErrorMessage(e));
      }
    }

    res.json({ success: true, ref: no_resit });
  } catch (err: unknown) {
    console.error("Update error:", err);
    res.status(500).json({ success: false, error: "Gagal mengemaskini data." });
  }
});

router.delete("/hantaran/:no_resit", requireRole(['rc', 'oc', 'pf', 'fc', 'afc', 'fs', 'staff', 'mandur']), async (req, res) => {
  try {
    const { no_resit } = req.params;
    if (!no_resit) return res.status(400).json({ success: false, error: "No. Resit diperlukan." });

    const supabase = req.supabase || getScopedSupabase(req.rawToken);

    // Always delete from local storage
    try {
      const localData = (getLocalHantaran() as HantaranRecord[]) || [];
      const updatedData = localData.filter((r: HantaranRecord) => String(r.no_resit || '').toUpperCase() !== no_resit.toUpperCase());
      saveLocalHantaran(updatedData);
    } catch (localErr) {
      console.warn("Local delete warning:", localErr);
    }

    if (supabase) {
      try {
        const { error } = await supabase
          .from('hantaran_hasil')
          .delete()
          .eq('no_resit', no_resit.toUpperCase());

        if (error) {
          console.warn("Supabase delete warning:", error.message);
        }
      } catch (e: unknown) {
        console.warn("Supabase delete exception:", getSafeErrorMessage(e));
      }
    }

    res.json({ success: true });
  } catch (err: unknown) {
    console.error("Delete error:", err);
    res.status(500).json({ success: false, error: "Gagal memadam data." });
  }
});

router.get("/config-check", (req, res) => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  const isReady = !!(supabaseUrl && supabaseAnonKey && supabaseUrl !== 'https://placeholder.supabase.co');

  res.json({
    supabase: isReady,
    googleSheets: false,
    supabaseUrl: isReady ? supabaseUrl : undefined,
    supabaseAnonKey: isReady ? supabaseAnonKey : undefined,
    env: process.env.NODE_ENV || 'development'
  });
});

export default router;

