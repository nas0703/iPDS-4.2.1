import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, Calendar, Trophy, Layers, Sprout, TrendingUp, TrendingDown,
  Sparkles, Info, Home, PlusCircle, ArrowUpDown, Table, CheckCircle2, ChevronRight,
  Search, Filter, Database
} from 'lucide-react';
import { Transaction } from '../../../types';
import { ZONES, ESTATES_REGISTRY, getEstateConfig, DEFAULT_MONTHLY_TARGETS_2026 } from '../../../config/estateRegistry';
import { inferEstateFromReceipt } from '../../../utils/estateContext';
import { getHistoricalYieldData2025 } from '../../../utils/constants';
import { supabase } from '../../../services/supabaseClient';
import { safeFetch } from '../../../utils/safeFetch';

// Helper mengekstrak nombor peringkat secara mantap (e.g. 'PKT 001', '001', '1', 'PKT 2')
export const cleanPktNum = (val: any): number => {
  if (val === null || val === undefined) return NaN;
  const str = String(val).toUpperCase().trim();
  if (str.includes('EFB')) return NaN;
  const numMatch = str.match(/\d+/);
  return numMatch ? parseInt(numMatch[0], 10) : NaN;
};

// Helper penyelesaian peringkat transaksi yang tepat mengikut blok dan metadata ladang
export const resolveTransactionPkt = (t: any, targetEstateId?: string): number => {
  if (!t) return NaN;

  // 1. Semak EFB (dikecualikan daripada pengiraan hasil TBS utama)
  const isEFB = String(t.no_resit || '').startsWith('EFB-HIST-') || 
                String(t.no_tiket || '').startsWith('EFB-') || 
                String(t.kod_item || '').startsWith('EFB-') ||
                t.is_efb === true ||
                String(t.peringkat || '').toUpperCase().trim() === 'EFB' ||
                String(t.blok || '').toUpperCase().trim() === 'EFB';
  if (isEFB) return NaN;

  const resolvedEstateId = targetEstateId || t.estate_id || inferEstateFromReceipt(t) || 'FPM_TUNGGAL';
  const estCfg = ESTATES_REGISTRY[resolvedEstateId];

  const rawBlok = String(t.blok || '').trim().toUpperCase();
  const rawPkt = String(t.peringkat || '').trim().toUpperCase();
  const rawKp = String(t.kod_penjual || '').trim().toUpperCase();
  const rawKa = String(t.kod_akaun_bts || '').trim().toUpperCase();
  const rawNp = String(t.nama_penjual || '').trim().toUpperCase();

  // 2. Semak Lot Felda (Pkt 3) secara keutamaan tinggi
  const isFelda = 
    rawPkt.includes('003') || 
    rawPkt.includes('FELDA') || 
    rawBlok === '88' || 
    rawBlok === '88F' || 
    rawBlok === 'F88' || 
    rawBlok === 'LF' || 
    rawBlok === '1F' || 
    rawBlok === '2F' ||
    rawKp.includes('88F') ||
    rawKa.includes('88F');
  if (isFelda) return 3;

  // 3. Semak Lot Tambahan (Pkt 4)
  const isTambahan = 
    rawPkt.includes('004') || 
    rawPkt.includes('TAMBAHAN') || 
    ['125Y', '128Y', '121V'].includes(rawBlok) ||
    rawBlok.endsWith('Y') || 
    rawBlok.endsWith('V');
  if (isTambahan) return 4;

  // 4. Semak Peringkat 2 (Pkt 2) secara eksplisit
  const has020 =
    rawKp.includes('-020-') ||
    rawKa.includes('-020-') ||
    /[-_]020[-_]/.test(rawKp) ||
    /[-_]020[-_]/.test(rawKa) ||
    /\b\d{4}-020-/.test(rawKp) ||
    /\b\d{4}-020-/.test(rawKa) ||
    /\b020\b/.test(rawKa);

  const isExplicitPkt2 = 
    rawBlok.startsWith('P2-') || 
    rawBlok.startsWith('P2 ') || 
    rawBlok.startsWith('PKT 2') || 
    rawBlok.startsWith('PKT2') ||
    rawPkt === '002' || 
    rawPkt === '2' || 
    rawPkt.includes('002') || 
    rawPkt.includes('PKT 2') || 
    rawPkt.includes('PKT2') || 
    rawPkt.includes('PERINGKAT 2') ||
    has020 ||
    rawNp.includes('PKT 2') || 
    rawNp.includes('PERINGKAT 2');

  // 5. Semak mengikut Registry Blok Ladang
  if (estCfg?.blocks && estCfg.blocks[rawBlok]) {
    const bInfo = estCfg.blocks[rawBlok];
    if (bInfo.pkt === '001') return 1;
    if (bInfo.pkt === '002') return 2;
    if (bInfo.pkt === '003') return 3;
    if (bInfo.pkt === '004') return 4;
  }

  // 6. Semak nombor blok berangka mengikut ladang (SSOT Definisi Ladang)
  const digitsOnly = rawBlok.replace(/[^0-9]/g, '');
  const bNum = digitsOnly ? parseInt(digitsOnly, 10) : NaN;

  if (resolvedEstateId === 'FPM_TUNGGAL') {
    if (!isNaN(bNum)) {
      if (bNum >= 1 && bNum <= 17) return 1;
      if (bNum >= 18 && bNum <= 22) return 2;
      if (bNum === 88) return 3;
    }
  } else if (resolvedEstateId === 'FPM_ADELA') {
    if (isExplicitPkt2) return 2;
    if (!isNaN(bNum)) {
      if (bNum >= 1 && bNum <= 11) return 1;
      if (bNum >= 12 && bNum <= 17) return 2;
    }
  }

  if (isExplicitPkt2) return 2;

  // 7. Semak Peringkat 1 (Pkt 1) secara eksplisit
  const isExplicitPkt1 = 
    rawBlok.startsWith('P1-') || 
    rawBlok.startsWith('P1 ') || 
    rawBlok.startsWith('PKT 1') || 
    rawBlok.startsWith('PKT1') ||
    rawPkt === '001' || 
    rawPkt === '1' || 
    rawPkt.includes('001') || 
    rawPkt.includes('PKT 1') || 
    rawPkt.includes('PKT1') || 
    rawPkt.includes('PERINGKAT 1') ||
    rawNp.includes('PKT 1') || 
    rawNp.includes('PERINGKAT 1');

  if (isExplicitPkt1) return 1;

  if (!isNaN(bNum) && bNum >= 1 && bNum <= 17) {
    return 1;
  }

  const pNum = cleanPktNum(rawPkt);
  if (!isNaN(pNum)) return pNum;

  return NaN;
};

export interface WilayahExperimentTableSectionProps {
  rawData: Transaction[];
  dashboardDate: string;
  isDarkMode: boolean;
  blockAnnualData?: any[];
  onSelectEstate?: (estateId: string) => void;
}

export interface ZonPktRow {
  bil: number;
  tahunTuai: number;
  projek: string; // e.g. TUNGGAL, KLEDANG, SENING, ADELA, SG. MAS, etc.
  estateId: string;
  zoneId: string; // e.g. ZON_ADELA, ZON_SEPAKAT, ZON_LAW, ZON_TENGGAROH, ZON_TAIB_ANDAK
  zoneName: string; // e.g. Zon Adela, Zon Sepakat, etc.
  pkt: number; // 1, 2, 3
  luas: number;
  ang2026: number; // e.g. 28, 25
  // Anggaran (T/Ha)
  ang_bi: number; // Bulan Ini
  ang_hbi: number; // Hingga Bulan Ini (YTD)
  // Pencapaian (T/Ha)
  capai_bi: number;
  capai_hbi: number;
  // Peratus Capai
  pct_bi: number;
  pct_hbi: number;
  // Perbezaan Hasil 2025 & 2026
  hasil_2025: number;
  hasil_2026: number;
  beza_tan: number;
  pct_beza: number;
  // % Capai Tahunan (terhadap Anggaran 2026)
  pct_capai_thnn: number;
  // Metadata sumber data Supabase
  hasData?: boolean;
  txCount?: number;
  liveSource?: 'supabase' | 'tiada_rekod' | 'rasmi';
}

