import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Leaf,
  Trophy,
  DownloadCloud,
  FileSpreadsheet,
  FileText as FileTextIcon,
  Camera,
  ScanLine,
  Search,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Calendar,
  RotateCcw,
  RotateCw,
  TrendingUp,
  TrendingDown,
  Target,
  BarChart3,
  Loader2,
  Share2,
  PieChart as PieChartIcon,
  X,
  ZoomIn,
  ZoomOut,
  MoveHorizontal,
  Printer,
  Download,
  Users,
  Maximize2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
  AreaChart,
  Area,
  ComposedChart,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import {
  MASTER_DATA,
  CHART_COLORS,
  TARGET_ANNUAL_PKT1,
  TARGET_ANNUAL_PKT2,
  TARGET_ANNUAL_FELDA,
  YIELD_DATA_2025,
  getHistoricalYieldData2025,
} from "../../../utils/constants";
import { getEstateConfig } from "../../../config/estateRegistry";
import { getActiveEstateId } from "../../../utils/estateContext";
import { Transaction } from "../../../types";
import { AnimatePresence, motion } from "motion/react";

const HasilBulananTableComponent = ({
  analytics,
  dashboardDate = new Date().toISOString().split("T")[0],
  setDashboardDate,
  isDarkMode,
  onScreenshot,
  isCapturing,
  onExcel,
  onDownloadPdf,
  isDownloadingPdf = false,
  onPrint,
}: {
  analytics: any;
  dashboardDate?: string;
  setDashboardDate?: (date: string) => void;
  isDarkMode: boolean;
  onScreenshot?: () => void;
  isCapturing?: boolean;
  onExcel?: () => void;
  onDownloadPdf?: () => void;
  isDownloadingPdf?: boolean;
  onPrint?: () => void;
}) => {
  const [zoom, setZoom] = useState(40);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [sortBy, setSortBy] = useState<"id" | "month" | "ytd" | "yoy">("id");
  const [fullscreenTab, setFullscreenTab] = useState<"blok" | "staff" | null>(null);
  const isFullscreen = fullscreenTab !== null;
  const [isLandscapeMode, setIsLandscapeMode] = useState(true);
  const [isRotated90, setIsRotated90] = useState(false);
  const [fitScale, setFitScale] = useState(1);
  const contentRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDownloadMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const renderScale = isCapturing || isDownloadingPdf ? 3 : 1;
  const effectiveScale = isCapturing || isDownloadingPdf ? 3 : renderScale;
  const effectiveZoom = isCapturing || isDownloadingPdf ? 45 : zoom;

  useEffect(() => {
    const checkFit = () => {
      if (isFullscreen && contentRef.current && tableRef.current) {
        const prevTransform = tableRef.current.style.transform;
        tableRef.current.style.transform = "none";

        const containerWidth = contentRef.current.clientWidth;
        const containerHeight = contentRef.current.clientHeight;
        const tableWidth = tableRef.current.offsetWidth;
        const tableHeight = tableRef.current.offsetHeight;

        // Add padding to calculation
        const px = 16;
        const py = 16;

        const scaleX = (containerWidth - px) / Math.max(1, tableWidth);
        const scaleY = (containerHeight - py) / Math.max(1, tableHeight);
        const newScale = Math.min(scaleX, scaleY);

        setFitScale(newScale);
        tableRef.current.style.transform = prevTransform;
      } else {
        setFitScale(1);
      }
    };

    checkFit();

    // Add small delay to ensure rendering completes before check
    const timeoutProcess = setTimeout(checkFit, 50);
    window.addEventListener("resize", checkFit);

    return () => {
      clearTimeout(timeoutProcess);
      window.removeEventListener("resize", checkFit);
    };
  }, [isFullscreen, zoom, analytics]);

  if (!analytics || !analytics.month || !analytics.year || !analytics.day)
    return null;

  // Use dashboardDate to accurately align with the subset of data being viewed
  const dashboardFallback =
    dashboardDate || new Date().toISOString().split("T")[0];
  const [dbYear, dbMonth, dbDay] = dashboardFallback.split("-");
  const now = new Date(
    parseInt(dbYear),
    parseInt(dbMonth) - 1,
    parseInt(dbDay),
  );

  const currentMonthIdx = now.getMonth();
  const currentDay = now.getDate();
  const daysInMonth = new Date(
    now.getFullYear(),
    currentMonthIdx + 1,
    0,
  ).getDate();
  const daysPassedYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) /
      (1000 * 60 * 60 * 24),
  );
  const totalDaysYear = 365;

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
  const currentMonthName = monthNames[currentMonthIdx];

  const monthOptions = [
    { value: "01", label: "Januari" },
    { value: "02", label: "Februari" },
    { value: "03", label: "Mac" },
    { value: "04", label: "April" },
    { value: "05", label: "Mei" },
    { value: "06", label: "Jun" },
    { value: "07", label: "Julai" },
    { value: "08", label: "Ogos" },
    { value: "09", label: "September" },
    { value: "10", label: "Oktober" },
    { value: "11", label: "November" },
    { value: "12", label: "Disember" },
  ];

  const handleSelectMonthYear = (newYear: string, newMonth: string) => {
    if (!setDashboardDate) return;
    const y = parseInt(newYear, 10);
    const m = parseInt(newMonth, 10);
    const nowReal = new Date();
    const isCurrentRealMonth =
      nowReal.getFullYear() === y && nowReal.getMonth() + 1 === m;

    if (isCurrentRealMonth) {
      const todayFormatted = nowReal.toISOString().split("T")[0];
      setDashboardDate(todayFormatted);
    } else {
      const lastDayObj = new Date(y, m, 0);
      const dayStr = String(lastDayObj.getDate()).padStart(2, "0");
      const monthStr = String(m).padStart(2, "0");
      setDashboardDate(`${y}-${monthStr}-${dayStr}`);
    }
  };

  const handlePrevMonth = () => {
    if (!setDashboardDate) return;
    let y = parseInt(dbYear, 10);
    let m = parseInt(dbMonth, 10) - 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    handleSelectMonthYear(String(y), String(m).padStart(2, "0"));
  };

  const handleNextMonth = () => {
    if (!setDashboardDate) return;
    let y = parseInt(dbYear, 10);
    let m = parseInt(dbMonth, 10) + 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    handleSelectMonthYear(String(y), String(m).padStart(2, "0"));
  };

  const handleExactDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value && setDashboardDate) {
      setDashboardDate(e.target.value);
    }
  };

  const dateStr = now.toLocaleDateString("ms-MY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const renderReportHeader = (title: string, subtitle?: string) => (
    <div className="flex flex-col items-center justify-center bg-[#042015] border border-emerald-800/80 rounded-xl p-2.5 sm:p-3 mb-3 text-center w-full select-text shadow-md">
      <h2 className="font-black text-white tracking-tight leading-snug uppercase text-xs sm:text-base md:text-lg w-full text-center">
        FELDA PLANTATION MANAGEMENT SDN BHD
      </h2>
      <h3 className="font-extrabold text-emerald-300 uppercase tracking-wide text-[10px] sm:text-xs md:text-sm mt-0.5 w-full text-center">
        {title}
      </h3>
      <div className="flex flex-wrap items-center justify-center gap-2 mt-1 w-full">
        {subtitle && (
          <p className="text-[9px] sm:text-[10px] text-slate-300 font-bold uppercase tracking-tight">
            {subtitle} —
          </p>
        )}
        <span className="bg-emerald-900/80 text-emerald-200 border border-emerald-700/60 px-2.5 py-0.5 rounded-md font-black uppercase tracking-wider text-[9px] sm:text-[10px]">
          BULAN {currentMonthName} SEHINGGA : {dateStr}
        </span>
      </div>
    </div>
  );

  const estateId = analytics?.estateId || getActiveEstateId();
  const cfg = getEstateConfig(estateId);
  const isTunggal = cfg.id === "FPM_TUNGGAL";
  const masterData = (cfg.blocks && Object.keys(cfg.blocks).length > 0)
    ? cfg.blocks
    : (isTunggal ? MASTER_DATA : {});
  const currentYieldData2025 = getHistoricalYieldData2025(estateId);

  const isAdelaOrTunggal = cfg.id === "FPM_ADELA" || cfg.id === "FPM_TUNGGAL";
  const pkt3Label = isAdelaOrTunggal ? "LOT FELDA" : "PKT 003";

  const getTahunTuai = (pkt: string) => {
    if (pkt === "001") return { tahun: "THN 15", target: (cfg.annualTargetPkt1 || 25.0).toFixed(2) };
    if (pkt === "002") return { tahun: "THN 9", target: (cfg.annualTargetPkt2 || 25.0).toFixed(2) };
    if (pkt === "003") {
      return { 
        tahun: isAdelaOrTunggal ? "1F/2F" : "THN 3", 
        target: (cfg.annualTargetFelda || 12.98).toFixed(2) 
      };
    }
    if (pkt === "004") return { tahun: "LT", target: (cfg.annualTargetLotTambahan || 21.0).toFixed(2) };
    return { tahun: "-", target: "-" };
  };

  const calculateRowData = (blokId: string, isLF: boolean = false) => {
    const dBlok = analytics.day.blokStats.find((b: any) => b.blok === blokId);
    const mBlok = analytics.month.blokStats.find((b: any) => b.blok === blokId);
    const yBlok = analytics.year.blokStats.find((b: any) => b.blok === blokId);

    const bData = masterData[blokId];
    const luas = isLF ? (bData?.luas || 98.51) : bData?.luas || 0;
    const pkt = isLF ? "003" : bData?.pkt || "";
    const infoTahun = getTahunTuai(pkt);

    // Anggaran Bulan Ini
    const targetHekMonth = mBlok?.targetHek || 0;
    const targetMtMonth = mBlok?.target_mt || 0;

    // Pencapaian Bulan Ini
    const hiMt = dBlok?.tan || 0;
    const hhiMt = mBlok?.tan || 0;
    const penerokaCount = bData?.peneroka || 0;
    const tPenMonth = penerokaCount > 0 ? hhiMt / penerokaCount : 0;
    const pctCapaiMonth = targetMtMonth > 0 ? (hhiMt / targetMtMonth) * 100 : 0;

    // Capai 2025 (Reference)
    const yield2025 = currentYieldData2025[currentMonthIdx];
    const capaiTan2025 =
      yield2025?.blok?.[blokId as keyof typeof yield2025.blok] || 0;
    const capai2025 = luas > 0 ? capaiTan2025 / luas : 0;

    // Hingga Bulan Ini (YTD)
    const targetHekYtd = yBlok?.targetHek || 0;
    const targetMtYtd = yBlok?.target_mt || 0;
    const actualMtYtd = yBlok?.tan || 0;
    const actualTHekYtd = luas > 0 ? actualMtYtd / luas : 0;
    const pctCapaiYtd = targetMtYtd > 0 ? (actualMtYtd / targetMtYtd) * 100 : 0;

    return {
      pkt,
      tahunTuai: infoTahun.tahun,
      targetTahun: infoTahun.target,
      blok: blokId,
      luas,
      peneroka: penerokaCount,
      capai2025,
      anggaranMonth: { mt: targetMtMonth, tHek: targetHekMonth },
      pencapaianMonth: {
        hiMt,
        hhiMt,
        tHek: hhiMt / (luas || 1),
        tPen: tPenMonth,
      },
      pctCapaiMonth,
      anggaranYtd: { mt: targetMtYtd, tHek: targetHekYtd },
      pencapaianYtd: { mt: actualMtYtd, tHek: actualTHekYtd },
      pctCapaiYtd,
      ytd2025: currentYieldData2025.slice(0, currentMonthIdx + 1).reduce(
        (acc: number, curr: any, idx: number) => {
          const val = isLF
            ? (curr.blok[blokId] ?? curr.blok["1F"] ?? curr.blok["88"] ?? 0)
            : curr.blok[blokId] || 0;
          if (idx === currentMonthIdx) {
            return acc + (val / daysInMonth) * currentDay;
          }
          return acc + val;
        },
        0,
      ),
    };
  };

  const renderRow = (
    data: any,
    isSubtotal: boolean = false,
    isGrandTotal: boolean = false,
  ) => {
    if (!data) return null;
    const yoyVal =
      data.ytd2025 > 0
        ? ((data.pencapaianYtd.mt - data.ytd2025) / data.ytd2025) * 100
        : 0;
    const yoyColor =
      yoyVal >= 0
        ? isGrandTotal
          ? "text-emerald-200 dark:text-emerald-200"
          : "text-emerald-600 dark:text-emerald-700"
        : isGrandTotal
          ? "text-rose-300 dark:text-rose-220"
          : "text-rose-600 dark:text-rose-600";
    const targetColor = isGrandTotal
      ? "text-emerald-200 dark:text-emerald-200"
      : "text-emerald-600 dark:text-emerald-700";
    const capaiColor = isGrandTotal
      ? "text-rose-300 dark:text-rose-200"
      : "text-rose-600 dark:text-rose-600";
    const tPenColor = isGrandTotal
      ? "text-emerald-200 dark:text-emerald-200"
      : "text-emerald-900 dark:text-emerald-950";

    let rowClass =
      "bg-white dark:bg-white text-slate-900 dark:text-slate-900 border-b border-emerald-100 dark:border-emerald-200/60";
    let monthRankTextColor = "";
    let ytdRankTextColor = "";

    if (isGrandTotal) {
      rowClass =
        "bg-emerald-800 text-white dark:bg-emerald-800 dark:text-white font-black shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-20 relative";
    } else if (isSubtotal) {
      rowClass =
        "bg-emerald-50 dark:bg-emerald-100/90 font-bold text-emerald-900 dark:text-emerald-950 border-b-2 border-emerald-200 dark:border-emerald-300";
    } else if (data.blok !== "LF" && (sortBy === "month" || sortBy === "ytd")) {
      const calculateRankTextColor = (pct: number) => {
        if (pct >= 100) return "text-emerald-600 dark:text-emerald-700";
        if (pct >= 90) return "text-teal-600 dark:text-teal-700";
        if (pct >= 70) return "text-amber-500 dark:text-amber-600";
        return "text-rose-600 dark:text-rose-600";
      };

      if (sortBy === "month") {
        monthRankTextColor = calculateRankTextColor(data.pctCapaiMonth);
      } else if (sortBy === "ytd") {
        ytdRankTextColor = calculateRankTextColor(data.pctCapaiYtd);
      }
    }

    const zoomStyles = {
      padding: `${Math.max(2, 3 * ((effectiveZoom / 100) * effectiveScale))}px ${Math.max(2, 4 * ((effectiveZoom / 100) * effectiveScale))}px`,
      fontSize: `${Math.max(10.5, 13.5 * ((effectiveZoom / 100) * effectiveScale))}px`,
      fontWeight: "bold" as const,
    };

    return (
      <tr
        key={data.blok}
        className={`${rowClass} transition-colors cursor-pointer ${!isGrandTotal && !isSubtotal ? "hover:bg-emerald-50 dark:hover:bg-emerald-50/50" : ""}`}
      >
        {!isCapturing && !isDownloadingPdf && (
          <td
            style={zoomStyles}
            title={`Peringkat (PKT): ${data.pkt}`}
            className="border-r border-emerald-200 dark:border-b border-r border-emerald-700/50 dark:border-emerald-800/40 text-center uppercase"
          >
            {data.pkt}
          </td>
        )}
        {!isCapturing && !isDownloadingPdf && (
          <td
            style={zoomStyles}
            title={`Tahun Tuai: ${data.tahunTuai}`}
            className="border-r border-emerald-200 dark:border-b border-r border-emerald-700/50 dark:border-emerald-800/40 text-center uppercase"
          >
            {data.tahunTuai}
          </td>
        )}
        {!isCapturing && !isDownloadingPdf && (
          <td
            style={zoomStyles}
            title={`Kadar Sasaran Tahunan (TAR/MT): ${data.targetTahun}`}
            className={`border-r border-emerald-200 dark:border-b border-r border-emerald-700/50 dark:border-emerald-800/40 text-center ${targetColor}`}
          >
            {data.targetTahun}
          </td>
        )}
        <td
          style={zoomStyles}
          title={`Blok: ${data.blok}`}
          className={`sticky left-0 border-r-2 border-emerald-400 dark:border-b border-r border-emerald-700/50 dark:border-emerald-800/40 group-hover:bg-emerald-50 dark:text-slate-900 text-center font-black shadow-[2px_0_5px_rgba(0,0,0,0.1)] z-10 ${rowClass}`}
        >
          {data.blok}
        </td>
        <td
          style={zoomStyles}
          title={`Kawasan Mengikut Hektar (LUAS): ${data.luas.toFixed(2)}`}
          className="border-r border-emerald-200 dark:border-b border-r border-emerald-700/50 dark:border-emerald-800/40 text-right pr-2 font-medium"
        >
          {data.luas.toFixed(2)}
        </td>
        <td
          style={zoomStyles}
          title={`Jumlah Peneroka: ${data.peneroka > 0 ? data.peneroka : "-"}`}
          className={`border-r border-emerald-200 dark:border-b border-r border-emerald-700/50 dark:border-emerald-800/40 text-center font-bold ${isGrandTotal ? "text-emerald-200 dark:text-emerald-200" : "text-slate-900 dark:text-slate-900"}`}
        >
          {data.peneroka > 0 ? data.peneroka : "-"}
        </td>
        <td
          style={zoomStyles}
          title={`Pencapaian ${currentMonthName} ${parseInt(dbYear) - 1} (CAPAI T/HEK): ${data.capai2025.toFixed(2)}`}
          className={`border-r border-emerald-200 dark:border-b border-r border-emerald-700/50 dark:border-emerald-800/40 text-center font-bold ${capaiColor}`}
        >
          {data.capai2025.toFixed(2)}
        </td>

        {/* BULAN INI ANGGARAN */}
        <td
          style={zoomStyles}
          title={`Anggaran Hasil Bulan Ini (BULAN INI - ANGGARAN M/T): ${data.anggaranMonth.mt.toFixed(2)}`}
          className={`border-r border-emerald-200 dark:border-b border-r border-emerald-700/50 dark:border-emerald-800/40 text-right pr-2 ${!isGrandTotal && !isSubtotal ? "bg-emerald-50/30 dark:bg-emerald-100/30" : ""}`}
        >
          {data.anggaranMonth.mt.toFixed(2)}
        </td>
        <td
          style={zoomStyles}
          title={`Anggaran Kadar Bulan Ini (BULAN INI - ANGGARAN T/HEK): ${data.anggaranMonth.tHek.toFixed(2)}`}
          className={`border-r border-emerald-200 dark:border-b border-r border-emerald-700/50 dark:border-emerald-800/40 text-center ${!isGrandTotal && !isSubtotal ? "bg-emerald-50/30 dark:bg-emerald-100/30" : ""}`}
        >
          {data.anggaranMonth.tHek.toFixed(2)}
        </td>

        {/* BULAN INI PENCAPAIAN */}
        <td
          style={zoomStyles}
          title={`Hasil Hari Ini (BULAN INI - PENCAPAIAN H.I M/T): ${data.pencapaianMonth.hiMt.toFixed(2)}`}
          className="border-r border-emerald-200 dark:border-b border-r border-emerald-700/50 dark:border-emerald-800/40 text-right pr-2 font-black"
        >
          {data.pencapaianMonth.hiMt.toFixed(2)}
        </td>
        <td
          style={zoomStyles}
          title={`Jumlah Hasil Hingga Hari Ini (BULAN INI - PENCAPAIAN H.H.I M/T): ${data.pencapaianMonth.hhiMt.toFixed(2)}`}
          className="border-r border-emerald-200 dark:border-b border-r border-emerald-700/50 dark:border-emerald-800/40 text-right pr-2 font-black"
        >
          {data.pencapaianMonth.hhiMt.toFixed(2)}
        </td>
        <td
          style={zoomStyles}
          title={`Kadar Hasil Bulan Ini (BULAN INI - PENCAPAIAN T/HEK): ${data.pencapaianMonth.tHek.toFixed(2)}`}
          className="border-r border-emerald-200 dark:border-b border-r border-emerald-700/50 dark:border-emerald-800/40 text-center font-black"
        >
          {data.pencapaianMonth.tHek.toFixed(2)}
        </td>
        <td
          style={zoomStyles}
          title={`Purata Hasil Peneroka Bulan Ini (BULAN INI - PENCAPAIAN T/PEN): ${data.pencapaianMonth.tPen.toFixed(2)}`}
          className={`border-r border-emerald-200 dark:border-b border-r border-emerald-700/50 dark:border-emerald-800/40 text-center font-black ${tPenColor}`}
        >
          {data.pencapaianMonth.tPen.toFixed(2)}
        </td>

        <td
          style={zoomStyles}
          title={`Peratus Pencapaian Bulan Ini (BULAN INI - % CAPAI): ${data.pctCapaiMonth.toFixed(2)}%`}
          className={`border-r border-emerald-200 dark:border-b border-r border-emerald-700/50 dark:border-emerald-800/40 text-center font-black`}
        >
          <span className={monthRankTextColor}>
            {data.pctCapaiMonth.toFixed(2)}
          </span>
        </td>

        {/* HINGGA BULAN INI ANGGARAN */}
        <td
          style={zoomStyles}
          title={`Sasar Hasil Hingga Bulan Ini (HINGGA BULAN INI - ANGGARAN M/T): ${data.anggaranYtd.mt.toFixed(2)}`}
          className={`border-r border-emerald-200 dark:border-b border-r border-emerald-700/50 dark:border-emerald-800/40 text-right pr-2 ${!isGrandTotal && !isSubtotal ? "bg-emerald-50/30 dark:bg-emerald-100/30" : ""}`}
        >
          {data.anggaranYtd.mt.toFixed(2)}
        </td>
        <td
          style={zoomStyles}
          title={`Sasar Kadar Hingga Bulan Ini (HINGGA BULAN INI - ANGGARAN T/HEK): ${data.anggaranYtd.tHek.toFixed(2)}`}
          className={`border-r border-emerald-200 dark:border-b border-r border-emerald-700/50 dark:border-emerald-800/40 text-center ${!isGrandTotal && !isSubtotal ? "bg-emerald-50/30 dark:bg-emerald-100/30" : ""}`}
        >
          {data.anggaranYtd.tHek.toFixed(2)}
        </td>

        {/* HINGGA BULAN INI PENCAPAIAN */}
        <td
          style={zoomStyles}
          title={`Hasil Terkumpul Hingga Bulan Ini (HINGGA BULAN INI - PENCAPAIAN M/T): ${data.pencapaianYtd.mt.toFixed(2)}`}
          className="border-r border-emerald-200 dark:border-b border-r border-emerald-700/50 dark:border-emerald-800/40 text-right pr-2 font-black"
        >
          {data.pencapaianYtd.mt.toFixed(2)}
        </td>
        <td
          style={zoomStyles}
          title={`Kadar Terkumpul Hingga Bulan Ini (HINGGA BULAN INI - PENCAPAIAN T/HEK): ${data.pencapaianYtd.tHek.toFixed(2)}`}
          className="border-r border-emerald-200 dark:border-b border-r border-emerald-700/50 dark:border-emerald-800/40 text-center font-black"
        >
          {data.pencapaianYtd.tHek.toFixed(2)}
        </td>

        <td
          style={zoomStyles}
          title={`Peratus Pencapaian Hingga Bulan Ini (HINGGA BULAN INI - % CAPAI): ${data.pctCapaiYtd.toFixed(2)}%`}
          className={`border-r border-emerald-200 dark:border-b border-r border-[#065f46]/30 dark:border-emerald-800/40 text-center font-black ${isCapturing || isDownloadingPdf ? "" : "border-r"}`}
        >
          <span className={ytdRankTextColor}>
            {data.pctCapaiYtd.toFixed(2)}
          </span>
        </td>
        {!isCapturing && !isDownloadingPdf && (
          <td
            style={zoomStyles}
            title={`Pertumbuhan Setahun ke Setahun (YOY): ${yoyVal.toFixed(1)}%`}
            className={`text-center font-black ${yoyColor}`}
          >
            {yoyVal.toFixed(1)}%
          </td>
        )}
      </tr>
    );
  };

  const pkt1Keys = Object.keys(masterData).filter((k) => masterData[k].pkt === "001");
  const pkt2Keys = Object.keys(masterData).filter((k) => masterData[k].pkt === "002");
  const feldaKeys = Object.keys(masterData).filter((k) => masterData[k].pkt === "003");
  const tambahanKeys = Object.keys(masterData).filter((k) => masterData[k].pkt === "004");

  const pkt1Rows = pkt1Keys.map((id) => calculateRowData(id));
  const pkt2Rows = pkt2Keys.map((id) => calculateRowData(id));
  const feldaRows = feldaKeys.map((id) => calculateRowData(id));
  const tambahanRows = tambahanKeys.map((id) => calculateRowData(id));

  const sortFn = (a: any, b: any) => {
    if (sortBy === "id") return parseInt(a.blok) - parseInt(b.blok);
    if (sortBy === "month")
      return b.pencapaianMonth.tHek - a.pencapaianMonth.tHek;
    if (sortBy === "ytd") return b.pencapaianYtd.tHek - a.pencapaianYtd.tHek;
    if (sortBy === "yoy") {
      const yoyA =
        a.ytd2025 > 0 ? (a.pencapaianYtd.mt - a.ytd2025) / a.ytd2025 : -1e9;
      const yoyB =
        b.ytd2025 > 0 ? (b.pencapaianYtd.mt - b.ytd2025) / b.ytd2025 : -1e9;
      return yoyB - yoyA;
    }
    return 0;
  };

  const sortedPkt1 = [...pkt1Rows].sort(sortFn);
  const sortedPkt2 = [...pkt2Rows].sort(sortFn);
  const sortedFelda = [...feldaRows].sort(sortFn);
  const sortedTambahan = [...tambahanRows].sort(sortFn);

  const calculateGroupTotal = (inputRows: any[], label: string) => {
    const rows = (inputRows || []).filter((r): r is NonNullable<typeof r> => r != null);
    if (rows.length === 0) {
      return {
        pkt: label,
        tahunTuai: "-",
        targetTahun: "-",
        blok: label,
        luas: 0,
        peneroka: 0,
        capai2025: 0,
        anggaranMonth: { mt: 0, tHek: 0 },
        pencapaianMonth: {
          hiMt: 0,
          hhiMt: 0,
          tHek: 0,
          tPen: 0,
        },
        pctCapaiMonth: 0,
        anggaranYtd: { mt: 0, tHek: 0 },
        pencapaianYtd: { mt: 0, tHek: 0 },
        pctCapaiYtd: 0,
        ytd2025: 0,
      };
    }

    const totalLuas = rows.reduce((acc, curr) => acc + (curr?.luas || 0), 0);
    const totalCapai2025 =
      rows.reduce((acc, curr) => acc + (curr?.capai2025 || 0) * (curr?.luas || 0), 0) /
      (totalLuas || 1);

    const totalAnggaranMonthMt = rows.reduce(
      (acc, curr) => acc + (curr?.anggaranMonth?.mt || 0),
      0,
    );
    const totalAnggaranMonthTHek =
      rows.reduce((acc, curr) => acc + (curr?.anggaranMonth?.tHek || 0) * (curr?.luas || 0), 0) /
      (totalLuas || 1);

    const totalHiMt = rows.reduce(
      (acc, curr) => acc + (curr?.pencapaianMonth?.hiMt || 0),
      0,
    );
    const totalHhiMt = rows.reduce(
      (acc, curr) => acc + (curr?.pencapaianMonth?.hhiMt || 0),
      0,
    );
    const totalTHekMonth = totalLuas > 0 ? totalHhiMt / totalLuas : 0;
    const totalPeneroka = rows.reduce((acc, curr) => acc + (curr?.peneroka || 0), 0);
    const totalTPenMonth = totalPeneroka > 0 ? totalHhiMt / totalPeneroka : 0;
    const totalPctCapaiMonth =
      totalAnggaranMonthMt > 0 ? (totalHhiMt / totalAnggaranMonthMt) * 100 : 0;

    const totalAnggaranYtdMt = rows.reduce(
      (acc, curr) => acc + (curr?.anggaranYtd?.mt || 0),
      0,
    );
    const totalAnggaranYtdTHek =
      rows.reduce((acc, curr) => acc + (curr?.anggaranYtd?.tHek || 0) * (curr?.luas || 0), 0) /
      (totalLuas || 1);
    const totalActualMtYtd = rows.reduce(
      (acc, curr) => acc + (curr?.pencapaianYtd?.mt || 0),
      0,
    );
    const totalActualTHekYtd = totalLuas > 0 ? totalActualMtYtd / totalLuas : 0;
    const totalPctCapaiYtd =
      totalAnggaranYtdMt > 0
        ? (totalActualMtYtd / totalAnggaranYtdMt) * 100
        : 0;
    const totalYtd2025 = rows.reduce((acc, curr) => acc + (curr?.ytd2025 || 0), 0);

    const firstBlok = rows[0]?.blok || "";
    const lastBlok = rows[rows.length - 1]?.blok || "";
    const rangeStr = rows.length > 0 ? `${firstBlok}-${lastBlok}` : "-";

    return {
      pkt: label,
      tahunTuai: label.startsWith("PKT") ? rangeStr : "-",
      targetTahun: "-",
      blok: label,
      luas: totalLuas,
      peneroka: totalPeneroka,
      capai2025: totalCapai2025,
      anggaranMonth: { mt: totalAnggaranMonthMt, tHek: totalAnggaranMonthTHek },
      pencapaianMonth: {
        hiMt: totalHiMt,
        hhiMt: totalHhiMt,
        tHek: totalTHekMonth,
        tPen: totalTPenMonth,
      },
      pctCapaiMonth: totalPctCapaiMonth,
      anggaranYtd: { mt: totalAnggaranYtdMt, tHek: totalAnggaranYtdTHek },
      pencapaianYtd: { mt: totalActualMtYtd, tHek: totalActualTHekYtd },
      pctCapaiYtd: totalPctCapaiYtd,
      ytd2025: totalYtd2025,
    };
  };

  const pkt1Total = calculateGroupTotal(pkt1Rows, "PKT 001");
  const pkt2Total = calculateGroupTotal(pkt2Rows, "PKT 002");
  const pkt12Total = calculateGroupTotal(
    [...pkt1Rows, ...pkt2Rows],
    "PKT 1 DAN 2",
  );
  const lfRow = feldaRows.length > 0
    ? calculateGroupTotal(feldaRows, pkt3Label)
    : (isTunggal ? calculateRowData("88", true) : null);

  const ltRow = tambahanRows.length > 0
    ? calculateGroupTotal(tambahanRows, "LOT TAMBAHAN")
    : null;

  const grandTotal = calculateGroupTotal(
    [...pkt1Rows, ...pkt2Rows, ...(lfRow ? [lfRow] : []), ...(ltRow ? [ltRow] : [])],
    "JUMLAH BESAR",
  );

  // Staff Groupings (Aidil, Aril, Kiromin, Wan, Lot Felda)
  const aidilBlockIds = ["1", "2", "3", "5", "6", "7"];
  const arilBlockIds = ["4", "8", "9", "10", "11", "12"];
  const kirominBlockIds = ["13", "14", "15", "16", "17"];
  const wanBlockIds = ["18", "19", "20", "21", "22"];

  const aidilRows = aidilBlockIds.map((id) => calculateRowData(id));
  const arilRows = arilBlockIds.map((id) => calculateRowData(id));
  const kirominRows = kirominBlockIds.map((id) => calculateRowData(id));
  const wanRows = wanBlockIds.map((id) => calculateRowData(id));

  const sortedAidil = [...aidilRows].sort(sortFn);
  const sortedAril = [...arilRows].sort(sortFn);
  const sortedKiromin = [...kirominRows].sort(sortFn);
  const sortedWan = [...wanRows].sort(sortFn);

  const aidilTotal = calculateGroupTotal(aidilRows, "JUMLAH AIDIL");
  const arilTotal = calculateGroupTotal(arilRows, "JUMLAH ARIL");
  const kirominTotal = calculateGroupTotal(kirominRows, "JUMLAH KIROMIN");
  const wanTotal = calculateGroupTotal(wanRows, "JUMLAH WAN");
  const feldaTotal = calculateGroupTotal(lfRow ? [lfRow] : [], `JUMLAH ${pkt3Label}`);

  const renderStaffHeaderRow = (staffName: string, blockInfo: string) => (
    <tr
      key={`staff-hdr-${staffName}`}
      className="bg-emerald-950 text-emerald-100 font-black uppercase text-[10.5px] border-y-2 border-emerald-700"
    >
      <td
        colSpan={isCapturing || isDownloadingPdf ? 16 : 20}
        className="py-2.5 px-3 bg-emerald-900 text-amber-300 font-black shadow-inner"
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-amber-300 font-black tracking-wide text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block animate-pulse"></span>
            PENYELIA / STAFF: {staffName}
          </span>
          <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider">
            {blockInfo}
          </span>
        </div>
      </td>
    </tr>
  );

  const handleExportTableToExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet("Laporan Hasil Bulanan");

      ws.pageSetup.orientation = "landscape";
      ws.pageSetup.fitToPage = true;
      ws.pageSetup.fitToWidth = 1;

      // 1. Titles
      ws.mergeCells("A1:S1");
      const title1 = ws.getCell("A1");
      title1.value = "FELDA PLANTATION MANAGEMENT SDN BHD";
      title1.font = { bold: true, size: 16 };
      title1.alignment = { horizontal: "center" };

      ws.mergeCells("A2:S2");
      const title2 = ws.getCell("A2");
      title2.value = `LAPORAN HASIL BULANAN MENGIKUT BLOK ${dbYear}`;
      title2.font = { bold: true, size: 12 };
      title2.alignment = { horizontal: "center" };

      ws.mergeCells("A3:S3");
      const title3 = ws.getCell("A3");
      title3.value = `BULAN ${currentMonthName} SEHINGGA : ${dateStr}`;
      title3.font = { bold: true, size: 10 };
      title3.alignment = { horizontal: "center" };

      ws.addRow([]); // Blank Row 4

      // 2. Headers Row 1
      const headerRow1 = ws.getRow(5);
      ws.mergeCells("A5:A6");
      headerRow1.getCell(1).value = "PERINGKAT";
      ws.mergeCells("B5:B6");
      headerRow1.getCell(2).value = "TAHUN TUAI";
      ws.mergeCells("C5:C6");
      headerRow1.getCell(3).value = "TARGET TAHUN";
      ws.mergeCells("D5:D6");
      headerRow1.getCell(4).value = "BLOK";
      ws.mergeCells("E5:E6");
      headerRow1.getCell(5).value = "LUAS BUKAAN (HEK)";
      ws.mergeCells("F5:F6");
      headerRow1.getCell(6).value = "JUM PEN.";
      ws.mergeCells("G5:G6");
      headerRow1.getCell(7).value = `CAPAI T/HEK (${parseInt(dbYear) - 1})`;

      ws.mergeCells("H5:I5");
      headerRow1.getCell(8).value = "ANGGARAN BULAN INI";
      ws.mergeCells("J5:N5");
      headerRow1.getCell(10).value = "PENCAPAIAN SEHINGGA HARI INI";
      ws.mergeCells("O5:P5");
      headerRow1.getCell(15).value = "ANGGARAN HINGGA BULAN INI";
      ws.mergeCells("Q5:T5");
      headerRow1.getCell(17).value = "PENCAPAIAN HINGGA BULAN INI";

      // 3. Headers Row 2
      const headerRow2 = ws.getRow(6);
      headerRow2.getCell(8).value = "MT";
      headerRow2.getCell(9).value = "T/HEK";

      headerRow2.getCell(10).value = "HI M/T";
      headerRow2.getCell(11).value = "HHI M/T";
      headerRow2.getCell(12).value = "T/HEK";
      headerRow2.getCell(13).value = "T.PEN M/T";
      headerRow2.getCell(14).value = "% CAPAI";

      headerRow2.getCell(15).value = "MT";
      headerRow2.getCell(16).value = "T/HEK";

      headerRow2.getCell(17).value = "M/T";
      headerRow2.getCell(18).value = "T/HEK";
      headerRow2.getCell(19).value = "% CAPAI";
      headerRow2.getCell(20).value = "YOY (%)";

      // 4. Style headers
      [5, 6].forEach((rowIdx) => {
        const row = ws.getRow(rowIdx);
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF064E3B" },
          };
          cell.alignment = {
            horizontal: "center",
            vertical: "middle",
            wrapText: true,
          };
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });
      });
      headerRow1.height = 25;
      headerRow2.height = 25;

      // 5. Columns width
      ws.columns = [
        { width: 12 },
        { width: 12 },
        { width: 15 },
        { width: 10 },
        { width: 18 },
        { width: 18 },
        { width: 10 },
        { width: 10 },
        { width: 10 },
        { width: 10 },
        { width: 10 },
        { width: 12 },
        { width: 10 },
        { width: 10 },
        { width: 10 },
        { width: 10 },
        { width: 10 },
        { width: 10 },
        { width: 10 },
      ];

      // 6. Append Row helper
      const appendRow = (
        data: any,
        isSubtotal = false,
        isGrandTotal = false,
      ) => {
        const yoyVal =
          data.ytd2025 > 0
            ? ((data.pencapaianYtd.mt - data.ytd2025) / data.ytd2025) * 100
            : 0;
        const row = ws.addRow([
          data.pkt,
          data.tahunTuai,
          data.targetTahun,
          data.blok,
          data.luas,
          data.peneroka > 0 ? data.peneroka : "-",
          data.capai2025,
          data.anggaranMonth.mt,
          data.anggaranMonth.tHek,
          data.pencapaianMonth.hiMt,
          data.pencapaianMonth.hhiMt,
          data.pencapaianMonth.tHek,
          data.pencapaianMonth.tPen,
          data.pctCapaiMonth,
          data.anggaranYtd.mt,
          data.anggaranYtd.tHek,
          data.pencapaianYtd.mt,
          data.pencapaianYtd.tHek,
          data.pctCapaiYtd,
          yoyVal,
        ]);

        row.eachCell((cell, colNumber) => {
          if (colNumber > 4 && colNumber !== 6) {
            cell.numFmt = "#,##0.00";
            if (colNumber === 14 || colNumber === 19 || colNumber === 20)
              cell.numFmt = '0.00"%"';
          }
          if (colNumber === 6 && cell.value !== "-") {
            cell.numFmt = "0";
          }
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };

          if (isGrandTotal) {
            cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FF059669" },
            };
          } else if (isSubtotal) {
            cell.font = { bold: true, color: { argb: "FF064E3B" } };
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFD1FAE5" },
            };
          } else if (
            data.blok !== "LF" &&
            (sortBy === "month" || sortBy === "ytd")
          ) {
            const pct =
              sortBy === "month" ? data.pctCapaiMonth : data.pctCapaiYtd;
            if (pct >= 100) {
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FF059669" },
              };
              cell.font = { color: { argb: "FFFFFFFF" } };
            } else if (pct >= 90) {
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FF6EE7B7" },
              };
              cell.font = { color: { argb: "FF022C22" } };
            } else if (pct >= 70) {
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFFDE68A" },
              };
              cell.font = { color: { argb: "FF422006" } };
            } else {
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFFB7185" },
              };
              cell.font = { color: { argb: "FFFFFFFF" } };
            }
          }
        });
      };

      // 7. Inject data
      sortedPkt1.forEach((r) => appendRow(r));
      appendRow(pkt1Total, true);
      sortedPkt2.forEach((r) => appendRow(r));
      appendRow(pkt2Total, true);
      appendRow(pkt12Total, true);
      if (ltRow) appendRow(ltRow);
      if (sortedFelda.length > 1) {
        sortedFelda.forEach((r) => appendRow(r));
        appendRow(lfRow, true);
      } else {
        appendRow(lfRow);
      }
      appendRow(grandTotal, false, true);

      // 7.1 Inject Staff Sections into Excel
      ws.addRow([]); // Blank Row
      const staffTitleRow = ws.addRow(["LAPORAN PRESTASI BULANAN MENGIKUT STAFF / PENYELIA"]);
      ws.mergeCells(`A${staffTitleRow.number}:T${staffTitleRow.number}`);
      const stCell = staffTitleRow.getCell(1);
      stCell.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
      stCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF064E3B" } };
      stCell.alignment = { horizontal: "center", vertical: "middle" };

      const appendStaffExcelHeader = (staffName: string, blockInfo: string) => {
        const hdrRow = ws.addRow([`PENYELIA / STAFF: ${staffName} (${blockInfo})`]);
        ws.mergeCells(`A${hdrRow.number}:T${hdrRow.number}`);
        const c = hdrRow.getCell(1);
        c.font = { bold: true, size: 10, color: { argb: "FFFFF59D" } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF042F2E" } };
        c.alignment = { horizontal: "left", vertical: "middle" };
      };

      appendStaffExcelHeader("AIDIL", "BLOK 1, 2, 3, 5, 6, 7");
      sortedAidil.forEach((r) => appendRow(r));
      appendRow(aidilTotal, true);

      appendStaffExcelHeader("ARIL", "BLOK 4, 8, 9, 10, 11, 12");
      sortedAril.forEach((r) => appendRow(r));
      appendRow(arilTotal, true);

      appendStaffExcelHeader("KIROMIN", "BLOK 13, 14, 15, 16, 17");
      sortedKiromin.forEach((r) => appendRow(r));
      appendRow(kirominTotal, true);

      appendStaffExcelHeader("WAN", "BLOK 18, 19, 20, 21, 22");
      sortedWan.forEach((r) => appendRow(r));
      appendRow(wanTotal, true);

      appendStaffExcelHeader(pkt3Label, isAdelaOrTunggal ? "BLOK 88 / LOT FELDA" : "PKT 003");
      if (sortedFelda.length > 1) {
        sortedFelda.forEach((r) => appendRow(r));
        appendRow(lfRow, true);
      } else {
        appendRow(lfRow);
        appendRow(feldaTotal, true);
      }

      appendRow(grandTotal, false, true);

      // 8. Download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      saveAs(
        blob,
        `Laporan_Hasil_Bulanan_${dateStr.replace(/ /g, "_").replaceAll("/", "")}.xlsx`,
      );
    } catch (e) {
      console.error(e);
      alert("Gagal memuat turun Excel");
    }
  };

  const renderTableHeader = () => (
    <thead className="sticky top-0 bg-emerald-900 text-[9.5px] uppercase font-black tracking-wider text-white z-30 shadow-md border-b-2 border-emerald-700">
      <tr>
        {!isCapturing && !isDownloadingPdf && (
          <th
            rowSpan={3}
            style={{
              fontSize: `${Math.max(
                9.5,
                12.5 * ((effectiveZoom / 100) * effectiveScale),
              )}px`,
            }}
            className="border-b border-r border-emerald-700/50 dark:border-emerald-800/40 py-1.5 px-0.5 w-[3%] bg-emerald-900/90 dark:bg-emerald-900 text-center"
          >
            PKT
          </th>
        )}
        {!isCapturing && !isDownloadingPdf && (
          <th
            rowSpan={3}
            style={{
              fontSize: `${Math.max(
                9.5,
                12.5 * ((effectiveZoom / 100) * effectiveScale),
              )}px`,
            }}
            className="border-b border-r border-emerald-700/50 dark:border-emerald-800/40 py-1.5 px-0.5 w-[4.5%] bg-emerald-900/90 dark:bg-emerald-900 text-center"
          >
            THN TUAI
          </th>
        )}
        {!isCapturing && !isDownloadingPdf && (
          <th
            rowSpan={3}
            style={{
              fontSize: `${Math.max(
                9.5,
                12.5 * ((effectiveZoom / 100) * effectiveScale),
              )}px`,
            }}
            className="border-b border-r border-emerald-700/50 dark:border-emerald-800/40 py-1.5 px-0.5 w-[4%] bg-emerald-900/90 dark:bg-emerald-900 text-center"
          >
            TAR/MT
          </th>
        )}
        <th
          rowSpan={3}
          style={{
            fontSize: `${Math.max(
              10.5,
              13.5 * ((effectiveZoom / 100) * effectiveScale),
            )}px`,
          }}
          className="sticky left-0 border-b border-r border-emerald-700/50 dark:border-emerald-800/40 text-white py-1.5 px-0.5 w-[3.5%] bg-emerald-900 z-40 shadow-md text-center"
        >
          BLOK
        </th>
        <th
          rowSpan={3}
          style={{
            fontSize: `${Math.max(
              9.5,
              12.5 * ((effectiveZoom / 100) * effectiveScale),
            )}px`,
          }}
          className="border-b border-r border-emerald-700/50 dark:border-emerald-800/40 py-1.5 px-0.5 w-[4.5%] bg-emerald-900/90 dark:bg-emerald-900 text-center"
        >
          LUAS
        </th>
        <th
          rowSpan={3}
          style={{
            fontSize: `${Math.max(
              9.5,
              12.5 * ((effectiveZoom / 100) * effectiveScale),
            )}px`,
          }}
          className="border-b border-r border-emerald-700/50 dark:border-emerald-800/40 py-1.5 px-0.5 w-[4%] bg-emerald-900/90 dark:bg-emerald-900 text-center"
        >
          JUM PEN.
        </th>
        <th
          rowSpan={2}
          style={{
            fontSize: `${Math.max(
              9.5,
              12.5 * ((effectiveZoom / 100) * effectiveScale),
            )}px`,
          }}
          className="border-b border-r border-emerald-700/50 dark:border-emerald-800/40 py-1.5 px-0.5 w-[4.5%] bg-emerald-900/90 dark:bg-emerald-900 text-center"
        >
          CAPAI
        </th>
        <th
          colSpan={7}
          style={{
            fontSize: `${Math.max(
              10.5,
              13.5 * ((effectiveZoom / 100) * effectiveScale),
            )}px`,
          }}
          className="border-b border-r border-emerald-700/50 dark:border-emerald-800/40 py-1.5 px-0.5 bg-emerald-800 dark:bg-emerald-800 text-center"
        >
          BULAN INI
        </th>
        <th
          colSpan={isCapturing || isDownloadingPdf ? 5 : 6}
          style={{
            fontSize: `${Math.max(
              10.5,
              13.5 * ((effectiveZoom / 100) * effectiveScale),
            )}px`,
          }}
          className="border-b border-r border-emerald-700/50 dark:border-emerald-800/40 py-1.5 px-0.5 bg-emerald-800 dark:bg-emerald-800 text-center"
        >
          HINGGA BULAN INI
        </th>
      </tr>
      <tr
        style={{
          fontSize: `${Math.max(9.5, 12.5 * ((effectiveZoom / 100) * effectiveScale))}px`,
        }}
      >
        <th
          colSpan={2}
          className="border-b border-r border-emerald-700/50 dark:border-emerald-800/40 text-emerald-50 py-1 px-0.5 font-semibold bg-emerald-800/80 text-center"
        >
          ANGGARAN
        </th>
        <th
          colSpan={4}
          className="border-b border-r border-emerald-700/50 dark:border-emerald-800/40 text-emerald-50 py-1 px-0.5 font-semibold bg-emerald-800/80 text-center"
        >
          PENCAPAIAN
        </th>
        <th
          rowSpan={2}
          className="border-b border-r border-emerald-700/50 dark:border-emerald-800/40 text-emerald-50 py-1 px-0.5 w-[4.5%] font-semibold bg-emerald-800/80 text-center"
        >
          % CAPAI
        </th>
        <th
          colSpan={2}
          className="border-b border-r border-emerald-700/50 dark:border-emerald-800/40 text-emerald-50 py-1 px-0.5 font-semibold bg-emerald-800/80 text-center"
        >
          ANGGARAN
        </th>
        <th
          colSpan={2}
          className="border-b border-r border-emerald-700/50 dark:border-emerald-800/40 text-emerald-50 py-1 px-0.5 font-semibold bg-emerald-800/80 text-center"
        >
          PENCAPAIAN
        </th>
        <th
          rowSpan={2}
          className="border-b border-r border-emerald-700/50 dark:border-emerald-800/40 text-emerald-50 py-1 px-0.5 w-[4.5%] font-semibold bg-emerald-800/80 text-center"
        >
          % CAPAI
        </th>
        {!isCapturing && !isDownloadingPdf && (
          <th
            rowSpan={2}
            className="border-b border-r border-emerald-700/50 dark:border-emerald-800/40 text-emerald-50 py-1 px-0.5 w-[4.5%] font-semibold bg-emerald-800/80 text-center"
          >
            YOY
          </th>
        )}
      </tr>
      <tr
        style={{
          fontSize: `${Math.max(8.5, 11 * ((effectiveZoom / 100) * effectiveScale))}px`,
        }}
      >
        <th className="border-b border-r border-emerald-700/50 dark:border-emerald-800/40 py-1 px-0.5 min-w-[50px] w-[4.5%] bg-emerald-900/90 dark:bg-emerald-900 text-center">
          {currentMonthName} {parseInt(dbYear) - 1} <br />
          T/HEK
        </th>
        <th className="border-b border-r border-emerald-700/50 dark:border-emerald-800/40 text-emerald-100 py-1 px-0.5 min-w-[50px] w-[4.5%] bg-emerald-800 dark:bg-emerald-800 text-center">
          M/T
        </th>
        <th className="border-b border-r border-emerald-700/50 dark:border-emerald-800/40 text-emerald-100 py-1 px-0.5 min-w-[45px] w-[4.5%] bg-emerald-800 dark:bg-emerald-800 text-center">
          T/HEK
        </th>
        <th className="border-b border-r border-emerald-700/50 dark:border-emerald-800/40 text-emerald-100 py-1 px-0.5 min-w-[50px] w-[5%] bg-emerald-800 dark:bg-emerald-800 text-center">
          H.I M/T
        </th>
        <th className="border-b border-r border-emerald-700/50 dark:border-emerald-800/40 text-emerald-100 py-1 px-0.5 min-w-[55px] w-[5.5%] bg-emerald-800 dark:bg-emerald-800 text-center">
          H.H.I M/T
        </th>
        <th className="border-b border-r border-emerald-700/50 dark:border-emerald-800/40 text-emerald-100 py-1 px-0.5 min-w-[45px] w-[4.5%] bg-emerald-800 dark:bg-emerald-800 text-center">
          T/HEK
        </th>
        <th className="border-b border-r border-emerald-700/50 dark:border-emerald-800/40 text-emerald-100 py-1 px-0.5 min-w-[45px] w-[4.5%] bg-emerald-800 dark:bg-emerald-800 text-center">
          T/PEN
        </th>
        <th className="border-b border-r border-emerald-700/50 dark:border-emerald-800/40 text-emerald-100 py-1 px-0.5 min-w-[50px] w-[5%] bg-emerald-800 dark:bg-emerald-800 text-center">
          M/T
        </th>
        <th className="border-b border-r border-emerald-700/50 dark:border-emerald-800/40 text-emerald-100 py-1 px-0.5 min-w-[45px] w-[4.5%] bg-emerald-800 dark:bg-emerald-800 text-center">
          T/HEK
        </th>
        <th className="border-b border-r border-emerald-700/50 dark:border-emerald-800/40 text-emerald-100 py-1 px-0.5 min-w-[55px] w-[5.5%] bg-emerald-800 dark:bg-emerald-800 text-center">
          M/T
        </th>
        <th className="border-b border-r border-emerald-700/50 dark:border-emerald-800/40 text-emerald-100 py-1 px-0.5 min-w-[45px] w-[4.5%] bg-emerald-800 dark:bg-emerald-800 text-center">
          T/HEK
        </th>
      </tr>
    </thead>
  );

  return (
    <div
      id="hasil-bulanan-report"
      className={`mt-8 md:mt-20 w-full px-4 mb-32 mx-auto font-sans ${isCapturing ? "max-w-none" : "max-w-7xl"}`}
    >
      <div className="flex flex-col items-center justify-center text-center mb-6 gap-4 md:gap-6 w-full">
        <div className="flex flex-col items-center justify-center text-center w-full">
          <div className="hidden flex-col items-center flex-shrink-0">
            <div className="bg-[#E11D48] text-white p-1.5 md:p-2 rounded-xl mb-1 shadow-md shadow-rose-900/20 ring-1 ring-[#E11D48]/30">
              <Leaf className="w-5 h-5 md:w-8 md:h-8" strokeWidth={2.5} />
            </div>
            <span className="text-[7px] md:text-[10px] font-black tracking-widest text-[#E11D48]">
              FELDA
            </span>
          </div>
          <div className="flex flex-col items-center justify-center text-center w-full">
            <h2
              className={`font-display font-black text-slate-800 dark:text-white tracking-tight leading-tight uppercase text-center w-full ${isCapturing ? "text-[42px] sm:text-[45px] md:text-[48px] mb-2" : "text-[18px] sm:text-[21px] md:text-[34px]"}`}
            >
              FELDA PLANTATION MANAGEMENT SDN BHD
            </h2>
            <h3
              className={`font-bold dark:text-emerald-100 mt-1 uppercase tracking-wide text-center w-full ${isCapturing ? "text-[28px] sm:text-[30px] md:text-[32px] mb-1.5" : "text-[14px] sm:text-[17px] md:text-[22px]"}`}
            >
              LAPORAN HASIL BULANAN MENGIKUT BLOK {dbYear}
            </h3>
            <p
              className={`font-bold text-slate-400 uppercase tracking-tighter mt-1.5 text-center w-full ${isCapturing ? "text-[18px] sm:text-[21px] md:text-[24px]" : "text-[13px] sm:text-[14px] md:text-[17px]"}`}
            >
              BULAN {currentMonthName} SEHINGGA : {dateStr}
            </p>
          </div>
        </div>

        {/* MONTH & DATE SELECTOR BAR */}
        {!isCapturing && !isDownloadingPdf && (
          <div className="no-screenshot w-full flex flex-wrap items-center justify-center gap-2 md:gap-3 bg-slate-100/80 dark:bg-slate-800/80 p-2.5 md:p-3 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm transition-all">
            <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-black text-xs uppercase tracking-wider">
              <Calendar size={16} className="text-emerald-600 dark:text-emerald-400" />
              <span>Pilih Bulan Laporan:</span>
            </div>

            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-emerald-200 dark:border-emerald-700 shadow-sm">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-200 transition-colors active:scale-95"
                title="Bulan Sebelumnya"
              >
                <ChevronLeft size={16} />
              </button>

              <select
                value={dbMonth}
                onChange={(e) => handleSelectMonthYear(dbYear, e.target.value)}
                className="bg-transparent font-black text-xs md:text-sm text-emerald-700 dark:text-emerald-400 px-2 py-1 outline-none cursor-pointer"
              >
                {monthOptions.map((mo) => (
                  <option
                    key={mo.value}
                    value={mo.value}
                    className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  >
                    {mo.label}
                  </option>
                ))}
              </select>

              <select
                value={dbYear}
                onChange={(e) => handleSelectMonthYear(e.target.value, dbMonth)}
                className="bg-transparent font-black text-xs md:text-sm text-emerald-700 dark:text-emerald-400 px-2 py-1 outline-none cursor-pointer border-l border-slate-200 dark:border-slate-700"
              >
                {["2024", "2025", "2026", "2027"].map((y) => (
                  <option
                    key={y}
                    value={y}
                    className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  >
                    {y}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-200 transition-colors active:scale-95"
                title="Bulan Seterusnya"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-xl border border-emerald-200 dark:border-emerald-700 shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">
                Tarikh:
              </span>
              <input
                type="date"
                value={dashboardFallback}
                onChange={handleExactDateChange}
                className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
              />
            </div>

            {setDashboardDate && (
              <button
                type="button"
                onClick={() => setDashboardDate(new Date().toISOString().split("T")[0])}
                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-sm active:scale-95 flex items-center gap-1"
                title="Kembali ke Tarikh Hari Ini"
              >
                <RotateCcw size={12} />
                <span>Hari Ini</span>
              </button>
            )}
          </div>
        )}

        <div className="flex flex-col xs:flex-row items-center justify-center gap-2 w-full lg:w-auto no-screenshot">
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 md:p-1 rounded-xl border-emerald-200 dark:border-emerald-700 shadow-sm max-w-full no-scrollbar">
            {[
              { id: "id", label: "ASAL", icon: <Target size={10} /> },
              { id: "month", label: "BULAN", icon: <BarChart3 size={10} /> },
              { id: "ytd", label: "TAHUN", icon: <Trophy size={10} /> },
              { id: "yoy", label: "YOY", icon: <TrendingUp size={10} /> },
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setSortBy(btn.id as any)}
                className={`flex items-center gap-1 px-1.5 md:px-3 py-1.5 rounded-lg text-[8px] md:text-[10px] font-black transition-all whitespace-nowrap ${
                  sortBy === btn.id
                    ? "bg-emerald-800 dark:bg-emerald-400 text-white dark:text-slate-900 shadow-md shadow-slate-900/10 dark:shadow-white/10"
                    : "dark:text-emerald-100 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {btn.icon}
                <span className="xs:inline">{btn.label}</span>
              </button>
            ))}

            <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                className="flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-lg bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-emerald-800 dark:text-emerald-100 shadow-sm transition-all active:scale-[0.95]"
                title="Muat Turun"
              >
                <DownloadCloud size={14} />
              </button>

              <AnimatePresence>
                {showDownloadMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                    className="absolute right-0 top-full mt-2 w-52 bg-white/95 dark:bg-[#072d1f]/98 backdrop-blur-xl rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.15)] border-emerald-200 dark:border-slate-800 py-3 px-2 z-[100] ring-1 ring-black/5"
                  >
                    <div className="px-3 py-1.5 border-b border-emerald-100 dark:border-slate-800/50 mb-1">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] block">
                        Fail Digital
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <button
                        onClick={() => {
                          handleExportTableToExcel();
                          setShowDownloadMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-emerald-800 dark:text-emerald-100 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all text-left group"
                      >
                        <div className="w-7 h-7 bg-emerald-500/10 rounded-lg flex items-center justify-center dark:text-emerald-100 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                          <FileSpreadsheet size={14} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold uppercase tracking-tight">
                            Excel
                          </span>
                          <span className="text-[7px] text-slate-400 leading-none">
                            Data Mentah
                          </span>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          onDownloadPdf?.();
                          setShowDownloadMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-emerald-800 dark:text-emerald-100 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 transition-all text-left group"
                      >
                        <div className="w-7 h-7 bg-rose-500/10 rounded-lg flex items-center justify-center text-rose-600 dark:text-rose-400 group-hover:bg-rose-500 group-hover:text-white transition-all">
                          <FileTextIcon size={14} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold uppercase tracking-tight">
                            PDF
                          </span>
                          <span className="text-[7px] text-slate-400 leading-none">
                            Dokumen HD
                          </span>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          onPrint?.();
                          setShowDownloadMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-emerald-800 dark:text-emerald-100 hover:bg-slate-500/10 transition-all text-left group"
                      >
                        <div className="w-7 h-7 bg-slate-500/10 rounded-lg flex items-center justify-center text-emerald-700 dark:text-emerald-300 group-hover:bg-slate-600 group-hover:text-white transition-all">
                          <Printer size={14} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold uppercase tracking-tight">
                            Cetak
                          </span>
                          <span className="text-[7px] text-slate-400 leading-none">
                            Pencetak Fizikal
                          </span>
                        </div>
                      </button>
                    </div>
                  </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 bg-white dark:bg-slate-800 py-2 px-1 md:p-1.5 rounded-xl border border-emerald-200 dark:border-emerald-700 shadow-sm">
                <button
                  onClick={() => setZoom(Math.max(5, zoom - 5))}
                  className="p-1.5 md:p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg transition-all dark:text-emerald-100 active:scale-95"
                  title="Zum Keluar"
                >
                  <ZoomOut size={16} />
                </button>
                <span className="text-[10px] md:text-sm font-black min-w-[4ch] text-center text-emerald-800 dark:text-emerald-400">
                  {zoom}%
                </span>
                <button
                  onClick={() => setZoom(Math.min(100, zoom + 5))}
                  className="p-1.5 md:p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg transition-all dark:text-emerald-100 active:scale-95"
                  title="Zum Masuk"
                >
                  <ZoomIn size={16} />
                </button>
              </div>
              <button 
                onClick={() => setZoom(40)} 
                className="text-[9px] px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors shadow-sm uppercase tracking-widest cursor-pointer"
              >
                RESET
              </button>
          </div>
        </div>
      </div>

      {isFullscreen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-md flex flex-col p-2 sm:p-4 text-white overflow-hidden animate-in fade-in duration-200">
          {/* Fullscreen Top Navigation Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 sm:p-3 bg-slate-900/95 border border-emerald-800/60 rounded-2xl mb-2 shrink-0 shadow-2xl text-white">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-600/20 border border-emerald-500/40 rounded-xl text-emerald-400 shrink-0">
                <ScanLine size={18} className="animate-pulse" />
              </div>
              <div>
                <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                  READY FOR SCREENSHOT
                  <span className="bg-emerald-500/20 text-emerald-300 text-[9px] px-2 py-0.5 rounded-full border border-emerald-500/30">
                    {fullscreenTab === "blok" ? "JADUAL 1: BLOK" : "JADUAL 2: STAFF"}
                  </span>
                </h2>
                <p className="text-[10px] text-slate-400 font-medium hidden sm:block">
                  Format Landskap Skrin Penuh Untuk Tangkapan Skrin (Screenshot) HD
                </p>
              </div>
            </div>

            {/* Middle Switcher & Format Controls */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-800/90 p-1 rounded-xl border border-slate-700/80">
              <button
                onClick={() => setFullscreenTab("blok")}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                  fullscreenTab === "blok"
                    ? "bg-emerald-600 text-white shadow-md border border-emerald-400/30"
                    : "text-slate-300 hover:bg-slate-700 hover:text-white"
                }`}
              >
                <span>1. Mengikut Blok</span>
              </button>
              <button
                onClick={() => setFullscreenTab("staff")}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                  fullscreenTab === "staff"
                    ? "bg-emerald-600 text-white shadow-md border border-emerald-400/30"
                    : "text-slate-300 hover:bg-slate-700 hover:text-white"
                }`}
              >
                <span>2. Mengikut Staff</span>
              </button>

              <div className="h-4 w-px bg-slate-700 my-auto mx-1 hidden sm:block" />

              {/* Landscape Mode Button */}
              <button
                onClick={() => setIsLandscapeMode(!isLandscapeMode)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                  isLandscapeMode
                    ? "bg-emerald-500 text-slate-950 shadow-md border border-emerald-300"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
                title="Tukar Format Landskap"
              >
                <RotateCw size={12} className={isLandscapeMode ? "rotate-90" : ""} />
                <span>Format Landskap: {isLandscapeMode ? "ON" : "OFF"}</span>
              </button>

              {/* Rotate 90deg button for phone screenshot option */}
              <button
                onClick={() => setIsRotated90(!isRotated90)}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer ${
                  isRotated90
                    ? "bg-amber-500 text-slate-950 shadow-md"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
                title="Putar Jadual 90 Darjah (Untuk Telefon Bimbit)"
              >
                <RotateCw size={12} />
                <span>Rotasi 90°</span>
              </button>
            </div>

            {/* Right Action Controls */}
            <div className="flex items-center gap-2">
              {/* Zoom Controls */}
              <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-xl border border-slate-700/60">
                <button
                  onClick={() => setZoom((z) => Math.max(20, z - 5))}
                  className="p-1 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
                  title="Zum Keluar"
                >
                  <ZoomOut size={14} />
                </button>
                <span className="text-[11px] font-black text-emerald-400 min-w-[3.5ch] text-center">
                  {zoom}%
                </span>
                <button
                  onClick={() => setZoom((z) => Math.min(150, z + 5))}
                  className="p-1 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
                  title="Zum Masuk"
                >
                  <ZoomIn size={14} />
                </button>
                
                <div className="flex items-center gap-1 border-l border-slate-700 pl-1.5 ml-1">
                  <button
                    onClick={() => setZoom(40)}
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase cursor-pointer ${
                      zoom === 40 ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    }`}
                    title="Fit Landskap 40% (Default)"
                  >
                    40%
                  </button>
                  <button
                    onClick={() => setZoom(60)}
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase cursor-pointer ${
                      zoom === 60 ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    }`}
                    title="Fit Landskap 60%"
                  >
                    60%
                  </button>
                  <button
                    onClick={() => setZoom(100)}
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase cursor-pointer ${
                      zoom === 100 ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    }`}
                    title="Muatkan 100%"
                  >
                    100%
                  </button>
                </div>
              </div>

              {/* Excel Download */}
              <button
                onClick={handleExportTableToExcel}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
                title="Muat Turun Excel (.xlsx)"
              >
                <Download size={13} className="stroke-[2.5]" />
                <span className="hidden sm:inline">Excel</span>
              </button>

              {/* Close Button */}
              <button
                onClick={() => setFullscreenTab(null)}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer shrink-0"
              >
                <X size={15} />
                <span>Tutup</span>
              </button>
            </div>
          </div>

          {/* Fullscreen Body showing ONLY the selected isolated table in landscape format */}
          <div className="flex-1 overflow-auto custom-scrollbar bg-slate-950 p-2 sm:p-4 flex justify-center items-start">
            <div className={`transition-all duration-300 origin-center ${isRotated90 ? "transform rotate-90 my-20 scale-95" : ""}`}>
              {fullscreenTab === "blok" ? (
                /* SECTION 1: LAPORAN HASIL BULANAN MENGIKUT BLOK */
                <div className="bg-[#072d1f] rounded-2xl p-3 sm:p-5 shadow-2xl border border-emerald-800/60 inline-block min-w-full">
                  {renderReportHeader(`LAPORAN HASIL BULANAN MENGIKUT BLOK ${dbYear}`)}

                  <div className="overflow-x-auto custom-scrollbar rounded-xl border border-emerald-800/60 bg-white">
                    <div style={{ zoom: `${zoom / 100}` }}>
                      <table className="w-full border-collapse bg-white dark:bg-white min-w-[1200px]">
                        {renderTableHeader()}
                        <tbody className="text-[10px] text-slate-800 dark:text-slate-900">
                          {sortedPkt1.map((row) => renderRow(row))}
                          {renderRow(pkt1Total, true)}
                          {sortedPkt2.map((row) => renderRow(row))}
                          {renderRow(pkt2Total, true)}
                          {renderRow(pkt12Total, true)}
                          {ltRow && renderRow(ltRow)}
                          {sortedFelda.length > 1 ? (
                            <>
                              {sortedFelda.map((row) => renderRow(row))}
                              {renderRow(lfRow, true)}
                            </>
                          ) : (
                            renderRow(lfRow)
                          )}
                          {renderRow(grandTotal, false, true)}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                /* SECTION 2: LAPORAN PRESTASI BULANAN MENGIKUT STAFF / PENYELIA */
                <div className="bg-[#072d1f] rounded-2xl p-3 sm:p-5 shadow-2xl border border-emerald-800/60 inline-block min-w-full">
                  {renderReportHeader(
                    `LAPORAN PRESTASI BULANAN MENGIKUT STAFF / PENYELIA ${dbYear}`,
                    `PENGASINGAN BLOK MENGIKUT PENYELIA: AIDIL, ARIL, KIROMIN & WAN (${dbYear})`
                  )}

                  <div className="overflow-x-auto custom-scrollbar rounded-xl border border-emerald-800/60 bg-white">
                    <div style={{ zoom: `${zoom / 100}` }}>
                      <table className="w-full border-collapse bg-white dark:bg-white min-w-[1200px]">
                        {renderTableHeader()}
                        <tbody className="text-[10px] text-slate-800 dark:text-slate-900">
                          {/* AIDIL / ADIB */}
                          {renderStaffHeaderRow("AIDIL", "BLOK 1, 2, 3, 5, 6, 7 (PKT 1A & 1B)")}
                          {sortedAidil.map((row) => renderRow(row))}
                          {renderRow(aidilTotal, true)}

                          {/* ARIL */}
                          {renderStaffHeaderRow("ARIL", "BLOK 4, 8, 9, 10, 11, 12 (PKT 1C)")}
                          {sortedAril.map((row) => renderRow(row))}
                          {renderRow(arilTotal, true)}

                          {/* KIROMIN */}
                          {renderStaffHeaderRow("KIROMIN", "BLOK 13, 14, 15, 16, 17 (PKT 1D)")}
                          {sortedKiromin.map((row) => renderRow(row))}
                          {renderRow(kirominTotal, true)}

                          {/* WAN */}
                          {renderStaffHeaderRow("WAN", "BLOK 18, 19, 20, 21, 22 (PKT 002)")}
                          {sortedWan.map((row) => renderRow(row))}
                          {renderRow(wanTotal, true)}

                          {/* LOT FELDA */}
                          {renderStaffHeaderRow(pkt3Label, isAdelaOrTunggal ? "BLOK 88 / LOT FELDA" : "PKT 003")}
                          {sortedFelda.length > 1 ? (
                            <>
                              {sortedFelda.map((row) => renderRow(row))}
                              {renderRow(lfRow, true)}
                            </>
                          ) : (
                            <>
                              {renderRow(lfRow)}
                              {renderRow(feldaTotal, true)}
                            </>
                          )}

                          {/* JUMLAH BESAR */}
                          {renderRow(grandTotal, false, true)}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Inline Report Containers - Separated into distinct clickable cards */}
      <div className="space-y-8">
        {/* JADUAL 1: LAPORAN HASIL BULANAN MENGIKUT BLOK */}
        <div
          onClick={() => setFullscreenTab("blok")}
          className="bg-white dark:bg-[#072d1f] border-y border-x-0 sm:border sm:rounded-2xl border-emerald-200 dark:border-slate-800/40 dark:text-emerald-100 shadow-xl shadow-emerald-900/10 p-4 md:p-6 cursor-pointer hover:border-emerald-500 dark:hover:border-emerald-500 transition-all relative group"
        >
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-emerald-100 dark:border-slate-800/80">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h4 className="text-xs sm:text-sm font-black text-slate-800 dark:text-emerald-100 uppercase tracking-wide">
                1. LAPORAN HASIL BULANAN MENGIKUT BLOK
              </h4>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-700/60 px-2.5 py-1 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-sm">
              <Maximize2 size={12} />
              <span>SKRIN PENUH LANDSKAP</span>
            </div>
          </div>

          <div ref={contentRef} className="overflow-x-auto custom-scrollbar">
            <table
              ref={tableRef}
              className="w-full border-collapse bg-white dark:bg-white"
              style={{
                minWidth:
                  isCapturing || isDownloadingPdf
                    ? "1120px"
                    : `${Math.max(1280, 1280 * ((effectiveZoom / 100) * effectiveScale))}px`,
              }}
            >
              {renderTableHeader()}
              <tbody className="text-[10px] text-slate-800 dark:text-slate-900">
                {sortedPkt1.map((row) => renderRow(row))}
                {renderRow(pkt1Total, true)}
                {sortedPkt2.map((row) => renderRow(row))}
                {renderRow(pkt2Total, true)}
                {renderRow(pkt12Total, true)}
                {ltRow && renderRow(ltRow)}
                {sortedFelda.length > 1 ? (
                  <>
                    {sortedFelda.map((row) => renderRow(row))}
                    {renderRow(lfRow, true)}
                  </>
                ) : (
                  renderRow(lfRow)
                )}
                {renderRow(grandTotal, false, true)}
              </tbody>
            </table>
          </div>
        </div>

        {/* JADUAL 2: LAPORAN PRESTASI BULANAN MENGIKUT STAFF / PENYELIA */}
        <div
          onClick={() => setFullscreenTab("staff")}
          className="bg-white dark:bg-[#072d1f] border-y border-x-0 sm:border sm:rounded-2xl border-emerald-200 dark:border-slate-800/40 dark:text-emerald-100 shadow-xl shadow-emerald-900/10 p-4 md:p-6 cursor-pointer hover:border-emerald-500 dark:hover:border-emerald-500 transition-all relative group"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 pb-2 border-b border-emerald-100 dark:border-slate-800/80 gap-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-700/20">
                <Users size={18} />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-black text-slate-800 dark:text-emerald-100 uppercase tracking-wide">
                  2. LAPORAN PRESTASI BULANAN MENGIKUT STAFF / PENYELIA
                </h4>
                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  PENGASINGAN BLOK MENGIKUT PENYELIA: AIDIL, ARIL, KIROMIN & WAN ({dbYear})
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-700/60 px-2.5 py-1 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-sm shrink-0">
              <Maximize2 size={12} />
              <span>SKRIN PENUH LANDSKAP</span>
            </div>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table
              className="w-full border-collapse bg-white dark:bg-white"
              style={{
                minWidth:
                  isCapturing || isDownloadingPdf
                    ? "1120px"
                    : `${Math.max(1280, 1280 * ((effectiveZoom / 100) * effectiveScale))}px`,
              }}
            >
              {renderTableHeader()}
              <tbody className="text-[10px] text-slate-800 dark:text-slate-900">
                {/* AIDIL / ADIB */}
                {renderStaffHeaderRow("AIDIL", "BLOK 1, 2, 3, 5, 6, 7 (PKT 1A & 1B)")}
                {sortedAidil.map((row) => renderRow(row))}
                {renderRow(aidilTotal, true)}

                {/* ARIL */}
                {renderStaffHeaderRow("ARIL", "BLOK 4, 8, 9, 10, 11, 12 (PKT 1C)")}
                {sortedAril.map((row) => renderRow(row))}
                {renderRow(arilTotal, true)}

                {/* KIROMIN */}
                {renderStaffHeaderRow("KIROMIN", "BLOK 13, 14, 15, 16, 17 (PKT 1D)")}
                {sortedKiromin.map((row) => renderRow(row))}
                {renderRow(kirominTotal, true)}

                {/* WAN */}
                {renderStaffHeaderRow("WAN", "BLOK 18, 19, 20, 21, 22 (PKT 002)")}
                {sortedWan.map((row) => renderRow(row))}
                {renderRow(wanTotal, true)}

                {/* LOT FELDA */}
                {renderStaffHeaderRow(pkt3Label, isAdelaOrTunggal ? "BLOK 88 / LOT FELDA" : "PKT 003")}
                {sortedFelda.length > 1 ? (
                  <>
                    {sortedFelda.map((row) => renderRow(row))}
                    {renderRow(lfRow, true)}
                  </>
                ) : (
                  <>
                    {renderRow(lfRow)}
                    {renderRow(feldaTotal, true)}
                  </>
                )}

                {/* JUMLAH BESAR */}
                {renderRow(grandTotal, false, true)}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-between items-center text-[10px] dark:text-emerald-100 font-bold uppercase tracking-widest px-2">
        <div className="flex gap-6">
          <span className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-md bg-emerald-50 dark:bg-emerald-800/80 border border-emerald-200 dark:border-emerald-700 shadow-sm" />{" "}
            Sub-Total
          </span>
          <span className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-md bg-emerald-800 dark:bg-emerald-400 border border-slate-900 dark:border-white shadow-md" />{" "}
            Jumlah Besar
          </span>
        </div>
        <p className="opacity-80">
          DIJANA SECARA AUTOMATIK OLEH SISTEM FPMSB TUNGGAL v4.1.0
        </p>
      </div>
    </div>
  );
};

export const HasilBulananTable = React.memo(HasilBulananTableComponent);

