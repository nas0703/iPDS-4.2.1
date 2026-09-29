import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { getActiveEstateId, ESTATE_CHANGED_EVENT } from '../../utils/estateContext';
import { getEstateConfig, ESTATES_REGISTRY } from '../../config/estateRegistry';
import { PruningRecord, PruningSummary } from './types';
import { PruningDashboard } from './components/PruningDashboard';
import { PruningTable } from './components/PruningTable';
import { PruningChart } from './components/PruningChart';
import { 
  Plus, Upload, Search, RefreshCw, 
  Calendar, X, Save, Loader2, MapPin
} from 'lucide-react';
import ExcelJS from 'exceljs';

interface PruningModuleProps {
  isDarkMode: boolean;
  onShowToast: (type: 'success' | 'error', msg: string) => void;
}

export const PruningModule: React.FC<PruningModuleProps> = ({ isDarkMode, onShowToast }) => {
  const [data, setData] = useState<PruningRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showInputModal, setShowInputModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<Partial<PruningRecord> | null>(null);

  // Helper for API calls with automatic session auth headers and tenant isolation
  const safeFetch = async (url: string, options?: RequestInit): Promise<any> => {
    const token = typeof window !== 'undefined' ? (sessionStorage.getItem('ipds_token') || localStorage.getItem('ipds_token')) : null;
    const activeEstate = getActiveEstateId();

    const headers: Record<string, string> = {
      ...(options?.headers as Record<string, string> || {}),
      'x-estate-id': activeEstate
    };
    if (token && !headers['Authorization']) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include'
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Ralat pelayan (${res.status})`);
    }
    return res.json();
  };

  // Generate estate baseline records dynamically
  const getEstateBaselineData = (estateId: string): Partial<PruningRecord>[] => {
    const estateCfg = getEstateConfig(estateId);
    if (estateCfg && estateCfg.blocks) {
      return Object.values(estateCfg.blocks).map(b => ({
        blok: String(b.blok),
        luas: Number(b.luas) || 0,
        tarikh_mula: "2026-01-01",
        tarikh_siap: null,
        hek_siap_pekerja: 0,
        hek_pekerja_cekrol: 0,
        jum_hektar_siap: 0,
        peratus_siap: 0,
        estate_id: estateId
      }));
    }
    return [];
  };

  // Data from screenshot for initial FPM_TUNGGAL baseline
  const SCREENSHOT_DATA: Partial<PruningRecord>[] = [
    { blok: "1", luas: 72.15, tarikh_mula: "2026-01-01", hek_siap_pekerja: 12.00, hek_pekerja_cekrol: 0, jum_hektar_siap: 12.00, peratus_siap: 16.63 },
    { blok: "2", luas: 68.37, tarikh_mula: "2026-01-01", hek_siap_pekerja: 0, hek_pekerja_cekrol: 8.00, jum_hektar_siap: 8.00, peratus_siap: 11.70 },
    { blok: "3", luas: 76.59, tarikh_mula: "2026-01-01", hek_siap_pekerja: 40.00, hek_pekerja_cekrol: 0, jum_hektar_siap: 40.00, peratus_siap: 52.23 },
    { blok: "4", luas: 92.39, tarikh_mula: "2026-01-01", hek_siap_pekerja: 32.00, hek_pekerja_cekrol: 0, jum_hektar_siap: 32.00, peratus_siap: 34.64 },
    { blok: "5", luas: 60.19, tarikh_mula: "2026-01-01", hek_siap_pekerja: 20.00, hek_pekerja_cekrol: 0, jum_hektar_siap: 20.00, peratus_siap: 33.23 },
    { blok: "6", luas: 80.42, tarikh_mula: "2026-01-01", hek_siap_pekerja: 20.00, hek_pekerja_cekrol: 0, jum_hektar_siap: 20.00, peratus_siap: 24.87 },
    { blok: "7", luas: 89.46, tarikh_mula: "2026-01-01", hek_siap_pekerja: 30.00, hek_pekerja_cekrol: 0, jum_hektar_siap: 30.00, peratus_siap: 33.53 },
    { blok: "8", luas: 82.03, tarikh_mula: "2026-01-01", hek_siap_pekerja: 40.00, hek_pekerja_cekrol: 0, jum_hektar_siap: 40.00, peratus_siap: 48.76 },
    { blok: "9", luas: 83.61, tarikh_mula: "2026-01-01", hek_siap_pekerja: 40.00, hek_pekerja_cekrol: 0, jum_hektar_siap: 40.00, peratus_siap: 47.84 },
    { blok: "10", luas: 84.36, tarikh_mula: "2026-01-01", hek_siap_pekerja: 40.00, hek_pekerja_cekrol: 0, jum_hektar_siap: 40.00, peratus_siap: 47.42 },
    { blok: "11", luas: 47.85, tarikh_mula: "2026-01-01", hek_siap_pekerja: 20.00, hek_pekerja_cekrol: 0, jum_hektar_siap: 20.00, peratus_siap: 41.80 },
    { blok: "12", luas: 76.5, tarikh_mula: "2026-01-01", hek_siap_pekerja: 40.00, hek_pekerja_cekrol: 0, jum_hektar_siap: 40.00, peratus_siap: 52.29 },
    { blok: "13", luas: 50.75, tarikh_mula: "2026-01-01", hek_siap_pekerja: 20.00, hek_pekerja_cekrol: 0, jum_hektar_siap: 30.00, peratus_siap: 59.11 },
    { blok: "14", luas: 70.45, tarikh_mula: "2026-01-01", hek_siap_pekerja: 50.00, hek_pekerja_cekrol: 0, jum_hektar_siap: 50.00, peratus_siap: 70.97 },
    { blok: "15", luas: 68.36, tarikh_mula: "2026-01-01", hek_siap_pekerja: 30.00, hek_pekerja_cekrol: 0, jum_hektar_siap: 30.00, peratus_siap: 43.89 },
    { blok: "16", luas: 64.44, tarikh_mula: "2026-01-01", hek_siap_pekerja: 64.44, hek_pekerja_cekrol: 0, jum_hektar_siap: 64.44, peratus_siap: 100.00 },
    { blok: "17", luas: 84.08, tarikh_mula: "2026-01-01", hek_siap_pekerja: 0, hek_pekerja_cekrol: 84.08, jum_hektar_siap: 84.08, peratus_siap: 100.00 },
    { blok: "18", luas: 76.2, tarikh_mula: "2026-01-01", hek_siap_pekerja: 30.00, hek_pekerja_cekrol: 0, jum_hektar_siap: 30.00, peratus_siap: 39.37 },
    { blok: "19", luas: 81.75, tarikh_mula: "2026-01-01", hek_siap_pekerja: 40.00, hek_pekerja_cekrol: 0, jum_hektar_siap: 40.00, peratus_siap: 48.93 },
    { blok: "20", luas: 68.62, tarikh_mula: "2026-01-01", hek_siap_pekerja: 0, hek_pekerja_cekrol: 0, jum_hektar_siap: 0, peratus_siap: 0 },
    { blok: "21", luas: 24.26, tarikh_mula: "2026-01-01", hek_siap_pekerja: 0, hek_pekerja_cekrol: 0, jum_hektar_siap: 0, peratus_siap: 0 },
    { blok: "22", luas: 65.29, tarikh_mula: "2026-01-01", hek_siap_pekerja: 0, hek_pekerja_cekrol: 0, jum_hektar_siap: 0, peratus_siap: 0 },
  ];

  const activeEstateId = getActiveEstateId();

  const fetchPruningData = async () => {
    try {
      setLoading(true);
      const currentEstate = getActiveEstateId();
      const records = await safeFetch(`/api/pruning?estate_id=${currentEstate}`);
      
      if (records && Array.isArray(records) && records.length > 0) {
        const parsedRecords = records.map((r: any) => ({
          ...r,
          luas: Number(r.luas) || 0,
          hek_siap_pekerja: Number(r.hek_siap_pekerja) || 0,
          hek_pekerja_cekrol: Number(r.hek_pekerja_cekrol) || 0,
          jum_hektar_siap: Number(r.jum_hektar_siap) || ((Number(r.hek_siap_pekerja) || 0) + (Number(r.hek_pekerja_cekrol) || 0)),
          peratus_siap: Number(r.peratus_siap) || (Number(r.luas) > 0 ? (((Number(r.hek_siap_pekerja) || 0) + (Number(r.hek_pekerja_cekrol) || 0)) / Number(r.luas)) * 100 : 0)
        }));
        setData(parsedRecords);
      } else {
        if (currentEstate === 'FPM_TUNGGAL') {
          // Fallback to official estate baseline records ONLY for FPM_TUNGGAL
          const parsedScreenshot = SCREENSHOT_DATA.map((r: any) => ({
            ...r,
            luas: Number(r.luas) || 0,
            hek_siap_pekerja: Number(r.hek_siap_pekerja) || 0,
            hek_pekerja_cekrol: Number(r.hek_pekerja_cekrol) || 0,
            jum_hektar_siap: Number(r.jum_hektar_siap) || ((Number(r.hek_siap_pekerja) || 0) + (Number(r.hek_pekerja_cekrol) || 0)),
            peratus_siap: Number(r.peratus_siap) || (Number(r.luas) > 0 ? (((Number(r.hek_siap_pekerja) || 0) + (Number(r.hek_pekerja_cekrol) || 0)) / Number(r.luas)) * 100 : 0)
          }));
          setData(parsedScreenshot as PruningRecord[]);

          safeFetch(`/api/pruning/batch?estate_id=${currentEstate}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: SCREENSHOT_DATA })
          }).catch(() => {});
        } else {
          // Clean dynamic baseline for Adela, Kledang, Sening
          const baselineData = getEstateBaselineData(currentEstate);
          setData(baselineData as PruningRecord[]);
        }
      }
    } catch (error: any) {
      console.warn('Fallback to baseline pruning estate records:', error);
      const currentEstate = getActiveEstateId();
      if (currentEstate === 'FPM_TUNGGAL') {
        const parsedScreenshot = SCREENSHOT_DATA.map((r: any) => ({
          ...r,
          luas: Number(r.luas) || 0,
          hek_siap_pekerja: Number(r.hek_siap_pekerja) || 0,
          hek_pekerja_cekrol: Number(r.hek_pekerja_cekrol) || 0,
          jum_hektar_siap: Number(r.jum_hektar_siap) || ((Number(r.hek_siap_pekerja) || 0) + (Number(r.hek_pekerja_cekrol) || 0)),
          peratus_siap: Number(r.peratus_siap) || (Number(r.luas) > 0 ? (((Number(r.hek_siap_pekerja) || 0) + (Number(r.hek_pekerja_cekrol) || 0)) / Number(r.luas)) * 100 : 0)
        }));
        setData(parsedScreenshot as PruningRecord[]);
      } else {
        const baselineData = getEstateBaselineData(currentEstate);
        setData(baselineData as PruningRecord[]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPruningData();

    const handleEstateChange = () => {
      fetchPruningData();
    };

    window.addEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
    return () => window.removeEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
  }, []);

  const filteredData = useMemo(() => {
    return [...data].sort((a, b) => {
      const numA = parseInt(String(a.blok).replace(/\D/g, '')) || 0;
      const numB = parseInt(String(b.blok).replace(/\D/g, '')) || 0;
      return numA - numB;
    });
  }, [data]);

  const handleExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      
      // Check file extension
      if (!file.name.endsWith('.xlsx')) {
        throw new Error('Hanya fail .xlsx (Excel Moden) dibenarkan. Fail .xls atau .csv tidak disokong.');
      }

      const workbook = new ExcelJS.Workbook();
      const arrayBuffer = await file.arrayBuffer();
      
      try {
        await workbook.xlsx.load(arrayBuffer);
      } catch (err: any) {
        if (err.message.includes('zip file')) {
          throw new Error('Fail rosak atau format tidak sah. Sila simpan semula fail sebagai "Excel Workbook (.xlsx)".');
        }
        throw err;
      }
      const worksheet = workbook.getWorksheet(1);
      
      const newRecords: PruningRecord[] = [];
      
      worksheet?.eachRow((row, rowNumber) => {
        if (rowNumber > 2) { 
          const blokVal = row.getCell(1).value;
          const blok = blokVal !== null && blokVal !== undefined ? String(blokVal) : '';
          
          const luasVal = row.getCell(2).value;
          const luas = typeof luasVal === 'number' ? luasVal : (typeof luasVal === 'object' && luasVal !== null && 'result' in luasVal ? Number(luasVal.result) : 0);
          
          const hekPekerjaVal = row.getCell(5).value;
          const hek_pekerja = typeof hekPekerjaVal === 'number' ? hekPekerjaVal : (typeof hekPekerjaVal === 'object' && hekPekerjaVal !== null && 'result' in hekPekerjaVal ? Number(hekPekerjaVal.result) : 0);
          
          const hekCekrolVal = row.getCell(6).value;
          const hek_cekrol = typeof hekCekrolVal === 'number' ? hekCekrolVal : (typeof hekCekrolVal === 'object' && hekCekrolVal !== null && 'result' in hekCekrolVal ? Number(hekCekrolVal.result) : 0);
          
          if (blok && luas > 0) {
            const jum_siap = hek_pekerja + hek_cekrol;
            const peratus = (jum_siap / luas) * 100;

            newRecords.push({
              blok,
              luas,
              tarikh_mula: row.getCell(3).text || null,
              tarikh_siap: row.getCell(4).text || null,
              hek_siap_pekerja: hek_pekerja,
              hek_pekerja_cekrol: hek_cekrol,
              jum_hektar_siap: jum_siap,
              peratus_siap: peratus
            });
          }
        }
      });

      if (newRecords.length > 0) {
        const activeEst = getActiveEstateId();
        const recordsWithEstate = newRecords.map(r => ({ ...r, estate_id: activeEst }));
        await safeFetch(`/api/pruning/batch?estate_id=${activeEst}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: recordsWithEstate })
        });

        onShowToast('success', `Berjaya memuat naik ${newRecords.length} rekod.`);
        fetchPruningData();
      }
    } catch (error: any) {
      console.error('Excel upload error:', error);
      onShowToast('error', 'Gagal memuat naik Excel. Sila pastikan format betul.');
    } finally {
      setIsProcessing(false);
      if (event.target) event.target.value = '';
    }
  };

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord?.blok || !selectedRecord?.luas) return;

    try {
      setIsProcessing(true);
      const luas = Number(selectedRecord.luas);
      const hek_pekerja = Number(selectedRecord.hek_siap_pekerja || 0);
      const hek_cekrol = Number(selectedRecord.hek_pekerja_cekrol || 0);
      const jum_siap = hek_pekerja + hek_cekrol;
      const peratus = (jum_siap / luas) * 100;
      const activeEst = getActiveEstateId();

      const record: PruningRecord = {
        ...selectedRecord as PruningRecord,
        luas,
        hek_siap_pekerja: hek_pekerja,
        hek_pekerja_cekrol: hek_cekrol,
        jum_hektar_siap: jum_siap,
        peratus_siap: peratus,
        estate_id: activeEst
      };

      await safeFetch(`/api/pruning?estate_id=${activeEst}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });

      onShowToast('success', `Rekod Blok ${record.blok} berjaya disimpan.`);
      setShowInputModal(false);
      fetchPruningData();
    } catch (error: any) {
      console.error('Save error:', error);
      onShowToast('error', 'Gagal menyimpan rekod.');
    } finally {
      setIsProcessing(false);
    }
  };

  const summary: PruningSummary = useMemo(() => {
    const totalLuas = filteredData.reduce((acc, curr) => acc + (Number(curr.luas) || 0), 0);
    const totalHektarSiap = filteredData.reduce((acc, curr) => acc + (Number(curr.jum_hektar_siap) || 0), 0);
    const overallProgress = totalLuas > 0 ? (totalHektarSiap / totalLuas) * 100 : 0;
    const remainingHektar = Math.max(0, totalLuas - totalHektarSiap);

    return {
      totalLuas,
      totalHektarSiap,
      overallProgress,
      remainingHektar
    };
  }, [filteredData]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Dashboard Section */}
      <PruningDashboard summary={summary} isDarkMode={isDarkMode} />

      {/* Chart Section */}
      <PruningChart data={filteredData} isDarkMode={isDarkMode} />

      {/* Controls Section */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-end">
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <button
              onClick={fetchPruningData}
              disabled={loading}
              className={`p-3 rounded-2xl border ${isDarkMode ? 'bg-slate-900/50 border-white/5 text-slate-400' : 'bg-white border-slate-100'} hover:text-emerald-500 transition-all shadow-xl`}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Table Section */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 size={40} className="text-emerald-500 animate-spin" />
          <p className="text-slate-500 font-black uppercase tracking-widest text-xs font-mono">Memuatkan Data...</p>
        </div>
      ) : (
        <PruningTable 
          data={filteredData} 
          isDarkMode={isDarkMode} 
          onEdit={(record) => {
            setSelectedRecord(record);
            setShowInputModal(true);
          }}
        />
      )}

      {/* Input Modal */}
      <AnimatePresence>
        {showInputModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowInputModal(false)}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`relative w-full max-w-lg rounded-[32px] border p-8 shadow-2xl ${
                isDarkMode ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'
              }`}
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className={`text-2xl font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Kemas Kini Rekod</h3>
                  <p className="text-slate-500 text-sm">Gunakan borang ini untuk memasukkan data cantas pelepah manual.</p>
                </div>
                <button 
                  onClick={() => setShowInputModal(false)}
                  className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveRecord} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Blok</label>
                    <input
                      type="text"
                      required
                      value={selectedRecord?.blok || ''}
                      onChange={(e) => setSelectedRecord(prev => ({ ...prev!, blok: e.target.value }))}
                      className={`w-full border rounded-xl px-4 py-3 outline-none transition-all font-bold ${
                        isDarkMode ? 'bg-slate-800/50 border-white/5 text-white focus:border-emerald-500/50' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                      }`}
                      placeholder="Contoh: 1"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Luas (HA)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={selectedRecord?.luas || ''}
                      onChange={(e) => setSelectedRecord(prev => ({ ...prev!, luas: Number(e.target.value) }))}
                      className={`w-full border rounded-xl px-4 py-3 outline-none transition-all font-bold ${
                        isDarkMode ? 'bg-slate-800/50 border-white/5 text-white focus:border-emerald-500/50' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                      }`}
                      placeholder="Contoh: 72.15"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tarikh Mula</label>
                    <input
                      type="date"
                      value={selectedRecord?.tarikh_mula || ''}
                      onChange={(e) => setSelectedRecord(prev => ({ ...prev!, tarikh_mula: e.target.value }))}
                      className={`w-full border rounded-xl px-4 py-3 outline-none transition-all font-bold ${
                        isDarkMode ? 'bg-slate-800/50 border-white/5 text-white focus:border-emerald-500/50' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                      }`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tarikh Siap</label>
                    <input
                      type="date"
                      value={selectedRecord?.tarikh_siap || ''}
                      onChange={(e) => setSelectedRecord(prev => ({ ...prev!, tarikh_siap: e.target.value }))}
                      className={`w-full border rounded-xl px-4 py-3 outline-none transition-all font-bold ${
                        isDarkMode ? 'bg-slate-800/50 border-white/5 text-white focus:border-emerald-500/50' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Hek Siap Pekerja</label>
                    <input
                      type="number"
                      step="0.01"
                      value={selectedRecord?.hek_siap_pekerja || 0}
                      onChange={(e) => setSelectedRecord(prev => ({ ...prev!, hek_siap_pekerja: Number(e.target.value) }))}
                      className={`w-full border rounded-xl px-4 py-3 outline-none transition-all font-bold ${
                        isDarkMode ? 'bg-slate-800/50 border-white/5 text-white focus:border-emerald-500/50' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                      }`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Hek Pekerja Cekrol</label>
                    <input
                      type="number"
                      step="0.01"
                      value={selectedRecord?.hek_pekerja_cekrol || 0}
                      onChange={(e) => setSelectedRecord(prev => ({ ...prev!, hek_pekerja_cekrol: Number(e.target.value) }))}
                      className={`w-full border rounded-xl px-4 py-3 outline-none transition-all font-bold ${
                        isDarkMode ? 'bg-slate-800/50 border-white/5 text-white focus:border-emerald-500/50' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                      }`}
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowInputModal(false)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.95]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-900/40 transition-all active:scale-[0.95] flex items-center justify-center gap-2"
                  >
                    {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    SIMPAN REKOD
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
