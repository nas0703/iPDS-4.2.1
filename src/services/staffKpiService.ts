/**
 * Staff KPI Service - Multi-Tenant Estate Architecture
 * Handles loading, saving, and synchronizing Staff KPI configurations & scores
 * with strict estate isolation (FPM Tunggal, FPM Adela, FPM Kledang, FPM Sening, Wilayah JB).
 * 
 * Supports:
 * - Isolated LocalStorage per estate: fpm_staff_kpi_v2_${estateId}
 * - Cloud database sync via Supabase app_settings table: key = staff_kpi_${estateId}
 * - Real-time sync & estate switching listener
 */

import { supabase, isSupabaseReady } from './supabaseClient';
import { getActiveEstateId, ESTATE_CHANGED_EVENT } from '../utils/estateContext';

export interface StaffKpiMetrics {
  hasilPct: number;    // 30% weight
  btsMudaPct: number;  // 15% weight
  kpgKpaPct: number;   // 15% weight
  efbPct: number;      // 15% weight
  membajaPct: number;  // 15% weight
  merumputPct: number; // 10% weight
}

export interface StaffConfig {
  id: string;
  name: string;
  role: string;
  blocks: string[];
  totalLuas: number;
  avatarColor: string;
  badgeBg: string;
  chartColor: string;
  baseMetrics: StaffKpiMetrics;
  notes?: string;
}

export interface EstateStaffKpiPayload {
  estateId: string;
  estateName: string;
  lastUpdated: string;
  updatedBy?: string;
  staffList: StaffConfig[];
  customScores: Record<string, { metrics: Partial<StaffKpiMetrics>; notes: string }>;
}

/**
 * Official Baseline Staff Registry Per Estate
 */
