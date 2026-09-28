/**
 * Standard Data Transfer Objects (DTOs) & Type Contracts
 * Eliminates 'any' usage across server API endpoints.
 */

export interface PruningRecordDTO {
  id?: string;
  blok: string;
  pusingan?: number;
  tarikh?: string;
  pokok_siap?: number;
  jumlah_pokok?: number;
  luas_hektar?: number;
  status?: string;
  pekerja?: string;
  catatan?: string;
  estate_id?: string;
  recorded_by_kiosk?: string;
  operator_id?: string;
}

export interface PruningBatchDTO {
  data: PruningRecordDTO[];
}

export interface MerumputProgressDTO {
  id?: string;
  blok: string;
  luas?: number;
  pusingan?: number;
  jenis?: string;
  tarikh_mula?: string;
  tarikh_siap?: string;
  hek_siap?: number;
  workers_count?: number;
  estate_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MerumputInventoryDTO {
  id?: string;
  bahan: string;
  baki_awal?: number;
  terima?: number;
  guna?: number;
  baki_akhir?: number;
  unit?: string;
  tarikh?: string;
  estate_id?: string;
}

export interface HasilAbwDTO {
  id?: string;
  tarikh: string;
  blok: string;
  bts_count?: number;
  berat_tan?: number;
  abw?: number;
  pusingan?: number;
  mandur?: string;
  estate_id?: string;
}

export interface HantaranRecordDTO {
  id?: string;
  no_resit: string;
  tarikh: string;
  pemandu?: string;
  no_lori?: string;
  berat_bersih_tan?: number;
  kilang?: string;
  status?: string;
  estate_id?: string;
  [key: string]: unknown;
}

export interface AiChatRequestDTO {
  message: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  category?: string;
  estateId?: string;
  clientBacklogHistory?: unknown;
}

export interface ApiResponse<T = unknown> {
  success?: boolean;
  data?: T;
  error?: string;
  count?: number;
  message?: string;
}

export interface FertilizerMasterScheduleDTO {
  id?: string;
  blok_code: string;
  luas_ha?: number;
  dirian?: number;
  pokok?: number;
  pus1_beg?: number;
  pus2_beg?: number;
  pus3_beg?: number;
  pus4_beg?: number;
  compact_total_beg?: number;
  organic_total_beg?: number;
  grand_total_beg?: number;
  estate_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FertilizerDailyEntryDTO {
  id?: string;
  entry_date: string;
  blok_code: string;
  pus: number;
  interval_name?: string;
  fertilizer_type?: string;
  workers_count?: number;
  total_beg_completed: number;
  productivity_beg_per_worker?: number;
  target_beg_for_selected_pus?: number;
  note?: string;
  estate_id?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FertilizerInventoryDTO {
  id?: string;
  name: string;
  type?: string;
  quantity?: number;
  unit?: string;
  minimum_stock?: number;
  estate_id?: string;
  updated_at?: string;
}

export interface FertilizerTransactionDTO {
  id?: string;
  inventory_id: string;
  type: 'IN' | 'OUT';
  quantity: number;
  reference?: string;
  estate_id?: string;
  created_at?: string;
}
