import React from "react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import domToImage from "dom-to-image";
import { Transaction, ReportType } from "../../../types";
import { MASTER_DATA } from "../../../utils/constants";
import { getEstateConfig, getActiveEstateId, getBlockArea } from "../../../config/estateRegistry";

export interface ExcelExportParams {
  rawData: Transaction[];
  reportType: ReportType;
  exportFilter: "all" | "date" | "month" | "range";
  exportDate: string;
  exportStartDate?: string;
  exportEndDate?: string;
  exportMonth: string;
  exportColumns: string[];
  chartPeriod: "day" | "month" | "year";
  isDarkMode: boolean;
  monthlyTrendRef: React.RefObject<HTMLDivElement | null>;
  thekChartRef: React.RefObject<HTMLDivElement | null>;
  showToast: (type: "success" | "error", msg: string) => void;
  setIsExporting: (isExporting: boolean) => void;
  setShowExportModal: (show: boolean) => void;
}

// Helper to normalize any date string (YYYY-MM-DD, DD.MM.YYYY, DD/MM/YYYY) to standard YYYY-MM-DD
function normalizeDateStr(d?: string | null): string {
  if (!d) return "";
  const s = String(d).trim().split(/[T ]/)[0];
  // Match YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const ymd = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;
  // Match DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  return s;
}