export const ESTATE_STAFF_REGISTRY: Record<string, StaffConfig[]> = {
  // 1. FPM TUNGGAL (1,568.30 HA) - 4 Penyelia (Pkt 1 & 2)
  FPM_TUNGGAL: [
    {
      id: 'ADIB',
      name: 'ADIB',
      role: 'Penolong Penyelia / Supervisor (Blok 1A & 1B)',
      blocks: ['1', '2', '3', '5', '6', '7'],
      totalLuas: 447.01,
      avatarColor: 'from-emerald-500 to-teal-700',
      badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      chartColor: '#10b981',
      baseMetrics: {
        hasilPct: 94.2,
        btsMudaPct: 92.0,
        kpgKpaPct: 90.5,
        efbPct: 88.0,
        membajaPct: 95.0,
        merumputPct: 91.0
      }
    },
    {
      id: 'ARIL',
      name: 'ARIL',
      role: 'Penolong Penyelia / Supervisor (Blok 1C)',
      blocks: ['4', '8', '9', '10', '11', '12'],
      totalLuas: 467.09,
      avatarColor: 'from-blue-500 to-indigo-700',
      badgeBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      chartColor: '#3b82f6',
      baseMetrics: {
        hasilPct: 88.5,
        btsMudaPct: 90.0,
        kpgKpaPct: 87.0,
        efbPct: 85.0,
        membajaPct: 92.0,
        merumputPct: 89.0
      }
    },
    {
      id: 'KIROMIN',
      name: 'KIROMIN',
      role: 'Penolong Penyelia / Supervisor (Blok 1D)',
      blocks: ['13', '14', '15', '16', '17'],
      totalLuas: 338.09,
      avatarColor: 'from-purple-500 to-violet-700',
      badgeBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
      chartColor: '#a855f7',
      baseMetrics: {
        hasilPct: 91.0,
        btsMudaPct: 88.5,
        kpgKpaPct: 92.0,
        efbPct: 90.0,
        membajaPct: 87.0,
        merumputPct: 93.0
      }
    },
    {
      id: 'WAN',
      name: 'WAN (PKT 002)',
      role: 'Penolong Penyelia / Supervisor (Sektor 2)',
      blocks: ['18', '19', '20', '21', '22'],
      totalLuas: 316.12,
      avatarColor: 'from-amber-500 to-orange-700',
      badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      chartColor: '#f59e0b',
      baseMetrics: {
        hasilPct: 89.8,
        btsMudaPct: 94.0,
        kpgKpaPct: 89.0,
        efbPct: 86.5,
        membajaPct: 90.0,
        merumputPct: 88.0
      }
    }
  ],

  // 2. FPM ADELA (1,041.22 HA) - 4 Penyelia (Pkt 1, Pkt 2, Felda & Tambahan)
  FPM_ADELA: [
    {
      id: 'FS_ADL_01',
      name: 'FS ADELA 01 (SEKTOR 1A)',
      role: 'Penolong Penyelia (Peringkat 1 - Blok 1-6)',
      blocks: ['1', '2', '3', '4', '5', '6'],
      totalLuas: 327.02,
      avatarColor: 'from-emerald-500 to-teal-700',
      badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      chartColor: '#10b981',
      baseMetrics: {
        hasilPct: 91.5,
        btsMudaPct: 93.0,
        kpgKpaPct: 89.5,
        efbPct: 88.0,
        membajaPct: 94.0,
        merumputPct: 90.0
      }
    },
    {
      id: 'FS_ADL_02',
      name: 'FS ADELA 02 (SEKTOR 1B)',
      role: 'Penolong Penyelia (Peringkat 1 - Blok 7-11)',
      blocks: ['7', '8', '9', '10', '11'],
      totalLuas: 286.62,
      avatarColor: 'from-blue-500 to-indigo-700',
      badgeBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      chartColor: '#3b82f6',
      baseMetrics: {
        hasilPct: 89.2,
        btsMudaPct: 91.0,
        kpgKpaPct: 91.0,
        efbPct: 86.5,
        membajaPct: 92.5,
        merumputPct: 88.5
      }
    },
    {
      id: 'FS_ADL_03',
      name: 'FS ADELA 03 (SEKTOR 2)',
      role: 'Penolong Penyelia (Peringkat 2 - Blok 12-17)',
      blocks: ['12', '13', '14', '15', '16', '17'],
      totalLuas: 333.42,
      avatarColor: 'from-purple-500 to-violet-700',
      badgeBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
      chartColor: '#a855f7',
      baseMetrics: {
        hasilPct: 88.1,
        btsMudaPct: 89.5,
        kpgKpaPct: 88.0,
        efbPct: 85.0,
        membajaPct: 89.0,
        merumputPct: 91.0
      }
    },
    {
      id: 'FS_ADL_04',
      name: 'FS ADELA 04 (LOT FELDA & TAMBAHAN)',
      role: 'Penolong Penyelia (Lot FELDA & Tambahan)',
      blocks: ['1F', '2F', '125Y', '128Y', '121V'],
      totalLuas: 94.16,
      avatarColor: 'from-amber-500 to-orange-700',
      badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      chartColor: '#f59e0b',
      baseMetrics: {
        hasilPct: 82.5,
        btsMudaPct: 88.0,
        kpgKpaPct: 86.0,
        efbPct: 83.0,
        membajaPct: 87.0,
        merumputPct: 86.0
      }
    }
  ],

  // 3. FPM KLEDANG (STANDBY / PRE-REGISTERED)
  FPM_KLEDANG: [
    {
      id: 'FS_KLD_01',
      name: 'FS KLEDANG 01 (SEKTOR 1)',
      role: 'Penolong Penyelia (Peringkat 1)',
      blocks: ['K1', 'K2', 'K3', 'K4'],
      totalLuas: 350.00,
      avatarColor: 'from-emerald-500 to-teal-700',
      badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      chartColor: '#10b981',
      baseMetrics: {
        hasilPct: 85.0,
        btsMudaPct: 88.0,
        kpgKpaPct: 86.0,
        efbPct: 85.0,
        membajaPct: 90.0,
        merumputPct: 88.0
      }
    },
    {
      id: 'FS_KLD_02',
      name: 'FS KLEDANG 02 (SEKTOR 2)',
      role: 'Penolong Penyelia (Peringkat 2)',
      blocks: ['K5', 'K6', 'K7', 'K8'],
      totalLuas: 320.00,
      avatarColor: 'from-blue-500 to-indigo-700',
      badgeBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      chartColor: '#3b82f6',
      baseMetrics: {
        hasilPct: 86.0,
        btsMudaPct: 87.0,
        kpgKpaPct: 88.0,
        efbPct: 84.0,
        membajaPct: 89.0,
        merumputPct: 87.0
      }
    }
  ],

  // 4. FPM SENING (STANDBY / PRE-REGISTERED)
  FPM_SENING: [
    {
      id: 'FS_SNG_01',
      name: 'FS SENING 01 (SEKTOR 1)',
      role: 'Penolong Penyelia (Peringkat 1)',
      blocks: ['S1', 'S2', 'S3', 'S4'],
      totalLuas: 340.00,
      avatarColor: 'from-emerald-500 to-teal-700',
      badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      chartColor: '#10b981',
      baseMetrics: {
        hasilPct: 84.0,
        btsMudaPct: 86.0,
        kpgKpaPct: 85.0,
        efbPct: 83.0,
        membajaPct: 88.0,
        merumputPct: 85.0
      }
    },
    {
      id: 'FS_SNG_02',
      name: 'FS SENING 02 (SEKTOR 2)',
      role: 'Penolong Penyelia (Peringkat 2)',
      blocks: ['S5', 'S6', 'S7', 'S8'],
      totalLuas: 310.00,
      avatarColor: 'from-blue-500 to-indigo-700',
      badgeBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      chartColor: '#3b82f6',
      baseMetrics: {
        hasilPct: 85.5,
        btsMudaPct: 87.5,
        kpgKpaPct: 86.0,
        efbPct: 84.0,
        membajaPct: 89.0,
        merumputPct: 86.0
      }
    }
  ],

  // 5. WILAYAH JOHOR BAHRU (ZON ADELA - EXECUTIVE COMPARISON)
  WILAYAH_JB: [
    {
      id: 'TUNGGAL_AVG',
      name: 'LADANG FPM TUNGGAL',
      role: 'Penyelia Lapangan FPM Tunggal (1,568.3 Ha)',
      blocks: ['1-22'],
      totalLuas: 1568.30,
      avatarColor: 'from-emerald-500 to-teal-700',
      badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      chartColor: '#10b981',
      baseMetrics: {
        hasilPct: 90.9,
        btsMudaPct: 91.1,
        kpgKpaPct: 89.6,
        efbPct: 87.4,
        membajaPct: 91.0,
        merumputPct: 90.3
      }
    },
    {
      id: 'ADELA_AVG',
      name: 'LADANG FPM ADELA',
      role: 'Penyelia Lapangan FPM Adela (1,041.2 Ha)',
      blocks: ['1-17, 1F, 2F, 125Y, 128Y, 121V'],
      totalLuas: 1041.22,
      avatarColor: 'from-blue-500 to-indigo-700',
      badgeBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      chartColor: '#3b82f6',
      baseMetrics: {
        hasilPct: 87.8,
        btsMudaPct: 90.4,
        kpgKpaPct: 88.6,
        efbPct: 85.6,
        membajaPct: 90.6,
        merumputPct: 88.9
      }
    },
    {
      id: 'KLEDANG_AVG',
      name: 'LADANG FPM KLEDANG',
      role: 'Penyelia Lapangan FPM Kledang (Standby)',
      blocks: ['K1-K8'],
      totalLuas: 670.00,
      avatarColor: 'from-purple-500 to-violet-700',
      badgeBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
      chartColor: '#a855f7',
      baseMetrics: {
        hasilPct: 85.5,
        btsMudaPct: 87.5,
        kpgKpaPct: 87.0,
        efbPct: 84.5,
        membajaPct: 89.5,
        merumputPct: 87.5
      }
    },
    {
      id: 'SENING_AVG',
      name: 'LADANG FPM SENING',
      role: 'Penyelia Lapangan FPM Sening (Standby)',
      blocks: ['S1-S8'],
      totalLuas: 650.00,
      avatarColor: 'from-amber-500 to-orange-700',
      badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      chartColor: '#f59e0b',
      baseMetrics: {
        hasilPct: 84.8,
        btsMudaPct: 86.8,
        kpgKpaPct: 85.5,
        efbPct: 83.5,
        membajaPct: 88.5,
        merumputPct: 85.5
      }
    }
  ]
};

