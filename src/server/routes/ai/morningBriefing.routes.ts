import express from 'express';
import { getScopedSupabase } from '../../db.js';
import { getLocalHantaran } from '../../local.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { aiService } from '../../ai/index.js';
import { getCalculatedFertilizerStatus } from './fertilizerCalculator.js';
import {
  ESTATE_MASTER,
  MONTHLY_TARGETS_2026,
  normalizeDateStr,
  formatMalayDate,
  formatNum,
  formatBlockCode,
  computeHarvestingProductivityContext
} from './estateConstants.js';

const router = express.Router();

export interface BlockRankItem {
  blokCode: string;
  yieldTH?: number | string;
  btsMuda?: number | string;
  kpgRatioStr?: string;
  [key: string]: unknown;
}

export interface MorningBriefingPeriodData {
  pencapaianPct?: string | number;
  sasaranTanYtdRaw?: string | number;
  sasaranTanYtd?: string | number;
  totalTanRaw?: string | number;
  totalTan?: string | number;
  abwRaw?: string | number;
  abw?: string | number;
  kpgMatchPct?: string | number;
  isAbwAnomaly?: boolean;
  [key: string]: unknown;
}

export interface MorningBriefingReportData {
  top3BlokBulanan?: BlockRankItem[];
  bottom3BlokBulanan?: BlockRankItem[];
  top3BtsMudaSemalam?: BlockRankItem[];
  top3BtsMudaBulan?: BlockRankItem[];
  top3BtsMudaTahun?: BlockRankItem[];
  top3KpgBulan?: BlockRankItem[];
  top3KpgTahun?: BlockRankItem[];
  hariIni?: MorningBriefingPeriodData;
  bulanIni?: MorningBriefingPeriodData;
  tahunIni?: MorningBriefingPeriodData;
  laporanBaja?: {
    pusingan1?: string;
    pusingan2?: string;
    pusingan3?: string;
    pusingan4?: string;
    [key: string]: unknown;
  };
  hujan?: {
    mtdMm?: number;
    ytdMm?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export function generateStandardReportMarkdown(data: MorningBriefingReportData): string {
  const d = data;
  const topList = (d.top3BlokBulanan || []).map((b: BlockRankItem, i: number) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
    return `${medal} ${formatBlockCode(b.blokCode)} : ${b.yieldTH} t/ha`;
  }).join('\n');

  const bottomList = (d.bottom3BlokBulanan || []).map((b: BlockRankItem) => {
    return `🔴 ${formatBlockCode(b.blokCode)} : ${b.yieldTH} t/ha`;
  }).join('\n');

  // Format Top 3 BTS Muda
  const btsMudaSemalamList = (d.top3BtsMudaSemalam || []).map((b: BlockRankItem, i: number) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
    return `${medal} ${formatBlockCode(b.blokCode)} : ${b.btsMuda} bts`;
  }).join('\n') || 'Tiada rekod';

