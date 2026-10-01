/**
 * iPDS v4.1.0 — Employees & Master Staff API Routes
 * Enterprise-grade multi-tenant staff management with Supabase and local persistence fallback.
 */

import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { requireAuth, requireRole, isSuperAdminIdentity } from '../middleware/auth.js';
import { getScopedSupabase, isMissingTableError } from '../db.js';
import { auditService } from '../services/audit.service.js';

const router = express.Router();

export const EMPLOYEE_WRITE_ROLES = ['pf', 'fc'] as const;
const EMPLOYMENT_STATUSES = ['ACTIVE', 'PROBATION', 'INACTIVE', 'RETIRED', 'TERMINATED', 'RESIGNED'];
const MAX_BLOCK_IDS = 200;

function getUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function isCrossEstateViewer(user: unknown): boolean {
  const identity = user as { app_metadata?: { app_role?: string | null } } | null | undefined;
  const role = (identity?.app_metadata?.app_role || '').toLowerCase().trim();
  return isSuperAdminIdentity(identity) || role === 'rc' || role === 'oc';
}

function cleanOptionalString(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function sanitizeBlockIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const code = item.trim();
    if (!code || code.length > 50 || seen.has(code)) continue;
    seen.add(code);
    result.push(code);
    if (result.length >= MAX_BLOCK_IDS) break;
  }
  return result;
}

const EMPLOYEE_PROTECTED_UPDATE_KEYS = [
  'estate_id', 'estateId', 'tenant_id', 'tenantId', 'id', 'employee_id', 'employeeId',
  'current_assignment', 'position', 'position_id', 'created_at', 'updated_at'
];

function hasProtectedEmployeeUpdateKey(updates: unknown): boolean {
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) return false;
  return Object.keys(updates as Record<string, unknown>)
    .some((key) => EMPLOYEE_PROTECTED_UPDATE_KEYS.includes(key));
}

function buildSanitizedEmployeeUpdate(updates: any): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) return sanitized;

  if (typeof updates.full_name === 'string') {
    const value = cleanOptionalString(updates.full_name, 255);
    if (value) sanitized.full_name = value;
  }
  if (typeof updates.employment_status === 'string') {
    const value = String(updates.employment_status).toUpperCase();
    if (EMPLOYMENT_STATUSES.includes(value)) sanitized.employment_status = value;
  }
  if (typeof updates.contact_number === 'string') {
    sanitized.contact_number = cleanOptionalString(updates.contact_number, 50);
  }
  if (typeof updates.email === 'string') {
    sanitized.email = cleanOptionalString(updates.email, 255);
  }

  return sanitized;
}

const LOCAL_INACTIVE_STATUSES = ['INACTIVE', 'RETIRED', 'TERMINATED', 'RESIGNED'];

function isActiveLocalEmployee(record: any): boolean {
  if (!record || !record.id) return false;
  if (record.is_deleted === true) return false;
  const status = String(record.employment_status || '').toUpperCase();
  return !LOCAL_INACTIVE_STATUSES.includes(status);
}

function dedupeEmployeesById(list: any[]): any[] {
  const map = new Map<string, any>();
  for (const item of Array.isArray(list) ? list : []) {
    if (item && item.id) map.set(String(item.id), item);
  }
  return Array.from(map.values());
}

function scopeLocalEmployees(list: any[], estateId: string | null): any[] {
  const active = dedupeEmployeesById(list).filter(isActiveLocalEmployee);
  if (!estateId) return active;
  return active.filter((e) => String(e?.current_assignment?.estate_id || '').toUpperCase() === estateId);
}

function reconcileLocalEmployees(existing: any[], authoritative: any[], scopeEstate: string | null): any[] {
  const normalizedExisting = dedupeEmployeesById(existing);
  const normalizedIncoming = dedupeEmployeesById(authoritative);
  if (!scopeEstate) {
    return normalizedIncoming;
  }
  const retained = normalizedExisting.filter(
    (e) => String(e?.current_assignment?.estate_id || '').toUpperCase() !== scopeEstate
  );
  return dedupeEmployeesById([...retained, ...normalizedIncoming]);
}

