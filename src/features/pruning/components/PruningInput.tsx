import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Plus, 
  Loader2, 
  ShieldCheck, 
  AlertTriangle,
  Scissors,
  Layers,
  MapPin
} from 'lucide-react';
import { PruningRecord } from '../types';
import { getActiveEstateId, ESTATE_CHANGED_EVENT } from '../../../utils/estateContext';
import { getEstateConfig, normalizeEstateId } from '../../../config/estateRegistry';

interface PruningInputProps {
  isDarkMode?: boolean;
  onShowToast?: (
    type: 'success' | 'error' | 'warning' | 'info',
    message: string
  ) => void;
  onSuccess?: () => void;
}

export const PruningInput: React.FC<PruningInputProps> = ({ 
  isDarkMode = false, 
  onShowToast = (_type: 'success' | 'error' | 'warning' | 'info', _message: string) => {}, 
  onSuccess 
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeEstate, setActiveEstate] = useState<string>(() => getActiveEstateId());
  
  const getTodayLocalDate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [formData, setFormData] = useState({
    blok: '',
    luas: 0,
    hek_siap: 0,
    type: 'kontrak', // 'cekrol' or 'kontrak'
    entry_date: getTodayLocalDate(),
  });

  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Sync with active estate
  useEffect(() => {
    const handleEstateChange = (e?: any) => {
      const newEstate = e?.detail?.estateId || getActiveEstateId();
      setActiveEstate(newEstate);
    };

    window.addEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
    window.addEventListener('storage', handleEstateChange);
    return () => {
      window.removeEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
      window.removeEventListener('storage', handleEstateChange);
    };
  }, []);

  // Retrieve current estate configuration and blocks
  const estateConfig = useMemo(() => {
    return getEstateConfig(activeEstate);
  }, [activeEstate]);

  const blockOptions = useMemo(() => {
    if (!estateConfig || !estateConfig.blocks) return [];
    return (Object.values(estateConfig.blocks) as any[]).sort((a: any, b: any) => {
      const numA = parseInt(String(a.blok).replace(/\D/g, '')) || 0;
      const numB = parseInt(String(b.blok).replace(/\D/g, '')) || 0;
      return numA - numB;
    });
  }, [estateConfig]);

  // Handle block selection with automatic Luas fill
  const handleBlockSelect = (blokValue: string) => {
    const match = blockOptions.find(b => String(b.blok) === String(blokValue));
    setFormData(prev => ({
      ...prev,
      blok: blokValue,
      luas: match ? Number(match.luas) : prev.luas
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.blok || formData.luas <= 0) {
      setMessage({ type: 'error', text: 'Sila pilih blok dan pastikan keluasan sah.' });
      return;
    }

    if (formData.hek_siap <= 0) {
      setMessage({ type: 'error', text: 'Sila masukkan jumlah hektar siap yang sah (> 0 HA).' });
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    try {
      const peratus = (formData.hek_siap / formData.luas) * 100;
      const targetEstate = getActiveEstateId();
      
      const payload: Partial<PruningRecord> = {
        blok: formData.blok,
        luas: formData.luas,
        tarikh_mula: formData.entry_date,
        tarikh_siap: formData.entry_date,
        hek_siap_pekerja: formData.type === 'kontrak' ? formData.hek_siap : 0,
        hek_pekerja_cekrol: formData.type === 'cekrol' ? formData.hek_siap : 0,
        jum_hektar_siap: formData.hek_siap,
        peratus_siap: peratus,
        estate_id: targetEstate
      };

      const token = typeof window !== 'undefined' ? (sessionStorage.getItem('ipds_token') || localStorage.getItem('ipds_token')) : null;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-estate-id': targetEstate
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/pruning?estate_id=${targetEstate}`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        onShowToast('success', `Rekod Cantas Pelepah untuk Blok ${formData.blok} (${formData.hek_siap} HA) berjaya disimpan.`);
        setMessage({ type: 'success', text: `Rekod Blok ${formData.blok} berjaya disimpan.` });
        setFormData(prev => ({
          ...prev,
          blok: '',
          hek_siap: 0,
        }));
        onSuccess?.();
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Gagal menyimpan rekod' }));
        throw new Error(errorData.error || `Ralat HTTP ${res.status}`);
      }
    } catch (err: any) {
      const errTxt = err.message || 'Ralat semasa menyimpan data cantas';
      setMessage({ type: 'error', text: errTxt });
      onShowToast('error', errTxt);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-xl border border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex flex-col gap-1 mb-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Kemasukan Kerja Cantas Pelepah</p>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <MapPin size={11} /> {estateConfig?.name || activeEstate}
            </span>
          </div>
          <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase leading-none italic">Harian Staf Ladang</h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 text-left">
            <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Tarikh</label>
            <input 
              type="date" 
              value={formData.entry_date}
              onChange={e => setFormData({...formData, entry_date: e.target.value})}
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-black text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div className="space-y-1.5 text-left">
            <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Pilih Blok</label>
            <select
              value={formData.blok}
              onChange={e => handleBlockSelect(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-black text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500/20"
              required
            >
              <option value="">-- Pilih Blok ({blockOptions.length} Blok) --</option>
              {blockOptions.map(b => (
                <option key={b.blok} value={b.blok}>
                  Blok {b.blok} ({Number(b.luas).toFixed(2)} HA)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 text-left">
            <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Keluasan Blok (HA)</label>
            <input 
              type="number" 
              step="0.01"
              value={formData.luas || ''}
              onChange={e => setFormData({...formData, luas: parseFloat(e.target.value) || 0})}
              placeholder="0.00"
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-black text-slate-800 dark:text-white"
              required
            />
          </div>
          <div className="space-y-1.5 text-left">
            <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Hektar Siap (HA)</label>
            <input 
              type="number" 
              step="0.01"
              value={formData.hek_siap || ''}
              onChange={e => setFormData({...formData, hek_siap: parseFloat(e.target.value) || 0})}
              placeholder="0.00"
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-black text-slate-800 dark:text-white"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5 text-left">
          <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Kategori Pekerja</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setFormData({...formData, type: 'cekrol'})}
              className={`py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                formData.type === 'cekrol' 
                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg' 
                  : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Cekrol
            </button>
            <button
              type="button"
              onClick={() => setFormData({...formData, type: 'kontrak'})}
              className={`py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                formData.type === 'kontrak' 
                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg' 
                  : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Kontrak
            </button>
          </div>
        </div>

        {message && (
          <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in fade-in zoom-in duration-300 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'}`}>
            {message.type === 'success' ? <ShieldCheck size={18} /> : <AlertTriangle size={18} />}
            <span className="text-[10px] font-black uppercase">{message.text}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isProcessing}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-5 rounded-3xl shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
        >
          {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Scissors size={20} />}
          {isProcessing ? 'MEMPROSES...' : 'SIMPAN REKOD CANTAS'}
        </button>

        {/* Realtime Calc */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <div className="space-y-0.5">
            <p className="text-[8px] font-black text-slate-400 uppercase">Peratusan Siap</p>
            <p className="text-sm font-black text-emerald-500">{formData.luas > 0 ? ((formData.hek_siap / formData.luas) * 100).toFixed(1) : '0.0'}%</p>
          </div>
          <div className="text-right">
            <p className="text-[8px] font-black text-slate-400 uppercase">Kategori</p>
            <p className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest">{formData.type}</p>
          </div>
        </div>
      </form>
    </div>
  );
};