/**
 * Storage Key generator partitioned by Estate ID
 */
function getStorageKey(estateId: string): string {
  const normId = (estateId || 'FPM_TUNGGAL').trim().toUpperCase();
  return `fpm_staff_kpi_v2_${normId}`;
}

function getSupabaseKey(estateId: string): string {
  const normId = (estateId || 'FPM_TUNGGAL').trim().toUpperCase();
  return `staff_kpi_${normId}`;
}

/**
 * Get default staff list for an estate
 */
export function getDefaultStaffForEstate(estateId: string): StaffConfig[] {
  const normId = (estateId || '').trim().toUpperCase();
  if (normId === 'FPM_TUNGGAL' || normId === '5155' || normId === 'TGL') {
    return ESTATE_STAFF_REGISTRY.FPM_TUNGGAL;
  }
  return ESTATE_STAFF_REGISTRY[normId] || [];
}

/**
 * Load Staff KPI state for a specific estate (Local storage + Supabase cloud fallback)
 */
export function loadEstateStaffKpi(estateId: string): {
  staffList: StaffConfig[];
  customScores: Record<string, { metrics: Partial<StaffKpiMetrics>; notes: string }>;
  source: 'local' | 'cloud' | 'default';
  lastUpdated?: string;
} {
  const normId = (estateId || 'FPM_TUNGGAL').trim().toUpperCase();
  const storageKey = getStorageKey(normId);

  // 1. Check local storage partitioned by estateId
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && Array.isArray(parsed.staffList) && parsed.staffList.length > 0) {
          return {
            staffList: parsed.staffList,
            customScores: parsed.customScores || {},
            source: 'local',
            lastUpdated: parsed.lastUpdated
          };
        }
      }
    } catch (e) {
      console.warn(`[StaffKpiService] Error loading local KPI for ${normId}:`, e);
    }
  }

  // 2. Fallback to default preset for this specific estate
  const defaultStaff = getDefaultStaffForEstate(normId);
  return {
    staffList: defaultStaff,
    customScores: {},
    source: 'default'
  };
}

