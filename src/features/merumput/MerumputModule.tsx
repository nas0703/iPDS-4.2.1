import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { getActiveEstateId, ESTATE_CHANGED_EVENT } from '../../utils/estateContext';
import { getEstateConfig } from '../../config/estateRegistry';
import { MerumputProgress, MerumputInventoryItem, WeedingSummary } from './types';
import { MerumputDashboard } from './components/MerumputDashboard';
import { MerumputTable } from './components/MerumputTable';
import { MerumputChart } from './components/MerumputChart';
import { MerumputInventory } from './components/MerumputInventory';
import { MerumputGanttChart } from './components/MerumputGanttChart';
import { MerumputMatrixAnalysis } from './components/MerumputMatrixAnalysis';
import { WeedDatabaseModal } from '../dashboard/components/WeedDatabaseModal';
import { WeedVisionModal } from '../dashboard/components/WeedVisionModal';
import ExcelJS from 'exceljs';
import { 
  Plus, 
  RefreshCw, 
  X, 
  Save, 
  Loader2, 
  Sprout, 
  SlidersHorizontal,
  FolderLock,
  Upload,
  Trash2,
  LayoutDashboard,
  CalendarDays,
  History,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  AlertTriangle,
  Leaf,
  Check,
  BookOpen,
  Sparkles,
  Calculator,
  Camera
} from 'lucide-react';

interface MerumputModuleProps {
  authRole?: string;
  isDarkMode?: boolean;
  onShowToast: (type: "success" | "error", message: string) => void;
}

