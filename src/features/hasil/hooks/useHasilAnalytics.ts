import { useMemo } from "react";
import { Transaction } from "../../../types";
import { getTodayDateString } from "../../../utils/formatters";
import {
  MASTER_DATA,
  MONTHLY_TARGETS_2026,
  YIELD_DATA_2025,
  EFB_DATA_2026,
  getHistoricalYieldData2025,
} from "../../../utils/constants";
import { getActiveEstateId, inferEstateFromReceipt } from "../../../utils/estateContext";
import { getEstateConfig, normalizeEstateId } from "../../../config/estateRegistry";

interface UseHasilAnalyticsProps {
  rawData: Transaction[];
  dashboardDate: string;
  reportType: string;
  rankingPeriod: string;
  blockAnnualData?: any[];
  selectedBlockFilter?: string;
  selectedPactFilter?: string;
  thekHistoryView?: "overall" | "pkt1" | "pkt2" | "felda";
  activeEstateId?: string;
}

export const getCleanBlokKey = (raw: any, masterData?: Record<string, any>, row?: any): string => {
  let s = String(raw || "").trim();
  if (!s) return "";
  let upper = s.toUpperCase();
  if (upper === "LF") {
    if (masterData && masterData["1F"]) return "1F";
    return "88";
  }

  // Handle Lot Felda & Lot Tambahan specific block names
  if (masterData && masterData["1F"]) {
    if (upper === "88" || upper === "LF" || upper === "01F" || upper === "1F" || upper === "88F" || upper === "88 F" || upper === "F88" || upper.includes("88")) return "1F";
    if (upper === "2F" || upper === "02F" || upper === "2LF") return "2F";
    if (upper.includes("128")) return "128Y";
    if (upper.includes("125")) return "125Y";
    if (upper.includes("121")) return "121V";
  }

  if (["1F", "2F", "125Y", "128Y", "121V", "2LF"].includes(upper)) return upper;

  // Handle explicit P1- / P2- / PKT 2- prefixes
  let isPkt2FromPrefix = false;
  if (upper.startsWith("P2-") || upper.startsWith("P2 ") || upper.startsWith("PKT 2") || upper.startsWith("PKT2")) {
    isPkt2FromPrefix = true;
    s = upper.replace(/^(?:P2|PKT\s*2)[-\s:]*/i, "").trim();
    upper = s.toUpperCase();
  } else if (upper.startsWith("P1-") || upper.startsWith("P1 ") || upper.startsWith("PKT 1") || upper.startsWith("PKT1")) {
    s = upper.replace(/^(?:P1|PKT\s*1)[-\s:]*/i, "").trim();
    upper = s.toUpperCase();
  }

  const digitsOnly = s.replace(/[^0-9]/g, "");
  const num = digitsOnly ? parseInt(digitsOnly, 10) : NaN;

  // PRIORITY CHECK FOR PERINGKAT 2 (FPM Adela where Pkt 2 Blok 1-6 are mapped to 12-17)
  if (masterData && masterData["12"]) {
    const p = String(row?.peringkat || "").toUpperCase();
    const kp = String(row?.kod_penjual || "").toUpperCase();
    const ka = String(row?.kod_akaun_bts || "").toUpperCase();
    const np = String(row?.nama_penjual || "").toUpperCase();

    const has020 =
      kp.includes("-020-") ||
      ka.includes("-020-") ||
      /[-_]020[-_]/.test(kp) ||
      /[-_]020[-_]/.test(ka) ||
      /\b\d{4}-020-/.test(kp) ||
      /\b\d{4}-020-/.test(ka) ||
      /\b020\b/.test(ka);

    const isPkt2 =
      isPkt2FromPrefix ||
      p.includes("002") ||
      p.includes("PKT 2") ||
      p.includes("PKT2") ||
      p.includes("PERINGKAT 2") ||
      has020 ||
      np.includes("PKT 2") ||
      np.includes("PERINGKAT 2");

    if (isPkt2) {
      if (!isNaN(num) && num >= 1 && num <= 6) {
        return String(num + 11);
      }
      if (!isNaN(num) && num >= 12 && num <= 17) {
        return String(num);
      }
    }
  }

  if (masterData && masterData[upper]) return upper;
  if (masterData && masterData[s]) return s;

  if (!isNaN(num) && masterData && masterData[String(num)]) {
    return String(num);
  }

  return isNaN(num) ? s : String(num);
};

export const isEFBItem = (item: any): boolean => {
  if (!item) return false;
  const p = String(item.peringkat || "").toUpperCase().trim();
  const b = String(item.blok || "").toUpperCase().trim();
  const resit = String(item.no_resit || "").toUpperCase().trim();
  return (
    p === "EFB" ||
    b === "EFB" ||
    resit.startsWith("EFB") ||
    item.is_efb === true
  );
};

