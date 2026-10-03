import { supabase } from '../../../services/supabaseClient';
import { safeFetch } from '../../../utils/safeFetch';
import { 
  EmployeeMaster, 
  OrgPosition, 
  EmployeeAssignment, 
  OrgBlock, 
  CreateEmployeePayload, 
  TransferEmployeePayload,
  EmploymentStatus,
  PositionCategory,
  AssignmentStatus
} from '../types/employeeMaster';
import { ESTATES_REGISTRY } from '../../../config/estateRegistry';

const LOCAL_STORAGE_KEY_EMPLOYEES = 'ipds_master_employees_v1';
const LOCAL_STORAGE_KEY_ASSIGNMENTS = 'ipds_master_assignments_v1';

export const DEFAULT_POSITIONS: OrgPosition[] = [
  {
    id: '20000000-0000-0000-0000-000000000001',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    code: 'FC',
    title: 'Field Controller (FC)',
    category: 'MANAGEMENT',
    department: 'PENTADBIRAN',
    is_active: true
  },
  {
    id: '20000000-0000-0000-0000-000000000002',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    code: 'AFC',
    title: 'Asst. Field Controller (AFC)',
    category: 'MANAGEMENT',
    department: 'OPERASI',
    is_active: true
  },
  {
    id: '20000000-0000-0000-0000-000000000003',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    code: 'FS',
    title: 'Field Supervisor (FS)',
    category: 'SUPERVISORY',
    department: 'OPERASI',
    is_active: true
  },
  {
    id: '20000000-0000-0000-0000-000000000004',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    code: 'KK',
    title: 'Kerani Kewangan',
    category: 'FIELD_STAFF',
    department: 'KEWANGAN',
    is_active: true
  },
  {
    id: '20000000-0000-0000-0000-000000000005',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    code: 'KSB',
    title: 'Kerani Stok Dan Bekalan',
    category: 'FIELD_STAFF',
    department: 'STOR & BEKALAN',
    is_active: true
  },
  {
    id: '20000000-0000-0000-0000-000000000006',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    code: 'KR',
    title: 'Kerani Resit',
    category: 'FIELD_STAFF',
    department: 'PENTADBIRAN',
    is_active: true
  },
  {
    id: '20000000-0000-0000-0000-000000000007',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    code: 'MDR',
    title: 'Mandur',
    category: 'SUPERVISORY',
    department: 'PENUAIAN',
    is_active: true
  }
];

export const DEFAULT_DIVISIONS: { id: string; estate_id: string; name: string }[] = [
  { id: 'DIV_TGL_P1', estate_id: 'FPM_TUNGGAL', name: 'Peringkat 1 (P1 - Sawit Matang)' },
  { id: 'DIV_TGL_P2', estate_id: 'FPM_TUNGGAL', name: 'Peringkat 2 (P2 - Tanam Semula)' },
  { id: 'DIV_ADL_P1', estate_id: 'FPM_ADELA', name: 'Peringkat 1 (P1 - Sawit Matang)' },
  { id: 'DIV_ADL_P2', estate_id: 'FPM_ADELA', name: 'Peringkat 2 (P2 - Tanam Semula)' },
  { id: 'DIV_KLD_P1', estate_id: 'FPM_KLEDANG', name: 'Peringkat 1 (P1)' },
  { id: 'DIV_SNG_P1', estate_id: 'FPM_SENING', name: 'Peringkat 1 (P1)' },
  { id: 'DIV_WJB_HQ', estate_id: 'WILAYAH_JB', name: 'Pejabat Wilayah Johor Bahru' },
];

export function getBlocksForEstate(estateId: string, divisionId?: string): OrgBlock[] {
  const normEstate = estateId === '5136' ? 'FPM_ADELA' :
                     estateId === '5176' ? 'FPM_KLEDANG' :
                     estateId === '5156' ? 'FPM_SENING' :
                     estateId === 'WJB' || estateId === '0001' ? 'WILAYAH_JB' :
                     (estateId || 'FPM_TUNGGAL');
                     
  const config = ESTATES_REGISTRY[normEstate] || ESTATES_REGISTRY['FPM_TUNGGAL'];
  if (!config || !config.blocks) return [];

  const defaultDiv1 = 
    normEstate === 'FPM_ADELA' ? 'DIV_ADL_P1' :
    normEstate === 'FPM_KLEDANG' ? 'DIV_KLD_P1' :
    normEstate === 'FPM_SENING' ? 'DIV_SNG_P1' :
    normEstate === 'WILAYAH_JB' ? 'DIV_WJB_HQ' : 'DIV_TGL_P1';

  const defaultDiv2 = 
    normEstate === 'FPM_ADELA' ? 'DIV_ADL_P2' :
    normEstate === 'FPM_KLEDANG' ? 'DIV_KLD_P1' :
    normEstate === 'FPM_SENING' ? 'DIV_SNG_P1' :
    normEstate === 'WILAYAH_JB' ? 'DIV_WJB_HQ' : 'DIV_TGL_P2';

  return Object.entries(config.blocks).map(([code, b]) => {
    const isPkt1 = b.pkt === '001';
    const inferredDiv = isPkt1 ? defaultDiv1 : defaultDiv2;
    return {
      id: `blk-${normEstate}-${code}`,
      tenant_id: '00000000-0000-0000-0000-000000000001',
      estate_id: normEstate,
      division_id: inferredDiv,
      block_code: `B${b.blok.padStart(2, '0')}`,
      hectarage: Number(b.luas.toFixed(2)),
      crop_type: 'OIL_PALM',
      planting_year: isPkt1 ? 2012 : 2018,
      is_active: true
    };
  }).filter(b => !divisionId || b.division_id === divisionId);
}