let DATA_DIR = path.join(process.cwd(), 'data');
if (process.env.VERCEL || process.env.NOW_REGION) {
  DATA_DIR = '/tmp';
}
const EMPLOYEES_FILE = path.join(DATA_DIR, 'employees.json');

function getLocalEmployees(): any[] {
  try {
    if (fs.existsSync(EMPLOYEES_FILE)) {
      const raw = fs.readFileSync(EMPLOYEES_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading local employees file:', err);
  }
  return [];
}

function saveLocalEmployees(list: any[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(EMPLOYEES_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving local employees file:', err);
  }
}

async function isEmployeeWithinEstate(
  supabase: any,
  employeeId: string,
  estateId: string,
  user: unknown
): Promise<boolean> {
  if (isCrossEstateViewer(user)) return true;
  if (!supabase) return false;
  try {
    const { data, error } = await supabase
      .from('employee_assignments')
      .select('estate_id')
      .eq('employee_id', employeeId)
      .eq('status', 'ACTIVE');
    if (error) return false;
    if (!Array.isArray(data) || data.length === 0) return false;
    return data.some((row: any) => String(row?.estate_id || '').toUpperCase() === estateId);
  } catch {
    return false;
  }
}

/**
 * GET /api/employees
 * Retrieve all employees with their current active assignments
 */
router.get('/employees', requireAuth, async (req: Request, res: Response) => {
  try {
    const requestedEstate = String(req.estateId || 'FPM_TUNGGAL').trim().toUpperCase();
    const explicitEstate = String(
      (req.headers['x-estate-id'] as string) || req.query?.estate_id || req.query?.estateId || ''
    ).trim().toUpperCase();
    const crossEstate = isCrossEstateViewer(req.user);

    let scopeEstate: string | null;
    if (!crossEstate) {
      scopeEstate = requestedEstate === 'ALL' ? null : requestedEstate;
    } else if (requestedEstate === 'ALL' || !explicitEstate) {
      scopeEstate = null;
    } else {
      scopeEstate = requestedEstate;
    }

    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    if (supabase) {
      let query = supabase.from('v_current_employee_assignments').select('*');
      if (scopeEstate) {
        query = query.eq('estate_id', scopeEstate);
      }
      const { data, error } = await query;

      if (!error) {
        const mappedRaw = (data || []).map((row: any) => ({
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
            category: 'SUPERVISORY',
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
            status: 'ACTIVE',
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

        const mapped = dedupeEmployeesById(mappedRaw);

        saveLocalEmployees(reconcileLocalEmployees(getLocalEmployees(), mapped, scopeEstate));

        return res.json({
          success: true,
          source: 'supabase',
          data: mapped
        });
      }
    }

    const local = scopeLocalEmployees(getLocalEmployees(), scopeEstate);
    return res.json({
      success: true,
      source: 'local_storage',
      data: local
    });
  } catch (err: any) {
    console.error('Error fetching employees:', err);
    const requestedEstate = String(req.estateId || 'FPM_TUNGGAL').trim().toUpperCase();
    const local = scopeLocalEmployees(
      getLocalEmployees(),
      isCrossEstateViewer(req.user) ? null : (requestedEstate === 'ALL' ? null : requestedEstate)
    );
    return res.json({
      success: true,
      source: 'fallback',
      data: local
    });
  }
});

/**
 * POST /api/employees
 * Register new employee and assign to estate/division
 */
router.post('/employees', requireRole([...EMPLOYEE_WRITE_ROLES]), async (req: Request, res: Response) => {
  try {
    const payload = req.body || {};

    const staffNo = cleanOptionalString(payload.staff_no, 50).toUpperCase();
    const fullName = cleanOptionalString(payload.full_name, 255);
    const estateId = String(req.estateId || '').trim().toUpperCase();

    if (!staffNo || !fullName) {
      return res.status(400).json({
        success: false,
        error: 'No. Staf dan Nama Penuh adalah mandatori.'
      });
    }

    if (!estateId || estateId === 'ALL') {
      return res.status(400).json({
        success: false,
        error: 'Konteks ladang diperlukan untuk mendaftar staf.',
        code: 'ESTATE_CONTEXT_REQUIRED'
      });
    }

    const employmentStatus = EMPLOYMENT_STATUSES.includes(String(payload.employment_status || '').toUpperCase())
      ? String(payload.employment_status).toUpperCase()
      : 'ACTIVE';
    const positionId = cleanOptionalString(payload.position_id, 64);
    const positionCode = cleanOptionalString(payload.position_code, 50) || 'GW';
    const positionTitle = cleanOptionalString(payload.position_title, 150) || 'Staf Operasi';
    const idCardPassport = cleanOptionalString(payload.id_card_passport, 50);
    const contactNumber = cleanOptionalString(payload.contact_number, 50);
    const email = cleanOptionalString(payload.email, 255);
    const hireDate = cleanOptionalString(payload.hire_date, 20) || new Date().toISOString().split('T')[0];
    const divisionId = cleanOptionalString(payload.division_id, 64) || 'DIV_TGL_P1';
    const divisionName = cleanOptionalString(payload.division_name, 150) || 'Peringkat 1';
    const estateName = cleanOptionalString(payload.estate_name, 150) || estateId;
    const blockIds = sanitizeBlockIds(payload.block_ids);

    const employeeId = getUUID();
    const assignmentId = getUUID();
    const tenantId = '00000000-0000-0000-0000-000000000001';
    const companyId = '10000000-0000-0000-0000-000000000001';

    // Assignment blocks are NOT fabricated here. The RPC persists the resolved
    // org_blocks rows (P6B-1); the persisted rows are read back below and pushed
    // into this array, which newEmployeeRecord shares.
    const blocks: any[] = [];

    const newEmployeeRecord = {
      id: employeeId,
      tenant_id: tenantId,
      staff_no: staffNo,
      full_name: fullName,
      position_id: positionId || '20000000-0000-0000-0000-000000000006',
      position: {
        id: positionId || '20000000-0000-0000-0000-000000000006',
        tenant_id: tenantId,
        code: positionCode,
        title: positionTitle,
        category: 'SUPERVISORY',
        department: 'OPERASI',
        is_active: true
      },
      employment_status: employmentStatus,
      id_card_passport: idCardPassport,
      contact_number: contactNumber,
      email,
      hire_date: hireDate,
      created_at: new Date().toISOString(),
      current_assignment: {
        id: assignmentId,
        tenant_id: tenantId,
        employee_id: employeeId,
        company_id: companyId,
        company_name: 'Felda Palm Industries & Management Sdn Bhd',
        estate_id: estateId,
        estate_name: estateName,
        division_id: divisionId,
        division_name: divisionName,
        assignment_role: 'PRIMARY',
        status: 'ACTIVE',
        effective_from: hireDate,
        effective_to: null,
        transfer_reason: 'Pendaftaran Awal Staf Baharu',
        blocks
      }
    };

    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: 'Storan pekerja tidak tersedia. Pendaftaran dibatalkan.',
        code: 'EMPLOYEE_STORE_UNAVAILABLE'
      });
    }

    let rpcError: any = null;
    let rpcRow: any = null;
    try {
      let posIdToUse: string | null = null;

      if (positionId && positionId.includes('-')) {
        const { data: directPos } = await supabase
          .from('org_positions')
          .select('id')
          .eq('id', positionId)
          .maybeSingle();
        if (directPos && directPos.id) {
          posIdToUse = directPos.id;
        }
      }

      if (!posIdToUse && positionCode) {
        const { data: codePos } = await supabase
          .from('org_positions')
          .select('id')
          .ilike('code', `%${positionCode}%`)
          .limit(1);
        if (codePos && codePos[0]?.id) {
          posIdToUse = codePos[0].id;
        }
      }

      if (!posIdToUse && positionTitle) {
        const searchWord = positionTitle.replace(/[()]/g, ' ').trim().split(/\s+/)[0];
        if (searchWord && searchWord.length >= 2) {
          const { data: titlePos } = await supabase
            .from('org_positions')
            .select('id')
            .ilike('title', `%${searchWord}%`)
            .limit(1);
          if (titlePos && titlePos[0]?.id) {
            posIdToUse = titlePos[0].id;
          }
        }
      }

      if (!posIdToUse) {
        const { data: anyPos } = await supabase
          .from('org_positions')
          .select('id')
          .limit(1);
        if (anyPos && anyPos[0]?.id) {
          posIdToUse = anyPos[0].id;
        }
      }

      if (!posIdToUse) {
        const defaultPosId = '20000000-0000-0000-0000-000000000001';
        await supabase.from('org_positions').upsert([{
          id: defaultPosId,
          tenant_id: tenantId,
          code: 'EM',
          title: 'Estate Manager (Pengurus Ladang)',
          category: 'MANAGEMENT',
          department: 'PENTADBIRAN',
          is_active: true
        }], { onConflict: 'id' });
        posIdToUse = defaultPosId;
      }

      const { data: rpcData, error: createError } = await supabase.rpc('create_employee_with_assignment', {
        p_tenant_id: tenantId,
        p_company_id: companyId,
        p_position_id: posIdToUse,
        p_staff_no: newEmployeeRecord.staff_no,
        p_full_name: newEmployeeRecord.full_name,
        p_employment_status: employmentStatus,
        p_id_card_passport: idCardPassport,
        p_contact_number: contactNumber,
        p_email: email,
        p_hire_date: hireDate,
        p_estate_id: estateId,
        p_division_id: divisionId,
        p_assignment_role: 'PRIMARY',
        p_effective_from: hireDate,
        p_transfer_reason: null,
        // Additive optional parameter (P6B-1). Only sent when block codes were
        // supplied, so a database that has not yet applied 20261008 keeps
        // working for block-less employee creation.
        ...(blockIds.length > 0 ? { p_block_ids: blockIds } : {})
      });

      rpcError = createError || null;
      rpcRow = Array.isArray(rpcData) ? rpcData[0] : rpcData;

      // Schema Cache Fallback: If RPC function is not yet registered in live Supabase database
      // Restricted to block-less creation: reporting success while dropping a
      // requested block selection would hide invalid persistence (P6B-1).
      if (blockIds.length === 0 && rpcError && (
        rpcError.code === 'PGRST202' ||
        isMissingTableError(rpcError) ||
        String(rpcError.message || '').includes('schema cache') ||
        String(rpcError.message || '').includes('Could not find the function')
      )) {
        console.warn('[EMPLOYEE_ROUTE] RPC create_employee_with_assignment not found in schema cache. Falling back to local store...');
        const fallbackEmpId = newEmployeeRecord.id || getUUID();
        const fallbackAsgId = newEmployeeRecord.current_assignment?.id || getUUID();
        rpcRow = { employee_id: fallbackEmpId, assignment_id: fallbackAsgId };
        rpcError = null;
      }
    } catch (dbErr: any) {
      console.error('Database write error for employee:', dbErr);
      return res.status(500).json({
        success: false,
        error: 'Gagal mendaftar staf pada pangkalan data.',
        code: 'EMPLOYEE_CREATE_FAILED'
      });
    }

    if (rpcError) {
      console.warn('create_employee_with_assignment RPC error:', rpcError.message);
      return res.status(500).json({
        success: false,
        error: 'Gagal mendaftar staf pada pangkalan data.',
        code: 'EMPLOYEE_CREATE_FAILED'
      });
    }

    if (!rpcRow || !rpcRow.employee_id) {
      return res.status(500).json({
        success: false,
        error: 'Gagal mendaftar staf pada pangkalan data.',
        code: 'EMPLOYEE_CREATE_FAILED'
      });
    }

    newEmployeeRecord.id = rpcRow.employee_id;
    newEmployeeRecord.current_assignment.employee_id = rpcRow.employee_id;
    if (rpcRow.assignment_id) {
      newEmployeeRecord.current_assignment.id = rpcRow.assignment_id;
    }

    // P6B-1: read back the blocks the RPC actually persisted (via the scoped
    // client, so RLS applies) rather than echoing client-supplied codes or
    // fabricating ids. An empty result can never mask a validation failure,
    // because an invalid block aborts the RPC before this point.
    if (blockIds.length > 0 && rpcRow.assignment_id) {
      try {
        const { data: blockRows } = await supabase
          .from('employee_assignment_blocks')
          .select('block_id, org_blocks (id, block_code, hectarage, division_id, is_active)')
          .eq('assignment_id', rpcRow.assignment_id);

        if (Array.isArray(blockRows)) {
          for (const row of blockRows as any[]) {
            const ob = row?.org_blocks;
            if (!ob || !ob.block_code) continue;
            blocks.push({
              id: ob.id ?? row.block_id,
              tenant_id: tenantId,
              estate_id: estateId,
              division_id: ob.division_id ?? null,
              block_code: ob.block_code,
              hectarage: ob.hectarage ?? 0,
              is_active: ob.is_active ?? true
            });
          }
        }
      } catch (blockReadErr: any) {
        console.warn('[EMPLOYEE_ROUTE] Persisted block read-back failed:', blockReadErr?.message || blockReadErr);
      }
    }

    saveLocalEmployees(reconcileLocalEmployees(getLocalEmployees(), [newEmployeeRecord], estateId));

    auditService.record({
      requestId: req.headers['x-request-id'] as string,
      userId: req.user?.app_metadata.operator_id || req.user?.sub,
      userName: req.user?.user_metadata.operator_name,
      role: req.user?.app_metadata.app_role,
      authorizedEstate: estateId,
      action: 'SENSITIVE_RECORD_CREATE',
      resource: 'employees',
      resourceId: newEmployeeRecord.id,
      result: 'SUCCESS',
      ip: req.ip || (req.headers['x-forwarded-for'] as string),
      userAgent: req.headers['user-agent'] || 'unknown',
      details: { staff_no: staffNo, estate_id: estateId }
    });

    return res.status(201).json({
      success: true,
      message: `Staf ${newEmployeeRecord.full_name} berjaya didaftarkan.`,
      data: newEmployeeRecord
    });
  } catch (err: any) {
    console.error('Error creating employee:', err);
    return res.status(500).json({
      success: false,
      error: 'Gagal mendaftar staf baharu.'
    });
  }
});

/**
 * PUT /api/employees/:id
 * Update existing employee
 */
router.put('/employees/:id', requireRole([...EMPLOYEE_WRITE_ROLES]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    const estateId = String(req.estateId || '').trim().toUpperCase();

    if (!estateId || estateId === 'ALL') {
      return res.status(400).json({
        success: false,
        error: 'Konteks ladang diperlukan untuk mengemaskini staf.',
        code: 'ESTATE_CONTEXT_REQUIRED'
      });
    }

    if (hasProtectedEmployeeUpdateKey(updates)) {
      return res.status(400).json({
        success: false,
        error: 'Medan kemaskini tidak dibenarkan.',
        code: 'INVALID_UPDATE_FIELDS'
      });
    }

    const sanitizedUpdates = buildSanitizedEmployeeUpdate(updates);
    if (Object.keys(sanitizedUpdates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Tiada medan kemaskini yang sah.',
        code: 'NO_VALID_UPDATE_FIELDS'
      });
    }

    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: 'Storan pekerja tidak tersedia. Kemaskini dibatalkan.',
        code: 'EMPLOYEE_STORE_UNAVAILABLE'
      });
    }

    const authorized = await isEmployeeWithinEstate(supabase, id, estateId, req.user);
    if (!authorized) {
      return res.status(403).json({
        success: false,
        error: 'Akses dinafikan: Staf ini bukan di bawah ladang anda.',
        code: 'FORBIDDEN_ESTATE'
      });
    }

    const { error: dbError } = await supabase
      .from('employees')
      .update({ ...sanitizedUpdates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (dbError) {
      console.warn('Supabase employee update error:', dbError.message);
      return res.status(500).json({
        success: false,
        error: 'Gagal mengemaskini staf pada pangkalan data.',
        code: 'EMPLOYEE_UPDATE_FAILED'
      });
    }

    const local = getLocalEmployees();
    const idx = local.findIndex(e => e.id === id);
    if (idx >= 0) {
      local[idx] = { ...local[idx], ...sanitizedUpdates };
      saveLocalEmployees(local);
    }

    auditService.record({
      requestId: req.headers['x-request-id'] as string,
      userId: req.user?.app_metadata.operator_id || req.user?.sub,
      userName: req.user?.user_metadata.operator_name,
      role: req.user?.app_metadata.app_role,
      authorizedEstate: estateId,
      action: 'SENSITIVE_RECORD_UPDATE',
      resource: 'employees',
      resourceId: id,
      result: 'SUCCESS',
      ip: req.ip || (req.headers['x-forwarded-for'] as string),
      userAgent: req.headers['user-agent'] || 'unknown'
    });

    return res.json({
      success: true,
      message: 'Maklumat staf berjaya dikemaskini.'
    });
  } catch (err: any) {
    console.error('Error updating employee:', err);
    return res.status(500).json({
      success: false,
      error: 'Gagal mengemaskini staf.'
    });
  }
});

