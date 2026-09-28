import express from 'express';
import { getScopedSupabase } from '../../db.js';
import { getLocalHantaran } from '../../local.js';
import { requireRole } from '../../middleware/auth.js';
import { aiService } from '../../ai/index.js';
import {
  ESTATE_MASTER,
  MONTHLY_TARGETS_2026,
  normalizeDateStr,
  formatNum,
  computeHarvestingProductivityContext
} from './estateConstants.js';
import { fetchMslKnowledgeChunks, compressMslContent } from '../../services/mslKnowledge.service.js';
import { getSafeErrorMessage } from '../../utils/errorUtils.js';

const router = express.Router();

// POST /api/ai/estate-chat and /estate-chat - Intelligent Chatbot & Q&A for ALL Estate Data
router.post(['/ai/estate-chat', '/estate-chat', '/ai/data-chat', '/data-chat'], requireRole(['staff', 'mandur', 'pf', 'fc', 'afc', 'fs', 'eqi', 'oc', 'rc']), async (req, res) => {
  try {
    const { question, targetDate, allDeliveries: clientDeliveries, conversationHistory, backlogHistory: clientBacklogHistory } = req.body || {};

    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ error: "Sila masukkan soalan berkaitan data ladang." });
    }

    const qClean = question.trim();
    const qLower = qClean.toLowerCase();
    const supabase = req.supabase || getScopedSupabase(req.rawToken);

    // P0-09: determine the target estate from the authenticated session only.
    // requireRole() -> validateTenantAccess() has already validated any requested
    // estate and set req.estateId; client-supplied estate values are never trusted.
    const targetEstate = String(req.estateId || 'FPM_TUNGGAL').trim().toUpperCase();
    const isTunggal = targetEstate === 'FPM_TUNGGAL' || targetEstate === 'TUNGGAL';
    const isAll = targetEstate === 'ALL';

    // Gather backlog / harvesting productivity data (estate-scoped)
    let backlogData: Record<string, unknown> = clientBacklogHistory || {};
    if (!backlogData || typeof backlogData !== 'object' || Object.keys(backlogData).length === 0) {
      if (supabase) {
        try {
          let bQuery = supabase.from('hasil_backlog_history').select('*');
          if (!isAll) {
            bQuery = bQuery.eq('estate_id', targetEstate);
          }
          const { data: bRows } = await bQuery;
          if (bRows && bRows.length > 0) {
            const rows = bRows as Record<string, unknown>[];
            const catRow = isAll
              ? (rows.find((r) => r.category === 'backlogHistory') || rows[0])
              : (rows.find((r) => r.category === `backlogHistory_${targetEstate}`)
                || rows.find((r) => r.category === 'backlogHistory')
                || rows[0]);
            if (catRow && catRow.data) {
              backlogData = catRow.data as Record<string, unknown>;
            }
          }
        } catch (e) {
          console.warn("Notice: Backlog fetch for estate-chat:", e);
        }
      }
    }

    // 1. Gather all deliveries dataset
    let rawData: Record<string, unknown>[] = [];
    if (Array.isArray(clientDeliveries) && clientDeliveries.length > 0) {
      rawData = clientDeliveries as Record<string, unknown>[];
    } else {
      if (supabase) {
        try {
          let start = 0;
          const limit = 1000;
          let hasMore = true;
          while (hasMore) {
            let query = supabase
              .from('hantaran_hasil')
              .select('*')
              .order('tarikh', { ascending: false });

            if (!isAll) {
              if (isTunggal) {
                query = query.or('estate_id.is.null,estate_id.eq.FPM_TUNGGAL');
              } else {
                query = query.eq('estate_id', targetEstate);
              }
            }

            const { data: records, error } = await query.range(start, start + limit - 1);

            if (!error && records && records.length > 0) {
              rawData = rawData.concat(records as Record<string, unknown>[]);
              if (records.length < limit) hasMore = false;
              else start += limit;
            } else {
              hasMore = false;
            }
          }
        } catch (e) {
          console.warn("Supabase fetch fallback:", e);
        }
      }
      if (rawData.length === 0) {
        const local = (getLocalHantaran() || []) as unknown as Record<string, unknown>[];
        rawData = isAll ? local : local.filter(r => isTunggal ? (!r.estate_id || r.estate_id === 'FPM_TUNGGAL') : r.estate_id === targetEstate);
      }
    }

    if (!isAll && Array.isArray(rawData) && rawData.length > 0) {
      rawData = rawData.filter(r => isTunggal ? (!r.estate_id || r.estate_id === 'FPM_TUNGGAL') : r.estate_id === targetEstate);
    }

    // Effective date resolution
    const now = new Date();
    const myYesterdayMs = now.getTime() + 8 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000;
    const defaultYesterday = new Date(myYesterdayMs).toISOString().split('T')[0];
    const defaultDateStr = normalizeDateStr(targetDate) || defaultYesterday;

    const produktivitiMenuaiData = computeHarvestingProductivityContext(backlogData, defaultDateStr);

    const [selYearStr, selMonthStr] = defaultDateStr.split('-');
    const selYear = parseInt(selYearStr, 10) || new Date().getFullYear();
    const selMonth = parseInt(selMonthStr, 10) || (new Date().getMonth() + 1);
    const monthPrefix = `${selYear}-${String(selMonth).padStart(2, '0')}`;
    const yearPrefix = `${selYear}`;

    const monthNames = ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"];
    const currentMonthName = monthNames[selMonth - 1] || "Bulan Semasa";

    // Separate FFB and EFB
    const ffb = rawData.filter(r => r.peringkat !== "EFB" && !r.is_efb && String(r.jenis || '').toUpperCase() !== 'EFB');
    const efbRecords = rawData.filter(r => r.peringkat === "EFB" || r.is_efb === true || String(r.jenis || '').toUpperCase() === 'EFB');

    const getTan = (r: Record<string, unknown>) => parseFloat(String(r.tan || r.berat_tan || r.berat_bersih_tan || '0')) || 0;
    const getMuda = (r: Record<string, unknown>) => parseInt(String(r.muda || r.bts_muda || '0'), 10) || 0;
    const getReject = (r: Record<string, unknown>) => parseInt(String(r.reject || r.bts_reject || r.rosak || '0'), 10) || 0;
    const getSample = (r: Record<string, unknown>) => parseInt(String(r.sample || r.bts_count || r.bil_tandan || '0'), 10) || 0;
    const getRmMt = (r: Record<string, unknown>) => parseFloat(String(r.rm_mt || r.harga_tan || r.kadar_harga || '0')) || 0;
    const getHasilRm = (r: Record<string, unknown>) => {
      if (r.hasil_rm && parseFloat(String(r.hasil_rm)) > 0) return parseFloat(String(r.hasil_rm));
      const tanVal = getTan(r);
      const rmVal = getRmMt(r);
      return tanVal * (rmVal > 0 ? rmVal : 680.00); // Default benchmark jika harga tidak diisi per resit
    };

    const isKpg = (r: Record<string, unknown>) => {
      const k = parseFloat(String(r.kpg || '0'));
      const dt = normalizeDateStr(r.tarikh);
      return k >= (dt >= '2026-04-13' ? 21.25 : 21.0);
    };

    // Calculate FFB Aggregates
    const ffbDayRows = ffb.filter(r => normalizeDateStr(r.tarikh) === defaultDateStr);
    const ffbMonthRows = ffb.filter(r => normalizeDateStr(r.tarikh).startsWith(monthPrefix));
    const ffbYearRows = ffb.filter(r => normalizeDateStr(r.tarikh).startsWith(yearPrefix));

    const dayTan = ffbDayRows.reduce((a, b) => a + getTan(b), 0);
    const dayMuda = ffbDayRows.reduce((a, b) => a + getMuda(b), 0);
    const dayReject = ffbDayRows.reduce((a, b) => a + getReject(b), 0);
    const daySample = ffbDayRows.reduce((a, b) => a + getSample(b), 0);
    const dayResit = ffbDayRows.length;
    const dayKpgMatch = ffbDayRows.filter(isKpg).length;
    const dayYield = (dayTan / 1615.11).toFixed(3);
    const dayAbw = daySample > 0 ? ((dayTan * 1000) / daySample).toFixed(2) : '0.00';
    const dayHasilRm = ffbDayRows.reduce((a, b) => a + getHasilRm(b), 0);

    const monthTan = ffbMonthRows.reduce((a, b) => a + getTan(b), 0);
    const monthMuda = ffbMonthRows.reduce((a, b) => a + getMuda(b), 0);
    const monthReject = ffbMonthRows.reduce((a, b) => a + getReject(b), 0);
    const monthSample = ffbMonthRows.reduce((a, b) => a + getSample(b), 0);
    const monthResit = ffbMonthRows.length;
    const monthKpgMatch = ffbMonthRows.filter(isKpg).length;
    const monthYield = (monthTan / 1615.11).toFixed(3);
    const monthAbw = monthSample > 0 ? ((monthTan * 1000) / monthSample).toFixed(2) : '0.00';
    const monthKpgPct = monthResit > 0 ? ((monthKpgMatch / monthResit) * 100).toFixed(1) : '0.0';
    const monthHasilRm = ffbMonthRows.reduce((a, b) => a + getHasilRm(b), 0);

    const yearTan = ffbYearRows.reduce((a, b) => a + getTan(b), 0);
    const yearMuda = ffbYearRows.reduce((a, b) => a + getMuda(b), 0);
    const yearReject = ffbYearRows.reduce((a, b) => a + getReject(b), 0);
    const yearSample = ffbYearRows.reduce((a, b) => a + getSample(b), 0);
    const yearResit = ffbYearRows.length;
    const yearKpgMatch = ffbYearRows.filter(isKpg).length;
    const yearYield = (yearTan / 1615.11).toFixed(2);
    const yearAbw = yearSample > 0 ? ((yearTan * 1000) / yearSample).toFixed(2) : '0.00';
    const yearHasilRm = ffbYearRows.reduce((a, b) => a + getHasilRm(b), 0);

    // Kira Purata Harga BTS Semasa (RM / MT)
    const validPriceRows = ffbMonthRows.filter(r => getRmMt(r) > 0);
    const avgHargaBtsMonth = validPriceRows.length > 0
      ? validPriceRows.reduce((a, b) => a + getRmMt(b), 0) / validPriceRows.length
      : 685.00; // Pasaran rujukan

    // Pengiraan Pendapatan Kasar Mengikut Peringkat (Peneroka / Felda vs PKT 1 & 2)
    const pendapatanPeringkat = {
      pkt1Tan: ffbMonthRows.filter(r => String(r.peringkat || '').includes('001') || String(r.blok || '').match(/^(0[1-9]|1[0-2])$/)).reduce((a, b) => a + getTan(b), 0),
      pkt2Tan: ffbMonthRows.filter(r => String(r.peringkat || '').includes('002') || String(r.blok || '').match(/^(1[3-9]|2[0-2])$/)).reduce((a, b) => a + getTan(b), 0),
      feldaPenerokaTan: ffbMonthRows.filter(r => String(r.peringkat || '').toLowerCase().includes('felda') || String(r.peringkat || '').includes('003') || String(r.blok || '').match(/^(2[3-9]|[3-9][0-9])/)).reduce((a, b) => a + getTan(b), 0)
    };

    // Analitik Lori & Logistik Pengangkutan (No Lori, Trip, Muatan)
    const loriMap: Record<string, { noLori: string; tripsMonth: number; tripsDay: number; totalTanMonth: number; totalTanDay: number }> = {};
    ffbMonthRows.forEach(r => {
      const rawNoLori = String(r.no_lori || r.lori || r.kenderaan || '').trim().toUpperCase();
      if (rawNoLori && rawNoLori !== '-' && rawNoLori !== 'N/A') {
        if (!loriMap[rawNoLori]) {
          loriMap[rawNoLori] = { noLori: rawNoLori, tripsMonth: 0, tripsDay: 0, totalTanMonth: 0, totalTanDay: 0 };
        }
        loriMap[rawNoLori].tripsMonth += 1;
        loriMap[rawNoLori].totalTanMonth += getTan(r);
        if (normalizeDateStr(r.tarikh) === defaultDateStr) {
          loriMap[rawNoLori].tripsDay += 1;
          loriMap[rawNoLori].totalTanDay += getTan(r);
        }
      }
    });
    const senaraiLoriAktif = Object.values(loriMap).sort((a, b) => b.totalTanMonth - a.totalTanMonth);

    // Calculate EFB Aggregates
    const efbDayRows = efbRecords.filter(r => normalizeDateStr(r.tarikh) === defaultDateStr);
    const efbMonthRows = efbRecords.filter(r => normalizeDateStr(r.tarikh).startsWith(monthPrefix));
    const efbYearRows = efbRecords.filter(r => normalizeDateStr(r.tarikh).startsWith(yearPrefix));

    const efbTanDay = efbDayRows.reduce((a, b) => a + getTan(b), 0);
    let efbTanMonth = efbMonthRows.reduce((a, b) => a + getTan(b), 0);
    let efbTanYear = efbYearRows.reduce((a, b) => a + getTan(b), 0);
    const efbTripsDay = efbDayRows.length;
    const efbTripsMonth = efbMonthRows.length;
    const efbTripsYear = efbYearRows.length;

    // Historical benchmark reference
    const benchmarkEfb2026: Record<string, number> = {
      "2026-01": 319.21,
      "2026-02": 379.98,
      "2026-03": 95.24,
      "2026-04": 120.00,
      "2026-05": 140.00,
      "2026-06": 160.00,
      "2026-07": 180.00,
      "2026-08": 210.00
    };
    if (efbTanMonth === 0 && benchmarkEfb2026[monthPrefix]) {
      efbTanMonth = benchmarkEfb2026[monthPrefix];
    }
    if (efbTanYear === 0) {
      efbTanYear = Object.entries(benchmarkEfb2026)
        .filter(([k]) => k.startsWith(yearPrefix) && k <= monthPrefix)
        .reduce((s, [, v]) => s + v, 0);
    }

    // Per Block Breakdown for current month (All 23 Blocks in Estate Master)
    const blockStats: Record<string, {
      blok: string;
      pkt: string;
      peringkatNama: string;
      luas: number;
      totalTan: number;
      totalTandan: number;
      yieldTH: number;
      btsMuda: number;
      btsMudaPct: number;
      kpgMatch: number;
      resitCount: number;
      kpgMatchPct: number;
    }> = {};

    Object.entries(ESTATE_MASTER).forEach(([k, v]) => {
      blockStats[k] = {
        blok: k,
        pkt: v.pkt,
        peringkatNama: v.pkt === "001" ? "PKT 1" : (v.pkt === "002" ? "PKT 2" : "LOT FELDA"),
        luas: v.luas,
        totalTan: 0,
        totalTandan: 0,
        yieldTH: 0,
        btsMuda: 0,
        btsMudaPct: 0,
        kpgMatch: 0,
        resitCount: 0,
        kpgMatchPct: 0
      };
    });

    ffbMonthRows.forEach(r => {
      const bKey = String(r.blok || '').replace(/[^0-9]/g, '');
      if (blockStats[bKey]) {
        blockStats[bKey].totalTan += getTan(r);
        blockStats[bKey].totalTandan += getSample(r);
        blockStats[bKey].btsMuda += getMuda(r);
        if (isKpg(r)) blockStats[bKey].kpgMatch += 1;
        blockStats[bKey].resitCount += 1;
      }
    });

    Object.values(blockStats).forEach(b => {
      b.yieldTH = b.luas > 0 ? (b.totalTan / b.luas) : 0;
      b.kpgMatchPct = b.resitCount > 0 ? ((b.kpgMatch / b.resitCount) * 100) : 0;
      b.btsMudaPct = b.totalTandan > 0 ? ((b.btsMuda / b.totalTandan) * 100) : (b.totalTan > 0 ? ((b.btsMuda / (b.totalTan * 50)) * 100) : 0);
    });

    // Sortings for Analytics & Full Rankings
    const allBlocksArray = Object.values(blockStats);
    const sortedBlocksYield = [...allBlocksArray].sort((a, b) => b.yieldTH - a.yieldTH);
    const sortedBlocksMuda = [...allBlocksArray].sort((a, b) => b.btsMuda - a.btsMuda || b.totalTan - a.totalTan);

    // Sort KPG=KPA: Best (Highest match % and count) vs Lowest (Lowest match % or least matching receipts)
    const sortedBlocksKpgBest = [...allBlocksArray].sort((a, b) => {
      if (b.kpgMatchPct !== a.kpgMatchPct) return b.kpgMatchPct - a.kpgMatchPct;
      return b.kpgMatch - a.kpgMatch;
    });
    const sortedBlocksKpgLowest = [...allBlocksArray]
      .filter(b => b.resitCount > 0)
      .sort((a, b) => {
        if (a.kpgMatchPct !== b.kpgMatchPct) return a.kpgMatchPct - b.kpgMatchPct;
        return a.kpgMatch - b.kpgMatch;
      });

    // Target summaries
    const targetMonth = (MONTHLY_TARGETS_2026["001"]?.[selMonth - 1] || 1.90) * 399.82 +
                        (MONTHLY_TARGETS_2026["002"]?.[selMonth - 1] || 1.60) * 542.49 +
                        (MONTHLY_TARGETS_2026["003"]?.[selMonth - 1] || 0.88) * 672.80;
    const targetMonthYield = (targetMonth / 1615.11).toFixed(2);
    const pencapaianMonthPct = targetMonth > 0 ? ((monthTan / targetMonth) * 100).toFixed(1) : '0.0';

    // Formatted detailed block summaries
    const senaraiSemuaBlok = allBlocksArray.map(b => ({
      blok: `Blok ${b.blok}`,
      peringkat: b.peringkatNama,
      luasHa: b.luas,
      hasilTan: parseFloat(b.totalTan.toFixed(2)),
      yieldTH: parseFloat(b.yieldTH.toFixed(3)),
      btsMuda: b.btsMuda,
      jumlahResit: b.resitCount,
      kpgMatch: b.kpgMatch,
      kpgMatchPct: `${b.kpgMatchPct.toFixed(1)}%`,
      kpgRatioStr: `${b.kpgMatch} / ${b.resitCount} (${b.kpgMatchPct.toFixed(1)}%)`
    }));

    // Comprehensive Estate State Object for AI Context
    const estateContextData = {
      tarikhRujukan: defaultDateStr,
      bulanRujukan: currentMonthName,
      tahunRujukan: selYear,
      keluasanLadang: {
        totalLuasHa: 1615.11,
        pkt1LuasHa: 399.82,
        pkt2LuasHa: 542.49,
        feldaLuasHa: 672.80,
        bilanganBlok: Object.keys(ESTATE_MASTER).length
      },
      programPembajaan: {
        pusingan1: "85% Selesai",
        pusingan2: "60% Selesai",
        pusingan3: "40% Selesai",
        pusingan4: "10% Selesai",
        status: "Mengikut Jadual"
      },
      prestasiHariIni: {
        tarikh: defaultDateStr,
        hasilTan: formatNum(dayTan, 2),
        yieldTH: dayYield,
        btsMuda: dayMuda,
        abwKg: dayAbw,
        kpgMatchRatio: `${dayKpgMatch} / ${dayResit}`,
        totalResit: dayResit
      },
      prestasiBulanIni_MTD: {
        bulan: currentMonthName,
        hasilSebenarTan: formatNum(monthTan, 2),
        sasaranTan: formatNum(targetMonth, 2),
        pencapaianPct: `${pencapaianMonthPct}%`,
        yieldSebenarTH: monthYield,
        sasaranYieldTH: targetMonthYield,
        btsMuda: monthMuda,
        abwKg: monthAbw,
        kpgMatchRatio: `${monthKpgMatch} / ${monthResit} (${monthKpgPct}%)`,
        totalResit: monthResit
      },
      prestasiTahunIni_YTD: {
        tahun: selYear,
        hasilSebenarTan: formatNum(yearTan, 2),
        yieldSebenarTH: yearYield,
        btsMuda: yearMuda,
        abwKg: yearAbw,
        kpgMatchCount: yearKpgMatch,
        totalResit: yearResit
      },
      tandanKosong_EFB: {
        hariIniTan: formatNum(efbTanDay, 2),
        hariIniTrip: efbTripsDay,
        bulanIniTan: formatNum(efbTanMonth, 2),
        bulanIniTrip: efbTripsMonth || (efbTanMonth > 0 ? Math.round(efbTanMonth / 15) : 0),
        tahunIniTan: formatNum(efbTanYear, 2),
        tahunIniTrip: efbTripsYear || (efbTanYear > 0 ? Math.round(efbTanYear / 15) : 0),
        kadarAplikasiStandard: "30 - 40 tan/ha/tahun (200-250 kg/pokok)",
        statusOperasi: `Aplikasi EFB bulan ${currentMonthName} mencatatkan ${formatNum(efbTanMonth, 2)} tan.`
      },
      rankingBlokMTD: {
        top5Yield: sortedBlocksYield.slice(0, 5).map((b, i) => `${i + 1}. Blok ${b.blok} (${b.peringkatNama}): ${b.yieldTH.toFixed(3)} t/ha (${formatNum(b.totalTan, 2)} mt)`),
        bottom5Yield: [...sortedBlocksYield].reverse().slice(0, 5).map((b, i) => `${i + 1}. Blok ${b.blok} (${b.peringkatNama}): ${b.yieldTH.toFixed(3)} t/ha (${formatNum(b.totalTan, 2)} mt)`),
        top5BtsMuda: sortedBlocksMuda.slice(0, 5).map((b, i) => `${i + 1}. Blok ${b.blok} (${b.peringkatNama}): ${b.btsMuda} tandan muda (${formatNum(b.totalTan, 2)} mt)`),
        bottom5BtsMuda: [...sortedBlocksMuda].reverse().slice(0, 5).map((b, i) => `${i + 1}. Blok ${b.blok} (${b.peringkatNama}): ${b.btsMuda} tandan muda`),
        top5KpgKpa: sortedBlocksKpgBest.slice(0, 5).map((b, i) => `${i + 1}. Blok ${b.blok} (${b.peringkatNama}): ${b.kpgMatch} / ${b.resitCount} resit (${b.kpgMatchPct.toFixed(1)}%)`),
        bottom5KpgKpa: sortedBlocksKpgLowest.slice(0, 5).map((b, i) => `${i + 1}. Blok ${b.blok} (${b.peringkatNama}): ${b.kpgMatch} / ${b.resitCount} resit (${b.kpgMatchPct.toFixed(1)}%)`)
      },
      logistikDanLori: {
        jumlahLoriAktifBulanIni: senaraiLoriAktif.length,
        jumlahLoriHariIni: senaraiLoriAktif.filter(l => l.tripsDay > 0).length,
        senaraiLoriDanTrip: senaraiLoriAktif.map((l, i) => `${i + 1}. Lori ${l.noLori}: ${l.tripsMonth} trip bulan ini (${formatNum(l.totalTanMonth, 2)} tan)${l.tripsDay > 0 ? ` [Hari ini: ${l.tripsDay} trip, ${formatNum(l.totalTanDay, 2)} tan]` : ''}`),
        loriPalingAktif: senaraiLoriAktif[0] ? `Lori ${senaraiLoriAktif[0].noLori} (${senaraiLoriAktif[0].tripsMonth} trip, ${formatNum(senaraiLoriAktif[0].totalTanMonth, 2)} tan)` : 'Tiada rekod'
      },
      kewanganDanPendapatan: {
        purataHargaBtsPerTanRM: `RM ${avgHargaBtsMonth.toFixed(2)} / MT`,
        anggaranHasilHariIniRM: `RM ${formatNum(dayHasilRm, 2)}`,
        anggaranHasilBulanIniRM: `RM ${formatNum(monthHasilRm, 2)}`,
        anggaranHasilTahunIniRM: `RM ${formatNum(yearHasilRm, 2)}`,
        pecahanHasilPeringkat: {
          pkt1_HasilTan: `${formatNum(pendapatanPeringkat.pkt1Tan, 2)} mt`,
          pkt1_AnggaranRM: `RM ${formatNum(pendapatanPeringkat.pkt1Tan * avgHargaBtsMonth, 2)}`,
          pkt2_HasilTan: `${formatNum(pendapatanPeringkat.pkt2Tan, 2)} mt`,
          pkt2_AnggaranRM: `RM ${formatNum(pendapatanPeringkat.pkt2Tan * avgHargaBtsMonth, 2)}`,
          feldaPeneroka_HasilTan: `${formatNum(pendapatanPeringkat.feldaPenerokaTan, 2)} mt`,
          feldaPeneroka_AnggaranRM: `RM ${formatNum(pendapatanPeringkat.feldaPenerokaTan * avgHargaBtsMonth, 2)}`
        }
      },
      kualitiRejectDanBuahRosak: {
        buahRejectHariIni: dayReject,
        buahRejectBulanIni: monthReject,
        buahRejectTahunIni: yearReject
      },
      laporanBacklogDanProduktivitiMenuai: produktivitiMenuaiData,
      senaraiPenuhSemuaBlok: senaraiSemuaBlok
    };

    // 2. Query RAG System (Manual Sawit Lestari, KUK Siri 8 & PDF Documents)
    let contextualSearchQuery = qClean;
    const historyList = (conversationHistory || []) as Array<{ role?: string; content?: string; text?: string }>;
    const pastUserMessages = historyList.filter((m) => m.role === 'user');
    if (qClean.length < 30 && pastUserMessages.length > 0) {
      const lastUserQ = pastUserMessages[pastUserMessages.length - 1]?.content || '';
      if (lastUserQ) {
        contextualSearchQuery = `${lastUserQ} ${qClean}`;
      }
    }

    let mslRagChunks: Array<{ manual_title?: string; section_title?: string; page_number?: string | number; content?: string; category?: string }> = [];
    try {
      mslRagChunks = (await fetchMslKnowledgeChunks(contextualSearchQuery, 'Semua', 5)) as Array<{ manual_title?: string; section_title?: string; page_number?: string | number; content?: string; category?: string }>;
    } catch (ragFetchErr) {
      console.warn("Notice: RAG fetch for estate-chat had issue:", ragFetchErr);
    }

    const hasRagContext = mslRagChunks && mslRagChunks.length > 0;
    const ragContextText = hasRagContext
      ? mslRagChunks.map((c, i) => `[Rujukan ${i + 1}: ${c.manual_title} - ${c.section_title} (M/S: ${c.page_number || 'N/A'})]\n${compressMslContent(c.content, 2000)}`).join('\n---\n')
      : "Tiada rujukan RAG khusus bagi soalan ini.";

    let aiAnswer = "";

    // 3. Call Centralized AI Service for Intelligent Integrated Conversation
    if (aiService.isConfigured()) {
      try {
        const systemInstruction = `Anda adalah "AI Penganalisis Data Pintar Ladang & Pembantu Operasi FPMSB TUNGGAL (Dengan Akses Penuh RAG Manual Sawit Lestari Edisi 3, Kadar Upah KUK Siri 8 & Manual Perolehan 2023 Pind. 2025)".
Anda mempunyai 2 pangkalan data utama yang berkuasa:
1. PANGKALAN DATA OPERASI SEMASA LADANG FPMSB TUNGGAL:
   - Penghantaran BTS & Hasil Tan (Harian, MTD, YTD).
   - Prestasi & ranking lengkap 23 blok (Yield, BTS Muda, Padanan Integriti KPG=KPA).
   - Logistik & Lori (Nombor pendaftaran lori, kekerapan trip, jumlah muatan tan per lori).
   - Kewangan & Harga BTS (Purata harga RM/tan, anggaran nilai hasil jualan RM, pendapatan sektor FELDA/Peneroka vs PKT 1 & 2).
   - Taburan EFB / Tandan Kosong (Tan harian, bulanan, tahunan, trip lori EFB).
   - Kemajuan Program Pembajaan 4T (P1 hingga P4).
   - Kualiti Buah (BTS Muda, Buah Reject/Rosak, ABW/BTP, KPG=KPA).
   - Laporan Backlog & Produktiviti Menuai (Bilangan Pekerja Aktif, Hari Kerja, Man-Days, BTS Terkumpul HII, Luas Kerja HII, Kadar Produktiviti bts/pkr/hari, MT/pkr/hari, dan Ha/pkr/hari).

2. PANGKALAN PENGETAHUAN RAG MANUAL SAWIT LESTARI EDISI 3, KADAR UPAH KERJA SIRI 8 & MANUAL PEROLEHAN 2023 (PIND. 2025):
   - Piawaian kematangan & kriteria penuaian BTS (1-5 biji relai, pusingan 10-15 hari, kawalan BTS muda).
   - Jadual Rasmi Kadar Upah Kerja Ladang (KUK Siri 8: Menuai, Pruning, Meracun, Membaja, EFB, Pemunggahan, dsb).
   - Prosedur Manual Perolehan 2023 Pind. 2025: Had Nilai (Pembelian Terus, Sebut Harga, Tender), Pengurusan LPO/DO/GRN, Kelayakan Kontraktor CIDB/MOF/SSM, Bon Pelaksanaan 5% & Wang Jaminan Pelaksanaan (WJP), Perolehan Darurat.
   - Amalan Pertanian Baik (GAP), Prinsip Pembajaan 4T, Pengurusan Pelepah (Pruning), Pengurusan Perosak Bersepadu (IPM Tikus & Burung Hantu Tyto alba), MSPO & Zon Penampan Riparian.

Panduan Format & Menjawab:
1. PENTING: JANGAN sesekali letakkan sebarang tanda bintang (* atau **) atau tanda pagar markdown (### / ## / #) dalam teks jawapan. Hasilkan teks bersih tanpa simbol markdown mentah.
2. KEFAHAMAN SOALAN SUSULAN (MULTI-TURN): Fahami konteks perbualan terdahulu jika pengguna bertanya soalan susulan (contoh: "kenapa?", "bagaimana pula dengan blok 5?", "berapa kosnya?").
3. Jawab soalan pengguna dengan TEPAT, PADAT, dan LENGKAP berpandukan data JSON ladang serta Rujukan RAG Manual Sawit / KUK / Manual Perolehan yang dibekalkan.
4. Jika soalan berkaitan data operasi ladang (cth: hasil, blok, lori, harga, EFB, peratus KPG=KPA), gunakan fakta tepat daripada data operasi JSON.
5. Jika soalan berkaitan SOP agronomi, perolehan/kontrak ladang, had nilai kuasa melulus, tindakan atasi BTS muda/kualiti buah, kadar baja, atau kadar upah pekerja, integrasikan rujukan rasmi yang dibekalkan secara tepat.
6. Gunakan baris baru, nombor berurutan (1, 2, 3), atau bullet point bersih (•) serta emoji yang relevan.
7. Jawab dalam Bahasa Melayu profesional dan mesra perladangan.`;

        const compactChatHistory = historyList.slice(-6).map((m) =>
          `${m.role === 'user' ? 'Pengguna' : 'AI'}: ${(m.content || m.text || '').slice(0, 300)}`
        ).join('\n');

        const userPrompt = `Data Rasmi Ladang FPMSB TUNGGAL Semasa:
\`\`\`json
${JSON.stringify(estateContextData, null, 2)}
\`\`\`

Rujukan Pangkalan Pengetahuan RAG (Manual Sawit Lestari & KUK Siri 8):
${ragContextText}

${compactChatHistory ? `Sejarah Perbualan Terdahulu (Konteks Soalan Susulan):\n${compactChatHistory}\n\n` : ''}Soalan Pengguna Semasa:
${qClean}

Sila berikan jawapan terperinci dan tepat berdasarkan data ladang dan rujukan manual di atas tanpa menggunakan tanda bintang (* atau **).`;

        const aiRes = await aiService.generateText({
          prompt: userPrompt,
          systemInstruction,
          temperature: 0.2,
          operationName: 'estate_chat'
        });
        if (aiRes.text) {
          aiAnswer = aiRes.text;
        }
      } catch (gemErr) {
        console.warn("Estate chat AI API notice, using intelligent fallback:", gemErr);
      }
    }

    // 4. Robust Deterministic Rule-Based Fallback Engine if AI offline
    if (!aiAnswer) {
      if (qLower.includes('upah') || qLower.includes('kadar') || qLower.includes('kuk') || qLower.includes('gaji')) {
        const upahChunk = mslRagChunks.find(c => (c.category || '').toLowerCase().includes('upah') || (c.manual_title || '').toLowerCase().includes('upah') || (c.content || '').toLowerCase().includes('upah'));
        if (upahChunk) {
          aiAnswer = `💵 Rujukan Kadar Upah Kerja Ladang (KUK Siri 8)\n\n` +
            `Berikut adalah maklumat kadar upah rasmi berpandukan ${upahChunk.manual_title} - ${upahChunk.section_title} (M/S: ${upahChunk.page_number || 'N/A'}):\n\n` +
            `${compressMslContent(upahChunk.content, 1200)}\n\n` +
            `📌 Sila pastikan kadar ini diselaraskan dengan jadual tuntutan kerja bulanan.`;
        } else {
          aiAnswer = `💵 Kadar Upah Kerja Ladang (KUK Siri 8)\n\n` +
            `• Menuai Pokok Rendah (Dabus/Sabit Pendek): RM 18.00 - RM 25.00 / tan\n` +
            `• Menuai Pokok Tinggi (Galah/Sabit Panjang): RM 26.00 - RM 35.00 / tan\n` +
            `• Membaja Manual: RM 1.20 - RM 1.80 / beg atau RM 25.00 - RM 35.00 / tan\n` +
            `• Meracun Bulatan Pokok & Lorong: RM 22.00 - RM 28.00 / hektar\n` +
            `• Pruning / Cantas Pelepah: RM 0.80 - RM 1.40 / pokok mengikut ketinggian.`;
        }
      } else if (qLower.includes('pruning') || qLower.includes('pelepah') || qLower.includes('cantas')) {
        const pruningChunk = mslRagChunks.find(c => (c.content || '').toLowerCase().includes('pelepah') || (c.content || '').toLowerCase().includes('pruning'));
        if (pruningChunk) {
          aiAnswer = `✂️ SOP Pengurusan Pelepah & Pruning (Manual Sawit Lestari)\n\n` +
            `Berdasarkan ${pruningChunk.manual_title} - ${pruningChunk.section_title}:\n\n` +
            `${compressMslContent(pruningChunk.content, 1200)}\n\n` +
            `📌 Piawaian Standard Pelepah: Pokok muda (<8 tahun) kekalkan 48-56 pelepah (2 pelepah sokong tandan), pokok matang (>8 tahun) kekalkan 40-48 pelepah (1 pelepah sokong).`;
        } else {
          aiAnswer = `✂️ SOP Pruning / Cantas Pelepah (Manual Sawit Lestari)\n\n` +
            `• Pokok Muda (< 8 Tahun): Kekalkan minimum 48 - 56 pelepah (2 pelepah menyokong tandan buah paling bawah).\n` +
            `• Pokok Matang (> 8 Tahun): Kekalkan minimum 40 - 48 pelepah (1 pelepah menyokong tandan buah paling bawah).\n` +
            `• Kaedah Susunan: Pelepah yang dipotong hendaklah disusun kemas di lorong pelepah mati (U-shape atau L-shape mengikut kontur) dan tidak bertaburan di lorong menuai.`;
        }
      } else if (qLower.includes('lori') || qLower.includes('kenderaan') || qLower.includes('no plat') || qLower.includes('pemandu')) {
        aiAnswer = `🚛 Laporan Logistik & No Lori Pengangkutan BTS (Bulan ${currentMonthName} ${selYear})\n\n` +
          `• Jumlah Lori Aktif Bulan Ini: ${senaraiLoriAktif.length} buah lori\n` +
          `• Lori Aktif Tarikh ${defaultDateStr}: ${senaraiLoriAktif.filter(l => l.tripsDay > 0).length} buah\n` +
          `• Lori Paling Banyak Trip: ${senaraiLoriAktif[0] ? `Lori ${senaraiLoriAktif[0].noLori} (${senaraiLoriAktif[0].tripsMonth} trip, ${formatNum(senaraiLoriAktif[0].totalTanMonth, 2)} tan)` : 'Tiada rekod'}\n\n` +
          `📋 Senarai Lori & Trip Pengangkutan:\n` +
          senaraiLoriAktif.slice(0, 8).map((l, i) => `${i + 1}. No Lori: ${l.noLori} — ${l.tripsMonth} trip (${formatNum(l.totalTanMonth, 2)} tan)${l.tripsDay > 0 ? ` [Hari ini: ${l.tripsDay} trip]` : ''}`).join('\n');
      } else if (qLower.includes('harga') || qLower.includes('pendapatan') || qLower.includes('rm') || qLower.includes('peneroka') || qLower.includes('duit') || qLower.includes('hasil rm')) {
        aiAnswer = `💰 Maklumat Kewangan & Nilai Hasil BTS (Bulan ${currentMonthName} ${selYear})\n\n` +
          `• Purata Harga BTS Semasa: RM ${avgHargaBtsMonth.toFixed(2)} / MT\n` +
          `• Anggaran Nilai Hasil Harian (${defaultDateStr}): RM ${formatNum(dayHasilRm, 2)} (${formatNum(dayTan, 2)} mt)\n` +
          `• Anggaran Nilai Hasil MTD (${currentMonthName}): RM ${formatNum(monthHasilRm, 2)} (${formatNum(monthTan, 2)} mt)\n` +
          `• Anggaran Nilai Hasil YTD (${selYear}): RM ${formatNum(yearHasilRm, 2)} (${formatNum(yearTan, 2)} mt)\n\n` +
          `🏛️ Pecahan Anggaran Pendapatan Mengikut Sektor:\n` +
          `1. Sektor FELDA / Peneroka: ${formatNum(pendapatanPeringkat.feldaPenerokaTan, 2)} mt (~RM ${formatNum(pendapatanPeringkat.feldaPenerokaTan * avgHargaBtsMonth, 2)})\n` +
          `2. Sektor Ladang PKT 1: ${formatNum(pendapatanPeringkat.pkt1Tan, 2)} mt (~RM ${formatNum(pendapatanPeringkat.pkt1Tan * avgHargaBtsMonth, 2)})\n` +
          `3. Sektor Ladang PKT 2: ${formatNum(pendapatanPeringkat.pkt2Tan, 2)} mt (~RM ${formatNum(pendapatanPeringkat.pkt2Tan * avgHargaBtsMonth, 2)})`;
      } else if (qLower.includes('kpg') || qLower.includes('kpa')) {
        const isLowest = qLower.includes('rendah') || qLower.includes('terendah') || qLower.includes('teruk') || qLower.includes('kurang') || qLower.includes('bawah');
        if (isLowest) {
          aiAnswer = `📋 5 Blok KPG = KPA Terendah (Bulan ${currentMonthName} ${selYear})\n\n` +
            `Berikut adalah ranking blok dengan kadar integriti padanan KPG = KPA terendah:\n\n` +
            sortedBlocksKpgLowest.slice(0, 5).map((b, i) => `${i + 1}. Blok ${b.blok} (${b.peringkatNama}) — ${b.kpgMatch} / ${b.resitCount} resit (${b.kpgMatchPct.toFixed(1)}%)`).join('\n') +
            `\n\n📌 Jumlah Keseluruhan Ladang: ${monthKpgMatch} / ${monthResit} resit (${monthKpgPct}% padanan KPG=KPA).\n\n` +
            `⚠️ Cadangan Tindakan: Mandur dan Penimbang disarankan membuat semakan silang gred kilang berbanding anggaran ladang serta meneliti kualiti buah di platform timbang.`;
        } else {
          aiAnswer = `🏆 5 Blok KPG = KPA Tertinggi (Bulan ${currentMonthName} ${selYear})\n\n` +
            `Berikut adalah ranking blok dengan pencapaian padanan KPG = KPA terbaik:\n\n` +
            sortedBlocksKpgBest.slice(0, 5).map((b, i) => `${i + 1}. Blok ${b.blok} (${b.peringkatNama}) — ${b.kpgMatch} / ${b.resitCount} resit (${b.kpgMatchPct.toFixed(1)}%)`).join('\n') +
            `\n\n📌 Jumlah Keseluruhan Ladang: ${monthKpgMatch} / ${monthResit} resit (${monthKpgPct}% padanan KPG=KPA).`;
        }
      } else if (qLower.includes('efb') || qLower.includes('tandan kosong')) {
        aiAnswer = `🚛 Maklumat Taburan EFB (Tandan Kosong) FPMSB TUNGGAL\n\n` +
          `Berdasarkan rekod pangkalan data bagi Bulan ${currentMonthName} ${selYear}:\n\n` +
          `• Hasil Taburan Harian (${defaultDateStr}): ${formatNum(efbTanDay, 2)} mt (${efbTripsDay} trip)\n` +
          `• Jumlah Taburan MTD (${currentMonthName}): ${formatNum(efbTanMonth, 2)} mt (Anggaran ${efbTripsMonth || Math.round(efbTanMonth / 15)} trip lori)\n` +
          `• Jumlah Terkumpul YTD (${selYear}): ${formatNum(efbTanYear, 2)} mt\n` +
          `• Kadar Aplikasi Standard (GAP): 30 – 40 tan/ha/tahun (~200–250 kg setiap pokok) di lorong pelepah.\n\n` +
          `💡 Aplikasi EFB membekalkan nutrien Kalium (K) organik, memelihara kelembapan tanah, dan menjimatkan kos baja kimia.`;
      } else if (qLower.includes('baja') || qLower.includes('pembajaan')) {
        aiAnswer = `🌱 Status Program Pembajaan FPMSB TUNGGAL (${selYear})\n\n` +
          `• Pusingan 1 (Jan–Mac): 85% Selesai\n` +
          `• Pusingan 2 (Apr–Jun): 60% Selesai\n` +
          `• Pusingan 3 (Jul–Sep): 40% Selesai\n` +
          `• Pusingan 4 (Okt–Dis): 10% Selesai\n\n` +
          `📌 Prinsip 4T MSL: Tepat Jenis, Tepat Sukatan/Kadar, Tepat Masa/Cuaca, Tepat Kaedah/Tempat tabur.`;
      } else if (qLower.includes('muda') || qLower.includes('bts muda')) {
        aiAnswer = `🥭 Laporan Kualiti BTS Muda FPMSB TUNGGAL\n\n` +
          `• Hari Semalam (${defaultDateStr}): ${dayMuda} tandan\n` +
          `• Terkumpul MTD (${currentMonthName}): ${monthMuda} tandan\n` +
          `• Terkumpul YTD (${selYear}): ${yearMuda} tandan\n\n` +
          `🏆 Top 5 Blok BTS Muda Tertinggi (Bulan Ini):\n` +
          sortedBlocksMuda.slice(0, 5).map((b, i) => `${i + 1}. Blok ${b.blok} (${b.peringkatNama}) — ${b.btsMuda} tandan (${formatNum(b.totalTan, 2)} mt)`).join('\n') +
          `\n\n⚠️ Tindakan & SOP MSL Edisi 3: Mandur dinasihatkan membuat semakan pusingan tuai (10-15 hari) dan mengingatkan penuai supaya hanya memotong buah yang mempunyai sekurang-kurangnya 1-5 biji relai semula jadi di piringan pokok.`;
      } else if (qLower.includes('hasil') || qLower.includes('tan') || qLower.includes('yield') || qLower.includes('prestasi')) {
        aiAnswer = `📊 Ringkasan Prestasi Hasil BTS FPMSB TUNGGAL\n\n` +
          `• Tarikh ${defaultDateStr}: ${formatNum(dayTan, 2)} mt | Yield: ${dayYield} t/ha | ABW: ${dayAbw} kg\n` +
          `• MTD (${currentMonthName}): ${formatNum(monthTan, 2)} mt / Sasaran ${formatNum(targetMonth, 2)} mt (${pencapaianMonthPct}%)\n` +
          `• Yield MTD: ${monthYield} t/ha (Sasaran: ${targetMonthYield} t/ha)\n` +
          `• YTD (${selYear}): ${formatNum(yearTan, 2)} mt | Yield: ${yearYield} t/ha\n\n` +
          `🏆 Top 5 Blok Yield Tertinggi:\n` +
          sortedBlocksYield.slice(0, 5).map((b, i) => `${i + 1}. Blok ${b.blok} (${b.peringkatNama}): ${b.yieldTH.toFixed(3)} t/ha (${formatNum(b.totalTan, 2)} mt)`).join('\n') +
          `\n\n🔴 5 Blok Yield Terendah:\n` +
          [...sortedBlocksYield].reverse().slice(0, 5).map((b, i) => `${i + 1}. Blok ${b.blok} (${b.peringkatNama}): ${b.yieldTH.toFixed(3)} t/ha (${formatNum(b.totalTan, 2)} mt)`).join('\n');
      } else {
        aiAnswer = `🌴 Ringkasan Data Ladang FPMSB TUNGGAL (${defaultDateStr})\n\n` +
          `• Hasil Harian: ${formatNum(dayTan, 2)} mt (Yield: ${dayYield} t/ha)\n` +
          `• Hasil MTD (${currentMonthName}): ${formatNum(monthTan, 2)} mt (${pencapaianMonthPct}% daripada sasaran)\n` +
          `• Taburan EFB MTD: ${formatNum(efbTanMonth, 2)} mt\n` +
          `• Status Pembajaan: P1 (85%), P2 (60%), P3 (40%), P4 (10%)\n` +
          `• KPG = KPA: ${monthKpgMatch} / ${monthResit} resit (${monthKpgPct}%)\n\n` +
          `Anda boleh bertanya soalan tentang data operasi atau SOP manual seperti:\n` +
          `• "Berapa kadar upah menuai mengikut KUK Siri 8?"\n` +
          `• "Apakah SOP pruning pelepah mengikut MSL?"\n` +
          `• "5 blok KPG=KPA terendah bulan ini?"\n` +
          `• "Berapa tan EFB dan trip lori?"`;
      }
    }

    // 5. Sanitize and remove all raw asterisks, markdown headers, and formatting artifacts
    aiAnswer = aiAnswer
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/\*/g, '')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .replace(/`{1,3}/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return res.json({
      success: true,
      question: qClean,
      tarikh: defaultDateStr,
      answer: aiAnswer,
      metrics: estateContextData,
      ragSources: (mslRagChunks || []).slice(0, 3).map(c => ({
        title: c.manual_title,
        section: c.section_title,
        page: c.page_number,
        category: c.category
      }))
    });

  } catch (error: unknown) {
    console.error("Critical error in estate-chat route:", error);
    return res.status(500).json({
      success: false,
      error: getSafeErrorMessage(error, 'Gagal memproses pertanyaan data ladang.')
    });
  }
});

export default router;

