import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, ChevronDown, ClipboardCheck, Share2, Calendar, Clock } from 'lucide-react';
import { HasilBulananTable } from '../../dashboard/components/HasilBulananTable';
import { PendapatanBulananTable } from './PendapatanBulananTable';

interface LaporanViewProps {
  showFSA13Report: boolean;
  setShowFSA13Report: (show: boolean) => void;
  handleCopyReport: () => void;
  handleWhatsAppShare: () => void;
  showReportDatePicker: boolean;
  dashboardDate: string;
  setDashboardDate: (date: string) => void;
  executeWhatsAppShare: () => void;
  generateRCReport: () => React.ReactNode;
  tableToCaptureRef: React.RefObject<HTMLDivElement>;
  analytics: any;
  isDarkMode: boolean;
  captureTableScreenshot: () => void;
  isCapturing: boolean;
  setShowExportModal: (show: boolean) => void;
  handleDownloadPdf: () => void;
  isDownloadingPdf: boolean;
  handlePrint: () => void;
}

export const LaporanView: React.FC<LaporanViewProps> = ({
  showFSA13Report,
  setShowFSA13Report,
  handleCopyReport,
  handleWhatsAppShare,
  showReportDatePicker,
  dashboardDate,
  setDashboardDate,
  executeWhatsAppShare,
  generateRCReport,
  tableToCaptureRef,
  analytics,
  isDarkMode,
  captureTableScreenshot,
  isCapturing,
  setShowExportModal,
  handleDownloadPdf,
  isDownloadingPdf,
  handlePrint
}) => {
  const [activeSubTab, setActiveSubTab] = React.useState<'prestasi' | 'pendapatan' | 'fsa13'>('fsa13');

  const todayStr = React.useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const yesterdayStr = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const effectiveDate = dashboardDate || todayStr;
  const isYesterday = effectiveDate === yesterdayStr;
  const isToday = effectiveDate === todayStr;

  const formatDateDisplay = (isoDate: string) => {
    if (!isoDate) return '';
    const parts = isoDate.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoDate;
  };

  return (
    <>
      <div className="flex mt-2 mb-4 space-x-2 px-1 overflow-x-auto custom-scrollbar pb-2">
        <button
          onClick={() => setActiveSubTab('fsa13')}
          className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
            activeSubTab === 'fsa13'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20 border border-emerald-500'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <FileText size={12} /> Live FSA 13
        </button>
        <button
          onClick={() => setActiveSubTab('prestasi')}
          className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
            activeSubTab === 'prestasi'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20 border border-emerald-500'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          Prestasi Bulanan
        </button>
        <button
          onClick={() => setActiveSubTab('pendapatan')}
          className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
            activeSubTab === 'pendapatan'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20 border border-emerald-500'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          Pendapatan Peneroka
        </button>
      </div>

      <div ref={tableToCaptureRef} className="-mx-2 sm:mx-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {activeSubTab === 'fsa13' ? (
          <div className="bg-slate-900 rounded-[24px] p-5 shadow-2xl border border-slate-800 relative overflow-hidden group mb-6">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <FileText size={80} className="text-white" />
            </div>
            <div className="relative z-10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                    <FileText size={14} className="text-emerald-400" />
                    Laporan Live FSA 13
                  </h3>
                  <p className="text-[8px] font-bold text-emerald-400/80 uppercase tracking-widest mt-0.5">
                    Format Regional Controller
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    onClick={handleCopyReport}
                    title="Salin Teks Laporan"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/10 text-emerald-400 text-[10px] font-black"
                  >
                    <ClipboardCheck size={13} />
                    <span>Salin</span>
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    onClick={handleWhatsAppShare}
                    title="Hantar Laporan ke WhatsApp"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-colors shadow-lg shadow-emerald-500/20 text-white text-[10px] font-black"
                  >
                    <Share2 size={13} />
                    <span>WhatsApp</span>
                  </motion.button>
                </div>
              </div>

              {/* BAR PILIHAN TARIKH LAPORAN FSA 13 */}
              <div className="mb-4 p-3 bg-slate-950/80 rounded-2xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Calendar size={13} className="text-emerald-400" />
                    <span className="text-[9px] font-black uppercase tracking-wider">
                      Tarikh Laporan:
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-black text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                    {formatDateDisplay(effectiveDate)}
                  </span>
                  {isYesterday && (
                    <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-in fade-in">
                      ● Bertarikh Semalam
                    </span>
                  )}
                  {isToday && (
                    <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-in fade-in">
                      ● Hari Semasa
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setDashboardDate(yesterdayStr)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                      isYesterday
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black ring-2 ring-amber-400/50'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 hover:text-white'
                    }`}
                  >
                    <Clock size={12} className={isYesterday ? 'text-slate-950' : 'text-amber-400'} />
                    Semalam
                  </button>

                  <button
                    type="button"
                    onClick={() => setDashboardDate(todayStr)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                      isToday
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20 font-black ring-2 ring-emerald-400/50'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 hover:text-white'
                    }`}
                  >
                    Hari Ini
                  </button>

                  <div className="flex items-center">
                    <input
                      type="date"
                      value={effectiveDate}
                      max={todayStr}
                      onChange={(e) => setDashboardDate(e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1 text-[10px] font-bold text-white focus:outline-none focus:border-emerald-500 transition-all cursor-pointer hover:border-slate-500"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-black/40 rounded-2xl p-4 font-mono text-[9px] leading-relaxed text-emerald-400/90 whitespace-pre shadow-inner overflow-x-auto custom-scrollbar border border-white/5 relative">
                {generateRCReport()}
              </div>
            </div>
          </div>
        ) : activeSubTab === 'prestasi' ? (
          <HasilBulananTable
            analytics={analytics}
            dashboardDate={dashboardDate}
            setDashboardDate={setDashboardDate}
            isDarkMode={isDarkMode}
            onScreenshot={captureTableScreenshot}
            isCapturing={isCapturing}
            onExcel={() => setShowExportModal(true)}
            onDownloadPdf={handleDownloadPdf}
            isDownloadingPdf={isDownloadingPdf}
            onPrint={handlePrint}
          />
        ) : (
          <PendapatanBulananTable
            analytics={analytics}
            dashboardDate={dashboardDate}
            setDashboardDate={setDashboardDate}
            isDarkMode={isDarkMode}
            onScreenshot={captureTableScreenshot}
            isCapturing={isCapturing}
          />
        )}
      </div>
    </>
  );
};
