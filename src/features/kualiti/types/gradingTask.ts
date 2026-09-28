export type GradingTaskStatus = 'OPEN' | 'FIELD_RESOLVED' | 'FINAL_VERIFIED';

export interface GradingTask {
  id: string;
  estate_id: string;
  task_date: string;
  block: string;
  rank: number;
  source_window_start: string;
  source_window_end: string;
  cumulative_bts_muda: number;
  source_receipt_count: number;
  status: GradingTaskStatus;
  grading_session_id?: string | null;
  field_grade?: string | null;
  field_muda_count?: number | null;
  field_lorry?: string | null;
  field_resolved_at?: string | null;
  matched_receipt_id?: string | null;
  matched_no_resit?: string | null;
  mill_muda?: number | null;
  mill_kpg?: number | null;
  mill_kpa?: number | null;
  kpg_achieved?: boolean | null;
  final_verified_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GradingTaskContext {
  id: string;
  taskDate: string;
  estateId: string;
  block: string;
}
