import React, { Suspense } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { RECENT_UPDATES } from "../config/recentUpdates";
import { ErrorBoundary } from "../components/common/ErrorBoundary";
import { isFeatureEnabled } from "../config/featureFlags";
import { ExpandedChartModals } from "../features/dashboard/components/ExpandedChartModals";
import { lazyWithRetry } from "../utils/lazyWithRetry";

// Lazy-loaded modal dialogs with automatic chunk retry & error resilience
const ShareModal = lazyWithRetry(
  () => import("../components/common/modals/ShareModal").then((m) => ({ default: m.ShareModal })),
  "ShareModal"
);
const ExportModal = lazyWithRetry(
  () => import("../components/common/modals/ExportModal").then((m) => ({ default: m.ExportModal })),
  "ExportModal"
);
const DeleteRecordModal = lazyWithRetry(
  () => import("../components/common/modals/DeleteRecordModal").then((m) => ({ default: m.DeleteRecordModal })),
  "DeleteRecordModal"
);
const NewFeaturesModal = lazyWithRetry(
  () => import("../components/common/modals/NewFeaturesModal").then((m) => ({ default: m.NewFeaturesModal })),
  "NewFeaturesModal"
);
const BacklogLoginModal = lazyWithRetry(
  () => import("../components/common/modals/BacklogLoginModal").then((m) => ({ default: m.BacklogLoginModal })),
  "BacklogLoginModal"
);
const SettingsModal = lazyWithRetry(
  () => import("../components/common/modals/SettingsModal").then((m) => ({ default: m.SettingsModal })),
  "SettingsModal"
);
const ReceiptDateVerificationModal = lazyWithRetry(
  () => import("../components/common/modals/ReceiptDateVerificationModal").then((m) => ({ default: m.ReceiptDateVerificationModal })),
  "ReceiptDateVerificationModal"
);
const SessionTimeoutModal = lazyWithRetry(
  () => import("../features/auth/components/SessionTimeoutModal").then((m) => ({ default: m.SessionTimeoutModal || m.default })),
  "SessionTimeoutModal"
);
const MorningBriefingModal = lazyWithRetry(
  () => import("../features/dashboard/components/MorningBriefingModal").then((m) => ({ default: m.MorningBriefingModal })),
  "MorningBriefingModal"
);
const ManualSawitChatModal = lazyWithRetry(
  () => import("../features/dashboard/components/ManualSawitChatModal").then((m) => ({ default: m.ManualSawitChatModal })),
  "ManualSawitChatModal"
);
const RCReportModal = lazyWithRetry(
  () => import("../components/common/modals/RCReportModal").then((m) => ({ default: m.RCReportModal })),
  "RCReportModal"
);
const WeedVisionModal = lazyWithRetry(
  () => import("../features/dashboard/components/WeedVisionModal").then((m) => ({ default: m.WeedVisionModal })),
  "WeedVisionModal"
);
const MasterDatasetModal = lazyWithRetry(
  () => import("../components/common/modals/MasterDatasetModal").then((m) => ({ default: m.MasterDatasetModal })),
  "MasterDatasetModal"
);
const EstateSwitcherModal = lazyWithRetry(
  () => import("../components/EstateSwitcherModal").then((m) => ({ default: m.EstateSwitcherModal })),
  "EstateSwitcherModal"
);
const SystemHealthModal = lazyWithRetry(
  () => import("../components/common/modals/SystemHealthModal").then((m) => ({ default: m.SystemHealthModal })),
  "SystemHealthModal"
);

export interface AppModalsContainerProps {
  // Share
  sharePreviewData: any;
  setSharePreviewData: (data: any) => void;
  showToast: (type: "success" | "error" | any, msg: string) => void;