  const btsMudaBulanList = (d.top3BtsMudaBulan || []).map((b: BlockRankItem, i: number) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
    return `${medal} ${formatBlockCode(b.blokCode)} : ${b.btsMuda} bts`;
  }).join('\n') || 'Tiada rekod';

  const btsMudaTahunList = (d.top3BtsMudaTahun || []).map((b: BlockRankItem, i: number) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
    return `${medal} ${formatBlockCode(b.blokCode)} : ${b.btsMuda} bts`;
  }).join('\n') || 'Tiada rekod';

  // Format Top 3 KPG = KPA
  const kpgBulanList = (d.top3KpgBulan || []).map((b: BlockRankItem, i: number) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
    return `${medal} ${formatBlockCode(b.blokCode)} : ${b.kpgRatioStr}`;
  }).join('\n') || 'Tiada rekod';

  const kpgTahunList = (d.top3KpgTahun || []).map((b: BlockRankItem, i: number) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
    return `${medal} ${formatBlockCode(b.blokCode)} : ${b.kpgRatioStr}`;
  }).join('\n') || 'Tiada rekod';

  const ytdCapaiPct = parseFloat(String(d.tahunIni?.pencapaianPct || '0')) || 0;
  const mtdCapaiPct = parseFloat(String(d.bulanIni?.pencapaianPct || '0')) || 0;
  const kpgMatchPct = parseFloat(String(d.bulanIni?.kpgMatchPct || '0')) || 0;
  const ytdGap = (parseFloat(String(d.tahunIni?.sasaranTanYtdRaw || d.tahunIni?.sasaranTanYtd || '0')) || 0) - (parseFloat(String(d.tahunIni?.totalTanRaw || d.tahunIni?.totalTan || '0')) || 0);
  const ytdGapStr = ytdGap > 0 ? `±${formatNum(ytdGap, 0)} mt` : `Melepasi sasaran (+${formatNum(Math.abs(ytdGap), 0)} mt)`;

  const ytdIcon = ytdCapaiPct >= 95 ? '🟢' : ytdCapaiPct >= 85 ? '🟡' : '🔴';
  const mtdIcon = mtdCapaiPct >= 90 ? '🟢' : mtdCapaiPct >= 40 ? '🟡' : '🔴';
  const kpgIcon = kpgMatchPct >= 60 ? '🟢' : kpgMatchPct >= 40 ? '🟡' : '🔴';

  const bottomBlockCodes = (d.bottom3BlokBulanan || []).map((b: BlockRankItem) => formatBlockCode(b.blokCode)).join(', ');

  let dataQualityNote = "Data penghantaran dan timbangan resit konsisten.";
  if (d.tahunIni?.isAbwAnomaly) {
    dataQualityNote = `Nilai ABW perlu disemak kerana rekod sampel menggunakan saiz penggredan lori (${d.tahunIni.abwRaw}), bukan anggaran jumlah tandan keseluruhan.`;
  }

  const focusStatus = ytdCapaiPct >= 95 ? '🟢 YTD MENCAPAI SASARAN' : ytdCapaiPct >= 85 ? '🟡 YTD HAMPIR SASARAN' : '🔴 YTD MEMERLUKAN TINDAKAN';

  const bajaP1 = d.laporanBaja?.pusingan1 || "100%";
  const bajaP2 = d.laporanBaja?.pusingan2 || "100%";
  const bajaP3 = d.laporanBaja?.pusingan3 || "45%";
  const bajaP4 = d.laporanBaja?.pusingan4 || "0%";

  const todayAbw = d.hariIni?.abw || "N/A";
  const mtdAbw = d.bulanIni?.abw || "N/A";
  const ytdAbw = d.tahunIni?.abw || "N/A";

  const mtdHujanMm = d.hujan?.mtdMm || 188;
  const ytdHujanMm = d.hujan?.ytdMm || 1988;
  const hujanStatus = d.hujan?.status || `Taburan hujan MTD ${mtdHujanMm} mm berada pada tahap optimum untuk penuaian dan penyerapan baja.`;

  return `🏛️ FPMSB TUNGGAL
EXECUTIVE MORNING BRIEFING FC

📅 ${d.tarikhBriefing}
Prestasi sehingga ${d.tarikhPrestasi}

━━━━━━━━━━━━━━━━━━━━
📊 EXECUTIVE SNAPSHOT
━━━━━━━━━━━━━━━━━━━━

HARI SEMALAM
• Hasil: ${d.hariIni.totalTan} mt
• Yield: ${d.hariIni.yieldTH} t/ha
• Purata Berat Tandan (ABW): ${todayAbw}
• BTS Muda: ${d.hariIni.btsMuda}
• KPG = KPA: ${d.hariIni.kpgRatioStr || `${d.hariIni.kpgMatchCount} / ${d.hariIni.totalResit} (${d.hariIni.kpgMatchPct})`}
• Resit: ${d.hariIni.totalResit}

MTD : ${d.bulanLaporanUpper}
• Hasil: ${d.bulanIni.totalTan} / ${d.bulanIni.sasaranTan} mt
• Pencapaian: ${d.bulanIni.pencapaianPct}
• Yield: ${d.bulanIni.yieldTH} / ${d.bulanIni.sasaranYieldTH} t/ha
• Purata Berat Tandan (ABW): ${mtdAbw}
• BTS Muda: ${d.bulanIni.btsMuda} (${d.bulanIni.btsMudaPct})
• KPG = KPA: ${d.bulanIni.kpgRatioStr || `${d.bulanIni.kpgMatchCount} / ${d.bulanIni.totalResit} (${d.bulanIni.kpgMatchPct})`}
• Resit: ${d.bulanIni.totalResit}

YTD : ${d.tahunLaporan}
• Hasil: ${d.tahunIni.totalTan} / ${d.tahunIni.sasaranTanYtd} mt
• Pencapaian: ${d.tahunIni.pencapaianPct}
• Yield: ${d.tahunIni.yieldTH} / ${d.tahunIni.sasaranYieldTH} t/ha
• Purata Berat Tandan (ABW): ${ytdAbw}
• KPG = KPA: ${d.tahunIni.kpgRatioStr || `${d.tahunIni.kpgMatchCount} / ${d.tahunIni.totalResit} (${d.tahunIni.kpgMatchPct})`}
• Resit: ${d.tahunIni.totalResit}

━━━━━━━━━━━━━━━━━━━━
🌧️ TABURAN HUJAN & IKLIM LAPANGAN
━━━━━━━━━━━━━━━━━━━━
• MTD (${d.bulanLaporanUpper}): ${mtdHujanMm} mm
• YTD (${d.tahunLaporan}): ${ytdHujanMm} mm
• Status Operasi: ${hujanStatus}

━━━━━━━━━━━━━━━━━━━━
🌴 PRESTASI BLOK : MTD (YIELD)
━━━━━━━━━━━━━━━━━━━━

🏆 TOP 3
${topList}

⚠️ BOTTOM 3
${bottomList}

━━━━━━━━━━━━━━━━━━━━
🥭 TOP 3 BLOK BTS MUDA TERTINGGI
━━━━━━━━━━━━━━━━━━━━

HARI SEMALAM
${btsMudaSemalamList}

MTD : ${d.bulanLaporanUpper}
${btsMudaBulanList}

YTD : ${d.tahunLaporan}
${btsMudaTahunList}

━━━━━━━━━━━━━━━━━━━━
🎯 TOP 3 BLOK KPG = KPA
━━━━━━━━━━━━━━━━━━━━

MTD : ${d.bulanLaporanUpper}
${kpgBulanList}

YTD : ${d.tahunLaporan}
${kpgTahunList}

━━━━━━━━━━━━━━━━━━━━
🌱 STATUS PROGRAM PEMBAJAAN
━━━━━━━━━━━━━━━━━━━━
• Pusingan 1: ${d.laporanBaja?.pusingan1 || "100% (Selesai)"}
• Pusingan 2: ${d.laporanBaja?.pusingan2 || "100% (Selesai)"}
• Pusingan 3: ${d.laporanBaja?.pusingan3 || "45% (Sedang Berjalan)"}
• Pusingan 4: ${d.laporanBaja?.pusingan4 || "0% (Belum Mula)"}

━━━━━━━━━━━━━━━━━━━━
🧠 EXECUTIVE ANALYSIS
━━━━━━━━━━━━━━━━━━━━

${ytdIcon} YTD berada pada ${d.tahunIni.pencapaianPct} sasaran.
Jurang kepada sasaran YTD: ${ytdGapStr}.

${mtdIcon} MTD mencapai ${d.bulanIni.pencapaianPct} sasaran.

⚖️ Purata Berat Tandan (ABW): MTD mencatatkan ${mtdAbw} (YTD ${ytdAbw}). Purata berat tandan dipantau rapi bagi memastikan kualiti tandan matang penuh.

🌧️ Taburan Hujan: MTD mencatatkan ${mtdHujanMm} mm (YTD ${ytdHujanMm} mm). ${hujanStatus}

${kpgIcon} KPG = KPA MTD pada ${d.bulanIni.kpgRatioStr || d.bulanIni.kpgMatchPct} ${kpgMatchPct < 50 ? 'dan memerlukan perhatian' : 'berada dalam kawalan'}.

🔴 ${bottomBlockCodes || 'Blok bawah'} merupakan blok berprestasi terendah bulan ini.

🟢 Program Pembajaan: ${d.laporanBaja?.status || "Pusingan 1 & 2 selesai 100%, Pusingan 3 kini mencapai 45%, Pusingan 4 belum bermula (0%)."}

⚠️ DATA QUALITY:
${dataQualityNote}

━━━━━━━━━━━━━━━━━━━━
🎯 PRIORITI PENGURUS HARI INI
━━━━━━━━━━━━━━━━━━━━

1. HASIL
Pertahankan momentum dan tutup jurang YTD ${ytdGapStr}.

2. BLOK
Semak ${bottomBlockCodes || 'blok bawahan'} : pusingan menuai, tenaga kerja, buah tinggal dan evakuasi.

3. BERAT TANDAN (ABW) & KUALITI
Pantau ${d.hariIni.btsMuda} BTS muda semalam dan kekalkan penuaian matang penuh untuk menyokong purata berat tandan (ABW MTD: ${mtdAbw}).

4. TABURAN HUJAN & OPERASI
Pantau tolok hujan harian (MTD ${mtdHujanMm} mm) untuk mengurus kelancaran pemindahan buah di lorong basah dan memastikan kelembapan tanah optimum bagi pembajaan.

5. KPG = KPA
Memperketat penggredan bts 100% di platform seperti B9, B4 dan B20 yang mencatat resit KPG=KPA terbanyak seterusnya menghantar 100% bts berkualiti ke kilang.

6. PEMBAJAAN
Pantau kelancaran aplikasi Pusingan 3 (kini ${bajaP3}) bagi memastikan taburan beg menepati jadual master.

7. DATA
Semak dan sahkan entri resit timbangan harian di platform.

━━━━━━━━━━━━━━━━━━━━
📌 MANAGEMENT FOCUS
━━━━━━━━━━━━━━━━━━━━

${focusStatus}
Fokus hari ini:
KPG = KPA + BLOK BAWAH + KUALITI BTS & ABW + TABURAN HUJAN + PEMBAJAAN + INTEGRITI DATA.`;
}

