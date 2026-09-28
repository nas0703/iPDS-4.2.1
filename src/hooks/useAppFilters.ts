import { useState, useEffect, useRef } from "react";
import { getTodayDateString } from "../utils/formatters";

export const getDefaultAndSavedTabs = (): any[] => {
  const defaultTabs = [
    { id: "hasil", label: "Hasil" },
    { id: "kualiti_bts", label: "Kualiti BTS" },
    { id: "baja", label: "Membaja" },
    { id: "merumput", label: "Merumput" },
    { id: "pruning", label: "Pruning" },
    { id: "pekerja", label: "iPDS Muster" },
    { id: "harga", label: "Harga Bts" },
    { id: "efb", label: "Efb" },
    { id: "kpi_staff", label: "KPI Staff" },
  ];

  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("report_tabs_order_v7");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        let finalTabs = [...parsed];
        finalTabs = finalTabs.filter((t: any) => t.id !== "muda" && t.id !== "kpa_kpg");
        finalTabs = finalTabs.map((t: any) => t.id === "pekerja" ? { ...t, label: "iPDS Muster" } : t);
        const hasKualitiBts = finalTabs.some((t: any) => t.id === "kualiti_bts");
        if (!hasKualitiBts) {
          const hasilIdx = finalTabs.findIndex((t: any) => t.id === "hasil");
          if (hasilIdx !== -1) {
            finalTabs.splice(hasilIdx + 1, 0, { id: "kualiti_bts", label: "Kualiti BTS" });
          } else {
            finalTabs.unshift({ id: "kualiti_bts", label: "Kualiti BTS" });
          }
        }
        if (finalTabs.length <= 1) {
          return defaultTabs;
        }
        return finalTabs;
      } catch (e) {
        return defaultTabs;
      }
    }
  }
  return defaultTabs;
};