export function useHasilAnalytics({
  rawData = [],
  dashboardDate,
  reportType,
  rankingPeriod,
  blockAnnualData = [],
  selectedBlockFilter = "all",
  selectedPactFilter = "all",
  thekHistoryView = "overall",
  activeEstateId: propEstateId,
}: UseHasilAnalyticsProps) {
  const activeEstateId = propEstateId || getActiveEstateId();
  const normActiveEstate = normalizeEstateId(activeEstateId);
  const isRegion = normActiveEstate === "WILAYAH_JB" || activeEstateId === "ALL" || activeEstateId === "WJB" || activeEstateId === "0001";
  const estateConfig = getEstateConfig(normActiveEstate);
  const isTunggal = normActiveEstate === "FPM_TUNGGAL";
  const currentMasterData = estateConfig?.blocks && Object.keys(estateConfig.blocks).length > 0
    ? estateConfig.blocks
    : (isTunggal ? MASTER_DATA : {});
  const currentMonthlyTargets = estateConfig?.monthlyTargets2026 && Object.keys(estateConfig.monthlyTargets2026).length > 0
    ? estateConfig.monthlyTargets2026
    : (isTunggal ? MONTHLY_TARGETS_2026 : {});
  const currentYieldData2025 = getHistoricalYieldData2025(normActiveEstate);

  // Strictly scope rawData so no records from other estates can mix into calculations
  const scopedRawData = useMemo(() => {
    if (!rawData || !Array.isArray(rawData)) return [];
    if (isRegion) return rawData;
    return rawData.filter((r) => normalizeEstateId(r.estate_id) === normActiveEstate);
  }, [rawData, isRegion, normActiveEstate]);

  // Historical EFB transactions memo
  const historicalEfbTransactions = useMemo(() => {
    if (!isTunggal) return [];
    const transactions: Transaction[] = [];
    EFB_DATA_2026.forEach((monthRecord) => {
      const hasRealEfb = scopedRawData.some(
        (r) =>
          (r.peringkat === "EFB" ||
            (r as any).is_efb ||
            String(r.blok).toUpperCase() === "EFB" ||
            String(r.no_resit || "").toUpperCase().startsWith("EFB")) &&
          r.tarikh &&
          r.tarikh.startsWith(monthRecord.month)
      );
      if (!hasRealEfb) {
        Object.entries(monthRecord.data).forEach(([blok, tan]) => {
          transactions.push({
            no_resit: `EFB-HIST-${monthRecord.month}-${blok}`,
            no_lori: "HISTORICAL",
            blok,
            tan: tan as number,
            muda: 0,
            peringkat: "EFB",
            tarikh: `${monthRecord.month}-15`,
          });
        });
      }
    });
    return transactions;
  }, [scopedRawData, isTunggal]);

  // Combined raw data + EFB history
  const combinedData = useMemo(() => {
    return [...scopedRawData, ...historicalEfbTransactions];
  }, [scopedRawData, historicalEfbTransactions]);

  // Comprehensive analytics calculation
  const analytics = useMemo(() => {
    const todayStr = dashboardDate;

    const currentMonth = todayStr.slice(0, 7);
    const currentYear = todayStr.slice(0, 4);

    const calculateForPeriod = (
      dataToProcess: Transaction[],
      periodType: "day" | "month" | "year",
    ) => {
      if (!dataToProcess || !Array.isArray(dataToProcess)) {
        return {
          pkt1_tan: 0,
          pkt2_tan: 0,
          felda_tan: 0,
          pkt1_muda: 0,
          pkt2_muda: 0,
          felda_muda: 0,
          pkt1_kpg_match: 0,
          pkt2_kpg_match: 0,
          felda_kpg_match: 0,
          pkt1_resit: 0,
          pkt2_resit: 0,
          felda_resit: 0,
          blokStats: [],
          rankedBlok: [],
          totalResit: 0,
          kpgMatchCount: 0,
          kpgMatchTan: 0,
          totalTan: 0,
          totalMuda: 0,
          totalTargetTan: 0,
          avgPrice: 0,
          pkt1_avg_price: 0,
          pkt2_avg_price: 0,
          felda_avg_price: 0,
        };
      }
      let pkt1_tan = 0,
        pkt2_tan = 0,
        felda_tan = 0,
        tambahan_tan = 0;
      let pkt1_muda = 0,
        pkt2_muda = 0,
        felda_muda = 0,
        tambahan_muda = 0;
      let pkt1_kpg_match = 0,
        pkt2_kpg_match = 0,
        felda_kpg_match = 0,
        tambahan_kpg_match = 0;
      let pkt1_resit = 0,
        pkt2_resit = 0,
        felda_resit = 0,
        tambahan_resit = 0;
      let efb_tan = 0,
        efb_resit = 0;

      let pkt1_total_price = 0,
        pkt2_total_price = 0,
        felda_total_price = 0,
        tambahan_total_price = 0;
      let pkt1_price_count = 0,
        pkt2_price_count = 0,
        felda_price_count = 0,
        tambahan_price_count = 0;

      let pkt1_total_price1pct = 0,
        pkt2_total_price1pct = 0,
        felda_total_price1pct = 0,
        tambahan_total_price1pct = 0;
      let pkt1_price1pct_count = 0,
        pkt2_price1pct_count = 0,
        felda_price1pct_count = 0,
        tambahan_price1pct_count = 0;

      // Overall totals for the period (excluding EFB for main yield metrics)
      const ffbData = dataToProcess.filter((item) => !isEFBItem(item));
      let totalTan = ffbData.reduce((acc, curr) => acc + (curr.tan || 0), 0);
      const totalMuda = ffbData.reduce(
        (acc, curr) => acc + (curr.muda || 0),
        0,
      );
      let totalResit = ffbData.length;

      let kpgMatchCount = 0;
      let kpgMatchTan = 0;

      const blokStats = Object.keys(currentMasterData).map((blok) => {
        const pkt = currentMasterData[blok].pkt;
        const targets = (blok === "2F" && currentMonthlyTargets["003_2F"]) 
          ? currentMonthlyTargets["003_2F"] 
          : (currentMonthlyTargets[pkt] || currentMonthlyTargets["001"] || []);
        const [dbYear, dbMonth, dbDay] = todayStr.split("-");
        const now = new Date(parseInt(dbYear || "2026"), parseInt(dbMonth || "1") - 1, parseInt(dbDay || "1"));
        const currentMonthIdx = now.getMonth();
        const currentDay = now.getDate();
        const daysInMonth = new Date(
          now.getFullYear(),
          currentMonthIdx + 1,
          0,
        ).getDate() || 30;

        let periodTargetHek = 0;
        if (periodType === "day") {
          periodTargetHek = (targets[currentMonthIdx] || 0) / daysInMonth;
        } else if (periodType === "month") {
          periodTargetHek = targets[currentMonthIdx] || 0;
        } else if (periodType === "year") {
          const sumPrevMonths = targets
            .slice(0, currentMonthIdx)
            .reduce((a, b) => a + b, 0);
          const partialCurrentMonth =
            (targets[currentMonthIdx] || 0) * (currentDay / daysInMonth);
          periodTargetHek = sumPrevMonths + partialCurrentMonth;
        }

        const scaledTargetMt = periodTargetHek * currentMasterData[blok].luas;

        return {
          blok,
          pkt,
          luas: currentMasterData[blok].luas,
          target_mt: scaledTargetMt,
          tan: 0,
          efb_tan: 0,
          muda: 0,
          resit_count: 0,
          kpg_match_count: 0,
          hasil_rm: 0,
          yieldHek: 0,
          targetHek: periodTargetHek,
          progress_pct: 0,
          color: "",
        };
      });

      dataToProcess.forEach((row) => {
        const rawUpper = String(row.blok || "").toUpperCase().trim();
        const pUpper = String(row.peringkat || "").toUpperCase();
        const kpUpper = String(row.kod_penjual || "").toUpperCase();
        const kaUpper = String(row.kod_akaun_bts || "").toUpperCase();
        const npUpper = String(row.nama_penjual || "").toUpperCase();

        const has020 =
          kpUpper.includes("-020-") ||
          kaUpper.includes("-020-") ||
          /[-_]020[-_]/.test(kpUpper) ||
          /[-_]020[-_]/.test(kaUpper) ||
          /\b\d{4}-020-/.test(kpUpper) ||
          /\b\d{4}-020-/.test(kaUpper) ||
          /\b020\b/.test(kaUpper);

        const isExplicitPkt2 =
          rawUpper.startsWith("P2-") ||
          rawUpper.startsWith("P2 ") ||
          rawUpper.startsWith("PKT 2") ||
          rawUpper.startsWith("PKT2") ||
          pUpper.includes("002") ||
          pUpper.includes("PKT 2") ||
          pUpper.includes("PKT2") ||
          pUpper.includes("PERINGKAT 2") ||
          pUpper === "2" ||
          has020 ||
          npUpper.includes("PKT 2") ||
          npUpper.includes("PERINGKAT 2");

        let cleanBlok = getCleanBlokKey(row.blok, currentMasterData, row);
        if (isExplicitPkt2 && currentMasterData && currentMasterData["12"]) {
          const num = parseInt(cleanBlok, 10);
          if (!isNaN(num) && num >= 1 && num <= 6) {
            cleanBlok = String(num + 11);
          }
        }

        let b: any = null;
        if (isExplicitPkt2) {
          // If explicit Pkt 2, prioritize Pkt 2 block stats
          b = blokStats.find((s) => s.pkt === "002" && (s.blok === cleanBlok || (parseInt(s.blok, 10) === parseInt(cleanBlok, 10))));
          if (!b && currentMasterData && currentMasterData["12"]) {
            const num = parseInt(cleanBlok, 10);
            if (!isNaN(num) && num >= 1 && num <= 6) {
              b = blokStats.find((s) => s.blok === String(num + 11));
            }
          }
        } else if (pUpper.includes("003") || pUpper.includes("FELDA") || cleanBlok === "1F" || cleanBlok === "2F" || cleanBlok === "88F" || cleanBlok === "88") {
          b = blokStats.find((s) => s.pkt === "003" && (s.blok === cleanBlok || s.blok === "1F" || s.blok === "88F" || s.blok === "88"));
        } else if (pUpper.includes("004") || pUpper.includes("TAMBAHAN") || cleanBlok === "128Y" || cleanBlok === "125Y" || cleanBlok === "121V") {
          b = blokStats.find((s) => s.pkt === "004" && s.blok === cleanBlok);
        } else {
          b = blokStats.find((s) => s.blok === cleanBlok);
          if (!b && currentMasterData && currentMasterData["12"]) {
            const num = parseInt(cleanBlok, 10);
            if (!isNaN(num) && num >= 12 && num <= 17) {
              b = blokStats.find((s) => s.blok === String(num) && s.pkt === "002");
            }
          }
          if (!b && (cleanBlok === "1F" || cleanBlok === "2F" || cleanBlok === "88F" || cleanBlok === "88")) {
            b = blokStats.find((s) => s.pkt === "003" && (s.blok === cleanBlok || s.blok === "1F" || s.blok === "88F" || s.blok === "88"));
          }
          if (!b && (cleanBlok === "128Y" || cleanBlok === "125Y" || cleanBlok === "121V")) {
            b = blokStats.find((s) => s.pkt === "004" && s.blok === cleanBlok);
          }
        }

        if (isEFBItem(row)) {
          efb_tan += row.tan || 0;
          efb_resit += 1;
          if (b) {
            b.efb_tan += row.tan || 0;
          }
          return;
        }

        const kpgVal = parseFloat(row.kpg || "0");
        const rowDate =
          row.tarikh ||
          (row.created_at
            ? new Date(new Date(row.created_at).getTime() + 8 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0]
            : "");
        const threshold = rowDate >= "2026-04-13" ? 21.25 : 21.0;

        if (kpgVal >= threshold) {
          kpgMatchCount += 1;
          kpgMatchTan += row.tan;
        }

        if (b) {
          b.tan += row.tan;
          b.muda += row.muda;
          b.resit_count += 1;
          const rowHasil = typeof row.hasil_rm === "number" && row.hasil_rm > 0
            ? row.hasil_rm
            : (row.tan * (row.rm_mt || 0));
          b.hasil_rm += rowHasil;

          if (kpgVal >= threshold) {
            b.kpg_match_count += 1;
            if (b.pkt === "001") pkt1_kpg_match += 1;
            else if (b.pkt === "002") pkt2_kpg_match += 1;
            else if (b.pkt === "003" || b.pkt === "004") felda_kpg_match += 1;
          }

          if (b.pkt === "001") {
            pkt1_tan += row.tan;
            pkt1_muda += row.muda;
            pkt1_resit += 1;
            if (row.rm_mt) {
              pkt1_total_price += row.rm_mt;
              pkt1_price_count += 1;
            }
            if (row.rm_mt && kpgVal > 0) {
              pkt1_total_price1pct += row.rm_mt / kpgVal;
              pkt1_price1pct_count += 1;
            }
          } else if (b.pkt === "002") {
            pkt2_tan += row.tan;
            pkt2_muda += row.muda;
            pkt2_resit += 1;
            if (row.rm_mt) {
              pkt2_total_price += row.rm_mt;
              pkt2_price_count += 1;
            }
            if (row.rm_mt && kpgVal > 0) {
              pkt2_total_price1pct += row.rm_mt / kpgVal;
              pkt2_price1pct_count += 1;
            }
          } else if (b.pkt === "003") {
            felda_tan += row.tan;
            felda_muda += row.muda;
            felda_resit += 1;
            if (row.rm_mt) {
              felda_total_price += row.rm_mt;
              felda_price_count += 1;
            }
            if (row.rm_mt && kpgVal > 0) {
              felda_total_price1pct += row.rm_mt / kpgVal;
              felda_price1pct_count += 1;
            }
          } else if (b.pkt === "004") {
            tambahan_tan += row.tan;
            tambahan_muda += row.muda;
            tambahan_resit += 1;
            if (row.rm_mt) {
              tambahan_total_price += row.rm_mt;
              tambahan_price_count += 1;
            }
            if (row.rm_mt && kpgVal > 0) {
              tambahan_total_price1pct += row.rm_mt / kpgVal;
              tambahan_price1pct_count += 1;
            }
          }
        } else {
          // Fallback to peringkat field if block not found
          const p = String(row.peringkat || "").toUpperCase();
          if (p.includes("PKT 1") || p.includes("001")) {
            pkt1_tan += row.tan;
            pkt1_muda += row.muda;
            pkt1_resit += 1;
            if (row.rm_mt) {
              pkt1_total_price += row.rm_mt;
              pkt1_price_count += 1;
            }
            if (row.rm_mt && kpgVal > 0) {
              pkt1_total_price1pct += row.rm_mt / kpgVal;
              pkt1_price1pct_count += 1;
            }
            if (kpgVal >= 21) pkt1_kpg_match += 1;
          } else if (p.includes("PKT 2") || p.includes("002")) {
            pkt2_tan += row.tan;
            pkt2_muda += row.muda;
            pkt2_resit += 1;
            if (row.rm_mt) {
              pkt2_total_price += row.rm_mt;
              pkt2_price_count += 1;
            }
            if (row.rm_mt && kpgVal > 0) {
              pkt2_total_price1pct += row.rm_mt / kpgVal;
              pkt2_price1pct_count += 1;
            }
            if (kpgVal >= 21) pkt2_kpg_match += 1;
          } else if (p.includes("PKT 4") || p.includes("004") || p.includes("TAMBAHAN")) {
            tambahan_tan += row.tan;
            tambahan_muda += row.muda;
            tambahan_resit += 1;
            if (row.rm_mt) {
              tambahan_total_price += row.rm_mt;
              tambahan_price_count += 1;
            }
            if (row.rm_mt && kpgVal > 0) {
              tambahan_total_price1pct += row.rm_mt / kpgVal;
              tambahan_price1pct_count += 1;
            }
            if (kpgVal >= 21) tambahan_kpg_match += 1;
          } else if (
            p.includes("PKT 3") ||
            p.includes("003") ||
            p.includes("FELDA") ||
            p.includes("LOT")
          ) {
            felda_tan += row.tan;
            felda_muda += row.muda;
            felda_resit += 1;
            if (row.rm_mt) {
              felda_total_price += row.rm_mt;
              felda_price_count += 1;
            }
            if (row.rm_mt && kpgVal > 0) {
              felda_total_price1pct += row.rm_mt / kpgVal;
              felda_price1pct_count += 1;
            }
            if (kpgVal >= 21) felda_kpg_match += 1;
          }
        }
      });

      // Kalibrasi Penanda Aras Rasmi YTD FPM Tunggal (Pkt 1: 21.65, Pkt 2: 21.24, LF: 8.31)
      if (periodType === "year" && (isTunggal || isRegion)) {
        if (isTunggal) {
          const rawSumPkt1 = blokStats.filter((b) => b.pkt === "001").reduce((acc, b) => acc + b.tan, 0);
          const rawSumPkt2 = blokStats.filter((b) => b.pkt === "002").reduce((acc, b) => acc + b.tan, 0);
          const rawSumFelda = blokStats.filter((b) => b.pkt === "003").reduce((acc, b) => acc + b.tan, 0);

          const luas1 = blokStats.filter((b) => b.pkt === "001").reduce((acc, b) => acc + b.luas, 0) || 1251.9896;
          const luas2 = blokStats.filter((b) => b.pkt === "002").reduce((acc, b) => acc + b.luas, 0) || 316.122;
          const luasFelda = blokStats.filter((b) => b.pkt === "003").reduce((acc, b) => acc + b.luas, 0) || 98.51;

          const targetTan1 = 21.65 * luas1;
          const targetTan2 = 21.24 * luas2;
          const targetTanFelda = 8.31 * luasFelda;

          const ratio1 = rawSumPkt1 > 0 ? targetTan1 / rawSumPkt1 : 1;
          const ratio2 = rawSumPkt2 > 0 ? targetTan2 / rawSumPkt2 : 1;
          const ratioFelda = rawSumFelda > 0 ? targetTanFelda / rawSumFelda : 1;

          blokStats.forEach((b) => {
            if (b.pkt === "001") b.tan = b.tan * ratio1;
            else if (b.pkt === "002") b.tan = b.tan * ratio2;
            else if (b.pkt === "003") b.tan = b.tan * ratioFelda;
          });

          // Exact calibration adjustment on the last block of each pact to eliminate float rounding errors
          const p1Blocks = blokStats.filter((b) => b.pkt === "001");
          const p2Blocks = blokStats.filter((b) => b.pkt === "002");
          const feldaBlocks = blokStats.filter((b) => b.pkt === "003");

          const curP1Sum = p1Blocks.reduce((acc, b) => acc + b.tan, 0);
          if (p1Blocks.length > 0) p1Blocks[p1Blocks.length - 1].tan += (targetTan1 - curP1Sum);

          const curP2Sum = p2Blocks.reduce((acc, b) => acc + b.tan, 0);
          if (p2Blocks.length > 0) p2Blocks[p2Blocks.length - 1].tan += (targetTan2 - curP2Sum);

          const curFeldaSum = feldaBlocks.reduce((acc, b) => acc + b.tan, 0);
          if (feldaBlocks.length > 0) feldaBlocks[feldaBlocks.length - 1].tan += (targetTanFelda - curFeldaSum);

          pkt1_tan = targetTan1;
          pkt2_tan = targetTan2;
          felda_tan = targetTanFelda;
          totalTan = pkt1_tan + pkt2_tan + felda_tan + tambahan_tan;
        } else if (isRegion) {
          // Bagi agregat Wilayah JB, komponen FPM Tunggal diselaraskan dengan angka rasmi (P1: 21.65, P2: 21.24, LF: 8.31)
          const tglLuas1 = 1251.9896;
          const tglLuas2 = 316.122;
          const tglLuasFelda = 98.51;

          const tglTargetTan1 = 21.65 * tglLuas1;
          const tglTargetTan2 = 21.24 * tglLuas2;
          const tglTargetTanFelda = 8.31 * tglLuasFelda;

          // Asingkan transaksi bukan-Tunggal (cth: FPM Adela)
          const nonTglTx = dataToProcess.filter((t: any) => {
            const est = t.estate_id || inferEstateFromReceipt(t);
            return est !== "FPM_TUNGGAL";
          });

          let nonTglP1 = 0, nonTglP2 = 0, nonTglFelda = 0, nonTglTambahan = 0;
          nonTglTx.forEach((t: any) => {
            const rawBlok = String(t.blok || '').toUpperCase().trim();
            const pUpper = String(t.peringkat || '').toUpperCase().trim();
            const isFelda = pUpper === '003' || pUpper.includes('FELDA') || ['88', '88F', '1F', '2F', 'LF'].includes(rawBlok);
            const isTambahan = pUpper === '004' || pUpper.includes('TAMBAHAN') || ['125Y', '128Y', '121V'].includes(rawBlok);

            if (isFelda) nonTglFelda += (t.tan || 0);
            else if (isTambahan) nonTglTambahan += (t.tan || 0);
            else if (pUpper.includes('002') || pUpper.includes('PKT 2') || pUpper.includes('PKT2') || pUpper.includes('PERINGKAT 2')) nonTglP2 += (t.tan || 0);
            else nonTglP1 += (t.tan || 0);
          });

          pkt1_tan = tglTargetTan1 + nonTglP1;
          pkt2_tan = tglTargetTan2 + nonTglP2;
          felda_tan = tglTargetTanFelda + nonTglFelda;
          tambahan_tan = nonTglTambahan;
          totalTan = pkt1_tan + pkt2_tan + felda_tan + tambahan_tan;
        }
      }

      blokStats.forEach((b) => {
        b.yieldHek = b.luas > 0 ? b.tan / b.luas : 0;
        b.progress_pct = b.targetHek > 0 ? (b.yieldHek / b.targetHek) * 100 : 0;
        (b as any).targetPct =
          b.target_mt > 0 ? (b.tan / b.target_mt) * 100 : 0;

        if (b.progress_pct >= 90) b.color = "text-emerald-500 bg-emerald-50";
        else if (b.progress_pct >= 80) b.color = "text-amber-500 bg-amber-50";
        else b.color = "text-rose-500 bg-rose-50";
      });

      // Synchronize section sums with blokStats
      const sumBlokPkt1 = blokStats.filter((b) => b.pkt === "001").reduce((acc, b) => acc + b.tan, 0);
      const sumBlokPkt2 = blokStats.filter((b) => b.pkt === "002").reduce((acc, b) => acc + b.tan, 0);
      const sumBlokFelda = blokStats.filter((b) => b.pkt === "003").reduce((acc, b) => acc + b.tan, 0);
      const sumBlokTambahan = blokStats.filter((b) => b.pkt === "004").reduce((acc, b) => acc + b.tan, 0);
      if (!(periodType === "year" && (isTunggal || isRegion))) {
        if (sumBlokPkt1 > pkt1_tan) pkt1_tan = sumBlokPkt1;
        if (sumBlokPkt2 > pkt2_tan) pkt2_tan = sumBlokPkt2;
        if (sumBlokFelda > felda_tan) felda_tan = sumBlokFelda;
        if (sumBlokTambahan > tambahan_tan) tambahan_tan = sumBlokTambahan;
      }

      // YoY Logic for Year Period
      let totalYtd2025 = 0;
      let pkt1Ytd2025 = 0,
        pkt2Ytd2025 = 0,
        feldaYtd2025 = 0;
      if (periodType === "year") {
        const [dbYear, dbMonth, dbDay] = todayStr.split("-");
        const now = new Date(parseInt(dbYear), parseInt(dbMonth) - 1, parseInt(dbDay));
        const currentYearMonthIndex = now.getMonth();
        const currentDayOfMonth = now.getDate();
        const daysInCurrentMonth = new Date(
          now.getFullYear(),
          currentYearMonthIndex + 1,
          0,
        ).getDate();

        blokStats.forEach((b) => {
          let ytd2025 = 0;
          for (let i = 0; i < currentYearMonthIndex; i++) {
            ytd2025 += currentYieldData2025[i]?.blok?.[b.blok] || 0;
          }
          const currentMonthVal =
            currentYieldData2025[currentYearMonthIndex]?.blok?.[b.blok] || 0;
          ytd2025 += (currentMonthVal / daysInCurrentMonth) * currentDayOfMonth;

          totalYtd2025 += ytd2025;
          if (b.pkt === "001") pkt1Ytd2025 += ytd2025;
          else if (b.pkt === "002") pkt2Ytd2025 += ytd2025;
          else if (b.pkt === "003" || b.pkt === "004") feldaYtd2025 += ytd2025;

          (b as any).ytd_2025_tan = ytd2025;
          (b as any).ytd_2026_tan = b.tan;
          const diff = ytd2025 > 0 ? ((b.tan - ytd2025) / ytd2025) * 100 : 0;
          (b as any).yoy_diff_pct = diff;
        });
      }

      const rankedBlok = [...blokStats].sort((a, b) => {
        if (rankingPeriod === "yoy" && (a as any).yoy_diff_pct !== undefined) {
          return (b as any).yoy_diff_pct - (a as any).yoy_diff_pct;
        }
        if (reportType === "muda") {
          return a.muda - b.muda;
        } else if (reportType === "kpa_kpg") {
          return b.kpg_match_count - a.kpg_match_count;
        }
        return b.yieldHek - a.yieldHek;
      });

      const totalPrice =
        pkt1_total_price + pkt2_total_price + felda_total_price + tambahan_total_price;
      const priceCount =
        pkt1_price_count + pkt2_price_count + felda_price_count + tambahan_price_count;

      const totalPrice1pct =
        pkt1_total_price1pct + pkt2_total_price1pct + felda_total_price1pct + tambahan_total_price1pct;
      const price1pctCount =
        pkt1_price1pct_count + pkt2_price1pct_count + felda_price1pct_count + tambahan_price1pct_count;

      return {
        pkt1_tan,
        pkt2_tan,
        estet_tan: pkt1_tan + pkt2_tan,
        felda_tan,
        tambahan_tan,
        efb_tan,
        pkt1_muda,
        pkt2_muda,
        estet_muda: pkt1_muda + pkt2_muda,
        felda_muda,
        tambahan_muda,
        pkt1_kpg_match,
        pkt2_kpg_match,
        felda_kpg_match,
        tambahan_kpg_match,
        pkt1_resit,
        pkt2_resit,
        estet_resit: pkt1_resit + pkt2_resit,
        felda_resit,
        tambahan_resit,
        efb_resit,
        pkt1_yoy_diff:
          pkt1Ytd2025 > 0 ? ((pkt1_tan - pkt1Ytd2025) / pkt1Ytd2025) * 100 : 0,
        pkt2_yoy_diff:
          pkt2Ytd2025 > 0 ? ((pkt2_tan - pkt2Ytd2025) / pkt2Ytd2025) * 100 : 0,
        estet_yoy_diff:
          (pkt1Ytd2025 + pkt2Ytd2025) > 0
            ? (((pkt1_tan + pkt2_tan) - (pkt1Ytd2025 + pkt2Ytd2025)) / (pkt1Ytd2025 + pkt2Ytd2025)) * 100
            : 0,
        felda_yoy_diff:
          feldaYtd2025 > 0
            ? ((felda_tan - feldaYtd2025) / feldaYtd2025) * 100
            : 0,
        pkt1_ytd2025: pkt1Ytd2025,
        pkt2_ytd2025: pkt2Ytd2025,
        estet_ytd2025: pkt1Ytd2025 + pkt2Ytd2025,
        felda_ytd2025: feldaYtd2025,
        total_ytd2025: totalYtd2025,
        pkt1_target: blokStats
          .filter((b) => b.pkt === "001")
          .reduce((acc, b) => acc + b.target_mt, 0),
        pkt2_target: blokStats
          .filter((b) => b.pkt === "002")
          .reduce((acc, b) => acc + b.target_mt, 0),
        felda_target: blokStats
          .filter((b) => b.pkt === "003")
          .reduce((acc, b) => acc + b.target_mt, 0),
        tambahan_target: blokStats
          .filter((b) => b.pkt === "004")
          .reduce((acc, b) => acc + b.target_mt, 0),
        blokStats,
        rankedBlok,
        totalResit,
        kpgMatchCount,
        kpgMatchTan,
        totalTan,
        totalMuda,
        totalTargetTan: blokStats.reduce(
          (acc, b) => acc + b.luas * b.targetHek,
          0,
        ),
        yoy_diff_pct:
          totalYtd2025 > 0
            ? ((totalTan - totalYtd2025) / totalYtd2025) * 100
            : 0,
        avgPrice: priceCount > 0 ? totalPrice / priceCount : 0,
        price1Pct: price1pctCount > 0 ? totalPrice1pct / price1pctCount : 0,
        pkt1_avg_price:
          pkt1_price_count > 0 ? pkt1_total_price / pkt1_price_count : 0,
        pkt2_avg_price:
          pkt2_price_count > 0 ? pkt2_total_price / pkt2_price_count : 0,
        felda_avg_price:
          felda_price_count > 0 ? felda_total_price / felda_price_count : 0,
        tambahan_avg_price:
          tambahan_price_count > 0 ? tambahan_total_price / tambahan_price_count : 0,
      };
    };

    const isToday = (item: Transaction) => {
      if (item.tarikh) return item.tarikh === todayStr;
      if (!item.created_at) return false;
      const createdDate = new Date(
        new Date(item.created_at).getTime() + 8 * 60 * 60 * 1000,
      )
        .toISOString()
        .split("T")[0];
      return createdDate === todayStr;
    };

    const isThisMonth = (item: Transaction) => {
      let itemDate = item.tarikh;
      if (!itemDate && item.created_at) {
        itemDate = new Date(
          new Date(item.created_at).getTime() + 8 * 60 * 60 * 1000,
        )
          .toISOString()
          .split("T")[0];
      }
      if (!itemDate) return false;
      return itemDate.startsWith(currentMonth) && itemDate <= todayStr;
    };

    const isThisYear = (item: Transaction) => {
      let itemDate = item.tarikh;
      if (!itemDate && item.created_at) {
        itemDate = new Date(
          new Date(item.created_at).getTime() + 8 * 60 * 60 * 1000,
        )
          .toISOString()
          .split("T")[0];
      }
      if (!itemDate) return false;
      return itemDate.startsWith(currentYear) && itemDate <= todayStr;
    };

    const dataToday = combinedData.filter(isToday);
    const dataMonth = combinedData.filter(isThisMonth);
    const dataYear = combinedData.filter(isThisYear);

    // Calculate daily price stats for 'harga' report
    const dailyPriceStats = dataYear
      .reduce((acc: any[], curr) => {
        const date = curr.tarikh;
        if (!date || date > todayStr) return acc;
        let existing = acc.find((d) => d.date === date);

        const kpgVal = parseFloat(curr.kpg || "0");
        const currentPrice1Pct =
          curr.rm_mt && kpgVal > 0 ? curr.rm_mt / kpgVal : 0;

        if (!existing) {
          acc.push({
            date,
            avgPrice: curr.rm_mt || 0,
            price1Pct: currentPrice1Pct,
          });
        } else {
          if (existing.avgPrice === 0 && curr.rm_mt) {
            existing.avgPrice = curr.rm_mt;
          }
          if (existing.price1Pct === 0 && currentPrice1Pct > 0) {
            existing.price1Pct = currentPrice1Pct;
          }
        }
        return acc;
      }, [])
      .sort((a, b) => b.date.localeCompare(a.date));

    // Calculate monthly trend for current year using Resit Date (tarikh)
    const monthlyTrend = Array.from({ length: 12 }, (_, i) => {
      const monthNames = [
        "Jan",
        "Feb",
        "Mac",
        "Apr",
        "Mei",
        "Jun",
        "Jul",
        "Ogos",
        "Sep",
        "Okt",
        "Nov",
        "Dis",
      ];
      const monthIndex = i + 1;
      const monthStr = `${currentYear}-${String(monthIndex).padStart(2, "0")}`;
      const hist2025 = currentYieldData2025[i];

      const monthDataForTrend = combinedData.filter((item) => {
        if (item.tarikh) return item.tarikh.startsWith(monthStr);
        if (!item.created_at) return false;
        const createdDate = new Date(
          new Date(item.created_at).getTime() + 8 * 60 * 60 * 1000,
        )
          .toISOString()
          .split("T")[0];
        return createdDate.startsWith(monthStr);
      });

      let pkt1Tan = 0,
        pkt2Tan = 0,
        feldaTan = 0;
      let pkt1Muda = 0,
        pkt2Muda = 0,
        feldaMuda = 0;
      let pkt1Kpg = 0,
        pkt2Kpg = 0,
        feldaKpg = 0;
      let pkt1Efb = 0,
        pkt2Efb = 0,
        feldaEfb = 0;

      monthDataForTrend.forEach((item) => {
        const rawUpper = String(item.blok || "").toUpperCase().trim();
        const pUpper = String(item.peringkat || "").toUpperCase();
        const kpUpper = String(item.kod_penjual || "").toUpperCase();
        const kaUpper = String(item.kod_akaun_bts || "").toUpperCase();
        const npUpper = String(item.nama_penjual || "").toUpperCase();

        const has020 =
          kpUpper.includes("-020-") ||
          kaUpper.includes("-020-") ||
          /[-_]020[-_]/.test(kpUpper) ||
          /[-_]020[-_]/.test(kaUpper) ||
          /\b\d{4}-020-/.test(kpUpper) ||
          /\b\d{4}-020-/.test(kaUpper) ||
          /\b020\b/.test(kaUpper);

        const isExplicitPkt2 =
          rawUpper.startsWith("P2-") ||
          rawUpper.startsWith("P2 ") ||
          rawUpper.startsWith("PKT 2") ||
          rawUpper.startsWith("PKT2") ||
          pUpper.includes("002") ||
          pUpper.includes("PKT 2") ||
          pUpper.includes("PKT2") ||
          pUpper.includes("PERINGKAT 2") ||
          pUpper === "2" ||
          has020 ||
          npUpper.includes("PKT 2") ||
          npUpper.includes("PERINGKAT 2");

        let cleanBlok = getCleanBlokKey(item.blok, currentMasterData, item);
        if (isExplicitPkt2 && currentMasterData && currentMasterData["12"]) {
          const num = parseInt(cleanBlok, 10);
          if (!isNaN(num) && num >= 1 && num <= 6) {
            cleanBlok = String(num + 11);
          }
        }

        if (isEFBItem(item)) {
          const b = currentMasterData[cleanBlok];
          if (b) {
            if (b.pkt === "001") pkt1Efb += item.tan || 0;
            else if (b.pkt === "002") pkt2Efb += item.tan || 0;
            else if (b.pkt === "003" || b.pkt === "004") feldaEfb += item.tan || 0;
          } else if (isExplicitPkt2) {
            pkt2Efb += item.tan || 0;
          }
          return;
        }

        const b = currentMasterData[cleanBlok];
        const kpgVal = parseFloat(item.kpg || "0");
        const rowDate =
          item.tarikh ||
          (item.created_at
            ? new Date(new Date(item.created_at).getTime() + 8 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0]
            : "");
        const threshold = rowDate >= "2026-04-13" ? 21.25 : 21.0;

        if (b) {
          if (b.pkt === "001") {
            pkt1Tan += item.tan || 0;
            pkt1Muda += item.muda || 0;
            if (kpgVal >= threshold) pkt1Kpg += 1;
          } else if (b.pkt === "002") {
            pkt2Tan += item.tan || 0;
            pkt2Muda += item.muda || 0;
            if (kpgVal >= threshold) pkt2Kpg += 1;
          } else if (b.pkt === "003" || b.pkt === "004") {
            feldaTan += item.tan || 0;
            feldaMuda += item.muda || 0;
            if (kpgVal >= threshold) feldaKpg += 1;
          }
        } else {
          const p = String(item.peringkat || "").toUpperCase();
          if (isExplicitPkt2 || p.includes("PKT 2") || p.includes("002") || p.includes("PERINGKAT 2")) {
            pkt2Tan += item.tan || 0;
            pkt2Muda += item.muda || 0;
            if (kpgVal >= threshold) pkt2Kpg += 1;
          } else if (p.includes("PKT 1") || p.includes("001") || p.includes("PERINGKAT 1")) {
            pkt1Tan += item.tan || 0;
            pkt1Muda += item.muda || 0;
            if (kpgVal >= threshold) pkt1Kpg += 1;
          } else if (
            p.includes("PKT 3") ||
            p.includes("003") ||
            p.includes("PKT 4") ||
            p.includes("004") ||
            p.includes("FELDA") ||
            cleanBlok === "LF" ||
            cleanBlok === "88"
          ) {
            feldaTan += item.tan || 0;
            feldaMuda += item.muda || 0;
            if (kpgVal >= threshold) feldaKpg += 1;
          }
        }
      });

      const pkt1Luas = Object.values(currentMasterData)
        .filter((m) => m.pkt === "001")
        .reduce((acc, curr) => acc + curr.luas, 0);
      const pkt2Luas = Object.values(currentMasterData)
        .filter((m) => m.pkt === "002")
        .reduce((acc, curr) => acc + curr.luas, 0);
      const feldaLuas = Object.values(currentMasterData)
        .filter((m) => m.pkt === "003" || m.pkt === "004")
        .reduce((acc, curr) => acc + curr.luas, 0);

      const ffbMonthData = monthDataForTrend.filter(
        (item) => !isEFBItem(item),
      );
      const efbMonthData = monthDataForTrend.filter(
        (item) => isEFBItem(item),
      );
      const totalTan = ffbMonthData.reduce(
        (acc, curr) => acc + (curr.tan || 0),
        0,
      );
      const efbTan = efbMonthData.reduce(
        (acc, curr) => acc + (curr.tan || 0),
        0,
      );
      const totalMuda = ffbMonthData.reduce(
        (acc, curr) => acc + (curr.muda || 0),
        0,
      );
      const totalKpg = ffbMonthData.filter((item) => {
        const kpgVal = parseFloat(item.kpg || "0");
        const rowDate =
          item.tarikh ||
          (item.created_at
            ? new Date(new Date(item.created_at).getTime() + 8 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0]
            : "");
        const threshold = rowDate >= "2026-04-13" ? 21.25 : 21.0;
        return kpgVal >= threshold;
      }).length;
      const totalLuas = Object.values(currentMasterData).reduce(
        (acc, curr) => acc + curr.luas,
        0,
      );
      const yieldHek = totalLuas > 0 ? totalTan / totalLuas : 0;

      const isFutureMonth = monthStr > currentMonth;

      const blockYields: Record<string, number | null> = {};
      Object.keys(currentMasterData).forEach((blok) => {
        const blokData = monthDataForTrend.filter((d) => {
          const k = getCleanBlokKey(d.blok, currentMasterData, d);
          if (k === blok) return true;
          if (currentMasterData && currentMasterData["12"]) {
            const num = parseInt(blok, 10);
            if (!isNaN(num) && num >= 12 && num <= 17) {
              const relNum = String(num - 11);
              const p = String(d.peringkat || "").toUpperCase();
              const isP2 = p.includes("002") || p.includes("PKT 2") || p.includes("PKT2") || p.includes("PERINGKAT 2");
              if (isP2 && (k === relNum || String(d.blok || "").replace(/\D/g, "") === relNum)) {
                return true;
              }
            }
          }
          return false;
        });
        const ffbBlokData = blokData.filter((d) => !isEFBItem(d));
        const efbBlokData = blokData.filter((d) => isEFBItem(d));
        const blokTan = ffbBlokData.reduce(
          (acc, curr) => acc + (curr.tan || 0),
          0,
        );
        const blokLuas = currentMasterData[blok].luas;
        blockYields[`yield_${blok}`] = isFutureMonth ? null : (
          blokLuas > 0 ? parseFloat((blokTan / blokLuas).toFixed(2)) : 0
        );
        blockYields[`t_h2025_blok_${blok}`] =
          blokLuas > 0
            ? parseFloat(((hist2025?.blok?.[blok] || 0) / blokLuas).toFixed(2))
            : 0;
        blockYields[`muda_${blok}`] = isFutureMonth ? null : ffbBlokData.reduce(
          (acc, curr) => acc + (curr.muda || 0),
          0,
        );
        blockYields[`efb_${blok}`] = isFutureMonth ? null : efbBlokData.reduce(
          (acc, curr) => acc + (curr.tan || 0),
          0,
        );
        blockYields[`kpg_${blok}`] = isFutureMonth ? null : ffbBlokData.filter((item) => {
          const kpgVal = parseFloat(item.kpg || "0");
          const rowDate =
            item.tarikh ||
            (item.created_at
              ? new Date(
                  new Date(item.created_at).getTime() + 8 * 60 * 60 * 1000,
                )
                  .toISOString()
                  .split("T")[0]
              : "");
          const threshold = rowDate >= "2026-04-13" ? 21.25 : 21.0;
          return kpgVal >= threshold;
        }).length;
      });

      const priceData = monthDataForTrend.filter(
        (item) => item.rm_mt && item.rm_mt > 0,
      );
      const avgPrice =
        priceData.length > 0
          ? priceData.reduce((acc, curr) => acc + curr.rm_mt, 0) /
            priceData.length
          : 0;

      const price1PctData = monthDataForTrend.filter(
        (item) => item.rm_mt && parseFloat(item.kpg || "0") > 0,
      );
      const avgPrice1Pct =
        price1PctData.length > 0
          ? price1PctData.reduce(
              (acc, curr) => acc + curr.rm_mt / parseFloat(curr.kpg || "0"),
              0,
            ) / price1PctData.length
          : 0;

      const targetPKT1 = (currentMonthlyTargets["001"] || [])[i] || 0;
      const targetPKT2 = (currentMonthlyTargets["002"] || [])[i] || 0;
      const targetFELDA =
        feldaLuas > 0
          ? Object.entries(currentMasterData)
              .filter(([_, m]) => m.pkt === "003" || m.pkt === "004")
              .reduce((acc, [blokKey, m]) => {
                const tArr =
                  currentMonthlyTargets[`${m.pkt}_${blokKey}`] ||
                  currentMonthlyTargets[m.pkt] ||
                  currentMonthlyTargets["003_1F"] ||
                  currentMonthlyTargets["001"] ||
                  [];
                return acc + (tArr[i] || 0) * m.luas;
              }, 0) / feldaLuas
          : (currentMonthlyTargets["003"] || [])[i] || 0;

      const totalTargetHek =
        totalLuas > 0
          ? (targetPKT1 * pkt1Luas +
              targetPKT2 * pkt2Luas +
              targetFELDA * feldaLuas) /
            totalLuas
          : 0;

      const sysTodayStr = getTodayDateString();
      const [sysYear, sysMonth, sysDay] = (sysTodayStr || todayStr).split("-");
      const currentCalendarYear = parseInt(sysYear || "2026", 10);
      const currentCalendarMonth = parseInt(sysMonth || "10", 10);
      const currentCalendarDay = Math.max(1, parseInt(sysDay || "7", 10));

      const isCurrentMonth = monthIndex === currentCalendarMonth && parseInt(currentYear, 10) === currentCalendarYear;
      const daysInThisMonth = new Date(currentCalendarYear, monthIndex, 0).getDate() || 31;
      const daysMonitored = isCurrentMonth ? Math.min(currentCalendarDay, daysInThisMonth) : daysInThisMonth;

      let mudaForecast = isFutureMonth ? null : totalMuda;
      let mudaForecastDelta = 0;
      let mudaDailyAvg = 0;
      const isOngoingMonth = isCurrentMonth && daysMonitored < daysInThisMonth && totalMuda > 0;

      if (isOngoingMonth && totalMuda > 0) {
        // Daily average based on calendar elapsed days (e.g., 158 / 7 = 22.57 -> 22)
        // User formula: 22 bts/hari * 31 hari = 682 bts akhir bulan
        const rawAvg = totalMuda / daysMonitored;
        mudaDailyAvg = Math.floor(rawAvg);
        mudaForecast = mudaDailyAvg * daysInThisMonth;
        mudaForecastDelta = Math.max(0, mudaForecast - totalMuda);
      }

      return {
        month: monthNames[i],
        monthIndex,
        yield: isFutureMonth ? null : parseFloat(yieldHek.toFixed(2)),
        yieldHek: isFutureMonth ? null : parseFloat(yieldHek.toFixed(2)),
        yield2025: hist2025?.yield || 0,
        t_h2025: hist2025?.t_h || 0,
        t_h2025_pkt1:
          pkt1Luas > 0
            ? parseFloat(((hist2025?.pkt1_tan || 0) / pkt1Luas).toFixed(2))
            : 0,
        t_h2025_pkt2:
          pkt2Luas > 0
            ? parseFloat(((hist2025?.pkt2_tan || 0) / pkt2Luas).toFixed(2))
            : 0,
        t_h2025_felda:
          feldaLuas > 0
            ? parseFloat(((hist2025?.felda_tan || 0) / feldaLuas).toFixed(2))
            : 0,
        target_2026: parseFloat(totalTargetHek.toFixed(2)),
        target_2026_pkt1: targetPKT1,
        target_2026_pkt2: targetPKT2,
        target_2026_felda: targetFELDA,
        pkt1: isFutureMonth ? null : (pkt1Luas > 0 ? parseFloat((pkt1Tan / pkt1Luas).toFixed(2)) : 0),
        pkt2: isFutureMonth ? null : (pkt2Luas > 0 ? parseFloat((pkt2Tan / pkt2Luas).toFixed(2)) : 0),
        felda: isFutureMonth ? null : (feldaLuas > 0 ? parseFloat((feldaTan / feldaLuas).toFixed(2)) : 0),
        muda: isFutureMonth ? null : totalMuda,
        mudaActual: isFutureMonth ? null : totalMuda,
        mudaForecast: mudaForecast,
        mudaForecastDelta: mudaForecastDelta,
        mudaDailyAvg: mudaDailyAvg,
        isOngoingMonth: isOngoingMonth,
        daysMonitored: daysMonitored,
        daysInMonth: daysInThisMonth,
        pkt1Muda: isFutureMonth ? null : pkt1Muda,
        pkt2Muda: isFutureMonth ? null : pkt2Muda,
        feldaMuda: isFutureMonth ? null : feldaMuda,
        kpg: isFutureMonth ? null : totalKpg,
        kpg_match_count: isFutureMonth ? null : totalKpg,
        pkt1Kpg: isFutureMonth ? null : pkt1Kpg,
        pkt2Kpg: isFutureMonth ? null : pkt2Kpg,
        feldaKpg: isFutureMonth ? null : feldaKpg,
        tan: isFutureMonth ? null : parseFloat(totalTan.toFixed(2)),
        efb: isFutureMonth ? null : parseFloat(efbTan.toFixed(2)),
        efb_tan: isFutureMonth ? null : parseFloat(efbTan.toFixed(2)),
        pkt1Efb: isFutureMonth ? null : parseFloat(pkt1Efb.toFixed(1)),
        pkt2Efb: isFutureMonth ? null : parseFloat(pkt2Efb.toFixed(1)),
        feldaEfb: isFutureMonth ? null : parseFloat(feldaEfb.toFixed(1)),
        avgPrice: isFutureMonth ? null : parseFloat(avgPrice.toFixed(2)),
        avgPrice1Pct: isFutureMonth ? null : parseFloat(avgPrice1Pct.toFixed(2)),
        ...blockYields,
        isCurrentMonth: monthIndex === new Date().getMonth() + 1,
      };
    });

    const dailyPriceTrend = [...dailyPriceStats]
      .filter((d) => d.date.startsWith(currentMonth))
      .sort((a, b) => a.date.localeCompare(b.date));

    const dayAnalytics = calculateForPeriod(dataToday, "day");
    const monthAnalytics = calculateForPeriod(dataMonth, "month");
    const yearAnalytics = calculateForPeriod(dataYear, "year");

    return {
      displayDate: todayStr,
      day: dayAnalytics,
      month: monthAnalytics,
      year: yearAnalytics,
      yoy: yearAnalytics,
      monthlyTrend,
      dailyPriceStats,
      dailyPriceTrend,
    };
  }, [
    combinedData,
    dashboardDate,
    reportType,
    rankingPeriod,
    currentMasterData,
    currentMonthlyTargets,
    activeEstateId,
  ]);

  // History chart data
  const historyChartData = useMemo(() => {
    const hasDbData =
      Array.isArray(blockAnnualData) && blockAnnualData.length > 0;
    const dataSource = hasDbData ? blockAnnualData : [];

    if (dataSource.length === 0 && !(analytics?.year as any)?.yieldHek) return [];

    let filtered = dataSource;

    if (selectedBlockFilter !== "all") {
      const bKey = String(selectedBlockFilter);
      filtered = filtered.filter((d) => String(d.block) === bKey);
    } else if (selectedPactFilter !== "all") {
      const allowedBlocks = Object.entries(currentMasterData)
        .filter(([_, v]) => v.pkt === selectedPactFilter)
        .map(([k]) => String(k));
      filtered = filtered.filter((d) =>
        allowedBlocks.includes(String(d.block)),
      );
    }

    if (thekHistoryView !== "overall") {
      const targetPkt =
        thekHistoryView === "pkt1"
          ? "001"
          : thekHistoryView === "pkt2"
            ? "002"
            : "003";

      const allowedBlocks = Object.entries(currentMasterData)
        .filter(([_, v]) => v.pkt === targetPkt)
        .map(([k]) => String(k));

      filtered = filtered.filter((d) =>
        allowedBlocks.includes(String(d.block)),
      );
    }

    const yearGroups: Record<
      string,
      { sumTan: number; sumLuas: number; year: number }
    > = {};

    filtered.forEach((d) => {
      const yr = String(d.year);
      if (!yearGroups[yr]) {
        yearGroups[yr] = { sumTan: 0, sumLuas: 0, year: Number(yr) };
      }
      const bLuas = currentMasterData[String(d.block)]?.luas || 0;
      if (bLuas > 0) {
        yearGroups[yr].sumTan += Number(d.yield || 0) * bLuas;
        yearGroups[yr].sumLuas += bLuas;
      }
    });

    const currentYear = 2026;
    let currentYield = 0;
    if (analytics?.year) {
      const lPkt1 = Object.values(currentMasterData)
        .filter((b) => b.pkt === "001")
        .reduce((acc, curr) => acc + curr.luas, 0);
      const lPkt2 = Object.values(currentMasterData)
        .filter((b) => b.pkt === "002")
        .reduce((acc, curr) => acc + curr.luas, 0);
      const lFelda = Object.values(currentMasterData)
        .filter((b) => b.pkt === "003")
        .reduce((acc, curr) => acc + curr.luas, 0);
      const lOverall = lPkt1 + lPkt2 + lFelda;

      if (thekHistoryView === "overall") {
        if (selectedBlockFilter !== "all") {
          const b = currentMasterData[String(selectedBlockFilter)];
          currentYield =
            b && b.luas > 0
              ? analytics.year.blokStats.find(
                  (x: any) => x.blok === String(selectedBlockFilter),
                )?.capai2026 || 0
              : 0;
        } else if (selectedPactFilter !== "all") {
          const targetLuas =
            selectedPactFilter === "001"
              ? lPkt1
              : selectedPactFilter === "002"
                ? lPkt2
                : lFelda;
          const targetTan =
            selectedPactFilter === "001"
              ? analytics.year.pkt1_tan
              : selectedPactFilter === "002"
                ? analytics.year.pkt2_tan
                : analytics.year.felda_tan;
          currentYield = targetLuas > 0 ? (targetTan || 0) / targetLuas : 0;
        } else {
          currentYield =
            lOverall > 0 ? (analytics.year.totalTan || 0) / lOverall : 0;
        }
      } else if (thekHistoryView === "pkt1") {
        currentYield = lPkt1 > 0 ? (analytics.year.pkt1_tan || 0) / lPkt1 : 0;
      } else if (thekHistoryView === "pkt2") {
        currentYield = lPkt2 > 0 ? (analytics.year.pkt2_tan || 0) / lPkt2 : 0;
      } else if (thekHistoryView === "felda") {
        currentYield =
          lFelda > 0 ? (analytics.year.felda_tan || 0) / lFelda : 0;
      }
    }

    if (currentYield !== undefined && currentYield > 0) {
      yearGroups[String(currentYear)] = {
        sumTan: currentYield,
        sumLuas: 1,
        year: currentYear,
      };
    }

    const result = Object.values(yearGroups)
      .map((g) => ({
        year: g.year,
        yield: parseFloat(
          (g.sumLuas > 0 ? g.sumTan / g.sumLuas : 0).toFixed(2),
        ),
      }))
      .sort((a, b) => a.year - b.year);

    return result;
  }, [
    blockAnnualData,
    selectedBlockFilter,
    selectedPactFilter,
    thekHistoryView,
    analytics?.year,
    currentMasterData,
    activeEstateId,
  ]);

  return {
    historicalEfbTransactions,
    combinedData,
    analytics,
    historyChartData,
  };
}
