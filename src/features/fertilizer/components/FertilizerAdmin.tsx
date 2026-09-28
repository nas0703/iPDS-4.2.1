
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Trash2,
  RefreshCw,
  Database
} from 'lucide-react';
import { FERTILIZER_PROGRAM_2026 } from '../program_data';

const FERTILIZER_REPORT_IZAD = [
  { blok_code: "1", entry_date: "2026-04-03", total_beg_completed: 527 },
  { blok_code: "2", entry_date: "2026-04-06", total_beg_completed: 510 },
  { blok_code: "3", entry_date: "2026-04-09", total_beg_completed: 586 },
  { blok_code: "4", entry_date: "2026-04-11", total_beg_completed: 688 },
  { blok_code: "8", entry_date: "2026-03-19", total_beg_completed: 610 },
  { blok_code: "9", entry_date: "2026-03-17", total_beg_completed: 607 },
  { blok_code: "10", entry_date: "2026-03-26", total_beg_completed: 617 },
  { blok_code: "11", entry_date: "2026-03-27", total_beg_completed: 364 },
  { blok_code: "12", entry_date: "2026-04-01", total_beg_completed: 567 },
  { blok_code: "5", entry_date: "2026-04-14", total_beg_completed: 440 },
  { blok_code: "6", entry_date: "2026-04-16", total_beg_completed: 611 },
  { blok_code: "7", entry_date: "2026-04-18", total_beg_completed: 594 },
  { blok_code: "13", entry_date: "2026-04-21", total_beg_completed: 373 },
  { blok_code: "14", entry_date: "2026-04-22", total_beg_completed: 528 },
];

