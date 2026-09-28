export interface PruningRecord {
  id?: string;
  estate_id?: string;
  blok: string;
  luas: number;
  tarikh_mula: string | null;
  tarikh_siap: string | null;
  hek_siap_pekerja: number;
  hek_pekerja_cekrol: number;
  jum_hektar_siap: number;
  peratus_siap: number;
  created_at?: string;
}

export interface PruningSummary {
  totalLuas: number;
  totalHektarSiap: number;
  overallProgress: number;
  remainingHektar: number;
}