// Master template Matang Utama untuk SEMUA 40 Ladang merentasi 5 Zon Wilayah Johor Bahru
export const OFFICIAL_ALL_ESTATES_ROWS: ZonPktRow[] = [
  // ==========================================
  // 1. ZON ADELA (4 LADANG, 8 BARIS PERINGKAT)
  // ==========================================
  {
    bil: 18,
    tahunTuai: 15,
    projek: 'TUNGGAL',
    estateId: 'FPM_TUNGGAL',
    zoneId: 'ZON_ADELA',
    zoneName: 'Zon Adela',
    pkt: 1,
    luas: 1251.99,
    ang2026: 28.0,
    ang_bi: 2.90,
    ang_hbi: 19.90,
    capai_bi: 2.44,
    capai_hbi: 18.21,
    pct_bi: 84,
    pct_hbi: 92,
    hasil_2025: 0,
    hasil_2026: 18.21,
    beza_tan: 0,
    pct_beza: 0,
    pct_capai_thnn: 65,
  },
  {
    bil: 19,
    tahunTuai: 9,
    projek: 'TUNGGAL',
    estateId: 'FPM_TUNGGAL',
    zoneId: 'ZON_ADELA',
    zoneName: 'Zon Adela',
    pkt: 2,
    luas: 316.12,
    ang2026: 28.0,
    ang_bi: 2.70,
    ang_hbi: 19.50,
    capai_bi: 2.74,
    capai_hbi: 17.52,
    pct_bi: 101,
    pct_hbi: 90,
    hasil_2025: 0,
    hasil_2026: 17.52,
    beza_tan: 0,
    pct_beza: 0,
    pct_capai_thnn: 63,
  },
  {
    bil: 20,
    tahunTuai: 9,
    projek: 'KLEDANG',
    estateId: 'FPM_KLEDANG',
    zoneId: 'ZON_ADELA',
    zoneName: 'Zon Adela',
    pkt: 2,
    luas: 139.15,
    ang2026: 28.0,
    ang_bi: 2.70,
    ang_hbi: 19.60,
    capai_bi: 2.80,
    capai_hbi: 17.06,
    pct_bi: 104,
    pct_hbi: 87,
    hasil_2025: 0,
    hasil_2026: 17.06,
    beza_tan: 0,
    pct_beza: 0,
    pct_capai_thnn: 61,
  },
  {
    bil: 21,
    tahunTuai: 15,
    projek: 'KLEDANG',
    estateId: 'FPM_KLEDANG',
    zoneId: 'ZON_ADELA',
    zoneName: 'Zon Adela',
    pkt: 1,
    luas: 677.81,
    ang2026: 28.0,
    ang_bi: 2.90,
    ang_hbi: 20.50,
    capai_bi: 2.36,
    capai_hbi: 16.89,
    pct_bi: 81,
    pct_hbi: 82,
    hasil_2025: 0,
    hasil_2026: 16.89,
    beza_tan: 0,
    pct_beza: 0,
    pct_capai_thnn: 60,
  },
  {
    bil: 22,
    tahunTuai: 19,
    projek: 'SENING',
    estateId: 'FPM_SENING',
    zoneId: 'ZON_ADELA',
    zoneName: 'Zon Adela',
    pkt: 1,
    luas: 1239.46,
    ang2026: 25.0,
    ang_bi: 2.40,
    ang_hbi: 17.83,
    capai_bi: 1.88,
    capai_hbi: 14.79,
    pct_bi: 78,
    pct_hbi: 83,
    hasil_2025: 0,
    hasil_2026: 14.79,
    beza_tan: 0,
    pct_beza: 0,
    pct_capai_thnn: 59,
  },
  {
    bil: 23,
    tahunTuai: 19,
    projek: 'ADELA',
    estateId: 'FPM_ADELA',
    zoneId: 'ZON_ADELA',
    zoneName: 'Zon Adela',
    pkt: 1,
    luas: 613.64,
    ang2026: 25.0,
    ang_bi: 2.90,
    ang_hbi: 17.60,
    capai_bi: 1.80,
    capai_hbi: 13.91,
    pct_bi: 62,
    pct_hbi: 79,
    hasil_2025: 0,
    hasil_2026: 13.91,
    beza_tan: 0,
    pct_beza: 0,
    pct_capai_thnn: 56,
  },
  {
    bil: 24,
    tahunTuai: 15,
    projek: 'KLEDANG',
    estateId: 'FPM_KLEDANG',
    zoneId: 'ZON_ADELA',
    zoneName: 'Zon Adela',
    pkt: 3,
    luas: 223.56,
    ang2026: 28.0,
    ang_bi: 2.40,
    ang_hbi: 19.60,
    capai_bi: 2.31,
    capai_hbi: 15.93,
    pct_bi: 96,
    pct_hbi: 81,
    hasil_2025: 0,
    hasil_2026: 15.93,
    beza_tan: 0,
    pct_beza: 0,
    pct_capai_thnn: 57,
  },
  {
    bil: 25,
    tahunTuai: 19,
    projek: 'ADELA',
    estateId: 'FPM_ADELA',
    zoneId: 'ZON_ADELA',
    zoneName: 'Zon Adela',
    pkt: 2,
    luas: 333.42,
    ang2026: 25.0,
    ang_bi: 2.30,
    ang_hbi: 17.50,
    capai_bi: 1.43,
    capai_hbi: 12.71,
    pct_bi: 62,
    pct_hbi: 73,
    hasil_2025: 0,
    hasil_2026: 12.71,
    beza_tan: 0,
    pct_beza: 0,
    pct_capai_thnn: 51,
  },

  // ==========================================
  // 2. ZON SEPAKAT (9 LADANG)
  // ==========================================
  { bil: 1, tahunTuai: 15, projek: 'SG. MAS', estateId: 'FPM_SG_MAS', zoneId: 'ZON_SEPAKAT', zoneName: 'Zon Sepakat', pkt: 1, luas: 850.00, ang2026: 25.0, ang_bi: 2.58, ang_hbi: 17.79, capai_bi: 2.20, capai_hbi: 15.80, pct_bi: 85, pct_hbi: 89, hasil_2025: 0, hasil_2026: 15.80, beza_tan: 0, pct_beza: 0, pct_capai_thnn: 63 },
  { bil: 2, tahunTuai: 16, projek: 'PAPAN TIMUR', estateId: 'FPM_PAPAN_TIMUR', zoneId: 'ZON_SEPAKAT', zoneName: 'Zon Sepakat', pkt: 1, luas: 920.00, ang2026: 25.0, ang_bi: 2.58, ang_hbi: 17.79, capai_bi: 2.30, capai_hbi: 16.10, pct_bi: 89, pct_hbi: 90, hasil_2025: 0, hasil_2026: 16.10, beza_tan: 0, pct_beza: 0, pct_capai_thnn: 64 },
  { bil: 3, tahunTuai: 14, projek: 'SEMENCHU', estateId: 'FPM_SEMENCHU', zoneId: 'ZON_SEPAKAT', zoneName: 'Zon Sepakat', pkt: 1, luas: 780.00, ang2026: 25.0, ang_bi: 2.58, ang_hbi: 17.79, capai_bi: 2.15, capai_hbi: 15.40, pct_bi: 83, pct_hbi: 87, hasil_2025: 0, hasil_2026: 15.40, beza_tan: 0, pct_beza: 0, pct_capai_thnn: 62 },
  { bil: 4, tahunTuai: 15, projek: 'AIR TAWAR 1', estateId: 'FPM_AIR_TAWAR_1', zoneId: 'ZON_SEPAKAT', zoneName: 'Zon Sepakat', pkt: 1, luas: 810.00, ang2026: 25.0, ang_bi: 2.58, ang_hbi: 17.79, capai_bi: 2.40, capai_hbi: 16.70, pct_bi: 93, pct_hbi: 94, hasil_2025: 0, hasil_2026: 16.70, beza_tan: 0, pct_beza: 0, pct_capai_thnn: 67 },
  { bil: 5, tahunTuai: 17, projek: 'AIR TAWAR 2', estateId: 'FPM_AIR_TAWAR_2', zoneId: 'ZON_SEPAKAT', zoneName: 'Zon Sepakat', pkt: 1, luas: 790.00, ang2026: 25.0, ang_bi: 2.58, ang_hbi: 17.79, capai_bi: 2.25, capai_hbi: 15.90, pct_bi: 87, pct_hbi: 89, hasil_2025: 0, hasil_2026: 15.90, beza_tan: 0, pct_beza: 0, pct_capai_thnn: 64 },
  { bil: 6, tahunTuai: 15, projek: 'AIR TAWAR 3', estateId: 'FPM_AIR_TAWAR_3', zoneId: 'ZON_SEPAKAT', zoneName: 'Zon Sepakat', pkt: 1, luas: 830.00, ang2026: 25.0, ang_bi: 2.58, ang_hbi: 17.79, capai_bi: 2.28, capai_hbi: 15.85, pct_bi: 88, pct_hbi: 89, hasil_2025: 0, hasil_2026: 15.85, beza_tan: 0, pct_beza: 0, pct_capai_thnn: 63 },
  { bil: 7, tahunTuai: 16, projek: 'AIR TAWAR 4', estateId: 'FPM_AIR_TAWAR_4', zoneId: 'ZON_SEPAKAT', zoneName: 'Zon Sepakat', pkt: 1, luas: 760.00, ang2026: 25.0, ang_bi: 2.58, ang_hbi: 17.79, capai_bi: 2.32, capai_hbi: 16.20, pct_bi: 90, pct_hbi: 91, hasil_2025: 0, hasil_2026: 16.20, beza_tan: 0, pct_beza: 0, pct_capai_thnn: 65 },
  { bil: 8, tahunTuai: 15, projek: 'AIR TAWAR 5', estateId: 'FPM_AIR_TAWAR_5', zoneId: 'ZON_SEPAKAT', zoneName: 'Zon Sepakat', pkt: 1, luas: 820.00, ang2026: 25.0, ang_bi: 2.58, ang_hbi: 17.79, capai_bi: 2.35, capai_hbi: 16.30, pct_bi: 91, pct_hbi: 92, hasil_2025: 0, hasil_2026: 16.30, beza_tan: 0, pct_beza: 0, pct_capai_thnn: 65 },
  { bil: 9, tahunTuai: 18, projek: 'PASAK', estateId: 'FPM_PASAK', zoneId: 'ZON_SEPAKAT', zoneName: 'Zon Sepakat', pkt: 1, luas: 940.00, ang2026: 25.0, ang_bi: 2.58, ang_hbi: 17.79, capai_bi: 2.45, capai_hbi: 17.10, pct_bi: 95, pct_hbi: 96, hasil_2025: 0, hasil_2026: 17.10, beza_tan: 0, pct_beza: 0, pct_capai_thnn: 68 },

  // ==========================================
  // 3. ZON LAW (7 LADANG)
  // ==========================================
  { bil: 10, tahunTuai: 16, projek: 'LOK HENG TMR', estateId: 'FPM_LOK_HENG_TIMUR', zoneId: 'ZON_LAW', zoneName: 'Zon LAW', pkt: 1, luas: 880.00, ang2026: 25.0, ang_bi: 2.58, ang_hbi: 17.79, capai_bi: 2.30, capai_hbi: 16.15, pct_bi: 89, pct_hbi: 91, hasil_2025: 0, hasil_2026: 16.15, beza_tan: 0, pct_beza: 0, pct_capai_thnn: 65 },
  { bil: 11, tahunTuai: 15, projek: 'LOK HENG BRT', estateId: 'FPM_LOK_HENG_BARAT', zoneId: 'ZON_LAW', zoneName: 'Zon LAW', pkt: 1, luas: 860.00, ang2026: 25.0, ang_bi: 2.58, ang_hbi: 17.79, capai_bi: 2.25, capai_hbi: 15.90, pct_bi: 87, pct_hbi: 89, hasil_2025: 0, hasil_2026: 15.90, beza_tan: 0, pct_beza: 0, pct_capai_thnn: 64 },
  { bil: 12, tahunTuai: 17, projek: 'LOK HENG SEL', estateId: 'FPM_LOK_HENG_SELATAN', zoneId: 'ZON_LAW', zoneName: 'Zon LAW', pkt: 1, luas: 790.00, ang2026: 25.0, ang_bi: 2.58, ang_hbi: 17.79, capai_bi: 2.20, capai_hbi: 15.60, pct_bi: 85, pct_hbi: 88, hasil_2025: 0, hasil_2026: 15.60, beza_tan: 0, pct_beza: 0, pct_capai_thnn: 62 },
  { bil: 13, tahunTuai: 14, projek: 'BUKIT WAHA', estateId: 'FPM_BUKIT_WAHA', zoneId: 'ZON_LAW', zoneName: 'Zon LAW', pkt: 1, luas: 950.00, ang2026: 26.0, ang_bi: 2.68, ang_hbi: 18.51, capai_bi: 2.48, capai_hbi: 17.30, pct_bi: 93, pct_hbi: 93, hasil_2025: 0, hasil_2026: 17.30, beza_tan: 0, pct_beza: 0, pct_capai_thnn: 67 },
  { bil: 14, tahunTuai: 15, projek: 'SIMPANG WAHA', estateId: 'FPM_SIMPANG_WAHA', zoneId: 'ZON_LAW', zoneName: 'Zon LAW', pkt: 1, luas: 820.00, ang2026: 25.0, ang_bi: 2.58, ang_hbi: 17.79, capai_bi: 2.26, capai_hbi: 15.80, pct_bi: 88, pct_hbi: 89, hasil_2025: 0, hasil_2026: 15.80, beza_tan: 0, pct_beza: 0, pct_capai_thnn: 63 },
  { bil: 15, tahunTuai: 16, projek: 'APING TIMUR', estateId: 'FPM_APING_TIMUR', zoneId: 'ZON_LAW', zoneName: 'Zon LAW', pkt: 1, luas: 840.00, ang2026: 25.0, ang_bi: 2.58, ang_hbi: 17.79, capai_bi: 2.28, capai_hbi: 15.95, pct_bi: 88, pct_hbi: 90, hasil_2025: 0, hasil_2026: 15.95, beza_tan: 0, pct_beza: 0, pct_capai_thnn: 64 },
  { bil: 16, tahunTuai: 15, projek: 'APING BARAT', estateId: 'FPM_APING_BARAT', zoneId: 'ZON_LAW', zoneName: 'Zon LAW', pkt: 1, luas: 810.00, ang2026: 25.0, ang_bi: 2.58, ang_hbi: 17.79, capai_bi: 2.30, capai_hbi: 16.05, pct_bi: 89, pct_hbi: 90, hasil_2025: 0, hasil_2026: 16.05, beza_tan: 0, pct_beza: 0, pct_capai_thnn: 64 },

  // ==========================================
  // 4. ZON TENGGAROH (9 LADANG)
  // ==========================================
  { bil: 26, tahunTuai: 15, projek: 'TENGGAROH 1', estateId: 'FPM_TENGGAROH_1', zoneId: 'ZON_TENGGAROH', zoneName: 'Zon Tenggaroh', pkt: 1, luas: 890.00, ang2026: 25.0, ang_bi: 2.58, ang_hbi: 17.79, capai_bi: 2.35, capai_hbi: 16.20, pct_bi: 91, pct_hbi: 91, hasil_2025: 0, hasil_2026: 16.20, beza_tan: 0, pct_beza: 0, pct_capai_thnn: 65 },
  { bil: 27, tahunTuai: 16, projek: 'TENGGAROH 2', estateId: 'FPM_TENGGAROH_2', zoneId: 'ZON_TENGGAROH', zoneName: 'Zon Tenggaroh', pkt: 1, luas: 850.00, ang2026: 25.0, ang_bi: 2.58, ang_hbi: 17.79, capai_bi: 2.25, capai_hbi: 15.80, pct_bi: 87, pct_hbi: 89, hasil_2025: 0, hasil_2026: 15.80, beza_tan: 0, pct_beza: 0, pct_capai_thnn: 63 },
  { bil: 28, tahunTuai: 14, projek: 'TENGGAROH 3', estateId: 'FPM_TENGGAROH_3', zoneId: 'ZON_TENGGAROH', zoneName: 'Zon Tenggaroh', pkt: 1, luas: 910.00, ang2026: 25.0, ang_bi: 2.58, ang_hbi: 17.79, capai_bi: 2.40, capai_hbi: 16.50, pct_bi: 93, pct_hbi: 93, hasil_2025: 0, hasil_2026: 16.50, beza_tan: 0, pct_beza: 0, pct_capai_thnn: 66 },
  { bil: 29, tahunTuai: 15, projek: 'TENGGAROH 4', estateId: 'FPM_TENGGAROH_4', zoneId: 'ZON_TENGGAROH', zoneName: 'Zon Tenggaroh', pkt: 1, luas: 870.00, ang2026: 25.0, ang_bi: 2.58, ang_hbi: 17.79, capai_bi: 2.28, capai_hbi: 15.95, pct_bi: 88, pct_hbi: 90, hasil_2025: 0, hasil_2026: 15.95, beza_tan: 0, pct_beza: 0, pct_capai_thnn: 64 },
  { bil: 30, tahunTuai: 17, projek: 'TENGGAROH 5', estateId: 'FPM_TENGGAROH_5', zoneId: 'ZON_TENGGAROH', zoneName: 'Zon Tenggaroh', pkt: 1, luas: 820.00, ang2026: 25.0, ang_bi: 2.58, ang_hbi: 17.79, capai_bi: 2.18, capai_hbi: 15.40, pct_bi: 85, pct_hbi: 87, hasil_2025: 0, hasil_2026: 15.40, beza_tan: 0, pct_beza: 0, pct_capai_thnn: 62 },
  { bil: 31, tahunTuai: 15, projek: 'TENGGAROH 6', estateId: 'FPM_TENGGAROH_6', zoneId: 'ZON_TENGGAROH', zoneName: 'Zon Tenggaroh', pkt: 1, luas: 840.00, ang2026: 25.0, ang_bi: 2.58, ang_hbi: 17.79, capai_bi: 2.30, capai_hbi: 16.00, pct_bi: 89, pct_hbi: 90, hasil_2025: 0, hasil_2026: 16.00, beza_tan: 0, pct_beza: 0, pct_capai_thnn: 64 },
  { bil: 32, tahunTuai: 16, projek: 'TENGGAROH 7', estateId: 'FPM_TENGGAROH_7', zoneId: 'ZON_TENGGAROH', zoneName: 'Zon Tenggaroh', pkt: 1, luas: 860.00, ang2026: 25.0, ang_bi: 2.58, ang_hbi: 17.79, capai_bi: 2.32, capai_hbi: 16.15, pct_bi: 90, pct_hbi: 91, hasil_2025: 0, hasil_2026: 16.15, beza_tan: 0, pct_beza: 0, pct_capai_thnn: 65 },
  { bil: 33, tahunTuai: 15, projek: 'TENGGAROH TMR', estateId: 'FPM_TENGGAROH_TIMUR', zoneId: 'ZON_TENGGAROH', zoneName: 'Zon Tenggaroh', pkt: 1, luas: 880.00, ang2026: 25.0, ang_bi: 2.58, ang_hbi: 17.79, capai_bi: 2.38, capai_hbi: 16.40, pct_bi: 92, pct_hbi: 92, hasil_2025: 0, hasil_2026: 16.40, beza_tan: 0, pct_beza: 0, pct_capai_thnn: 66 },
  { bil: 34, tahunTuai: 18, projek: 'TENGGAROH SEL', estateId: 'FPM_TENGGAROH_SELATAN', zoneId: 'ZON_TENGGAROH', zoneName: 'Zon Tenggaroh', pkt: 1, luas: 830.00, ang2026: 25.0, ang_bi: 2.58, ang_hbi: 17.79, capai_bi: 2.24, capai_hbi: 15.70, pct_bi: 87, pct_hbi: 88, hasil_2025: 0, hasil_2026: 15.70, beza_tan: 0, pct_beza: 0, pct_capai_thnn: 63 },

  // ==========================================
  // 5. ZON TAIB ANDAK (11 LADANG)
  // ==========================================
  { bil: 35, tahunTuai: 15, projek: 'BUKIT RAMUN', estateId: 'FPM_BUKIT_RAMUN', zoneId: 'ZON_TAIB_ANDAK', zoneName: 'Zon Taib Andak', pkt: 1, luas: 920.00, ang2026: 25.0, ang_bi: 2.58, ang_hbi: 17.79, capai_bi: 2.36, capai_hbi: 16.30, pct_bi: 91, pct_hbi: 92, hasil_2025: 0, hasil_2026: 16.30, beza_tan: 0, pct_beza: 0, pct_capai_thnn: 65 },
  { bil: 36, tahunTuai: 16, projek: 'BUKIT BESAR', estateId: 'FPM_BUKIT_BESAR', zoneId: 'ZON_TAIB_ANDAK', zoneName: 'Zon Taib Andak', pkt: 1, luas: 900.00, ang2026: 25.0, ang_bi: 2.58, ang_hbi: 17.79, capai_bi: 2.42, capai_hbi: 16.70, pct_bi: 94, pct_hbi: 94, hasil_2025: 0, hasil_2026: 16.70, beza_tan: 0, pct_beza: 0, pct_capai_thnn: 67 },
  { bil: 37, tahunTuai: 15, projek: 'SG. SAYONG', estateId: 'FPM_SG_SAYONG', zoneId: 'ZON_TAIB_ANDAK', zoneName: 'Zon Taib Andak', pkt: 1, luas: 880.00, ang2026: 25.0, ang_bi: 2.58, ang_hbi: 17.79, capai_bi: 2.30, capai_hbi: 16.05, pct_bi: 89, pct_hbi: 90, hasil_2025: 0, hasil_2026: 16.05, beza_tan: 0, pct_beza: 0, pct_capai_thnn: 64 },
  { bil: 38, tahunTuai: 17, projek: 'PENGGELI TMR', estateId: 'FPM_PENGGELI_TIMUR', zoneId: 'ZON_TAIB_ANDAK', zoneName: 'Zon Taib Andak', pkt: 1, luas: 860.00, ang2026: 25.0, ang_bi: 2.58, ang_hbi: 17.79, capai_bi: 2.25, capai_hbi: 15.80, pct_bi: 87, pct_hbi: 89, hasil_2025: 0, hasil_2026: 15.80, beza_tan: 0, pct_beza: 0, pct_capai_thnn: 63 },
  { bil: 39, tahunTuai: 15, projek: 'SG. SIBOL', estateId: 'FPM_SG_SIBOL', zoneId: 'ZON_TAIB_ANDAK', zoneName: 'Zon Taib Andak', pkt: 1, luas: 840.00, ang2026: 25.0, ang_bi: 2.58, ang_hbi: 17.79, capai_bi: 2.34, capai_hbi: 16.25, pct_bi: 91, pct_hbi: 91, hasil_2025: 0, hasil_2026: 16.25, beza_tan: 0, pct_beza: 0, pct_capai_thnn: 65 },
  { bil: 40, tahunTuai: 18, projek: 'INAS UTARA', estateId: 'FPM_INAS_UTARA', zoneId: 'ZON_TAIB_ANDAK', zoneName: 'Zon Taib Andak', pkt: 1, luas: 830.00, ang2026: 25.0, ang_bi: 2.58, ang_hbi: 17.79, capai_bi: 2.20, capai_hbi: 15.50, pct_bi: 85, pct_hbi: 87, hasil_2025: 0, hasil_2026: 15.50, beza_tan: 0, pct_beza: 0, pct_capai_thnn: 62 },
  { bil: 41, tahunTuai: 15, projek: 'LINGGIU', estateId: 'FPM_LINGGIU', zoneId: 'ZON_TAIB_ANDAK', zoneName: 'Zon Taib Andak', pkt: 1, luas: 850.00, ang2026: 25.0, ang_bi: 2.58, ang_hbi: 17.79, capai_bi: 2.28, capai_hbi: 15.90, pct_bi: 88, pct_hbi: 89, hasil_2025: 0, hasil_2026: 15.90, beza_tan: 0, pct_beza: 0, pct_capai_thnn: 64 },
  { bil: 42, tahunTuai: 16, projek: 'PASIR RAJA', estateId: 'FPM_PASIR_RAJA', zoneId: 'ZON_TAIB_ANDAK', zoneName: 'Zon Taib Andak', pkt: 1, luas: 870.00, ang2026: 25.0, ang_bi: 2.58, ang_hbi: 17.79, capai_bi: 2.35, capai_hbi: 16.35, pct_bi: 91, pct_hbi: 92, hasil_2025: 0, hasil_2026: 16.35, beza_tan: 0, pct_beza: 0, pct_capai_thnn: 65 },
  { bil: 43, tahunTuai: 14, projek: 'ULU TEBRAU', estateId: 'FPM_ULU_TEBRAU', zoneId: 'ZON_TAIB_ANDAK', zoneName: 'Zon Taib Andak', pkt: 1, luas: 950.00, ang2026: 26.0, ang_bi: 2.68, ang_hbi: 18.51, capai_bi: 2.46, capai_hbi: 17.35, pct_bi: 92, pct_hbi: 94, hasil_2025: 0, hasil_2026: 17.35, beza_tan: 0, pct_beza: 0, pct_capai_thnn: 67 },
  { bil: 44, tahunTuai: 15, projek: 'TAIB ANDAK', estateId: 'FPM_TAIB_ANDAK', zoneId: 'ZON_TAIB_ANDAK', zoneName: 'Zon Taib Andak', pkt: 1, luas: 910.00, ang2026: 25.0, ang_bi: 2.58, ang_hbi: 17.79, capai_bi: 2.32, capai_hbi: 16.10, pct_bi: 90, pct_hbi: 90, hasil_2025: 0, hasil_2026: 16.10, beza_tan: 0, pct_beza: 0, pct_capai_thnn: 64 },
  { bil: 45, tahunTuai: 17, projek: 'ENDAU', estateId: 'FPM_ENDAU', zoneId: 'ZON_TAIB_ANDAK', zoneName: 'Zon Taib Andak', pkt: 1, luas: 800.00, ang2026: 25.0, ang_bi: 2.58, ang_hbi: 17.79, capai_bi: 2.22, capai_hbi: 15.60, pct_bi: 86, pct_hbi: 88, hasil_2025: 0, hasil_2026: 15.60, beza_tan: 0, pct_beza: 0, pct_capai_thnn: 62 },
];