export function useAppFilters() {
  const [dashboardDate, setDashboardDateState] = useState(() => {
    return getTodayDateString();
  });

  // Auto-sync dashboardDate to current date ("todate hari semasa")
  useEffect(() => {
    const today = getTodayDateString();
    if (dashboardDate !== today) {
      setDashboardDateState(today);
    }
    const interval = setInterval(() => {
      const currentToday = getTodayDateString();
      setDashboardDateState((prev) => (prev !== currentToday ? currentToday : prev));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const setDashboardDate = (newDate: string | ((prev: string) => string)) => {
    setDashboardDateState((prev) => {
      const resolved = typeof newDate === "function" ? newDate(prev) : newDate;
      return resolved || getTodayDateString();
    });
  };

  const [historyFilterDate, setHistoryFilterDate] = useState<string>("");
  const [selectedBlockFilter, setSelectedBlockFilter] = useState<string>("all");
  const [selectedPactFilter, setSelectedPactFilter] = useState<string>("all");

  const [reportType, setReportType] = useState<
    | "hasil"
    | "kualiti_bts"
    | "muda"
    | "kpa_kpg"
    | "harga"
    | "efb"
    | "efc_format"
    | "baja"
    | "pruning"
    | "merumput"
    | "pekerja"
    | "kpi_staff"
  >("hasil");

  const [activeKualitiTab, setActiveKualitiTab] = useState<'muda' | 'kpa_kpg' | 'penggredan'>('muda');
  const [activeHasilTab, setActiveHasilTab] = useState<'kpi' | 'kpi_staff' | 'laporan' | 'analitik' | 'abw' | 'bbc' | 'hujan' | 'backlog' | 'sejarah' | 'produktiviti'>('kpi');
  const [activeEfbTab, setActiveEfbTab] = useState<'kpi' | 'sejarah'>('kpi');
  const [reportTabs, setReportTabs] = useState<any[]>(() => getDefaultAndSavedTabs());

  const [showReportDatePicker, setShowReportDatePicker] = useState(false);
  const [showRanking, setShowRanking] = useState(false);
  const [rankingPeriod, setRankingPeriod] = useState<"month" | "year" | "yoy">("month");
  const [chartPeriod, setChartPeriod] = useState<"day" | "month" | "year" | "history" | "monthly_trend">("month");
  const [chartMetric, setChartMetric] = useState<"yield" | "muda" | "kpg" | "efb">("yield");

  const [showYtdChart, setShowYtdChart] = useState(true);
  const [showMonthlyTrendChart, setShowMonthlyTrendChart] = useState(true);
  const [showPriceTrendChart, setShowPriceTrendChart] = useState(true);
  const [showThekChart, setShowThekChart] = useState(true);

  const [showRankingCollapsed, setShowRankingCollapsed] = useState(false);
  const [showTrendCollapsed, setShowTrendCollapsed] = useState(false);
  const [showSummaryCollapsed, setShowSummaryCollapsed] = useState(false);
  const [showDetailsCollapsed, setShowDetailsCollapsed] = useState(false);

  const [showFSA13Report, setShowFSA13Report] = useState(true);
  const [dashboardTrendView, setDashboardTrendView] = useState<"overall" | "pkt1" | "pkt2" | "felda">("overall");
  const [thekSortMode, setThekSortMode] = useState<"blok" | "desc" | "asc">("blok");
  const [thekHistoryView, setThekHistoryView] = useState<"overall" | "pkt1" | "pkt2" | "felda">("overall");

  const [expandedTrendChart, setExpandedTrendChart] = useState<"overall" | "pkt1" | "pkt2" | "felda" | null>(null);
  const [isThekExpanded, setIsThekExpanded] = useState(false);
  const [isPieExpanded, setIsPieExpanded] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [showNewFeatures, setShowNewFeatures] = useState(false);

  const [isReordering, setIsReordering] = useState(false);
  const longPressTimer = useRef<any>(null);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right">("left");
  const [isNavigating, setIsNavigating] = useState(false);

  // Sync chart metric with report type
  useEffect(() => {
    let targetMetric: "yield" | "muda" | "kpg" | "efb" = "yield";
    const currentType = reportType === "kualiti_bts" ? activeKualitiTab : reportType;
    if (currentType === "muda") targetMetric = "muda";
    else if (currentType === "kpa_kpg") targetMetric = "kpg";
    else if (currentType === "efb") targetMetric = "efb";

    setChartMetric(targetMetric);

    if (reportType !== "hasil" && reportType !== "kualiti_bts" && chartPeriod === "history") {
      setChartPeriod("month");
    }
  }, [reportType, activeKualitiTab, chartPeriod]);

  const handleSwipe = (direction: "left" | "right") => {
    if (isNavigating) return;

    setSwipeDirection(direction);
    const types = reportTabs.map((r) => r.id);
    const currentIndex = types.indexOf(reportType);

    if (currentIndex === -1) return;

    setIsNavigating(true);
    let nextIndex;
    if (direction === "left") {
      nextIndex = (currentIndex + 1) % types.length;
    } else {
      nextIndex = (currentIndex - 1 + types.length) % types.length;
    }

    const nextType = types[nextIndex];
    setReportType(nextType);

    setTimeout(() => {
      setIsNavigating(false);
    }, 400);
  };

  return {
    dashboardDate,
    setDashboardDate,
    showReportDatePicker,
    setShowReportDatePicker,
    historyFilterDate,
    setHistoryFilterDate,
    selectedBlockFilter,
    setSelectedBlockFilter,
    selectedPactFilter,
    setSelectedPactFilter,
    reportType,
    setReportType,
    activeKualitiTab,
    setActiveKualitiTab,
    activeHasilTab,
    setActiveHasilTab,
    activeEfbTab,
    setActiveEfbTab,
    reportTabs,
    setReportTabs,
    showRanking,
    setShowRanking,
    rankingPeriod,
    setRankingPeriod,
    chartPeriod,
    setChartPeriod,
    chartMetric,
    setChartMetric,
    showYtdChart,
    setShowYtdChart,
    showMonthlyTrendChart,
    setShowMonthlyTrendChart,
    showPriceTrendChart,
    setShowPriceTrendChart,
    showThekChart,
    setShowThekChart,
    showRankingCollapsed,
    setShowRankingCollapsed,
    showTrendCollapsed,
    setShowTrendCollapsed,
    showSummaryCollapsed,
    setShowSummaryCollapsed,
    showDetailsCollapsed,
    setShowDetailsCollapsed,
    showFSA13Report,
    setShowFSA13Report,
    dashboardTrendView,
    setDashboardTrendView,
    thekSortMode,
    setThekSortMode,
    thekHistoryView,
    setThekHistoryView,
    expandedTrendChart,
    setExpandedTrendChart,
    isThekExpanded,
    setIsThekExpanded,
    isPieExpanded,
    setIsPieExpanded,
    isHistoryExpanded,
    setIsHistoryExpanded,
    showNewFeatures,
    setShowNewFeatures,
    isReordering,
    setIsReordering,
    longPressTimer,
    swipeDirection,
    handleSwipe,
  };
}
