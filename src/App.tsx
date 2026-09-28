/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, Suspense } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertTriangle,
  Database,
  Loader2,
} from "lucide-react";

import { YIELD_DATA_2025 } from "./utils/constants";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { OfflineStatusBanner } from "./components/common/OfflineStatusBanner";
import { GlobalToast } from "./components/common/GlobalToast";

// Layout & Navigation
import { Header } from "./layout/Header";
import { BottomNav } from "./layout/BottomNav";

// Auth & Screens
import { LoginScreen } from "./features/auth/components/LoginScreen";
import { useAuth } from "./features/auth/hooks/useAuth";
import { useIdleTimeout } from "./features/auth/hooks/useIdleTimeout";

// Domain Custom Hooks
import { useAppUIState } from "./hooks/useAppUIState";
import { useAppFilters, getDefaultAndSavedTabs } from "./hooks/useAppFilters";
import { useRainfallData } from "./hooks/useRainfallData";
import { useTransactionState } from "./hooks/useTransactionState";
import { useExportState } from "./hooks/useExportState";
import { useHasilAnalytics } from "./features/hasil/hooks/useHasilAnalytics";
import { getActiveEstateId, ESTATE_CHANGED_EVENT } from "./utils/estateContext";

// Primary Tab Views (Direct static imports prevent chunk version skew & dual React instance errors)
import { DashboardTab } from "./features/dashboard/components/DashboardTab";
import { InputTab } from "./features/input/components/InputTab";
import { SejarahTab } from "./features/sejarah/components/SejarahTab";
import { AiExecutiveView } from "./features/ai_executive/components/AiExecutiveView";

// Container for All Modal Dialogs (Dynamic / Lazy-loaded for light memory footprint)
import { AppModalsContainer } from "./layout/AppModalsContainer";
import { generateRCReport } from "./features/export/services/rcReportService";
import { OcrScanningOverlay } from "./components/common/OcrScanningOverlay";
import { EstateStandbyBanner } from "./components/common/EstateStandbyBanner";

const TabLoadingFallback = () => (
  <div className="w-full flex items-center justify-center min-h-[50vh] p-8">
    <div className="flex flex-col items-center gap-3 bg-white/80 dark:bg-slate-900/80 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm backdrop-blur-sm">
      <Loader2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400 animate-spin" />
      <span className="text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">Memuatkan Paparan...</span>
    </div>
  </div>
);

