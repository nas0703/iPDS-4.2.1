import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Plus, 
  Loader2, 
  ShieldCheck, 
  AlertTriangle,
  Flame,
  Sprout,
  Trash2,
  Droplet
} from 'lucide-react';

import { getActiveEstateConfig } from '../../../config/estateRegistry';
import { safeFetch } from '../../../utils/safeFetch';

interface ChemicalItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

interface MerumputInputProps {
  isDarkMode?: boolean;
  onShowToast?: (type: "success" | "error", msg: string) => void;
  onSuccess?: () => void;
}

export const MerumputInput: React.FC<MerumputInputProps> = ({ isDarkMode, onShowToast, onSuccess }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [chemicals, setChemicals] = useState<ChemicalItem[]>([]);
  const [loadingChemicals, setLoadingChemicals] = useState(false);

  // Dynamic blocks from active estate config
  const estateCfg = getActiveEstateConfig();
  const estateBlocks = estateCfg && estateCfg.blocks 
    ? Object.values(estateCfg.blocks).map((b: any) => ({
        blok: String(b.blok),
        luas: Number(b.luas) || 0,
        pkt: b.pkt || '001'
      }))
    : [];

  // Form State
  const [formData, setFormData] = useState({
    blok: '',
    luas: 0,
    hek_siap: 0,
    pusingan: 1,
    jenis: 'BULATAN & LORONG', // 'BULATAN & LORONG', 'SELANGKAS', 'RUMPAI LIAR'
    workers_count: 1,
    entry_date: (() => {
      const d = new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    })(),
    
    // Chemical Usage
    useChemical: false,
    chemicalId: '',
    chemicalQty: 0,
  });

  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Fetch chemical list
  const fetchChemicals = async () => {
    setLoadingChemicals(true);
    try {
      const res = await safeFetch('/api/merumput/inventory').catch(() => null);
      if (res && res.ok) {
        const data = await res.json().catch(() => []);
        setChemicals(data || []);
        if (data && data.length > 0) {
          setFormData(prev => ({ ...prev, chemicalId: data[0].id }));
        }
      }
    } catch (e) {
      console.warn("Gagal mendapatkan senarai racun:", e);
    } finally {
      setLoadingChemicals(false);
    }
  };

  useEffect(() => {
    fetchChemicals();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.blok || formData.luas <= 0) {
      setMessage({ type: 'error', text: 'Sila masukkan blok dan luas yang sah.' });
      return;
    }

    if (formData.useChemical && (!formData.chemicalId || formData.chemicalQty <= 0)) {
      setMessage({ type: 'error', text: 'Sila pilih jenis racun dan kuantiti yang sah.' });
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    try {
      // 1. Save weeding progress
      const progressPayload = {
        blok: formData.blok,
        luas: formData.luas,
        pusingan: formData.pusingan,
        jenis: formData.jenis,
        tarikh_mula: formData.entry_date,
        tarikh_siap: formData.hek_siap >= formData.luas ? formData.entry_date : undefined,
        hek_siap: formData.hek_siap,
        workers_count: formData.workers_count,
        updated_at: new Date().toISOString()
      };

      const res = await safeFetch('/api/merumput/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(progressPayload)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Gagal menyimpan kemajuan merumput' }));
        throw new Error(errorData.error);
      }

      const saveResult = await res.json();

      // 2. Perform Chemical Reduction if enabled
      if (formData.useChemical) {
        const selectedChemical = chemicals.find(c => c.id === formData.chemicalId);
        const chemRes = await safeFetch(`/api/merumput/inventory/${formData.chemicalId}/transaction`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'OUT',
            quantity: formData.chemicalQty,
            reference: `Kerja Meracun: Blok ${formData.blok} (${formData.jenis})`
          })
        });

        if (!chemRes.ok) {
          onShowToast?.('error', `Kerja merumput disimpan, tetapi kegagalan berlaku semasa mengurangkan stok racun.`);
        } else {
          onShowToast?.('success', `Stok racun ${selectedChemical?.name} dikurangkan sebanyak ${formData.chemicalQty} ${selectedChemical?.unit}.`);
        }
      }

      onShowToast?.('success', `Rekod Merumput & Meracun untuk Blok ${formData.blok} berjaya disimpan.`);
      setMessage({ type: 'success', text: 'Rekod berjaya disimpan.' });
      
      // Reset form
      setFormData(prev => ({
        ...prev,
        blok: '',
        hek_siap: 0,
        useChemical: false,
        chemicalQty: 0
      }));

      onSuccess?.();
      fetchChemicals(); // Refresh chemical quantities
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Ralat semasa menyimpan data' });
      onShowToast?.('error', err.message || 'Gagal menyimpan rekod.');
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedChemicalObj = chemicals.find(c => c.id === formData.chemicalId);

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-xl border border-slate-100 dark:border-slate-800 space-y-4 text-left">
        <div className="flex flex-col gap-1 mb-2">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Kemasukan Kerja Merumput & Racun</p>
          <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase leading-none italic">Sistem Kawalan Rumpai</h3>
        </div>

        {/* Tarikh & Blok */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Tarikh Mula</label>
            <input 
              type="date" 
              value={formData.entry_date}
              onChange={e => setFormData({...formData, entry_date: e.target.value})}
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-black text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Pilih Blok Estet</label>
            <select 
              value={formData.blok}
              onChange={e => {
                const selectedBlok = e.target.value;
                const blockInfo = estateBlocks.find(b => b.blok === selectedBlok);
                setFormData({
                  ...formData,
                  blok: selectedBlok,
                  luas: blockInfo ? blockInfo.luas : 0,
                  hek_siap: blockInfo ? blockInfo.luas : 0 // Default to fully completed HA, user can reduce if partial
                });
              }}
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-black text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="">Pilih Blok</option>
              {estateBlocks.map(b => (
                <option key={b.blok} value={b.blok}>Blok {b.blok} ({b.luas} HA)</option>
              ))}
            </select>
          </div>
        </div>

        {/* Luas & Progress */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Luas Blok (HA)</label>
            <input 
              type="number" 
              step="0.01"
              readOnly
              value={formData.luas || ''}
              placeholder="Auto-fill"
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-black text-slate-500 dark:text-slate-400 cursor-not-allowed"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Hektar Siap (HA)</label>
            <input 
              type="number" 
              step="0.01"
              value={formData.hek_siap || ''}
              onChange={e => setFormData({...formData, hek_siap: parseFloat(e.target.value) || 0})}
              placeholder="0.00"
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-black text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>

        {/* Pusingan & Pekerja */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Pusingan (Round)</label>
            <select
              value={formData.pusingan}
              onChange={e => setFormData({...formData, pusingan: parseInt(e.target.value) || 1})}
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-black text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="1">Pusingan 1</option>
              <option value="2">Pusingan 2</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Jumlah Pekerja</label>
            <input 
              type="number" 
              value={formData.workers_count || ''}
              onChange={e => setFormData({...formData, workers_count: parseInt(e.target.value) || 1})}
              placeholder="1"
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-black text-slate-800 dark:text-white"
            />
          </div>
        </div>

        {/* Jenis Meracun */}
        <div className="space-y-1.5">
          <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Jenis Kawalan Rumpai</label>
          <div className="grid grid-cols-2 gap-2">
            {['BULATAN & LORONG', 'DADA (R&S)'].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setFormData({...formData, jenis: v})}
                className={`py-2 p-1 rounded-2xl text-[9px] font-black uppercase tracking-wider border transition-all ${
                  formData.jenis === v 
                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/10' 
                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {v === 'BULATAN & LORONG' ? 'BULATAN' : 'DADA'}
              </button>
            ))}
          </div>
        </div>

        {/* --- CHEMICAL EXPENDITURE SECTION --- */}
        <div className="pt-2 border-t border-dashed border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Droplet size={14} className="text-emerald-500" />
              <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Rekod Stok Racun?</span>
            </div>
            <input 
              type="checkbox"
              checked={formData.useChemical}
              onChange={e => setFormData({ ...formData, useChemical: e.target.checked })}
              className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 bg-slate-100"
            />
          </div>

          {formData.useChemical && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }} 
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-3 bg-slate-50/50 dark:bg-slate-800/20 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Jenis Racun</label>
                  {loadingChemicals ? (
                    <div className="text-slate-400 text-xs py-3 animate-pulse">Memuatkan...</div>
                  ) : (
                    <select
                      value={formData.chemicalId}
                      onChange={e => setFormData({ ...formData, chemicalId: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2.5 text-[11px] font-black text-slate-800 dark:text-white"
                    >
                      {chemicals.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.quantity} {c.unit})</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Kuantiti Guna ({selectedChemicalObj?.unit || 'LITER'})</label>
                  <input
                    type="number"
                    step="0.05"
                    value={formData.chemicalQty || ''}
                    onChange={e => setFormData({ ...formData, chemicalQty: parseFloat(e.target.value) || 0 })}
                    placeholder={`0.00 ${selectedChemicalObj?.unit || 'LITER'}`}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2.5 text-[11px] font-black text-slate-800 dark:text-white"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Message Banner */}
        {message && (
          <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in fade-in zoom-in duration-300 ${message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/25 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-950/25 text-rose-600 dark:text-rose-400'}`}>
            {message.type === 'success' ? <ShieldCheck size={18} /> : <AlertTriangle size={18} />}
            <span className="text-[10px] font-black uppercase leading-tight">{message.text}</span>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isProcessing}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-3xl shadow-xl shadow-emerald-500/10 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Sprout size={20} />}
          {isProcessing ? 'MEMPROSES...' : 'SIMPAN REKOD MERUMPUT'}
        </button>

        {/* Realtime Stats */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <div className="space-y-0.5">
            <p className="text-[8px] font-black text-slate-400 uppercase">Peratusan Siap</p>
            <p className="text-sm font-black text-emerald-500">{formData.luas > 0 ? ((formData.hek_siap / formData.luas) * 100).toFixed(1) : '0.0'}%</p>
          </div>
          <div className="text-right">
            <p className="text-[8px] font-black text-slate-400 uppercase">Jenis</p>
            <p className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest">{formData.jenis}</p>
          </div>
        </div>
      </form>
    </div>
  );
};