export const FertilizerAdmin: React.FC = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [activeMode, setActiveMode] = useState<'master' | 'entries'>('master');
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [importStatus, setImportStatus] = useState<{ success: boolean, message: string } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        // Transform and validate data structure to match DB schema
        const transformedData = data.map((row: any) => {
          const grand_total = (row.pus1_beg || 0) + (row.pus2_beg || 0) + (row.pus3_beg || 0) + (row.pus4_beg || 0);
          return {
            blok_code: String(row.BLOK || row.blok_code || ''),
            luas_ha: parseFloat(row.LUAS || row.luas_ha || '0'),
            dirian: parseInt(row.DIRIAN || row.dirian || '0'),
            pokok: parseInt(row.POKOK || row.pokok || '0'),
            pus1_beg: parseInt(row.PUS1 || row.pus1_beg || '0'),
            pus2_beg: parseInt(row.PUS2 || row.pus2_beg || '0'),
            pus3_beg: parseInt(row.PUS3 || row.pus3_beg || '0'),
            pus4_beg: parseInt(row.PUS4 || row.pus4_beg || '0'),
            compact_total_beg: (parseInt(row.PUS1 || row.pus1_beg || '0')) + (parseInt(row.PUS4 || row.pus4_beg || '0')),
            organic_total_beg: (parseInt(row.PUS2 || row.pus2_beg || '0')) + (parseInt(row.PUS3 || row.pus3_beg || '0')),
            grand_total_beg: grand_total
          };
        }).filter(d => d.blok_code !== '');

        setPreviewData(transformedData);
        setImportStatus(null);
      } catch (err) {
        console.error(err);
        setImportStatus({ success: false, message: 'Gagal membaca fail Excel. Sila pastikan format betul.' });
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSeedIzadProgress = () => {
    setActiveMode('entries');
    const transformed = FERTILIZER_REPORT_IZAD.map(row => ({
      ...row,
      pus: 1,
      interval_name: "FEB",
      fertilizer_type: "COMPACT FELDA 12",
      workers_count: 10,
      productivity_beg_per_worker: parseFloat((row.total_beg_completed / 10).toFixed(2)),
      target_beg_for_selected_pus: row.total_beg_completed,
      note: "Auto-seeded from WhatsApp report (Izad)"
    }));
    setPreviewData(transformed);
    setImportStatus({ success: true, message: 'Progress dari Laporan Izad sedia untuk disimpan.' });
  };

  const handleImport = async () => {
    if (previewData.length === 0) return;
    setIsUploading(true);

    try {
      const endpoint = activeMode === 'master' ? '/api/fertilizer/master/batch' : '/api/fertilizer/entries/batch';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: previewData })
      });

      if (res.ok) {
        setImportStatus({ success: true, message: `Berjaya import ${previewData.length} baris data.` });
        setPreviewData([]);
      } else {
        throw new Error('Gagal menyimpan data ke pangkalan data.');
      }
    } catch (err: any) {
      setImportStatus({ success: false, message: err.message });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSeedStandard = () => {
    const transformed = FERTILIZER_PROGRAM_2026.map(row => {
      const p1 = Math.round(row.pus1);
      const p2 = Math.round(row.pus2);
      const p3 = Math.round(row.pus3);
      const p4 = Math.round(row.pus4);
      const grand = p1 + p2 + p3 + p4;
      return {
        blok_code: String(row.blok),
        luas_ha: row.luas,
        dirian: row.dirian,
        pokok: row.pokok,
        pus1_beg: p1,
        pus2_beg: p2,
        pus3_beg: p3,
        pus4_beg: p4,
        compact_total_beg: p1 + p4,
        organic_total_beg: p2 + p3,
        grand_total_beg: grand
      };
    });
    setPreviewData(transformed);
    setImportStatus({ success: true, message: 'Data Program 2026 sedia untuk disimpan.' });
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-xl border border-slate-100 dark:border-slate-800 space-y-6">
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Admin Module</p>
          <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase leading-none italic">Import Data Perancangan</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[24px] bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 transition-all group relative">
            <input 
              type="file" 
              id="excel-upload" 
              hidden 
              accept=".xlsx, .xls, .csv" 
              onChange={handleFileUpload}
            />
            <label htmlFor="excel-upload" className="cursor-pointer flex flex-col items-center text-center">
              <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform">
                <Upload className="text-purple-500" size={18} />
              </div>
              <p className="text-[10px] font-black text-slate-800 dark:text-white uppercase">Upload Excel</p>
              <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase">Master Schedule</p>
            </label>
          </div>

          <button 
            onClick={() => { setActiveMode('master'); handleSeedStandard(); }}
            className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-purple-200 dark:border-purple-900/50 rounded-[24px] bg-purple-50 dark:bg-purple-900/10 hover:bg-purple-100 transition-all group text-center"
          >
            <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform">
              <Database className="text-purple-600" size={18} />
            </div>
            <p className="text-[10px] font-black text-purple-700 dark:text-purple-400 uppercase leading-none">Setup Target</p>
            <p className="text-[8px] font-bold text-purple-400 mt-1 uppercase">Program 2026</p>
          </button>

          <button 
            onClick={handleSeedIzadProgress}
            className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-emerald-200 dark:border-emerald-900/50 rounded-[24px] bg-emerald-50 dark:bg-emerald-900/10 hover:bg-emerald-100 transition-all group text-center"
          >
            <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform">
              <CheckCircle2 className="text-emerald-600" size={18} />
            </div>
            <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase leading-none">Seed Progress</p>
            <p className="text-[8px] font-bold text-emerald-400 mt-1 uppercase">Laporan Izad</p>
          </button>
        </div>

        {importStatus && (
          <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in fade-in zoom-in duration-300 ${importStatus.success ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {importStatus.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span className="text-[10px] font-black uppercase">{importStatus.message}</span>
          </div>
        )}

        {previewData.length > 0 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Preview: {previewData.length} Blok</p>
              <button 
                onClick={() => setPreviewData([])}
                className="text-rose-500 text-[10px] font-black uppercase hover:underline"
              >
                Batal
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
              <table className="w-full text-[9px] text-left">
                 <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                   <tr>
                     <th className="p-3 font-black uppercase text-slate-400">{activeMode === 'master' ? 'Blok' : 'Tarikh'}</th>
                     <th className="p-3 font-black uppercase text-slate-400">{activeMode === 'master' ? 'Luas' : 'Blok'}</th>
                     <th className="p-3 font-black uppercase text-slate-400">{activeMode === 'master' ? 'PUS 1' : 'Pusingan'}</th>
                     <th className="p-3 font-black uppercase text-slate-400">{activeMode === 'master' ? 'PUS 2' : 'Beg Siap'}</th>
                     <th className="p-3 font-black uppercase text-slate-400">{activeMode === 'master' ? 'PUS 3' : 'Pekerja'}</th>
                     <th className="p-3 font-black uppercase text-slate-400">{activeMode === 'master' ? 'PUS 4' : 'Nota'}</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                   {previewData.map((row, i) => (
                     <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                       {activeMode === 'master' ? (
                         <>
                           <td className="p-3 font-black text-slate-800 dark:text-white">{row.blok_code}</td>
                           <td className="p-3 font-bold text-slate-500">{row.luas_ha}</td>
                           <td className="p-3 text-purple-600 font-bold">{row.pus1_beg}</td>
                           <td className="p-3 text-emerald-600 font-bold">{row.pus2_beg}</td>
                           <td className="p-3 text-blue-600 font-bold">{row.pus3_beg}</td>
                           <td className="p-3 text-amber-600 font-bold">{row.pus4_beg}</td>
                         </>
                       ) : (
                         <>
                           <td className="p-3 font-bold text-slate-500">{row.entry_date}</td>
                           <td className="p-3 font-black text-slate-800 dark:text-white">{row.blok_code}</td>
                           <td className="p-3"><span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-bold uppercase">{row.interval_name}</span></td>
                           <td className="p-3 font-black text-emerald-600">{row.total_beg_completed}</td>
                           <td className="p-3 font-bold">{row.workers_count}</td>
                           <td className="p-3 text-slate-400 italic truncate max-w-[100px]">{row.note}</td>
                         </>
                       )}
                     </tr>
                   ))}
                 </tbody>
              </table>
            </div>
            <button
               onClick={handleImport}
               disabled={isUploading}
               className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              {isUploading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
              {isUploading ? 'MENGIMPORT...' : 'SIMPAN SEMUA DATA'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