// Strictly extract transaction harvest/delivery date from item.tarikh first
function getItemOperationalDate(item: Transaction): string {
  if (item.tarikh) {
    const norm = normalizeDateStr(item.tarikh);
    if (norm) return norm;
  }
  // ONLY fallback to created_at if tarikh is completely missing
  if (item.created_at) {
    return new Date(new Date(item.created_at).getTime() + 8 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
  }
  return "";
}

export async function exportToExcel({
  rawData,
  reportType,
  exportFilter,
  exportDate,
  exportStartDate,
  exportEndDate,
  exportMonth,
  exportColumns,
  chartPeriod,
  isDarkMode,
  monthlyTrendRef,
  thekChartRef,
  showToast,
  setIsExporting,
  setShowExportModal,
}: ExcelExportParams): Promise<void> {
  try {
    setIsExporting(true);
    let filteredData = rawData;

    // STRICT SEPARATION: Filter by BTS or EFB based on report type
    if (reportType === "efb") {
      filteredData = rawData.filter((item) => item.peringkat === "EFB");
    } else {
      // All other reports (hasil, muda, kpa_kpg, efc_format) are BTS reports
      filteredData = rawData.filter((item) => item.peringkat !== "EFB");
    }

    if (exportFilter === "date") {
      const targetDate = normalizeDateStr(exportDate);
      filteredData = filteredData.filter((item) => {
        const itemDate = getItemOperationalDate(item);
        return itemDate === targetDate;
      });
    } else if (exportFilter === "range") {
      const start = normalizeDateStr(exportStartDate || exportDate);
      const end = normalizeDateStr(exportEndDate || exportDate);
      filteredData = filteredData.filter((item) => {
        const itemDate = getItemOperationalDate(item);
        if (!itemDate) return false;
        if (start && end) return itemDate >= start && itemDate <= end;
        if (start) return itemDate >= start;
        if (end) return itemDate <= end;
        return true;
      });
    } else if (exportFilter === "month") {
      const targetMonth = (exportMonth || "").slice(0, 7);
      filteredData = filteredData.filter((item) => {
        const itemDate = getItemOperationalDate(item);
        return itemDate.startsWith(targetMonth);
      });
    }

    if ((filteredData?.length || 0) === 0) {
      // If FPM_ADELA and data is empty in state/cache, automatically fallback to official baseline deliveries
      const activeEst = (rawData.length > 0 ? rawData[0].estate_id : null) || getActiveEstateId();
      if (activeEst === "FPM_ADELA") {
        const { generateAdelaBaselineTransactions } = await import("../../../data/adelaBaselineDeliveries");
        const baseline = generateAdelaBaselineTransactions();
        let fallbackData = baseline;
        if (exportFilter === "date") {
          const targetDate = normalizeDateStr(exportDate);
          fallbackData = baseline.filter((item) => getItemOperationalDate(item) === targetDate);
        } else if (exportFilter === "range") {
          const start = normalizeDateStr(exportStartDate || exportDate);
          const end = normalizeDateStr(exportEndDate || exportDate);
          fallbackData = baseline.filter((item) => {
            const itemDate = getItemOperationalDate(item);
            if (!itemDate) return false;
            if (start && end) return itemDate >= start && itemDate <= end;
            if (start) return itemDate >= start;
            if (end) return itemDate <= end;
            return true;
          });
        } else if (exportFilter === "month") {
          const targetMonth = (exportMonth || "").slice(0, 7);
          fallbackData = baseline.filter((item) => getItemOperationalDate(item).startsWith(targetMonth));
        }
        if (fallbackData.length > 0) {
          filteredData = fallbackData;
        }
      }
    }

    if ((filteredData?.length || 0) === 0) {
      showToast("error", "Tiada data untuk dieksport pada tarikh/bulan ini.");
      return;
    }

    // Sort data by date ascending (Earliest at top, Latest at bottom)
    const sortedData = [...filteredData].sort((a, b) => {
      // Primary sort by tarikh string (YYYY-MM-DD)
      const dateA = a.tarikh || "";
      const dateB = b.tarikh || "";
      if (dateA !== dateB) return dateA.localeCompare(dateB);

      // Secondary sort by created_at if tarikh is the same
      const createdA = a.created_at || "";
      const createdB = b.created_at || "";
      return createdA.localeCompare(createdB);
    });

    const sampleEstateId = (filteredData.length > 0 ? filteredData[0].estate_id : null) || getActiveEstateId();
    const currentEstateCfg = getEstateConfig(sampleEstateId);
    const estateDisplayTitle = `FPMSB ${currentEstateCfg.shortName.toUpperCase()}`;
    const estateFilePrefix = `FPMSB_${currentEstateCfg.shortName.toUpperCase()}`;

    // Theme palette for Excel styling according to app's theme (Light vs Dark mode)
    const theme = {
      isDark: isDarkMode,
      blankFill: isDarkMode ? "FF0F172A" : "FFFFFFFF",
      // Main Banner
      titleBg: isDarkMode ? "FF064E3B" : "FF059669",
      titleFg: "FFFFFFFF",
      subtitleBg: isDarkMode ? "FF0F172A" : "FFF0FDF4",
      subtitleFg: isDarkMode ? "FF34D399" : "FF065F46",
      reportTitleBg: isDarkMode ? "FF0F172A" : "FFFFFFFF",
      reportTitleFg: isDarkMode ? "FFF8FAFC" : "FF0F172A",
      metaBg: isDarkMode ? "FF0F172A" : "FFFFFFFF",
      metaFg: isDarkMode ? "FF94A3B8" : "FF475569",
      // Headers
      headerBg: isDarkMode ? "FF065F46" : "FF059669",
      headerFg: "FFFFFFFF",
      headerBorder: isDarkMode ? "FF1E293B" : "FFFFFFFF",
      // Data Rows
      rowBgEven: isDarkMode ? "FF0F172A" : "FFFFFFFF",
      rowBgOdd: isDarkMode ? "FF1E293B" : "FFF8FAFC",
      rowFg: isDarkMode ? "FFF1F5F9" : "FF0F172A",
      rowBorder: isDarkMode ? "FF334155" : "FFCBD5E1",
      // Summary Rows
      summaryBg: isDarkMode ? "FF78350F" : "FFFEF3C7",
      summaryFg: isDarkMode ? "FFFEF3C7" : "FF92400E",
      summaryBorder: isDarkMode ? "FFB45309" : "FFD97706",
      // Secondary highlights
      alertHeaderBg: isDarkMode ? "FF9F1239" : "FFE11D48",
      alertHeaderFg: "FFFFFFFF",
      alertFg: isDarkMode ? "FFF43F5E" : "FFE11D48",
      accentBg: isDarkMode ? "FF064E3B" : "FFD1FAE5",
      accentFg: isDarkMode ? "FFA7F3D0" : "FF064E3B",
    };

    const workbook = new ExcelJS.Workbook();

    // Helper function to create a standard sheet
    const createStandardSheet = (
      ws: ExcelJS.Worksheet,
      data: Transaction[],
      sheetTitle: string,
      _isMaster: boolean = false,
    ) => {
      // Ensure grid lines are visible and cleanly styled
      ws.views = [{ showGridLines: true }];

      // Define Columns
      const allPossibleColumns = [
        { header: "BIL", key: "bil", width: 8 },
        { header: "TARIKH", key: "tarikh", width: 14 },
        { header: "NO. RESIT", key: "no_resit", width: 16 },
        { header: "NO. LORI", key: "no_lori", width: 12 },
        { header: "NO. SEAL", key: "no_seal", width: 12 },
        { header: "NO. NOTA HANTARAN", key: "no_nota", width: 20 },
        { header: "KPG", key: "kpg", width: 10 },
        { header: "BLOK", key: "blok", width: 10 },
        { header: "PERINGKAT", key: "peringkat", width: 12 },
        { header: "BERAT (TAN)", key: "tan", width: 15 },
        { header: "BTS MUDA", key: "muda", width: 12 },
        { header: "TAN/HEK (T/H)", key: "thek", width: 15 },
        { header: "MASA MASUK", key: "masa", width: 15 },
        { header: "DICIPTA PADA", key: "created", width: 25 },
      ];

      const activeCols = allPossibleColumns.filter(
        (c) => exportColumns.includes(c.key) || c.key === "tarikh" || c.key === "bil",
      );
      ws.columns = activeCols.map((col) => ({
        key: col.key,
        width: col.width,
      }));

      const getColLetter = (index: number) => {
        let temp = index;
        let letter = "";
        while (temp > 0) {
          const rem = (temp - 1) % 26;
          letter = String.fromCharCode(65 + rem) + letter;
          temp = Math.floor((temp - 1) / 26);
        }
        return letter || "M";
      };
      const lastCol = getColLetter(activeCols.length);

      // Add Title Row
      ws.mergeCells(`A1:${lastCol}1`);
      const titleCell = ws.getCell("A1");
      titleCell.value = estateDisplayTitle;
      titleCell.font = {
        name: "Arial Black",
        size: 20,
        color: { argb: theme.titleFg },
        bold: true,
      };
      titleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: theme.titleBg },
      };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(1).height = 50;

      // Add Subtitle Row
      ws.mergeCells(`A2:${lastCol}2`);
      const subtitleCell = ws.getCell("A2");
      subtitleCell.value = "SISTEM MAKLUMAT LADANG BERSEPADU";
      subtitleCell.font = {
        name: "Arial",
        size: 14,
        bold: true,
        color: { argb: theme.subtitleFg },
      };
      subtitleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: theme.subtitleBg },
      };
      subtitleCell.alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(2).height = 30;

      // Add Report Type Row
      ws.mergeCells(`A3:${lastCol}3`);
      const reportCell = ws.getCell("A3");
      reportCell.value = sheetTitle;
      reportCell.font = {
        name: "Arial",
        size: 12,
        bold: true,
        color: { argb: theme.reportTitleFg },
      };
      reportCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: theme.reportTitleBg },
      };
      reportCell.alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(3).height = 25;

      // Add Metadata Row (Date/Month)
      let metaText = "Semua Rekod";
      if (exportFilter === "date") {
        metaText = `Tarikh: ${exportDate.split("-").reverse().join(".")} (Harian Sahaja)`;
      } else if (exportFilter === "range") {
        metaText = `Julat Tarikh: ${(exportStartDate || exportDate).split("-").reverse().join(".")} hingga ${(exportEndDate || exportDate).split("-").reverse().join(".")}`;
      } else if (exportFilter === "month") {
        metaText = `Bulan: ${exportMonth}`;
      }
      ws.mergeCells(`A4:${lastCol}4`);
      const metaCell = ws.getCell("A4");
      metaCell.value = `Ladang: ${estateDisplayTitle} | ${metaText} | Bilangan No. Resit: ${data.length}`;
      metaCell.font = {
        name: "Arial",
        size: 11,
        bold: true,
        italic: true,
        color: { argb: theme.metaFg },
      };
      metaCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: theme.metaBg },
      };
      metaCell.alignment = { horizontal: "right", vertical: "middle" };
      ws.getRow(4).height = 20;

      // Spacer (Row 5) with theme fill
      const spacerRow = ws.getRow(5);
      spacerRow.height = 10;
      for (let i = 1; i <= activeCols.length; i++) {
        spacerRow.getCell(i).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: theme.blankFill },
        };
      }

      // Add Header Row Values Explicitly at Row 6
      const headerRow = ws.getRow(6);
      headerRow.values = activeCols.map((c) => c.header);
      headerRow.height = 35;

      headerRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: theme.headerBg },
        };
        cell.font = { bold: true, color: { argb: theme.headerFg }, size: 11 };
        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
        cell.border = {
          top: { style: "thin", color: { argb: theme.headerBorder } },
          left: { style: "thin", color: { argb: theme.headerBorder } },
          bottom: { style: "thin", color: { argb: theme.headerBorder } },
          right: { style: "thin", color: { argb: theme.headerBorder } },
        };
      });

      // Add Data Rows with explicit background fill and font color for theme consistency
      data.forEach((item, rowIndex) => {
        const rowData: any = {};
        activeCols.forEach((col) => {
          if (col.key === "bil") rowData.bil = rowIndex + 1;
          else if (col.key === "tarikh")
            rowData.tarikh = item.tarikh.split("-").reverse().join(".");
          else if (col.key === "no_resit") rowData.no_resit = item.no_resit;
          else if (col.key === "no_lori") rowData.no_lori = item.no_lori;
          else if (col.key === "no_seal")
            rowData.no_seal = item.no_seal || "-";
          else if (col.key === "no_nota")
            rowData.no_nota = item.no_nota_hantaran || "-";
          else if (col.key === "kpg") rowData.kpg = item.kpg || "-";
          else if (col.key === "blok") rowData.blok = item.blok;
          else if (col.key === "peringkat")
            rowData.peringkat = item.peringkat || "-";
          else if (col.key === "tan") rowData.tan = item.tan;
          else if (col.key === "muda") rowData.muda = item.muda;
          else if (col.key === "thek") {
            const cleanBlok = String(item.blok || "").replace(/^B/i, "").trim();
            const isTunggal = sampleEstateId === "FPM_TUNGGAL";
            const bArea = getBlockArea(cleanBlok, sampleEstateId) || (isTunggal ? (MASTER_DATA as any)[cleanBlok]?.luas : 0) || 0;
            const val = bArea > 0 ? (item.tan || 0) / bArea : (item.thek || 0);
            rowData.thek = parseFloat(val.toFixed(2));
          }
          else if (col.key === "masa") rowData.masa = item.masa_masuk || "-";
          else if (col.key === "created")
            rowData.created = item.created_at
              ? new Date(item.created_at).toLocaleString()
              : "-";
        });
        const row = ws.addRow(rowData);
        const isOdd = rowIndex % 2 !== 0;
        const rowBg = isOdd ? theme.rowBgOdd : theme.rowBgEven;

        row.eachCell((cell, colNumber) => {
          const colKey = activeCols[colNumber - 1]?.key;
          if (colKey === "thek" || colKey === "tan") {
            cell.numFmt = "#,##0.00";
          }
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: rowBg },
          };
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.border = {
            top: { style: "thin", color: { argb: theme.rowBorder } },
            left: { style: "thin", color: { argb: theme.rowBorder } },
            bottom: { style: "thin", color: { argb: theme.rowBorder } },
            right: { style: "thin", color: { argb: theme.rowBorder } },
          };
          cell.font = { size: 10, color: { argb: theme.rowFg } };
        });
      });

      // Add Summary Row
      const summaryRow = ws.addRow({});
      const noResitColIndex = activeCols.findIndex((c) => c.key === "no_resit") + 1;
      const tanColIndex = activeCols.findIndex((c) => c.key === "tan") + 1;
      const mudaColIndex = activeCols.findIndex((c) => c.key === "muda") + 1;
      const thekColIndex = activeCols.findIndex((c) => c.key === "thek") + 1;

      // Style and fill all cells in the summary row to ensure a complete horizontal line
      for (let i = 1; i <= activeCols.length; i++) {
        const cell = summaryRow.getCell(i);
        cell.font = { bold: true, size: 11, color: { argb: theme.summaryFg } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: theme.summaryBg },
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "medium", color: { argb: theme.summaryBorder } },
          left: { style: "thin", color: { argb: theme.summaryBorder } },
          bottom: { style: "medium", color: { argb: theme.summaryBorder } },
          right: { style: "thin", color: { argb: theme.summaryBorder } },
        };

        // First column shows "JUMLAH (BILANGAN RESIT)"
        if (i === 1) {
          cell.value = `JUMLAH (${data.length} RESIT)`;
          cell.alignment = { horizontal: "center", vertical: "middle" };
        }
      }

      // Bilangan No. Resit (Total Receipt Count) in Summary Row
      if (noResitColIndex > 0) {
        summaryRow.getCell(noResitColIndex).value = data.length;
        summaryRow.getCell(noResitColIndex).numFmt = "#,##0";
      }

      if (tanColIndex > 0) {
        summaryRow.getCell(tanColIndex).value = data.reduce(
          (sum, item) => sum + item.tan,
          0,
        );
        summaryRow.getCell(tanColIndex).numFmt = "#,##0.00";
      }
      if (mudaColIndex > 0) {
        summaryRow.getCell(mudaColIndex).value = data.reduce(
          (sum, item) => sum + item.muda,
          0,
        );
      }
      if (thekColIndex > 0) {
        const totalTan = data.reduce((sum, item) => sum + (item.tan || 0), 0);
        const estateConfig = getEstateConfig(sampleEstateId);
        
        let totalEstateLuas = estateConfig?.totalHectares || 0;
        if (!totalEstateLuas && estateConfig?.blocks) {
          totalEstateLuas = Object.values(estateConfig.blocks).reduce((sum, b) => sum + (b.luas || 0), 0);
        }
        if (!totalEstateLuas && sampleEstateId === "FPM_TUNGGAL") {
          totalEstateLuas = Object.values(MASTER_DATA).reduce((sum: number, b: any) => sum + (b.luas || 0), 0);
        }

        summaryRow.getCell(thekColIndex).value =
          totalEstateLuas > 0 ? totalTan / totalEstateLuas : 0;
        summaryRow.getCell(thekColIndex).numFmt = "#,##0.00";
      }
    };

    const createEfcSheet = (ws: ExcelJS.Worksheet, data: Transaction[]) => {
      // Setup Page Layout
      ws.views = [{ showGridLines: true }];
      ws.pageSetup.orientation = "landscape";
      ws.pageSetup.fitToPage = true;
      ws.pageSetup.fitToWidth = 1;

      // 1. TOP METADATA SECTION (Now starts at Row 1)
      ws.getCell("A1").value = "TARIKH MULA";
      ws.getCell("A2").value = "TARIKH TAMAT";
      ws.getCell("A3").value = "BULAN";

      [1, 2, 3].forEach((r) => {
        ws.getCell(`B${r}`).value = ":";
        ws.getCell(`A${r}`).font = { size: 9, bold: true, color: { argb: theme.rowFg } };
        ws.getCell(`B${r}`).font = { size: 9, bold: true, color: { argb: theme.rowFg } };
        ws.getCell(`C${r}`).font = { size: 9, bold: true, color: { argb: theme.rowFg } };
        ws.getCell(`A${r}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: theme.blankFill } };
        ws.getCell(`B${r}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: theme.blankFill } };
        ws.getCell(`C${r}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: theme.blankFill } };
      });

      // Values
      const formatDateStr = (dStr?: string) => {
        if (!dStr) return "-";
        const parts = dStr.split("-");
        return parts.length === 3 ? parts.reverse().join(".") : dStr;
      };

      ws.getCell("C1").value =
        exportFilter === "date"
          ? formatDateStr(exportDate)
          : exportFilter === "range"
            ? formatDateStr(exportStartDate || exportDate)
            : "01.01.2026";
      ws.getCell("C2").value =
        exportFilter === "date"
          ? formatDateStr(exportDate)
          : exportFilter === "range"
            ? formatDateStr(exportEndDate || exportDate)
            : "31.12.2026";

      const mIdx = exportMonth && exportMonth.includes("-") ? parseInt(exportMonth.split("-")[1]) - 1 : new Date().getMonth();
      const mNames = [
        "JANUARI", "FEBRUARI", "MAC", "APRIL", "MEI", "JUN",
        "JULAI", "OGOS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DISEMBER"
      ];
      ws.getCell("C3").value =
        exportFilter === "month"
          ? (mNames[mIdx] || "APRIL")
          : "APRIL";

      // Bilangan No. Resit & Estate Metadata in Top Section
      const efcTotalTan = data.reduce((sum, item) => sum + (item.tan || 0), 0);
      ws.getCell("E1").value = "BILANGAN RESIT";
      ws.getCell("E2").value = "JUMLAH TAN";
      ws.getCell("E3").value = "LADANG";

      [1, 2, 3].forEach((r) => {
        ws.getCell(`F${r}`).value = ":";
        ws.getCell(`E${r}`).font = { size: 9, bold: true, color: { argb: theme.rowFg } };
        ws.getCell(`F${r}`).font = { size: 9, bold: true, color: { argb: theme.rowFg } };
        ws.getCell(`G${r}`).font = { size: 9, bold: true, color: { argb: theme.rowFg } };
        ws.getCell(`E${r}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: theme.blankFill } };
        ws.getCell(`F${r}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: theme.blankFill } };
        ws.getCell(`G${r}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: theme.blankFill } };
      });

      ws.getCell("G1").value = `${data.length} RESIT`;
      ws.getCell("G2").value = `${efcTotalTan.toFixed(2)} MT`;
      ws.getCell("G3").value = estateDisplayTitle;

      // 3. TABLE HEADERS (Row 4-5)
      const headers = [
        { col: "A", title: "TARIKH", rowSpan: true },
        { col: "B", title: "No. Kenderaan", rowSpan: true },
        { col: "C", title: "Trip No:", rowSpan: true },
        { col: "D", title: "No. Nota Hantaran", rowSpan: true },
        { col: "E", title: "No. Resit", rowSpan: true },
        { col: "F", title: "Bil. Tandan", rowSpan: true },
        { col: "G", title: "Tan", rowSpan: true },
        { col: "H", title: "OER (%)", rowSpan: true },
        { col: "I", title: "KPG (%)", rowSpan: true },
      ];

      headers.forEach((h) => {
        const cell = ws.getCell(`${h.col}4`);
        cell.value = h.title;
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: theme.headerBg },
        };
        cell.font = { color: { argb: theme.headerFg }, bold: true, size: 9 };
        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
        cell.border = {
          top: { style: "thin", color: { argb: theme.headerBorder } },
          left: { style: "thin", color: { argb: theme.headerBorder } },
          bottom: { style: "thin", color: { argb: theme.headerBorder } },
          right: { style: "thin", color: { argb: theme.headerBorder } },
        };
        if (h.rowSpan) ws.mergeCells(`${h.col}4:${h.col}5`);
      });

      // 4. DATA ROWS (Starting Row 6)
      let currentRow = 6;
      data.forEach((item, idx) => {
        const row = ws.getRow(currentRow);
        const itemDateFormatted = item.tarikh
          ? item.tarikh.split("-").reverse().join("/")
          : "-";
        row.values = [
          itemDateFormatted,
          item.no_lori || "-",
          "1", // Trip No
          item.no_nota_hantaran || "-",
          item.no_resit || "-",
          item.muda || 0,
          item.tan || 0,
          "21.25%", // OER Placeholder
          item.kpg || "-",
        ];

        const rowBg = idx % 2 !== 0 ? theme.rowBgOdd : theme.rowBgEven;
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: rowBg },
          };
          cell.border = {
            top: { style: "thin", color: { argb: theme.rowBorder } },
            left: { style: "thin", color: { argb: theme.rowBorder } },
            bottom: { style: "thin", color: { argb: theme.rowBorder } },
            right: { style: "thin", color: { argb: theme.rowBorder } },
          };
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.font = { size: 9, color: { argb: theme.rowFg } };
        });
        currentRow++;
      });

      // Fill empty rows to match the visual (up to 30 rows)
      const targetRows = Math.max(currentRow, 30);
      for (let i = currentRow; i <= targetRows; i++) {
        const row = ws.getRow(i);
        const rowBg = i % 2 !== 0 ? theme.rowBgOdd : theme.rowBgEven;
        for (let j = 1; j <= 9; j++) {
          const cell = row.getCell(j);
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: rowBg },
          };
          cell.border = {
            top: { style: "thin", color: { argb: theme.rowBorder } },
            left: { style: "thin", color: { argb: theme.rowBorder } },
            bottom: { style: "thin", color: { argb: theme.rowBorder } },
            right: { style: "thin", color: { argb: theme.rowBorder } },
          };
        }
      }

      // 5. FOOTER (JUMLAH & BILANGAN NO. RESIT)
      const footerRow = targetRows + 1;
      ws.mergeCells(`A${footerRow}:D${footerRow}`);
      const jumlahLabel = ws.getCell(`A${footerRow}`);
      jumlahLabel.value = `JUMLAH (${data.length} NO. RESIT)`;
      jumlahLabel.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: theme.headerBg },
      };
      jumlahLabel.font = { color: { argb: theme.headerFg }, bold: true };
      jumlahLabel.alignment = { horizontal: "center", vertical: "middle" };

      // In column E (No. Resit column): show the receipt count
      const resitCountCell = ws.getCell(`E${footerRow}`);
      resitCountCell.value = `${data.length} RESIT`;
      resitCountCell.font = { bold: true, color: { argb: theme.headerFg } };
      resitCountCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: theme.headerBg },
      };
      resitCountCell.border = {
        top: { style: "thin", color: { argb: theme.headerBorder } },
        left: { style: "thin", color: { argb: theme.headerBorder } },
        bottom: { style: "thin", color: { argb: theme.headerBorder } },
        right: { style: "thin", color: { argb: theme.headerBorder } },
      };
      resitCountCell.alignment = { horizontal: "center", vertical: "middle" };

      // In column F (Bil Tandan): total tandan
      const totalTandan = data.reduce((sum, item) => sum + (item.muda || item.sample || 0), 0);
      const tandanCell = ws.getCell(`F${footerRow}`);
      tandanCell.value = totalTandan || "-";
      tandanCell.font = { bold: true, color: { argb: theme.headerFg } };
      tandanCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: theme.headerBg },
      };
      tandanCell.border = {
        top: { style: "thin", color: { argb: theme.headerBorder } },
        left: { style: "thin", color: { argb: theme.headerBorder } },
        bottom: { style: "thin", color: { argb: theme.headerBorder } },
        right: { style: "thin", color: { argb: theme.headerBorder } },
      };
      tandanCell.alignment = { horizontal: "center", vertical: "middle" };

      const totalTan = data.reduce((sum, item) => sum + (item.tan || 0), 0);
      const totalCell = ws.getCell(`G${footerRow}`);
      totalCell.value = parseFloat(totalTan.toFixed(2));
      totalCell.numFmt = "#,##0.00";
      totalCell.font = { bold: true, color: { argb: theme.headerFg } };
      totalCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: theme.headerBg },
      };
      totalCell.border = {
        top: { style: "thin", color: { argb: theme.headerBorder } },
        left: { style: "thin", color: { argb: theme.headerBorder } },
        bottom: { style: "thin", color: { argb: theme.headerBorder } },
        right: { style: "thin", color: { argb: theme.headerBorder } },
      };
      totalCell.alignment = { horizontal: "center", vertical: "middle" };

      // In columns H & I: style empty footer cells to complete the table frame
      ["H", "I"].forEach((col) => {
        const c = ws.getCell(`${col}${footerRow}`);
        c.value = "-";
        c.font = { bold: true, color: { argb: theme.headerFg } };
        c.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: theme.headerBg },
        };
        c.border = {
          top: { style: "thin", color: { argb: theme.headerBorder } },
          left: { style: "thin", color: { argb: theme.headerBorder } },
          bottom: { style: "thin", color: { argb: theme.headerBorder } },
          right: { style: "thin", color: { argb: theme.headerBorder } },
        };
        c.alignment = { horizontal: "center", vertical: "middle" };
      });

      // Column Widths
      ws.getColumn("A").width = 12;
      ws.getColumn("B").width = 15;
      ws.getColumn("C").width = 8;
      ws.getColumn("D").width = 18;
      ws.getColumn("E").width = 15;
      ws.getColumn("F").width = 10;
      ws.getColumn("G").width = 10;
      ws.getColumn("H").width = 10;
      ws.getColumn("I").width = 10;
    };

    if (reportType === "efc_format") {
      // 1. Master Data Sheet
      const masterSheet = workbook.addWorksheet("Master Data");
      createEfcSheet(masterSheet, sortedData);

      // 2. Individual Block Sheets safely (case-insensitive deduplication)
      const usedSheetNames = new Set<string>(["master data"]);

      const uniqueBlocks = Array.from(
        new Set(sortedData.map((d) => d.blok)),
      ).sort((a, b) => {
        const strA = String(a || "");
        const strB = String(b || "");
        const numA = parseInt(strA);
        const numB = parseInt(strB);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return strA.localeCompare(strB);
      });

      uniqueBlocks.forEach((blok) => {
        const blokData = sortedData.filter((d) => d.blok === blok);
        if (blokData.length > 0) {
          const rawName = blok ? `Blok ${blok}` : "Blok";
          let cleanName = rawName.replace(/[:\\/?*\[\]]/g, "").trim().slice(0, 31);
          if (!cleanName) cleanName = "Blok";
          let finalName = cleanName;
          let counter = 1;
          while (usedSheetNames.has(finalName.toLowerCase())) {
            finalName = `${cleanName.slice(0, 27)}_${counter}`.slice(0, 31);
            counter++;
          }
          usedSheetNames.add(finalName.toLowerCase());
          const blokSheet = workbook.addWorksheet(finalName);
          createEfcSheet(blokSheet, blokData);
        }
      });
    } else if (reportType === "kpa_kpg") {
      const worksheet = workbook.addWorksheet("Rekod Hantaran");
      worksheet.views = [{ showGridLines: true }];
      // --- SPECIAL KPG=KPA REPORT FORMAT ---
      const monthNames = [
        "JANUARI",
        "FEBRUARI",
        "MAC",
        "APRIL",
        "MEI",
        "JUN",
        "JULAI",
        "OGOS",
        "SEPTEMBER",
        "OKTOBER",
        "NOVEMBER",
        "DISEMBER",
      ];
      const currentMonth =
        exportFilter === "month"
          ? monthNames[parseInt(exportMonth.split("-")[1]) - 1]
          : monthNames[new Date().getMonth()];
      const currentYear =
        exportFilter === "month"
          ? exportMonth.split("-")[0]
          : new Date().getFullYear();

      // Filter data for KPG >= 21
      const kpgData = sortedData.filter(
        (item) => parseFloat(item.kpg || "0") >= 21,
      );

      // Split into Standard and Felda
      const isTunggal = sampleEstateId === "FPM_TUNGGAL";
      const estateConfig = getEstateConfig(sampleEstateId);
      const standardData = kpgData.filter((item) => {
        const pkt = estateConfig?.blocks?.[item.blok]?.pkt || (isTunggal ? (MASTER_DATA as any)[item.blok]?.pkt : "001") || "001";
        return pkt !== "003";
      });
      const feldaData = kpgData.filter((item) => {
        const pkt = estateConfig?.blocks?.[item.blok]?.pkt || (isTunggal ? (MASTER_DATA as any)[item.blok]?.pkt : "001") || "001";
        return pkt === "003";
      });

      const renderKpgTable = (
        data: Transaction[],
        title: string,
        startRow: number,
      ) => {
        if (!data || !Array.isArray(data)) return startRow;
        // Title
        worksheet.mergeCells(`A${startRow}:L${startRow}`);
        const t1 = worksheet.getCell(`A${startRow}`);
        t1.value = "KPA = KPG";
        t1.font = { bold: true, size: 12, color: { argb: theme.rowFg } };
        t1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: theme.blankFill } };
        t1.alignment = { horizontal: "center" };

        worksheet.mergeCells(`A${startRow + 1}:L${startRow + 1}`);
        const t2 = worksheet.getCell(`A${startRow + 1}`);
        t2.value = `${title} ${currentMonth} ${currentYear}`;
        t2.font = { bold: true, size: 12, color: { argb: theme.rowFg } };
        t2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: theme.blankFill } };
        t2.alignment = { horizontal: "center" };

        // Headers
        const headerRowIndex = startRow + 3;
        const headers = [
          "Bil",
          "Tarikh",
          "Blok",
          "No. Akuan Terima",
          "Nota Hantaran",
          "Berat Bersih (Tan)",
          "RM / MT",
          "CAPAI (RM)",
          "Tandan Muda",
          "Reject",
          "Sample",
          "KPG",
        ];
        const headerRow = worksheet.getRow(headerRowIndex);
        headerRow.values = headers;
        headerRow.height = 30;

        headerRow.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: theme.headerBg },
          };
          cell.font = { bold: true, size: 10, color: { argb: theme.headerFg } };
          cell.alignment = {
            horizontal: "center",
            vertical: "middle",
            wrapText: true,
          };
          cell.border = {
            top: { style: "thin", color: { argb: theme.headerBorder } },
            left: { style: "thin", color: { argb: theme.headerBorder } },
            bottom: { style: "thin", color: { argb: theme.headerBorder } },
            right: { style: "thin", color: { argb: theme.headerBorder } },
          };
        });

        // Data
        let currentRow = headerRowIndex + 1;
        data.forEach((item, idx) => {
          const row = worksheet.getRow(currentRow);
          row.values = [
            idx + 1,
            item.tarikh.split("-").reverse().join("."),
            item.blok,
            item.no_akaun_terima || "-",
            item.no_resit,
            item.tan,
            item.rm_mt || 0,
            item.hasil_rm || item.tan * (item.rm_mt || 0),
            item.muda,
            item.reject || 0,
            item.sample || 0,
            item.kpg || "-",
          ];
          const rowBg = idx % 2 !== 0 ? theme.rowBgOdd : theme.rowBgEven;
          row.eachCell((cell) => {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: rowBg },
            };
            cell.alignment = { horizontal: "center", vertical: "middle" };
            cell.border = {
              top: { style: "thin", color: { argb: theme.rowBorder } },
              left: { style: "thin", color: { argb: theme.rowBorder } },
              bottom: { style: "thin", color: { argb: theme.rowBorder } },
              right: { style: "thin", color: { argb: theme.rowBorder } },
            };
            cell.font = { size: 9, color: { argb: theme.rowFg } };
          });
          row.getCell(6).numFmt = "#,##0.00";
          row.getCell(7).numFmt = "#,##0.00";
          row.getCell(8).numFmt = "#,##0.00";
          currentRow++;
        });

        // Totals
        const totalRow = worksheet.getRow(currentRow);
        const totalTan = data.reduce((sum, item) => sum + item.tan, 0);
        const totalHasil = data.reduce(
          (sum, item) =>
            sum + (item.hasil_rm || item.tan * (item.rm_mt || 0)),
          0,
        );
        const totalMuda = data.reduce((sum, item) => sum + item.muda, 0);
        const totalReject = data.reduce(
          (sum, item) => sum + (item.reject || 0),
          0,
        );
        const avgRmMt =
          data.length > 0
            ? data.reduce((sum, item) => sum + (item.rm_mt || 0), 0) /
              data.length
            : 0;
        const avgKpg =
          data.length > 0
            ? data.reduce(
                (sum, item) => sum + parseFloat(item.kpg || "0"),
                0,
              ) / data.length
            : 0;

        totalRow.getCell(1).value = `JUMLAH (${data.length} NO. RESIT)`;
        worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
        totalRow.getCell(6).value = totalTan;
        totalRow.getCell(7).value = avgRmMt;
        totalRow.getCell(8).value = totalHasil;
        totalRow.getCell(9).value = totalMuda;
        totalRow.getCell(10).value = totalReject;
        totalRow.getCell(12).value = avgKpg;

        totalRow.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: theme.summaryBg },
          };
          cell.font = { bold: true, size: 10, color: { argb: theme.summaryFg } };
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.border = {
            top: { style: "medium", color: { argb: theme.summaryBorder } },
            left: { style: "thin", color: { argb: theme.summaryBorder } },
            bottom: { style: "medium", color: { argb: theme.summaryBorder } },
            right: { style: "thin", color: { argb: theme.summaryBorder } },
          };
        });
        totalRow.getCell(6).numFmt = "#,##0.00";
        totalRow.getCell(7).numFmt = "#,##0.00";
        totalRow.getCell(8).numFmt = "#,##0.00";
        totalRow.getCell(12).numFmt = "#,##0.00";

        return currentRow + 3; // Return next start row
      };

      let nextRow = 1;
      nextRow = renderKpgTable(standardData, `${estateDisplayTitle} BULAN`, nextRow);
      renderKpgTable(feldaData, "KPA-KPG LOT FELDA", nextRow);

      // --- ADD SUMMARY SHEET BY BLOK ---
      const summarySheet = workbook.addWorksheet("Ringkasan KPG=KPA", {
        views: [{ state: "frozen", ySplit: 3, showGridLines: true }],
      });

      // Title
      summarySheet.mergeCells("A1:F1");
      const t1 = summarySheet.getCell("A1");
      t1.value = "RINGKASAN KPG=KPA MENGIKUT BLOK";
      t1.font = { bold: true, size: 14, color: { argb: theme.titleFg } };
      t1.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: theme.titleBg },
      };
      t1.alignment = { horizontal: "center", vertical: "middle" };
      summarySheet.getRow(1).height = 40;

      // Headers
      const headerRow = summarySheet.getRow(3);
      headerRow.values = [
        "BIL",
        "BLOK",
        "PERINGKAT",
        "JUMLAH RESIT",
        "KPG MATCH (>=21)",
        "PERATUS (%)",
      ];
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: theme.headerFg } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: theme.headerBg },
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin", color: { argb: theme.headerBorder } },
          left: { style: "thin", color: { argb: theme.headerBorder } },
          bottom: { style: "thin", color: { argb: theme.headerBorder } },
          right: { style: "thin", color: { argb: theme.headerBorder } },
        };
      });
      headerRow.height = 25;

      // Calculate data
      const blockSummary: {
        blok: string;
        pkt: string;
        totalResit: number;
        kpgMatch: number;
      }[] = [];
      const uniqueBlocks = (
        Array.from(new Set(sortedData.map((d) => d.blok))) as string[]
      ).sort((a, b) => {
        const numA = parseInt(a);
        const numB = parseInt(b);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b);
      });

      uniqueBlocks.forEach((blok: string) => {
        const blokData = sortedData.filter((d) => d.blok === blok);
        const kpgMatch = blokData.filter(
          (item) => parseFloat(item.kpg || "0") >= 21,
        ).length;
        const pkt = estateConfig?.blocks?.[blok]?.pkt || (isTunggal ? (MASTER_DATA as any)[blok]?.pkt : "-") || "-";
        blockSummary.push({
          blok,
          pkt,
          totalResit: blokData.length,
          kpgMatch,
        });
      });

      // Add rows
      blockSummary.forEach((item, idx) => {
        const percentage =
          item.totalResit > 0 ? (item.kpgMatch / item.totalResit) * 100 : 0;
        const row = summarySheet.addRow([
          idx + 1,
          `Blok ${item.blok}`,
          item.pkt === "001"
            ? "PKT 1"
            : item.pkt === "002"
              ? "PKT 2"
              : "LOT FELDA",
          item.totalResit,
          item.kpgMatch,
          parseFloat(percentage.toFixed(1)),
        ]);
        const rowBg = idx % 2 !== 0 ? theme.rowBgOdd : theme.rowBgEven;
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: rowBg },
          };
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.border = {
            top: { style: "thin", color: { argb: theme.rowBorder } },
            left: { style: "thin", color: { argb: theme.rowBorder } },
            bottom: { style: "thin", color: { argb: theme.rowBorder } },
            right: { style: "thin", color: { argb: theme.rowBorder } },
          };
          cell.font = { size: 10, color: { argb: theme.rowFg } };
        });
      });

      // Summary row
      const totalRow = summarySheet.addRow([
        "",
        "JUMLAH KESELURUHAN",
        "",
        blockSummary.reduce((sum, item) => sum + item.totalResit, 0),
        blockSummary.reduce((sum, item) => sum + item.kpgMatch, 0),
        "",
      ]);
      const totalResits = blockSummary.reduce(
        (sum, item) => sum + item.totalResit,
        0,
      );
      const totalMatches = blockSummary.reduce(
        (sum, item) => sum + item.kpgMatch,
        0,
      );
      totalRow.getCell(6).value =
        totalResits > 0
          ? parseFloat(((totalMatches / totalResits) * 100).toFixed(1))
          : 0;

      summarySheet.mergeCells(`B${totalRow.number}:C${totalRow.number}`);
      totalRow.eachCell((cell) => {
        cell.font = { bold: true, size: 11, color: { argb: theme.accentFg } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: theme.accentBg },
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "medium", color: { argb: theme.accentFg } },
          left: { style: "thin", color: { argb: theme.accentFg } },
          bottom: { style: "medium", color: { argb: theme.accentFg } },
          right: { style: "thin", color: { argb: theme.accentFg } },
        };
      });
      totalRow.height = 30;

      summarySheet.getColumn(1).width = 8;
      summarySheet.getColumn(2).width = 15;
      summarySheet.getColumn(3).width = 20;
      summarySheet.getColumn(4).width = 15;
      summarySheet.getColumn(5).width = 20;
      summarySheet.getColumn(6).width = 15;

      // Set column widths for main sheet
      worksheet.getColumn(1).width = 5;
      worksheet.getColumn(2).width = 12;
      worksheet.getColumn(3).width = 8;
      worksheet.getColumn(4).width = 15;
      worksheet.getColumn(5).width = 15;
      worksheet.getColumn(6).width = 15;
      worksheet.getColumn(7).width = 12;
      worksheet.getColumn(8).width = 15;
      worksheet.getColumn(9).width = 12;
      worksheet.getColumn(10).width = 10;
      worksheet.getColumn(11).width = 10;
      worksheet.getColumn(12).width = 8;
    } else if (reportType === "efb") {
      const worksheet = workbook.addWorksheet("Rekod EFB");
      const efbData = sortedData.filter((item) => item.peringkat === "EFB");
      createStandardSheet(
        worksheet,
        efbData,
        "LAPORAN PENGHANTARAN EFB (TANDAN KOSONG)",
      );
    } else {
      // Standard report sheets
      const worksheet = workbook.addWorksheet("Rekod Hantaran");
      const displayTitle =
        reportType === "hasil"
          ? "LAPORAN :  HANTARAN HASIL HARIAN"
          : reportType === "muda"
            ? "LAPORAN ANALITIK: BTS MUDA (TANDAN MUDA)"
            : `LAPORAN ANALITIK: ${reportType.toUpperCase()}`;

      createStandardSheet(worksheet, sortedData, displayTitle, true);

      // If it's 'hasil', also create individual block sheets
      if (reportType === "hasil") {
        const uniqueBlocks = Array.from(
          new Set(sortedData.map((d) => d.blok)),
        ).sort((a, b) => {
          const numA = parseInt(String(a));
          const numB = parseInt(String(b));
          if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
          return String(a).localeCompare(String(b));
        });

        uniqueBlocks.forEach((blok) => {
          const blokData = sortedData.filter((d) => d.blok === blok);
          if (blokData.length > 0) {
            const blokSheet = workbook.addWorksheet(`Blok ${blok}`);
            createStandardSheet(
              blokSheet,
              blokData,
              `REKOD HANTARAN BLOK ${blok}`,
            );
          }
        });
      }
    }

    if (reportType === "muda") {
      // Sheet 1: Bts Muda Bulan Ini by Blok by Date
      const currentMonthSheet = workbook.addWorksheet("Bts Muda Bulan Ini", {
        views: [{ state: "frozen", ySplit: 3, xSplit: 1, showGridLines: true }],
      });

      // Title
      currentMonthSheet.mergeCells("A1:E1");
      const t1 = currentMonthSheet.getCell("A1");
      t1.value = `BTS MUDA MENGIKUT BLOK & TARIKH (${exportMonth || new Date().toISOString().slice(0, 7)})`;
      t1.font = { bold: true, size: 14, color: { argb: theme.titleFg } };
      t1.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: theme.titleBg },
      };
      t1.alignment = { horizontal: "center", vertical: "middle" };
      currentMonthSheet.getRow(1).height = 35;

      // Use sortedData which is already filtered strictly by date/month/range and BTS
      const monthData = sortedData;
      const uniqueDates = Array.from(
        new Set(monthData.map((d) => d.tarikh)),
      ).sort() as string[];
      const uniqueBlocks = Array.from(
        new Set(monthData.map((d) => d.blok)),
      ).sort(
        (a, b) => parseInt(a as string) - parseInt(b as string),
      ) as string[];

      // Headers for Sheet 1
      const headerRow1 = currentMonthSheet.getRow(3);
      const headers1 = ["BLOK", ...uniqueDates, "JUMLAH"];
      headerRow1.values = headers1 as any[];
      headerRow1.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: theme.headerFg }, size: 9 };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: theme.headerBg },
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin", color: { argb: theme.headerBorder } },
          left: { style: "thin", color: { argb: theme.headerBorder } },
          bottom: { style: "thin", color: { argb: theme.headerBorder } },
          right: { style: "thin", color: { argb: theme.headerBorder } },
        };
      });

      // Add Data for Sheet 1
      uniqueBlocks.forEach((blok, bIdx) => {
        const rowValues: (string | number)[] = [blok as string];
        let blockTotal = 0;
        uniqueDates.forEach((date) => {
          const val = monthData
            .filter((d) => d.blok === blok && d.tarikh === date)
            .reduce((sum, curr) => sum + (curr.muda || 0), 0);
          rowValues.push(val || 0);
          blockTotal += val;
        });
        rowValues.push(blockTotal);
        const row = currentMonthSheet.addRow(rowValues);
        const rowBg = bIdx % 2 !== 0 ? theme.rowBgOdd : theme.rowBgEven;
        row.eachCell((cell, colIdx) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: rowBg },
          };
          cell.alignment = { horizontal: "center" };
          cell.border = {
            top: { style: "thin", color: { argb: theme.rowBorder } },
            left: { style: "thin", color: { argb: theme.rowBorder } },
            bottom: { style: "thin", color: { argb: theme.rowBorder } },
            right: { style: "thin", color: { argb: theme.rowBorder } },
          };
          cell.font = {
            size: 10,
            bold: colIdx === headers1.length,
            color: { argb: theme.rowFg },
          };
        });
      });

      // Add Total Row for Sheet 1
      const totalRow1Values: (string | number)[] = ["JUMLAH"];
      let grandTotal1 = 0;
      uniqueDates.forEach((date) => {
        const dayTotal = monthData
          .filter((d) => d.tarikh === date)
          .reduce((sum, curr) => sum + (curr.muda || 0), 0);
        totalRow1Values.push(dayTotal);
        grandTotal1 += dayTotal;
      });
      totalRow1Values.push(grandTotal1);
      const totalRow1 = currentMonthSheet.addRow(totalRow1Values);
      totalRow1.eachCell((cell) => {
        cell.font = { bold: true, size: 10, color: { argb: theme.summaryFg } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: theme.summaryBg },
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "medium", color: { argb: theme.summaryBorder } },
          left: { style: "thin", color: { argb: theme.summaryBorder } },
          bottom: { style: "medium", color: { argb: theme.summaryBorder } },
          right: { style: "thin", color: { argb: theme.summaryBorder } },
        };
      });

      // Sheet 2: Bts Muda Hingga Bulan Ini by Blok by Month
      const ytdSheet = workbook.addWorksheet("Bts Muda YTD", {
        views: [{ state: "frozen", ySplit: 3, xSplit: 1, showGridLines: true }],
      });

      // Title
      ytdSheet.mergeCells("A1:E1");
      const t2 = ytdSheet.getCell("A1");
      t2.value = `BTS MUDA MENGIKUT BLOK & BULAN (YTD ${new Date().getFullYear()})`;
      t2.font = { bold: true, size: 14, color: { argb: theme.titleFg } };
      t2.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: theme.titleBg },
      };
      t2.alignment = { horizontal: "center", vertical: "middle" };
      ytdSheet.getRow(1).height = 35;

      // Get unique months for the current year
      const currentYear = new Date().getFullYear().toString();
      const yearData = rawData
        .filter((item) => item.peringkat !== "EFB")
        .filter((item) => {
          if (item.tarikh && item.tarikh.startsWith(currentYear)) return true;
          if (item.created_at) {
            const createdDate = new Date(
              new Date(item.created_at).getTime() + 8 * 60 * 60 * 1000,
            )
              .toISOString()
              .split("T")[0];
            return createdDate.startsWith(currentYear);
          }
          return false;
        });

      const getMonthStr = (item: Transaction) => {
        if (item.tarikh) return item.tarikh.slice(0, 7);
        if (item.created_at) {
          return new Date(
            new Date(item.created_at).getTime() + 8 * 60 * 60 * 1000,
          )
            .toISOString()
            .slice(0, 7);
        }
        return "";
      };

      const uniqueMonths = Array.from(
        new Set(yearData.map((d) => getMonthStr(d))),
      )
        .filter((m) => (m as string).startsWith(currentYear))
        .sort() as string[];
      const uniqueBlocksYear = Array.from(
        new Set(yearData.map((d) => d.blok)),
      ).sort(
        (a, b) => parseInt(a as string) - parseInt(b as string),
      ) as string[];

      // Headers for Sheet 2
      const headerRow2 = ytdSheet.getRow(3);
      const headers2 = [
        "BLOK",
        ...uniqueMonths.map((m) => {
          const date = new Date(m + "-01");
          return date
            .toLocaleString("ms-MY", { month: "short" })
            .toUpperCase();
        }),
        "JUMLAH",
      ];
      headerRow2.values = headers2 as any[];
      headerRow2.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: theme.headerFg }, size: 9 };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: theme.headerBg },
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin", color: { argb: theme.headerBorder } },
          left: { style: "thin", color: { argb: theme.headerBorder } },
          bottom: { style: "thin", color: { argb: theme.headerBorder } },
          right: { style: "thin", color: { argb: theme.headerBorder } },
        };
      });

      // Add Data for Sheet 2
      uniqueBlocksYear.forEach((blok, yIdx) => {
        const rowValues: (string | number)[] = [blok as string];
        let blockTotal = 0;
        uniqueMonths.forEach((month) => {
          const val = yearData
            .filter((d) => d.blok === blok && getMonthStr(d) === month)
            .reduce((sum, curr) => sum + (curr.muda || 0), 0);
          rowValues.push(val || 0);
          blockTotal += val;
        });
        rowValues.push(blockTotal);
        const row = ytdSheet.addRow(rowValues);
        const rowBg = yIdx % 2 !== 0 ? theme.rowBgOdd : theme.rowBgEven;
        row.eachCell((cell, colIdx) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: rowBg },
          };
          cell.alignment = { horizontal: "center" };
          cell.border = {
            top: { style: "thin", color: { argb: theme.rowBorder } },
            left: { style: "thin", color: { argb: theme.rowBorder } },
            bottom: { style: "thin", color: { argb: theme.rowBorder } },
            right: { style: "thin", color: { argb: theme.rowBorder } },
          };
          cell.font = {
            size: 10,
            bold: colIdx === headers2.length,
            color: { argb: theme.rowFg },
          };
        });
      });

      // Add Total Row for Sheet 2
      const totalRow2Values: (string | number)[] = ["JUMLAH"];
      let grandTotal2 = 0;
      uniqueMonths.forEach((month) => {
        const monthTotal = yearData
          .filter((d) => getMonthStr(d) === month)
          .reduce((sum, curr) => sum + (curr.muda || 0), 0);
        totalRow2Values.push(monthTotal);
        grandTotal2 += monthTotal;
      });
      totalRow2Values.push(grandTotal2);
      const totalRow2 = ytdSheet.addRow(totalRow2Values);
      totalRow2.eachCell((cell) => {
        cell.font = { bold: true, size: 10, color: { argb: theme.summaryFg } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: theme.summaryBg },
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "medium", color: { argb: theme.summaryBorder } },
          left: { style: "thin", color: { argb: theme.summaryBorder } },
          bottom: { style: "medium", color: { argb: theme.summaryBorder } },
          right: { style: "thin", color: { argb: theme.summaryBorder } },
        };
      });

      // Auto-width columns for both sheets
      [currentMonthSheet, ytdSheet].forEach((s) => {
        s.columns.forEach((column) => {
          column.width = 12;
        });
        s.getColumn(1).width = 12;
      });

      // --- NEW SHEET: SENARAI MUDA >= 6 ---
      const alertMudaSheet = workbook.addWorksheet("Alert Muda >= 6", {
        views: [{ state: "frozen", ySplit: 3, showGridLines: true }],
      });

      // Title
      alertMudaSheet.mergeCells("A1:G1");
      const tAlert = alertMudaSheet.getCell("A1");
      tAlert.value = "SENARAI RESIT / LORI (BTS MUDA >= 6)";
      tAlert.font = { bold: true, size: 14, color: { argb: theme.alertHeaderFg } };
      tAlert.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: theme.alertHeaderBg },
      };
      tAlert.alignment = { horizontal: "center", vertical: "middle" };
      alertMudaSheet.getRow(1).height = 35;

      // Headers
      const headerAlert = alertMudaSheet.getRow(3);
      headerAlert.values = [
        "BIL",
        "TARIKH",
        "NO. LORI",
        "NO. RESIT",
        "BLOK",
        "TAN",
        "BTS MUDA",
      ];
      headerAlert.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: theme.isDark ? "FF334155" : "FF475569" },
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin", color: { argb: theme.headerBorder } },
          left: { style: "thin", color: { argb: theme.headerBorder } },
          bottom: { style: "thin", color: { argb: theme.headerBorder } },
          right: { style: "thin", color: { argb: theme.headerBorder } },
        };
      });
      headerAlert.height = 25;

      // Filter data for Muda >= 6
      const alertData = monthData
        .filter((d) => (d.muda || 0) >= 6)
        .sort((a, b) => (b.muda || 0) - (a.muda || 0));

      // Add rows
      alertData.forEach((item, idx) => {
        const row = alertMudaSheet.addRow([
          idx + 1,
          item.tarikh.split("-").reverse().join("."),
          item.no_lori,
          item.no_resit,
          item.blok,
          item.tan,
          item.muda,
        ]);
        const rowBg = idx % 2 !== 0 ? theme.rowBgOdd : theme.rowBgEven;
        row.eachCell((cell, colIdx) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: rowBg },
          };
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.border = {
            top: { style: "thin", color: { argb: theme.rowBorder } },
            left: { style: "thin", color: { argb: theme.rowBorder } },
            bottom: { style: "thin", color: { argb: theme.rowBorder } },
            right: { style: "thin", color: { argb: theme.rowBorder } },
          };
          cell.font = {
            size: 10,
            bold: colIdx === 7,
            color: { argb: colIdx === 7 ? theme.alertFg : theme.rowFg },
          };
        });
      });

      // Column Widths
      alertMudaSheet.getColumn(1).width = 8;
      alertMudaSheet.getColumn(2).width = 15;
      alertMudaSheet.getColumn(3).width = 15;
      alertMudaSheet.getColumn(4).width = 15;
      alertMudaSheet.getColumn(5).width = 10;
      alertMudaSheet.getColumn(6).width = 12;
      alertMudaSheet.getColumn(7).width = 12;
    }

    // --- ADD CHARTS SHEET ---
    if (reportType !== "efc_format") {
      const chartSheet = workbook.addWorksheet("Visual Analitik", {
        views: [{ showGridLines: true }],
      });

      // Title
      chartSheet.mergeCells("A1:L1");
      const tCell = chartSheet.getCell("A1");
      tCell.value = "LAPORAN VISUAL & ANALITIK GRAFIK";
      tCell.font = { bold: true, size: 18, color: { argb: theme.titleFg } };
      tCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: theme.titleBg },
      };
      tCell.alignment = { horizontal: "center", vertical: "middle" };
      chartSheet.getRow(1).height = 50;

      let currentImageRow = 3;

      const wait = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));

      const addChartToSheet = async (
        ref: React.RefObject<HTMLDivElement | null>,
        title: string,
      ) => {
        if (!ref.current) {
          console.warn(`Ref for ${title} is null`);
          return;
        }

        const dashboardContainer = document.getElementById(
          "dashboard-tab-container",
        );
        const containerWasHidden =
          dashboardContainer &&
          dashboardContainer.classList.contains("hidden");

        // Temporarily ensure the chart and its container are visible for capture
        const originalStyle = ref.current.style.display;
        const isHidden =
          ref.current.offsetParent === null || containerWasHidden;

        if (containerWasHidden && dashboardContainer) {
          dashboardContainer.classList.remove("hidden");
          dashboardContainer.style.position = "absolute";
          dashboardContainer.style.left = "-9999px";
          dashboardContainer.style.top = "-9999px";
          dashboardContainer.style.display = "block";
        }

        if (isHidden) {
          ref.current.style.display = "block";
          // Wait for the chart to re-render/resize in its new visible state
          await wait(1000);
        }

        try {
          const base64Image = await domToImage.toPng(ref.current, {
            bgcolor: isDarkMode ? "#0F172A" : "#FFFFFF",
          });

          if (containerWasHidden && dashboardContainer) {
            dashboardContainer.classList.add("hidden");
            dashboardContainer.style.position = "";
            dashboardContainer.style.left = "";
            dashboardContainer.style.top = "";
            dashboardContainer.style.display = "";
          }

          if (isHidden) {
            ref.current.style.display = originalStyle;
          }

          const imageId = workbook.addImage({
            base64: base64Image,
            extension: "png",
          });

          // Add Title for the chart
          chartSheet.mergeCells(`A${currentImageRow}:L${currentImageRow}`);
          const titleCell = chartSheet.getCell(`A${currentImageRow}`);
          titleCell.value = `> ${title}`;
          titleCell.font = {
            bold: true,
            size: 12,
            color: { argb: theme.isDark ? "FF34D399" : "FF059669" },
          };
          titleCell.alignment = { horizontal: "left" };
          chartSheet.getRow(currentImageRow).height = 25;

          // Add the image (tl is 0-indexed)
          chartSheet.addImage(imageId, {
            tl: { col: 0, row: currentImageRow },
            ext: { width: 900, height: 450 },
          });

          currentImageRow += 25; // Move down for next chart
        } catch (err) {
          console.error(`Error adding ${title} to excel:`, err);
        }
      };

      if (monthlyTrendRef.current) {
        await addChartToSheet(
          monthlyTrendRef,
          `TREND BULANAN (${reportType.toUpperCase()})`,
        );
      }

      if (thekChartRef.current) {
        await addChartToSheet(
          thekChartRef,
          `PRESTASI ANALITIK - THEK (${chartPeriod.toUpperCase()})`,
        );
      }
    }

    // Finalize and Save
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    let fileName = `${estateFilePrefix}_Rekod_Hantaran_${new Date().toISOString().split("T")[0]}.xlsx`;
    if (reportType === "kpa_kpg") {
      fileName = `${estateFilePrefix}_KPG_KPA_Report_${new Date().toISOString().split("T")[0]}.xlsx`;
    } else if (reportType === "efc_format") {
      fileName = `${estateFilePrefix}_EFC_Format_${new Date().toISOString().split("T")[0]}.xlsx`;
    }
    if (exportFilter === "date")
      fileName = fileName.replace(".xlsx", `_Tarikh_${exportDate}.xlsx`);
    else if (exportFilter === "range")
      fileName = fileName.replace(".xlsx", `_Julat_${exportStartDate || exportDate}_ke_${exportEndDate || exportDate}.xlsx`);
    else if (exportFilter === "month")
      fileName = fileName.replace(".xlsx", `_Bulan_${exportMonth}.xlsx`);

    saveAs(blob, fileName);
    showToast("success", `Fail Excel berjaya dimuat turun (Tema ${isDarkMode ? "Gelap / Dark Mode" : "Cerah / Light Mode"}).`);
    setShowExportModal(false);
  } catch (error) {
    console.error("Excel Export Error:", error);
    showToast("error", "Gagal memuat turun Excel. Sila cuba lagi.");
  } finally {
    setIsExporting(false);
  }
}
