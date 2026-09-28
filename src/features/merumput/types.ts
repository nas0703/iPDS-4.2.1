export interface MerumputProgress {
  id?: string;
  estate_id?: string;
  blok: string;
  luas: number;
  pusingan: number;
  jenis: string;
  tarikh_mula: string;
  tarikh_siap?: string;
  hek_siap: number;
  workers_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface MerumputInventoryItem {
  id: string;
  estate_id?: string;
  name: string;
  quantity: number;
  min_threshold: number;
  unit: string;
  created_at?: string;
  updated_at?: string;
}

export interface MerumputTransaction {
  id: string;
  estate_id?: string;
  inventory_id: string;
  type: 'IN' | 'OUT';
  quantity: number;
  reference?: string;
  created_at: string;
}

export interface WeedingSummary {
  totalLuas: number;
  totalHektarSiap: number;
  overallProgress: number;
  remainingHektar: number;
  lowStockCount: number;
  overdueBlocksCount: number;
}
