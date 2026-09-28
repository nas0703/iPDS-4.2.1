import express from 'express';
import crypto from 'crypto';
import { getScopedSupabase, isMissingTableError } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import type { AuthRole } from '../services/auth.service.js';
import { auditService } from '../services/audit.service.js';
import { getSafeErrorMessage } from '../utils/errorUtils.js';
import { getLocalEstateJson, saveLocalEstateJson } from '../local.js';

const router = express.Router();

export interface FertilizerEntry {
  id: string;
  estate_id: string;
  entry_date: string;
  blok_code: string;
  pus: number;
  fertilizer_type?: string;
  workers_count?: number;
  total_beg_completed: number;
  note?: string;
  interval_name?: string;
  productivity_beg_per_worker?: number;
  target_beg_for_selected_pus?: number;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface FertilizerMasterItem {
  blok?: string;
  blok_code: string;
  luas?: number;
  dirian?: number;
  pokok?: number;
  pus1?: number;
  pus2?: number;
  pus3?: number;
  pus4?: number;
  pus1_beg?: number;
  pus2_beg?: number;
  pus3_beg?: number;
  pus4_beg?: number;
  estate_id?: string;
  [key: string]: unknown;
}

export interface FertilizerInventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  type: string;
  estate_id: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface FertilizerTransaction {
  id: string;
  inventory_id: string;
  type: string;
  quantity: number;
  reference?: string;
  created_at?: string;
  estate_id: string;
  [key: string]: unknown;
}

function isValidUUID(str: unknown): boolean {
  if (!str || typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

function safeUUID(id?: unknown): string {
  if (id && isValidUUID(id)) return String(id);
  return crypto.randomUUID();
}

function generateUUID(): string {
  return crypto.randomUUID();
}

export const ALLOWED_FERTILIZER_ENTRY_COLUMNS = [
  'id',
  'entry_date',
  'blok_code',
  'pus',
  'interval_name',
  'fertilizer_type',
  'workers_count',
  'total_beg_completed',
  'productivity_beg_per_worker',
  'target_beg_for_selected_pus',
  'note',
  'created_by',
  'created_at',
  'updated_at',
  'estate_id'
];

export const FERTILIZER_PROGRAM_2026 = [
  { blok: "1", blok_code: "1", luas: 72.150, dirian: 133, pokok: 9589, pus1: 527, pus2: 384, pus3: 384, pus4: 384, pus1_beg: 527, pus2_beg: 384, pus3_beg: 384, pus4_beg: 384 },
  { blok: "2", blok_code: "2", luas: 68.370, dirian: 136, pokok: 9278, pus1: 510, pus2: 371, pus3: 371, pus4: 371, pus1_beg: 510, pus2_beg: 371, pus3_beg: 371, pus4_beg: 371 },
  { blok: "3", blok_code: "3", luas: 76.590, dirian: 139, pokok: 10661, pus1: 586, pus2: 426, pus3: 426, pus4: 426, pus1_beg: 586, pus2_beg: 426, pus3_beg: 426, pus4_beg: 426 },
  { blok: "4", blok_code: "4", luas: 92.390, dirian: 135, pokok: 12509, pus1: 688, pus2: 500, pus3: 500, pus4: 500, pus1_beg: 688, pus2_beg: 500, pus3_beg: 500, pus4_beg: 500 },
  { blok: "5", blok_code: "5", luas: 60.190, dirian: 133, pokok: 8008, pus1: 440, pus2: 320, pus3: 320, pus4: 320, pus1_beg: 440, pus2_beg: 320, pus3_beg: 320, pus4_beg: 320 },
  { blok: "6", blok_code: "6", luas: 80.420, dirian: 138, pokok: 11117, pus1: 611, pus2: 445, pus3: 445, pus4: 445, pus1_beg: 611, pus2_beg: 445, pus3_beg: 445, pus4_beg: 445 },
  { blok: "7", blok_code: "7", luas: 89.460, dirian: 121, pokok: 10806, pus1: 594, pus2: 432, pus3: 432, pus4: 432, pus1_beg: 594, pus2_beg: 432, pus3_beg: 432, pus4_beg: 432 },
  { blok: "8", blok_code: "8", luas: 82.030, dirian: 135, pokok: 11089, pus1: 610, pus2: 444, pus3: 444, pus4: 444, pus1_beg: 610, pus2_beg: 444, pus3_beg: 444, pus4_beg: 444 },
  { blok: "9", blok_code: "9", luas: 83.610, dirian: 132, pokok: 11028, pus1: 607, pus2: 441, pus3: 441, pus4: 441, pus1_beg: 607, pus2_beg: 441, pus3_beg: 441, pus4_beg: 441 },
  { blok: "10", blok_code: "10", luas: 84.360, dirian: 133, pokok: 11213, pus1: 617, pus2: 449, pus3: 449, pus4: 449, pus1_beg: 617, pus2_beg: 449, pus3_beg: 449, pus4_beg: 449 },
  { blok: "11", blok_code: "11", luas: 47.850, dirian: 138, pokok: 6625, pus1: 364, pus2: 265, pus3: 265, pus4: 265, pus1_beg: 364, pus2_beg: 265, pus3_beg: 265, pus4_beg: 265 },
  { blok: "12", blok_code: "12", luas: 76.500, dirian: 135, pokok: 10308, pus1: 567, pus2: 412, pus3: 412, pus4: 412, pus1_beg: 567, pus2_beg: 412, pus3_beg: 412, pus4_beg: 412 },
  { blok: "13", blok_code: "13", luas: 50.750, dirian: 134, pokok: 6786, pus1: 373, pus2: 271, pus3: 271, pus4: 271, pus1_beg: 373, pus2_beg: 271, pus3_beg: 271, pus4_beg: 271 },
  { blok: "14", blok_code: "14", luas: 70.450, dirian: 136, pokok: 9595, pus1: 528, pus2: 384, pus3: 384, pus4: 384, pus1_beg: 528, pus2_beg: 384, pus3_beg: 384, pus4_beg: 384 },
  { blok: "15", blok_code: "15", luas: 68.360, dirian: 132, pokok: 9041, pus1: 497, pus2: 362, pus3: 362, pus4: 362, pus1_beg: 497, pus2_beg: 362, pus3_beg: 362, pus4_beg: 362 },
  { blok: "16", blok_code: "16", luas: 64.440, dirian: 136, pokok: 8765, pus1: 482, pus2: 351, pus3: 351, pus4: 351, pus1_beg: 482, pus2_beg: 351, pus3_beg: 351, pus4_beg: 351 },
  { blok: "17", blok_code: "17", luas: 84.080, dirian: 133, pokok: 11209, pus1: 616, pus2: 448, pus3: 448, pus4: 448, pus1_beg: 616, pus2_beg: 448, pus3_beg: 448, pus4_beg: 448 },
  { blok: "18", blok_code: "18", luas: 76.190, dirian: 142, pokok: 10793, pus1: 648, pus2: 432, pus3: 432, pus4: 540, pus1_beg: 648, pus2_beg: 432, pus3_beg: 432, pus4_beg: 540 },
  { blok: "19", blok_code: "19", luas: 81.750, dirian: 141, pokok: 11559, pus1: 694, pus2: 462, pus3: 462, pus4: 578, pus1_beg: 694, pus2_beg: 462, pus3_beg: 462, pus4_beg: 578 },
  { blok: "20", blok_code: "20", luas: 68.620, dirian: 145, pokok: 9980, pus1: 599, pus2: 399, pus3: 399, pus4: 499, pus1_beg: 599, pus2_beg: 399, pus3_beg: 399, pus4_beg: 499 },
  { blok: "21", blok_code: "21", luas: 24.270, dirian: 144, pokok: 3503, pus1: 210, pus2: 140, pus3: 140, pus4: 175, pus1_beg: 210, pus2_beg: 140, pus3_beg: 140, pus4_beg: 175 },
  { blok: "22", blok_code: "22", luas: 65.290, dirian: 146, pokok: 9531, pus1: 572, pus2: 381, pus3: 381, pus4: 477, pus1_beg: 572, pus2_beg: 381, pus3_beg: 381, pus4_beg: 477 },
  { blok: "88", blok_code: "88", luas: 98.510, dirian: 136, pokok: 13397, pus1: 673, pus2: 470, pus3: 470, pus4: 522, pus1_beg: 673, pus2_beg: 470, pus3_beg: 470, pus4_beg: 522 }
];

export const FERTILIZER_PROGRAM_ADELA_2026 = [
  // Pkt 1 (A1 - A11)
  { blok: "A1", blok_code: "A1", luas: 30.460, dirian: 135, pokok: 4100, pus1: 205, pus2: 122, pus3: 122, pus4: 162, pus1_beg: 205, pus2_beg: 122, pus3_beg: 122, pus4_beg: 162, compact_total_beg: 367, organic_total_beg: 244, grand_total_beg: 611, pkt: "001", estate_id: "FPM_ADELA" },
  { blok: "A2", blok_code: "A2", luas: 58.070, dirian: 134, pokok: 7760, pus1: 388, pus2: 232, pus3: 232, pus4: 309, pus1_beg: 388, pus2_beg: 232, pus3_beg: 232, pus4_beg: 309, compact_total_beg: 697, organic_total_beg: 464, grand_total_beg: 1161, pkt: "001", estate_id: "FPM_ADELA" },
  { blok: "A3", blok_code: "A3", luas: 45.910, dirian: 134, pokok: 6140, pus1: 307, pus2: 183, pus3: 183, pus4: 244, pus1_beg: 307, pus2_beg: 183, pus3_beg: 183, pus4_beg: 244, compact_total_beg: 551, organic_total_beg: 366, grand_total_beg: 917, pkt: "001", estate_id: "FPM_ADELA" },
  { blok: "A4", blok_code: "A4", luas: 57.890, dirian: 134, pokok: 7740, pus1: 387, pus2: 231, pus3: 231, pus4: 308, pus1_beg: 387, pus2_beg: 231, pus3_beg: 231, pus4_beg: 308, compact_total_beg: 695, organic_total_beg: 462, grand_total_beg: 1157, pkt: "001", estate_id: "FPM_ADELA" },
  { blok: "A5", blok_code: "A5", luas: 60.050, dirian: 134, pokok: 8040, pus1: 402, pus2: 240, pus3: 240, pus4: 319, pus1_beg: 402, pus2_beg: 240, pus3_beg: 240, pus4_beg: 319, compact_total_beg: 721, organic_total_beg: 480, grand_total_beg: 1201, pkt: "001", estate_id: "FPM_ADELA" },
  { blok: "A6", blok_code: "A6", luas: 64.640, dirian: 134, pokok: 8640, pus1: 432, pus2: 258, pus3: 258, pus4: 344, pus1_beg: 432, pus2_beg: 258, pus3_beg: 258, pus4_beg: 344, compact_total_beg: 776, organic_total_beg: 516, grand_total_beg: 1292, pkt: "001", estate_id: "FPM_ADELA" },
  { blok: "A7", blok_code: "A7", luas: 68.170, dirian: 133, pokok: 9100, pus1: 455, pus2: 272, pus3: 272, pus4: 363, pus1_beg: 455, pus2_beg: 272, pus3_beg: 272, pus4_beg: 363, compact_total_beg: 818, organic_total_beg: 544, grand_total_beg: 1362, pkt: "001", estate_id: "FPM_ADELA" },
  { blok: "A8", blok_code: "A8", luas: 77.530, dirian: 134, pokok: 10360, pus1: 518, pus2: 311, pus3: 311, pus4: 412, pus1_beg: 518, pus2_beg: 311, pus3_beg: 311, pus4_beg: 412, compact_total_beg: 930, organic_total_beg: 622, grand_total_beg: 1552, pkt: "001", estate_id: "FPM_ADELA" },
  { blok: "A9", blok_code: "A9", luas: 64.040, dirian: 134, pokok: 8560, pus1: 428, pus2: 256, pus3: 256, pus4: 341, pus1_beg: 428, pus2_beg: 256, pus3_beg: 256, pus4_beg: 341, compact_total_beg: 769, organic_total_beg: 512, grand_total_beg: 1281, pkt: "001", estate_id: "FPM_ADELA" },
  { blok: "A10", blok_code: "A10", luas: 63.010, dirian: 134, pokok: 8420, pus1: 421, pus2: 251, pus3: 251, pus4: 335, pus1_beg: 421, pus2_beg: 251, pus3_beg: 251, pus4_beg: 335, compact_total_beg: 756, organic_total_beg: 502, grand_total_beg: 1258, pkt: "001", estate_id: "FPM_ADELA" },
  { blok: "A11", blok_code: "A11", luas: 23.870, dirian: 135, pokok: 3220, pus1: 161, pus2: 97, pus3: 97, pus4: 127, pus1_beg: 161, pus2_beg: 97, pus3_beg: 97, pus4_beg: 127, compact_total_beg: 288, organic_total_beg: 194, grand_total_beg: 482, pkt: "001", estate_id: "FPM_ADELA" },

  // Pkt 2 (B1 - B6)
  { blok: "B1", blok_code: "B1", luas: 59.930, dirian: 134, pokok: 8020, pus1: 401, pus2: 242, pus3: 242, pus4: 319, pus1_beg: 401, pus2_beg: 242, pus3_beg: 242, pus4_beg: 319, compact_total_beg: 720, organic_total_beg: 484, grand_total_beg: 1204, pkt: "002", estate_id: "FPM_ADELA" },
  { blok: "B2", blok_code: "B2", luas: 60.470, dirian: 134, pokok: 8080, pus1: 404, pus2: 243, pus3: 243, pus4: 322, pus1_beg: 404, pus2_beg: 243, pus3_beg: 243, pus4_beg: 322, compact_total_beg: 726, organic_total_beg: 486, grand_total_beg: 1212, pkt: "002", estate_id: "FPM_ADELA" },
  { blok: "B3", blok_code: "B3", luas: 40.400, dirian: 134, pokok: 5420, pus1: 271, pus2: 164, pus3: 164, pus4: 215, pus1_beg: 271, pus2_beg: 164, pus3_beg: 164, pus4_beg: 215, compact_total_beg: 486, organic_total_beg: 328, grand_total_beg: 814, pkt: "002", estate_id: "FPM_ADELA" },
  { blok: "B4", blok_code: "B4", luas: 48.420, dirian: 134, pokok: 6480, pus1: 324, pus2: 194, pus3: 194, pus4: 258, pus1_beg: 324, pus2_beg: 194, pus3_beg: 194, pus4_beg: 258, compact_total_beg: 582, organic_total_beg: 388, grand_total_beg: 970, pkt: "002", estate_id: "FPM_ADELA" },
  { blok: "B5", blok_code: "B5", luas: 67.760, dirian: 134, pokok: 9060, pus1: 453, pus2: 270, pus3: 270, pus4: 361, pus1_beg: 453, pus2_beg: 270, pus3_beg: 270, pus4_beg: 361, compact_total_beg: 814, organic_total_beg: 540, grand_total_beg: 1354, pkt: "002", estate_id: "FPM_ADELA" },
  { blok: "B6", blok_code: "B6", luas: 56.450, dirian: 134, pokok: 7540, pus1: 377, pus2: 226, pus3: 226, pus4: 300, pus1_beg: 377, pus2_beg: 226, pus3_beg: 226, pus4_beg: 300, compact_total_beg: 677, organic_total_beg: 452, grand_total_beg: 1129, pkt: "002", estate_id: "FPM_ADELA" },

  // Lot Tambahan (125Y, 128Y, 121V)
  { blok: "125Y", blok_code: "125Y", luas: 8.060, dirian: 134, pokok: 1080, pus1: 54, pus2: 32, pus3: 32, pus4: 43, pus1_beg: 54, pus2_beg: 32, pus3_beg: 32, pus4_beg: 43, compact_total_beg: 97, organic_total_beg: 64, grand_total_beg: 161, pkt: "004", estate_id: "FPM_ADELA" },
  { blok: "128Y", blok_code: "128Y", luas: 4.040, dirian: 134, pokok: 540, pus1: 27, pus2: 16, pus3: 16, pus4: 21, pus1_beg: 27, pus2_beg: 16, pus3_beg: 16, pus4_beg: 21, compact_total_beg: 48, organic_total_beg: 32, grand_total_beg: 80, pkt: "004", estate_id: "FPM_ADELA" },
  { blok: "121V", blok_code: "121V", luas: 4.020, dirian: 134, pokok: 540, pus1: 27, pus2: 16, pus3: 16, pus4: 21, pus1_beg: 27, pus2_beg: 16, pus3_beg: 16, pus4_beg: 21, compact_total_beg: 48, organic_total_beg: 32, grand_total_beg: 80, pkt: "004", estate_id: "FPM_ADELA" },

  // Lot FELDA (1F, 2F)
  { blok: "1F", blok_code: "1F", luas: 39.810, dirian: 135, pokok: 5360, pus1: 268, pus2: 157, pus3: 157, pus4: 211, pus1_beg: 268, pus2_beg: 157, pus3_beg: 157, pus4_beg: 211, compact_total_beg: 479, organic_total_beg: 314, grand_total_beg: 793, pkt: "003", estate_id: "FPM_ADELA" },
  { blok: "2F", blok_code: "2F", luas: 38.230, dirian: 134, pokok: 5120, pus1: 256, pus2: 155, pus3: 155, pus4: 203, pus1_beg: 256, pus2_beg: 155, pus3_beg: 155, pus4_beg: 203, compact_total_beg: 459, organic_total_beg: 310, grand_total_beg: 769, pkt: "003", estate_id: "FPM_ADELA" }
];

export function getInitialFertilizerEntries(estateId: string = 'FPM_TUNGGAL'): FertilizerEntry[] {
  const cleanEstate = (estateId || 'FPM_TUNGGAL').trim().toUpperCase();
  const entries: FertilizerEntry[] = [];

  if (cleanEstate === 'FPM_ADELA' || cleanEstate === '5136' || cleanEstate.includes('ADELA')) {
    // Berdasarkan Laporan Dokumen Rasmi FPM Adela 2026:
    // PUS 1: 6,334 Beg Siap (COMPACT FELDA 12)
    // PUS 2: 3,792 Beg Siap (FELDA Organic 6/5/15/2 + 20% org)
    // PUS 3: 768 Beg Siap (SBI Julai: 10,894 Beg)

    // PUS 1: 6,334 Beg
    FERTILIZER_PROGRAM_ADELA_2026.forEach((p, idx) => {
      let begCompleted = p.pus1;
      if (p.blok_code === 'B6') {
        begCompleted = 0; // 377 beg remaining
      } else if (p.blok_code === 'B5') {
        begCompleted = 198; // 255 beg remaining (377 + 255 = 632 remaining; 6,966 - 632 = 6,334 Beg)
      }
      if (begCompleted > 0) {
        const day = String(Math.min(28, (idx % 20) + 5)).padStart(2, '0');
        entries.push({
          id: `p1-${cleanEstate}-${p.blok_code}`,
          estate_id: cleanEstate,
          entry_date: `2026-02-${day}`,
          blok_code: p.blok_code,
          pus: 1,
          fertilizer_type: 'COMPACT FELDA 12',
          workers_count: Math.max(1, Math.round(begCompleted / 40)),
          total_beg_completed: begCompleted,
          note: begCompleted === p.pus1 ? 'Siap Pusingan 1 (100%)' : `Sebahagian Pusingan 1 (${begCompleted}/${p.pus1} Beg)`,
          interval_name: 'FEB - MAC',
          productivity_beg_per_worker: 40,
          target_beg_for_selected_pus: p.pus1,
          created_at: '2026-02-28T08:00:00.000Z',
          updated_at: '2026-02-28T08:00:00.000Z'
        });
      }
    });

    // PUS 2: 3,792 Beg (Total 4,168 - 376 remaining: B6 226 rem, 2F 150 rem)
    FERTILIZER_PROGRAM_ADELA_2026.forEach((p, idx) => {
      let begCompleted = p.pus2;
      if (p.blok_code === 'B6') {
        begCompleted = 0;
      } else if (p.blok_code === '2F') {
        begCompleted = 5; // 155 - 150 = 5 beg
      }
      if (begCompleted > 0) {
        const day = String(Math.min(28, (idx % 20) + 5)).padStart(2, '0');
        entries.push({
          id: `p2-${cleanEstate}-${p.blok_code}`,
          estate_id: cleanEstate,
          entry_date: `2026-04-${day}`,
          blok_code: p.blok_code,
          pus: 2,
          fertilizer_type: 'FELDA Organic 6/5/15/2 + 20% org',
          workers_count: Math.max(1, Math.round(begCompleted / 40)),
          total_beg_completed: begCompleted,
          note: begCompleted === p.pus2 ? 'Siap Pusingan 2 (100%)' : `Sebahagian Pusingan 2 (${begCompleted}/${p.pus2} Beg)`,
          interval_name: 'APR - MEI',
          productivity_beg_per_worker: 40,
          target_beg_for_selected_pus: p.pus2,
          created_at: '2026-04-30T08:00:00.000Z',
          updated_at: '2026-04-30T08:00:00.000Z'
        });
      }
    });

    // PUS 3: 768 Beg (Total SBI Julai = 6,334 + 3,792 + 768 = 10,894 Beg)
    const p3Blocks = ['A1', 'A2', 'A3', 'A4'];
    p3Blocks.forEach((bCode, idx) => {
      const p = FERTILIZER_PROGRAM_ADELA_2026.find(item => item.blok_code === bCode);
      if (p) {
        entries.push({
          id: `p3-${cleanEstate}-${p.blok_code}`,
          estate_id: cleanEstate,
          entry_date: `2026-06-${String(10 + idx * 4).padStart(2, '0')}`,
          blok_code: p.blok_code,
          pus: 3,
          fertilizer_type: 'FELDA Organic 6/5/15/2 + 20% org',
          workers_count: Math.max(1, Math.round(p.pus3 / 40)),
          total_beg_completed: p.pus3,
          note: 'Siap Pusingan 3 (SBI Julai)',
          interval_name: 'JUN - JUL',
          productivity_beg_per_worker: 40,
          target_beg_for_selected_pus: p.pus3,
          created_at: '2026-07-15T08:00:00.000Z',
          updated_at: '2026-07-15T08:00:00.000Z'
        });
      }
    });

    return entries;
  }

  // PUS 1 - Siap 100% (Januari - Februari 2026, 12,613 Beg)
  FERTILIZER_PROGRAM_2026.forEach((p, idx) => {
    const day = String(Math.min(28, (idx % 20) + 5)).padStart(2, '0');
    entries.push({
      id: `p1-${cleanEstate}-${p.blok_code}`,
      estate_id: cleanEstate,
      entry_date: `2026-02-${day}`,
      blok_code: p.blok_code,
      pus: 1,
      fertilizer_type: 'BAJA SEBATIAN (NPK)',
      workers_count: Math.max(1, Math.round(p.pus1 / 40)),
      total_beg_completed: p.pus1,
      note: 'Siap Pusingan 1 (100%)',
      interval_name: 'JANUARI - FEBRUARI',
      productivity_beg_per_worker: 40,
      target_beg_for_selected_pus: p.pus1,
      created_at: '2026-02-28T08:00:00.000Z',
      updated_at: '2026-02-28T08:00:00.000Z'
    });
  });

  // PUS 2 - Siap 100% (April - Mei 2026, 9,009 Beg)
  FERTILIZER_PROGRAM_2026.forEach((p, idx) => {
    const day = String(Math.min(28, (idx % 20) + 5)).padStart(2, '0');
    entries.push({
      id: `p2-${cleanEstate}-${p.blok_code}`,
      estate_id: cleanEstate,
      entry_date: `2026-04-${day}`,
      blok_code: p.blok_code,
      pus: 2,
      fertilizer_type: 'BAJA ORGANIK',
      workers_count: Math.max(1, Math.round(p.pus2 / 40)),
      total_beg_completed: p.pus2,
      note: 'Siap Pusingan 2 (100%)',
      interval_name: 'APRIL - MEI',
      productivity_beg_per_worker: 40,
      target_beg_for_selected_pus: p.pus2,
      created_at: '2026-04-30T08:00:00.000Z',
      updated_at: '2026-04-30T08:00:00.000Z'
    });
  });

  // PUS 3 - Siap 100% (Jun - Ogos 2026, 8,989 Beg)
  FERTILIZER_PROGRAM_2026.forEach((p, idx) => {
    const day = String(Math.min(28, (idx % 20) + 5)).padStart(2, '0');
    entries.push({
      id: `p3-${cleanEstate}-${p.blok_code}`,
      estate_id: cleanEstate,
      entry_date: `2026-07-${day}`,
      blok_code: p.blok_code,
      pus: 3,
      fertilizer_type: 'BAJA KIESERITE',
      workers_count: Math.max(1, Math.round(p.pus3 / 40)),
      total_beg_completed: p.pus3,
      note: 'Siap Pusingan 3 (100%)',
      interval_name: 'JUN - JULAI',
      productivity_beg_per_worker: 40,
      target_beg_for_selected_pus: p.pus3,
      created_at: '2026-08-31T08:00:00.000Z',
      updated_at: '2026-08-31T08:00:00.000Z'
    });
  });

  return entries;
}

// --- FERTILIZER (BAJA) MODULE ROUTES ---

// 1. MASTER SCHEDULE GET
const handleGetMaster: express.RequestHandler = async (req, res) => {
  try {
    const targetEstateId = (req.estateId || 'FPM_TUNGGAL').trim().toUpperCase();
    const defaultData = (targetEstateId === 'FPM_ADELA' || targetEstateId === '5136' || targetEstateId.includes('ADELA'))
      ? FERTILIZER_PROGRAM_ADELA_2026
      : FERTILIZER_PROGRAM_2026;

    let localData = getLocalEstateJson('fertilizer_master', targetEstateId, defaultData);
    if (!Array.isArray(localData) || localData.length === 0 || ((targetEstateId === 'FPM_ADELA' || targetEstateId === '5136') && (localData.length === 23 || (localData as FertilizerMasterItem[]).some((x: FertilizerMasterItem) => x.blok_code === '88')))) {
      localData = defaultData;
      saveLocalEstateJson('fertilizer_master', targetEstateId, localData);
    }

    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    if (!supabase) return res.json(localData);

    let query = supabase.from('fertilizer_master_schedule').select('*');
    if (targetEstateId === 'FPM_TUNGGAL') {
      query = query.or('estate_id.is.null,estate_id.eq.FPM_TUNGGAL');
    } else {
      query = query.eq('estate_id', targetEstateId);
    }

    const { data, error } = await query.order('blok_code', { ascending: true });

    if (error) {
      if (isMissingTableError(error) || error.code === '42703' || String(error.message || '').includes('estate_id')) {
        return res.json(localData);
      }
      console.warn("Error fetching fertilizer master:", error.message);
      return res.json(localData);
    }

    if (data && data.length > 0) {
      saveLocalEstateJson('fertilizer_master', targetEstateId, data);
      return res.json(data);
    }

    res.json(localData);
  } catch (err: unknown) {
    const targetEstateId = (req.estateId || 'FPM_TUNGGAL').trim().toUpperCase();
    const defaultData = (targetEstateId === 'FPM_ADELA' || targetEstateId === '5136' || targetEstateId.includes('ADELA'))
      ? FERTILIZER_PROGRAM_ADELA_2026
      : FERTILIZER_PROGRAM_2026;
    const localData = getLocalEstateJson('fertilizer_master', targetEstateId, defaultData);
    res.json(localData);
  }
};

// 2. MASTER SCHEDULE BATCH POST
const handlePostMasterBatch: express.RequestHandler = async (req, res) => {
  try {
    const { data } = req.body || {};
    const targetEstateId = (req.estateId || 'FPM_TUNGGAL').trim().toUpperCase();
    
    if (Array.isArray(data)) {
      saveLocalEstateJson('fertilizer_master', targetEstateId, data);
    }

    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    if (!supabase) return res.json({ success: true, count: Array.isArray(data) ? data.length : 0 });

    const enriched = Array.isArray(data) ? data.map((item: unknown) => ({
      ...(typeof item === 'object' && item !== null ? item : {}),
      estate_id: (item as Record<string, unknown>)?.estate_id || targetEstateId
    })) : data;

    try {
      const { error } = await supabase
        .from('fertilizer_master_schedule')
        .upsert(enriched, { onConflict: 'blok_code' });

      if (error) console.warn("Supabase fertilizer master batch upsert warning:", error.message);
    } catch (e: unknown) {
      console.warn("Supabase upsert exception:", getSafeErrorMessage(e));
    }

    res.json({ success: true, count: Array.isArray(data) ? data.length : 0 });
  } catch (err: unknown) {
    res.status(500).json({ error: getSafeErrorMessage(err, 'Ralat memproses data baja.') });
  }
};

// Helper to deduplicate and purge synthetic mock entries when real records exist
function sanitizeAndMergeFertilizerEntries(localEntries: FertilizerEntry[], remoteEntries: FertilizerEntry[]): FertilizerEntry[] {
  const combined: FertilizerEntry[] = [
    ...(Array.isArray(localEntries) ? localEntries : []),
    ...(Array.isArray(remoteEntries) ? remoteEntries : [])
  ];

  // Group by estate_id + blok_code + pus
  const groups = new Map<string, FertilizerEntry[]>();
  for (const item of combined) {
    if (!item) continue;
    const blok = String(item.blok_code || item.blok || '').trim();
    const pus = Number(item.pus) || 0;
    const estate = String(item.estate_id || 'FPM_TUNGGAL').trim().toUpperCase();
    const key = `${estate}__${blok}__${pus}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(item);
  }

  const result: FertilizerEntry[] = [];
  for (const [_, items] of groups.entries()) {
    // Check if real (non-seed) records exist
    const realItems = items.filter((e: FertilizerEntry) => {
      const id = String(e.id || '');
      return !id.startsWith('p1-') && !id.startsWith('p2-') && !id.startsWith('p3-');
    });

    // If real records exist, completely discard synthetic seed entries
    const chosenItems = realItems.length > 0 ? realItems : items;

    // Deduplicate by id or composite key (blok_code, pus, entry_date, total_beg_completed)
    const seen = new Set<string>();
    for (const entry of chosenItems) {
      const dedupKey = entry.id || `${entry.blok_code}_${entry.pus}_${entry.entry_date}_${entry.total_beg_completed}`;
      if (!seen.has(dedupKey)) {
        seen.add(dedupKey);
        result.push(entry);
      }
    }
  }

  return result.sort((a: FertilizerEntry, b: FertilizerEntry) => {
    return (b.entry_date || '').localeCompare(a.entry_date || '');
  });
}

// 3. DAILY ENTRIES GET
const handleGetEntries: express.RequestHandler = async (req, res) => {
  try {
    const targetEstateId = (req.estateId || 'FPM_TUNGGAL').trim().toUpperCase();
    let localData = getLocalEstateJson('fertilizer_entries', targetEstateId, []);

    // Ensure baseline seed exists only if dataset is completely empty
    if (!Array.isArray(localData) || localData.length === 0) {
      localData = getInitialFertilizerEntries(targetEstateId);
      saveLocalEstateJson('fertilizer_entries', targetEstateId, localData);
    }

    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    if (!supabase) {
      const cleanLocal = sanitizeAndMergeFertilizerEntries(localData, []);
      return res.json(cleanLocal);
    }

    let query = supabase.from('fertilizer_daily_entries').select('*');
    if (targetEstateId === 'FPM_TUNGGAL') {
      query = query.or('estate_id.is.null,estate_id.eq.FPM_TUNGGAL');
    } else {
      query = query.eq('estate_id', targetEstateId);
    }

    const { data, error } = await query.order('entry_date', { ascending: false });

    if (error) {
      if (isMissingTableError(error) || error.code === '42703' || String(error.message || '').includes('estate_id')) {
        const cleanLocal = sanitizeAndMergeFertilizerEntries(localData, []);
        return res.json(cleanLocal);
      }
      console.warn("Error fetching fertilizer entries:", error.message);
      const cleanLocal = sanitizeAndMergeFertilizerEntries(localData, []);
      return res.json(cleanLocal);
    }

    // Merge Supabase data with localData ensuring NO synthetic duplicate seeds double-count
    const merged = sanitizeAndMergeFertilizerEntries(localData, data || []);

    saveLocalEstateJson('fertilizer_entries', targetEstateId, merged);
    return res.json(merged);
  } catch (err: unknown) {
    const targetEstateId = (req.estateId || 'FPM_TUNGGAL').trim().toUpperCase();
    const localData = getLocalEstateJson('fertilizer_entries', targetEstateId, getInitialFertilizerEntries(targetEstateId));
    const clean = sanitizeAndMergeFertilizerEntries(localData, []);
    res.json(clean);
  }
};

// 4. DAILY ENTRY CREATE (POST)
const handlePostEntry: express.RequestHandler = async (req, res) => {
  try {
    const payload = req.body || {};
    const targetEstateId = (req.estateId || 'FPM_TUNGGAL').trim().toUpperCase();

    const entryId = safeUUID(payload.id);
    const workersCount = Number(payload.workers_count) || 1;
    const totalBeg = Number(payload.total_beg_completed) || 0;
    const productivity = Number(payload.productivity_beg_per_worker) || (workersCount > 0 ? Math.round((totalBeg / workersCount) * 100) / 100 : 0);

    const localEntry: FertilizerEntry = {
      id: entryId,
      entry_date: payload.entry_date || new Date().toISOString().split('T')[0],
      blok_code: String(payload.blok_code || '').trim(),
      pus: Number(payload.pus) || 1,
      interval_name: payload.interval_name || null,
      fertilizer_type: payload.fertilizer_type || 'COMPACT FELDA 12',
      workers_count: workersCount,
      total_beg_completed: totalBeg,
      productivity_beg_per_worker: productivity,
      target_beg_for_selected_pus: Number(payload.target_beg_for_selected_pus) || 0,
      note: payload.note || '',
      created_by: req.user?.sub || req.user?.user_metadata?.email || payload.created_by || null,
      estate_id: targetEstateId,
      created_at: payload.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // 1. Update local storage for zero-data-loss resiliency
    const localEntries = getLocalEstateJson('fertilizer_entries', targetEstateId, getInitialFertilizerEntries(targetEstateId));
    const filteredLocal = (localEntries as FertilizerEntry[]).filter((e: FertilizerEntry) => e.id !== entryId && !(e.blok_code === localEntry.blok_code && Number(e.pus) === Number(localEntry.pus) && e.entry_date === localEntry.entry_date));
    filteredLocal.unshift(localEntry);
    saveLocalEstateJson('fertilizer_entries', targetEstateId, filteredLocal);

    // Auto update local inventory if specified
    if (localEntry.fertilizer_type && localEntry.total_beg_completed > 0) {
      const localInv = getLocalEstateJson('fertilizer_inventory', targetEstateId, []);
      const invIdx = (localInv as FertilizerInventoryItem[]).findIndex((i: FertilizerInventoryItem) => i.name === localEntry.fertilizer_type);
      const kgValue = localEntry.total_beg_completed * 50;

      if (invIdx >= 0) {
        localInv[invIdx].quantity = Math.max(0, (Number(localInv[invIdx].quantity) || 0) - kgValue);
        localInv[invIdx].updated_at = new Date().toISOString();
        saveLocalEstateJson('fertilizer_inventory', targetEstateId, localInv);
      }

      const localTrans = getLocalEstateJson('fertilizer_transactions', targetEstateId, []);
      localTrans.unshift({
        id: generateUUID(),
        inventory_id: invIdx >= 0 ? localInv[invIdx].id : 'temp-id',
        type: 'OUT',
        quantity: kgValue,
        reference: `Auto-deduct: Blok ${localEntry.blok_code} (Entry ID: ${entryId})`,
        created_at: new Date().toISOString(),
        estate_id: targetEstateId
      });
      saveLocalEstateJson('fertilizer_transactions', targetEstateId, localTrans);
    }

    // 2. Try Supabase write (Strictly sanitize payload against existing table schema)
    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    if (!supabase) {
      return res.json({ success: true, data: localEntry });
    }

    const supabasePayload: Record<string, unknown> = {};
    for (const col of ALLOWED_FERTILIZER_ENTRY_COLUMNS) {
      if (localEntry[col] !== undefined) {
        supabasePayload[col] = localEntry[col];
      }
    }

    try {
      // Use upsert onConflict (entry_date, blok_code, pus) to gracefully update or insert without duplicate key conflict
      const { data: insertedData, error } = await supabase
        .from('fertilizer_daily_entries')
        .upsert([supabasePayload], { onConflict: 'entry_date,blok_code,pus' })
        .select();

      if (error) {
        console.warn("Supabase daily entry upsert warning:", error.message);
        return res.json({ success: true, data: localEntry });
      }

      // Supabase auto-deduct inventory
      if (localEntry.fertilizer_type && localEntry.total_beg_completed > 0) {
        try {
          const { data: invItem, error: invError } = await supabase
            .from('fertilizer_inventory')
            .select('id, quantity')
            .eq('name', localEntry.fertilizer_type)
            .single();

          if (invItem && !invError) {
            const kgValue = localEntry.total_beg_completed * 50;
            const newQuantity = Math.max(0, invItem.quantity - kgValue);

            await supabase
              .from('fertilizer_inventory_transactions')
              .insert([{
                inventory_id: invItem.id,
                type: 'OUT',
                quantity: kgValue,
                reference: `Auto-deduct: Blok ${localEntry.blok_code} (Entry ID: ${insertedData ? insertedData[0]?.id : entryId})`,
                created_at: new Date().toISOString(),
                estate_id: targetEstateId
              }]);

            await supabase
              .from('fertilizer_inventory')
              .update({ 
                quantity: newQuantity, 
                updated_at: new Date().toISOString() 
              })
              .eq('id', invItem.id);
          }
        } catch (deductErr) {
          console.error("Failed to auto-deduct inventory in Supabase:", deductErr);
        }
      }

      return res.json({ success: true, data: (insertedData && insertedData[0]) ? insertedData[0] : localEntry });
    } catch (e: unknown) {
      console.warn("Supabase entry insert exception:", getSafeErrorMessage(e));
      return res.json({ success: true, data: localEntry });
    }
  } catch (err: unknown) {
    res.status(500).json({ error: getSafeErrorMessage(err, 'Ralat memproses data baja.') });
  }
};

// 5. DAILY ENTRY UPDATE (PUT)
const handlePutEntry: express.RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};
    const targetEstateId = (req.estateId || 'FPM_TUNGGAL').trim().toUpperCase();

    // Update local JSON
    const localEntries = getLocalEstateJson('fertilizer_entries', targetEstateId, []);
    const idx = (localEntries as FertilizerEntry[]).findIndex((e: FertilizerEntry) => String(e.id) === String(id));
    let updatedEntry = { ...payload, id, estate_id: targetEstateId, updated_at: new Date().toISOString() };
    if (idx >= 0) {
      updatedEntry = { ...localEntries[idx], ...payload, updated_at: new Date().toISOString() };
      localEntries[idx] = updatedEntry;
      saveLocalEstateJson('fertilizer_entries', targetEstateId, localEntries);
    }

    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    if (!supabase) return res.json({ success: true, data: updatedEntry });

    // Cleanse update payload so no invalid column (like searchString or UI helper properties) causes PGRST204
    const cleanedUpdate: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };
    for (const col of ALLOWED_FERTILIZER_ENTRY_COLUMNS) {
      if (col !== 'id' && payload[col] !== undefined) {
        cleanedUpdate[col] = payload[col];
      }
    }

    try {
      const { data, error } = await supabase
        .from('fertilizer_daily_entries')
        .update(cleanedUpdate)
        .eq('id', id)
        .select();

      if (error) {
        console.warn("Supabase update error:", error.message);
        return res.json({ success: true, data: updatedEntry });
      }

      res.json({ success: true, data: data && data[0] ? data[0] : updatedEntry });
    } catch (e: unknown) {
      res.json({ success: true, data: updatedEntry });
    }
  } catch (err: unknown) {
    res.status(500).json({ error: getSafeErrorMessage(err, 'Ralat memproses data baja.') });
  }
};

// 6. DAILY ENTRY DELETE (DELETE)
const handleDeleteEntry: express.RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const targetEstateId = (req.estateId || 'FPM_TUNGGAL').trim().toUpperCase();

    // Update local storage
    const localEntries = getLocalEstateJson('fertilizer_entries', targetEstateId, []);
    const filtered = (localEntries as FertilizerEntry[]).filter((e: FertilizerEntry) => String(e.id) !== String(id));
    saveLocalEstateJson('fertilizer_entries', targetEstateId, filtered);

    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    if (!supabase) return res.json({ success: true });

    try {
      await supabase
        .from('fertilizer_daily_entries')
        .delete()
        .eq('id', id);
    } catch (e: unknown) {
      console.warn("Supabase delete warning:", getSafeErrorMessage(e));
    }

    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ error: getSafeErrorMessage(err, 'Ralat memproses data baja.') });
  }
};

// 7. DAILY ENTRIES BATCH POST
const handlePostBatchEntries: express.RequestHandler = async (req, res) => {
  try {
    const { data } = req.body || {};
    const targetEstateId = (req.estateId || 'FPM_TUNGGAL').trim().toUpperCase();

    if (Array.isArray(data)) {
      saveLocalEstateJson('fertilizer_entries', targetEstateId, data);
    }

    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    if (!supabase) return res.json({ success: true, count: Array.isArray(data) ? data.length : 0 });

    const enriched = Array.isArray(data) ? data.map((item: Record<string, unknown>) => {
      const sanitized: Record<string, unknown> = {
        id: safeUUID(item.id),
        estate_id: item.estate_id || targetEstateId,
        updated_at: new Date().toISOString()
      };
      for (const col of ALLOWED_FERTILIZER_ENTRY_COLUMNS) {
        if (item[col] !== undefined) {
          sanitized[col] = item[col];
        }
      }
      return sanitized;
    }) : data;

    try {
      const { error } = await supabase
        .from('fertilizer_daily_entries')
        .upsert(enriched, { onConflict: 'entry_date,blok_code,pus' });

      if (error) console.warn("Supabase batch upsert warning:", error.message);
    } catch (e: unknown) {
      console.warn("Supabase batch upsert exception:", getSafeErrorMessage(e));
    }

    res.json({ success: true, count: Array.isArray(data) ? data.length : 0 });
  } catch (err: unknown) {
    res.status(500).json({ error: getSafeErrorMessage(err, 'Ralat memproses data baja.') });
  }
};

// 8. INVENTORY GET
const handleGetInventory: express.RequestHandler = async (req, res) => {
  try {
    const targetEstateId = (req.estateId || 'FPM_TUNGGAL').trim().toUpperCase();
    const defaultInventory = (targetEstateId === 'FPM_ADELA' || targetEstateId === '5136' || targetEstateId.includes('ADELA')) ? [
      { id: generateUUID(), name: "COMPACT FELDA 12", quantity: 625200, unit: "KG", type: "BAJA", estate_id: targetEstateId },
      { id: generateUUID(), name: "FELDA Organic 6/5/15/2 + 20% org", quantity: 416800, unit: "KG", type: "BAJA", estate_id: targetEstateId },
      { id: generateUUID(), name: "BAJA KIESERITE", quantity: 2500, unit: "KG", type: "BAJA", estate_id: targetEstateId },
      { id: generateUUID(), name: "BAJA BORATE", quantity: 1000, unit: "KG", type: "BAJA", estate_id: targetEstateId }
    ] : [
      { id: generateUUID(), name: "BAJA SEBATIAN (NPK)", quantity: 5000, unit: "KG", type: "BAJA", estate_id: targetEstateId },
      { id: generateUUID(), name: "BAJA MOP", quantity: 3000, unit: "KG", type: "BAJA", estate_id: targetEstateId },
      { id: generateUUID(), name: "BAJA KIESERITE", quantity: 2500, unit: "KG", type: "BAJA", estate_id: targetEstateId },
      { id: generateUUID(), name: "BAJA BORATE", quantity: 1000, unit: "KG", type: "BAJA", estate_id: targetEstateId }
    ];
    const localData = getLocalEstateJson('fertilizer_inventory', targetEstateId, defaultInventory);

    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    if (!supabase) return res.json(localData);

    let query = supabase.from('fertilizer_inventory').select('*');
    if (targetEstateId === 'FPM_TUNGGAL') {
      query = query.or('estate_id.is.null,estate_id.eq.FPM_TUNGGAL');
    } else {
      query = query.eq('estate_id', targetEstateId);
    }

    const { data, error } = await query.order('name', { ascending: true });

    if (error) {
      if (isMissingTableError(error) || error.code === '42703' || String(error.message || '').includes('estate_id')) {
        return res.json(localData);
      }
      console.warn("Error fetching fertilizer inventory:", error.message);
      return res.json(localData);
    }

    if (data && data.length > 0) {
      saveLocalEstateJson('fertilizer_inventory', targetEstateId, data);
      return res.json(data);
    }

    res.json(localData);
  } catch (err: unknown) {
    const targetEstateId = (req.estateId || 'FPM_TUNGGAL').trim().toUpperCase();
    const localData = getLocalEstateJson('fertilizer_inventory', targetEstateId, []);
    res.json(localData);
  }
};

// 9. INVENTORY POST
const handlePostInventory: express.RequestHandler = async (req, res) => {
  try {
    const payload = req.body || {};
    const targetEstateId = (req.estateId || 'FPM_TUNGGAL').trim().toUpperCase();

    const invId = payload.id || generateUUID();
    const newInvItem: FertilizerInventoryItem = {
      ...payload,
      id: invId,
      estate_id: targetEstateId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const localInv = getLocalEstateJson('fertilizer_inventory', targetEstateId, []);
    (localInv as FertilizerInventoryItem[]).push(newInvItem);
    saveLocalEstateJson('fertilizer_inventory', targetEstateId, localInv);

    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    if (!supabase) return res.json(newInvItem);

    try {
      const { data, error } = await supabase
        .from('fertilizer_inventory')
        .insert([newInvItem])
        .select();

      if (!error && data && data[0]) {
        return res.json(data[0]);
      }
    } catch (e: unknown) {
      console.warn("Supabase inventory insert warning:", getSafeErrorMessage(e));
    }

    res.json(newInvItem);
  } catch (err: unknown) {
    res.status(500).json({ error: getSafeErrorMessage(err, 'Ralat memproses data baja.') });
  }
};

// 10. INVENTORY TRANSACTIONS GET
const handleGetTransactions: express.RequestHandler = async (req, res) => {
  try {
    const targetEstateId = (req.estateId || 'FPM_TUNGGAL').trim().toUpperCase();
    const localData = getLocalEstateJson('fertilizer_transactions', targetEstateId, []);

    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    if (!supabase) return res.json(localData);

    let query = supabase.from('fertilizer_inventory_transactions').select('*');
    if (targetEstateId === 'FPM_TUNGGAL') {
      query = query.or('estate_id.is.null,estate_id.eq.FPM_TUNGGAL');
    } else {
      query = query.eq('estate_id', targetEstateId);
    }

    const { data, error } = await query.order('created_at', { ascending: false }).limit(100);

    if (error) {
      if (isMissingTableError(error) || error.code === '42703' || String(error.message || '').includes('estate_id')) {
        return res.json(localData);
      }
      console.warn("Error fetching fertilizer inventory transactions:", error.message);
      return res.json(localData);
    }

    if (data && data.length > 0) {
      saveLocalEstateJson('fertilizer_transactions', targetEstateId, data);
      return res.json(data);
    }

    res.json(localData);
  } catch (err: unknown) {
    const targetEstateId = (req.estateId || 'FPM_TUNGGAL').trim().toUpperCase();
    const localData = getLocalEstateJson('fertilizer_transactions', targetEstateId, []);
    res.json(localData);
  }
};

// 11. INVENTORY TRANSACTION POST
const handlePostTransaction: express.RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, quantity, reference } = req.body || {};
    const targetEstateId = (req.estateId || 'FPM_TUNGGAL').trim().toUpperCase();

    // Update local inventory
    const localInv = getLocalEstateJson('fertilizer_inventory', targetEstateId, []);
    const invIdx = (localInv as FertilizerInventoryItem[]).findIndex((i: FertilizerInventoryItem) => String(i.id) === String(id));
    let newQuantity = 0;
    if (invIdx >= 0) {
      const currentQty = Number(localInv[invIdx].quantity) || 0;
      newQuantity = type === 'IN' ? currentQty + Number(quantity) : Math.max(0, currentQty - Number(quantity));
      localInv[invIdx].quantity = newQuantity;
      localInv[invIdx].updated_at = new Date().toISOString();
      saveLocalEstateJson('fertilizer_inventory', targetEstateId, localInv);
    }

    // Save local transaction
    const localTrans = getLocalEstateJson('fertilizer_transactions', targetEstateId, []);
    (localTrans as FertilizerTransaction[]).unshift({
      id: generateUUID(),
      inventory_id: id,
      type,
      quantity: Number(quantity),
      reference,
      created_at: new Date().toISOString(),
      estate_id: targetEstateId
    });
    saveLocalEstateJson('fertilizer_transactions', targetEstateId, localTrans);

    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    if (!supabase) return res.json({ success: true, newQuantity });

    try {
      await supabase
        .from('fertilizer_inventory_transactions')
        .insert([{
          inventory_id: id,
          type,
          quantity: Number(quantity),
          reference,
          created_at: new Date().toISOString(),
          estate_id: targetEstateId
        }]);

      const { data: inv } = await supabase
        .from('fertilizer_inventory')
        .select('quantity')
        .eq('id', id)
        .single();

      if (inv) {
        const sbQty = type === 'IN' ? (inv.quantity + Number(quantity)) : Math.max(0, (inv.quantity - Number(quantity)));
        await supabase
          .from('fertilizer_inventory')
          .update({ quantity: sbQty, updated_at: new Date().toISOString() })
          .eq('id', id);
      }
    } catch (e: unknown) {
      console.warn("Supabase transaction execution warning:", getSafeErrorMessage(e));
    }

    res.json({ success: true, newQuantity });
  } catch (err: unknown) {
    res.status(500).json({ error: getSafeErrorMessage(err, 'Ralat memproses data baja.') });
  }
};

// 12. INVENTORY TRANSACTION DELETE
const handleDeleteTransaction: express.RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const targetEstateId = (req.estateId || 'FPM_TUNGGAL').trim().toUpperCase();

    const localTrans = getLocalEstateJson('fertilizer_transactions', targetEstateId, []);
    const trans = (localTrans as FertilizerTransaction[]).find((t: FertilizerTransaction) => String(t.id) === String(id));
    const filteredTrans = (localTrans as FertilizerTransaction[]).filter((t: FertilizerTransaction) => String(t.id) !== String(id));
    saveLocalEstateJson('fertilizer_transactions', targetEstateId, filteredTrans);

    let revertedQuantity = 0;
    if (trans) {
      const localInv = getLocalEstateJson('fertilizer_inventory', targetEstateId, []);
      const invIdx = (localInv as FertilizerInventoryItem[]).findIndex((i: FertilizerInventoryItem) => String(i.id) === String(trans.inventory_id));
      if (invIdx >= 0) {
        const currentQty = Number(localInv[invIdx].quantity) || 0;
        revertedQuantity = trans.type === 'IN' ? Math.max(0, currentQty - Number(trans.quantity)) : currentQty + Number(trans.quantity);
        localInv[invIdx].quantity = revertedQuantity;
        saveLocalEstateJson('fertilizer_inventory', targetEstateId, localInv);
      }
    }

    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    if (!supabase) return res.json({ success: true, newQuantity: revertedQuantity });

    try {
      await supabase.from('fertilizer_inventory_transactions').delete().eq('id', id);
    } catch (e: unknown) {
      console.warn("Supabase transaction delete warning:", getSafeErrorMessage(e));
    }

    res.json({ success: true, newQuantity: revertedQuantity });
  } catch (err: unknown) {
    res.status(500).json({ error: getSafeErrorMessage(err, 'Ralat memproses data baja.') });
  }
};

// ==========================================
// ROUTE REGISTRATIONS (Dual Prefixed & Flat)
// P0-08: mandatory authentication + role authorization. Estate is derived from
// the validated session (req.estateId); client-supplied estate_id / estateId /
// x-estate-id values cannot override it.
// ==========================================

const FERTILIZER_WRITE_ROLES: AuthRole[] = ['staff', 'mandur', 'pf', 'fc', 'afc', 'fs', 'oc', 'rc'];

// Master
router.get("/fertilizer/master", requireAuth, handleGetMaster);
router.get("/master", requireAuth, handleGetMaster);

router.post("/fertilizer/master/batch", requireRole(FERTILIZER_WRITE_ROLES), handlePostMasterBatch);
router.post("/master/batch", requireRole(FERTILIZER_WRITE_ROLES), handlePostMasterBatch);

// Entries
router.get("/fertilizer/entries", requireAuth, handleGetEntries);
router.get("/entries", requireAuth, handleGetEntries);

router.post("/fertilizer/entries/batch", requireRole(FERTILIZER_WRITE_ROLES), handlePostBatchEntries);
router.post("/entries/batch", requireRole(FERTILIZER_WRITE_ROLES), handlePostBatchEntries);

router.post("/fertilizer/entries", requireRole(FERTILIZER_WRITE_ROLES), handlePostEntry);
router.post("/entries", requireRole(FERTILIZER_WRITE_ROLES), handlePostEntry);

router.put("/fertilizer/entries/:id", requireRole(FERTILIZER_WRITE_ROLES), handlePutEntry);
router.put("/entries/:id", requireRole(FERTILIZER_WRITE_ROLES), handlePutEntry);

router.delete("/fertilizer/entries/:id", requireRole(FERTILIZER_WRITE_ROLES), handleDeleteEntry);
router.delete("/entries/:id", requireRole(FERTILIZER_WRITE_ROLES), handleDeleteEntry);

// Inventory
router.get("/fertilizer/inventory/transactions", requireAuth, handleGetTransactions);
router.get("/inventory/transactions", requireAuth, handleGetTransactions);
router.get("/transactions", requireAuth, handleGetTransactions);

router.post("/fertilizer/inventory/:id/transaction", requireRole(FERTILIZER_WRITE_ROLES), handlePostTransaction);
router.post("/inventory/:id/transaction", requireRole(FERTILIZER_WRITE_ROLES), handlePostTransaction);
router.post("/:id/transaction", requireRole(FERTILIZER_WRITE_ROLES), handlePostTransaction);

router.delete("/fertilizer/inventory/transactions/:id", requireRole(FERTILIZER_WRITE_ROLES), handleDeleteTransaction);
router.delete("/inventory/transactions/:id", requireRole(FERTILIZER_WRITE_ROLES), handleDeleteTransaction);
router.delete("/transactions/:id", requireRole(FERTILIZER_WRITE_ROLES), handleDeleteTransaction);

router.get("/fertilizer/inventory", requireAuth, handleGetInventory);
router.get("/inventory", requireAuth, handleGetInventory);

router.post("/fertilizer/inventory", requireRole(FERTILIZER_WRITE_ROLES), handlePostInventory);
router.post("/inventory", requireRole(FERTILIZER_WRITE_ROLES), handlePostInventory);

export default router;
