
import React, { useState, useEffect, useMemo } from 'react';
import ExcelJS from 'exceljs';
import { FileText, Download } from 'lucide-react';
import { FERTILIZER_PROGRAM_2026, getFertilizerMasterForEstate, FertilizerBlockProgram } from '../program_data';
import { getPusInfo } from '../helpers';
import { getActiveEstateId, ESTATE_CHANGED_EVENT } from '../../../utils/estateContext';
import { getEstateConfig } from '../../../config/estateRegistry';
import { safeFetch } from '../../../utils/safeFetch';

export const FertilizerProgramTable: React.FC = () => {
  const [activeEstate, setActiveEstate] = useState<string>(() => getActiveEstateId());
  const [masterList, setMasterList] = useState<FertilizerBlockProgram[]>([]);

  useEffect(() => {
    const handleEstateChange = (e?: any) => {
      const newEstateId = e?.detail?.estateId || getActiveEstateId();
      setActiveEstate(newEstateId);
    };

    window.addEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
    window.addEventListener('storage', handleEstateChange);
    return () => {
      window.removeEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
      window.removeEventListener('storage', handleEstateChange);
    };
  }, []);

  useEffect(() => {
    const estateCfg = getEstateConfig(activeEstate);
    safeFetch(`/api/fertilizer/master?estate_id=${activeEstate}`)
      .then(res => res.json())
      .then((data: any) => {
        if (Array.isArray(data) && data.length > 0) {
          const formatted = data.map((d: any) => {
            const bCode = String(d.blok_code || d.blok || '').trim();
            const p1 = Number(d.pus1_beg ?? d.pus1 ?? 0);
            const p2 = Number(d.pus2_beg ?? d.pus2 ?? 0);
            const p3 = Number(d.pus3_beg ?? d.pus3 ?? 0);
            const p4 = Number(d.pus4_beg ?? d.pus4 ?? 0);
            return {
              blok: bCode,
              blok_code: bCode,
              luas: Number(d.luas_ha ?? d.luas ?? 0),
              luas_ha: Number(d.luas_ha ?? d.luas ?? 0),
              dirian: Number(d.dirian ?? 136),
              pokok: Number(d.pokok ?? 0),
              pus1: p1,
              pus2: p2,
              pus3: p3,
              pus4: p4,
              pus1_beg: p1,
              pus2_beg: p2,
              pus3_beg: p3,
              pus4_beg: p4,
              compact_total_beg: Number(d.compact_total_beg ?? (p1 + p4)),
              organic_total_beg: Number(d.organic_total_beg ?? (p2 + p3)),
              grand_total_beg: Number(d.grand_total_beg ?? (p1 + p2 + p3 + p4)),
              pkt: d.pkt || "001",
              estate_id: activeEstate
            };
          }).filter((item: any) => item.blok_code.length > 0);
          setMasterList(formatted.length > 0 ? formatted : getFertilizerMasterForEstate(activeEstate, estateCfg.blocks));
        } else {
          setMasterList(getFertilizerMasterForEstate(activeEstate, estateCfg.blocks));
        }
      })
      .catch(() => {
        setMasterList(getFertilizerMasterForEstate(activeEstate, estateCfg.blocks));
      });
  }, [activeEstate]);

  const estateCfg = useMemo(() => getEstateConfig(activeEstate), [activeEstate]);
  const currentProgram = masterList.length > 0 ? masterList : getFertilizerMasterForEstate(activeEstate, estateCfg.blocks);
  const isAdela = activeEstate === 'FPM_ADELA' || activeEstate === '5136' || activeEstate.toLowerCase().includes('adela');

  const pus1Info = getPusInfo(1, activeEstate);
  const pus2Info = getPusInfo(2, activeEstate);
  const pus3Info = getPusInfo(3, activeEstate);
  const pus4Info = getPusInfo(4, activeEstate);

  const handleExportToExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet(`Program Baja ${estateCfg.shortName || '2026'}`);

      ws.pageSetup.orientation = "landscape";
      ws.pageSetup.fitToPage = true;
      ws.pageSetup.fitToWidth = 1;

      // Title
      ws.mergeCells("A1:H1");
      const titleCell = ws.getCell("A1");
      titleCell.value = `PROGRAM BAJA 2026 - JADUAL INDUK PEMBAJAAN (${estateCfg.name.toUpperCase()})`;
      titleCell.font = { name: "Arial", size: 14, bold: true };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(1).height = 30;

      // Date
      ws.mergeCells("A2:H2");
      const dateCell = ws.getCell("A2");
      dateCell.value = `DIJANA PADA: ${new Date().toLocaleDateString("ms-MY")} ${new Date().toLocaleTimeString("ms-MY")}`;
      dateCell.font = { name: "Arial", size: 10, italic: true };
      dateCell.alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(2).height = 20;

      // Header Row
      const headerRow = ws.addRow([
        "BLOK", 
        "LUAS (HA)", 
        "POKOK", 
        `PUS 1 (${pus1Info.interval})\n${pus1Info.fertilizer}\n(${pus1Info.rate})`, 
        `PUS 2 (${pus2Info.interval})\n${pus2Info.fertilizer}\n(${pus2Info.rate})`, 
        `PUS 3 (${pus3Info.interval})\n${pus3Info.fertilizer}\n(${pus3Info.rate})`, 
        `PUS 4 (${pus4Info.interval})\n${pus4Info.fertilizer}\n(${pus4Info.rate})`, 
        "JUMLAH"
      ]);
      
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF0F172A" } // Dark Slate
        };
        cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
      });
      ws.getRow(4).height = 28;

      // Columns Width
      ws.columns = [
        { width: 10 }, // Blok
        { width: 12 }, // Luas
        { width: 12 }, // Pokok
        { width: 18 }, // PUS 1
        { width: 18 }, // PUS 2
        { width: 18 }, // PUS 3
        { width: 18 }, // PUS 4
        { width: 15 }, // Jumlah
      ];

      // Add Data
      currentProgram.forEach(row => {
        const total = row.pus1 + row.pus2 + row.pus3 + row.pus4;
        const wsRow = ws.addRow([
          row.blok_code || row.blok,
          row.luas,
          row.pokok,
          row.pus1,
          row.pus2,
          row.pus3,
          row.pus4,
          total
        ]);

        wsRow.eachCell((cell, colNumber) => {
          cell.font = { name: "Arial", size: 10 };
          cell.alignment = { horizontal: colNumber === 1 ? "center" : "right", vertical: "middle" };
          cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
          
          if (colNumber === 2) {
             cell.numFmt = "0.000";
          } else if (colNumber > 2) {
             cell.numFmt = "#,##0";
          }
        });
      });

      // Add Footer
      const totalPus1 = currentProgram.reduce((a, b) => a + b.pus1, 0);
      const totalPus2 = currentProgram.reduce((a, b) => a + b.pus2, 0);
      const totalPus3 = currentProgram.reduce((a, b) => a + b.pus3, 0);
      const totalPus4 = currentProgram.reduce((a, b) => a + b.pus4, 0);
      const totalAll = totalPus1 + totalPus2 + totalPus3 + totalPus4;

      const footerRow = ws.addRow([
        "JUMLAH KESELURUHAN (BEG)", "", "", totalPus1, totalPus2, totalPus3, totalPus4, totalAll
      ]);
      ws.mergeCells(`A${footerRow.number}:C${footerRow.number}`);

      footerRow.eachCell((cell, colNumber) => {
        if (colNumber === 1 || colNumber > 3) {
            cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
            cell.alignment = { horizontal: colNumber === 1 ? "left" : "right", vertical: "middle" };
            cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
        }
        if (colNumber > 3) {
            cell.numFmt = "#,##0";
        }
      });

      // Save file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Program_Baja_${estateCfg.shortName || '2026'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error exporting to Excel:", err);
      alert("Ralat semasa memuat turun Excel.");
    }
  };

  return (
    <div className="space-y-4">
      {/* Adela Specific Program Summary Banner */}
      {isAdela && (
        <div className="bg-gradient-to-r from-purple-950/70 via-slate-900 to-indigo-950/70 border border-purple-800/40 rounded-[24px] p-4 text-white shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-purple-700/30 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h4 className="text-xs font-black uppercase tracking-wider text-purple-200">
                Penyata Rasmi Program Baja 2026 - FPM ADELA (5136)
              </h4>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Total: 1,041.23 Ha • 138,934 Pokok
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
            <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
              <p className="text-[9px] font-bold text-slate-400 uppercase">Compact Felda 12</p>
              <p className="text-sm font-black text-purple-300 mt-0.5">12,504 Beg</p>
              <p className="text-[8px] text-slate-400">625.20 MT (P1: 6,947 + P4: 5,557)</p>
            </div>
            <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
              <p className="text-[9px] font-bold text-slate-400 uppercase">Felda Organic</p>
              <p className="text-sm font-black text-emerald-300 mt-0.5">8,336 Beg</p>
              <p className="text-[8px] text-slate-400">416.80 MT (P2: 4,168 + P3: 4,168)</p>
            </div>
            <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
              <p className="text-[9px] font-bold text-slate-400 uppercase">Jumlah Besar Beg</p>
              <p className="text-sm font-black text-amber-300 mt-0.5">20,840 Beg</p>
              <p className="text-[8px] text-slate-400">1,042.00 MT Keseluruhan</p>
            </div>
            <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
              <p className="text-[9px] font-bold text-slate-400 uppercase">Status Terkini (SBI)</p>
              <p className="text-sm font-black text-cyan-300 mt-0.5">10,894 Beg Siap</p>
              <p className="text-[8px] text-emerald-400 font-bold">52.3% Program Selesai</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-3 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-tight">Program Baja 2026</h3>
              <span className="px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-[8px] font-black uppercase">
                {estateCfg?.shortName || activeEstate}
              </span>
            </div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Jadual Induk Pembajaan (Beg)</p>
          </div>
          <button onClick={handleExportToExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-all">
            <Download size={12} />
            Export
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-[9px] text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-400 font-black uppercase tracking-widest">
              <tr>
                <th className="p-2 border-b border-slate-100 dark:border-slate-800">Blok</th>
                <th className="p-2 border-b border-slate-100 dark:border-slate-800 text-right">Luas (Ha)</th>
                <th className="p-2 border-b border-slate-100 dark:border-slate-800 text-right">Pokok</th>
                <th className="p-2 border-b border-slate-100 dark:border-slate-800 text-center bg-purple-500/5 text-purple-600 dark:text-purple-400">
                  <div>PUS 1 ({pus1Info.interval})</div>
                  <div className="text-[7px] font-black uppercase tracking-tighter mt-1 opacity-70">{pus1Info.fertilizer}</div>
                  <div className="text-[7px] font-bold uppercase tracking-tighter opacity-50">{pus1Info.rate}</div>
                </th>
                <th className="p-2 border-b border-slate-100 dark:border-slate-800 text-center bg-emerald-500/5 text-emerald-600 dark:text-emerald-400">
                  <div>PUS 2 ({pus2Info.interval})</div>
                  <div className="text-[7px] font-black uppercase tracking-tighter mt-1 opacity-70">{pus2Info.fertilizer}</div>
                  <div className="text-[7px] font-bold uppercase tracking-tighter opacity-50">{pus2Info.rate}</div>
                </th>
                <th className="p-2 border-b border-slate-100 dark:border-slate-800 text-center bg-blue-500/5 text-blue-600 dark:text-blue-400">
                  <div>PUS 3 ({pus3Info.interval})</div>
                  <div className="text-[7px] font-black uppercase tracking-tighter mt-1 opacity-70">{pus3Info.fertilizer}</div>
                  <div className="text-[7px] font-bold uppercase tracking-tighter opacity-50">{pus3Info.rate}</div>
                </th>
                <th className="p-2 border-b border-slate-100 dark:border-slate-800 text-center bg-amber-500/5 text-amber-600 dark:text-amber-400">
                  <div>PUS 4 ({pus4Info.interval})</div>
                  <div className="text-[7px] font-black uppercase tracking-tighter mt-1 opacity-70">{pus4Info.fertilizer}</div>
                  <div className="text-[7px] font-bold uppercase tracking-tighter opacity-50">{pus4Info.rate}</div>
                </th>
                <th className="p-2 border-b border-slate-100 dark:border-slate-800 text-right font-black text-slate-800 dark:text-white">Jumlah</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {currentProgram.map((row, idx) => {
                const total = row.pus1 + row.pus2 + row.pus3 + row.pus4;
                return (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="p-2 font-black text-slate-800 dark:text-white">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-4 bg-slate-200 dark:bg-slate-700 rounded-full group-hover:bg-purple-500 transition-colors"></div>
                        {row.blok_code || row.blok}
                      </div>
                    </td>
                    <td className="p-2 text-right font-bold text-slate-500">{row.luas.toFixed(3)}</td>
                    <td className="p-2 text-right font-bold text-slate-500">{row.pokok.toLocaleString()}</td>
                    <td className="p-2 text-center font-black text-purple-600 dark:text-purple-400 bg-purple-500/[0.02]">{row.pus1.toLocaleString()}</td>
                    <td className="p-2 text-center font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/[0.02]">{row.pus2.toLocaleString()}</td>
                    <td className="p-2 text-center font-black text-blue-600 dark:text-blue-400 bg-blue-500/[0.02]">{row.pus3.toLocaleString()}</td>
                    <td className="p-2 text-center font-black text-amber-600 dark:text-amber-400 bg-amber-500/[0.02]">{row.pus4.toLocaleString()}</td>
                    <td className="p-2 text-right font-black text-slate-800 dark:text-white bg-slate-50/50 dark:bg-slate-800/30">
                      {total.toLocaleString()}
                    </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-slate-900 text-white font-black uppercase text-[9px]">
            <tr>
              <td className="p-2" colSpan={3}>Jumlah Keseluruhan (Beg)</td>
              <td className="p-2 text-center">{currentProgram.reduce((a, b) => a + b.pus1, 0).toLocaleString()}</td>
              <td className="p-2 text-center">{currentProgram.reduce((a, b) => a + b.pus2, 0).toLocaleString()}</td>
              <td className="p-2 text-center">{currentProgram.reduce((a, b) => a + b.pus3, 0).toLocaleString()}</td>
              <td className="p-2 text-center">{currentProgram.reduce((a, b) => a + b.pus4, 0).toLocaleString()}</td>
              <td className="p-2 text-right text-emerald-400">
                {currentProgram.reduce((a, b) => a + (b.pus1 + b.pus2 + b.pus3 + b.pus4), 0).toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      
      <div className="p-3 bg-slate-50 dark:bg-slate-800/50 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white dark:bg-slate-900 rounded-lg flex items-center justify-center text-purple-500 shadow-sm">
            <FileText size={16} />
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-800 dark:text-white uppercase leading-none">Nota Program</p>
            <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Data diselaraskan mengikut Luas (Ha) dan Pokok setiap blok.</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <div className="px-2 py-1 bg-purple-500 text-white rounded-md text-[8px] font-black uppercase">Compact Felda 12</div>
          <div className="px-2 py-1 bg-emerald-500 text-white rounded-md text-[8px] font-black uppercase">Felda Organic</div>
        </div>
      </div>
    </div>
  </div>
);
};

