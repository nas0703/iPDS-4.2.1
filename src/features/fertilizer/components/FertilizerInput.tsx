
import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Plus, 
  Loader2, 
  ShieldCheck, 
  AlertTriangle,
  RefreshCw,
  Target,
  ArrowRight,
  Layers,
  MapPin
} from 'lucide-react';
import { getPusInfo, calculateProductivity, calculateProgress } from '../helpers';
import { FERTILIZER_PROGRAM_2026, getFertilizerMasterForEstate, FertilizerBlockProgram } from '../program_data';
import { DailyEntrySchema } from '../types';
import { getActiveEstateId, ESTATE_CHANGED_EVENT } from '../../../utils/estateContext';
import { getEstateConfig } from '../../../config/estateRegistry';

interface FertilizerInputProps {
  onSuccess?: () => void;
  isDarkMode?: boolean;
  onShowToast?: (type: 'success' | 'error', msg: string) => void;
}

export const FertilizerInput: React.FC<FertilizerInputProps> = ({ onSuccess }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [masterData, setMasterData] = useState<FertilizerBlockProgram[]>([]);
  const [existingEntries, setExistingEntries] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [activeEstate, setActiveEstate] = useState<string>(() => getActiveEstateId());
  
  const getTodayLocalDate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [formData, setFormData] = useState({
    entry_date: getTodayLocalDate(),
    blok_code: '',
    pus: 1,
    fertilizer_type: 'COMPACT FELDA 12',
    workers_count: 1,
    total_beg_completed: 0,
    note: ''
  });

  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Sync with active estate changes
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
    fetchMasterData(activeEstate);
    fetchEntries(activeEstate);
    fetchInventory(activeEstate);
  }, [activeEstate]);

  const fetchInventory = async (estateId: string) => {
    try {
      const res = await fetch(`/api/fertilizer/inventory?estate_id=${estateId}`);
      const data = await res.json();
      setInventory(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length > 0 && !formData.fertilizer_type) {
        setFormData(prev => ({ ...prev, fertilizer_type: data[0].name }));
      }
    } catch (err) {
      console.error('Failed to fetch inventory', err);
    }
  };

  const fetchMasterData = async (estateId: string) => {
    try {
      const estateCfg = getEstateConfig(estateId);
      const res = await fetch(`/api/fertilizer/master?estate_id=${estateId}`);
      const data = await res.json().catch(() => []);
      
      if (Array.isArray(data) && data.length > 0) {
        const formatted: FertilizerBlockProgram[] = data.map((d: any) => {
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
            estate_id: estateId
          };
        }).filter(item => item.blok_code.length > 0);

        setMasterData(formatted.length > 0 ? formatted : getFertilizerMasterForEstate(estateId, estateCfg.blocks));
      } else {
        setMasterData(getFertilizerMasterForEstate(estateId, estateCfg.blocks));
      }
    } catch (err) {
      console.error('Failed to fetch master data', err);
      const estateCfg = getEstateConfig(estateId);
      setMasterData(getFertilizerMasterForEstate(estateId, estateCfg.blocks));
    }
  };

  const fetchEntries = async (estateId: string) => {
    try {
      const isTunggal = estateId === 'FPM_TUNGGAL';
      const res = await fetch(`/api/fertilizer/entries?estate_id=${estateId}`);
      const data = await res.json().catch(() => []);
      const filtered = Array.isArray(data) ? data.filter((e: any) => isTunggal ? (!e.estate_id || e.estate_id === 'FPM_TUNGGAL') : e.estate_id === estateId) : [];
      setExistingEntries(filtered);
    } catch (err) {
      console.error('Failed to fetch entries', err);
    }
  };

  const estateCfg = useMemo(() => getEstateConfig(activeEstate), [activeEstate]);
  const activeMasterList: FertilizerBlockProgram[] = (masterData && masterData.length > 0) 
    ? masterData 
    : getFertilizerMasterForEstate(activeEstate, estateCfg.blocks);

  const selectedPusInfo = getPusInfo(formData.pus, activeEstate);
  const selectedBlokMaster = activeMasterList.find(b => String(b.blok_code || b.blok) === String(formData.blok_code));

  useEffect(() => {
    const pusInfo = getPusInfo(formData.pus, activeEstate);
    if (pusInfo && pusInfo.fertilizer && pusInfo.fertilizer !== 'TIDAK DIKETAHUI') {
      setFormData(prev => ({
        ...prev,
        fertilizer_type: pusInfo.fertilizer
      }));
    }
  }, [formData.pus, activeEstate]);
  
  const targetBeg = selectedBlokMaster 
    ? Number(selectedBlokMaster[`pus${formData.pus}_beg` as keyof FertilizerBlockProgram] ?? selectedBlokMaster[`pus${formData.pus}` as keyof FertilizerBlockProgram] ?? 0) 
    : 0;
  
  // Calculate cumulative actual for this block and PUS
  const relevantEntries = (existingEntries || [])
    .filter(e => String(e.blok_code || e.blok) === String(formData.blok_code) && Number(e.pus) === Number(formData.pus));
  const realRelevant = relevantEntries.filter(e => {
    const id = String(e.id || '');
    return !id.startsWith('p1-') && !id.startsWith('p2-') && !id.startsWith('p3-');
  });
  const chosenRelevant = realRelevant.length > 0 ? realRelevant : relevantEntries;
  const cumulativeActual = chosenRelevant.reduce((acc, curr) => acc + (Number(curr.total_beg_completed) || 0), 0);

  const remainingBeg = Math.max(0, targetBeg - cumulativeActual);
  const currentProgress = calculateProgress(cumulativeActual, targetBeg);
  const currentProductivity = calculateProductivity(formData.total_beg_completed, formData.workers_count);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setMessage(null);

    try {
      // Validate with Zod
      DailyEntrySchema.parse(formData);

      const payload = {
        ...formData,
        estate_id: activeEstate,
        interval_name: selectedPusInfo.interval,
        productivity_beg_per_worker: currentProductivity,
        target_beg_for_selected_pus: targetBeg
      };

      const res = await fetch('/api/fertilizer/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: `Rekod harian Blok ${formData.blok_code} (PUS ${formData.pus}) berjaya disimpan.` });
        setFormData({
          ...formData,
          blok_code: '',
          workers_count: 1,
          total_beg_completed: 0,
          note: ''
        });
        fetchEntries(activeEstate);
        window.dispatchEvent(new CustomEvent('fertilizer_entry_saved', { detail: { blok: formData.blok_code, pus: formData.pus } }));
        if (onSuccess) onSuccess();
      } else if (res.status === 409) {
        setMessage({ type: 'error', text: result.error });
      } else {
        throw new Error(result.error || 'Gagal menyimpan rekod');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Ralat semasa menyimpan data' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-xl border border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex flex-col gap-1 text-left">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Kemasukan Kerja Baja</p>
            <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase leading-none italic">Harian Staff</h3>
          </div>
          <span className="px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-[10px] font-black uppercase tracking-wider border border-purple-200 dark:border-purple-800">
            {estateCfg?.shortName || activeEstate}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 text-left">
            <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Tarikh</label>
            <input 
              type="date" 
              value={formData.entry_date}
              onChange={e => setFormData({...formData, entry_date: e.target.value})}
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-black text-slate-800 dark:text-white focus:ring-2 focus:ring-purple-500/20"
            />
          </div>
          
          <div className="space-y-1.5 text-left">
            <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest flex items-center justify-between">
              <span>Pilih Blok</span>
              <span className="text-[8px] text-purple-600 dark:text-purple-400 font-bold">{activeMasterList.length} Blok Tersedia</span>
            </label>
            <select
              value={formData.blok_code}
              onChange={e => setFormData({...formData, blok_code: e.target.value})}
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-black text-slate-800 dark:text-white focus:ring-2 focus:ring-purple-500/20"
              required
            >
              <option value="">-- PILIH BLOK --</option>
              {activeMasterList.map(b => {
                const code = String(b.blok_code || b.blok);
                const luasText = b.luas ? `${Number(b.luas).toFixed(1)} Ha` : '';
                const pokokText = b.pokok ? `${b.pokok} pkk` : '';
                const details = [luasText, pokokText].filter(Boolean).join(' • ');
                return (
                  <option key={code} value={code}>
                    Blok {code} {details ? `(${details})` : ''}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Selected Block Info Badge */}
        {selectedBlokMaster && (
          <div className="p-3 bg-purple-50/60 dark:bg-purple-950/20 rounded-2xl border border-purple-100 dark:border-purple-900/40 flex items-center justify-between text-left">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black text-xs shadow-md shadow-purple-600/20">
                {selectedBlokMaster.blok_code}
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-800 dark:text-white uppercase leading-none">
                  Blok {selectedBlokMaster.blok_code}
                </p>
                <p className="text-[9px] font-bold text-purple-600 dark:text-purple-400">
                  Keluasan: {selectedBlokMaster.luas} Ha • Pokok: {selectedBlokMaster.pokok.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[8px] font-black uppercase text-slate-400 block">Sasaran PUS {formData.pus}</span>
              <span className="text-xs font-black text-purple-700 dark:text-purple-300">{targetBeg} Beg</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 text-left">
            <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">PUS</label>
            <select
              value={formData.pus}
              onChange={e => {
                const newPus = parseInt(e.target.value) as any;
                const info = getPusInfo(newPus);
                setFormData({
                  ...formData, 
                  pus: newPus,
                  fertilizer_type: info.fertilizer // Default to PUS config fertilizer
                });
              }}
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-black text-slate-800 dark:text-white focus:ring-2 focus:ring-purple-500/20"
            >
              <option value={1}>PUS 1 (FEB - COMPACT)</option>
              <option value={2}>PUS 2 (APR - ORGANIK)</option>
              <option value={3}>PUS 3 (JUN - ORGANIK)</option>
              <option value={4}>PUS 4 (AUG - COMPACT)</option>
            </select>
          </div>
          <div className="space-y-1.5 text-left">
            <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Jenis Baja / Produk</label>
            <select
              value={formData.fertilizer_type}
              onChange={e => setFormData({...formData, fertilizer_type: e.target.value})}
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-black text-slate-800 dark:text-white focus:ring-2 focus:ring-purple-500/20"
              required
            >
              <option value="">Pilih Baja</option>
              {inventory.length > 0 ? (
                inventory.map(item => (
                  <option key={item.id} value={item.name}>{item.name}</option>
                ))
              ) : (
                <>
                  <option value="COMPACT FELDA 12">COMPACT FELDA 12</option>
                  <option value="FELDA Organic">FELDA Organic</option>
                </>
              )}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 text-left">
            <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Bil. Pekerja</label>
            <input 
              type="number" 
              min="1"
              value={formData.workers_count || ''}
              onChange={e => setFormData({...formData, workers_count: parseInt(e.target.value) || 0})}
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-black text-slate-800 dark:text-white"
              placeholder="0"
              required
            />
          </div>
          <div className="space-y-1.5 text-left">
            <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Beg Siap</label>
            <input 
              type="number" 
              step="0.01"
              min="0.1"
              value={formData.total_beg_completed || ''}
              onChange={e => setFormData({...formData, total_beg_completed: parseFloat(e.target.value) || 0})}
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-black text-slate-800 dark:text-white"
              placeholder="0.00"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5 text-left">
          <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Nota Tambahan</label>
          <textarea 
            value={formData.note}
            onChange={e => setFormData({...formData, note: e.target.value})}
            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-black text-slate-800 dark:text-white min-h-[80px]"
            placeholder="Komen kerja (pilihan)..."
          />
        </div>

        {message && (
          <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in fade-in zoom-in duration-300 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {message.type === 'success' ? <ShieldCheck size={18} /> : <AlertTriangle size={18} />}
            <span className="text-[10px] font-black uppercase">{message.text}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isProcessing}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-black py-5 rounded-3xl shadow-xl shadow-purple-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
          {isProcessing ? 'MEMPROSES...' : 'SIMPAN REKOD BAJA'}
        </button>

        {/* Realtime Summary Card */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-4">
          <div className="space-y-0.5">
            <p className="text-[8px] font-black text-slate-400 uppercase">Target Blok + PUS</p>
            <p className="text-sm font-black text-slate-800 dark:text-white">{targetBeg} <span className="text-[10px] text-slate-500">BEG</span></p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[8px] font-black text-slate-400 uppercase">Baki Kerja</p>
            <p className="text-sm font-black text-rose-500">{remainingBeg} <span className="text-[10px] text-rose-300">BEG</span></p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[8px] font-black text-slate-400 uppercase">Produktiviti</p>
            <p className="text-sm font-black text-emerald-500">{currentProductivity} <span className="text-[10px] text-emerald-300">BEG/PEK</span></p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[8px] font-black text-slate-400 uppercase">Progress Keseluruhan</p>
            <p className="text-sm font-black text-purple-500">{currentProgress}%</p>
          </div>
        </div>
      </form>
    </div>
  );
};