const DEFAULT_EMPLOYEES: EmployeeMaster[] = [
  // ==========================================
  // 1. FPM TUNGGAL (STAFF OPERASI LADANG TUNGGAL)
  // ==========================================
  {
    id: '50000000-0000-0000-0000-000000000001',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    staff_no: 'STF00101',
    full_name: 'Zulkifli bin Ismail',
    position_id: '20000000-0000-0000-0000-000000000001',
    position: DEFAULT_POSITIONS[0],
    employment_status: 'ACTIVE',
    id_card_passport: '780412-01-5431',
    contact_number: '019-7123456',
    email: 'zulkifli@fpm.felda.gov.my',
    hire_date: '2015-03-01',
    created_at: '2026-01-01T08:00:00Z',
    current_assignment: {
      id: 'asg-001',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      employee_id: '50000000-0000-0000-0000-000000000001',
      company_id: '10000000-0000-0000-0000-000000000001',
      company_name: 'Felda Palm Industries & Management (FPMSB)',
      estate_id: 'FPM_TUNGGAL',
      estate_name: 'FPM Tunggal',
      division_id: 'DIV_TGL_P1',
      division_name: 'Peringkat 1 (P1 - Sawit Matang)',
      assignment_role: 'PRIMARY',
      status: 'ACTIVE',
      effective_from: '2026-01-01',
      effective_to: null,
      transfer_reason: 'Pengurusan Utama Seluruh Ladang',
      blocks: []
    }
  },
  {
    id: '50000000-0000-0000-0000-000000000002',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    staff_no: 'STF00102',
    full_name: 'Razali bin Othman',
    position_id: '20000000-0000-0000-0000-000000000002',
    position: DEFAULT_POSITIONS[1],
    employment_status: 'ACTIVE',
    id_card_passport: '840618-01-6123',
    contact_number: '013-7890123',
    email: 'razali@fpm.felda.gov.my',
    hire_date: '2018-06-15',
    created_at: '2026-01-01T08:00:00Z',
    current_assignment: {
      id: 'asg-002',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      employee_id: '50000000-0000-0000-0000-000000000002',
      company_id: '10000000-0000-0000-0000-000000000001',
      company_name: 'FPMSB',
      estate_id: 'FPM_TUNGGAL',
      estate_name: 'FPM Tunggal',
      division_id: 'DIV_TGL_P1',
      division_name: 'Peringkat 1 (P1 - Sawit Matang)',
      assignment_role: 'PRIMARY',
      status: 'ACTIVE',
      effective_from: '2026-01-01',
      effective_to: null,
      transfer_reason: 'Penolong Pengurus Bahagian Operasi',
      blocks: []
    }
  },
  {
    id: '50000000-0000-0000-0000-000000000003',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    staff_no: 'STF00103',
    full_name: 'Mohd Farhan bin Salleh',
    position_id: '20000000-0000-0000-0000-000000000003',
    position: DEFAULT_POSITIONS[2],
    employment_status: 'ACTIVE',
    id_card_passport: '900223-01-5987',
    contact_number: '017-6543210',
    email: 'farhan@fpm.felda.gov.my',
    hire_date: '2020-01-10',
    created_at: '2026-01-01T08:00:00Z',
    current_assignment: {
      id: 'asg-003',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      employee_id: '50000000-0000-0000-0000-000000000003',
      company_id: '10000000-0000-0000-0000-000000000001',
      company_name: 'FPMSB',
      estate_id: 'FPM_TUNGGAL',
      estate_name: 'FPM Tunggal',
      division_id: 'DIV_TGL_P1',
      division_name: 'Peringkat 1 (P1 - Sawit Matang)',
      assignment_role: 'PRIMARY',
      status: 'ACTIVE',
      effective_from: '2026-01-01',
      effective_to: null,
      transfer_reason: 'Penyelia Lapangan P1',
      blocks: [
        { id: 'blk-FPM_TUNGGAL-1', tenant_id: '00000000-0000-0000-0000-000000000001', estate_id: 'FPM_TUNGGAL', division_id: 'DIV_TGL_P1', block_code: 'B01', hectarage: 72.15, is_active: true },
        { id: 'blk-FPM_TUNGGAL-2', tenant_id: '00000000-0000-0000-0000-000000000001', estate_id: 'FPM_TUNGGAL', division_id: 'DIV_TGL_P1', block_code: 'B02', hectarage: 68.37, is_active: true },
        { id: 'blk-FPM_TUNGGAL-3', tenant_id: '00000000-0000-0000-0000-000000000001', estate_id: 'FPM_TUNGGAL', division_id: 'DIV_TGL_P1', block_code: 'B03', hectarage: 76.59, is_active: true }
      ]
    }
  },
  {
    id: '50000000-0000-0000-0000-000000000004',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    staff_no: 'STF00125',
    full_name: 'Ahmad bin Ali',
    position_id: '20000000-0000-0000-0000-000000000007',
    position: DEFAULT_POSITIONS[6], // Mandur
    employment_status: 'ACTIVE',
    id_card_passport: '881105-01-5211',
    contact_number: '011-23456789',
    email: 'ahmad.ali@fpm.felda.gov.my',
    hire_date: '2021-04-01',
    created_at: '2026-01-01T08:00:00Z',
    current_assignment: {
      id: 'asg-004-active',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      employee_id: '50000000-0000-0000-0000-000000000004',
      company_id: '10000000-0000-0000-0000-000000000001',
      company_name: 'FPMSB',
      estate_id: 'FPM_TUNGGAL',
      estate_name: 'FPM Tunggal',
      division_id: 'DIV_TGL_P2',
      division_name: 'Peringkat 2 (P2 - Tanam Semula)',
      assignment_role: 'PRIMARY',
      status: 'ACTIVE',
      effective_from: '2026-07-01',
      effective_to: null,
      transfer_reason: 'Pertukaran Giliran Penuaian Peringkat 2 (Perancangan Operasi)',
      blocks: [
        { id: 'blk-FPM_TUNGGAL-20', tenant_id: '00000000-0000-0000-0000-000000000001', estate_id: 'FPM_TUNGGAL', division_id: 'DIV_TGL_P2', block_code: 'B20', hectarage: 68.62, is_active: true },
        { id: 'blk-FPM_TUNGGAL-21', tenant_id: '00000000-0000-0000-0000-000000000001', estate_id: 'FPM_TUNGGAL', division_id: 'DIV_TGL_P2', block_code: 'B21', hectarage: 24.26, is_active: true },
        { id: 'blk-FPM_TUNGGAL-22', tenant_id: '00000000-0000-0000-0000-000000000001', estate_id: 'FPM_TUNGGAL', division_id: 'DIV_TGL_P2', block_code: 'B22', hectarage: 65.29, is_active: true }
      ]
    }
  },
  {
    id: '50000000-0000-0000-0000-000000000005',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    staff_no: 'STF00105',
    full_name: 'Nurul Huda binti Ramli',
    position_id: '20000000-0000-0000-0000-000000000006',
    position: DEFAULT_POSITIONS[5], // Kerani Resit
    employment_status: 'ACTIVE',
    id_card_passport: '940819-01-5120',
    contact_number: '019-3334455',
    email: 'nurul.huda@fpm.felda.gov.my',
    hire_date: '2022-08-01',
    created_at: '2026-01-01T08:00:00Z',
    current_assignment: {
      id: 'asg-005',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      employee_id: '50000000-0000-0000-0000-000000000005',
      company_id: '10000000-0000-0000-0000-000000000001',
      company_name: 'FPMSB',
      estate_id: 'FPM_TUNGGAL',
      estate_name: 'FPM Tunggal',
      division_id: 'DIV_TGL_P1',
      division_name: 'Peringkat 1 (P1 - Sawit Matang)',
      assignment_role: 'PRIMARY',
      status: 'ACTIVE',
      effective_from: '2026-01-01',
      effective_to: null,
      transfer_reason: 'Kerani Resit & Timbang Pejabat Ladang',
      blocks: []
    }
  },

  // ==========================================
  // 2. FPM ADELA (STAFF OPERASI LADANG ADELA)
  // ==========================================
  {
    id: '50000000-0000-0000-0000-000000000021',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    staff_no: 'STF00201',
    full_name: 'Khairul Azman bin Daud',
    position_id: '20000000-0000-0000-0000-000000000001',
    position: DEFAULT_POSITIONS[0], // EM
    employment_status: 'ACTIVE',
    id_card_passport: '790515-01-5231',
    contact_number: '019-7812345',
    email: 'khairul.azman@fpm.felda.gov.my',
    hire_date: '2016-04-01',
    created_at: '2026-01-01T08:00:00Z',
    current_assignment: {
      id: 'asg-adl-001',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      employee_id: '50000000-0000-0000-0000-000000000021',
      company_id: '10000000-0000-0000-0000-000000000001',
      company_name: 'FPMSB',
      estate_id: 'FPM_ADELA',
      estate_name: 'FPM Adela',
      division_id: 'DIV_ADL_P1',
      division_name: 'Peringkat 1 (P1 - Sawit Matang)',
      assignment_role: 'PRIMARY',
      status: 'ACTIVE',
      effective_from: '2026-01-01',
      effective_to: null,
      transfer_reason: 'Pengurus Ladang FPM Adela',
      blocks: []
    }
  },
  {
    id: '50000000-0000-0000-0000-000000000022',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    staff_no: 'STF00202',
    full_name: 'Shahril bin Mat',
    position_id: '20000000-0000-0000-0000-000000000002',
    position: DEFAULT_POSITIONS[1], // AM
    employment_status: 'ACTIVE',
    id_card_passport: '861112-01-6345',
    contact_number: '013-7923456',
    email: 'shahril.mat@fpm.felda.gov.my',
    hire_date: '2019-02-15',
    created_at: '2026-01-01T08:00:00Z',
    current_assignment: {
      id: 'asg-adl-002',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      employee_id: '50000000-0000-0000-0000-000000000022',
      company_id: '10000000-0000-0000-0000-000000000001',
      company_name: 'FPMSB',
      estate_id: 'FPM_ADELA',
      estate_name: 'FPM Adela',
      division_id: 'DIV_ADL_P1',
      division_name: 'Peringkat 1 (P1 - Sawit Matang)',
      assignment_role: 'PRIMARY',
      status: 'ACTIVE',
      effective_from: '2026-01-01',
      effective_to: null,
      transfer_reason: 'Penolong Pengurus Ladang FPM Adela',
      blocks: []
    }
  },
  {
    id: '50000000-0000-0000-0000-000000000023',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    staff_no: 'STF00203',
    full_name: 'Borhan bin Kassim',
    position_id: '20000000-0000-0000-0000-000000000003',
    position: DEFAULT_POSITIONS[2], // FS
    employment_status: 'ACTIVE',
    id_card_passport: '910304-01-5789',
    contact_number: '017-7123987',
    email: 'borhan.kassim@fpm.felda.gov.my',
    hire_date: '2020-05-10',
    created_at: '2026-01-01T08:00:00Z',
    current_assignment: {
      id: 'asg-adl-003',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      employee_id: '50000000-0000-0000-0000-000000000023',
      company_id: '10000000-0000-0000-0000-000000000001',
      company_name: 'FPMSB',
      estate_id: 'FPM_ADELA',
      estate_name: 'FPM Adela',
      division_id: 'DIV_ADL_P1',
      division_name: 'Peringkat 1 (P1 - Sawit Matang)',
      assignment_role: 'PRIMARY',
      status: 'ACTIVE',
      effective_from: '2026-01-01',
      effective_to: null,
      transfer_reason: 'Penyelia Lapangan Adela P1',
      blocks: [
        { id: 'blk-FPM_ADELA-1', tenant_id: '00000000-0000-0000-0000-000000000001', estate_id: 'FPM_ADELA', division_id: 'DIV_ADL_P1', block_code: 'B01', hectarage: 70.50, is_active: true },
        { id: 'blk-FPM_ADELA-2', tenant_id: '00000000-0000-0000-0000-000000000001', estate_id: 'FPM_ADELA', division_id: 'DIV_ADL_P1', block_code: 'B02', hectarage: 65.20, is_active: true }
      ]
    }
  },
  {
    id: '50000000-0000-0000-0000-000000000024',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    staff_no: 'STF00225',
    full_name: 'Azman bin Jamil',
    position_id: '20000000-0000-0000-0000-000000000007',
    position: DEFAULT_POSITIONS[6], // Mandur
    employment_status: 'ACTIVE',
    id_card_passport: '870919-01-5341',
    contact_number: '012-7894561',
    email: 'azman.jamil@fpm.felda.gov.my',
    hire_date: '2019-08-01',
    created_at: '2026-01-01T08:00:00Z',
    current_assignment: {
      id: 'asg-adl-004',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      employee_id: '50000000-0000-0000-0000-000000000024',
      company_id: '10000000-0000-0000-0000-000000000001',
      company_name: 'FPMSB',
      estate_id: 'FPM_ADELA',
      estate_name: 'FPM Adela',
      division_id: 'DIV_ADL_P2',
      division_name: 'Peringkat 2 (P2 - Tanam Semula)',
      assignment_role: 'PRIMARY',
      status: 'ACTIVE',
      effective_from: '2026-01-01',
      effective_to: null,
      transfer_reason: 'Mandur Penuaian Peringkat 2',
      blocks: [
        { id: 'blk-FPM_ADELA-15', tenant_id: '00000000-0000-0000-0000-000000000001', estate_id: 'FPM_ADELA', division_id: 'DIV_ADL_P2', block_code: 'B15', hectarage: 62.10, is_active: true },
        { id: 'blk-FPM_ADELA-16', tenant_id: '00000000-0000-0000-0000-000000000001', estate_id: 'FPM_ADELA', division_id: 'DIV_ADL_P2', block_code: 'B16', hectarage: 58.40, is_active: true }
      ]
    }
  },
  {
    id: '50000000-0000-0000-0000-000000000025',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    staff_no: 'STF00205',
    full_name: 'Siti Aisyah binti Zainal',
    position_id: '20000000-0000-0000-0000-000000000004',
    position: DEFAULT_POSITIONS[3], // Kerani Kewangan
    employment_status: 'ACTIVE',
    id_card_passport: '951010-01-5998',
    contact_number: '018-9123456',
    email: 'siti.aisyah@fpm.felda.gov.my',
    hire_date: '2023-03-01',
    created_at: '2026-01-01T08:00:00Z',
    current_assignment: {
      id: 'asg-adl-005',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      employee_id: '50000000-0000-0000-0000-000000000025',
      company_id: '10000000-0000-0000-0000-000000000001',
      company_name: 'FPMSB',
      estate_id: 'FPM_ADELA',
      estate_name: 'FPM Adela',
      division_id: 'DIV_ADL_P1',
      division_name: 'Peringkat 1 (P1 - Sawit Matang)',
      assignment_role: 'PRIMARY',
      status: 'ACTIVE',
      effective_from: '2026-01-01',
      effective_to: null,
      transfer_reason: 'Kerani Kewangan Ladang Adela',
      blocks: []
    }
  },

  // ==========================================
  // 3. FPM KLEDANG (STAFF OPERASI LADANG KLEDANG)
  // ==========================================
  {
    id: '50000000-0000-0000-0000-000000000031',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    staff_no: 'STF00301',
    full_name: 'Hamzah bin Zakaria',
    position_id: '20000000-0000-0000-0000-000000000001',
    position: DEFAULT_POSITIONS[0], // EM
    employment_status: 'ACTIVE',
    id_card_passport: '810722-01-5111',
    contact_number: '019-7432190',
    email: 'hamzah.zakaria@fpm.felda.gov.my',
    hire_date: '2017-09-01',
    created_at: '2026-01-01T08:00:00Z',
    current_assignment: {
      id: 'asg-kld-001',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      employee_id: '50000000-0000-0000-0000-000000000031',
      company_id: '10000000-0000-0000-0000-000000000001',
      company_name: 'FPMSB',
      estate_id: 'FPM_KLEDANG',
      estate_name: 'FPM Kledang',
      division_id: 'DIV_KLD_P1',
      division_name: 'Peringkat 1 (P1)',
      assignment_role: 'PRIMARY',
      status: 'ACTIVE',
      effective_from: '2026-01-01',
      effective_to: null,
      transfer_reason: 'Pengurus Ladang FPM Kledang',
      blocks: []
    }
  },
  {
    id: '50000000-0000-0000-0000-000000000032',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    staff_no: 'STF00302',
    full_name: 'Idris bin Mansor',
    position_id: '20000000-0000-0000-0000-000000000003',
    position: DEFAULT_POSITIONS[2], // FS
    employment_status: 'ACTIVE',
    id_card_passport: '920815-01-5673',
    contact_number: '016-7234567',
    email: 'idris.mansor@fpm.felda.gov.my',
    hire_date: '2021-02-01',
    created_at: '2026-01-01T08:00:00Z',
    current_assignment: {
      id: 'asg-kld-002',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      employee_id: '50000000-0000-0000-0000-000000000032',
      company_id: '10000000-0000-0000-0000-000000000001',
      company_name: 'FPMSB',
      estate_id: 'FPM_KLEDANG',
      estate_name: 'FPM Kledang',
      division_id: 'DIV_KLD_P1',
      division_name: 'Peringkat 1 (P1)',
      assignment_role: 'PRIMARY',
      status: 'ACTIVE',
      effective_from: '2026-01-01',
      effective_to: null,
      transfer_reason: 'Penyelia Lapangan FPM Kledang',
      blocks: [
        { id: 'blk-FPM_KLEDANG-1', tenant_id: '00000000-0000-0000-0000-000000000001', estate_id: 'FPM_KLEDANG', division_id: 'DIV_KLD_P1', block_code: 'B01', hectarage: 75.00, is_active: true }
      ]
    }
  },
  {
    id: '50000000-0000-0000-0000-000000000033',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    staff_no: 'STF00325',
    full_name: 'Roslan bin Che Wan',
    position_id: '20000000-0000-0000-0000-000000000007',
    position: DEFAULT_POSITIONS[6], // Mandur
    employment_status: 'ACTIVE',
    id_card_passport: '890403-01-5233',
    contact_number: '011-8976543',
    email: 'roslan.chewan@fpm.felda.gov.my',
    hire_date: '2020-07-01',
    created_at: '2026-01-01T08:00:00Z',
    current_assignment: {
      id: 'asg-kld-003',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      employee_id: '50000000-0000-0000-0000-000000000033',
      company_id: '10000000-0000-0000-0000-000000000001',
      company_name: 'FPMSB',
      estate_id: 'FPM_KLEDANG',
      estate_name: 'FPM Kledang',
      division_id: 'DIV_KLD_P1',
      division_name: 'Peringkat 1 (P1)',
      assignment_role: 'PRIMARY',
      status: 'ACTIVE',
      effective_from: '2026-01-01',
      effective_to: null,
      transfer_reason: 'Mandur Lapangan Kledang',
      blocks: [
        { id: 'blk-FPM_KLEDANG-5', tenant_id: '00000000-0000-0000-0000-000000000001', estate_id: 'FPM_KLEDANG', division_id: 'DIV_KLD_P1', block_code: 'B05', hectarage: 69.40, is_active: true }
      ]
    }
  },
  {
    id: '50000000-0000-0000-0000-000000000034',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    staff_no: 'STF00305',
    full_name: 'Fadzilah binti Osman',
    position_id: '20000000-0000-0000-0000-000000000005',
    position: DEFAULT_POSITIONS[4], // Kerani Stok Dan Bekalan
    employment_status: 'ACTIVE',
    id_card_passport: '960212-01-5884',
    contact_number: '019-3217654',
    email: 'fadzilah.osman@fpm.felda.gov.my',
    hire_date: '2022-11-01',
    created_at: '2026-01-01T08:00:00Z',
    current_assignment: {
      id: 'asg-kld-004',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      employee_id: '50000000-0000-0000-0000-000000000034',
      company_id: '10000000-0000-0000-0000-000000000001',
      company_name: 'FPMSB',
      estate_id: 'FPM_KLEDANG',
      estate_name: 'FPM Kledang',
      division_id: 'DIV_KLD_P1',
      division_name: 'Peringkat 1 (P1)',
      assignment_role: 'PRIMARY',
      status: 'ACTIVE',
      effective_from: '2026-01-01',
      effective_to: null,
      transfer_reason: 'Kerani Stok Dan Bekalan FPM Kledang',
      blocks: []
    }
  },

  // ==========================================
  // 4. FPM SENING (STAFF OPERASI LADANG SENING)
  // ==========================================
  {
    id: '50000000-0000-0000-0000-000000000041',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    staff_no: 'STF00401',
    full_name: 'Mahadhir bin Ariffin',
    position_id: '20000000-0000-0000-0000-000000000001',
    position: DEFAULT_POSITIONS[0], // EM
    employment_status: 'ACTIVE',
    id_card_passport: '800611-01-5329',
    contact_number: '019-7564321',
    email: 'mahadhir.ariffin@fpm.felda.gov.my',
    hire_date: '2016-10-01',
    created_at: '2026-01-01T08:00:00Z',
    current_assignment: {
      id: 'asg-sng-001',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      employee_id: '50000000-0000-0000-0000-000000000041',
      company_id: '10000000-0000-0000-0000-000000000001',
      company_name: 'FPMSB',
      estate_id: 'FPM_SENING',
      estate_name: 'FPM Sening',
      division_id: 'DIV_SNG_P1',
      division_name: 'Peringkat 1 (P1)',
      assignment_role: 'PRIMARY',
      status: 'ACTIVE',
      effective_from: '2026-01-01',
      effective_to: null,
      transfer_reason: 'Pengurus Ladang FPM Sening',
      blocks: []
    }
  },
  {
    id: '50000000-0000-0000-0000-000000000042',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    staff_no: 'STF00402',
    full_name: 'Nazri bin Abu Bakar',
    position_id: '20000000-0000-0000-0000-000000000003',
    position: DEFAULT_POSITIONS[2], // FS
    employment_status: 'ACTIVE',
    id_card_passport: '930109-01-5821',
    contact_number: '017-8901234',
    email: 'nazri.abubakar@fpm.felda.gov.my',
    hire_date: '2021-06-01',
    created_at: '2026-01-01T08:00:00Z',
    current_assignment: {
      id: 'asg-sng-002',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      employee_id: '50000000-0000-0000-0000-000000000042',
      company_id: '10000000-0000-0000-0000-000000000001',
      company_name: 'FPMSB',
      estate_id: 'FPM_SENING',
      estate_name: 'FPM Sening',
      division_id: 'DIV_SNG_P1',
      division_name: 'Peringkat 1 (P1)',
      assignment_role: 'PRIMARY',
      status: 'ACTIVE',
      effective_from: '2026-01-01',
      effective_to: null,
      transfer_reason: 'Penyelia Lapangan FPM Sening',
      blocks: [
        { id: 'blk-FPM_SENING-1', tenant_id: '00000000-0000-0000-0000-000000000001', estate_id: 'FPM_SENING', division_id: 'DIV_SNG_P1', block_code: 'B01', hectarage: 72.00, is_active: true }
      ]
    }
  },
  {
    id: '50000000-0000-0000-0000-000000000043',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    staff_no: 'STF00425',
    full_name: 'Saiful Bahri bin Talib',
    position_id: '20000000-0000-0000-0000-000000000007',
    position: DEFAULT_POSITIONS[6], // Mandur
    employment_status: 'ACTIVE',
    id_card_passport: '880320-01-5199',
    contact_number: '013-8765432',
    email: 'saiful.bahri@fpm.felda.gov.my',
    hire_date: '2019-12-01',
    created_at: '2026-01-01T08:00:00Z',
    current_assignment: {
      id: 'asg-sng-003',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      employee_id: '50000000-0000-0000-0000-000000000043',
      company_id: '10000000-0000-0000-0000-000000000001',
      company_name: 'FPMSB',
      estate_id: 'FPM_SENING',
      estate_name: 'FPM Sening',
      division_id: 'DIV_SNG_P1',
      division_name: 'Peringkat 1 (P1)',
      assignment_role: 'PRIMARY',
      status: 'ACTIVE',
      effective_from: '2026-01-01',
      effective_to: null,
      transfer_reason: 'Mandur Penuaian Sening',
      blocks: [
        { id: 'blk-FPM_SENING-4', tenant_id: '00000000-0000-0000-0000-000000000001', estate_id: 'FPM_SENING', division_id: 'DIV_SNG_P1', block_code: 'B04', hectarage: 68.50, is_active: true }
      ]
    }
  },
  {
    id: '50000000-0000-0000-0000-000000000044',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    staff_no: 'STF00405',
    full_name: 'Halimah binti Sidek',
    position_id: '20000000-0000-0000-0000-000000000006',
    position: DEFAULT_POSITIONS[5], // Kerani Resit
    employment_status: 'ACTIVE',
    id_card_passport: '970425-01-5044',
    contact_number: '018-7654321',
    email: 'halimah.sidek@fpm.felda.gov.my',
    hire_date: '2023-01-15',
    created_at: '2026-01-01T08:00:00Z',
    current_assignment: {
      id: 'asg-sng-004',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      employee_id: '50000000-0000-0000-0000-000000000044',
      company_id: '10000000-0000-0000-0000-000000000001',
      company_name: 'FPMSB',
      estate_id: 'FPM_SENING',
      estate_name: 'FPM Sening',
      division_id: 'DIV_SNG_P1',
      division_name: 'Peringkat 1 (P1)',
      assignment_role: 'PRIMARY',
      status: 'ACTIVE',
      effective_from: '2026-01-01',
      effective_to: null,
      transfer_reason: 'Kerani Resit Ladang Sening',
      blocks: []
    }
  },

  // ==========================================
  // 5. WILAYAH JOHOR BAHRU (PEGAWAI WILAYAH JB)
  // ==========================================
  {
    id: '50000000-0000-0000-0000-000000000051',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    staff_no: 'STF00010',
    full_name: 'Irwan bin Rosli',
    position_id: '20000000-0000-0000-0000-000000000001',
    position: DEFAULT_POSITIONS[0], // EM
    employment_status: 'ACTIVE',
    id_card_passport: '770808-01-5121',
    contact_number: '019-7100010',
    email: 'irwan.rosli@fpm.felda.gov.my',
    hire_date: '2014-01-01',
    created_at: '2026-01-01T08:00:00Z',
    current_assignment: {
      id: 'asg-wjb-001',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      employee_id: '50000000-0000-0000-0000-000000000051',
      company_id: '10000000-0000-0000-0000-000000000001',
      company_name: 'FPMSB',
      estate_id: 'WILAYAH_JB',
      estate_name: 'FPM Wilayah Johor Bahru',
      division_id: 'DIV_WJB_HQ',
      division_name: 'Pejabat Wilayah Johor Bahru',
      assignment_role: 'PRIMARY',
      status: 'ACTIVE',
      effective_from: '2026-01-01',
      effective_to: null,
      transfer_reason: 'Pegawai Pengurusan Wilayah Johor Bahru',
      blocks: []
    }
  }
];

