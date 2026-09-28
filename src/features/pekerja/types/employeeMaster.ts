export type EmploymentStatus = 
  | 'ACTIVE' 
  | 'PROBATION' 
  | 'INACTIVE' 
  | 'RETIRED' 
  | 'TERMINATED' 
  | 'RESIGNED';

export type PositionCategory = 
  | 'MANAGEMENT' 
  | 'SUPERVISORY' 
  | 'FIELD_STAFF' 
  | 'GENERAL_WORKER'
  | 'EXECUTIVE';

export type AssignmentStatus = 
  | 'ACTIVE' 
  | 'TRANSFERRED' 
  | 'EXPIRED' 
  | 'CANCELLED';

export type AssignmentRole = 
  | 'PRIMARY' 
  | 'SECONDARY' 
  | 'ACTING' 
  | 'TEMPORARY';

export interface OrgPosition {
  id: string;
  tenant_id: string;
  code: string;
  title: string;
  category: PositionCategory;
  department: string;
  is_active: boolean;
}

export interface OrgBlock {
  id: string;
  tenant_id: string;
  estate_id: string;
  division_id?: string;
  block_code: string;
  crop_type?: string;
  hectarage: number;
  planting_year?: number;
  is_active: boolean;
}

export interface EmployeeAssignmentBlock {
  id: string;
  assignment_id: string;
  block_id: string;
  block_code?: string;
  hectarage?: number;
}

export interface EmployeeAssignment {
  id: string;
  tenant_id: string;
  employee_id: string;
  company_id: string;
  company_name?: string;
  estate_id: string;
  estate_name?: string;
  division_id?: string;
  division_name?: string;
  assignment_role: AssignmentRole;
  status: AssignmentStatus;
  effective_from: string; // YYYY-MM-DD
  effective_to?: string | null; // YYYY-MM-DD
  transfer_reason?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  blocks?: OrgBlock[];
}

export interface EmployeeMaster {
  id: string;
  tenant_id: string;
  staff_no: string;
  full_name: string;
  position_id: string;
  position?: OrgPosition;
  employment_status: EmploymentStatus;
  id_card_passport?: string;
  contact_number?: string;
  email?: string;
  hire_date: string;
  end_date?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
  // Current active assignment projection
  current_assignment?: EmployeeAssignment | null;
}

export interface CreateEmployeePayload {
  staff_no: string;
  full_name: string;
  position_id: string;
  employment_status: EmploymentStatus;
  id_card_passport?: string;
  contact_number?: string;
  email?: string;
  hire_date: string;
  // Initial assignment payload
  estate_id: string;
  division_id?: string;
  block_ids?: string[];
}

export interface TransferEmployeePayload {
  employee_id: string;
  estate_id: string;
  division_id?: string;
  block_ids: string[];
  assignment_role?: AssignmentRole;
  effective_from: string;
  transfer_reason?: string;
}
