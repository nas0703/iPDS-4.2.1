import { Transaction, ReportType } from "../../../types";

export interface PPTXExportParams {
  rawData: Transaction[];
  exportFilter: "all" | "date" | "month" | "range";
  exportDate: string;
  exportStartDate?: string;
  exportEndDate?: string;
  exportMonth: string;
  exportColumns: string[];
  reportType: ReportType;
  analytics: any;
  showToast: (type: "success" | "error", msg: string) => void;
  setIsExporting: (exporting: boolean) => void;
}

// Helper to normalize any date string to standard YYYY-MM-DD
function normalizeDateStr(d?: string | null): string {
  if (!d) return "";
  const s = String(d).trim().split(/[T ]/)[0];
  const ymd = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;
  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  return s;
}

function getItemOperationalDate(item: Transaction): string {
  if (item.tarikh) {
    const norm = normalizeDateStr(item.tarikh);
    if (norm) return norm;
  }
  if (item.created_at) {
    return new Date(new Date(item.created_at).getTime() + 8 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
  }
  return "";
}

export async function exportToPPTX({
  rawData,
  exportFilter,
  exportDate,
  exportStartDate,
  exportEndDate,
  exportMonth,
  exportColumns,
  reportType,
  analytics,
  showToast,
  setIsExporting,
}: PPTXExportParams): Promise<void> {
  let filteredData = rawData;

  if (exportFilter === "date") {
    const targetDate = normalizeDateStr(exportDate);
    filteredData = rawData.filter((item) => {
      const itemDate = getItemOperationalDate(item);
      return itemDate === targetDate;
    });
  } else if (exportFilter === "range") {
    const start = normalizeDateStr(exportStartDate || exportDate);
    const end = normalizeDateStr(exportEndDate || exportDate);
    filteredData = rawData.filter((item) => {
      const itemDate = getItemOperationalDate(item);
      if (!itemDate) return false;
      if (start && end) return itemDate >= start && itemDate <= end;
      if (start) return itemDate >= start;
      if (end) return itemDate <= end;
      return true;
    });
  } else if (exportFilter === "month") {
    const targetMonth = (exportMonth || "").slice(0, 7);
    filteredData = rawData.filter((item) => {
      const itemDate = getItemOperationalDate(item);
      return itemDate.startsWith(targetMonth);
    });
  }

  if ((filteredData?.length || 0) === 0) {
    showToast("error", "Tiada data untuk dieksport pada tarikh/bulan ini.");
    return;
  }

  const periodLabel =
    exportFilter === "all"
      ? "Semua Rekod"
      : exportFilter === "month"
        ? exportMonth
        : exportDate;
  const summaryData = analytics?.month || {
    pkt1_tan: 0,
    pkt2_tan: 0,
    felda_tan: 0,
    totalTan: 0,
    pkt1_muda: 0,
    pkt2_muda: 0,
    felda_muda: 0,
    totalMuda: 0,
    pkt1_kpg_match: 0,
    pkt2_kpg_match: 0,
    felda_kpg_match: 0,
    kpgMatchCount: 0,
  };

  const allPossibleCols = [
    { id: "blok", label: "Blok" },
    { id: "peringkat", label: "Peringkat" },
    { id: "tan", label: "CAPAI (Tan)" },
    { id: "thek", label: "Yield (T/H)" },
    { id: "muda", label: "Muda" },
  ];

  const activeCols = allPossibleCols.filter((c) =>
    exportColumns.includes(c.id),
  );
  if (activeCols.length === 0) activeCols.push(allPossibleCols[0]);

  const topBlocks = (analytics?.month?.rankedBlok || []).slice(0, 10);
  const tableRows = topBlocks.map((b: any) => {
    const row: any[] = [];
    activeCols.forEach((c) => {
      if (c.id === "blok") row.push(b.blok);
      else if (c.id === "peringkat")
        row.push(
          b.pkt === "001" ? "PKT 1" : b.pkt === "002" ? "PKT 2" : "LOT FELDA",
        );
      else if (c.id === "tan") row.push(b.tan.toFixed(1));
      else if (c.id === "thek") row.push(b.yieldHek.toFixed(2));
      else if (c.id === "muda") row.push(b.muda.toString());
    });
    return row;
  });

  const exportPayload = {
    reportTitle: `Laporan Analitik: ${reportType.toUpperCase()}`,
    generatedAt: new Date().toLocaleString(),
    filters: {
      type: reportType,
      period: periodLabel,
      columns: exportColumns,
    },
    summaryCards: [
      {
        label: "Total Tan",
        value: (summaryData.totalTan || 0).toFixed(1),
        subValue: "Keseluruhan",
      },
      {
        label: "Muda (Tandan)",
        value: (summaryData.totalMuda || 0).toString(),
        subValue: "Keseluruhan",
      },
      {
        label: "KPG=KPA (Resit)",
        value: (summaryData.kpgMatchCount || 0).toString(),
        subValue: "Keseluruhan",
      },
    ],
    charts: [
      {
        title: `Trend CAPAI Bulanan (${new Date().getFullYear()})`,
        type: "bar",
        data: (analytics?.monthlyTrend || []).map((d: any) => ({
          name: d.month,
          values: [d.yield],
        })),
        options: { showValue: true, valAxisTitle: "T/H" },
      },
      {
        title: "Pecahan CAPAI Mengikut Peringkat",
        type: "pie",
        data: [
          { name: "PKT 1", values: [summaryData.pkt1_tan || 0] },
          { name: "PKT 2", values: [summaryData.pkt2_tan || 0] },
          { name: "FELDA", values: [summaryData.felda_tan || 0] },
        ],
        options: { showPercent: true, legendPos: "r" },
      },
    ],
    tables: [
      {
        title: "Prestasi Mengikut Blok (Top 10)",
        headers: activeCols.map((c) => c.label),
        rows: tableRows,
      },
    ],
    branding: {
      companyName: "FPMSB TUNGGAL",
      logoText: "Integrated Plantation Data System",
      primaryColor: "#064E3B",
    },
  };

  try {
    setIsExporting(true);
    const response = await fetch("/api/export/pptx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(exportPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gagal menjana PowerPoint: ${errorText}`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `FPMSB_Laporan_${periodLabel.replace(/-/g, "_")}.pptx`,
    );
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    }, 100);

    showToast("success", "PowerPoint berjaya dimuat turun.");
  } catch (error) {
    console.error("PPTX Export Error:", error);
    showToast(
      "error",
      `Gagal memuat turun PowerPoint: ${error instanceof Error ? error.message : "Sila cuba lagi"}`,
    );
  } finally {
    setIsExporting(false);
  }
}