const DEFAULT_HISTORICAL_ASSIGNMENTS: EmployeeAssignment[] = [
  // Ahmad bin Ali's previous assignment in P1
  {
    id: 'asg-004-past',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    employee_id: '50000000-0000-0000-0000-000000000004',
    company_id: '10000000-0000-0000-0000-000000000001',
    company_name: 'FPMSB',
    estate_id: 'FPM_TUNGGAL',
    estate_name: 'FPM Tunggal',
    division_id: 'DIV_TGL_P1',
    division_name: 'Peringkat 1 (P1 - Sawit Matang)',
    assignment_role: 'PRIMARY',
    status: 'TRANSFERRED',
    effective_from: '2026-01-01',
    effective_to: '2026-06-30',
    transfer_reason: 'Penugasan Awal Mandur P1',
    created_at: '2026-01-01T08:00:00Z',
    created_by: 'Super Admin',
    blocks: [
      { id: 'blk-FPM_TUNGGAL-12', tenant_id: '00000000-0000-0000-0000-000000000001', estate_id: 'FPM_TUNGGAL', division_id: 'DIV_TGL_P1', block_code: 'B12', hectarage: 76.50, is_active: true },
      { id: 'blk-FPM_TUNGGAL-13', tenant_id: '00000000-0000-0000-0000-000000000001', estate_id: 'FPM_TUNGGAL', division_id: 'DIV_TGL_P1', block_code: 'B13', hectarage: 50.75, is_active: true },
      { id: 'blk-FPM_TUNGGAL-14', tenant_id: '00000000-0000-0000-0000-000000000001', estate_id: 'FPM_TUNGGAL', division_id: 'DIV_TGL_P1', block_code: 'B14', hectarage: 70.45, is_active: true }
    ]
  },
  // Ahmad bin Ali's current assignment in P2
  {
    id: 'asg-004-active',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    employee_id: '50000000-0000-0000-0000-000000000004',
    company_id: '10000000-0000-0000-0000-000000000001',
    company_name: 'FPMSB',
    estate_id: 'FPM_TUNGGAL',
    estate_name: 'FPM Tunggal',
    division_id: 'DIV_TGL_P2',
    division_name: 'Peringkat 2 (P2 - Tanam Semula)',
    assignment_role: 'PRIMARY',
    status: 'ACTIVE',
    effective_from: '2026-07-01',
    effective_to: null,
    transfer_reason: 'Pertukaran Giliran Penuaian Peringkat 2 (Perancangan Operasi)',
    created_at: '2026-07-01T08:00:00Z',
    created_by: 'FC Tunggal',
    blocks: [
      { id: 'blk-FPM_TUNGGAL-20', tenant_id: '00000000-0000-0000-0000-000000000001', estate_id: 'FPM_TUNGGAL', division_id: 'DIV_TGL_P2', block_code: 'B20', hectarage: 68.62, is_active: true },
      { id: 'blk-FPM_TUNGGAL-21', tenant_id: '00000000-0000-0000-0000-000000000001', estate_id: 'FPM_TUNGGAL', division_id: 'DIV_TGL_P2', block_code: 'B21', hectarage: 24.26, is_active: true },
      { id: 'blk-FPM_TUNGGAL-22', tenant_id: '00000000-0000-0000-0000-000000000001', estate_id: 'FPM_TUNGGAL', division_id: 'DIV_TGL_P2', block_code: 'B22', hectarage: 65.29, is_active: true }
    ]
  }
];

