import React, { Suspense } from 'react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import {
  LayoutDashboard, Loader2, Calendar, Target, TrendingUp, TrendingDown, ClipboardCheck,
  FileSpreadsheet, BarChart3, Package, CloudRain, ShieldCheck, AlertCircle,
  AlertTriangle, Play, ChevronRight, Share, FileText, ArrowRight, ZoomIn, ChevronDown, CircleDollarSign, Share2, Plus, ScanLine, Trophy, Sparkles, Lock, History, Users
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, LabelList, Brush, LineChart, Line, AreaChart, Area, Legend, ReferenceLine,
  ComposedChart, PieChart, Pie
} from 'recharts';

import { DigitalClock } from '../../../components/common/DigitalClock';
import { CardSkeleton, TableSkeleton } from '../../../components/common/LoadingSkeleton';
import { HasilBulananTable } from './HasilBulananTable';
import { ReportSummarySection } from './ReportSummarySection';
import { DashboardSubNav } from './DashboardSubNav';
import { MonthlyTrendAnalyticsSection } from './MonthlyTrendAnalyticsSection';
import { HargaBtsSection } from './HargaBtsSection';
import { BlockAnalyticsCharts } from './BlockAnalyticsCharts';
import { BlockPerformanceRanking } from './BlockPerformanceRanking';
import { FloatingInput } from '../../../components/ui/FloatingInput';
import {
  CHART_COLORS, TARGET_ANNUAL_PKT1, TARGET_ANNUAL_PKT2, TARGET_ANNUAL_FELDA,
  MONTHLY_TARGETS_2026, MASTER_DATA
} from '../../../utils/constants';

import { SejarahTab } from '../../sejarah/components/SejarahTab';
import { FertilizerModule } from '../../fertilizer/FertilizerModule';
import { MerumputModule } from '../../merumput/MerumputModule';
import { PruningModule } from '../../pruning/PruningModule';
import { PekerjaModule } from '../../pekerja/PekerjaModule';
import { StaffKpiView } from './StaffKpiView';
import { AbwView } from '../../hasil/components/AbwView';
import { BbcView } from '../../hasil/components/BbcView';
import { LaporanHujanView } from '../../hasil/components/LaporanHujanView';
import { LaporanView } from '../../hasil/components/LaporanView';
import { LaporanBacklogView } from '../../hasil/components/LaporanBacklogView';
import { LaporanProduktivitiView } from '../../hasil/components/LaporanProduktivitiView';
import { PenggredanView } from '../../kualiti/components/PenggredanView';
import { ExecutiveZoneDashboard } from './ExecutiveZoneDashboard';
import { WilayahEstatesSummarySection } from './WilayahEstatesSummarySection';
import { getActiveEstateId, ESTATE_CHANGED_EVENT, setRuntimeEstateId } from '../../../utils/estateContext';

const SubmoduleFallback = () => (
  <div className="space-y-4 p-2">
    <CardSkeleton className="grid-cols-1 md:grid-cols-3" count={3} />
  </div>
);

