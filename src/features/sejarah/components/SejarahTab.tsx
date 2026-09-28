import React, { useMemo, useState, useEffect } from "react";
import { motion } from "motion/react";
import { History, X, Download, Trash2, Edit2, ArrowDownCircle, Search } from "lucide-react";
import { Transaction } from "../../../types";
import { formatDate, getMalayMonthName, formatNumber, formatRM } from "../../../utils/formatters";

import { AuthRole } from "../../auth/services/rbacService";

interface SejarahTabProps {
  rawData: Transaction[];
  historyFilterDate: string;
  setHistoryFilterDate: (date: string) => void;
  setShowExportModal?: (show: boolean) => void;
  setRecordToDelete?: (no_resit: string | null) => void;
  onEditRecord?: (record: Transaction) => void;
  authRole?: AuthRole | null;
  defaultMode?: "bts" | "efb";
  hideModeToggle?: boolean;
  customTitle?: string;
}

// Timezone safe and local-format date formatter (Avoids day shift errors for client offsets)
const formatTarikhMalay = (tarikhStr: string) => {
  if (!tarikhStr) return "-";
  const parts = tarikhStr.split('-');
  if (parts.length === 3) {
    const m = parts[1];
    const d = parts[2];
    const monthName = getMalayMonthName(m, true);
    return `${parseInt(d, 10)} ${monthName}`;
  }
  return formatDate(tarikhStr, 'short');
};