function syncEmployeePosition(emp: EmployeeMaster): boolean {
  let changed = false;
  const defMatch = DEFAULT_EMPLOYEES.find(d => d.staff_no === emp.staff_no);
  if (defMatch) {
    if (emp.position_id !== defMatch.position_id || emp.position?.title !== defMatch.position?.title) {
      emp.position_id = defMatch.position_id;
      emp.position = defMatch.position;
      changed = true;
    }
    return changed;
  }

  const curTitle = emp.position?.title || '';
  const curCode = emp.position?.code || '';

  if (curCode === 'EM' || curTitle.includes('Estate Manager') || curTitle.includes('Pengurus Ladang')) {
    emp.position_id = DEFAULT_POSITIONS[0].id;
    emp.position = DEFAULT_POSITIONS[0];
    changed = true;
  } else if (curCode === 'AM' || curTitle.includes('Assistant Manager') || curTitle.includes('Penolong Pengurus')) {
    emp.position_id = DEFAULT_POSITIONS[1].id;
    emp.position = DEFAULT_POSITIONS[1];
    changed = true;
  } else if (curCode === 'FS' || curTitle.includes('Field Supervisor') || curTitle.includes('Penyelia Lapangan')) {
    emp.position_id = DEFAULT_POSITIONS[2].id;
    emp.position = DEFAULT_POSITIONS[2];
    changed = true;
  } else if (curTitle.includes('Kerani Kewangan')) {
    emp.position_id = DEFAULT_POSITIONS[3].id;
    emp.position = DEFAULT_POSITIONS[3];
    changed = true;
  } else if (curTitle.includes('Stok') || curTitle.includes('Bekalan')) {
    emp.position_id = DEFAULT_POSITIONS[4].id;
    emp.position = DEFAULT_POSITIONS[4];
    changed = true;
  } else if (curTitle.includes('Resit')) {
    emp.position_id = DEFAULT_POSITIONS[5].id;
    emp.position = DEFAULT_POSITIONS[5];
    changed = true;
  } else if (curCode === 'MDR' || curTitle.toLowerCase().includes('mandur') || curTitle.toLowerCase().includes('mandore')) {
    emp.position_id = DEFAULT_POSITIONS[6].id;
    emp.position = DEFAULT_POSITIONS[6];
    changed = true;
  } else if (curCode === 'CLK' || curTitle.includes('Clerk') || curTitle.includes('Kerani')) {
    emp.position_id = DEFAULT_POSITIONS[5].id;
    emp.position = DEFAULT_POSITIONS[5];
    changed = true;
  } else {
    // Check if position_id matches any in DEFAULT_POSITIONS
    const matchPos = DEFAULT_POSITIONS.find(p => p.id === emp.position_id);
    if (matchPos && emp.position?.title !== matchPos.title) {
      emp.position = matchPos;
      changed = true;
    }
  }

  return changed;
}