/**
 * Save Staff KPI state for a specific estate (both to isolated LocalStorage and Supabase app_settings)
 */
export async function saveEstateStaffKpi(
  estateId: string,
  staffList: StaffConfig[],
  customScores: Record<string, { metrics: Partial<StaffKpiMetrics>; notes: string }>,
  updatedBy?: string
): Promise<{ success: boolean; cloudSynced: boolean }> {
  const normId = (estateId || 'FPM_TUNGGAL').trim().toUpperCase();
  const storageKey = getStorageKey(normId);
  const now = new Date().toISOString();

  const payload: EstateStaffKpiPayload = {
    estateId: normId,
    estateName: normId.replace('_', ' '),
    lastUpdated: now,
    updatedBy: updatedBy || 'FC / Super Admin',
    staffList,
    customScores
  };

  // 1. Save to isolated LocalStorage immediately
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch (e) {
      console.error(`[StaffKpiService] Error saving local KPI for ${normId}:`, e);
    }
  }

  // 2. Save to Supabase app_settings if available
  let cloudSynced = false;
  if (isSupabaseReady()) {
    try {
      const supabaseKey = getSupabaseKey(normId);
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          key: supabaseKey,
          value: payload,
          updated_at: now
        }, { onConflict: 'key' });

      if (!error) {
        cloudSynced = true;
      } else {
        console.warn(`[StaffKpiService] Supabase sync warning for ${normId}:`, error.message);
      }
    } catch (sbErr) {
      console.warn(`[StaffKpiService] Supabase sync failed:`, sbErr);
    }
  }

  // 3. Dispatch an event for components listening to KPI updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ipds_staff_kpi_updated', {
      detail: { estateId: normId, payload }
    }));
  }

  return { success: true, cloudSynced };
}

/**
 * Reset Staff KPI state for a specific estate to factory defaults
 */
export async function resetEstateStaffKpiToDefault(estateId: string): Promise<void> {
  const normId = (estateId || 'FPM_TUNGGAL').trim().toUpperCase();
  const storageKey = getStorageKey(normId);

  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {
      console.error(e);
    }
  }

  // If Supabase is ready, delete or reset row
  if (isSupabaseReady()) {
    try {
      const supabaseKey = getSupabaseKey(normId);
      await supabase.from('app_settings').delete().eq('key', supabaseKey);
    } catch (e) {
      console.warn(e);
    }
  }

  // Dispatch update event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ipds_staff_kpi_updated', {
      detail: { estateId: normId, reset: true }
    }));
  }
}
