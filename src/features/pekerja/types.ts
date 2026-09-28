export interface Worker {
  id: string;
  worker_no: string;
  name: string;
  role: string;
  is_active?: boolean;
  negara_asal?: string; // e.g. "Malaysia", "Indonesia", "Bangladesh", "Nepal", "India"
  kumpulan?: string;    // e.g. "Gredding", "Kerja Am dan Lain-lain", "Membaja", etc.
}

export type AttendanceStatus = 'Hadir' | 'Tidak Hadir' | 'Cuti' | 'Sakit' | 'Cuti Mingguan' | 'Cuti Umum';

export interface AttendanceRecord {
  id?: string;
  worker_id: string;
  date: string;
  status: AttendanceStatus;
  created_by?: string;
  created_at?: string;
  worker?: Worker; // In case we join
}

export interface WorkAssignment {
  id?: string;
  worker_id: string;
  date: string;
  work_type: string;
  blok: string;
  peringkat: string;
  notes: string;
  created_at?: string;
  worker?: Worker; // Join
  local_id?: string;
}

export interface CheckrollJobRow {
  id: string;
  code: string; // e.g., 'MB', 'MR', 'PP', 'MN', 'BR', 'RC'
  work_type: string; // e.g. 'Membaja', 'Merumput', 'Pangkas Pelepah', 'Menuai'
  unit: string; // e.g. 'beg', 'hektar', 'tan', 'hari'
  rate: number; // e.g. 1.20, 12.00, 175.00, 38.00
  dailyQuantities: { [day: number]: number }; // day 1..31 -> qty
}

export interface CheckrollDeduction {
  id: string;
  description: string;
  amount: number;
}

export interface CheckrollRecord {
  worker_id: string;
  month: string; // 'YYYY-MM'
  estate_code: string;
  jobRows: CheckrollJobRow[];
  deductions: CheckrollDeduction[];
  prepared_by?: string;
  reviewed_by?: string;
  approved_by?: string;
  payment_date?: string;
}
