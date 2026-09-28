import { useState, useRef, useEffect } from "react";
import { Transaction } from "../types";
import { exportToExcel } from "../features/export/services/excelExportService";
import { exportToPPTX } from "../features/export/services/pptxExportService";
import {
  captureTableScreenshot,
  downloadPdf,
  shareBtsReport,
} from "../features/export/services/pdfExportService";
import {
  generateRCReport,
  executeWhatsAppShare,
} from "../features/export/services/rcReportService";

interface UseExportStateProps {
  rawData: Transaction[];
  reportType: any;
  chartPeriod: string;
  isDarkMode: boolean;
  analytics: any;
  showToast: (type: "success" | "error", msg: string) => void;
}

export function useExportState({
  rawData,
  reportType,
  chartPeriod,
  isDarkMode,
  analytics,
  showToast,
}: UseExportStateProps) {
  const [showExportModal, setShowExportModal] = useState(false);
  const [showRCReportModal, setShowRCReportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSharingBts, setIsSharingBts] = useState(false);

  // Dedicated export modal report type to prevent conflicts with global role enforcement
  const [exportReportType, setExportReportType] = useState<any>(reportType || "hasil");

  useEffect(() => {
    if (reportType && reportType !== "kualiti_bts") {
      setExportReportType(reportType);
    }
  }, [reportType]);

  const [sharePreviewData, setSharePreviewData] = useState<{
    file: File;
    url: string;
    name: string;
  } | null>(null);

  const [exportFilter, setExportFilter] = useState<"all" | "date" | "month" | "range">("all");
  const [exportDate, setExportDate] = useState(
    new Date(new Date().getTime() + 8 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [exportStartDate, setExportStartDate] = useState(
    new Date(new Date().getTime() + 8 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [exportEndDate, setExportEndDate] = useState(
    new Date(new Date().getTime() + 8 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [exportMonth, setExportMonth] = useState(
    new Date(new Date().getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 7)
  );

  const [exportColumns, setExportColumns] = useState<string[]>([
    "bil",
    "tarikh",
    "no_resit",
    "no_lori",
    "blok",
    "tan",
    "muda",
    "kpg",
    "thek",
    "kpa",
    "hasil_rm",
  ]);

  const monthlyTrendRef = useRef<HTMLDivElement>(null);
  const thekChartRef = useRef<HTMLDivElement>(null);
  const tableToCaptureRef = useRef<HTMLDivElement>(null);

  const handleExportToExcel = () => {
    exportToExcel({
      rawData,
      reportType: exportReportType,
      exportFilter,
      exportDate,
      exportStartDate,
      exportEndDate,
      exportMonth,
      exportColumns,
      chartPeriod: chartPeriod === "history" || chartPeriod === "monthly_trend" ? "month" : (chartPeriod as any),
      isDarkMode,
      monthlyTrendRef,
      thekChartRef,
      showToast,
      setIsExporting,
      setShowExportModal,
    });
  };

  const handleExportToPPTX = () => {
    exportToPPTX({
      rawData,
      exportFilter,
      exportDate,
      exportStartDate,
      exportEndDate,
      exportMonth,
      exportColumns,
      reportType: exportReportType,
      analytics,
      showToast,
      setIsExporting,
    });
  };

  const handleCaptureScreenshot = () => {
    captureTableScreenshot({
      isDarkMode,
      showToast,
      setIsCapturing,
      setSharePreviewData,
    });
  };

  const handleDownloadPdf = () => {
    downloadPdf({
      showToast,
      setIsDownloadingPdf,
    });
  };

  const handleShareBts = () => {
    shareBtsReport({
      isDarkMode,
      setIsSharingBts,
    });
  };

  const handleWhatsAppShare = () => {
    executeWhatsAppShare(analytics, showToast);
  };

  const handleCopyReport = () => {
    const report = generateRCReport(analytics);
    navigator.clipboard.writeText(report);
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(50);
    }
    showToast("success", "Laporan disalin ke papan klip.");
  };

  return {
    showExportModal,
    setShowExportModal,
    showRCReportModal,
    setShowRCReportModal,
    isExporting,
    setIsExporting,
    isDownloadingPdf,
    isCapturing,
    isSharingBts,
    sharePreviewData,
    setSharePreviewData,
    exportFilter,
    setExportFilter,
    exportDate,
    setExportDate,
    exportStartDate,
    setExportStartDate,
    exportEndDate,
    setExportEndDate,
    exportMonth,
    setExportMonth,
    exportColumns,
    setExportColumns,
    exportReportType,
    setExportReportType,
    monthlyTrendRef,
    thekChartRef,
    tableToCaptureRef,
    handleExportToExcel,
    handleExportToPPTX,
    handleCaptureScreenshot,
    handleDownloadPdf,
    handleShareBts,
    handleWhatsAppShare,
    handleCopyReport,
  };
}
