import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ClipboardCheck, Plus, Trash2, Share2, Copy, Check, Sparkles, 
  Layers, MessageSquare, History, FileText, Send, AlertCircle, ChevronRight, Edit3, Save, Database,
  ChevronDown, Search, Download, BarChart3, SlidersHorizontal, Calendar, Volume2, VolumeX, RefreshCw,
  Boxes, Award, TrendingUp, TrendingDown, Truck, Info, Eye, ExternalLink
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { 
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell 
} from 'recharts';
import { PlatformGradingData, BlockGradingSession, normalizeLorryNo } from '../types/penggredan';
import { StepperControl } from './StepperControl';
import { penggredanService } from '../services/penggredanService';
import { playSound, isSoundEnabled, setSoundEnabled } from '../../../utils/sound';
import { ESTATE_CHANGED_EVENT, getActiveEstateId } from '../../../utils/estateContext';
import { getEstateConfig, normalizeEstateId } from '../../../config/estateRegistry';
import { evaluateFieldGrade } from '../../../utils/gradingRules';
import { GradingTaskView } from './GradingTaskView';
import { gradingTaskService } from '../services/gradingTaskService';
import type { GradingTask } from '../types/gradingTask';

export const ESTATE_LORRIES: Record<string, string[]> = {
  FPM_ADELA: [
    'BLS 4830', 'CCA 7297', 'CCR 1449', 'JBV 7370', 'JCM 3007', 'JES 4893', 
    'JFL 1886', 'JGG 6366', 'JGG 8910', 'JJV 681', 'JLF 7922', 'JLO 5089', 
    'JLQ 625', 'JNA 5540', 'JPM 1902', 'JQP 7697', 'JQR 8823', 'JRM 970', 
    'JSD 2291', 'JTG 4421', 'JTK 9031'
  ],
  FPM_TUNGGAL: [
    'CCR 1449', 'DLH 7442', 'JEH 243', 'JES 4893', 'JFL 1886', 'JGK 1917', 
    'JGS 85', 'JGX 7725', 'JGX 9838', 'JJT 4167', 'JKK 7725', 'JKK 9822', 
    'JKP 6959', 'JKX 7725', 'JLA 2612', 'JLF 9002', 'JLH 7442', 'JLP 6966', 
    'JNV 256', 'JSS 2776', 'JTH 1263', 'SD 1351E', 'VWR 4152', 'WHK 7221', 
    'WHK 7271', 'WWR 4152', 'WYT 9162'
  ],
  FPM_KLEDANG: [
    'JLF 7922', 'JGK 1917', 'JNA 5540', 'JTG 4421', 'JTK 9031', 'WWR 4152', 'WYT 9162'
  ],
  FPM_SENING: [
    'JES 4893', 'JGG 6366', 'JPM 1902', 'JQR 8823', 'JSD 2291', 'WHK 7221'
  ]
};

const AVAILABLE_BLOCKS = [
  // PERINGKAT 1A
  { value: '01/01', label: '01/01 (Blok 1)', group: 'PERINGKAT 1A' },
  { value: '01/02', label: '01/02 (Blok 2)', group: 'PERINGKAT 1A' },
  { value: '01/03', label: '01/03 (Blok 3)', group: 'PERINGKAT 1A' },
  { value: '01/05', label: '01/05 (Blok 5)', group: 'PERINGKAT 1A' },
  { value: '01/06', label: '01/06 (Blok 6)', group: 'PERINGKAT 1A' },
  { value: '01/07', label: '01/07 (Blok 7)', group: 'PERINGKAT 1A' },

  // PERINGKAT 1B
  { value: '01/04', label: '01/04 (Blok 4)', group: 'PERINGKAT 1B' },
  { value: '01/08', label: '01/08 (Blok 8)', group: 'PERINGKAT 1B' },
  { value: '01/09', label: '01/09 (Blok 9)', group: 'PERINGKAT 1B' },
  { value: '01/10', label: '01/10 (Blok 10)', group: 'PERINGKAT 1B' },
  { value: '01/11', label: '01/11 (Blok 11)', group: 'PERINGKAT 1B' },
  { value: '01/12', label: '01/12 (Blok 12)', group: 'PERINGKAT 1B' },

  // PERINGKAT 1C
  { value: '01/13', label: '01/13 (Blok 13)', group: 'PERINGKAT 1C' },
  { value: '01/14', label: '01/14 (Blok 14)', group: 'PERINGKAT 1C' },
  { value: '01/15', label: '01/15 (Blok 15)', group: 'PERINGKAT 1C' },
  { value: '01/16', label: '01/16 (Blok 16)', group: 'PERINGKAT 1C' },
  { value: '01/17', label: '01/17 (Blok 17)', group: 'PERINGKAT 1C' },

  // PERINGKAT 2
  { value: '02/18', label: '02/18 (Blok 18)', group: 'PERINGKAT 2' },
  { value: '02/19', label: '02/19 (Blok 19)', group: 'PERINGKAT 2' },
  { value: '02/20', label: '02/20 (Blok 20)', group: 'PERINGKAT 2' },
  { value: '02/21', label: '02/21 (Blok 21)', group: 'PERINGKAT 2' },
  { value: '02/22', label: '02/22 (Blok 22)', group: 'PERINGKAT 2' },

  // LOT FELDA
  { value: 'LF PKT 1', label: 'LF PKT 1', group: 'LOT FELDA' },
  { value: 'LF PKT 2', label: 'LF PKT 2', group: 'LOT FELDA' },
];

export const getAvailableBlocksForEstate = (estateId: string) => {
  const norm = normalizeEstateId(estateId);
  if (norm === 'FPM_ADELA') {
    return [
      // PERINGKAT 1
      { value: '01/01', label: '01/01 (Blok 1)', group: 'PERINGKAT 1' },
      { value: '01/02', label: '01/02 (Blok 2)', group: 'PERINGKAT 1' },
      { value: '01/03', label: '01/03 (Blok 3)', group: 'PERINGKAT 1' },
      { value: '01/04', label: '01/04 (Blok 4)', group: 'PERINGKAT 1' },
      { value: '01/05', label: '01/05 (Blok 5)', group: 'PERINGKAT 1' },
      { value: '01/06', label: '01/06 (Blok 6)', group: 'PERINGKAT 1' },
      { value: '01/07', label: '01/07 (Blok 7)', group: 'PERINGKAT 1' },
      { value: '01/08', label: '01/08 (Blok 8)', group: 'PERINGKAT 1' },
      { value: '01/09', label: '01/09 (Blok 9)', group: 'PERINGKAT 1' },
      { value: '01/10', label: '01/10 (Blok 10)', group: 'PERINGKAT 1' },
      { value: '01/11', label: '01/11 (Blok 11)', group: 'PERINGKAT 1' },
      // PERINGKAT 2
      { value: '02/12', label: '02/12 (Blok 12 / Pkt 2 Blok 1)', group: 'PERINGKAT 2' },
      { value: '02/13', label: '02/13 (Blok 13 / Pkt 2 Blok 2)', group: 'PERINGKAT 2' },
      { value: '02/14', label: '02/14 (Blok 14 / Pkt 2 Blok 3)', group: 'PERINGKAT 2' },
      { value: '02/15', label: '02/15 (Blok 15 / Pkt 2 Blok 4)', group: 'PERINGKAT 2' },
      { value: '02/16', label: '02/16 (Blok 16 / Pkt 2 Blok 5)', group: 'PERINGKAT 2' },
      { value: '02/17', label: '02/17 (Blok 17 / Pkt 2 Blok 6)', group: 'PERINGKAT 2' },
      // LOT FELDA
      { value: '1F', label: '1F (Lot Felda 1)', group: 'LOT FELDA' },
      { value: '2F', label: '2F (Lot Felda 2)', group: 'LOT FELDA' },
      // LOT TAMBAHAN
      { value: '125Y', label: '125Y (Lot Tambahan)', group: 'LOT TAMBAHAN' },
      { value: '128Y', label: '128Y (Lot Tambahan)', group: 'LOT TAMBAHAN' },
      { value: '121V', label: '121V (Lot Tambahan)', group: 'LOT TAMBAHAN' },
    ];
  }
  return AVAILABLE_BLOCKS;
};

const DEFAULT_LORRIES = [
  'CCR 1449', 'JEH 243', 'JGK 1917', 'JGS 85', 'JGX 7725', 'JGX 9838', 
  'JJT 4167', 'JKK 7725', 'JKK 9822', 'JKP 6959', 'JKX 7725', 'JLH 7442', 
  'JNV 256', 'WHK 7221', 'WWR 4152', 'WYT 9162'
];

interface PenggredanViewProps {
  onShowToast?: (type: 'success' | 'error', message: string) => void;
}