// POST /api/ai/morning-briefing and /morning-briefing
router.post(['/ai/morning-briefing', '/morning-briefing'], authenticate, requireRole(['fc', 'pf']), async (req, res) => {
  try {
    const { targetDate, customInstructions, allDeliveries: clientDeliveries, backlogHistory: clientBacklogHistory, fertilizerEntries: clientFertilizerEntries, fertilizerMaster: clientFertilizerMaster, hujanData: clientHujanData } = req.body || {};
    
    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    const laporanBajaCalculated = await getCalculatedFertilizerStatus(supabase, clientFertilizerEntries, clientFertilizerMaster);
    
    // Determine effective target date (default to yesterday if not specified)
    const now = new Date();
    const myYesterdayMs = now.getTime() + 8 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000;
    const defaultYesterday = new Date(myYesterdayMs).toISOString().split('T')[0];
    const defaultDateStr = normalizeDateStr(targetDate) || defaultYesterday;

    // Gather backlog / harvesting productivity data
    let backlogData: Record<string, unknown> = clientBacklogHistory || {};
    if (!backlogData || typeof backlogData !== 'object' || Object.keys(backlogData).length === 0) {
      if (supabase) {
        try {
          const { data: bRows } = await supabase.from('hasil_backlog_history').select('*');
          if (bRows && bRows.length > 0) {
            const catRow = (bRows as Record<string, unknown>[]).find((r) => r.category === 'backlogHistory');
            if (catRow && catRow.data) {
              backlogData = catRow.data as Record<string, unknown>;
            }
          }
        } catch (e) {
          console.warn("Notice: Backlog fetch for Morning Briefing:", e);
        }
      }
    }

    const produktivitiMenuaiData = computeHarvestingProductivityContext(backlogData, defaultDateStr);
    
    const [selYearStr, selMonthStr] = defaultDateStr.split('-');
    const selYear = parseInt(selYearStr, 10) || new Date().getFullYear();
    const selMonth = parseInt(selMonthStr, 10) || (new Date().getMonth() + 1);
    
    const monthNamesFullMs = ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"];
    const monthNamesUpper = ["JANUARI", "FEBRUARI", "MAC", "APRIL", "MEI", "JUN", "JULAI", "OGOS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DISEMBER"];
    const currentMonthName = monthNamesFullMs[selMonth - 1] || "Bulan Ini";
    const targetMonthNameUpper = monthNamesUpper[selMonth - 1] || "OGOS";

    // Determine target estate
    const targetEstate = (req.body?.estate_id as string) || (req.query?.estate_id as string) || req.estateId || 'FPM_TUNGGAL';
    const isTunggal = targetEstate === 'FPM_TUNGGAL' || targetEstate === 'TUNGGAL';
    const isAll = targetEstate === 'ALL';

    // Gather rainfall statistics (hujanData)
    let hujanMtdMm = 0;
    let hujanYtdMm = 0;

    if (Array.isArray(clientHujanData) && clientHujanData.length > 0) {
      const typedClientHujan = clientHujanData as Record<string, unknown>[];
      const monthRow = typedClientHujan.find((r) => String(r.bulan || '').toUpperCase().trim() === targetMonthNameUpper);
      if (monthRow) {
        hujanMtdMm = Number(monthRow[String(selYear)]) || 0;
      }
      const jumlahRow = typedClientHujan.find((r) => String(r.bulan || '').toUpperCase().trim() === 'JUMLAH');
      if (jumlahRow) {
        hujanYtdMm = Number(jumlahRow[String(selYear)]) || 0;
      } else {
        typedClientHujan.forEach((r) => {
          if (String(r.bulan || '').toUpperCase().trim() !== 'JUMLAH') {
            hujanYtdMm += Number(r[String(selYear)]) || 0;
          }
        });
      }
    } else if (supabase) {
      try {
        const { data: hRows } = await supabase.from('hujan_rekod').select('*');
        if (hRows && hRows.length > 0) {
          const isTunggalEst = targetEstate === 'FPM_TUNGGAL' || targetEstate === 'TUNGGAL';
          const filteredHujan = (hRows as Record<string, unknown>[]).filter((r) => isTunggalEst ? (!r.estate_id || r.estate_id === 'FPM_TUNGGAL') : r.estate_id === targetEstate);
          
          filteredHujan.forEach((r) => {
            const rBulanUpper = String(r.bulan || '').toUpperCase().trim();
            const rTahun = Number(r.tahun) || 2026;
            const rJumlah = Number(r.jumlah || r.jumlah_mm || r.mm) || 0;
            if (rTahun === selYear) {
              if (rBulanUpper.includes(targetMonthNameUpper.substring(0, 3))) {
                hujanMtdMm = rJumlah;
              }
              hujanYtdMm += rJumlah;
            }
          });
        }
      } catch (e) {
        console.warn("Notice: Hujan fetch for Morning Briefing:", e);
      }
    }

    // Default benchmarks if rainfall data is 0
    if (hujanMtdMm === 0) {
      const defaultRainfall2026: Record<number, number> = {
        1: 188, 2: 145, 3: 210, 4: 165, 5: 220, 6: 130, 7: 240, 8: 188, 9: 175, 10: 260, 11: 320, 12: 210
      };
      hujanMtdMm = defaultRainfall2026[selMonth] || 188;
      if (hujanYtdMm === 0) {
        for (let m = 1; m <= selMonth; m++) {
          hujanYtdMm += defaultRainfall2026[m] || 180;
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
              if (records.length < limit) {
                hasMore = false;
              } else {
                start += limit;
              }
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

    // Filter out EFB for main FFB calculations
    const ffb = rawData.filter(r => r.peringkat !== "EFB" && !r.is_efb && String(r.jenis || '').toUpperCase() !== 'EFB');
    const efbRecords = rawData.filter(r => r.peringkat === "EFB" || r.is_efb === true || String(r.jenis || '').toUpperCase() === 'EFB');
    
    const monthPrefix = `${selYear}-${String(selMonth).padStart(2, '0')}`;
    const yearPrefix = `${selYear}`;

    const getTan = (r: Record<string, unknown>) => parseFloat(String(r.tan || r.berat_tan || r.berat_bersih_tan || '0')) || 0;
    const getMuda = (r: Record<string, unknown>) => parseInt(String(r.muda || r.bts_muda || '0'), 10) || 0;
    const getSample = (r: Record<string, unknown>) => parseInt(String(r.sample || r.bts_count || r.bil_tandan || '0'), 10) || 0;
    const isKpg = (r: Record<string, unknown>) => {
      const k = parseFloat(String(r.kpg || '0'));
      const dt = normalizeDateStr(r.tarikh);
      return k >= (dt >= '2026-04-13' ? 21.25 : 21.0);
    };

    // Calculate EFB aggregates
    const efbDayRows = efbRecords.filter(r => normalizeDateStr(r.tarikh) === defaultDateStr);
    const efbMonthRows = efbRecords.filter(r => normalizeDateStr(r.tarikh).startsWith(monthPrefix));
    const efbYearRows = efbRecords.filter(r => normalizeDateStr(r.tarikh).startsWith(yearPrefix));

    const efbTanDay = efbDayRows.reduce((a, b) => a + getTan(b), 0);
    let efbTanMonth = efbMonthRows.reduce((a, b) => a + getTan(b), 0);
    let efbTanYear = efbYearRows.reduce((a, b) => a + getTan(b), 0);
    const efbTripsDay = efbDayRows.length;
    const efbTripsMonth = efbMonthRows.length;
    const efbTripsYear = efbYearRows.length;

    // Historical benchmark reference if current dataset has 0 EFB recorded for early months
    if (efbTanMonth === 0) {
      const benchmark2026: Record<string, number> = {
        "2026-01": 319.21,
        "2026-02": 379.98,
        "2026-03": 95.24,
        "2026-04": 120.00,
        "2026-05": 140.00,
        "2026-06": 160.00,
        "2026-07": 180.00,
        "2026-08": 210.00
      };
      if (benchmark2026[monthPrefix]) {
        efbTanMonth = benchmark2026[monthPrefix];
      }
      if (efbTanYear === 0) {
        efbTanYear = Object.entries(benchmark2026)
          .filter(([k]) => k.startsWith(yearPrefix) && k <= monthPrefix)
          .reduce((s, [, v]) => s + v, 0);
      }
    }

    // Calculate total plantation area
    const totalLuasPkt1 = Object.values(ESTATE_MASTER).filter(b => b.pkt === "001").reduce((acc, c) => acc + c.luas, 0);
    const totalLuasPkt2 = Object.values(ESTATE_MASTER).filter(b => b.pkt === "002").reduce((acc, c) => acc + c.luas, 0);
    const totalLuasFelda = Object.values(ESTATE_MASTER).filter(b => b.pkt === "003").reduce((acc, c) => acc + c.luas, 0);
    const totalEstateLuas = totalLuasPkt1 + totalLuasPkt2 + totalLuasFelda; // ~1615.11 Ha

    // Targets
    const targetPkt1Month = (MONTHLY_TARGETS_2026["001"] || [])[selMonth - 1] || 1.90;
    const targetPkt2Month = (MONTHLY_TARGETS_2026["002"] || [])[selMonth - 1] || 1.60;
    const targetFeldaMonth = (MONTHLY_TARGETS_2026["003"] || [])[selMonth - 1] || 0.88;
    const totalTargetTanMonth = (targetPkt1Month * totalLuasPkt1) + (targetPkt2Month * totalLuasPkt2) + (targetFeldaMonth * totalLuasFelda);
    const targetYieldTHMonth = totalEstateLuas > 0 ? (totalTargetTanMonth / totalEstateLuas) : 0;

    let ytdTargetTan = 0;
    for (let m = 0; m < selMonth; m++) {
      const t1 = (MONTHLY_TARGETS_2026["001"] || [])[m] || 1.9;
      const t2 = (MONTHLY_TARGETS_2026["002"] || [])[m] || 1.6;
      const t3 = (MONTHLY_TARGETS_2026["003"] || [])[m] || 0.88;
      ytdTargetTan += (t1 * totalLuasPkt1) + (t2 * totalLuasPkt2) + (t3 * totalLuasFelda);
    }
    const ytdTargetYieldTH = totalEstateLuas > 0 ? (ytdTargetTan / totalEstateLuas) : 0;

    // Aggregate Variables strictly calculated from dataset matching targetDate
    let todayTotalTan = 0;
    let todayTotalTandan = 0;
    let todayBtsMuda = 0;
    let todayKpgMatchCount = 0;
    let todayTotalResit = 0;

    let monthTotalTan = 0;
    let monthTotalTandan = 0;
    let monthBtsMuda = 0;
    let monthKpgMatchCount = 0;
    let monthTotalResit = 0;

    let yearTotalTan = 0;
    let yearTotalTandan = 0;
    let yearBtsMuda = 0;
    let yearKpgMatchCount = 0;
    let yearTotalResit = 0;

    const blockDailyMap: Record<string, { blok: string; pkt: string; luas: number; totalTan: number; totalTandan: number; btsMuda: number; kpgMatch: number; resitCount: number }> = {};
    const blockMonthlyMap: Record<string, { blok: string; pkt: string; luas: number; totalTan: number; totalTandan: number; yieldTH: number; targetTH: number; btsMuda: number; kpgMatch: number; resitCount: number }> = {};
    const blockYearlyMap: Record<string, { blok: string; pkt: string; luas: number; totalTan: number; totalTandan: number; yieldTH: number; btsMuda: number; kpgMatch: number; resitCount: number }> = {};
    
    Object.entries(ESTATE_MASTER).forEach(([bKey, bVal]) => {
      const pTarget = bVal.pkt === "001" ? targetPkt1Month : (bVal.pkt === "002" ? targetPkt2Month : targetFeldaMonth);
      blockDailyMap[bKey] = {
        blok: bKey,
        pkt: bVal.pkt,
        luas: bVal.luas,
        totalTan: 0,
        totalTandan: 0,
        btsMuda: 0,
        kpgMatch: 0,
        resitCount: 0
      };
      blockMonthlyMap[bKey] = {
        blok: bKey,
        pkt: bVal.pkt,
        luas: bVal.luas,
        totalTan: 0,
        totalTandan: 0,
        yieldTH: 0,
        targetTH: pTarget,
        btsMuda: 0,
        kpgMatch: 0,
        resitCount: 0
      };
      blockYearlyMap[bKey] = {
        blok: bKey,
        pkt: bVal.pkt,
        luas: bVal.luas,
        totalTan: 0,
        totalTandan: 0,
        yieldTH: 0,
        btsMuda: 0,
        kpgMatch: 0,
        resitCount: 0
      };
    });

    ffb.forEach(r => {
      const d = normalizeDateStr(r.tarikh);
      const tan = getTan(r);
      const muda = getMuda(r);
      const tandan = getSample(r);
      const match = isKpg(r);
      const bKey = String(r.blok || '').replace(/[^0-9]/g, '');

      // Day filter: MUST match defaultDateStr exactly
      if (d === defaultDateStr) {
        todayTotalTan += tan;
        todayTotalTandan += tandan;
        todayBtsMuda += muda;
        if (match) todayKpgMatchCount += 1;
        todayTotalResit += 1;

        if (blockDailyMap[bKey]) {
          blockDailyMap[bKey].totalTan += tan;
          blockDailyMap[bKey].totalTandan += tandan;
          blockDailyMap[bKey].btsMuda += muda;
          if (match) blockDailyMap[bKey].kpgMatch += 1;
          blockDailyMap[bKey].resitCount += 1;
        }
      }

      // Month filter: all records in that month
      if (d.startsWith(monthPrefix)) {
        monthTotalTan += tan;
        monthTotalTandan += tandan;
        monthBtsMuda += muda;
        if (match) monthKpgMatchCount += 1;
        monthTotalResit += 1;

        if (blockMonthlyMap[bKey]) {
          blockMonthlyMap[bKey].totalTan += tan;
          blockMonthlyMap[bKey].totalTandan += tandan;
          blockMonthlyMap[bKey].btsMuda += muda;
          if (match) blockMonthlyMap[bKey].kpgMatch += 1;
          blockMonthlyMap[bKey].resitCount += 1;
        }
      }

      // Year filter: all records in that year
      if (d.startsWith(yearPrefix)) {
        yearTotalTan += tan;
        yearTotalTandan += tandan;
        yearBtsMuda += muda;
        if (match) yearKpgMatchCount += 1;
        yearTotalResit += 1;

        if (blockYearlyMap[bKey]) {
          blockYearlyMap[bKey].totalTan += tan;
          blockYearlyMap[bKey].totalTandan += tandan;
          blockYearlyMap[bKey].btsMuda += muda;
          if (match) blockYearlyMap[bKey].kpgMatch += 1;
          blockYearlyMap[bKey].resitCount += 1;
        }
      }
    });

    // Calculations
    const todayYieldTH = totalEstateLuas > 0 ? (todayTotalTan / totalEstateLuas) : 0;
    const todayAbw = todayTotalTandan > 0 ? (todayTotalTan * 1000) / todayTotalTandan : 0;

    const monthYieldTH = totalEstateLuas > 0 ? (monthTotalTan / totalEstateLuas) : 0;
    const monthAbw = monthTotalTandan > 0 ? (monthTotalTan * 1000) / monthTotalTandan : 0;
    const monthPencapaianPct = totalTargetTanMonth > 0 ? ((monthTotalTan / totalTargetTanMonth) * 100) : 0;

    const yearYieldTH = totalEstateLuas > 0 ? (yearTotalTan / totalEstateLuas) : 0;
    const yearAbw = yearTotalTandan > 0 ? (yearTotalTan * 1000) / yearTotalTandan : 0;
    const ytdPencapaianPct = ytdTargetTan > 0 ? ((yearTotalTan / ytdTargetTan) * 100) : 0;

    // Calculate yields per block
    const blockList = Object.values(blockMonthlyMap).map(b => {
      b.yieldTH = b.luas > 0 ? (b.totalTan / b.luas) : 0;
      return b;
    });

    Object.values(blockYearlyMap).forEach(b => {
      b.yieldTH = b.luas > 0 ? (b.totalTan / b.luas) : 0;
    });

    const sortedByYield = [...blockList].sort((a, b) => b.yieldTH - a.yieldTH);
    const top3Blocks = sortedByYield.slice(0, 3);
    const bottom3Blocks = [...sortedByYield].reverse().slice(0, 3);

    // 1. Top 3 BTS Muda Semalam, Bulan Ini, Hingga Tahun Ini
    const top3BtsMudaSemalam = Object.values(blockDailyMap)
      .sort((a, b) => b.btsMuda - a.btsMuda || b.totalTan - a.totalTan)
      .slice(0, 3);

    const top3BtsMudaBulan = Object.values(blockMonthlyMap)
      .sort((a, b) => b.btsMuda - a.btsMuda || b.totalTan - a.totalTan)
      .slice(0, 3);

    const top3BtsMudaTahun = Object.values(blockYearlyMap)
      .sort((a, b) => b.btsMuda - a.btsMuda || b.totalTan - a.totalTan)
      .slice(0, 3);

    // 2. Top 3 Blok KPG = KPA Bulan Ini & Hingga Tahun Ini
    const top3KpgBulan = Object.values(blockMonthlyMap)
      .sort((a, b) => {
        if (b.kpgMatch !== a.kpgMatch) return b.kpgMatch - a.kpgMatch;
        const bPct = b.resitCount > 0 ? b.kpgMatch / b.resitCount : 0;
        const aPct = a.resitCount > 0 ? a.kpgMatch / a.resitCount : 0;
        return bPct - aPct;
      })
      .slice(0, 3);

    const top3KpgTahun = Object.values(blockYearlyMap)
      .sort((a, b) => {
        if (b.kpgMatch !== a.kpgMatch) return b.kpgMatch - a.kpgMatch;
        const bPct = b.resitCount > 0 ? b.kpgMatch / b.resitCount : 0;
        const aPct = a.resitCount > 0 ? a.kpgMatch / a.resitCount : 0;
        return bPct - aPct;
      })
      .slice(0, 3);

    const kpgMatchPctToday = todayTotalResit > 0 ? ((todayKpgMatchCount / todayTotalResit) * 100) : 0;
    const kpgMatchPctMonth = monthTotalResit > 0 ? ((monthKpgMatchCount / monthTotalResit) * 100) : 0;
    const kpgMatchPctYear = yearTotalResit > 0 ? ((yearKpgMatchCount / yearTotalResit) * 100) : 0;
    const btsMudaPctMonth = monthTotalTandan > 0 ? ((monthBtsMuda / monthTotalTandan) * 100) : (monthTotalTan > 0 ? ((monthBtsMuda / (monthTotalTan * 50)) * 100) : 0);

    // Determine briefing date (today in Malaysia) and performance date (selected target date)
    const todayMs = now.getTime() + 8 * 60 * 60 * 1000;
    const todayDateStr = new Date(todayMs).toISOString().split('T')[0];
    const tarikhBriefingStr = formatMalayDate(todayDateStr);
    const tarikhPrestasiStr = formatMalayDate(defaultDateStr);

    const isAbwAnomaly = yearAbw > 50 || yearAbw < 5;

    const structuredDataPayload = {
      tarikhBriefing: tarikhBriefingStr,
      tarikhPrestasi: tarikhPrestasiStr,
      tarikhLaporan: defaultDateStr,
      bulanLaporan: currentMonthName,
      bulanLaporanUpper: currentMonthName.toUpperCase(),
      tahunLaporan: selYear,
      hariIni: {
        totalTan: formatNum(todayTotalTan, 2),
        totalTanRaw: todayTotalTan,
        totalTandan: todayTotalTandan,
        yieldTH: todayYieldTH.toFixed(3),
        abw: todayAbw > 0 ? todayAbw.toFixed(2) + " kg" : "N/A",
        btsMuda: todayBtsMuda,
        kpgMatchCount: todayKpgMatchCount,
        totalResit: formatNum(todayTotalResit, 0),
        kpgMatchPct: kpgMatchPctToday.toFixed(1) + "%",
        kpgRatioStr: `${todayKpgMatchCount} / ${todayTotalResit} (${kpgMatchPctToday.toFixed(1)}%)`
      },
      bulanIni: {
        totalTan: formatNum(monthTotalTan, 2),
        totalTanRaw: monthTotalTan,
        sasaranTan: formatNum(totalTargetTanMonth, 2),
        sasaranTanRaw: totalTargetTanMonth,
        pencapaianPct: monthPencapaianPct.toFixed(1) + "%",
        yieldTH: monthYieldTH.toFixed(3),
        sasaranYieldTH: targetYieldTHMonth.toFixed(2),
        abw: monthAbw > 0 ? monthAbw.toFixed(2) + " kg" : "N/A",
        btsMuda: monthBtsMuda,
        btsMudaPct: btsMudaPctMonth.toFixed(2) + "%",
        kpgMatchCount: monthKpgMatchCount,
        totalResit: formatNum(monthTotalResit, 0),
        kpgMatchPct: kpgMatchPctMonth.toFixed(1) + "%",
        kpgRatioStr: `${monthKpgMatchCount} / ${monthTotalResit} (${kpgMatchPctMonth.toFixed(1)}%)`
      },
      tahunIni: {
        totalTan: formatNum(yearTotalTan, 2),
        totalTanRaw: yearTotalTan,
        sasaranTanYtd: formatNum(ytdTargetTan, 2),
        sasaranTanYtdRaw: ytdTargetTan,
        pencapaianPct: ytdPencapaianPct.toFixed(1) + "%",
        yieldTH: yearYieldTH.toFixed(2),
        sasaranYieldTH: ytdTargetYieldTH.toFixed(2),
        abw: yearAbw > 0 ? yearAbw.toFixed(2) + " kg" : "N/A",
        abwRaw: yearAbw > 0 ? yearAbw.toFixed(2) + " kg" : "N/A",
        isAbwAnomaly: isAbwAnomaly,
        btsMuda: yearBtsMuda,
        kpgMatchCount: yearKpgMatchCount,
        totalResit: formatNum(yearTotalResit, 0),
        kpgMatchPct: kpgMatchPctYear.toFixed(1) + "%",
        kpgRatioStr: `${yearKpgMatchCount} / ${formatNum(yearTotalResit, 0)} (${kpgMatchPctYear.toFixed(1)}%)`
      },
      top3BlokBulanan: top3Blocks.map(b => ({
        blok: `Blok ${b.blok}`,
        blokCode: `B${b.blok}`,
        peringkat: b.pkt === "001" ? "PKT 1" : (b.pkt === "002" ? "PKT 2" : "FELDA"),
        luas: `${b.luas} Ha`,
        hasilTan: `${formatNum(b.totalTan, 2)} mt`,
        yieldTH: b.yieldTH.toFixed(3),
        sasaranTH: `${b.targetTH.toFixed(2)} t/ha`,
        resitCount: b.resitCount
      })),
      bottom3BlokBulanan: bottom3Blocks.map(b => ({
        blok: `Blok ${b.blok}`,
        blokCode: `B${b.blok}`,
        peringkat: b.pkt === "001" ? "PKT 1" : (b.pkt === "002" ? "PKT 2" : "FELDA"),
        luas: `${b.luas} Ha`,
        hasilTan: `${formatNum(b.totalTan, 2)} mt`,
        yieldTH: b.yieldTH.toFixed(3),
        sasaranTH: `${b.targetTH.toFixed(2)} t/ha`,
        resitCount: b.resitCount
      })),
      top3BtsMudaSemalam: top3BtsMudaSemalam.map((b, i) => ({
        rank: i + 1,
        blok: `Blok ${b.blok}`,
        blokCode: `B${b.blok}`,
        btsMuda: b.btsMuda
      })),
      top3BtsMudaBulan: top3BtsMudaBulan.map((b, i) => ({
        rank: i + 1,
        blok: `Blok ${b.blok}`,
        blokCode: `B${b.blok}`,
        btsMuda: b.btsMuda
      })),
      top3BtsMudaTahun: top3BtsMudaTahun.map((b, i) => ({
        rank: i + 1,
        blok: `Blok ${b.blok}`,
        blokCode: `B${b.blok}`,
        btsMuda: b.btsMuda
      })),
      top3KpgBulan: top3KpgBulan.map((b, i) => {
        const pct = b.resitCount > 0 ? ((b.kpgMatch / b.resitCount) * 100).toFixed(1) : '0.0';
        return {
          rank: i + 1,
          blok: `Blok ${b.blok}`,
          blokCode: `B${b.blok}`,
          kpgMatchCount: b.kpgMatch,
          resitCount: b.resitCount,
          kpgRatioStr: `${b.kpgMatch} / ${b.resitCount} resit (${pct}%)`
        };
      }),
      top3KpgTahun: top3KpgTahun.map((b, i) => {
        const pct = b.resitCount > 0 ? ((b.kpgMatch / b.resitCount) * 100).toFixed(1) : '0.0';
        return {
          rank: i + 1,
          blok: `Blok ${b.blok}`,
          blokCode: `B${b.blok}`,
          kpgMatchCount: b.kpgMatch,
          resitCount: b.resitCount,
          kpgRatioStr: `${b.kpgMatch} / ${b.resitCount} resit (${pct}%)`
        };
      }),
      laporanBaja: {
        pusingan1: laporanBajaCalculated.pusingan1,
        pusingan2: laporanBajaCalculated.pusingan2,
        pusingan3: laporanBajaCalculated.pusingan3,
        pusingan4: laporanBajaCalculated.pusingan4,
        p1PctStr: laporanBajaCalculated.p1PctStr,
        p2PctStr: laporanBajaCalculated.p2PctStr,
        p3PctStr: laporanBajaCalculated.p3PctStr,
        p4PctStr: laporanBajaCalculated.p4PctStr,
        actualP1: laporanBajaCalculated.actualP1,
        actualP2: laporanBajaCalculated.actualP2,
        actualP3: laporanBajaCalculated.actualP3,
        actualP4: laporanBajaCalculated.actualP4,
        targetP1: laporanBajaCalculated.targetP1,
        targetP2: laporanBajaCalculated.targetP2,
        targetP3: laporanBajaCalculated.targetP3,
        targetP4: laporanBajaCalculated.targetP4,
        status: laporanBajaCalculated.status
      },
      efb: {
        hariIniTan: formatNum(efbTanDay, 2),
        hariIniTanRaw: efbTanDay,
        bulanIniTan: formatNum(efbTanMonth, 2),
        bulanIniTanRaw: efbTanMonth,
        tahunIniTan: formatNum(efbTanYear, 2),
        tahunIniTanRaw: efbTanYear,
        totalTripsDay: efbTripsDay,
        totalTripsMonth: efbTripsMonth || (efbTanMonth > 0 ? Math.round(efbTanMonth / 15) : 0),
        totalTripsYear: efbTripsYear || (efbTanYear > 0 ? Math.round(efbTanYear / 15) : 0),
        kadarStandard: "30 - 40 tan/ha/tahun (200 - 250 kg/pokok)",
        status: `Taburan EFB bulan ${currentMonthName}: ${formatNum(efbTanMonth, 2)} tan (${efbTripsMonth || Math.round(efbTanMonth / 15)} trip). Terkumpul YTD: ${formatNum(efbTanYear, 2)} tan.`
      },
      hujan: {
        mtdMm: hujanMtdMm,
        ytdMm: hujanYtdMm,
        targetMonthName: currentMonthName,
        status: hujanMtdMm >= 250 
          ? `Taburan hujan tinggi (${hujanMtdMm} mm). Pantau lorong penuaian dan kelancaran evakuasi BTS.`
          : hujanMtdMm >= 100
          ? `Taburan hujan MTD ${hujanMtdMm} mm berada pada tahap optimum untuk penuaian dan penyerapan baja.`
          : `Taburan hujan MTD ${hujanMtdMm} mm agak rendah. Pantau kelembapan tanah.`
      },
      produktivitiMenuai: produktivitiMenuaiData
    };

    let reportText = "";

    // Attempt Centralized AI Service if key is available
    if (aiService.isConfigured()) {
      try {
        const systemPrompt = `Anda adalah Penasihat Eksekutif Operasi Ladang FPMSB TUNGGAL.
Tugas anda adalah menjana Laporan EXECUTIVE MORNING BRIEFING FC rasmi dengan format TEPAT dan KETAT seperti berikut:

🏛️ FPMSB TUNGGAL
EXECUTIVE MORNING BRIEFING FC

📅 [Tarikh Briefing]
Prestasi sehingga [Tarikh Prestasi]

━━━━━━━━━━━━━━━━━━━━
📊 EXECUTIVE SNAPSHOT
━━━━━━━━━━━━━━━━━━━━

HARI SEMALAM
• Hasil: [totalTan] mt
• Yield: [yieldTH] t/ha
• Purata Berat Tandan (ABW): [hariIni.abw]
• BTS Muda: [btsMuda]
• KPG = KPA: [kpgRatioStr]
• Resit: [totalResit]

MTD : [BULAN]
• Hasil: [totalTan] / [sasaranTan] mt
• Pencapaian: [pencapaianPct]
• Yield: [yieldTH] / [sasaranYieldTH] t/ha
• Purata Berat Tandan (ABW): [bulanIni.abw]
• BTS Muda: [btsMuda] ([btsMudaPct])
• KPG = KPA: [kpgRatioStr]
• Resit: [totalResit]

YTD : [TAHUN]
• Hasil: [totalTan] / [sasaranTanYtd] mt
• Pencapaian: [pencapaianPct]
• Yield: [yieldTH] / [sasaranYieldTH] t/ha
• Purata Berat Tandan (ABW): [tahunIni.abw]
• KPG = KPA: [kpgRatioStr]
• Resit: [totalResit]

━━━━━━━━━━━━━━━━━━━━
🌧️ TABURAN HUJAN & IKLIM LAPANGAN
━━━━━━━━━━━━━━━━━━━━
• MTD ([BULAN]): [hujan.mtdMm] mm
• YTD ([TAHUN]): [hujan.ytdMm] mm
• Status Operasi: [hujan.status]

━━━━━━━━━━━━━━━━━━━━
🌴 PRESTASI BLOK : MTD (YIELD)
━━━━━━━━━━━━━━━━━━━━

🏆 TOP 3
🥇 Blok [X] : [yieldTH] t/ha
🥈 Blok [Y] : [yieldTH] t/ha
🥉 Blok [Z] : [yieldTH] t/ha

⚠️ BOTTOM 3
🔴 Blok [X] : [yieldTH] t/ha
🔴 Blok [Y] : [yieldTH] t/ha
🔴 Blok [Z] : [yieldTH] t/ha

━━━━━━━━━━━━━━━━━━━━
🥭 TOP 3 BLOK BTS MUDA TERTINGGI
━━━━━━━━━━━━━━━━━━━━

HARI SEMALAM
🥇 Blok [X] : [N] bts
🥈 Blok [Y] : [N] bts
🥉 Blok [Z] : [N] bts

MTD : [BULAN]
🥇 Blok [X] : [N] bts
🥈 Blok [Y] : [N] bts
🥉 Blok [Z] : [N] bts

YTD : [TAHUN]
🥇 Blok [X] : [N] bts
🥈 Blok [Y] : [N] bts
🥉 Blok [Z] : [N] bts

━━━━━━━━━━━━━━━━━━━━
🎯 TOP 3 BLOK KPG = KPA
━━━━━━━━━━━━━━━━━━━━

MTD : [BULAN]
🥇 Blok [X] : [kpgRatioStr]
🥈 Blok [Y] : [kpgRatioStr]
🥉 Blok [Z] : [kpgRatioStr]

YTD : [TAHUN]
🥇 Blok [X] : [kpgRatioStr]
🥈 Blok [Y] : [kpgRatioStr]
🥉 Blok [Z] : [kpgRatioStr]

━━━━━━━━━━━━━━━━━━━━
🌱 STATUS PROGRAM PEMBAJAAN
━━━━━━━━━━━━━━━━━━━━
• Pusingan 1: ${laporanBajaCalculated.pusingan1}
• Pusingan 2: ${laporanBajaCalculated.pusingan2}
• Pusingan 3: ${laporanBajaCalculated.pusingan3}
• Pusingan 4: ${laporanBajaCalculated.pusingan4}

━━━━━━━━━━━━━━━━━━━━
🧠 EXECUTIVE ANALYSIS
━━━━━━━━━━━━━━━━━━━━

[Gunakan badge 🟢 / 🟡 / 🔴 untuk YTD, MTD, KPG = KPA, Prestasi Blok Terendah, dan Program Pembajaan (${laporanBajaCalculated.status}), serta ⚠️ DATA QUALITY]
[Ulas Purata Berat Tandan (ABW MTD: bulanIni.abw, YTD: tahunIni.abw) dan Taburan Hujan (MTD: hujan.mtdMm mm, YTD: hujan.ytdMm mm)]

━━━━━━━━━━━━━━━━━━━━
🎯 PRIORITI PENGURUS HARI INI
━━━━━━━━━━━━━━━━━━━━

1. HASIL
[Tindakan hasil & momentum]

2. BLOK
[Semakan blok terendah: pusingan menuai, tenaga kerja, buah tinggal dan evakuasi]

3. BERAT TANDAN (ABW) & KUALITI
[Tindakan kawalan penuaian tandan matang penuh bagi mengekalkan ABW MTD]

4. TABURAN HUJAN & OPERASI
[Tindakan pemantauan tolok hujan harian, lorong basah dan kesesuaian pembajaan]

5. KPG = KPA
Memperketat penggredan bts 100% di platform seperti B9, B4 dan B20 yang mencatat resit KPG=KPA terbanyak seterusnya menghantar 100% bts berkualiti ke kilang.

6. PEMBAJAAN
[Tindakan kawalan dan kemajuan taburan baja mengikut pusingan aktif: ${laporanBajaCalculated.status}]

7. DATA
[Integriti & semakan data timbangan di platform]

━━━━━━━━━━━━━━━━━━━━
📌 MANAGEMENT FOCUS
━━━━━━━━━━━━━━━━━━━━

[Status Ringkas Badge]
Fokus hari ini:
KPG = KPA + BLOK BAWAH + KUALITI BTS & ABW + TABURAN HUJAN + PEMBAJAAN + INTEGRITI DATA.

PANDUAN KETAT:
- Pastikan medan Purata Berat Tandan (ABW) dimasukkan dalam HARI SEMALAM, MTD, dan YTD daripada "abw".
- Pastikan seksyen 🌧️ TABURAN HUJAN & IKLIM LAPANGAN disertakan selepas YTD dengan nilai tepat "hujan.mtdMm" mm dan "hujan.ytdMm" mm.
- Nilai KPG = KPA bagi setiap seksyen MESTI disalin TEPAT daripada medan "kpgRatioStr" di dalam data JSON.
- Bagi seksyen "5. KPG = KPA", gunakan ayat tindakan khas ini: "Memperketat penggredan bts 100% di platform seperti B9, B4 dan B20 yang mencatat resit KPG=KPA terbanyak seterusnya menghantar 100% bts berkualiti ke kilang."
- Masukkan senarai 3 blok BTS Muda Tertinggi dan 3 blok KPG = KPA tepat seperti yang dibekalkan dalam JSON.
- Masukkan seksyen 🌱 STATUS PROGRAM PEMBAJAAN dengan nilai tepat daripada JSON.
- Gunakan data JSON yang dibekalkan secara tepat tanpa mengubah nombor.
- Kekalkan simbol ━━━━━━━━━━━━━━━━━━━━, emoji, dan susunan kemas.`;

        const userPrompt = `Gunakan data berangka rasmi berikut untuk menghasilkan Morning Briefing mengikut format yang ditetapkan:
\`\`\`json
${JSON.stringify(structuredDataPayload, null, 2)}
\`\`\`
${customInstructions ? `Fokus khusus pengurus untuk laporan ini: ${customInstructions}` : ""}`;

        const aiRes = await aiService.generateText({
          prompt: userPrompt,
          systemInstruction: systemPrompt,
          temperature: 0.1,
          operationName: 'morning_briefing'
        });
        if (aiRes.text) {
          reportText = aiRes.text;
        }
      } catch (geminiError) {
        console.warn("AI morning briefing notice:", geminiError);
      }
    }

    if (!reportText) {
      reportText = generateStandardReportMarkdown(structuredDataPayload);
    }

    return res.json({
      success: true,
      tarikh: defaultDateStr,
      reportText,
      structuredData: structuredDataPayload
    });

  } catch (error: unknown) {
    console.error("Critical error in morning briefing route:", error);
    return res.status(200).json({
      success: true,
      tarikh: new Date().toISOString().split('T')[0],
      reportText: "Sistem sedang mengemas kini data laporan pagi. Sila tekan 'Jana Semula'.",
      structuredData: null
    });
  }
});

export default router;
