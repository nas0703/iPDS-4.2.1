import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { getActiveEstateId, ESTATE_CHANGED_EVENT, inferEstateFromReceipt } from '../../../utils/estateContext';
import { getEstateConfig, EstateConfig } from '../../../config/estateRegistry';
import { safeFetch } from '../../../utils/safeFetch';
import { 
  Users, Calendar, Search, Filter, Download, Share2, 
  Edit3, Check, X, RefreshCw, TrendingUp, AlertTriangle, 
  Award, ShieldCheck, FileSpreadsheet, Layers, Info, CheckCircle2,
  CalendarDays, Hash, Weight, ArrowUpRight
} from 'lucide-react';
import { MASTER_DATA } from '../../../utils/constants';
import { EmptyState, NoDataRow } from '../../../components/common/EmptyState';
import ExcelJS from 'exceljs';

interface Transaction {
  no_resit?: string;
  no_lori?: string;
  blok: string;
  tan: number;
  muda?: number;
  tarikh: string;
  estate_id?: string;
  [key: string]: any;
}

interface BacklogRecord {
  pus1_mula?: string;
  pus1_tamat?: string;
  pus2_mula?: string;
  pus2_tamat?: string;
  hektar_siap?: number;
  capai_tandan?: number;
  backlog_diladang?: number;
  catatan?: string;
  bil_buruh?: number;
  tandan_harian?: number;
  custom_abw?: number;
}

interface BlockProductivityRecord {
  blok: string;
  displayCode: string;
  pkt: string;
  luasBlok: number;
  tarikh: string;
  bilPekerja: number;
  bilHariKerja: number;
  // HI (Hari Ini - Daily) & HII (Hingga Hari Ini - Cumulative)
  luasKerjaHI: number;
  luasKerjaHII: number;
  jumlahBtsHI: number;
  jumlahBtsHII: number;
  beratMtHI: number;
  beratMtHII: number;
  // Legacy / fallbacks
  luasKerja?: number;
  jumlahBts?: number;
  beratMt?: number;
  tarikhMulaBacklog?: string;
  tarikhSiapBacklog?: string;
  isBacklogSynced: boolean;
  isYieldSynced: boolean;
  totalManDays?: number;
  btsPerPekerjaHariHI?: number;
  btsPerPekerjaHariHII?: number;
  mtPerPekerjaHariHI?: number;
  mtPerPekerjaHariHII?: number;
  haPerPekerjaHariHI?: number;
  haPerPekerjaHariHII?: number;
  btsPerPekerjaHari?: number;
  mtPerPekerjaHari?: number;
  haPerPekerjaHari?: number;
  abwKg?: number;
  benchmark?: string;
  benchmarkColor?: string;
}

const STORAGE_KEY = 'fpmsb_laporan_produktiviti_menuai_v2';
const BACKLOG_STORAGE_KEY = 'fpm_backlog_history_v1';

// Default worker & harvesting standards per block (FPM Tunggal)
const DEFAULT_BLOCK_DEFAULTS_TUNGGAL: Record<string, { buruh: number; bts: number }> = {
  "1": { buruh: 3, bts: 219 },
  "2": { buruh: 3, bts: 360 },
  "3": { buruh: 3, bts: 330 },
  "4": { buruh: 4, bts: 250 },
  "5": { buruh: 3, bts: 198 },
  "6": { buruh: 3, bts: 230 },
  "7": { buruh: 4, bts: 250 },
  "8": { buruh: 2, bts: 280 },
  "9": { buruh: 3, bts: 274 },
  "10": { buruh: 3, bts: 259 },
  "11": { buruh: 2, bts: 152 },
  "12": { buruh: 2, bts: 233 },
  "13": { buruh: 2, bts: 225 },
  "14": { buruh: 4, bts: 310 },
  "15": { buruh: 2, bts: 335 },
  "16": { buruh: 2, bts: 220 },
  "17": { buruh: 4, bts: 400 },
  "18": { buruh: 2, bts: 490 },
  "19": { buruh: 2, bts: 543 },
  "20": { buruh: 2, bts: 342 },
  "21": { buruh: 2, bts: 210 },
  "22": { buruh: 2, bts: 288 },
  "88": { buruh: 6, bts: 240 } // Combined Lot Felda
};

// Default Average Bunch Weight (ABW in kg) per block based on estate historical standards (FPM Tunggal)
const DEFAULT_ABW_MAP_TUNGGAL: Record<string, number> = {
  "1": 23.00, "2": 23.01, "3": 23.00, "4": 24.05, "5": 23.00, "6": 24.97, "7": 22.98,
  "8": 23.00, "9": 23.00, "10": 23.01, "11": 23.00, "12": 23.00, "13": 22.38, "14": 12.88,
  "15": 23.02, "16": 23.01, "17": 23.01, "18": 18.39, "19": 13.99, "20": 18.69, "21": 14.01,
  "22": 14.00, "88": 18.66
};

// Default worker & harvesting standards per block (FPM Adela)
const ADELA_BLOCK_DEFAULTS: Record<string, { buruh: number; bts: number }> = {
  "1": { buruh: 2, bts: 110 },
  "2": { buruh: 3, bts: 210 },
  "3": { buruh: 2, bts: 160 },
  "4": { buruh: 3, bts: 210 },
  "5": { buruh: 3, bts: 220 },
  "6": { buruh: 3, bts: 230 },
  "7": { buruh: 3, bts: 240 },
  "8": { buruh: 3, bts: 280 },
  "9": { buruh: 3, bts: 230 },
  "10": { buruh: 3, bts: 230 },
  "11": { buruh: 2, bts: 90 },
  "12": { buruh: 3, bts: 220 },
  "13": { buruh: 3, bts: 220 },
  "14": { buruh: 2, bts: 150 },
  "15": { buruh: 2, bts: 180 },
  "16": { buruh: 3, bts: 250 },
  "17": { buruh: 3, bts: 210 },
  "1F": { buruh: 2, bts: 120 },
  "2F": { buruh: 2, bts: 120 },
  "125Y": { buruh: 1, bts: 35 },
  "128Y": { buruh: 1, bts: 20 },
  "121V": { buruh: 1, bts: 20 },
};

// Default ABW for FPM Adela
const ADELA_ABW_MAP: Record<string, number> = {
  "1": 23.50, "2": 23.50, "3": 23.50, "4": 23.50, "5": 23.50, "6": 23.50, "7": 23.50,
  "8": 23.50, "9": 23.50, "10": 23.50, "11": 23.50,
  "12": 16.50, "13": 16.50, "14": 16.50, "15": 16.50, "16": 16.50, "17": 16.50,
  "1F": 18.00, "2F": 18.00,
  "125Y": 18.00, "128Y": 18.00, "121V": 18.00,
};

interface BlockDefinition {
  key: string;
  luas: number;
  pkt: string;
  peneroka?: number;
  target_mt?: number;
}

// Helper to resolve estate blocks dynamically
function getEstateBlocks(estateId: string, estateConfig: EstateConfig): BlockDefinition[] {
  if (estateId === 'FPM_TUNGGAL') {
    return Object.entries(MASTER_DATA).map(([blokKey, info]) => ({
      key: blokKey,
      luas: info.luas,
      pkt: info.pkt,
      peneroka: info.peneroka,
      target_mt: info.target_mt
    }));
  }

  if (estateConfig && estateConfig.blocks && Object.keys(estateConfig.blocks).length > 0) {
    const keys = Object.keys(estateConfig.blocks).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });

    return keys.map(k => {
      const b = estateConfig.blocks[k];
      return {
        key: k,
        luas: b.luas,
        pkt: b.pkt,
        peneroka: b.peneroka,
        target_mt: b.target_mt
      };
    });
  }

  if (estateId === 'FPM_TUNGGAL' || estateId === '5155') {
    return Object.entries(MASTER_DATA).map(([blokKey, info]) => ({
      key: blokKey,
      luas: info.luas,
      pkt: info.pkt,
      peneroka: info.peneroka,
      target_mt: info.target_mt
    }));
  }

  return [];
}

// Display code format helper
function getBlockDisplayCode(blokKey: string, estateId: string): string {
  if (estateId === 'FPM_TUNGGAL') {
    return blokKey === '88' ? 'Blok 88 (Lot Felda)' : `Blok ${blokKey}`;
  }
  if (blokKey === '88' || blokKey === '88F' || blokKey.includes('LF')) {
    return `Lot Felda (${blokKey})`;
  }
  if (blokKey === '1F' || blokKey === '2F') {
    return `Blok ${blokKey} (Felda)`;
  }
  if (blokKey.includes('Y') || blokKey.includes('V')) {
    return `Lot ${blokKey}`;
  }
  return `Blok ${blokKey}`;
}

// Short badge for sector column (dynamic per estate)
function getPktShortBadge(pktCode: string, estateId?: string): string {
  const cleanId = (estateId || getActiveEstateId() || 'FPM_TUNGGAL').trim().toUpperCase();
  const isAdelaOrTunggal = cleanId === 'FPM_ADELA' || cleanId === 'FPM_TUNGGAL';

  if (pktCode === '001') return 'P1';
  if (pktCode === '002') return 'P2';
  if (pktCode === '003') {
    return isAdelaOrTunggal ? 'Lot Felda' : 'P3';
  }
  if (pktCode === '004') return 'Lot';
  return pktCode;
}

// Group configuration for tables, subtotals, Excel and WhatsApp
interface GroupConfig {
  id: string;
  title: string;
  code: string;
  icon: string;
  headerBg: string;
  headerSub: string;
  subtotalBg: string;
  subtotalText: string;
  excelColor: string;
}