export const PenggredanView: React.FC<PenggredanViewProps> = ({ onShowToast }) => {
  // Active Tab inside Penggredan Submodule
  const [activeSubTab, setActiveSubTab] = useState<'borang' | 'grading_task' | 'analitik_semua' | 'rumusan_blok' | 'sejarah'>('borang');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [activeGradingTask, setActiveGradingTask] = useState<GradingTask | null>(null);
  const [taskRefreshKey, setTaskRefreshKey] = useState(0);

  // States for Rumusan Setiap Blok
  const [blockCardSearch, setBlockCardSearch] = useState<string>('');
  const [copiedBlockId, setCopiedBlockId] = useState<string | null>(null);
  const [expandedBlockSessionsId, setExpandedBlockSessionsId] = useState<string | null>(null);

  // Today's formatted date default e.g. 05/08/26
  const getFormattedTodayDate = () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yy = String(today.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  };

  const formatBlokDisplay = (val?: string) => {
    if (!val) return '';
    if (val.includes('/') || val.startsWith('Blok') || val.startsWith('LF') || val.startsWith('Lot')) {
      return val;
    }
    return `Blok ${val}`;
  };

  const [activeEstateId, setActiveEstateId] = useState<string>(() => getActiveEstateId());
  const activeBlocks = useMemo(() => getAvailableBlocksForEstate(activeEstateId), [activeEstateId]);

  // Header Info for Current Session
  const [sessionHeader, setSessionHeader] = useState(() => {
    const estateId = getActiveEstateId();
    const config = getEstateConfig(estateId);
    const norm = normalizeEstateId(estateId);
    const lorryList = ESTATE_LORRIES[norm] || DEFAULT_LORRIES;
    return {
      tajuk: '*JPPK KS ADELA*',
      program: 'Task Force Grading',
      jenisGrading: 'Grading Di ladang',
      tarikh: getFormattedTodayDate(),
      ladang: config.name,
      peringkatBlok: norm === 'FPM_ADELA' ? '01/01' : '01/02',
      noLori: lorryList[0] || 'JGK 1917',
      namaPenggred: 'GIANTARA'
    };
  });

  // Active session ID to ensure consistent upsert across platform additions and final save
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => `session-${Date.now()}`);

  // Current Platform Input Form State
  const [platformNo, setPlatformNo] = useState<number>(1);
  const [platformForm, setPlatformForm] = useState<PlatformGradingData>({
    id: 'p-1',
    platformNo: 1,
    tandanDiGred: 0,
    tandanDiTinggal: 0,
    tandanDiBawa: 0,
    rejectMuda: 0,
    rejectMudaUnit: 'T',
    rejectPeram: 0,
    rejectPeramUnit: 'T',
    penaltiMengkal: 0,
    penaltiMengkalUnit: 'T',
    penaltiBusuk: 0,
    penaltiBusukUnit: 'T',
    penaltiKosong: 0,
    penaltiKosongUnit: 'T',
    kotor: 0,
    lama: 0,
    dura: 0,
    tangkaiPanjang: 0,
    masak: 0,
    seranganTikus: 0
  });

  // Submitted platforms for current session
  const [submittedPlatforms, setSubmittedPlatforms] = useState<PlatformGradingData[]>([]);

  // History sessions list
  const [historySessions, setHistorySessions] = useState<BlockGradingSession[]>([]);

  // Group history sessions by tarikh
  const groupedHistorySessions = useMemo<Record<string, BlockGradingSession[]>>(() => {
    const groups: Record<string, BlockGradingSession[]> = {};
    historySessions.forEach((session) => {
      const dateKey = session.tarikh || 'Tiada Tarikh';
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(session);
    });
    return groups;
  }, [historySessions]);

  // Analytics & Rumusan States
  const [selectedBlokFilter, setSelectedBlokFilter] = useState<string>('ALL');
  const [selectedBulanFilter, setSelectedBulanFilter] = useState<string>('ALL');
  const [aggregationMode, setAggregationMode] = useState<'hari' | 'bulan' | 'blok'>('hari');

  // Copy state
  const [isCopied, setIsCopied] = useState(false);
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled());
  const [previewFontSize, setPreviewFontSize] = useState<'normal' | 'large'>('large');

  const handleToggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) playSound('click');
  };

  // Block dropdown states
  const [showBlockDropdown, setShowBlockDropdown] = useState(false);
  const [blockSearchQuery, setBlockSearchQuery] = useState('');

  // Lorry dropdown states
  const [showLorryDropdown, setShowLorryDropdown] = useState(false);
  const [lorrySearchQuery, setLorrySearchQuery] = useState('');

  // Dynamic list of unique lorries combining defaults and actual history (strictly normalized & deduplicated)
  const uniqueLorryList = useMemo(() => {
    const set = new Set<string>();
    const norm = normalizeEstateId(activeEstateId);
    const defaultList = ESTATE_LORRIES[norm] || DEFAULT_LORRIES;

    defaultList.forEach(lorry => {
      const normL = normalizeLorryNo(lorry);
      if (normL && !normL.includes('TEST')) {
        set.add(normL);
      }
    });

    historySessions.forEach(session => {
      if (session.noLori) {
        const normL = normalizeLorryNo(session.noLori);
        if (normL && !normL.includes('TEST')) {
          set.add(normL);
        }
      }
    });

    return Array.from(set).sort();
  }, [activeEstateId, historySessions]);

  // Load history from Supabase / localStorage on mount and on estate change
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setIsLoadingHistory(true);
    try {
      const sessions = await penggredanService.getSessions();
      setHistorySessions(sessions);
    } catch (e) {
      console.error("Gagal membaca rekod sejarah penggredan:", e);
    } finally {
      if (!silent) setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    const handleEstateChange = (e?: any) => {
      const newEstateId = e?.detail?.estateId || getActiveEstateId();
      setActiveEstateId(newEstateId);
      const newConfig = getEstateConfig(newEstateId);
      const norm = normalizeEstateId(newEstateId);
      const lorryList = ESTATE_LORRIES[norm] || DEFAULT_LORRIES;
      setSessionHeader(prev => ({
        ...prev,
        tajuk: '*JPPK KS ADELA*',
        ladang: newConfig.name,
        peringkatBlok: norm === 'FPM_ADELA' ? '01/01' : (prev.peringkatBlok || '01/02'),
        noLori: lorryList.includes(prev.noLori) ? prev.noLori : (lorryList[0] || prev.noLori)
      }));
      loadData();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData(true);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
        window.removeEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [loadData]);

  // Auto-poll every 12 seconds when visible so grading entries, updates, and deletions from other devices sync automatically
  useEffect(() => {
    loadData(true);
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadData(true);
      }
    }, 12000);
    return () => clearInterval(timer);
  }, [activeSubTab, loadData]);

  // Helper to parse Tarikh string (e.g. "05/08/26" or "05/08/2026")
  const parseSessionDate = (tarikhStr: string) => {
    if (!tarikhStr) return { day: '', month: 'Semua', monthRaw: 'Semua', year: '2026' };
    const parts = tarikhStr.split('/');
    if (parts.length < 3) return { day: tarikhStr, month: 'Semua', monthRaw: 'Semua', year: '2026' };
    const day = parts[0];
    const monthNum = parts[1];
    let year = parts[2];
    if (year.length === 2) year = '20' + year;
    
    const monthNames: Record<string, string> = {
      '01': 'Januari', '02': 'Februari', '03': 'Mac', '04': 'April',
      '05': 'Mei', '06': 'Jun', '07': 'Julai', '08': 'Ogos',
      '09': 'September', '10': 'Oktober', '11': 'November', '12': 'Disember'
    };
    const monthLabel = monthNames[monthNum] || `Bulan ${monthNum}`;
    return {
      day: tarikhStr,
      month: `${monthLabel} ${year}`,
      monthRaw: `${monthNum}/${year.slice(-2)}`,
      year
    };
  };

  // Unique Blocks & Months for Filter dropdowns
  const filterOptions = useMemo(() => {
    const blocksSet = new Set<string>();
    const monthsSet = new Set<string>();
    
    historySessions.forEach(session => {
      if (session.peringkatBlok) {
        blocksSet.add(session.peringkatBlok);
      }
      const parsed = parseSessionDate(session.tarikh);
      if (parsed.month) {
        monthsSet.add(parsed.month);
      }
    });
    
    return {
      blocks: Array.from(blocksSet).sort(),
      months: Array.from(monthsSet).sort()
    };
  }, [historySessions]);

  // Filter sessions based on active filter choices
  const filteredSessions = useMemo(() => {
    return historySessions.filter(session => {
      const matchBlok = selectedBlokFilter === 'ALL' || session.peringkatBlok === selectedBlokFilter;
      const parsedDate = parseSessionDate(session.tarikh);
      const matchBulan = selectedBulanFilter === 'ALL' || parsedDate.month === selectedBulanFilter;
      return matchBlok && matchBulan;
    });
  }, [historySessions, selectedBlokFilter, selectedBulanFilter]);

  // Aggregated data by Day
  const dailyData = useMemo(() => {
    const map: Record<string, any> = {};
    filteredSessions.forEach(session => {
      const key = `${session.tarikh}|||${session.peringkatBlok}`;
      if (!map[key]) {
        map[key] = {
          id: key,
          tarikh: session.tarikh,
          peringkatBlok: session.peringkatBlok,
          platformCount: 0,
          tandanDiGred: 0,
          tandanDiTinggal: 0,
          tandanDiBawa: 0,
          rejectMuda: 0,
          rejectPeram: 0,
          penaltiMengkal: 0,
          penaltiBusuk: 0,
          penaltiKosong: 0,
          kotor: 0,
          lama: 0,
          dura: 0,
          tangkaiPanjang: 0,
          masak: 0,
          seranganTikus: 0,
          loriList: new Set<string>(),
          penggredList: new Set<string>()
        };
      }
      
      if (session.noLori) map[key].loriList.add(session.noLori);
      if (session.namaPenggred) map[key].penggredList.add(session.namaPenggred);
      
      session.platforms.forEach(p => {
        map[key].platformCount += 1;
        map[key].tandanDiGred += Number(p.tandanDiGred || 0);
        map[key].tandanDiTinggal += Number(p.tandanDiTinggal || 0);
        map[key].tandanDiBawa += Number(p.tandanDiBawa || 0);
        map[key].rejectMuda += Number(p.rejectMuda || 0);
        map[key].rejectPeram += Number(p.rejectPeram || 0);
        map[key].penaltiMengkal += Number(p.penaltiMengkal || 0);
        map[key].penaltiBusuk += Number(p.penaltiBusuk || 0);
        map[key].penaltiKosong += Number(p.penaltiKosong || 0);
        map[key].kotor += Number(p.kotor || 0);
        map[key].lama += Number(p.lama || 0);
        map[key].dura += Number(p.dura || 0);
        map[key].tangkaiPanjang += Number(p.tangkaiPanjang || 0);
        map[key].masak += Number(p.masak || 0);
        map[key].seranganTikus += Number(p.seranganTikus || 0);
      });
    });

    return Object.values(map).map(item => ({
      ...item,
      lori: Array.from(item.loriList).join(', '),
      penggred: Array.from(item.penggredList).join(', ')
    })).sort((a, b) => {
      const parseDateStr = (s: string) => {
        const parts = s.split('/');
        if (parts.length < 3) return 0;
        return new Date(2000 + Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
      };
      return parseDateStr(b.tarikh) - parseDateStr(a.tarikh);
    });
  }, [filteredSessions]);

  // Aggregated data by Month
  const monthlyData = useMemo(() => {
    const map: Record<string, any> = {};
    filteredSessions.forEach(session => {
      const parsedDate = parseSessionDate(session.tarikh);
      const key = `${parsedDate.month}|||${session.peringkatBlok}`;
      if (!map[key]) {
        map[key] = {
          id: key,
          bulan: parsedDate.month,
          peringkatBlok: session.peringkatBlok,
          platformCount: 0,
          tandanDiGred: 0,
          tandanDiTinggal: 0,
          tandanDiBawa: 0,
          rejectMuda: 0,
          rejectPeram: 0,
          penaltiMengkal: 0,
          penaltiBusuk: 0,
          penaltiKosong: 0,
          kotor: 0,
          lama: 0,
          dura: 0,
          tangkaiPanjang: 0,
          masak: 0,
          seranganTikus: 0,
          loriList: new Set<string>(),
          penggredList: new Set<string>()
        };
      }
      
      if (session.noLori) map[key].loriList.add(session.noLori);
      if (session.namaPenggred) map[key].penggredList.add(session.namaPenggred);
      
      session.platforms.forEach(p => {
        map[key].platformCount += 1;
        map[key].tandanDiGred += Number(p.tandanDiGred || 0);
        map[key].tandanDiTinggal += Number(p.tandanDiTinggal || 0);
        map[key].tandanDiBawa += Number(p.tandanDiBawa || 0);
        map[key].rejectMuda += Number(p.rejectMuda || 0);
        map[key].rejectPeram += Number(p.rejectPeram || 0);
        map[key].penaltiMengkal += Number(p.penaltiMengkal || 0);
        map[key].penaltiBusuk += Number(p.penaltiBusuk || 0);
        map[key].penaltiKosong += Number(p.penaltiKosong || 0);
        map[key].kotor += Number(p.kotor || 0);
        map[key].lama += Number(p.lama || 0);
        map[key].dura += Number(p.dura || 0);
        map[key].tangkaiPanjang += Number(p.tangkaiPanjang || 0);
        map[key].masak += Number(p.masak || 0);
        map[key].seranganTikus += Number(p.seranganTikus || 0);
      });
    });

    return Object.values(map).map(item => ({
      ...item,
      lori: Array.from(item.loriList).join(', '),
      penggred: Array.from(item.penggredList).join(', ')
    })).sort((a, b) => a.bulan.localeCompare(b.bulan));
  }, [filteredSessions]);

  // Aggregated data by Block (Rumusan Mengikut Blok)
  const blockData = useMemo(() => {
    const map: Record<string, any> = {};
    filteredSessions.forEach(session => {
      const key = session.peringkatBlok || 'Tanpa Blok';
      if (!map[key]) {
        map[key] = {
          id: key,
          peringkatBlok: key,
          sessionCount: 0,
          platformCount: 0,
          tandanDiGred: 0,
          tandanDiTinggal: 0,
          tandanDiBawa: 0,
          rejectMuda: 0,
          rejectPeram: 0,
          penaltiMengkal: 0,
          penaltiBusuk: 0,
          penaltiKosong: 0,
          kotor: 0,
          lama: 0,
          dura: 0,
          tangkaiPanjang: 0,
          masak: 0,
          seranganTikus: 0,
          datesList: new Set<string>(),
          loriList: new Set<string>(),
          penggredList: new Set<string>(),
          sessions: [] as BlockGradingSession[]
        };
      }
      
      map[key].sessionCount += 1;
      map[key].sessions.push(session);
      if (session.tarikh) map[key].datesList.add(session.tarikh);
      if (session.noLori) map[key].loriList.add(session.noLori);
      if (session.namaPenggred) map[key].penggredList.add(session.namaPenggred);
      
      session.platforms.forEach(p => {
        map[key].platformCount += 1;
        map[key].tandanDiGred += Number(p.tandanDiGred || 0);
        map[key].tandanDiTinggal += Number(p.tandanDiTinggal || 0);
        map[key].tandanDiBawa += Number(p.tandanDiBawa || 0);
        map[key].rejectMuda += Number(p.rejectMuda || 0);
        map[key].rejectPeram += Number(p.rejectPeram || 0);
        map[key].penaltiMengkal += Number(p.penaltiMengkal || 0);
        map[key].penaltiBusuk += Number(p.penaltiBusuk || 0);
        map[key].penaltiKosong += Number(p.penaltiKosong || 0);
        map[key].kotor += Number(p.kotor || 0);
        map[key].lama += Number(p.lama || 0);
        map[key].dura += Number(p.dura || 0);
        map[key].tangkaiPanjang += Number(p.tangkaiPanjang || 0);
        map[key].masak += Number(p.masak || 0);
        map[key].seranganTikus += Number(p.seranganTikus || 0);
      });
    });

    return Object.values(map).map(item => {
      const totalGred = Number(item.tandanDiGred) || 0;
      const fieldGrade = evaluateFieldGrade(totalGred, item.tandanDiTinggal, item.masak);
      const rejectPct = fieldGrade.rejectPct;
      const masakPct = fieldGrade.masakPct;
      const mengkalPct = totalGred ? (item.penaltiMengkal / totalGred) * 100 : 0;

      return {
        ...item,
        totalDates: item.datesList.size,
        lori: Array.from(item.loriList).join(', '),
        penggred: Array.from(item.penggredList).join(', '),
        rejectPct,
        masakPct,
        mengkalPct,
        qualityGrade: fieldGrade.grade,
        qualityLabel: fieldGrade.label,
        badgeTheme: fieldGrade.badgeTheme
      };
    }).sort((a, b) => a.peringkatBlok.localeCompare(b.peringkatBlok));
  }, [filteredSessions]);

  // Overall stats for KPIs
  const analyticsStats = useMemo(() => {
    let platformCount = 0;
    let tandanDiGred = 0;
    let tandanDiTinggal = 0;
    let tandanDiBawa = 0;
    let rejectMuda = 0;
    let rejectPeram = 0;
    let penaltiMengkal = 0;
    let penaltiBusuk = 0;
    let penaltiKosong = 0;
    let kotor = 0;
    let lama = 0;
    let dura = 0;
    let tangkaiPanjang = 0;
    let masak = 0;
    let seranganTikus = 0;
    
    filteredSessions.forEach(session => {
      session.platforms.forEach(p => {
        platformCount += 1;
        tandanDiGred += Number(p.tandanDiGred || 0);
        tandanDiTinggal += Number(p.tandanDiTinggal || 0);
        tandanDiBawa += Number(p.tandanDiBawa || 0);
        rejectMuda += Number(p.rejectMuda || 0);
        rejectPeram += Number(p.rejectPeram || 0);
        penaltiMengkal += Number(p.penaltiMengkal || 0);
        penaltiBusuk += Number(p.penaltiBusuk || 0);
        penaltiKosong += Number(p.penaltiKosong || 0);
        kotor += Number(p.kotor || 0);
        lama += Number(p.lama || 0);
        dura += Number(p.dura || 0);
        tangkaiPanjang += Number(p.tangkaiPanjang || 0);
        masak += Number(p.masak || 0);
        seranganTikus += Number(p.seranganTikus || 0);
      });
    });
    
    const totalGred = tandanDiGred || 1;
    const pctMasak = (masak / totalGred) * 100;
    const pctTinggal = (tandanDiTinggal / totalGred) * 100;
    const pctBawa = (tandanDiBawa / totalGred) * 100;
    const pctMuda = (rejectMuda / totalGred) * 100;
    const pctPeram = (rejectPeram / totalGred) * 100;
    const pctMengkal = (penaltiMengkal / totalGred) * 100;
    const pctBusuk = (penaltiBusuk / totalGred) * 100;
    const pctKosong = (penaltiKosong / totalGred) * 100;
    const pctKotor = (kotor / totalGred) * 100;
    const pctLama = (lama / totalGred) * 100;
    const pctDura = (dura / totalGred) * 100;
    const pctTangkaiPanjang = (tangkaiPanjang / totalGred) * 100;
    const pctSeranganTikus = (seranganTikus / totalGred) * 100;
    
    return {
      platformCount,
      tandanDiGred,
      tandanDiTinggal,
      tandanDiBawa,
      rejectMuda,
      rejectPeram,
      penaltiMengkal,
      penaltiBusuk,
      penaltiKosong,
      kotor,
      lama,
      dura,
      tangkaiPanjang,
      masak,
      seranganTikus,
      pctMasak,
      pctTinggal,
      pctBawa,
      pctMuda,
      pctPeram,
      pctMengkal,
      pctBusuk,
      pctKosong,
      pctKotor,
      pctLama,
      pctDura,
      pctTangkaiPanjang,
      pctSeranganTikus
    };
  }, [filteredSessions]);

  // Recharts: Trend Kualiti Over Time (by Day, Month or Block)
  const trendChartData = useMemo(() => {
    let dataList: any[] = [];
    if (aggregationMode === 'hari') {
      dataList = dailyData;
    } else if (aggregationMode === 'bulan') {
      dataList = monthlyData;
    } else {
      dataList = blockData;
    }

    return [...dataList].reverse().slice(-10).map(item => {
      let label = '';
      if (aggregationMode === 'hari') {
        label = `${item.tarikh} (B${item.peringkatBlok})`;
      } else if (aggregationMode === 'bulan') {
        label = `${item.bulan} (B${item.peringkatBlok})`;
      } else {
        label = `Blok ${item.peringkatBlok}`;
      }

      const total = Number(item.tandanDiGred) || 1;
      return {
        label,
        'Masak (%)': Number(((item.masak / total) * 100).toFixed(1)),
        'Tinggal (%)': Number(((item.tandanDiTinggal / total) * 100).toFixed(1)),
        'Muda (%)': Number(((item.rejectMuda / total) * 100).toFixed(1)),
        'Peram (%)': Number(((item.rejectPeram / total) * 100).toFixed(1)),
        'Mengkal (%)': Number(((item.penaltiMengkal / total) * 100).toFixed(1)),
        'T.Panjang (%)': Number(((item.tangkaiPanjang / total) * 100).toFixed(1)),
        'Lama (%)': Number(((item.lama / total) * 100).toFixed(1)),
        'Busuk (%)': Number(((item.penaltiBusuk / total) * 100).toFixed(1)),
      };
    });
  }, [dailyData, monthlyData, blockData, aggregationMode]);

  // Recharts: Penalty Parameter Breakdown
  const penaltyBreakdownData = useMemo(() => {
    const s = analyticsStats;
    const totalGred = s.tandanDiGred || 1;
    return [
      { name: 'Muda', jumlah: s.rejectMuda, peratus: ((s.rejectMuda / totalGred) * 100).toFixed(1), fill: '#EF4444' },
      { name: 'Peram', jumlah: s.rejectPeram, peratus: ((s.rejectPeram / totalGred) * 100).toFixed(1), fill: '#EC4899' },
      { name: 'Mengkal', jumlah: s.penaltiMengkal, peratus: ((s.penaltiMengkal / totalGred) * 100).toFixed(1), fill: '#F97316' },
      { name: 'Busuk', jumlah: s.penaltiBusuk, peratus: ((s.penaltiBusuk / totalGred) * 100).toFixed(1), fill: '#DC2626' },
      { name: 'Kosong', jumlah: s.penaltiKosong, peratus: ((s.penaltiKosong / totalGred) * 100).toFixed(1), fill: '#64748B' },
      { name: 'Kotor', jumlah: s.kotor, peratus: ((s.kotor / totalGred) * 100).toFixed(1), fill: '#A16207' },
      { name: 'Lama', jumlah: s.lama, peratus: ((s.lama / totalGred) * 100).toFixed(1), fill: '#8B5CF6' },
      { name: 'Dura', jumlah: s.dura, peratus: ((s.dura / totalGred) * 100).toFixed(1), fill: '#D97706' },
      { name: 'T. Panjang', jumlah: s.tangkaiPanjang, peratus: ((s.tangkaiPanjang / totalGred) * 100).toFixed(1), fill: '#6366F1' },
      { name: 'Sg. Tikus', jumlah: s.seranganTikus, peratus: ((s.seranganTikus / totalGred) * 100).toFixed(1), fill: '#334155' },
    ];
  }, [analyticsStats]);

  // ExcelJS Download Handler for Analytics
  const handleExportAnalyticsExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Rumusan Analitik Blok');
      
      ws.pageSetup.orientation = "landscape";
      ws.pageSetup.fitToPage = true;
      ws.pageSetup.fitToWidth = 1;

      // Report title
      ws.mergeCells("A1:S1");
      const titleCell = ws.getCell("A1");
      titleCell.value = aggregationMode === 'blok'
        ? `LAPORAN RUMUSAN REKOD PENGGREDAN MENGIKUT BLOK (SEMUA KRITERIA)`
        : `LAPORAN RUMUSAN & ANALITIK PENGGREDAN SEMUA BLOK (${aggregationMode === 'hari' ? 'HARIAN' : 'BULANAN'})`;
      titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FF064E3B" } };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(1).height = 35;

      // Metadata information
      ws.mergeCells("A2:S2");
      const filterLabel = `Penapis - Blok: ${selectedBlokFilter === 'ALL' ? 'Semua' : selectedBlokFilter} | Bulan: ${selectedBulanFilter === 'ALL' ? 'Semua' : selectedBulanFilter}`;
      ws.getCell("A2").value = `${filterLabel}  |  Dijana Pada: ${new Date().toLocaleDateString("ms-MY")} ${new Date().toLocaleTimeString("ms-MY")}`;
      ws.getCell("A2").font = { name: "Arial", size: 10, italic: true };
      ws.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(2).height = 20;

      // Spacer
      ws.addRow([]);

      // Headers for columns
      const headers = aggregationMode === 'blok'
        ? [
            'BLOK',
            'BIL SESI / HARI',
            'BIL PLATFORM',
            'TANDAN DI GRED (TANDAN)',
            'TANDAN DI TINGGAL (TANDAN)',
            'KADAR REJECT (%)',
            'TANDAN DI BAWA (TANDAN)',
            'MASAK (TANDAN)',
            'KADAR MASAK (%)',
            'MUDA (TANDAN)',
            'PERAM (TANDAN)',
            'MENGKAL (TANDAN)',
            'BUSUK (TANDAN)',
            'KOSONG (TANDAN)',
            'KOTOR (TANDAN)',
            'LAMA (TANDAN)',
            'DURA (TANDAN)',
            'TANGKAI PANJANG (TANDAN)',
            'SERANGAN TIKUS (TANDAN)'
          ]
        : [
            aggregationMode === 'hari' ? 'TARIKH' : 'BULAN',
            'BLOK',
            'BIL PLATFORM',
            'TANDAN DI GRED (TANDAN)',
            'TANDAN DI TINGGAL (TANDAN)',
            'KADAR REJECT (%)',
            'TANDAN DI BAWA (TANDAN)',
            'MASAK (TANDAN)',
            'KADAR MASAK (%)',
            'MUDA (TANDAN)',
            'PERAM (TANDAN)',
            'MENGKAL (TANDAN)',
            'BUSUK (TANDAN)',
            'KOSONG (TANDAN)',
            'KOTOR (TANDAN)',
            'LAMA (TANDAN)',
            'DURA (TANDAN)',
            'TANGKAI PANJANG (TANDAN)',
            'SERANGAN TIKUS (TANDAN)'
          ];

      const headerRow = ws.addRow(headers);
      headerRow.height = 30;
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF064E3B" } // Dark green
        };
        cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = {
          top: { style: "thin", color: { argb: "FFFFFFFF" } },
          left: { style: "thin", color: { argb: "FFFFFFFF" } },
          bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
          right: { style: "thin", color: { argb: "FFFFFFFF" } }
        };
      });

      // Widths
      ws.columns = [
        { width: 16 }, // Tarikh / Bulan / Blok
        { width: 16 }, // Blok / Bil Sesi
        { width: 14 }, // Bil Platform
        { width: 16 }, // Gred
        { width: 16 }, // Tinggal
        { width: 15 }, // Kadar Reject
        { width: 16 }, // Bawa
        { width: 14 }, // Masak pcs
        { width: 15 }, // Kadar Masak %
        { width: 12 }, // Muda
        { width: 12 }, // Peram
        { width: 12 }, // Mengkal
        { width: 12 }, // Busuk
        { width: 12 }, // Kosong
        { width: 12 }, // Kotor
        { width: 12 }, // Lama
        { width: 12 }, // Dura
        { width: 16 }, // Tangkai Panjang
        { width: 16 }  // Serangan Tikus
      ];

      const dataList = aggregationMode === 'hari'
        ? dailyData
        : aggregationMode === 'bulan'
        ? monthlyData
        : blockData;
      
      dataList.forEach(item => {
        const totalGred = Number(item.tandanDiGred) || 0;
        const rejectPct = totalGred ? (Number(item.tandanDiTinggal) / totalGred) : 0;
        const masakPct = totalGred ? (Number(item.masak) / totalGred) : 0;

        const rowData = aggregationMode === 'blok'
          ? [
              formatBlokDisplay(item.peringkatBlok),
              `${item.sessionCount} Sesi (${item.totalDates} Hari)`,
              item.platformCount,
              item.tandanDiGred,
              item.tandanDiTinggal,
              rejectPct,
              item.tandanDiBawa,
              item.masak,
              masakPct,
              item.rejectMuda,
              item.rejectPeram,
              item.penaltiMengkal,
              item.penaltiBusuk,
              item.penaltiKosong,
              item.kotor,
              item.lama,
              item.dura,
              item.tangkaiPanjang,
              item.seranganTikus
            ]
          : [
              aggregationMode === 'hari' ? item.tarikh : item.bulan,
              formatBlokDisplay(item.peringkatBlok),
              item.platformCount,
              item.tandanDiGred,
              item.tandanDiTinggal,
              rejectPct,
              item.tandanDiBawa,
              item.masak,
              masakPct,
              item.rejectMuda,
              item.rejectPeram,
              item.penaltiMengkal,
              item.penaltiBusuk,
              item.penaltiKosong,
              item.kotor,
              item.lama,
              item.dura,
              item.tangkaiPanjang,
              item.seranganTikus
            ];

        const r = ws.addRow(rowData);
        r.eachCell((cell, colIndex) => {
          cell.font = { name: "Arial", size: 10 };
          cell.border = {
            top: { style: "thin", color: { argb: "FFD1D5DB" } },
            left: { style: "thin", color: { argb: "FFD1D5DB" } },
            bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
            right: { style: "thin", color: { argb: "FFD1D5DB" } }
          };
          
          if (colIndex === 1 || colIndex === 2) {
            cell.alignment = { horizontal: "center", vertical: "middle" };
          } else if (colIndex === 6 || colIndex === 9) {
            cell.alignment = { horizontal: "right", vertical: "middle" };
            cell.numFmt = "0.0%";
          } else {
            cell.alignment = { horizontal: "right", vertical: "middle" };
            cell.numFmt = "#,##0";
          }
        });
      });

      // Summation Row
      const s = analyticsStats;
      const totalGredSum = s.tandanDiGred || 0;
      const avgRejectPct = totalGredSum ? (s.tandanDiTinggal / totalGredSum) : 0;
      const avgMasakPct = totalGredSum ? (s.masak / totalGredSum) : 0;

      const sumRowData = [
        'JUMLAH BESAR',
        aggregationMode === 'blok' ? `${filteredSessions.length} Sesi` : '',
        s.platformCount,
        s.tandanDiGred,
        s.tandanDiTinggal,
        avgRejectPct,
        s.tandanDiBawa,
        s.masak,
        avgMasakPct,
        s.rejectMuda,
        s.rejectPeram,
        s.penaltiMengkal,
        s.penaltiBusuk,
        s.penaltiKosong,
        s.kotor,
        s.lama,
        s.dura,
        s.tangkaiPanjang,
        s.seranganTikus
      ];

      const sumRow = ws.addRow(sumRowData);
      sumRow.height = 25;
      sumRow.eachCell((cell, colIndex) => {
        cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF0B251D" } // Darker emerald tone
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FFD1D5DB" } },
          left: { style: "thin", color: { argb: "FFD1D5DB" } },
          bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
          right: { style: "thin", color: { argb: "FFD1D5DB" } }
        };
        
        if (colIndex === 1 || colIndex === 2) {
          cell.alignment = { horizontal: "center", vertical: "middle" };
        } else if (colIndex === 6 || colIndex === 9) {
          cell.alignment = { horizontal: "right", vertical: "middle" };
          cell.numFmt = "0.0%";
        } else {
          cell.alignment = { horizontal: "right", vertical: "middle" };
          cell.numFmt = "#,##0";
        }
      });

      // Write and download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Laporan_Analitik_Penggredan_${aggregationMode === 'hari' ? 'Harian' : aggregationMode === 'bulan' ? 'Bulanan' : 'Mengikut_Blok'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
      
      if (onShowToast) {
        onShowToast('success', 'Laporan Excel Analitik berjaya dimuat turun!');
      }
    } catch (err) {
      console.error(err);
      if (onShowToast) {
        onShowToast('error', 'Gagal memuat turun fail Excel Analitik.');
      }
    }
  };

  // Generate WhatsApp text for a specific block summary
  const generateBlockWhatsAppText = (blockItem: any) => {
    const totalGred = Number(blockItem.tandanDiGred) || 0;
    const rejectPct = totalGred ? ((blockItem.tandanDiTinggal / totalGred) * 100).toFixed(1) : '0.0';
    const masakPct = totalGred ? ((blockItem.masak / totalGred) * 100).toFixed(1) : '0.0';

    return `*RUMUSAN PENGGREDAN ${formatBlokDisplay(blockItem.peringkatBlok).toUpperCase()}*
=============================
📋 *Maklumat Operasi:*
• Bilangan Sesi: ${blockItem.sessionCount} Sesi (${blockItem.totalDates} Hari)
• Bilangan Platform: ${blockItem.platformCount} Platform
• Lori Terlibat: ${blockItem.lori || '-'}
• Penggred: ${blockItem.penggred || '-'}

📊 *Prestasi Mutu & Tandan:*
• Tandan Di Gred: ${blockItem.tandanDiGred.toLocaleString()} tandan
• Tandan Di Bawa: ${blockItem.tandanDiBawa.toLocaleString()} tandan
• Tandan Masak: ${blockItem.masak.toLocaleString()} tandan (${masakPct}%)
• Tandan Di Tinggal: ${blockItem.tandanDiTinggal.toLocaleString()} tandan (${rejectPct}%)

❌ *( Reject / Tinggal ):*
• Muda: ${blockItem.rejectMuda} T
• Peram: ${blockItem.rejectPeram} T

⚠️ *( Penalti Mutu ):*
• Mengkal: ${blockItem.penaltiMengkal} T
• Busuk: ${blockItem.penaltiBusuk} T
• Kosong: ${blockItem.penaltiKosong} T

🔍 *Parameter Kualiti Lain:*
• Kotor: ${blockItem.kotor} T
• Lama: ${blockItem.lama} T
• Dura: ${blockItem.dura} T
• Tangkai Panjang: ${blockItem.tangkaiPanjang} T
• Serangan Tikus: ${blockItem.seranganTikus} T
=============================
_Laporan Dijana daripada Sistem Penggredan BTS Ladang_`;
  };

  const handleCopyBlockWhatsApp = async (blockItem: any) => {
    try {
      const text = generateBlockWhatsAppText(blockItem);
      await navigator.clipboard.writeText(text);
      setCopiedBlockId(blockItem.id);
      playSound('click');
      if (onShowToast) onShowToast('success', `Rumusan WhatsApp ${formatBlokDisplay(blockItem.peringkatBlok)} disalin!`);
      setTimeout(() => setCopiedBlockId(null), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  const handleShareBlockWhatsApp = (blockItem: any) => {
    const text = generateBlockWhatsAppText(blockItem);
    const encodedText = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
    if (onShowToast) onShowToast('success', `Membuka WhatsApp untuk ${formatBlokDisplay(blockItem.peringkatBlok)}...`);
  };

  // Update tandanDiBawa and tandanDiTinggal automatically when tandanDiGred changes
  const handleTandanDiGredChange = (gredVal: number) => {
    const tinggalVal = platformForm.rejectMuda; // Ditinggal sentiasa dikunci sama dengan nilai Muda
    const diBawa = Math.max(0, gredVal - tinggalVal);
    setPlatformForm(prev => ({
      ...prev,
      tandanDiGred: gredVal,
      tandanDiTinggal: tinggalVal,
      tandanDiBawa: diBawa,
      masak: diBawa // cadangan default untuk masak
    }));
  };

  // Update tandanDiTinggal and tandanDiBawa automatically when rejectMuda changes
  const handleRejectMudaChange = (mudaVal: number) => {
    const gredVal = platformForm.tandanDiGred;
    const tinggalVal = mudaVal; // Jumlah Tandan Ditinggal = Kategori Reject Muda
    const diBawa = Math.max(0, gredVal - tinggalVal);
    setPlatformForm(prev => ({
      ...prev,
      rejectMuda: mudaVal,
      tandanDiTinggal: tinggalVal,
      tandanDiBawa: diBawa,
      masak: diBawa
    }));
  };

  // Pre-fill sample data from prompt
  const handleQuickFillSample = () => {
    setSessionHeader({
      tajuk: '*JPPK KS 𝘼𝘿𝙀𝙇𝘼*',
      program: '𝙏𝙖𝙨𝙠 𝙁𝙤𝙧𝙘𝙚 𝙂𝙧𝙖𝙙𝙞𝙣𝙜',
      jenisGrading: '𝙂𝙧𝙖𝙙𝙞𝙣𝙜 𝘿𝙞 𝙡𝙖𝙙𝙖𝙣𝙜',
      tarikh: getFormattedTodayDate(),
      ladang: 'FPMTunggal',
      peringkatBlok: '01/02',
      noLori: 'JGK 1917',
      namaPenggred: 'GIANTARA'
    });

    setPlatformForm({
      id: `p-${platformNo}-${Date.now()}`,
      platformNo: platformNo,
      tandanDiGred: 340,
      tandanDiTinggal: 4, // Dikunci sama dengan rejectMuda: 4
      tandanDiBawa: 336,  // 340 - 4
      rejectMuda: 4,
      rejectMudaUnit: 'T',
      rejectPeram: 7,
      rejectPeramUnit: 'T',
      penaltiMengkal: 10,
      penaltiMengkalUnit: 'T',
      penaltiBusuk: 0,
      penaltiBusukUnit: 'T',
      penaltiKosong: 0,
      penaltiKosongUnit: 'T',
      kotor: 4,
      lama: 0,
      dura: 0,
      tangkaiPanjang: 5,
      masak: 336,
      seranganTikus: 0
    });

    if (onShowToast) {
      onShowToast('success', 'Data sampel contoh prompt telah dimuatkan!');
    }
  };

  // Submit current platform and sync session
  const handleAddPlatform = async () => {
    setIsSaving(true);
    playSound('submit');
    const newPlatformData: PlatformGradingData = {
      ...platformForm,
      id: `p-${platformNo}-${Date.now()}`,
      platformNo: platformNo
    };

    const updatedPlatforms = [...submittedPlatforms, newPlatformData];
    setSubmittedPlatforms(updatedPlatforms);

    // Save current state as session to Supabase & localStorage automatically
    const currentSession: BlockGradingSession = {
      id: currentSessionId,
      tajuk: sessionHeader.tajuk,
      program: sessionHeader.program,
      jenisGrading: sessionHeader.jenisGrading,
      tarikh: sessionHeader.tarikh,
      ladang: sessionHeader.ladang,
      peringkatBlok: sessionHeader.peringkatBlok,
      noLori: sessionHeader.noLori,
      namaPenggred: sessionHeader.namaPenggred,
      gradingTaskId: activeGradingTask?.id,
      platforms: updatedPlatforms,
      createdAt: new Date().toISOString()
    };

    const res = await penggredanService.saveSession(currentSession);
    const reloaded = await penggredanService.getSessions();
    setHistorySessions(reloaded);

    const nextNo = platformNo + 1;
    setPlatformNo(nextNo);

    // Reset form for next platform
    setPlatformForm({
      id: `p-${nextNo}`,
      platformNo: nextNo,
      tandanDiGred: 0,
      tandanDiTinggal: 0,
      tandanDiBawa: 0,
      rejectMuda: 0,
      rejectMudaUnit: 'T',
      rejectPeram: 0,
      rejectPeramUnit: 'T',
      penaltiMengkal: 0,
      penaltiMengkalUnit: 'T',
      penaltiBusuk: 0,
      penaltiBusukUnit: 'T',
      penaltiKosong: 0,
      penaltiKosongUnit: 'T',
      kotor: 0,
      lama: 0,
      dura: 0,
      tangkaiPanjang: 0,
      masak: 0,
      seranganTikus: 0
    });

    setIsSaving(false);

    if (onShowToast) {
      onShowToast('success', `Platform ${platformNo} berjaya disimpan di Supabase & Tempatan!`);
    }
  };

  // Remove platform entry
  const handleRemovePlatform = async (id: string) => {
    const updated = submittedPlatforms.filter(p => p.id !== id);
    setSubmittedPlatforms(updated);

    if (updated.length > 0) {
      const currentSession: BlockGradingSession = {
        id: currentSessionId,
        tajuk: sessionHeader.tajuk,
        program: sessionHeader.program,
        jenisGrading: sessionHeader.jenisGrading,
        tarikh: sessionHeader.tarikh,
        ladang: sessionHeader.ladang,
        peringkatBlok: sessionHeader.peringkatBlok,
        noLori: sessionHeader.noLori,
        namaPenggred: sessionHeader.namaPenggred,
        gradingTaskId: activeGradingTask?.id,
        platforms: updated,
        createdAt: new Date().toISOString()
      };
      await penggredanService.saveSession(currentSession);
      const reloaded = await penggredanService.getSessions();
      setHistorySessions(reloaded);
    }

    if (onShowToast) {
      onShowToast('success', 'Platform telah dipadam.');
    }
  };

  // Calculate current aggregated totals across active or submitted platforms
  const activePlatforms = submittedPlatforms.length > 0 
    ? submittedPlatforms 
    : [platformForm]; // if none submitted yet, preview current form

  const totalDiGred = activePlatforms.reduce((a, b) => a + Number(b.tandanDiGred || 0), 0);
  const totalDiTinggal = activePlatforms.reduce((a, b) => a + Number(b.tandanDiTinggal || 0), 0);
  const totalDiBawa = activePlatforms.reduce((a, b) => a + Number(b.tandanDiBawa || 0), 0);
  const totalRejectMuda = activePlatforms.reduce((a, b) => a + Number(b.rejectMuda || 0), 0);
  const totalRejectPeram = activePlatforms.reduce((a, b) => a + Number(b.rejectPeram || 0), 0);
  const totalPenaltiMengkal = activePlatforms.reduce((a, b) => a + Number(b.penaltiMengkal || 0), 0);
  const totalPenaltiBusuk = activePlatforms.reduce((a, b) => a + Number(b.penaltiBusuk || 0), 0);
  const totalPenaltiKosong = activePlatforms.reduce((a, b) => a + Number(b.penaltiKosong || 0), 0);
  const totalKotor = activePlatforms.reduce((a, b) => a + Number(b.kotor || 0), 0);
  const totalLama = activePlatforms.reduce((a, b) => a + Number(b.lama || 0), 0);
  const totalDura = activePlatforms.reduce((a, b) => a + Number(b.dura || 0), 0);
  const totalTPanjang = activePlatforms.reduce((a, b) => a + Number(b.tangkaiPanjang || 0), 0);
  const totalMasak = activePlatforms.reduce((a, b) => a + Number(b.masak || 0), 0);
  const totalSTikus = activePlatforms.reduce((a, b) => a + Number(b.seranganTikus || 0), 0);

  const primaryPlatform = activePlatforms[0] || platformForm;

  // Generate WhatsApp text
  const generateWhatsAppText = () => {
    const tajuk = sessionHeader.tajuk || '*JPPK KS 𝘼𝘿𝙀𝙇𝘼*';
    const program = sessionHeader.program || '𝙏𝙖𝙨𝙠 𝙁𝙤𝙧𝙘𝙚 𝙂𝙧𝙖𝙙𝙞𝙣𝙜';
    const jenis = sessionHeader.jenisGrading || '𝙂𝙧𝙖𝙙𝙞𝙣𝙜 𝘿𝙞 𝙡𝙖𝙙𝙖𝙣𝙜';

    return `${tajuk}
${program}
${jenis}

Tarikh : ${sessionHeader.tarikh}
Ladang : ${sessionHeader.ladang}
Peringkat / Blok : ${sessionHeader.peringkatBlok}
No Lori : ${sessionHeader.noLori}

Jumlah Tandan yg di gred : ${totalDiGred}
Jumlah Tandan yg di tinggal : ${totalDiTinggal}
Jumlah Tandan yg di bawa : ${totalDiBawa}

( Reject )T/B
Muda : ${totalRejectMuda} (${primaryPlatform.rejectMudaUnit || 'T'})
Peram : ${totalRejectPeram} (${primaryPlatform.rejectPeramUnit || 'T'})

( Penalti)T/B
Mengkal : ${totalPenaltiMengkal}(${primaryPlatform.penaltiMengkalUnit || 'T'})
Busuk : ${totalPenaltiBusuk}(${primaryPlatform.penaltiBusukUnit || 'T'})
Kosong : ${totalPenaltiKosong}(${primaryPlatform.penaltiKosongUnit || 'T'})
Kotor : ${totalKotor}
Lama : ${totalLama}
Dura : ${totalDura}
T.Panjang : ${totalTPanjang} (Dipotong)
Masak : ${totalMasak}
S.Tikus : ${totalSTikus}

Nama Penggereding : ${sessionHeader.namaPenggred}`;
  };

  const whatsappMessage = generateWhatsAppText();

  // Handle Copy text
  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(whatsappMessage);
      setIsCopied(true);
      if (onShowToast) {
        onShowToast('success', 'Laporan WhatsApp berjaya disalin!');
      }
      setTimeout(() => setIsCopied(false), 2500);
    } catch (e) {
      if (onShowToast) onShowToast('error', 'Gagal menyalin teks.');
    }
  };

  // Handle Share to WhatsApp
  const handleShareWhatsApp = () => {
    const encoded = encodeURIComponent(whatsappMessage);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
    if (onShowToast) {
      onShowToast('success', 'Membuka WhatsApp untuk menghantar laporan...');
    }
  };

  // Save session explicitly to Supabase
  const handleSaveToHistory = async () => {
    setIsSaving(true);
    const newSession: BlockGradingSession = {
      id: currentSessionId,
      tajuk: sessionHeader.tajuk,
      program: sessionHeader.program,
      jenisGrading: sessionHeader.jenisGrading,
      tarikh: sessionHeader.tarikh,
      ladang: sessionHeader.ladang,
      peringkatBlok: sessionHeader.peringkatBlok,
      noLori: sessionHeader.noLori,
      namaPenggred: sessionHeader.namaPenggred,
      gradingTaskId: activeGradingTask?.id,
      platforms: activePlatforms,
      createdAt: new Date().toISOString()
    };

    try {
      if (activeGradingTask) {
        const completedTask = await gradingTaskService.completeFieldTask(activeGradingTask.id, newSession);
        setActiveGradingTask(completedTask);
        setTaskRefreshKey((value) => value + 1);
        setActiveSubTab('grading_task');
        if (onShowToast) onShowToast('success', 'Grading Task selesai di lapangan dan menunggu keputusan kilang.');
      } else {
        const res = await penggredanService.saveSession(newSession);
        if (onShowToast) onShowToast(res.success ? 'success' : 'error', res.message);
      }
      const reloaded = await penggredanService.getSessions();
      setHistorySessions(reloaded);
    } catch (error: any) {
      if (onShowToast) onShowToast('error', error?.message || 'Gagal menyimpan rekod penggredan.');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete history item
  const handleDeleteHistory = async (id: string) => {
    setHistorySessions(prev => prev.filter(s => s.id !== id));
    await penggredanService.deleteSession(id);
    const reloaded = await penggredanService.getSessions();
    setHistorySessions(reloaded);
    if (onShowToast) onShowToast('success', 'Rekod sejarah dipadam daripada semua peranti.');
  };

  // Reset the entire grading form & session
  const handleResetSession = () => {
    setCurrentSessionId(`session-${Date.now()}`);
    setSubmittedPlatforms([]);
    setPlatformNo(1);
    setPlatformForm({
      id: 'p-1',
      platformNo: 1,
      tandanDiGred: 0,
      tandanDiTinggal: 0,
      tandanDiBawa: 0,
      rejectMuda: 0,
      rejectMudaUnit: 'T',
      rejectPeram: 0,
      rejectPeramUnit: 'T',
      penaltiMengkal: 0,
      penaltiMengkalUnit: 'T',
      penaltiBusuk: 0,
      penaltiBusukUnit: 'T',
      penaltiKosong: 0,
      penaltiKosongUnit: 'T',
      kotor: 0,
      lama: 0,
      dura: 0,
      tangkaiPanjang: 0,
      masak: 0,
      seranganTikus: 0
    });

    const config = getEstateConfig(activeEstateId);
    const norm = normalizeEstateId(activeEstateId);
    const lorryList = ESTATE_LORRIES[norm] || DEFAULT_LORRIES;

    setSessionHeader(prev => ({
      ...prev,
      tajuk: '*JPPK KS ADELA*',
      ladang: config.name,
      peringkatBlok: '',
      noLori: lorryList[0] || ''
    }));

    setActiveSubTab('borang');
    setActiveGradingTask(null);

    if (onShowToast) {
      onShowToast('success', 'Sesi penggredan diset semula! Borang sedia untuk blok baru.');
    }
  };

  const handleStartGradingTask = (task: GradingTask) => {
    const [year, month, day] = task.task_date.split('-');
    const taskDate = `${day}/${month}/${year.slice(-2)}`;
    const estate = getEstateConfig(task.estate_id);

    setSubmittedPlatforms([]);
    setPlatformNo(1);
    setCurrentSessionId(`grading-task-${task.id}`);
    setActiveGradingTask(task);
    setSessionHeader((current) => ({
      ...current,
      tarikh: taskDate,
      ladang: estate.name,
      peringkatBlok: task.block,
      noLori: ''
    }));
    setActiveSubTab('borang');
  };

  return (
    <div className="w-full space-y-4">
      {/* HEADER & SUBTAB NAVIGATION */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 p-4 rounded-2xl border border-emerald-500/20 shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/40 rounded text-[9px] font-mono font-black text-emerald-300 uppercase tracking-widest">
                iPDS Grading
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
              <ClipboardCheck className="text-emerald-400" size={20} />
              Borang Penggredan BTS Di Ladang
            </h2>
            <p className="text-[10px] text-slate-300 mt-1">
              Borang penggredan kualiti tandan buah segar di ladang berasaskan Blok &amp; Platform dengan butang +/- pintar &amp; penyimpan pangkalan data Supabase.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
            <button
              onClick={() => loadData()}
              disabled={isLoadingHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 rounded-xl text-emerald-300 text-[11px] font-bold transition-all active:scale-95 shrink-0 disabled:opacity-50"
              title="Segarkan Data dari Supabase"
            >
              <RefreshCw size={13} className={isLoadingHistory ? 'animate-spin' : ''} />
              {isLoadingHistory ? 'Menyegerak...' : 'Muat Semula'}
            </button>
            <button
              onClick={handleResetSession}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 rounded-xl text-rose-300 text-[11px] font-bold transition-all active:scale-95 shrink-0"
              title="Set Semula Semua Data Borang"
            >
              <Trash2 size={14} />
              Set Semula Borang
            </button>
          </div>
        </div>

        {/* SUBTABS */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/10 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveSubTab('borang')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
              activeSubTab === 'borang'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
            }`}
          >
            <Edit3 size={14} />
            1. Borang Penggredan {submittedPlatforms.length > 0 && `(${submittedPlatforms.length})`}
          </button>

          <button
            onClick={() => setActiveSubTab('grading_task')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
              activeSubTab === 'grading_task'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
            }`}
          >
            <ClipboardCheck size={14} />
            2. Grading Task
          </button>

          <button
            onClick={() => setActiveSubTab('analitik_semua')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
              activeSubTab === 'analitik_semua'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
            }`}
          >
            <BarChart3 size={14} />
            3. Analitik
          </button>

          <button
            onClick={() => setActiveSubTab('rumusan_blok')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
              activeSubTab === 'rumusan_blok'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
            }`}
          >
            <Boxes size={14} />
            4. Rumusan {blockData.length > 0 && `(${blockData.length})`}
          </button>

          <button
            onClick={() => setActiveSubTab('sejarah')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
              activeSubTab === 'sejarah'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
            }`}
          >
            <History size={14} />
            5. Sejarah {historySessions.length > 0 && `(${historySessions.length})`}
          </button>
        </div>
      </div>

      {activeSubTab === 'grading_task' && (
        <GradingTaskView onStartTask={handleStartGradingTask} refreshKey={taskRefreshKey} />
      )}

      {/* VIEW 1: BORANG MENGGRED PLATFORM */}
      {activeSubTab === 'borang' && (
        <div className="space-y-4">
          {activeGradingTask && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-amber-600">Konteks Grading Task #{activeGradingTask.rank}</p>
                <p className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-100">Blok {activeGradingTask.block} · {activeGradingTask.task_date} · {activeGradingTask.estate_id}</p>
              </div>
              <button type="button" onClick={() => setActiveSubTab('grading_task')} className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-300">
                Kembali ke Tugasan
              </button>
            </div>
          )}
          {/* HEADER MAKLUMAT LOKASI & LORI */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <FileText size={15} className="text-emerald-500" />
              Maklumat Asas Tugasan (Sesi Blok)
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                  Tajuk Laporan
                </label>
                <input
                  type="text"
                  value={sessionHeader.tajuk}
                  onChange={(e) => setSessionHeader({ ...sessionHeader, tajuk: e.target.value })}
                  className="w-full text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                  Tarikh
                </label>
                <input
                  type="text"
                  value={sessionHeader.tarikh}
                  onChange={(e) => setSessionHeader({ ...sessionHeader, tarikh: e.target.value })}
                  className="w-full text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                  Ladang
                </label>
                <input
                  type="text"
                  value={sessionHeader.ladang}
                  onChange={(e) => setSessionHeader({ ...sessionHeader, ladang: e.target.value })}
                  className="w-full text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="relative">
                <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                  Peringkat / Blok
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={sessionHeader.peringkatBlok}
                    onChange={(e) => {
                      setSessionHeader({ ...sessionHeader, peringkatBlok: e.target.value });
                      setBlockSearchQuery(e.target.value);
                    }}
                    onFocus={() => setShowBlockDropdown(true)}
                    className="w-full text-xs font-bold pl-2.5 pr-8 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    placeholder="Pilih atau taip..."
                  />
                  <button
                    type="button"
                    onClick={() => setShowBlockDropdown(!showBlockDropdown)}
                    className="absolute right-0 top-0 bottom-0 px-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <ChevronDown size={14} className={`transform transition-transform ${showBlockDropdown ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {/* Dropdown Menu */}
                {showBlockDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => {
                        setShowBlockDropdown(false);
                        setBlockSearchQuery('');
                      }} 
                    />
                    <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-20 divide-y divide-slate-100 dark:divide-slate-800/60 scrollbar-thin">
                      {/* Search Input inside Dropdown */}
                      <div className="p-2 sticky top-0 bg-white dark:bg-slate-900 z-10">
                        <div className="relative flex items-center">
                          <Search size={12} className="absolute left-2.5 text-slate-400" />
                          <input
                            type="text"
                            value={blockSearchQuery}
                            onChange={(e) => setBlockSearchQuery(e.target.value)}
                            placeholder="Cari peringkat / blok..."
                            className="w-full text-[10px] font-medium pl-7 pr-2 py-1 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>

                      {/* Grouped Options */}
                      {(() => {
                        const filtered = activeBlocks.filter(b => 
                          b.label.toLowerCase().includes(blockSearchQuery.toLowerCase()) || 
                          b.value.toLowerCase().includes(blockSearchQuery.toLowerCase()) ||
                          b.group.toLowerCase().includes(blockSearchQuery.toLowerCase())
                        );
                        
                        if (filtered.length === 0) {
                          return (
                            <div className="p-3 text-center text-[10px] text-slate-400 font-medium">
                              Tiada padanan. Sila taip terus.
                            </div>
                          );
                        }

                        const grouped = filtered.reduce((acc, curr) => {
                          if (!acc[curr.group]) acc[curr.group] = [];
                          acc[curr.group].push(curr);
                          return acc;
                        }, {} as Record<string, typeof activeBlocks>);

                        return Object.entries(grouped).map(([groupName, blocks]) => (
                          <div key={groupName} className="p-1.5">
                            <div className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-emerald-500 dark:text-emerald-400/80">
                              {groupName}
                            </div>
                            <div className="grid grid-cols-1 gap-0.5 mt-1">
                              {blocks.map((block) => (
                                <button
                                  key={block.value}
                                  type="button"
                                  onClick={() => {
                                    setSessionHeader({ ...sessionHeader, peringkatBlok: block.value });
                                    setShowBlockDropdown(false);
                                    setBlockSearchQuery('');
                                  }}
                                  className={`w-full text-left px-2 py-1.5 rounded-md text-[11px] font-bold flex items-center justify-between transition-colors ${
                                    sessionHeader.peringkatBlok === block.value 
                                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                                      : 'hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200'
                                  }`}
                                >
                                  <span>{block.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </>
                )}
              </div>

              <div className="relative">
                <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                  No. Lori
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={sessionHeader.noLori}
                    onChange={(e) => {
                      setSessionHeader({ ...sessionHeader, noLori: e.target.value.toUpperCase() });
                      setLorrySearchQuery(e.target.value);
                    }}
                    onFocus={() => setShowLorryDropdown(true)}
                    className="w-full text-xs font-bold pl-2.5 pr-8 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    placeholder="Pilih atau taip..."
                  />
                  <button
                    type="button"
                    onClick={() => setShowLorryDropdown(!showLorryDropdown)}
                    className="absolute right-0 top-0 bottom-0 px-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <ChevronDown size={14} className={`transform transition-transform ${showLorryDropdown ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {/* Dropdown Menu for Lorry */}
                {showLorryDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => {
                        setShowLorryDropdown(false);
                        setLorrySearchQuery('');
                      }} 
                    />
                    <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-20 divide-y divide-slate-100 dark:divide-slate-800/60 scrollbar-thin">
                      {/* Search Input inside Dropdown */}
                      <div className="p-2 sticky top-0 bg-white dark:bg-slate-900 z-10">
                        <div className="relative flex items-center">
                          <Search size={12} className="absolute left-2.5 text-slate-400" />
                          <input
                            type="text"
                            value={lorrySearchQuery}
                            onChange={(e) => setLorrySearchQuery(e.target.value)}
                            placeholder="Cari no. lori..."
                            className="w-full text-[10px] font-medium pl-7 pr-2 py-1 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>

                      {/* Lorry Options */}
                      <div className="p-1.5">
                        <div className="grid grid-cols-1 gap-0.5">
                          {(() => {
                            const filtered = uniqueLorryList.filter(lorry => 
                              lorry.toLowerCase().includes(lorrySearchQuery.toLowerCase())
                            );

                            if (filtered.length === 0) {
                              return (
                                <div className="p-3 text-center text-[10px] text-slate-400 font-medium">
                                  Tiada padanan. Sila taip terus.
                                </div>
                              );
                            }

                            return filtered.map((lorry) => (
                              <button
                                key={lorry}
                                type="button"
                                onClick={() => {
                                  setSessionHeader({ ...sessionHeader, noLori: lorry });
                                  setShowLorryDropdown(false);
                                  setLorrySearchQuery('');
                                }}
                                className={`w-full text-left px-2 py-1.5 rounded-md text-[11px] font-bold flex items-center justify-between transition-colors ${
                                  sessionHeader.noLori === lorry 
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                                    : 'hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200'
                                }`}
                              >
                                <span>{lorry}</span>
                                {sessionHeader.noLori === lorry && <Check size={12} className="text-emerald-500" />}
                              </button>
                            ));
                          })()}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                  Nama Penggred (EQI)
                </label>
                <input
                  type="text"
                  value={sessionHeader.namaPenggred}
                  onChange={(e) => setSessionHeader({ ...sessionHeader, namaPenggred: e.target.value })}
                  className="w-full text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="Contoh: GIANTARA"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                  Program
                </label>
                <input
                  type="text"
                  value={sessionHeader.program}
                  onChange={(e) => setSessionHeader({ ...sessionHeader, program: e.target.value })}
                  className="w-full text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                  Jenis Grading
                </label>
                <input
                  type="text"
                  value={sessionHeader.jenisGrading}
                  onChange={(e) => setSessionHeader({ ...sessionHeader, jenisGrading: e.target.value })}
                  className="w-full text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* LIST OF SUBMITTED PLATFORMS SO FAR */}
          {submittedPlatforms.length > 0 && (
            <div className="bg-emerald-950/20 dark:bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-3.5 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers size={14} />
                  Platform Yang Telah Disiapkan ({submittedPlatforms.length})
                </span>
                <button
                  onClick={() => {
                    const elem = document.getElementById('rumusan-section');
                    if (elem) elem.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="text-[10px] font-extrabold text-emerald-300 underline hover:text-emerald-200"
                >
                  Lihat Rumusan Blok &rarr;
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {submittedPlatforms.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-emerald-500/40 rounded-xl text-white text-xs font-bold shadow-sm"
                  >
                    <span className="text-emerald-400 font-extrabold">Platform #{p.platformNo}</span>
                    <span className="text-[10px] text-slate-400">({p.tandanDiGred} gred / {p.tandanDiBawa} dibawa)</span>
                    <button
                      onClick={() => handleRemovePlatform(p.id)}
                      className="text-slate-400 hover:text-rose-400 ml-1 transition-colors"
                      title="Padam Platform Ini"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* INPUT FORM FOR CURRENT PLATFORM */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
              <div>
                <span className="inline-block px-2 py-0.5 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase rounded mb-0.5">
                  Platform #{platformNo}
                </span>
                <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Borang Penggredan Platform #{platformNo}
                </h3>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleToggleSound}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-all border ${
                    soundOn
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                  }`}
                  title={soundOn ? 'Nyahaktifkan Bunyi' : 'Aktifkan Bunyi'}
                >
                  {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
                  <span className="text-[9px] uppercase hidden sm:inline">{soundOn ? 'Bunyi ON' : 'Bunyi OFF'}</span>
                </button>

                <label className="text-[9px] font-bold text-slate-500 uppercase">No Platform:</label>
                <input
                  type="number"
                  min={1}
                  value={platformNo}
                  onChange={(e) => setPlatformNo(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-14 text-xs font-bold text-center py-1 px-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* SECTION 1: JUMLAH TANDAN WITH STEPPER (+/-) BUTTONS */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] sm:text-[11px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center gap-1.5">
                  <span>1. Ringkasan Jumlah Tandan</span>
                </h4>
                <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase">Tekan +/- atau taip terus</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <StepperControl
                  label="Jumlah Tandan Yg Di Gred"
                  subtitle="Semua tandan yang diperiksa"
                  value={platformForm.tandanDiGred}
                  onChange={(val) => handleTandanDiGredChange(val)}
                  quickSteps={[10, 50]}
                  theme="emerald"
                />

                <StepperControl
                  label="Jumlah Tandan Yg Di Tinggal"
                  subtitle="Auto-kunci: Sama dgn Kategori Muda"
                  value={platformForm.tandanDiTinggal}
                  onChange={() => {}}
                  disabled={true}
                  quickSteps={[]}
                  theme="rose"
                />

                <StepperControl
                  label="Jumlah Tandan Yg Di Bawa"
                  subtitle="Auto-kira: Gred - Tinggal"
                  value={platformForm.tandanDiBawa}
                  onChange={(val) => setPlatformForm({ ...platformForm, tandanDiBawa: val })}
                  quickSteps={[10, 50]}
                  theme="emerald"
                />
              </div>
            </div>

            {/* SECTION 2: REJECT (T/B) WITH STEPPER (+/-) BUTTONS */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] sm:text-[11px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">
                  2. Kategori ( Reject ) T/B
                </h4>
                <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 lowercase font-mono">t = tandan, b = buah</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <StepperControl
                  label="Muda"
                  value={platformForm.rejectMuda}
                  onChange={(val) => handleRejectMudaChange(val)}
                  unit={platformForm.rejectMudaUnit}
                  onToggleUnit={() => setPlatformForm({ ...platformForm, rejectMudaUnit: platformForm.rejectMudaUnit === 'T' ? 'B' : 'T' })}
                  quickSteps={[5]}
                  theme="rose"
                />

                <StepperControl
                  label="Peram"
                  value={platformForm.rejectPeram}
                  onChange={(val) => setPlatformForm({ ...platformForm, rejectPeram: val })}
                  unit={platformForm.rejectPeramUnit}
                  onToggleUnit={() => setPlatformForm({ ...platformForm, rejectPeramUnit: platformForm.rejectPeramUnit === 'T' ? 'B' : 'T' })}
                  quickSteps={[5]}
                  theme="emerald"
                />
              </div>
            </div>

            {/* SECTION 3: PENALTI (T/B) WITH STEPPER (+/-) BUTTONS */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-[10px] sm:text-[11px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">
                3. Kategori ( Penalti ) T/B
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <StepperControl
                  label="Mengkal"
                  value={platformForm.penaltiMengkal}
                  onChange={(val) => setPlatformForm({ ...platformForm, penaltiMengkal: val })}
                  unit={platformForm.penaltiMengkalUnit}
                  onToggleUnit={() => setPlatformForm({ ...platformForm, penaltiMengkalUnit: platformForm.penaltiMengkalUnit === 'T' ? 'B' : 'T' })}
                  quickSteps={[5]}
                  theme="emerald"
                />

                <StepperControl
                  label="Busuk"
                  value={platformForm.penaltiBusuk}
                  onChange={(val) => setPlatformForm({ ...platformForm, penaltiBusuk: val })}
                  unit={platformForm.penaltiBusukUnit}
                  onToggleUnit={() => setPlatformForm({ ...platformForm, penaltiBusukUnit: platformForm.penaltiBusukUnit === 'T' ? 'B' : 'T' })}
                  quickSteps={[5]}
                  theme="emerald"
                />

                <StepperControl
                  label="Kosong"
                  value={platformForm.penaltiKosong}
                  onChange={(val) => setPlatformForm({ ...platformForm, penaltiKosong: val })}
                  unit={platformForm.penaltiKosongUnit}
                  onToggleUnit={() => setPlatformForm({ ...platformForm, penaltiKosongUnit: platformForm.penaltiKosongUnit === 'T' ? 'B' : 'T' })}
                  quickSteps={[5]}
                  theme="emerald"
                />
              </div>
            </div>

            {/* SECTION 4: PARAMETER KUALITI LAIN WITH STEPPER (+/-) BUTTONS */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-[10px] sm:text-[11px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">
                4. Parameter Kualiti Lain
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <StepperControl
                  label="Kotor"
                  value={platformForm.kotor}
                  onChange={(val) => setPlatformForm({ ...platformForm, kotor: val })}
                  theme="emerald"
                />

                <StepperControl
                  label="Lama"
                  value={platformForm.lama}
                  onChange={(val) => setPlatformForm({ ...platformForm, lama: val })}
                  theme="emerald"
                />

                <StepperControl
                  label="Dura"
                  value={platformForm.dura}
                  onChange={(val) => setPlatformForm({ ...platformForm, dura: val })}
                  theme="emerald"
                />

                <StepperControl
                  label="T.Panjang"
                  subtitle="(Dipotong)"
                  value={platformForm.tangkaiPanjang}
                  onChange={(val) => setPlatformForm({ ...platformForm, tangkaiPanjang: val })}
                  theme="emerald"
                />

                <StepperControl
                  label="Masak"
                  subtitle="Tandan bermutu tinggi"
                  value={platformForm.masak}
                  onChange={(val) => setPlatformForm({ ...platformForm, masak: val })}
                  quickSteps={[10, 50]}
                  theme="emerald"
                />

                <StepperControl
                  label="S.Tikus"
                  value={platformForm.seranganTikus}
                  onChange={(val) => setPlatformForm({ ...platformForm, seranganTikus: val })}
                  theme="emerald"
                />
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-2 justify-end">
              <button
                type="button"
                onClick={handleAddPlatform}
                disabled={isSaving}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 border border-slate-700 disabled:opacity-50"
              >
                {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus size={16} />}
                SIMPAN
              </button>

              <button
                type="button"
                onClick={async () => {
                  if (submittedPlatforms.length === 0) {
                    await handleAddPlatform();
                  } else {
                    await handleSaveToHistory();
                  }
                  const elem = document.getElementById('rumusan-section');
                  if (elem) {
                    elem.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
              >
                <ChevronRight size={16} />
                SELESAI &amp; LIHAT RUMUSAN
              </button>
            </div>
          </div>

          {/* RUMUSAN PENGGREDAN DI BAWAH BORANG */}
          <div id="rumusan-section" className="pt-6 border-t-2 border-dashed border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-black text-xs uppercase tracking-wider rounded-lg">
                Rumusan Sesi Semasa
              </span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Rumusan Penggredan &amp; Laporan WhatsApp
              </h3>
            </div>

            {/* STATS SUMMARY CARDS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-900 text-white p-3.5 rounded-2xl border border-slate-800 shadow-md">
                <span className="text-[10px] font-extrabold uppercase text-slate-400">Jumlah Tandan Di Gred</span>
                <p className="text-2xl font-black text-emerald-400 mt-1">{totalDiGred}</p>
                <p className="text-[9px] text-slate-400 mt-0.5">daripada {activePlatforms.length} platform</p>
              </div>

              <div className="bg-slate-900 text-white p-3.5 rounded-2xl border border-slate-800 shadow-md">
                <span className="text-[10px] font-extrabold uppercase text-slate-400">Tandan Di Tinggal</span>
                <p className="text-2xl font-black text-rose-400 mt-1">{totalDiTinggal}</p>
                <p className="text-[9px] text-slate-400 mt-0.5">kadar reject: {totalDiGred ? ((totalDiTinggal / totalDiGred) * 100).toFixed(1) : 0}%</p>
              </div>

              <div className="bg-slate-900 text-white p-3.5 rounded-2xl border border-slate-800 shadow-md">
                <span className="text-[10px] font-extrabold uppercase text-slate-400">Tandan Di Bawa</span>
                <p className="text-2xl font-black text-sky-400 mt-1">{totalDiBawa}</p>
                <p className="text-[9px] text-slate-400 mt-0.5">tandan sedia diangkut</p>
              </div>

              <div className="bg-slate-900 text-white p-3.5 rounded-2xl border border-slate-800 shadow-md">
                <span className="text-[10px] font-extrabold uppercase text-slate-400">Tandan Masak</span>
                <p className="text-2xl font-black text-emerald-300 mt-1">{totalMasak}</p>
                <p className="text-[9px] text-slate-400 mt-0.5">kualiti terbaik</p>
              </div>
            </div>

            {/* WHATSAPP MESSAGE PREVIEW CONTAINER */}
            <div className="bg-slate-950 rounded-2xl p-4 sm:p-5 border border-emerald-500/30 shadow-2xl space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/10 pb-3">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-wider">
                    <MessageSquare size={12} />
                    Format Laporan Group WhatsApp Kilang
                  </span>
                  <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wider mt-1">
                    Preview Mesej WhatsApp EQI
                  </h3>
                </div>

                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                  {/* Font Size Toggle Controls */}
                  <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-[10px] font-bold">
                    <span className="px-2 text-slate-400 uppercase text-[9px] hidden sm:inline">Saiz:</span>
                    <button
                      type="button"
                      onClick={() => setPreviewFontSize('normal')}
                      className={`px-2 py-1 rounded-lg transition-all ${
                        previewFontSize === 'normal'
                          ? 'bg-emerald-500 text-slate-950 font-black'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Sederhana
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewFontSize('large')}
                      className={`px-2 py-1 rounded-lg transition-all ${
                        previewFontSize === 'large'
                          ? 'bg-emerald-500 text-slate-950 font-black'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Besar
                    </button>
                  </div>

                  <button
                    onClick={handleCopyText}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold border border-slate-700 transition-all active:scale-95"
                  >
                    {isCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    {isCopied ? 'Telah Disalin!' : 'Salin Mesej'}
                  </button>

                  <button
                    onClick={handleShareWhatsApp}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
                  >
                    <Send size={14} />
                    Hantar Ke WhatsApp
                  </button>
                </div>
              </div>

              {/* CHAT BUBBLE BOX WITH ENHANCED HEADER & SPACING */}
              <div className="bg-[#0b141a] p-4 sm:p-5 rounded-2xl border border-emerald-900/60 shadow-inner overflow-x-auto select-all custom-scrollbar space-y-3">
                {/* Visual Header Box in Preview */}
                <div className="bg-emerald-950/70 p-3.5 sm:p-4 rounded-xl border border-emerald-500/40 space-y-1.5 shadow-md">
                  <div className={`font-black tracking-wider text-emerald-400 uppercase ${previewFontSize === 'large' ? 'text-base sm:text-xl' : 'text-sm sm:text-base'}`}>
                    {sessionHeader.tajuk || '*JPPK KS 𝘼𝘿𝙀𝙇𝘼*'}
                  </div>
                  <div className={`font-extrabold text-emerald-200 ${previewFontSize === 'large' ? 'text-sm sm:text-lg' : 'text-xs sm:text-sm'}`}>
                    {sessionHeader.program || '𝙏𝙖𝙨𝙠 𝙁𝙤𝙧𝙘𝙚 𝙂𝙧𝙖𝙙𝙞𝙣𝙜'}
                  </div>
                  <div className={`font-bold text-emerald-300/90 ${previewFontSize === 'large' ? 'text-xs sm:text-base' : 'text-[11px] sm:text-xs'}`}>
                    {sessionHeader.jenisGrading || '𝙂𝙧𝙖𝙙𝙞𝙣𝙜 𝘿𝙞 𝙡𝙖𝙙𝙖𝙣𝙜'}
                  </div>
                </div>

                {/* Complete WhatsApp Plaintext Box with Spacing */}
                <div className={`font-mono text-slate-100 leading-relaxed whitespace-pre-wrap ${previewFontSize === 'large' ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'}`}>
                  {whatsappMessage}
                </div>
              </div>

              {/* ACTION FOOTER */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 text-[11px] text-slate-300 font-medium">
                  <Check size={14} className="text-emerald-400 shrink-0" />
                  <span>Maklumat penggredan telah disimpan secara automatik ke Pangkalan Data Supabase.</span>
                </div>
              </div>

              {/* NEW SESSION RESET ACTION CARD */}
              <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="text-left">
                  <h4 className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles size={14} />
                    Selesai Penggredan Blok Ini?
                  </h4>
                  <p className="text-[10px] text-slate-300 mt-1">
                    Tekan butang di sebelah untuk menamatkan sesi ini, mengosongkan borang, dan memulakan penggredan di blok atau lori yang baharu.
                  </p>
                </div>
                <button
                  onClick={handleResetSession}
                  className="w-full md:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all active:scale-95 shadow-md flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Database size={13} />
                  Selesai &amp; Mula Sesi Baru
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: RUMUSAN & ANALITIK SEMUA BLOK */}
      {activeSubTab === 'analitik_semua' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {/* FILTER CONTROLS & ACTION CARD */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <BarChart3 className="text-emerald-500" size={18} />
                  Analitik &amp; Rumusan Penggredan Blok
                </h3>
                <p className="text-[10px] text-slate-500 mt-1">
                  Analisis terkumpul mengikut hari dan bulan untuk mengukur prestasi kualiti penuaian lori &amp; platform.
                </p>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex items-center gap-2 self-stretch md:self-auto">
                <button
                  onClick={handleExportAnalyticsExcel}
                  disabled={filteredSessions.length === 0}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-black text-[10px] uppercase tracking-wider rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed shrink-0"
                  title="Muat Turun Excel"
                >
                  <Download size={13} className="stroke-[2.5]" />
                  <span>Excel</span>
                </button>
              </div>
            </div>

            {/* SELECTION FILTERS */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {/* TOGGLE HARI / BULAN / BLOK */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                  Skop Analisis
                </label>
                <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                  <button
                    onClick={() => setAggregationMode('hari')}
                    className={`py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${
                      aggregationMode === 'hari'
                        ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    Harian
                  </button>
                  <button
                    onClick={() => setAggregationMode('bulan')}
                    className={`py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${
                      aggregationMode === 'bulan'
                        ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    Bulanan
                  </button>
                  <button
                    onClick={() => setAggregationMode('blok')}
                    className={`py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${
                      aggregationMode === 'blok'
                        ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    Blok
                  </button>
                </div>
              </div>

              {/* BLOK FILTER */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                  Tapis Blok
                </label>
                <select
                  value={selectedBlokFilter}
                  onChange={(e) => setSelectedBlokFilter(e.target.value)}
                  className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="ALL">Semua Blok</option>
                  {filterOptions.blocks.map(block => (
                    <option key={block} value={block}>Blok {block}</option>
                  ))}
                </select>
              </div>

              {/* BULAN FILTER */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                  Tapis Bulan
                </label>
                <select
                  value={selectedBulanFilter}
                  onChange={(e) => setSelectedBulanFilter(e.target.value)}
                  className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="ALL">Semua Bulan</option>
                  {filterOptions.months.map(month => (
                    <option key={month} value={month}>{month}</option>
                  ))}
                </select>
              </div>

              {/* RESET FILTERS */}
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setSelectedBlokFilter('ALL');
                    setSelectedBulanFilter('ALL');
                    setAggregationMode('hari');
                  }}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs uppercase tracking-wider rounded-xl border border-slate-200 dark:border-slate-700 transition-all active:scale-95"
                >
                  Set Semula Tapisan
                </button>
              </div>
            </div>
          </div>

          {/* KPI CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900 text-white p-3.5 rounded-2xl border border-slate-800 shadow-md">
              <span className="text-[10px] font-extrabold uppercase text-slate-400">Tandan Di Gred</span>
              <p className="text-2xl font-black text-emerald-400 mt-1">{analyticsStats.tandanDiGred.toLocaleString()}</p>
              <p className="text-[9px] text-slate-400 mt-0.5">daripada {analyticsStats.platformCount} platform</p>
            </div>

            <div className="bg-slate-900 text-white p-3.5 rounded-2xl border border-slate-800 shadow-md">
              <span className="text-[10px] font-extrabold uppercase text-slate-400">Tandan Di Tinggal / Reject</span>
              <p className="text-2xl font-black text-rose-400 mt-1">{analyticsStats.tandanDiTinggal.toLocaleString()}</p>
              <p className="text-[9px] text-rose-400 mt-0.5 font-bold">kadar: {analyticsStats.pctTinggal.toFixed(1)}%</p>
            </div>

            <div className="bg-slate-900 text-white p-3.5 rounded-2xl border border-slate-800 shadow-md">
              <span className="text-[10px] font-extrabold uppercase text-slate-400">Kadar Masak Terbaik</span>
              <p className="text-2xl font-black text-emerald-300 mt-1">{analyticsStats.pctMasak.toFixed(1)}%</p>
              <div className="w-full bg-slate-800 rounded-full h-1 mt-1.5 overflow-hidden">
                <div 
                  className="bg-emerald-400 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, analyticsStats.pctMasak)}%` }}
                />
              </div>
            </div>

            <div className="bg-slate-900 text-white p-3.5 rounded-2xl border border-slate-800 shadow-md">
              <span className="text-[10px] font-extrabold uppercase text-slate-400">Tandan Di Bawa</span>
              <p className="text-2xl font-black text-sky-400 mt-1">{analyticsStats.tandanDiBawa.toLocaleString()}</p>
              <p className="text-[9px] text-slate-400 mt-0.5">sedia untuk diangkut lori</p>
            </div>
          </div>

          {/* ALL CRITERIA SUMMARY GRID */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={15} className="text-emerald-500" />
                <h4 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider">
                  Rumusan Semua Kriteria Penggredan &amp; Kualiti Mutu
                </h4>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                Jumlah Tandan Di Gred: <strong className="text-emerald-600 dark:text-emerald-400">{analyticsStats.tandanDiGred.toLocaleString()}</strong> tandan
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
              {/* REJECT: MUDA */}
              <div className="p-2.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase text-rose-600 dark:text-rose-400">Muda (Reject)</span>
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300">
                    {analyticsStats.pctMuda.toFixed(1)}%
                  </span>
                </div>
                <p className="text-lg font-black text-rose-700 dark:text-rose-300 mt-1">
                  {analyticsStats.rejectMuda.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">tandan</span>
                </p>
              </div>

              {/* REJECT: PERAM */}
              <div className="p-2.5 rounded-xl bg-pink-50/70 dark:bg-pink-950/20 border border-pink-200/60 dark:border-pink-900/40">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase text-pink-600 dark:text-pink-400">Peram (Reject)</span>
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300">
                    {analyticsStats.pctPeram.toFixed(1)}%
                  </span>
                </div>
                <p className="text-lg font-black text-pink-700 dark:text-pink-300 mt-1">
                  {analyticsStats.rejectPeram.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">tandan</span>
                </p>
              </div>

              {/* PENALTI: MENGKAL */}
              <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase text-amber-700 dark:text-amber-400">Mengkal</span>
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300">
                    {analyticsStats.pctMengkal.toFixed(1)}%
                  </span>
                </div>
                <p className="text-lg font-black text-amber-800 dark:text-amber-300 mt-1">
                  {analyticsStats.penaltiMengkal.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">tandan</span>
                </p>
              </div>

              {/* PENALTI: BUSUK */}
              <div className="p-2.5 rounded-xl bg-red-50/70 dark:bg-red-950/20 border border-red-200/60 dark:border-red-900/40">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase text-red-600 dark:text-red-400">Busuk</span>
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300">
                    {analyticsStats.pctBusuk.toFixed(1)}%
                  </span>
                </div>
                <p className="text-lg font-black text-red-700 dark:text-red-300 mt-1">
                  {analyticsStats.penaltiBusuk.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">tandan</span>
                </p>
              </div>

              {/* PENALTI: KOSONG */}
              <div className="p-2.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase text-slate-600 dark:text-slate-400">Kosong</span>
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    {analyticsStats.pctKosong.toFixed(1)}%
                  </span>
                </div>
                <p className="text-lg font-black text-slate-800 dark:text-slate-200 mt-1">
                  {analyticsStats.penaltiKosong.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">tandan</span>
                </p>
              </div>

              {/* MUTU TINGGI: MASAK */}
              <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400">Masak (Mutu)</span>
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                    {analyticsStats.pctMasak.toFixed(1)}%
                  </span>
                </div>
                <p className="text-lg font-black text-emerald-700 dark:text-emerald-300 mt-1">
                  {analyticsStats.masak.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">tandan</span>
                </p>
              </div>

              {/* PARAMETER: TANGKAI PANJANG */}
              <div className="p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400">T. Panjang</span>
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                    {analyticsStats.pctTangkaiPanjang.toFixed(1)}%
                  </span>
                </div>
                <p className="text-lg font-black text-indigo-700 dark:text-indigo-300 mt-1">
                  {analyticsStats.tangkaiPanjang.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">tandan</span>
                </p>
              </div>

              {/* PARAMETER: LAMA */}
              <div className="p-2.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase text-purple-600 dark:text-purple-400">Lama</span>
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">
                    {analyticsStats.pctLama.toFixed(1)}%
                  </span>
                </div>
                <p className="text-lg font-black text-purple-700 dark:text-purple-300 mt-1">
                  {analyticsStats.lama.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">tandan</span>
                </p>
              </div>

              {/* PARAMETER: KOTOR */}
              <div className="p-2.5 rounded-xl bg-yellow-50/70 dark:bg-yellow-950/20 border border-yellow-200/60 dark:border-yellow-900/40">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase text-yellow-700 dark:text-yellow-400">Kotor</span>
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300">
                    {analyticsStats.pctKotor.toFixed(1)}%
                  </span>
                </div>
                <p className="text-lg font-black text-yellow-800 dark:text-yellow-300 mt-1">
                  {analyticsStats.kotor.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">tandan</span>
                </p>
              </div>

              {/* PARAMETER: DURA */}
              <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase text-amber-700 dark:text-amber-500">Dura</span>
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300">
                    {analyticsStats.pctDura.toFixed(1)}%
                  </span>
                </div>
                <p className="text-lg font-black text-amber-800 dark:text-amber-300 mt-1">
                  {analyticsStats.dura.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">tandan</span>
                </p>
              </div>

              {/* PARAMETER: SERANGAN TIKUS */}
              <div className="p-2.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase text-slate-600 dark:text-slate-400">Sg. Tikus</span>
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    {analyticsStats.pctSeranganTikus.toFixed(1)}%
                  </span>
                </div>
                <p className="text-lg font-black text-slate-800 dark:text-slate-200 mt-1">
                  {analyticsStats.seranganTikus.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">tandan</span>
                </p>
              </div>
            </div>
          </div>

          {/* RECHARTS CHARTS */}
          {filteredSessions.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* TREND LINE CHART */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                  <h4 className="text-xs font-black uppercase text-slate-800 dark:text-white tracking-wider flex items-center gap-1.5">
                    <Calendar size={14} className="text-emerald-500" />
                    Trend Kualiti Tandan (%)
                  </h4>
                  <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded font-bold">
                    Had 10 Sesi Terakhir
                  </span>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" className="dark:stroke-slate-800" />
                      <XAxis dataKey="label" stroke="#94A3B8" fontSize={9} tickLine={false} />
                      <YAxis stroke="#94A3B8" fontSize={9} tickLine={false} unit="%" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#0F172A', 
                          border: 'none', 
                          borderRadius: '8px', 
                          color: '#FFFFFF',
                          fontSize: '11px',
                          fontWeight: 'bold'
                        }} 
                      />
                      <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                      <Line type="monotone" dataKey="Masak (%)" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="Tinggal (%)" stroke="#EF4444" strokeWidth={2} dot={{ r: 2 }} />
                      <Line type="monotone" dataKey="Mengkal (%)" stroke="#F97316" strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
                      <Line type="monotone" dataKey="Muda (%)" stroke="#F43F5E" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                      <Line type="monotone" dataKey="T.Panjang (%)" stroke="#6366F1" strokeWidth={1.5} dot={false} />
                      <Line type="monotone" dataKey="Lama (%)" stroke="#8B5CF6" strokeWidth={1.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* PENALTY BREAKDOWN BAR CHART */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                  <h4 className="text-xs font-black uppercase text-slate-800 dark:text-white tracking-wider flex items-center gap-1.5">
                    <SlidersHorizontal size={14} className="text-rose-500" />
                    Pecahan Parameter Reject &amp; Penalti (Tandan)
                  </h4>
                  <span className="text-[10px] bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded font-bold">
                    Semua Rekod Ditapis
                  </span>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={penaltyBreakdownData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" className="dark:stroke-slate-800" />
                      <XAxis dataKey="name" stroke="#94A3B8" fontSize={9} tickLine={false} />
                      <YAxis stroke="#94A3B8" fontSize={9} tickLine={false} />
                      <Tooltip 
                        formatter={(value: any, name: any, item: any) => [`${value} tandan (${item.payload.peratus}%)`, name]}
                        contentStyle={{ 
                          backgroundColor: '#0F172A', 
                          border: 'none', 
                          borderRadius: '8px', 
                          color: '#FFFFFF',
                          fontSize: '11px',
                          fontWeight: 'bold'
                        }} 
                      />
                      <Bar dataKey="jumlah" radius={[4, 4, 0, 0]}>
                        {penaltyBreakdownData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 text-center space-y-3">
              <BarChart3 size={36} className="mx-auto text-slate-300 dark:text-slate-600" />
              <div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                  Tiada data analitik ditemui untuk penapis yang dipilih.
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  Sila pastikan rekod telah disimpan ke pangkalan data Supabase atau tukar pilihan penapis blok/bulan.
                </p>
              </div>
              <button
                onClick={() => loadData()}
                disabled={isLoadingHistory}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
              >
                <RefreshCw size={13} className={isLoadingHistory ? 'animate-spin' : ''} />
                {isLoadingHistory ? 'Menyegerak dari Supabase...' : 'Segarkan Data dari Supabase'}
              </button>
            </div>
          )}

          {/* INTERACTIVE TABLE WITH ALL GRADING CRITERIA */}
          {filteredSessions.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 dark:bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black uppercase text-slate-800 dark:text-white tracking-wider">
                    {aggregationMode === 'hari'
                      ? 'Jadual Perincian Harian Blok (Semua Kriteria)'
                      : aggregationMode === 'bulan'
                      ? 'Jadual Perincian Bulanan Blok (Semua Kriteria)'
                      : 'Jadual Rumusan Rekod Mengikut Blok (Semua Kriteria)'}
                  </h4>
                </div>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold uppercase bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200/50 dark:border-emerald-800/40 w-fit">
                  {aggregationMode === 'hari'
                    ? `${dailyData.length} Rekod Harian Ditemui`
                    : aggregationMode === 'bulan'
                    ? `${monthlyData.length} Rekod Bulanan Ditemui`
                    : `${blockData.length} Blok Dinilai (${filteredSessions.length} Sesi Terlibat)`}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1300px]">
                  <thead>
                    <tr className="bg-slate-100/70 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                      <th className="p-3 pl-4 sticky left-0 z-10 bg-slate-100 dark:bg-slate-800">
                        {aggregationMode === 'blok' ? 'Blok' : aggregationMode === 'hari' ? 'Tarikh' : 'Bulan'}
                      </th>
                      <th className="p-3">
                        {aggregationMode === 'blok' ? 'Bil Sesi / Hari' : 'Blok'}
                      </th>
                      <th className="p-3 text-center">Bil Platform</th>
                      <th className="p-3 text-right">Tandan Di Gred</th>
                      <th className="p-3 text-right text-rose-600 dark:text-rose-400">Tandan Di Tinggal</th>
                      <th className="p-3 text-right text-rose-600 dark:text-rose-400">Kadar Reject</th>
                      <th className="p-3 text-right text-sky-600 dark:text-sky-400">Tandan Di Bawa</th>
                      <th className="p-3 text-right text-emerald-600 dark:text-emerald-400">Masak (Tandan)</th>
                      <th className="p-3 text-right text-emerald-600 dark:text-emerald-400">Kadar Masak</th>
                      <th className="p-3 text-right bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400">Muda</th>
                      <th className="p-3 text-right bg-pink-50/50 dark:bg-pink-950/20 text-pink-600 dark:text-pink-400">Peram</th>
                      <th className="p-3 text-right bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400">Mengkal</th>
                      <th className="p-3 text-right bg-red-50/50 dark:bg-red-950/20 text-red-600 dark:text-red-400">Busuk</th>
                      <th className="p-3 text-right text-slate-500 dark:text-slate-400">Kosong</th>
                      <th className="p-3 text-right text-yellow-700 dark:text-yellow-400">Kotor</th>
                      <th className="p-3 text-right text-purple-700 dark:text-purple-400">Lama</th>
                      <th className="p-3 text-right text-amber-800 dark:text-amber-500">Dura</th>
                      <th className="p-3 text-right text-indigo-700 dark:text-indigo-400">T.Panjang</th>
                      <th className="p-3 text-right text-slate-600 dark:text-slate-400">S.Tikus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs font-medium text-slate-700 dark:text-slate-300">
                    {(aggregationMode === 'hari' ? dailyData : aggregationMode === 'bulan' ? monthlyData : blockData).map((row) => {
                      const totalGred = Number(row.tandanDiGred) || 0;
                      const rejectRate = totalGred ? ((row.tandanDiTinggal / totalGred) * 100) : 0;
                      const masakRate = totalGred ? ((row.masak / totalGred) * 100) : 0;

                      return (
                        <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="p-3 pl-4 font-bold text-slate-950 dark:text-slate-100 whitespace-nowrap sticky left-0 z-10 bg-white dark:bg-slate-900">
                            {aggregationMode === 'blok' ? formatBlokDisplay(row.peringkatBlok) : aggregationMode === 'hari' ? row.tarikh : row.bulan}
                          </td>
                          <td className="p-3 font-bold text-slate-900 dark:text-slate-300 whitespace-nowrap">
                            {aggregationMode === 'blok' ? (
                              <span className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded font-bold text-[11px]">
                                {row.sessionCount} Sesi ({row.totalDates} Hari)
                              </span>
                            ) : (
                              formatBlokDisplay(row.peringkatBlok)
                            )}
                          </td>
                          <td className="p-3 text-center font-bold text-slate-600 dark:text-slate-400">
                            {row.platformCount}
                          </td>
                          <td className="p-3 text-right font-bold text-slate-950 dark:text-slate-100">
                            {row.tandanDiGred.toLocaleString()}
                          </td>
                          <td className="p-3 text-right font-bold text-rose-600 dark:text-rose-400">
                            {row.tandanDiTinggal.toLocaleString()}
                          </td>
                          <td className="p-3 text-right font-bold text-rose-600 dark:text-rose-400">
                            {rejectRate.toFixed(1)}%
                          </td>
                          <td className="p-3 text-right font-bold text-sky-600 dark:text-sky-400">
                            {row.tandanDiBawa.toLocaleString()}
                          </td>
                          <td className="p-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {row.masak.toLocaleString()}
                          </td>
                          <td className="p-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {masakRate.toFixed(1)}%
                          </td>
                          <td className={`p-3 text-right font-bold ${row.rejectMuda > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-slate-600'}`}>
                            {row.rejectMuda}
                          </td>
                          <td className={`p-3 text-right font-bold ${row.rejectPeram > 0 ? 'text-pink-600 dark:text-pink-400' : 'text-slate-400 dark:text-slate-600'}`}>
                            {row.rejectPeram}
                          </td>
                          <td className={`p-3 text-right font-bold ${row.penaltiMengkal > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-400 dark:text-slate-600'}`}>
                            {row.penaltiMengkal}
                          </td>
                          <td className={`p-3 text-right font-bold ${row.penaltiBusuk > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-600'}`}>
                            {row.penaltiBusuk}
                          </td>
                          <td className={`p-3 text-right font-bold ${row.penaltiKosong > 0 ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-600'}`}>
                            {row.penaltiKosong}
                          </td>
                          <td className={`p-3 text-right font-bold ${row.kotor > 0 ? 'text-yellow-700 dark:text-yellow-400' : 'text-slate-400 dark:text-slate-600'}`}>
                            {row.kotor}
                          </td>
                          <td className={`p-3 text-right font-bold ${row.lama > 0 ? 'text-purple-700 dark:text-purple-400' : 'text-slate-400 dark:text-slate-600'}`}>
                            {row.lama}
                          </td>
                          <td className={`p-3 text-right font-bold ${row.dura > 0 ? 'text-amber-800 dark:text-amber-400' : 'text-slate-400 dark:text-slate-600'}`}>
                            {row.dura}
                          </td>
                          <td className={`p-3 text-right font-bold ${row.tangkaiPanjang > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-600'}`}>
                            {row.tangkaiPanjang}
                          </td>
                          <td className={`p-3 text-right font-bold ${row.seranganTikus > 0 ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-600'}`}>
                            {row.seranganTikus}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* SUMMARY FOOTER (JUMLAH BESAR) */}
                  <tfoot>
                    <tr className="bg-slate-900 text-white font-black text-[11px] border-t-2 border-slate-700">
                      <td className="p-3 pl-4 sticky left-0 z-10 bg-slate-900 text-emerald-400 whitespace-nowrap">
                        {aggregationMode === 'blok' ? `JUMLAH BESAR (${blockData.length} BLOK)` : 'JUMLAH BESAR'}
                      </td>
                      <td className="p-3 text-center text-slate-300">
                        {aggregationMode === 'blok' ? `${filteredSessions.length} Sesi` : '-'}
                      </td>
                      <td className="p-3 text-center">{analyticsStats.platformCount}</td>
                      <td className="p-3 text-right text-emerald-400">{analyticsStats.tandanDiGred.toLocaleString()}</td>
                      <td className="p-3 text-right text-rose-400">{analyticsStats.tandanDiTinggal.toLocaleString()}</td>
                      <td className="p-3 text-right text-rose-400">{analyticsStats.pctTinggal.toFixed(1)}%</td>
                      <td className="p-3 text-right text-sky-400">{analyticsStats.tandanDiBawa.toLocaleString()}</td>
                      <td className="p-3 text-right text-emerald-300">{analyticsStats.masak.toLocaleString()}</td>
                      <td className="p-3 text-right text-emerald-300">{analyticsStats.pctMasak.toFixed(1)}%</td>
                      <td className="p-3 text-right text-rose-300">{analyticsStats.rejectMuda.toLocaleString()}</td>
                      <td className="p-3 text-right text-pink-300">{analyticsStats.rejectPeram.toLocaleString()}</td>
                      <td className="p-3 text-right text-amber-300">{analyticsStats.penaltiMengkal.toLocaleString()}</td>
                      <td className="p-3 text-right text-red-400">{analyticsStats.penaltiBusuk.toLocaleString()}</td>
                      <td className="p-3 text-right text-slate-300">{analyticsStats.penaltiKosong.toLocaleString()}</td>
                      <td className="p-3 text-right text-yellow-300">{analyticsStats.kotor.toLocaleString()}</td>
                      <td className="p-3 text-right text-purple-300">{analyticsStats.lama.toLocaleString()}</td>
                      <td className="p-3 text-right text-amber-400">{analyticsStats.dura.toLocaleString()}</td>
                      <td className="p-3 text-right text-indigo-300">{analyticsStats.tangkaiPanjang.toLocaleString()}</td>
                      <td className="p-3 text-right text-slate-300">{analyticsStats.seranganTikus.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: RUMUSAN SETIAP BLOK (BLOCK-BY-BLOCK EXECUTIVE SUMMARY) */}
      {activeSubTab === 'rumusan_blok' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {/* HEADER & FILTER CONTROLS */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Boxes className="text-emerald-500" size={18} />
                  Rumusan Kualiti &amp; Prestasi Setiap Blok
                </h3>
                <p className="text-[10px] text-slate-500 mt-1">
                  Kad rumusan eksekutif setiap blok merangkumi jumlah tandan di gred, kadar masak, kadar reject, penalti, serta logistik lori.
                </p>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex items-center gap-2 self-stretch md:self-auto">
                <button
                  onClick={handleExportAnalyticsExcel}
                  disabled={blockData.length === 0}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-black text-[10px] uppercase tracking-wider rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed shrink-0"
                  title="Muat Turun Excel Rumusan Blok"
                >
                  <Download size={13} className="stroke-[2.5]" />
                  <span>Eksport Excel</span>
                </button>
              </div>
            </div>

            {/* QUICK SEARCH & MONTH FILTER */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* SEARCH BLOCK */}
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                  Cari Blok / No Lori / Nama Penggred
                </label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Contoh: 01/02, JGK 1917, GIANTARA..."
                    value={blockCardSearch}
                    onChange={(e) => setBlockCardSearch(e.target.value)}
                    className="w-full text-xs font-bold pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  {blockCardSearch && (
                    <button
                      onClick={() => setBlockCardSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* FILTER BULAN */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                  Tapisan Bulan
                </label>
                <select
                  value={selectedBulanFilter}
                  onChange={(e) => setSelectedBulanFilter(e.target.value)}
                  className="w-full text-xs font-bold px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="ALL">Semua Bulan ({filterOptions.months.length})</option>
                  {filterOptions.months.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* TOP EXECUTIVE OVERVIEW STATS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <Boxes size={20} />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block leading-tight">Jumlah Blok</span>
                <span className="text-base font-black text-slate-900 dark:text-white">{blockData.length} Blok</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/50 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
                <Award size={20} />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block leading-tight">Gred A &amp; B</span>
                <span className="text-base font-black text-sky-600 dark:text-sky-400">
                  {blockData.filter(b => b.qualityGrade === 'A' || b.qualityGrade === 'B').length} Blok
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <AlertCircle size={20} />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block leading-tight">Perlu Perhatian</span>
                <span className="text-base font-black text-rose-600 dark:text-rose-400">
                  {blockData.filter(b => b.qualityGrade === 'C' || b.qualityGrade === 'D').length} Blok
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <TrendingUp size={20} />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block leading-tight">Purata Masak</span>
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                  {analyticsStats.pctMasak.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* CARTA PERBANDINGAN PRESTASI KUALITI SETIAP BLOK */}
          {blockData.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                <h4 className="text-xs font-black uppercase text-slate-800 dark:text-white tracking-wider flex items-center gap-2">
                  <BarChart3 size={15} className="text-emerald-500" />
                  Perbandingan Kadar Masak (%) &amp; Kadar Reject (%) Antara Blok
                </h4>
                <span className="text-[10px] font-bold text-slate-400">
                  {blockData.length} Blok Tersedia
                </span>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={blockData.map(b => ({
                      name: formatBlokDisplay(b.peringkatBlok),
                      'Masak (%)': Number(b.masakPct.toFixed(1)),
                      'Reject (%)': Number(b.rejectPct.toFixed(1)),
                      'Mengkal (%)': Number(b.mengkalPct.toFixed(1)),
                    }))}
                    margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                    <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} tick={{ fontSize: 9, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '0.75rem',
                        color: '#fff',
                        fontSize: '11px',
                        fontWeight: 'bold'
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                    <Bar dataKey="Masak (%)" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Mengkal (%)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Reject (%)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* GRID KAD RUMUSAN SETIAP BLOK */}
          {blockData.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 text-center space-y-2">
              <Boxes size={36} className="mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                Tiada rekod penggredan dijumpai untuk kriteria tapisan ini.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {blockData
                .filter(b => {
                  if (!blockCardSearch.trim()) return true;
                  const q = blockCardSearch.toLowerCase();
                  return (
                    b.peringkatBlok.toLowerCase().includes(q) ||
                    (b.lori && b.lori.toLowerCase().includes(q)) ||
                    (b.penggred && b.penggred.toLowerCase().includes(q))
                  );
                })
                .map((block) => {
                  const isCopiedThis = copiedBlockId === block.id;
                  const isExpanded = expandedBlockSessionsId === block.id;

                  return (
                    <div
                      key={block.id}
                      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
                    >
                      {/* CARD HEADER */}
                      <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/50">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-base font-black text-slate-950 dark:text-white tracking-wide">
                                {formatBlokDisplay(block.peringkatBlok)}
                              </span>
                              <span
                                className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                  block.qualityGrade === 'A'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                                    : block.qualityGrade === 'B'
                                    ? 'bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800'
                                    : block.qualityGrade === 'C'
                                    ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                                    : 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                                }`}
                              >
                                Gred {block.qualityGrade} ({block.qualityLabel})
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                              <span>📅 {block.sessionCount} Sesi ({block.totalDates} Hari)</span>
                              <span>•</span>
                              <span>🏗️ {block.platformCount} Platform</span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Kadar Reject</span>
                            <span
                              className={`text-sm font-black ${
                                block.rejectPct > 5 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'
                              }`}
                            >
                              {block.rejectPct.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* CARD BODY */}
                      <div className="p-4 space-y-3.5 flex-1">
                        {/* 4 QUICK METRICS */}
                        <div className="grid grid-cols-4 gap-2 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
                          <div>
                            <span className="text-[9px] font-bold uppercase text-slate-400 block leading-tight">Di Gred</span>
                            <span className="text-xs font-black text-slate-900 dark:text-white">{block.tandanDiGred}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold uppercase text-sky-500 block leading-tight">Di Bawa</span>
                            <span className="text-xs font-black text-sky-600 dark:text-sky-400">{block.tandanDiBawa}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold uppercase text-emerald-500 block leading-tight">Masak</span>
                            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{block.masak} ({block.masakPct.toFixed(0)}%)</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold uppercase text-rose-500 block leading-tight">Tinggal</span>
                            <span className="text-xs font-black text-rose-600 dark:text-rose-400">{block.tandanDiTinggal}</span>
                          </div>
                        </div>

                        {/* VISUAL COMPOSITION BAR */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-bold text-slate-500">
                            <span>Komposisi Mutu Tandan</span>
                            <span>{block.masakPct.toFixed(1)}% Masak</span>
                          </div>
                          <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                            <div
                              style={{ width: `${Math.min(100, block.masakPct)}%` }}
                              className="bg-emerald-500 h-full"
                              title={`Masak: ${block.masak} tandan (${block.masakPct.toFixed(1)}%)`}
                            />
                            <div
                              style={{ width: `${Math.min(100, block.mengkalPct)}%` }}
                              className="bg-amber-400 h-full"
                              title={`Mengkal: ${block.penaltiMengkal} tandan (${block.mengkalPct.toFixed(1)}%)`}
                            />
                            <div
                              style={{ width: `${Math.min(100, block.rejectPct)}%` }}
                              className="bg-rose-500 h-full"
                              title={`Reject: ${block.tandanDiTinggal} tandan (${block.rejectPct.toFixed(1)}%)`}
                            />
                          </div>
                          <div className="flex items-center gap-3 text-[9px] text-slate-400 font-bold pt-0.5">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Masak</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span> Mengkal</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span> Reject</span>
                          </div>
                        </div>

                        {/* PECAHAN PARAMETER KEROSAKAN & PENALTI */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block">
                            Pecahan Kerosakan &amp; Penalti (10 Kriteria):
                          </span>
                          <div className="grid grid-cols-5 gap-1.5 text-center">
                            <div className="bg-rose-50/70 dark:bg-rose-950/30 p-1.5 rounded-lg border border-rose-100 dark:border-rose-900/40">
                              <span className="text-[8px] font-bold text-rose-500 block uppercase">Muda</span>
                              <span className="text-[11px] font-black text-rose-700 dark:text-rose-300">{block.rejectMuda}</span>
                            </div>
                            <div className="bg-pink-50/70 dark:bg-pink-950/30 p-1.5 rounded-lg border border-pink-100 dark:border-pink-900/40">
                              <span className="text-[8px] font-bold text-pink-500 block uppercase">Peram</span>
                              <span className="text-[11px] font-black text-pink-700 dark:text-pink-300">{block.rejectPeram}</span>
                            </div>
                            <div className="bg-amber-50/70 dark:bg-amber-950/30 p-1.5 rounded-lg border border-amber-100 dark:border-amber-900/40">
                              <span className="text-[8px] font-bold text-amber-500 block uppercase">Mengkal</span>
                              <span className="text-[11px] font-black text-amber-700 dark:text-amber-300">{block.penaltiMengkal}</span>
                            </div>
                            <div className="bg-red-50/70 dark:bg-red-950/30 p-1.5 rounded-lg border border-red-100 dark:border-red-900/40">
                              <span className="text-[8px] font-bold text-red-500 block uppercase">Busuk</span>
                              <span className="text-[11px] font-black text-red-700 dark:text-red-300">{block.penaltiBusuk}</span>
                            </div>
                            <div className="bg-slate-100/70 dark:bg-slate-800/40 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                              <span className="text-[8px] font-bold text-slate-500 block uppercase">Kosong</span>
                              <span className="text-[11px] font-black text-slate-700 dark:text-slate-300">{block.penaltiKosong}</span>
                            </div>
                            <div className="bg-yellow-50/70 dark:bg-yellow-950/30 p-1.5 rounded-lg border border-yellow-100 dark:border-yellow-900/40">
                              <span className="text-[8px] font-bold text-yellow-600 block uppercase">Kotor</span>
                              <span className="text-[11px] font-black text-yellow-700 dark:text-yellow-300">{block.kotor}</span>
                            </div>
                            <div className="bg-purple-50/70 dark:bg-purple-950/30 p-1.5 rounded-lg border border-purple-100 dark:border-purple-900/40">
                              <span className="text-[8px] font-bold text-purple-500 block uppercase">Lama</span>
                              <span className="text-[11px] font-black text-purple-700 dark:text-purple-300">{block.lama}</span>
                            </div>
                            <div className="bg-orange-50/70 dark:bg-orange-950/30 p-1.5 rounded-lg border border-orange-100 dark:border-orange-900/40">
                              <span className="text-[8px] font-bold text-orange-500 block uppercase">Dura</span>
                              <span className="text-[11px] font-black text-orange-700 dark:text-orange-300">{block.dura}</span>
                            </div>
                            <div className="bg-indigo-50/70 dark:bg-indigo-950/30 p-1.5 rounded-lg border border-indigo-100 dark:border-indigo-900/40">
                              <span className="text-[8px] font-bold text-indigo-500 block uppercase">T.Pjg</span>
                              <span className="text-[11px] font-black text-indigo-700 dark:text-indigo-300">{block.tangkaiPanjang}</span>
                            </div>
                            <div className="bg-slate-100/70 dark:bg-slate-800/40 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                              <span className="text-[8px] font-bold text-slate-500 block uppercase">S.Tikus</span>
                              <span className="text-[11px] font-black text-slate-700 dark:text-slate-300">{block.seranganTikus}</span>
                            </div>
                          </div>
                        </div>

                        {/* LOGISTICS INFO */}
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50/80 dark:bg-slate-800/30 p-2 rounded-xl border border-slate-100 dark:border-slate-800 space-y-0.5">
                          <div className="truncate">
                            <span className="font-bold text-slate-600 dark:text-slate-300">🚚 Lori:</span> {block.lori || '-'}
                          </div>
                          <div className="truncate">
                            <span className="font-bold text-slate-600 dark:text-slate-300">👷 Penggred:</span> {block.penggred || '-'}
                          </div>
                        </div>

                        {/* EXPANDED SESSIONS PREVIEW (IF TOGGLED) */}
                        {isExpanded && (
                          <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2 animate-in fade-in duration-200">
                            <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 block">
                              Senarai {block.sessions.length} Sesi Terlibat:
                            </span>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                              {block.sessions.map((s: BlockGradingSession, idx: number) => {
                                const sGred = s.platforms.reduce((a, b) => a + Number(b.tandanDiGred || 0), 0);
                                const sTinggal = s.platforms.reduce((a, b) => a + Number(b.tandanDiTinggal || 0), 0);
                                const sMasak = s.platforms.reduce((a, b) => a + Number(b.masak || 0), 0);
                                return (
                                  <div
                                    key={s.id || idx}
                                    className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] flex justify-between items-center"
                                  >
                                    <div>
                                      <span className="font-bold text-slate-800 dark:text-slate-200">{s.tarikh}</span>
                                      <span className="text-slate-400 ml-1.5">({s.noLori || '-'})</span>
                                    </div>
                                    <div className="text-right">
                                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{sMasak} M</span>
                                      <span className="text-slate-300 dark:text-slate-600 mx-1">/</span>
                                      <span className="font-bold text-rose-500">{sTinggal} Tgl</span>
                                      <span className="text-slate-400 ml-1">({sGred} Gred)</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* CARD FOOTER ACTIONS */}
                      <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setExpandedBlockSessionsId(isExpanded ? null : block.id)}
                          className="text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white flex items-center gap-1 transition-all"
                        >
                          <Eye size={12} />
                          <span>{isExpanded ? 'Tutup Sesi' : 'Perincian Sesi'}</span>
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopyBlockWhatsApp(block)}
                            className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold border border-slate-200 dark:border-slate-700 transition-all active:scale-95 flex items-center gap-1"
                            title="Salin Mesej Rumusan WhatsApp"
                          >
                            {isCopiedThis ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                            <span>{isCopiedThis ? 'Disalin' : 'Salin'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleShareBlockWhatsApp(block)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 flex items-center gap-1 shadow-sm"
                            title="Hantar Rumusan Blok ke WhatsApp"
                          >
                            <Send size={11} />
                            <span>WhatsApp</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 4: SEJARAH REKOD */}
      {activeSubTab === 'sejarah' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <History size={16} className="text-emerald-500" />
              Sejarah Rekod Penggredan Supabase ({historySessions.length})
            </h3>

            <button
              onClick={async () => {
                setIsLoadingHistory(true);
                const reloaded = await penggredanService.getSessions();
                setHistorySessions(reloaded);
                setIsLoadingHistory(false);
                if (onShowToast) onShowToast('success', 'Rekod Supabase diperbaharui!');
              }}
              className="px-2.5 py-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 rounded-lg text-[10px] font-bold text-slate-700 dark:text-slate-300"
            >
              Muat Semula
            </button>
          </div>

          {isLoadingHistory ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 text-center space-y-2">
              <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-500">Memuatkan rekod dari Supabase...</p>
            </div>
          ) : historySessions.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 text-center space-y-2">
              <ClipboardCheck size={36} className="mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                Tiada rekod sejarah disimpan setakat ini.
              </p>
              <button
                onClick={() => setActiveSubTab('borang')}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider mt-2 inline-block"
              >
                Mula Menggred Sekarang
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedHistorySessions).map(([dateKey, sessionList]) => {
                const sessions = sessionList as BlockGradingSession[];
                return (
                <div key={dateKey} className="space-y-2">
                  {/* Tarikh Header */}
                  <div className="flex items-center gap-2 px-1">
                    <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                      <Calendar size={11} />
                      {dateKey}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      ({sessions.length} rekod)
                    </span>
                  </div>

                  {/* Sebaris Setiap Sejarah - Compact Layout */}
                  <div className="space-y-1">
                    {sessions.map((session) => {
                      const totalGred = session.platforms.reduce((a, b) => a + Number(b.tandanDiGred || 0), 0);
                      const totalTinggal = session.platforms.reduce((a, b) => a + Number(b.tandanDiTinggal || 0), 0);
                      const totalMasak = session.platforms.reduce((a, b) => a + Number(b.masak || 0), 0);
                      const totalMuda = session.platforms.reduce((a, b) => a + Number(b.rejectMuda || 0), 0);

                      return (
                        <div
                          key={session.id}
                          className="bg-white dark:bg-slate-900 rounded-lg px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-1.5 hover:border-emerald-500/40 transition-colors"
                        >
                          {/* Left: Info + Stats in tight layout */}
                          <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                            {/* Line 1 / Part 1: Blok, Lori, Penggred */}
                            <div className="flex items-center gap-1 text-[11px] truncate">
                              <span className="font-black text-slate-900 dark:text-white uppercase text-xs shrink-0">
                                {formatBlokDisplay(session.peringkatBlok)}
                              </span>
                              <span className="text-slate-300 dark:text-slate-700">&bull;</span>
                              <span className="font-bold text-slate-700 dark:text-slate-300 uppercase shrink-0">
                                {session.noLori}
                              </span>
                              <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">&bull;</span>
                              <span className="text-slate-400 text-[10px] truncate hidden sm:inline" title={session.namaPenggred}>
                                {session.namaPenggred}
                              </span>
                            </div>

                            {/* Line 2 / Part 2: Stat Ringkas Tight */}
                            <div className="flex items-center gap-1.5 text-[9px] font-bold bg-slate-50 dark:bg-slate-800/80 px-2 py-0.5 rounded border border-slate-100 dark:border-slate-800/50 w-fit shrink-0">
                              <span className="text-slate-400">Gred:<strong className="text-slate-800 dark:text-slate-100 font-black ml-0.5">{totalGred}</strong></span>
                              <span className="text-slate-300 dark:text-slate-700">|</span>
                              <span className="text-slate-400">Tgl:<strong className="text-rose-500 font-black ml-0.5">{totalTinggal}</strong></span>
                              <span className="text-slate-300 dark:text-slate-700">|</span>
                              <span className="text-slate-400">Msk:<strong className="text-emerald-500 font-black ml-0.5">{totalMasak}</strong></span>
                              <span className="text-slate-300 dark:text-slate-700">|</span>
                              <span className="text-slate-400">Mda:<strong className="text-amber-500 font-black ml-0.5">{totalMuda}</strong></span>
                            </div>
                          </div>

                          {/* Right: Actions */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => {
                                setCurrentSessionId(session.id);
                                setSessionHeader({
                                  tajuk: session.tajuk,
                                  program: session.program,
                                  jenisGrading: session.jenisGrading,
                                  tarikh: session.tarikh,
                                  ladang: session.ladang,
                                  peringkatBlok: session.peringkatBlok,
                                  noLori: session.noLori,
                                  namaPenggred: session.namaPenggred
                                });
                                setSubmittedPlatforms(session.platforms);
                                setActiveSubTab('borang');
                                setTimeout(() => {
                                  const elem = document.getElementById('rumusan-section');
                                  if (elem) elem.scrollIntoView({ behavior: 'smooth' });
                                }, 100);
                              }}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all"
                              title="Buka & Kongsi Laporan"
                            >
                              <Share2 size={10} />
                              <span>Kongsi</span>
                            </button>

                            <button
                              onClick={() => handleDeleteHistory(session.id)}
                              className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors"
                              title="Padam Rekod"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