function getStoredEmployees(): EmployeeMaster[] {
  if (typeof window === 'undefined') return DEFAULT_EMPLOYEES;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_EMPLOYEES);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_KEY_EMPLOYEES, JSON.stringify(DEFAULT_EMPLOYEES));
      return DEFAULT_EMPLOYEES;
    }
    const parsed: EmployeeMaster[] = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(LOCAL_STORAGE_KEY_EMPLOYEES, JSON.stringify(DEFAULT_EMPLOYEES));
      return DEFAULT_EMPLOYEES;
    }

    // Ensure all default employees for all estates exist in storage so non-Tunggal estates have their staff
    let updated = false;
    const existingStaffNos = new Set(parsed.map(e => e.staff_no));
    
    for (const defEmp of DEFAULT_EMPLOYEES) {
      if (!existingStaffNos.has(defEmp.staff_no)) {
        parsed.push(defEmp);
        updated = true;
      }
    }

    // Migrate all positions to the new 7 roles
    for (const emp of parsed) {
      if (syncEmployeePosition(emp)) {
        updated = true;
      }
    }

    if (updated) {
      localStorage.setItem(LOCAL_STORAGE_KEY_EMPLOYEES, JSON.stringify(parsed));
    }

    return parsed;
  } catch (_) {
    return DEFAULT_EMPLOYEES;
  }
}

