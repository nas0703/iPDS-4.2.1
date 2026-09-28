import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import ExcelJS from 'exceljs';
import { 
  Search, 
  Download, 
  ArrowUpRight, 
  TrendingUp, 
  SlidersHorizontal,
  Calendar,
  Users,
  Edit2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { MerumputProgress } from '../types';

interface MerumputTableProps {
  data: MerumputProgress[];
  isDarkMode?: boolean;
  onEdit: (record: MerumputProgress) => void;
}

export const MerumputTable: React.FC<MerumputTableProps> = ({ data, isDarkMode, onEdit }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'incomplete' | 'overdue'>('all');
  const [activePusingan, setActivePusingan] = useState<number>(1);
  const [activeJenis, setActiveJenis] = useState<string>('ALL');

  const today = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Unique types from data or default set
  const categories = useMemo(() => {
    return ['BULATAN & LORONG', 'DADA (R&S)'];
  }, []);

  // Process data for presentation
  const processedData = useMemo(() => {
    const filtered = data.filter(record => {
      const matchSearch = record.blok.toLowerCase().includes(searchTerm.toLowerCase());
      const matchPusingan = record.pusingan === activePusingan;
      const matchJenis = activeJenis === 'ALL' || record.jenis === activeJenis;
      return matchSearch && matchPusingan && matchJenis;
    });

    const sortBlocks = (a: any, b: any) => {
      const numA = parseInt(a.blok, 10);
      const numB = parseInt(b.blok, 10);
      if (isNaN(numA) && isNaN(numB)) {
        return a.blok.localeCompare(b.blok);
      }
      if (isNaN(numA)) return 1;
      if (isNaN(numB)) return -1;
      return numA - numB;
    };

    if (activeJenis === 'ALL') {
      const groupedMap: Record<string, any[]> = {};
      filtered.forEach(record => {
        if (!groupedMap[record.blok]) {
          groupedMap[record.blok] = [];
        }
        groupedMap[record.blok].push(record);
      });

      const consolidated = Object.keys(groupedMap).map(blok => {
        const records = groupedMap[blok];
        const target = Number(records[0]?.luas || 0);
        
        let siapHI = 0;
        let buruhHI = 0;
        let siapHHI = 0;
        let buruhHHI = 0;
        const startDates: string[] = [];
        const endDates: string[] = [];
        let hasIncomplete = false;
        let hasStarted = false;

        records.forEach(rec => {
          const complete = Number(rec.hek_siap || 0);
          const isToday = rec.tarikh_mula === today;
          
          if (isToday) {
            siapHI += complete; 
            buruhHI += Number(rec.workers_count || 0);
          }
          siapHHI += complete;
          buruhHHI += Number(rec.workers_count || 0);

          if (rec.tarikh_mula) startDates.push(rec.tarikh_mula);
          if (rec.tarikh_siap) endDates.push(rec.tarikh_siap);

          const targetRec = Number(rec.luas || 0);
          if (complete < targetRec * 0.999) {
            hasIncomplete = true;
          }
          if (complete > 0) {
            hasStarted = true;
          }
        });

        const totalTarget = target * records.length;
        const pct = totalTarget > 0 ? (siapHHI / totalTarget) * 100 : 0;

        const formatCompactDate = (dateStr: string) => {
          if (!dateStr) return '-';
          try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear().toString().slice(-2)}`;
          } catch {
            return dateStr;
          }
        };

        let tarikhMulaVal = '-';
        if (startDates.length > 0 && hasStarted) {
          const sortedStarts = [...startDates].sort();
          tarikhMulaVal = formatCompactDate(sortedStarts[0]);
        }

        let tarikhTamatVal = '-';
        if (!hasIncomplete && records.length > 0) {
          if (endDates.length === records.length) {
            const sortedEnds = [...endDates].sort();
            tarikhTamatVal = formatCompactDate(sortedEnds[sortedEnds.length - 1]);
          } else {
            tarikhTamatVal = formatCompactDate(today);
          }
        } else if (hasStarted) {
          tarikhTamatVal = 'PROSES';
        }

        const scaledSiapHI = records.length > 0 ? siapHI / records.length : 0;
        const scaledSiapHHI = records.length > 0 ? siapHHI / records.length : 0;

        // Calculate daysSinceLast for group mode using the oldest (max days) weeding type
        let daysSinceLast = null;
        let oldestDaysSinceLast = null;
        records.forEach(rec => {
          const dateStr = rec.tarikh_siap || rec.tarikh_mula;
          if (dateStr) {
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
              const todayDate = new Date("2026-05-30");
              const diffTime = todayDate.getTime() - d.getTime();
              const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
              if (oldestDaysSinceLast === null || diffDays > oldestDaysSinceLast) {
                oldestDaysSinceLast = diffDays;
              }
            }
          }
        });
        daysSinceLast = oldestDaysSinceLast;

        return {
          id: `grouped-${blok}`,
          blok,
          luas: target,
          pusingan: activePusingan,
          jenis: "SEMUA JENIS",
          target,
          siapHI: scaledSiapHI,
          siapHHI: scaledSiapHHI,
          buruhHI,
          buruhHHI,
          pct,
          tarikhMula: tarikhMulaVal,
          tarikhTamat: tarikhTamatVal,
          originalRecords: records,
          daysSinceLast
        };
      });

      return consolidated
        .filter(row => {
          if (filterStatus === 'completed') return row.pct >= 99.9;
          if (filterStatus === 'incomplete') return row.pct < 99.9;
          if (filterStatus === 'overdue') return row.daysSinceLast !== null && row.daysSinceLast > 120;
          return true;
        })
        .sort(sortBlocks);
    }

    return filtered
      .map(record => {
        const target = Number(record.luas || 0);
        const complete = Number(record.hek_siap || 0);
        const pct = target > 0 ? (complete / target) * 100 : 0;

        const isToday = record.tarikh_mula === today;
        const siapHI = isToday ? complete : 0;
        const buruhHI = isToday ? Number(record.workers_count || 0) : 0;

        const siapHHI = complete;
        const buruhHHI = Number(record.workers_count || 0);

        const formatCompactDate = (dateStr: string) => {
          if (!dateStr) return '-';
          try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear().toString().slice(-2)}`;
          } catch {
            return dateStr;
          }
        };

        const tarikhMula = record.hek_siap > 0 ? formatCompactDate(record.tarikh_mula) : '-';
        const tarikhTamat = pct >= 99.9 
          ? formatCompactDate(record.tarikh_siap || record.tarikh_mula) 
          : (record.hek_siap > 0 ? 'PROSES' : '-');

        // Calculate daysSinceLast for single category mode
        let daysSinceLast = null;
        const lastDateStr = record.tarikh_siap || record.tarikh_mula;
        if (lastDateStr) {
          const d = new Date(lastDateStr);
          if (!isNaN(d.getTime())) {
            const todayDate = new Date("2026-05-30");
            const diffTime = todayDate.getTime() - d.getTime();
            daysSinceLast = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          }
        }

        return {
          ...record,
          target,
          siapHI,
          siapHHI,
          buruhHI,
          buruhHHI,
          pct,
          tarikhMula,
          tarikhTamat,
          daysSinceLast
        };
      })
      .filter(row => {
        if (filterStatus === 'completed') return row.pct >= 99.9;
        if (filterStatus === 'incomplete') return row.pct < 99.9;
        if (filterStatus === 'overdue') return row.daysSinceLast !== null && row.daysSinceLast > 120;
        return true;
      })
      .sort(sortBlocks);
  }, [data, searchTerm, filterStatus, activePusingan, activeJenis, today]);

  // Summary statistics
  const totals = useMemo(() => {
    const target = processedData.reduce((acc, curr) => acc + curr.target, 0);
    const siapHI = processedData.reduce((acc, curr) => acc + curr.siapHI, 0);
    const siapHHI = processedData.reduce((acc, curr) => acc + curr.siapHHI, 0);
    const buruhHI = processedData.reduce((acc, curr) => acc + curr.buruhHI, 0);
    const buruhHHI = processedData.reduce((acc, curr) => acc + curr.buruhHHI, 0);
    const pct = target > 0 ? (siapHHI / target) * 100 : 0;

    return {
      target,
      siapHI,
      siapHHI,
      buruhHI,
      buruhHHI,
      pct
    };
  }, [processedData]);

  // ExcelJS report export following the exactly requested landscape layout
  const handleExportToExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet(`Progres Merumput P${activePusingan}`);

      ws.pageSetup.orientation = "landscape";
      ws.pageSetup.fitToPage = true;
      ws.pageSetup.fitToWidth = 1;

      // Title
      ws.mergeCells("A1:I1");
      const titleCell = ws.getCell("A1");
      titleCell.value = `LAPORAN PROGRES MERUMPUT PUSINGAN ${activePusingan} (${activeJenis === 'ALL' ? 'SEMUA KATEGORI' : activeJenis})`;
      titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FF000000" } };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(1).height = 30;

      // Date Generated Info
      ws.mergeCells("A2:I2");
      const dateCell = ws.getCell("A2");
      dateCell.value = `DIJANA PADA: ${new Date().toLocaleDateString("ms-MY")} ${new Date().toLocaleTimeString("ms-MY")}`;
      dateCell.font = { name: "Arial", size: 10, italic: true };
      dateCell.alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(2).height = 20;

      // Table Multi-header configuration
      ws.mergeCells("A4:A5");
      ws.getCell("A4").value = "BLOK";
      ws.mergeCells("B4:B5");
      ws.getCell("B4").value = "TARGET (HA)";
      
      ws.mergeCells("C4:D4");
      ws.getCell("C4").value = "SIAP (HA)";
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

      // Styles for header row cells
      const headerRows = [ws.getRow(4), ws.getRow(5)];
      headerRows.forEach(row => {
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF064E3B" } // Dark Green
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

      ws.columns = [
        { width: 12 }, // Blok
        { width: 16 }, // Target (HA)
        { width: 12 }, // Siap HI
        { width: 12 }, // Siap HHI
        { width: 12 }, // Buruh HI
        { width: 12 }, // Buruh HHI
        { width: 14 }, // % Capai
        { width: 16 }, // Tarikh Mula
        { width: 16 }, // Tarikh Tamat
      ];

      // Insert data rows
      processedData.forEach(row => {
        const wsRow = ws.addRow([
          `Blok ${row.blok}`,
          row.target,
          row.siapHI,
          row.siapHHI,
          row.buruhHI,
          row.buruhHHI,
          row.pct,
          row.tarikhMula,
          row.tarikhTamat
        ]);

        wsRow.eachCell((cell, colNumber) => {
          cell.font = { name: "Arial", size: 10 };
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };

          if (colNumber === 2 || colNumber === 3 || colNumber === 4) {
            cell.numFmt = "0.00";
            cell.alignment = { horizontal: "right", vertical: "middle" };
          }
          if (colNumber === 5 || colNumber === 6) {
            cell.numFmt = "#,##0";
            cell.alignment = { horizontal: "right", vertical: "middle" };
          }
          if (colNumber === 7) {
            cell.numFmt = "0.0%";
            cell.value = row.pct / 100;
          }
        });

        // Highlight completed blocks with subtle green bg
        if (row.pct >= 99.9) {
          wsRow.eachCell(cell => {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFECFDF5" }
            };
          });
        }
      });

      // Total summation footer row
      const totalsRow = ws.addRow([
        "JUM",
        totals.target,
        totals.siapHI,
        totals.siapHHI,
        totals.buruhHI,
        totals.buruhHHI,
        totals.pct / 100,
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
        cell.alignment = { horizontal: colNumber > 1 && colNumber < 7 ? "right" : "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };

        if (colNumber === 2 || colNumber === 3 || colNumber === 4) {
          cell.numFmt = "0.00";
        }
        if (colNumber === 5 || colNumber === 6) {
          cell.numFmt = "#,##0";
        }
        if (colNumber === 7) {
          cell.numFmt = "0.0%";
        }
      });

      // Writes buffer and download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Laporan_Progres_Merumput_P${activePusingan}_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Gagal memuat turun fail Excel.");
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* 1. FILTERING & SEARCH PANEL CONTAINER */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto">
          {/* Circular Search box input */}
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="text" 
              placeholder="Cari Blok..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-850 rounded-full text-xs font-black placeholder:text-slate-400 text-slate-800 dark:text-white border border-slate-100 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* All, 100%, Incomplete buttons row */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-850 rounded-full w-full sm:w-auto overflow-x-auto shrink-0 scrollbar-none">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-250 shrink-0 ${
                filterStatus === 'all' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              SEMUA
            </button>
            <button
              onClick={() => setFilterStatus('completed')}
              className={`px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-250 shrink-0 ${
                filterStatus === 'completed' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              100% SIAP
            </button>
            <button
              onClick={() => setFilterStatus('incomplete')}
              className={`px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-250 shrink-0 ${
                filterStatus === 'incomplete' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              BELUM SIAP
            </button>
            <button
              onClick={() => setFilterStatus('overdue')}
              className={`px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-250 shrink-0 flex items-center gap-1 ${
                filterStatus === 'overdue' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 dark:text-rose-500/80 hover:text-rose-650'
              }`}
            >
              <span>⚠️ OVERDUE</span>
            </button>
          </div>
        </div>

        {/* Right tools (P1, P2 + Export Excel) */}
        <div className="flex items-center justify-between sm:justify-end gap-2.5 w-full md:w-auto">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-850 rounded-full w-fit">
            {[1, 2].map(p => (
              <button
                key={p}
                onClick={() => setActivePusingan(p)}
                className={`w-9 h-9 flex items-center justify-center text-[11px] font-black rounded-full transition-all duration-250 ${
                  activePusingan === p 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-white'
                }`}
              >
                P{p}
              </button>
            ))}
          </div>

          <div className="w-[1px] h-8 bg-slate-200 dark:bg-slate-800 hidden sm:block"></div>

          <button
            onClick={handleExportToExcel}
            className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-sm shadow-emerald-600/30 active:scale-95 cursor-pointer shrink-0"
            title="Muat Turun Excel"
          >
            <Download size={13} className="stroke-[2.5]" />
            <span>Excel</span>
          </button>
        </div>
      </div>

      {/* 2. CATEGORIES FILTER SHEETS */}
      <div className="bg-white dark:bg-slate-900 rounded-[24px] p-5 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5">
          <SlidersHorizontal size={14} className="text-emerald-500" />
          <h4 className="text-[10px] font-black uppercase text-slate-800 dark:text-white tracking-widest">
            KATEGORI JENIS MERACUN
          </h4>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveJenis('ALL')}
            className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-wider transition-all border ${
              activeJenis === 'ALL'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-850/50 border-slate-150 dark:border-slate-800 text-slate-400 hover:text-slate-500'
            }`}
          >
            SEMUA JENIS
          </button>
          
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setActiveJenis(c)}
              className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-wider transition-all border ${
                activeJenis === c
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-850/50 border-slate-150 dark:border-slate-800 text-slate-400 hover:text-slate-500'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* 3. FOUR PROGRESS STATS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Area Targets */}
        <div className="bg-[#054030] p-5 rounded-[24px] text-white shadow-xl flex flex-col justify-between min-h-[110px]">
          <p className="text-[9px] font-black uppercase opacity-60 tracking-widest leading-none">
            SASARAN KAWASAN
          </p>
          <div className="mt-3">
            <h1 className="text-2xl font-black font-display text-white">
              {totals.target.toFixed(2)} <span className="text-[12px] font-bold opacity-80">HA</span>
            </h1>
          </div>
        </div>

        {/* Card 2: Completed Hectare Today */}
        <div className="bg-[#10b981] p-5 rounded-[24px] text-white shadow-xl flex flex-col justify-between min-h-[110px]">
          <p className="text-[9px] font-black uppercase opacity-90 tracking-widest leading-none">
            SEMBURAN HARI INI
          </p>
          <div className="mt-3">
            <h1 className="text-2xl font-black font-display text-white">
              {totals.siapHI.toFixed(2)} <span className="text-[12px] font-bold opacity-80">HA</span>
            </h1>
          </div>
        </div>

        {/* Card 3: Total Cumulative Completed Hectare */}
        <div className="bg-[#0b132b] p-5 rounded-[24px] text-white shadow-xl flex flex-col justify-between min-h-[110px]">
          <p className="text-[9px] font-black uppercase opacity-60 tracking-widest leading-none">
            JUMLAH SEMBUR HHI
          </p>
          <div className="mt-3">
            <h1 className="text-2xl font-black font-display text-white">
              {totals.siapHHI.toFixed(2)} <span className="text-[12px] font-bold opacity-80">HA</span>
            </h1>
          </div>
        </div>

        {/* Card 4: Progress % achieved */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-[24px] shadow-sm relative flex flex-col justify-between min-h-[110px] overflow-hidden">
          <div>
            <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none">
              PENCAPAIAN PUS {activePusingan}
            </p>
            <h1 className="text-2xl font-black font-display text-emerald-600 dark:text-emerald-400 mt-2">
              {totals.pct.toFixed(0)}%
            </h1>
          </div>
          {/* Beautiful bottom background progress bar */}
          <div className="absolute bottom-0 left-0 h-1.5 bg-emerald-500 rounded-b-[24px]" style={{ width: `${Math.min(100, totals.pct)}%` }} />
        </div>
      </div>

      {/* 4. DUAL HEADERS DETAILED TABLE PROGRESS */}
      <div className="bg-white dark:bg-slate-900 rounded-[20px] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#054030] text-emerald-100 font-black uppercase tracking-widest text-[7px] md:text-[8px]">
                <th rowSpan={2} className="py-2.5 px-1 md:px-2 border-b border-emerald-950 text-left align-bottom">Blok</th>
                <th rowSpan={2} className="py-2.5 px-1 md:px-2 border-b border-emerald-950 text-right align-bottom">
                  Target<br/><span className="text-[5px] md:text-[6px] text-emerald-250 opacity-80">(HA)</span>
                </th>
                <th colSpan={2} className="pt-2.5 pb-1 px-1 md:px-2 text-center border-x border-emerald-950/60 shadow-inner">Siap (HA)</th>
                <th colSpan={2} className="pt-2.5 pb-1 px-1 md:px-2 text-center border-r border-emerald-950/60 shadow-inner">Buruh</th>
                <th rowSpan={2} className="py-2.5 px-1 md:px-2 border-b border-emerald-950 text-center align-bottom">% Capai</th>
                <th colSpan={2} className="pt-2.5 pb-1 px-1 md:px-2 text-center border-l border-emerald-950/60">Tarikh</th>
                <th rowSpan={2} className="py-2.5 px-1 md:px-2 border-b border-emerald-950 text-center align-bottom">Aksi</th>
              </tr>
              <tr className="bg-[#0a5c45] text-white font-black uppercase tracking-widest text-[7px] md:text-[8px]">
                <th className="pb-2 px-1 md:px-2 text-right border-l border-emerald-950/40">HI</th>
                <th className="pb-2 px-1 md:px-2 text-right border-r border-emerald-950/40">HHI</th>
                <th className="pb-2 px-1 md:px-2 text-right">HI</th>
                <th className="pb-2 px-1 md:px-2 text-right border-r border-emerald-950/40">HHI</th>
                <th className="pb-2 px-1 md:px-2 text-center border-l border-emerald-950/40">Mula</th>
                <th className="pb-2 px-1 md:px-2 text-center">Tamat</th>
              </tr>
            </thead>

            {processedData.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                    Tiada blok ditemui untuk tapisan carian semasa.
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/80">
                {processedData.map((row) => {
                  const isCompleted = row.pct >= 99.9;
                  return (
                    <tr 
                      key={`${row.blok}-${row.pusingan}-${row.jenis}`} 
                      className={`group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all ${
                        isCompleted ? 'bg-emerald-50/10 dark:bg-emerald-950/5' : ''
                      }`}
                    >
                      {/* BLOK ID CARD BADGE */}
                      <td className="py-1.5 px-1 md:px-2">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-6 h-6 md:w-7 md:h-7 rounded flex items-center justify-center font-black text-[8px] md:text-[9px] border shrink-0 ${
                            isCompleted 
                              ? 'bg-emerald-500 text-white border-emerald-400 shadow-sm' 
                              : row.pct > 0 
                                ? 'bg-amber-100 dark:bg-amber-955/35 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/30' 
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                          }`}>
                            {row.blok}
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] md:text-[10px] font-black text-slate-800 dark:text-white uppercase leading-none whitespace-nowrap">Blok {row.blok}</span>
                            {row.daysSinceLast !== null && row.daysSinceLast !== undefined && (
                              <span className={`text-[7px] md:text-[7.5px] font-extrabold mt-0.5 uppercase tracking-wider px-1 py-0.5 rounded w-fit ${
                                row.daysSinceLast > 120 
                                  ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10 dark:bg-rose-500/20 animate-pulse border border-rose-500/30' 
                                  : row.daysSinceLast > 100
                                    ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/20'
                                    : 'text-slate-400 dark:text-slate-500/80 bg-slate-100 dark:bg-slate-800/80'
                              }`}>
                                {row.daysSinceLast > 120 
                                  ? `⚠️ OVERDUE: ${row.daysSinceLast} Hari` 
                                  : `${row.daysSinceLast} Hari Berlalu`}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* TARGET AREA */}
                      <td className="py-1.5 px-1 md:px-2 text-right text-[8px] md:text-[9px] font-mono font-black text-slate-600 dark:text-slate-400">
                        {row.target.toFixed(2)}
                      </td>

                      {/* SIAP HA HI */}
                      <td className="py-1.5 px-1 md:px-2 text-right border-l border-slate-50 dark:border-slate-800/20">
                        {row.siapHI > 0 ? (
                          <div className="flex items-center justify-end text-emerald-600 dark:text-emerald-400 gap-0.5">
                            <ArrowUpRight size={8} className="hidden md:block" />
                            <span className="text-[8px] md:text-[9px] font-mono font-black">{row.siapHI.toFixed(2)}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700 text-[8px] md:text-[9px]">-</span>
                        )}
                      </td>

                      {/* SIAP HA HHI */}
                      <td className="py-1.5 px-1 md:px-2 text-right text-[8px] md:text-[9px] font-mono font-black text-slate-800 dark:text-white border-r border-slate-50 dark:border-slate-800/20">
                        {row.siapHHI > 0 ? row.siapHHI.toFixed(2) : <span className="text-slate-300 dark:text-slate-700">-</span>}
                      </td>

                      {/* BURUH HI */}
                      <td className="py-1.5 px-1 md:px-2 text-right text-[8px] md:text-[9px] font-mono font-bold text-slate-500">
                        {row.buruhHI > 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400">+{row.buruhHI}</span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700 text-[8px] md:text-[9px]">-</span>
                        )}
                      </td>

                      {/* BURUH HHI */}
                      <td className="py-1.5 px-1 md:px-2 text-right text-[8px] md:text-[9px] font-mono font-bold text-slate-600 dark:text-slate-400 border-r border-slate-50 dark:border-slate-800/20">
                        {row.siapHHI > 0 ? row.buruhHHI : <span className="text-slate-300 dark:text-slate-700">-</span>}
                      </td>

                      {/* % CAPAI */}
                      <td className="py-1.5 px-1 md:px-2">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={`text-[8px] md:text-[9px] font-black ${
                            isCompleted ? 'text-emerald-500' : 'text-amber-500'
                          }`}>
                            {row.pct.toFixed(0)}%
                          </span>
                          <div className="w-8 md:w-12 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shrink-0">
                            <div className={`h-full rounded-full ${
                              isCompleted ? 'bg-emerald-500' : 'bg-amber-500'
                            }`} style={{ width: `${Math.min(100, row.pct)}%` }} />
                          </div>
                        </div>
                      </td>

                      {/* DATE MULA */}
                      <td className="py-1.5 px-0.5 text-center text-[7.5px] md:text-[8px] font-mono font-bold text-slate-500 whitespace-nowrap border-l border-slate-50 dark:border-slate-800/20">
                        {row.tarikhMula}
                      </td>

                      {/* DATE TAMAT PILL */}
                      <td className="py-1.5 px-0.5 text-center">
                        {row.tarikhTamat === 'PROSES' ? (
                          <div className="inline-flex items-center justify-center min-w-[32px] px-1.5 py-0.5 bg-amber-50 dark:bg-amber-955/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/20 rounded-md text-[6.5px] md:text-[7px] font-black uppercase tracking-wider">
                            PROSES
                          </div>
                        ) : (
                          <div className="inline-flex items-center justify-center min-w-[32px] px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 rounded-md text-[6.5px] md:text-[7px] font-black uppercase tracking-wider shadow-sm">
                            {row.tarikhTamat}
                          </div>
                        )}
                      </td>

                      {/* ROW EDIT BUTTON */}
                      <td className="py-1.5 px-1 md:px-2 text-center">
                        {activeJenis === 'ALL' && row.originalRecords ? (
                          <div className="flex items-center justify-center gap-1">
                            {row.originalRecords.map((or: any) => (
                              <button
                                key={`${or.id || 'record'}-${or.blok}-${or.pusingan}-${or.jenis}`}
                                onClick={() => onEdit(or)}
                                className="px-1 py-0.5 bg-slate-50 hover:bg-emerald-50 dark:bg-slate-800/50 dark:hover:bg-emerald-950/30 text-[7px] md:text-[8px] font-black text-slate-500 dark:text-slate-400 hover:text-emerald-500 hover:border-emerald-500/30 dark:hover:text-emerald-400 border border-slate-200 dark:border-slate-800 rounded transition-all active:scale-[0.92] shrink-0 uppercase leading-none"
                                title={`Kemaskini ${or.jenis}`}
                              >
                                {or.jenis.startsWith('BULATAN') ? 'BL' : 'DADA'}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <button
                            onClick={() => onEdit(row as any)}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-lg text-slate-400 hover:text-emerald-500 transition-all active:scale-[0.93] inline-flex items-center"
                            title="Kemaskini Rekod Blok"
                          >
                            <Edit2 size={10} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            )}

            {processedData.length > 0 && (
              <tfoot className="bg-slate-900 text-white font-black uppercase text-[7px] md:text-[8px] sticky bottom-0">
                <tr>
                  <td className="py-2 px-1 md:px-2 text-left">JUMLAH</td>
                  <td className="py-2 px-1 md:px-2 text-right font-mono">{totals.target.toFixed(2)}</td>
                  <td className="py-2 px-1 md:px-2 text-right text-emerald-400 font-mono">+{totals.siapHI.toFixed(2)}</td>
                  <td className="py-2 px-1 md:px-2 text-right text-purple-400 font-mono">{totals.siapHHI.toFixed(2)}</td>
                  <td className="py-2 px-1 md:px-2 text-right font-mono">{totals.buruhHI || '-'}</td>
                  <td className="py-2 px-1 md:px-2 text-right font-mono">{totals.buruhHHI}</td>
                  <td className="py-2 px-1 md:px-2 text-center" colSpan={4}>
                    <div className="flex items-center justify-center gap-1 text-emerald-400">
                      <TrendingUp size={9} />
                      <span>{totals.pct.toFixed(1)}% SIAP KESELURUHAN (P{activePusingan})</span>
                    </div>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