export const MerumputModule: React.FC<MerumputModuleProps> = ({ isDarkMode, onShowToast }) => {
  const [activeEstate, setActiveEstate] = useState<string>(getActiveEstateId());
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'progress' | 'inventory' | 'history'>('dashboard');
  const [data, setData] = useState<MerumputProgress[]>([]);
  const [chemicals, setChemicals] = useState<MerumputInventoryItem[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<Partial<MerumputProgress> | null>(null);
  
  // Weed Database & WeedVision modals state
  const [showWeedDatabaseModal, setShowWeedDatabaseModal] = useState(false);
  const [showWeedVisionModal, setShowWeedVisionModal] = useState(false);
  const [weedVisionInitialTab, setWeedVisionInitialTab] = useState<'scanner' | 'calculator' | 'database'>('scanner');
  const [selectedWeedIdForCalc, setSelectedWeedIdForCalc] = useState<string>('asystasia-gangetica');
  
  const excelInputRef = useRef<HTMLInputElement>(null);

  // Dynamic estate blocks according to active estate configuration
  const estateCfg = getEstateConfig(activeEstate);
  const isTunggal = activeEstate === 'FPM_TUNGGAL';
  const isAdela = activeEstate === 'FPM_ADELA';

  const ESTATE_BLOCKS = useMemo(() => {
    if (estateCfg && estateCfg.blocks && Object.keys(estateCfg.blocks).length > 0) {
      return Object.values(estateCfg.blocks).map((b: any) => ({
        blok: String(b.blok),
        luas: Number(b.luas) || 0,
        pkt: b.pkt || '001'
      }));
    }
    if (isTunggal) {
      return [
        { blok: "1", luas: 72.15, pkt: '001' },
        { blok: "2", luas: 68.37, pkt: '001' },
        { blok: "3", luas: 76.59, pkt: '001' },
        { blok: "4", luas: 92.39, pkt: '001' },
        { blok: "5", luas: 60.19, pkt: '001' },
        { blok: "6", luas: 80.42, pkt: '001' },
        { blok: "7", luas: 89.46, pkt: '001' },
        { blok: "8", luas: 82.03, pkt: '001' },
        { blok: "9", luas: 83.61, pkt: '001' },
        { blok: "10", luas: 84.36, pkt: '001' },
        { blok: "11", luas: 47.85, pkt: '001' },
        { blok: "12", luas: 76.50, pkt: '001' },
        { blok: "13", luas: 50.75, pkt: '001' },
        { blok: "14", luas: 70.44, pkt: '001' },
        { blok: "15", luas: 68.36, pkt: '001' },
        { blok: "16", luas: 64.44, pkt: '001' },
        { blok: "17", luas: 84.08, pkt: '001' },
        { blok: "18", luas: 76.20, pkt: '002' },
        { blok: "19", luas: 81.75, pkt: '002' },
        { blok: "20", luas: 68.62, pkt: '002' },
        { blok: "21", luas: 24.26, pkt: '002' },
        { blok: "22", luas: 65.29, pkt: '002' },
        { blok: "LF", luas: 98.51, pkt: '003' }
      ];
    }
    return [];
  }, [estateCfg, isTunggal]);

  // Specific progress and dates based on user screenshots for "BULATAN & LORONG" Pusingan 1 (Tunggal)
  const BULATAN_P1_MAP: Record<string, { hek_siap: number; workers_count: number; tarikh_mula: string; tarikh_siap?: string }> = {
    "1": { hek_siap: 72.15, workers_count: 5, tarikh_mula: "2026-05-06", tarikh_siap: "2026-05-06" },
    "2": { hek_siap: 68.37, workers_count: 4, tarikh_mula: "2026-05-13", tarikh_siap: "2026-05-13" },
    "3": { hek_siap: 76.59, workers_count: 5, tarikh_mula: "2026-05-19", tarikh_siap: "2026-05-19" },
    "4": { hek_siap: 12.00, workers_count: 3, tarikh_mula: "2026-05-26" },
    "5": { hek_siap: 60.19, workers_count: 5, tarikh_mula: "2026-05-18", tarikh_siap: "2026-05-18" },
    "6": { hek_siap: 80.42, workers_count: 6, tarikh_mula: "2026-05-12", tarikh_siap: "2026-05-12" },
    "7": { hek_siap: 89.46, workers_count: 7, tarikh_mula: "2026-05-04", tarikh_siap: "2026-05-04" },
    "13": { hek_siap: 24.00, workers_count: 12, tarikh_mula: "2026-05-25" },
    "18": { hek_siap: 76.20, workers_count: 5, tarikh_mula: "2026-05-10", tarikh_siap: "2026-05-10" },
    "19": { hek_siap: 44.00, workers_count: 7, tarikh_mula: "2026-05-25" },
    "21": { hek_siap: 24.26, workers_count: 3, tarikh_mula: "2026-04-20", tarikh_siap: "2026-04-20" },
    "22": { hek_siap: 65.29, workers_count: 4, tarikh_mula: "2026-04-18", tarikh_siap: "2026-04-18" },
    "LF": { hek_siap: 98.51, workers_count: 6, tarikh_mula: "2026-01-10", tarikh_siap: "2026-01-10" }
  };

  const SEED_DATA = useMemo(() => {
    const list: Partial<MerumputProgress>[] = [];
    ESTATE_BLOCKS.forEach((b, idx) => {
      // 1. Pusingan 1 - BULATAN & LORONG
      if (isTunggal) {
        const bulatanEntry = BULATAN_P1_MAP[b.blok];
        if (bulatanEntry) {
          list.push({
            blok: b.blok,
            luas: b.luas,
            pusingan: 1,
            jenis: "BULATAN & LORONG",
            tarikh_mula: bulatanEntry.tarikh_mula,
            tarikh_siap: bulatanEntry.tarikh_siap || "",
            hek_siap: bulatanEntry.hek_siap,
            workers_count: bulatanEntry.workers_count,
            estate_id: activeEstate
          });
        } else {
          list.push({
            blok: b.blok,
            luas: b.luas,
            pusingan: 1,
            jenis: "BULATAN & LORONG",
            tarikh_mula: "2026-05-01",
            tarikh_siap: null as any,
            hek_siap: 0,
            workers_count: 0,
            estate_id: activeEstate
          });
        }
      } else if (isAdela) {
        // FPM Adela: Initial seed progress for Peringkat 1 (1-11)
        const isPkt1 = b.pkt === '001';
        const defaultHek = isPkt1 && idx < 5 ? parseFloat((b.luas * 0.7).toFixed(2)) : 0;
        list.push({
          blok: b.blok,
          luas: b.luas,
          pusingan: 1,
          jenis: "BULATAN & LORONG",
          tarikh_mula: "2026-05-02",
          tarikh_siap: defaultHek >= b.luas ? "2026-05-18" : "",
          hek_siap: defaultHek,
          workers_count: defaultHek > 0 ? 4 : 0,
          estate_id: activeEstate
        });
      } else {
        list.push({
          blok: b.blok,
          luas: b.luas,
          pusingan: 1,
          jenis: "BULATAN & LORONG",
          tarikh_mula: "2026-05-01",
          tarikh_siap: null as any,
          hek_siap: 0,
          workers_count: 0,
          estate_id: activeEstate
        });
      }

      // 2. Pusingan 1 - DADA (R&S)
      if (isTunggal) {
        const dadaMulaStr = `2026-04-${String(10 + (idx % 15)).padStart(2, '0')}`;
        list.push({
          blok: b.blok,
          luas: b.luas,
          pusingan: 1,
          jenis: "DADA (R&S)",
          tarikh_mula: dadaMulaStr,
          tarikh_siap: dadaMulaStr,
          hek_siap: b.luas,
          workers_count: Math.max(3, Math.round(b.luas / 20)),
          estate_id: activeEstate
        });
      } else if (isAdela) {
        const isPkt1 = b.pkt === '001';
        const dadaHek = isPkt1 && idx < 4 ? parseFloat((b.luas * 0.6).toFixed(2)) : 0;
        list.push({
          blok: b.blok,
          luas: b.luas,
          pusingan: 1,
          jenis: "DADA (R&S)",
          tarikh_mula: "2026-04-15",
          tarikh_siap: dadaHek >= b.luas ? "2026-04-28" : "",
          hek_siap: dadaHek,
          workers_count: dadaHek > 0 ? 3 : 0,
          estate_id: activeEstate
        });
      } else {
        list.push({
          blok: b.blok,
          luas: b.luas,
          pusingan: 1,
          jenis: "DADA (R&S)",
          tarikh_mula: "2026-05-01",
          tarikh_siap: null as any,
          hek_siap: 0,
          workers_count: 0,
          estate_id: activeEstate
        });
      }

      // 3. Pusingan 2 - BULATAN & LORONG (0% clean starting state)
      list.push({
        blok: b.blok,
        luas: b.luas,
        pusingan: 2,
        jenis: "BULATAN & LORONG",
        tarikh_mula: "2026-07-01",
        tarikh_siap: null as any,
        hek_siap: 0,
        workers_count: 0,
        estate_id: activeEstate
      });

      // 4. Pusingan 2 - DADA (R&S) (0% clean starting state)
      list.push({
        blok: b.blok,
        luas: b.luas,
        pusingan: 2,
        jenis: "DADA (R&S)",
        tarikh_mula: "2026-07-01",
        tarikh_siap: null as any,
        hek_siap: 0,
        workers_count: 0,
        estate_id: activeEstate
      });
    });
    return list;
  }, [ESTATE_BLOCKS, isTunggal, isAdela, activeEstate]);

  const fetchWeedingData = async (targetEstateId?: string) => {
    const estateIdToFetch = targetEstateId || activeEstate;
    try {
      setLoading(true);
      const [progRes, chemRes, txRes] = await Promise.all([
        fetch(`/api/merumput/progress?estate_id=${estateIdToFetch}`).catch((err) => {
          console.warn("API progress fetch error, falling back:", err);
          return null;
        }),
        fetch(`/api/merumput/inventory?estate_id=${estateIdToFetch}`).catch((err) => {
          console.warn("API inventory fetch error, falling back:", err);
          return null;
        }),
        fetch(`/api/merumput/inventory/transactions?estate_id=${estateIdToFetch}`).catch(() => null)
      ]);
 
      if (progRes && progRes.ok) {
        let progData = await progRes.json().catch(() => null);
        
        if (progData && progData.length > 0) {
          const filtered = progData.filter((item: any) => {
            if (estateIdToFetch === 'FPM_TUNGGAL') return !item.estate_id || item.estate_id === 'FPM_TUNGGAL';
            return item.estate_id === estateIdToFetch;
          });

          if (filtered.length > 0) {
            setData(filtered);
          } else {
            setData(SEED_DATA as MerumputProgress[]);
          }
        } else {
          setData(SEED_DATA as MerumputProgress[]);
        }
      } else {
        setData(SEED_DATA as MerumputProgress[]);
      }

      if (chemRes && chemRes.ok) {
        const chemData = await chemRes.json().catch(() => null);
        if (chemData) setChemicals(chemData);
      }

      if (txRes && txRes.ok) {
        const txData = await txRes.json().catch(() => null);
        if (txData) setTransactions(txData);
      }
    } catch (e) {
      console.warn("Menggunakan data tempatan untuk merumput:", e);
      setData(SEED_DATA as MerumputProgress[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeedingData(activeEstate);

    const handleEstateChange = () => {
      const newEstateId = getActiveEstateId();
      setActiveEstate(newEstateId);
      fetchWeedingData(newEstateId);
    };

    window.addEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
    return () => window.removeEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
  }, []);

  // Compute stats summary
  const summary: WeedingSummary = useMemo(() => {
    const totalLuas = data.reduce((acc, curr) => acc + curr.luas, 0);
    const totalHektarSiap = data.reduce((acc, curr) => acc + curr.hek_siap, 0);
    const overallProgress = totalLuas > 0 ? (totalHektarSiap / totalLuas) * 100 : 0;
    const remainingHektar = Math.max(0, totalLuas - totalHektarSiap);
    
    const lowStockCount = chemicals.filter(chem => chem.quantity <= chem.min_threshold).length;

    // Calculate overdue blocks count (> 120 days since last weeding activity for ANY weeding division in Pusingan 1)
    const todayDate = new Date("2026-05-30");
    const uniqueBloks = Array.from(new Set(data.map(item => item.blok)));
    let overdueBlocksCount = 0;

    uniqueBloks.forEach(blok => {
      const blokRecords = data.filter(item => item.blok === blok && item.pusingan === 1);
      let hasOverdueWeedingType = false;
      
      blokRecords.forEach(rec => {
        const dateStr = rec.tarikh_siap || rec.tarikh_mula;
        if (dateStr) {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) {
            const diffTime = todayDate.getTime() - d.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays > 120) {
              hasOverdueWeedingType = true;
            }
          }
        }
      });

      if (hasOverdueWeedingType) {
        overdueBlocksCount++;
      }
    });

    return {
      totalLuas,
      totalHektarSiap,
      overallProgress,
      remainingHektar,
      lowStockCount,
      overdueBlocksCount
    };
  }, [data, chemicals]);

  // Handle Excel Upload (.xlsx) logic for batch inputs
  const handleExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      if (!file.name.endsWith('.xlsx')) {
        throw new Error('Hanya fail .xlsx (Excel Moden) dibenarkan.');
      }

      const workbook = new ExcelJS.Workbook();
      const arrayBuffer = await file.arrayBuffer();
      await workbook.xlsx.load(arrayBuffer);
      const worksheet = workbook.getWorksheet(1);
      
      const newRecords: Partial<MerumputProgress>[] = [];
      
      worksheet?.eachRow((row, rowNumber) => {
        if (rowNumber > 2) { 
          // Column 1: Blok
          const blokVal = row.getCell(1).value;
          const blok = blokVal !== null && blokVal !== undefined ? String(blokVal) : '';
          
          // Column 2: Luas (HA)
          const luasVal = row.getCell(2).value;
          const luas = typeof luasVal === 'number' ? luasVal : (typeof luasVal === 'object' && luasVal !== null && 'result' in luasVal ? Number(luasVal.result) : 0);
          
          // Column 3: Tarikh Mula
          const tarikhMulaVal = row.getCell(3).text || new Date().toISOString().split('T')[0];

          // Column 5: Hektar Siap (HA)
          const hekSiapVal = row.getCell(5).value;
          const hek_siap = typeof hekSiapVal === 'number' ? hekSiapVal : (typeof hekSiapVal === 'object' && hekSiapVal !== null && 'result' in hekSiapVal ? Number(hekSiapVal.result) : 0);

          // Column 6: Pusingan / Round
          const pusinganVal = row.getCell(6).value;
          const pusingan = typeof pusinganVal === 'number' ? pusinganVal : 1;

          // Column 7: Jenis
          const jenisVal = row.getCell(7).text || 'BULATAN & LORONG';

          // Column 8: Workers Count
          const workersVal = row.getCell(8).value;
          const workers_count = typeof workersVal === 'number' ? workersVal : 1;
          
          if (blok && luas > 0) {
            newRecords.push({
              blok,
              luas,
              tarikh_mula: tarikhMulaVal,
              hek_siap: Math.min(luas, hek_siap),
              pusingan,
              jenis: jenisVal,
              workers_count
            });
          }
        }
      });

      if (newRecords.length > 0) {
        await fetch('/api/merumput/progress/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: newRecords })
        });
        onShowToast('success', `Berjaya mengimport ${newRecords.length} rekod merumput daripada Excel.`);
        fetchWeedingData();
      } else {
        throw new Error('Tiada data sah terbaca dari fail Excel.');
      }
    } catch (error: any) {
      console.error(error);
      onShowToast('error', error.message || 'Gagal memuat naik fail Excel.');
    } finally {
      setIsProcessing(false);
      if (event.target) event.target.value = '';
    }
  };

  // Helper function to reset all 22 blocks back to initial 0 progress values
  const handleResetData = async () => {
    if (!window.confirm('Adakah anda pasti mahu set semula kemajuan merumput untuk semua 22 blok? Ini akan menetapkan semula hektar siap kepada 0.')) return;
    try {
      setIsProcessing(true);
      const resetSeed = SEED_DATA.map(s => ({
        ...s,
        hek_siap: 0,
        tarikh_mula: new Date().toISOString().split('T')[0]
      }));

      const res = await fetch('/api/merumput/progress/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: resetSeed })
      });

      if (res.ok) {
        onShowToast('success', 'Berjaya mengeset semula data kemajuan merumput estet.');
        fetchWeedingData();
      } else {
        throw new Error('Gagal mengeset semula data.');
      }
    } catch (e: any) {
      onShowToast('error', e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateProgressRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord?.blok || !selectedRecord?.luas) return;

    try {
      setIsProcessing(true);
      const payload = {
        ...selectedRecord,
        tarikh_siap: (selectedRecord.hek_siap || 0) >= (selectedRecord.luas || 0) ? selectedRecord.tarikh_mula : undefined
      };

      const res = await fetch('/api/merumput/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        onShowToast('success', `Rekod Blok ${selectedRecord.blok} berjaya dikemas kini.`);
        setShowEditModal(false);
        fetchWeedingData();
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal menyimpan rekod');
      }
    } catch (error: any) {
      onShowToast('error', error.message);
    } finally {
      setIsProcessing(false);
    }
  };



  return (
    <div className="space-y-6 text-left animate-in fade-in duration-500 pb-20">
      {/* Header Title with Leaf Badge */}
      <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950/20 p-4 rounded-[28px] border border-slate-100 dark:border-slate-800/40">
        <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0 shadow-sm">
          <Leaf size={22} className="fill-emerald-500/10" />
        </div>
        <div>
          <h3 className="text-[9px] font-black tracking-widest text-slate-400 dark:text-slate-505 uppercase leading-none font-mono">Rekod & Pemantauan</h3>
          <h2 className="text-lg font-black text-slate-800 dark:text-white uppercase leading-none tracking-wide mt-1.5 font-display flex items-center gap-2">
            MODUL MERUMPUT
          </h2>
        </div>
      </div>

      {/* Tab Selectors containing 4 navigation cards as requested */}
      <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-none snap-x -mx-4 px-4 sm:mx-0 sm:px-0">
        {[
          { id: 'dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
          { id: 'progress', label: 'PROGRES MERUMPUT', icon: Sprout },
          { id: 'inventory', label: 'INVENTORI', icon: SlidersHorizontal },
          { id: 'history', label: 'SEJARAH', icon: History }
        ].map((tab) => {
          const isActive = activeSubTab === tab.id;
          const IconComponent = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`px-5 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-200 shrink-0 flex items-center gap-2 active:scale-95 snap-center border ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-555/20 border-emerald-600'
                  : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-150 dark:border-slate-800 hover:text-emerald-500 dark:hover:text-white'
              }`}
            >
              <IconComponent size={14} className={isActive ? 'text-white' : 'text-slate-400'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {activeSubTab === 'dashboard' && (
          <motion.div
            key="dashboard-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* Quick Tools Banner: WeedVision AI & Pangkalan Data Rumpai 22 Spesies */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-[#01241c] via-[#023126] to-[#01241c] border border-emerald-500/40 shadow-lg shadow-emerald-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-md shadow-emerald-500/20 shrink-0">
                  <Sparkles size={20} className="animate-pulse" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs sm:text-sm font-black text-white tracking-wide">
                      WeedVision™ & Pangkalan Data Rumpai
                    </h4>
                    <span className="text-[8.5px] font-black uppercase tracking-wider bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 px-1.5 py-0.2 rounded">
                      MSPO 22 SPESIES
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Pengecaman AI, Manual 22 Rumpai Utama Sawit & Kalkulator Dos 16L
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <button
                  type="button"
                  onClick={() => setShowWeedDatabaseModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
                >
                  <BookOpen size={13} className="text-emerald-400" />
                  <span>Pangkalan Data (22)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setWeedVisionInitialTab('scanner');
                    setShowWeedVisionModal(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-md shadow-emerald-900/40"
                >
                  <Camera size={13} />
                  <span>Imbas AI</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setWeedVisionInitialTab('calculator');
                    setShowWeedVisionModal(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <Calculator size={13} className="text-teal-400" />
                  <span>Kalkulator 16L</span>
                </button>
              </div>
            </div>

            {/* Dashboard stats overview */}
            <MerumputDashboard summary={summary} isDarkMode={isDarkMode} />

            {/* Standalone scheduler timeline preview bar */}
            <MerumputGanttChart data={data} isDarkMode={isDarkMode} />

            {/* Matrix analysis split levels */}
            <MerumputMatrixAnalysis data={data} isDarkMode={isDarkMode} />
          </motion.div>
        )}

        {activeSubTab === 'progress' && (
          <motion.div 
            key="progress-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 size={36} className="text-emerald-500 animate-spin" />
                <p className="text-slate-500 font-mono text-xs uppercase tracking-widest">Sila tunggu...</p>
              </div>
            ) : (
              <MerumputTable 
                data={data} 
                isDarkMode={isDarkMode} 
                onEdit={(record) => {
                  setSelectedRecord(record);
                  setShowEditModal(true);
                }}
              />
            )}
          </motion.div>
        )}

        {activeSubTab === 'inventory' && (
          <motion.div
            key="inventory-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
          >
            <MerumputInventory isDarkMode={isDarkMode} onShowToast={onShowToast} />
          </motion.div>
        )}

        {activeSubTab === 'history' && (
          <motion.div
            key="history-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* Left: Weeding Progress entries history */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-800 dark:text-white tracking-widest font-display italic">Kemaskini Aktiviti Merumput</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Senarai blok mengikut hektar siap pusingan semasa.</p>
                </div>
                <div className="bg-slate-100 dark:bg-slate-850 px-2.5 py-1 rounded-full text-[9px] font-black text-slate-400 uppercase">
                  HA SIAP
                </div>
              </div>

              <div className="space-y-2 max-h-[420px] overflow-y-auto">
                {data.filter(x => x.hek_siap > 0).length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-xs font-black uppercase">
                    Semua baki 22 blok masih mempunyai 0.00 HA siap.
                  </div>
                ) : (
                  [...data]
                    .filter(x => x.hek_siap > 0)
                    .sort((a, b) => {
                      const dateA = new Date(a.created_at || a.updated_at || a.tarikh_mula || 0).getTime();
                      const dateB = new Date(b.created_at || b.updated_at || b.tarikh_mula || 0).getTime();
                      if (dateB !== dateA) return dateB - dateA;
                      return b.hek_siap - a.hek_siap;
                    })
                    .slice(0, 10)
                    .map((item, i) => (
                      <div key={i} className="p-3 bg-slate-50 dark:bg-slate-850/40 rounded-2xl border border-slate-100/50 dark:border-slate-800/40 flex items-center justify-between gap-2">
                        <div className="text-left">
                          <p className="text-xs font-black text-slate-800 dark:text-white">Blok {item.blok} ({item.luas.toFixed(2)} HA)</p>
                          <p className="text-[8px] text-zinc-400 uppercase font-black tracking-wider mt-0.5">Pusingan {item.pusingan || 1} • {item.jenis || 'BULATAN & LORONG'}</p>
                          <p className="text-[7.5px] text-emerald-600 dark:text-emerald-400 uppercase font-black tracking-wider mt-1.5 flex items-center gap-1 bg-emerald-50/50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-md w-fit">
                            <Clock size={8} />
                            Kemasukan: {(() => {
                              const dateStr = item.created_at || item.updated_at || item.tarikh_mula;
                              if (!dateStr) return "-";
                              try {
                                const d = new Date(dateStr);
                                if (isNaN(d.getTime())) return dateStr;
                                const day = String(d.getDate()).padStart(2, '0');
                                const month = String(d.getMonth() + 1).padStart(2, '0');
                                const year = d.getFullYear();
                                return `${day}/${month}/${year}`;
                              } catch (e) {
                                return dateStr;
                              }
                            })()}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-black text-emerald-500 font-mono">
                            {item.hek_siap.toFixed(2)} HA
                          </div>
                          <div className="w-16 bg-slate-200 dark:bg-slate-800 h-1 rounded-full overflow-hidden mt-1 ml-auto">
                            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, (item.hek_siap / item.luas) * 100)}%` }} />
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* Right: Chemical stock transaction activity */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-xl space-y-4">
              <div>
                <h4 className="text-xs font-black uppercase text-slate-800 dark:text-white tracking-widest font-display italic">Sejarah Log Perubahan Stok</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Menyimpan rekod transaksi aliran keluar atau masuk racun.</p>
              </div>

              <div className="space-y-2 max-h-[420px] overflow-y-auto">
                {transactions.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-xs font-black uppercase">
                    Tiada log sebaran atau pembekalan dikesan.
                  </div>
                ) : (
                  [...transactions].slice(0, 15).map((tx, i) => {
                    const chemObj = chemicals.find(c => c.id === tx.inventory_id);
                    const isAdd = tx.type === 'IN';
                    return (
                      <div key={i} className="p-3 bg-slate-50 dark:bg-slate-850/40 rounded-2xl border border-slate-100/50 dark:border-slate-800/40 flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2">
                          {isAdd ? (
                            <div className="bg-emerald-500/10 text-emerald-500 p-1.5 rounded-lg shrink-0">
                              <ArrowDownLeft size={14} />
                            </div>
                          ) : (
                            <div className="bg-rose-500/10 text-rose-500 p-1.5 rounded-lg shrink-0">
                              <ArrowUpRight size={14} />
                            </div>
                          )}
                          <div className="text-left">
                            <p className="text-xs font-black text-slate-850 dark:text-white uppercase leading-snug">{chemObj?.name || 'Racun Rumpai'}</p>
                            <p className="text-[8px] text-zinc-400 uppercase font-bold tracking-wide mt-0.5">Ref: {tx.reference || 'Kemasukan Manual'}</p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className={`text-xs font-black font-mono ${isAdd ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {isAdd ? '+' : '-'}{tx.quantity.toFixed(1)} {chemObj?.unit || 'LITER'}
                          </p>
                          <p className="text-[8px] text-slate-400 uppercase font-mono mt-0.5">{tx.created_at ? tx.created_at.split('T')[0] : ''}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual Edit progress record Modal popup */}
      <AnimatePresence>
        {showEditModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowEditModal(false)} />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`relative w-full max-w-lg rounded-[32px] border p-8 shadow-2xl text-left ${
                isDarkMode ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'
              }`}
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className={`text-2xl font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Kemaskini Blok</h3>
                  <p className="text-slate-500 text-sm">Gunakan borang ini untuk mengemaskini kerja merumput & meracun.</p>
                </div>
                <button 
                  onClick={() => setShowEditModal(false)}
                  className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleUpdateProgressRecord} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nama Blok</label>
                    <input
                      type="text"
                      required
                      value={selectedRecord?.blok || ''}
                      onChange={(e) => setSelectedRecord(prev => ({ ...prev!, blok: e.target.value }))}
                      className={`w-full border rounded-xl px-4 py-3 outline-none transition-all font-bold ${
                        isDarkMode ? 'bg-slate-800/50 border-white/5 text-white focus:border-emerald-500/50' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                      }`}
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
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tarikh Mula</label>
                    <input
                      type="date"
                      required
                      value={selectedRecord?.tarikh_mula || ''}
                      onChange={(e) => setSelectedRecord(prev => ({ ...prev!, tarikh_mula: e.target.value }))}
                      className={`w-full border rounded-xl px-4 py-3 outline-none transition-all font-bold ${
                        isDarkMode ? 'bg-slate-800/50 border-white/5 text-white focus:border-emerald-500/50' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                      }`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Hektar Siap (HA)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={selectedRecord?.hek_siap ?? 0}
                      onChange={(e) => setSelectedRecord(prev => ({ ...prev!, hek_siap: Number(e.target.value) }))}
                      className={`w-full border rounded-xl px-4 py-3 outline-none transition-all font-bold ${
                        isDarkMode ? 'bg-slate-800/50 border-white/5 text-white focus:border-emerald-500/50' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Jenis Kawalan</label>
                    <select
                      value={selectedRecord?.jenis || 'BULATAN & LORONG'}
                      onChange={(e) => setSelectedRecord(prev => ({ ...prev!, jenis: e.target.value }))}
                      className={`w-full border rounded-xl px-4 py-3 outline-none transition-all font-bold ${
                        isDarkMode ? 'bg-slate-800/50 border-white/5 text-white focus:border-emerald-500/50' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                      }`}
                    >
                      <option value="BULATAN & LORONG">BULATAN & LORONG</option>
                      <option value="DADA (R&S)">DADA (R&S)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Round Pusingan</label>
                    <select
                      value={selectedRecord?.pusingan || 1}
                      onChange={(e) => setSelectedRecord(prev => ({ ...prev!, pusingan: Number(e.target.value) }))}
                      className={`w-full border rounded-xl px-4 py-3 outline-none transition-all font-bold ${
                        isDarkMode ? 'bg-slate-800/50 border-white/5 text-white focus:border-emerald-500/50' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                      }`}
                    >
                      <option value="1">Pusingan 1</option>
                      <option value="2">Pusingan 2</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Kuantiti Pekerja</label>
                  <input
                    type="number"
                    value={selectedRecord?.workers_count || 1}
                    onChange={(e) => setSelectedRecord(prev => ({ ...prev!, workers_count: Number(e.target.value) }))}
                    className={`w-full border rounded-xl px-4 py-3 outline-none transition-all font-bold ${
                      isDarkMode ? 'bg-slate-800/50 border-white/5 text-white focus:border-emerald-500/50' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                    }`}
                  />
                </div>

                <div className="pt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
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
                    SIMPAN PERUBAHAN
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Standalone Weed Database Modal */}
      <WeedDatabaseModal
        isOpen={showWeedDatabaseModal}
        onClose={() => setShowWeedDatabaseModal(false)}
        onOpenCalculatorForWeed={(weedId) => {
          setSelectedWeedIdForCalc(weedId);
          setShowWeedDatabaseModal(false);
          setWeedVisionInitialTab('calculator');
          setShowWeedVisionModal(true);
        }}
      />

      {/* WeedVision AI Modal */}
      <WeedVisionModal
        isOpen={showWeedVisionModal}
        onClose={() => setShowWeedVisionModal(false)}
        initialWeedId={selectedWeedIdForCalc}
        initialTab={weedVisionInitialTab}
        onOpenCalculatorForWeed={(weedId) => setSelectedWeedIdForCalc(weedId)}
      />
    </div>
  );
};
export default MerumputModule;
