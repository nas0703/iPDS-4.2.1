export interface Transaction {
  id?: string | number;
  no_resit: string;
  no_akaun_terima?: string;
  no_lori: string;
  no_seal?: string;
  no_nota_hantaran?: string;
  kpg?: string;
  kpa?: number;
  blok: string;
  tan: number;
  muda: number;
  reject?: number;
  sample?: number;
  rm_mt?: number;
  hasil_rm?: number;
  thek?: number;
  tarikh: string;
  masa_masuk?: string;
  created_at?: string;
  peringkat?: string;
  is_efb?: boolean;
  estate_id?: string;
  kod_penjual?: string;
  nama_penjual?: string;
  kod_projek?: string;
  kod_akaun_bts?: string;
}

export type ReportType =
  | "hasil"
  | "kualiti_bts"
  | "muda"
  | "kpa_kpg"
  | "efb"
  | "harga"
  | "baja"
  | "pruning"
  | "merumput"
  | "efc_format"
  | "pekerja";

export interface HujanRecord {
  bulan: string;
  [year: string]: number | string | null;
}

export interface CompressedEvidence {
  citationId: string;
  document: string;
  category: string;
  page: number;
  section: string;
  chunkIndex: number;
  evidence: string;
  evidenceType: 'table' | 'paragraph' | 'formula' | 'rule';
  rrfScore: number;
}

export type CompressedEvidenceChunk = CompressedEvidence;