function getGroupsConfigForEstate(estateId: string, availablePkts: string[]): GroupConfig[] {
  const cleanId = (estateId || 'FPM_TUNGGAL').trim().toUpperCase();

  if (cleanId === 'FPM_ADELA') {
    return [
      {
        id: '001',
        title: 'PKT 001 (Blok 1 - 11)',
        code: 'P1',
        icon: '🔹',
        headerBg: 'bg-blue-600 dark:bg-blue-800 text-white',
        headerSub: 'text-blue-100',
        subtotalBg: 'bg-blue-50/90 dark:bg-blue-950/40 border-b-2 border-blue-200 dark:border-blue-900',
        subtotalText: 'text-blue-700 dark:text-blue-300 font-black',
        excelColor: '1D4ED8'
      },
      {
        id: '002',
        title: 'PKT 002 (Blok 12 - 17)',
        code: 'P2',
        icon: '🟣',
        headerBg: 'bg-purple-600 dark:bg-purple-800 text-white',
        headerSub: 'text-purple-100',
        subtotalBg: 'bg-purple-50/90 dark:bg-purple-950/40 border-b-2 border-purple-200 dark:border-purple-900',
        subtotalText: 'text-purple-700 dark:text-purple-300 font-black',
        excelColor: '7E22CE'
      },
      {
        id: '003',
        title: 'LOT FELDA (88F / 1F & 2F)',
        code: 'LOT FELDA',
        icon: '🟠',
        headerBg: 'bg-amber-600 dark:bg-amber-800 text-white',
        headerSub: 'text-amber-100',
        subtotalBg: 'bg-amber-50/90 dark:bg-amber-950/40 border-b-2 border-amber-200 dark:border-amber-900',
        subtotalText: 'text-amber-700 dark:text-amber-300 font-black',
        excelColor: 'D97706'
      },
      {
        id: '004',
        title: 'PKT 004 (Lot Tambahan)',
        code: 'P4 (Tambahan)',
        icon: '🟢',
        headerBg: 'bg-emerald-600 dark:bg-emerald-800 text-white',
        headerSub: 'text-emerald-100',
        subtotalBg: 'bg-emerald-50/90 dark:bg-emerald-950/40 border-b-2 border-emerald-200 dark:border-emerald-900',
        subtotalText: 'text-emerald-700 dark:text-emerald-300 font-black',
        excelColor: '059669'
      }
    ].filter(g => availablePkts.includes(g.id));
  }

  if (cleanId === 'FPM_TUNGGAL') {
    return [
      {
        id: '001',
        title: 'PKT 001 (Blok 1 - 17)',
        code: 'P1',
        icon: '🔹',
        headerBg: 'bg-blue-600 dark:bg-blue-800 text-white',
        headerSub: 'text-blue-100',
        subtotalBg: 'bg-blue-50/90 dark:bg-blue-950/40 border-b-2 border-blue-200 dark:border-blue-900',
        subtotalText: 'text-blue-700 dark:text-blue-300 font-black',
        excelColor: '1D4ED8'
      },
      {
        id: '002',
        title: 'PKT 002 (Blok 18 - 22)',
        code: 'P2',
        icon: '🟣',
        headerBg: 'bg-purple-600 dark:bg-purple-800 text-white',
        headerSub: 'text-purple-100',
        subtotalBg: 'bg-purple-50/90 dark:bg-purple-950/40 border-b-2 border-purple-200 dark:border-purple-900',
        subtotalText: 'text-purple-700 dark:text-purple-300 font-black',
        excelColor: '7E22CE'
      },
      {
        id: '003',
        title: 'LOT FELDA',
        code: 'LOT FELDA',
        icon: '🟠',
        headerBg: 'bg-amber-600 dark:bg-amber-800 text-white',
        headerSub: 'text-amber-100',
        subtotalBg: 'bg-amber-50/90 dark:bg-amber-950/40 border-b-2 border-amber-200 dark:border-amber-900',
        subtotalText: 'text-amber-700 dark:text-amber-300 font-black',
        excelColor: 'D97706'
      }
    ].filter(g => availablePkts.includes(g.id));
  }

  // Other estates (e.g. Kledang, Sening, or other new estates):
  // 003 is standard PKT 003 (Peringkat 3), and separate Felda if defined
  return [
    {
      id: '001',
      title: 'PKT 001',
      code: 'P1',
      icon: '🔹',
      headerBg: 'bg-blue-600 dark:bg-blue-800 text-white',
      headerSub: 'text-blue-100',
      subtotalBg: 'bg-blue-50/90 dark:bg-blue-950/40 border-b-2 border-blue-200 dark:border-blue-900',
      subtotalText: 'text-blue-700 dark:text-blue-300 font-black',
      excelColor: '1D4ED8'
    },
    {
      id: '002',
      title: 'PKT 002',
      code: 'P2',
      icon: '🟣',
      headerBg: 'bg-purple-600 dark:bg-purple-800 text-white',
      headerSub: 'text-purple-100',
      subtotalBg: 'bg-purple-50/90 dark:bg-purple-950/40 border-b-2 border-purple-200 dark:border-purple-900',
      subtotalText: 'text-purple-700 dark:text-purple-300 font-black',
      excelColor: '7E22CE'
    },
    {
      id: '003',
      title: 'PKT 003',
      code: 'P3',
      icon: '🟠',
      headerBg: 'bg-amber-600 dark:bg-amber-800 text-white',
      headerSub: 'text-amber-100',
      subtotalBg: 'bg-amber-50/90 dark:bg-amber-950/40 border-b-2 border-amber-200 dark:border-amber-900',
      subtotalText: 'text-amber-700 dark:text-amber-300 font-black',
      excelColor: 'D97706'
    },
    {
      id: '004',
      title: 'PKT 004',
      code: 'P4',
      icon: '🟢',
      headerBg: 'bg-emerald-600 dark:bg-emerald-800 text-white',
      headerSub: 'text-emerald-100',
      subtotalBg: 'bg-emerald-50/90 dark:bg-emerald-950/40 border-b-2 border-emerald-200 dark:border-emerald-900',
      subtotalText: 'text-emerald-700 dark:text-emerald-300 font-black',
      excelColor: '059669'
    },
    {
      id: 'FELDA',
      title: 'LOT FELDA',
      code: 'LOT FELDA',
      icon: '🍂',
      headerBg: 'bg-orange-600 dark:bg-orange-800 text-white',
      headerSub: 'text-orange-100',
      subtotalBg: 'bg-orange-50/90 dark:bg-orange-950/40 border-b-2 border-orange-200 dark:border-orange-900',
      subtotalText: 'text-orange-700 dark:text-orange-300 font-black',
      excelColor: 'EA580C'
    }
  ].filter(g => availablePkts.includes(g.id));
}

// Initial storage fetcher per estate
function getInitialBacklogForEstate(estateId: string): Record<string, Record<string, BacklogRecord>> {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(`fpm_backlog_history_${estateId}`) || 
      (estateId === 'FPM_TUNGGAL' ? localStorage.getItem(BACKLOG_STORAGE_KEY) : null);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
  }
  return {};
}

// Calculate days worked between start and end date from Laporan Backlog
function calculateDaysFromDates(startDateStr?: string, endDateStr?: string, fallbackDateStr?: string): number {
  if (!startDateStr || startDateStr.trim() === '') {
    return 1;
  }
  
  const targetEndStr = (endDateStr && endDateStr.trim() !== '') ? endDateStr : fallbackDateStr;
  if (!targetEndStr || targetEndStr.trim() === '') {
    return 1;
  }

  try {
    const parseDate = (dStr: string) => {
      const trimmed = dStr.trim();
      if (trimmed.includes('/')) {
        const parts = trimmed.split('/');
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          }
          return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
      } else if (trimmed.includes('-')) {
        const parts = trimmed.split('-');
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          }
          return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
      }
      return new Date(trimmed);
    };

    const d1 = parseDate(startDateStr);
    const d2 = parseDate(targetEndStr);

    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 1;

    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);

    const diffTime = d2.getTime() - d1.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(1, diffDays + 1);
  } catch (e) {
    return 1;
  }
}

interface LaporanProduktivitiViewProps {
  rawData?: Transaction[];
  selectedDate?: string;
}