function saveStoredEmployees(data: EmployeeMaster[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_EMPLOYEES, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('ipds_employees_updated', { detail: { count: data.length } }));
  } catch (_) {}
}

function getStoredAssignments(): EmployeeAssignment[] {
  if (typeof window === 'undefined') return DEFAULT_HISTORICAL_ASSIGNMENTS;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_ASSIGNMENTS);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_KEY_ASSIGNMENTS, JSON.stringify(DEFAULT_HISTORICAL_ASSIGNMENTS));
      return DEFAULT_HISTORICAL_ASSIGNMENTS;
    }
    return JSON.parse(raw);
  } catch (_) {
    return DEFAULT_HISTORICAL_ASSIGNMENTS;
  }
}

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function saveStoredAssignments(data: EmployeeAssignment[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_ASSIGNMENTS, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('ipds_employees_updated', { detail: { count: data.length } }));
  } catch (_) {}
}

/**
 * Intelligent LocalStorage-to-Supabase Synchronization Engine:
 * Compares employees currently saved in local browser storage against the remote Supabase / API list.
 * Any employee present locally but not yet on the server/Supabase is automatically uploaded.
 */
async function syncLocalEmployeesToRemote(
  localEmployees: EmployeeMaster[], 
  remoteEmployees: EmployeeMaster[]
): Promise<{ merged: EmployeeMaster[]; uploadedCount: number }> {
  const remoteStaffNos = new Set(
    remoteEmployees.map(r => r.staff_no?.trim().toUpperCase()).filter(Boolean)
  );

  // Find any local employee not yet recorded on remote
  const unSyncedLocal = localEmployees.filter(local => {
    const sNo = local.staff_no?.trim().toUpperCase();
    return sNo && !remoteStaffNos.has(sNo);
  });

  if (unSyncedLocal.length === 0) {
    return { merged: remoteEmployees, uploadedCount: 0 };
  }

  console.log(`[SYNC_ENGINE] Menemui ${unSyncedLocal.length} rekod kakitangan dalam localStorage yang belum wujud di Supabase. Menyegerak sekarang...`);

  let uploadedCount = 0;
  const merged = [...remoteEmployees];

  for (const emp of unSyncedLocal) {
    try {
      const asg = emp.current_assignment;
      const estateId = asg?.estate_id || 'FPM_TUNGGAL';
      const estateCfg = ESTATES_REGISTRY[estateId] || ESTATES_REGISTRY['FPM_TUNGGAL'];

      // 1. Post to Server Central API
      const resp = await safeFetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_no: emp.staff_no,
          full_name: emp.full_name,
          position_id: emp.position_id || emp.position?.id,
          position_code: emp.position?.code || 'GW',
          position_title: emp.position?.title || 'Staf Operasi',
          employment_status: emp.employment_status || 'ACTIVE',
          id_card_passport: emp.id_card_passport || '',
          contact_number: emp.contact_number || '',
          email: emp.email || '',
          hire_date: emp.hire_date || new Date().toISOString().split('T')[0],
          estate_id: estateId,
          estate_name: asg?.estate_name || estateCfg.name,
          division_id: asg?.division_id || 'DIV_TGL_P1',
          division_name: asg?.division_name || 'Peringkat 1',
          block_ids: (asg?.blocks || []).map(b => b.block_code)
        })
      });

      if (resp.ok) {
        uploadedCount++;
      }

      merged.push(emp);
    } catch (err) {
      console.warn('[SYNC_ENGINE] Notice syncing record to remote:', emp.staff_no, err);
      merged.push(emp);
    }
  }

  return { merged, uploadedCount };
}

