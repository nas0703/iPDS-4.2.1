import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Clock, 
  UploadCloud, 
  FileSpreadsheet, 
  Building2, 
  ChevronRight, 
  Sparkles,
  Info,
  X,
  AlertTriangle
} from 'lucide-react';
import { getEstateConfig, isEstateInStandby } from '../../config/estateRegistry';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

interface EstateStandbyBannerProps {
  activeEstateId: string;
  onOpenMasterDatasetModal: () => void;
  onOpenEstateSwitcher: () => void;
}

export const EstateStandbyBanner: React.FC<EstateStandbyBannerProps> = ({
  activeEstateId,
  onOpenMasterDatasetModal,
  onOpenEstateSwitcher,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const estate = getEstateConfig(activeEstateId);
  const inStandby = isEstateInStandby(activeEstateId);

  // Download template excel file for master data input
  const handleDownloadTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'iPDS FPM System';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet(`DATA_ASAS_${estate.code}`);

      // Title rows
      worksheet.mergeCells('A1', 'F1');
      worksheet.getCell('A1').value = `TEMPLAT DATA SET ASAS BLOK - ${estate.name.toUpperCase()}`;
      worksheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
      worksheet.getCell('A1').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF064E3B' }, // Emerald 900
      };
      worksheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 30;

      worksheet.mergeCells('A2', 'F2');
      worksheet.getCell('A2').value = `FPM Wilayah Johor Bahru • Zon Adela • Status: Mod Standby (Sedia Diisi)`;
      worksheet.getCell('A2').font = { italic: true, size: 10, color: { argb: 'FF475569' } };
      worksheet.getCell('A2').alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(2).height = 20;

      // Table Headers
      const headers = ['NO BLOK', 'PERINGKAT (PKT)', 'LUAS (HEKTAR)', 'BILANGAN PENEROKA', 'SASARAN BULANAN (T/HEK)', 'CATATAN'];
      const headerRow = worksheet.addRow(headers);
      headerRow.height = 25;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF0F766E' }, // Teal 700
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'medium' },
          right: { style: 'thin' },
        };
      });

      // Sample rows for guidance
      const sampleData = [
        ['1', '001', 75.20, 19, 1.90, 'Peringkat 1 (Contoh)'],
        ['2', '001', 71.50, 18, 1.90, 'Peringkat 1 (Contoh)'],
        ['13', '002', 68.00, 17, 1.60, 'Peringkat 2 (Contoh)'],
        ['1F', '003', 39.81, 0, 1.11, 'Lot FELDA (Jika Ada)'],
      ];

      sampleData.forEach((row) => {
        const r = worksheet.addRow(row);
        r.height = 20;
        r.eachCell((cell, colNum) => {
          cell.alignment = { vertical: 'middle', horizontal: colNum === 6 ? 'left' : 'center' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
        });
      });

      // Set column widths
      worksheet.columns = [
        { width: 14 },
        { width: 18 },
        { width: 16 },
        { width: 20 },
        { width: 26 },
        { width: 30 },
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      saveAs(blob, `Templat_Data_Asas_${estate.code}_Standby.xlsx`);
    } catch (err) {
      console.error('Failed to generate template:', err);
    }
  };

  if (!inStandby || isDismissed) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="mb-4 relative z-30"
      >
        <div className="bg-gradient-to-r from-amber-950/80 via-slate-900/90 to-amber-950/70 border border-amber-500/40 rounded-2xl p-3.5 sm:p-4 shadow-[0_10px_30px_rgba(245,158,11,0.1)] backdrop-blur-xl relative overflow-hidden">
          {/* Subtle glowing amber backdrop accent */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 relative z-10">
            {/* Left Content */}
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 mt-0.5 shadow-inner">
                <Clock className="w-5 h-5 animate-pulse" />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping inline-block" />
                    Mod Standby
                  </span>
                  <h3 className="text-sm sm:text-base font-black text-white tracking-wide uppercase">
                    {estate.name} • Sedia Menerima Data Set Asas
                  </h3>
                </div>

                <p className="text-xs text-slate-300/90 mt-1 leading-relaxed">
                  Ladang ini kini dalam status <strong className="text-amber-300 font-semibold">Standby</strong>. 
                  Sila masukkan maklumat blok (keluasan hektar, bilangan peneroka, dan sasaran) untuk mengaktifkan jadual analisis penuh.
                </p>
              </div>
            </div>

            {/* Right Buttons */}
            <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto shrink-0 pt-1 md:pt-0">
              <button
                type="button"
                onClick={onOpenMasterDatasetModal}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black tracking-wide uppercase flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all cursor-pointer active:scale-95"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Masukkan Data Asas</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Muat turun fail templat Excel untuk diisi"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">Templat Excel</span>
              </button>

              <button
                type="button"
                onClick={onOpenEstateSwitcher}
                className="px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                title="Pilih ladang lain"
              >
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Tukar Ladang</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDismissed(true)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors ml-auto sm:ml-0"
                title="Tutup banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
