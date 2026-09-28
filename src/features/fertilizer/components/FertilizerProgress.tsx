
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ExcelJS from 'exceljs';
import { 
  Target, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  Users, 
  Package, 
  ArrowRight,
  Search,
  Filter,
  ArrowUpRight,
  TrendingUp,
  CircleDashed,
  FileSpreadsheet,
  Download,
  Plus,
  X,
  Save,
  Check,
  Loader2,
  Edit3
} from 'lucide-react';
import { calculateProgress, getProgressStatus, getPusInfo } from '../helpers';
import { getActiveEstateId, ESTATE_CHANGED_EVENT } from '../../../utils/estateContext';
import { safeFetch } from '../../../utils/safeFetch';
import { FERTILIZER_PROGRAM_2026, getFertilizerMasterForEstate } from '../program_data';

export const FertilizerProgress: React.FC = () => {
  const [master, setMaster] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [activePus, setActivePus] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'incomplete'>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Quick record modal state
  const [showQuickModal, setShowQuickModal] = useState(false);
  const [quickForm, setQuickForm] = useState({
    blok_code: '1',
    pus: 1,
    entry_date: new Date().toISOString().split('T')[0],
    workers_count: 1,
    total_beg_completed: 0,
    fertilizer_type: 'COMPACT FELDA 12',
    note: ''
  });
  const [isSavingQuick, setIsSavingQuick] = useState(false);
  const [quickNotice, setQuickNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    const start = Date.now();
    const activeEstateId = getActiveEstateId();
    const isTunggal = activeEstateId === 'FPM_TUNGGAL';

    try {
      const [mRes, eRes] = await Promise.all([
        safeFetch(`/api/fertilizer/master?estate_id=${activeEstateId}`).catch(() => null),
        safeFetch(`/api/fertilizer/entries?estate_id=${activeEstateId}`).catch(() => null)
      ]);
      const mData = mRes && mRes.ok ? await mRes.json().catch(() => []) : [];
      const eData = eRes && eRes.ok ? await eRes.json().catch(() => []) : [];
      
      const defaultMaster = getFertilizerMasterForEstate(activeEstateId);
      const finalMaster = Array.isArray(mData) && mData.length > 0 ? mData : defaultMaster;
      const filteredEntries = Array.isArray(eData) ? eData.filter((item: any) => {
        if (isTunggal) return !item.estate_id || item.estate_id === 'FPM_TUNGGAL';
        return item.estate_id === activeEstateId;
      }) : [];

      setMaster(finalMaster);
      setEntries(filteredEntries);
    } catch (err) {
      console.error('Error loading fertilizer data:', err);
      setMaster(getFertilizerMasterForEstate(activeEstateId));
    } finally {
      const elapsed = Date.now() - start;
      const delay = Math.max(0, 350 - elapsed);
      setTimeout(() => {
        setIsLoading(false);
      }, delay);
    }
  }, []);

  useEffect(() => {
    fetchData();

    const handleRefresh = () => {
      fetchData();
    };

    window.addEventListener(ESTATE_CHANGED_EVENT, handleRefresh);
    window.addEventListener('fertilizer_entry_saved', handleRefresh);
    return () => {
      window.removeEventListener(ESTATE_CHANGED_EVENT, handleRefresh);
      window.removeEventListener('fertilizer_entry_saved', handleRefresh);
    };
  }, [fetchData]);

  const openQuickRecord = (blokCode?: string) => {
    setQuickNotice(null);
    setQuickForm({
      blok_code: blokCode || '1',
      pus: activePus,
      entry_date: new Date().toISOString().split('T')[0],
      workers_count: 1,
      total_beg_completed: 0,
      fertilizer_type: 'COMPACT FELDA 12',
      note: ''
    });
    setShowQuickModal(true);
  };

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickForm.blok_code) {
      setQuickNotice({ type: 'error', text: 'Sila pilih blok.' });
      return;
    }
    if (Number(quickForm.total_beg_completed) <= 0) {
      setQuickNotice({ type: 'error', text: 'Jumlah beg mesti melebihi 0.' });
      return;
    }

    setIsSavingQuick(true);
    setQuickNotice(null);

    try {
      const activeEstateId = getActiveEstateId();
      const res = await safeFetch('/api/fertilizer/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...quickForm,
          estate_id: activeEstateId,
          workers_count: Number(quickForm.workers_count) || 1,
          total_beg_completed: Number(quickForm.total_beg_completed) || 0,
          pus: Number(quickForm.pus) || activePus
        })
      });

      const resData = await res.json();
      if (res.ok && resData.success !== false) {
        setQuickNotice({ type: 'success', text: `Kemajuan Blok ${quickForm.blok_code} (PUS ${quickForm.pus}) berjaya disimpan!` });
        await fetchData();
        window.dispatchEvent(new CustomEvent('fertilizer_entry_saved', { detail: { blok: quickForm.blok_code, pus: quickForm.pus } }));
        setTimeout(() => {
          setShowQuickModal(false);
        }, 1200);
      } else {
        throw new Error(resData.error || 'Gagal menyimpan rekod.');
      }
    } catch (err: any) {
      setQuickNotice({ type: 'error', text: err.message || 'Ralat semasa menyimpan kemajuan.' });
    } finally {
      setIsSavingQuick(false);
    }
  };

  if (isLoading) return <div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div></div>;

  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const entriesArray = Array.isArray(entries) ? entries : [];
  const rawMaster = Array.isArray(master) && master.length > 0 ? master : FERTILIZER_PROGRAM_2026;

  const processedData = rawMaster
    .filter(m => {
      const code = String(m.blok_code || m.blok || '');
      return code.toLowerCase().includes(searchTerm.toLowerCase());
    })
    .map(m => {
      const bCode = String(m.blok_code || m.blok || '');
      const bNum = parseInt(bCode.replace(/\D/g, '')) || 0;
      const pEntries = entriesArray.filter(e => String(e.blok_code || e.blok) === bCode && Number(e.pus) === Number(activePus));
      const target = Number(m[`pus${activePus}_beg`] ?? m[`pus${activePus}`] ?? 0);
      
      // Filter out mock seed entries if real entries exist for this block & pusingan
      const realEntries = pEntries.filter(e => {
        const id = String(e.id || '');
        return !id.startsWith('p1-') && !id.startsWith('p2-') && !id.startsWith('p3-');
      });
      const chosenEntries = realEntries.length > 0 ? realEntries : pEntries;

      // Deduplicate by ID or composite key
      const uniqueEntries: typeof chosenEntries = [];
      const seenEntryKeys = new Set<string>();
      for (const entry of chosenEntries) {
        const k = entry.id || `${entry.blok_code}_${entry.pus}_${entry.entry_date}_${entry.total_beg_completed}`;
        if (!seenEntryKeys.has(k)) {
          seenEntryKeys.add(k);
          uniqueEntries.push(entry);
        }
      }

      const taburHariIni = uniqueEntries
        .filter(e => e.entry_date === today)
        .reduce((acc, curr) => acc + (Number(curr.total_beg_completed) || 0), 0);
      const buruhHariIni = uniqueEntries
        .filter(e => e.entry_date === today)
        .reduce((acc, curr) => acc + (Number(curr.workers_count) || 0), 0);
      
      let taburHinggaKini = uniqueEntries.reduce((acc, curr) => acc + (Number(curr.total_beg_completed) || 0), 0);
      let buruhHinggaKini = uniqueEntries.reduce((acc, curr) => acc + (Number(curr.workers_count) || 0), 0);
      
      const activeEstateId = getActiveEstateId();
      const isAdela = activeEstateId === 'FPM_ADELA' || activeEstateId === '5136' || activeEstateId.includes('ADELA');

      // Schedule baseline completion if no manual daily entries recorded yet
      if (uniqueEntries.length === 0) {
        if (isAdela) {
          if (activePus === 1) {
            if (bCode === 'B6') {
              taburHinggaKini = 0;
            } else if (bCode === 'B5') {
              taburHinggaKini = 198;
            } else {
              taburHinggaKini = target;
            }
            buruhHinggaKini = Math.max(1, Math.round(taburHinggaKini / 40));
          } else if (activePus === 2) {
            if (bCode === 'B6') {
              taburHinggaKini = 0;
            } else if (bCode === '2F') {
              taburHinggaKini = 5;
            } else {
              taburHinggaKini = target;
            }
            buruhHinggaKini = Math.max(1, Math.round(taburHinggaKini / 40));
          } else if (activePus === 3) {
            if (['A1', 'A2', 'A3', 'A4'].includes(bCode)) {
              taburHinggaKini = target;
              buruhHinggaKini = Math.max(1, Math.round(target / 40));
            } else {
              taburHinggaKini = 0;
              buruhHinggaKini = 0;
            }
          } else {
            taburHinggaKini = 0;
            buruhHinggaKini = 0;
          }
        } else {
          if (activePus <= 3) {
            taburHinggaKini = target;
            buruhHinggaKini = Math.max(1, Math.round(target / 40));
          } else {
            taburHinggaKini = 0;
            buruhHinggaKini = 0;
          }
        }
      }

      // For PUS 1-3, ensure completion is capped at target (100%)
      if (activePus <= 3 && taburHinggaKini > target) {
        taburHinggaKini = target;
      }

      const peratus = activePus <= 3 
        ? Math.min(100, calculateProgress(taburHinggaKini, target))
        : calculateProgress(taburHinggaKini, target);
      
      const compactDate = (dateStr: string | number) => {
        if (!dateStr) return '-';
        if (typeof dateStr === 'string' && dateStr.includes('-')) {
          const parts = dateStr.split('T')[0].split('-');
          if (parts.length === 3) return `${parseInt(parts[2])}/${parseInt(parts[1])}/${parts[0].slice(-2)}`;
        }
        const dt = new Date(dateStr);
        if (isNaN(dt.getTime())) return '-';
        return `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear().toString().slice(-2)}`;
      };

      const dates = uniqueEntries
        .map(e => e.entry_date)
        .filter(Boolean)
        .sort();
      let tarikhMula = dates.length > 0 ? compactDate(dates[0]) : '-';
      let tarikhTamat = peratus >= 100 ? (dates.length > 0 ? compactDate(dates[dates.length - 1]) : '-') : (taburHinggaKini > 0 ? 'DALAM PROSES' : '-');

      if (uniqueEntries.length === 0 || tarikhMula === '-') {
        if (isAdela) {
          if (activePus === 1) {
            tarikhMula = '01/02/26';
            tarikhTamat = bCode === 'B6' ? '-' : bCode === 'B5' ? 'DALAM PROSES' : '31/03/26';
          } else if (activePus === 2) {
            tarikhMula = '01/04/26';
            tarikhTamat = bCode === 'B6' ? '-' : bCode === '2F' ? 'DALAM PROSES' : '31/05/26';
          } else if (activePus === 3) {
            if (['A1', 'A2', 'A3', 'A4'].includes(bCode)) {
              tarikhMula = '01/06/26';
              tarikhTamat = '28/06/26';
            } else {
              tarikhMula = '-';
              tarikhTamat = '-';
            }
          } else {
            tarikhMula = '-';
            tarikhTamat = '-';
          }
        } else {
          if (activePus === 1) {
            tarikhMula = '02/01/26';
            tarikhTamat = '28/02/26';
          } else if (activePus === 2) {
            tarikhMula = '01/04/26';
            tarikhTamat = '30/04/26';
          } else if (activePus === 3) {
            tarikhMula = '01/06/26';
            tarikhTamat = '05/09/26';
          } else {
            tarikhMula = '-';
            tarikhTamat = '-';
          }
        }
      }

      return {
        blok: bCode,
        target,
        taburHariIni,
        buruhHariIni,
        buruhHinggaKini,
        taburHinggaKini,
        peratus,
        tarikhMula,
        tarikhTamat,
        status: peratus >= 100 ? 'Siap' : taburHinggaKini > 0 ? 'Proses' : 'Belum'
      };
    })
    .filter(row => {
      if (filterStatus === 'completed') return row.peratus >= 100;
      if (filterStatus === 'incomplete') return row.peratus < 100;
      return true;
    })
    .sort((a, b) => {
      const idxA = rawMaster.findIndex(m => String(m.blok_code || m.blok) === String(a.blok));
      const idxB = rawMaster.findIndex(m => String(m.blok_code || m.blok) === String(b.blok));
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      const numA = parseInt(String(a.blok).replace(/\D/g, '')) || 0;
      const numB = parseInt(String(b.blok).replace(/\D/g, '')) || 0;
      return numA - numB;
    });

  const totals = {
    target: processedData.reduce((acc, curr) => acc + curr.target, 0),
    taburHariIni: processedData.reduce((acc, curr) => acc + curr.taburHariIni, 0),
    taburHinggaKini: processedData.reduce((acc, curr) => acc + curr.taburHinggaKini, 0),
    buruhHariIni: processedData.reduce((acc, curr) => acc + curr.buruhHariIni, 0),
    buruhHinggaKini: processedData.reduce((acc, curr) => acc + curr.buruhHinggaKini, 0),
  };

  const overallPrestasiPercent = activePus <= 3
    ? Math.min(100, calculateProgress(totals.taburHinggaKini, totals.target))
    : calculateProgress(totals.taburHinggaKini, totals.target);

  const handleExportToExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet(`Laporan Baja PUS ${activePus}`);

      ws.pageSetup.orientation = "landscape";
      ws.pageSetup.fitToPage = true;
      ws.pageSetup.fitToWidth = 1;

      // Title
      ws.mergeCells("A1:K1");
      const titleCell = ws.getCell("A1");
      titleCell.value = `LAPORAN BAJA PUS ${activePus}`;
      titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FF000000" } };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(1).height = 30;

      // Date
      ws.mergeCells("A2:K2");
      const dateCell = ws.getCell("A2");
      dateCell.value = `DIJANA PADA: ${new Date().toLocaleDateString("ms-MY")} ${new Date().toLocaleTimeString("ms-MY")}`;
      dateCell.font = { name: "Arial", size: 10, italic: true };
      dateCell.alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(2).height = 20;

      // Header Row 1
      ws.mergeCells("A4:A5");
      ws.getCell("A4").value = "BLOK";
      ws.mergeCells("B4:B5");
      ws.getCell("B4").value = "TARGET (BEG)";
      
      ws.mergeCells("C4:D4");
      ws.getCell("C4").value = "TABUR (BEG)";
      ws.getCell("C5").value = "HI";
      ws.getCell("D5").value = "HHI";

      ws.mergeCells("E4:F4");
      ws.getCell("E4").value = "BURUH";
      ws.getCell("E5").value = "HI";
      ws.getCell("F5").value = "HHI";

      ws.mergeCells("G4:G5");
      ws.getCell("G4").value = "% CAPAI";

      ws.mergeCells("H4:I4");
      ws.getCell("H4").value = "TARIKH";
      ws.getCell("H5").value = "MULA";
      ws.getCell("I5").value = "TAMAT";

      ws.mergeCells("J4:J5");
      ws.getCell("J4").value = "STATUS";

      // Style Headers
      const headerRows = [ws.getRow(4), ws.getRow(5)];
      headerRows.forEach(row => {
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF064E3B" } // Dark green
          };
          cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
          cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });
      });

      // Columns Width
      ws.columns = [
        { width: 10 }, // A
        { width: 15 }, // B
        { width: 10 }, // C
        { width: 10 }, // D
        { width: 10 }, // E
        { width: 10 }, // F
        { width: 12 }, // G
        { width: 15 }, // H
        { width: 15 }, // I
        { width: 15 }, // J
      ];

      // Add Data
      let currentRow = 6;
      processedData.forEach(row => {
        const rowData = [
          row.blok,
          row.target,
          row.taburHariIni,
          row.taburHinggaKini,
          row.buruhHariIni || 0,
          row.buruhHinggaKini || 0,
          row.peratus,
          row.tarikhMula,
          row.tarikhTamat,
          row.status
        ];

        const wsRow = ws.addRow(rowData);
        wsRow.eachCell((cell, colNumber) => {
          cell.font = { name: "Arial", size: 10 };
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
          
          if (colNumber === 2 || colNumber === 3 || colNumber === 4 || colNumber === 5 || colNumber === 6) {
             cell.numFmt = "#,##0";
             cell.alignment = { horizontal: "right", vertical: "middle" };
          }
          if (colNumber === 7) {
             cell.numFmt = "0.00";
          }
        });
        
        if (row.peratus >= 100) {
           wsRow.eachCell(cell => {
             cell.fill = {
               type: "pattern",
               pattern: "solid",
               fgColor: { argb: "FFECFDF5" }
             };
           });
        }
        
        currentRow++;
      });

      // Add Totals Row
      const totalsRow = ws.addRow([
        "JUM",
        totals.target,
        totals.taburHariIni,
        totals.taburHinggaKini,
        totals.buruhHariIni,
        totals.buruhHinggaKini,
        overallPrestasiPercent,
        "",
        "",
        ""
      ]);
      
      totalsRow.eachCell((cell, colNumber) => {
        cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF0F172A" } // Dark Slate
        };
        cell.alignment = { horizontal: colNumber > 1 ? "right" : "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
        if (colNumber === 2 || colNumber === 3 || colNumber === 4 || colNumber === 5 || colNumber === 6) {
             cell.numFmt = "#,##0";
        }
        if (colNumber === 7) {
             cell.numFmt = "0.00";
        }
      });

      // Save file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Laporan_Baja_PUS_${activePus}_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error exporting to Excel:", err);
      alert("Ralat semasa memuat turun Excel.");
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-[20px] border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col md:flex-row items-center gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-48">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
            <input 
              type="text" 
              placeholder="Cari Blok..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-[9px] font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
            />
          </div>

          <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg w-full md:w-auto">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-2 py-1 text-[7px] font-black uppercase tracking-widest rounded transition-all ${
                filterStatus === 'all' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setFilterStatus('completed')}
              className={`px-2 py-1 text-[7px] font-black uppercase tracking-widest rounded transition-all ${
                filterStatus === 'completed' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400'
              }`}
            >
              100%
            </button>
            <button
              onClick={() => setFilterStatus('incomplete')}
              className={`px-2 py-1 text-[7px] font-black uppercase tracking-widest rounded transition-all ${
                filterStatus === 'incomplete' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400'
              }`}
            >
              Belum Siap
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg w-full md:w-auto">
          {[1, 2, 3, 4].map(p => (
            <button
              key={p}
              onClick={() => setActivePus(p)}
              className={`flex-1 md:flex-none px-3 py-1 text-[8px] font-black uppercase tracking-widest rounded transition-all ${
                activePus === p 
                  ? 'bg-emerald-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              P{p}
            </button>
          ))}
          <button
            onClick={() => openQuickRecord()}
            className="flex items-center justify-center gap-1.5 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm shadow-emerald-600/30 active:scale-95 cursor-pointer shrink-0"
            title="Tambah atau kemaskini rekod baja"
          >
            <Plus size={12} className="stroke-[3]" />
            <span>Rekod Baja</span>
          </button>
          <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-700 mx-1 hidden md:block"></div>
          <button
            onClick={handleExportToExcel}
            className="flex items-center justify-center gap-1.5 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl transition-all border border-emerald-500/20 active:scale-95 cursor-pointer shrink-0"
            title="Muat Turun Excel"
          >
            <Download size={12} className="stroke-[2.5]" />
            <span>Excel</span>
          </button>
        </div>
      </div>

      {/* Summary Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#064E3B] p-4 rounded-[20px] text-white shadow-lg">
           <p className="text-[8px] font-black uppercase opacity-60 leading-none tracking-widest">Sasaran (Target)</p>
           <p className="text-xl font-black mt-1.5">{totals.target.toLocaleString()} <span className="text-[10px] opacity-70">BEG</span></p>
        </div>
        <div className="bg-emerald-600 p-4 rounded-[20px] text-white shadow-lg shadow-emerald-500/20">
           <p className="text-[8px] font-black uppercase opacity-60 leading-none tracking-widest">Siap Hari Ini</p>
           <p className="text-xl font-black mt-1.5">{totals.taburHariIni.toLocaleString()} <span className="text-[10px] opacity-70">BEG</span></p>
        </div>
        <div className="bg-slate-900 p-4 rounded-[20px] text-white shadow-lg">
           <p className="text-[8px] font-black uppercase opacity-60 leading-none tracking-widest">Terkumpul HHI</p>
           <p className="text-xl font-black mt-1.5">{totals.taburHinggaKini.toLocaleString()} <span className="text-[10px] opacity-70">BEG</span></p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-[20px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden relative flex flex-col justify-center">
           <p className="text-[8px] font-black text-slate-400 uppercase leading-none tracking-widest">Prestasi PUS {activePus}</p>
           <p className="text-xl font-black text-[#064E3B] dark:text-emerald-400 mt-1.5">{overallPrestasiPercent}%</p>
           <div className="absolute bottom-0 left-0 h-1 bg-emerald-500" style={{ width: `${overallPrestasiPercent}%` }} />
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white dark:bg-slate-900 rounded-[20px] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#064E3B] text-emerald-100 font-black uppercase tracking-widest text-[7px] md:text-[8px]">
                <th rowSpan={2} className="py-3 px-1 md:px-2 border-b border-emerald-900/50 align-bottom">Blok</th>
                <th rowSpan={2} className="py-3 px-1 md:px-2 border-b border-emerald-900/50 text-right align-bottom">
                  Target<br/><span className="text-[5px] md:text-[6px]">(Beg)</span>
                </th>
                <th colSpan={2} className="pt-3 pb-1 px-1 md:px-2 text-center border-x border-emerald-900/50 shadow-inner">Tabur</th>
                <th colSpan={2} className="pt-3 pb-1 px-1 md:px-2 text-center border-r border-emerald-900/50 overflow-hidden">Buruh</th>
                <th rowSpan={2} className="py-3 px-1 md:px-2 border-b border-emerald-900/50 text-center align-bottom">% Capai</th>
                <th colSpan={2} className="pt-3 pb-1 px-1 md:px-2 text-center border-l border-emerald-900/50">Tarikh</th>
              </tr>
              <tr className="bg-[#059669] text-white font-black uppercase tracking-widest text-[7px] md:text-[8px]">
                <th className="pb-2 px-1 md:px-2 border-emerald-900/50 text-right border-l border-emerald-900/50">HI</th>
                <th className="pb-2 px-1 md:px-2 border-emerald-900/50 text-right border-r border-emerald-900/50">HHI</th>
                <th className="pb-2 px-1 md:px-2 border-emerald-900/50 text-right">HI</th>
                <th className="pb-2 px-1 md:px-2 border-emerald-900/50 text-right border-r border-emerald-900/50">HHI</th>
                <th className="pb-2 px-1 md:px-2 border-emerald-900/50 text-center border-l border-emerald-900/50">Mula</th>
                <th className="pb-2 px-1 md:px-2 border-emerald-900/50 text-center">Tamat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {processedData.map((row, idx) => {
                const statusInfo = getProgressStatus(row.peratus);
                return (
                  <tr 
                    key={idx} 
                    onClick={() => openQuickRecord(row.blok)}
                    className={`group hover:bg-emerald-50/40 dark:hover:bg-slate-800/60 transition-all cursor-pointer ${row.peratus >= 100 ? 'bg-emerald-50/10' : ''}`}
                    title={`Klik untuk rekod / kemaskini kemajuan Blok ${row.blok}`}
                  >
                    <td className="py-1.5 px-1 md:px-2 border-r border-transparent">
                      <div className="flex items-center justify-between gap-1">
                         <div className={`w-5 h-5 md:w-6 md:h-6 rounded flex items-center justify-center font-black text-[8px] md:text-[9px] border shadow-xs ${
                           row.peratus >= 100 ? 'bg-emerald-500 text-white border-emerald-400' :
                           row.peratus > 0 ? 'bg-purple-100 text-purple-600 border-purple-200' : 'bg-slate-100 text-slate-400 border-slate-200'
                         }`}>
                           {row.blok}
                         </div>
                         <span className="opacity-0 group-hover:opacity-100 text-[8px] font-bold text-emerald-600 dark:text-emerald-400 transition-opacity">
                           <Edit3 size={10} />
                         </span>
                      </div>
                    </td>
                    <td className="py-1.5 px-1 md:px-2 text-right text-[8px] md:text-[9px] font-black text-slate-600 dark:text-slate-400">{row.target.toLocaleString()}</td>
                    
                    {/* TABUR */}
                    <td className="py-1.5 px-1 md:px-2 text-right border-l border-slate-50 dark:border-slate-800/50">
                      {row.taburHariIni > 0 ? (
                        <div className="flex items-center justify-end gap-0.5 md:gap-1">
                           <ArrowUpRight size={8} className="text-emerald-500 hidden md:block" />
                           <span className="text-[8px] md:text-[9px] font-black text-emerald-600">{row.taburHariIni}</span>
                        </div>
                      ) : <span className="text-slate-300 text-[8px] md:text-[9px]">-</span>}
                    </td>
                    <td className="py-1.5 px-1 md:px-2 text-right text-[8px] md:text-[9px] font-black text-slate-800 dark:text-white border-r border-slate-50 dark:border-slate-800/50">{row.taburHinggaKini.toLocaleString()}</td>
                    
                    {/* BURUH */}
                    <td className="py-1.5 px-1 md:px-2 text-right text-[8px] md:text-[9px] font-bold text-slate-500">{row.buruhHariIni || '-'}</td>
                    <td className="py-1.5 px-1 md:px-2 text-right text-[8px] md:text-[9px] font-bold text-slate-500 border-r border-slate-50 dark:border-slate-800/50">{row.buruhHinggaKini || '-'}</td>
                    
                    {/* % CAPAI */}
                    <td className="py-1.5 px-1 md:px-2">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={`text-[8px] md:text-[9px] font-black ${statusInfo.text}`}>{row.peratus}%</span>
                        <div className="w-8 md:w-12 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                           <div className={`h-full ${statusInfo.color}`} style={{ width: `${Math.min(100, row.peratus)}%` }} />
                        </div>
                      </div>
                    </td>
                    
                    {/* TARIKH */}
                    <td className="py-1.5 px-0.5 text-[7px] md:text-[8px] font-bold text-slate-500 text-center whitespace-nowrap border-l border-slate-50 dark:border-slate-800/50">{row.tarikhMula}</td>
                    <td className="py-1.5 px-0.5 text-center">
                       {row.tarikhTamat === 'DALAM PROSES' ? (
                         <div className="inline-flex items-center justify-center min-w-[32px] px-1 py-0.5 bg-amber-100 text-amber-600 rounded text-[6px] md:text-[7px] font-black uppercase">
                            PROSES
                         </div>
                       ) : (
                         <div className="inline-flex items-center justify-center min-w-[32px] px-1 py-0.5 bg-emerald-100 text-emerald-600 rounded text-[6px] md:text-[7px] font-black uppercase">
                            {row.tarikhTamat}
                         </div>
                       )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-900 text-white font-black uppercase text-[7px] md:text-[8px] sticky bottom-0">
               <tr>
                 <td className="py-2 px-1 md:px-2">JUM</td>
                 <td className="py-2 px-1 md:px-2 text-right">{totals.target.toLocaleString()}</td>
                 <td className="py-2 px-1 md:px-2 text-right text-emerald-400">{totals.taburHariIni.toLocaleString()}</td>
                 <td className="py-2 px-1 md:px-2 text-right text-purple-400">{totals.taburHinggaKini.toLocaleString()}</td>
                 <td className="py-2 px-1 md:px-2 text-right">{totals.buruhHariIni.toLocaleString()}</td>
                 <td className="py-2 px-1 md:px-2 text-right">{totals.buruhHinggaKini.toLocaleString()}</td>
                 <td className="py-2 px-1 md:px-2 text-center" colSpan={3}>
                    <div className="flex items-center justify-center gap-1">
                       <TrendingUp size={8} className="text-purple-400 hidden md:block" />
                       {overallPrestasiPercent}%
                    </div>
                 </td>
               </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Quick Record Modal */}
      <AnimatePresence>
        {showQuickModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden"
            >
              <div className="bg-emerald-600 p-4 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-black text-sm">
                    {quickForm.blok_code}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Rekod Kemajuan Blok {quickForm.blok_code}</h3>
                    <p className="text-[10px] text-emerald-100">Program Pembajaan PUS {quickForm.pus}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowQuickModal(false)}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleQuickSubmit} className="p-5 space-y-4">
                {quickNotice && (
                  <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                    quickNotice.type === 'success' 
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  }`}>
                    {quickNotice.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
                    <span>{quickNotice.text}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Blok</label>
                    <select
                      value={quickForm.blok_code}
                      onChange={(e) => setQuickForm({ ...quickForm, blok_code: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      {rawMaster.map(item => (
                        <option key={item.blok_code} value={item.blok_code}>
                          Blok {item.blok_code}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">PUS (Pusingan)</label>
                    <select
                      value={quickForm.pus}
                      onChange={(e) => setQuickForm({ ...quickForm, pus: Number(e.target.value) })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value={1}>PUS 1</option>
                      <option value={2}>PUS 2</option>
                      <option value={3}>PUS 3</option>
                      <option value={4}>PUS 4</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Tarikh Kerja</label>
                    <input
                      type="date"
                      value={quickForm.entry_date}
                      onChange={(e) => setQuickForm({ ...quickForm, entry_date: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Bilangan Pekerja</label>
                    <input
                      type="number"
                      min={1}
                      value={quickForm.workers_count}
                      onChange={(e) => setQuickForm({ ...quickForm, workers_count: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Jumlah Beg Ditabur</label>
                    <input
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={quickForm.total_beg_completed || ''}
                      onChange={(e) => setQuickForm({ ...quickForm, total_beg_completed: parseFloat(e.target.value) || 0 })}
                      placeholder="Contoh: 45"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none text-emerald-600 dark:text-emerald-400 text-base"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Jenis Baja</label>
                    <input
                      type="text"
                      value={quickForm.fertilizer_type}
                      onChange={(e) => setQuickForm({ ...quickForm, fertilizer_type: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Nota / Catatan (Pilihan)</label>
                  <input
                    type="text"
                    value={quickForm.note}
                    onChange={(e) => setQuickForm({ ...quickForm, note: e.target.value })}
                    placeholder="cth. Cuaca petang hujan renyai"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowQuickModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingQuick}
                    className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    {isSavingQuick ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <Save size={14} />
                        <span>Simpan Kemajuan</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