export const employeeMasterService = {
  /**
   * Explicitly triggers synchronization from local storage to Supabase & Central API.
   */
  async syncLocalStorageToCloud(): Promise<{ uploadedCount: number; totalCount: number }> {
    const local = getStoredEmployees();
    let remote: EmployeeMaster[] = [];

    try {
      const resp = await safeFetch('/api/employees', { cache: 'no-cache' });
      if (resp.ok) {
        const json = await resp.json();
        if (json.success && Array.isArray(json.data)) {
          remote = json.data;
        }
      }
    } catch (_) {}

    const { merged, uploadedCount } = await syncLocalEmployeesToRemote(local, remote);
    saveStoredEmployees(merged);
    return { uploadedCount, totalCount: merged.length };
  },

  async getEmployees(): Promise<EmployeeMaster[]> {
    const localBefore = getStoredEmployees();

    // 1. Primary: Central Server API (synchronizes consistently across all devices, laptops & phones)
    try {
      const resp = await safeFetch('/api/employees', {
        headers: { 'Accept': 'application/json' },
        cache: 'no-cache'
      });
      if (resp.ok) {
        const result = await resp.json();
        if (result.success && Array.isArray(result.data) && result.data.length > 0) {
          const { merged } = await syncLocalEmployeesToRemote(localBefore, result.data);
          saveStoredEmployees(merged);
          return merged;
        }
      }
    } catch (apiErr) {
      console.warn('API /api/employees notice:', apiErr);
    }

    // 2. Secondary: Direct Supabase client query
    try {
      // First try live Supabase view
      const { data, error } = await supabase
        .from('v_current_employee_assignments')
        .select('*');

      if (!error && data && data.length > 0) {
        const mapped = data.map((row: any) => ({
          id: row.employee_id,
          tenant_id: row.tenant_id,
          staff_no: row.staff_no,
          full_name: row.full_name,
          position_id: '',
          position: {
            id: '',
            tenant_id: row.tenant_id,
            code: row.position_code,
            title: row.position_title,
            category: 'SUPERVISORY' as PositionCategory,
            department: 'OPERASI',
            is_active: true
          },
          employment_status: row.employment_status,
          hire_date: row.effective_from || '2026-01-01',
          current_assignment: row.assignment_id ? {
            id: row.assignment_id,
            tenant_id: row.tenant_id,
            employee_id: row.employee_id,
            company_id: row.company_id,
            company_name: row.company_name,
            estate_id: row.estate_id,
            estate_name: row.estate_name,
            division_id: row.division_id,
            division_name: row.division_name,
            assignment_role: row.assignment_role,
            status: (row.status || 'ACTIVE') as AssignmentStatus,
            effective_from: row.effective_from,
            blocks: (row.assigned_blocks || []).map((b: any) => ({
              id: b.block_id,
              tenant_id: row.tenant_id,
              estate_id: row.estate_id,
              block_code: b.block_code,
              hectarage: b.hectarage,
              is_active: true
            }))
          } : null
        }));
        const { merged } = await syncLocalEmployeesToRemote(localBefore, mapped);
        saveStoredEmployees(merged);
        return merged;
      }
    } catch (e) {
      // Supabase unavailable, fallback to local storage
    }

    return getStoredEmployees();
  },

  async getPositions(): Promise<OrgPosition[]> {
    try {
      const { data, error } = await supabase
        .from('org_positions')
        .select('*')
        .eq('is_active', true)
        .order('id', { ascending: true });
      if (!error && data && data.length > 0) {
        return data as OrgPosition[];
      }
    } catch (_) {}
    return DEFAULT_POSITIONS;
  },

  async getAssignmentHistory(employeeId: string): Promise<EmployeeAssignment[]> {
    try {
      const { data, error } = await supabase
        .from('employee_assignments')
        .select(`
          *,
          org_estates (name),
          org_divisions (name),
          companies (name),
          employee_assignment_blocks (
            org_blocks (id, block_code, hectarage)
          )
        `)
        .eq('employee_id', employeeId)
        .order('effective_from', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map((r: any) => ({
          id: r.id,
          tenant_id: r.tenant_id,
          employee_id: r.employee_id,
          company_id: r.company_id,
          company_name: r.companies?.name,
          estate_id: r.estate_id,
          estate_name: r.org_estates?.name,
          division_id: r.division_id,
          division_name: r.org_divisions?.name,
          assignment_role: r.assignment_role,
          status: r.status,
          effective_from: r.effective_from,
          effective_to: r.effective_to,
          transfer_reason: r.transfer_reason,
          created_at: r.created_at,
          created_by: r.created_by,
          blocks: (r.employee_assignment_blocks || []).map((b: any) => b.org_blocks).filter(Boolean)
        }));
      }
    } catch (_) {}

    const allStored = getStoredAssignments();
    return allStored.filter(a => a.employee_id === employeeId);
  },

  async createEmployee(payload: CreateEmployeePayload): Promise<EmployeeMaster> {
    const positions = await this.getPositions();
    const pos = positions.find(p => p.id === payload.position_id) || positions[0];
    const estateCfg = ESTATES_REGISTRY[payload.estate_id] || ESTATES_REGISTRY['FPM_TUNGGAL'];
    const division = DEFAULT_DIVISIONS.find(d => d.id === payload.division_id);

    const newId = generateUUID();
    const newAsgId = generateUUID();

    // Phase 6C — block identity, block_code and hectarage belong to
    // public.org_blocks. create_employee_with_assignment() (20261008) persists
    // the resolved rows and the API response returns them; the client must not
    // manufacture block UUIDs, hectarage or database identity.
    const blocks: OrgBlock[] = [];

    const newEmployee: EmployeeMaster = {
      id: newId,
      tenant_id: '00000000-0000-0000-0000-000000000001',
      staff_no: payload.staff_no.trim().toUpperCase(),
      full_name: payload.full_name.trim(),
      position_id: payload.position_id,
      position: pos,
      employment_status: payload.employment_status,
      id_card_passport: payload.id_card_passport,
      contact_number: payload.contact_number,
      email: payload.email,
      hire_date: payload.hire_date,
      created_at: new Date().toISOString(),
      current_assignment: {
        id: newAsgId,
        tenant_id: '00000000-0000-0000-0000-000000000001',
        employee_id: newId,
        company_id: '10000000-0000-0000-0000-000000000001',
        company_name: 'FPMSB',
        estate_id: payload.estate_id,
        estate_name: estateCfg.name,
        division_id: payload.division_id,
        division_name: division?.name,
        assignment_role: 'PRIMARY',
        status: 'ACTIVE',
        effective_from: payload.hire_date,
        effective_to: null,
        transfer_reason: 'Penugasan Awal Pendaftaran',
        blocks
      }
    };

    // 1. Post to Central Server API (Ensures cross-device visibility immediately)
    let persisted: EmployeeMaster = newEmployee;
    try {
      const resp = await safeFetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_no: newEmployee.staff_no,
          full_name: newEmployee.full_name,
          position_id: payload.position_id,
          position_code: pos?.code || 'GW',
          position_title: pos?.title || 'Staf Operasi',
          employment_status: newEmployee.employment_status,
          id_card_passport: newEmployee.id_card_passport,
          contact_number: newEmployee.contact_number,
          email: newEmployee.email,
          hire_date: newEmployee.hire_date,
          estate_id: payload.estate_id,
          estate_name: estateCfg.name,
          division_id: payload.division_id,
          division_name: division?.name,
          block_ids: payload.block_ids
        })
      });

      // Adopt the authoritative database ids issued by the server RPC.
      if (resp.ok) {
        const result: any = await resp.json().catch(() => null);
        const serverRecord = result && result.success ? result.data : null;
        const serverEmployeeId = typeof serverRecord?.id === 'string' ? serverRecord.id.trim() : '';
        const serverAssignmentId = typeof serverRecord?.current_assignment?.id === 'string'
          ? serverRecord.current_assignment.id.trim()
          : '';

        // Phase 6C: the persisted org_blocks rows are the single source of
        // truth. Adopt exactly what the server returned; when the response
        // carries no block list (or the call failed) the locally empty list is
        // kept, so no phantom block state is ever created.
        const serverBlocks = Array.isArray(serverRecord?.current_assignment?.blocks)
          ? (serverRecord.current_assignment.blocks as OrgBlock[])
          : null;

        if (serverEmployeeId) {
          persisted = {
            ...newEmployee,
            id: serverEmployeeId,
            current_assignment: newEmployee.current_assignment
              ? {
                  ...newEmployee.current_assignment,
                  id: serverAssignmentId || newEmployee.current_assignment.id,
                  employee_id: serverEmployeeId,
                  blocks: serverBlocks ?? newEmployee.current_assignment.blocks
                }
              : newEmployee.current_assignment
          };
        }
      }
    } catch (apiErr) {
      console.warn('API sync notice for new employee:', apiErr);
    }

    // 2. Save to local storage cache
    const current = getStoredEmployees();
    current.unshift(persisted);
    saveStoredEmployees(current);

    // Also record in assignment history
    if (persisted.current_assignment) {
      const asgs = getStoredAssignments();
      asgs.unshift(persisted.current_assignment);
      saveStoredAssignments(asgs);
    }

    return persisted;
  },

  async transferAssignment(payload: TransferEmployeePayload): Promise<EmployeeMaster> {
    const employees = getStoredEmployees();
    const emp = employees.find(e => e.id === payload.employee_id);
    if (!emp) throw new Error('Staf tidak dijumpai.');

    const estateCfg = ESTATES_REGISTRY[payload.estate_id] || ESTATES_REGISTRY['FPM_TUNGGAL'];
    const division = DEFAULT_DIVISIONS.find(d => d.id === payload.division_id);

    const newBlocks: OrgBlock[] = (payload.block_ids || []).map(code => ({
      id: `blk-${payload.estate_id}-${code}`,
      tenant_id: '00000000-0000-0000-0000-000000000001',
      estate_id: payload.estate_id,
      division_id: payload.division_id,
      block_code: code,
      hectarage: 50.0,
      is_active: true
    }));

    const assignments = getStoredAssignments();

    // 1. Close current active assignment
    const yesterday = new Date(payload.effective_from);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (emp.current_assignment) {
      emp.current_assignment.status = 'TRANSFERRED';
      emp.current_assignment.effective_to = yesterdayStr;

      // update in assignment storage
      const existingIdx = assignments.findIndex(a => a.id === emp.current_assignment?.id);
      if (existingIdx !== -1) {
        assignments[existingIdx].status = 'TRANSFERRED';
        assignments[existingIdx].effective_to = yesterdayStr;
      }
    }

    // 2. Create new active assignment
    const newAsg: EmployeeAssignment = {
      id: `asg-${Date.now()}`,
      tenant_id: '00000000-0000-0000-0000-000000000001',
      employee_id: emp.id,
      company_id: '10000000-0000-0000-0000-000000000001',
      company_name: 'FPMSB',
      estate_id: payload.estate_id,
      estate_name: estateCfg.name,
      division_id: payload.division_id,
      division_name: division?.name,
      assignment_role: payload.assignment_role || 'PRIMARY',
      status: 'ACTIVE',
      effective_from: payload.effective_from,
      effective_to: null,
      transfer_reason: payload.transfer_reason || 'Pertukaran Penugasan Operasi',
      created_at: new Date().toISOString(),
      blocks: newBlocks
    };

    emp.current_assignment = newAsg;
    assignments.unshift(newAsg);

    saveStoredAssignments(assignments);
    saveStoredEmployees(employees);

    return emp;
  },

  async updateEmploymentStatus(employeeId: string, status: EmploymentStatus, reason?: string): Promise<void> {
    const employees = getStoredEmployees();
    const emp = employees.find(e => e.id === employeeId);
    if (!emp) throw new Error('Staf tidak dijumpai.');

    emp.employment_status = status;
    if (['RETIRED', 'TERMINATED', 'RESIGNED'].includes(status)) {
      emp.end_date = new Date().toISOString().split('T')[0];
      if (emp.current_assignment) {
        emp.current_assignment.status = 'EXPIRED';
        emp.current_assignment.effective_to = emp.end_date;
      }
    }

    saveStoredEmployees(employees);

    try {
      await safeFetch(`/api/employees/${employeeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employment_status: status })
      });
    } catch (_) {}
  }
};
