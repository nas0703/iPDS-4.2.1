import React from "react";
import { Download, X, Loader2 } from "lucide-react";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportType: string;
  setReportType: (id: any) => void;
  exportFilter: "all" | "date" | "month" | "range";
  setExportFilter: (filter: "all" | "date" | "month" | "range") => void;
  exportMonth: string;
  setExportMonth: (val: any) => void;
  exportDate: string;
  setExportDate: (val: string) => void;
  exportStartDate?: string;
  setExportStartDate?: (val: string) => void;
  exportEndDate?: string;
  setExportEndDate?: (val: string) => void;
  exportColumns: string[];
  setExportColumns: (cols: string[]) => void;
  isExporting: boolean;
  exportToExcel: () => void;
  isDarkMode?: boolean;
}

export function ExportModal({
  isOpen,
  onClose,
  reportType,
  setReportType,
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
  exportToExcel,
  isDarkMode,
}: ExportModalProps) {
  if (!isOpen) return null;

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return "-";
    const parts = dateStr.split("-");
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-black text-slate-800 dark:text-white text-lg flex items-center gap-2">
            <Download size={20} className="text-emerald-500" />
            Muat Turun Excel
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 p-2 rounded-full transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">
              Jenis Laporan
            </label>
            <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
              {(
                [
                  { id: "hasil", label: "CAPAI", span: "col-span-1" },
                  { id: "muda", label: "Muda", span: "col-span-1" },
                  { id: "kpa_kpg", label: "Kpg=Kpa", span: "col-span-1" },
                  { id: "efb", label: "EFB", span: "col-span-1" },
                  { id: "efc_format", label: "EFC FORMAT", span: "col-span-2" },
                ] as const
              ).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setReportType(r.id)}
                  className={`py-2 px-2 text-[10px] font-black rounded-xl transition-all uppercase tracking-wider cursor-pointer touch-manipulation min-h-[38px] active:scale-[0.98] ${r.span} ${
                    reportType === r.id
                      ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-md ring-1 ring-emerald-500/20"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {reportType === "efc_format" && (
              <div className="mt-2 p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-left animate-in fade-in duration-150">
                <p className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                  Format Rasmi EFC (Master Data + Helaian Blok)
                </p>
                <p className="text-[9px] text-emerald-700/80 dark:text-emerald-400/90 mt-0.5 leading-relaxed">
                  Menjana helaian Master Data lengkap dengan ringkasan & helaian berasingan bagi setiap blok FPM Adela.
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">
              Pilihan Muat Turun
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => setExportFilter("date")}
                className={`py-2 px-1 text-[11px] font-bold rounded-xl border text-center transition-all ${exportFilter === "date" ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-sm ring-1 ring-emerald-500" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"}`}
              >
                Tarikh
              </button>
              <button
                type="button"
                onClick={() => setExportFilter("range")}
                className={`py-2 px-1 text-[11px] font-bold rounded-xl border text-center transition-all ${exportFilter === "range" ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-sm ring-1 ring-emerald-500" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"}`}
              >
                Julat
              </button>
              <button
                type="button"
                onClick={() => setExportFilter("month")}
                className={`py-2 px-1 text-[11px] font-bold rounded-xl border text-center transition-all ${exportFilter === "month" ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-sm ring-1 ring-emerald-500" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"}`}
              >
                Bulan
              </button>
              <button
                type="button"
                onClick={() => setExportFilter("all")}
                className={`py-2 px-1 text-[11px] font-bold rounded-xl border text-center transition-all ${exportFilter === "all" ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-sm ring-1 ring-emerald-500" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"}`}
              >
                Semua
              </button>
            </div>
          </div>

          {exportFilter === "date" && (
            <div className="animate-in slide-in-from-top-2 duration-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Pilih Tarikh (Harian Sahaja)
                </label>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/50">
                  1 Hari Sahaja
                </span>
              </div>
              <input
                type="date"
                value={exportDate}
                onChange={(e) => setExportDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium pl-1">
                ✓ Hanya data pada {formatDateDisplay(exportDate)} sahaja yang akan dimuat turun.
              </p>
            </div>
          )}

          {exportFilter === "range" && (
            <div className="animate-in slide-in-from-top-2 duration-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Pilih Julat Tarikh
                </label>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/50">
                  Julat Masa
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block mb-1">
                    Dari Tarikh
                  </label>
                  <input
                    type="date"
                    value={exportStartDate || exportDate}
                    onChange={(e) => setExportStartDate && setExportStartDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block mb-1">
                    Hingga Tarikh
                  </label>
                  <input
                    type="date"
                    value={exportEndDate || exportDate}
                    onChange={(e) => setExportEndDate && setExportEndDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 pl-1">
                Memuat turun dari {formatDateDisplay(exportStartDate || exportDate)} hingga {formatDateDisplay(exportEndDate || exportDate)}.
              </p>
            </div>
          )}

          {exportFilter === "month" && (
            <div className="animate-in slide-in-from-top-2 duration-200 space-y-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
                Pilih Bulan
              </label>
              <input
                type="month"
                value={exportMonth}
                onChange={(e) => setExportMonth(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
              <p className="text-[10px] text-slate-500 dark:text-slate-400 pl-1">
                Memuat turun semua rekod dalam bulan ini.
              </p>
            </div>
          )}

          {exportFilter === "all" && (
            <div className="animate-in slide-in-from-top-2 duration-200 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Memuat turun keseluruhan rekod hantaran tanpa had tarikh.
              </p>
            </div>
          )}

          <div>
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">
              Pilihan Kolum
            </label>
            <div className="flex flex-wrap gap-1.5 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-2xl border border-slate-100 dark:border-slate-800">
              {[
                { id: "bil", label: "Bil" },
                { id: "tarikh", label: "Tarikh" },
                { id: "no_resit", label: "Resit" },
                { id: "no_lori", label: "Lori" },
                { id: "no_seal", label: "Seal" },
                { id: "no_nota", label: "Nota" },
                { id: "kpg", label: "KPG" },
                { id: "blok", label: "Blok" },
                { id: "peringkat", label: "Pkt" },
                { id: "tan", label: "Tan" },
                { id: "muda", label: "Muda" },
                { id: "thek", label: "T/H" },
                { id: "masa", label: "Masa" },
                { id: "created", label: "Cipta" },
              ].map((col) => (
                <button
                  key={col.id}
                  onClick={() => {
                    if (exportColumns.includes(col.id)) {
                      if (exportColumns.length > 1)
                        setExportColumns(
                          exportColumns.filter((c) => c !== col.id),
                        );
                    } else {
                      setExportColumns([...exportColumns, col.id]);
                    }
                  }}
                  className={`px-2 py-1 text-[8px] font-black rounded-lg border transition-all uppercase tracking-tighter ${exportColumns.includes(col.id) ? "bg-emerald-500 border-emerald-500 text-white shadow-sm" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500"}`}
                >
                  {col.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 mt-3">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Tema Warna Excel:</span>
            <span className="font-bold inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {isDarkMode ? "🌙 Gelap (Dark Mode)" : "☀️ Cerah (Light Mode)"}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2 mt-2">
            <button
              onClick={exportToExcel}
              disabled={isExporting}
              className={`w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2 rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer ${isExporting ? "opacity-70 cursor-not-allowed" : ""}`}
            >
              {isExporting ? (
                <Loader2 className="animate-spin" size={14} />
              ) : (
                <Download size={14} className="stroke-[2.5]" />
              )}
              <span className="text-[11px] uppercase tracking-wider">
                {isExporting
                  ? "Menjana Fail..."
                  : "Muat Turun Excel (.xlsx)"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