// Backwards compatibility re-export
export const OFFICIAL_ZON_ADELA_ROWS = OFFICIAL_ALL_ESTATES_ROWS.filter(r => r.zoneId === 'ZON_ADELA');

export const WilayahExperimentTableSection: React.FC<WilayahExperimentTableSectionProps> = ({
  rawData,
  dashboardDate,
  isDarkMode,
  blockAnnualData,
  onSelectEstate,
}) => {
  // Pilihan sumber data: Lalai 'live' (Data masa nyata / real-time daripada transaksi semasa) dengan opsyen melihat 'rasmi' (Gambar arkib Ogos 2026)
  const [dataSource, setDataSource] = useState<'rasmi' | 'live'>('live');
  // Pilihan Zon: 'ZON_ADELA' secara lalai (atau 'ALL' / 'ZON_SEPAKAT' / 'ZON_LAW' / 'ZON_TENGGAROH' / 'ZON_TAIB_ANDAK')
  const [selectedZone, setSelectedZone] = useState<string>('ZON_ADELA');
  const [selectedEstateFilter, setSelectedEstateFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'bil' | 'pct_hbi' | 'capai_hbi' | 'luas'>('bil');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [supabaseYields2025, setSupabaseYields2025] = useState<Record<string, number>>({});
  const [supabaseTargets2026, setSupabaseTargets2026] = useState<Record<string, { ang_bi?: number; ang_hbi: number }>>({});

  // Senarai ladang yang sah bagi zon yang sedang dipilih
  const availableEstatesInZone = useMemo(() => {
    let rows = OFFICIAL_ALL_ESTATES_ROWS;
    if (selectedZone !== 'ALL') {
      rows = rows.filter((r) => r.zoneId === selectedZone);
    }
    const uniqueEstates = Array.from(new Set(rows.map((r) => r.projek)));
    return uniqueEstates;
  }, [selectedZone]);

  // Tajuk dinamik berdasarkan zon yang dipilih
  const zoneHeaderTitle = useMemo(() => {
    if (selectedZone === 'ALL') return 'WILAYAH JOHOR BAHRU';
    const cfg = ZONES[selectedZone];
    return cfg ? cfg.name.toUpperCase() : selectedZone;
  }, [selectedZone]);

  const activeDateInfo = useMemo(() => {
    const todayStr = dashboardDate || new Date().toISOString().split('T')[0];
    const [dbYear, dbMonth, dbDay] = todayStr.split('-');
    const currentMonthIdx = Math.max(0, Math.min(11, parseInt(dbMonth || '10', 10) - 1));
    const currentDayNum = Math.max(1, parseInt(dbDay || '1', 10));
    const MONTH_NAMES = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
    const monthName = MONTH_NAMES[currentMonthIdx] || 'Bulan';
    return {
      dateStr: todayStr,
      day: currentDayNum,
      month: monthName,
      label: `${currentDayNum} ${monthName}`,
    };
  }, [dashboardDate]);

  // Ambil data hasil 2025 sebenar & sasaran anggaran 2026 terus daripada Supabase / API backend
  useEffect(() => {
    let isSubscribed = true;
    async function fetchSupabaseData() {
      const yieldMap: Record<string, number> = {};
      const targetMap: Record<string, { ang_bi?: number; ang_hbi: number }> = {};

      const parseRow = (row: any) => {
        const yr = Number(row.year || row.tahun);
        const rawYield = row.yield ?? row.y2025 ?? row.yield_val ?? row.actual_yield ?? row.tonnage_ha;
        if (rawYield !== null && rawYield !== undefined && !isNaN(Number(rawYield))) {
          const yNum = Number(rawYield);
          let est = String(row.estate_id || '').toUpperCase();
          const blk = String(row.block || row.pkt || row.peringkat || '').toUpperCase();

          if (blk.includes('TUNGGAL')) est = 'FPM_TUNGGAL';
          else if (blk.includes('KLEDANG')) est = 'FPM_KLEDANG';
          else if (blk.includes('SENING')) est = 'FPM_SENING';
          else if (blk.includes('ADELA')) est = 'FPM_ADELA';

          const pktNum = cleanPktNum(blk);
          if (yr === 2025) {
            if (est && !isNaN(pktNum) && pktNum > 0) {
              yieldMap[`${est}_P${pktNum}`] = yNum;
            } else if (est) {
              yieldMap[est] = yNum;
            }
          } else if (yr === 2026) {
            if (est && !isNaN(pktNum) && pktNum > 0) {
              targetMap[`${est}_P${pktNum}`] = { ang_hbi: yNum };
            } else if (est) {
              targetMap[est] = { ang_hbi: yNum };
            }
          }
        }
      };

      try {
        // 1. Backend API /api/block-annual-yields?estate_id=ALL (membaca Supabase table block_annual_yields dengan server auth)
        try {
          const res = await safeFetch('/api/block-annual-yields?estate_id=ALL');
          if (res && res.ok) {
            const list = await res.json();
            if (Array.isArray(list)) {
              list.forEach(parseRow);
            }
          }
        } catch (apiErr) {
          console.warn('API /api/block-annual-yields error:', apiErr);
        }

        // 2. Direct Supabase query as resilient fallback for yields & targets
        try {
          const { data: bData, error: bErr } = await supabase
            .from('block_annual_yields')
            .select('*')
            .in('year', [2025, 2026]);
          if (!bErr && Array.isArray(bData)) {
            bData.forEach(parseRow);
          }
        } catch (sErr) {
          console.warn('Supabase block_annual_yields fallback query error:', sErr);
        }

        // 3. Muat turun dari Supabase app_settings jika ada targets_2026 khusus
        try {
          const { data: sData } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'estate_targets_2026')
            .maybeSingle();
          if (sData && sData.value && typeof sData.value === 'object') {
            Object.entries(sData.value).forEach(([k, v]: [string, any]) => {
              if (v && typeof v === 'object' && v.ang_hbi) {
                targetMap[k] = { ang_bi: v.ang_bi, ang_hbi: v.ang_hbi };
              }
            });
          }
        } catch (appErr) {
          console.warn('Supabase app_settings targets query error:', appErr);
        }

        // 4. Fallback baseline nilai rasmi 2025
        const BASELINE_2025: Record<string, number> = {
          'FPM_TUNGGAL_P1': 22.66,
          'FPM_TUNGGAL_P2': 20.66,
          'FPM_ADELA_P1': 16.79,
          'FPM_ADELA_P2': 16.47,
        };
        Object.keys(BASELINE_2025).forEach((key) => {
          if (yieldMap[key] === undefined || yieldMap[key] === 0) {
            yieldMap[key] = BASELINE_2025[key];
          }
        });

        if (isSubscribed) {
          setSupabaseYields2025(yieldMap);
          setSupabaseTargets2026(targetMap);
        }
      } catch (err) {
        console.warn('Gagal memuatkan data dari Supabase:', err);
      }
    }

    fetchSupabaseData();
    return () => {
      isSubscribed = false;
    };
  }, []);

  // Hitung data mengikut mod 'live' (real-time) atau 'rasmi'
  const computedRows = useMemo(() => {
    let rows: ZonPktRow[] = [];

    const todayStr = dashboardDate || new Date().toISOString().split('T')[0];
    const [dbYear, dbMonth, dbDay] = todayStr.split('-');
    const currentMonthIdx = Math.max(0, Math.min(11, parseInt(dbMonth || '10', 10) - 1));
    const currentDayNum = Math.max(1, parseInt(dbDay || '1', 10));
    const daysInCurrentMonth = new Date(parseInt(dbYear || '2026', 10), currentMonthIdx + 1, 0).getDate() || 31;
    const currentDayRatio = Math.min(1, Math.max(0, currentDayNum / daysInCurrentMonth));

    // Helper mengira sasaran Anggaran Bulan Ini (BI) dan Hingga Bulan Ini (HBI) dari DB/Registry
    const getDynamicTarget = (baseRow: ZonPktRow) => {
      const rowKey1 = `${baseRow.estateId}_P${baseRow.pkt}`;
      const rowKey2 = `${baseRow.projek}_P${baseRow.pkt}`;
      const dbTarget = supabaseTargets2026[rowKey1] ?? supabaseTargets2026[rowKey2] ?? supabaseTargets2026[baseRow.estateId];

      const estCfg = ESTATES_REGISTRY[baseRow.estateId];
      const monthlyTargets = estCfg?.monthlyTargets2026 || DEFAULT_MONTHLY_TARGETS_2026;
      const pktKey = baseRow.pkt === 2 ? '002' : (baseRow.pkt === 3 ? '003' : '001');
      const targetArr = (monthlyTargets && monthlyTargets[pktKey])
        ? monthlyTargets[pktKey]
        : (DEFAULT_MONTHLY_TARGETS_2026[pktKey] || DEFAULT_MONTHLY_TARGETS_2026['001']);

      const annualSum = targetArr.reduce((a, b) => a + b, 0);
      const scale = annualSum > 0 ? baseRow.ang2026 / annualSum : 1;

      const dynamicAngBi = dbTarget?.ang_bi ?? Number((targetArr[currentMonthIdx] * scale).toFixed(2));
      const dynamicAngHbi = dbTarget?.ang_hbi ?? Number((targetArr.slice(0, currentMonthIdx + 1).reduce((a, b) => a + b, 0) * scale).toFixed(2));

      return {
        angBi: dynamicAngBi > 0 ? dynamicAngBi : baseRow.ang_bi,
        angHbi: dynamicAngHbi > 0 ? dynamicAngHbi : baseRow.ang_hbi,
      };
    };

    // Helper mengira hasil sebenar 2025 To-Date (sehingga tarikh pemantauan yang sepadan dalam 2025, cth 1 Jan - 7 Okt 2025)
    const getHistorical2025ToDate = (baseRow: ZonPktRow): number => {
      // 1. Semak jika ada rekod transaksi 2025 dalam rawData
      const targetDate2025 = `2025-${dbMonth || '10'}-${dbDay || '07'}`;
      const tx2025 = (rawData || []).filter((t: any) => {
        if (!t) return false;
        const isEFB = String(t.no_resit || '').startsWith('EFB-HIST-') || 
                      String(t.no_tiket || '').startsWith('EFB-') || 
                      String(t.kod_item || '').startsWith('EFB-');
        if (isEFB) return false;

        const estId = t.estate_id || inferEstateFromReceipt(t);
        if (estId !== baseRow.estateId) return false;

        const pktNum = resolveTransactionPkt(t, baseRow.estateId);
        if (pktNum !== baseRow.pkt) return false;

        const tDate = String(t.tarikh || '');
        return tDate.startsWith('2025') && tDate <= targetDate2025;
      });

      if (tx2025.length > 0 && baseRow.luas > 0) {
        const totalTan2025 = tx2025.reduce((sum: number, t: any) => sum + (Number(t.tan) || 0), 0);
        return Number((totalTan2025 / baseRow.luas).toFixed(2));
      }

      // 2. Semak data bulanan sejarah 2025 dari dataset rasmi (Tunggal YIELD_DATA_2025 & Adela ADELA_YIELD_DATA_2025)
      const histRecords = getHistoricalYieldData2025(baseRow.estateId);
      if (Array.isArray(histRecords) && histRecords.length > 0) {
        let cumulativeTan = 0;
        // Bulan-bulan lengkap terdahulu (Januari hingga September bagi bulan Oktober)
        for (let m = 0; m < currentMonthIdx && m < histRecords.length; m++) {
          const rec = histRecords[m];
          if (rec) {
            if (baseRow.pkt === 1 && typeof rec.pkt1_tan === 'number') {
              cumulativeTan += rec.pkt1_tan;
            } else if (baseRow.pkt === 2 && typeof rec.pkt2_tan === 'number') {
              cumulativeTan += rec.pkt2_tan;
            } else if (baseRow.pkt === 3 && typeof rec.felda_tan === 'number') {
              cumulativeTan += rec.felda_tan;
            } else if (typeof rec.yield === 'number' && baseRow.luas > 0) {
              cumulativeTan += (rec.t_h ? rec.t_h * baseRow.luas : rec.yield);
            }
          }
        }
        // Bulan semasa (dikira to-date pro-rata mengikut bilangan hari dipantau cth 7hb / 31 hari)
        const currentMonthRec = histRecords[currentMonthIdx];
        if (currentMonthRec) {
          if (baseRow.pkt === 1 && typeof currentMonthRec.pkt1_tan === 'number') {
            cumulativeTan += currentMonthRec.pkt1_tan * currentDayRatio;
          } else if (baseRow.pkt === 2 && typeof currentMonthRec.pkt2_tan === 'number') {
            cumulativeTan += currentMonthRec.pkt2_tan * currentDayRatio;
          } else if (baseRow.pkt === 3 && typeof currentMonthRec.felda_tan === 'number') {
            cumulativeTan += currentMonthRec.felda_tan * currentDayRatio;
          } else if (typeof currentMonthRec.yield === 'number' && baseRow.luas > 0) {
            cumulativeTan += (currentMonthRec.t_h ? currentMonthRec.t_h * baseRow.luas : currentMonthRec.yield) * currentDayRatio;
          }
        }

        if (cumulativeTan > 0 && baseRow.luas > 0) {
          return Number((cumulativeTan / baseRow.luas).toFixed(2));
        }
      }

      // 3. Fallback: Gunakan nilai tahunan 2025 dari Supabase / baseline yang diskalakan to-date mengikut lengkung pengeluaran
      const rowKey = `${baseRow.estateId}_P${baseRow.pkt}`;
      const annual2025 = supabaseYields2025[rowKey] ?? supabaseYields2025[baseRow.estateId] ?? 0;
      if (annual2025 > 0) {
        const estCfg = ESTATES_REGISTRY[baseRow.estateId];
        const monthlyTargets = estCfg?.monthlyTargets2026 || DEFAULT_MONTHLY_TARGETS_2026;
        const pktKey = baseRow.pkt === 2 ? '002' : (baseRow.pkt === 3 ? '003' : '001');
        const targetArr = (monthlyTargets && monthlyTargets[pktKey])
          ? monthlyTargets[pktKey]
          : (DEFAULT_MONTHLY_TARGETS_2026[pktKey] || DEFAULT_MONTHLY_TARGETS_2026['001']);

        const annualTargetSum = targetArr.reduce((a: number, b: number) => a + b, 0);
        const prevTargetSum = targetArr.slice(0, currentMonthIdx).reduce((a: number, b: number) => a + b, 0);
        const toDateTarget = prevTargetSum + (targetArr[currentMonthIdx] || 0) * currentDayRatio;

        const toDateRatio = annualTargetSum > 0 ? (toDateTarget / annualTargetSum) : ((currentMonthIdx + currentDayRatio) / 12);
        return Number((annual2025 * toDateRatio).toFixed(2));
      }

      return 0;
    };

    if (dataSource === 'rasmi') {
      rows = OFFICIAL_ALL_ESTATES_ROWS.map((r) => {
        const y2025ToDate = getHistorical2025ToDate(r);
        const has2025 = y2025ToDate > 0;
        const beza_tan = has2025 ? r.hasil_2026 - y2025ToDate : 0;
        const pct_beza = has2025 ? Math.round((beza_tan / y2025ToDate) * 100) : 0;

        const { angBi, angHbi } = getDynamicTarget(r);
        const pct_bi = angBi > 0 ? Math.round((r.capai_bi / angBi) * 100) : r.pct_bi;
        const pct_hbi = angHbi > 0 ? Math.round((r.capai_hbi / angHbi) * 100) : r.pct_hbi;
        const pct_capai_thnn = r.ang2026 > 0 ? Math.round((r.capai_hbi / r.ang2026) * 100) : r.pct_capai_thnn;

        return {
          ...r,
          ang_bi: angBi,
          ang_hbi: angHbi,
          pct_bi,
          pct_hbi,
          pct_capai_thnn,
          hasil_2025: y2025ToDate,
          beza_tan: Number(beza_tan.toFixed(2)),
          pct_beza,
          hasData: true,
          liveSource: 'rasmi',
        };
      });
    } else {
      // Mod Live Real-Time: Kira menggunakan data transaksi sebenar dari pangkalan data Supabase
      const currentMonth = todayStr.slice(0, 7);
      const currentYear = todayStr.slice(0, 4);

      rows = OFFICIAL_ALL_ESTATES_ROWS.map((baseRow) => {
        const actual2025ToDate = getHistorical2025ToDate(baseRow);
        const { angBi, angHbi } = getDynamicTarget(baseRow);

        const estateTx = (rawData || []).filter((t: any) => {
          if (!t) return false;
          const isEFB = String(t.no_resit || '').startsWith('EFB-HIST-') || 
                        String(t.no_tiket || '').startsWith('EFB-') || 
                        String(t.kod_item || '').startsWith('EFB-');
          if (isEFB) return false;

          const estId = t.estate_id || inferEstateFromReceipt(t);
          if (estId !== baseRow.estateId) return false;

          const pktNum = resolveTransactionPkt(t, baseRow.estateId);
          return pktNum === baseRow.pkt;
        });

        // Jika TIADA transaksi langsung dalam pangkalan data untuk peringkat ladang ini,
        // biarkan KOSONG/0 mengikut arahan pengguna, jangan fallback ke data arkib rasmi.
        if (estateTx.length === 0) {
          return {
            ...baseRow,
            ang_bi: angBi,
            ang_hbi: angHbi,
            hasil_2025: actual2025ToDate,
            capai_bi: 0,
            capai_hbi: 0,
            pct_bi: 0,
            pct_hbi: 0,
            hasil_2026: 0,
            beza_tan: 0,
            pct_beza: 0,
            pct_capai_thnn: 0,
            hasData: false,
            txCount: 0,
            liveSource: 'tiada_rekod',
          };
        }

        const monthTx = estateTx.filter((t: any) => String(t.tarikh || '').startsWith(currentMonth));
        const yearTx = estateTx.filter((t: any) => String(t.tarikh || '').startsWith(currentYear) && String(t.tarikh || '') <= todayStr);

        const tanMonth = monthTx.reduce((sum, t) => sum + (Number(t.tan) || 0), 0);
        const tanYear = yearTx.reduce((sum, t) => sum + (Number(t.tan) || 0), 0);

        // Kiraan sebenar berdasarkan tan transaksi dibahagikan dengan luas hektar
        const liveCapaiBi = baseRow.luas > 0 ? tanMonth / baseRow.luas : 0;
        const liveCapaiHbi = baseRow.luas > 0 ? tanYear / baseRow.luas : 0;
        const livePctBi = angBi > 0 ? Math.round((liveCapaiBi / angBi) * 100) : 0;
        const livePctHbi = angHbi > 0 ? Math.round((liveCapaiHbi / angHbi) * 100) : 0;
        const liveBezaTan = actual2025ToDate > 0 ? liveCapaiHbi - actual2025ToDate : 0;
        const livePctBeza = actual2025ToDate > 0 ? Math.round((liveBezaTan / actual2025ToDate) * 100) : 0;
        const livePctCapaiThnn = baseRow.ang2026 > 0 ? Math.round((liveCapaiHbi / baseRow.ang2026) * 100) : 0;

        return {
          ...baseRow,
          ang_bi: angBi,
          ang_hbi: angHbi,
          hasil_2025: actual2025ToDate,
          capai_bi: Number(liveCapaiBi.toFixed(2)),
          capai_hbi: Number(liveCapaiHbi.toFixed(2)),
          pct_bi: livePctBi,
          pct_hbi: livePctHbi,
          hasil_2026: Number(liveCapaiHbi.toFixed(2)),
          beza_tan: Number(liveBezaTan.toFixed(2)),
          pct_beza: livePctBeza,
          pct_capai_thnn: livePctCapaiThnn,
          hasData: true,
          txCount: estateTx.length,
          liveSource: 'supabase',
        };
      });
    }

    // 1. Tapis mengikut Zon
    if (selectedZone !== 'ALL') {
      rows = rows.filter((r) => r.zoneId === selectedZone);
    }

    // 2. Tapis mengikut Ladang
    if (selectedEstateFilter !== 'ALL') {
      rows = rows.filter((r) => r.projek === selectedEstateFilter || r.estateId === selectedEstateFilter);
    }

    // 3. Tapis Carian Pantas (jika ada input teks carian)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      rows = rows.filter((r) => 
        r.projek.toLowerCase().includes(q) || 
        r.zoneName.toLowerCase().includes(q) ||
        String(r.bil).includes(q)
      );
    }

    // 4. Susunan (Sorting)
    if (sortBy === 'pct_hbi') {
      rows.sort((a, b) => b.pct_hbi - a.pct_hbi);
    } else if (sortBy === 'capai_hbi') {
      rows.sort((a, b) => b.capai_hbi - a.capai_hbi);
    } else if (sortBy === 'luas') {
      rows.sort((a, b) => b.luas - a.luas);
    } else {
      rows.sort((a, b) => a.bil - b.bil);
    }

    return rows;
  }, [dataSource, selectedZone, selectedEstateFilter, searchQuery, sortBy, rawData, dashboardDate, supabaseYields2025, supabaseTargets2026]);

  // Ringkasan Jumlah / Total (dinamik mengikut baris yang dipaparkan)
  const tableSummaryTotal = useMemo(() => {
    const allLiveRows = computedRows;
    const totalLuas = allLiveRows.reduce((acc, r) => acc + r.luas, 0);

    if (totalLuas === 0) {
      return {
        totalLuas: 0,
        ang2026Weighted: 0,
        angBiWeighted: 0,
        angHbiWeighted: 0,
        capaiBiWeighted: 0,
        capaiHbiWeighted: 0,
        pctBi: 0,
        pctHbi: 0,
        hasil2025: 0,
        hasil2026: 0,
        bezaTan: 0,
        pctBeza: 0,
        pctCapaiThnn: 0,
      };
    }

    const ang2026Weighted = allLiveRows.reduce((acc, r) => acc + (r.ang2026 * r.luas), 0) / totalLuas;
    const angBiWeighted = allLiveRows.reduce((acc, r) => acc + (r.ang_bi * r.luas), 0) / totalLuas;
    const angHbiWeighted = allLiveRows.reduce((acc, r) => acc + (r.ang_hbi * r.luas), 0) / totalLuas;
    const capaiBiWeighted = allLiveRows.reduce((acc, r) => acc + (r.capai_bi * r.luas), 0) / totalLuas;
    const capaiHbiWeighted = allLiveRows.reduce((acc, r) => acc + (r.capai_hbi * r.luas), 0) / totalLuas;
    const rowsWith2025 = allLiveRows.filter((r) => r.hasil_2025 > 0);
    const luasWith2025 = rowsWith2025.reduce((acc, r) => acc + r.luas, 0);
    const hasil2025 = luasWith2025 > 0
      ? rowsWith2025.reduce((acc, r) => acc + (r.hasil_2025 * r.luas), 0) / luasWith2025
      : 0;
    const hasil2026Comparable = luasWith2025 > 0
      ? rowsWith2025.reduce((acc, r) => acc + (r.hasil_2026 * r.luas), 0) / luasWith2025
      : capaiHbiWeighted;
    const hasil2026 = capaiHbiWeighted;
    const bezaTan = hasil2025 > 0 ? Number((hasil2026Comparable - hasil2025).toFixed(2)) : 0;
    const pctBi = angBiWeighted > 0 ? Math.round((capaiBiWeighted / angBiWeighted) * 100) : 0;
    const pctHbi = angHbiWeighted > 0 ? Math.round((capaiHbiWeighted / angHbiWeighted) * 100) : 0;
    const pctBeza = hasil2025 > 0 ? Math.round((bezaTan / hasil2025) * 100) : 0;
    const pctCapaiThnn = ang2026Weighted > 0 ? Math.round((capaiHbiWeighted / ang2026Weighted) * 100) : 0;

    return {
      totalLuas,
      ang2026Weighted,
      angBiWeighted,
      angHbiWeighted,
      capaiBiWeighted,
      capaiHbiWeighted,
      pctBi,
      pctHbi,
      hasil2025,
      hasil2026,
      bezaTan,
      pctBeza,
      pctCapaiThnn,
    };
  }, [computedRows]);

  // Label tajuk baris jumlah
  const summaryBottomLabel = useMemo(() => {
    if (selectedEstateFilter !== 'ALL') return selectedEstateFilter;
    if (selectedZone === 'ALL') return 'WILAYAH JOHOR BAHRU';
    const cfg = ZONES[selectedZone];
    return cfg ? cfg.name.toUpperCase() : selectedZone;
  }, [selectedEstateFilter, selectedZone]);

  // Pewarnaan baris: jika tiada data dalam Supabase, gunakan gaya kelabu/lembut; jika ada data, gunakan Hijau Zamrud atau Kuning Terang persis gambar
  const getRowHighlightColor = (row: ZonPktRow) => {
    if (dataSource === 'live' && row.hasData === false) {
      return {
        bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium',
        stickyBg: 'bg-slate-100 dark:bg-slate-800',
        pctBiBadge: 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
        pctHbiBadge: 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
        border: 'border-slate-300/60 dark:border-slate-700/60',
        isPending: true,
      };
    }

    // Berdasarkan gambar:
    // Bil 25 (Adela Pkt 2) atau prestasi sederhana (< 90%) berwarna Kuning Terang
    if (row.bil === 25 || row.pct_hbi < 90) {
      return {
        bg: 'bg-yellow-300 dark:bg-amber-400 text-slate-950 font-bold',
        stickyBg: 'bg-yellow-300 dark:bg-amber-400',
        pctBiBadge: 'bg-yellow-400 text-slate-950',
        pctHbiBadge: 'bg-sky-400 text-slate-950',
        border: 'border-yellow-400/80 dark:border-amber-400/80',
        isPending: false,
      };
    }

    // Baris berprestasi tinggi berwarna Hijau Zamrud (#10b981 / emerald-400)
    return {
      bg: 'bg-emerald-400 dark:bg-emerald-500 text-slate-950 font-semibold',
      stickyBg: 'bg-emerald-400 dark:bg-emerald-500',
      pctBiBadge: 'bg-emerald-300 text-slate-950',
      pctHbiBadge: 'bg-sky-400 text-slate-950',
      border: 'border-emerald-500/40 dark:border-emerald-600/40',
      isPending: false,
    };
  };

  return (
    <div
      id="wilayah-experiment-section"
      className="bg-white dark:bg-slate-900 rounded-[24px] p-3 sm:p-4 border border-slate-200 dark:border-slate-800 mb-6 shadow-xl relative overflow-hidden mt-6"
    >
      {/* HEADER SECTION: EXPERIMENT BADGE + TITLE */}
      <div className="flex flex-col gap-3 pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[7.5px] font-black uppercase tracking-wider flex items-center gap-1">
                <Sparkles size={10} className="text-amber-500" />
                EKSPERIMEN PAPARAN BARU
              </span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[7.5px] font-black uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                LIVE REAL-TIME DATA
              </span>
              <span className="px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 text-[7.5px] font-black uppercase tracking-wider flex items-center gap-1">
                <Database size={10} className="text-sky-500" />
                ANGGARAN HBI SEBENAR (DB)
              </span>
            </div>

            <h2 className="text-[13px] sm:text-[15px] font-black tracking-tight text-slate-900 dark:text-white uppercase mt-1 flex items-center gap-1.5">
              <Table size={16} className="text-emerald-500 shrink-0" />
              RANKING HASIL MENGIKUT PKT & ZON (MATANG UTAMA) {zoneHeaderTitle}
            </h2>
            <p className="text-[8px] sm:text-[9px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
              <span>
                {dataSource === 'live'
                  ? `Data Masa Nyata (Live) • Tarikh: ${activeDateInfo.label} (${activeDateInfo.dateStr}) • Anggaran HBI dikira secara dinamik dari DB • Perbandingan Hasil Sebenar 2025 To-Date vs 2026 To-Date (sehingga ${activeDateInfo.label})`
                  : `Data Laporan Matang Utama • Anggaran HBI diselaraskan dengan pangkalan data Supabase • Tarikh: ${activeDateInfo.label} (${activeDateInfo.dateStr})`}
              </span>
            </p>
          </div>

          {/* TOGGLE MOD DATA & SUSUNAN */}
          <div className="flex items-center gap-1.5 self-start md:self-auto flex-wrap">
            {/* Togol Sumber Data: Live (Lalai) vs Rasmi */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setDataSource('live')}
                className={`px-2.5 py-1 rounded-md text-[7px] sm:text-[7.5px] font-black uppercase tracking-wider transition-all flex items-center gap-1 ${
                  dataSource === 'live'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                }`}
                title="Kira secara dinamik daripada pangkalan data transaksi BTS semasa (Live)"
              >
                <TrendingUp size={9} />
                LIVE REAL-TIME
              </button>
              <button
                type="button"
                onClick={() => setDataSource('rasmi')}
                className={`px-2.5 py-1 rounded-md text-[7px] sm:text-[7.5px] font-black uppercase tracking-wider transition-all flex items-center gap-1 ${
                  dataSource === 'rasmi'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                }`}
                title="Guna data rasmi matriks matang utama sepadan laporan arkib"
              >
                <CheckCircle2 size={9} />
                DATA RASMI
              </button>
            </div>

            {/* Susun Mengikut */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[7px] sm:text-[7.5px]">
              <span className="text-slate-400 font-bold mr-1 flex items-center gap-0.5">
                <ArrowUpDown size={8} /> SUSUN:
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent font-black text-slate-800 dark:text-slate-200 uppercase outline-hidden cursor-pointer text-[7px] sm:text-[7.5px]"
              >
                <option value="bil">BIL</option>
                <option value="pct_hbi">% HBI (TERTINGGI)</option>
                <option value="capai_hbi">CAPAI HBI</option>
                <option value="luas">KELUASAN</option>
              </select>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PILIHAN MENGIKUT ZON (ZONE SELECTOR TABS) */}
        {/* ========================================================================= */}
        <div className="flex flex-col gap-1.5 pt-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none w-full sm:w-auto">
              <span className="text-[7.5px] font-black uppercase text-slate-500 dark:text-slate-400 shrink-0 mr-1 flex items-center gap-1">
                <Layers size={11} className="text-emerald-500" /> PILIH ZON:
              </span>
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0 flex-nowrap">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedZone('ALL');
                    setSelectedEstateFilter('ALL');
                  }}
                  className={`px-2.5 py-1 rounded-md text-[7px] sm:text-[7.5px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                    selectedZone === 'ALL'
                      ? 'bg-emerald-600 text-white shadow-xs font-black'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  SEMUA ZON (40)
                </button>
                {Object.entries(ZONES).map(([zId, zConfig]) => {
                  const isSelected = selectedZone === zId;
                  return (
                    <button
                      key={zId}
                      type="button"
                      onClick={() => {
                        setSelectedZone(zId);
                        setSelectedEstateFilter('ALL');
                      }}
                      className={`px-2.5 py-1 rounded-md text-[7px] sm:text-[7.5px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-xs font-black'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                      }`}
                    >
                      {zConfig.name.toUpperCase()} ({zConfig.estates.length})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* KOTAK CARIAN PANTAS LADANG */}
            <div className="relative flex items-center shrink-0 w-full sm:w-44">
              <Search size={10} className="absolute left-2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari ladang / peringkat..."
                className="w-full pl-6 pr-2 py-0.5 text-[7.5px] rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-hidden focus:border-emerald-500 font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1.5 text-slate-400 hover:text-slate-600 text-[8px] font-bold px-1"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* PILIHAN MENGIKUT LADANG (ESTATE FILTER TABS BERDASARKAN ZON) */}
          {/* ========================================================================= */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none pt-0.5">
            <span className="text-[7.5px] font-black uppercase text-slate-500 dark:text-slate-400 shrink-0 mr-1 flex items-center gap-1">
              <Building2 size={11} className="text-emerald-500" /> LADANG:
            </span>
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0 flex-nowrap">
              <button
                type="button"
                onClick={() => setSelectedEstateFilter('ALL')}
                className={`px-2 py-0.5 rounded-md text-[7px] sm:text-[7.5px] font-black uppercase tracking-wider transition-all ${
                  selectedEstateFilter === 'ALL'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-black'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                SEMUA
              </button>
              {availableEstatesInZone.map((projekName) => (
                <button
                  key={projekName}
                  type="button"
                  onClick={() => setSelectedEstateFilter(projekName)}
                  className={`px-2 py-0.5 rounded-md text-[7px] sm:text-[7.5px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                    selectedEstateFilter === projekName
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-black'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  {projekName}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* PANDUAN PENGGUNA & STATISTIK PAPARAN */}
      <div className="flex items-center justify-between gap-2 mb-2 px-1 text-[7px] sm:text-[7.5px] text-slate-500 dark:text-slate-400 flex-wrap">
        <div className="flex items-center gap-1">
          <Info size={10} className="text-emerald-500 shrink-0" />
          <span>
            Nama ladang dipaparkan secara <strong>tag float kekal (sticky) di sebelah kiri</strong> dengan nombor peringkat (PKT) apabila skrin ditatal. Memaparkan <strong>{computedRows.length} rekod ladang/peringkat</strong>.
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-xs bg-emerald-400 inline-block" /> Prestasi Tinggi (Matang Utama)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-xs bg-yellow-300 inline-block" /> Perhatian Prestasi
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-xs bg-sky-400 inline-block" /> % HBI
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PAPARAN EXPERIMEN: KOMBINASI JADUAL MATRIX KORPORAT & FLOATING ESTATE TAG */}
      {/* ========================================================================= */}
      <div className="overflow-x-auto rounded-xl border border-slate-300 dark:border-slate-700/80 shadow-md">
        <table className="w-full text-center border-collapse min-w-[880px] text-[9.5px]">
          {/* HEADER 2 TIER SEPERTI GAMBAR LAMPIRAN */}
          <thead>
            {/* ROW 1: HEADER KATEGORI */}
            <tr className="bg-slate-500 text-white font-black text-[9px] uppercase tracking-wider border-b border-slate-400">
              <th rowSpan={2} className="px-1.5 py-1.5 border-r border-slate-400 w-7">BIL</th>
              <th rowSpan={2} className="px-1.5 py-1.5 border-r border-slate-400 w-11">TAHUN TUAI</th>
              <th rowSpan={2} className="sticky left-0 z-20 bg-slate-600 text-white px-2 py-1.5 border-r border-slate-400 text-left w-[110px] min-w-[105px] max-w-[115px] shadow-sm">
                LADANG {selectedZone === 'ALL' && <span className="block text-[6px] text-emerald-300 font-bold">& ZON</span>}
              </th>
              <th rowSpan={2} className="px-1.5 py-1.5 border-r border-slate-400 w-8">PKT</th>
              <th rowSpan={2} className="px-2 py-1.5 border-r border-slate-400">LUAS (HA)</th>
              <th rowSpan={2} className="px-2 py-1.5 border-r border-slate-400">ANG 2026</th>
              <th colSpan={2} className="px-1.5 py-1 border-r border-slate-400 bg-slate-600/90">ANGGARAN (T/HA)</th>
              <th colSpan={2} className="px-1.5 py-1 border-r border-slate-400 bg-slate-600/90">PENCAPAIAN (T/HA)</th>
              <th colSpan={2} className="px-1.5 py-1 border-r border-slate-400 bg-slate-600/90">PERATUS CAPAI</th>
              <th colSpan={4} className="px-1.5 py-1 border-r border-slate-400 bg-slate-600/90">PERBEZAAN HASIL 2025 & 2026</th>
              <th rowSpan={2} className="px-1.5 py-1.5 w-12 bg-slate-600">% CAPAI THNN</th>
            </tr>
            {/* ROW 2: SUB-HEADER */}
            <tr className="bg-slate-500 text-white font-black text-[8px] uppercase tracking-wider border-b border-slate-400">
              <th className="px-1.5 py-1 border-r border-slate-400">BI</th>
              <th className="px-1.5 py-1 border-r border-slate-400">HBI</th>
              <th className="px-1.5 py-1 border-r border-slate-400">BI</th>
              <th className="px-1.5 py-1 border-r border-slate-400">HBI</th>
              <th className="px-1.5 py-1 border-r border-slate-400">% BI</th>
              <th className="px-1.5 py-1 border-r border-slate-400">% HBI</th>
              <th className="px-1.5 py-1 border-r border-slate-400" title={`Pencapaian Hasil 2025 To-Date (Sehingga ${activeDateInfo.label} 2025)`}>2025</th>
              <th className="px-1.5 py-1 border-r border-slate-400" title={`Pencapaian Hasil 2026 To-Date (Sehingga ${activeDateInfo.label} 2026)`}>2026</th>
              <th className="px-1.5 py-1 border-r border-slate-400">BEZA</th>
              <th className="px-1.5 py-1 border-r border-slate-400">% BEZA</th>
            </tr>
          </thead>

          {/* BODY: SENARAI PROJEK DENGAN WARNA ASAL GAMBAR & FLOATING BADGE */}
          <tbody className="divide-y divide-slate-300 dark:divide-slate-700/60 font-semibold text-slate-900">
            {computedRows.length === 0 ? (
              <tr>
                <td colSpan={17} className="py-8 text-center text-slate-500 dark:text-slate-400 font-medium">
                  Tiada rekod ladang ditemui bagi pilihan zon atau carian ini.
                </td>
              </tr>
            ) : (
              computedRows.map((row) => {
                const theme = getRowHighlightColor(row);

                return (
                  <tr
                    key={`${row.zoneId}-${row.projek}-${row.pkt}-${row.bil}`}
                    onClick={() => onSelectEstate && onSelectEstate(row.estateId)}
                    className={`${theme.bg} hover:brightness-105 transition-all cursor-pointer relative group border-b ${theme.border}`}
                    title={`Klik untuk lihat rekod terperinci ${row.projek} Pkt ${row.pkt} (${row.zoneName})`}
                  >
                    {/* BIL */}
                    <td className="px-1.5 py-2.5 border-r border-slate-300/60 font-bold text-center">
                      {row.bil}
                    </td>

                    {/* TAHUN TUAI */}
                    <td className="px-1.5 py-2.5 border-r border-slate-300/60 font-bold text-center">
                      {row.tahunTuai}
                    </td>

                    {/* PROJEK DENGAN FLOATING STICKY TAG WARNA HITAM DI SEBELAH KIRI (COMPACT & SLIM) */}
                    <td className={`sticky left-0 z-10 ${theme.stickyBg} px-1.5 py-2 border-r border-slate-300/60 text-left w-[110px] min-w-[105px] max-w-[115px] shadow-sm`}>
                      <div className="flex flex-col justify-center">
                        {/* FLOATING BLACK TAG DI SEBELAH KIRI */}
                        <div className="inline-flex items-center gap-1 bg-slate-950 dark:bg-black text-white px-1.5 py-0.5 rounded-xs shadow-sm border border-slate-800 w-fit max-w-full">
                          <span className="text-[7.5px] font-black uppercase tracking-tight text-emerald-400 truncate max-w-[62px]">
                            {row.projek}
                          </span>
                          <span className="text-[6.5px] text-slate-300 font-bold uppercase bg-slate-800/80 px-1 py-0.2 rounded-2xs shrink-0">
                            P{row.pkt}
                          </span>
                        </div>
                        {selectedZone === 'ALL' && (
                          <div className="mt-0.5">
                            <span className="text-[6px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-tight truncate max-w-[85px] block">
                              {row.zoneName}
                            </span>
                          </div>
                        )}
                        {dataSource === 'live' && row.hasData === false && (
                          <div className="mt-0.5">
                            <span className="text-[5.5px] font-bold px-1 py-0.2 rounded-2xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 tracking-tight leading-none inline-block">
                              MENUNGGU
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* PKT */}
                    <td className="px-1.5 py-2.5 border-r border-slate-300/60 font-black text-center">
                      {row.pkt}
                    </td>

                    {/* LUAS (HA) */}
                    <td className="px-2 py-2.5 border-r border-slate-300/60 font-mono font-bold text-right">
                      {row.luas.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* ANGGARAN 2026 */}
                    <td className="px-1.5 py-2.5 border-r border-slate-300/60 font-mono font-bold text-center">
                      {row.ang2026.toFixed(0)}
                    </td>

                    {/* ANGGARAN BI */}
                    <td className="px-1.5 py-2.5 border-r border-slate-300/60 font-mono text-center">
                      {row.ang_bi.toFixed(2)}
                    </td>

                    {/* ANGGARAN HBI */}
                    <td className="px-1.5 py-2.5 border-r border-slate-300/60 font-mono text-center">
                      {row.ang_hbi.toFixed(2)}
                    </td>

                    {/* PENCAPAIAN BI */}
                    <td className="px-1.5 py-2.5 border-r border-slate-300/60 font-mono font-bold text-center">
                      {dataSource === 'live' && row.hasData === false ? (
                        <span className="text-slate-400 dark:text-slate-500 font-normal">-</span>
                      ) : (
                        row.capai_bi.toFixed(2)
                      )}
                    </td>

                    {/* PENCAPAIAN HBI */}
                    <td className="px-1.5 py-2.5 border-r border-slate-300/60 font-mono font-bold text-center">
                      {dataSource === 'live' && row.hasData === false ? (
                        <span className="text-slate-400 dark:text-slate-500 font-normal">-</span>
                      ) : (
                        row.capai_hbi.toFixed(2)
                      )}
                    </td>

                    {/* % BI */}
                    <td className="px-1.5 py-2.5 border-r border-slate-300/60 font-mono font-black text-center">
                      {dataSource === 'live' && row.hasData === false ? (
                        <span className="text-slate-400 dark:text-slate-500 font-normal text-[9px]">-</span>
                      ) : (
                        <span className={`px-1.5 py-0.5 rounded ${theme.pctBiBadge} text-[9px]`}>
                          {row.pct_bi}
                        </span>
                      )}
                    </td>

                    {/* % HBI (SKY BLUE BADGE PERSIS GAMBAR) */}
                    <td className={`px-1.5 py-2.5 border-r border-slate-300/60 font-mono font-black text-center ${dataSource === 'live' && row.hasData === false ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500' : 'bg-sky-400/90 text-slate-950'}`}>
                      {dataSource === 'live' && row.hasData === false ? (
                        <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500">-</span>
                      ) : (
                        <span className="text-[10px] font-black">
                          {row.pct_hbi}
                        </span>
                      )}
                    </td>

                    {/* HASIL 2025 */}
                    <td className="px-1.5 py-2.5 border-r border-slate-300/60 font-mono text-center">
                      {row.hasil_2025 > 0 ? (
                        row.hasil_2025.toFixed(2)
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 font-normal">-</span>
                      )}
                    </td>

                    {/* HASIL 2026 */}
                    <td className="px-1.5 py-2.5 border-r border-slate-300/60 font-mono font-bold text-center">
                      {dataSource === 'live' && row.hasData === false ? (
                        <span className="text-slate-400 dark:text-slate-500 font-normal">-</span>
                      ) : (
                        row.hasil_2026.toFixed(2)
                      )}
                    </td>

                    {/* BEZA (TAN) */}
                    <td className={`px-1.5 py-2.5 border-r border-slate-300/60 font-mono font-bold text-center ${row.beza_tan < 0 ? 'text-rose-900 dark:text-rose-950 font-black' : 'text-emerald-950'}`}>
                      {(dataSource === 'live' && row.hasData === false) || row.hasil_2025 <= 0 ? (
                        <span className="text-slate-400 dark:text-slate-500 font-normal">-</span>
                      ) : (
                        row.beza_tan > 0 ? `+${row.beza_tan.toFixed(2)}` : row.beza_tan.toFixed(2)
                      )}
                    </td>

                    {/* % BEZA */}
                    <td className={`px-1.5 py-2.5 border-r border-slate-300/60 font-mono font-bold text-center ${row.pct_beza < 0 ? 'text-rose-900 dark:text-rose-950 font-black' : 'text-emerald-950'}`}>
                      {(dataSource === 'live' && row.hasData === false) || row.hasil_2025 <= 0 ? (
                        <span className="text-slate-400 dark:text-slate-500 font-normal">-</span>
                      ) : (
                        `${row.pct_beza}%`
                      )}
                    </td>

                    {/* % CAPAI TAHUNAN */}
                    <td className="px-1.5 py-2.5 font-mono font-black text-center text-[10px]">
                      {dataSource === 'live' && row.hasData === false ? (
                        <span className="text-slate-400 dark:text-slate-500 font-normal">-</span>
                      ) : (
                        `${row.pct_capai_thnn}%`
                      )}
                    </td>
                  </tr>
                );
              })
            )}

            {/* ========================================================================= */}
            {/* TOTAL ROW: DINAMIK MENGIKUT ZON / WILAYAH (BIRU CYAN TERANG PERSIS GAMBAR) */}
            {/* ========================================================================= */}
            {computedRows.length > 0 && (
              <tr className="bg-sky-400 text-slate-950 font-black text-[10px] border-t-2 border-sky-600">
                <td colSpan={2} className="px-1.5 py-2.5 border-r border-sky-500 text-center uppercase tracking-wider font-bold">
                  JUMLAH
                </td>
                <td className="sticky left-0 z-10 bg-sky-400 text-slate-950 px-2 py-2.5 border-r border-sky-500 text-left uppercase tracking-tight font-black shadow-sm w-[110px] min-w-[105px] max-w-[115px] text-[8.5px] leading-tight">
                  {summaryBottomLabel}
                </td>
                <td className="px-1.5 py-2.5 border-r border-sky-500 font-bold text-center">
                  -
                </td>
                {/* LUAS */}
                <td className="px-2 py-2.5 border-r border-sky-500 font-mono font-black text-right">
                  {tableSummaryTotal.totalLuas.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                {/* ANG 2026 */}
                <td className="px-1.5 py-2.5 border-r border-sky-500 font-mono font-black text-center">
                  {tableSummaryTotal.ang2026Weighted.toFixed(2)}
                </td>
                {/* ANG BI */}
                <td className="px-1.5 py-2.5 border-r border-sky-500 font-mono font-black text-center">
                  {tableSummaryTotal.angBiWeighted.toFixed(2)}
                </td>
                {/* ANG HBI */}
                <td className="px-1.5 py-2.5 border-r border-sky-500 font-mono font-black text-center">
                  {tableSummaryTotal.angHbiWeighted.toFixed(2)}
                </td>
                {/* CAPAI BI */}
                <td className="px-1.5 py-2.5 border-r border-sky-500 font-mono font-black text-center">
                  {tableSummaryTotal.capaiBiWeighted.toFixed(2)}
                </td>
                {/* CAPAI HBI */}
                <td className="px-1.5 py-2.5 border-r border-sky-500 font-mono font-black text-center">
                  {tableSummaryTotal.capaiHbiWeighted.toFixed(2)}
                </td>
                {/* % BI */}
                <td className="px-1.5 py-2.5 border-r border-sky-500 font-mono font-black text-center">
                  {tableSummaryTotal.pctBi}
                </td>
                {/* % HBI */}
                <td className="px-1.5 py-2.5 border-r border-sky-500 font-mono font-black text-center bg-sky-300 text-slate-950">
                  {tableSummaryTotal.pctHbi}
                </td>
                {/* HASIL 2025 */}
                <td className="px-1.5 py-2.5 border-r border-sky-500 font-mono font-black text-center">
                  {tableSummaryTotal.hasil2025 > 0 ? (
                    tableSummaryTotal.hasil2025.toFixed(2)
                  ) : (
                    <span className="opacity-70 font-normal">-</span>
                  )}
                </td>
                {/* HASIL 2026 */}
                <td className="px-1.5 py-2.5 border-r border-sky-500 font-mono font-black text-center">
                  {tableSummaryTotal.hasil2026.toFixed(2)}
                </td>
                {/* BEZA */}
                <td className="px-1.5 py-2.5 border-r border-sky-500 font-mono font-black text-center">
                  {tableSummaryTotal.hasil2025 > 0 ? (
                    tableSummaryTotal.bezaTan > 0 ? `+${tableSummaryTotal.bezaTan.toFixed(2)}` : tableSummaryTotal.bezaTan.toFixed(2)
                  ) : (
                    <span className="opacity-70 font-normal">-</span>
                  )}
                </td>
                {/* % BEZA */}
                <td className="px-1.5 py-2.5 border-r border-sky-500 font-mono font-black text-center">
                  {tableSummaryTotal.hasil2025 > 0 ? (
                    `${tableSummaryTotal.pctBeza}%`
                  ) : (
                    <span className="opacity-70 font-normal">-</span>
                  )}
                </td>
                {/* % CAPAI THNN */}
                <td className="px-1.5 py-2.5 font-mono font-black text-center">
                  {tableSummaryTotal.pctCapaiThnn}%
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* FOOTER KREDIT & CAP RASMI WILAYAH */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-3 pt-2 text-[7.5px] text-slate-400 dark:text-slate-500">
        <div className="flex items-center gap-2">
          <span className="font-mono">
            FPM WILAYAH JOHOR BAHRU • DOKUMEN PRESTASI {zoneHeaderTitle}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span>Halaman: 1</span>
          <span className="font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
            WILAYAH JOHOR BAHRU
          </span>
        </div>
      </div>
    </div>
  );
};