  // Export
  showExportModal: boolean;
  setShowExportModal: (show: boolean) => void;
  exportReportType: string;
  setExportReportType: (type: any) => void;
  exportFilter: any;
  setExportFilter: (filter: any) => void;
  exportMonth: string;
  setExportMonth: (month: string) => void;
  exportDate: string;
  setExportDate: (date: string) => void;
  exportStartDate: string;
  setExportStartDate: (date: string) => void;
  exportEndDate: string;
  setExportEndDate: (date: string) => void;
  exportColumns: any;
  setExportColumns: (cols: any) => void;
  isExporting: boolean;
  handleExportToExcel: () => void;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;

  // Deletion
  recordToDelete: string | null;
  setRecordToDelete: (id: string | null) => void;
  handleDeleteRecord: (id: string) => void;
  isProcessing: boolean;
  showDeleteAllModal: boolean;
  setShowDeleteAllModal: (show: boolean) => void;
  handleDeleteAllRecords: () => void;

  // App announcements & settings
  showNewFeaturesModal: boolean;
  setShowNewFeaturesModal: (show: boolean) => void;
  showBacklogLoginModal: boolean;
  setShowBacklogLoginModal: (show: boolean) => void;
  showSettingsModal: boolean;
  setShowSettingsModal: (show: boolean) => void;
  showSystemHealthModal: boolean;
  setShowSystemHealthModal: (show: boolean) => void;
  fetchData: (silent?: boolean) => void;
  checkConfig: () => void;

  // OCR Verification
  showDateVerificationModal: boolean;
  setShowDateVerificationModal: (show: boolean) => void;
  pendingOcrVerification: any;
  handleConfirmOcrDate: (confirmedDate: string) => void;
  handleConfirmAndSaveDirectly: (confirmedDate: string) => Promise<void> | void;

  // Session Timeout
  showIdleWarning: boolean;
  idleSecondsRemaining: number;
  extendIdleSession: () => void;
  handleLogout: () => void;

  // Morning Briefing & AI Exec
  showMorningBriefing: boolean;
  setShowMorningBriefing: (show: boolean) => void;
  aiExecutiveSubmodule: "briefing" | "msl";
  setAiExecutiveSubmodule: (mod: "briefing" | "msl") => void;
  analytics: any;
  rawData: any[];
  authRole: string | null;

  // Manual Sawit Chat & RC Report
  showManualSawit: boolean;
  setShowManualSawit: (show: boolean) => void;
  showRCReportModal: boolean;
  setShowRCReportModal: (show: boolean) => void;
  generateRCReport: (analytics: any) => string;
  handleCopyReport: () => void;
  handleWhatsAppShare: () => void;

  // WeedVision Modal
  showWeedVisionModal: boolean;
  setShowWeedVisionModal: (show: boolean) => void;
  setActiveTab: (tab: any) => void;

  // Charts expansion
  expandedTrendChart: any;
  setExpandedTrendChart: (chart: any) => void;
  reportType: any;
  isThekExpanded: boolean;
  setIsThekExpanded: (expanded: boolean) => void;
  chartMetric: any;
  chartPeriod: any;
  isPieExpanded: boolean;
  setIsPieExpanded: (expanded: boolean) => void;
  isHistoryExpanded: boolean;
  setIsHistoryExpanded: (expanded: boolean) => void;
  historyChartData: any;

  // Master Dataset & Estate Switcher
  showMasterDatasetModal: boolean;
  setShowMasterDatasetModal: (show: boolean) => void;
  activeEstateId: string;
  showEstateSwitcherModal: boolean;
  setShowEstateSwitcherModal: (show: boolean) => void;

  // Inline Ciri Baharu Popup
  showNewFeatures: boolean;
  setShowNewFeatures: (show: boolean) => void;
}

