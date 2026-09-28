import { getEstateConfig } from "../../../config/estateRegistry";
import { getActiveEstateId } from "../../../utils/estateContext";

export function generateRCReport(analytics: any): string {
  if (!analytics || !analytics.day || !analytics.month || !analytics.year) {
    return "Memuatkan data...";
  }

  const estateId = analytics.estateId || getActiveEstateId();
  const cfg = getEstateConfig(estateId);

  const rawDateStr = analytics.displayDate || new Date().toISOString().split("T")[0];
  const dateParts = rawDateStr.includes("-") ? rawDateStr.split("-") : rawDateStr.split("/");
  let dateStr = rawDateStr;
  let currentYearNum = new Date().getFullYear();
  if (dateParts.length === 3) {
    if (dateParts[0].length === 4) {
      dateStr = `${dateParts[2].padStart(2, "0")}/${dateParts[1].padStart(2, "0")}/${dateParts[0]}`;
      currentYearNum = parseInt(dateParts[0], 10) || currentYearNum;
    } else {
      dateStr = `${dateParts[0].padStart(2, "0")}/${dateParts[1].padStart(2, "0")}/${dateParts[2]}`;
      currentYearNum = parseInt(dateParts[2], 10) || currentYearNum;
    }
  }
  const prevYearNum = currentYearNum - 1;

  // Calculate areas and sections dynamically from estate config blocks (Lot Peneroka: Pkt 1 & Pkt 2 sahaja)
  const blocksMap = cfg.blocks || {};
  
  let luasPkt1 = 0;
  let luasPkt2 = 0;

  const pkt1Blocks: string[] = [];
  const pkt2Blocks: string[] = [];

  Object.values(blocksMap).forEach((b) => {
    if (b.pkt === "001") {
      luasPkt1 += b.luas;
      pkt1Blocks.push(b.blok);
    } else if (b.pkt === "002") {
      luasPkt2 += b.luas;
      pkt2Blocks.push(b.blok);
    }
  });

  const sections: any[] = [];

  if (pkt1Blocks.length > 0) {
    sections.push({
      name: "Peringkat 1",
      pkt: "001",
      area: luasPkt1,
      blocks: pkt1Blocks,
      ttnYield: cfg.annualTargetPkt1 || 25.0,
      ttn2025Yield: (cfg.annualTargetPkt1 || 25.0) * 0.96,
      category: "Lot Peneroka\nMatang Utama",
    });
  }

  if (pkt2Blocks.length > 0) {
    sections.push({
      name: "Peringkat 2",
      pkt: "002",
      area: luasPkt2,
      blocks: pkt2Blocks,
      ttnYield: cfg.annualTargetPkt2 || 25.0,
      ttn2025Yield: (cfg.annualTargetPkt2 || 25.0) * 0.96,
      category: "Lot Peneroka\nMatang Utama",
    });
  }

  // Luas keseluruhan laporan hanya merangkumi Lot Peneroka (Pkt 1 & Pkt 2, tanpa Lot FELDA dan Lot Tambahan)
  const totalLuas = sections.reduce((acc, sec) => acc + sec.area, 0);

  let report = `*${cfg.name.toUpperCase()}*\nLaporan Hasil Harian\nHasil Hingga : ${dateStr}\n..............................................................\n`;

  sections.forEach((sec) => {
    report += `${sec.category}\n${sec.name} : (${sec.area.toFixed(2)} Ha)\n\n`;

    sec.blocks.forEach((blkId) => {
      const bMonth = analytics.month?.blokStats?.find((b: any) => {
        if (sec.pkt === "002") {
          // Strictly match Pkt 2 blocks
          if (b.pkt && b.pkt !== "002") return false;
          if (b.blok === blkId || b.blok === blkId.replace(/^0+/, "")) return true;
          const num = parseInt(blkId, 10);
          if (!isNaN(num) && num >= 12 && num <= 17) {
            const relNum = String(num - 11);
            return (
              b.blok === relNum ||
              b.blok === relNum.padStart(2, "0") ||
              b.blok === `P2-${relNum}` ||
              b.blok === `P2-${relNum.padStart(2, "0")}`
            );
          }
          return false;
        } else if (sec.pkt === "001") {
          if (b.pkt && b.pkt !== "001") return false;
          return b.blok === blkId || b.blok === blkId.replace(/^0+/, "");
        }
        return b.blok === blkId || b.blok === blkId.replace(/^0+/, "");
      });

      let label = blkId.length <= 2 && !isNaN(Number(blkId)) ? blkId.padStart(2, "0") : blkId;
      // In FPM Adela, Pkt 2 blocks 12-17 are presented to management and settlers as 01 to 06
      if (sec.pkt === "002") {
        const num = parseInt(blkId, 10);
        if (!isNaN(num) && num >= 12 && num <= 17) {
          label = String(num - 11).padStart(2, "0");
        }
      }

      const tanVal = bMonth?.tan || 0;
      const blkLuas = bMonth?.luas || cfg.blocks?.[blkId]?.luas || 0;
      const yieldVal = bMonth?.yieldHek || (blkLuas > 0 ? tanVal / blkLuas : 0);
      report += `${label}-\t${yieldVal.toFixed(2)}\tT/Ha\t(\t${tanVal.toFixed(2)}\tM/t\t)\n`;
    });
    report += `\n`;

    // Extract tan and target for H.I, B.I, H.B.I based on section pkt
    const getSecData = (periodData: any) => {
      if (!periodData) return { tan: 0, target: 0 };
      if (sec.pkt === "001") {
        let tan = periodData.pkt1_tan || 0;
        if (tan === 0 && periodData.blokStats) {
          tan = periodData.blokStats
            .filter((b: any) => b.pkt === "001")
            .reduce((acc: number, b: any) => acc + (b.tan || 0), 0);
        }
        return { tan, target: periodData.pkt1_target || 0 };
      } else if (sec.pkt === "002") {
        let tan = periodData.pkt2_tan || 0;
        if (tan === 0 && periodData.blokStats) {
          tan = periodData.blokStats
            .filter((b: any) => b.pkt === "002")
            .reduce((acc: number, b: any) => acc + (b.tan || 0), 0);
        }
        return { tan, target: periodData.pkt2_target || 0 };
      } else if (sec.pkt === "003") {
        return { tan: periodData.felda_tan || 0, target: periodData.felda_target || 0 };
      } else if (sec.pkt === "004") {
        return { tan: periodData.tambahan_tan || 0, target: periodData.tambahan_target || 0 };
      }
      return { tan: 0, target: 0 };
    };

    // H.I
    const dData = getSecData(analytics.day);
    const dTan = dData.tan;
    const dTarget = dData.target;
    const dYield = sec.area > 0 ? dTan / sec.area : 0;
    const dTargetYield = sec.area > 0 ? dTarget / sec.area : 0;
    const dPct = dTarget > 0 ? (dTan / dTarget) * 100 : 0;
    report += `H.I\nT-\t${dTarget.toFixed(2)}\tM/t @\t${dTargetYield.toFixed(2)}\tT/Ha\t\t\nC-\t${dTan.toFixed(2)}\tM/t @\t${dYield.toFixed(2)}\tT/Ha (\t${dPct.toFixed(2)}%\t)\n\n`;

    // B.I
    const mData = getSecData(analytics.month);
    const mTan = mData.tan;
    const mTarget = mData.target;
    const mYield = sec.area > 0 ? mTan / sec.area : 0;
    const mTargetYield = sec.area > 0 ? mTarget / sec.area : 0;
    const mPct = mTarget > 0 ? (mTan / mTarget) * 100 : 0;
    report += `B.I\nT-\t${mTarget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\tM/t @\t${mTargetYield.toFixed(2)}\tT/Ha\t\t\nC-\t${mTan.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\tM/t @\t${mYield.toFixed(2)}\tT/Ha (\t${mPct.toFixed(2)}%\t)\n\n`;

    // H.B.I
    const yData = getSecData(analytics.year);
    const yTan = yData.tan;
    const yTarget = yData.target;
    const yYield = sec.area > 0 ? yTan / sec.area : 0;
    const yTargetYield = sec.area > 0 ? yTarget / sec.area : 0;
    const yPct = yTarget > 0 ? (yTan / yTarget) * 100 : 0;
    const ttnTan = sec.ttnYield * sec.area;
    report += `H.B.I ${currentYearNum}\nT :\t${yTarget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\tM/t @\t${yTargetYield.toFixed(2)}\tT/Ha\t\t\nC-\t${yTan.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\tM/t @\t${yYield.toFixed(2)}\tT/Ha (\t${yPct.toFixed(2)}%\t)\nTTn-\t${ttnTan.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\tM/t @\t${sec.ttnYield.toFixed(1)}\tT/Ha \t\t\n\n`;

    // H.B.I prev
    const y25Tan =
      sec.pkt === "001"
        ? analytics.year?.pkt1_ytd2025 || 0
        : sec.pkt === "002"
        ? analytics.year?.pkt2_ytd2025 || 0
        : sec.pkt === "003"
        ? analytics.year?.felda_ytd2025 || 0
        : 0;
    const y25Yield = sec.area > 0 ? y25Tan / sec.area : 0;
    const y25Target = yTarget * 0.98;
    const y25TargetYield = sec.area > 0 ? y25Target / sec.area : 0;
    const ttn25Yield = sec.ttn2025Yield;
    const ttn25Tan = ttn25Yield * sec.area;
    report += `H.B.I ${prevYearNum}\nT-\t${y25Target.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\tM/t @\t${y25TargetYield.toFixed(2)}\tT/Ha\t\t\nC-\t${y25Tan.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\tM/t @\t${y25Yield.toFixed(2)}\tT/Ha\t\t\nTTn-\t${ttn25Tan.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\tM/t @\t${ttn25Yield.toFixed(2)}\tT/Ha\n..................................................................\n`;
  });

  const dAll = analytics.day || {};
  const mAll = analytics.month || {};
  const yAll = analytics.year || {};

  const dOTan = (dAll.pkt1_tan || 0) + (dAll.pkt2_tan || 0);
  const dOTarget = (dAll.pkt1_target || 0) + (dAll.pkt2_target || 0);
  const dOYield = totalLuas > 0 ? dOTan / totalLuas : 0;
  const dOTargetYield = totalLuas > 0 ? dOTarget / totalLuas : 0;
  const dOPct = dOTarget > 0 ? (dOTan / dOTarget) * 100 : 0;

  const mOTan = (mAll.pkt1_tan || 0) + (mAll.pkt2_tan || 0);
  const mOTarget = (mAll.pkt1_target || 0) + (mAll.pkt2_target || 0);
  const mOYield = totalLuas > 0 ? mOTan / totalLuas : 0;
  const mOTargetYield = totalLuas > 0 ? mOTarget / totalLuas : 0;
  const mOPct = mOTarget > 0 ? (mOTan / mOTarget) * 100 : 0;

  const yOTan = (yAll.pkt1_tan || 0) + (yAll.pkt2_tan || 0);
  const yOTarget = (yAll.pkt1_target || 0) + (yAll.pkt2_target || 0);
  const yOYield = totalLuas > 0 ? yOTan / totalLuas : 0;
  const yOTargetYield = totalLuas > 0 ? yOTarget / totalLuas : 0;
  const yOPct = yOTarget > 0 ? (yOTan / yOTarget) * 100 : 0;
  const ttnOTan = sections.reduce((acc, sec) => acc + (sec.ttnYield * sec.area), 0);
  const ttnOYield = totalLuas > 0 ? ttnOTan / totalLuas : 25.0;

  report += `Hasil Keseluruhan ${cfg.name}\nLuas: (${totalLuas.toFixed(2)} Hek)\n\n`;
  report += `H.I\nT-\t${dOTarget.toFixed(2)}\tM/t @\t${dOTargetYield.toFixed(2)}\tT/Ha\t\t\nC-\t${dOTan.toFixed(2)}\tM/t @\t${dOYield.toFixed(2)}\tT/Ha (\t${dOPct.toFixed(2)}%\t)\n\n`;
  report += `B.I\nT-\t${mOTarget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\tM/t @\t${mOTargetYield.toFixed(2)}\tT/Ha\t\t\nC-\t${mOTan.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\tM/t @\t${mOYield.toFixed(2)}\tT/Ha (\t${mOPct.toFixed(2)}%\t)\n\n`;
  report += `H.B.I ${currentYearNum}\nT-\t${yOTarget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\tM/t @\t${yOTargetYield.toFixed(2)}\tT/Ha\t\t\nC-\t${yOTan.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\tM/t @\t${yOYield.toFixed(2)}\tT/Ha (\t${yOPct.toFixed(2)}%\t)\nTTn-\t${ttnOTan.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\tM/t @\t${ttnOYield.toFixed(1)}\tT/Ha \t\t\n\n`;

  const y25OTan = (yAll.pkt1_ytd2025 || 0) + (yAll.pkt2_ytd2025 || 0);
  const y25OYield = totalLuas > 0 ? y25OTan / totalLuas : 0;
  const y25OTarget = yOTarget * 0.98;
  const y25OTargetYield = totalLuas > 0 ? y25OTarget / totalLuas : 0;
  const ttn25OTan = sections.reduce((acc, sec) => acc + (sec.ttn2025Yield * sec.area), 0);
  const ttn25OYield = totalLuas > 0 ? ttn25OTan / totalLuas : 24.5;

  report += `H.B.I ${prevYearNum}\nT-\t${y25OTarget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\tM/t @\t${y25OTargetYield.toFixed(2)}\tT/Ha\nC-\t${y25OTan.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\tM/t @\t${y25OYield.toFixed(2)}\tT/Ha\nTTn-\t${ttn25OTan.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\tM/t @\t${ttn25OYield.toFixed(2)}\tT/Ha`;

  return report;
}

export function executeWhatsAppShare(
  analytics: any,
  showToast?: (type: "success" | "error", msg: string) => void,
): void {
  const report = generateRCReport(analytics);
  const url = `https://wa.me/?text=${encodeURIComponent(report)}`;
  window.open(url, "_blank");
  if (showToast) showToast("success", "Membuka WhatsApp...");
}
