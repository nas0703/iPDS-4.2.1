import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileSpreadsheet, ClipboardCheck, Edit3, Calendar, Search, 
  Trash2, Plus, Info, Check, X, AlertCircle, Share2, Printer, MessageCircle,
  Eye, ShieldCheck, Clock, CheckSquare, UserCheck
} from 'lucide-react';
import { MASTER_DATA, ABW_DATA, MONTHLY_TARGETS_2026 } from '../../../utils/constants';
import { getActiveEstateId, ESTATE_CHANGED_EVENT } from '../../../utils/estateContext';
import { getEstateConfig, normalizeEstateId } from '../../../config/estateRegistry';
import { offlineStore } from '../../../utils/offlineStore';
import { employeeMasterService } from '../../pekerja/services/employeeMasterService';
import { EmployeeMaster } from '../../pekerja/types/employeeMaster';
import { safeFetch } from '../../../utils/safeFetch';
import { saveBacklogHistoryLocally, getInitialBacklogForEstate } from '../utils/backlogStorage';

const getAuthHeaders = (estateId: string) => {
  const token = typeof window !== 'undefined'
    ? (sessionStorage.getItem('ipds_token') || localStorage.getItem('ipds_token') || localStorage.getItem('ipds_auth_token') || '')
    : '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-estate-id': estateId
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

interface BacklogRecord {
  pus1_mula: string;
  pus1_tamat: string;
  pus2_mula: string;
  pus2_tamat: string;
  hektar_siap: number;
  capai_tandan: number;
  backlog_diladang: number;
  catatan: string;
  bil_buruh?: number;
  tandan_harian?: number;
  custom_abw?: number;
  pus1_mula_default?: string;
  pus1_tamat_default?: string;
  isCarriedFromLastMonth?: boolean;
  carriedFromDate?: string;
  originalBacklogCarried?: number;
}

export interface BlockConfig {
  id: string;
  label: string;
  group: string;
  pkt: string; // '001', '002', '003', '004'
  defaultBuruh: number;
  defaultHektar: number;
  defaultTandanHarian: number;
  defaultAbw: number;
}

// Fixed block structure for Tunggal
const BLOCKS_CONFIG_TUNGGAL: BlockConfig[] = [
  // ADIB Group (1A)
  { id: "1", label: "1", group: "ADIB", pkt: "001", defaultBuruh: 3, defaultHektar: 72.15, defaultTandanHarian: 219, defaultAbw: 23.00 },
  { id: "2", label: "2", group: "ADIB", pkt: "001", defaultBuruh: 3, defaultHektar: 68.37, defaultTandanHarian: 360, defaultAbw: 23.01 },
  { id: "3", label: "3", group: "ADIB", pkt: "001", defaultBuruh: 3, defaultHektar: 76.59, defaultTandanHarian: 330, defaultAbw: 23.00 },
  { id: "5", label: "5", group: "ADIB", pkt: "001", defaultBuruh: 0, defaultHektar: 60.19, defaultTandanHarian: 198, defaultAbw: 23.00 },
  { id: "6", label: "6", group: "ADIB", pkt: "001", defaultBuruh: 3, defaultHektar: 80.42, defaultTandanHarian: 230, defaultAbw: 24.97 },
  { id: "7", label: "7", group: "ADIB", pkt: "001", defaultBuruh: 4, defaultHektar: 89.46, defaultTandanHarian: 250, defaultAbw: 22.98 },
  
  // ARIL Group (1B)
  { id: "4", label: "4", group: "ARIL", pkt: "001", defaultBuruh: 4, defaultHektar: 92.39, defaultTandanHarian: 250, defaultAbw: 24.05 },
  { id: "8", label: "8", group: "ARIL", pkt: "001", defaultBuruh: 2, defaultHektar: 82.03, defaultTandanHarian: 280, defaultAbw: 23.00 },
  { id: "9", label: "9", group: "ARIL", pkt: "001", defaultBuruh: 3, defaultHektar: 83.61, defaultTandanHarian: 274, defaultAbw: 23.00 },
  { id: "10", label: "10", group: "ARIL", pkt: "001", defaultBuruh: 3, defaultHektar: 84.36, defaultTandanHarian: 259, defaultAbw: 23.01 },
  { id: "11", label: "11", group: "ARIL", pkt: "001", defaultBuruh: 2, defaultHektar: 47.85, defaultTandanHarian: 152, defaultAbw: 23.00 },
  { id: "12", label: "12", group: "ARIL", pkt: "001", defaultBuruh: 2, defaultHektar: 76.50, defaultTandanHarian: 233, defaultAbw: 23.00 },
  
  // KIROMIN Group (1C)
  { id: "13", label: "13", group: "KIROMIN", pkt: "001", defaultBuruh: 2, defaultHektar: 50.75, defaultTandanHarian: 225, defaultAbw: 22.38 },
  { id: "14", label: "14", group: "KIROMIN", pkt: "001", defaultBuruh: 4, defaultHektar: 70.45, defaultTandanHarian: 310, defaultAbw: 12.88 },
  { id: "15", label: "15", group: "KIROMIN", pkt: "001", defaultBuruh: 2, defaultHektar: 68.36, defaultTandanHarian: 335, defaultAbw: 23.02 },
  { id: "16", label: "16", group: "KIROMIN", pkt: "001", defaultBuruh: 2, defaultHektar: 64.44, defaultTandanHarian: 220, defaultAbw: 23.01 },
  { id: "17", label: "17", group: "KIROMIN", pkt: "001", defaultBuruh: 4, defaultHektar: 84.08, defaultTandanHarian: 400, defaultAbw: 23.01 },
  
  // wan (PKT 002) Group
  { id: "18", label: "18", group: "wan", pkt: "002", defaultBuruh: 2, defaultHektar: 76.20, defaultTandanHarian: 490, defaultAbw: 18.39 },
  { id: "19", label: "19", group: "wan", pkt: "002", defaultBuruh: 2, defaultHektar: 81.75, defaultTandanHarian: 543, defaultAbw: 13.99 },
  { id: "20", label: "20", group: "wan", pkt: "002", defaultBuruh: 2, defaultHektar: 68.62, defaultTandanHarian: 342, defaultAbw: 18.69 },
  { id: "21", label: "21", group: "wan", pkt: "002", defaultBuruh: 2, defaultHektar: 24.26, defaultTandanHarian: 210, defaultAbw: 14.01 },
  { id: "22", label: "22", group: "wan", pkt: "002", defaultBuruh: 2, defaultHektar: 65.29, defaultTandanHarian: 288, defaultAbw: 14.00 },
  
  // FELDA Groups
  { id: "001LF", label: "001LF", group: "FELDA", pkt: "003", defaultBuruh: 3, defaultHektar: 51.71, defaultTandanHarian: 100, defaultAbw: 22.00 },
  { id: "002LF", label: "002LF", group: "FELDA", pkt: "003", defaultBuruh: 3, defaultHektar: 46.80, defaultTandanHarian: 140, defaultAbw: 15.33 }
];

export function isBlockMatchingCode(blockId: string, assignedCode: string): boolean {
  if (!blockId || !assignedCode) return false;
  const bId = blockId.trim().toUpperCase();
  const aCode = assignedCode.trim().toUpperCase();
  if (bId === aCode) return true;

  const bDigits = bId.replace(/\D/g, '');
  const aDigits = aCode.replace(/\D/g, '');
  if (bDigits && aDigits && parseInt(bDigits, 10) === parseInt(aDigits, 10)) {
    const bLetters = bId.replace(/[^A-Z]/g, '');
    const aLetters = aCode.replace(/[^A-Z]/g, '');
    if (!bLetters || aLetters === bLetters || aLetters === `B${bLetters}`) {
      return true;
    }
  }

  if (aCode === `B${bId}` || `B${aCode}` === bId) return true;
  return false;
}

export function getStaffNameForBlock(
  block: BlockConfig,
  estateId: string,
  employees: EmployeeMaster[]
): string {
  const normEst = normalizeEstateId(estateId);
  const activeStaff = (employees || []).filter(
    e => e.employment_status === 'ACTIVE' && 
         normalizeEstateId(e.current_assignment?.estate_id) === normEst
  );

  // 1. Direct block assignment in Maklumat Asas Staf
  for (const emp of activeStaff) {
    const assignedBlocks = emp.current_assignment?.blocks || [];
    const hasBlock = assignedBlocks.some(b => isBlockMatchingCode(block.id, b.block_code));
    if (hasBlock) {
      return emp.full_name;
    }
  }

  // 2. Division / Supervisor assignment if no direct block match
  const isPkt1 = block.pkt === '001' || block.group === 'ADIB' || block.group === 'ARIL' || block.group === 'KIROMIN' || block.group === 'PKT1';
  const isPkt2 = block.pkt === '002' || block.group === 'wan' || block.group === 'PKT2';

  if (isPkt1) {
    const p1Staff = activeStaff.find(e => 
      e.current_assignment?.division_id?.includes('P1') && 
      (e.position?.code === 'FS' || e.position?.code === 'MDR' || e.position?.category === 'SUPERVISORY')
    ) || activeStaff.find(e => e.current_assignment?.division_id?.includes('P1'));
    if (p1Staff) return p1Staff.full_name;
  }

  if (isPkt2) {
    const p2Staff = activeStaff.find(e => 
      e.current_assignment?.division_id?.includes('P2') && 
      (e.position?.code === 'FS' || e.position?.code === 'MDR' || e.position?.category === 'SUPERVISORY')
    ) || activeStaff.find(e => e.current_assignment?.division_id?.includes('P2'));
    if (p2Staff) return p2Staff.full_name;
  }

  if (block.group === 'FELDA' || block.pkt === '003' || block.pkt === '004' || block.id.includes('F') || block.id === '88') {
    return 'FELDA / PENEROKA';
  }

  // Specific estate sensible fallbacks
  if (normEst === 'FPM_ADELA') {
    return isPkt1 ? 'Borhan bin Kassim' : 'Azman bin Jamil';
  }

  return block.group || 'Penyelia';
}

export function getBlocksConfigForEstate(estateId: string): BlockConfig[] {
  if (estateId === 'FPM_TUNGGAL') {
    return BLOCKS_CONFIG_TUNGGAL;
  }
  const config = getEstateConfig(estateId);
  const blocks = config.blocks || {};
  const list: BlockConfig[] = [];

  const keys = Object.keys(blocks).sort((a, b) => {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });

  keys.forEach(k => {
    const b = blocks[k];
    const num = parseInt(k, 10);
    const pktVal = b.pkt || (num >= 12 && num <= 17 ? '002' : (k.includes('F') || k.includes('Y') || k.includes('V') ? '003' : '001'));
    
    let grp = 'PKT1';
    if (pktVal === '003' || pktVal === '004' || k.includes('F') || k.includes('Y') || k.includes('V') || k === '88' || k.includes('LF')) {
      grp = 'FELDA';
    } else if (pktVal === '002' || (!isNaN(num) && num >= 12)) {
      grp = 'PKT2';
    } else {
      grp = 'PKT1';
    }

    const defaultBuruh = Math.max(2, Math.round(b.luas / 25));
    const defaultTandanHarian = Math.round(b.target_mt * 1.8);
    const defaultAbw = pktVal === '002' ? 16.5 : (pktVal === '003' ? 18.0 : 23.5);

    list.push({
      id: k,
      label: k === '88' ? 'Lot Felda (88)' : k,
      group: grp,
      pkt: pktVal,
      defaultBuruh: b.peneroka > 0 ? Math.max(2, Math.round(b.peneroka / 8)) : defaultBuruh,
      defaultHektar: b.luas,
      defaultTandanHarian,
      defaultAbw
    });
  });

  return list;
}

const LaporanBacklogViewComponent: React.FC = () => {
  const [activeEstate, setActiveEstate] = useState<string>(() => getActiveEstateId());

  const BLOCKS_CONFIG = useMemo(() => getBlocksConfigForEstate(activeEstate), [activeEstate]);

  // Select active date (default to current date)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localToday = new Date(today.getTime() - (offset * 60 * 1000));
    return localToday.toISOString().split('T')[0];
  });
  
  // Backlog state: keyed by date and blockId, isolated per estate
  const [backlogHistory, setBacklogHistory] = useState<Record<string, Record<string, BacklogRecord>>>(() => {
    return getInitialBacklogForEstate(getActiveEstateId());
  });

  // Listen to estate changes
  useEffect(() => {
    const handleEstateChange = (e: any) => {
      const newEstateId = e?.detail?.estateId || getActiveEstateId();
      setActiveEstate(newEstateId);
      setBacklogHistory(getInitialBacklogForEstate(newEstateId));
    };

    if (typeof window !== "undefined") {
      window.addEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
      return () => {
        window.removeEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
      };
    }
  }, []);

  // Maklumat Asas Staf link & reactive state
  const [employees, setEmployees] = useState<EmployeeMaster[]>([]);

  useEffect(() => {
    let isMounted = true;
    const loadStaff = async () => {
      try {
        const list = await employeeMasterService.getEmployees();
        if (isMounted && Array.isArray(list)) {
          setEmployees(list);
        }
      } catch (err) {
        console.error('Error loading employees for backlog report:', err);
      }
    };
    loadStaff();

    const handleEmployeesChanged = () => {
      loadStaff();
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'ipds_master_employees_v1' || e.key === 'ipds_master_assignments_v1') {
        loadStaff();
      }
    };

    window.addEventListener('ipds_employees_updated', handleEmployeesChanged);
    window.addEventListener('storage', handleStorage);
    window.addEventListener(ESTATE_CHANGED_EVENT, handleEmployeesChanged);

    return () => {
      isMounted = false;
      window.removeEventListener('ipds_employees_updated', handleEmployeesChanged);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(ESTATE_CHANGED_EVENT, handleEmployeesChanged);
    };
  }, [activeEstate]);

  // State to fetch cloud dynamic ABW and map it
  const [cloudAbwHistory, setCloudAbwHistory] = useState<Record<string, Record<string, number[]>>>({});
  const [cloudFeldaAbwHistory, setCloudFeldaAbwHistory] = useState<Record<string, Record<string, number | null>>>({});
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Editing state
  const [editingBlock, setEditingBlock] = useState<BlockConfig | null>(null);
  const [editForm, setEditForm] = useState<BacklogRecord>({
    pus1_mula: "",
    pus1_tamat: "",
    pus2_mula: "",
    pus2_tamat: "",
    hektar_siap: 0,
    capai_tandan: 0,
    backlog_diladang: 0,
    catatan: "",
    bil_buruh: 0,
    tandan_harian: 0,
    custom_abw: 0
  });

  // Alert dismiss helper
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Load backlog data and dynamic ABW calculations from backend
  useEffect(() => {
    const loadData = async () => {
      try {
        // First check IndexedDB offline storage for immediate cache
        const offlineData = await offlineStore.getItem<Record<string, Record<string, BacklogRecord>>>(`fpm_backlog_history_${activeEstate}`, {});
        if (offlineData && Object.keys(offlineData).length > 0) {
          setBacklogHistory(prev => ({ ...prev, ...offlineData }));
        }

        // Fetch backlog history for active estate
        const backlogRes = await safeFetch(`/api/hasil/backlog?estate_id=${encodeURIComponent(activeEstate)}`, {
          headers: getAuthHeaders(activeEstate)
        });
        const isBacklogJson = backlogRes.headers.get("content-type")?.includes("application/json");
        if (backlogRes.ok && isBacklogJson) {
          const backlogJson = await backlogRes.json();
          if (backlogJson.backlogHistory && Object.keys(backlogJson.backlogHistory).length > 0) {
            setBacklogHistory(prev => {
              const merged = { ...prev, ...backlogJson.backlogHistory };
              void saveBacklogHistoryLocally(activeEstate, merged);
              return merged;
            });
          }
        } else {
          console.warn(`Backlog API returned non-JSON response or error (${backlogRes.status})`);
        }

        // Fetch dynamic ABW calculations
        const abwRes = await safeFetch("/api/hasil/abw", {
          headers: getAuthHeaders(activeEstate)
        });
        const isAbwJson = abwRes.headers.get("content-type")?.includes("application/json");
        if (abwRes.ok && isAbwJson) {
          const abwJson = await abwRes.json();
          if (abwJson.abwHistory) setCloudAbwHistory(abwJson.abwHistory);
          if (abwJson.feldaAbwHistory) setCloudFeldaAbwHistory(abwJson.feldaAbwHistory);
        } else {
          console.warn(`ABW API returned non-JSON response or error (${abwRes.status})`);
        }

      } catch (err) {
        console.error("Failed to load backlog or ABW data from API. Using offline copy.", err);
      } finally {
        setIsDataLoaded(true);
      }
    };
    loadData();
  }, [activeEstate]);

  // Save backlog to local and sync to Supabase Cloud
  const saveAndSync = async (updatedHistory: Record<string, Record<string, BacklogRecord>>) => {
    try {
      await saveBacklogHistoryLocally(activeEstate, updatedHistory);
    } catch (e) {
      console.warn("[LaporanBacklogView] Storage sync notice:", e);
    }

    setIsSyncing(true);
    try {
      const res = await safeFetch("/api/hasil/backlog", {
        method: "POST",
        headers: getAuthHeaders(activeEstate),
        body: JSON.stringify({ backlogHistory: updatedHistory, estate_id: activeEstate })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.backlogHistory) {
          setBacklogHistory(json.backlogHistory);
        }
      } else {
        console.warn("Sync backlog failed with status:", res.status);
      }
    } catch (e) {
      console.error("Sync backlog fail (offline mode active):", e);
    } finally {
      setIsSyncing(false);
    }
  };

  // Get approval and seen status for current selected date
  const approvalStatus = useMemo(() => {
    const dayData = backlogHistory[selectedDate] || {};
    return (dayData.approval as {
      seenByFc?: boolean;
      seenByFcAt?: string;
      approvedByManager?: boolean;
      approvedByManagerAt?: string;
    }) || { seenByFc: false, approvedByManager: false };
  }, [backlogHistory, selectedDate]);

  const handleToggleSeenByFc = async () => {
    const current = approvalStatus.seenByFc;
    const updatedHistory = { ...backlogHistory };
    if (!updatedHistory[selectedDate]) {
      updatedHistory[selectedDate] = {};
    }
    
    updatedHistory[selectedDate] = {
      ...updatedHistory[selectedDate],
      approval: {
        ...(updatedHistory[selectedDate].approval as any || {}),
        seenByFc: !current,
        seenByFcAt: !current ? new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('ms-MY') : undefined,
      }
    };
    
    setBacklogHistory(updatedHistory);
    await saveAndSync(updatedHistory);
    setToastMessage({
      type: 'success',
      text: !current ? 'Laporan telah ditandakan DISEMAK OLEH ASST. FIELD CONTROLLER.' : 'Tanda DISEMAK OLEH ASST. FIELD CONTROLLER telah dibatalkan.'
    });
  };

  const handleToggleApproved = async () => {
    const current = approvalStatus.approvedByManager;
    const updatedHistory = { ...backlogHistory };
    if (!updatedHistory[selectedDate]) {
      updatedHistory[selectedDate] = {};
    }
    
    updatedHistory[selectedDate] = {
      ...updatedHistory[selectedDate],
      approval: {
        ...(updatedHistory[selectedDate].approval as any || {}),
        approvedByManager: !current,
        approvedByManagerAt: !current ? new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('ms-MY') : undefined,
      }
    };
    
    setBacklogHistory(updatedHistory);
    await saveAndSync(updatedHistory);
    setToastMessage({
      type: 'success',
      text: !current ? 'Laporan telah DISAHKAN OLEH FIELD CONTROLLER.' : 'Tanda DISAHKAN OLEH FIELD CONTROLLER telah dibatalkan.'
    });
  };

  // Map Selected Date to ABW Month key ("Jan", "Feb", etc.)
  const activeAbwMonth = useMemo(() => {
    if (!selectedDate || typeof selectedDate !== 'string') return 'Mei';
    const parts = selectedDate.split("-");
    const monthIndex = parts[1] ? parseInt(parts[1], 10) - 1 : 5;
    const months = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"];
    return months[monthIndex] || 'Jun';
  }, [selectedDate]);

  // Dynamic look-up of local or cloud ABW per block
  const getDynamicBlockAbw = (blockId: string, customWeightOverride?: number) => {
    if (typeof customWeightOverride === 'number' && customWeightOverride > 0) {
      return customWeightOverride;
    }

    const monthKey = activeAbwMonth;
    
    // Check if it's a FELDA block
    if (blockId === "001LF") {
      const monthWeights = cloudFeldaAbwHistory[monthKey] || {};
      const lots1 = ["8009", "8017", "8016", "7993", "8066", "1811", "8102", "4408", "8165", "4593"]; // 1LF lots
      const validWeights = lots1.map(lot => monthWeights[lot]).filter(w => typeof w === 'number' && w !== null && (w as number) > 0);
      if (validWeights.length > 0) {
        return validWeights.reduce((a, b) => (a || 0) + (b || 0), 0) / validWeights.length;
      }
      return 21.60; // Fallback to Mei weighted average
    }
    
    if (blockId === "002LF") {
      const monthWeights = cloudFeldaAbwHistory[monthKey] || {};
      const lots2 = ["6235", "6226", "6284", "6280", "6206", "6199", "6195", "6172"]; // 2LF lots
      const validWeights = lots2.map(lot => monthWeights[lot]).filter(w => typeof w === 'number' && w !== null && (w as number) > 0);
      if (validWeights.length > 0) {
        return validWeights.reduce((a, b) => (a || 0) + (b || 0), 0) / validWeights.length;
      }
      return 15.33; // Fallback to Mei weighted average
    }

    // For standard blocks (1 to 22)
    const monthData = cloudAbwHistory[monthKey] || {};
    const recordedVals = monthData[blockId] || [];
    const nonZeroVals = recordedVals.filter(v => typeof v === 'number' && v > 0);
    
    if (nonZeroVals.length > 0) {
      return nonZeroVals.reduce((a, b) => a + b, 0) / nonZeroVals.length;
    }

    // Fallback block configuration weights which are pre-aligned with their photo values
    const configWeight = BLOCKS_CONFIG.find(b => b.id === blockId);
    return configWeight ? configWeight.defaultAbw : 20.0;
  };

  // Seed default dataset if date hasn't been initialized yet
  const activeDateRecords = useMemo(() => {
    const getMockRecordForBlock = (blockId: string): BacklogRecord => {
      const b = BLOCKS_CONFIG.find(bc => bc.id === blockId)!;
      const base: BacklogRecord = {
        pus1_mula: "",
        pus1_tamat: "",
        pus1_mula_default: blockId === "1" ? "2026-06-02" : "",
        pus1_tamat_default: "",
        pus2_mula: "",
        pus2_tamat: "",
        hektar_siap: 0,
        capai_tandan: 0,
        backlog_diladang: 0,
        catatan: "",
        bil_buruh: b.defaultBuruh,
        tandan_harian: b.defaultTandanHarian,
        custom_abw: 0
      };

      if (blockId === '1') {
        base.pus1_mula = '2026-06-02'; base.pus1_tamat = '2026-06-18'; base.pus2_mula = '2026-06-19';
        base.hektar_siap = 14.00; base.capai_tandan = 113; base.backlog_diladang = 413;
      } else if (blockId === '2') {
        base.pus1_mula = '2026-06-03'; base.pus1_tamat = '2026-06-14'; base.pus2_mula = '2026-06-15';
        base.hektar_siap = 38.00; base.capai_tandan = 315; base.backlog_diladang = 565;
      } else if (blockId === '3') {
        base.pus1_mula = '2026-06-02'; base.pus1_tamat = '2026-06-14'; base.pus2_mula = '2026-06-17';
        base.hektar_siap = 30.00; base.capai_tandan = 200; base.backlog_diladang = 30;
      } else if (blockId === '5') {
        base.pus1_mula = '2026-06-03'; base.pus1_tamat = '2026-06-13'; base.pus2_mula = '2026-06-18';
        base.hektar_siap = 24.00; base.capai_tandan = 180; base.backlog_diladang = 120;
      } else if (blockId === '6') {
        base.pus1_mula = '2026-06-03'; base.pus1_tamat = '2026-06-13'; base.pus2_mula = '2026-06-17';
        base.hektar_siap = 28.00; base.capai_tandan = 210; base.backlog_diladang = 320;
      } else if (blockId === '7') {
        base.pus1_mula = '2026-06-03'; base.pus1_tamat = '2026-06-15'; base.pus2_mula = '2026-06-16';
        base.hektar_siap = 32.00; base.capai_tandan = 250; base.backlog_diladang = 430;
      } else if (blockId === '4') {
        base.pus1_mula = '2026-06-02'; base.pus1_tamat = '2026-06-17'; base.pus2_mula = '2026-06-18';
        base.hektar_siap = 23.00; base.capai_tandan = 323; base.backlog_diladang = 395;
      } else if (blockId === '8') {
        base.pus1_mula = '2026-06-02'; base.pus1_tamat = '2026-06-13'; base.pus2_mula = '2026-06-15';
        base.hektar_siap = 44.00; base.capai_tandan = 301; base.backlog_diladang = 370;
      } else if (blockId === '9') {
        base.pus1_mula = '2026-06-02'; base.pus1_tamat = '2026-06-16'; base.pus2_mula = '2026-06-17';
        base.hektar_siap = 35.00; base.capai_tandan = 280; base.backlog_diladang = 400;
      } else if (blockId === '10') {
        base.pus1_mula = '2026-06-01'; base.pus1_tamat = '2026-06-14'; base.pus2_mula = '2026-06-15';
        base.hektar_siap = 49.00; base.capai_tandan = 270; base.backlog_diladang = 425;
      } else if (blockId === '11') {
        base.pus1_mula = '2026-06-03'; base.pus1_tamat = '2026-06-15'; base.pus2_mula = '2026-06-16';
        base.hektar_siap = 24.00; base.capai_tandan = 205; base.backlog_diladang = 350;
      } else if (blockId === '12') {
        base.pus1_mula = '2026-06-06'; base.pus1_tamat = '2026-06-16'; base.pus2_mula = '2026-06-17';
        base.hektar_siap = 33.00; base.capai_tandan = 255; base.backlog_diladang = 380;
      } else if (blockId === '13') {
        base.pus1_mula = '2026-06-06'; base.pus1_tamat = '2026-06-16'; base.pus2_mula = '2026-06-20';
        base.hektar_siap = 11.00; base.capai_tandan = 230; base.backlog_diladang = 475;
      } else if (blockId === '14') {
        base.pus1_mula = '2026-06-02'; base.pus1_tamat = '2026-06-13'; base.pus2_mula = '2026-06-17';
        base.hektar_siap = 40.00; base.capai_tandan = 403; base.backlog_diladang = 224;
      } else if (blockId === '15') {
        base.pus1_mula = '2026-06-04'; base.pus1_tamat = '2026-06-15'; base.pus2_mula = '2026-06-18';
        base.hektar_siap = 35.00; base.capai_tandan = 285; base.backlog_diladang = 285;
      } else if (blockId === '16') {
        base.pus1_mula = '2026-06-03'; base.pus1_tamat = '2026-06-14'; base.pus2_mula = '2026-06-18';
        base.hektar_siap = 36.00; base.capai_tandan = 385; base.backlog_diladang = 385;
      } else if (blockId === '17') {
        base.pus1_mula = '2026-06-02'; base.pus1_tamat = '2026-06-13'; base.pus2_mula = '2026-06-14';
        base.hektar_siap = 48.00; base.capai_tandan = 452; base.backlog_diladang = 452;
      } else if (blockId === '18') {
        base.pus1_mula = '2026-06-04'; base.pus1_tamat = '2026-06-15'; base.pus2_mula = '2026-06-18';
        base.hektar_siap = 26.00; base.capai_tandan = 434; base.backlog_diladang = 485;
      } else if (blockId === '19') {
        base.pus1_mula = '2026-06-03'; base.pus1_tamat = '2026-06-13'; base.pus2_mula = '2026-06-18';
        base.hektar_siap = 30.00; base.capai_tandan = 411; base.backlog_diladang = 461;
      } else if (blockId === '20') {
        base.pus1_mula = '2026-06-05'; base.pus1_tamat = '2026-06-18'; base.pus2_mula = '2026-06-19';
        base.hektar_siap = 25.00; base.capai_tandan = 300; base.backlog_diladang = 284;
      } else if (blockId === '21') {
        base.pus1_mula = '2026-06-04'; base.pus1_tamat = '2026-06-10'; base.pus2_mula = '2026-06-19';
        base.hektar_siap = 16.00; base.capai_tandan = 270; base.backlog_diladang = 294;
      } else if (blockId === '22') {
        base.pus1_mula = '2026-06-06'; base.pus1_tamat = '2026-06-16'; base.pus2_mula = '2026-06-19';
        base.hektar_siap = 25.00; base.capai_tandan = 400; base.backlog_diladang = 452;
      } else if (blockId === '001LF') {
        base.pus1_mula = '2026-06-01'; base.pus1_tamat = '2026-06-10'; base.pus2_mula = '2026-06-17';
        base.hektar_siap = 18.00; base.capai_tandan = 160; base.backlog_diladang = 245;
        base.catatan = "tuai di blok 2";
      } else if (blockId === '002LF') {
        base.pus1_mula = '2026-06-11'; base.pus1_tamat = '2026-06-17'; base.pus2_mula = '2026-06-25';
        base.hektar_siap = 46.80; base.capai_tandan = 0; base.backlog_diladang = 0;
      }
      return base;
    };

    const records: Record<string, BacklogRecord> = backlogHistory[selectedDate] || {};
    const merged: Record<string, BacklogRecord & { abw: number }> = {};
    
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localToday = new Date(today.getTime() - (offset * 60 * 1000));
    const todayStr = localToday.toISOString().split('T')[0];

    // Helper to clean record for a new month while carrying over essential continuous data
    const cleanRecordForNewMonth = (priorRec: BacklogRecord, sourceDateStr: string, blockId: string): BacklogRecord => {
      const b = BLOCKS_CONFIG.find(bc => bc.id === blockId)!;
      return {
        pus1_mula: priorRec.pus1_mula || "", // Preserve previous round dates as reference
        pus1_tamat: priorRec.pus1_tamat || "",
        pus1_mula_default: priorRec.pus1_mula_default || (blockId === "1" ? "2026-06-02" : ""),
        pus1_tamat_default: priorRec.pus1_tamat_default || "",
        pus2_mula: priorRec.pus2_mula || "",
        pus2_tamat: priorRec.pus2_tamat || "",
        hektar_siap: priorRec.hektar_siap || 0,
        capai_tandan: 0,
        backlog_diladang: priorRec.backlog_diladang || 0, // Carry forward previous month's ending backlog!
        catatan: priorRec.catatan || "",
        bil_buruh: priorRec.bil_buruh !== undefined ? priorRec.bil_buruh : (b ? b.defaultBuruh : 2),
        tandan_harian: b ? b.defaultTandanHarian : 200, // will be recalculated dynamically below
        custom_abw: priorRec.custom_abw || 0,
        isCarriedFromLastMonth: true,
        carriedFromDate: sourceDateStr,
        originalBacklogCarried: priorRec.backlog_diladang || 0
      };
    };

    BLOCKS_CONFIG.forEach(b => {
      let rec: BacklogRecord;

      if (records[b.id]) {
        rec = { ...records[b.id] };
      } else {
        // Find latest date in backlogHistory before selectedDate that has this block
        const allDates = Object.keys(backlogHistory).sort();
        const priorDates = allDates.filter(d => d < selectedDate);
        let foundPrior = false;

        for (let i = priorDates.length - 1; i >= 0; i--) {
          const priorDate = priorDates[i];
          if (backlogHistory[priorDate] && backlogHistory[priorDate][b.id]) {
            const priorRec = backlogHistory[priorDate][b.id];
            const isNewMonth = priorDate.substring(0, 7) !== selectedDate.substring(0, 7);

            if (isNewMonth) {
              rec = cleanRecordForNewMonth(priorRec, priorDate, b.id);
            } else {
              rec = { ...priorRec };
            }
            foundPrior = true;
            break;
          }
        }

        if (!foundPrior) {
          // If no prior record was saved in database, and selectedDate is on/after 2026-06-22 (for Tunggal only),
          // we use the 2026-06-22 mock dataset as our baseline prior/current!
          if (selectedDate >= '2026-06-22' && activeEstate === 'FPM_TUNGGAL') {
            const mockRec = getMockRecordForBlock(b.id);
            const isNewMonth = selectedDate.substring(0, 7) !== '2026-06';
            if (isNewMonth) {
              rec = cleanRecordForNewMonth(mockRec, '2026-06-30', b.id);
            } else {
              rec = mockRec;
            }
          } else {
            // Default blank baseline for other estates or earlier dates
            rec = {
              pus1_mula: "",
              pus1_tamat: "",
              pus1_mula_default: (activeEstate === 'FPM_TUNGGAL' && b.id === "1") ? "2026-06-02" : "",
              pus1_tamat_default: "",
              pus2_mula: "",
              pus2_tamat: "",
              hektar_siap: 0,
              capai_tandan: 0,
              backlog_diladang: 0,
              catatan: "",
              bil_buruh: b.defaultBuruh,
              tandan_harian: b.defaultTandanHarian,
              custom_abw: 0
            };
          }
        }
      }

      // Jika tarikh yang dipilih adalah esok atau tarikh masa hadapan (kedepan), clearkan capai tandan & backlog tandan
      if (selectedDate > todayStr) {
        rec.capai_tandan = 0;
        rec.backlog_diladang = 0;
      }

      const abwVal = getDynamicBlockAbw(b.id, rec.custom_abw);

      // --- DYNAMIC TANDAN HARIAN TARGET CALCULATION ---
      let monthIdx = 5; // Default to June (0-indexed 5)
      if (selectedDate && typeof selectedDate === 'string' && selectedDate.includes('-')) {
        const parts = selectedDate.split("-");
        if (parts.length >= 2) {
          const parsed = parseInt(parts[1], 10);
          if (!isNaN(parsed)) {
            monthIdx = parsed - 1;
          }
        }
      }

      let pkt = "001";
      let luas = b.defaultHektar;
      if (b.group === "wan") {
        pkt = "002";
      } else if (b.group === "FELDA") {
        pkt = "003";
      }

      if (activeEstate === 'FPM_TUNGGAL' && MASTER_DATA[b.id]) {
        luas = MASTER_DATA[b.id].luas;
        pkt = MASTER_DATA[b.id].pkt;
      }

      const targets = MONTHLY_TARGETS_2026[pkt] || [];
      const targetHek = targets[monthIdx] !== undefined ? targets[monthIdx] : 1.9;

      // Target Ton = targetHek * luas
      const targetMonthlyTonnage = targetHek * luas;

      // Divided by 26 working days
      const targetDailyTonnage = targetMonthlyTonnage / 26;

      // Tonnage to kg
      const targetDailyKg = targetDailyTonnage * 1000;

      // Convert to bunches using dynamic ABW
      const computedTandanHarian = abwVal > 0 ? Math.round(targetDailyKg / abwVal) : b.defaultTandanHarian;

      merged[b.id] = {
        ...rec,
        tandan_harian: computedTandanHarian,
        abw: abwVal
      };
    });

    return merged;
  }, [backlogHistory, selectedDate, cloudAbwHistory, cloudFeldaAbwHistory]);

  // Open modal/edit drawer for a block
  const handleEditClick = (block: BlockConfig) => {
    const record = activeDateRecords[block.id];
    setEditingBlock(block);
    setEditForm({
      pus1_mula: record.pus1_mula || "",
      pus1_tamat: record.pus1_tamat || "",
      pus2_mula: record.pus2_mula || "",
      pus2_tamat: record.pus2_tamat || "",
      hektar_siap: record.hektar_siap || 0,
      capai_tandan: record.capai_tandan || 0,
      backlog_diladang: record.backlog_diladang || 0,
      catatan: record.catatan || "",
      bil_buruh: record.bil_buruh !== undefined ? record.bil_buruh : block.defaultBuruh,
      tandan_harian: record.tandan_harian !== undefined ? record.tandan_harian : block.defaultTandanHarian,
      custom_abw: record.custom_abw || 0
    });
  };

  // Submit edits
  const handleEditSave = () => {
    if (!editingBlock) return;
    
    const updatedDateRecords = {
      ...backlogHistory[selectedDate],
      [editingBlock.id]: editForm
    };

    const updatedHistory = {
      ...backlogHistory,
      [selectedDate]: updatedDateRecords
    };

    setBacklogHistory(updatedHistory);
    saveAndSync(updatedHistory);
    setEditingBlock(null);
    setToastMessage({ type: 'success', text: `Data Backlog Blok ${editingBlock.label} berjaya dikemaskini.` });
  };

  // Grouped Calculations for Rendering summaries (exactly as in Excel screenshot!)
  const stats = useMemo(() => {
    // Pre-calculate monthly to-date sum of capai_tandan & hektar_siap for each block
    const blockMonthlyToDateCapai: Record<string, number> = {};
    const blockMonthlyToDateHektarSiap: Record<string, number> = {};
    const parts = selectedDate.split("-");
    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1];
      const maxDay = parseInt(parts[2], 10);
      
      BLOCKS_CONFIG.forEach(b => {
        let sumCapai = 0;
        let sumHektar = 0;
        for (let day = 1; day <= maxDay; day++) {
          const dateStr = `${year}-${month}-${String(day).padStart(2, '0')}`;
          if (dateStr === selectedDate) {
            // For selectedDate, we MUST use activeDateRecords (which has latest edited changes in active session)
            const rec = activeDateRecords[b.id];
            if (rec) {
              sumCapai += rec.capai_tandan || 0;
              sumHektar += rec.hektar_siap || 0;
            }
          } else {
            const histRec = backlogHistory[dateStr]?.[b.id];
            if (histRec) {
              sumCapai += histRec.capai_tandan || 0;
              sumHektar += histRec.hektar_siap || 0;
            }
          }
        }
        blockMonthlyToDateCapai[b.id] = sumCapai;
        blockMonthlyToDateHektarSiap[b.id] = parseFloat(sumHektar.toFixed(2));
      });
    } else {
      BLOCKS_CONFIG.forEach(b => {
        blockMonthlyToDateCapai[b.id] = 0;
        blockMonthlyToDateHektarSiap[b.id] = 0;
      });
    }

    const defaultGroupStats = () => ({
      buruh: 0,
      hektar: 0,
      hektarSiap: 0,
      tandanHarian: 0,
      capaiTandan: 0,
      backlog: 0,
      anggaranTan: 0,
      monthlyToDateCapai: 0,
      totalAbwWeight: 0,
      blockCount: 0,
      avgAbw: 0
    });

    const groups: Record<string, ReturnType<typeof defaultGroupStats>> = {
      ADIB: defaultGroupStats(),
      ARIL: defaultGroupStats(),
      KIROMIN: defaultGroupStats(),
      wan: defaultGroupStats(),
      FELDA: defaultGroupStats(),
      PKT1: defaultGroupStats(),
      PKT2: defaultGroupStats()
    };

    const pkt1 = defaultGroupStats();
    const pkt2 = defaultGroupStats();
    const felda = defaultGroupStats();

    BLOCKS_CONFIG.forEach(b => {
      const rec = activeDateRecords[b.id] || {
        abw: b.defaultAbw,
        hektar_siap: 0,
        capai_tandan: 0,
        backlog_diladang: 0,
        pus1_mula: "", pus1_tamat: "", pus2_mula: "", pus2_tamat: "", catatan: ""
      };
      
      const buruh = rec.bil_buruh !== undefined ? rec.bil_buruh : b.defaultBuruh;
      const tandanHarian = rec.tandan_harian !== undefined ? rec.tandan_harian : b.defaultTandanHarian;
      const hSiap = rec.hektar_siap || 0;
      const capai = rec.capai_tandan || 0;
      const backlog = rec.backlog_diladang || 0;
      const abwVal = rec.abw || b.defaultAbw;
      const angTan = (backlog * abwVal) / 1000;
      const monthlyToDateCapaiVal = blockMonthlyToDateCapai[b.id] || 0;

      if (!groups[b.group]) {
        groups[b.group] = defaultGroupStats();
      }
      const g = groups[b.group];
      g.buruh += buruh;
      g.hektar += b.defaultHektar;
      g.hektarSiap += hSiap;
      g.tandanHarian += tandanHarian;
      g.capaiTandan += capai;
      g.backlog += backlog;
      g.anggaranTan += angTan;
      g.monthlyToDateCapai += monthlyToDateCapaiVal;
      g.totalAbwWeight += abwVal;
      g.blockCount += 1;

      // Group into PKT 001, PKT 002, or FELDA based on b.pkt
      if (b.pkt === '001') {
        pkt1.buruh += buruh;
        pkt1.hektar += b.defaultHektar;
        pkt1.hektarSiap += hSiap;
        pkt1.tandanHarian += tandanHarian;
        pkt1.capaiTandan += capai;
        pkt1.backlog += backlog;
        pkt1.anggaranTan += angTan;
        pkt1.monthlyToDateCapai += monthlyToDateCapaiVal;
        pkt1.totalAbwWeight += abwVal;
        pkt1.blockCount += 1;
      } else if (b.pkt === '002') {
        pkt2.buruh += buruh;
        pkt2.hektar += b.defaultHektar;
        pkt2.hektarSiap += hSiap;
        pkt2.tandanHarian += tandanHarian;
        pkt2.capaiTandan += capai;
        pkt2.backlog += backlog;
        pkt2.anggaranTan += angTan;
        pkt2.monthlyToDateCapai += monthlyToDateCapaiVal;
        pkt2.totalAbwWeight += abwVal;
        pkt2.blockCount += 1;
      } else {
        felda.buruh += buruh;
        felda.hektar += b.defaultHektar;
        felda.hektarSiap += hSiap;
        felda.tandanHarian += tandanHarian;
        felda.capaiTandan += capai;
        felda.backlog += backlog;
        felda.anggaranTan += angTan;
        felda.monthlyToDateCapai += monthlyToDateCapaiVal;
        felda.totalAbwWeight += abwVal;
        felda.blockCount += 1;
      }
    });

    // Calculate avgAbw for each group
    Object.keys(groups).forEach(gKey => {
      const g = groups[gKey];
      g.avgAbw = g.backlog > 0 ? (g.anggaranTan * 1000) / g.backlog : (g.blockCount > 0 ? g.totalAbwWeight / g.blockCount : 0);
    });

    pkt1.avgAbw = pkt1.backlog > 0 ? (pkt1.anggaranTan * 1000) / pkt1.backlog : (pkt1.blockCount > 0 ? pkt1.totalAbwWeight / pkt1.blockCount : 0);
    pkt2.avgAbw = pkt2.backlog > 0 ? (pkt2.anggaranTan * 1000) / pkt2.backlog : (pkt2.blockCount > 0 ? pkt2.totalAbwWeight / pkt2.blockCount : 0);
    felda.avgAbw = felda.backlog > 0 ? (felda.anggaranTan * 1000) / felda.backlog : (felda.blockCount > 0 ? felda.totalAbwWeight / felda.blockCount : 0);

    // GRAND TOTAL = PKT 001 + PKT 002
    const grand = defaultGroupStats();
    [pkt1, pkt2].forEach(p => {
      grand.buruh += p.buruh;
      grand.hektar += p.hektar;
      grand.hektarSiap += p.hektarSiap;
      grand.tandanHarian += p.tandanHarian;
      grand.capaiTandan += p.capaiTandan;
      grand.backlog += p.backlog;
      grand.anggaranTan += p.anggaranTan;
      grand.monthlyToDateCapai += p.monthlyToDateCapai;
      grand.totalAbwWeight += p.totalAbwWeight;
      grand.blockCount += p.blockCount;
    });
    grand.avgAbw = grand.backlog > 0 ? (grand.anggaranTan * 1000) / grand.backlog : (grand.blockCount > 0 ? grand.totalAbwWeight / grand.blockCount : 0);

    return {
      groups,
      pkt1,
      pkt2,
      felda,
      grand,
      blockMonthlyToDateCapai
    };
  }, [activeDateRecords, backlogHistory, selectedDate, BLOCKS_CONFIG]);

  // Utility to parse standard dates to dd.mm.yyyy layout as per image
  const formatTarikhDmy = (dateStr: string) => {
    if (!dateStr) return "-";
    const pts = dateStr.split("-");
    if (pts.length !== 3) return dateStr;
    return `${pts[2]}.${pts[1]}.${pts[0]}`;
  };

  // Check which round is active based on filled dates
  const calculateActivePus = (rec: BacklogRecord) => {
    if (rec.pus2_mula || rec.pus2_tamat) return 2;
    if (rec.pus1_mula || rec.pus1_tamat) return 1;
    return 2; // Default to 2 loop representation
  };

  const isAdela = activeEstate === 'FPM_ADELA';

  // Generate beautiful WhatsApp message share link
  const whatsappUrl = useMemo(() => {
    const formattedDate = formatTarikhDmy(selectedDate);
    const estateTitle = isAdela ? 'FPM ADELA' : 'FPM TUNGGAL';
    
    let text = `*LAPORAN TANDAN BACKLOG ${estateTitle}*\n` +
      `*Tarikh Laporan:* ${formattedDate}\n\n` +
      `*1. RINGKASAN KESELURUHAN:*\n` +
      `• *Jumlah Backlog:* ${stats.grand.backlog} TBS\n` +
      `• *Anggaran Berat:* ${stats.grand.anggaranTan.toFixed(2)} Tan\n` +
      `• *Jumlah Hektar Siap:* ${stats.grand.hektarSiap.toFixed(2)} / ${stats.grand.hektar.toFixed(2)} Ha\n` +
      `• *Jumlah Buruh:* ${stats.grand.buruh} orang\n\n`;

    if (isAdela) {
      text += `*2. PECAHAN PERINGKAT:*\n` +
        `• *PKT 1 (Blok 1 - 11):* ${stats.pkt1.backlog} TBS (${stats.pkt1.anggaranTan.toFixed(2)} Tan)\n` +
        `• *PKT 2 (Blok 12 - 17):* ${stats.pkt2.backlog} TBS (${stats.pkt2.anggaranTan.toFixed(2)} Tan)\n\n`;
    } else {
      text += `*2. PECAHAN KUMPULAN:*\n` +
        `🟢 *ADIB:* ${stats.groups.ADIB.backlog} TBS (${stats.groups.ADIB.anggaranTan.toFixed(2)} Tan)\n` +
        `🟡 *ARIL:* ${stats.groups.ARIL.backlog} TBS (${stats.groups.ARIL.anggaranTan.toFixed(2)} Tan)\n` +
        `🔵 *KIROMIN:* ${stats.groups.KIROMIN.backlog} TBS (${stats.groups.KIROMIN.anggaranTan.toFixed(2)} Tan)\n` +
        `🟣 *WAN (PKT 2):* ${stats.groups.wan.backlog} TBS (${stats.groups.wan.anggaranTan.toFixed(2)} Tan)\n` +
        `🟠 *FELDA:* ${stats.groups.FELDA.backlog} TBS (${stats.groups.FELDA.anggaranTan.toFixed(2)} Tan)\n\n` +
        `*3. PECAHAN PERINGKAT:*\n` +
        `• *PKT 1 (ADIB/ARIL/KIROMIN):* ${stats.pkt1.backlog} TBS (${stats.pkt1.anggaranTan.toFixed(2)} Tan)\n` +
        `• *PKT 2 (WAN):* ${stats.pkt2.backlog} TBS (${stats.pkt2.anggaranTan.toFixed(2)} Tan)\n\n`;
    }

    text += `Dihantar dari *FPM App - Sistem Laporan Backlog* 🌾`;

    return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  }, [stats, selectedDate, isAdela]);

  interface RenderRowItem {
    block: BlockConfig;
    staffName: string;
    isFirstInStaffGroup: boolean;
    staffRowSpan: number;
  }

  const getRenderRowsForBlocks = (blocks: BlockConfig[]): RenderRowItem[] => {
    const items: RenderRowItem[] = [];
    let i = 0;
    while (i < blocks.length) {
      const currentBlock = blocks[i];
      const currentStaff = getStaffNameForBlock(currentBlock, activeEstate, employees);
      
      let count = 1;
      while (i + count < blocks.length) {
        const nextBlock = blocks[i + count];
        const nextStaff = getStaffNameForBlock(nextBlock, activeEstate, employees);
        if (nextStaff === currentStaff) {
          count++;
        } else {
          break;
        }
      }

      items.push({
        block: currentBlock,
        staffName: currentStaff,
        isFirstInStaffGroup: true,
        staffRowSpan: count
      });

      for (let j = 1; j < count; j++) {
        items.push({
          block: blocks[i + j],
          staffName: currentStaff,
          isFirstInStaffGroup: false,
          staffRowSpan: 0
        });
      }

      i += count;
    }
    return items;
  };

  const renderBlockRow = (item: RenderRowItem) => {
    const { block, staffName, isFirstInStaffGroup, staffRowSpan } = item;
    const rec = activeDateRecords[block.id] || {
      abw: block.defaultAbw,
      hektar_siap: 0,
      capai_tandan: 0,
      backlog_diladang: 0,
      pus1_mula: "", pus1_tamat: "", pus2_mula: "", pus2_tamat: "", catatan: ""
    };
    const activePus = calculateActivePus(rec);
    const pctSiap = block.defaultHektar > 0 ? ((rec.hektar_siap || 0) / block.defaultHektar) * 100 : 0;
    
    const buruh = rec.bil_buruh !== undefined ? rec.bil_buruh : block.defaultBuruh;
    const tandanHarian = rec.tandan_harian !== undefined ? rec.tandan_harian : block.defaultTandanHarian;
    const pctCapai = tandanHarian > 0 ? ((rec.capai_tandan || 0) / tandanHarian) * 100 : 0;
    const angTan = ((rec.backlog_diladang || 0) * (rec.abw || block.defaultAbw)) / 1000;
    const isUpdatedOnDate = !!(backlogHistory[selectedDate] && backlogHistory[selectedDate][block.id]);

    return (
      <tr 
        key={block.id} 
        className={`hover:bg-slate-500/[0.02] transition-colors group cursor-pointer ${
          isUpdatedOnDate ? "bg-emerald-50/30 dark:bg-emerald-950/10" : ""
        }`}
        onClick={() => handleEditClick(block)}
      >
        {isFirstInStaffGroup && (
          <td 
            rowSpan={staffRowSpan} 
            className="px-3 py-3 border-r border-slate-100 dark:border-slate-800 align-middle font-black text-slate-700 dark:text-slate-300 bg-slate-50/30 dark:bg-slate-900/20"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-black uppercase tracking-tight text-slate-800 dark:text-slate-200">
                {staffName}
              </span>
              <span className="text-[7.5px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
                Maklumat Asas Staf
              </span>
            </div>
          </td>
        )}
        <td className={`px-2 py-2.5 font-bold text-center border-r border-slate-100 dark:border-slate-800 transition-all ${
          isUpdatedOnDate 
            ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 font-black" 
            : "bg-slate-500/[0.02] text-slate-700 dark:text-slate-300"
        }`}>
          <div className="flex items-center justify-center gap-1.5">
            {isUpdatedOnDate && <Check size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0 font-black animate-pulse" />}
            <span>{block.label}</span>
          </div>
        </td>
        <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
          {buruh}
        </td>
        <td className="px-3 py-2.5 font-mono text-right border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
          {block.defaultHektar.toFixed(2)}
        </td>
        
        {/* Pus 1 Mula / Tamat */}
        <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
          {formatTarikhDmy(rec.pus1_mula)}
        </td>
        <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
          {formatTarikhDmy(rec.pus1_tamat)}
        </td>
        
        {/* Pus 2 Mula / Tamat */}
        <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
          {formatTarikhDmy(rec.pus2_mula)}
        </td>
        <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
          {formatTarikhDmy(rec.pus2_tamat)}
        </td>
        
        <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300">
          {activePus}
        </td>
        <td className="px-2 py-2.5 font-mono text-right border-r border-slate-100 dark:border-slate-800 font-semibold text-slate-700 dark:text-slate-300">
          {rec.hektar_siap > 0 ? rec.hektar_siap.toFixed(2) : "-"}
        </td>
        <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-500">
          {rec.hektar_siap > 0 ? `${pctSiap.toFixed(2)}%` : "-"}
        </td>
        <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
          {tandanHarian}
        </td>
        <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
          {rec.capai_tandan > 0 ? rec.capai_tandan : "-"}
        </td>
        <td className={`px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 font-bold ${pctCapai >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
          {rec.capai_tandan > 0 ? `${pctCapai.toFixed(2)}%` : "-"}
        </td>
        <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold bg-emerald-500/[0.02] dark:bg-emerald-500/[0.01]">
          {stats.blockMonthlyToDateCapai[block.id] > 0 ? stats.blockMonthlyToDateCapai[block.id] : "-"}
        </td>
        <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-sky-700 dark:text-sky-400 font-bold bg-sky-500/[0.02]">
          {rec.abw ? rec.abw.toFixed(2) : "-"}
        </td>
        
        <td className="px-3 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 font-black text-rose-600 bg-rose-500/[0.02]">
          {rec.backlog_diladang > 0 ? rec.backlog_diladang : "-"}
        </td>
        <td className="px-3 py-2.5 font-mono text-right border-r border-slate-100 dark:border-slate-800 font-black text-rose-700 dark:text-rose-400 bg-rose-500/[0.04]">
          {rec.backlog_diladang > 0 ? angTan.toFixed(2) : "-"}
        </td>
        <td className="px-3 py-2.5 text-slate-500 relative w-44 min-w-[150px] max-w-[176px] break-words whitespace-normal border-r border-slate-100 dark:border-slate-800">
          <div className="flex justify-between items-start gap-1 w-full">
            <span className="italic text-[9px] leading-tight block break-words whitespace-normal">{rec.catatan || "-"}</span>
            <Edit3 size={11} className="opacity-0 group-hover:opacity-100 text-slate-400 transition-opacity ml-1 shrink-0 mt-0.5" />
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6 pb-28">
      {/* HEADER SECTION WITH FILTERS */}
      <div className="bg-white dark:bg-slate-900 rounded-[24px] p-5 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-2xl">
            <FileSpreadsheet size={24} />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">
              Laporan Tandan Backlog
            </h2>
          </div>
        </div>

        {/* Date Selector & Sync Indicators */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800">
            <Calendar size={13} className="text-emerald-500" />
            <span className="text-[9px] font-black uppercase text-slate-400">Tarikh Laporan:</span>
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-black text-slate-700 dark:text-slate-200 border-none focus:ring-0 cursor-pointer p-0 w-28"
            />
          </div>

          <button
            onClick={() => window.print()}
            className="p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-900 text-slate-500 dark:text-slate-400 rounded-xl border border-slate-100 dark:border-slate-800 transition-all"
            title="Cetak Laporan"
          >
            <Printer size={14} />
          </button>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] rounded-xl border border-[#25D366]/20 transition-all flex items-center gap-1.5 font-black text-[10px] uppercase tracking-wider inline-flex"
            title="Kongsi Ringkasan ke WhatsApp"
          >
            <MessageCircle size={14} />
            <span className="hidden sm:inline">WhatsApp</span>
          </a>
          
          {isSyncing && (
            <span className="px-2.5 py-1 text-[8px] font-black uppercase rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse">
              Menyimpan Cloud...
            </span>
          )}
        </div>
      </div>

      {/* ALERT FEEDBACK */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-3 rounded-2xl border text-[10px] font-bold flex items-center gap-2 ${
              toastMessage.type === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-400' 
                : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:border-rose-800 dark:text-rose-400'
            }`}
          >
            <ClipboardCheck size={14} />
            {toastMessage.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* THE MAIN BACKLOG GRID */}
      <div className="bg-white dark:bg-slate-900 rounded-[28px] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden relative">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-[10px] text-left border-collapse min-w-[1200px]">
            <thead>
              {/* Main Headers Row 1 */}
              <tr className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-extrabold border-b border-slate-100 dark:border-slate-800">
                <th rowSpan={2} className="px-3 py-3.5 border-r border-slate-100 dark:border-slate-800 w-28 text-left">
                  STAF / PENYELIA
                  <span className="block text-[8px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">Maklumat Staf</span>
                </th>
                <th rowSpan={2} className="px-2 py-3.5 border-r border-slate-100 dark:border-slate-800 text-center w-12">BLOK</th>
                <th rowSpan={2} className="px-2 py-3.5 border-r border-slate-100 dark:border-slate-800 text-center w-14">BIL BURUH</th>
                <th rowSpan={2} className="px-3 py-3.5 border-r border-slate-100 dark:border-slate-800 text-right w-16">HEKTAR</th>
                <th colSpan={2} className="px-2 py-1.5 border-b border-r border-slate-100 dark:border-slate-800 text-center">PUS 1</th>
                <th colSpan={2} className="px-2 py-1.5 border-b border-r border-slate-100 dark:border-slate-800 text-center">PUS 2</th>
                <th rowSpan={2} className="px-2 py-3.5 border-r border-slate-100 dark:border-slate-800 text-center w-12">PUS</th>
                <th rowSpan={2} className="px-2 py-3.5 border-r border-slate-100 dark:border-slate-800 text-right w-16">HEKTAR SIAP</th>
                <th rowSpan={2} className="px-2 py-3.5 border-r border-slate-100 dark:border-slate-800 text-center w-16">% SIAP PUS</th>
                <th rowSpan={2} className="px-2 py-3.5 border-r border-slate-100 dark:border-slate-800 text-center w-24">
                  TANDAN HARIAN 
                  <span className="block text-[8px] text-slate-400 font-bold">(2.00 TAN)</span>
                </th>
                <th rowSpan={2} className="px-2 py-3.5 border-r border-slate-100 dark:border-slate-800 text-center w-16">CAPAI TANDAN</th>
                <th rowSpan={2} className="px-2 py-3.5 border-r border-slate-100 dark:border-slate-800 text-center w-16">% CAPAI</th>
                <th rowSpan={2} className="px-2 py-3.5 border-r border-slate-100 dark:border-slate-800 text-center w-24 bg-emerald-500/5 dark:bg-emerald-500/5 font-black text-emerald-700 dark:text-emerald-400">
                  TANDAN BULANAN
                  <span className="block text-[8px] text-slate-400 font-bold">(M-TD)</span>
                </th>
                <th rowSpan={2} className="px-2 py-3.5 border-r border-slate-100 dark:border-slate-800 text-center w-20 bg-sky-500/5 dark:bg-sky-500/5 font-black text-sky-700 dark:text-sky-400">
                  ABW (KG)
                  <span className="block text-[8px] text-slate-400 font-bold">(kg/tandan)</span>
                </th>
                <th rowSpan={2} className="px-3 py-3.5 border-r border-slate-100 dark:border-slate-800 text-center w-24 bg-rose-500/5 dark:bg-rose-500/5 font-black text-rose-700 dark:text-rose-400 text-xs">Backlog - Tandan</th>
                <th rowSpan={2} className="px-3 py-3.5 border-r border-slate-100 dark:border-slate-800 text-right w-24 bg-rose-500/10 dark:bg-rose-500/10 font-black text-rose-800 dark:text-rose-300 text-xs">Backlog - Tan</th>
                <th rowSpan={2} className="px-4 py-3.5 w-44">CATATAN / TINDAKAN</th>
              </tr>
              {/* Sub-headers Row 2 */}
              <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 dark:text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                <th className="px-2 py-1 text-center border-r border-slate-100 dark:border-slate-800 w-20">MULA</th>
                <th className="px-2 py-1 text-center border-r border-slate-100 dark:border-slate-800 w-20">TAMAT</th>
                <th className="px-2 py-1 text-center border-r border-slate-100 dark:border-slate-800 w-20">MULA</th>
                <th className="px-2 py-1 text-center border-r border-slate-100 dark:border-slate-800 w-20">TAMAT</th>
              </tr>
            </thead>

            {/* TABLE BODY CONTAINER */}
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/65">
              {isAdela ? (
                <>
                  {/* ADELA: PKT 001 BLOCKS (TANPA 1A, 1B, 1C) */}
                  {getRenderRowsForBlocks(BLOCKS_CONFIG.filter(b => b.pkt === '001')).map(renderBlockRow)}

                  {/* JUMLAH PKT 001 (ADELA) */}
                  <tr className="bg-emerald-500/10 dark:bg-emerald-500/15 font-black text-slate-800 dark:text-slate-100 border-y-2 border-emerald-500/30">
                    <td colSpan={2} className="px-3 py-3 border-r border-emerald-500/20 uppercase tracking-wider text-[11px] font-black text-emerald-950 dark:text-emerald-300">
                      JUMLAH PKT 001
                    </td>
                    <td className="px-2 py-3 font-mono text-center border-r border-emerald-500/20">{stats.pkt1.buruh}</td>
                    <td className="px-3 py-3 font-mono text-right border-r border-emerald-500/20">{stats.pkt1.hektar.toFixed(2)}</td>
                    <td colSpan={4} className="border-r border-emerald-500/20 bg-emerald-500/5"></td>
                    <td className="border-r border-emerald-500/20"></td>
                    <td className="px-2 py-3 font-mono text-right border-r border-emerald-500/20 font-bold">{stats.pkt1.hektarSiap.toFixed(2)}</td>
                    <td className="px-2 py-3 font-mono text-center border-r border-emerald-500/20">
                      {stats.pkt1.hektar > 0 ? `${((stats.pkt1.hektarSiap / stats.pkt1.hektar) * 100).toFixed(2)}%` : "-"}
                    </td>
                    <td className="px-2 py-3 font-mono text-center border-r border-emerald-500/20">{stats.pkt1.tandanHarian}</td>
                    <td className="px-2 py-3 font-mono text-center border-r border-emerald-500/20">{stats.pkt1.capaiTandan}</td>
                    <td className="px-2 py-3 font-mono text-center border-r border-emerald-500/20 font-bold">
                      {stats.pkt1.tandanHarian > 0 ? `${((stats.pkt1.capaiTandan / stats.pkt1.tandanHarian) * 100).toFixed(2)}%` : "-"}
                    </td>
                    <td className="px-2 py-3 font-mono text-center border-r border-emerald-500/20 bg-emerald-500/10 font-black text-emerald-700 dark:text-emerald-400">
                      {stats.pkt1.monthlyToDateCapai > 0 ? stats.pkt1.monthlyToDateCapai : "-"}
                    </td>
                    <td className="px-2 py-3 font-mono text-center border-r border-emerald-500/20 text-sky-800 dark:text-sky-300">
                      {stats.pkt1.avgAbw.toFixed(2)}
                    </td>
                    <td className="px-3 py-3 font-mono text-center border-r border-emerald-500/20 font-black text-rose-700 dark:text-rose-400">
                      {stats.pkt1.backlog > 0 ? stats.pkt1.backlog : "-"}
                    </td>
                    <td className="px-3 py-3 font-mono text-right border-r border-emerald-500/20 font-black text-rose-800 dark:text-rose-300">
                      {stats.pkt1.backlog > 0 ? stats.pkt1.anggaranTan.toFixed(2) : "-"}
                    </td>
                    <td className="px-3 py-3 text-emerald-900/60 dark:text-emerald-400/60 text-[9px] italic">
                      Ringkasan Keseluruhan PKT 001 Ladang Adela
                    </td>
                  </tr>

                  {/* ADELA: PKT 002 BLOCKS */}
                  {getRenderRowsForBlocks(BLOCKS_CONFIG.filter(b => b.pkt === '002')).map(renderBlockRow)}

                  {/* JUMLAH PKT 002 (ADELA) */}
                  <tr className="bg-sky-500/10 dark:bg-sky-500/15 font-black text-slate-800 dark:text-slate-100 border-y-2 border-sky-500/30">
                    <td colSpan={2} className="px-3 py-3 border-r border-sky-500/20 uppercase tracking-wider text-[11px] font-black text-sky-950 dark:text-sky-300">
                      JUMLAH PKT 002
                    </td>
                    <td className="px-2 py-3 font-mono text-center border-r border-sky-500/20">{stats.pkt2.buruh}</td>
                    <td className="px-3 py-3 font-mono text-right border-r border-sky-500/20">{stats.pkt2.hektar.toFixed(2)}</td>
                    <td colSpan={4} className="border-r border-sky-500/20 bg-sky-500/5"></td>
                    <td className="border-r border-sky-500/20"></td>
                    <td className="px-2 py-3 font-mono text-right border-r border-sky-500/20 font-bold">{stats.pkt2.hektarSiap.toFixed(2)}</td>
                    <td className="px-2 py-3 font-mono text-center border-r border-sky-500/20">
                      {stats.pkt2.hektar > 0 ? `${((stats.pkt2.hektarSiap / stats.pkt2.hektar) * 100).toFixed(2)}%` : "-"}
                    </td>
                    <td className="px-2 py-3 font-mono text-center border-r border-sky-500/20">{stats.pkt2.tandanHarian}</td>
                    <td className="px-2 py-3 font-mono text-center border-r border-sky-500/20">{stats.pkt2.capaiTandan}</td>
                    <td className="px-2 py-3 font-mono text-center border-r border-sky-500/20 font-bold">
                      {stats.pkt2.tandanHarian > 0 ? `${((stats.pkt2.capaiTandan / stats.pkt2.tandanHarian) * 100).toFixed(2)}%` : "-"}
                    </td>
                    <td className="px-2 py-3 font-mono text-center border-r border-sky-500/20 bg-sky-500/10 font-black text-sky-700 dark:text-sky-400">
                      {stats.pkt2.monthlyToDateCapai > 0 ? stats.pkt2.monthlyToDateCapai : "-"}
                    </td>
                    <td className="px-2 py-3 font-mono text-center border-r border-sky-500/20 text-sky-800 dark:text-sky-300">
                      {stats.pkt2.avgAbw.toFixed(2)}
                    </td>
                    <td className="px-3 py-3 font-mono text-center border-r border-sky-500/20 font-black text-rose-700 dark:text-rose-400">
                      {stats.pkt2.backlog > 0 ? stats.pkt2.backlog : "-"}
                    </td>
                    <td className="px-3 py-3 font-mono text-right border-r border-sky-500/20 font-black text-rose-800 dark:text-rose-300">
                      {stats.pkt2.backlog > 0 ? stats.pkt2.anggaranTan.toFixed(2) : "-"}
                    </td>
                    <td className="px-3 py-3 text-sky-900/60 dark:text-sky-400/60 text-[9px] italic">
                      Ringkasan Keseluruhan PKT 002 Ladang Adela
                    </td>
                  </tr>

                  {/* JUMLAH KESELURUHAN PKT 001 & PKT 002 (ADELA) */}
                  <tr className="bg-slate-900 text-white dark:bg-emerald-950 dark:text-emerald-100 font-black text-[11px] border-t-2 border-b-4 border-slate-700">
                    <td colSpan={2} className="px-3 py-3.5 border-r border-slate-800 dark:border-emerald-900 uppercase tracking-wider">
                      JUMLAH PKT 001 &amp; PKT 002 (KESELURUHAN)
                    </td>
                    <td className="px-2 py-3.5 font-mono text-center border-r border-slate-800 dark:border-emerald-900 text-emerald-400">{stats.grand.buruh}</td>
                    <td className="px-3 py-3.5 font-mono text-right border-r border-slate-800 dark:border-emerald-900">{stats.grand.hektar.toFixed(2)}</td>
                    <td colSpan={4} className="border-r border-slate-800 dark:border-emerald-900"></td>
                    <td className="border-r border-slate-800 dark:border-emerald-900"></td>
                    <td className="px-2 py-3.5 font-mono text-right border-r border-slate-800 dark:border-emerald-900 text-emerald-400 font-bold">{stats.grand.hektarSiap.toFixed(2)}</td>
                    <td className="px-2 py-3.5 font-mono text-center border-r border-slate-800 dark:border-emerald-900">
                      {stats.grand.hektar > 0 ? `${((stats.grand.hektarSiap / stats.grand.hektar) * 100).toFixed(2)}%` : "-"}
                    </td>
                    <td className="px-2 py-3.5 font-mono text-center border-r border-slate-800 dark:border-emerald-900">{stats.grand.tandanHarian}</td>
                    <td className="px-2 py-3.5 font-mono text-center border-r border-slate-800 dark:border-emerald-900">{stats.grand.capaiTandan}</td>
                    <td className="px-2 py-3.5 font-mono text-center border-r border-slate-800 dark:border-emerald-900">
                      {stats.grand.tandanHarian > 0 ? `${((stats.grand.capaiTandan / stats.grand.tandanHarian) * 100).toFixed(2)}%` : "-"}
                    </td>
                    <td className="px-2 py-3.5 font-mono text-center border-r border-slate-800 dark:border-emerald-900 text-emerald-400 font-black">
                      {stats.grand.monthlyToDateCapai > 0 ? stats.grand.monthlyToDateCapai : "-"}
                    </td>
                    <td className="px-2 py-3.5 font-mono text-center border-r border-slate-800 dark:border-emerald-900 text-sky-400">
                      {stats.grand.avgAbw.toFixed(2)}
                    </td>
                    <td className="px-3 py-3.5 font-mono text-center border-r border-slate-800 dark:border-emerald-900 text-rose-400 text-xs">
                      {stats.grand.backlog > 0 ? stats.grand.backlog : "-"}
                    </td>
                    <td className="px-3 py-3.5 font-mono text-right border-r border-slate-800 dark:border-emerald-900 text-rose-400 text-xs">
                      {stats.grand.backlog > 0 ? stats.grand.anggaranTan.toFixed(2) : "-"}
                    </td>
                    <td className="px-3 py-3.5 text-slate-400 text-[9px] italic">
                      Grand Total Keseluruhan Peringkat Ladang Adela
                    </td>
                  </tr>

                  {/* FELDA BLOCKS (IF ANY IN ADELA) */}
                  {BLOCKS_CONFIG.some(b => b.group === 'FELDA') && (
                    <>
                      {getRenderRowsForBlocks(BLOCKS_CONFIG.filter(b => b.group === 'FELDA')).map(renderBlockRow)}
                      <tr className="bg-amber-500/10 dark:bg-amber-500/15 font-black text-slate-800 dark:text-slate-100 border-y-2 border-amber-500/30">
                        <td colSpan={2} className="px-3 py-3 border-r border-amber-500/20 uppercase tracking-wider text-[11px] font-black text-amber-950 dark:text-amber-300">
                          JUMLAH FELDA
                        </td>
                        <td className="px-2 py-3 font-mono text-center border-r border-amber-500/20">{stats.felda.buruh}</td>
                        <td className="px-3 py-3 font-mono text-right border-r border-amber-500/20">{stats.felda.hektar.toFixed(2)}</td>
                        <td colSpan={4} className="border-r border-amber-500/20 bg-amber-500/5"></td>
                        <td className="border-r border-amber-500/20"></td>
                        <td className="px-2 py-3 font-mono text-right border-r border-amber-500/20 font-bold">{stats.felda.hektarSiap.toFixed(2)}</td>
                        <td className="px-2 py-3 font-mono text-center border-r border-amber-500/20">
                          {stats.felda.hektar > 0 ? `${((stats.felda.hektarSiap / stats.felda.hektar) * 100).toFixed(2)}%` : "-"}
                        </td>
                        <td className="px-2 py-3 font-mono text-center border-r border-amber-500/20">{stats.felda.tandanHarian}</td>
                        <td className="px-2 py-3 font-mono text-center border-r border-amber-500/20">{stats.felda.capaiTandan}</td>
                        <td className="px-2 py-3 font-mono text-center border-r border-amber-500/20 font-bold">
                          {stats.felda.tandanHarian > 0 ? `${((stats.felda.capaiTandan / stats.felda.tandanHarian) * 100).toFixed(2)}%` : "-"}
                        </td>
                        <td className="px-2 py-3 font-mono text-center border-r border-amber-500/20 bg-amber-500/10">
                          {stats.felda.monthlyToDateCapai > 0 ? stats.felda.monthlyToDateCapai : "-"}
                        </td>
                        <td className="px-2 py-3 font-mono text-center border-r border-amber-500/20 text-sky-800 dark:text-sky-300">
                          {stats.felda.avgAbw.toFixed(2)}
                        </td>
                        <td className="px-3 py-3 font-mono text-center border-r border-amber-500/20 font-black text-rose-700 dark:text-rose-400">
                          {stats.felda.backlog > 0 ? stats.felda.backlog : "-"}
                        </td>
                        <td className="px-3 py-3 font-mono text-right border-r border-amber-500/20 font-black text-rose-800 dark:text-rose-300">
                          {stats.felda.backlog > 0 ? stats.felda.anggaranTan.toFixed(2) : "-"}
                        </td>
                        <td className="px-3 py-3 text-amber-900/60 dark:text-amber-400/60 text-[9px] italic">
                          Ringkasan Kawasan FELDA
                        </td>
                      </tr>
                    </>
                  )}
                </>
              ) : (
                <>
                  {/* TUNGGAL: GROUP 1: ADIB */}
                  {BLOCKS_CONFIG.filter(b => b.group === 'ADIB').map((block, idx, arr) => {
                    const rec = activeDateRecords[block.id];
                    const activePus = calculateActivePus(rec);
                    const pctSiap = block.defaultHektar > 0 ? ((rec.hektar_siap || 0) / block.defaultHektar) * 100 : 0;
                    
                    const buruh = rec.bil_buruh !== undefined ? rec.bil_buruh : block.defaultBuruh;
                    const tandanHarian = rec.tandan_harian !== undefined ? rec.tandan_harian : block.defaultTandanHarian;
                    const pctCapai = tandanHarian > 0 ? ((rec.capai_tandan || 0) / tandanHarian) * 100 : 0;
                    const angTan = ((rec.backlog_diladang || 0) * rec.abw) / 1000;
                    const isUpdatedOnDate = !!(backlogHistory[selectedDate] && backlogHistory[selectedDate][block.id]);

                    return (
                      <tr 
                        key={block.id} 
                        className={`hover:bg-slate-500/[0.02] transition-colors group cursor-pointer ${
                          isUpdatedOnDate ? "bg-emerald-50/30 dark:bg-emerald-950/10" : ""
                        }`}
                        onClick={() => handleEditClick(block)}
                      >
                        {idx === 0 && (
                          <td rowSpan={arr.length} className="px-3 py-3 border-r border-slate-100 dark:border-slate-800 align-middle font-black text-slate-700 dark:text-slate-300 bg-slate-50/30 dark:bg-slate-900/20">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[11px] font-black uppercase tracking-tight text-slate-800 dark:text-slate-200">
                                {getStaffNameForBlock(block, activeEstate, employees)}
                              </span>
                              <span className="text-[7.5px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
                                Maklumat Asas Staf
                              </span>
                            </div>
                          </td>
                        )}
                    <td className={`px-2 py-2.5 font-bold text-center border-r border-slate-100 dark:border-slate-800 transition-all ${
                      isUpdatedOnDate 
                        ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 font-black" 
                        : "bg-slate-500/[0.02] text-slate-700 dark:text-slate-300"
                    }`}>
                      <div className="flex items-center justify-center gap-1.5">
                        {isUpdatedOnDate && <Check size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0 font-black animate-pulse" />}
                        <span>{block.label}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                      {buruh}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-right border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                      {block.defaultHektar.toFixed(2)}
                    </td>
                    
                    {/* Pus 1 Mula / Tamat */}
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                      {formatTarikhDmy(rec.pus1_mula)}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                      {formatTarikhDmy(rec.pus1_tamat)}
                    </td>
                    
                    {/* Pus 2 Mula / Tamat */}
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                      {formatTarikhDmy(rec.pus2_mula)}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                      {formatTarikhDmy(rec.pus2_tamat)}
                    </td>
                    
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300">
                      {activePus}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-right border-r border-slate-100 dark:border-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                      {rec.hektar_siap > 0 ? rec.hektar_siap.toFixed(2) : "-"}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-500">
                      {rec.hektar_siap > 0 ? `${pctSiap.toFixed(2)}%` : "-"}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                      {tandanHarian}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                      {rec.capai_tandan > 0 ? rec.capai_tandan : "-"}
                    </td>
                    <td className={`px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 font-bold ${pctCapai >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}`}>
                      {rec.capai_tandan > 0 ? `${pctCapai.toFixed(2)}%` : "-"}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold bg-emerald-500/[0.02] dark:bg-emerald-500/[0.01]">
                      {stats.blockMonthlyToDateCapai[block.id] > 0 ? stats.blockMonthlyToDateCapai[block.id] : "-"}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-sky-700 dark:text-sky-400 font-bold bg-sky-500/[0.02]">
                      {rec.abw ? rec.abw.toFixed(2) : "-"}
                    </td>
                    
                    {/* Backlog items */}
                    <td className="px-3 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 font-black text-rose-600 bg-rose-500/[0.02]">
                      {rec.backlog_diladang > 0 ? rec.backlog_diladang : "-"}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-right border-r border-slate-100 dark:border-slate-800 font-black text-rose-700 dark:text-rose-400 bg-rose-500/[0.04]">
                      {rec.backlog_diladang > 0 ? angTan.toFixed(2) : "-"}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 relative w-44 min-w-[150px] max-w-[176px] break-words whitespace-normal border-r border-slate-100 dark:border-slate-800">
                      <div className="flex justify-between items-start gap-1 w-full">
                        <span className="italic text-[9px] leading-tight block break-words whitespace-normal">{rec.catatan || "-"}</span>
                        <Edit3 size={11} className="opacity-0 group-hover:opacity-100 text-slate-400 transition-opacity ml-1 shrink-0 mt-0.5" />
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* SUMMARY ADIB: 1A (YELLOW ROW) */}
              <tr className="bg-amber-500/10 dark:bg-amber-500/5 font-bold border-y border-amber-500/20">
                <td colSpan={2} className="px-3 py-2 text-right border-r border-amber-500/10 font-black text-amber-800 dark:text-amber-400">
                  1A
                </td>
                <td className="px-2 py-2 text-center font-mono font-black border-r border-amber-500/10 text-slate-700 dark:text-slate-300">
                  {stats.groups.ADIB.buruh}
                </td>
                <td className="px-3 py-2 text-right font-mono font-black border-r border-amber-500/10 text-slate-700 dark:text-slate-300">
                  {stats.groups.ADIB.hektar.toFixed(2)}
                </td>
                <td colSpan={5} className="bg-amber-500/[0.02] border-r border-amber-500/10" />
                <td className="px-2 py-2 text-right font-mono font-black border-r border-amber-500/10 text-slate-700 dark:text-slate-300">
                  {stats.groups.ADIB.hektarSiap > 0 ? stats.groups.ADIB.hektarSiap.toFixed(2) : "-"}
                </td>
                <td className="px-2 py-2 text-center font-mono font-black border-r border-amber-500/10 text-slate-600">
                  {stats.groups.ADIB.hektarSiap > 0 ? `${((stats.groups.ADIB.hektarSiap / stats.groups.ADIB.hektar) * 100).toFixed(2)}%` : "-"}
                </td>
                <td className="px-2 py-2 text-center font-mono font-black border-r border-amber-500/10 text-slate-700 dark:text-slate-300">
                  {stats.groups.ADIB.tandanHarian}
                </td>
                <td className="px-2 py-2 text-center font-mono font-black border-r border-amber-500/10 text-slate-700 dark:text-slate-300">
                  {stats.groups.ADIB.capaiTandan > 0 ? stats.groups.ADIB.capaiTandan : "-"}
                </td>
                <td className="px-2 py-2 text-center font-mono font-black border-r border-amber-500/10 text-slate-700 dark:text-slate-300">
                  {stats.groups.ADIB.capaiTandan > 0 ? `${((stats.groups.ADIB.capaiTandan / stats.groups.ADIB.tandanHarian) * 100).toFixed(2)}%` : "-"}
                </td>
                <td className="px-2 py-2 text-center font-mono font-black border-r border-amber-500/10 text-emerald-800 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/5">
                  {stats.groups.ADIB.monthlyToDateCapai > 0 ? stats.groups.ADIB.monthlyToDateCapai : "-"}
                </td>
                <td className="px-2 py-2 text-center font-mono font-black border-r border-amber-500/10 text-sky-800 dark:text-sky-400 bg-sky-500/10">
                  {stats.groups.ADIB.avgAbw > 0 ? stats.groups.ADIB.avgAbw.toFixed(2) : "-"}
                </td>
                <td className="px-3 py-2 text-center font-mono font-black border-r border-amber-500/20 text-rose-600 bg-rose-500/[0.04]">
                  {stats.groups.ADIB.backlog > 0 ? stats.groups.ADIB.backlog : "-"}
                </td>
                <td className="px-3 py-2 text-right font-mono font-black border-r border-amber-500/20 text-rose-700 dark:text-rose-400 bg-rose-500/[0.08]">
                  {stats.groups.ADIB.backlog > 0 ? stats.groups.ADIB.anggaranTan.toFixed(2) : "-"}
                </td>
                <td colSpan={1} />
              </tr>

              {/* GROUP 2: ARIL */}
              {BLOCKS_CONFIG.filter(b => b.group === 'ARIL').map((block, idx, arr) => {
                const rec = activeDateRecords[block.id];
                const activePus = calculateActivePus(rec);
                const pctSiap = block.defaultHektar > 0 ? ((rec.hektar_siap || 0) / block.defaultHektar) * 100 : 0;
                
                const buruh = rec.bil_buruh !== undefined ? rec.bil_buruh : block.defaultBuruh;
                const tandanHarian = rec.tandan_harian !== undefined ? rec.tandan_harian : block.defaultTandanHarian;
                const pctCapai = tandanHarian > 0 ? ((rec.capai_tandan || 0) / tandanHarian) * 100 : 0;
                const angTan = ((rec.backlog_diladang || 0) * rec.abw) / 1000;
                const isUpdatedOnDate = !!(backlogHistory[selectedDate] && backlogHistory[selectedDate][block.id]);

                return (
                  <tr 
                    key={block.id} 
                    className={`hover:bg-slate-500/[0.02] transition-colors group cursor-pointer ${
                      isUpdatedOnDate ? "bg-emerald-50/30 dark:bg-emerald-950/10" : ""
                    }`}
                    onClick={() => handleEditClick(block)}
                  >
                    {idx === 0 && (
                      <td rowSpan={arr.length} className="px-3 py-3 border-r border-slate-100 dark:border-slate-800 align-middle font-black text-slate-700 dark:text-slate-300 bg-slate-50/30 dark:bg-slate-900/20">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[11px] font-black uppercase tracking-tight text-slate-800 dark:text-slate-200">
                            {getStaffNameForBlock(block, activeEstate, employees)}
                          </span>
                          <span className="text-[7.5px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
                            Maklumat Asas Staf
                          </span>
                        </div>
                      </td>
                    )}
                    <td className={`px-2 py-2.5 font-bold text-center border-r border-slate-100 dark:border-slate-800 transition-all ${
                      isUpdatedOnDate 
                        ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 font-black" 
                        : "bg-slate-500/[0.02] text-slate-700 dark:text-slate-300"
                    }`}>
                      <div className="flex items-center justify-center gap-1.5">
                        {isUpdatedOnDate && <Check size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0 font-black animate-pulse" />}
                        <span>{block.label}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                      {buruh}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-right border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                      {block.defaultHektar.toFixed(2)}
                    </td>
                    
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                      {formatTarikhDmy(rec.pus1_mula)}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                      {formatTarikhDmy(rec.pus1_tamat)}
                    </td>
                    
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                      {formatTarikhDmy(rec.pus2_mula)}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                      {formatTarikhDmy(rec.pus2_tamat)}
                    </td>
                    
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300">
                      {activePus}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-right border-r border-slate-100 dark:border-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                      {rec.hektar_siap > 0 ? rec.hektar_siap.toFixed(2) : "-"}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-500">
                      {rec.hektar_siap > 0 ? `${pctSiap.toFixed(2)}%` : "-"}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                      {tandanHarian}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                      {rec.capai_tandan > 0 ? rec.capai_tandan : "-"}
                    </td>
                    <td className={`px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 font-bold ${pctCapai >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {rec.capai_tandan > 0 ? `${pctCapai.toFixed(2)}%` : "-"}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold bg-emerald-500/[0.02] dark:bg-emerald-500/[0.01]">
                      {stats.blockMonthlyToDateCapai[block.id] > 0 ? stats.blockMonthlyToDateCapai[block.id] : "-"}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-sky-700 dark:text-sky-400 font-bold bg-sky-500/[0.02]">
                      {rec.abw ? rec.abw.toFixed(2) : "-"}
                    </td>
                    
                    <td className="px-3 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 font-black text-rose-600 bg-rose-500/[0.02]">
                      {rec.backlog_diladang > 0 ? rec.backlog_diladang : "-"}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-right border-r border-slate-100 dark:border-slate-800 font-black text-rose-700 dark:text-rose-400 bg-rose-500/[0.04]">
                      {rec.backlog_diladang > 0 ? angTan.toFixed(2) : "-"}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 relative w-44 min-w-[150px] max-w-[176px] break-words whitespace-normal border-r border-slate-100 dark:border-slate-800">
                      <div className="flex justify-between items-start gap-1 w-full">
                        <span className="italic text-[9px] leading-tight block break-words whitespace-normal">{rec.catatan || "-"}</span>
                        <Edit3 size={11} className="opacity-0 group-hover:opacity-100 text-slate-400 transition-opacity ml-1 shrink-0 mt-0.5" />
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* SUMMARY ARIL: 1B (YELLOW ROW) */}
              <tr className="bg-amber-500/10 dark:bg-amber-500/5 font-bold border-y border-amber-500/20">
                <td colSpan={2} className="px-3 py-2 text-right border-r border-amber-500/10 font-black text-amber-800 dark:text-amber-400">
                  1B
                </td>
                <td className="px-2 py-2 text-center font-mono font-black border-r border-amber-500/10 text-slate-700 dark:text-slate-300">
                  {stats.groups.ARIL.buruh}
                </td>
                <td className="px-3 py-2 text-right font-mono font-black border-r border-amber-500/10 text-slate-700 dark:text-slate-300">
                  {stats.groups.ARIL.hektar.toFixed(2)}
                </td>
                <td colSpan={5} className="bg-amber-500/[0.02] border-r border-amber-500/10" />
                <td className="px-2 py-2 text-right font-mono font-black border-r border-amber-500/10 text-slate-700 dark:text-slate-300">
                  {stats.groups.ARIL.hektarSiap > 0 ? stats.groups.ARIL.hektarSiap.toFixed(2) : "-"}
                </td>
                <td className="px-2 py-2 text-center font-mono font-black border-r border-amber-500/10 text-slate-600">
                  {stats.groups.ARIL.hektarSiap > 0 ? `${((stats.groups.ARIL.hektarSiap / stats.groups.ARIL.hektar) * 100).toFixed(2)}%` : "-"}
                </td>
                <td className="px-2 py-2 text-center font-mono font-black border-r border-amber-500/10 text-slate-700 dark:text-slate-300">
                  {stats.groups.ARIL.tandanHarian}
                </td>
                <td className="px-2 py-2 text-center font-mono font-black border-r border-amber-500/10 text-slate-700 dark:text-slate-300">
                  {stats.groups.ARIL.capaiTandan > 0 ? stats.groups.ARIL.capaiTandan : "-"}
                </td>
                <td className="px-2 py-2 text-center font-mono font-black border-r border-amber-500/10 text-slate-700 dark:text-slate-300">
                  {stats.groups.ARIL.capaiTandan > 0 ? `${((stats.groups.ARIL.capaiTandan / stats.groups.ARIL.tandanHarian) * 100).toFixed(2)}%` : "-"}
                </td>
                <td className="px-2 py-2 text-center font-mono font-black border-r border-amber-500/10 text-emerald-800 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/5">
                  {stats.groups.ARIL.monthlyToDateCapai > 0 ? stats.groups.ARIL.monthlyToDateCapai : "-"}
                </td>
                <td className="px-2 py-2 text-center font-mono font-black border-r border-amber-500/10 text-sky-800 dark:text-sky-400 bg-sky-500/10">
                  {stats.groups.ARIL.avgAbw > 0 ? stats.groups.ARIL.avgAbw.toFixed(2) : "-"}
                </td>
                <td className="px-3 py-2 text-center font-mono font-black border-r border-amber-500/20 text-rose-600 bg-rose-500/[0.04]">
                  {stats.groups.ARIL.backlog > 0 ? stats.groups.ARIL.backlog : "-"}
                </td>
                <td className="px-3 py-2 text-right font-mono font-black border-r border-amber-500/20 text-rose-700 dark:text-rose-400 bg-rose-500/[0.08]">
                  {stats.groups.ARIL.backlog > 0 ? stats.groups.ARIL.anggaranTan.toFixed(2) : "-"}
                </td>
                <td colSpan={1} />
              </tr>

              {/* GROUP 3: KIROMIN */}
              {BLOCKS_CONFIG.filter(b => b.group === 'KIROMIN').map((block, idx, arr) => {
                const rec = activeDateRecords[block.id];
                const activePus = calculateActivePus(rec);
                const pctSiap = block.defaultHektar > 0 ? ((rec.hektar_siap || 0) / block.defaultHektar) * 100 : 0;
                
                const buruh = rec.bil_buruh !== undefined ? rec.bil_buruh : block.defaultBuruh;
                const tandanHarian = rec.tandan_harian !== undefined ? rec.tandan_harian : block.defaultTandanHarian;
                const pctCapai = tandanHarian > 0 ? ((rec.capai_tandan || 0) / tandanHarian) * 100 : 0;
                const angTan = ((rec.backlog_diladang || 0) * rec.abw) / 1000;
                const isUpdatedOnDate = !!(backlogHistory[selectedDate] && backlogHistory[selectedDate][block.id]);

                return (
                  <tr 
                    key={block.id} 
                    className={`hover:bg-slate-500/[0.02] transition-colors group cursor-pointer ${
                      isUpdatedOnDate ? "bg-emerald-50/30 dark:bg-emerald-950/10" : ""
                    }`}
                    onClick={() => handleEditClick(block)}
                  >
                    {idx === 0 && (
                      <td rowSpan={arr.length} className="px-3 py-3 border-r border-slate-100 dark:border-slate-800 align-middle font-black text-slate-700 dark:text-slate-300 bg-slate-50/30 dark:bg-slate-900/20">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[11px] font-black uppercase tracking-tight text-slate-800 dark:text-slate-200">
                            {getStaffNameForBlock(block, activeEstate, employees)}
                          </span>
                          <span className="text-[7.5px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
                            Maklumat Asas Staf
                          </span>
                        </div>
                      </td>
                    )}
                    <td className={`px-2 py-2.5 font-bold text-center border-r border-slate-100 dark:border-slate-800 transition-all ${
                      isUpdatedOnDate 
                        ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 font-black" 
                        : "bg-slate-500/[0.02] text-slate-700 dark:text-slate-300"
                    }`}>
                      <div className="flex items-center justify-center gap-1.5">
                        {isUpdatedOnDate && <Check size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0 font-black animate-pulse" />}
                        <span>{block.label}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                      {buruh}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-right border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                      {block.defaultHektar.toFixed(2)}
                    </td>
                    
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                      {formatTarikhDmy(rec.pus1_mula)}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                      {formatTarikhDmy(rec.pus1_tamat)}
                    </td>
                    
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                      {formatTarikhDmy(rec.pus2_mula)}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                      {formatTarikhDmy(rec.pus2_tamat)}
                    </td>
                    
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300">
                      {activePus}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-right border-r border-slate-100 dark:border-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                      {rec.hektar_siap > 0 ? rec.hektar_siap.toFixed(2) : "-"}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-500">
                      {rec.hektar_siap > 0 ? `${pctSiap.toFixed(2)}%` : "-"}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                      {tandanHarian}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                      {rec.capai_tandan > 0 ? rec.capai_tandan : "-"}
                    </td>
                    <td className={`px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 font-bold ${pctCapai >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {rec.capai_tandan > 0 ? `${pctCapai.toFixed(2)}%` : "-"}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold bg-emerald-500/[0.02] dark:bg-emerald-500/[0.01]">
                      {stats.blockMonthlyToDateCapai[block.id] > 0 ? stats.blockMonthlyToDateCapai[block.id] : "-"}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-sky-700 dark:text-sky-400 font-bold bg-sky-500/[0.02]">
                      {rec.abw ? rec.abw.toFixed(2) : "-"}
                    </td>
                    
                    <td className="px-3 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 font-black text-rose-600 bg-rose-500/[0.02]">
                      {rec.backlog_diladang > 0 ? rec.backlog_diladang : "-"}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-right border-r border-slate-100 dark:border-slate-800 font-black text-rose-700 dark:text-rose-400 bg-rose-500/[0.04]">
                      {rec.backlog_diladang > 0 ? angTan.toFixed(2) : "-"}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 relative w-44 min-w-[150px] max-w-[176px] break-words whitespace-normal border-r border-slate-100 dark:border-slate-800">
                      <div className="flex justify-between items-start gap-1 w-full">
                        <span className="italic text-[9px] leading-tight block break-words whitespace-normal">{rec.catatan || "-"}</span>
                        <Edit3 size={11} className="opacity-0 group-hover:opacity-100 text-slate-400 transition-opacity ml-1 shrink-0 mt-0.5" />
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* SUMMARY KIROMIN: 1C (YELLOW ROW) */}
              <tr className="bg-amber-500/10 dark:bg-amber-500/5 font-bold border-y border-amber-500/20">
                <td colSpan={2} className="px-3 py-2 text-right border-r border-amber-500/10 font-black text-amber-800 dark:text-amber-400">
                  1C
                </td>
                <td className="px-2 py-2 text-center font-mono font-black border-r border-amber-500/10 text-slate-700 dark:text-slate-300">
                  {stats.groups.KIROMIN.buruh}
                </td>
                <td className="px-3 py-2 text-right font-mono font-black border-r border-amber-500/10 text-slate-700 dark:text-slate-300">
                  {stats.groups.KIROMIN.hektar.toFixed(2)}
                </td>
                <td colSpan={5} className="bg-amber-500/[0.02] border-r border-amber-500/10" />
                <td className="px-2 py-2 text-right font-mono font-black border-r border-amber-500/10 text-slate-700 dark:text-slate-300">
                  {stats.groups.KIROMIN.hektarSiap > 0 ? stats.groups.KIROMIN.hektarSiap.toFixed(2) : "-"}
                </td>
                <td className="px-2 py-2 text-center font-mono font-black border-r border-amber-500/10 text-slate-600">
                  {stats.groups.KIROMIN.hektarSiap > 0 ? `${((stats.groups.KIROMIN.hektarSiap / stats.groups.KIROMIN.hektar) * 100).toFixed(2)}%` : "-"}
                </td>
                <td className="px-2 py-2 text-center font-mono font-black border-r border-amber-500/10 text-slate-700 dark:text-slate-300">
                  {stats.groups.KIROMIN.tandanHarian}
                </td>
                <td className="px-2 py-2 text-center font-mono font-black border-r border-amber-500/10 text-slate-700 dark:text-slate-300">
                  {stats.groups.KIROMIN.capaiTandan > 0 ? stats.groups.KIROMIN.capaiTandan : "-"}
                </td>
                <td className="px-2 py-2 text-center font-mono font-black border-r border-amber-500/10 text-slate-700 dark:text-slate-300">
                  {stats.groups.KIROMIN.capaiTandan > 0 ? `${((stats.groups.KIROMIN.capaiTandan / stats.groups.KIROMIN.tandanHarian) * 100).toFixed(2)}%` : "-"}
                </td>
                <td className="px-2 py-2 text-center font-mono font-black border-r border-amber-500/10 text-emerald-800 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/5">
                  {stats.groups.KIROMIN.monthlyToDateCapai > 0 ? stats.groups.KIROMIN.monthlyToDateCapai : "-"}
                </td>
                <td className="px-2 py-2 text-center font-mono font-black border-r border-amber-500/10 text-sky-800 dark:text-sky-400 bg-sky-500/10">
                  {stats.groups.KIROMIN.avgAbw > 0 ? stats.groups.KIROMIN.avgAbw.toFixed(2) : "-"}
                </td>
                <td className="px-3 py-2 text-center font-mono font-black border-r border-amber-500/20 text-rose-600 bg-rose-500/[0.04]">
                  {stats.groups.KIROMIN.backlog > 0 ? stats.groups.KIROMIN.backlog : "-"}
                </td>
                <td className="px-3 py-2 text-right font-mono font-black border-r border-amber-500/20 text-rose-700 dark:text-rose-400 bg-rose-500/[0.08]">
                  {stats.groups.KIROMIN.backlog > 0 ? stats.groups.KIROMIN.anggaranTan.toFixed(2) : "-"}
                </td>
                <td colSpan={1} />
              </tr>

              {/* PKT 001 HEADER / SUMMARY (BLUE ROW) */}
              <tr className="bg-emerald-600 text-white dark:bg-emerald-700 font-extrabold text-[11px] border-y border-emerald-600 dark:border-emerald-700">
                <td colSpan={2} className="px-3 py-3 text-right uppercase border-r border-emerald-500">
                  PKT 001
                </td>
                <td className="px-2 py-3 text-center font-mono border-r border-emerald-500">
                  {stats.pkt1.buruh}
                </td>
                <td className="px-3 py-3 text-right font-mono border-r border-emerald-500">
                  {stats.pkt1.hektar.toFixed(2)}
                </td>
                <td colSpan={5} className="border-r border-emerald-500" />
                <td className="px-2 py-3 text-right font-mono border-r border-emerald-500">
                  {stats.pkt1.hektarSiap > 0 ? stats.pkt1.hektarSiap.toFixed(2) : "-"}
                </td>
                <td className="px-2 py-3 text-center font-mono border-r border-emerald-500">
                  {stats.pkt1.hektarSiap > 0 ? `${((stats.pkt1.hektarSiap / stats.pkt1.hektar) * 100).toFixed(2)}%` : "-"}
                </td>
                <td className="px-2 py-3 text-center font-mono border-r border-emerald-500">
                  {stats.pkt1.tandanHarian}
                </td>
                <td className="px-2 py-3 text-center font-mono border-r border-emerald-500">
                  {stats.pkt1.capaiTandan > 0 ? stats.pkt1.capaiTandan : "-"}
                </td>
                <td className="px-2 py-3 text-center font-mono border-r border-emerald-500">
                  {stats.pkt1.capaiTandan > 0 ? `${((stats.pkt1.capaiTandan / stats.pkt1.tandanHarian) * 100).toFixed(2)}%` : "-"}
                </td>
                <td className="px-2 py-3 text-center font-mono border-r border-emerald-500 text-emerald-200 bg-emerald-700/20">
                  {stats.pkt1.monthlyToDateCapai > 0 ? stats.pkt1.monthlyToDateCapai : "-"}
                </td>
                <td className="px-2 py-3 text-center font-mono border-r border-emerald-500 text-emerald-100 bg-emerald-700/20 font-extrabold">
                  {stats.pkt1.avgAbw > 0 ? stats.pkt1.avgAbw.toFixed(2) : "-"}
                </td>
                <td className="px-3 py-3 text-center font-mono border-r border-emerald-500 bg-rose-600/25">
                  {stats.pkt1.backlog > 0 ? stats.pkt1.backlog : "-"}
                </td>
                <td className="px-3 py-3 text-right font-mono border-r border-emerald-500 bg-rose-600/35">
                  {stats.pkt1.backlog > 0 ? stats.pkt1.anggaranTan.toFixed(2) : "-"}
                </td>
                <td colSpan={1} />
              </tr>

              {/* GROUP 4: wan (PKT 002) */}
              {BLOCKS_CONFIG.filter(b => b.group === 'wan').map((block, idx, arr) => {
                const rec = activeDateRecords[block.id];
                const activePus = calculateActivePus(rec);
                const pctSiap = block.defaultHektar > 0 ? ((rec.hektar_siap || 0) / block.defaultHektar) * 100 : 0;
                
                const buruh = rec.bil_buruh !== undefined ? rec.bil_buruh : block.defaultBuruh;
                const tandanHarian = rec.tandan_harian !== undefined ? rec.tandan_harian : block.defaultTandanHarian;
                const pctCapai = tandanHarian > 0 ? ((rec.capai_tandan || 0) / tandanHarian) * 100 : 0;
                const angTan = ((rec.backlog_diladang || 0) * rec.abw) / 1000;
                const isUpdatedOnDate = !!(backlogHistory[selectedDate] && backlogHistory[selectedDate][block.id]);

                return (
                  <tr 
                    key={block.id} 
                    className={`hover:bg-slate-500/[0.02] transition-colors group cursor-pointer ${
                      isUpdatedOnDate ? "bg-emerald-50/30 dark:bg-emerald-950/10" : ""
                    }`}
                    onClick={() => handleEditClick(block)}
                  >
                    {idx === 0 && (
                      <td rowSpan={arr.length} className="px-3 py-3 border-r border-slate-100 dark:border-slate-800 align-middle font-black text-slate-700 dark:text-slate-300 bg-slate-50/30 dark:bg-slate-900/20">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[11px] font-black uppercase tracking-tight text-slate-800 dark:text-slate-200">
                            {getStaffNameForBlock(block, activeEstate, employees)}
                          </span>
                          <span className="text-[7.5px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
                            Maklumat Asas Staf
                          </span>
                        </div>
                      </td>
                    )}
                    <td className={`px-2 py-2.5 font-bold text-center border-r border-slate-100 dark:border-slate-800 transition-all ${
                      isUpdatedOnDate 
                        ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 font-black" 
                        : "bg-slate-500/[0.02] text-slate-700 dark:text-slate-300"
                    }`}>
                      <div className="flex items-center justify-center gap-1.5">
                        {isUpdatedOnDate && <Check size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0 font-black animate-pulse" />}
                        <span>{block.label}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                      {buruh}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-right border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                      {block.defaultHektar.toFixed(2)}
                    </td>
                    
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                      {formatTarikhDmy(rec.pus1_mula)}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                      {formatTarikhDmy(rec.pus1_tamat)}
                    </td>
                    
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                      {formatTarikhDmy(rec.pus2_mula)}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                      {formatTarikhDmy(rec.pus2_tamat)}
                    </td>
                    
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300">
                      {activePus}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-right border-r border-slate-100 dark:border-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                      {rec.hektar_siap > 0 ? rec.hektar_siap.toFixed(2) : "-"}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-500">
                      {rec.hektar_siap > 0 ? `${pctSiap.toFixed(2)}%` : "-"}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                      {tandanHarian}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                      {rec.capai_tandan > 0 ? rec.capai_tandan : "-"}
                    </td>
                    <td className={`px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 font-bold ${pctCapai >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {rec.capai_tandan > 0 ? `${pctCapai.toFixed(2)}%` : "-"}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold bg-emerald-500/[0.02] dark:bg-emerald-500/[0.01]">
                      {stats.blockMonthlyToDateCapai[block.id] > 0 ? stats.blockMonthlyToDateCapai[block.id] : "-"}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 text-sky-700 dark:text-sky-400 font-bold bg-sky-500/[0.02]">
                      {rec.abw ? rec.abw.toFixed(2) : "-"}
                    </td>
                    
                    <td className="px-3 py-2.5 font-mono text-center border-r border-slate-100 dark:border-slate-800 font-black text-rose-600 bg-rose-500/[0.02]">
                      {rec.backlog_diladang > 0 ? rec.backlog_diladang : "-"}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-right border-r border-slate-100 dark:border-slate-800 font-black text-rose-700 dark:text-rose-400 bg-rose-500/[0.04]">
                      {rec.backlog_diladang > 0 ? angTan.toFixed(2) : "-"}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 relative w-44 min-w-[150px] max-w-[176px] break-words whitespace-normal border-r border-slate-100 dark:border-slate-800">
                      <div className="flex justify-between items-start gap-1 w-full">
                        <span className="italic text-[9px] leading-tight block break-words whitespace-normal">{rec.catatan || "-"}</span>
                        <Edit3 size={11} className="opacity-0 group-hover:opacity-100 text-slate-400 transition-opacity ml-1 shrink-0 mt-0.5" />
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* SUMMARY PKT 002: (YELLOW ROW) */}
              <tr className="bg-amber-500/10 dark:bg-amber-500/5 font-bold border-y border-amber-500/20">
                <td colSpan={2} className="px-3 py-2 text-right border-r border-amber-500/10 font-black text-amber-800 dark:text-amber-400">
                  PKT 002
                </td>
                <td className="px-2 py-2 text-center font-mono font-black border-r border-amber-500/10 text-slate-700 dark:text-slate-300">
                  {stats.groups.wan.buruh}
                </td>
                <td className="px-3 py-2 text-right font-mono font-black border-r border-amber-500/10 text-slate-700 dark:text-slate-300">
                  {stats.groups.wan.hektar.toFixed(2)}
                </td>
                <td colSpan={5} className="bg-amber-500/[0.02] border-r border-amber-500/10" />
                <td className="px-2 py-2 text-right font-mono font-black border-r border-amber-500/10 text-slate-700 dark:text-slate-300">
                  {stats.groups.wan.hektarSiap > 0 ? stats.groups.wan.hektarSiap.toFixed(2) : "-"}
                </td>
                <td className="px-2 py-2 text-center font-mono font-black border-r border-amber-500/10 text-slate-600">
                  {stats.groups.wan.hektarSiap > 0 ? `${((stats.groups.wan.hektarSiap / stats.groups.wan.hektar) * 100).toFixed(2)}%` : "-"}
                </td>
                <td className="px-2 py-2 text-center font-mono font-black border-r border-amber-500/10 text-slate-700 dark:text-slate-300">
                  {stats.groups.wan.tandanHarian}
                </td>
                <td className="px-2 py-2 text-center font-mono font-black border-r border-amber-500/10 text-slate-700 dark:text-slate-300">
                  {stats.groups.wan.capaiTandan > 0 ? stats.groups.wan.capaiTandan : "-"}
                </td>
                <td className="px-2 py-2 text-center font-mono font-black border-r border-amber-500/10 text-slate-700 dark:text-slate-300">
                  {stats.groups.wan.capaiTandan > 0 ? `${((stats.groups.wan.capaiTandan / stats.groups.wan.tandanHarian) * 100).toFixed(2)}%` : "-"}
                </td>
                <td className="px-2 py-2 text-center font-mono font-black border-r border-amber-500/10 text-emerald-800 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/5">
                  {stats.groups.wan.monthlyToDateCapai > 0 ? stats.groups.wan.monthlyToDateCapai : "-"}
                </td>
                <td className="px-2 py-2 text-center font-mono font-black border-r border-amber-500/10 text-sky-800 dark:text-sky-400 bg-sky-500/10">
                  {stats.groups.wan.avgAbw > 0 ? stats.groups.wan.avgAbw.toFixed(2) : "-"}
                </td>
                <td className="px-3 py-2 text-center font-mono font-black border-r border-amber-500/20 text-rose-600 bg-rose-500/[0.04]">
                  {stats.groups.wan.backlog > 0 ? stats.groups.wan.backlog : "-"}
                </td>
                <td className="px-3 py-2 text-right font-mono font-black border-r border-amber-500/20 text-rose-700 dark:text-rose-400 bg-rose-500/[0.08]">
                  {stats.groups.wan.backlog > 0 ? stats.groups.wan.anggaranTan.toFixed(2) : "-"}
                </td>
                <td colSpan={1} />
              </tr>

              {/* PKT 001 & 002 (BLUE ROW) */}
              <tr className="bg-emerald-600 text-white dark:bg-emerald-700 font-extrabold text-[11px] border-y border-emerald-500">
                <td colSpan={2} className="px-3 py-3 text-right uppercase border-r border-emerald-500">
                  PKT 001 & 002
                </td>
                <td className="px-2 py-3 text-center font-mono border-r border-emerald-500">
                  {stats.grand.buruh}
                </td>
                <td className="px-3 py-3 text-right font-mono border-r border-emerald-500">
                  {stats.grand.hektar.toFixed(2)}
                </td>
                <td colSpan={5} className="border-r border-emerald-500" />
                <td className="px-2 py-3 text-right font-mono border-r border-emerald-500">
                  {stats.grand.hektarSiap > 0 ? stats.grand.hektarSiap.toFixed(2) : "-"}
                </td>
                <td className="px-2 py-3 text-center font-mono border-r border-emerald-500">
                  {stats.grand.hektarSiap > 0 ? `${((stats.grand.hektarSiap / stats.grand.hektar) * 100).toFixed(2)}%` : "-"}
                </td>
                <td className="px-2 py-3 text-center font-mono border-r border-emerald-500">
                  {stats.grand.tandanHarian}
                </td>
                <td className="px-2 py-3 text-center font-mono border-r border-emerald-500">
                  {stats.grand.capaiTandan > 0 ? stats.grand.capaiTandan : "-"}
                </td>
                <td className="px-2 py-3 text-center font-mono border-r border-emerald-500">
                  {stats.grand.capaiTandan > 0 ? `${((stats.grand.capaiTandan / stats.grand.tandanHarian) * 100).toFixed(2)}%` : "-"}
                </td>
                <td className="px-2 py-3 text-center font-mono border-r border-emerald-500 text-emerald-200 bg-emerald-700/20">
                  {stats.grand.monthlyToDateCapai > 0 ? stats.grand.monthlyToDateCapai : "-"}
                </td>
                <td className="px-2 py-3 text-center font-mono border-r border-emerald-500 text-emerald-100 bg-emerald-700/20 font-extrabold">
                  {stats.grand.avgAbw > 0 ? stats.grand.avgAbw.toFixed(2) : "-"}
                </td>
                <td className="px-3 py-3 text-center font-mono border-r border-emerald-500 bg-rose-600/25">
                  {stats.grand.backlog > 0 ? stats.grand.backlog : "-"}
                </td>
                <td className="px-3 py-3 text-right font-mono border-r border-emerald-500 bg-rose-600/35">
                  {stats.grand.backlog > 0 ? stats.grand.anggaranTan.toFixed(2) : "-"}
                </td>
                <td colSpan={1} />
              </tr>

              {/* FELDA GROUPS (001LF / 002LF) (ORANGE ROW STYLE) */}
              {BLOCKS_CONFIG.filter(b => b.group === 'FELDA').map((block) => {
                const rec = activeDateRecords[block.id];
                const activePus = calculateActivePus(rec);
                const pctSiap = block.defaultHektar > 0 ? ((rec.hektar_siap || 0) / block.defaultHektar) * 100 : 0;
                
                const buruh = rec.bil_buruh !== undefined ? rec.bil_buruh : block.defaultBuruh;
                const tandanHarian = rec.tandan_harian !== undefined ? rec.tandan_harian : block.defaultTandanHarian;
                const pctCapai = tandanHarian > 0 ? ((rec.capai_tandan || 0) / tandanHarian) * 100 : 0;
                const angTan = ((rec.backlog_diladang || 0) * rec.abw) / 1000;
                const isUpdatedOnDate = !!(backlogHistory[selectedDate] && backlogHistory[selectedDate][block.id]);

                const feldaLabel = block.id === '001LF' ? 'ADIB/ARIL' : 'KIROMIN';

                return (
                  <tr 
                    key={block.id} 
                    className={`transition-colors group cursor-pointer border-y border-amber-500/10 ${
                      isUpdatedOnDate 
                        ? "bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300" 
                        : "bg-amber-120/10 dark:bg-amber-900/10 hover:bg-amber-500/5 text-amber-900 dark:text-amber-300"
                    }`}
                    onClick={() => handleEditClick(block)}
                  >
                    <td className="px-3 py-2.5 font-black border-r border-amber-500/10 align-middle">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] font-black uppercase tracking-tight text-amber-950 dark:text-amber-200">
                          {getStaffNameForBlock(block, activeEstate, employees)}
                        </span>
                        <span className="text-[7.5px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
                          Maklumat Asas Staf
                        </span>
                      </div>
                    </td>
                    <td className={`px-2 py-2.5 font-bold text-center border-r border-amber-500/10 transition-all ${
                      isUpdatedOnDate 
                        ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 font-black" 
                        : "bg-amber-500/5"
                    }`}>
                      <div className="flex items-center justify-center gap-1.5">
                        {isUpdatedOnDate && <Check size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0 font-black animate-pulse" />}
                        <span>{block.label}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-amber-500/10">
                      {buruh}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-right border-r border-amber-500/10">
                      {block.defaultHektar.toFixed(2)}
                    </td>
                    
                    <td className="px-2 py-2.5 font-mono text-center border-r border-amber-500/10 text-slate-500">
                      {formatTarikhDmy(rec.pus1_mula)}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-amber-500/10 text-slate-500">
                      {formatTarikhDmy(rec.pus1_tamat)}
                    </td>
                    
                    <td className="px-2 py-2.5 font-mono text-center border-r border-amber-500/10 text-slate-500">
                      {formatTarikhDmy(rec.pus2_mula)}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-amber-500/10 text-slate-500">
                      {formatTarikhDmy(rec.pus2_tamat)}
                    </td>
                    
                    <td className="px-2 py-2.5 font-mono text-center border-r border-amber-500/10 font-bold">
                      {activePus}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-right border-r border-amber-500/10 font-semibold">
                      {rec.hektar_siap > 0 ? rec.hektar_siap.toFixed(2) : "-"}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-amber-500/10">
                      {rec.hektar_siap > 0 ? `${pctSiap.toFixed(2)}%` : "-"}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-amber-500/10 font-semibold">
                      {tandanHarian}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-amber-500/10">
                      {rec.capai_tandan > 0 ? rec.capai_tandan : "-"}
                    </td>
                    <td className={`px-2 py-2.5 font-mono text-center border-r border-amber-500/10 font-bold ${pctCapai >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {rec.capai_tandan > 0 ? `${pctCapai.toFixed(2)}%` : "-"}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-amber-500/10 font-bold bg-emerald-500/[0.02] dark:bg-emerald-500/[0.01]">
                      {stats.blockMonthlyToDateCapai[block.id] > 0 ? stats.blockMonthlyToDateCapai[block.id] : "-"}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-center border-r border-amber-500/10 font-bold text-sky-800 dark:text-sky-300 bg-sky-500/5">
                      {rec.abw ? rec.abw.toFixed(2) : "-"}
                    </td>
                    
                    <td className="px-3 py-2.5 font-mono text-center border-r border-amber-500/10 font-black text-rose-600 bg-rose-500/[0.02]">
                      {rec.backlog_diladang > 0 ? rec.backlog_diladang : "-"}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-right border-r border-amber-500/10 font-black text-rose-700 dark:text-rose-400 bg-rose-500/[0.04]">
                      {rec.backlog_diladang > 0 ? angTan.toFixed(2) : "-"}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 relative w-44 min-w-[150px] max-w-[176px] break-words whitespace-normal border-r border-amber-500/10">
                      <div className="flex justify-between items-start gap-1 w-full">
                        <span className="italic text-[9px] leading-tight block break-words whitespace-normal">{rec.catatan || "-"}</span>
                        <Edit3 size={11} className="opacity-0 group-hover:opacity-100 text-slate-400 transition-opacity ml-1 shrink-0 mt-0.5" />
                      </div>
                    </td>
                  </tr>
                );
              })}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* STATUS PENGESAHAN & KELULUSAN */}
      <div className="bg-white dark:bg-slate-900 rounded-[20px] p-4 shadow-sm border border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        {/* Asst FC Verification Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50/50 dark:bg-slate-950/40 rounded-xl border border-slate-100/70 dark:border-slate-800/60">
          <div className="flex items-start gap-2.5">
            <div className={`p-2 rounded-lg shrink-0 ${approvalStatus.seenByFc ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
              <Eye size={16} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 leading-none mb-1">Disemak oleh : Asst. Field Controller</p>
              {approvalStatus.seenByFc ? (
                <div className="space-y-0.5">
                  <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Check size={12} className="stroke-[3]" /> Telah Disemak
                  </span>
                  <p className="text-[8px] font-medium text-slate-400 flex items-center gap-1">
                    <Clock size={9} /> {approvalStatus.seenByFcAt}
                  </p>
                </div>
              ) : (
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <AlertCircle size={12} /> Belum Disemak
                </span>
              )}
            </div>
          </div>
          
          <button
            onClick={handleToggleSeenByFc}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all self-start sm:self-center shrink-0 ${
              approvalStatus.seenByFc
                ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/50 dark:bg-rose-950/20 dark:hover:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/30'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/10'
            }`}
          >
            {approvalStatus.seenByFc ? 'Batal Semak' : 'Sahkan Disemak'}
          </button>
        </div>

        {/* FC Approval Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50/50 dark:bg-slate-950/40 rounded-xl border border-slate-100/70 dark:border-slate-800/60">
          <div className="flex items-start gap-2.5">
            <div className={`p-2 rounded-lg shrink-0 ${approvalStatus.approvedByManager ? 'bg-indigo-500/10 text-indigo-600' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
              <ShieldCheck size={16} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 leading-none mb-1">Disahkan oleh : Field Controller</p>
              {approvalStatus.approvedByManager ? (
                <div className="space-y-0.5">
                  <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                    <CheckSquare size={12} className="stroke-[3]" /> Telah Disahkan
                  </span>
                  <p className="text-[8px] font-medium text-slate-400 flex items-center gap-1">
                    <Clock size={9} /> {approvalStatus.approvedByManagerAt}
                  </p>
                </div>
              ) : (
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <AlertCircle size={12} /> Belum Disahkan
                </span>
              )}
            </div>
          </div>
          
          <button
            onClick={handleToggleApproved}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all self-start sm:self-center shrink-0 ${
              approvalStatus.approvedByManager
                ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/50 dark:bg-rose-950/20 dark:hover:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/30'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/10'
            }`}
          >
            {approvalStatus.approvedByManager ? 'Batal Sah' : 'Sahkan'}
          </button>
        </div>
      </div>

      {/* EDITING DRAWER / MODAL POPUP */}
      <AnimatePresence>
        {editingBlock && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-white dark:bg-slate-900 rounded-[28px] sm:rounded-[30px] shadow-2xl border border-slate-100 dark:border-slate-800 w-full max-w-lg overflow-hidden flex flex-col max-h-[90dvh] sm:max-h-[85vh] my-auto"
            >
              <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl">
                    <Edit3 size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase">
                      Edit Backlog Blok {editingBlock.label}
                    </h3>
                    <p className="text-[9px] text-slate-400 uppercase font-black">
                      Kawasan: {editingBlock.group} | {formatTarikhDmy(selectedDate)}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setEditingBlock(null)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
                
                {activeDateRecords[editingBlock.id]?.isCarriedFromLastMonth && (
                  <div className="p-3 bg-emerald-500/5 dark:bg-emerald-500/5 rounded-2xl border border-emerald-500/10 dark:border-emerald-500/10 flex items-start gap-2.5">
                    <Info size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div className="text-[9px] text-emerald-800 dark:text-emerald-300 font-medium leading-relaxed">
                      <span className="font-extrabold uppercase block text-emerald-900 dark:text-emerald-200 mb-0.5">Bawaan Bulan Lepas</span>
                      Sistem membawa masuk baki data secara automatik dari bulan lepas ({formatTarikhDmy(activeDateRecords[editingBlock.id].carriedFromDate || '')}):
                      <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-600 dark:text-slate-400 font-semibold">
                        <li>Bawaan Backlog: <span className="text-emerald-700 dark:text-emerald-300 font-bold">{activeDateRecords[editingBlock.id].originalBacklogCarried} Tandan</span></li>
                        <li>Bil. Buruh: <span className="font-bold">{activeDateRecords[editingBlock.id].bil_buruh}</span></li>
                      </ul>
                      <span className="block mt-1 text-slate-500 dark:text-slate-400 italic">Sila kemaskini maklumat di bawah mengikut rekod hari ini jika terdapat perubahan.</span>
                    </div>
                  </div>
                )}

                {/* DATES GRID */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">
                      Tarikh Pusingan (Pus)
                    </span>
                    {(editForm.pus1_mula || editForm.pus1_tamat || editForm.pus2_mula || editForm.pus2_tamat) && (
                      <button
                        type="button"
                        onClick={() => setEditForm(prev => ({
                          ...prev,
                          pus1_mula: "",
                          pus1_tamat: "",
                          pus2_mula: "",
                          pus2_tamat: ""
                        }))}
                        className="text-[8px] font-bold text-rose-500 hover:text-rose-400 flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 cursor-pointer"
                        title="Kosongkan semua tarikh mula dan tamat pusingan"
                      >
                        <X size={10} /> Padam Semua Tarikh
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* PUS 1 MULA */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[8px] font-black uppercase text-slate-400">Pus 1 Mula</label>
                        {editForm.pus1_mula && (
                          <button
                            type="button"
                            onClick={() => setEditForm(prev => ({ ...prev, pus1_mula: "" }))}
                            className="text-[8px] font-bold text-rose-500 hover:text-rose-400 flex items-center gap-0.5 px-1 py-0.2 rounded hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Padam tarikh Pus 1 Mula"
                          >
                            <X size={9} /> Padam
                          </button>
                        )}
                      </div>
                      <div className="relative flex items-center">
                        <input 
                          type="date"
                          value={editForm.pus1_mula}
                          onChange={(e) => setEditForm(prev => ({ ...prev, pus1_mula: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Backspace' || e.key === 'Delete') {
                              e.preventDefault();
                              setEditForm(prev => ({ ...prev, pus1_mula: "" }));
                            }
                          }}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-3 pr-8 py-2 text-xs text-slate-700 dark:text-slate-200 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        {editForm.pus1_mula && (
                          <button
                            type="button"
                            onClick={() => setEditForm(prev => ({ ...prev, pus1_mula: "" }))}
                            title="Padam tarikh Pus 1 Mula"
                            aria-label="Padam tarikh Pus 1 Mula"
                            className="absolute right-7 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors z-10 cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* PUS 1 TAMAT */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[8px] font-black uppercase text-slate-400">Pus 1 Tamat</label>
                        {editForm.pus1_tamat && (
                          <button
                            type="button"
                            onClick={() => setEditForm(prev => ({ ...prev, pus1_tamat: "" }))}
                            className="text-[8px] font-bold text-rose-500 hover:text-rose-400 flex items-center gap-0.5 px-1 py-0.2 rounded hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Padam tarikh Pus 1 Tamat"
                          >
                            <X size={9} /> Padam
                          </button>
                        )}
                      </div>
                      <div className="relative flex items-center">
                        <input 
                          type="date"
                          value={editForm.pus1_tamat}
                          onChange={(e) => setEditForm(prev => ({ ...prev, pus1_tamat: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Backspace' || e.key === 'Delete') {
                              e.preventDefault();
                              setEditForm(prev => ({ ...prev, pus1_tamat: "" }));
                            }
                          }}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-3 pr-8 py-2 text-xs text-slate-700 dark:text-slate-200 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        {editForm.pus1_tamat && (
                          <button
                            type="button"
                            onClick={() => setEditForm(prev => ({ ...prev, pus1_tamat: "" }))}
                            title="Padam tarikh Pus 1 Tamat"
                            aria-label="Padam tarikh Pus 1 Tamat"
                            className="absolute right-7 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors z-10 cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* PUS 2 MULA */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[8px] font-black uppercase text-slate-400">Pus 2 Mula</label>
                        {editForm.pus2_mula && (
                          <button
                            type="button"
                            onClick={() => setEditForm(prev => ({ ...prev, pus2_mula: "" }))}
                            className="text-[8px] font-bold text-rose-500 hover:text-rose-400 flex items-center gap-0.5 px-1 py-0.2 rounded hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Padam tarikh Pus 2 Mula"
                          >
                            <X size={9} /> Padam
                          </button>
                        )}
                      </div>
                      <div className="relative flex items-center">
                        <input 
                          type="date"
                          value={editForm.pus2_mula}
                          onChange={(e) => setEditForm(prev => ({ ...prev, pus2_mula: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Backspace' || e.key === 'Delete') {
                              e.preventDefault();
                              setEditForm(prev => ({ ...prev, pus2_mula: "" }));
                            }
                          }}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-3 pr-8 py-2 text-xs text-slate-700 dark:text-slate-200 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        {editForm.pus2_mula && (
                          <button
                            type="button"
                            onClick={() => setEditForm(prev => ({ ...prev, pus2_mula: "" }))}
                            title="Padam tarikh Pus 2 Mula"
                            aria-label="Padam tarikh Pus 2 Mula"
                            className="absolute right-7 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors z-10 cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* PUS 2 TAMAT */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[8px] font-black uppercase text-slate-400">Pus 2 Tamat</label>
                        {editForm.pus2_tamat && (
                          <button
                            type="button"
                            onClick={() => setEditForm(prev => ({ ...prev, pus2_tamat: "" }))}
                            className="text-[8px] font-bold text-rose-500 hover:text-rose-400 flex items-center gap-0.5 px-1 py-0.2 rounded hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Padam tarikh Pus 2 Tamat"
                          >
                            <X size={9} /> Padam
                          </button>
                        )}
                      </div>
                      <div className="relative flex items-center">
                        <input 
                          type="date"
                          value={editForm.pus2_tamat}
                          onChange={(e) => setEditForm(prev => ({ ...prev, pus2_tamat: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Backspace' || e.key === 'Delete') {
                              e.preventDefault();
                              setEditForm(prev => ({ ...prev, pus2_tamat: "" }));
                            }
                          }}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-3 pr-8 py-2 text-xs text-slate-700 dark:text-slate-200 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        {editForm.pus2_tamat && (
                          <button
                            type="button"
                            onClick={() => setEditForm(prev => ({ ...prev, pus2_tamat: "" }))}
                            title="Padam tarikh Pus 2 Tamat"
                            aria-label="Padam tarikh Pus 2 Tamat"
                            className="absolute right-7 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors z-10 cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="h-[1px] bg-slate-100 dark:bg-slate-800" />

                {/* HEKTAR & METRICS INPUTS */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[8px] font-black uppercase text-emerald-600 dark:text-emerald-400 mb-1">
                      Luas Kerja Siap Harian (Ha) (Maks: {editingBlock.defaultHektar.toFixed(2)})
                    </label>
                    <input 
                      type="number"
                      step="0.01"
                      value={editForm.hektar_siap === 0 ? '' : editForm.hektar_siap}
                      placeholder="0.00"
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setEditForm({ ...editForm, hektar_siap: Math.max(0, val) });
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-emerald-300 dark:border-emerald-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 font-black focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="block text-[7px] font-bold text-slate-400 mt-0.5">
                      Direkod & automatik terkumpul ke Luas Siap Bulanan (Ha)
                    </span>
                  </div>
                  <div>
                    <label className="block text-[8px] font-black uppercase text-emerald-600 dark:text-emerald-400 mb-1">
                      Bil. Tandan Harian / Capai Tandan (TBS)
                    </label>
                    <input 
                      type="number"
                      value={editForm.capai_tandan === 0 ? '' : editForm.capai_tandan}
                      placeholder="0"
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 0;
                        setEditForm({ 
                          ...editForm, 
                          capai_tandan: Math.max(0, val),
                          tandan_harian: val > 0 ? val : editForm.tandan_harian
                        });
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-emerald-300 dark:border-emerald-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 font-black focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="block text-[7px] font-bold text-slate-400 mt-0.5">
                      Direkod & automatik terkumpul ke Tandan Bulanan (M-TD)
                    </span>
                  </div>
                  <div>
                    <label className="block text-[8px] font-black uppercase text-slate-400 mb-1">Backlog Diladang (TBS)</label>
                    <input 
                      type="number"
                      value={editForm.backlog_diladang === 0 ? '' : editForm.backlog_diladang}
                      placeholder="0"
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 0;
                        setEditForm({ ...editForm, backlog_diladang: Math.max(0, val) });
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-200 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-black uppercase text-slate-400 mb-1">
                      Custom ABW Override (kg)
                    </label>
                    <input 
                      type="number"
                      step="0.01"
                      value={editForm.custom_abw === 0 ? '' : editForm.custom_abw}
                      placeholder={`Auto (${getDynamicBlockAbw(editingBlock.id).toFixed(1)} kg)`}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setEditForm({ ...editForm, custom_abw: Math.max(0, val) });
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-200 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* EDITABLE MASTER FIELDS */}
                <div className="h-[1px] bg-slate-100 dark:bg-slate-800" />
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-955/15 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div>
                    <label className="block text-[7px] font-black uppercase text-slate-400 mb-1">Bilangan Buruh</label>
                    <input 
                      type="number"
                      value={editForm.bil_buruh}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 0;
                        setEditForm({ ...editForm, bil_buruh: Math.max(0, val) });
                      }}
                      className="w-full bg-transparent border-b border-slate-200 dark:border-slate-800 rounded-none px-1 py-1 text-[11px] text-slate-700 dark:text-slate-200 font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[7px] font-black uppercase text-slate-400 mb-1">Tandan Harian Sasaran</label>
                    <input 
                      type="number"
                      value={editForm.tandan_harian}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 0;
                        setEditForm({ ...editForm, tandan_harian: Math.max(0, val) });
                      }}
                      className="w-full bg-transparent border-b border-slate-200 dark:border-slate-800 rounded-none px-1 py-1 text-[11px] text-slate-700 dark:text-slate-200 font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* CATATAN */}
                <div>
                  <label className="block text-[8px] font-black uppercase text-slate-400 mb-1">Catatan / Tindakan Susulan</label>
                  <textarea 
                    value={editForm.catatan}
                    onChange={(e) => setEditForm({ ...editForm, catatan: e.target.value })}
                    placeholder="Masukkan ulasan tindakan..."
                    rows={2}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-200 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                  />
                </div>
              </div>

              <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 flex justify-end items-center gap-3 bg-slate-50 dark:bg-slate-950 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingBlock(null)}
                  className="px-4 py-2.5 min-h-[44px] text-xs uppercase font-black tracking-widest text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors flex items-center justify-center cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleEditSave}
                  className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs uppercase font-black min-h-[44px] px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                >
                  <Check size={14} className="stroke-[3]" /> Simpan
                </button>
              </div>
            </motion.div>
          </div>
        )}

      </AnimatePresence>
    </div>
  );
};

export const LaporanBacklogView = React.memo(LaporanBacklogViewComponent);