export function AppModalsContainer({
  sharePreviewData,
  setSharePreviewData,
  showToast,
  showExportModal,
  setShowExportModal,
  exportReportType,
  setExportReportType,
  exportFilter,
  setExportFilter,
  exportMonth,
  setExportMonth,
  exportDate,
  setExportDate,
  exportStartDate,
  setExportStartDate,
  exportEndDate,
  setExportEndDate,
  exportColumns,
  setExportColumns,
  isExporting,
  handleExportToExcel,
  isDarkMode,
  setIsDarkMode,
  recordToDelete,
  setRecordToDelete,
  handleDeleteRecord,
  isProcessing,
  showDeleteAllModal,
  setShowDeleteAllModal,
  handleDeleteAllRecords,
  showNewFeaturesModal,
  setShowNewFeaturesModal,
  showBacklogLoginModal,
  setShowBacklogLoginModal,
  showSettingsModal,
  setShowSettingsModal,
  showSystemHealthModal,
  setShowSystemHealthModal,
  fetchData,
  checkConfig,
  showDateVerificationModal,
  setShowDateVerificationModal,
  pendingOcrVerification,
  handleConfirmOcrDate,
  handleConfirmAndSaveDirectly,
  showIdleWarning,
  idleSecondsRemaining,
  extendIdleSession,
  handleLogout,
  showMorningBriefing,
  setShowMorningBriefing,
  aiExecutiveSubmodule,
  setAiExecutiveSubmodule,
  analytics,
  rawData,
  authRole,
  showManualSawit,
  setShowManualSawit,
  showRCReportModal,
  setShowRCReportModal,
  generateRCReport,
  handleCopyReport,
  handleWhatsAppShare,
  showWeedVisionModal,
  setShowWeedVisionModal,
  setActiveTab,
  expandedTrendChart,
  setExpandedTrendChart,
  reportType,
  isThekExpanded,
  setIsThekExpanded,
  chartMetric,
  chartPeriod,
  isPieExpanded,
  setIsPieExpanded,
  isHistoryExpanded,
  setIsHistoryExpanded,
  historyChartData,
  showMasterDatasetModal,
  setShowMasterDatasetModal,
  activeEstateId,
  showEstateSwitcherModal,
  setShowEstateSwitcherModal,
  showNewFeatures,
  setShowNewFeatures,
}: AppModalsContainerProps) {
  return (
    <>
      <Suspense fallback={null}>
        {/* Share Modal */}
        {sharePreviewData && (
          <ErrorBoundary compact moduleName="Share Modal">
            <ShareModal
              isOpen={!!sharePreviewData}
              onClose={() => setSharePreviewData(null)}
              sharePreviewData={sharePreviewData}
              setSharePreviewData={setSharePreviewData}
              showToast={showToast}
            />
          </ErrorBoundary>
        )}

        {/* Export Modal */}
        {showExportModal && (
          <ErrorBoundary compact moduleName="Export Modal">
            <ExportModal
              isOpen={showExportModal}
              onClose={() => setShowExportModal(false)}
              reportType={exportReportType}
              setReportType={setExportReportType}
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
              exportToExcel={handleExportToExcel}
              isDarkMode={isDarkMode}
            />
          </ErrorBoundary>
        )}

        {/* Delete Record Modal (Single) */}
        {recordToDelete && (
          <ErrorBoundary compact moduleName="Delete Record Modal">
            <DeleteRecordModal
              isOpen={!!recordToDelete}
              onClose={() => setRecordToDelete(null)}
              recordId={recordToDelete}
              onDelete={handleDeleteRecord}
              isProcessing={isProcessing}
              type="single"
            />
          </ErrorBoundary>
        )}

        {/* Delete All Modal */}
        {showDeleteAllModal && (
          <ErrorBoundary compact moduleName="Delete All Modal">
            <DeleteRecordModal
              isOpen={showDeleteAllModal}
              onClose={() => setShowDeleteAllModal(false)}
              recordId={null}
              onDelete={handleDeleteAllRecords}
              isProcessing={isProcessing}
              type="all"
            />
          </ErrorBoundary>
        )}

        {/* New Features Modal */}
        {showNewFeaturesModal && (
          <ErrorBoundary compact moduleName="New Features Modal">
            <NewFeaturesModal
              isOpen={showNewFeaturesModal}
              onClose={() => setShowNewFeaturesModal(false)}
              recentUpdates={RECENT_UPDATES}
            />
          </ErrorBoundary>
        )}

        {/* Backlog Login Modal */}
        {showBacklogLoginModal && (
          <ErrorBoundary compact moduleName="Backlog Login Modal">
            <BacklogLoginModal
              isOpen={showBacklogLoginModal}
              onClose={() => setShowBacklogLoginModal(false)}
            />
          </ErrorBoundary>
        )}

        {/* Settings Modal */}
        {showSettingsModal && (
          <ErrorBoundary compact moduleName="Settings Modal">
            <SettingsModal
              isOpen={showSettingsModal}
              onClose={() => setShowSettingsModal(false)}
              isDarkMode={isDarkMode}
              setIsDarkMode={setIsDarkMode}
              onConfigSaved={() => {
                fetchData(true);
                checkConfig();
                showToast("success", "Supabase berjaya disambung!");
              }}
              onOpenSystemHealth={() => setShowSystemHealthModal(true)}
            />
          </ErrorBoundary>
        )}

        {/* System Health & Token Usage Modal */}
        {showSystemHealthModal && (
          <ErrorBoundary compact moduleName="System Health Modal">
            <SystemHealthModal
              isOpen={showSystemHealthModal}
              onClose={() => setShowSystemHealthModal(false)}
              isDarkMode={isDarkMode}
            />
          </ErrorBoundary>
        )}

        {/* Receipt Date Verification Modal */}
        {showDateVerificationModal && (
          <ErrorBoundary compact moduleName="Receipt Date Verification Modal">
            <ReceiptDateVerificationModal
              isOpen={showDateVerificationModal}
              onClose={() => setShowDateVerificationModal(false)}
              detectedDate={pendingOcrVerification?.detectedDate || ""}
              receiptInfo={pendingOcrVerification?.receiptInfo || null}
              onConfirmAndFillForm={handleConfirmOcrDate}
              onConfirmAndSaveDirectly={handleConfirmAndSaveDirectly}
              isDarkMode={isDarkMode}
            />
          </ErrorBoundary>
        )}

        {/* 30-Minute Inactivity Session Timeout Warning Modal */}
        {showIdleWarning && (
          <ErrorBoundary compact moduleName="Session Timeout Modal">
            <SessionTimeoutModal
              isOpen={showIdleWarning}
              secondsRemaining={idleSecondsRemaining}
              onExtend={extendIdleSession}
              onLogout={handleLogout}
            />
          </ErrorBoundary>
        )}

        {/* AI EXECUTIVE UNIFIED MODAL (AI Briefing FC & Manual Sawit RAG) */}
        {showMorningBriefing && isFeatureEnabled("enableMorningBriefing") && (
          <ErrorBoundary compact moduleName="Morning Briefing Modal">
            <MorningBriefingModal
              isOpen={showMorningBriefing}
              onClose={() => setShowMorningBriefing(false)}
              isDarkMode={isDarkMode}
              onShowToast={showToast}
              currentDate={analytics?.displayDate}
              analytics={analytics}
              allDeliveries={rawData}
              authRole={authRole}
              initialSubmodule={aiExecutiveSubmodule}
            />
          </ErrorBoundary>
        )}

        {/* STANDALONE FALLBACK IF TRIGGERED DIRECTLY */}
        {showManualSawit && isFeatureEnabled("enableManualSawitRAG") && (
          <ErrorBoundary compact moduleName="Manual Sawit Modal">
            <ManualSawitChatModal
              isOpen={showManualSawit}
              onClose={() => setShowManualSawit(false)}
              onShowToast={showToast}
            />
          </ErrorBoundary>
        )}

        {/* RC Report Modal */}
        {showRCReportModal && isFeatureEnabled("enableRCReportExport") && (
          <ErrorBoundary compact moduleName="RC Report Modal">
            <RCReportModal
              isOpen={showRCReportModal}
              onClose={() => setShowRCReportModal(false)}
              generateRCReport={() => generateRCReport(analytics)}
              handleCopyReport={handleCopyReport}
              handleWhatsAppShare={handleWhatsAppShare}
            />
          </ErrorBoundary>
        )}

        {/* WeedVision Modal */}
        {showWeedVisionModal && isFeatureEnabled("enableWeedVision") && (
          <ErrorBoundary compact moduleName="WeedVision AI">
            <WeedVisionModal
              isOpen={showWeedVisionModal}
              onClose={() => setShowWeedVisionModal(false)}
              onAskAiWithPhoto={(_query) => {
                setShowWeedVisionModal(false);
                setAiExecutiveSubmodule("msl");
                setActiveTab("ai_executive");
              }}
            />
          </ErrorBoundary>
        )}

        {/* Expanded Chart Modals */}
        {(expandedTrendChart || isThekExpanded || isPieExpanded || isHistoryExpanded) && (
          <ErrorBoundary compact moduleName="Expanded Chart Modals">
            <ExpandedChartModals
              expandedTrendChart={expandedTrendChart}
              setExpandedTrendChart={setExpandedTrendChart}
              reportType={reportType}
              analytics={analytics}
              isDarkMode={isDarkMode}
              isThekExpanded={isThekExpanded}
              setIsThekExpanded={setIsThekExpanded}
              chartMetric={chartMetric}
              chartPeriod={chartPeriod}
              isPieExpanded={isPieExpanded}
              setIsPieExpanded={setIsPieExpanded}
              isHistoryExpanded={isHistoryExpanded}
              setIsHistoryExpanded={setIsHistoryExpanded}
              historyChartData={historyChartData}
            />
          </ErrorBoundary>
        )}

        {/* Standby Master Dataset Setup Modal */}
        {showMasterDatasetModal && (
          <MasterDatasetModal
            isOpen={showMasterDatasetModal}
            onClose={() => setShowMasterDatasetModal(false)}
            defaultEstateId={activeEstateId}
          />
        )}

        {/* Estate Switcher Modal from Standby Banner */}
        {showEstateSwitcherModal && (
          <EstateSwitcherModal
            isOpen={showEstateSwitcherModal}
            onClose={() => setShowEstateSwitcherModal(false)}
            authRole={authRole}
            onSelectEstate={(estate) => {
              showToast?.("success", `Bertukar ke ${estate.name}`);
            }}
            showToast={showToast}
            onOpenMasterDataset={(_estateId) => {
              setShowMasterDatasetModal(true);
            }}
          />
        )}
      </Suspense>

      {/* Inline Ciri Baharu Notification Overlay */}
      <AnimatePresence>
        {showNewFeatures && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNewFeatures(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      Ciri Baharu
                    </h3>
                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em]">
                      Kemas Kini {RECENT_UPDATES[0]?.date || "Terkini"}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowNewFeatures(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {RECENT_UPDATES[0]?.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex gap-4 p-4 rounded-[24px] bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all hover:scale-[1.02]"
                    >
                      <div
                        className={`w-12 h-12 shrink-0 ${item.iconBg} rounded-2xl flex items-center justify-center shadow-inner`}
                      >
                        {React.cloneElement(item.icon, { size: 24 })}
                      </div>
                      <div>
                        <h4 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-tight">
                          {item.title}
                        </h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setShowNewFeatures(false)}
                  className="w-full mt-8 py-4 bg-slate-900 dark:bg-emerald-600 text-white text-[12px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-lg active:scale-[0.98] transition-all cursor-pointer"
                >
                  Faham &amp; Teruskan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
