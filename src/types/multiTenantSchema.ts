/**
 * IPDS Ver 4.1.0 — Multi-Tenant Database Schema Definitions & Contracts
 * FPMSB Enterprise Topography Compliance
 */

// 1. Organizational Hierarchy Models
export interface OrgMacroZone {
  id: string; // e.g. 'MACRO_ZONE_SELATAN'
  name: string;
  created_at?: string;
}

export interface OrgRegion {
  id: string; // e.g. 'REG_JOHOR_BAHRU'
  macro_zone_id: string;
  name: string;
  created_at?: string;
}

export interface OrgOpZone {
  id: string; // e.g. 'OP_ZONE_ADELA'
  region_id: string;
  name: string;
  created_at?: string;
}

export interface OrgEstate {
  id: string; // e.g. 'FPM_TUNGGAL', 'FPM_ADELA'
  op_zone_id: string;
  name: string;
  total_area_ha: number;
  is_active: boolean;
  created_at?: string;
}

export interface OrgDivision {
  id: string; // e.g. 'FPM_ADELA_DIV1'
  estate_id: string;
  name: string;
  created_at?: string;
}

// 2. The 8 Core Operational Multi-Tenant Table Models

// Table 1: Hasil & ABW Records
export interface HasilAbwRecord {
  id: string;
  estate_id: string; // MANDATORY TENANT ISOLATION KEY
  blok: string;
  peringkat?: string;
  tarikh: string; // YYYY-MM-DD
  bunch_count: number;
  sample_weight_kg: number;
  abw_kg: number;
  total_tan: number;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
}

// Table 2: Hantaran & Weighbridge Resit
export interface HantaranResitRecord {
  id: string;
  no_resit: string;
  estate_id: string; // MANDATORY TENANT ISOLATION KEY
  no_lori: string;
  no_seal?: string;
  no_nota_hantaran?: string;
  kpg?: string;
  kpa?: number;
  blok: string;
  tan: number;
  muda: number;
  reject?: number;
  rm_mt?: number;
  tarikh: string; // YYYY-MM-DD
  masa_masuk?: string;
  is_efb?: boolean;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
}

// Table 3: Pruning Progress
export interface PruningProgressRecord {
  id: string;
  estate_id: string; // MANDATORY TENANT ISOLATION KEY
  blok: string;
  luas_hek: number;
  pusingan: number;
  tarikh_mula: string;
  tarikh_siap?: string;
  hek_siap: number;
  workers_count: number;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
}

// Table 4: Merumput Progress
export interface MerumputProgressRecord {
  id: string;
  estate_id: string; // MANDATORY TENANT ISOLATION KEY
  blok: string;
  luas: number;
  pusingan: number;
  jenis: string;
  tarikh_mula: string;
  tarikh_siap?: string;
  hek_siap: number;
  workers_count: number;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
}

// Table 5: Merumput Chemical & Herbicide Inventory
export interface MerumputInventoryRecord {
  id: string;
  estate_id: string; // MANDATORY TENANT ISOLATION KEY
  item_code: string;
  item_name: string;
  category: string;
  unit: string;
  stok_semasa: number;
  paras_minimum: number;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
}

// Table 6: Pekerja & Worker Management
export interface PekerjaRecord {
  id: string;
  estate_id: string; // MANDATORY TENANT ISOLATION KEY
  worker_no: string;
  name: string;
  role: string;
  is_active: boolean;
  negara_asal?: string;
  kumpulan?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
}

// Table 7: Kualiti BTS & Grading
export interface KualitiBtsRecord {
  id: string;
  estate_id: string; // MANDATORY TENANT ISOLATION KEY
  tajuk?: string;
  program?: string;
  jenis_grading?: string;
  tarikh: string;
  peringkat_blok?: string;
  no_lori?: string;
  nama_penggred?: string;
  total_di_gred: number;
  total_di_tinggal: number;
  total_di_bawa: number;
  platforms?: Array<Record<string, unknown>>;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface GradingTaskRecord {
  id: string;
  estate_id: string;
  task_date: string;
  block: string;
  rank: number;
  source_window_start: string;
  source_window_end: string;
  cumulative_bts_muda: number;
  source_receipt_count: number;
  status: 'OPEN' | 'FIELD_RESOLVED' | 'FINAL_VERIFIED';
  grading_session_id?: string;
  field_grade?: string;
  field_muda_count?: number;
  field_lorry?: string;
  matched_receipt_id?: string;
  matched_no_resit?: string;
  mill_muda?: number;
  mill_kpg?: number;
  mill_kpa?: number;
  kpg_achieved?: boolean;
  field_resolved_at?: string;
  final_verified_at?: string;
  created_at?: string;
  updated_at?: string;
}

// Table 8: Observability Audit Logs
export interface ObservabilityAuditLog {
  id: string;
  estate_id: string; // MANDATORY TENANT ISOLATION KEY
  event_type: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  actor_id?: string;
  module?: string;
  payload?: Record<string, unknown>;
  timestamp: string;
}

// Table 9: Kiosk Staff Identities
export interface KioskIdentityRecord {
  id: string;
  operator_id: string;
  staff_no_hash: string;
  app_role: string;
  estate_id: string; // MANDATORY TENANT ISOLATION KEY
  kiosk_id: string;
  station_name: string;
  operator_name: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
}

// Helper utility to enforce estate context validation
export function assertTenantContext(estateId?: string | null): string {
  if (!estateId || estateId.trim() === '') {
    throw new Error('MULTITENANT_SECURITY_ERROR: Missing estate_id tenant context');
  }
  return estateId.trim();
}