export function App() {
  const [showMorningBriefing, setShowMorningBriefing] = useState(false);
  const [aiExecutiveSubmodule, setAiExecutiveSubmodule] = useState<'briefing' | 'msl'>('briefing');
  const [showManualSawit, setShowManualSawit] = useState(false);
  const [showWeedVisionModal, setShowWeedVisionModal] = useState(false);

  // Navigation & UI State
  const {
    activeTab,
    setActiveTab,
    direction,
    handleTabChange,
    handleMainTabSwipe,
  } = useAppUIState();

  // App Filters & View State
  const {
    dashboardDate,
    setDashboardDate,
    showReportDatePicker,
    historyFilterDate,
    setHistoryFilterDate,
    selectedBlockFilter,
    selectedPactFilter,
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
  } = useAppFilters();

  // Rainfall Data Management
  const { hujanData, handleAddHujan } = useRainfallData();

  // Modal Visibility States
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSystemHealthModal, setShowSystemHealthModal] = useState(false);
  const [showNewFeaturesModal, setShowNewFeaturesModal] = useState(false);
  const [showBacklogLoginModal, setShowBacklogLoginModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMasterDatasetModal, setShowMasterDatasetModal] = useState(false);
  const [showEstateSwitcherModal, setShowEstateSwitcherModal] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Theme Management
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      return (
        saved === "dark" ||
        (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)
      );
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  // Auth Hook
  const {
    authRole,
    pin,
    loginError,
    deviceApprovalState,
    setDeviceApprovalState,
    handlePinPress,
    handleDeletePress,
    handleQuickLogin,
    verifyStaffCredentials,
    verifyPasswordOnServer,
    handleLogout,
  } = useAuth({
    onLoginSuccess: (role) => {
      if (role === "eqi") {
        setActiveTab("dashboard");
        setReportType("kualiti_bts");
        setActiveKualitiTab("penggredan");
        setReportTabs([{ id: "kualiti_bts", label: "Kualiti BTS" }]);
      } else if (role === "staff") {
        setActiveTab("dashboard");
        setReportType("hasil");
        setActiveHasilTab("kpi");
        setReportTabs([
          { id: "hasil", label: "Hasil" },
          { id: "efb", label: "Efb" },
        ]);
      } else {
        setActiveTab("dashboard");
        setReportType("hasil");
        setActiveHasilTab("kpi");
        setReportTabs(getDefaultAndSavedTabs());
      }
      setShowUserMenu(false);

      const backlogSessionKey = "backlog_app_session_modal_v2_premium";
      const backlogCountKey = "backlog_login_modal_count_v2_premium";
      const hasBacklogShownThisSession = sessionStorage.getItem(backlogSessionKey) === "true";
      if (!hasBacklogShownThisSession) {
        const storedCount = localStorage.getItem(backlogCountKey);
        const shownCount = storedCount ? parseInt(storedCount, 10) : 0;
        if (shownCount < 7) {
          setShowBacklogLoginModal(true);
          localStorage.setItem(backlogCountKey, String(shownCount + 1));
          sessionStorage.setItem(backlogSessionKey, "true");
          return;
        }
      }

      const sessionKey = "ipds_v352_features_session_v1";
      const countKey = "ipds_v352_features_login_count_v1";
      const hasShownThisSession = sessionStorage.getItem(sessionKey) === "true";
      if (!hasShownThisSession) {
        const storedCount = localStorage.getItem(countKey);
        const shownCount = storedCount ? parseInt(storedCount, 10) : 0;
        if (shownCount < 7) {
          setShowNewFeaturesModal(true);
          localStorage.setItem(countKey, String(shownCount + 1));
          sessionStorage.setItem(sessionKey, "true");
        }
      }
    },
    onLogout: () => {
      setActiveTab("dashboard");
      setReportType("hasil");
      setActiveHasilTab("kpi");
      setShowUserMenu(false);
      setReportTabs(getDefaultAndSavedTabs());
    },
  });

  // 30-Minute Idle Session Timeout Guard (with 60-second warning countdown)
  const {
    showWarning: showIdleWarning,
    secondsRemaining: idleSecondsRemaining,
    extendSession: extendIdleSession,
  } = useIdleTimeout({
    timeoutMs: 30 * 60 * 1000, // 30 minutes
    warningMs: 60 * 1000,      // 60 seconds warning
    enabled: Boolean(authRole),
    onTimeout: () => {
      handleLogout();
    },
  });

  // Enforce role-based module and tab restrictions
  // EQI: Hanya Kualiti BTS sahaja
  // Kerani Operasi (Staff): Hanya Hasil dan EFB sahaja
  useEffect(() => {
    if (authRole === "eqi") {
      const isEqiOnly = reportTabs.length === 1 && reportTabs[0].id === "kualiti_bts";
      if (!isEqiOnly) {
        setReportTabs([{ id: "kualiti_bts", label: "Kualiti BTS" }]);
      }
      if (reportType !== "kualiti_bts") {
        setReportType("kualiti_bts");
      }
      if (activeTab === "ai_executive") {
        setActiveTab("dashboard");
      }
    } else if (authRole === "staff") {
      const isStaffOnly =
        reportTabs.length === 2 &&
        reportTabs.some((t) => t.id === "hasil") &&
        reportTabs.some((t) => t.id === "efb");
      if (!isStaffOnly) {
        setReportTabs([
          { id: "hasil", label: "Hasil" },
          { id: "efb", label: "Efb" },
        ]);
      }
      if (reportType !== "hasil" && reportType !== "efb") {
        setReportType("hasil");
      }
      if (activeTab === "ai_executive") {
        setActiveTab("dashboard");
      }
    }
  }, [authRole, reportTabs, reportType, activeTab, setReportTabs, setReportType, setActiveTab]);

  // Transaction & Supabase Data Hook
  const {
    formData,
    setFormData,
    resetFormData,
    rawData,
    blockAnnualData,
    isProcessing,
    isScanning,
    toast,
    setToast,
    showToast,
    recordToDelete,
    setRecordToDelete,
    editingRecordId,
    setEditingRecordId,
    showDeleteAllModal,
    setShowDeleteAllModal,
    showDateVerificationModal,
    setShowDateVerificationModal,
    pendingOcrVerification,
    handleConfirmOcrDate,
    handleConfirmAndSaveDirectly,
    configStatus,
    fileInputRef,
    uploadInputRef,
    fetchData,
    checkConfig,
    handleDeleteRecord,
    handleDeleteAllRecords,
    handleEditRecord,
    submitTransaction,
    handleOcrScan,
  } = useTransactionState({
    authRole,
    setActiveTab,
    setDashboardDate,
    setHistoryFilterDate,
    setShowUserMenu,
  });

  // Estate Context State for Executive & Multi-Estate Views
  const [activeEstateId, setActiveEstateId] = useState<string>(() => getActiveEstateId());

  useEffect(() => {
    const handleEstateChange = (e: any) => {
      const newId = e?.detail?.estateId || getActiveEstateId();
      setActiveEstateId(newId);
    };
    window.addEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
    return () => window.removeEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
  }, []);

  // Analytics Hook
  const { combinedData, analytics, historyChartData } = useHasilAnalytics({
    rawData,
    dashboardDate,
    reportType,
    rankingPeriod,
    blockAnnualData,
    selectedBlockFilter,
    selectedPactFilter,
    thekHistoryView,
    activeEstateId,
  });

  // Export State & Services Hook
  const {
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
    thekChartRef,
    tableToCaptureRef,
    handleExportToExcel,
    handleExportToPPTX,
    handleCaptureScreenshot,
    handleDownloadPdf,
    handleShareBts,
    handleWhatsAppShare,
    handleCopyReport,
  } = useExportState({
    rawData,
    reportType,
    chartPeriod,
    isDarkMode,
    analytics,
    showToast,
  });

  // Close User Menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        const target = event.target as HTMLElement;
        if (target && target.closest(".bottom-nav-profile-btn")) {
          return;
        }
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // VIEW: LOG MASUK (KOD LADANG + NO. KAKITANGAN & PIN PAD)
  if (!authRole) {
    return (
      <LoginScreen
        pin={pin}
        loginError={loginError}
        isDarkMode={isDarkMode}
        handlePinPress={handlePinPress}
        handleDeletePress={handleDeletePress}
        handleQuickLogin={handleQuickLogin}
        verifyStaffCredentials={verifyStaffCredentials}
        verifyPasswordOnServer={verifyPasswordOnServer}
        deviceApprovalState={deviceApprovalState}
        onClearDeviceApprovalState={() => setDeviceApprovalState(null)}
      />
    );
  }

  // VIEW: APLIKASI UTAMA
  return (
    <div className="w-full max-w-md landscape:max-w-full md:max-w-4xl mx-auto min-h-screen bg-slate-50 dark:bg-slate-950 font-sans relative pb-24 landscape:pb-20 transition-all duration-500 overflow-hidden">
      {/* GLOBAL HIGH-PRIORITY FLOATING TOAST (Z-INDEX 99999 - ALWAYS ABOVE HEADER & MODALS) */}
      <GlobalToast toast={toast} onClose={() => setToast(null)} />

      {/* OCR AI SCANNING & PROCESSING FULLSCREEN OVERLAY (SPINNING RADAR & LASER BEAM) */}
      <OcrScanningOverlay isScanning={isScanning} />

      {/* PWA Offline / Online & Install Status Indicator Banner */}
      <OfflineStatusBanner />

      <Header
        authRole={authRole}
        showUserMenu={showUserMenu}
        setShowUserMenu={setShowUserMenu}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        setShowNewFeaturesModal={setShowNewFeaturesModal}
        setShowExportModal={setShowExportModal}
        setShowSettingsModal={setShowSettingsModal}
        handleLogout={handleLogout}
        userMenuRef={userMenuRef}
        activeTab={activeTab}
        reportTabs={reportTabs}
        setReportTabs={setReportTabs}
        reportType={reportType}
        setReportType={(val: any) => setReportType(val)}
        isReordering={isReordering}
        setIsReordering={setIsReordering}
        longPressTimer={longPressTimer}
        onOpenMorningBriefing={() => {
          setAiExecutiveSubmodule('briefing');
          setShowMorningBriefing(true);
        }}
        onOpenManualSawit={() => {
          setAiExecutiveSubmodule('msl');
          setShowMorningBriefing(true);
        }}
        onOpenWeedVision={() => setShowWeedVisionModal(true)}
        showToast={showToast}
      />

      {/* GLOBAL MODALS CONTAINER (DYNAMIC CODE-SPLIT & MEMORY OPTIMIZED) */}
      <AppModalsContainer
        sharePreviewData={sharePreviewData}
        setSharePreviewData={setSharePreviewData}
        showToast={showToast}
        showExportModal={showExportModal}
        setShowExportModal={setShowExportModal}
        exportReportType={exportReportType}
        setExportReportType={setExportReportType}
        exportFilter={exportFilter}
        setExportFilter={setExportFilter}
        exportMonth={exportMonth}
        setExportMonth={setExportMonth}
        exportDate={exportDate}
        setExportDate={setExportDate}
        exportStartDate={exportStartDate}
        setExportStartDate={setExportStartDate}
        exportEndDate={exportEndDate}
        setExportEndDate={setExportEndDate}
        exportColumns={exportColumns}
        setExportColumns={setExportColumns}
        isExporting={isExporting}
        handleExportToExcel={handleExportToExcel}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        recordToDelete={recordToDelete}
        setRecordToDelete={setRecordToDelete}
        handleDeleteRecord={handleDeleteRecord}
        isProcessing={isProcessing}
        showDeleteAllModal={showDeleteAllModal}
        setShowDeleteAllModal={setShowDeleteAllModal}
        handleDeleteAllRecords={handleDeleteAllRecords}
        showNewFeaturesModal={showNewFeaturesModal}
        setShowNewFeaturesModal={setShowNewFeaturesModal}
        showBacklogLoginModal={showBacklogLoginModal}
        setShowBacklogLoginModal={setShowBacklogLoginModal}
        showSettingsModal={showSettingsModal}
        setShowSettingsModal={setShowSettingsModal}
        showSystemHealthModal={showSystemHealthModal}
        setShowSystemHealthModal={setShowSystemHealthModal}
        fetchData={fetchData}
        checkConfig={checkConfig}
        showDateVerificationModal={showDateVerificationModal}
        setShowDateVerificationModal={setShowDateVerificationModal}
        pendingOcrVerification={pendingOcrVerification}
        handleConfirmOcrDate={handleConfirmOcrDate}
        handleConfirmAndSaveDirectly={handleConfirmAndSaveDirectly}
        showIdleWarning={showIdleWarning}
        idleSecondsRemaining={idleSecondsRemaining}
        extendIdleSession={extendIdleSession}
        handleLogout={handleLogout}
        showMorningBriefing={showMorningBriefing}
        setShowMorningBriefing={setShowMorningBriefing}
        aiExecutiveSubmodule={aiExecutiveSubmodule}
        setAiExecutiveSubmodule={setAiExecutiveSubmodule}
        analytics={analytics}
        rawData={rawData}
        authRole={authRole}
        showManualSawit={showManualSawit}
        setShowManualSawit={setShowManualSawit}
        showRCReportModal={showRCReportModal}
        setShowRCReportModal={setShowRCReportModal}
        generateRCReport={generateRCReport}
        handleCopyReport={handleCopyReport}
        handleWhatsAppShare={handleWhatsAppShare}
        showWeedVisionModal={showWeedVisionModal}
        setShowWeedVisionModal={setShowWeedVisionModal}
        setActiveTab={setActiveTab}
        expandedTrendChart={expandedTrendChart}
        setExpandedTrendChart={setExpandedTrendChart}
        reportType={reportType}
        isThekExpanded={isThekExpanded}
        setIsThekExpanded={setIsThekExpanded}
        chartMetric={chartMetric}
        chartPeriod={chartPeriod}
        isPieExpanded={isPieExpanded}
        setIsPieExpanded={setIsPieExpanded}
        isHistoryExpanded={isHistoryExpanded}
        setIsHistoryExpanded={setIsHistoryExpanded}
        historyChartData={historyChartData}
        showMasterDatasetModal={showMasterDatasetModal}
        setShowMasterDatasetModal={setShowMasterDatasetModal}
        activeEstateId={activeEstateId}
        showEstateSwitcherModal={showEstateSwitcherModal}
        setShowEstateSwitcherModal={setShowEstateSwitcherModal}
        showNewFeatures={showNewFeatures}
        setShowNewFeatures={setShowNewFeatures}
      />

      <main className="px-2 pt-2 pb-28 sm:pt-3 sm:pb-32 overflow-hidden w-full max-w-7xl mx-auto">
        {/* Banner Mod Standby jika ladang aktif ialah Kledang atau Sening (atau tiada data asas) */}
        <EstateStandbyBanner
          activeEstateId={activeEstateId}
          onOpenMasterDatasetModal={() => setShowMasterDatasetModal(true)}
          onOpenEstateSwitcher={() => setShowEstateSwitcherModal(true)}
        />

        {configStatus && !configStatus.supabase && (
          <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/50 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in slide-in-from-top duration-500 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-rose-500 shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-[11px] font-black text-rose-700 dark:text-rose-400 uppercase tracking-tight">
                  Pangkalan Data Belum Bersambung
                </p>
                <p className="text-[10px] text-rose-600 dark:text-rose-500 font-medium leading-tight mt-0.5">
                  Kredensial Supabase belum dikesan secara automatik di pelayar.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowSettingsModal(true)}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-[11px] font-black uppercase tracking-wider transition-all shadow-sm shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Database size={13} />
              Tetapkan Sambungan
            </button>
          </div>
        )}

        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full min-h-[80vh]"
          >
            {/* TAB 1: KEMASUKAN DATA */}
            {activeTab === "scan" && (
              <ErrorBoundary compact moduleName="Kemasukan Data">
                <InputTab
                  formData={formData}
                  setFormData={setFormData}
                  rawData={rawData}
                  fileInputRef={fileInputRef}
                  uploadInputRef={uploadInputRef}
                  handleOcrScan={handleOcrScan}
                  submitTransaction={submitTransaction}
                  isProcessing={isProcessing}
                  isScanning={isScanning}
                  onAddHujan={handleAddHujan}
                  isEditing={!!editingRecordId}
                  authRole={authRole}
                  onCancelEdit={() => {
                    setEditingRecordId(null);
                    resetFormData();
                    setActiveTab("sejarah");
                  }}
                />
              </ErrorBoundary>
            )}

            {/* TAB 2: DASHBOARD */}
            {activeTab === "dashboard" && (
              <ErrorBoundary compact moduleName="Dashboard Ringkasan">
                <DashboardTab
                  dashboardTrendView={dashboardTrendView}
                  setDashboardTrendView={setDashboardTrendView}
                  showFSA13Report={showFSA13Report}
                  handleCopyReport={handleCopyReport}
                  handleWhatsAppShare={handleWhatsAppShare}
                  showReportDatePicker={showReportDatePicker}
                  dashboardDate={dashboardDate}
                  setDashboardDate={setDashboardDate}
                  executeWhatsAppShare={handleWhatsAppShare}
                  generateRCReport={() => generateRCReport(analytics)}
                  tableToCaptureRef={tableToCaptureRef}
                  captureTableScreenshot={handleCaptureScreenshot}
                  isCapturing={isCapturing}
                  handleDownloadPdf={handleDownloadPdf}
                  isDownloadingPdf={isDownloadingPdf}
                  handlePrint={() => window.print()}
                  handleShareBtsReport={handleShareBts}
                  isSharingBts={isSharingBts}
                  thekChartRef={thekChartRef}
                  historyChartData={historyChartData}
                  setShowRanking={setShowRanking}
                  showRanking={showRanking}
                  setRankingPeriod={setRankingPeriod}
                  rankingPeriod={rankingPeriod}
                  activeTab={activeTab}
                  authRole={authRole}
                  isDarkMode={isDarkMode}
                  swipeDirection={swipeDirection}
                  handleSwipe={handleSwipe}
                  reportType={reportType}
                  setReportType={setReportType}
                  showToast={showToast}
                  reportTabs={reportTabs}
                  analytics={analytics}
                  activeHasilTab={activeHasilTab}
                  setActiveHasilTab={setActiveHasilTab}
                  activeKualitiTab={activeKualitiTab}
                  setActiveKualitiTab={setActiveKualitiTab}
                  activeEfbTab={activeEfbTab}
                  setActiveEfbTab={setActiveEfbTab}
                  setShowFSA13Report={setShowFSA13Report}
                  hujanData={hujanData}
                  chartPeriod={chartPeriod}
                  setChartPeriod={setChartPeriod}
                  chartMetric={chartMetric}
                  setChartMetric={setChartMetric}
                  showYtdChart={showYtdChart}
                  setShowYtdChart={setShowYtdChart}
                  showMonthlyTrendChart={showMonthlyTrendChart}
                  setShowMonthlyTrendChart={setShowMonthlyTrendChart}
                  showPriceTrendChart={showPriceTrendChart}
                  setShowPriceTrendChart={setShowPriceTrendChart}
                  showThekChart={showThekChart}
                  setShowThekChart={setShowThekChart}
                  showRankingCollapsed={showRankingCollapsed}
                  setShowRankingCollapsed={setShowRankingCollapsed}
                  showTrendCollapsed={showTrendCollapsed}
                  setShowTrendCollapsed={setShowTrendCollapsed}
                  showSummaryCollapsed={showSummaryCollapsed}
                  setShowSummaryCollapsed={setShowSummaryCollapsed}
                  showDetailsCollapsed={showDetailsCollapsed}
                  setShowDetailsCollapsed={setShowDetailsCollapsed}
                  setExpandedTrendChart={setExpandedTrendChart}
                  thekSortMode={thekSortMode}
                  setThekSortMode={setThekSortMode}
                  thekHistoryView={thekHistoryView}
                  setThekHistoryView={setThekHistoryView}
                  isThekExpanded={isThekExpanded}
                  setIsThekExpanded={setIsThekExpanded}
                  isPieExpanded={isPieExpanded}
                  setIsPieExpanded={setIsPieExpanded}
                  sharePreviewData={sharePreviewData}
                  setSharePreviewData={setSharePreviewData}
                  rawData={rawData}
                  isExporting={isExporting}
                  blockAnnualData={blockAnnualData}
                  YIELD_DATA_2025={YIELD_DATA_2025}
                  setReportTabs={setReportTabs}
                  isReordering={isReordering}
                  setRecordToDelete={setRecordToDelete}
                  onEditRecord={handleEditRecord}
                  onOpenMorningBriefing={() => {
                    setAiExecutiveSubmodule('briefing');
                    setActiveTab('ai_executive');
                  }}
                  onOpenManualSawit={() => {
                    setAiExecutiveSubmodule('msl');
                    setActiveTab('ai_executive');
                  }}
                />
              </ErrorBoundary>
            )}

            {/* TAB 3: AI EXECUTIVE */}
            {activeTab === "ai_executive" && (
              <ErrorBoundary compact moduleName="AI Executive Portal">
                <AiExecutiveView
                  authRole={authRole}
                  analytics={analytics}
                  allDeliveries={rawData}
                  isDarkMode={isDarkMode}
                  onShowToast={showToast}
                  currentDate={analytics?.displayDate}
                  initialSubmodule={aiExecutiveSubmodule}
                />
              </ErrorBoundary>
            )}

            {/* TAB 4: SEJARAH */}
            {activeTab === "sejarah" && (
              <ErrorBoundary compact moduleName="Sejarah Rekod">
                <SejarahTab
                  historyFilterDate={historyFilterDate}
                  setHistoryFilterDate={setHistoryFilterDate}
                  setShowExportModal={setShowExportModal}
                  rawData={rawData}
                  setRecordToDelete={setRecordToDelete}
                  onEditRecord={handleEditRecord}
                  authRole={authRole}
                />
              </ErrorBoundary>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* BOTTOM NAVIGATION */}
      <BottomNav
        activeTab={activeTab}
        handleTabChange={handleTabChange}
        isProfileActive={showUserMenu}
        setIsProfileActive={setShowUserMenu}
        onUploadClick={() => uploadInputRef.current?.click()}
        onCameraClick={() => fileInputRef.current?.click()}
        onWeedVisionClick={() => setShowWeedVisionModal(true)}
        authRole={authRole}
      />

      {/* Hidden OCR Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleOcrScan}
        accept="image/*"
        className="hidden"
        capture="environment"
      />
      <input
        type="file"
        ref={uploadInputRef}
        onChange={handleOcrScan}
        accept="image/*"
        className="hidden"
      />
    </div>
  );
}

export default App;