export const SejarahTab: React.FC<SejarahTabProps> = ({
  rawData,
  historyFilterDate,
  setHistoryFilterDate,
  setShowExportModal,
  setRecordToDelete,
  onEditRecord,
  authRole,
  defaultMode = "bts",
  hideModeToggle = false,
  customTitle,
}) => {
  const [activeTab, setActiveTab] = useState<"bts" | "efb">(defaultMode);
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Cari tarikh transaksi terkini dalam dataset
  const latestTransactionDate = useMemo(() => {
    if (!rawData || rawData.length === 0) return null;
    const validRows = rawData.filter(r => r.tarikh && (r.tan || 0) > 0 && !r.no_resit?.startsWith("EFB-HIST-"));
    if (validRows.length === 0) return null;
    const sorted = [...validRows].sort((a, b) => (b.tarikh || '').localeCompare(a.tarikh || ''));
    return sorted[0].tarikh;
  }, [rawData]);

  useEffect(() => {
    if (defaultMode) {
      setActiveTab(defaultMode);
    }
  }, [defaultMode]);
  
  // HAD RENDERING AWAL (Hanya paparkan 25 rekod pada satu masa untuk kelancaran)
  const [visibleLimit, setVisibleLimit] = useState<number>(25);

  // Setkan semula had jika penapis atau tab bertukar untuk menjaga kelancaran memori
  useEffect(() => {
    setVisibleLimit(25);
  }, [activeTab, historyFilterDate, searchQuery]);

  // ULTRA HIGH PERFORMANCE MEMOIZATION OF FILTERED TRANS
  const filteredData = useMemo(() => {
    // 1. Isihan Berdasarkan Jenis (BTS vs EFB)
    let data = (rawData || []).filter((row) => {
      const isEfb = row.peringkat === "EFB" || row.is_efb === true;
      return activeTab === "efb" ? isEfb : !isEfb;
    });

    // 2. Isihan disusun secara menurun (Terbaru didahulukan)
    data = [...data].sort((a, b) => {
      return (b.tarikh || "").localeCompare(a.tarikh || "");
    });

    // 3. Tapis tarikh atau Carian No Resit/Nota/Lori
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      data = data.filter((row) => {
        const resit = (row.no_resit || "").toLowerCase();
        const nota = (row.no_nota_hantaran || "").toLowerCase();
        const akaun = (row.no_akaun_terima || "").toLowerCase();
        const lori = (row.no_lori || "").toLowerCase();
        const seal = (row.no_seal || "").toLowerCase();
        const blok = `b${row.blok || ""}`.toLowerCase();
        return (
          resit.includes(q) || 
          nota.includes(q) || 
          akaun.includes(q) || 
          lori.includes(q) || 
          seal.includes(q) ||
          blok.includes(q)
        );
      });
    } else if (historyFilterDate) {
      data = data.filter((row) => row.tarikh === historyFilterDate);
    } else {
      // TEMPORAL WINDOWING: Had paparan automatik hanya data 3 bulan terakhir sahaja.
      // Ciri ini memotong carian beratus baris yang membebankan rendering awal.
      const now = new Date();
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(now.getMonth() - 3);
      const thresholdDate = threeMonthsAgo.toISOString().split("T")[0];
      
      data = data.filter((row) => {
        const rowDate = row.tarikh || "";
        return rowDate >= thresholdDate;
      });
    }

    return data;
  }, [rawData, activeTab, historyFilterDate, searchQuery]);

  // CHUNK SLICING (Hanya muat turun baris dalam had memori kecil pelayar)
  const displayedData = useMemo(() => {
    return filteredData.slice(0, visibleLimit);
  }, [filteredData, visibleLimit]);

  // JUMLAH KESELURUHAN UNTUK REKOD DITAPIS
  const totalStats = useMemo(() => {
    let totalTan = 0;
    let totalCapaiRM = 0;
    let totalMuda = 0;

    for (const item of filteredData) {
      totalTan += Number(item.tan) || 0;
      totalCapaiRM += Number(item.hasil_rm) || 0;
      totalMuda += Number(item.muda) || 0;
    }

    return {
      count: filteredData.length,
      tan: totalTan,
      capaiRM: totalCapaiRM,
      muda: totalMuda,
    };
  }, [filteredData]);

  const hasMore = filteredData.length > visibleLimit;
  const isEfb = activeTab === "efb";

  return (
    <div className="w-full">
      <div className="animate-in fade-in slide-in-from-right-4 duration-200">
        
        {/* Header & Filters */}
        <div className="flex flex-col items-center justify-center gap-3 mb-4">
          <h2 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <History size={14} /> {customTitle || `Sejarah Harian (${activeTab.toUpperCase()})`}
          </h2>

          {!hideModeToggle && (
            <div className="flex justify-center w-full px-4 mb-2">
              <div className="bg-slate-100 dark:bg-slate-800 p-1 flex justify-center rounded-2xl w-full max-w-sm">
                <button
                  onClick={() => setActiveTab("bts")}
                  className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                    activeTab === "bts"
                      ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                      : "text-slate-500 hover:text-emerald-600"
                  }`}
                >
                  BTS
                </button>
                <button
                  onClick={() => setActiveTab("efb")}
                  className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                    activeTab === "efb"
                      ? "bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm"
                      : "text-slate-500 hover:text-purple-600"
                  }`}
                >
                  EFB
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-center items-center gap-2 w-full px-4">
            {/* Tapis Tarikh */}
            <div className="relative flex-1 max-w-[150px]">
              <input
                type="date"
                value={historyFilterDate}
                onChange={(e) => {
                  setHistoryFilterDate(e.target.value);
                  if (e.target.value) {
                    setSearchQuery(""); // Auto clear text search if specific date is manually filtered
                  }
                }}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono tracking-tighter"
              />
              {historyFilterDate && (
                <button
                  onClick={() => setHistoryFilterDate("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Tombol Toggle Carian (Search Toggle) */}
            <button
              onClick={() => {
                const nextShowSearch = !showSearch;
                setShowSearch(nextShowSearch);
                if (nextShowSearch) {
                  setHistoryFilterDate(""); // Auto clear specific date to allow searching across other dates
                } else {
                  setSearchQuery(""); // Cancel/clear search on closing
                }
              }}
              className={`p-2.5 rounded-xl border flex items-center justify-center transition-all active:scale-95 shrink-0 ${
                showSearch || searchQuery.trim()
                  ? "bg-emerald-500 border-emerald-400 text-white shadow-md shadow-emerald-500/20"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              }`}
              title="Cari No. Resit / Nota / Lori"
            >
              <Search size={14} className="stroke-[2.5]" />
            </button>

            {/* Export (Excel) Button */}
            <button
              onClick={() => setShowExportModal(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 active:scale-95 transition-all shadow-sm shrink-0 uppercase tracking-wider cursor-pointer"
              title="Export Excel"
            >
              <Download size={13} className="stroke-[2.5]" />
              <span>Excel</span>
            </button>
          </div>
        </div>

        {/* Slot Input Carian (Animasi Slide Down) */}
        {showSearch && (
          <motion.div 
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="w-full px-4 mb-3"
          >
            <div className="relative w-full max-w-sm mx-auto">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Masukkan No. Resit, Nota, atau Lori..."
                className={`w-full py-2.5 pl-9 pr-8 bg-white dark:bg-slate-900 border text-xs font-black rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-all ${
                  searchQuery.trim() 
                    ? "border-emerald-500 dark:border-emerald-500 ring-2 ring-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                    : "border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                }`}
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Search size={14} className={`${searchQuery.trim() ? "text-emerald-500 animate-pulse" : ""}`} />
              </div>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {searchQuery.trim() && (
              <p className="text-[9px] text-center text-emerald-500 font-black uppercase tracking-widest mt-1.5 animate-pulse">
                🔍 Mencari merentasi semua tarikh rekod BTS/EFB...
              </p>
            )}
          </motion.div>
        )}

        {/* Note on Automatic Pagination Filter */}
        {!historyFilterDate && !searchQuery.trim() && (
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold px-2 py-1 mb-2 tracking-wide text-center">
            * Memaparkan rekod 3 bulan terakhir sahaja untuk kelajuan aplikasi. Sila tapis tarikh untuk rekod lampau.
          </p>
        )}

        {searchQuery.trim() && (
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black px-2 py-1.5 mb-2 tracking-wide text-center bg-emerald-500/10 border border-emerald-500/25 rounded-xl mx-4">
            ✓ Mod Pencarian Global Aktif: Edit mana-mana resit/nota lama merentasi tarikh pilihan terus.
          </p>
        )}

        {/* Data Table */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
          {displayedData.length === 0 ? (
            <div className="text-center p-8 space-y-3">
              <p className="text-xs font-bold text-slate-400">
                {historyFilterDate ? `Tiada rekod ditemui untuk tarikh ${formatTarikhMalay(historyFilterDate)}.` : 'Tiada rekod ditemui.'}
              </p>
              {historyFilterDate && rawData && rawData.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    onClick={() => setHistoryFilterDate("")}
                    className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-all cursor-pointer"
                  >
                    Tunjuk Semua Rekod
                  </button>
                  {latestTransactionDate && latestTransactionDate !== historyFilterDate && (
                    <button
                      onClick={() => setHistoryFilterDate(latestTransactionDate)}
                      className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span>Lihat Rekod Terkini ({formatTarikhMalay(latestTransactionDate)})</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto w-full custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-emerald-50/70 dark:bg-emerald-950/20 text-[9px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                      <th className="px-2 py-1.5 border-b border-emerald-100 dark:border-emerald-800 text-center whitespace-nowrap opacity-90 w-8">NO.</th>
                      <th className="px-3 py-1.5 border-b border-emerald-100 dark:border-emerald-800 whitespace-nowrap opacity-90">Tarikh</th>
                      <th className="px-3 py-1.5 border-b border-emerald-100 dark:border-emerald-800 whitespace-nowrap opacity-90">Resit / Nota</th>
                      <th className="px-3 py-1.5 border-b border-emerald-100 dark:border-emerald-800 whitespace-nowrap opacity-90">Lori / Seal</th>
                      {!isEfb && (
                        <th className="px-3 py-1.5 border-b border-emerald-100 dark:border-emerald-800 whitespace-nowrap text-center opacity-90">Muda</th>
                      )}
                      <th className="px-3 py-1.5 border-b border-emerald-100 dark:border-emerald-800 whitespace-nowrap text-center opacity-90">Blok</th>
                      {!isEfb && (
                        <th className="px-3 py-1.5 border-b border-emerald-100 dark:border-emerald-800 whitespace-nowrap text-center opacity-90">KPG</th>
                      )}
                      <th className="px-3 py-1.5 border-b border-emerald-100 dark:border-emerald-800 text-right whitespace-nowrap opacity-90">Tan</th>
                      {!isEfb && (
                        <th className="px-3 py-1.5 border-b border-emerald-100 dark:border-emerald-800 text-right whitespace-nowrap font-bold opacity-90">CAPAI (RM)</th>
                      )}
                      <th className="px-3 py-1.5 border-b border-emerald-100 dark:border-emerald-800 whitespace-nowrap text-center opacity-90">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedData.map((row, i) => (
                      <tr 
                        key={row.no_resit || i} 
                        className="border-b border-slate-100 dark:border-slate-800/50 text-[11px] text-slate-700 dark:text-slate-300 hover:bg-emerald-50/10 dark:hover:bg-emerald-950/5 transition-colors"
                      >
                        <td className="px-2 py-1.5 font-bold text-center text-slate-400 dark:text-slate-500 text-[10px] whitespace-nowrap">
                          {i + 1}
                        </td>
                        <td className="px-3 py-1.5 font-bold">
                          {formatTarikhMalay(row.tarikh)}
                        </td>
                        <td className="px-3 py-1.5 font-mono tracking-tighter whitespace-nowrap">
                          <div className="font-bold text-emerald-900 dark:text-white uppercase truncate max-w-[120px]">
                            {row.no_resit}
                          </div>
                          <div className="text-[9px] text-slate-400 dark:text-slate-500 flex flex-col mt-0.5 leading-none">
                            {row.no_nota_hantaran && row.no_nota_hantaran !== row.no_resit && (
                              <span className="truncate max-w-[120px]">
                                Nota: {row.no_nota_hantaran}
                              </span>
                            )}
                            {row.no_akaun_terima && row.no_akaun_terima !== row.no_resit && (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold truncate max-w-[120px]">
                                Akaun: {row.no_akaun_terima}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-1.5 uppercase whitespace-nowrap">
                          <div className="font-bold truncate max-w-[100px]">{row.no_lori}</div>
                          <div className="text-[9px] text-slate-400 dark:text-slate-500 truncate max-w-[100px] leading-none">{row.no_seal || "-"}</div>
                        </td>
                        {!isEfb && (
                          <td className="px-3 py-1.5 font-bold text-rose-500 text-center whitespace-nowrap">{row.muda}</td>
                        )}
                        <td className="px-3 py-1.5 whitespace-nowrap text-center animate-none">
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-emerald-700 dark:text-emerald-400">
                              B{row.blok}
                            </span>
                            {row.peringkat === "EFB" && (
                              <span className="text-[7px] bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-1 py-0.5 rounded font-black mt-0.5 w-fit leading-none">
                                EFB
                              </span>
                            )}
                          </div>
                        </td>
                        {!isEfb && (
                          <td className={`px-3 py-1.5 font-bold text-center whitespace-nowrap ${
                            parseFloat(row.kpg || "0") >= 21 
                              ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 rounded-md" 
                              : "text-slate-400 dark:text-slate-500"
                          }`}>
                            {row.kpg || "-"}
                          </td>
                        )}
                        <td className="px-3 py-1.5 text-right font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/10 dark:bg-emerald-900/5 rounded-md whitespace-nowrap">
                          {row.tan.toFixed(2)}
                        </td>
                        {!isEfb && (
                          <td className="px-3 py-1.5 text-right font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                            {row.hasil_rm > 0
                              ? row.hasil_rm.toLocaleString("ms-MY", {
                                  minimumFractionDigits: 2,
                                })
                              : "-"}
                          </td>
                        )}
                        <td className="px-3 py-1.5 text-center whitespace-nowrap">
                          {(authRole === "rc" || authRole === "oc" || authRole === "staff" || authRole === "fc" || authRole === "pf") && (
                            <div className="flex items-center justify-center gap-0.5">
                              <button
                                onClick={() => {
                                  if (typeof onEditRecord === "function") {
                                    onEditRecord(row);
                                  }
                                }}
                                className="p-1 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/10 rounded-full transition-colors"
                                title="Kemaskini Rekod"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                onClick={() => {
                                  if (typeof setRecordToDelete === "function") {
                                    setRecordToDelete(row.no_resit);
                                  }
                                }}
                                className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-full transition-colors"
                                title="Padam Rekod"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-emerald-100/90 dark:bg-emerald-950/80 border-t-2 border-emerald-500/40 text-[11px] font-black text-emerald-950 dark:text-emerald-100 sticky bottom-0">
                    <tr>
                      <td colSpan={isEfb ? 5 : 7} className="px-3 py-2 text-right uppercase tracking-wider font-extrabold text-emerald-900 dark:text-emerald-200">
                        JUMLAH ({totalStats.count} RESIT):
                      </td>
                      <td className="px-3 py-2 text-right font-black text-emerald-700 dark:text-emerald-300 bg-emerald-200/60 dark:bg-emerald-900/50 rounded-md whitespace-nowrap text-xs">
                        {totalStats.tan.toFixed(2)}
                      </td>
                      {!isEfb && (
                        <td className="px-3 py-2 text-right font-black text-indigo-700 dark:text-indigo-300 whitespace-nowrap text-xs">
                          {totalStats.capaiRM > 0
                            ? `RM ${totalStats.capaiRM.toLocaleString("ms-MY", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`
                            : "-"}
                        </td>
                      )}
                      <td className="px-3 py-2"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* BUTANG PAGINATION (DYNAMIC LOAD MORE) */}
              {hasMore && (
                <div className="p-4 border-t border-slate-100 dark:border-slate-800/40 flex justify-center bg-slate-50/50">
                  <button
                    onClick={() => setVisibleLimit((prev) => prev + 25)}
                    className="flex items-center gap-2 px-6 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 text-emerald-600 text-xs font-black uppercase tracking-wider rounded-2xl border border-slate-200 shadow-sm active:scale-95 transition-all cursor-pointer"
                  >
                    <ArrowDownCircle size={14} className="animate-bounce" />
                    Tunjukkan Lagi (+{filteredData.length - visibleLimit} rekod)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
