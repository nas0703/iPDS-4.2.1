import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  RotateCcw, 
  Download, 
  Building2,
  Clock,
  Layers,
  Save,
  HelpCircle,
  Info
} from 'lucide-react';
import { 
  getEstateConfig, 
  saveCustomEstateMasterData, 
  resetCustomEstateMasterData, 
  isEstateInStandby,
  EstateBlockInfo,
  getAllEstatesList
} from '../../../config/estateRegistry';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

interface MasterDatasetModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEstateId: string;
}

interface BlockInputRow {
  id: string;
  blok: string;
  pkt: string;
  luas: number;
  peneroka: number;
  target_hek: number;
}

export const MasterDatasetModal: React.FC<MasterDatasetModalProps> = ({
  isOpen,
  onClose,
  defaultEstateId,
}) => {
  const [selectedEstateId, setSelectedEstateId] = useState<string>(defaultEstateId);
  const [activeTab, setActiveTab] = useState<'upload' | 'manual' | 'preset'>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Manual rows state
  const [blockRows, setBlockRows] = useState<BlockInputRow[]>([
    { id: '1', blok: '1', pkt: '001', luas: 75.0, peneroka: 18, target_hek: 1.9 },
    { id: '2', blok: '2', pkt: '001', luas: 72.5, peneroka: 18, target_hek: 1.9 },
    { id: '3', blok: '3', pkt: '001', luas: 80.0, peneroka: 20, target_hek: 1.9 },
  ]);

  const estate = useMemo(() => getEstateConfig(selectedEstateId), [selectedEstateId]);
  const inStandby = useMemo(() => isEstateInStandby(selectedEstateId), [selectedEstateId]);
  const allEstates = useMemo(() => getAllEstatesList(), []);

  // Summary calculations
  const totalLuasCalculated = useMemo(() => {
    return blockRows.reduce((acc, curr) => acc + (Number(curr.luas) || 0), 0);
  }, [blockRows]);

  const totalPenerokaCalculated = useMemo(() => {
    return blockRows.reduce((acc, curr) => acc + (Number(curr.peneroka) || 0), 0);
  }, [blockRows]);

  // Handle Excel/CSV file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setStatusMessage(null);

    try {
      const fileName = file.name.toLowerCase();
      const rowsParsed: BlockInputRow[] = [];

      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const buffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.worksheets[0];

        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber <= 2) return; // Skip title / header rows
          const blokVal = row.getCell(1).text?.trim();
          if (!blokVal || blokVal.toLowerCase().includes('blok') || blokVal.toLowerCase().includes('total')) {
            return;
          }

          const pktVal = row.getCell(2).text?.trim() || '001';
          const luasVal = parseFloat(row.getCell(3).text) || 0;
          const penerokaVal = parseInt(row.getCell(4).text, 10) || 0;
          const targetVal = parseFloat(row.getCell(5).text) || (pktVal === '002' ? 1.6 : 1.9);

          if (luasVal > 0) {
            rowsParsed.push({
              id: `imported_${rowNumber}_${blokVal}`,
              blok: blokVal,
              pkt: pktVal,
              luas: Number(luasVal.toFixed(2)),
              peneroka: penerokaVal,
              target_hek: Number(targetVal.toFixed(2)),
            });
          }
        });
      } else if (fileName.endsWith('.csv')) {
        const text = await file.text();
        const lines = text.split(/\r\n|\n/);
        lines.forEach((line, idx) => {
          if (idx === 0) return; // Skip header
          const cols = line.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
          if (cols.length >= 3 && cols[0]) {
            const blok = cols[0];
            const pkt = cols[1] || '001';
            const luas = parseFloat(cols[2]) || 0;
            const peneroka = parseInt(cols[3], 10) || 0;
            const target = parseFloat(cols[4]) || 1.9;
            if (luas > 0) {
              rowsParsed.push({
                id: `csv_${idx}_${blok}`,
                blok,
                pkt,
                luas: Number(luas.toFixed(2)),
                peneroka,
                target_hek: target,
              });
            }
          }
        });
      }

      if (rowsParsed.length > 0) {
        setBlockRows(rowsParsed);
        setActiveTab('manual');
        setStatusMessage({
          type: 'success',
          text: `Berjaya memproses ${rowsParsed.length} blok daripada fail! Sila semak dan klik "Sahkan & Simpan Data Asas".`,
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: 'Tiada data blok sah yang dapat dibaca daripada fail. Sila pastikan format lajur mengikut templat standard.',
        });
      }
    } catch (err: any) {
      console.error('File parsing error:', err);
      setStatusMessage({
        type: 'error',
        text: `Ralat semasa memproses fail: ${err.message || 'Format tidak disokong'}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Add empty row
  const handleAddRow = () => {
    const nextNum = blockRows.length + 1;
    setBlockRows((prev) => [
      ...prev,
      {
        id: `row_${Date.now()}_${nextNum}`,
        blok: String(nextNum),
        pkt: '001',
        luas: 70.0,
        peneroka: 18,
        target_hek: 1.9,
      },
    ]);
  };

  // Remove row
  const handleRemoveRow = (id: string) => {
    setBlockRows((prev) => prev.filter((r) => r.id !== id));
  };

  // Update cell
  const handleUpdateRow = (id: string, field: keyof BlockInputRow, val: any) => {
    setBlockRows((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          return { ...r, [field]: val };
        }
        return r;
      })
    );
  };

  // Load sample preset data for Kledang or Sening
  const handleLoadPreset = (type: 'kledang_standard' | 'sening_standard') => {
    if (type === 'kledang_standard') {
      const sampleKledang: BlockInputRow[] = [
        { id: 'k1', blok: '1', pkt: '001', luas: 75.2, peneroka: 19, target_hek: 1.9 },
        { id: 'k2', blok: '2', pkt: '001', luas: 71.5, peneroka: 18, target_hek: 1.9 },
        { id: 'k3', blok: '3', pkt: '001', luas: 80.1, peneroka: 20, target_hek: 1.9 },
        { id: 'k4', blok: '4', pkt: '001', luas: 88.4, peneroka: 22, target_hek: 1.9 },
        { id: 'k5', blok: '5', pkt: '001', luas: 65.3, peneroka: 16, target_hek: 1.9 },
        { id: 'k6', blok: '6', pkt: '001', luas: 82.5, peneroka: 21, target_hek: 1.9 },
        { id: 'k7', blok: '7', pkt: '001', luas: 79.8, peneroka: 20, target_hek: 1.9 },
        { id: 'k8', blok: '8', pkt: '001', luas: 74.6, peneroka: 19, target_hek: 1.9 },
        { id: 'k9', blok: '9', pkt: '001', luas: 85.0, peneroka: 21, target_hek: 1.9 },
        { id: 'k10', blok: '10', pkt: '001', luas: 80.2, peneroka: 20, target_hek: 1.9 },
        { id: 'k11', blok: '11', pkt: '001', luas: 72.8, peneroka: 18, target_hek: 1.9 },
        { id: 'k12', blok: '12', pkt: '001', luas: 70.0, peneroka: 18, target_hek: 1.9 },
        { id: 'k13', blok: '13', pkt: '002', luas: 68.0, peneroka: 17, target_hek: 1.6 },
        { id: 'k14', blok: '14', pkt: '002', luas: 73.5, peneroka: 18, target_hek: 1.6 },
        { id: 'k15', blok: '15', pkt: '002', luas: 76.0, peneroka: 19, target_hek: 1.6 },
        { id: 'k16', blok: '16', pkt: '002', luas: 72.5, peneroka: 18, target_hek: 1.6 },
        { id: 'k17', blok: '17', pkt: '002', luas: 69.0, peneroka: 17, target_hek: 1.6 },
        { id: 'k18', blok: '18', pkt: '002', luas: 70.0, peneroka: 18, target_hek: 1.6 },
        { id: 'k88', blok: '88', pkt: '003', luas: 91.0, peneroka: 0, target_hek: 0.88 },
      ];
      setBlockRows(sampleKledang);
    } else {
      const sampleSening: BlockInputRow[] = [
        { id: 's1', blok: '1', pkt: '001', luas: 76.5, peneroka: 19, target_hek: 1.9 },
        { id: 's2', blok: '2', pkt: '001', luas: 73.0, peneroka: 18, target_hek: 1.9 },
        { id: 's3', blok: '3', pkt: '001', luas: 81.4, peneroka: 20, target_hek: 1.9 },
        { id: 's4', blok: '4', pkt: '001', luas: 87.2, peneroka: 22, target_hek: 1.9 },
        { id: 's5', blok: '5', pkt: '001', luas: 68.9, peneroka: 17, target_hek: 1.9 },
        { id: 's6', blok: '6', pkt: '001', luas: 84.1, peneroka: 21, target_hek: 1.9 },
        { id: 's7', blok: '7', pkt: '001', luas: 80.5, peneroka: 20, target_hek: 1.9 },
        { id: 's8', blok: '8', pkt: '001', luas: 77.3, peneroka: 19, target_hek: 1.9 },
        { id: 's9', blok: '9', pkt: '001', luas: 83.2, peneroka: 21, target_hek: 1.9 },
        { id: 's10', blok: '10', pkt: '001', luas: 79.8, peneroka: 20, target_hek: 1.9 },
        { id: 's11', blok: '11', pkt: '001', luas: 71.4, peneroka: 18, target_hek: 1.9 },
        { id: 's12', blok: '12', pkt: '001', luas: 75.0, peneroka: 19, target_hek: 1.9 },
        { id: 's13', blok: '13', pkt: '002', luas: 72.0, peneroka: 18, target_hek: 1.6 },
        { id: 's14', blok: '14', pkt: '002', luas: 76.8, peneroka: 19, target_hek: 1.6 },
        { id: 's15', blok: '15', pkt: '002', luas: 78.5, peneroka: 20, target_hek: 1.6 },
        { id: 's16', blok: '16', pkt: '002', luas: 74.0, peneroka: 19, target_hek: 1.6 },
        { id: 's17', blok: '17', pkt: '002', luas: 71.0, peneroka: 18, target_hek: 1.6 },
        { id: 's18', blok: '18', pkt: '002', luas: 72.0, peneroka: 18, target_hek: 1.6 },
        { id: 's88', blok: '88', pkt: '003', luas: 90.0, peneroka: 0, target_hek: 0.88 },
      ];
      setBlockRows(sampleSening);
    }
    setActiveTab('manual');
    setStatusMessage({
      type: 'success',
      text: 'Data contoh rasmi telah dimuatkan ke dalam jadual. Anda boleh mengubah suai nilai sebelum menyimpan.',
    });
  };

  // Save to system
  const handleSaveData = () => {
    if (blockRows.length === 0) {
      setStatusMessage({
        type: 'error',
        text: 'Sila masukkan sekurang-kurangnya satu blok.',
      });
      return;
    }

    const blocksPayload: Record<string, EstateBlockInfo> = {};
    blockRows.forEach((r) => {
      const cleanBlok = r.blok.trim();
      if (cleanBlok) {
        const luas = Number(r.luas) || 1.0;
        const target_hek = Number(r.target_hek) || 1.9;
        const target_mt = Number((luas * target_hek).toFixed(2));
        blocksPayload[cleanBlok] = {
          blok: cleanBlok,
          luas,
          target_mt,
          target_hek,
          pkt: r.pkt || '001',
          peneroka: Number(r.peneroka) || 0,
        };
      }
    });

    saveCustomEstateMasterData(selectedEstateId, {
      blocks: blocksPayload,
      totalHectares: totalLuasCalculated,
      annualTargetPkt1: 27.5,
      annualTargetPkt2: 27.5,
      annualTargetFelda: 11.5,
    });

    setStatusMessage({
      type: 'success',
      text: `Data asas untuk ${estate.name} berjaya disimpan! Status ladang kini aktif.`,
    });

    setTimeout(() => {
      onClose();
    }, 1200);
  };

  // Reset back to standby
  const handleResetToStandby = () => {
    if (window.confirm(`Adakah anda pasti ingin mengosongkan data dan meletakkan semula ${estate.name} ke Mod Standby?`)) {
      resetCustomEstateMasterData(selectedEstateId);
      setBlockRows([]);
      setStatusMessage({
        type: 'success',
        text: `${estate.name} telah dikembalikan ke Mod Standby (sedia menerima data set asas).`,
      });
      setTimeout(() => {
        onClose();
      }, 1000);
    }
  };

  // Download template
  const handleDownloadTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(`DATA_ASAS_${estate.code}`);
      worksheet.mergeCells('A1', 'E1');
      worksheet.getCell('A1').value = `TEMPLAT RASMI DATA SET ASAS - ${estate.name.toUpperCase()}`;
      worksheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
      worksheet.getCell('A1').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF064E3B' },
      };
      worksheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 30;

      const headers = ['NO BLOK', 'PERINGKAT (PKT)', 'LUAS (HEKTAR)', 'BILANGAN PENEROKA', 'SASARAN (T/HEK)'];
      const headerRow = worksheet.addRow(headers);
      headerRow.height = 25;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF0F766E' },
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      const sampleRows = [
        ['1', '001', 75.0, 18, 1.9],
        ['2', '001', 72.5, 18, 1.9],
        ['13', '002', 68.0, 17, 1.6],
        ['88', '003', 90.0, 0, 0.88],
      ];

      sampleRows.forEach((r) => worksheet.addRow(r));
      worksheet.columns = [{ width: 15 }, { width: 18 }, { width: 18 }, { width: 22 }, { width: 20 }];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      saveAs(blob, `Templat_Data_Asas_${estate.code}.xlsx`);
    } catch (err) {
      console.error('Failed to download template', err);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-wide flex items-center gap-2">
                  <span>Penyediaan Data Set Asas Ladang</span>
                  {inStandby && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black tracking-wider">
                      MOD STANDBY
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-400">
                  Konfigurasi keluasan hektar, bilangan peneroka, dan sasaran blok ladang
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Estate Selector Bar */}
          <div className="px-4 sm:px-6 py-3 bg-slate-800/50 border-b border-slate-700/50 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-400" />
              <label htmlFor="estate-select" className="text-xs font-bold text-slate-300 uppercase">
                Pilih Ladang Sasaran:
              </label>
              <select
                id="estate-select"
                value={selectedEstateId}
                onChange={(e) => setSelectedEstateId(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-amber-500"
              >
                {allEstates.map((est) => (
                  <option key={est.id} value={est.id}>
                    {est.name} ({est.code}) {est.isStandby ? '— [STANDBY]' : '— [AKTIF]'}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Status Semasa:</span>
              {inStandby ? (
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Standby (Sedia Terima Data)
                </span>
              ) : (
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Aktif ({Object.keys(estate.blocks).length} Blok, {estate.totalHectares.toFixed(2)} Ha)
                </span>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-800 px-4 sm:px-6 bg-slate-900/50">
            <button
              onClick={() => setActiveTab('upload')}
              className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
                activeTab === 'upload'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>1. Muat Naik Fail Excel/CSV</span>
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
                activeTab === 'manual'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>2. Jadual Blok ({blockRows.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('preset')}
              className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
                activeTab === 'preset'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>3. Data Asas Rasmi & Templat</span>
            </button>
          </div>

          {/* Status Alert */}
          {statusMessage && (
            <div
              className={`mx-4 sm:mx-6 mt-3 p-3 rounded-xl text-xs flex items-center gap-2 border ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40'
                  : 'bg-rose-950/40 text-rose-300 border-rose-500/40'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Content Area */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1">
            {/* TAB 1: FILE UPLOAD */}
            {activeTab === 'upload' && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-slate-700 hover:border-amber-500/60 rounded-2xl p-6 sm:p-10 text-center bg-slate-800/30 hover:bg-slate-800/50 transition-all">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-3">
                    <Upload className="w-7 h-7" />
                  </div>
                  <h4 className="text-sm font-bold text-white mb-1">
                    Pilih atau Seret Fail Data Set Asas
                  </h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
                    Sokongan untuk fail <strong>Excel (.xlsx, .xls)</strong> atau <strong>CSV (.csv)</strong>. 
                    Sistem akan mengekstrak senarai nombor blok, peringkat, keluasan (hektar), dan bilangan peneroka secara automatik.
                  </p>

                  <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer shadow-lg shadow-amber-500/20 transition-all">
                    <span>Pilih Fail Dari Komputer</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={isProcessing}
                    />
                  </label>

                  {isProcessing && (
                    <p className="text-xs text-amber-300 mt-3 animate-pulse">
                      Sedang memproses dan mengesahkan struktur data fail...
                    </p>
                  )}
                </div>

                <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/60 flex items-start gap-3">
                  <Info className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-300 space-y-1">
                    <p className="font-bold text-white">Susunan Lajur Yang Disyorkan:</p>
                    <p className="text-slate-400">
                      Lajur 1: <strong>No Blok</strong> (cth: 1, 2, 3...) • Lajur 2: <strong>Pkt</strong> (001, 002, 003) • Lajur 3: <strong>Luas Hektar</strong> • Lajur 4: <strong>Bil. Peneroka</strong> • Lajur 5: <strong>Sasaran T/Hek</strong>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: MANUAL TABLE ENTRY */}
            {activeTab === 'manual' && (
              <div className="space-y-3">
                {/* Summary Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-800/60 p-3 rounded-xl border border-slate-700 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Jumlah Blok:</span>
                    <span className="text-white font-black text-sm">{blockRows.length} Blok</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Jumlah Keluasan:</span>
                    <span className="text-amber-400 font-black text-sm">{totalLuasCalculated.toFixed(2)} Ha</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Jumlah Peneroka:</span>
                    <span className="text-teal-400 font-black text-sm">{totalPenerokaCalculated} Orang</span>
                  </div>
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={handleAddRow}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold text-[11px] flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Tambah Blok
                    </button>
                  </div>
                </div>

                {/* Table */}
                <div className="border border-slate-700/80 rounded-xl overflow-x-auto max-h-72">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-800 text-slate-300 font-bold sticky top-0 z-10">
                      <tr>
                        <th className="p-2.5 border-b border-slate-700 text-center w-12">#</th>
                        <th className="p-2.5 border-b border-slate-700">No Blok</th>
                        <th className="p-2.5 border-b border-slate-700">Peringkat (PKT)</th>
                        <th className="p-2.5 border-b border-slate-700">Luas (Ha)</th>
                        <th className="p-2.5 border-b border-slate-700">Bil. Peneroka</th>
                        <th className="p-2.5 border-b border-slate-700">Sasaran (T/Hek)</th>
                        <th className="p-2.5 border-b border-slate-700 text-center w-12">Hapus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {blockRows.map((row, idx) => (
                        <tr key={row.id} className="hover:bg-slate-800/40">
                          <td className="p-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.blok}
                              onChange={(e) => handleUpdateRow(row.id, 'blok', e.target.value)}
                              className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-semibold"
                            />
                          </td>
                          <td className="p-2">
                            <select
                              value={row.pkt}
                              onChange={(e) => handleUpdateRow(row.id, 'pkt', e.target.value)}
                              className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
                            >
                              <option value="001">Pkt 1 (001)</option>
                              <option value="002">Pkt 2 (002)</option>
                              <option value="003">Lot Felda (003)</option>
                              <option value="004">Lot Tambahan (004)</option>
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="0.01"
                              value={row.luas}
                              onChange={(e) => handleUpdateRow(row.id, 'luas', parseFloat(e.target.value) || 0)}
                              className="w-24 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              value={row.peneroka}
                              onChange={(e) => handleUpdateRow(row.id, 'peneroka', parseInt(e.target.value, 10) || 0)}
                              className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="0.1"
                              value={row.target_hek}
                              onChange={(e) => handleUpdateRow(row.id, 'target_hek', parseFloat(e.target.value) || 0)}
                              className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(row.id)}
                              className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-950/50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: OFFICIAL PRESETS & TEMPLATES */}
            {activeTab === 'preset' && (
              <div className="space-y-4">
                <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    <span>Muat Turun Templat Excel Rasmi</span>
                  </h4>
                  <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                    Muat turun borang templat Excel kosong mengikut piawaian Zon Adela untuk diisi oleh penyelia atau kerani ladang.
                  </p>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-emerald-400" />
                    <span>Muat Turun Templat Excel ({estate.code})</span>
                  </button>
                </div>

                <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-amber-400" />
                    <span>Pilihan Data Asas Pantas (Standard Presets)</span>
                  </h4>
                  <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                    Jika anda ingin menguji sistem atau memuatkan maklumat blok standard ladang:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleLoadPreset('kledang_standard')}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5"
                    >
                      <span>Isi Data Asas Standard FPM Kledang (19 Blok, 1485.40 Ha)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLoadPreset('sening_standard')}
                      className="px-3 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 text-xs font-bold flex items-center gap-1.5"
                    >
                      <span>Isi Data Asas Standard FPM Sening (19 Blok, 1512.60 Ha)</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              {!inStandby && (
                <button
                  type="button"
                  onClick={handleResetToStandby}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 border border-rose-900/50 flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Kembalikan ke Mod Standby</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleSaveData}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Sahkan & Simpan Data Asas</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