export const LaporanProduktivitiViewComponent: React.FC<LaporanProduktivitiViewProps> = ({
  rawData = [],
  selectedDate: propSelectedDate
}) => {
  // Active Estate State with Live Reactive Listener
  const [activeEstate, setActiveEstate] = useState<string>(() => getActiveEstateId());
  const estateConfig = useMemo(() => getEstateConfig(activeEstate), [activeEstate]);
  const isAdela = activeEstate === 'FPM_ADELA';
  const estateName = estateConfig?.name || (isAdela ? 'FPM Adela' : 'FPMSB Tunggal');
  const estateShortName = estateConfig?.shortName || (isAdela ? 'Adela' : 'Tunggal');

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (propSelectedDate) return propSelectedDate;
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localToday = new Date(today.getTime() - (offset * 60 * 1000));
    return localToday.toISOString().split('T')[0];
  });

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterPkt, setFilterPkt] = useState<string>('semua');
  
  // Backlog history fetched from localStorage/API
  const [backlogHistory, setBacklogHistory] = useState<Record<string, Record<string, BacklogRecord>>>(() => {
    return getInitialBacklogForEstate(getActiveEstateId());
  });

  // Sync propSelectedDate if passed from parent
  useEffect(() => {
    if (propSelectedDate) {
      setSelectedDate(propSelectedDate);
    }
  }, [propSelectedDate]);

  // State for Editing Overrides
  const [editingBlock, setEditingBlock] = useState<BlockProductivityRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fetch Backlog History for Current Estate
  const fetchBacklogData = useCallback(async (currentEstateId: string) => {
    try {
      const res = await safeFetch(`/api/hasil/backlog?estate_id=${currentEstateId}`);
      if (res.ok && res.headers.get("content-type")?.includes("application/json")) {
        const json = await res.json();
        if (json.backlogHistory) {
          setBacklogHistory(json.backlogHistory);
          localStorage.setItem(`fpm_backlog_history_${currentEstateId}`, JSON.stringify(json.backlogHistory));
        } else {
          // If no history returned, attempt reading local cache
          const localCache = getInitialBacklogForEstate(currentEstateId);
          setBacklogHistory(localCache);
        }
      } else {
        const localCache = getInitialBacklogForEstate(currentEstateId);
        setBacklogHistory(localCache);
      }
    } catch (err) {
      console.warn("Using offline backlog history copy for:", currentEstateId);
      const localCache = getInitialBacklogForEstate(currentEstateId);
      setBacklogHistory(localCache);
    }
  }, []);

  // Listen to estate switches and load appropriate backlog data
  useEffect(() => {
    fetchBacklogData(activeEstate);

    const handleEstateChange = (e: any) => {
      const newEstateId = e?.detail?.estateId || getActiveEstateId();
      setActiveEstate(newEstateId);
      setFilterPkt('semua');
      fetchBacklogData(newEstateId);
    };

    window.addEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
    return () => window.removeEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
  }, [activeEstate, fetchBacklogData]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Format date display (e.g. 19/08/2026)
  const formattedDisplayDate = useMemo(() => {
    if (!selectedDate) return '19/08/2026';
    const parts = selectedDate.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return selectedDate;
  }, [selectedDate]);

  // Combine Data Sources per Block based on active estate
  const records = useMemo<BlockProductivityRecord[]>(() => {
    const dayBacklogData = backlogHistory[selectedDate] || {};
    const estateBlocks = getEstateBlocks(activeEstate, estateConfig);

    // Filter transaction receipts for active estate to prevent crosstalk
    const estateTransactions = (rawData || []).filter(t => {
      if (t.estate_id) {
        return t.estate_id.trim().toUpperCase() === activeEstate.trim().toUpperCase();
      }
      return inferEstateFromReceipt(t) === activeEstate;
    });

    return estateBlocks.map(({ key: blokKey, luas, pkt }) => {
      const isLF = blokKey === '88' || blokKey.includes('LF');
      const displayCode = getBlockDisplayCode(blokKey, activeEstate);

      // Default standards
      let defaultBuruh = 3;
      let defaultBts = 200;

      if (isAdela) {
        const adelaDef = ADELA_BLOCK_DEFAULTS[blokKey];
        if (adelaDef) {
          defaultBuruh = adelaDef.buruh;
          defaultBts = adelaDef.bts;
        } else {
          defaultBuruh = Math.max(2, Math.round(luas / 25));
          defaultBts = Math.max(80, Math.round(luas * 3.5));
        }
      } else {
        const tunggalDef = DEFAULT_BLOCK_DEFAULTS_TUNGGAL[blokKey] || { buruh: 3, bts: 200 };
        defaultBuruh = tunggalDef.buruh;
        defaultBts = tunggalDef.bts;
      }

      let bilPekerja = 0;
      let bilHariKerja = 1;
      let jumlahBts = 0;
      let luasKerja = luas;
      let tarikhMulaBacklog = '';
      let tarikhSiapBacklog = '';
      let isBacklogSynced = false;

      // --- BACKLOG DATA EXTRACTION ---
      if (activeEstate === 'FPM_TUNGGAL' && isLF) {
        // Lot Felda Tunggal uses 001LF & 002LF in Backlog
        const b001 = dayBacklogData['001LF'] || {};
        const b002 = dayBacklogData['002LF'] || {};

        const buruh1 = b001.bil_buruh !== undefined && b001.bil_buruh > 0 ? b001.bil_buruh : 3;
        const buruh2 = b002.bil_buruh !== undefined && b002.bil_buruh > 0 ? b002.bil_buruh : 3;
        bilPekerja = buruh1 + buruh2;

        const bts1 = b001.capai_tandan || b001.tandan_harian || 100;
        const bts2 = b002.capai_tandan || b002.tandan_harian || 140;
        jumlahBts = bts1 + bts2;

        const days1 = calculateDaysFromDates(b001.pus1_mula, b001.pus1_tamat, formattedDisplayDate);
        const days2 = calculateDaysFromDates(b002.pus1_mula, b002.pus1_tamat, formattedDisplayDate);
        bilHariKerja = Math.max(days1, days2);

        tarikhMulaBacklog = b001.pus1_mula || b002.pus1_mula || '';
        tarikhSiapBacklog = b001.pus1_tamat || b002.pus1_tamat || '';
        if (b001.bil_buruh || b002.bil_buruh || b001.capai_tandan || b002.capai_tandan) {
          isBacklogSynced = true;
        }
      } else {
        const bRecord = dayBacklogData[blokKey] || {};

        if (bRecord.bil_buruh !== undefined && bRecord.bil_buruh > 0) {
          bilPekerja = bRecord.bil_buruh;
          isBacklogSynced = true;
        } else {
          bilPekerja = defaultBuruh;
        }

        if (bRecord.capai_tandan && bRecord.capai_tandan > 0) {
          jumlahBts = bRecord.capai_tandan;
          isBacklogSynced = true;
        } else if (bRecord.tandan_harian && bRecord.tandan_harian > 0) {
          jumlahBts = bRecord.tandan_harian;
        } else {
          jumlahBts = defaultBts;
        }

        if (bRecord.hektar_siap && bRecord.hektar_siap > 0) {
          luasKerja = bRecord.hektar_siap;
        } else {
          luasKerja = parseFloat((luas * 0.25).toFixed(1));
        }

        tarikhMulaBacklog = bRecord.pus1_mula || '';
        tarikhSiapBacklog = bRecord.pus1_tamat || '';
        bilHariKerja = calculateDaysFromDates(tarikhMulaBacklog, tarikhSiapBacklog, formattedDisplayDate);
      }

      // --- HASIL / YIELD & BTS DATA EXTRACTION ---
      let defaultAbw = 23.0;
      if (isAdela) {
        defaultAbw = ADELA_ABW_MAP[blokKey] || (pkt === '002' ? 16.5 : (pkt === '003' || pkt === '004' ? 18.0 : 23.5));
      } else {
        defaultAbw = DEFAULT_ABW_MAP_TUNGGAL[blokKey] || (pkt === '001' ? 23.0 : pkt === '002' ? 18.0 : 18.66);
      }

      // 1. Determine Daily Values for Hari Ini (HI)
      let jumlahBtsHI = 0;

      if (activeEstate === 'FPM_TUNGGAL' && isLF) {
        const b001 = dayBacklogData['001LF'] || {};
        const b002 = dayBacklogData['002LF'] || {};
        const bts1 = b001.capai_tandan || b001.tandan_harian || 0;
        const bts2 = b002.capai_tandan || b002.tandan_harian || 0;
        if (bts1 + bts2 > 0) {
          jumlahBtsHI = bts1 + bts2;
        }
      } else {
        const bRecord = dayBacklogData[blokKey] || {};
        if (bRecord.capai_tandan && bRecord.capai_tandan > 0) {
          jumlahBtsHI = bRecord.capai_tandan;
        } else if (bRecord.tandan_harian && bRecord.tandan_harian > 0) {
          jumlahBtsHI = bRecord.tandan_harian;
        }
      }

      if (jumlahBtsHI === 0) {
        jumlahBtsHI = defaultBts;
      }

      const luasKerjaHI = luasKerja;

      let beratMtHI = 0;
      let isYieldSynced = false;

      if (estateTransactions.length > 0) {
        const blockMonthTx = estateTransactions.filter(t => {
          const tBlok = String(t.blok || '').trim().toUpperCase();
          const targetBlok = String(blokKey).trim().toUpperCase();
          if (tBlok === targetBlok) return true;
          if (tBlok === `B${targetBlok}` || `B${tBlok}` === targetBlok) return true;
          if (isLF && (tBlok === '88' || tBlok === '88F' || tBlok === 'FELDA' || tBlok === '001LF' || tBlok === '002LF' || tBlok === '1F' || tBlok === '2F')) return true;
          return false;
        });

        const matchingTx = blockMonthTx.filter(t => 
          t.tarikh === selectedDate || t.tarikh === formattedDisplayDate
        );

        if (matchingTx.length > 0) {
          const sumDailyTan = matchingTx.reduce((acc, t) => acc + (Number(t.tan) || 0), 0);
          if (sumDailyTan > 0 && sumDailyTan < 50) {
            beratMtHI = sumDailyTan;
            isYieldSynced = true;
          }
        }
      }

      // If no weighbridge scale transactions exist yet for today, compute estimated MT via ABW
      if (beratMtHI === 0 && jumlahBtsHI > 0) {
        beratMtHI = parseFloat(((jumlahBtsHI * defaultAbw) / 1000).toFixed(2));
      }

      // 2. Determine Cumulative Values Hingga Hari Ini (HII)
      let accumulatedBtsInMonth = 0;
      let accumulatedHektarInMonth = 0;
      let accumulatedManDaysInMonth = 0;
      let accumulatedBeratMtInMonth = 0;
      let workingDaysInMonth = 0;

      let targetYear = 2026;
      let targetMonth = 8;
      let maxDay = 29;

      if (selectedDate && selectedDate.includes('-')) {
        const parts = selectedDate.split('-');
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            targetYear = parseInt(parts[0], 10) || 2026;
            targetMonth = parseInt(parts[1], 10) || 8;
            maxDay = parseInt(parts[2], 10) || 1;
          } else {
            maxDay = parseInt(parts[0], 10) || 1;
            targetMonth = parseInt(parts[1], 10) || 8;
            targetYear = parseInt(parts[2], 10) || 2026;
          }
        }
      } else if (selectedDate && selectedDate.includes('/')) {
        const parts = selectedDate.split('/');
        if (parts.length === 3) {
          if (parts[2].length === 4) {
            maxDay = parseInt(parts[0], 10) || 1;
            targetMonth = parseInt(parts[1], 10) || 8;
            targetYear = parseInt(parts[2], 10) || 2026;
          } else {
            targetYear = parseInt(parts[0], 10) || 2026;
            targetMonth = parseInt(parts[1], 10) || 8;
            maxDay = parseInt(parts[2], 10) || 1;
          }
        }
      }

      const yearMonthStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;

      for (let d = 1; d <= maxDay; d++) {
        const dStr = `${yearMonthStr}-${String(d).padStart(2, '0')}`;
        const dDisplayDate = `${String(d).padStart(2, '0')}/${String(targetMonth).padStart(2, '0')}/${targetYear}`;
        const dDate = new Date(targetYear, targetMonth - 1, d);
        const isSunday = dDate.getDay() === 0;

        let hasDataOnDay = false;

        if (activeEstate === 'FPM_TUNGGAL' && isLF) {
          const b1 = backlogHistory[dStr]?.['001LF'];
          const b2 = backlogHistory[dStr]?.['002LF'];

          let dailyBts = 0;
          if (b1 || b2) {
            hasDataOnDay = true;
            const val1 = b1?.capai_tandan || b1?.tandan_harian || 0;
            const val2 = b2?.capai_tandan || b2?.tandan_harian || 0;
            dailyBts = val1 + val2;
          } else if (d === maxDay) {
            dailyBts = jumlahBtsHI;
          }
          accumulatedBtsInMonth += dailyBts;

          let dailyHa = 0;
          if (b1 || b2) {
            hasDataOnDay = true;
            const ha1 = b1?.hektar_siap || 0;
            const ha2 = b2?.hektar_siap || 0;
            dailyHa = ha1 + ha2;
          } else if (d === maxDay) {
            dailyHa = luasKerjaHI;
          }
          accumulatedHektarInMonth += dailyHa;

          let dailyBuruh = 0;
          if (b1 || b2) {
            hasDataOnDay = true;
            const buruh1 = b1?.bil_buruh !== undefined && b1.bil_buruh > 0 ? b1.bil_buruh : 0;
            const buruh2 = b2?.bil_buruh !== undefined && b2.bil_buruh > 0 ? b2.bil_buruh : 0;
            dailyBuruh = buruh1 + buruh2;
          } else if (d === maxDay) {
            dailyBuruh = bilPekerja;
          }
          accumulatedManDaysInMonth += dailyBuruh;

          let dailyMt = 0;
          if (d === maxDay && beratMtHI > 0) {
            dailyMt = beratMtHI;
            hasDataOnDay = true;
          } else if (estateTransactions.length > 0) {
            const matchingTx = estateTransactions.filter(t => 
              (t.blok === '88' || t.blok === '88F' || t.blok === 'FELDA' || String(t.blok) === '001LF' || String(t.blok) === '002LF' || t.blok === '1F' || t.blok === '2F') && (t.tarikh === dStr || t.tarikh === dDisplayDate)
            );
            if (matchingTx.length > 0) {
              const sumDailyTan = matchingTx.reduce((acc, t) => acc + (Number(t.tan) || 0), 0);
              if (sumDailyTan > 0 && sumDailyTan < 50) {
                dailyMt = sumDailyTan;
                hasDataOnDay = true;
              }
            }
          }
          if (dailyMt === 0 && dailyBts > 0) {
            dailyMt = parseFloat(((dailyBts * defaultAbw) / 1000).toFixed(2));
          }
          accumulatedBeratMtInMonth += dailyMt;

        } else {
          const bRec = backlogHistory[dStr]?.[blokKey];

          let dailyBts = 0;
          if (bRec && (bRec.capai_tandan || bRec.tandan_harian)) {
            hasDataOnDay = true;
            dailyBts = bRec.capai_tandan || bRec.tandan_harian || 0;
          } else if (d === maxDay) {
            dailyBts = jumlahBtsHI;
          }
          accumulatedBtsInMonth += dailyBts;

          let dailyHa = 0;
          if (bRec && bRec.hektar_siap && bRec.hektar_siap > 0) {
            hasDataOnDay = true;
            dailyHa = bRec.hektar_siap;
          } else if (d === maxDay) {
            dailyHa = luasKerjaHI;
          }
          accumulatedHektarInMonth += dailyHa;

          let dailyBuruh = 0;
          if (bRec && bRec.bil_buruh !== undefined && bRec.bil_buruh > 0) {
            hasDataOnDay = true;
            dailyBuruh = bRec.bil_buruh;
          } else if (d === maxDay) {
            dailyBuruh = bilPekerja;
          }
          accumulatedManDaysInMonth += dailyBuruh;

          let dailyMt = 0;
          if (d === maxDay && beratMtHI > 0) {
            dailyMt = beratMtHI;
            hasDataOnDay = true;
          } else if (estateTransactions.length > 0) {
            const matchingTx = estateTransactions.filter(t => {
              const tBlok = String(t.blok || '').trim().toUpperCase();
              const targetBlok = String(blokKey).trim().toUpperCase();
              const matchesBlock = tBlok === targetBlok || tBlok === `B${targetBlok}` || `B${tBlok}` === targetBlok;
              return matchesBlock && (t.tarikh === dStr || t.tarikh === dDisplayDate);
            });
            if (matchingTx.length > 0) {
              const sumDailyTan = matchingTx.reduce((acc, t) => acc + (Number(t.tan) || 0), 0);
              if (sumDailyTan > 0 && sumDailyTan < 50) {
                dailyMt = sumDailyTan;
                hasDataOnDay = true;
              }
            }
          }
          if (dailyMt === 0 && dailyBts > 0) {
            dailyMt = parseFloat(((dailyBts * defaultAbw) / 1000).toFixed(2));
          }
          accumulatedBeratMtInMonth += dailyMt;
        }

        if (hasDataOnDay || !isSunday) {
          workingDaysInMonth++;
        }
      }

      bilHariKerja = Math.max(1, workingDaysInMonth);

      const jumlahBtsHII = accumulatedBtsInMonth;
      const luasKerjaHII = parseFloat(accumulatedHektarInMonth.toFixed(1));
      const beratMtHII = parseFloat(accumulatedBeratMtInMonth.toFixed(2));
      const accumulatedManDaysHII = accumulatedManDaysInMonth;

      return {
        blok: blokKey,
        displayCode,
        pkt,
        luasBlok: luas,
        tarikh: selectedDate,
        bilPekerja,
        bilHariKerja,
        accumulatedManDaysHII,
        luasKerjaHI,
        luasKerjaHII,
        jumlahBtsHI,
        jumlahBtsHII,
        beratMtHI,
        beratMtHII,
        luasKerja: luasKerjaHI,
        jumlahBts: jumlahBtsHI,
        beratMt: beratMtHI,
        tarikhMulaBacklog,
        tarikhSiapBacklog,
        isBacklogSynced,
        isYieldSynced,
      };
    });
  }, [backlogHistory, selectedDate, rawData, formattedDisplayDate, activeEstate, estateConfig, isAdela]);

  // Computed records with final metrics & benchmark colors
  const computedRecords = useMemo(() => {
    return records.map((r) => {
      const workerCount = Math.max(1, r.bilPekerja || 1);
      const roundDays = Math.max(1, r.bilHariKerja || 1);
      const totalManDays = (r as any).accumulatedManDaysHII > 0 
        ? (r as any).accumulatedManDaysHII 
        : (workerCount * roundDays);

      // HI Ratios (Daily per 1 Worker on this Day)
      const btsPerPekerjaHariHI = workerCount > 0 ? r.jumlahBtsHI / workerCount : 0;
      const mtPerPekerjaHariHI = workerCount > 0 ? r.beratMtHI / workerCount : 0;
      const haPerPekerjaHariHI = workerCount > 0 ? r.luasKerjaHI / workerCount : 0;

      // HII Ratios (Cumulative / Round Average per 1 Man-Day)
      const btsPerPekerjaHariHII = totalManDays > 0 ? r.jumlahBtsHII / totalManDays : btsPerPekerjaHariHI;
      const mtPerPekerjaHariHII = totalManDays > 0 ? r.beratMtHII / totalManDays : mtPerPekerjaHariHI;
      const haPerPekerjaHariHII = totalManDays > 0 ? r.luasKerjaHII / totalManDays : haPerPekerjaHariHI;

      const abwKg = r.jumlahBtsHII > 0 
        ? (r.beratMtHII * 1000) / r.jumlahBtsHII 
        : (r.jumlahBtsHI > 0 ? (r.beratMtHI * 1000) / r.jumlahBtsHI : 0);

      // Primary productivity benchmark based on Harvester Ton / Worker / Day (MT/Pkr/Hari)
      const effectiveMtPerPkr = btsPerPekerjaHariHI > 0 && mtPerPekerjaHariHI > 0 ? mtPerPekerjaHariHI : mtPerPekerjaHariHII;

      let benchmark = '🔴 Rendah';
      let benchmarkColor = 'bg-rose-500/10 text-rose-600 border-rose-500/30';
      if (effectiveMtPerPkr >= 2.0) {
        benchmark = '🟢 Tinggi';
        benchmarkColor = 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30';
      } else if (effectiveMtPerPkr >= 1.5) {
        benchmark = '🟡 Sederhana';
        benchmarkColor = 'bg-amber-500/10 text-amber-600 border-amber-500/30';
      }

      return {
        ...r,
        totalManDays,
        btsPerPekerjaHariHI,
        btsPerPekerjaHariHII,
        mtPerPekerjaHariHI,
        mtPerPekerjaHariHII,
        haPerPekerjaHariHI,
        haPerPekerjaHariHII,
        btsPerPekerjaHari: btsPerPekerjaHariHI > 0 ? btsPerPekerjaHariHI : btsPerPekerjaHariHII,
        mtPerPekerjaHari: mtPerPekerjaHariHI > 0 ? mtPerPekerjaHariHI : mtPerPekerjaHariHII,
        haPerPekerjaHari: haPerPekerjaHariHI > 0 ? haPerPekerjaHariHI : haPerPekerjaHariHII,
        abwKg,
        benchmark,
        benchmarkColor,
      };
    });
  }, [records]);

  // Distinct available PKT categories in the records
  const availablePkts = useMemo(() => {
    return Array.from(new Set(computedRecords.map(r => r.pkt))).sort();
  }, [computedRecords]);

  // Dynamic Groups Definition for active estate
  const activeGroups = useMemo(() => {
    return getGroupsConfigForEstate(activeEstate, availablePkts);
  }, [activeEstate, availablePkts]);

  // Filtered list based on search and PKT
  const filteredRecords = useMemo(() => {
    return computedRecords.filter((r) => {
      const matchSearch = 
        r.displayCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.blok.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.pkt.toLowerCase().includes(searchQuery.toLowerCase());

      const matchPkt = filterPkt === 'semua' ? true : r.pkt === filterPkt;

      return matchSearch && matchPkt;
    });
  }, [computedRecords, searchQuery, filterPkt]);

  // Totals and KPI summary
  const summary = useMemo(() => {
    const totalLuasBlok = computedRecords.reduce((acc, r) => acc + r.luasBlok, 0);
    const totalPekerja = computedRecords.reduce((acc, r) => acc + r.bilPekerja, 0);
    const totalManDays = computedRecords.reduce((acc, r) => acc + (r.totalManDays || (r.bilPekerja * r.bilHariKerja)), 0);

    const totalLuasKerjaHI = computedRecords.reduce((acc, r) => acc + r.luasKerjaHI, 0);
    const totalLuasKerjaHII = computedRecords.reduce((acc, r) => acc + r.luasKerjaHII, 0);

    const totalBtsHI = computedRecords.reduce((acc, r) => acc + r.jumlahBtsHI, 0);
    const totalBtsHII = computedRecords.reduce((acc, r) => acc + r.jumlahBtsHII, 0);

    const totalBeratMtHI = computedRecords.reduce((acc, r) => acc + r.beratMtHI, 0);
    const totalBeratMtHII = computedRecords.reduce((acc, r) => acc + r.beratMtHII, 0);

    const validProdRecords = computedRecords.filter(r => r.mtPerPekerjaHariHII > 0 || r.btsPerPekerjaHariHII > 0);

    const avgBtsPerPekerjaHari = totalManDays > 0 
      ? totalBtsHII / totalManDays 
      : (validProdRecords.length > 0 ? validProdRecords.reduce((a, r) => a + r.btsPerPekerjaHariHII, 0) / validProdRecords.length : 0);

    const avgMtPerPekerjaHari = totalManDays > 0 
      ? totalBeratMtHII / totalManDays 
      : (validProdRecords.length > 0 ? validProdRecords.reduce((a, r) => a + r.mtPerPekerjaHariHII, 0) / validProdRecords.length : 0);

    const avgHaPerPekerjaHari = totalManDays > 0 
      ? totalLuasKerjaHII / totalManDays 
      : (validProdRecords.length > 0 ? validProdRecords.reduce((a, r) => a + r.haPerPekerjaHariHII, 0) / validProdRecords.length : 0);

    const overallAbw = totalBtsHII > 0 ? (totalBeratMtHII * 1000) / totalBtsHII : 0;
    const avgHariKerja = totalPekerja > 0 ? totalManDays / totalPekerja : 0;

    const sortedByProd = [...computedRecords].sort((a, b) => b.mtPerPekerjaHariHII - a.mtPerPekerjaHariHII);
    const top3 = sortedByProd.slice(0, 3);
    const bot3 = sortedByProd.filter(r => r.mtPerPekerjaHariHII > 0).slice(-3).reverse();

    const calcSubtotal = (pktCode: string) => {
      const subList = computedRecords.filter(r => r.pkt === pktCode);
      const subLuasBlok = subList.reduce((a, r) => a + r.luasBlok, 0);
      const subPekerja = subList.reduce((a, r) => a + r.bilPekerja, 0);
      const subManDays = subList.reduce((a, r) => a + (r.totalManDays || (r.bilPekerja * r.bilHariKerja)), 0);

      const subLuasKerjaHI = subList.reduce((a, r) => a + r.luasKerjaHI, 0);
      const subLuasKerjaHII = subList.reduce((a, r) => a + r.luasKerjaHII, 0);

      const subBtsHI = subList.reduce((a, r) => a + r.jumlahBtsHI, 0);
      const subBtsHII = subList.reduce((a, r) => a + r.jumlahBtsHII, 0);

      const subMtHI = subList.reduce((a, r) => a + r.beratMtHI, 0);
      const subMtHII = subList.reduce((a, r) => a + r.beratMtHII, 0);

      const validSubList = subList.filter(r => r.mtPerPekerjaHariHII > 0 || r.btsPerPekerjaHariHII > 0);

      const avgBtsPkr = subManDays > 0 
        ? subBtsHII / subManDays 
        : (validSubList.length > 0 ? validSubList.reduce((a, r) => a + r.btsPerPekerjaHariHII, 0) / validSubList.length : 0);

      const avgMtPkr = subManDays > 0 
        ? subMtHII / subManDays 
        : (validSubList.length > 0 ? validSubList.reduce((a, r) => a + r.mtPerPekerjaHariHII, 0) / validSubList.length : 0);

      const avgHaPkr = subManDays > 0 
        ? subLuasKerjaHII / subManDays 
        : (validSubList.length > 0 ? validSubList.reduce((a, r) => a + r.haPerPekerjaHariHII, 0) / validSubList.length : 0);

      const abw = subBtsHII > 0 ? (subMtHII * 1000) / subBtsHII : 0;
      const subAvgHariKerja = subPekerja > 0 ? subManDays / subPekerja : 0;

      return {
        count: subList.length,
        subLuasBlok,
        subPekerja,
        subManDays,
        subAvgHariKerja,
        subLuasKerjaHI,
        subLuasKerjaHII,
        subBtsHI,
        subBtsHII,
        subMtHI,
        subMtHII,
        avgBtsPkr,
        avgMtPkr,
        avgHaPkr,
        abw,
      };
    };

    const byPkt: Record<string, ReturnType<typeof calcSubtotal>> = {};
    availablePkts.forEach(p => {
      byPkt[p] = calcSubtotal(p);
    });

    return {
      totalLuasBlok,
      totalPekerja,
      totalManDays,
      avgHariKerja,
      totalLuasKerjaHI,
      totalLuasKerjaHII,
      totalLuasKerja: totalLuasKerjaHII,
      totalBtsHI,
      totalBtsHII,
      totalBts: totalBtsHII,
      totalBeratMtHI,
      totalBeratMtHII,
      totalBeratMt: totalBeratMtHII,
      avgBtsPerPekerjaHari,
      avgMtPerPekerjaHari,
      avgHaPerPekerjaHari,
      overallAbw,
      top3,
      bot3,
      byPkt,
      calcSubtotal,
      pkt1: byPkt['001'] || calcSubtotal('001'),
      pkt2: byPkt['002'] || calcSubtotal('002'),
      pkt3: byPkt['003'] || calcSubtotal('003'),
    };
  }, [computedRecords, availablePkts]);

  // Handle Edit Modal
  const handleEditClick = (record: BlockProductivityRecord) => {
    setEditingBlock({ ...record });
    setIsModalOpen(true);
  };

  // Save Modal Override
  const handleSaveModal = () => {
    if (!editingBlock) return;

    const dayData = backlogHistory[selectedDate] || {};
    const bKey = (activeEstate === 'FPM_TUNGGAL' && editingBlock.blok === '88') ? '001LF' : editingBlock.blok;

    const updatedDayData = {
      ...dayData,
      [bKey]: {
        ...(dayData[bKey] || {}),
        bil_buruh: editingBlock.bilPekerja,
        capai_tandan: editingBlock.jumlahBts,
        hektar_siap: editingBlock.luasKerja,
      }
    };

    const updatedHistory = {
      ...backlogHistory,
      [selectedDate]: updatedDayData
    };

    setBacklogHistory(updatedHistory);
    localStorage.setItem(`fpm_backlog_history_${activeEstate}`, JSON.stringify(updatedHistory));
    if (activeEstate === 'FPM_TUNGGAL') {
      localStorage.setItem(BACKLOG_STORAGE_KEY, JSON.stringify(updatedHistory));
    }

    // Save to API
    safeFetch(`/api/hasil/backlog?estate_id=${activeEstate}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ backlogHistory: updatedHistory, estate_id: activeEstate })
    }).catch(e => console.error("Sync edit fail:", e));

    setIsModalOpen(false);
    setEditingBlock(null);
    triggerToast(`Data Laporan Backlog & Produktiviti ${editingBlock.displayCode} telah dikemaskini!`);
  };

  // Export to Excel
  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Produktiviti Menuai');
      const estateTitle = estateName.toUpperCase();

      worksheet.mergeCells('A1:R1');
      worksheet.getCell('A1').value = `LAPORAN PRODUKTIVITI MENUAI & TENAGA KERJA ${estateTitle} (MENGIKUT PERINGKAT)`;
      worksheet.getCell('A1').font = { bold: true, size: 14 };
      worksheet.getCell('A1').alignment = { horizontal: 'center' };

      worksheet.mergeCells('A2:R2');
      worksheet.getCell('A2').value = `Tarikh Semakan: ${formattedDisplayDate} | Ladang: ${estateName} | Sumber: Laporan Backlog & Data Hasil`;
      worksheet.getCell('A2').font = { italic: true, size: 10 };
      worksheet.getCell('A2').alignment = { horizontal: 'center' };

      worksheet.addRow([]);

      const headerRow = worksheet.addRow([
        'No', 'Sektor / PKT', 'Blok', 'Luas Blok (Ha)', 'Tarikh',
        'Pekerja (Backlog)', 'Hari Kerja', 'Luas HI (Ha)', 'Luas HII (Ha)',
        'BTS HI', 'BTS HII', 'Berat MT HI', 'Berat MT HII',
        'BTS/Pkr/Hari', 'MT/Pkr/Hari', 'Ha/Pkr/Hari', 'ABW (kg)', 'Benchmark'
      ]);

      headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: '059669' },
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      let rowCounter = 1;

      activeGroups.forEach((grp) => {
        const grpRecords = filteredRecords.filter(r => r.pkt === grp.id);
        if (grpRecords.length === 0) return;

        // Add Group Section Title Row
        const groupHeaderRow = worksheet.addRow([`--- ${grp.title.toUpperCase()} ---`]);
        worksheet.mergeCells(`A${groupHeaderRow.number}:R${groupHeaderRow.number}`);
        groupHeaderRow.font = { bold: true, color: { argb: 'FFFFFF' } };
        groupHeaderRow.getCell(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: grp.excelColor }
        };

        grpRecords.forEach((r) => {
          worksheet.addRow([
            rowCounter++,
            getPktShortBadge(r.pkt, activeEstate),
            r.displayCode,
            r.luasBlok.toFixed(2),
            formattedDisplayDate,
            r.bilPekerja,
            r.bilHariKerja,
            r.luasKerjaHI.toFixed(2),
            r.luasKerjaHII.toFixed(2),
            r.jumlahBtsHI,
            r.jumlahBtsHII,
            r.beratMtHI.toFixed(2),
            r.beratMtHII.toFixed(2),
            r.btsPerPekerjaHari.toFixed(0),
            r.mtPerPekerjaHari.toFixed(2),
            r.haPerPekerjaHari.toFixed(2),
            r.abwKg.toFixed(2),
            r.benchmark
          ]);
        });

        // Group Subtotal
        const subData = summary.byPkt[grp.id] || summary.calcSubtotal(grp.id);
        const subRow = worksheet.addRow([
          '',
          `SUBTOTAL ${grp.title}`,
          `${subData.count} BLOK`,
          subData.subLuasBlok.toFixed(2),
          formattedDisplayDate,
          subData.subPekerja,
          subData.subAvgHariKerja > 0 ? `${subData.subAvgHariKerja.toFixed(1)} h` : '-',
          subData.subLuasKerjaHI.toFixed(2),
          subData.subLuasKerjaHII.toFixed(2),
          subData.subBtsHI,
          subData.subBtsHII,
          subData.subMtHI.toFixed(2),
          subData.subMtHII.toFixed(2),
          subData.avgBtsPkr.toFixed(0),
          subData.avgMtPkr.toFixed(2),
          subData.avgHaPkr.toFixed(2),
          subData.abw.toFixed(2),
          'SUBTOTAL'
        ]);
        subRow.font = { bold: true };
      });

      worksheet.addRow([]);
      const totalRow = worksheet.addRow([
        '',
        `JUMLAH KESELURUHAN ${estateShortName.toUpperCase()}`,
        `${computedRecords.length} BLOK`,
        summary.totalLuasBlok.toFixed(2),
        formattedDisplayDate,
        summary.totalPekerja,
        summary.avgHariKerja > 0 ? `${summary.avgHariKerja.toFixed(1)} h` : '-',
        summary.totalLuasKerjaHI.toFixed(2),
        summary.totalLuasKerjaHII.toFixed(2),
        summary.totalBtsHI,
        summary.totalBtsHII,
        summary.totalBeratMtHI.toFixed(2),
        summary.totalBeratMtHII.toFixed(2),
        summary.avgBtsPerPekerjaHari.toFixed(0),
        summary.avgMtPerPekerjaHari.toFixed(2),
        summary.avgHaPerPekerjaHari.toFixed(2),
        summary.overallAbw.toFixed(2),
        summary.avgMtPerPekerjaHari >= 2.0 ? 'Cemerlang' : 'Sederhana'
      ]);

      totalRow.font = { bold: true };

      worksheet.columns = [
        { width: 6 }, { width: 18 }, { width: 22 }, { width: 14 },
        { width: 14 }, { width: 16 }, { width: 12 }, { width: 14 },
        { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 },
        { width: 14 }, { width: 16 }, { width: 16 }, { width: 14 },
        { width: 12 }, { width: 16 }
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Laporan_Produktiviti_Menuai_${estateShortName}_${selectedDate.replace(/-/g, '')}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);

      triggerToast(`Laporan Excel Produktiviti Menuai ${estateName} berjaya dimuat turun!`);
    } catch (err) {
      console.error('Error generating Excel report:', err);
      triggerToast('Gagal memuat turun laporan Excel.');
    }
  };

  // WhatsApp Share
  const handleShareWhatsApp = () => {
    const estateTitle = estateName.toUpperCase();
    let msg = `*${estateTitle} — LAPORAN PRODUKTIVITI MENUAI*\n`;
    msg += `📅 Tarikh: ${formattedDisplayDate}\n`;
    msg += `📊 *Nota Rekod:* HI = Hari Ini | HII = Hingga Hari Ini\n\n`;
    msg += `👥 Jumlah Penuai: ${summary.totalPekerja} orang (${computedRecords.length} Blok)\n`;
    msg += `🌾 Hasil HI (Hari Ini): ${summary.totalBeratMtHI.toFixed(2)} MT (${summary.totalBtsHI.toLocaleString()} BTS, ${summary.totalLuasKerjaHI.toFixed(1)} Ha)\n`;
    msg += `🌾 Hasil HII (Terkumpul): ${summary.totalBeratMtHII.toFixed(2)} MT (${summary.totalBtsHII.toLocaleString()} BTS, ${summary.totalLuasKerjaHII.toFixed(1)} Ha)\n`;
    msg += `⚡ Purata Produktiviti: *${summary.avgMtPerPekerjaHari.toFixed(2)} MT/pkr/hari* (${summary.avgBtsPerPekerjaHari.toFixed(0)} bts, ${summary.avgHaPerPekerjaHari.toFixed(2)} Ha)\n\n`;

    activeGroups.forEach(grp => {
      const sub = summary.byPkt[grp.id] || summary.calcSubtotal(grp.id);
      if (sub.count === 0) return;
      msg += `${grp.icon} *${grp.title}:*\n`;
      msg += `• Penuai: ${sub.subPekerja} pkr | HII: ${sub.subMtHII.toFixed(2)} MT (${sub.subBtsHII.toLocaleString()} bts)\n`;
      msg += `• Produktiviti: *${sub.avgMtPkr.toFixed(2)} MT/pkr/hari*\n\n`;
    });

    msg += `🏆 *TOP 3 BLOK PRODUKTIF:*\n`;
    summary.top3.forEach((b, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
      msg += `${medal} ${b.displayCode}: ${b.mtPerPekerjaHari.toFixed(2)} MT/pkr (${b.bilPekerja} pkr, HI: ${b.beratMtHI.toFixed(2)} MT / HII: ${b.beratMtHII.toFixed(2)} MT)\n`;
    });

    if (summary.bot3.length > 0) {
      msg += `\n⚠️ *BOTTOM 3 BLOK (PERLU PEMANTAUAN):*\n`;
      summary.bot3.forEach((b) => {
        msg += `🔴 ${b.displayCode}: ${b.mtPerPekerjaHari.toFixed(2)} MT/pkr (${b.bilPekerja} pkr, HI: ${b.beratMtHI.toFixed(2)} MT / HII: ${b.beratMtHII.toFixed(2)} MT)\n`;
      });
    }

    msg += `\nSistem Pengurusan ${estateTitle}`;

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  // Dynamic filter tabs
  const filterTabs = useMemo(() => {
    const tabs = [
      { id: 'semua', label: `Semua ${computedRecords.length} Blok` }
    ];

    activeGroups.forEach(grp => {
      const count = computedRecords.filter(r => r.pkt === grp.id).length;
      if (count > 0) {
        tabs.push({
          id: grp.id,
          label: `${grp.title} (${count} Blok)`
        });
      }
    });

    return tabs;
  }, [computedRecords, activeGroups]);

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 bg-emerald-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER CARD */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-black text-xs uppercase tracking-wider mb-1">
            <Users size={16} />
            <span>Modul Hasil — Analisis Tenaga Kerja</span>
          </div>
          <h1 className="text-xl font-black text-slate-800 dark:text-slate-100 font-display flex flex-wrap items-center gap-2">
            <span>Laporan Produktiviti Menuai</span>
            <span className="text-[11px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-black px-2.5 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
              {estateName}
            </span>
            <span className="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-bold px-2 py-0.5 rounded-full border border-blue-300 dark:border-blue-800">
              Synced Backlog &amp; Yield Data
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Pekerja &amp; Tandan diambil daripada <b>Laporan Backlog ({estateShortName})</b>. Hari Kerja dihitung daripada <b>Tarikh Mula &amp; Siap Menuai</b>. Hasil (MT) diambil daripada <b>Data Hasil</b>.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <Calendar size={14} className="text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-md shadow-emerald-600/20"
          >
            <Download size={14} />
            <span>Eksport Excel</span>
          </button>

          <button
            onClick={handleShareWhatsApp}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-md shadow-emerald-500/20"
          >
            <Share2 size={14} />
            <span>Kongsi WhatsApp</span>
          </button>
        </div>
      </div>

      {/* DATA SOURCE SYNC BANNER */}
      <div className="bg-slate-900 text-slate-200 rounded-2xl p-3 shadow-sm border border-slate-800 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
        <div className="flex items-center gap-2 bg-slate-800/60 p-2 rounded-xl border border-slate-700/60">
          <Info size={16} className="text-emerald-400 shrink-0" />
          <div>
            <p className="text-[10px] text-emerald-400 font-black uppercase">HI vs HII</p>
            <p className="font-bold text-slate-100 text-[10px]">HI = Hari Ini | HII = Hingga Hari Ini</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-800/60 p-2 rounded-xl border border-slate-700/60">
          <Hash size={16} className="text-blue-400 shrink-0" />
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase">Bil. Pekerja</p>
            <p className="font-bold text-slate-100 text-[11px]">Laporan Backlog {estateShortName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-800/60 p-2 rounded-xl border border-slate-700/60">
          <CalendarDays size={16} className="text-purple-400 shrink-0" />
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase">Hari Kerja</p>
            <p className="font-bold text-slate-100 text-[11px]">Automatik dari Backlog</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-800/60 p-2 rounded-xl border border-slate-700/60">
          <Layers size={16} className="text-amber-400 shrink-0" />
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase">Jumlah BTS</p>
            <p className="font-bold text-slate-100 text-[11px]">HI &amp; HII Backlog</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-800/60 p-2 rounded-xl border border-slate-700/60">
          <Weight size={16} className="text-emerald-400 shrink-0" />
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase">Berat Hasil (MT)</p>
            <p className="font-bold text-slate-100 text-[11px]">HI &amp; HII Data Hasil</p>
          </div>
        </div>
      </div>

      {/* KPI METRIC CARDS GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 dark:from-emerald-900/30 dark:to-emerald-950/20 border border-emerald-500/20 rounded-2xl p-3 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Ton / Pekerja</span>
            <TrendingUp size={14} />
          </div>
          <p className="text-lg font-black text-slate-800 dark:text-slate-100 font-display">
            {summary.avgMtPerPekerjaHari.toFixed(2)} <span className="text-[10px] font-normal text-slate-500">MT/pkr</span>
          </p>
          <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold">Purata {estateShortName}</span>
        </div>

        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 dark:from-blue-900/30 dark:to-blue-950/20 border border-blue-500/20 rounded-2xl p-3 shadow-sm">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">BTS / Pekerja</span>
            <Award size={14} />
          </div>
          <p className="text-lg font-black text-slate-800 dark:text-slate-100 font-display">
            {summary.avgBtsPerPekerjaHari.toFixed(0)} <span className="text-[10px] font-normal text-slate-500">bts/pkr</span>
          </p>
          <span className="text-[9px] text-blue-600 dark:text-blue-400 font-semibold">Kadar Tuai Harian</span>
        </div>

        <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 dark:from-amber-900/30 dark:to-amber-950/20 border border-amber-500/20 rounded-2xl p-3 shadow-sm">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Ha / Pekerja</span>
            <Layers size={14} />
          </div>
          <p className="text-lg font-black text-slate-800 dark:text-slate-100 font-display">
            {summary.avgHaPerPekerjaHari.toFixed(2)} <span className="text-[10px] font-normal text-slate-500">Ha/pkr</span>
          </p>
          <span className="text-[9px] text-amber-600 dark:text-amber-400 font-semibold">Liputan Kawasan</span>
        </div>

        <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 dark:from-purple-900/30 dark:to-purple-950/20 border border-purple-500/20 rounded-2xl p-3 shadow-sm">
          <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Pekerja (Backlog)</span>
            <Users size={14} />
          </div>
          <p className="text-lg font-black text-slate-800 dark:text-slate-100 font-display">
            {summary.totalPekerja} <span className="text-[10px] font-normal text-slate-500">orang</span>
          </p>
          <span className="text-[9px] text-purple-600 dark:text-purple-400 font-semibold">{computedRecords.length} Blok Bertugas</span>
        </div>

        <div className="bg-gradient-to-br from-teal-500/10 to-teal-600/5 dark:from-teal-900/30 dark:to-teal-950/20 border border-teal-500/20 rounded-2xl p-3 shadow-sm">
          <div className="flex items-center justify-between text-teal-600 dark:text-teal-400 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Purata ABW</span>
            <ShieldCheck size={14} />
          </div>
          <p className="text-lg font-black text-slate-800 dark:text-slate-100 font-display">
            {summary.overallAbw.toFixed(2)} <span className="text-[10px] font-normal text-slate-500">kg/bts</span>
          </p>
          <span className="text-[9px] text-teal-600 dark:text-teal-400 font-semibold">Berat Tandan</span>
        </div>

        <div className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 dark:from-indigo-900/30 dark:to-indigo-950/20 border border-indigo-500/20 rounded-2xl p-3 shadow-sm">
          <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Hasil (Data Hasil)</span>
            <FileSpreadsheet size={14} />
          </div>
          <p className="text-lg font-black text-slate-800 dark:text-slate-100 font-display">
            {(summary.totalBeratMtHII ?? summary.totalBeratMt ?? 0).toFixed(2)} <span className="text-[10px] font-normal text-slate-500">MT (HII)</span>
          </p>
          <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-semibold">{(summary.totalBtsHII ?? summary.totalBts ?? 0).toLocaleString()} BTS</span>
        </div>
      </div>

      {/* TOP & BOTTOM PRODUCTIVITY HIGHLIGHTS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Top 3 */}
        <div className="bg-white dark:bg-slate-900 border border-emerald-500/30 dark:border-emerald-800/50 rounded-2xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Award size={15} />
              <span>Top 3 Blok Paling Produktif ({estateShortName})</span>
            </span>
            <span className="text-[10px] text-slate-400">MT / Pekerja / Hari</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {summary.top3.map((b, i) => (
              <div key={b.blok} className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/40 rounded-xl p-2.5 text-center">
                <span className="text-lg">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                <p className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5">{b.displayCode}</p>
                <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{(b.mtPerPekerjaHariHII ?? b.mtPerPekerjaHari ?? 0).toFixed(2)} MT</p>
                <p className="text-[9px] text-slate-500 dark:text-slate-400">{b.bilPekerja} pkr • {b.bilHariKerja} hari • {(b.beratMtHII ?? b.beratMt ?? 0).toFixed(2)} MT</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom 3 */}
        <div className="bg-white dark:bg-slate-900 border border-rose-500/30 dark:border-rose-800/50 rounded-2xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle size={15} />
              <span>Bottom 3 Blok Memerlukan Pemantauan</span>
            </span>
            <span className="text-[10px] text-slate-400">MT / Pekerja / Hari</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {summary.bot3.map((b) => (
              <div key={b.blok} className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/50 dark:border-rose-900/40 rounded-xl p-2.5 text-center">
                <span className="text-lg">🔴</span>
                <p className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5">{b.displayCode}</p>
                <p className="text-sm font-black text-rose-600 dark:text-rose-400">{(b.mtPerPekerjaHariHII ?? b.mtPerPekerjaHari ?? 0).toFixed(2)} MT</p>
                <p className="text-[9px] text-slate-500 dark:text-slate-400">{b.bilPekerja} pkr • {b.bilHariKerja} hari • {(b.beratMtHII ?? b.beratMt ?? 0).toFixed(2)} MT</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={`Cari Blok (${isAdela ? 'cth. Blok 1, Blok 12' : 'cth. Blok 14, Lot Felda'})...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <Filter size={14} className="text-slate-400 shrink-0" />
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterPkt(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                filterPkt === tab.id
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN DATA TABLE */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-black border-b border-slate-200 dark:border-slate-700">
                <th rowSpan={2} className="py-3 px-2 text-center w-8">No</th>
                <th rowSpan={2} className="py-3 px-2">Sektor / PKT</th>
                <th rowSpan={2} className="py-3 px-2">Blok</th>
                <th rowSpan={2} className="py-3 px-2 text-right">Luas (Ha)</th>
                <th rowSpan={2} className="py-3 px-2 text-right bg-purple-50/50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300">
                  Bil. Pkr
                </th>
                <th rowSpan={2} className="py-3 px-2 text-center bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300">
                  Hari Kerja
                </th>
                <th colSpan={2} className="py-1.5 px-2 text-center bg-slate-200/50 dark:bg-slate-700/50 border-x border-slate-300 dark:border-slate-700 font-black">
                  Luas Kerja (Ha)
                </th>
                <th colSpan={2} className="py-1.5 px-2 text-center bg-amber-100/50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-x border-amber-200 dark:border-amber-800 font-black">
                  Jumlah BTS (Tandan)
                </th>
                <th colSpan={2} className="py-1.5 px-2 text-center bg-emerald-100/50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-x border-emerald-200 dark:border-emerald-800 font-black">
                  Berat (MT)
                </th>
                <th rowSpan={2} className="py-3 px-2 text-right font-black text-blue-600 dark:text-blue-400">BTS/Pkr/Hari</th>
                <th rowSpan={2} className="py-3 px-2 text-right font-black text-emerald-600 dark:text-emerald-400 bg-emerald-100/40 dark:bg-emerald-950/40">
                  MT/Pkr/Hari
                </th>
                <th rowSpan={2} className="py-3 px-2 text-right font-black text-amber-600 dark:text-amber-400">Ha/Pkr/Hari</th>
                <th rowSpan={2} className="py-3 px-2 text-right">ABW (kg)</th>
                <th rowSpan={2} className="py-3 px-2 text-center">Benchmark</th>
                <th rowSpan={2} className="py-3 px-2 text-center">Edit</th>
              </tr>
              <tr className="bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                <th className="py-1 px-2 text-center bg-slate-200/60 dark:bg-slate-700/70 border-r border-slate-300 dark:border-slate-700">HI</th>
                <th className="py-1 px-2 text-center bg-slate-300/60 dark:bg-slate-600/70 border-r border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-black">HII</th>

                <th className="py-1 px-2 text-center bg-amber-100/70 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-r border-amber-200 dark:border-amber-800">HI</th>
                <th className="py-1 px-2 text-center bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-100 border-r border-amber-300 dark:border-amber-800 font-black">HII</th>

                <th className="py-1 px-2 text-center bg-emerald-100/70 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-r border-emerald-200 dark:border-emerald-800">HI</th>
                <th className="py-1 px-2 text-center bg-emerald-200/80 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-100 border-r border-emerald-300 dark:border-emerald-800 font-black">HII</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-[11px]">
              {filteredRecords.length === 0 ? (
                <NoDataRow
                  colSpan={18}
                  message="Tiada rekod produktiviti dijumpai untuk carian atau pilihan ini."
                />
              ) : (
                activeGroups.map((group) => {
                  const groupRecords = filteredRecords.filter((r) => r.pkt === group.id);
                  if (groupRecords.length === 0) return null;

                  const sub = summary.byPkt[group.id] || summary.calcSubtotal(group.id);

                  return (
                    <React.Fragment key={group.id}>
                      {/* PERINGKAT SECTION BANNER */}
                      <tr className={`${group.headerBg} font-black text-xs border-y border-slate-300 dark:border-slate-700 shadow-inner`}>
                        <td colSpan={18} className="py-2.5 px-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{group.icon}</span>
                              <span className="text-sm font-black uppercase tracking-wider">{group.title}</span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/20 text-white font-bold">
                                {groupRecords.length} Blok
                              </span>
                            </div>
                            <div className={`flex flex-wrap items-center gap-3 text-[11px] font-semibold ${group.headerSub}`}>
                              <span>Luas: <strong className="text-white">{sub.subLuasBlok.toFixed(2)} Ha</strong></span>
                              <span>• Pekerja: <strong className="text-white">{sub.subPekerja} pkr</strong></span>
                              <span>• BTS (HII): <strong className="text-white">{sub.subBtsHII.toLocaleString()}</strong></span>
                              <span>• Berat (HII): <strong className="text-white">{sub.subMtHII.toFixed(2)} MT</strong></span>
                              <span>• Purata: <strong className="text-white">{sub.avgMtPkr.toFixed(2)} MT/pkr/hari</strong></span>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* BLOCK ROWS IN THIS PERINGKAT */}
                      {groupRecords.map((r, idx) => {
                        const isLF = r.blok === '88' || r.blok === '88F' || r.blok.includes('LF') || r.blok === '1F' || r.blok === '2F';

                        return (
                          <tr 
                            key={r.blok}
                            className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${
                              isLF ? 'bg-purple-50/30 dark:bg-purple-950/10' : ''
                            }`}
                          >
                            <td className="py-2.5 px-2 text-center text-slate-400 font-bold">{idx + 1}</td>
                            <td className="py-2.5 px-2">
                              <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold ${
                                r.pkt === '001' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                                r.pkt === '002' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' :
                                r.pkt === '003' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                                'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                              }`}>
                                {getPktShortBadge(r.pkt, activeEstate)}
                              </span>
                            </td>
                            <td className="py-2.5 px-2 font-black text-slate-800 dark:text-slate-100">
                              {r.displayCode}
                            </td>
                            <td className="py-2.5 px-2 text-right text-slate-600 dark:text-slate-400">{r.luasBlok.toFixed(2)}</td>

                            {/* Worker Count (Backlog) */}
                            <td className="py-2.5 px-2 text-right font-black text-purple-700 dark:text-purple-300 bg-purple-50/30 dark:bg-purple-950/10">
                              <div className="flex items-center justify-end gap-1">
                                <span>{r.bilPekerja}</span>
                                {r.isBacklogSynced && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500" title="Synced dari Laporan Backlog" />
                                )}
                              </div>
                            </td>

                            {/* Hari Kerja (Calculated from Dates) */}
                            <td className="py-2.5 px-2 text-center font-black text-blue-700 dark:text-blue-300 bg-blue-50/30 dark:bg-blue-950/10">
                              <span className="px-1.5 py-0.5 rounded-md bg-blue-100/60 dark:bg-blue-900/40">
                                {r.bilHariKerja} hari
                              </span>
                            </td>

                            {/* Luas Kerja HI & HII */}
                            <td className="py-2.5 px-2 text-right text-slate-600 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800">{r.luasKerjaHI.toFixed(1)}</td>
                            <td className="py-2.5 px-2 text-right font-bold text-slate-800 dark:text-slate-200 bg-slate-50/50 dark:bg-slate-800/30 border-r border-slate-200 dark:border-slate-700">{r.luasKerjaHII.toFixed(1)}</td>

                            {/* BTS HI & HII */}
                            <td className="py-2.5 px-2 text-right text-amber-700 dark:text-amber-300 border-r border-amber-100 dark:border-amber-900/40">{r.jumlahBtsHI.toLocaleString()}</td>
                            <td className="py-2.5 px-2 text-right font-black text-amber-800 dark:text-amber-200 bg-amber-50/40 dark:bg-amber-950/20 border-r border-amber-200 dark:border-amber-800">{r.jumlahBtsHII.toLocaleString()}</td>

                            {/* Berat MT HI & HII */}
                            <td className="py-2.5 px-2 text-right text-emerald-700 dark:text-emerald-300 border-r border-emerald-100 dark:border-emerald-900/40">{r.beratMtHI.toFixed(2)}</td>
                            <td className="py-2.5 px-2 text-right font-black text-emerald-800 dark:text-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20 border-r border-emerald-200 dark:border-emerald-800">
                              <div className="flex items-center justify-end gap-1">
                                <span>{r.beratMtHII.toFixed(2)}</span>
                                {r.isYieldSynced && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Synced dari Data Hasil" />
                                )}
                              </div>
                            </td>

                            {/* Derived Productivity Ratios */}
                            <td className="py-2.5 px-2 text-right font-black text-blue-600 dark:text-blue-400">
                              {r.btsPerPekerjaHari.toFixed(0)}
                            </td>
                            <td className="py-2.5 px-2 text-right font-black text-emerald-600 dark:text-emerald-400 text-xs bg-emerald-100/30 dark:bg-emerald-950/30">
                              {r.mtPerPekerjaHari.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-2 text-right font-black text-amber-600 dark:text-amber-400">
                              {r.haPerPekerjaHari.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-2 text-right text-slate-600 dark:text-slate-400 font-semibold">
                              {r.abwKg.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${r.benchmarkColor}`}>
                                {r.benchmark}
                              </span>
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <button
                                onClick={() => handleEditClick(r)}
                                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-all"
                                title="Kemaskini Rekod Blok"
                              >
                                <Edit3 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}

                      {/* SUBTOTAL ROW FOR THIS PERINGKAT */}
                      <tr className={`${group.subtotalBg} font-black text-[11px]`}>
                        <td colSpan={3} className={`py-2.5 px-2 text-right uppercase text-[10px] ${group.subtotalText}`}>
                          Subtotal {group.title}
                        </td>
                        <td className="py-2.5 px-2 text-right">{sub.subLuasBlok.toFixed(2)}</td>
                        <td className="py-2.5 px-2 text-right text-purple-700 dark:text-purple-300">{sub.subPekerja}</td>
                        <td className="py-2.5 px-2 text-center text-blue-700 dark:text-blue-300 font-bold">
                          {sub.subAvgHariKerja > 0 ? `${sub.subAvgHariKerja.toFixed(1)} hari` : '-'}
                        </td>
                        <td className="py-2.5 px-2 text-right">{sub.subLuasKerjaHI.toFixed(1)}</td>
                        <td className="py-2.5 px-2 text-right font-black">{sub.subLuasKerjaHII.toFixed(1)}</td>
                        <td className="py-2.5 px-2 text-right text-amber-700 dark:text-amber-300">{sub.subBtsHI.toLocaleString()}</td>
                        <td className="py-2.5 px-2 text-right text-amber-800 dark:text-amber-200 font-black">{sub.subBtsHII.toLocaleString()}</td>
                        <td className="py-2.5 px-2 text-right text-emerald-700 dark:text-emerald-300">{sub.subMtHI.toFixed(2)}</td>
                        <td className="py-2.5 px-2 text-right text-emerald-800 dark:text-emerald-200 font-black">{sub.subMtHII.toFixed(2)}</td>
                        <td className="py-2.5 px-2 text-right text-blue-700 dark:text-blue-300">{sub.avgBtsPkr.toFixed(0)}</td>
                        <td className="py-2.5 px-2 text-right text-emerald-700 dark:text-emerald-300 font-black text-xs bg-emerald-100/40 dark:bg-emerald-950/40">{sub.avgMtPkr.toFixed(2)}</td>
                        <td className="py-2.5 px-2 text-right text-amber-700 dark:text-amber-300">{sub.avgHaPkr.toFixed(2)}</td>
                        <td className="py-2.5 px-2 text-right">{sub.abw.toFixed(2)}</td>
                        <td colSpan={2} className="py-2.5 px-2 text-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          Subtotal {group.code}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>

            {/* GRAND TOTAL FOOTER */}
            <tfoot className="border-t-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 font-black text-[11px]">
              <tr className="bg-emerald-900 text-white text-xs">
                <td colSpan={3} className="py-3 px-2 text-right uppercase tracking-wider font-black">
                  JUMLAH KESELURUHAN {estateShortName.toUpperCase()}
                </td>
                <td className="py-3 px-2 text-right font-black">{summary.totalLuasBlok.toFixed(2)}</td>
                <td className="py-3 px-2 text-right font-black text-purple-300">{summary.totalPekerja}</td>
                <td className="py-3 px-2 text-center text-blue-300 font-bold">
                  {summary.avgHariKerja > 0 ? `${summary.avgHariKerja.toFixed(1)} h` : '-'}
                </td>
                <td className="py-3 px-2 text-right font-medium text-slate-200">{summary.totalLuasKerjaHI.toFixed(1)}</td>
                <td className="py-3 px-2 text-right font-black text-white">{summary.totalLuasKerjaHII.toFixed(1)}</td>
                <td className="py-3 px-2 text-right font-medium text-amber-200">{summary.totalBtsHI.toLocaleString()}</td>
                <td className="py-3 px-2 text-right font-black text-amber-300">{summary.totalBtsHII.toLocaleString()}</td>
                <td className="py-3 px-2 text-right font-medium text-emerald-200">{summary.totalBeratMtHI.toFixed(2)}</td>
                <td className="py-3 px-2 text-right font-black text-emerald-300">{summary.totalBeratMtHII.toFixed(2)}</td>
                <td className="py-3 px-2 text-right font-black text-blue-200">{summary.avgBtsPerPekerjaHari.toFixed(0)}</td>
                <td className="py-3 px-2 text-right font-black text-emerald-200 text-sm bg-emerald-800/80">{summary.avgMtPerPekerjaHari.toFixed(2)}</td>
                <td className="py-3 px-2 text-right font-black text-amber-200">{summary.avgHaPerPekerjaHari.toFixed(2)}</td>
                <td className="py-3 px-2 text-right font-black">{summary.overallAbw.toFixed(2)}</td>
                <td colSpan={2} className="py-3 px-2 text-center text-[10px] font-black uppercase tracking-wider text-emerald-300">
                  {summary.avgMtPerPekerjaHari >= 2.0 ? 'Cemerlang' : 'Sederhana'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* EDIT MODAL OVERRIDE */}
      {isModalOpen && editingBlock && (
        <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-4 sm:p-5 shadow-2xl animate-in fade-in zoom-in-95 my-auto max-h-[90dvh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                  Kemaskini Backlog &amp; Produktiviti — {editingBlock.displayCode} ({estateShortName})
                </h3>
                <p className="text-xs text-slate-500">
                  Mengemaskini pangkalan data Laporan Backlog bagi tarikh {formattedDisplayDate}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 py-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Bilangan Pekerja (Laporan Backlog)
                </label>
                <input
                  type="number"
                  min="1"
                  value={editingBlock.bilPekerja}
                  onChange={(e) => setEditingBlock({ ...editingBlock, bilPekerja: Math.max(1, parseInt(e.target.value) || 0) })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Jumlah BTS / Tandan (Backlog)
                </label>
                <input
                  type="number"
                  min="0"
                  value={editingBlock.jumlahBts}
                  onChange={(e) => setEditingBlock({ ...editingBlock, jumlahBts: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Luas Kerja (Ha)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={editingBlock.luasKerja}
                  onChange={(e) => setEditingBlock({ ...editingBlock, luasKerja: Math.max(0, parseFloat(e.target.value) || 0) })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Berat Hasil (MT - Data Hasil)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editingBlock.beratMt}
                  onChange={(e) => setEditingBlock({ ...editingBlock, beratMt: Math.max(0, parseFloat(e.target.value) || 0) })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-emerald-600 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500 font-black text-sm"
                />
              </div>
            </div>

            {/* Preview derived formulas */}
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 mb-4 text-xs space-y-1 text-slate-600 dark:text-slate-300">
              <div className="flex justify-between">
                <span>Nisbah BTS / Pekerja / Hari:</span>
                <span className="font-bold text-blue-600">
                  {editingBlock.bilPekerja > 0 ? (editingBlock.jumlahBts / (editingBlock.bilPekerja * editingBlock.bilHariKerja)).toFixed(0) : '0'} bts
                </span>
              </div>
              <div className="flex justify-between">
                <span>Produktiviti MT / Pekerja / Hari:</span>
                <span className="font-bold text-emerald-600">
                  {editingBlock.bilPekerja > 0 ? (editingBlock.beratMt / (editingBlock.bilPekerja * editingBlock.bilHariKerja)).toFixed(2) : '0.00'} MT
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleSaveModal}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
              >
                <Check size={14} />
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const LaporanProduktivitiView = React.memo(LaporanProduktivitiViewComponent);