export const DashboardTab = (props: any) => {
  const {
      activeTab, authRole, isDarkMode, swipeDirection, handleSwipe, reportType,
      setReportType, showToast, reportTabs, analytics, activeHasilTab, setActiveHasilTab,
      activeKualitiTab = 'muda', setActiveKualitiTab,
      activeEfbTab = 'kpi', setActiveEfbTab,
      setShowFSA13Report, hujanData, chartPeriod, setChartPeriod, chartMetric, setChartMetric,
      showYtdChart, setShowYtdChart, showMonthlyTrendChart, setShowMonthlyTrendChart,
      showPriceTrendChart, setShowPriceTrendChart, showThekChart, setShowThekChart,
      showRankingCollapsed, setShowRankingCollapsed, showTrendCollapsed, setShowTrendCollapsed,
      showSummaryCollapsed, setShowSummaryCollapsed, showDetailsCollapsed, setShowDetailsCollapsed,
      setExpandedTrendChart, thekSortMode, setThekSortMode, thekHistoryView, setThekHistoryView,
      isThekExpanded, setIsThekExpanded, isPieExpanded, setIsPieExpanded,
      sharePreviewData,
      setSharePreviewData, rawData, isExporting, blockAnnualData, YIELD_DATA_2025, dashboardTrendView, setDashboardTrendView, showFSA13Report,  handleCopyReport, handleWhatsAppShare, showReportDatePicker, dashboardDate, setDashboardDate, executeWhatsAppShare, generateRCReport, tableToCaptureRef, captureTableScreenshot, isCapturing, setShowExportModal, handleDownloadPdf, isDownloadingPdf, handlePrint, handleShareBtsReport, isSharingBts, thekChartRef, historyChartData, setShowRanking, showRanking, setRankingPeriod, rankingPeriod, isReordering,
      setRecordToDelete, onEditRecord,
      onOpenMorningBriefing, onOpenManualSawit,
      // Pass EVERYTHING else implicitly
      ...rest
  } = props;

  const effectiveReportType = reportType === "kualiti_bts" ? activeKualitiTab : reportType;
  const validHasilTabs = ['kpi', 'sejarah', 'laporan', 'analitik', 'abw', 'bbc', 'hujan', 'backlog', 'produktiviti'];
  const currentHasilTab = (activeHasilTab && validHasilTabs.includes(activeHasilTab)) ? activeHasilTab : 'kpi';
  const currentEfbTab = (activeEfbTab && ['kpi', 'sejarah'].includes(activeEfbTab)) ? activeEfbTab : 'kpi';

  // Cari transaksi penghantaran BTS terkini
  const latestDelivery = React.useMemo(() => {
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) return null;
    const realTransactions = rawData.filter(
      (r: any) => r.tarikh && !String(r.no_resit || '').startsWith("EFB-HIST-") && (r.tan || 0) > 0
    );
    if (realTransactions.length === 0) return null;
    const sorted = [...realTransactions].sort((a: any, b: any) => (b.tarikh || "").localeCompare(a.tarikh || ""));
    return sorted[0];
  }, [rawData]);

  const todayIso = new Date().toISOString().split("T")[0];

  const [activeEstateId, setActiveEstateId] = React.useState<string>(() => props.activeEstateId || getActiveEstateId());
  const [hasilScope, setHasilScope] = React.useState<'estet' | 'all'>('estet');

  React.useEffect(() => {
    const handleEstateChange = (e: any) => {
      const newId = e?.detail?.estateId || getActiveEstateId();
      setActiveEstateId(newId);
    };
    window.addEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
    return () => window.removeEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
  }, []);

  const isWilayah = React.useMemo(() => {
    const cleanId = (activeEstateId || '').trim().toUpperCase();
    return cleanId === 'WILAYAH_JB' || cleanId === 'WJB' || cleanId === '0001' || cleanId === 'ALL' || cleanId.includes('WILAYAH');
  }, [activeEstateId]);

  return (
    <>
{/* TAB 2: DASHBOARD (Merged Summary + Analytics) */}
            {activeTab === "dashboard" && !!authRole && (
                <div
                  id="dashboard-tab-container"
                  className="w-full min-h-[70vh]"
                >
                  <motion.div
                    key={`dashboard-${reportType}`}
                    initial={{
                      opacity: 0,
                      x: swipeDirection === "left" ? 30 : -30,
                    }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{
                      opacity: 0,
                      x: swipeDirection === "left" ? -30 : 30,
                    }}
                    transition={{ duration: 0.3 }}
                    className="space-y-1.5 touch-pan-y pb-24"
                  >
                    {/* EXECUTIVE ZONE / WILAYAH PORTFOLIO OVERVIEW (For RC, OC, and optional FC/PF) */}
                    {(authRole === "rc" || authRole === "oc") && (
                      <ExecutiveZoneDashboard
                        authRole={authRole}
                        isDarkMode={isDarkMode}
                        onOpenMorningBriefing={props.onOpenMorningBriefing}
                        onOpenRCReportModal={() => {
                          if (props.setShowExportModal) props.setShowExportModal(true);
                        }}
                        showToast={showToast}
                      />
                    )}

                    {/* HEADER SUMMARY FOR ALL MODULES */}
                    <div className="flex flex-col items-center justify-center px-1 mb-2">
                      <div className="flex items-center justify-between w-full max-w-5xl px-1 gap-2">
                        <div className="flex flex-col items-start min-w-0">
                          <h2 className="text-[8.5px] sm:text-[9.5px] font-display font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                            <LayoutDashboard size={10} />
                            {reportTabs.find((t) => t.id === reportType)
                              ?.label || "Status"}
                          </h2>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[6.5px] sm:text-[7px] font-black uppercase tracking-wider border border-emerald-500/20">
                              <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                              Auto-Update Todate
                            </span>
                          </div>
                        </div>

                        {/* LIVE TODATE DATE & TIME DISPLAY */}
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 shadow-xs">
                          <Calendar size={11} className="text-emerald-500 shrink-0" />
                          <span className="text-[9px] font-bold font-mono text-slate-700 dark:text-slate-200">
                            {new Date().toLocaleDateString('ms-MY', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </span>
                          <div className="w-[1px] h-2.5 bg-slate-300 dark:bg-slate-700 mx-0.5" />
                          <DigitalClock />
                        </div>
                      </div>
                    </div>

                    {/* BAJA & MERUMPUT & PRUNING SPECIAL VIEWS */}
                    <Suspense fallback={<SubmoduleFallback />}>
                      {reportType === "baja" ? (
                        <FertilizerModule
                          authRole={authRole}
                          isDarkMode={isDarkMode}
                        />
                      ) : reportType === "merumput" ? (
                        <MerumputModule
                          authRole={authRole}
                          isDarkMode={isDarkMode}
                          onShowToast={showToast}
                        />
                      ) : reportType === "pruning" ? (
                        <PruningModule
                          isDarkMode={isDarkMode}
                          onShowToast={showToast}
                        />
                      ) : reportType === "pekerja" ? (
                        <PekerjaModule
                          authRole={authRole}
                          isDarkMode={isDarkMode}
                          onShowToast={showToast}
                        />
                      ) : reportType === "kpi_staff" ? (
                        <StaffKpiView isDarkMode={isDarkMode} showToast={showToast} />
                      ) : null}
                    </Suspense>

                    {reportType !== "baja" && reportType !== "merumput" && reportType !== "pruning" && reportType !== "pekerja" && reportType !== "kpi_staff" && (
                      <>
                        <DashboardSubNav
                          reportType={reportType}
                          effectiveReportType={effectiveReportType}
                          currentHasilTab={currentHasilTab}
                          currentEfbTab={currentEfbTab}
                          setActiveKualitiTab={setActiveKualitiTab}
                          setActiveHasilTab={setActiveHasilTab}
                          setActiveEfbTab={setActiveEfbTab}
                          setShowFSA13Report={setShowFSA13Report}
                        />

      <Suspense fallback={<SubmoduleFallback />}>
        {reportType === "hasil" && currentHasilTab === 'sejarah' && (
          <SejarahTab
            rawData={rawData}
            historyFilterDate={dashboardDate}
            setHistoryFilterDate={setDashboardDate}
            setShowExportModal={setShowExportModal}
            setRecordToDelete={setRecordToDelete}
            onEditRecord={onEditRecord}
            authRole={authRole}
            defaultMode="bts"
            hideModeToggle={true}
            customTitle="SEJARAH HASIL (BTS)"
          />
        )}

        {reportType === "efb" && currentEfbTab === 'sejarah' && (
          <SejarahTab
            rawData={rawData}
            historyFilterDate={dashboardDate}
            setHistoryFilterDate={setDashboardDate}
            setShowExportModal={setShowExportModal}
            setRecordToDelete={setRecordToDelete}
            onEditRecord={onEditRecord}
            authRole={authRole}
            defaultMode="efb"
            hideModeToggle={true}
            customTitle="SEJARAH REKOD EFB"
          />
        )}
      </Suspense>

      <Suspense fallback={<SubmoduleFallback />}>
        {reportType === "hasil" && currentHasilTab === 'abw' && <AbwView />}
        
        {reportType === "hasil" && currentHasilTab === 'bbc' && <BbcView />}

        {reportType === "hasil" && currentHasilTab === 'hujan' && <LaporanHujanView data={hujanData} />}
        
        {reportType === "hasil" && currentHasilTab === 'backlog' && <LaporanBacklogView />}

        {reportType === "hasil" && currentHasilTab === 'produktiviti' && (
          <LaporanProduktivitiView rawData={rawData} selectedDate={dashboardDate} />
        )}

        {reportType === "kualiti_bts" && activeKualitiTab === 'penggredan' && (
          <PenggredanView onShowToast={showToast} />
        )}
      </Suspense>
      
                        {((reportType === "hasil" && currentHasilTab === 'kpi') || (reportType === "kualiti_bts" && activeKualitiTab !== 'penggredan') || (reportType === "efb" && currentEfbTab === 'kpi') || (reportType !== "hasil" && reportType !== "kualiti_bts" && reportType !== "efb")) && (
                          <div className="relative pt-1">
                            {/* Overall Section Header & Scope Switcher */}
                            <div className="flex items-center justify-between pb-1.5 px-1">
                              <div className="flex items-center gap-1.5">
                                <div className="bg-slate-900 dark:bg-slate-800 border border-slate-800 dark:border-slate-700 shadow-md px-1.5 py-0.5 rounded-sm">
                                  <p className="text-[6px] font-black text-white uppercase tracking-[0.1em] leading-none">
                                    KESELURUHAN
                                  </p>
                                </div>
                                {reportType === "hasil" && (
                                  <div className="inline-flex items-center bg-slate-200/90 dark:bg-slate-800/90 p-0.5 rounded-lg border border-slate-300/60 dark:border-slate-700/60 shadow-xs">
                                    <button
                                      type="button"
                                      onClick={() => setHasilScope('estet')}
                                      className={`px-2 py-0.5 rounded-md text-[6.5px] font-black uppercase tracking-wider transition-all ${
                                        hasilScope === 'estet'
                                          ? 'bg-emerald-600 text-white shadow-xs'
                                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                      }`}
                                      title="Paparan Estet Utama (Pkt 1 & 2 sahaja)"
                                    >
                                      Estet Pkt 1 & 2
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setHasilScope('all')}
                                      className={`px-2 py-0.5 rounded-md text-[6.5px] font-black uppercase tracking-wider transition-all ${
                                        hasilScope === 'all'
                                          ? 'bg-emerald-600 text-white shadow-xs'
                                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                      }`}
                                      title="Paparan Keseluruhan Portfolio (+ Lot Felda)"
                                    >
                                      + Lot Felda
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setShowSummaryCollapsed(!showSummaryCollapsed)
                                  }
                                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
                                >
                                  <motion.div
                                    animate={{
                                      rotate: showSummaryCollapsed ? 0 : 180,
                                    }}
                                  >
                                    <ChevronDown
                                      size={12}
                                      className="text-slate-400"
                                    />
                                  </motion.div>
                                </button>
                              </div>
                            </div>

                          <AnimatePresence>
                            {!showSummaryCollapsed && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="grid grid-cols-3 gap-1 mb-6 px-1">
                                  <ReportSummarySection
                                    type={effectiveReportType}
                                    data={analytics.day}
                                    period="day"
                                    isDarkMode={isDarkMode}
                                    mode="hero"
                                    scope={hasilScope}
                                    onToggleScope={setHasilScope}
                                  />
                                  <ReportSummarySection
                                    type={effectiveReportType}
                                    data={analytics.month}
                                    period="month"
                                    isDarkMode={isDarkMode}
                                    mode="hero"
                                    scope={hasilScope}
                                    onToggleScope={setHasilScope}
                                  />
                                  <ReportSummarySection
                                    type={effectiveReportType}
                                    data={analytics.year}
                                    period="year"
                                    isDarkMode={isDarkMode}
                                    mode="hero"
                                    scope={hasilScope}
                                    onToggleScope={setHasilScope}
                                  />
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}

                        {/* SUBSECTION DETAILS */}
                        {((reportType === "hasil" && currentHasilTab === 'kpi') || (reportType === "kualiti_bts" && activeKualitiTab !== 'penggredan') || (reportType !== "hasil" && reportType !== "kualiti_bts" && reportType !== "efb")) && (
                          isWilayah ? (
                            <WilayahEstatesSummarySection
                              rawData={rawData}
                              dashboardDate={dashboardDate || todayIso}
                              isDarkMode={isDarkMode}
                              blockAnnualData={blockAnnualData}
                              onSelectEstate={(estId) => {
                                setRuntimeEstateId(estId);
                                showToast?.('info', `Memaparkan perincian ladang ${estId}...`);
                              }}
                            />
                          ) : (
                          <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-[24px] border border-slate-200 dark:border-slate-800 mb-4 relative mt-6">
                          <div className="overflow-hidden">
                            <div className="grid grid-cols-3 gap-x-2 mb-2 px-1">
                              <div className="flex items-center gap-1 justify-center opacity-90 pb-1 border-b border-emerald-500/20">
                                <Calendar size={8} className="text-emerald-500" />
                                <h3 className="text-[7px] font-black text-emerald-500 uppercase tracking-widest leading-none">
                                  HARI INI
                                </h3>
                              </div>
                              <div className="flex items-center gap-1 justify-center opacity-90 pb-1 border-b border-emerald-500/20">
                                <Calendar size={8} className="text-emerald-500" />
                                <h3 className="text-[7px] font-black text-emerald-500 uppercase tracking-widest leading-none">
                                  BULAN INI
                                </h3>
                              </div>
                              <div className="flex items-center gap-1 justify-center opacity-90 pb-1 border-b border-emerald-500/20">
                                <Calendar size={8} className="text-emerald-500" />
                                <h3 className="text-[7px] font-black text-emerald-500 uppercase tracking-widest leading-none">
                                  TAHUN INI (YTD)
                                </h3>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-x-2">
                              <ReportSummarySection
                                type={effectiveReportType}
                                data={analytics.day}
                                period="day"
                                isDarkMode={isDarkMode}
                                mode="details"
                              />
                              <ReportSummarySection
                                type={effectiveReportType}
                                data={analytics.month}
                                period="month"
                                isDarkMode={isDarkMode}
                                mode="details"
                              />
                              <ReportSummarySection
                                type={effectiveReportType}
                                data={analytics.year}
                                period="year"
                                isDarkMode={isDarkMode}
                                mode="details"
                              />
                            </div>
                          </div>
                        </div>
                          )
                        )}

                        {/* RANKING CARDS - ONLY FOR ANALITIK TAB */}
                        {reportType === "hasil" && currentHasilTab === 'analitik' && (
                          <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 shadow-md border border-slate-100 dark:border-slate-800 mb-4 relative">
                            <div className={`flex justify-between items-center ${showRankingCollapsed ? "mb-0" : "mb-4"}`}>
                              <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2 pl-1">
                                <TrendingUp size={12} />
                                Blok Performance
                              </h3>
                              <div className="flex items-center gap-1">
                                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200/50 dark:border-white/5 mr-2">
                                  <button
                                    onClick={() => setRankingPeriod("month")}
                                    className={`px-2 py-1 rounded-md text-[8px] font-black uppercase transition-all ${rankingPeriod === "month" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
                                  >
                                    Bulan
                                  </button>
                                  <button
                                    onClick={() => setRankingPeriod("year")}
                                    className={`px-2 py-1 rounded-md text-[8px] font-black uppercase transition-all ${rankingPeriod === "year" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
                                  >
                                    YTD
                                  </button>
                                </div>
                                <button
                                  onClick={() =>
                                    setShowRankingCollapsed(
                                      !showRankingCollapsed,
                                    )
                                  }
                                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
                                >
                                  <motion.div
                                    animate={{
                                      rotate: showRankingCollapsed ? 0 : 180,
                                    }}
                                  >
                                    <ChevronDown
                                      size={14}
                                      className="text-slate-400"
                                    />
                                  </motion.div>
                                </button>
                              </div>
                            </div>
                            <AnimatePresence>
                              {!showRankingCollapsed && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <div className="bg-emerald-500/10 text-emerald-500 py-1.5 text-center rounded-lg">
                                        <p className="text-[8px] font-black uppercase">
                                          Top 5
                                        </p>
                                      </div>
                                      {(
                                        analytics[rankingPeriod].rankedBlok ||
                                        []
                                      )
                                        .slice(0, 5)
                                        .map((b: any, idx: number) => (
                                          <div
                                            key={idx}
                                            className="flex justify-between items-center px-1"
                                          >
                                            <div className="flex items-center gap-2">
                                              <span className="text-[10px] font-black text-slate-400 w-3">
                                                {idx + 1}
                                              </span>
                                              <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                                                Blok {b.blok}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <span className="text-[10px] font-black text-slate-500">
                                                {b.yieldHek.toFixed(2)}
                                              </span>
                                              <span
                                                className={`text-[10px] font-black ${b.targetPct >= 100 ? "text-emerald-500" : "text-amber-500"}`}
                                              >
                                                {Math.round(b.targetPct)}%
                                              </span>
                                            </div>
                                          </div>
                                        ))}
                                    </div>
                                    <div className="space-y-2">
                                      <div className="bg-rose-500/10 text-rose-500 py-1.5 text-center rounded-lg">
                                        <p className="text-[8px] font-black uppercase">
                                          Bottom 5
                                        </p>
                                      </div>
                                      {(
                                        analytics[rankingPeriod].rankedBlok ||
                                        []
                                      )
                                        .slice(-5)
                                        .reverse()
                                        .map((b: any, idx: number) => (
                                          <div
                                            key={idx}
                                            className="flex justify-between items-center px-1"
                                          >
                                            <div className="flex items-center gap-2">
                                              <span className="text-[10px] font-black text-slate-400 w-3">
                                                {(
                                                  analytics[rankingPeriod]
                                                    .rankedBlok || []
                                                ).length - idx}
                                              </span>
                                              <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                                                Blok {b.blok}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <span className="text-[10px] font-black text-slate-500">
                                                {b.yieldHek.toFixed(2)}
                                              </span>
                                              <span className="text-[10px] font-black text-rose-500">
                                                {Math.round(b.targetPct)}%
                                              </span>
                                            </div>
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}

                        {/* TREND ANALYTICS SECTION */}
                        <MonthlyTrendAnalyticsSection
                          effectiveReportType={effectiveReportType}
                          reportType={reportType}
                          currentHasilTab={currentHasilTab}
                          dashboardTrendView={dashboardTrendView}
                          setDashboardTrendView={setDashboardTrendView}
                          showTrendCollapsed={showTrendCollapsed}
                          setShowTrendCollapsed={setShowTrendCollapsed}
                          analytics={analytics}
                          isDarkMode={isDarkMode}
                          dashboardDate={dashboardDate}
                          setDashboardDate={setDashboardDate}
                        />

                          {/* LIVE FSA 13 REPORT PREVIEW */}
                          {reportType === "hasil" && currentHasilTab === 'laporan' && (
                            <LaporanView
                              showFSA13Report={showFSA13Report}
                              setShowFSA13Report={setShowFSA13Report}
                              handleCopyReport={handleCopyReport}
                              handleWhatsAppShare={handleWhatsAppShare}
                              showReportDatePicker={showReportDatePicker}
                              dashboardDate={dashboardDate}
                              setDashboardDate={setDashboardDate}
                              executeWhatsAppShare={executeWhatsAppShare}
                              generateRCReport={generateRCReport}
                              tableToCaptureRef={tableToCaptureRef}
                              analytics={analytics}
                              isDarkMode={isDarkMode}
                              captureTableScreenshot={captureTableScreenshot}
                              isCapturing={isCapturing}
                              setShowExportModal={setShowExportModal}
                              handleDownloadPdf={handleDownloadPdf}
                              isDownloadingPdf={isDownloadingPdf}
                              handlePrint={handlePrint}
                            />
                          )}

                        {/* HARGA BTS DAILY REPORT LIST */}
                        {reportType === "harga" && (
                          <HargaBtsSection
                            analytics={analytics}
                            showPriceTrendChart={showPriceTrendChart}
                            setShowPriceTrendChart={setShowPriceTrendChart}
                            isDarkMode={isDarkMode}
                            handleShareBtsReport={handleShareBtsReport}
                            isSharingBts={isSharingBts}
                          />
                        )}

                        {/* CHART SECTION: PRESTASI ANALITIK */}
                        <BlockAnalyticsCharts
                          thekChartRef={thekChartRef}
                          showThekChart={showThekChart}
                          setShowThekChart={setShowThekChart}
                          chartMetric={chartMetric}
                          thekSortMode={thekSortMode}
                          setThekSortMode={setThekSortMode}
                          chartPeriod={chartPeriod}
                          setChartPeriod={setChartPeriod}
                          reportType={reportType}
                          thekHistoryView={thekHistoryView}
                          setThekHistoryView={setThekHistoryView}
                          historyChartData={historyChartData}
                          isDarkMode={isDarkMode}
                          analytics={analytics}
                          setIsThekExpanded={setIsThekExpanded}
                          setIsPieExpanded={setIsPieExpanded}
                          currentHasilTab={currentHasilTab}
                          activeKualitiTab={activeKualitiTab}
                          dashboardDate={dashboardDate}
                          setDashboardDate={setDashboardDate}
                        />

                        {/* Togol Ranking */}
                        <BlockPerformanceRanking
                          reportType={reportType}
                          currentHasilTab={currentHasilTab}
                          activeKualitiTab={activeKualitiTab}
                          showRanking={showRanking}
                          setShowRanking={setShowRanking}
                          rankingPeriod={rankingPeriod}
                          setRankingPeriod={setRankingPeriod}
                          analytics={analytics}
                          effectiveReportType={effectiveReportType}
                          dashboardDate={dashboardDate}
                          setDashboardDate={setDashboardDate}
                        />
                      </>
                    )}
                  </motion.div>
                </div>
              )}
    </>
  );
};