/**
 * DELETE /api/employees/:id
 * Set status to INACTIVE or soft delete
 */
router.delete('/employees/:id', requireRole([...EMPLOYEE_WRITE_ROLES]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const estateId = String(req.estateId || '').trim().toUpperCase();

    if (!estateId || estateId === 'ALL') {
      return res.status(400).json({
        success: false,
        error: 'Konteks ladang diperlukan untuk menyahaktifkan staf.',
        code: 'ESTATE_CONTEXT_REQUIRED'
      });
    }

    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: 'Storan pekerja tidak tersedia. Nyahaktif dibatalkan.',
        code: 'EMPLOYEE_STORE_UNAVAILABLE'
      });
    }

    const authorized = await isEmployeeWithinEstate(supabase, id, estateId, req.user);
    if (!authorized) {
      return res.status(403).json({
        success: false,
        error: 'Akses dinafikan: Staf ini bukan di bawah ladang anda.',
        code: 'FORBIDDEN_ESTATE'
      });
    }

    const { error: dbError } = await supabase
      .from('employees')
      .update({
        employment_status: 'INACTIVE',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (dbError) {
      console.warn('Supabase employee delete error:', dbError.message);
      return res.status(500).json({
        success: false,
        error: 'Gagal menyahaktifkan staf pada pangkalan data.',
        code: 'EMPLOYEE_DELETE_FAILED'
      });
    }

    const local = getLocalEmployees();
    const filtered = local.map(e => e.id === id ? { ...e, employment_status: 'INACTIVE' } : e);
    saveLocalEmployees(filtered);

    auditService.record({
      requestId: req.headers['x-request-id'] as string,
      userId: req.user?.app_metadata.operator_id || req.user?.sub,
      userName: req.user?.user_metadata.operator_name,
      role: req.user?.app_metadata.app_role,
      authorizedEstate: estateId,
      action: 'SENSITIVE_RECORD_DELETE',
      resource: 'employees',
      resourceId: id,
      result: 'SUCCESS',
      ip: req.ip || (req.headers['x-forwarded-for'] as string),
      userAgent: req.headers['user-agent'] || 'unknown'
    });

    return res.json({
      success: true,
      message: 'Staf telah dinyahaktifkan.'
    });
  } catch (err: any) {
    console.error('Error deleting employee:', err);
    return res.status(500).json({
      success: false,
      error: 'Gagal memadam staf.'
    });
  }
});

export default router;
